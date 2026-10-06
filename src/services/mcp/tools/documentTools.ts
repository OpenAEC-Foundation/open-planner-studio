// MCP-bridge — de VIER DOCUMENT-TOOLS.
//
// `list_documents` / `new_document` / `duplicate_document` / `switch_document`. De AI sluit bewust
// GEEN documenten en beslist niet over opslaan — die tools bestaan hier dus niet.
//
// Drie ontwerpbesluiten:
//
//  1. DRIFT-ANKER. `new_document`, `duplicate_document` en `switch_document` verzetten het anker
//     (`bindExpectedDoc`) ná hun documentwissel, zodat de eerstvolgende mutatie tegen het nieuwe
//     document ankert. Of een tool ZELF eerst op drift faalt, hangt af van of hij de INHOUD van het
//     actieve document gebruikt:
//       - `duplicate_document` doet dat (hij kopieert het actieve document) ⇒ volle
//         `guardNonTransactional` incl. drift-check: dupliceren van het verkeerde document zou een
//         onopgemerkt verkeerde variant opleveren.
//       - `switch_document` is juist de BEVESTIGING die drift oplost en mag dus
//         nooit zelf op drift falen.
//       - `new_document` maakt een leeg document; de inhoud van het actieve document doet er niet
//         toe en het anker gaat sowieso mee. Geen drift-check.
//  2. GEEN TRANSACTIE. Documentwissels zijn geen planningsmutaties: ze pushen geen undo-snapshot en
//     horen niet in `runInMcpTransaction` (dat zou een snapshot van het VERKEERDE document nemen).
//     Daarom de veiligheidsvlag-guards los, via `guardBridgeFlags` hieronder.
//  3. GEEN AI-BACKUP. Document-tools triggeren zelf géén auto-backup; hun `kind` is `'document'`
//     (alleen `'mutate'`/`'batch'` triggeren). Wel MOET `duplicate_document` het nieuwe document als
//     "duplicate-born" registreren (backup-contract) — via dezelfde contextbinding die
//     ook de volgende backupbeslissing neemt.
//
// Batch-uitsluiting: document-tools horen niet in `batch` ⇒ `batchable: false` op alle
// vier (ook op de leestool `list_documents`, die als document-tool meeloopt).

import type { AppState } from '@/state/appStore';
import { bindExpectedDoc, buildEnvelope, guardNonTransactional, mcpDocumentTitle, preBackupGuards, runReadTool, toolError } from './runtime';
import type { McpContext, McpToolDef, McpToolErr, McpToolResult } from '../contracts';
import { READ_ANNOTATIONS, WRITE_ANNOTATIONS } from './helpers';

// --- Gedeelde veiligheidsvlag-guard --------------------------------------------------------------

/**
 * Pauze → alleen-lezen → dialoog: EXACT dezelfde guards en volgorde als
 * `runMutateTool`/`guardNonTransactional`, maar ZONDER de drift-check
 * en zonder transactie/backup — die is hier per tool verschillend (zie de kopcomment).
 *
 * Bewust een dunne doorgeefpost naar de ÉNE guard-implementatie in `runtime.ts`
 * (`preBackupGuards`, daarvoor geëxporteerd) in plaats van een tweede kopie. Een kopie zou (a) de
 * guard-volgorde kunnen laten afdrijven en (b) de eis missen dat de DIALOG_OPEN-fout BENOEMT wélke
 * dialoog blokkeert; die naamgeving zit in de runtime-versie.
 *
 * Waarom óók `readOnly` op tools die de planning niet wijzigen: fail-closed. Een document aanmaken/
 * wisselen of een bestand wegschrijven zijn zichtbare neveneffecten op de werkomgeving van de user;
 * "alleen-lezen" hoort dan te betekenen dat de AI niets doet behalve lezen.
 *
 * Gedeeld met `fileTools.ts`.
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
  /** Alleen aanwezig (en dan `true`) wanneer de invoer na de laatste berekening is gewijzigd. Het
   *  actieve document is dan al vers doorgerekend (de tool rekent het eerst door); een geparkeerd
   *  document kan de tool niet doorrekenen zonder ernaar te wisselen, dus daar meldt hij het. */
  scheduleStale?: true;
  /** Alleen aanwezig (en dan `true`) in "datums zoals opgeslagen": `projectEnd` is dan het
   *  vastgelegde einde uit het bestand, geen berekening. */
  datesAsRecorded?: true;
}

/**
 * Alle open documenten met hun verrijkte kop-gegevens.
 *
 * Het "niet doorgerekend"-signaal komt uit `cpmResult == null` en NADRUKKELIJK niet uit
 * `scheduleStale`. De twee vlaggen beantwoorden verschillende vragen: `scheduleStale` zegt of de
 * uitkomst nog kán kloppen, `cpmResult == null` of er überhaupt een uitkomst ís. Een document dat
 * verouderd is maar wél een `cpmResult` draagt, is doorgerekend — alleen niet meer actueel — en
 * hoort dus géén "niet doorgerekend" te melden; er is immers een (verouderde) einddatum te tonen.
 * Op `scheduleStale` sturen zou dat verwarren, in beide richtingen (een via crash-herstel
 * teruggekomen document is bijvoorbeeld verouderd gemarkeerd).
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
    const stale = isActive ? s.scheduleStale : entry.payload!.scheduleStale;
    const asRecorded = isActive ? s.datesAsRecorded : entry.payload!.datesAsRecorded;
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
    // Een rij-veld van de respons, geen storevlag; `= stale` (genarrowd tot `true`) houdt de
    // broncontrole 11c in tests/planning/check-recorded-dates.ts zuiver.
    if (stale) row.scheduleStale = stale;
    if (asRecorded) row.datesAsRecorded = asRecorded;
    return row;
  });
  return { activeDocumentId: s.activeDocumentId, documents };
}

// --- Annotaties ----------------------------------------------------------------------------------

// Schrijvende document-tools gebruiken `WRITE_ANNOTATIONS` ongewijzigd: niet destructief (er gaat
// geen planningsdata verloren), niet idempotent (elke aanroep maakt een NIEUW document), binnen de app.

// --- Tooldefinities ------------------------------------------------------------------------------

export const documentTools: McpToolDef[] = [
  {
    name: 'planner_list_documents',
    description:
      'All open documents (tabs), with per document: id, title, `isActive`, `isDirty`, task count, ' +
      '`projectStart` (= project.startDate, the anchor the schedule is calculated from) and `projectEnd` ' +
      '(the calculated project end). Two signals NOT to confuse: `notCalculated: true` means the document ' +
      'has never been calculated (typically after crash recovery — only the active document is calculated ' +
      'then) and therefore has no end date; `calculationError` means it was calculated but with an error ' +
      '(circular dependency), so the end-date field is missing. `title` is a DISPLAY title: the file name ' +
      'without extension, otherwise the project name, and for a project without a name "New schedule" ' +
      '(numbered when there are several untitled documents: "New schedule (2)"). To know whether a project ' +
      'name has really been set, read `project.name` via get_project_info. Use this tool to compare variants ' +
      '(end dates side by side) and to find document ids for switch_document. FRESHNESS: an out-of-date ' +
      'ACTIVE document is recalculated first, like F5 in the app (no undo step; the envelope then carries ' +
      '`scheduleRecalculated: true`). Other open documents cannot be recalculated without switching to them: ' +
      'such a row carries `scheduleStale: true`, and its `projectEnd` is the last calculated one. ' +
      '`datesAsRecorded: true` on a row means its dates are the ones recorded in the imported file, not a ' +
      'calculation; such a document is never recalculated by a read.',
    kind: 'document',
    batchable: false, // document-tools zijn uitgesloten van batch
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ANNOTATIONS,
    handler: (_args, ctx) => runReadTool(ctx, (s) => listDocuments(s), { freshSchedule: true }),
  },
  {
    name: 'planner_new_document',
    description:
      'Open a NEW, EMPTY document in its own tab and make it active — the equivalent of File → New, but ' +
      'deliberately WITHOUT the project wizard (an open dialog would block all follow-up tools). The new ' +
      'document has no tasks, no file path and the default calendar; set project properties afterwards with ' +
      'update_project. The drift anchor moves to the new document, so follow-up mutations land there. If you ' +
      'want a COPY of the current schedule instead (what-if/variant), use duplicate_document.',
    kind: 'document',
    batchable: false,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: WRITE_ANNOTATIONS,
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
      'Duplicate the ACTIVE document into a new tab and make that copy active — the route for what-if ' +
      'scenarios and tender variants (never use undo as a what-if: you share that stack with the user). The ' +
      'copy is fully detached: its own deep copy of all schedule data, an EMPTY file path (so a Ctrl+S by ' +
      'the user does not overwrite the source file), a fresh undo stack and `isDirty: true`. Name: `name` if ' +
      'given, otherwise "<project name> (variant N)" with the lowest free number — there is no separate ' +
      'title field, so this is the project name. If the source has NO project name, the copy stays untitled ' +
      'too (no name is invented) and the two can only be told apart by their display title: "New schedule" / ' +
      '"New schedule (2)". The drift anchor moves to the copy: all follow-up steps land THERE, so switch ' +
      'back explicitly to the base document before you make another variant (otherwise you get variants of ' +
      'variants). The AI does not close variants: the user decides.',
    kind: 'document',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name for the copy; omitted ⇒ "<name> (variant N)"' },
      },
      additionalProperties: false,
    },
    annotations: WRITE_ANNOTATIONS,
    handler: (args, ctx): McpToolResult => {
      // VOLLE guard incl. drift: deze tool kopieert de INHOUD van het actieve document — na een
      // tabwissel van de user zou dat stilzwijgend de verkeerde planning zijn.
      const blocked = guardNonTransactional(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { name?: unknown };
      if (raw.name !== undefined && typeof raw.name !== 'string') {
        return toolError(ctx, 'VALIDATION', 'Parameter \'name\' must be text when you pass it.');
      }
      const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : undefined;
      const documentId = ctx.app.store.getState().duplicateDocument(name);
      // Backup-contract: dit document is deze sessie "geboren" uit een duplicaat en
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
      'Make another open document active (ids via list_documents). This is ALSO the way to resolve a ' +
      'DOC_DRIFT error: if the user switched tabs themselves, mutating tools refuse until you confirm with ' +
      'this tool WHICH document you mean. Switching to the already active document is allowed and changes ' +
      'nothing. Note: task, relationship and calendar ids are PER DOCUMENT — ids from another document are ' +
      'meaningless here.',
    kind: 'document',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document id from list_documents ' },
      },
      required: ['documentId'],
      additionalProperties: false,
    },
    // idempotentHint op o.a. switch_document
    annotations: { ...WRITE_ANNOTATIONS, idempotentHint: true },
    handler: (args, ctx): McpToolResult => {
      // BEWUST geen drift-check: deze tool ÍS de drift-bevestiging.
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { documentId?: unknown };
      if (typeof raw.documentId !== 'string' || raw.documentId.trim() === '') {
        return toolError(ctx, 'VALIDATION', 'Parameter \'documentId\' (text) is required; get valid ids with planner_list_documents.');
      }
      const documentId = raw.documentId;
      const s = ctx.app.store.getState();
      if (!s.documents.some((d) => d.id === documentId)) {
        return toolError(ctx, 'NOT_FOUND', `Unknown document id '${documentId}'; open documents are: ${s.documents.map((d) => d.id).join(', ')}`);
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
