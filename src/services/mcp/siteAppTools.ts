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
// niet zouden passen (`linksTooLarge`), met de opdracht kleinere porties te sturen. Verder valt uit het antwoord
// van een wijzigende tool geen veld weg; alleen lange lijsten houden hun eerste regels (zie `compactChange`).

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

/** Een tool die een koppeling van een opgegeven label naar een nieuw id teruggeeft. */
interface IdLinkTool {
  /** De labels die deze aanroep zou aanmaken (een bovengrens: een label kan ook een bestaand item raken). */
  labels(args: unknown): string[];
  /** Het veld van `data` waarin de koppelingen staan. */
  field: 'created' | 'calendars';
  /** Bij een lijstveld: de koppeling uit één regel (`{requestedId, id}`), of niets als de regel er geen is. Zo'n
   *  regel blijft bij het inkorten van de lijst altijd staan, zo nodig alleen als koppeling. */
  linkOf?(entry: unknown): unknown;
  /** Vaste JSON-tekens per koppeling, naast het label en het id. */
  perLink: number;
}

/**
 * De tools die zo'n koppeling teruggeven, nagelopen in november 2026 (#825, ronde 3 tot 5). Geen automatische
 * vangst: een nieuwe aanmaaktool met een eigen label moet hier bij. Vergeet je er een, dan telt hij niet mee in de
 * controle vooraf, en kan een lange lijst met zijn koppelingen bij het inkorten regels verliezen.
 * `tests/mcp/cases-site-app-tools.ts` toetst per tool de echte invoer en de bewaarde uitvoer, direct en in een batch.
 *   - `planner_add_tasks`: `created` (`tempId` → taak-id);
 *   - `planner_manage_resources`: `created` (`tempId` → resource-id, alleen bij `action: "create"`);
 *   - `planner_update_calendar`: `calendars[].{requestedId, id}` (alleen bij `created: true`).
 */
export const SITE_APP_ID_LINK_TOOLS: Readonly<Record<string, IdLinkTool>> = {
  planner_add_tasks: {
    labels: (args) => listIn(args, 'tasks').flatMap((task) => stringIn(task, 'tempId')),
    field: 'created',
    perLink: 2, // "label":"id",
  },
  planner_manage_resources: {
    labels: (args) =>
      listIn(args, 'actions').filter((a) => isRecord(a) && a.action === 'create').flatMap((a) => stringIn(a, 'tempId')),
    field: 'created',
    perLink: 2,
  },
  planner_update_calendar: {
    labels: (args) =>
      listIn(args, 'calendars').filter((c) => isRecord(c) && c.create === true).flatMap((c) => stringIn(c, 'id')),
    field: 'calendars',
    linkOf: (row) =>
      isRecord(row) && row.created === true && typeof row.requestedId === 'string'
        ? { requestedId: row.requestedId, id: row.id }
        : undefined,
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

interface BatchStep { step: number; tool: string; status: string; data?: unknown; error?: string }

/** Een lijst in het antwoord die bij het inkorten regels mag verliezen (de eerste blijven), met wat er blijft. */
interface Shrinkable {
  /** Waar de lijst staat, voor `compacted.shortened`. */
  path: string;
  into: Record<string, unknown>;
  key: string;
  list: unknown[];
  /** Per regel: de koppeling die altijd blijft (bij `linkOf`), anders niets. */
  linkOf?: (entry: unknown) => unknown;
}

/**
 * Het compacte rapport van een te groot wijzigingsantwoord. Uit het antwoord van een wijzigende tool valt GEEN veld
 * weg: de wijziging is gedaan, en wat het antwoord erover zegt (overgangen, gewiste waarden, waarschuwingen) is
 * later vaak niet meer terug te lezen.
 *   1. Weg: alleen de uitvoer van leesstappen in een batch (`readOnlyHint`; de assistent leest die opnieuw).
 *   2. Past het dan nog niet: de lange lijsten in de wijzigingsantwoorden (in `data`, in elke batchstap, de
 *      restwerkcorrecties in de envelop en de deelweigeringen) houden hun eerste regels, eerlijk verdeeld: elke lijst
 *      regel voor regel om de beurt, zolang het past. `compacted.shortened` noemt per lijst het totaal en het aantal
 *      weggelaten regels. Een koppeling label → id blijft altijd (`created` is geen lijst; een kalenderregel met
 *      `created: true` blijft zo nodig als `{requestedId, id}`).
 *   3. Eén eindcontrole op het hele antwoord. Past het dan nog niet (alleen bij heel lange losse teksten), dan het
 *      geraamte: de status per stap en de koppelingen.
 */
function compactChange(name: string, result: McpToolOk, chars: number, getDef: (tool: string) => McpToolDef | undefined): McpToolOk {
  const envelope: Record<string, unknown> = { ...result.envelope };
  const data: Record<string, unknown> = isRecord(result.data) ? { ...result.data } : { value: result.data };
  const top: { itemRejections?: unknown[] } = result.itemRejections ? { itemRejections: [...result.itemRejections] } : {};
  const shrinkables: Shrinkable[] = [];
  /** De lijsten van één wijzigingsantwoord (`data` direct, of van een batchstap); kopieën, zodat inkorten kan. */
  const collect = (tool: string, into: Record<string, unknown>, path: string) => {
    const links = SITE_APP_ID_LINK_TOOLS[tool];
    for (const [key, value] of Object.entries(into)) {
      if (!Array.isArray(value)) continue;
      into[key] = [...value];
      shrinkables.push({ path: `${path}${key}`, into, key, list: value, linkOf: links?.field === key ? links.linkOf : undefined });
    }
  };
  let readSteps = 0;
  if (name === 'planner_batch' && Array.isArray(data.steps)) {
    data.steps = (data.steps as BatchStep[]).map((step) => {
      if (step.data !== undefined && getDef(step.tool)?.annotations.readOnlyHint) {
        readSteps += 1;
        const { data: _read, ...rest } = step;
        void _read;
        return { ...rest, readOutputOmitted: true };
      }
      if (!isRecord(step.data)) return { ...step };
      const stepData = { ...step.data };
      collect(step.tool, stepData, `steps[${step.step}].`);
      return { ...step, data: stepData };
    });
    // `rejections` van de batch zelf is een lijst als elke andere.
    if (Array.isArray(data.rejections)) {
      const list = data.rejections as unknown[];
      data.rejections = [...list];
      shrinkables.push({ path: 'rejections', into: data, key: 'rejections', list });
    }
  } else {
    collect(name, data, '');
  }
  if (Array.isArray(envelope.remainingWorkRecomputed)) {
    shrinkables.push({ path: 'envelope.remainingWorkRecomputed', into: envelope, key: 'remainingWorkRecomputed', list: [...(envelope.remainingWorkRecomputed as unknown[])] });
  }
  if (top.itemRejections) shrinkables.push({ path: 'itemRejections', into: top as Record<string, unknown>, key: 'itemRejections', list: top.itemRejections });

  const shortened: Record<string, { total: number; omitted: number }> = {};
  const compacted = {
    originalChars: chars,
    limit: SITE_APP_MAX_RESPONSE_CHARS,
    note:
      'Every change in this answer succeeded. The full answer was too large, so it was shortened. Nothing an editing ' +
      'step returned was left out' +
      (readSteps > 0 ? ', except the output of read steps (`readOutputOmitted`): call such a step on its own, outside planner_batch, to read it' : '') +
      '. Long lists keep their first entries; `shortened` gives per list the total and how many were left out. ' +
      'Read tasks again with planner_list_tasks (`limit`, `offset`) or planner_get_task.',
    shortened,
  };
  const assemble = (): McpToolOk => ({
    ok: true,
    envelope: envelope as unknown as McpToolOk['envelope'],
    data: { compacted, ...data },
    ...(top.itemRejections ? { itemRejections: top.itemRejections as McpToolOk['itemRejections'] } : {}),
  });
  if (sizeOf(assemble()) <= SITE_APP_MAX_RESPONSE_CHARS) return assemble();

  // Inkorten. Eerst elke lijst tot zijn koppelingen; dan om de beurt een regel terug, zolang het past. `room` begint
  // ruim onder de grens en zakt als `shortened` zelf de ruimte opeet (veel ingekorte lijsten).
  const fill = (room: number): McpToolOk => {
    for (const key of Object.keys(shortened)) delete shortened[key];
    const kept = shrinkables.map((sh) => {
      const links = sh.list.map((entry) => sh.linkOf?.(entry));
      sh.into[sh.key] = links.filter((link) => link !== undefined);
      return { sh, links, full: 0 };
    });
    let size = sizeOf(assemble());
    let growing = true;
    for (let i = 0; growing; i++) {
      growing = false;
      for (const k of kept) {
        if (k.full !== i || i >= k.sh.list.length) continue;
        const add = sizeOf(k.sh.list[i]) + 1 - (k.links[i] !== undefined ? sizeOf(k.links[i]) + 1 : 0);
        if (size + add > room) continue;
        size += add;
        k.full = i + 1;
        growing = true;
      }
    }
    for (const { sh, links, full } of kept) {
      sh.into[sh.key] = [...sh.list.slice(0, full), ...links.slice(full).filter((link) => link !== undefined)];
      const omitted = sh.list.length - full;
      if (omitted > 0) shortened[sh.path] = { total: sh.list.length, omitted };
    }
    return assemble();
  };
  let room = SITE_APP_MAX_RESPONSE_CHARS - 500;
  for (let attempt = 0; attempt < 3; attempt++) {
    const report = fill(room);
    const over = sizeOf(report) - SITE_APP_MAX_RESPONSE_CHARS;
    if (over <= 0) return report;
    room -= over + 500;
  }

  // EINDCONTROLE mislukt: alleen het geraamte. De koppelingen blijven (`linksTooLarge` houdt ze vóór uitvoering
  // binnen het budget), net als de status per stap.
  const bare = (tool: string, d: unknown): Record<string, unknown> => {
    const links = SITE_APP_ID_LINK_TOOLS[tool];
    if (!links || !isRecord(d)) return {};
    const value = d[links.field];
    if (Array.isArray(value)) return { [links.field]: value.map((e) => links.linkOf?.(e)).filter((e) => e !== undefined) };
    return value === undefined ? {} : { [links.field]: value };
  };
  const steps = Array.isArray(data.steps)
    ? (data.steps as BatchStep[]).map((step) => ({ step: step.step, tool: step.tool, status: step.status, ...bare(step.tool, step.data) }))
    : undefined;
  return {
    ok: true,
    envelope: { activeDocumentId: result.envelope.activeDocumentId, documentTitle: clip(result.envelope.documentTitle, 200), scheduleStale: result.envelope.scheduleStale, paused: result.envelope.paused, readOnly: result.envelope.readOnly } as McpToolOk['envelope'],
    data: {
      compacted: { originalChars: chars, limit: SITE_APP_MAX_RESPONSE_CHARS, note: 'Every change in this answer succeeded; the answer was too large even shortened, so only the status per step and the label → id links remain. Read the result with the read tools.' },
      ...(steps ? { steps } : bare(name, result.data)),
    },
  };
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
