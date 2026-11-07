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
    return 'Ask for one part at a time: `part: "guide"`, then `part: "goed-plannen"` or `part: "progress-update"` (one skill each).';
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

/** Vaste ruimte per batchstap in het rapport, naast de naam van de tool: `step`, `status`, de losse waarden van de
 *  stap (zoals `projectEnd`), de haakjes van `links` en een regel in `compacted.shortened`. Getoetst in
 *  tests/mcp/cases-site-app-tools.ts (`assertShellsFit`: het geraamte van elke stap in batches op het maximum van de
 *  voorcontrole). Een tool met een groter geraamte krijgt extra ruimte in `SITE_APP_STEP_EXTRA_CHARS`. */
export const SITE_APP_REPORT_STEP_CHARS = 220;

/** Extra vaste ruimte voor een batchstap van een tool met een groot geraamte: losse waarden die niet krimpen, plus de
 *  regels in `compacted.shortened` voor zijn verzamelingen. Gemeten in tests/mcp/cases-site-app-tools.ts
 *  (`assertShellsFit`): planner_level_resources heeft een geraamte van 264 tekens en tot zes verzamelingen. */
export const SITE_APP_STEP_EXTRA_CHARS: Readonly<Record<string, number>> = { planner_level_resources: 250 };

/** De vaste ruimte voor één batchstap van `tool` in de voorcontrole. */
export const siteAppStepReserve = (tool: string) => SITE_APP_REPORT_STEP_CHARS + tool.length + (SITE_APP_STEP_EXTRA_CHARS[tool] ?? 0);

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
  /** Bij een lijstveld: de koppeling uit één regel (`{requestedId, id}`), of niets als de regel er geen is. De
   *  koppelingen komen bij het inkorten uit de oorspronkelijke regels en staan apart in `links`. */
  linkOf?(entry: unknown): unknown;
  /** Vaste JSON-tekens per koppeling, naast het label en het id. */
  perLink: number;
}

/**
 * De tools die zo'n koppeling teruggeven, nagelopen in november 2026 (#825, ronde 3 tot 6). Geen automatische
 * vangst: een nieuwe aanmaaktool met een eigen label moet hier bij. Vergeet je er een, dan telt hij niet mee in de
 * controle vooraf, en krijgt hij bij het inkorten geen aparte `links`: zijn koppelingen kunnen dan regels verliezen.
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
    (name === 'planner_batch' ? calls.reduce((sum, c) => sum + siteAppStepReserve(c.tool), 0) : 0);
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

/** De koppelingen label → id uit de OORSPRONKELIJKE uitvoer van één tool, of niets. */
function linksFrom(tool: string, data: unknown): Record<string, unknown> | undefined {
  const links = SITE_APP_ID_LINK_TOOLS[tool];
  if (!links || !isRecord(data)) return undefined;
  const value = data[links.field];
  if (links.linkOf) {
    const pairs = Array.isArray(value) ? value.map((row) => links.linkOf!(row)).filter((pair) => pair !== undefined) : [];
    return pairs.length > 0 ? { [links.field]: pairs } : undefined;
  }
  return isRecord(value) ? { [links.field]: value } : undefined;
}

/** Is deze aanroep een leesvariant? `readOnlyHint`, `kind: 'read'`, of `dryRun: true` bij een tool die dat kent. */
function isReadCall(def: McpToolDef | undefined, args: unknown): boolean {
  if (!def) return false;
  if (def.annotations.readOnlyHint || def.kind === 'read') return true;
  const properties = (def.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  return 'dryRun' in properties && isRecord(args) && args.dryRun === true;
}

/** Een verzameling in het antwoord: een lijst, of een object met veel sleutels die id's zijn (een map per taak-id). */
interface Collection {
  path: string;
  holder: Record<string, unknown> | unknown[];
  key: string | number;
  value: unknown[] | Record<string, unknown>;
  size: number;
}

/** Een object is een map (en dus een verzameling) als het minstens 5 sleutels heeft en elke sleutel een cijfer bevat,
 *  zoals taak-id's (`task-…12`). Gewone veldnamen hebben geen cijfers; zo'n object wordt nooit ingekort. */
const isIdMap = (value: Record<string, unknown>) => {
  const keys = Object.keys(value);
  return keys.length >= 5 && keys.every((key) => /\d/.test(key));
};

/** Alle verzamelingen in `node`, op elke diepte. `steps` (de stapregels van een batch) en `links` doen niet mee. */
function collections(node: unknown, path: string, holder: Record<string, unknown> | unknown[] | null, key: string | number, out: Collection[]): void {
  if (Array.isArray(node)) {
    if (holder && path !== 'data.steps') out.push({ path, holder, key, value: node, size: sizeOf(node) });
    node.forEach((child, i) => collections(child, `${path}[${i}]`, node, i, out));
  } else if (isRecord(node)) {
    if (path.endsWith('.links') || path === 'data.compacted') return;
    if (holder && isIdMap(node)) out.push({ path, holder, key, value: node, size: sizeOf(node) });
    for (const [k, child] of Object.entries(node)) collections(child, path ? `${path}.${k}` : k, node, k, out);
  }
}

/**
 * Het compacte antwoord bij een te groot wijzigingsantwoord. Uit het antwoord van een wijzigende tool valt geen veld
 * weg; alleen verzamelingen worden korter.
 *   1. De koppelingen label → id komen uit de OORSPRONKELIJKE uitvoer en staan apart (`links`, direct in `data` of
 *      per batchstap). Ze doen niet mee met inkorten. `created` verhuist daarheen; kalenderregels blijven ook staan.
 *   2. Een leesvariant in een batch (`isReadCall`) verliest haar uitvoer (`readOutputOmitted: true`).
 *   3. Zolang het niet past: de GROOTSTE verzameling in het hele antwoord, op welke diepte ook, houdt haar eerste
 *      regels of sleutels. Een verzameling is een lijst of een map per id (`isIdMap`). `compacted.shortened` noemt per
 *      pad het totaal en het aantal weggelaten regels. Losse waarden blijven altijd; zo blijven kleine meldingen
 *      (`phaseTransitions`, `becameLiteral`, `clearedLagMinutes`) staan terwijl de bulk krimpt.
 *   4. Is er geen verzameling meer om in te korten en past het nog niet, dan worden lange losse teksten ingekort
 *      (ook in `shortened`). Er verdwijnt geen veld. De voorcontrole (`linksTooLarge`) houdt de koppelingen en de
 *      vaste ruimte per aanroep binnen het budget.
 */
function compactChange(
  name: string,
  args: unknown,
  result: McpToolOk,
  chars: number,
  getDef: (tool: string) => McpToolDef | undefined,
): McpToolOk {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const answer: { ok: true; envelope: Record<string, unknown>; data: Record<string, unknown>; itemRejections?: unknown[] } = {
    ok: true,
    envelope: clone(result.envelope) as unknown as Record<string, unknown>,
    data: isRecord(result.data) ? clone(result.data) : { value: clone(result.data) },
    ...(result.itemRejections ? { itemRejections: clone(result.itemRejections) } : {}),
  };
  let readSteps = 0;
  const moveLinks = (tool: string, original: unknown, into: Record<string, unknown>, data: Record<string, unknown> | undefined) => {
    const links = linksFrom(tool, original);
    if (!links) return;
    into.links = links;
    if (data && SITE_APP_ID_LINK_TOOLS[tool]?.field === 'created') delete data.created; // verhuisd, niet weg
  };
  if (name === 'planner_batch' && Array.isArray(answer.data.steps)) {
    const callArgs = listIn(args, 'steps');
    const originals = (isRecord(result.data) && Array.isArray(result.data.steps) ? result.data.steps : []) as BatchStep[];
    answer.data.steps = (answer.data.steps as BatchStep[]).map((step, i) => {
      const out: Record<string, unknown> = { ...step };
      const stepArgs = isRecord(callArgs[i]) ? (callArgs[i] as { args?: unknown }).args : undefined;
      if (step.data !== undefined && isReadCall(getDef(step.tool), stepArgs)) {
        delete out.data;
        out.readOutputOmitted = true;
        readSteps += 1;
        return out;
      }
      moveLinks(step.tool, originals[i]?.data, out, isRecord(out.data) ? out.data : undefined);
      return out;
    });
  } else {
    const links = linksFrom(name, result.data);
    if (links) {
      if (SITE_APP_ID_LINK_TOOLS[name]?.field === 'created') delete answer.data.created;
      answer.data.links = links;
    }
  }
  const shortened: Record<string, { total: number; omitted: number }> = {};
  const compacted = {
    originalChars: chars,
    limit: SITE_APP_MAX_RESPONSE_CHARS,
    note:
      'Every change in this answer succeeded. The full answer was too large, so it was shortened. No field an editing ' +
      'step returned was left out; the label → id links are in `links`' +
      (readSteps > 0 ? '. The output of read steps was left out (`readOutputOmitted`): call such a step on its own, outside planner_batch, to read it' : '') +
      '. Long lists and maps keep their first entries; `shortened` gives per path the total and how many were left ' +
      'out. Read tasks again with planner_list_tasks (`limit`, `offset`) or planner_get_task.',
    shortened,
  };
  const whole = () => ({ ...answer, data: { compacted, ...answer.data } }) as unknown as McpToolOk;
  const over = () => sizeOf(whole()) - SITE_APP_MAX_RESPONSE_CHARS;
  /** Voor de regel in `shortened`: ruim genoeg voor pad en getallen. */
  const lineFor = (path: string) => (path in shortened ? 0 : path.length + 40);

  // 3. De grootste verzameling eerst, steeds opnieuw, tot het past.
  let excess = over();
  while (excess > 0) {
    const found: Collection[] = [];
    collections(answer, '', null, '', found);
    const candidates = found.filter((c) => (Array.isArray(c.value) ? c.value.length : Object.keys(c.value).length) > 0);
    if (candidates.length === 0) break;
    const largest = candidates.reduce((a, b) => (b.size > a.size ? b : a));
    const entries: [string | number, unknown][] = Array.isArray(largest.value)
      ? largest.value.map((v, i) => [i, v])
      : Object.entries(largest.value);
    const need = excess + lineFor(largest.path);
    let removed = 0;
    let keep = entries.length;
    while (keep > 0 && removed < need) {
      keep -= 1;
      const [k, v] = entries[keep];
      removed += sizeOf(v) + 1 + (typeof k === 'string' ? JSON.stringify(k).length + 1 : 0);
    }
    const before = shortened[largest.path];
    const total = before ? before.total : entries.length;
    shortened[largest.path] = { total, omitted: total - keep };
    const kept = Array.isArray(largest.value)
      ? largest.value.slice(0, keep)
      : Object.fromEntries(entries.slice(0, keep) as [string, unknown][]);
    (largest.holder as Record<string | number, unknown>)[largest.key] = kept;
    excess = over();
  }

  // 4. Alleen nog losse waarden en koppelingen: lange teksten inkorten (de langste eerst), zonder iets te verwijderen.
  if (excess > 0) {
    const texts: { holder: Record<string, unknown> | unknown[]; key: string | number; path: string; value: string }[] = [];
    const walk = (node: unknown, path: string) => {
      if (path.endsWith('.links') || path === 'data.compacted') return;
      const children: [string | number, unknown][] = Array.isArray(node) ? node.map((v, i) => [i, v]) : isRecord(node) ? Object.entries(node) : [];
      for (const [k, v] of children) {
        const childPath = typeof k === 'number' ? `${path}[${k}]` : path ? `${path}.${k}` : k;
        if (typeof v === 'string' && v.length > 200) texts.push({ holder: node as Record<string, unknown>, key: k, path: childPath, value: v });
        else walk(v, childPath);
      }
    };
    walk(answer, '');
    texts.sort((a, b) => b.value.length - a.value.length);
    for (const text of texts) {
      if (excess <= 0) break;
      const cut = Math.min(text.value.length - 200, excess + lineFor(text.path));
      (text.holder as Record<string | number, unknown>)[text.key] = `${text.value.slice(0, text.value.length - cut)}…`;
      shortened[text.path] = { total: text.value.length, omitted: cut };
      excess = over();
    }
  }
  // Eén eindmeting: `run` geeft dit antwoord terug. Past het nog niet, dan bestaat het alleen uit losse waarden en
  // koppelingen; de voorcontrole voorkomt dat bij invoer onder haar maximum (getoetst).
  return whole();
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
      return compactChange(name, args, result, chars, getDef);
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
