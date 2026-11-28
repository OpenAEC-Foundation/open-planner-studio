import type { McpToolAnnotations, McpToolDef } from './contracts';

export interface ListedTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: McpToolAnnotations;
}

export function toolListEntry(def: McpToolDef): ListedTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    annotations: def.annotations,
  };
}
