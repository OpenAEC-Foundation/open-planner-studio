import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpToolOk, McpToolResult } from '@/services/mcp/contracts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const S = () => useAppStore.getState();
const BONSAI = readFileSync(join(ROOT, 'tests/fixtures/ifc-foreign/bonsai-4d.ifc'), 'utf8');
const guidOf = (stepId: number) => new RegExp(`^#${stepId}=IFC\\w+\\('([^']+)'`, 'm').exec(BONSAI)![1];

async function getTask(taskId: string): Promise<Record<string, unknown>> {
  const result = await getTool('planner_get_task')!.handler({ taskId }, makeMcpContext(appStoreContext)) as McpToolResult;
  assert(result.ok, `planner_get_task gaf een fout: ${result.ok ? '' : result.error}`);
  return (result as McpToolOk).data as Record<string, unknown>;
}

async function openBonsai(content: string) {
  useAppStore.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await S().openOpenedFile({ name: 'bonsai-4d.ifc', content: '', bytes: new TextEncoder().encode(content), ref: null });
  assertEq(S().ifcSource?.foreign, true, 'het model opent met zijn bron');
  return (name: string) => S().tasks.find(t => t.name === name)!.id;
}

test('planner_get_task: dezelfde koppelingen als het taakpaneel, alleen met de flag', async () => {
  const idOf = await openBonsai(BONSAI);
  const wallA = await getTask(idOf('Wand A bouwen'));
  assertEq(wallA.elementLinks, {
    elements: 1, notFound: 0,
    links: [
      { direction: 'output', target: guidOf(30), found: true },
      { direction: 'input', target: guidOf(30), found: true },
    ],
  }, 'Wand A: uitvoer en invoer, één bouwdeel');
  const roughWork = await getTask(idOf('Ruwbouw'));
  assertEq('elementLinks' in roughWork, false, 'een taak zonder koppeling heeft geen veld');

  useAppStore.setState(s => { s.ui.featureFlags = {}; });
  const withoutFlag = await getTask(idOf('Wand A bouwen'));
  assertEq('elementLinks' in withoutFlag, false, 'zonder flag geen veld, ook met de bron nog in het document');
});

test('planner_get_task: een doel dat niet in het bestand staat, telt als niet gevonden', async () => {
  const idOf = await openBonsai(BONSAI.replace('(#108,#160),$,#61);', '(#108,#160),$,#9999);'));
  const wallB = await getTask(idOf('Wand B bouwen'));
  assertEq(wallB.elementLinks, {
    elements: 1, notFound: 1, links: [{ direction: 'output', target: '#9999', found: false }],
  }, 'Wand B: de verwijzing zelf, niet gevonden');
});

await run();
