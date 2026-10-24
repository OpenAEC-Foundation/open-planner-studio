// stdio-transport van de headless MCP-server (MCP-spec: één JSON-RPC-bericht per regel op stdin,
// antwoorden per regel op stdout, logging alleen op stderr).
//
// Eén proces = één client = één sessie. Daarom geen `Mcp-Session-Id`: het drift-anker leeft hier per
// proces, en een geslaagde `initialize` begint (net als een nieuwe sessie in de bridge) zonder anker.
// Requests lopen strikt na elkaar, zoals in de bridge (`createRequestHandler`).
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { McpContext } from '@/services/mcp/contracts';

export interface StdioOptions {
  input: Readable;
  output: Writable;
  buildContext: () => McpContext;
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
}

function method(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { method?: unknown };
    return parsed && typeof parsed === 'object' && typeof parsed.method === 'string' ? parsed.method : null;
  } catch {
    return null;
  }
}

function isResult(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return !!parsed && typeof parsed === 'object' && 'result' in parsed && !('error' in parsed);
  } catch {
    return false;
  }
}

/** Een JSON-RPC-fout voor een verwerking die zelf wierp (vangnet buiten de crash-barrière van de dispatcher). */
function internalError(raw: string, error: unknown): string {
  let id: unknown = null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    if (parsed && typeof parsed === 'object' && !('id' in parsed)) return '';
    id = parsed?.id ?? null;
  } catch { /* onparseerbaar ⇒ id null */ }
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: `Internal error: ${message}` } });
}

/** Draai de stdio-lus. De belofte lost op als stdin sluit en het laatste antwoord geschreven is. */
export function runStdio(opts: StdioOptions): Promise<void> {
  let anchor: string | null = null;
  let tail: Promise<void> = Promise.resolve();
  const write = (text: string) => new Promise<void>((resolve, reject) => {
    opts.output.write(`${text}\n`, (err) => (err ? reject(err) : resolve()));
  });

  const handleLine = async (line: string): Promise<void> => {
    const body = line.trim();
    if (body === '') return;
    const isInitialize = method(body) === 'initialize';
    const ctx = opts.buildContext();
    ctx.expectedDocId = isInitialize ? null : anchor;
    let response: string;
    try {
      response = await opts.handleMessage(body, ctx);
    } catch (error) {
      response = internalError(body, error);
    }
    // Een geslaagde initialize begint een nieuwe sessie: zonder anker. Anders draagt het anker over.
    anchor = isInitialize && isResult(response) ? null : ctx.expectedDocId;
    if (response !== '') await write(response);
  };

  return new Promise<void>((resolve) => {
    const rl = createInterface({ input: opts.input, crlfDelay: Infinity });
    rl.on('line', (line) => {
      tail = tail.then(() => handleLine(line)).catch((error) => {
        process.stderr.write(`[ops-mcp] could not answer a request: ${String(error)}\n`);
      });
    });
    rl.on('close', () => { void tail.then(() => resolve()); });
  });
}
