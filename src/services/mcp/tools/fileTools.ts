// MCP-bridge — de TWEE BESTANDS-TOOLS (taak T21, spec §Bestands-tools 107-111, §Overig regel 105).
//
// `export_ifc` en `import_schedule` zijn de enige tools die de wereld BUITEN de app raken. Daarom:
//
//  1. FS-SCOPE. De Tauri-capability dekt `$HOME` (recursief), niet de hele schijf (spec regel 109).
//     Elk pad wordt eerst genormaliseerd (`..`/`.`/dubbele scheiders, `~`-expansie) en daarna tegen
//     de home-map gehouden; erbuiten ⇒ code `SCOPE` met uitleg. Normaliseren VÓÓR de vergelijking is
//     het hele punt: `$HOME/../../etc/x` ziet er anders uit als "binnen $HOME". Deze guard is
//     LEXICAAL — hij redeneert over de padtekst, niet over wat er op schijf staat. Een symlink
//     BINNEN `$HOME` die naar buiten wijst passeert hem dus; dat is bewust: de Tauri-fs-scope
//     (capability) is de tweede, gezaghebbende poort die zulke ontsnappingen alsnog weigert. De
//     JS-guard levert de nette, uitlegbare fout; de capability levert de harde grens.
//  2. OVERSCHRIJVEN. `export_ifc` weigert een bestaand bestand zonder expliciete `overwrite: true`
//     (spec regel 110). Die controle is NIET atomair (check-dan-schrijf): tussen `exists` en
//     `writeTextFile` kan een ander proces het bestand aanmaken. Acceptabel voor deze
//     single-user-desktopcontext; er is geen exclusief-aanmaken-primitief in plugin-fs.
//  3. GEEN USER-DIALOOG. Bewust geaccepteerd (spec regel 111): het pad komt uit de AI-args in plaats
//     van uit een bestandskiezer — de instemming verschuift naar de opt-in van de bridge zelf. Het
//     resultaat is altijd zichtbaar (import = een tabblad, export = een gemeld pad).
//  4. GEEN AI-BACKUP, GEEN TRANSACTIE. Spec regel 130: `import_schedule` triggert zelf géén backup
//     (de per-document-teller start op het RESULTERENDE document, zodat de eerste echte mutatie
//     precies de post-import-staat vastlegt) ⇒ `kind: 'other'`, en het laden loopt via het bestaande
//     `applyLoadedProject`-pad, niet via `runInMcpTransaction`.
//  5. DRIFT-ANKER. `export_ifc` schrijft de inhoud van het ACTIEVE document weg ⇒ volle drift-check
//     (het verkeerde document exporteren is stil fout). `import_schedule` verzet het anker naar het
//     resulterende document (spec regel 111) — zonder dat zou de import zichzelf klemzetten.
//
// De fs-rand loopt via de injecteerbare naad `fileToolDeps` (zelfde motief als `backup.ts`): de
// echte implementatie importeert `@tauri-apps/*` DYNAMISCH binnen een `isTauri()`-tak (anders breekt
// de web-build), de headless tests spuiten een in-memory fs in.

import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { parseOpenedFile, readFormatForFile, readFormatInput, type FormatInput } from '@/services/formatRegistry';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { extensionOf } from '@/utils/filePath';
import type { OpenedImport } from '@/services/importTypes';
import { bindExpectedDoc, buildEnvelope, guardNonTransactional, toolError } from './runtime';
import { guardBridgeFlags } from './documentTools';
import type { McpToolAnnotations, McpToolDef, McpToolResult } from '../contracts';

// --- fs-naad -------------------------------------------------------------------------------------

/** Minimale bestandssysteem-abstractie voor de twee bestands-tools. */
export interface McpFileFs {
  /** Wortel van de toegestane scope (`$HOME`). */
  homeDir(): Promise<string>;
  exists(path: string): Promise<boolean>;
  writeTextFile(path: string, content: string): Promise<void>;
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

/** Echte (Tauri-)fs; dynamisch geïmporteerd binnen een `isTauri()`-tak — spiegel van
 *  `recoveryStore.ts`/`backup.ts`, zodat de web-build niet op een top-level `@tauri-apps`-import breekt. */
async function realFs(): Promise<McpFileFs> {
  if (!isTauri()) {
    throw new Error(
      'De bestands-tools werken alleen in de desktop-app (Tauri): de browserversie heeft geen ' +
      'directe bestandssysteem-toegang. Gebruik daar Bestand → Openen/Exporteren.',
    );
  }
  const { exists, readTextFile, readFile, writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
  const { homeDir } = await import('@tauri-apps/api/path');
  return {
    homeDir: () => homeDir(),
    exists: (p) => exists(p),
    readTextFile: (p) => readTextFile(p),
    readFile: (p) => readFile(p),
    writeTextFile: async (p, content) => {
      const dir = p.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
      if (dir) await mkdir(dir, { recursive: true }); // no-op wanneer de map al bestaat
      await writeTextFile(p, content);
    },
  };
}

/** Injecteerbare afhankelijkheden (tests vervangen `getFs` door een in-memory fake). */
export const fileToolDeps: { getFs: () => Promise<McpFileFs> } = { getFs: realFs };

// --- Padnormalisatie + scope ---------------------------------------------------------------------

/**
 * Normaliseer een ABSOLUUT pad: backslashes → `/`, `.`/lege segmenten weg, `..` opgelost, geen
 * afsluitende slash. Retourneert `null` voor een relatief pad of een `..` dat boven de wortel klimt —
 * beide zijn per definitie niet te scopen en worden geweigerd. Bewust een eigen implementatie: het
 * Node-`path`-pakket bestaat niet in de webview-build.
 */
export function normalizeAbsolutePath(input: string): string | null {
  const unified = input.replace(/\\/g, '/');
  let root = '';
  let rest: string;
  const drive = /^([A-Za-z]:)\//.exec(unified); // Windows: C:/…
  if (drive) {
    root = drive[1];
    rest = unified.slice(drive[1].length);
  } else if (unified.startsWith('/')) {
    rest = unified;
  } else {
    return null; // relatief pad — er is geen werkmap-begrip aan deze kant van de bridge
  }
  const out: string[] = [];
  for (const seg of rest.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length === 0) return null; // klimt boven de wortel uit
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return `${root}/${out.join('/')}`;
}

/** Uitkomst van de scope-controle: het genormaliseerde pad, of een uitleg waarom het buiten de scope valt. */
type ScopeCheck = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Controleer of `input` binnen de `$HOME`-fs-scope valt (spec regel 109). `~`/`~/…` wordt eerst naar
 * de home-map geëxpandeerd (comfort — het resultaat ligt per definitie binnen de scope). Vergelijking
 * gebeurt op genormaliseerde paden; bij een Windows-driveletter hoofdletterongevoelig.
 */
export function checkScope(home: string, input: string): ScopeCheck {
  const expanded = input === '~' || input.startsWith('~/') || input.startsWith('~\\')
    ? `${home}/${input.slice(2)}`
    : input;
  const target = normalizeAbsolutePath(expanded);
  const root = normalizeAbsolutePath(home);
  if (target === null || root === null) {
    return {
      ok: false,
      reason:
        `Pad '${input}' is niet bruikbaar: geef een ABSOLUUT pad binnen '${home}' ` +
        `(een relatief pad of een pad dat via '..' boven de wortel uitklimt wordt geweigerd).`,
    };
  }
  const windows = /^[A-Za-z]:/.test(target) || /^[A-Za-z]:/.test(root);
  const t = windows ? target.toLowerCase() : target;
  const r = windows ? root.toLowerCase() : root;
  const prefix = r.endsWith('/') ? r : `${r}/`;
  if (!t.startsWith(prefix)) {
    return {
      ok: false,
      reason:
        `Pad '${input}' valt buiten de toegestane bestandsscope. De app mag alleen binnen de ` +
        `home-map '${home}' lezen en schrijven; kies een pad daarbinnen.`,
    };
  }
  return { ok: true, path: target };
}

// --- Formaatherkenning ---------------------------------------------------------------------------

/** Leesbaar formaatlabel op basis van de extensie (de XML-variant wordt op inhoud gesnifft).
 *  `MPP14` (T8): de enige binaire indeling die dit pad kent — `.mpp` (MS Project 2010-2021,
 *  alleen-lezen native lezer, zie `src/services/mpp/`). */
function formatOf(path: string, content: string): 'IFC' | 'CSV' | 'P6-XML' | 'MSPDI-XML' | 'MPP14' | 'XER' {
  const ext = extensionOf(path);
  if (ext === 'csv') return 'CSV';
  if (ext === 'mpp') return 'MPP14';
  if (ext === 'xer') return 'XER';
  if (ext === 'xml') {
    return content.includes('APIBusinessObjects') || content.includes('Primavera') ? 'P6-XML' : 'MSPDI-XML';
  }
  return 'IFC';
}

// --- Annotaties ----------------------------------------------------------------------------------

/**
 * Bestands-tool-annotaties. `openWorldHint: true` is de expliciete uitzondering uit spec regel 65
 * ("de server raakt niets buiten de app **behalve de expliciete bestands-tools**"): deze twee tools
 * lezen/schrijven op het bestandssysteem van de gebruiker, dus de MCP-client hoort dat te weten.
 */
const EXPORT_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false, // weigert overschrijven tenzij de aanroeper er expliciet om vraagt
  idempotentHint: false,
  openWorldHint: true,
};

const IMPORT_ANNOTATIONS: McpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true, // spec regel 65: destructiveHint op import_schedule
  idempotentHint: false,
  openWorldHint: true,
};

// --- Tooldefinities ------------------------------------------------------------------------------

export const fileTools: McpToolDef[] = [
  {
    name: 'planner_export_ifc',
    description:
      'Schrijf het ACTIEVE document als IFC 4.3-bestand naar `path` (het native formaat: taken, ' +
      'relaties, kalenders, resources, toewijzingen, baselines en structuur gaan volledig mee). ' +
      'BESTANDSSCOPE: alleen paden binnen de home-map van de gebruiker; erbuiten volgt een ' +
      'SCOPE-fout. Een bestaand bestand wordt NIET overschreven tenzij je expliciet ' +
      '`overwrite: true` meegeeft. Dit wijzigt de planning niet en verandert ook het opslaan-doel ' +
      'van het document niet: het blijft "niet opgeslagen" in de app — het is een export, geen ' +
      '"opslaan als". Let op: het pad komt uit jouw argumenten, niet uit een bestandsdialoog van de ' +
      'gebruiker; noem het gekozen pad dus altijd in je antwoord.',
    kind: 'other',
    batchable: false, // spec regel 100: export_ifc/import_schedule zijn uitgesloten van batch
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absoluut doelpad binnen de home-map, bv. /home/naam/planning.ifc (~ mag)' },
        overwrite: { type: 'boolean', description: 'true = een bestaand bestand vervangen (default false)' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: EXPORT_ANNOTATIONS,
    handler: async (args, ctx): Promise<McpToolResult> => {
      // Volle guard incl. drift: we schrijven de inhoud van het ACTIEVE document weg.
      const blocked = guardNonTransactional(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { path?: unknown; overwrite?: unknown };
      if (typeof raw.path !== 'string' || raw.path.trim() === '') {
        return toolError(ctx, 'VALIDATION', "Parameter 'path' (tekst) is verplicht: het absolute doelpad van het IFC-bestand.");
      }
      if (raw.overwrite !== undefined && typeof raw.overwrite !== 'boolean') {
        return toolError(ctx, 'VALIDATION', "Parameter 'overwrite' moet true of false zijn.");
      }
      const overwrite = raw.overwrite === true;

      let fs: McpFileFs;
      try {
        fs = await fileToolDeps.getFs();
      } catch (e) {
        return toolError(ctx, 'INTERNAL', e instanceof Error ? e.message : String(e));
      }

      let path: string;
      // `existed` wordt ALTIJD bepaald, ook met `overwrite: true` — de respons moet melden wat er
      // werkelijk gebeurde (vervangen of nieuw aangemaakt), niet welke vlag de aanroeper meestuurde.
      let existed: boolean;
      try {
        const scope = checkScope(await fs.homeDir(), raw.path);
        if (!scope.ok) return toolError(ctx, 'SCOPE', scope.reason);
        path = scope.path;
        existed = await fs.exists(path);
        if (existed && !overwrite) {
          return toolError(
            ctx,
            'VALIDATION',
            `Er bestaat al een bestand op '${path}'. Geef 'overwrite': true mee om het te vervangen, ` +
            'of kies een ander pad — de AI overschrijft niet uit zichzelf.',
          );
        }
      } catch (e) {
        return toolError(ctx, 'INTERNAL', `Kon het doelpad niet controleren: ${e instanceof Error ? e.message : String(e)}`);
      }

      const state = useAppStore.getState();
      // Gedeelde state→writer-invoer (dezelfde bron als opslaan/auto-save), zodat deze route nooit
      // stil velden kan laten vallen.
      const content = writeIFC(buildWriteIFCInput(state));
      try {
        await fs.writeTextFile(path, content);
      } catch (e) {
        return toolError(ctx, 'INTERNAL', `Schrijven naar '${path}' is mislukt: ${e instanceof Error ? e.message : String(e)}`);
      }
      return {
        ok: true,
        envelope: buildEnvelope(),
        data: {
          path,
          // Aantal TEKENS van het IFC-document (geen bytes: UTF-8 is multi-byte voor niet-ASCII
          // projectnamen/omschrijvingen, dus `length` zou als byte-telling onjuist zijn).
          characters: content.length,
          tasks: state.tasks.length,
          /** Werkelijke uitkomst: stond er al een bestand op dit pad dat nu vervangen is? */
          overwritten: existed,
        },
      };
    },
  },
  {
    name: 'planner_import_schedule',
    description:
      'Lees een planningsbestand van schijf en open het als DOCUMENT (tabblad). Ondersteund: .ifc ' +
      '(native, volledig), .xml (Primavera P6 of MS Project MSPDI — het formaat wordt op inhoud ' +
      'herkend), .csv, .xer (Primavera P6, alleen-lezen) en .mpp (MS Project 2010-2021, MPP14, ' +
      'alleen-lezen — oudere formaten en ' +
      'wachtwoordbestanden geven een fout die vraagt om eerst als XML te exporteren). Er wordt NIET ' +
      'samengevoegd met het huidige plan: een leeg-en-ongewijzigd ' +
      'actief tabblad wordt hergebruikt, anders komt er een nieuw tabblad bij; het resultaat wordt ' +
      'actief en het vervolgwerk landt daar. ' +
      'VERLIES PER FORMAAT — noem dit tegen de gebruiker: CSV bevat GEEN kalender (het document ' +
      'krijgt de standaardkalender, dus datums kunnen verschuiven!) en geen resources of ' +
      'toewijzingen; P6-XML mapt Nonlabor-resources op EQUIPMENT; MPP bevat geen baselines/custom ' +
      'fields; MSPDI is het rijkst na IFC. ' +
      'Na een CSV-/XML-/MPP-import heeft het document nog GEEN opslagdoel (opslaan schrijft altijd ' +
      'IFC, dus het bronbestand wordt nooit overschreven); alleen een IFC-import neemt het bronpad over. ' +
      'Gebruik de `documents`-inventaris UIT DE RESPONS voor alle geopende documenten; `documentId` ' +
      'blijft voor compatibiliteit het actieve document aanwijzen. Of het eerste project in het ' +
      'bestaande tabblad of in een nieuw tabblad landde hangt af van de staat van de app. ' +
      'Kalender-id\'s zijn per document: herbouw een kalender in het importdocument met ' +
      'update_calendar — geef een kalenderobject uit planner_get_calendars van het masterdocument ' +
      'LETTERLIJK terug (inclusief `workTime`-uurbanden, `shift`, `holidays` en `generation`) met ' +
      '`create: true`, of gebruik het generator-pad (`generate`). Hang de taken daarna aan het NIEUWE ' +
      'id via `update_tasks.calendarId`; wil je de PROJECTkalender van het importdocument gelijkmaken, ' +
      'schrijf de velden dan op het id uit zijn eigen `projectDefaultId` (WELKE kalender de ' +
      'projectdefault is, kan de bridge niet wisselen). Hergebruik nooit een id uit een ander document. ' +
      'BESTANDSSCOPE: alleen paden binnen de home-map. Het pad komt uit ' +
      'jouw argumenten, niet uit een bestandsdialoog van de gebruiker.',
    kind: 'other',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absoluut bronpad binnen de home-map (.ifc / .xml / .csv / .mpp / .xer; ~ mag)' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: IMPORT_ANNOTATIONS,
    handler: async (args, ctx): Promise<McpToolResult> => {
      // GEEN drift-check: het resultaat is per definitie een vers/hergebruikt tabblad en het anker
      // verzet mee (spec regel 111). Wel de veiligheidsvlaggen + dialoog-guard.
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { path?: unknown };
      if (typeof raw.path !== 'string' || raw.path.trim() === '') {
        return toolError(ctx, 'VALIDATION', "Parameter 'path' (tekst) is verplicht: het absolute pad van het te importeren bestand.");
      }

      let fs: McpFileFs;
      try {
        fs = await fileToolDeps.getFs();
      } catch (e) {
        return toolError(ctx, 'INTERNAL', e instanceof Error ? e.message : String(e));
      }

      let path: string;
      try {
        const scope = checkScope(await fs.homeDir(), raw.path);
        if (!scope.ok) return toolError(ctx, 'SCOPE', scope.reason);
        path = scope.path;
      } catch (e) {
        return toolError(ctx, 'INTERNAL', `Kon het bronpad niet controleren: ${e instanceof Error ? e.message : String(e)}`);
      }
      const readFormat = readFormatForFile(path);
      // `content` blijft '' voor een binair formaat — puur voor `formatOf` (verderop) se sniffen
      // op CSV/P6-XML/MSPDI-XML-inhoud; het OPSLAGDOEL-besluit hangt sinds T11 niet meer af van
      // `formatOf`'s AI-facing label maar rechtstreeks van `readFormat.canBeSaveTarget` (zie
      // verderop) — dus geen risico meer dat een binair formaat via `formatOf`'s IFC-terugval per
      // ongeluk als opslagdoel-waardig zou worden gelezen.
      let input: FormatInput;
      try {
        // T11 (T2-kwaliteitsreview-agenda stap 0 a): gedeelde isBinary?readFile:readTextFile-tak,
        // óók hier — `fs` (McpFileFs) is structureel compatibel met `readFormatInput`'s `FormatIO`.
        input = await readFormatInput(path, fs);
      } catch (e) {
        return toolError(ctx, 'NOT_FOUND', `Kon '${path}' niet lezen: ${e instanceof Error ? e.message : String(e)}`);
      }
      const content = input.text ?? '';

      let parsed: OpenedImport;
      try {
        // Geen `labels`: dienstlaag zonder `t(...)` — de MCP-laag is AI-facing en kent geen UI-taal.
        // `readIFC` valt dan terug op de Engelse default voor een bestand zonder IFCPROJECT (zie
        // ImportLabels).
        parsed = await parseOpenedFile(input);
      } catch (e) {
        return toolError(ctx, 'VALIDATION', `'${path}' kon niet worden gelezen als planning: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Exact het bestaande laadpatroon (fileSlice.openFile), inclusief X4b's meervoudige XER-vorm.
      const format = formatOf(path, content);
      // OPSLAGDOEL alleen bij een formaat dat `canBeSaveTarget` draagt (T11 — vóór deze fix: `format
      // === 'IFC' && !isBinary`, twee losse classificaties die uit elkaar konden lopen). Opslaan
      // schrijft ALTIJD IFC; zou een geïmporteerd .csv-/.xml-/.mpp-pad het opslagdoel worden, dan
      // overschrijft de eerstvolgende Ctrl+S van de user zijn eigen bronbestand met IFC-inhoud onder
      // die naam. Zelfde motief als de genulde `filePath` van `duplicate_document`. Gevolg: na een
      // CSV-/XML-/MPP-import is het document "naamloos" en wordt opslaan een opslaan-als — precies
      // wat je wilt. `formatOf` blijft puur het AI-facing label (`format` hieronder, voor de respons
      // en de notices) — de opslagdoel-beslissing leest voortaan uitsluitend `readFormat.
      // canBeSaveTarget`, dezelfde registry-vlag als `fileSlice.ts`.
      const opened = useAppStore.getState().applyOpenedImport(parsed, {
        filePath: readFormat.canBeSaveTarget ? path : null,
        fileHandle: null,
        recompute: true,
        fit: true,
        hourDataNotice: true,
      });
      // Drift-anker naar het RESULTERENDE document (spec regel 111) — anders zou de eerstvolgende
      // mutatie op het importdocument als drift falen en zet de import zichzelf klem.
      bindExpectedDoc(ctx);

      const after = useAppStore.getState();
      const payloadById = new Map(after.getOpenDocumentPayloads().map(document => [
        document.id,
        document.payload,
      ]));
      const documents = opened.documentIds.map(documentId => {
        const payload = payloadById.get(documentId);
        if (!payload) throw new Error(`Geopend document '${documentId}' ontbreekt na import`);
        return {
          documentId,
          projectId: payload.project.id,
          projectName: payload.project.name,
          tasks: payload.tasks.length,
          sequences: payload.sequences.length,
          resources: payload.resources.length,
          filePath: payload.filePath,
        };
      });
      const notices: string[] = [];
      if (format === 'CSV') {
        notices.push('CSV bevat geen kalender (het document draait nu op de STANDAARDkalender — datums kunnen afwijken) en geen resources/toewijzingen.');
      } else if (format === 'P6-XML') {
        notices.push('P6-XML: Nonlabor-resources zijn als EQUIPMENT geïmporteerd.');
      } else if (format === 'MPP14') {
        notices.push('MPP-import is alleen-lezen (best effort; baselines en custom fields komen niet mee). Opslaan schrijft IFC; export naar MS Project = MSPDI-XML.');
      } else if (format === 'XER') {
        notices.push(
          `XER-import is alleen-lezen; deze stap importeert ${documents.length} niet-lege ` +
          `P6-project${documents.length === 1 ? '' : 'en'} als ${documents.length} ` +
          `document${documents.length === 1 ? '' : 'en'}. Opslaan schrijft IFC.`,
        );
      }
      if (format !== 'IFC') {
        notices.push('Het document heeft nog GEEN opslagdoel: opslaan schrijft IFC, dus het bronbestand wordt niet overschreven — de gebruiker kiest bij opslaan een pad.');
      }
      return {
        ok: true,
        envelope: buildEnvelope(),
        data: {
          documentId: after.activeDocumentId,
          documentsOpened: documents.length,
          documents,
          path,
          format,
          reusedActiveTab: opened.reusedActiveTab,
          /** Opslagdoel van het document: het bronpad bij IFC, anders null (zie hierboven). */
          filePath: after.filePath,
          tasks: after.tasks.length,
          sequences: after.sequences.length,
          resources: after.resources.length,
          // Eerlijk over wat dit formaat NIET meebrengt — de AI hoort dit door te geven.
          notice: notices.length > 0 ? notices.join(' ') : undefined,
        },
      };
    },
  },
];
