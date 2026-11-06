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
// ANTWOORDGROOTTE. Het contract vraagt antwoorden van hoogstens zo'n 30.000 tekens. Een leestool met paginering
// (`limit` en `offset` in zijn schema) die meer geeft, wordt geweigerd met `te_groot: …`, met de parameters waarmee
// de assistent kleiner kan vragen. Tools zonder paginering en muterende tools krijgen geen grens: weigeren na een
// wijziging zou de assistent laten denken dat de wijziging mislukte.
import type { McpContext, McpToolDef, McpToolResult } from './contracts';
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
export interface SiteAppToolsDeps {
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

/** Heeft deze tool paginering (`limit` en `offset`)? Dan kan de assistent kleiner vragen. */
function pagedFilters(def: McpToolDef | undefined): string[] | null {
  const properties = (def?.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
  const keys = Object.keys(properties);
  return keys.includes('limit') && keys.includes('offset') ? keys : null;
}

/** De fout voor een te groot antwoord, met de parameters waarmee het kleiner kan. */
function tooLarge(name: string, chars: number, filters: string[]): SiteAppToolError {
  const other = filters.filter((key) => key !== 'limit' && key !== 'offset');
  const narrow = other.length > 0 ? `, or narrow it with ${other.map((key) => `\`${key}\``).join(', ')}` : '';
  return new SiteAppToolError(
    'te_groot',
    `${name} answered with ${chars} characters (limit ${SITE_APP_MAX_RESPONSE_CHARS}). Ask for a smaller page with \`limit\` and \`offset\`${narrow}.`,
  );
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

export function createSiteAppTools(loadDeps: () => Promise<SiteAppToolsDeps>): SiteAppTools {
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
      const def = (await loadDeps()).getTools().find((d) => d.name === name);
      const filters = def?.annotations.readOnlyHint ? pagedFilters(def) : null;
      if (filters !== null) {
        const chars = JSON.stringify(result).length;
        if (chars > SITE_APP_MAX_RESPONSE_CHARS) throw tooLarge(name, chars, filters);
      }
      return result;
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
