// MCP-bridge — de VIER DOCUMENT-TOOLS (taak T21, spec §Tool-set Documenten regel 90, §Sessie-
// semantiek/drift-anker regel 116, WP4 regel 57).
//
// `list_documents` / `new_document` / `duplicate_document` / `switch_document`. De AI sluit bewust
// GEEN documenten en beslist niet over opslaan (spec regel 90) — die tools bestaan hier dus niet.
//
// Drie ontwerpbesluiten die de spec-regels vertalen:
//
//  1. DRIFT-ANKER. `new_document`, `duplicate_document` en `switch_document` verzetten het anker
//     (`bindExpectedDoc`) ná hun documentwissel, zodat de eerstvolgende mutatie tegen het nieuwe
//     document ankert. Of een tool ZELF eerst op drift faalt, hangt af van of hij de INHOUD van het
//     actieve document gebruikt:
//       - `duplicate_document` doet dat (hij kopieert het actieve document) ⇒ volle
//         `guardNonTransactional` incl. drift-check: dupliceren van het verkeerde document zou een
//         onopgemerkt verkeerde variant opleveren.
//       - `switch_document` is per spec (regel 116) juist de BEVESTIGING die drift oplost en mag dus
//         nooit zelf op drift falen.
//       - `new_document` maakt een leeg document; de inhoud van het actieve document doet er niet
//         toe en het anker gaat sowieso mee. Geen drift-check.
//  2. GEEN TRANSACTIE. Documentwissels zijn geen planningsmutaties: ze pushen geen undo-snapshot en
//     horen niet in `runInMcpTransaction` (dat zou een snapshot van het VERKEERDE document nemen).
//     Daarom de veiligheidsvlag-guards los, via `guardBridgeFlags` hieronder.
//  3. GEEN AI-BACKUP. Spec regel 130: document-tools triggeren zelf géén auto-backup; hun `kind` is
//     `'document'` (alleen `'mutate'`/`'batch'` triggeren). Wel MOET `duplicate_document` het nieuwe
//     document als "duplicate-born" registreren (T16-contract) — via dezelfde contextbinding die
//     ook de volgende backupbeslissing neemt.
//
// Batch-uitsluiting: spec regel 100 sluit document-tools uit van `batch` ⇒ `batchable: false` op alle
// vier (ook op de leestool `list_documents`, die als document-tool meeloopt).

import type { AppState } from '@/state/appStore';
import { bindExpectedDoc, buildEnvelope, guardNonTransactional, mcpDocumentTitle, preBackupGuards, runReadTool, toolError } from './runtime';
import type { McpContext, McpToolAnnotations, McpToolDef, McpToolErr, McpToolResult } from '../contracts';

// --- Gedeelde veiligheidsvlag-guard --------------------------------------------------------------

/**
 * Pauze → alleen-lezen → dialoog: EXACT dezelfde guards en volgorde als
 * `runMutateTool`/`guardNonTransactional` (spec §UI/veiligheid 128-132), maar ZONDER de drift-check
 * en zonder transactie/backup — die is hier per tool verschillend (zie de kopcomment).
 *
 * Bewust een dunne doorgeefpost naar de ÉNE guard-implementatie in `runtime.ts`
 * (`preBackupGuards`, daarvoor geëxporteerd) in plaats van een tweede kopie. Een kopie zou (a) de
 * guard-volgorde kunnen laten afdrijven en (b) — zoals de review terecht ving — de spec-eis missen
 * dat de DIALOG_OPEN-fout BENOEMT wélke dialoog blokkeert; die naamgeving zit in de runtime-versie.
 *
 * Waarom óók `readOnly` op tools die de planning niet wijzigen: fail-closed. Een document aanmaken/
 * wisselen of een bestand wegschrijven zijn zichtbare neveneffecten op de werkomgeving van de user;
 * "alleen-lezen" hoort dan te betekenen dat de AI niets doet behalve lezen.
 *
 * Gedeeld met `fileTools.ts` (zelfde T21-baan).
 */
export function guardBridgeFlags(ctx: McpContext): McpToolErr | null {
  return preBackupGuards(ctx);
}

// --- list_documents ------------------------------------------------------------------------------

/** Eén regel in `list_documents`. Compact: velden die niet van toepassing zijn ontbreken. */
interface DocumentRow {
  id: string;
  title: string;
  isActive: boolean;
  isDirty: boolean;
  taskCount: number;
  /** Projectanker (`project.startDate`) — waar de planning vanaf rekent. */
  projectStart: string;
  /** Berekend projecteinde (`cpmResult.projectEnd`); ontbreekt zonder (geldig) rekenresultaat. */
  projectEnd?: string;
  /** Alleen aanwezig (en dan `true`) wanneer er nog nooit gerekend is: `cpmResult == null`. */
  notCalculated?: true;
  /** Alleen aanwezig wanneer er wél gerekend is maar met een fout (kringverwijzing) — dát is de
   *  reden dat `projectEnd` ontbreekt, en die reden mag niet als "niet doorgerekend" wegvallen. */
  calculationError?: string;
}

/**
 * Alle open documenten met hun verrijkte kop-gegevens (spec regel 90).
 *
 * Het "niet doorgerekend"-signaal komt uit `cpmResult == null` en NADRUKKELIJK niet uit
 * `scheduleStale`. De twee vlaggen beantwoorden verschillende vragen: `scheduleStale` zegt of de
 * uitkomst nog kán kloppen, `cpmResult == null` of er überhaupt een uitkomst ís. Een document dat
 * verouderd is maar wél een `cpmResult` draagt, is doorgerekend — alleen niet meer actueel — en
 * hoort dus géén "niet doorgerekend" te melden; er is immers een (verouderde) einddatum te tonen.
 * Op `scheduleStale` sturen zou dat verwarren, in beide richtingen.
 *
 * (Sinds `5e4b85a` markeert `restoreDocuments` een via crash-herstel teruggekomen document bewust
 * ALS verouderd; daarvóór was dat `scheduleStale === false` mét `cpmResult === null`. Die
 * gedragswijziging raakt deze afleiding niet — juist omdat ze niet op `scheduleStale` leunt.)
 *
 * Titels komen uit `getOpenDocuments()` — dezelfde afleiding als de tabbladen (bestandsnaam zonder
 * extensie, anders de projectnaam), zodat er één bron voor de titel blijft. Een NAAMLOOS document
 * levert daar bewust een lege titel; `mcpDocumentTitle` zet daar de vaste Engelse terugval
 * `MCP_UNTITLED_TITLE` (+ volgnummer bij meerdere naamloze) voor in de plaats, zodat de AI-client
 * nooit een lege titel te zien krijgt. Zie de onderbouwing bij `MCP_UNTITLED_TITLE` in `runtime.ts`.
 */
function listDocuments(s: AppState): { activeDocumentId: string; documents: DocumentRow[] } {
  const infos = new Map(s.getOpenDocuments().map((d) => [d.id, d]));
  const documents = s.documents.map((entry) => {
    const isActive = entry.id === s.activeDocumentId;
    // Het actieve document leeft op top-level; de rest in zijn geparkeerde payload.
    const project = isActive ? s.project : entry.payload!.project;
    const tasks = isActive ? s.tasks : entry.payload!.tasks;
    const cpm = isActive ? s.cpmResult : entry.payload!.cpmResult;
    const info = infos.get(entry.id);
    const row: DocumentRow = {
      id: entry.id,
      title: mcpDocumentTitle(info),
      isActive,
      isDirty: info ? info.isDirty : false,
      taskCount: tasks.length,
      projectStart: project.startDate,
    };
    if (cpm === null) {
      row.notCalculated = true;
    } else {
      if (cpm.projectEnd) row.projectEnd = cpm.projectEnd;
      if (cpm.error) row.calculationError = cpm.error;
    }
    return row;
  });
  return { activeDocumentId: s.activeDocumentId, documents };
}

// --- Annotaties ----------------------------------------------------------------------------------

/** Leestool-annotatie (spec regel 65). `openWorldHint:false`: blijft binnen de app. */
const DOC_READ_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false,
};

/** Schrijvende document-tool: niet destructief (er gaat geen planningsdata verloren), niet
 *  idempotent (elke aanroep maakt een NIEUW document), binnen de app. */
const DOC_WRITE_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false,
};

// --- Tooldefinities ------------------------------------------------------------------------------

export const documentTools: McpToolDef[] = [
  {
    name: 'planner_list_documents',
    description:
      'Alle geopende documenten (tabbladen) met per document: id, titel, `isActive`, `isDirty`, ' +
      'taakaantal, `projectStart` (= project.startDate, het anker waar vanaf gerekend wordt) en ' +
      '`projectEnd` (het berekende projecteinde). Twee signalen om NIET te verwarren: ' +
      '`notCalculated: true` betekent dat het document nog nooit is doorgerekend (typisch na ' +
      'crash-herstel — alleen het actieve document wordt dan doorgerekend) en dus geen einddatum ' +
      'heeft; `calculationError` betekent dat er wél gerekend is maar met een fout (kringverwijzing), ' +
      'waardoor het einddatum-veld ontbreekt. `title` is een WEERGAVEtitel: de bestandsnaam zonder ' +
      'extensie, anders de projectnaam, en voor een project zonder naam "New schedule" (bij meerdere ' +
      'naamloze documenten genummerd: "New schedule (2)"). Wil je weten of er écht een projectnaam ' +
      'is gezet, lees dan `project.name` via get_project_info. Gebruik deze tool om varianten te vergelijken ' +
      '(einddatums naast elkaar) en om document-id\'s te vinden voor switch_document.',
    kind: 'document',
    batchable: false, // spec regel 100: document-tools zijn uitgesloten van batch
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: DOC_READ_ANNOTATIONS,
    handler: (_args, ctx) => runReadTool(ctx, (s) => listDocuments(s)),
  },
  {
    name: 'planner_new_document',
    description:
      'Open een NIEUW, LEEG document in een eigen tabblad en maak het actief — het equivalent van ' +
      'Bestand → Nieuw, maar bewust ZONDER de projectwizard (een open dialoog zou alle vervolgtools ' +
      'blokkeren). Het nieuwe document heeft geen taken, geen bestandspad en de standaardkalender; ' +
      'zet project-eigenschappen daarna met update_project. Het drift-anker verschuift naar het ' +
      'nieuwe document, dus vervolgmutaties landen daar. Wil je juist een KOPIE van de huidige ' +
      'planning (wat-als/variant), gebruik dan duplicate_document.',
    kind: 'document',
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: DOC_WRITE_ANNOTATIONS,
    handler: (_args, ctx): McpToolResult => {
      // Geen drift-check: een leeg document is onafhankelijk van welk tabblad nu actief is (zie kop).
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const s = ctx.app.store.getState();
      const documentId = s.newDocument();
      bindExpectedDoc(ctx);
      const info = ctx.app.store.getState().getOpenDocuments().find((d) => d.id === documentId);
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
        data: { documentId, title: mcpDocumentTitle(info) },
      };
    },
  },
  {
    name: 'planner_duplicate_document',
    description:
      'Dupliceer het ACTIEVE document naar een nieuw tabblad en maak die kopie actief — de route ' +
      'voor wat-als-scenario\'s en tendervarianten (nooit undo gebruiken als wat-als: die stack deel ' +
      'je met de gebruiker). De kopie is volledig losgekoppeld: eigen diepe kopie van alle ' +
      'planningsdata, LEEG bestandspad (zodat een Ctrl+S van de gebruiker het bronbestand niet ' +
      'overschrijft), verse undo-stack en `isDirty: true`. Naam: `name` indien meegegeven, anders ' +
      '"<projectnaam> (variant N)" met het laagste vrije nummer — er bestaat geen los titelveld, dus ' +
      'dit is de projectnaam. Heeft de bron GEEN projectnaam, dan blijft ook de kopie naamloos (er ' +
      'wordt geen naam verzonnen) en zijn de twee alleen in de weergavetitel te onderscheiden: ' +
      '"New schedule" / "New schedule (2)". Het drift-anker verschuift naar de kopie: alle vervolgstappen landen ' +
      'dáár, dus switch expliciet terug naar het basisdocument voordat je een volgende variant maakt ' +
      '(anders krijg je varianten-van-varianten). De AI sluit varianten niet op: de gebruiker beslist.',
    kind: 'document',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Projectnaam voor de kopie; weglaten ⇒ "<naam> (variant N)"' },
      },
      additionalProperties: false,
    },
    annotations: DOC_WRITE_ANNOTATIONS,
    handler: (args, ctx): McpToolResult => {
      // VOLLE guard incl. drift: deze tool kopieert de INHOUD van het actieve document — na een
      // tabwissel van de user zou dat stilzwijgend de verkeerde planning zijn.
      const blocked = guardNonTransactional(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { name?: unknown };
      if (raw.name !== undefined && typeof raw.name !== 'string') {
        return toolError(ctx, 'VALIDATION', "Parameter 'name' moet een tekst zijn wanneer je hem meegeeft.");
      }
      const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : undefined;
      const documentId = ctx.app.store.getState().duplicateDocument(name);
      // T16-contract (spec regel 130): dit document is deze sessie "geboren" uit een duplicaat en
      // slaat daarom de automatische backup over.
      ctx.markDuplicateBorn(documentId);
      bindExpectedDoc(ctx);
      const s = ctx.app.store.getState();
      const info = s.getOpenDocuments().find((d) => d.id === documentId);
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
        data: {
          documentId,
          title: mcpDocumentTitle(info),
          // BEWUST rauw: dit is het echte `project.name`-veld, geen weergavetitel. Leeg betekent
          // hier dus "dit project heeft geen naam" — een signaal waar de AI iets mee kan (bv.
          // update_project) en dat verdwijnt zodra je er een terugval in zou schrijven. De
          // weergaveterugval hoort in `title`, dat daar wél voor bedoeld is.
          projectName: s.project.name,
          taskCount: s.tasks.length,
        },
      };
    },
  },
  {
    name: 'planner_switch_document',
    description:
      'Maak een ander geopend document actief (id\'s via list_documents). Dit is óók de manier om ' +
      'een DOC_DRIFT-fout op te lossen: wisselde de gebruiker zelf van tabblad, dan weigeren ' +
      'muterende tools tot je met deze tool bevestigt wélk document je bedoelt. Wisselen naar het ' +
      'al-actieve document is toegestaan en verandert niets. Let op: taak-, relatie- en ' +
      'kalender-id\'s zijn PER DOCUMENT — id\'s uit een ander document zijn hier betekenisloos.',
    kind: 'document',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document-id uit list_documents' },
      },
      required: ['documentId'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false, destructiveHint: false,
      idempotentHint: true, // spec regel 65: idempotentHint op o.a. switch_document
      openWorldHint: false,
    },
    handler: (args, ctx): McpToolResult => {
      // BEWUST geen drift-check: deze tool ÍS de drift-bevestiging (spec regel 116).
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { documentId?: unknown };
      if (typeof raw.documentId !== 'string' || raw.documentId.trim() === '') {
        return toolError(ctx, 'VALIDATION', "Parameter 'documentId' (tekst) is verplicht; haal geldige id's op met planner_list_documents.");
      }
      const documentId = raw.documentId;
      const s = ctx.app.store.getState();
      if (!s.documents.some((d) => d.id === documentId)) {
        return toolError(ctx, 'NOT_FOUND', `Onbekend document-id '${documentId}'; open documenten zijn: ${s.documents.map((d) => d.id).join(', ')}`);
      }
      s.switchDocument(documentId); // no-op wanneer het al actief is
      bindExpectedDoc(ctx);
      const after = ctx.app.store.getState();
      const info = after.getOpenDocuments().find((d) => d.id === documentId);
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
        data: {
          documentId,
          title: mcpDocumentTitle(info),
          taskCount: after.tasks.length,
        },
      };
    },
  },
];
