import type { McpContext, McpToolResult } from './contracts';
import { getTools, getTool } from './toolRegistry';
import { ATOMIC_ITEM_TOOLS, validateToolArgs } from './schemaValidate';
import { toolListEntry } from './toolListing';

export const MCP_SERVER_NAME = 'open-planner-studio';
export const MCP_SERVER_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export const MCP_INSTRUCTIONS = [
  'You edit a real construction schedule people rely on.',
  '- Start with milestones and delivery. Tasks: about a day to two weeks.',
  '- Use relationships (Finish-to-start default): each task needs a predecessor and successor except the first task and final milestone. Constraints only for user-given hard external dates; never negative lag.',
  '- Changes/reads recalculate; check the result with planner_get_project_info and planner_get_critical_path. With `datesAsRecorded: true` in the envelope, say the dates are as recorded. `scheduleError`: fix it first; a change that leaves it is rolled back.',
  '- Progress needs the user\'s status date: never invent it; pass their actual dates.',
  '- Report what you assumed (durations, relationships, capacities, calendars, constraints and why) and omitted.',
  'Before building or restructuring, read `planner_get_planning_guide`.',
].join('\n');

const KNOWN_PROTOCOL_VERSIONS = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

type JsonRpcId = string | number | null;

function resultMsg(id: JsonRpcId, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function errorMsg(id: JsonRpcId, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

function wrapToolResult(result: McpToolResult): object {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
    isError: !result.ok,
  };
}

export async function handleMcpMessage(rawBody: string, ctx: McpContext): Promise<string> {
  let msg: any;
  try {
    msg = JSON.parse(rawBody);
  } catch {
    return errorMsg(null, -32700, 'Parse error');
  }

  if (Array.isArray(msg)) {
    return errorMsg(null, -32600, 'Batch arrays of JSON-RPC messages are not supported');
  }
  if (msg === null || typeof msg !== 'object') {
    return errorMsg(null, -32600, 'Invalid JSON-RPC message');
  }

  const isNotification = !('id' in msg);
  const id: JsonRpcId = isNotification ? null : msg.id;
  const method: unknown = msg.method;

  if (typeof method !== 'string') {
    return isNotification ? '' : errorMsg(id, -32600, 'Invalid JSON-RPC message: missing method');
  }

  if (isNotification) {
    return '';
  }

  switch (method) {
    case 'initialize': {
      const clientVersion: unknown = msg.params?.protocolVersion;
      const protocolVersion =
        typeof clientVersion === 'string' && KNOWN_PROTOCOL_VERSIONS.has(clientVersion)
          ? clientVersion
          : DEFAULT_PROTOCOL_VERSION;
      return resultMsg(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        instructions: MCP_INSTRUCTIONS,
      });
    }

    case 'ping':
      return resultMsg(id, {});

    case 'tools/list':
      return resultMsg(id, { tools: getTools().map(def => toolListEntry(def.describe ? { ...def, description: def.describe(ctx) } : def)) });

    case 'tools/call': {
      const name: unknown = msg.params?.name;
      const def = typeof name === 'string' ? getTool(name) : undefined;
      if (!def) {
        return errorMsg(id, -32602, `Unknown tool: ${String(name)}`);
      }
      const schemaError = validateToolArgs(def.inputSchema, msg.params?.arguments, {
        deepArrayItems: ATOMIC_ITEM_TOOLS.has(def.name),
      });
      if (schemaError) {
        const err: McpToolResult = {
          ok: false,
          code: 'VALIDATION',
          error: `invalid arguments for ${def.name} — ${schemaError}`,
        };
        return resultMsg(id, wrapToolResult(err));
      }
      let result: McpToolResult;
      try {
        result = await def.handler(msg.params?.arguments, ctx);
      } catch (e) {
        if (import.meta.env.DEV) console.error(`[mcp] handler '${def.name}' gooide:`, e);
        return errorMsg(id, -32603, `Internal error while running tool ${def.name}`);
      }
      return resultMsg(id, wrapToolResult(result));
    }

    default:
      return errorMsg(id, -32601, `Unknown method: ${method}`);
  }
}
