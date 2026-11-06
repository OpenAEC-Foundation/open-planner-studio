// `window.__OPDS_APP__` van de platformbouw: dezelfde verzoekafhandeling, dispatcher en tools als de bridge, zonder
// Tauri. Elke test werkt via `installSiteAppTools` op een nepvenster, dus via de route die de platformbouw neerzet
// (review PR #802, vervolg 1): de guards, het documentanker en de bestandstools worden daar getoetst, niet in een
// verse context zonder documentbinding.
import { useAppStore, test, assert, assertEq, run } from './harness';
import { getTools } from '@/services/mcp/toolRegistry';
import type { McpToolDef } from '@/services/mcp/contracts';
import {
  installSiteAppTools,
  siteAppToolDefinitions,
  siteAppToolsJson,
  SITE_APP_UNAVAILABLE_TOOLS,
  SITE_APP_MAX_RESPONSE_CHARS,
  type SiteAppTools,
} from '@/services/mcp/siteAppTools';

/** Een vers nepvenster met `__OPDS_APP__`, zoals `main.tsx` het in de platformbouw neerzet (eigen sessie). */
function install(): SiteAppTools {
  const target: Parameters<typeof installSiteAppTools>[0] = {};
  installSiteAppTools(target);
  assert(target.__OPDS_APP__, '__OPDS_APP__ ontbreekt');
  return target.__OPDS_APP__!;
}

/** Een leeg nieuw document, met de AI-schakelaars in de beginstand. */
function freshDocument(): void {
  const st = useAppStore.getState();
  st.setUI({ aiPaused: false, aiReadOnly: false, showNewProjectDialog: false });
  st.newDocument();
}

/** De fout van een aanroep (`message` en `code`), of null als hij slaagde. */
async function failure(app: SiteAppTools, name: string, args?: Record<string, unknown>) {
  try {
    await app.run(name, args);
  } catch (error) {
    return { message: (error as Error).message, code: (error as { code?: unknown }).code };
  }
  return null;
}

const addTask = (name: string) => ({ tasks: [{ tempId: `tmp-${name}`, name, duration: 2 }] });

test('tools() en definitions(): de registry zonder de bestandstools, met dezelfde schema\'s als tools/list', async () => {
  const app = install();
  const names = await app.tools();
  assert(names.includes('planner_add_tasks'), 'planner_add_tasks ontbreekt');
  assert(names.includes('planner_get_critical_path'), 'planner_get_critical_path ontbreekt');
  for (const name of SITE_APP_UNAVAILABLE_TOOLS) assert(!names.includes(name), `${name} hoort er niet bij`);
  assertEq(names.length, getTools().length - SITE_APP_UNAVAILABLE_TOOLS.size, 'aantal tools');
  const addTasks = (await app.definitions()).find((d) => d.name === 'planner_add_tasks');
  assertEq(addTasks?.inputSchema, getTools().find((d) => d.name === 'planner_add_tasks')!.inputSchema, 'schema');
});

test('mcp-tools.json: dezelfde definities, zonder de bestandstools, alles met planner_', async () => {
  const defs = siteAppToolDefinitions(getTools());
  const fromFile = JSON.parse(siteAppToolsJson(getTools())) as { name: string; description: string; inputSchema: object }[];
  assertEq(fromFile, defs, 'bestand = definities');
  assertEq(fromFile.map((d) => d.name), await install().tools(), 'zelfde namen als tools()');
  assert(fromFile.length > 0, 'leeg bestand');
  for (const def of fromFile) {
    assert(def.name.startsWith('planner_'), `naam zonder planner_: ${def.name}`);
    assert(typeof def.description === 'string' && def.description !== '', `${def.name}: geen beschrijving`);
    assert(def.inputSchema && typeof def.inputSchema === 'object', `${def.name}: geen schema`);
  }
  for (const name of SITE_APP_UNAVAILABLE_TOOLS) {
    assert(!fromFile.some((d) => d.name === name), `${name} staat in mcp-tools.json`);
  }
  // Een pure functie: alleen de invoer telt, niet de registry.
  const fake = [
    { name: 'planner_x', description: 'x', inputSchema: {}, annotations: getTools()[0].annotations },
    { name: 'planner_export_ifc', description: 'y', inputSchema: {}, annotations: getTools()[0].annotations },
  ] as unknown as McpToolDef[];
  assertEq(siteAppToolDefinitions(fake).map((d) => d.name), ['planner_x'], 'pure functie filtert');
});

test('run(): taken met relaties in een batch, en het kritieke pad klopt', async () => {
  freshDocument();
  const app = install();
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
  assertEq(batch.ok, true, 'batch');
  assertEq(useAppStore.getState().sequences.length, 1, 'relaties');
  const path = (await app.run('planner_get_critical_path')) as { data: { criticalTasks: { name: string }[] } };
  assertEq(path.data.criticalTasks.map((t) => t.name), ['Fundering', 'Metselwerk'], 'kritiek pad');
});

test('run(): de schemapoort van de dispatcher geldt ook hier', async () => {
  freshDocument();
  const fail = await failure(install(), 'planner_add_tasks', { tasks: [{ tempId: 'zonder-prefix', name: 'x' }] });
  assert(fail?.message.startsWith('VALIDATION: '), `verwacht VALIDATION, kreeg: ${fail?.message}`);
  assertEq(fail?.code, 'VALIDATION', 'code los op de fout');
});

test('run(): een JSON-RPC-fout houdt de code van de dispatcher', async () => {
  const fail = await failure(install(), 'planner_bestaat_niet');
  assertEq(fail?.message, 'JSONRPC_-32602: Unknown tool: planner_bestaat_niet', 'melding met code');
  assertEq(fail?.code, 'JSONRPC_-32602', 'code los op de fout');
});

test('run(): PAUSED, READ_ONLY en DIALOG_OPEN weigeren een wijziging', async () => {
  const cases: [string, Record<string, boolean>][] = [
    ['PAUSED', { aiPaused: true }],
    ['READ_ONLY', { aiReadOnly: true }],
    ['DIALOG_OPEN', { showNewProjectDialog: true }],
  ];
  for (const [code, ui] of cases) {
    freshDocument();
    const app = install();
    useAppStore.getState().setUI(ui);
    const fail = await failure(app, 'planner_add_tasks', addTask('geweigerd'));
    assert(fail?.message.startsWith(`${code}: `), `${code}: verwacht ${code}, kreeg: ${fail?.message ?? 'geen fout'}`);
    assertEq(fail?.code, code, `${code}: code los op de fout`);
    assertEq(useAppStore.getState().tasks.length, 0, `${code}: er is niets toegevoegd`);
    useAppStore.getState().setUI({ aiPaused: false, aiReadOnly: false, showNewProjectDialog: false });
    assertEq((await app.run('planner_add_tasks', addTask('daarna')) as { ok: boolean }).ok, true, `${code}: daarna weer toegestaan`);
  }
});

test('run(): het documentanker blijft tussen aanroepen; een wissel door de gebruiker geeft DOC_DRIFT (review PR #802)', async () => {
  freshDocument();
  const app = install();
  const docA = useAppStore.getState().activeDocumentId;
  assertEq((await app.run('planner_add_tasks', addTask('in-A')) as { ok: boolean }).ok, true, 'taak in A');

  useAppStore.getState().newDocument(); // de gebruiker wisselt zelf, buiten de assistent om
  const docB = useAppStore.getState().activeDocumentId;
  assert(docA !== docB, 'voorwaarde: B is actief');
  const fail = await failure(app, 'planner_add_tasks', addTask('in-B'));
  assert(fail?.message.startsWith('DOC_DRIFT: '), `verwacht DOC_DRIFT, kreeg: ${fail?.message ?? 'geen fout'}`);
  assertEq(useAppStore.getState().tasks.length, 0, 'B blijft leeg');

  // Lezen mag door; wijzigen blijft geweigerd tot de assistent expliciet een document kiest.
  await app.run('planner_list_tasks');
  assert((await failure(app, 'planner_add_tasks', addTask('nog-in-B')))?.message.startsWith('DOC_DRIFT: '), 'nog steeds DOC_DRIFT');
  assertEq((await app.run('planner_switch_document', { documentId: docB }) as { ok: boolean }).ok, true, 'expliciet B kiezen');
  assertEq((await app.run('planner_add_tasks', addTask('na-keuze')) as { ok: boolean }).ok, true, 'daarna in B');
  assertEq(useAppStore.getState().tasks.map((t) => t.name), ['na-keuze'], 'alleen de taak na de keuze staat in B');
});

test('run(): beide bestandstools geven niet_in_browser, direct en in planner_batch', async () => {
  freshDocument();
  const app = install();
  const argsFor: Record<string, Record<string, unknown>> = {
    planner_export_ifc: { path: '/tmp/x.ifc' },
    planner_import_schedule: { path: '/tmp/x.xml' },
  };
  assertEq([...SITE_APP_UNAVAILABLE_TOOLS].sort(), Object.keys(argsFor).sort(), 'de twee bestandstools');
  for (const [name, args] of Object.entries(argsFor)) {
    const direct = await failure(app, name, args);
    assert(direct?.message.startsWith(`niet_in_browser: ${name}`), `${name} direct: kreeg ${direct?.message ?? 'geen fout'}`);
    assertEq(direct?.code, 'niet_in_browser', `${name} direct: code`);
    const inBatch = await failure(app, 'planner_batch', {
      steps: [{ tool: 'planner_add_tasks', args: addTask('voor') }, { tool: name, args }],
    });
    assert(inBatch?.message.startsWith(`niet_in_browser: ${name}`), `${name} in batch: kreeg ${inBatch?.message ?? 'geen fout'}`);
    assertEq(useAppStore.getState().tasks.length, 0, `${name} in batch: de batch draaide niet`);
  }
});

test('run(): een te groot antwoord van een gepagineerde leestool geeft te_groot met de filters', async () => {
  freshDocument();
  const app = install();
  const tasks = Array.from({ length: 200 }, (_, i) => ({
    tempId: `tmp-t${i}`,
    name: `Taak ${i} met een lange naam zodat het antwoord flink groeit`,
    duration: 1,
  }));
  assertEq((await app.run('planner_add_tasks', { tasks }) as { ok: boolean }).ok, true, 'taken toegevoegd');
  const fail = await failure(app, 'planner_list_tasks', { limit: 1000 });
  assertEq(fail?.code, 'te_groot', `code, kreeg: ${fail?.message ?? 'geen fout'}`);
  assert(fail!.message.includes(`limit ${SITE_APP_MAX_RESPONSE_CHARS}`), 'noemt de grens');
  assert(fail!.message.includes('`limit` and `offset`') && fail!.message.includes('`kritiek`'), 'noemt hoe je filtert');
  const page = (await app.run('planner_list_tasks', { limit: 10 })) as { ok: boolean };
  assertEq(page.ok, true, 'een kleine pagina mag');
});

await run();
