// MCP-bridge — hoe een tooldefinitie naar buiten gaat: als regel in `tools/list` (desktopbridge en headless
// server, via `dispatcher.ts`) en in de SuperCloud-export (`siteAppTools.ts`). Eén plek, zodat beide kanalen
// dezelfde vorm hebben (#818).
//
// ANNOTATIES ZONDER STANDAARDWAARDEN. De MCP-spec (ToolAnnotations) geeft elke hint een standaard:
// `readOnlyHint` false, `destructiveHint` true, `idempotentHint` false, `openWorldHint` true. `destructiveHint`
// en `idempotentHint` betekenen alleen iets als `readOnlyHint` false is. Een hint die gelijk is aan zijn
// standaard, of die bij een leestool niets betekent, laten we hier weg: de betekenis blijft gelijk en elke
// sessie spaart tekens. Intern (`def.annotations`) blijven alle vier de vlaggen staan; alleen de uitvoer is
// korter. De Claude Desktop-bundel leest `readOnlyHint === true`, en dat blijft altijd staan.
import type { McpToolAnnotations, McpToolDef } from './contracts';

/** De annotaties zoals een client ze ziet: alleen de hints die van de standaard afwijken. */
export type ListedAnnotations = Partial<McpToolAnnotations>;

/** Een tooldefinitie zoals een client hem ziet. */
export interface ListedTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: ListedAnnotations;
}

export function listedAnnotations(a: McpToolAnnotations): ListedAnnotations {
  const out: ListedAnnotations = {};
  if (a.readOnlyHint) {
    out.readOnlyHint = true;
  } else {
    if (!a.destructiveHint) out.destructiveHint = false;
    if (a.idempotentHint) out.idempotentHint = true;
  }
  if (!a.openWorldHint) out.openWorldHint = false;
  return out;
}

/** Eén regel voor `tools/list` en voor de SuperCloud-export. */
export function toolListEntry(def: McpToolDef): ListedTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    annotations: listedAnnotations(def.annotations),
  };
}
