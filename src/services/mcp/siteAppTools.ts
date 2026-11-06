// De `planner_*`-tools voor de assistent van de site (platformbouw, `window.__OPDS_APP__`).
//
// Op de site heeft de tool geen bridge: er is geen Rust-shell en geen poort. De assistent van de site stuurt zijn
// toolcalls via de brug van de site naar dit koppelvlak in het frame. Daarachter draait dezelfde code als achter de
// bridge: de verzoekafhandeling (`createRequestHandler`: één sessie, wachtrij, documentanker, activiteitenlog),
// `handleMcpMessage` (schemapoort, crash-barrière), de toolregistry en de guards in `tools/runtime.ts`. Er is dus geen
// tweede implementatie en geen tweede lijst met tools; alleen het transport verschilt (een functieaanroep in plaats
// van een Tauri-event).
//
// DOCUMENTANKER. Elke `__OPDS_APP__` opent bij de eerste aanroep één MCP-sessie (`initialize`) en stuurt elke `run`
// in die sessie. Zo bewaart de verzoekafhandeling het anker tussen aanroepen, net als bij de bridge: wisselt de
// gebruiker van document, dan geeft de volgende wijziging `DOC_DRIFT` tot de assistent expliciet een document kiest
// (`planner_switch_document`).
//
// ALLEEN OP HET VENSTER VAN DE TOOL. Het object staat in het frame van de tool; wie erbij wil, moet al in dat frame
// draaien. Wat er van buiten binnenkomt, regelt de brug van de site (alleen van de ouder met de juiste oorsprong).
//
// LADEN. `installSiteAppTools` staat er meteen, zodat de brug niet hoeft te wachten. De dispatcher, de toolregistry
// en `server.ts` komen via dynamische imports binnen bij de eerste aanroep. Let op: dat maakt er nog geen aparte
// chunk van. Andere modules importeren `server.ts` en de toolregistry statisch (zie `docs/platformbouw.md`).
//
// BESTANDSTOOLS. `planner_export_ifc` en `planner_import_schedule` werken op een bestandssysteem, en dat is er in de
// browser niet: openen en opslaan lopen via het hostcontract (`siteHost.ts`), door de gebruiker. Ze staan daarom niet
// in `definitions()`, en `run` weigert ze met `niet_in_browser: <tool>`, ook als stap van `planner_batch`.
//
// ANTWOORDGROOTTE. Het contract vraagt antwoorden van hoogstens zo'n 30.000 tekens; dat geldt voor elk antwoord van
// `run`, envelop inbegrepen. Een leestool (`readOnlyHint`) die meer geeft, wordt geweigerd met `te_groot: …` en een
// uitweg die werkt: `limit`/`offset` (ook op het kritieke pad, de baselinevergelijking en de vertraginganalyse), één
// `part` van de gids, of `planner_list_tasks` in plaats van het overzicht. Een wijzigende tool of `planner_batch`
// krijgt nooit achteraf een fout (de wijziging is al gedaan); dat antwoord wordt één compact rapport
// (`compactChange`, zie "Grote wijzigingen"). Wat daarin moet blijven en niet zou passen, weigert `run` vóór
// uitvoering (`linksTooLarge`). Ook een foutantwoord blijft binnen de grens (`boundedFailure`).
import type { McpContext, McpToolDef, McpToolOk, McpToolResult } from './contracts';
import { createRequestHandler, type McpResponseEvent } from './requestHandler';

export const SITE_APP_UNAVAILABLE_TOOLS: ReadonlySet<string> = new Set(['planner_export_ifc', 'planner_import_schedule']);

/** Zoveel tekens mag het antwoord van een leestool met paginering hoogstens hebben (het contract: ~30.000). */
export const SITE_APP_MAX_RESPONSE_CHARS = 30_000;

/** Een tooldefinitie zoals de site hem leest: dezelfde velden als een regel uit `tools/list`. */
export interface SiteAppToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  annotations: McpToolDef['annotations'];
}

export interface SiteAppTools {
  /** De namen van de tools die hier werken. */
  tools(): Promise<string[]>;
  /** Hun definities, zoals in `tools/list`. */
  definitions(): Promise<SiteAppToolDefinition[]>;
  /** Eén tool uitvoeren. Geeft het `structuredContent` van het antwoord; een weigering wordt een fout. */
  run(name: string, args?: Record<string, unknown>): Promise<unknown>;
}

/** De bouwstenen die `run` nodig heeft; injecteerbaar zodat de tests dezelfde code zonder app-singleton draaien. */
interface SiteAppToolsDeps {
  getTools(): McpToolDef[];
  /** Bouwt de context voor één verzoek (echt: `buildMcpContext`). */
  buildContext(): McpContext;
  /** Verwerkt één rauwe JSON-RPC-body (echt: `handleMcpMessage`). */
  handleMessage(rawBody: string, ctx: McpContext): Promise<string>;
}

/**
 * Een weigering. `message` is altijd `CODE: melding`; `code` is dezelfde code los, zodat een brug die het
 * foutobject doorgeeft er niet in hoeft te zoeken. Codes: de toolcodes van het contract (`VALIDATION`, `PAUSED`,
 * `DOC_DRIFT`, …), `JSONRPC_<code>` voor een fout van de dispatcher (bijv. `JSONRPC_-32602` bij een onbekende tool),
 * en de codes van het sitecontract: `niet_in_browser` en `te_groot`.
 */
export class SiteAppToolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'SiteAppToolError';
    this.code = code;
  }
}

/** De definities voor de site: de registry zonder de bestandstools. Eén bron voor `definitions()` en `mcp-tools.json`. */
export function siteAppToolDefinitions(defs: readonly McpToolDef[]): SiteAppToolDefinition[] {
  return defs
    .filter((def) => !SITE_APP_UNAVAILABLE_TOOLS.has(def.name))
    .map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations }));
}

/** De inhoud van `mcp-tools.json` naast de platformbundel (`scripts/export-mcp-tools.ts`). */
export function siteAppToolsJson(defs: readonly McpToolDef[]): string {
  return `${JSON.stringify(siteAppToolDefinitions(defs), null, 1)}\n`;
}

/** Het eerste bestandstool in een aanroep (direct, of als stap van `planner_batch`), of null. */
function unavailableTool(name: string, args: Record<string, unknown>): string | null {
  if (SITE_APP_UNAVAILABLE_TOOLS.has(name)) return name;
  if (name === 'planner_batch' && Array.isArray(args.steps)) {
    for (const step of args.steps as unknown[]) {
      const tool = step !== null && typeof step === 'object' ? (step as { tool?: unknown }).tool : undefined;
      if (typeof tool === 'string' && SITE_APP_UNAVAILABLE_TOOLS.has(tool)) return tool;
    }
  }
  return null;
}

/** De lengte van een antwoord zoals de site hem doorgeeft (JSON). */
const sizeOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0;

/** Heeft deze tool paginering (`limit` en `offset`)? Dan de namen van al zijn parameters, anders null. */
function pagedFilters(def: McpToolDef | undefined): string[] | null {
  const properties = (def?.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
  const keys = Object.keys(properties);
  return keys.includes('limit') && keys.includes('offset') ? keys : null;
}

/** Hoe de assistent een te groot antwoord van deze leestool kleiner vraagt. Elke uitweg werkt echt (getoetst). */
function narrowHint(name: string, def: McpToolDef | undefined): string {
  const filters = pagedFilters(def);
  if (filters !== null) {
    const other = filters.filter((key) => key !== 'limit' && key !== 'offset');
    const narrow = other.length > 0 ? `, or narrow it with ${other.map((key) => `\`${key}\``).join(', ')}` : '';
    return `Ask for a smaller page with \`limit\` and \`offset\`${narrow}.`;
  }
  if (name === 'planner_get_planning_guide') {
    return 'Ask for one part at a time: first `part: "guide"` (the agent guide), then `part: "skill"` (the two skills).';
  }
  if (name === 'planner_get_resource_histogram') {
    return 'Ask for less detail: one resource at a time in `resourceIds`, a shorter window with `van`/`tot`, or a coarser `bucket` ("maand").';
  }
  if (name === 'planner_get_project_overview') {
    return 'Read the tasks page by page with planner_list_tasks (`limit` and `offset`), and one task in full with planner_get_task.';
  }
  return 'Ask for a smaller part: the tasks page by page with planner_list_tasks (`limit` and `offset`), or one task with planner_get_task.';
}

/** De fout voor een te groot antwoord van een leestool, met de uitweg. */
function tooLarge(name: string, chars: number, def: McpToolDef | undefined): SiteAppToolError {
  return new SiteAppToolError(
    'te_groot',
    `${name} answered with ${chars} characters (limit ${SITE_APP_MAX_RESPONSE_CHARS}). ${narrowHint(name, def)}`,
  );
}

// --- Grote wijzigingen ---------------------------------------------------------------------------
//
// Een wijzigende tool of `planner_batch` krijgt NOOIT achteraf een fout: de wijziging is al gedaan, en een fout zou
// de assistent laten denken dat ze mislukte (en haar herhalen). Een te groot antwoord wordt daarom één compact
// rapport (`compactChange`), met daarna één eindcontrole op het hele antwoord, envelop inbegrepen.
//
// Wat altijd blijft: de status per stap en elke koppeling van een opgegeven label naar een nieuw id
// (`SITE_APP_ID_LINK_TOOLS`). Die koppeling is later niet meer terug te vragen: het label wordt niet opgeslagen.
// Omdat ze moet blijven, weigert `run` VÓÓR uitvoering een aanroep waarvan de koppelingen samen met het rapport
// niet zouden passen (`linksTooLarge`), met de opdracht kleinere porties te sturen. Al het andere wordt een aantal
// of een samenvatting, en wat er nog past van de restwerkcorrecties en de deelweigeringen komt erbij, per regel
// ingekort.

/**
 * Bovengrens voor één echt id in JSON, met aanhalingstekens. `generateId` (`src/utils/id.ts`) maakt
 * `<voorvoegsel>-<tijd base36, 8><willekeurig, ≤4><teller>`: met `task`/`res`/`cal` en een teller tot tien cijfers is
 * dat hoogstens 27 tekens. De test meet de echte id's van 300 nieuwe taken en houdt ze onder deze grens.
 */
export const SITE_APP_REAL_ID_JSON_CHARS = 29;

/** Vaste ruimte van het compacte rapport voor één aanroep: envelop (titel en notities ingekort), uitleg, aantallen. */
export const SITE_APP_REPORT_BASE_CHARS = 4_000;

/** Vaste ruimte per batchstap in het rapport, naast de naam van de tool (`step`, `status`, `omitted`, de haakjes
 *  van een koppelingsveld). */
export const SITE_APP_REPORT_STEP_CHARS = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const listIn = (value: unknown, key: string): unknown[] =>
  isRecord(value) && Array.isArray(value[key]) ? (value[key] as unknown[]) : [];
const stringIn = (item: unknown, key: string): string[] =>
  isRecord(item) && typeof item[key] === 'string' ? [item[key] as string] : [];
const createdMap = (data: unknown): Record<string, unknown> | undefined =>
  isRecord(data) && isRecord(data.created) ? { created: data.created } : undefined;

/** Een tool die een koppeling van een opgegeven label naar een nieuw id teruggeeft. */
interface IdLinkTool {
  /** De labels die deze aanroep zou aanmaken (een bovengrens: een label kan ook een bestaand item raken). */
  labels(args: unknown): string[];
  /** Alleen de koppelingen uit het antwoord, als deel van het compacte rapport. */
  keep(data: unknown): Record<string, unknown> | undefined;
  /** Vaste JSON-tekens per koppeling, naast het label en het id. */
  perLink: number;
}

/**
 * De tools die zo'n koppeling teruggeven, nagelopen in november 2026 (#825, ronde 3 en 4). Geen automatische
 * vangst: een nieuwe aanmaaktool met een eigen label moet hier bij. Een vergeten tool verliest zijn koppelingen niet
 * stil (een veld buiten `SITE_APP_RESULT_FIELDS` blijft staan), maar telt dan niet mee in de controle vooraf.
 * `tests/mcp/cases-site-app-tools.ts` toetst per tool de echte invoer en de bewaarde uitvoer, direct en in een batch.
 *   - `planner_add_tasks`: `created` (`tempId` → taak-id);
 *   - `planner_manage_resources`: `created` (`tempId` → resource-id, alleen bij `action: "create"`);
 *   - `planner_update_calendar`: `calendars[].{requestedId, id}` (alleen bij `created: true`).
 */
export const SITE_APP_ID_LINK_TOOLS: Readonly<Record<string, IdLinkTool>> = {
  planner_add_tasks: {
    labels: (args) => listIn(args, 'tasks').flatMap((task) => stringIn(task, 'tempId')),
    keep: createdMap,
    perLink: 2, // "label":"id",
  },
  planner_manage_resources: {
    labels: (args) =>
      listIn(args, 'actions').filter((a) => isRecord(a) && a.action === 'create').flatMap((a) => stringIn(a, 'tempId')),
    keep: createdMap,
    perLink: 2,
  },
  planner_update_calendar: {
    labels: (args) =>
      listIn(args, 'calendars').filter((c) => isRecord(c) && c.create === true).flatMap((c) => stringIn(c, 'id')),
    keep: (data) => {
      const calendars = listIn(data, 'calendars')
        .filter((row) => isRecord(row) && row.created === true && typeof row.requestedId === 'string')
        .map((row) => ({ requestedId: (row as { requestedId: string }).requestedId, id: (row as { id: unknown }).id }));
      return calendars.length > 0 ? { calendars } : undefined;
    },
    perLink: 23, // {"requestedId":label,"id":id},
  },
};

/** De koppelingen van één aanroep (of de stappen van een batch), met de toolnaam per stap. */
function plannedCalls(name: string, args: unknown): { tool: string; args: unknown }[] {
  if (name !== 'planner_batch') return [{ tool: name, args }];
  return listIn(args, 'steps').flatMap((step) =>
    isRecord(step) && typeof step.tool === 'string' ? [{ tool: step.tool, args: step.args }] : [],
  );
}

/**
 * Weigering vóór uitvoering als de koppelingen samen met de rapportvorm van DEZE aanroep het budget kunnen
 * overschrijden; anders null. De ruimte voor het rapport hangt af van de aanroep: vast deel plus een regel per
 * batchstap.
 */
function linksTooLarge(name: string, args: unknown): SiteAppToolError | null {
  const calls = plannedCalls(name, args);
  const reserve = SITE_APP_REPORT_BASE_CHARS +
    (name === 'planner_batch' ? calls.reduce((sum, c) => sum + SITE_APP_REPORT_STEP_CHARS + c.tool.length, 0) : 0);
  let links = 0;
  let bound = 0;
  for (const call of calls) {
    const tool = SITE_APP_ID_LINK_TOOLS[call.tool];
    if (!tool) continue;
    for (const label of tool.labels(call.args)) {
      links += 1;
      bound += JSON.stringify(label).length + SITE_APP_REAL_ID_JSON_CHARS + tool.perLink;
    }
  }
  const budget = SITE_APP_MAX_RESPONSE_CHARS - reserve;
  if (links === 0 || bound <= budget) return null;
  const max = Math.max(0, Math.floor(budget / (bound / links)));
  return new SiteAppToolError(
    'te_groot',
    `${name} would create ${links} items with a label (tempId, or id with create: true); their label → id links ` +
      `alone could exceed the answer limit of ${SITE_APP_MAX_RESPONSE_CHARS} characters. Nothing was changed. Send ` +
      `at most ${max} new items with these labels per call (shorter labels allow more), in several calls.`,
  );
}

const clip = (text: unknown, max: number): string => {
  const value = typeof text === 'string' ? text : JSON.stringify(text) ?? '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

/** De koppelingen uit het antwoord van één tool, of niets. */
const linksOf = (tool: string, data: unknown) => SITE_APP_ID_LINK_TOOLS[tool]?.keep(data);

// --- Foutantwoorden ------------------------------------------------------------------------------

/** Zoveel tekens mag een foutmelding (`CODE: melding`) hoogstens hebben; de rest van het foutobject is klein. */
export const SITE_APP_MAX_ERROR_CHARS = SITE_APP_MAX_RESPONSE_CHARS - 1_000;

/** Een lange keten `a → b → … → z` (zoals een kring) wordt een aantal plus een begrensd fragment. */
function summariseChains(text: string): string {
  return text.replace(/[^\s→;,()]+(?: → [^\s→;,()]+){11,}/g, (chain) => {
    const parts = chain.split(' → ');
    return `${parts.slice(0, 5).join(' → ')} → … ${parts.length - 8} more … → ${parts.slice(-3).join(' → ')} (${parts.length} items in total)`;
  });
}

/**
 * Een foutantwoord binnen de grens, vóór er een `SiteAppToolError` van komt. De code blijft, ook de terugrolmelding
 * en het staprapport van een batch (`Report per step (everything rolled back): …`, aan het eind van de tekst). Een
 * lange keten wordt een aantal plus een fragment; past het dan nog niet, dan blijven het begin en het eind (met de
 * stapstatussen) en verdwijnt het midden, met het aantal weggelaten tekens.
 */
function boundedFailure(code: string, error: string): SiteAppToolError {
  const max = SITE_APP_MAX_ERROR_CHARS - code.length - 2;
  if (error.length <= max) return new SiteAppToolError(code, error);
  let text = summariseChains(error);
  if (text.length > max) {
    const head = 2_000;
    const tail = max - head - 80;
    text = `${text.slice(0, head)} … (${text.length - head - tail} characters left out) … ${text.slice(-tail)}`;
  }
  return new SiteAppToolError(code, text);
}

/**
 * DE INDELING van elk veld dat een wijzigende tool kan teruggeven (envelop, `data`, en `data` van een batchstap).
 *   - `keep`: blijft in het compacte rapport. Statussen, nevenwijzigingen en waarschuwingen, en alles wat later niet
 *     meer terug te lezen is (verwijderde ids, faseovergangen, restwerkcorrecties).
 *   - `links`: alleen de koppelingen label → id blijven (`SITE_APP_ID_LINK_TOOLS`), de rest mag weg.
 *   - `drop`: mag weg; de assistent leest het opnieuw met een leestool (datums, rijen, wat hij zelf vroeg).
 * Een veld dat NIET in deze lijst staat, blijft (ingekort): een nieuw veld valt dus nooit stil weg.
 * `tests/mcp/cases-site-app-tools.ts` roept elke wijzigende tool echt aan en eist dat elk veld uit een antwoord hier
 * staat. Een losse waarde (tekst, getal, ja/nee) blijft altijd, ook bij `drop`; de indeling telt voor lijsten en
 * objecten. Een lange lijst die blijft, wordt de eerste regels die passen plus het totaal in `compacted.shortened`.
 */
export const SITE_APP_RESULT_FIELDS = {
  envelope: {
    activeDocumentId: 'keep', documentTitle: 'keep', scheduleStale: 'keep', paused: 'keep', readOnly: 'keep',
    backupCreated: 'keep', timephasedGuidanceLost: 'keep', remainingWorkRecomputed: 'keep',
    scheduleRecalculated: 'keep', datesAsRecorded: 'keep', scheduleNote: 'keep', scheduleError: 'keep',
  },
  data: {
    // koppelingen label → id
    created: 'links', calendars: 'links',
    // nevenwijzigingen, waarschuwingen, wat weg is: blijft
    phaseTransitions: 'keep', progressAdjusted: 'keep', warnings: 'keep', warning: 'keep', note: 'keep', hint: 'keep',
    reason: 'keep', cappedTaskIds: 'keep', anchorsClamped: 'keep', hourMeasureTaskIds: 'keep', statusDateNote: 'keep',
    statusDateEffect: 'keep', unresolved: 'keep', unresolvedReasons: 'keep', deleted: 'keep', deletedTaskIds: 'keep',
    cascadedTaskIds: 'keep', deletedBaselineId: 'keep', deletedName: 'keep', deletedCreatedAt: 'keep',
    deletedTaskCount: 'keep', removedAssignmentCount: 'keep', removedDependencyCount: 'keep', wasActive: 'keep',
    remainingCount: 'keep', changed: 'keep', previousName: 'keep', previousActiveBaselineId: 'keep',
    previousActiveBaselineName: 'keep', activeBaselineId: 'keep', activeBaselineName: 'keep', undone: 'keep',
    redone: 'keep', undoDepth: 'keep', redoDepth: 'keep', cleared: 'keep', recomputed: 'keep', dryRun: 'keep',
    constrainToFloat: 'keep', projectEnd: 'keep', projectEndBefore: 'keep', projectEndAfter: 'keep',
    projectEndDelta: 'keep', deltaDays: 'keep', endDeltaDays: 'keep', newStartDate: 'keep', shiftBaselines: 'keep',
    taskCount: 'keep', baselineId: 'keep', name: 'keep', documentId: 'keep', title: 'keep', projectName: 'keep',
    taskId: 'keep', durationUnit: 'keep', scheduleDuration: 'keep', stepCount: 'keep',
    // opnieuw te lezen met een leestool, of wat de assistent zelf vroeg: mag weg
    tasks: 'drop', updated: 'drop', added: 'drop', removed: 'drop', moved: 'drop', resources: 'drop',
    project: 'drop', interruptions: 'drop', shifts: 'drop', delays: 'drop',
    // `planner_batch`: `steps` krijgt een eigen vorm, `rejections` staat ook in `itemRejections`, `substeps` is het
    // activiteitenlog (al verwerkt; gaat er vóór de lengtemeting al af)
    steps: 'keep', rejections: 'drop', substeps: 'drop',
    // leesuitvoer van een leesstap in een batch (die gaat er als geheel af)
    total: 'drop', has_more: 'drop', next_offset: 'drop',
  },
} as const satisfies Record<'envelope' | 'data', Record<string, 'keep' | 'links' | 'drop'>>;

const fieldClass = (scope: 'envelope' | 'data', key: string): 'keep' | 'links' | 'drop' =>
  (SITE_APP_RESULT_FIELDS[scope] as Record<string, 'keep' | 'links' | 'drop'>)[key] ?? 'keep';

const isScalar = (value: unknown) => value === null || typeof value !== 'object';

/** Een waarde ingekort: tekst tot 200 tekens, een lijst binnenin tot 5 regels plus een regel met het totaal. */
function shorten(value: unknown): unknown {
  if (typeof value === 'string') return clip(value, 200);
  if (Array.isArray(value)) {
    const head = value.slice(0, 5).map(shorten);
    return value.length > 5 ? [...head, `… ${value.length - 5} more (${value.length} in total)`] : head;
  }
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shorten(v)]));
  return value;
}

interface BatchStep { step: number; tool: string; status: string; data?: unknown; error?: string }

/** Iets wat in het rapport komt zolang het past: een veld in `into`, een lijst regel voor regel. */
interface Fill { into: Record<string, unknown>; key: string; value: unknown; path: string }

/**
 * Het compacte rapport van een te groot wijzigingsantwoord.
 *   1. Het geraamte, dat altijd blijft: de status per stap, elke koppeling label → id, de envelop zonder lijsten
 *      (met een samenvatting van de restwerkcorrecties), en `compacted` met wat er weg is.
 *   2. Daarna, zolang het past: de velden die blijven (`SITE_APP_RESULT_FIELDS`, en elk veld dat er niet in staat),
 *      per stap op volgorde; dan de restwerkcorrecties; dan de deelweigeringen. Een lijst regel voor regel, elke
 *      regel ingekort (`shorten`); wat niet meer past, telt `compacted.shortened`.
 *   3. Eén eindcontrole op het hele antwoord. Past het niet, dan alleen het geraamte.
 */
function compactChange(name: string, result: McpToolOk, chars: number, getDef: (tool: string) => McpToolDef | undefined): McpToolOk {
  const { remainingWorkRecomputed: corrections = [], ...envelopeRest } = result.envelope;
  const envelope: Record<string, unknown> = Object.fromEntries(
    Object.entries(envelopeRest).map(([k, v]) => [k, typeof v === 'string' ? clip(v, k === 'documentTitle' ? 200 : 500) : v]),
  );
  if (corrections.length > 0) {
    envelope.remainingWorkRecomputedSummary = {
      count: corrections.length,
      tasks: new Set(corrections.map((c) => c.taskId)).size,
      beforeHours: Math.round(corrections.reduce((sum, c) => sum + c.beforeHours, 0) * 100) / 100,
      afterHours: Math.round(corrections.reduce((sum, c) => sum + c.afterHours, 0) * 100) / 100,
    };
  }
  const omitted: Record<string, number> = {};
  const omit = (pattern: string) => { omitted[pattern] = (omitted[pattern] ?? 0) + 1; };
  const shortened: Record<string, number> = {};
  const fills: Fill[] = [];
  /** Geraamte van één `data` (direct, of van een batchstap): koppelingen nu, de rest als vulling of weg. */
  // `path` noemt de plek precies (voor `shortened`), `pattern` zonder stapnummer (voor de telling in `omitted`).
  const skeleton = (tool: string, data: unknown, into: Record<string, unknown>, path: string, pattern: string, isRead: boolean) => {
    if (!isRecord(data)) return;
    if (isRead) { omit(`${pattern}(read output)`); return; }
    Object.assign(into, linksOf(tool, data) ?? {});
    for (const [key, value] of Object.entries(data)) {
      const kind = fieldClass('data', key);
      if (kind === 'links') continue;
      if (kind === 'drop' && !isScalar(value)) { omit(`${pattern}${key}`); continue; }
      fills.push({ into, key, value, path: `${path}${key}` });
    }
  };
  const isBatch = name === 'planner_batch';
  const raw = result.data;
  const data: Record<string, unknown> = {};
  if (isBatch && isRecord(raw)) {
    const steps = (Array.isArray(raw.steps) ? (raw.steps as BatchStep[]) : []).map((step) => {
      const out: Record<string, unknown> = { step: step.step, tool: step.tool, status: step.status };
      if (step.error !== undefined) out.error = clip(step.error, 300);
      skeleton(step.tool, step.data, out, `steps[${step.step}].`, 'steps[].', getDef(step.tool)?.kind === 'read');
      return out;
    });
    data.steps = steps;
    if (typeof raw.stepCount === 'number') data.stepCount = raw.stepCount;
  } else {
    skeleton(name, raw, data, '', '', false);
  }
  const rejections = result.itemRejections ?? [];
  const compacted = {
    originalChars: chars,
    limit: SITE_APP_MAX_RESPONSE_CHARS,
    note:
      'Every change in this answer succeeded. The full answer was too large, so it was shortened. Always kept: the ' +
      'status per step, every label → id link (`created`, `calendars`) and the side effects and warnings, as far as ' +
      'they fit (see `shortened`: path → total). Left out (`omitted`: field → number of times): data you can read again, such as dates and the output of read ' +
      'steps; call a read step on its own (outside planner_batch), and read tasks with planner_list_tasks (`limit`, ' +
      '`offset`) or planner_get_task.',
    omitted,
    shortened,
  };
  const build = (full: boolean): McpToolOk => ({
    ok: true,
    envelope: envelope as unknown as McpToolOk['envelope'],
    data: { compacted: full ? compacted : { ...compacted, omitted: undefined, note: 'Every change in this answer succeeded; the answer was shortened to the ids and the status per step.' }, ...data },
  });
  // Vullen zolang het past, ruim onder de grens.
  const room = SITE_APP_MAX_RESPONSE_CHARS - 500;
  let size = sizeOf(build(true)) + 200; // ruimte voor de `shortened`-regels
  const fit = (fill: Fill) => {
    if (Array.isArray(fill.value)) {
      const list: unknown[] = [];
      fill.into[fill.key] = list;
      size += fill.key.length + 5;
      for (const entry of fill.value) {
        const short = shorten(entry);
        const add = sizeOf(short) + 1;
        if (size + add > room) { shortened[fill.path] = fill.value.length; return; }
        list.push(short);
        size += add;
      }
      return;
    }
    const short = shorten(fill.value);
    const add = sizeOf(short) + fill.key.length + 4;
    if (size + add > room) { shortened[fill.path] = 1; return; }
    fill.into[fill.key] = short;
    size += add;
  };
  fills.forEach(fit);
  if (corrections.length > 0) fit({ into: envelope, key: 'remainingWorkRecomputed', value: corrections, path: 'envelope.remainingWorkRecomputed' });
  const top: Record<string, unknown> = {};
  if (rejections.length > 0) fit({ into: top, key: 'itemRejections', value: rejections, path: 'itemRejections' });
  const report: McpToolOk = { ...build(true), ...(top as Partial<McpToolOk>) };
  // EINDCONTROLE op het hele antwoord. Past het niet, dan alleen het geraamte: de koppelingen blijven altijd
  // (`linksTooLarge` houdt ze vóór uitvoering binnen het budget), net als de status per stap.
  if (sizeOf(report) <= SITE_APP_MAX_RESPONSE_CHARS) return report;
  for (const step of (data.steps as Record<string, unknown>[] | undefined) ?? []) {
    for (const key of Object.keys(step)) if (!['step', 'tool', 'status', 'created', 'calendars'].includes(key)) delete step[key];
  }
  for (const key of Object.keys(data)) if (!['steps', 'created', 'calendars', 'stepCount'].includes(key)) delete data[key];
  delete envelope.remainingWorkRecomputed;
  return build(false);
}

/**
 * Eén MCP-sessie over de bestaande verzoekafhandeling. `createRequestHandler` antwoordt via `emit`; hier wacht een
 * belofte per verzoek-id op dat antwoord. De sessie opent bij het eerste verzoek met `initialize`.
 */
function createSiteSession(deps: SiteAppToolsDeps): (body: (id: number) => string) => Promise<string> {
  const waiting = new Map<number, (response: McpResponseEvent) => void>();
  const handle = createRequestHandler({
    emit: (_event, payload) => {
      const response = payload as McpResponseEvent;
      const resolve = waiting.get(response.id);
      waiting.delete(response.id);
      resolve?.(response);
    },
    buildContext: () => deps.buildContext(),
    handleMessage: (rawBody, ctx) => deps.handleMessage(rawBody, ctx),
  });
  let nextId = 0;
  const send = (body: (id: number) => string, sessionId: string | null): Promise<McpResponseEvent> => {
    nextId += 1;
    const id = nextId;
    return new Promise<McpResponseEvent>((resolve, reject) => {
      waiting.set(id, resolve);
      handle({ id, body: body(id), sessionId }).catch((error: unknown) => {
        waiting.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  };
  let session: Promise<string> | null = null;
  const open = (): Promise<string> => {
    session ??= send(
      (id) => JSON.stringify({
        jsonrpc: '2.0', id, method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'openaec-site', version: '1' } },
      }),
      null,
    ).then((response) => {
      if (!response.sessionId) throw new SiteAppToolError('JSONRPC_SESSION', 'could not open an MCP session');
      return response.sessionId;
    });
    // Mislukt het openen, dan probeert de volgende aanroep het opnieuw.
    session.catch(() => { session = null; });
    return session;
  };
  return async (body) => (await send(body, await open())).body;
}

function createSiteAppTools(loadDeps: () => Promise<SiteAppToolsDeps>): SiteAppTools {
  let call: Promise<(body: (id: number) => string) => Promise<string>> | null = null;
  const session = () => (call ??= loadDeps().then(createSiteSession));
  const available = async () => siteAppToolDefinitions((await loadDeps()).getTools());
  return {
    async tools() {
      return (await available()).map((def) => def.name);
    },
    async definitions() {
      return available();
    },
    async run(name, args = {}) {
      const blocked = unavailableTool(name, args);
      if (blocked !== null) {
        throw new SiteAppToolError('niet_in_browser', `${blocked} — the user opens and saves files through the site`);
      }
      const tooMany = linksTooLarge(name, args);
      if (tooMany !== null) throw tooMany;
      const raw = await (await session())((id) =>
        JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
      );
      const response = JSON.parse(raw) as {
        result?: { structuredContent?: McpToolResult };
        error?: { code?: number; message?: string };
      };
      if (response.error) {
        throw boundedFailure(`JSONRPC_${response.error.code ?? 'ERROR'}`, response.error.message ?? 'MCP error');
      }
      let result = response.result?.structuredContent;
      if (!result) throw new SiteAppToolError('JSONRPC_ERROR', 'MCP response without a result');
      // `substeps` van een batch is het activiteitenlog; de verzoekafhandeling heeft het al verwerkt, en de assistent
      // heeft er niets aan wat niet ook in `steps` staat. Het gaat er vóór de lengtemeting af.
      if (name === 'planner_batch' && isRecord(result.data) && 'substeps' in result.data) {
        const { substeps: _activity, ...rest } = result.data;
        void _activity;
        result = { ...result, data: rest } as McpToolResult;
      }
      if (!result.ok) throw boundedFailure(result.code, result.error);
      const chars = sizeOf(result);
      if (chars <= SITE_APP_MAX_RESPONSE_CHARS) return result;
      const defs = (await loadDeps()).getTools();
      const getDef = (tool: string) => defs.find((d) => d.name === tool);
      const def = getDef(name);
      // Een leestool veranderde niets: weigeren is veilig, en de melding zegt hoe het kleiner kan.
      if (def?.annotations.readOnlyHint) throw tooLarge(name, chars, def);
      // Al het andere kan iets veranderd hebben: inkorten, nooit achteraf een fout.
      return compactChange(name, result, chars, getDef);
    },
  };
}

/** Zet `window.__OPDS_APP__` neer (alleen de platformbouw, `main.tsx`). De MCP-laag laadt pas bij de eerste aanroep. */
export function installSiteAppTools(target: { __OPDS_APP__?: SiteAppTools } = window as never): void {
  let deps: Promise<SiteAppToolsDeps> | null = null;
  const loadDeps = () => {
    deps ??= (async (): Promise<SiteAppToolsDeps> => {
      const [{ handleMcpMessage }, { buildMcpContext }, { getTools }] = await Promise.all([
        import('./dispatcher'),
        import('./server'),
        import('./toolRegistry'),
      ]);
      return { getTools, buildContext: () => buildMcpContext(), handleMessage: handleMcpMessage };
    })();
    return deps;
  };
  target.__OPDS_APP__ = createSiteAppTools(loadDeps);
}
