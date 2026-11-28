import type { McpToolDef } from './contracts';
import { registerToolModules } from './toolIndex';
import { readTools } from './tools/readTools';
import { taskTools } from './tools/taskTools';
import { dependencyTools } from './tools/dependencyTools';
import { externalLinkTools } from './tools/externalLinkTools';
import { calendarResourceTools } from './tools/calendarResourceTools';
import { resourceTools } from './tools/resourceTools';
import { baselineTools } from './tools/baselineTools';
import { documentTools } from './tools/documentTools';
import { fileTools } from './tools/fileTools';
import { guideTools } from './tools/guideTools';
import { batchTools } from './tools/batchTool';
import { xerProvenanceTools } from './tools/xerProvenanceTools';

export { TOOL_PREFIX, registerToolModules, getTool, getTools } from './toolIndex';

const MODULES: McpToolDef[][] = [
  readTools,
  xerProvenanceTools,
  taskTools,
  dependencyTools,
  externalLinkTools,
  calendarResourceTools,
  resourceTools,
  baselineTools,
  documentTools,
  fileTools,
  guideTools,
  batchTools,
];

export function registerAllTools(): void {
  registerToolModules(MODULES);
}

registerAllTools();
