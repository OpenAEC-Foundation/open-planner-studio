// MCP-toolindex — de KALE registratie-staat (naam→def + vlakke lijst) zonder enige tool-import.
//
// WAAROM EEN APART BESTAND: `toolRegistry.ts` importeert álle tool-modules en registreert ze bij
// module-load. `tools/batchTool.ts` moet op zijn beurt tools kúnnen opzoeken (`getTool`) om een
// draaiboekstap te dispatchen. Zouden die twee elkaar direct importeren, dan ontstaat een
// import-cyclus waarvan de afloop van de laadvolgorde afhangt: wordt de cyclus via `batchTool`
// binnengegaan, dan draait het body van `toolRegistry` terwijl `batchTools` nog in zijn temporal dead
// zone staat ⇒ ReferenceError bij het opstarten. Deze leaf-module heeft nul tool-imports, dus
// `batchTool` (en elke toekomstige tool die iets moet opzoeken) leunt hierop en de cyclus bestaat niet.
//
// `toolRegistry.ts` blijft de publieke ingang (het re-exporteert alles hieruit) — dispatcher, server en
// tests hoeven niets te weten van deze splitsing.
import type { McpToolDef } from './contracts';

/** Service-prefix; alle toolnamen dragen hem (voorkomt botsingen met andere MCP-servers). */
export const TOOL_PREFIX = 'planner_';

let flatTools: McpToolDef[] = [];
let toolsByName = new Map<string, McpToolDef>();

/**
 * (Her)registreer de complete toolset uit een lijst van module-arrays. Vervangt de vorige staat.
 * Gooit bij een ontbrekende prefix, een dubbele naam of een lege description (ontwikkelfout, faalt vroeg).
 */
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

/** Alle geregistreerde tools als vlakke lijst (volgorde = registratievolgorde). */
export function getTools(): McpToolDef[] {
  return flatTools;
}

/** Zoek één tool op naam; `undefined` wanneer onbekend. */
export function getTool(name: string): McpToolDef | undefined {
  return toolsByName.get(name);
}
