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
// `run`. Een leestool (`readOnlyHint`) die meer geeft, wordt geweigerd met `te_groot: …` en een uitweg die werkt:
// `limit`/`offset` (ook op het kritieke pad, de baselinevergelijking en de vertraginganalyse), één `part` van de gids,
// of `planner_list_tasks` in plaats van het overzicht. Een wijzigende tool of `planner_batch` krijgt nooit achteraf
// een fout (de wijziging is al gedaan); dat antwoord wordt ingekort, met `compacted` en per batchstap hoe de
// assistent de weggelaten uitvoer volledig opvraagt (`compactChange`).
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

/** Zoveel deelweigeringen blijven staan in een ingekort antwoord. */
const KEPT_REJECTIONS = 20;

/** Een lijst deelweigeringen ingekort, met het aantal dat wegviel. */
function trimRejections(list: unknown): { kept: unknown; omitted: number } {
  if (!Array.isArray(list) || list.length <= KEPT_REJECTIONS) return { kept: list, omitted: 0 };
  return { kept: list.slice(0, KEPT_REJECTIONS), omitted: list.length - KEPT_REJECTIONS };
}

/** Velden van `data` die groter zijn dan `max` tekens vallen weg; hun namen blijven staan. */
function dropLargeFields(data: unknown, max: number): { data: unknown; omitted: string[] } {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return sizeOf(data) > max ? { data: undefined, omitted: ['data'] } : { data, omitted: [] };
  }
  const kept: Record<string, unknown> = {};
  const omitted: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (sizeOf(value) > max) omitted.push(key);
    else kept[key] = value;
  }
  return { data: kept, omitted };
}

interface BatchStep { step: number; tool: string; status: string; data?: unknown; error?: string; dataOmitted?: string }

/**
 * Een te groot antwoord van een WIJZIGENDE tool of `planner_batch` inkorten, zonder fout: de wijziging is al
 * uitgevoerd, en een fout achteraf zou de assistent laten denken dat ze mislukte (en haar herhalen). In stappen,
 * tot het antwoord past:
 *   1. batch: `substeps` weg (die vorm is voor het activiteitenpaneel; de app heeft hem al gelogd);
 *   2. batch: de uitvoer van leesstappen weg, met per stap hoe de assistent hem volledig opvraagt;
 *   3. grote velden weg (batch: per stap; anders in `data`), met hun namen;
 *   4. batch: alle stapuitvoer weg, alleen de status per stap blijft;
 *   5. deelweigeringen ingekort tot de eerste 20, met het aantal dat wegviel.
 * `compacted` zegt bovenaan wat er gebeurde.
 */
function compactChange(name: string, result: McpToolOk, chars: number, getDef: (tool: string) => McpToolDef | undefined): McpToolOk {
  const note = (done: string): McpToolOk['data'] => ({
    compacted: {
      originalChars: chars,
      limit: SITE_APP_MAX_RESPONSE_CHARS,
      note: `The change succeeded. The full answer was too large, so it was shortened: ${done}.`,
    },
  });
  const fits = (value: McpToolOk) => sizeOf(value) <= SITE_APP_MAX_RESPONSE_CHARS;
  let out: McpToolOk = { ...result };
  const done: string[] = [];
  const withNote = (): McpToolOk => ({ ...out, data: { ...(note(done.join('; ')) as object), ...(out.data as object) } });

  if (name === 'planner_batch' && out.data !== null && typeof out.data === 'object') {
    const data = { ...(out.data as Record<string, unknown>) };
    const steps = Array.isArray(data.steps) ? (data.steps as BatchStep[]).map((step) => ({ ...step })) : [];
    delete data.substeps;
    done.push('`substeps` left out');
    out = { ...out, data: { ...data, steps } };
    if (fits(withNote())) return withNote();

    for (const step of steps) {
      if (step.data !== undefined && getDef(step.tool)?.kind === 'read') {
        delete step.data;
        step.dataOmitted = `call ${step.tool} on its own (outside planner_batch) with the same arguments to read it in full`;
      }
    }
    done.push('the output of read steps left out (see `dataOmitted` per step)');
    if (fits(withNote())) return withNote();

    for (const step of steps) {
      if (step.data === undefined) continue;
      const trimmed = dropLargeFields(step.data, 2_000);
      if (trimmed.omitted.length > 0) {
        step.data = trimmed.data;
        step.dataOmitted = `fields left out: ${trimmed.omitted.join(', ')}; read the result with planner_list_tasks or planner_get_task`;
      }
    }
    done.push('large fields of the other steps left out');
    if (fits(withNote())) return withNote();

    for (const step of steps) {
      if (step.data === undefined) continue;
      delete step.data;
      step.dataOmitted = 'output left out; read the result with planner_list_tasks or planner_get_task';
    }
    done.push('all step output left out, only the status per step remains');
  } else {
    const trimmed = dropLargeFields(out.data, 2_000);
    out = { ...out, data: trimmed.data };
    done.push(`fields left out: ${trimmed.omitted.join(', ') || '(none)'}; read the result with planner_list_tasks or planner_get_task`);
  }
  if (fits(withNote())) return withNote();

  const top = trimRejections(out.itemRejections);
  const data = { ...(out.data as Record<string, unknown>) };
  const inner = trimRejections(data.rejections);
  if (inner.omitted > 0) { data.rejections = inner.kept; data.rejectionsOmitted = inner.omitted; }
  out = { ...out, data, ...(top.omitted > 0 ? { itemRejections: top.kept as McpToolOk['itemRejections'] } : {}) };
  done.push(`only the first ${KEPT_REJECTIONS} item rejections kept`);
  return withNote();
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
