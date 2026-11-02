// `window.__OPDS_APP__` van de platformbouw: dezelfde dispatcher en tools als de bridge, zonder Tauri.
import { useAppStore, test, assert, assertEq, run, makeMcpContext } from './harness';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { getTools } from '@/services/mcp/toolRegistry';
import {
  createSiteAppTools,
  installSiteAppTools,
  SITE_APP_UNAVAILABLE_TOOLS,
  type SiteAppToolsDeps,
} from '@/services/mcp/siteAppTools';

const deps: SiteAppToolsDeps = {
  getTools,
  dispatch: (rawBody) => handleMcpMessage(rawBody, makeMcpContext()),
};
const app = createSiteAppTools(async () => deps);

test('tools(): de registry zonder de bestandstools', async () => {
  const names = await app.tools();
  assert(names.includes('planner_add_tasks'), 'planner_add_tasks ontbreekt');
  assert(names.includes('planner_get_critical_path'), 'planner_get_critical_path ontbreekt');
  for (const name of SITE_APP_UNAVAILABLE_TOOLS) assert(!names.includes(name), `${name} hoort er niet bij`);
  assertEq(names.length, getTools().length - SITE_APP_UNAVAILABLE_TOOLS.size);
});

test('definitions(): dezelfde schema\'s als tools/list', async () => {
  const definitions = await app.definitions();
  const addTasks = definitions.find((d) => d.name === 'planner_add_tasks');
  assert(addTasks, 'planner_add_tasks ontbreekt');
  assertEq(addTasks!.inputSchema, getTools().find((d) => d.name === 'planner_add_tasks')!.inputSchema);
});

test('run(): taken met relaties in een batch, en het kritieke pad klopt', async () => {
  const batch = (await app.run('planner_batch', {
    steps: [
      {
        tool: 'planner_add_tasks',
        args: {
          tasks: [
            { tempId: 'tmp-a', name: 'Fundering', duration: 5 },
            { tempId: 'tmp-b', name: 'Metselwerk', duration: 10 },
          ],
        },
      },
      {
        tool: 'planner_add_dependencies',
        args: { dependencies: [{ predecessorId: 'tmp-a', successorId: 'tmp-b', type: 'FS' }] },
      },
    ],
  })) as { ok: boolean };
  assertEq(batch.ok, true);
  assertEq(useAppStore.getState().sequences.length, 1);

  const path = (await app.run('planner_get_critical_path')) as { ok: boolean; data: { criticalTasks: { name: string }[] } };
  assertEq(path.data.criticalTasks.map((t) => t.name), ['Fundering', 'Metselwerk']);
});

test('run(): de schemapoort van de dispatcher geldt ook hier', async () => {
  let message = '';
  try {
    await app.run('planner_add_tasks', { tasks: [{ tempId: 'zonder-prefix', name: 'x' }] });
  } catch (error) {
    message = (error as Error).message;
  }
  assert(message.startsWith('VALIDATION: '), `verwacht VALIDATION, kreeg: ${message}`);
});

test('run(): een onbekende tool en een bestandstool worden geweigerd', async () => {
  const failure = async (name: string) => {
    try {
      await app.run(name);
    } catch (error) {
      return (error as Error).message;
    }
    return '';
  };
  assert((await failure('planner_bestaat_niet')).includes('Unknown tool'), 'onbekende tool niet geweigerd');
  assert((await failure('planner_export_ifc')).startsWith('UNAVAILABLE: '), 'bestandstool niet geweigerd');
});

test('installSiteAppTools zet het object en laadt de MCP-laag pas bij gebruik', async () => {
  const target: Parameters<typeof installSiteAppTools>[0] = {};
  installSiteAppTools(target);
  assert(target.__OPDS_APP__, '__OPDS_APP__ ontbreekt');
  assert((await target.__OPDS_APP__!.tools()).includes('planner_list_tasks'), 'planner_list_tasks ontbreekt');
});

await run();
