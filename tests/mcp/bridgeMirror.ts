// Dunne Node-HTTP-host die het HTTP-contract van de Rust-bridge SPIEGELT, rond de ECHTE TS-kant.
//
// Waarom: de Rust-bridge (`src-tauri/src/mcp_bridge.rs`) kan alleen in een Tauri-build draaien. Om de
// productcode toch met een officiële MCP-client (`@modelcontextprotocol/sdk`) over echt HTTP te testen,
// zet deze host dezelfde HTTP-poorten na en geeft hij elke body door aan de ECHTE
// `createRequestHandler` (`src/services/mcp/server.ts`) — precies wat de webview met het
// `mcp://request`-event doet. Alles ná de HTTP-laag (dispatcher, tools, store, undo) is dus productie-
// code; alleen de HTTP-schil hieronder is een kopie.
//
// NAGEBOUWD NAAR `src-tauri/src/mcp_bridge.rs` (stand 2026-10-22). Dit is een kopie, geen bewijs voor
// het Rust-gedrag: dat toetst `.github/workflows/mcp-real-app.yml` met dezelfde controles tegen de echte
// bridge. Wijzigt de Rust-HTTP-laag, pas deze host dan met de hand mee aan.
//   - alleen 127.0.0.1; volgorde: Origin (403) → methode (405 + `Allow: POST`) → pad `/mcp` (404) →
//     Bearer-token (401, scheme hoofdletterongevoelig) → doorgeven
//   - body > 50 MiB ⇒ 413; onleesbare body ⇒ 400; geen antwoord binnen 120 s ⇒ 504
//   - strikt één request tegelijk; niet-lege antwoordbody ⇒ `200 application/json`, lege ⇒ `202`
//     zonder body of Content-Type (notificatie)
//   - elk antwoord met `Connection: close` (tiny_http sluit oude keep-alive-verbindingen niet bij een stop)
//   - `Mcp-Session-Id` van het request gaat mee als `sessionId`; een `sessionId` in het antwoord wordt de
//     header `Mcp-Session-Id`; `status: 400` ⇒ 400 met de JSON-body (header ontbreekt); `status: 404` ⇒
//     404 zonder body (onbekende sessie); elke andere status ⇒ 200 of 202 op basis van de antwoordbody
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createRequestHandler, createMcpSessionTable, type McpResponseEvent, type McpSessionTable } from '@/services/mcp/server';
import type { McpContext } from '@/services/mcp/contracts';

export const MIRROR_RESPONSE_TIMEOUT_SECS = 120;
export const MIRROR_MAX_BODY_BYTES = 50 * 1024 * 1024;
export const MIRROR_TIMEOUT_BODY = '{"jsonrpc":"2.0","error":{"code":-32001,"message":"timeout"},"id":null}';
export const MIRROR_INTERNAL_BODY = '{"jsonrpc":"2.0","error":{"code":-32603,"message":"internal error"},"id":null}';

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

function isAuthorized(header: string | undefined, token: string): boolean {
  if (header === undefined) return false;
  const space = header.indexOf(' ');
  if (space < 0) return false;
  const scheme = header.slice(0, space);
  const value = Buffer.from(header.slice(space + 1));
  const expected = Buffer.from(token);
  // Rust vouwt een lengteverschil mee in de vergelijking; hier eerst de lengte, dan timingSafeEqual.
  return scheme.toLowerCase() === 'bearer' && value.length === expected.length && timingSafeEqual(value, expected);
}

function respondEmpty(res: http.ServerResponse, status: number, headers: Record<string, string> = {}): void {
  res.writeHead(status, { ...headers, Connection: 'close' });
  res.end();
}

function respondJson(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
  res.end(body);
}

export async function startBridgeMirror(opts: BridgeMirrorOptions): Promise<BridgeMirror> {
  // Het `mcp://response`-kanaal: Rust correleert op een oplopend id (rs :102-171).
  const pending = new Map<number, (reply: McpResponseEvent) => void>();
  let nextId = 1;
  const sessions = opts.sessions ?? createMcpSessionTable();
  const makeHandler = () => createRequestHandler({
    emit: (_event, payload) => {
      const reply = payload as McpResponseEvent;
      pending.get(reply.id)?.(reply);
      pending.delete(reply.id);
    },
    buildContext: opts.buildContext,
    handleMessage: opts.handleMessage,
    sessions,
  });
  let onRequest = makeHandler();

  // Het in-flight-slot (rs :319-320): één request tegelijk naar de "webview".
  let slot: Promise<void> = Promise.resolve();

  async function forward(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const header = req.headers['mcp-session-id'];
    const sessionId = typeof header === 'string' && header !== '' ? header : undefined;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MIRROR_MAX_BODY_BYTES) {
        respondEmpty(res, 413);
        req.destroy();
        return;
      }
      chunks.push(chunk as Buffer);
    }
    let body: string;
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    } catch {
      respondJson(res, 400, MIRROR_INTERNAL_BODY);
      return;
    }
    const run = slot.then(() => new Promise<void>((resolve) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        respondJson(res, 504, MIRROR_TIMEOUT_BODY);
        resolve();
      }, MIRROR_RESPONSE_TIMEOUT_SECS * 1000);
      pending.set(id, (reply) => {
        clearTimeout(timer);
        if (reply.status === 404) {
          respondEmpty(res, 404);
        } else if (reply.status === 400) {
          respondJson(res, 400, reply.body);
        } else if (reply.body === '') {
          respondEmpty(res, 202);
        } else {
          const headers: Record<string, string> = { 'Content-Type': 'application/json', Connection: 'close' };
          if (reply.sessionId && /^[\x21-\x7e]{1,128}$/.test(reply.sessionId)) headers['Mcp-Session-Id'] = reply.sessionId;
          res.writeHead(200, headers);
          res.end(reply.body);
        }
        resolve();
      });
      onRequest({ id, body, sessionId }).catch(() => {
        clearTimeout(timer);
        pending.delete(id);
        respondJson(res, 500, MIRROR_INTERNAL_BODY);
        resolve();
      });
    }));
    slot = run;
    await run;
  }

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin !== '') return respondEmpty(res, 403);
    if (req.method !== 'POST') return respondEmpty(res, 405, { Allow: 'POST' });
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/mcp') return respondEmpty(res, 404);
    if (!isAuthorized(req.headers.authorization, opts.token)) return respondEmpty(res, 401);
    void forward(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    port,
    restart: () => { onRequest = makeHandler(); },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
