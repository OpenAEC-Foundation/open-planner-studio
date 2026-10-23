// Streamable-HTTP-transport van de headless MCP-server: hetzelfde HTTP-contract als de bridge in de
// desktop-app (`src-tauri/src/mcp_bridge.rs`), rond dezelfde TS-requestlaag (`createRequestHandler`
// in `src/services/mcp/requestHandler.ts`: sessies, drift-anker per sessie, wachtrij-deadline).
//
// NAGEBOUWD NAAR `mcp_bridge.rs` (stand 2026-10-22). Wijzigt de Rust-HTTP-laag, pas deze module dan
// mee aan. `tests/mcp/bridgeMirror.ts` gebruikt deze module als spiegel van de bridge, zodat
// `tests/mcp/externalClient.ts` beide met dezelfde controles toetst; het Rust-gedrag zelf toetst
// `.github/workflows/mcp-real-app.yml`.
//   - alleen loopback; volgorde: Origin (403) → methode (405 + `Allow: POST`) → pad `/mcp` (404) →
//     Bearer-token (401, scheme hoofdletterongevoelig, vergelijking in constante tijd) → doorgeven
//   - body > 50 MiB ⇒ 413; onleesbare body (geen UTF-8) ⇒ 400; geen antwoord binnen 120 s ⇒ 504
//   - strikt één request tegelijk; niet-lege antwoordbody ⇒ `200 application/json`, lege ⇒ `202`
//     zonder body of Content-Type (notificatie)
//   - elk antwoord met `Connection: close`
//   - `Mcp-Session-Id` van het request gaat mee als `sessionId`; een `sessionId` in het antwoord wordt de
//     header `Mcp-Session-Id`; `status: 400` ⇒ 400 met de JSON-body (header ontbreekt); `status: 404` ⇒
//     404 zonder body (onbekende sessie)
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  createRequestHandler, createMcpSessionTable, type McpResponseEvent, type McpSessionTable,
} from '@/services/mcp/requestHandler';
import type { McpContext } from '@/services/mcp/contracts';

export const HTTP_RESPONSE_TIMEOUT_SECS = 120;
export const HTTP_MAX_BODY_BYTES = 50 * 1024 * 1024;
export const HTTP_TIMEOUT_BODY = '{"jsonrpc":"2.0","error":{"code":-32001,"message":"timeout"},"id":null}';
export const HTTP_INTERNAL_BODY = '{"jsonrpc":"2.0","error":{"code":-32603,"message":"internal error"},"id":null}';

export interface HttpTransportOptions {
  token: string;
  /** Loopback-adres (de aanroeper controleert dat). Default `127.0.0.1`. */
  host?: string;
  /** 0 = een vrije poort. */
  port: number;
  buildContext: () => McpContext;
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  /** Eén regel per request (methode, pad, status, duur); nooit body of token. */
  log?: (line: string) => void;
  /** Bestaande sessietabel (testhulp van `tests/mcp/bridgeMirror.ts`: Stop/Start van de bridge in de
   *  app behoudt sessies en ankers). Ontbreekt hij, dan een nieuwe tabel. */
  sessions?: McpSessionTable;
}

export interface HttpTransport {
  url: string;
  port: number;
  close: () => Promise<void>;
  /** Een nieuwe request-handler met dezelfde sessietabel, zoals een herstart van de bridge in de app. */
  restart: () => void;
}

/** Klopt de `Authorization`-header? Zelfde regels als `is_authorized` in `mcp_bridge.rs`. */
export function isAuthorized(header: string | undefined, token: string): boolean {
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

export async function startHttpTransport(opts: HttpTransportOptions): Promise<HttpTransport> {
  // Het `mcp://response`-kanaal van de app: correlatie op een oplopend id.
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

  // Het in-flight-slot van de bridge: één request tegelijk.
  let slot: Promise<void> = Promise.resolve();

  async function forward(req: http.IncomingMessage, res: http.ServerResponse): Promise<number> {
    const header = req.headers['mcp-session-id'];
    const sessionId = typeof header === 'string' && header !== '' ? header : undefined;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > HTTP_MAX_BODY_BYTES) {
        respondEmpty(res, 413);
        req.destroy();
        return 413;
      }
      chunks.push(chunk as Buffer);
    }
    let body: string;
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    } catch {
      respondJson(res, 400, HTTP_INTERNAL_BODY);
      return 400;
    }
    let status = 0;
    const run = slot.then(() => new Promise<void>((resolve) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        respondJson(res, 504, HTTP_TIMEOUT_BODY);
        status = 504;
        resolve();
      }, HTTP_RESPONSE_TIMEOUT_SECS * 1000);
      pending.set(id, (reply) => {
        clearTimeout(timer);
        if (reply.status === 404) {
          respondEmpty(res, (status = 404));
        } else if (reply.status === 400) {
          respondJson(res, (status = 400), reply.body);
        } else if (reply.body === '') {
          respondEmpty(res, (status = 202));
        } else {
          const headers: Record<string, string> = { 'Content-Type': 'application/json', Connection: 'close' };
          if (reply.sessionId && /^[\x21-\x7e]{1,128}$/.test(reply.sessionId)) headers['Mcp-Session-Id'] = reply.sessionId;
          res.writeHead((status = 200), headers);
          res.end(reply.body);
        }
        resolve();
      });
      onRequest({ id, body, sessionId }).catch(() => {
        clearTimeout(timer);
        pending.delete(id);
        respondJson(res, (status = 500), HTTP_INTERNAL_BODY);
        resolve();
      });
    }));
    slot = run;
    await run;
    return status;
  }

  const server = http.createServer((req, res) => {
    const started = Date.now();
    const done = (status: number) => opts.log?.(`${req.method ?? '?'} ${(req.url ?? '').split('?')[0]} ${status} ${Date.now() - started}ms`);
    const refuse = (status: number, headers?: Record<string, string>) => { respondEmpty(res, status, headers); done(status); };
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin !== '') return refuse(403);
    if (req.method !== 'POST') return refuse(405, { Allow: 'POST' });
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/mcp') return refuse(404);
    if (!isAuthorized(req.headers.authorization, opts.token)) return refuse(401);
    forward(req, res).then(done, () => {
      if (!res.headersSent) respondJson(res, 500, HTTP_INTERNAL_BODY);
      done(500);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.host ?? '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  const hostPart = address.family === 'IPv6' ? `[${address.address}]` : address.address;
  return {
    url: `http://${hostPart}:${address.port}/mcp`,
    port: address.port,
    restart: () => { onRequest = makeHandler(); },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
