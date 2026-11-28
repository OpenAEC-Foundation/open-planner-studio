import { startHttpTransport, HTTP_INTERNAL_BODY, HTTP_MAX_BODY_BYTES, HTTP_RESPONSE_TIMEOUT_SECS, HTTP_TIMEOUT_BODY } from '../../headless/mcp-server/src/http';
import type { McpContext } from '@/services/mcp/contracts';
import type { McpSessionTable } from '@/services/mcp/requestHandler';

export const MIRROR_RESPONSE_TIMEOUT_SECS = HTTP_RESPONSE_TIMEOUT_SECS;
export const MIRROR_MAX_BODY_BYTES = HTTP_MAX_BODY_BYTES;
export const MIRROR_TIMEOUT_BODY = HTTP_TIMEOUT_BODY;
export const MIRROR_INTERNAL_BODY = HTTP_INTERNAL_BODY;

export interface BridgeMirrorOptions {
  token: string;
  buildContext: () => McpContext;
  handleMessage: (body: string, ctx: McpContext) => Promise<string>;
  port?: number;
  sessions?: McpSessionTable;
}

export interface BridgeMirror {
  url: string;
  port: number;
  close: () => Promise<void>;
  restart: () => void;
}

export async function startBridgeMirror(opts: BridgeMirrorOptions): Promise<BridgeMirror> {
  return startHttpTransport({ ...opts, host: '127.0.0.1', port: opts.port ?? 0 });
}
