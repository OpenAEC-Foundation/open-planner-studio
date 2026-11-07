// MCP-bridge — hoe een tooldefinitie naar buiten gaat: als regel in `tools/list` (desktopbridge en headless
// server, via `dispatcher.ts`) en in de SuperCloud-export (`siteAppTools.ts`). Eén plek, zodat beide kanalen
// dezelfde vorm hebben (#818).
//
// ANNOTATIES ALTIJD VOLLEDIG. Alle vier de hints gaan mee, ook als een hint gelijk is aan de standaardwaarde
// van de MCP-spec. Reden (council-ronde 2 op #838): Claude Code leest een ontbrekende `destructiveHint` en
// `openWorldHint` als `false`, niet als de standaard uit de spec, en vraagt dan geen toestemming meer bij een
// destructieve tool. Weglaten levert ook geen modeltokens op: een Anthropic-tooldefinitie heeft geen veld
// `annotations`, en het SuperCloud-contract noemt alleen `name`, `description` en `inputSchema`.
import type { McpToolAnnotations, McpToolDef } from './contracts';

/** Een tooldefinitie zoals een client hem ziet. */
export interface ListedTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: McpToolAnnotations;
}

/** Eén regel voor `tools/list` en voor de SuperCloud-export. */
export function toolListEntry(def: McpToolDef): ListedTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    annotations: def.annotations,
  };
}
