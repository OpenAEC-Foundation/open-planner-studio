import type { McpToolDef } from './contracts';

export const TOOL_PREFIX = 'planner_';

let flatTools: McpToolDef[] = [];
let toolsByName = new Map<string, McpToolDef>();

export function registerToolModules(defs: McpToolDef[][]): void {
  const flat: McpToolDef[] = [];
  const byName = new Map<string, McpToolDef>();
  for (const mod of defs) {
    for (const def of mod) {
      if (!def.name.startsWith(TOOL_PREFIX)) {
        throw new Error(`MCP-toolnaam mist de verplichte '${TOOL_PREFIX}'-prefix: '${def.name}'`);
      }
      if (byName.has(def.name)) {
        throw new Error(`Dubbele MCP-toolnaam bij registratie: '${def.name}'`);
      }
      if (def.description.trim() === '') {
        throw new Error(`MCP-tool '${def.name}' mist een (niet-lege) description`);
      }
      byName.set(def.name, def);
      flat.push(def);
    }
  }
  flatTools = flat;
  toolsByName = byName;
}

export function getTools(): McpToolDef[] {
  return flatTools;
}

export function getTool(name: string): McpToolDef | undefined {
  return toolsByName.get(name);
}
