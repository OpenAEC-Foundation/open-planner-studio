import { AGENT_GUIDE_URL } from './tools/guideTools';
import type { McpContext, McpToolDef, McpToolOk, McpToolResult } from './contracts';
import { createRequestHandler, type McpResponseEvent } from './requestHandler';
import { toolListEntry, type ListedTool } from './toolListing';

export const SITE_APP_UNAVAILABLE_TOOLS: ReadonlySet<string> = new Set(['planner_export_ifc', 'planner_import_schedule']);

export const SITE_APP_MAX_RESPONSE_CHARS = 30_000;

export type SiteAppToolDefinition = ListedTool;

export interface SiteAppTools {
  tools(): Promise<string[]>;
  definitions(): Promise<SiteAppToolDefinition[]>;
  run(name: string, args?: Record<string, unknown>): Promise<unknown>;
}

interface SiteAppToolsDeps {
  getTools(): McpToolDef[];
  buildContext(): McpContext;
  handleMessage(rawBody: string, ctx: McpContext): Promise<string>;
}

export class SiteAppToolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'SiteAppToolError';
    this.code = code;
  }
}

export function siteAppToolDefinitions(defs: readonly McpToolDef[]): SiteAppToolDefinition[] {
  return defs
    .filter((def) => !SITE_APP_UNAVAILABLE_TOOLS.has(def.name))
    .map(toolListEntry);
}

export function siteAppToolsJson(defs: readonly McpToolDef[]): string {
  return `${JSON.stringify(siteAppToolDefinitions(defs), null, 1)}\n`;
}

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

const sizeOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0;

function pagedFilters(def: McpToolDef | undefined): string[] | null {
  const properties = (def?.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
  const keys = Object.keys(properties);
  return keys.includes('limit') && keys.includes('offset') ? keys : null;
}

function narrowHint(name: string, def: McpToolDef | undefined): string {
  const filters = pagedFilters(def);
  if (filters !== null) {
    const other = filters.filter((key) => key !== 'limit' && key !== 'offset');
    const narrow = other.length > 0 ? `, or narrow it with ${other.map((key) => `\`${key}\``).join(', ')}` : '';
    return `Ask for a smaller page with \`limit\` and \`offset\`${narrow}.`;
  }
  if (name === 'planner_get_planning_guide') {
    return (
      'Ask for one part: `part: "guide"` (for building) or `part: "progress-update"` (progress). ' +
      `If the guide alone is too large, read it at ${AGENT_GUIDE_URL}.`
    );
  }
  if (name === 'planner_get_resource_histogram') {
    return 'Ask for less detail: one resource at a time in `resourceIds`, a shorter window with `van`/`tot`, or a coarser `bucket` ("maand").';
  }
  if (name === 'planner_get_project_overview') {
    return 'Read the tasks page by page with planner_list_tasks (`limit` and `offset`), and one task in full with planner_get_task.';
  }
  return 'Ask for a smaller part: the tasks page by page with planner_list_tasks (`limit` and `offset`), or one task with planner_get_task.';
}

function tooLarge(name: string, chars: number, def: McpToolDef | undefined): SiteAppToolError {
  return new SiteAppToolError(
    'te_groot',
    `${name} answered with ${chars} characters (limit ${SITE_APP_MAX_RESPONSE_CHARS}). ${narrowHint(name, def)}`,
  );
}

export const SITE_APP_REAL_ID_JSON_CHARS = 29;

export const SITE_APP_REPORT_BASE_CHARS = 4_000;

export const SITE_APP_REPORT_STEP_CHARS = 220;

export const SITE_APP_STEP_EXTRA_CHARS: Readonly<Record<string, number>> = { planner_level_resources: 250 };

export const siteAppStepReserve = (tool: string) => SITE_APP_REPORT_STEP_CHARS + tool.length + (SITE_APP_STEP_EXTRA_CHARS[tool] ?? 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const listIn = (value: unknown, key: string): unknown[] =>
  isRecord(value) && Array.isArray(value[key]) ? (value[key] as unknown[]) : [];
const stringIn = (item: unknown, key: string): string[] =>
  isRecord(item) && typeof item[key] === 'string' ? [item[key] as string] : [];

interface IdLinkTool {
  labels(args: unknown): string[];
  field: 'created' | 'calendars';
  linkOf?(entry: unknown): unknown;
  perLink: number;
}

export const SITE_APP_ID_LINK_TOOLS: Readonly<Record<string, IdLinkTool>> = {
  planner_add_tasks: {
    labels: (args) => listIn(args, 'tasks').flatMap((task) => stringIn(task, 'tempId')),
    field: 'created',
    perLink: 2,
  },
  planner_manage_resources: {
    labels: (args) =>
      listIn(args, 'actions').filter((a) => isRecord(a) && a.action === 'create').flatMap((a) => stringIn(a, 'tempId')),
    field: 'created',
    perLink: 2,
  },
  planner_update_calendar: {
    labels: (args) =>
      listIn(args, 'calendars').filter((c) => isRecord(c) && c.create === true).flatMap((c) => stringIn(c, 'id')),
    field: 'calendars',
    linkOf: (row) =>
      isRecord(row) && row.created === true && typeof row.requestedId === 'string'
        ? { requestedId: row.requestedId, id: row.id }
        : undefined,
    perLink: 23,
  },
};

function plannedCalls(name: string, args: unknown): { tool: string; args: unknown }[] {
  if (name !== 'planner_batch') return [{ tool: name, args }];
  return listIn(args, 'steps').flatMap((step) =>
    isRecord(step) && typeof step.tool === 'string' ? [{ tool: step.tool, args: step.args }] : [],
  );
}

function linksTooLarge(name: string, args: unknown): SiteAppToolError | null {
  const calls = plannedCalls(name, args);
  const reserve = SITE_APP_REPORT_BASE_CHARS +
    (name === 'planner_batch' ? calls.reduce((sum, c) => sum + siteAppStepReserve(c.tool), 0) : 0);
  let links = 0;
  let bound = 0;
  for (const call of calls) {
    const tool = SITE_APP_ID_LINK_TOOLS[call.tool];
    if (!tool) continue;
    for (const label of tool.labels(call.args)) {
      links += 1;
      bound += JSON.stringify(label).length + SITE_APP_REAL_ID_JSON_CHARS + tool.perLink;
    }
  }
  const budget = SITE_APP_MAX_RESPONSE_CHARS - reserve;
  if (links === 0 || bound <= budget) return null;
  const max = Math.max(0, Math.floor(budget / (bound / links)));
  return new SiteAppToolError(
    'te_groot',
    `${name} would create ${links} items with a label (tempId, or id with create: true); their label → id links ` +
      `alone could exceed the answer limit of ${SITE_APP_MAX_RESPONSE_CHARS} characters. Nothing was changed. Send ` +
      `at most ${max} new items with these labels per call (shorter labels allow more), in several calls.`,
  );
}


export const SITE_APP_MAX_ERROR_CHARS = SITE_APP_MAX_RESPONSE_CHARS - 1_000;

function summariseChains(text: string): string {
  return text.replace(/[^\s→;,()]+(?: → [^\s→;,()]+){11,}/g, (chain) => {
    const parts = chain.split(' → ');
    return `${parts.slice(0, 5).join(' → ')} → … ${parts.length - 8} more … → ${parts.slice(-3).join(' → ')} (${parts.length} items in total)`;
  });
}

function boundedFailure(code: string, error: string): SiteAppToolError {
  const max = SITE_APP_MAX_ERROR_CHARS - code.length - 2;
  if (error.length <= max) return new SiteAppToolError(code, error);
  let text = summariseChains(error);
  if (text.length > max) {
    const head = 2_000;
    const tail = max - head - 80;
    text = `${text.slice(0, head)} … (${text.length - head - tail} characters left out) … ${text.slice(-tail)}`;
  }
  return new SiteAppToolError(code, text);
}

interface BatchStep { step: number; tool: string; status: string; data?: unknown; error?: string }

function linksFrom(tool: string, data: unknown): Record<string, unknown> | undefined {
  const links = SITE_APP_ID_LINK_TOOLS[tool];
  if (!links || !isRecord(data)) return undefined;
  const value = data[links.field];
  if (links.linkOf) {
    const pairs = Array.isArray(value) ? value.map((row) => links.linkOf!(row)).filter((pair) => pair !== undefined) : [];
    return pairs.length > 0 ? { [links.field]: pairs } : undefined;
  }
  return isRecord(value) ? { [links.field]: value } : undefined;
}

function isReadCall(def: McpToolDef | undefined, args: unknown): boolean {
  if (!def) return false;
  if (def.annotations.readOnlyHint || def.kind === 'read') return true;
  const properties = (def.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  return 'dryRun' in properties && isRecord(args) && args.dryRun === true;
}

interface Collection {
  path: string;
  holder: Record<string, unknown> | unknown[];
  key: string | number;
  value: unknown[] | Record<string, unknown>;
  size: number;
}

const isIdMap = (value: Record<string, unknown>) => {
  const keys = Object.keys(value);
  return keys.length >= 5 && keys.every((key) => /\d/.test(key));
};

function collections(node: unknown, path: string, holder: Record<string, unknown> | unknown[] | null, key: string | number, out: Collection[]): void {
  if (Array.isArray(node)) {
    if (holder && path !== 'data.steps') out.push({ path, holder, key, value: node, size: sizeOf(node) });
    node.forEach((child, i) => collections(child, `${path}[${i}]`, node, i, out));
  } else if (isRecord(node)) {
    if (path.endsWith('.links') || path === 'data.compacted') return;
    if (holder && isIdMap(node)) out.push({ path, holder, key, value: node, size: sizeOf(node) });
    for (const [k, child] of Object.entries(node)) collections(child, path ? `${path}.${k}` : k, node, k, out);
  }
}

function compactChange(
  name: string,
  args: unknown,
  result: McpToolOk,
  chars: number,
  getDef: (tool: string) => McpToolDef | undefined,
): McpToolOk {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const answer: { ok: true; envelope: Record<string, unknown>; data: Record<string, unknown>; itemRejections?: unknown[] } = {
    ok: true,
    envelope: clone(result.envelope) as unknown as Record<string, unknown>,
    data: isRecord(result.data) ? clone(result.data) : { value: clone(result.data) },
    ...(result.itemRejections ? { itemRejections: clone(result.itemRejections) } : {}),
  };
  let readSteps = 0;
  const moveLinks = (tool: string, original: unknown, into: Record<string, unknown>, data: Record<string, unknown> | undefined) => {
    const links = linksFrom(tool, original);
    if (!links) return;
    into.links = links;
    if (data && SITE_APP_ID_LINK_TOOLS[tool]?.field === 'created') delete data.created;
  };
  if (name === 'planner_batch' && Array.isArray(answer.data.steps)) {
    const callArgs = listIn(args, 'steps');
    const originals = (isRecord(result.data) && Array.isArray(result.data.steps) ? result.data.steps : []) as BatchStep[];
    answer.data.steps = (answer.data.steps as BatchStep[]).map((step, i) => {
      const out: Record<string, unknown> = { ...step };
      const stepArgs = isRecord(callArgs[i]) ? (callArgs[i] as { args?: unknown }).args : undefined;
      if (step.data !== undefined && isReadCall(getDef(step.tool), stepArgs)) {
        delete out.data;
        out.readOutputOmitted = true;
        readSteps += 1;
        return out;
      }
      moveLinks(step.tool, originals[i]?.data, out, isRecord(out.data) ? out.data : undefined);
      return out;
    });
  } else {
    const links = linksFrom(name, result.data);
    if (links) {
      if (SITE_APP_ID_LINK_TOOLS[name]?.field === 'created') delete answer.data.created;
      answer.data.links = links;
    }
  }
  const shortened: Record<string, { total: number; omitted: number }> = {};
  const compacted = {
    originalChars: chars,
    limit: SITE_APP_MAX_RESPONSE_CHARS,
    note:
      'Every change in this answer succeeded. The full answer was too large, so it was shortened. No field an editing ' +
      'step returned was left out; the label → id links are in `links`' +
      (readSteps > 0 ? '. The output of read steps was left out (`readOutputOmitted`): call such a step on its own, outside planner_batch, to read it' : '') +
      '. Long lists and maps keep their first entries; `shortened` gives per path the total and how many were left ' +
      'out. Read tasks again with planner_list_tasks (`limit`, `offset`) or planner_get_task.',
    shortened,
  };
  const whole = () => ({ ...answer, data: { compacted, ...answer.data } }) as unknown as McpToolOk;
  const over = () => sizeOf(whole()) - SITE_APP_MAX_RESPONSE_CHARS;
  const lineFor = (path: string) => (path in shortened ? 0 : path.length + 40);

  let excess = over();
  while (excess > 0) {
    const found: Collection[] = [];
    collections(answer, '', null, '', found);
    const candidates = found.filter((c) => (Array.isArray(c.value) ? c.value.length : Object.keys(c.value).length) > 0);
    if (candidates.length === 0) break;
    const largest = candidates.reduce((a, b) => (b.size > a.size ? b : a));
    const entries: [string | number, unknown][] = Array.isArray(largest.value)
      ? largest.value.map((v, i) => [i, v])
      : Object.entries(largest.value);
    const need = excess + lineFor(largest.path);
    let removed = 0;
    let keep = entries.length;
    while (keep > 0 && removed < need) {
      keep -= 1;
      const [k, v] = entries[keep];
      removed += sizeOf(v) + 1 + (typeof k === 'string' ? JSON.stringify(k).length + 1 : 0);
    }
    const before = shortened[largest.path];
    const total = before ? before.total : entries.length;
    shortened[largest.path] = { total, omitted: total - keep };
    const kept = Array.isArray(largest.value)
      ? largest.value.slice(0, keep)
      : Object.fromEntries(entries.slice(0, keep) as [string, unknown][]);
    (largest.holder as Record<string | number, unknown>)[largest.key] = kept;
    excess = over();
  }

  if (excess > 0) {
    const texts: { holder: Record<string, unknown> | unknown[]; key: string | number; path: string; value: string }[] = [];
    const walk = (node: unknown, path: string) => {
      if (path.endsWith('.links') || path === 'data.compacted') return;
      const children: [string | number, unknown][] = Array.isArray(node) ? node.map((v, i) => [i, v]) : isRecord(node) ? Object.entries(node) : [];
      for (const [k, v] of children) {
        const childPath = typeof k === 'number' ? `${path}[${k}]` : path ? `${path}.${k}` : k;
        if (typeof v === 'string' && v.length > 200) texts.push({ holder: node as Record<string, unknown>, key: k, path: childPath, value: v });
        else walk(v, childPath);
      }
    };
    walk(answer, '');
    texts.sort((a, b) => b.value.length - a.value.length);
    for (const text of texts) {
      if (excess <= 0) break;
      const cut = Math.min(text.value.length - 200, excess + lineFor(text.path));
      (text.holder as Record<string | number, unknown>)[text.key] = `${text.value.slice(0, text.value.length - cut)}…`;
      shortened[text.path] = { total: text.value.length, omitted: cut };
      excess = over();
    }
  }
  return whole();
}

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
      const tooMany = linksTooLarge(name, args);
      if (tooMany !== null) throw tooMany;
      const raw = await (await session())((id) =>
        JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
      );
      const response = JSON.parse(raw) as {
        result?: { structuredContent?: McpToolResult };
        error?: { code?: number; message?: string };
      };
      if (response.error) {
        throw boundedFailure(`JSONRPC_${response.error.code ?? 'ERROR'}`, response.error.message ?? 'MCP error');
      }
      let result = response.result?.structuredContent;
      if (!result) throw new SiteAppToolError('JSONRPC_ERROR', 'MCP response without a result');
      if (name === 'planner_batch' && isRecord(result.data) && 'substeps' in result.data) {
        const { substeps: _activity, ...rest } = result.data;
        void _activity;
        result = { ...result, data: rest } as McpToolResult;
      }
      if (!result.ok) throw boundedFailure(result.code, result.error);
      const chars = sizeOf(result);
      if (chars <= SITE_APP_MAX_RESPONSE_CHARS) return result;
      const defs = (await loadDeps()).getTools();
      const getDef = (tool: string) => defs.find((d) => d.name === tool);
      const def = getDef(name);
      if (def?.annotations.readOnlyHint) throw tooLarge(name, chars, def);
      return compactChange(name, args, result, chars, getDef);
    },
  };
}

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
