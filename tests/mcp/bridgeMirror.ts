// Dunne Node-HTTP-host die het HTTP-contract van de Rust-bridge SPIEGELT, rond de ECHTE TS-kant.
//
// Waarom: de Rust-bridge (`src-tauri/src/mcp_bridge.rs`) kan alleen in een Tauri-build draaien. Om de
// productcode toch met een officiële MCP-client (`@modelcontextprotocol/sdk`) over echt HTTP te testen,
// zet deze host dezelfde HTTP-poorten na en geeft hij elke body door aan de ECHTE
// `createRequestHandler` (`src/services/mcp/requestHandler.ts`) — precies wat de webview met het
// `mcp://request`-event doet. Alles ná de HTTP-laag (dispatcher, tools, store, undo) is dus productie-
// code.
//
// Sinds issue #570 is de spiegel de HTTP-transport van de headless MCP-server
// (`headless/mcp-server/src/http.ts`): die is naar `mcp_bridge.rs` nagebouwd en moet zich naar buiten
// hetzelfde gedragen. Zo toetsen `cases-externe-client.ts` en `cases-headless-server.ts` één kopie van het
// Rust-contract in plaats van twee. Dit bewijst niets over het Rust-gedrag zelf: dat toetst
// `.github/workflows/mcp-real-app.yml` met dezelfde controles tegen de echte bridge. Wijzigt de
// Rust-HTTP-laag, pas dan `headless/mcp-server/src/http.ts` met de hand mee aan.
import { startHttpTransport, HTTP_INTERNAL_BODY, HTTP_MAX_BODY_BYTES, HTTP_RESPONSE_TIMEOUT_SECS, HTTP_TIMEOUT_BODY } from '../../headless/mcp-server/src/http';
import type { McpContext } from '@/services/mcp/contracts';
import type { McpSessionTable } from '@/services/mcp/requestHandler';

export const MIRROR_RESPONSE_TIMEOUT_SECS = HTTP_RESPONSE_TIMEOUT_SECS;
export const MIRROR_MAX_BODY_BYTES = HTTP_MAX_BODY_BYTES;
export const MIRROR_TIMEOUT_BODY = HTTP_TIMEOUT_BODY;
export const MIRROR_INTERNAL_BODY = HTTP_INTERNAL_BODY;

export interface BridgeMirrorOptions {
  token: string;
  /** Bouwt per request de context (echt: `buildMcpContext`). */
  buildContext: () => McpContext;
  /** Verwerkt de rauwe JSON-RPC-body (echt: `handleMcpMessage`). */
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  /** Vaste poort (testhulp, geen Rust-contract): zo kan een test een app-herstart op dezelfde poort nadoen.
   *  Ontbreekt hij, dan kiest het systeem een vrije poort. */
  port?: number;
  /** Bestaande sessietabel (testhulp): een nieuwe spiegel met dezelfde tabel doet Stop/Start van de bridge na,
   *  waarbij de app (`appMcpSessions`) sessies en ankers behoudt. Ontbreekt hij, dan een nieuwe tabel (= app-herstart). */
  sessions?: McpSessionTable;
}

export interface BridgeMirror {
  url: string;
  port: number;
  close: () => Promise<void>;
  /** Bootst een bridge-herstart na zoals `createBridgeController.restart()`: een nieuwe request-handler
   *  met dezelfde sessietabel (in de app `appMcpSessions`). */
  restart: () => void;
}

export async function startBridgeMirror(opts: BridgeMirrorOptions): Promise<BridgeMirror> {
  return startHttpTransport({ ...opts, host: '127.0.0.1', port: opts.port ?? 0 });
}
