// MCP-bridge — de TWEE BESTANDS-TOOLS.
//
// `export_ifc` en `import_schedule` zijn de enige tools die de wereld BUITEN de app raken. Daarom:
//
//  1. FS-SCOPE. De Tauri-capability dekt `$HOME` (recursief), niet de hele schijf.
//     Elk pad wordt eerst genormaliseerd (`..`/`.`/dubbele scheiders, `~`-expansie) en daarna tegen
//     de home-map gehouden; erbuiten ⇒ code `SCOPE` met uitleg. Normaliseren VÓÓR de vergelijking is
//     het hele punt: `$HOME/../../etc/x` ziet er anders uit als "binnen $HOME". Deze guard is
//     LEXICAAL — hij redeneert over de padtekst, niet over wat er op schijf staat. Een symlink
//     BINNEN `$HOME` die naar buiten wijst passeert hem dus; dat is bewust: de Tauri-fs-scope
//     (capability) is de tweede, gezaghebbende poort die zulke ontsnappingen alsnog weigert. De
//     JS-guard levert de nette, uitlegbare fout; de capability levert de harde grens.
//  2. OVERSCHRIJVEN. `export_ifc` weigert een bestaand bestand zonder expliciete `overwrite: true`.
//     Die controle is NIET atomair (check-dan-schrijf): tussen `exists` en
//     `writeTextFile` kan een ander proces het bestand aanmaken. Acceptabel voor deze
//     single-user-desktopcontext; er is geen exclusief-aanmaken-primitief in plugin-fs.
//  3. GEEN USER-DIALOOG. Bewust geaccepteerd: het pad komt uit de AI-args in plaats
//     van uit een bestandskiezer — de instemming verschuift naar de opt-in van de bridge zelf. Het
//     resultaat is altijd zichtbaar (import = een tabblad, export = een gemeld pad).
//  4. GEEN AI-BACKUP, GEEN TRANSACTIE. `import_schedule` triggert zelf géén backup
//     (de per-document-teller start op het RESULTERENDE document, zodat de eerste echte mutatie
//     precies de post-import-staat vastlegt) ⇒ `kind: 'other'`, en het laden loopt via de gedeelde
//     open-actie `openAsDocument` (→ `applyLoadedProject`, net als Bestand → Openen), niet via
//     `runInMcpTransaction`.
//  5. DRIFT-ANKER. `export_ifc` schrijft de inhoud van het ACTIEVE document weg ⇒ volle drift-check
//     (het verkeerde document exporteren is stil fout). `import_schedule` verzet het anker naar het
//     resulterende document — zonder dat zou de import zichzelf klemzetten.
//
// De fs-rand loopt via de injecteerbare naad `fileToolDeps` (zelfde motief als `backup.ts`): de
// echte implementatie importeert `@tauri-apps/*` DYNAMISCH binnen een `isTauri()`-tak (anders breekt
// de web-build), de headless tests spuiten een in-memory fs in.

import { isTauri } from '@/utils/platform';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { detectXmlFlavor, parseOpenedFile, readFormatInput, type FormatInput } from '@/services/formatRegistry';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { extensionOf } from '@/utils/filePath';
import type { OpenedImport } from '@/services/importTypes';
import { bindExpectedDoc, buildEnvelope, guardNonTransactional, postAwaitGuards, toolError } from './runtime';
import { guardBridgeFlags } from './documentTools';
import type { McpToolAnnotations, McpToolDef, McpToolResult } from '../contracts';
import { writeUserTextFileTauri } from '@/services/fileAccess/atomicWrite';

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
      'The file tools only work in the desktop app (Tauri): the browser version has no direct file system ' +
      'access. Use File → Open/Export there.',
    );
  }
  const { exists, readTextFile, readFile, mkdir } = await import('@tauri-apps/plugin-fs');
  const { homeDir } = await import('@tauri-apps/api/path');
  return {
    homeDir: () => homeDir(),
    exists: (p) => exists(p),
    readTextFile: (p) => readTextFile(p),
    readFile: (p) => readFile(p),
    writeTextFile: async (p, content) => {
      const dir = p.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
      if (dir) await mkdir(dir, { recursive: true }); // no-op wanneer de map al bestaat
      await writeUserTextFileTauri(p, content); // `overwrite: true` mag een bestaand IFC nooit afkappen
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
 * Controleer of `input` binnen de `$HOME`-fs-scope valt. `~`/`~/…` wordt eerst naar
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
        `Path '${input}' is not usable: give an ABSOLUTE path inside '${home}' (a relative path, or a path ` +
        'that climbs above the root via \'..\', is refused).',
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
        `Path '${input}' is outside the allowed file scope. The app may only read and write inside the home ` +
        `folder '${home}'; choose a path inside it.`,
    };
  }
  return { ok: true, path: target };
}

// --- Formaatherkenning ---------------------------------------------------------------------------

/** Leesbaar formaatlabel op basis van de extensie (de XML-variant volgt het root-element via
 *  `detectXmlFlavor` — dezelfde beslissing als de lezerkeuze in `formatRegistry`, nooit vrije tekst).
 *  `MPP14`: de enige binaire indeling die dit pad kent — `.mpp` (MS Project 2010-2021,
 *  alleen-lezen native lezer, zie `src/services/mpp/`). */
function formatOf(path: string, content: string): 'IFC' | 'CSV' | 'P6-XML' | 'MSPDI-XML' | 'MPP14' | 'XER' {
  const ext = extensionOf(path);
  if (ext === 'csv') return 'CSV';
  if (ext === 'mpp') return 'MPP14';
  if (ext === 'xer') return 'XER';
  if (ext === 'xml') return detectXmlFlavor(content) === 'p6' ? 'P6-XML' : 'MSPDI-XML';
  return 'IFC';
}

// --- Annotaties ----------------------------------------------------------------------------------

/**
 * Bestands-tool-annotaties. `openWorldHint: true` is de expliciete uitzondering ("de server raakt
 * niets buiten de app **behalve de expliciete bestands-tools**"): deze twee tools
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
  destructiveHint: true, // destructiveHint op import_schedule
  idempotentHint: false,
  openWorldHint: true,
};

// --- Tooldefinities ------------------------------------------------------------------------------

export const fileTools: McpToolDef[] = [
  {
    name: 'planner_export_ifc',
    description:
      'Write the ACTIVE document as an IFC 4.3 file to `path` (the native format: tasks, relationships, ' +
      'calendars, resources, assignments, baselines and structure are all included). FILE SCOPE: only paths ' +
      'inside the user\'s home folder; outside it a SCOPE error follows. An existing file is NOT overwritten ' +
      'unless you explicitly pass `overwrite: true`. This does not change the schedule, nor the document\'s ' +
      'save target: it stays "not saved" in the app — it is an export, not a "save as". Note: the path comes ' +
      'from your arguments, not from a file dialog of the user; so always mention the chosen path in your ' +
      'answer.',
    kind: 'other',
    batchable: false, // export_ifc/import_schedule zijn uitgesloten van batch
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute target path inside the home folder, e.g. /home/name/schedule.ifc (~ allowed)' },
        overwrite: { type: 'boolean', description: 'true = replace an existing file (default false)' },
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
        return toolError(ctx, 'VALIDATION', 'Parameter \'path\' (text) is required: the absolute target path of the IFC file.');
      }
      if (raw.overwrite !== undefined && typeof raw.overwrite !== 'boolean') {
        return toolError(ctx, 'VALIDATION', 'Parameter \'overwrite\' must be true or false.');
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
            `A file already exists at '${path}'. Pass 'overwrite': true to replace it, or choose another ` +
            'path — the AI does not overwrite on its own.',
          );
        }
      } catch (e) {
        return toolError(ctx, 'INTERNAL', `Could not check the target path: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Na de fs-awaits opnieuw: de gebruiker kan intussen gepauzeerd, alleen-lezen gezet, een
      // dialoog geopend of van tabblad gewisseld hebben — dan zou hier een ander document of een
      // half-bewerkte staat weggeschreven worden.
      const lateBlocked = postAwaitGuards(ctx) ?? guardNonTransactional(ctx);
      if (lateBlocked) return lateBlocked;
      const state = ctx.app.store.getState();
      // Gedeelde state→writer-invoer (dezelfde bron als opslaan/auto-save), zodat deze route nooit
      // stil velden kan laten vallen.
      const content = writeIFC(buildWriteIFCInput(state));
      try {
        await fs.writeTextFile(path, content);
      } catch (e) {
        return toolError(ctx, 'INTERNAL', `Writing to '${path}' failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
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
      'Read a schedule file from disk and open it as a DOCUMENT (tab). Supported: .ifc (native, complete), ' +
      '.xml (Primavera P6 or MS Project MSPDI — the format is detected from the content), .csv, .xer ' +
      '(Primavera P6, read-only) and .mpp (MS Project 2010-2021, MPP14, read-only — older formats and ' +
      'password-protected files give an error asking to export as XML first). Nothing is merged into the ' +
      'current plan: an empty and unchanged active tab is reused, otherwise a new tab is added; the result ' +
      'becomes active and follow-up work lands there. LOSS PER FORMAT — tell the user: CSV contains NO ' +
      'calendar (the document gets the default calendar, so dates can shift!) and no resources or ' +
      'assignments; P6 XML maps Nonlabor resources to EQUIPMENT; MPP contains no baselines/custom fields; ' +
      'MSPDI is the richest after IFC. After a CSV/XML/MPP import the document has NO save target yet ' +
      '(saving always writes IFC, so the source file is never overwritten); only an IFC import takes over ' +
      'the source path. Use the `documents` inventory FROM THE RESPONSE for all opened documents; ' +
      '`documentId` keeps pointing at the active document for compatibility. Whether the first project ' +
      'landed in the existing tab or in a new tab depends on the state of the app. Calendar ids are per ' +
      'document: rebuild a calendar in the imported document with update_calendar — pass a calendar object ' +
      'from planner_get_calendars of the master document back LITERALLY (including `workTime` hour bands, ' +
      '`shift`, `holidays` and `generation`) with `create: true`, or use the generator path (`generate`). ' +
      'Then attach the tasks to the NEW id via `update_tasks.calendarId`; to align the PROJECT calendar of ' +
      'the imported document, write the fields to the id from its own `projectDefaultId` (WHICH calendar is ' +
      'the project default cannot be switched via the bridge). Never reuse an id from another document. FILE ' +
      'SCOPE: only paths inside the home folder. The path comes from your arguments, not from a file dialog ' +
      'of the user.',
    kind: 'other',
    batchable: false,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute source path inside the home folder (.ifc / .xml / .csv / .mpp / .xer; ~ allowed)' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: IMPORT_ANNOTATIONS,
    handler: async (args, ctx): Promise<McpToolResult> => {
      // GEEN drift-check: het resultaat is per definitie een vers/hergebruikt tabblad en het anker
      // verzet mee. Wel de veiligheidsvlaggen + dialoog-guard.
      const blocked = guardBridgeFlags(ctx);
      if (blocked) return blocked;
      const raw = (args ?? {}) as { path?: unknown };
      if (typeof raw.path !== 'string' || raw.path.trim() === '') {
        return toolError(ctx, 'VALIDATION', 'Parameter \'path\' (text) is required: the absolute path of the file to import.');
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
        return toolError(ctx, 'INTERNAL', `Could not check the source path: ${e instanceof Error ? e.message : String(e)}`);
      }
      // `content` blijft '' voor een binair formaat — puur voor `formatOf` (verderop) om te sniffen
      // op CSV/P6-XML/MSPDI-XML-inhoud; het OPSLAGDOEL-besluit hangt niet af van `formatOf`'s
      // AI-facing label maar van de registry-vlag `canBeSaveTarget` (in `openAsDocument`, zie
      // verderop) — dus een binair formaat kan via `formatOf`'s IFC-terugval nooit per ongeluk als
      // opslagdoel-waardig gelezen worden.
      let input: FormatInput;
      try {
        // Gedeelde isBinary?readFile:readTextFile-tak,
        // óók hier — `fs` (McpFileFs) is structureel compatibel met `readFormatInput`'s `FormatIO`.
        input = await readFormatInput(path, fs);
      } catch (e) {
        return toolError(ctx, 'NOT_FOUND', `Could not read '${path}': ${e instanceof Error ? e.message : String(e)}`);
      }
      const content = input.text ?? '';

      let parsed: OpenedImport;
      try {
        // Geen `labels`: dienstlaag zonder `t(...)` — de MCP-laag is AI-facing en kent geen UI-taal.
        // `readIFC` valt dan terug op de Engelse default voor een bestand zonder IFCPROJECT (zie
        // ImportLabels).
        parsed = await parseOpenedFile(input);
      } catch (e) {
        return toolError(ctx, 'VALIDATION', `'${path}' could not be read as a schedule: ${e instanceof Error ? e.message : String(e)}`);
      }

      const format = formatOf(path, content);
      // Exact het laadpatroon van Bestand → Openen, want het IS dezelfde store-actie
      // (`openAsDocument` → `applyOpenedImport`): pristine tabblad hergebruiken of nieuwe
      // documenten (ook de meervoudige XER-vorm; bewust geen merge), OPSLAGDOEL alleen bij een
      // formaat dat `canBeSaveTarget` draagt, en GEKOPPELD laden (`linkedOpen`). Opslaan schrijft
      // ALTIJD IFC; zou een geïmporteerd .csv-/.xml-/.mpp-/.xer-pad het opslagdoel worden, dan
      // overschrijft de eerstvolgende Ctrl+S van de user zijn eigen bronbestand met IFC-inhoud
      // onder die naam. Omgekeerd: krijgt een .ifc het bronpad als opslagdoel, dan moet hij ook
      // alles laden wat erin stond — zonder `linkedOpen` zou Ctrl+S de bibliotheekkoppeling +
      // herkomststempels uit het bronbestand wissen (`tests/mcp/cases-import-bibliotheek.ts`).
      // `formatOf` blijft puur het AI-facing label
      // (`format`, voor de respons en de notices).
      // Lezen en parsen kunnen seconden duren: controleer pauze/alleen-lezen/dialoog opnieuw vlak
      // vóór het openen, anders opent de AI alsnog een document nadat de gebruiker hem stopte.
      const lateBlocked = postAwaitGuards(ctx);
      if (lateBlocked) return lateBlocked;
      const opened = ctx.app.store.getState().openAsDocument(parsed, {
        name: path,
        ref: { kind: 'path', path },
      });
      // Drift-anker naar het RESULTERENDE document — anders zou de eerstvolgende
      // mutatie op het importdocument als drift falen en zet de import zichzelf klem.
      bindExpectedDoc(ctx);

      const after = ctx.app.store.getState();
      const payloadById = new Map(after.getOpenDocumentPayloads().map(document => [
        document.id,
        document.payload,
      ]));
      const documents = opened.documentIds.map(documentId => {
        const payload = payloadById.get(documentId);
        if (!payload) throw new Error(`Opened document '${documentId}' is missing after the import`);
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
        notices.push('CSV contains no calendar (the document now runs on the DEFAULT calendar — dates may differ) and no resources/assignments.');
      } else if (format === 'P6-XML') {
        notices.push('P6 XML: Nonlabor resources were imported as EQUIPMENT.');
      } else if (format === 'MPP14') {
        notices.push('MPP import is read-only (best effort; baselines and custom fields are not included). Saving writes IFC; export to MS Project = MSPDI XML.');
      } else if (format === 'XER') {
        notices.push(
          `XER import is read-only; this step imports ${documents.length} non-empty P6 project` +
          `${documents.length === 1 ? '' : 's'} as ${documents.length} document` +
          `${documents.length === 1 ? '' : 's'}. Saving writes IFC.`,
        );
      }
      if (format !== 'IFC') {
        notices.push('The document has NO save target yet: saving writes IFC, so the source file is not overwritten — the user chooses a path when saving. ');
      }
      return {
        ok: true,
        envelope: buildEnvelope(ctx),
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
