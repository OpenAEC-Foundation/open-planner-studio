// MCP-toolregistry — de publieke ingang: importeert alle tool-modules en registreert ze bij load.
//
// Toelichting bij een nieuwe tool (stappen, context-aandachtspunten, het mechanische vangnet):
// docs/recepten/mcp-tool.md. Dat vangnet zelf is `tests/mcp/cases-toolregistry.ts`.
//
// STRUCTUUR (parallellisatie-eis, spec §componenten): elke `tools/*.ts`-module exporteert zijn eigen
// `McpToolDef[]`; deze registry importeert die arrays en slaat ze plat. Een baan voegt dus precies
// twee dingen toe: zijn eigen module én één regel in `MODULES` hieronder.
//
// De registratie-STAAT zelf (`registerToolModules`/`getTool`/`getTools`/`TOOL_PREFIX`) leeft in de
// leaf-module `toolIndex.ts` en wordt hier ongewijzigd doorgegeven. Reden: `tools/batchTool.ts` moet
// tools kunnen opzoeken; zou dat via dít bestand lopen, dan ontstond een import-cyclus die afhankelijk
// van de laadvolgorde in een temporal-dead-zone-fout eindigt (zie de kop van `toolIndex.ts`).
// Consumenten (dispatcher, server, tests) blijven gewoon hier importeren.
import type { McpToolDef } from './contracts';
import { registerToolModules } from './toolIndex';
import { readTools } from './tools/readTools';
import { taskTools } from './tools/taskTools';
import { dependencyTools } from './tools/dependencyTools';
import { calendarResourceTools } from './tools/calendarResourceTools';
import { resourceTools } from './tools/resourceTools';
import { baselineTools } from './tools/baselineTools';
import { documentTools } from './tools/documentTools';
import { fileTools } from './tools/fileTools';
import { batchTools } from './tools/batchTool';
import { xerProvenanceTools } from './tools/xerProvenanceTools';

export { TOOL_PREFIX, registerToolModules, getTool, getTools } from './toolIndex';

// Volgorde = registratievolgorde = de volgorde waarin `tools/list` ze teruggeeft.
// Batch staat bewust achteraan: hij dispatcht de andere tools, dus lezen we hem als sluitstuk.
const MODULES: McpToolDef[][] = [
  readTools,
  xerProvenanceTools,
  taskTools,
  // Direct ná taskTools: samen vormen add_/update_/remove_dependencies de volledige levensloop van
  // een relatie, en zo staan ze ook naast elkaar in `tools/list` (waar de AI ze leest).
  dependencyTools,
  calendarResourceTools,
  resourceTools,
  // Baselinebeheer staat direct ná de module waar `save_baseline` woont: samen vormen ze de
  // volledige levensloop van een nulmeting (opslaan → opsommen → activeren → hernoemen → verwijderen).
  baselineTools,
  documentTools,
  fileTools,
  batchTools,
];

/**
 * (Her)registreer de COMPLETE productie-toolset. Idempotent: `registerToolModules` bouwt de staat
 * elke keer vers op, dus twee aanroepen leveren exact dezelfde registratie.
 *
 * Waarom naast de zelf-registratie hieronder (SYNC-2): die zelf-registratie is een side-effect van het
 * IMPORTEREN van dit bestand. Dat werkt (de dispatcher importeert hem), maar het is een stille,
 * onopzettelijke afhankelijkheid — en een test die zijn eigen deelverzameling registreert laat de
 * globale staat afgeknot achter. `initMcpRuntime()` in `server.ts` roept deze functie expliciet aan bij
 * het opstarten van de bridge, zodat `tools/list` in de echte app gegarandeerd de volledige set toont.
 */
export function registerAllTools(): void {
  registerToolModules(MODULES);
}

// Zelf-registratie bij module-load.
registerAllTools();
