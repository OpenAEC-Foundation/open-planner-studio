// De `planner_*`-tools voor de assistent van de site (platformbouw, `window.__OPDS_APP__`).
//
// Op de site heeft de tool geen bridge: er is geen Rust-shell en geen poort. De assistent van de site stuurt zijn
// toolcalls via de brug van de site naar dit koppelvlak in het frame. Daarachter draait dezelfde code als achter de
// bridge: `handleMcpMessage` (schemapoort, crash-barrière), de toolregistry en de guards in `tools/runtime.ts`. Er
// is dus geen tweede implementatie en geen tweede lijst met tools; alleen het transport verschilt.
//
// ALLEEN OP HET VENSTER VAN DE TOOL. Het object staat in het frame van de tool; wie erbij wil, moet al in dat frame
// draaien. Wat er van buiten binnenkomt, regelt de brug van de site (alleen van de ouder met de juiste oorsprong).
//
// LUI LADEN. `installSiteAppTools` staat er meteen, zodat de brug niet hoeft te wachten; de MCP-laag (de hele toolset
// met XER-lezer en al) komt pas als aparte chunk binnen bij de eerste toolcall. Wie de assistent niet gebruikt, betaalt
// er niets voor.
//
// BESTANDSTOOLS. `planner_export_ifc` en `planner_import_schedule` werken op een bestandssysteem, en dat is er in de
// browser niet: openen en opslaan lopen via het hostcontract (`siteHost.ts`), door de gebruiker. Ze staan daarom niet
// in `definitions()` en `run` weigert ze.
import type { McpToolDef, McpToolResult } from './contracts';

export const SITE_APP_UNAVAILABLE_TOOLS: ReadonlySet<string> = new Set(['planner_export_ifc', 'planner_import_schedule']);

/** Een tooldefinitie zoals de site hem leest: dezelfde velden als een regel uit `tools/list`. */
export interface SiteAppToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface SiteAppTools {
  /** De namen van de tools die hier werken. */
  tools(): Promise<string[]>;
  /** Hun definities, zoals in `tools/list`. */
  definitions(): Promise<SiteAppToolDefinition[]>;
  /** Eén tool uitvoeren. Geeft het `structuredContent` van het antwoord; een weigering van de tool wordt een fout. */
  run(name: string, args?: Record<string, unknown>): Promise<unknown>;
}

/** De bouwstenen die `run` nodig heeft; injecteerbaar zodat de tests dezelfde code zonder app-singleton draaien. */
export interface SiteAppToolsDeps {
  getTools(): McpToolDef[];
  /** Eén rauwe JSON-RPC-body naar de dispatcher, met een verse context. */
  dispatch(rawBody: string): Promise<string>;
}

/** De fouttekst van een tool-weigering: de code van het contract plus de melding, zodat de AI erop kan handelen. */
function toolFailure(result: McpToolResult): Error {
  return new Error(result.ok ? 'unexpected result' : `${result.code}: ${result.error}`);
}

export function createSiteAppTools(loadDeps: () => Promise<SiteAppToolsDeps>): SiteAppTools {
  let requestId = 0;
  const available = async () =>
    (await loadDeps()).getTools().filter((def) => !SITE_APP_UNAVAILABLE_TOOLS.has(def.name));
  return {
    async tools() {
      return (await available()).map((def) => def.name);
    },
    async definitions() {
      return (await available()).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
    },
    async run(name, args = {}) {
      if (SITE_APP_UNAVAILABLE_TOOLS.has(name)) {
        throw new Error(`UNAVAILABLE: ${name} needs a file system; open and save through the site`);
      }
      const { dispatch } = await loadDeps();
      requestId += 1;
      const raw = await dispatch(
        JSON.stringify({ jsonrpc: '2.0', id: requestId, method: 'tools/call', params: { name, arguments: args } }),
      );
      const response = JSON.parse(raw) as {
        result?: { structuredContent?: McpToolResult };
        error?: { message?: string };
      };
      if (response.error) throw new Error(response.error.message ?? 'MCP error');
      const result = response.result?.structuredContent;
      if (!result) throw new Error('MCP response without a result');
      if (!result.ok) throw toolFailure(result);
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
      return { getTools, dispatch: (rawBody) => handleMcpMessage(rawBody, buildMcpContext()) };
    })();
    return deps;
  };
  target.__OPDS_APP__ = createSiteAppTools(loadDeps);
}
