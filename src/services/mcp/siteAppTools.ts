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
// uitvoering (`createdTooLarge`).
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
// Wat altijd blijft: de status per stap en de `created`-maps (`tempId` → echt id). Die koppeling is later niet meer
// terug te vragen: de tool bewaart `tempId` niet in de taak. Omdat ze moet blijven, weigert `run` VÓÓR uitvoering
// een aanroep waarvan de maps alleen al te groot kunnen worden (`createdTooLarge`), met de opdracht kleinere
// porties te sturen. Al het andere wordt een aantal of een samenvatting, en wat er nog past van de restwerk-
// correcties en de deelweigeringen komt erbij, ingekort per regel.

/** Zoveel tekens houdt het compacte rapport vrij voor alles behalve de `created`-maps (envelop, uitleg, een regel
 *  per stap voor 100 stappen). Getoetst in tests/mcp/cases-site-app-tools.ts (`compact rapport: vaste ruimte`). */
export const SITE_APP_REPORT_RESERVE_CHARS = 12_000;

/**
 * Bovengrens voor één echt id in JSON, met aanhalingstekens. `generateId` (`src/utils/id.ts`) maakt
 * `<voorvoegsel>-<tijd base36, 8><willekeurig, ≤4><teller>`: met `task`/`res` en een teller tot tien cijfers is dat
 * hoogstens 27 tekens. De test meet de echte id's van 300 nieuwe taken en houdt ze onder deze grens.
 */
export const SITE_APP_REAL_ID_JSON_CHARS = 29;

/** De `tempId`'s die deze aanroep zou aanmaken (direct of als stap van `planner_batch`). */
function newTempIds(name: string, args: Record<string, unknown>): string[] {
  const list = (value: unknown, key: string): unknown[] =>
    value !== null && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key])
      ? ((value as Record<string, unknown>)[key] as unknown[])
      : [];
  const tempIdOf = (item: unknown) =>
    item !== null && typeof item === 'object' && typeof (item as { tempId?: unknown }).tempId === 'string'
      ? [(item as { tempId: string }).tempId]
      : [];
  if (name === 'planner_add_tasks') return list(args, 'tasks').flatMap(tempIdOf);
  if (name === 'planner_manage_resources') {
    return list(args, 'actions').filter((a) => (a as { action?: unknown })?.action === 'create').flatMap(tempIdOf);
  }
  if (name === 'planner_batch') {
    return list(args, 'steps').flatMap((step) => {
      const s = step as { tool?: unknown; args?: unknown };
      return typeof s?.tool === 'string' && s.args !== null && typeof s.args === 'object'
        ? newTempIds(s.tool, s.args as Record<string, unknown>)
        : [];
    });
  }
  return [];
}

/** De grootste lengte die de `created`-maps van deze `tempId`'s in JSON kunnen krijgen. */
const createdMapBound = (tempIds: readonly string[]) =>
  tempIds.reduce((sum, id) => sum + JSON.stringify(id).length + 1 + SITE_APP_REAL_ID_JSON_CHARS + 1, 0);

/** Weigering vóór uitvoering als de `created`-maps het budget kunnen overschrijden; anders null. */
function createdTooLarge(name: string, args: Record<string, unknown>): SiteAppToolError | null {
  const tempIds = newTempIds(name, args);
  const budget = SITE_APP_MAX_RESPONSE_CHARS - SITE_APP_REPORT_RESERVE_CHARS;
  const bound = createdMapBound(tempIds);
  if (bound <= budget) return null;
  const perItem = bound / tempIds.length;
  const max = Math.floor(budget / perItem);
  return new SiteAppToolError(
    'te_groot',
    `${name} would create ${tempIds.length} items with a tempId; their tempId → id map alone could exceed the answer ` +
      `limit of ${SITE_APP_MAX_RESPONSE_CHARS} characters. Nothing was changed. Send at most ${max} new items with ` +
      'these tempIds per call (shorter tempIds allow more), in several calls.',
  );
}

const clip = (text: unknown, max: number): string => {
  const value = typeof text === 'string' ? text : JSON.stringify(text) ?? '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

/** De lengtes van de lijsten in `data` (wat er weg is, als aantal). */
function counts(data: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) out[key] = value.length;
      else if (key !== 'created' && value !== null && typeof value === 'object') out[key] = Object.keys(value).length;
    }
  }
  return out;
}

/** De `created`-map van een resultaat, als die er is. */
function createdOf(data: unknown): Record<string, string> | undefined {
  const created = data !== null && typeof data === 'object' ? (data as { created?: unknown }).created : undefined;
  return created !== null && typeof created === 'object' && !Array.isArray(created)
    ? (created as Record<string, string>)
    : undefined;
}

interface BatchStep { step: number; tool: string; status: string; data?: unknown; error?: string }

/**
 * Het compacte rapport van een te groot wijzigingsantwoord. Blijft: de status per stap, alle `created`-maps, de
 * envelop zonder lijsten, aantallen, en een samenvatting van de restwerkcorrecties. Daarna, zolang het past:
 * restwerkcorrecties en deelweigeringen, elk ingekort. Eén eindcontrole: past het dan nog niet, dan gaan die
 * aanvullingen en de lange teksten weg; de ids en de statussen blijven.
 */
function compactChange(name: string, result: McpToolOk, chars: number, getDef: (tool: string) => McpToolDef | undefined): McpToolOk {
  const { remainingWorkRecomputed: corrections = [], ...envelopeRest } = result.envelope;
  const envelope = {
    ...envelopeRest,
    documentTitle: clip(envelopeRest.documentTitle, 200),
    ...(envelopeRest.scheduleNote !== undefined ? { scheduleNote: clip(envelopeRest.scheduleNote, 500) } : {}),
    ...(envelopeRest.scheduleError !== undefined ? { scheduleError: clip(envelopeRest.scheduleError, 500) } : {}),
    ...(corrections.length > 0
      ? {
          remainingWorkRecomputedSummary: {
            count: corrections.length,
            tasks: new Set(corrections.map((c) => c.taskId)).size,
            beforeHours: Math.round(corrections.reduce((sum, c) => sum + c.beforeHours, 0) * 100) / 100,
            afterHours: Math.round(corrections.reduce((sum, c) => sum + c.afterHours, 0) * 100) / 100,
          },
        }
      : {}),
  } as McpToolOk['envelope'] & Record<string, unknown>;
  const rejections = result.itemRejections ?? [];
  const isBatch = name === 'planner_batch';
  const raw = result.data as Record<string, unknown> | null;
  const steps = isBatch && Array.isArray(raw?.steps)
    ? (raw.steps as BatchStep[]).map((step) => {
        const created = createdOf(step.data);
        return {
          step: step.step,
          tool: step.tool,
          status: step.status,
          ...(created ? { created } : {}),
          ...(step.error !== undefined ? { error: clip(step.error, 300) } : {}),
          ...(step.data !== undefined ? { omitted: getDef(step.tool)?.kind === 'read' ? 'read output' : 'details' } : {}),
        };
      })
    : undefined;
  const created = isBatch ? undefined : createdOf(raw);
  const how =
    'Every change in this answer succeeded. The full answer was too large, so it was shortened. Kept: ' +
    (isBatch ? 'the status per step and every `created` map; ' : 'the `created` map; ') +
    'lists are counted in `counts`. To read what was left out: call a read step on its own (outside planner_batch) ' +
    'with the same arguments; read changed tasks with planner_list_tasks (`limit`, `offset`) or planner_get_task. ' +
    (corrections.length > 0 ? 'Remaining-work corrections: see `remainingWorkRecomputedSummary`; the app also lists them. ' : '') +
    (rejections.length > 0 ? 'Item rejections: `itemRejections` shows the first ones that fit, shortened. ' : '');
  const build = (extraCorrections: unknown[], extraRejections: { id: string; reason: string }[], short: boolean): McpToolOk => ({
    ok: true,
    envelope: { ...envelope, ...(extraCorrections.length > 0 ? { remainingWorkRecomputed: extraCorrections } : {}) } as McpToolOk['envelope'],
    data: {
      compacted: {
        originalChars: chars,
        limit: SITE_APP_MAX_RESPONSE_CHARS,
        note: short ? 'Every change in this answer succeeded; the answer was shortened to the ids and the status per step.' : how,
        counts: { ...counts(raw), itemRejections: rejections.length, remainingWorkRecomputed: corrections.length },
      },
      ...(created ? { created } : {}),
      ...(steps ? { steps: short ? steps.map((step) => ({ step: step.step, tool: step.tool, status: step.status, ...(step.created ? { created: step.created } : {}) })) : steps } : {}),
    },
    ...(extraRejections.length > 0 ? { itemRejections: extraRejections } : {}),
  });
  // Aanvullen zolang het past (ruim onder de grens, zodat de eindcontrole niet krap uitvalt).
  const room = SITE_APP_MAX_RESPONSE_CHARS - 500;
  const keptCorrections: unknown[] = [];
  const keptRejections: { id: string; reason: string }[] = [];
  let size = sizeOf(build([], [], false));
  for (const c of corrections) {
    const entry = { ...c, taskName: clip(c.taskName, 80) };
    const add = sizeOf(entry) + 1;
    if (size + add > room) break;
    keptCorrections.push(entry);
    size += add;
  }
  for (const r of rejections) {
    const entry = { id: clip(r.id, 80), reason: clip(r.reason, 200) };
    const add = sizeOf(entry) + 1;
    if (size + add > room) break;
    keptRejections.push(entry);
    size += add;
  }
  const report = build(keptCorrections, keptRejections, false);
  // EINDCONTROLE op het hele antwoord. Past het niet (alleen bij heel veel stappen met lange fouten), dan zonder
  // aanvullingen en foutteksten. De ids blijven altijd: `createdTooLarge` houdt ze vóór uitvoering binnen het budget.
  return sizeOf(report) <= SITE_APP_MAX_RESPONSE_CHARS ? report : build([], [], true);
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
      const tooMany = createdTooLarge(name, args);
      if (tooMany !== null) throw tooMany;
      const raw = await (await session())((id) =>
        JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
      );
      const response = JSON.parse(raw) as {
        result?: { structuredContent?: McpToolResult };
        error?: { code?: number; message?: string };
      };
      if (response.error) {
        throw new SiteAppToolError(`JSONRPC_${response.error.code ?? 'ERROR'}`, response.error.message ?? 'MCP error');
      }
      const result = response.result?.structuredContent;
      if (!result) throw new SiteAppToolError('JSONRPC_ERROR', 'MCP response without a result');
      if (!result.ok) throw new SiteAppToolError(result.code, result.error);
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
