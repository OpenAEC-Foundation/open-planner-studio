// `window.__OPDS_APP__` van de platformbouw: dezelfde verzoekafhandeling, dispatcher en tools als de bridge, zonder
// Tauri. Elke test werkt via `installSiteAppTools` op een nepvenster, dus via de route die de platformbouw neerzet
// (review PR #802, vervolg 1): de guards, het documentanker en de bestandstools worden daar getoetst, niet in een
// verse context zonder documentbinding.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useAppStore, test, assert, assertEq, run } from './harness';
import { guideToolDeps } from '@/services/mcp/tools/guideTools';
import { getTools } from '@/services/mcp/toolRegistry';
import type { McpToolDef } from '@/services/mcp/contracts';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  installSiteAppTools,
  siteAppToolDefinitions,
  siteAppToolsJson,
  SITE_APP_UNAVAILABLE_TOOLS,
  SITE_APP_MAX_RESPONSE_CHARS,
  SITE_APP_REAL_ID_JSON_CHARS,
  SITE_APP_REPORT_BASE_CHARS,
  SITE_APP_REPORT_STEP_CHARS,
  SITE_APP_MAX_ERROR_CHARS,
  SITE_APP_ID_LINK_TOOLS,
  type SiteAppTools,
} from '@/services/mcp/siteAppTools';

// De gids en de skills komen in de app uit `public/`; hier leest de test ze van schijf (zelfde naad als
// de headless MCP-server, `guideToolDeps.fetchImpl`). De testbundel staat in tests/mcp/.
const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));
guideToolDeps.fetchImpl = async (url) => ({
  ok: true,
  status: 200,
  text: async () => readFileSync(PUBLIC + url.replace(/^\/+/, ''), 'utf8'),
});

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

/** Een keten van `n` taken (alles kritiek), via de site-interface zelf. Geeft de taak-id's in volgorde. */
async function chain(app: SiteAppTools, n: number): Promise<string[]> {
  const tasks = Array.from({ length: n }, (_, i) => ({
    tempId: `tmp-k${i}`,
    name: `Taak ${i} met een lange naam zodat het antwoord flink groeit`,
    duration: 1,
  }));
  for (let i = 0; i < tasks.length; i += 300) {
    assertEq((await app.run('planner_add_tasks', { tasks: tasks.slice(i, i + 300) }) as { ok: boolean }).ok, true, 'taken toegevoegd');
  }
  const ids = useAppStore.getState().tasks.map((t) => t.id);
  for (let i = 0; i < ids.length - 1; i += 100) {
    const dependencies = [];
    for (let j = i; j < Math.min(i + 100, ids.length - 1); j++) {
      dependencies.push({ predecessorId: ids[j], successorId: ids[j + 1], type: 'FS' });
    }
    assertEq((await app.run('planner_add_dependencies', { dependencies }) as { ok: boolean }).ok, true, 'relaties');
  }
  return ids;
}


/** Past dit antwoord binnen de grens van het sitecontract? */
const fits = (value: unknown) => JSON.stringify(value).length <= SITE_APP_MAX_RESPONSE_CHARS;

test('te_groot: een gepagineerde leestool noemt limit/offset en zijn filters; een kleine pagina mag', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const fail = await failure(app, 'planner_list_tasks', { limit: 1000 });
  assertEq(fail?.code, 'te_groot', `code, kreeg: ${fail?.message ?? 'geen fout'}`);
  assert(fail!.message.includes(`limit ${SITE_APP_MAX_RESPONSE_CHARS}`), 'noemt de grens');
  assert(fail!.message.includes('`limit` and `offset`') && fail!.message.includes('`kritiek`'), 'noemt hoe je filtert');
  assert(fits(await app.run('planner_list_tasks', { limit: 10 })), 'een kleine pagina past');
});

test('te_groot: het kritieke pad bij 200 taken, en de pagina\'s die het noemt passen en zijn samen compleet', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const fail = await failure(app, 'planner_get_critical_path');
  assertEq(fail?.code, 'te_groot', `code, kreeg: ${fail?.message ?? 'geen fout'}`);
  assert(fail!.message.includes('`limit` and `offset`'), `noemt de uitweg: ${fail!.message}`);
  let offset: number | null = 0;
  let count = 0;
  let relations = 0;
  while (offset !== null) {
    const page = (await app.run('planner_get_critical_path', { limit: 50, offset })) as {
      data: { criticalTasks: unknown[]; drivingRelations: unknown[]; total: number; next_offset: number | null };
    };
    assert(fits(page), 'elke pagina past');
    assertEq(page.data.total, 200, 'total');
    count += page.data.criticalTasks.length;
    relations += page.data.drivingRelations.length;
    offset = page.data.next_offset;
  }
  assertEq(count, 200, 'alle kritieke taken over de pagina\'s');
  assertEq(relations, 199, 'elke sturende relatie één keer');
});

test('te_groot: het overzicht verwijst naar planner_list_tasks', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const fail = await failure(app, 'planner_get_project_overview');
  assertEq(fail?.code, 'te_groot', `code, kreeg: ${fail?.message ?? 'geen fout'}`);
  assert(fail!.message.includes('planner_list_tasks'), `noemt de uitweg: ${fail!.message}`);
  assert(fits(await app.run('planner_list_tasks', { limit: 50 })), 'de uitweg past');
});

test('te_groot: de gids met de standaardwaarde van part; elk deel apart past', async () => {
  const fail = await failure(install(), 'planner_get_planning_guide');
  assertEq(fail?.code, 'te_groot', `code, kreeg: ${fail?.message ?? 'geen fout'}`);
  assert(fail!.message.includes('part: "guide"') && fail!.message.includes('part: "skill"'), `noemt de uitweg: ${fail!.message}`);
  for (const part of ['guide', 'skill']) {
    const res = (await install().run('planner_get_planning_guide', { part })) as { ok: boolean; data: { missing?: unknown } };
    assertEq(res.data.missing, undefined, `part ${part}: alles geladen`);
    assert(fits(res), `part ${part} past (${JSON.stringify(res).length} tekens)`);
  }
});

test('batch met een grote leesstap: geslaagd, ingekort, met hoe je de uitvoer volledig opvraagt', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const res = (await app.run('planner_batch', { steps: [{ tool: 'planner_list_tasks', args: { limit: 200 } }] })) as {
    ok: boolean; data: { compacted?: { note: string }; steps: { status: string; data?: unknown; readOutputOmitted?: boolean }[]; substeps?: unknown };
  };
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assert(res.data.compacted?.note.includes('shortened'), 'meldt dat het ingekort is');
  assertEq(res.data.substeps, undefined, 'substeps weg');
  assertEq(res.data.steps[0].status, 'uitgevoerd', 'status van de stap blijft');
  assertEq(res.data.steps[0].data, undefined, 'de leesuitvoer is weg');
  assertEq(res.data.steps[0].readOutputOmitted, true, 'zegt dat de leesuitvoer weg is');
  assert(res.data.compacted!.note.includes('call such a step on its own'), 'zegt hoe je hem volledig opvraagt');
});

test('batch met een wijziging en een grote leesstap: de wijziging blijft geslaagd, nooit achteraf een fout', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const before = useAppStore.getState().tasks.length;
  const res = (await app.run('planner_batch', {
    steps: [
      { tool: 'planner_add_tasks', args: addTask('extra') },
      { tool: 'planner_list_tasks', args: { limit: 1000 } },
    ],
  })) as { ok: boolean; data: { steps: { status: string; data?: { created?: Record<string, string> }; readOutputOmitted?: boolean }[] } };
  assertEq(res.ok, true, 'de batch is geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(useAppStore.getState().tasks.length, before + 1, 'de wijziging is uitgevoerd');
  assertEq(res.data.steps.map((st) => st.status), ['uitgevoerd', 'uitgevoerd'], 'status per stap');
  assert(typeof res.data.steps[0].data?.created?.['tmp-extra'] === 'string', 'de created-map van de wijziging blijft');
  assertEq(res.data.steps[1].readOutputOmitted, true, 'de leesuitvoer is weg');
});

/** Uurtaken van 80 h met een toewijzing en een bewaard restwerk van 320 h (zoals na een XER-import), zoals in
 *  cases-restwerk-duurwijziging.ts. Een duurwijziging rekent dat restwerk opnieuw uit en de envelop noemt elke
 *  correctie (`remainingWorkRecomputed`). */
function hourTasksWithRemainingWork(n: number): string[] {
  const S = () => useAppStore.getState();
  freshDocument();
  const band = [{ start: 480, end: 960 }];
  S().setProject({ startDate: '2024-01-09' });
  S().setCalendar({
    ...S().calendar, hoursPerDay: 8, workStartHour: 8, workEndHour: 16,
    workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
  } as WorkCalendar);
  const resourceId = S().addResource({ name: 'Design Engineer', type: 'LABOR', description: '', maxUnits: 1 });
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = S().addTask({
      name: `E-${1000 + i} met een gewone naam`,
      time: { ...createDefaultTaskTime('2024-01-09T08:00', 10, 'hours'), durationUnit: 'hours', durationMinutes: 80 * 60 },
    });
    S().assignResource(t, resourceId, 1);
    useAppStore.setState((st) => {
      st.tasks.find((x) => x.id === t)!.time.remainingMinutes = 80 * 60;
      st.assignments.find((a) => a.taskId === t)!.remainingWorkMinutes = 320 * 60;
    });
    ids.push(t);
  }
  S().runCPM();
  return ids;
}

type Compacted = {
  ok: boolean;
  envelope: { remainingWorkRecomputed?: { taskId: string; beforeHours: number; afterHours: number }[] };
  data: { compacted?: { shortened: Record<string, { total: number; omitted: number }> }; created?: Record<string, string>; steps?: { status: string; created?: Record<string, string>; data?: { created?: Record<string, string> } }[] };
  itemRejections?: { id: string; reason: string }[];
};

test('compact rapport: 230 restwerkcorrecties in één planner_update_tasks blijven binnen de grens, de eerste volledig', async () => {
  const ids = hourTasksWithRemainingWork(230);
  const app = install();
  const res = (await app.run('planner_update_tasks', {
    updates: ids.map((id) => ({ id, fields: { duration: 72, durationUnit: 'hours' } })),
  })) as Compacted;
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(useAppStore.getState().assignments.filter((a) => a.remainingWorkMinutes === 72 * 60).length, 230, 'alle 230 uitgevoerd');
  const kept = res.envelope.remainingWorkRecomputed ?? [];
  assert(kept.length > 0, 'de eerste correcties die passen staan erbij');
  assert(kept.every((c) => c.beforeHours === 320 && c.afterHours === 72), 'elke getoonde correctie is volledig');
  assertEq(res.data.compacted?.shortened['envelope.remainingWorkRecomputed'], { total: 230, omitted: 230 - kept.length }, 'totaal en aantal weggelaten');
});

test('compact rapport: 40 onbekende lange ids blijven binnen de grens, met het aantal weigeringen', async () => {
  freshDocument();
  const app = install();
  await app.run('planner_add_tasks', addTask('bestaat'));
  const res = (await app.run('planner_update_tasks', {
    updates: Array.from({ length: 40 }, (_, i) => ({ id: `onbekend-${i}-${'x'.repeat(1000)}`, fields: { name: 'n' } })),
  })) as Compacted;
  assertEq(res.ok, true, 'geslaagd (zachte weigeringen)');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assert(res.data.compacted, 'compact rapport');
  const kept = res.itemRejections?.length ?? 0;
  assert(kept > 0, 'de eerste weigeringen die passen staan erbij');
  assertEq(res.data.compacted?.shortened.itemRejections, { total: 40, omitted: 40 - kept }, 'totaal en aantal weggelaten');
  assert((res.itemRejections ?? []).every((r) => r.id.length > 1000), 'elke getoonde weigering is volledig');
});

test('compact rapport: 300 taken in één planner_add_tasks houden de volledige created-map binnen de grens', async () => {
  freshDocument();
  const app = install();
  const tasks = Array.from({ length: 300 }, (_, i) => ({ tempId: `tmp-t${i}`, name: `Taak ${i} met een lange naam zodat het antwoord flink groeit`, duration: 1 }));
  const res = (await app.run('planner_add_tasks', { tasks })) as Compacted;
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assert(res.data.compacted, 'het antwoord is compact');
  const created = res.data.created ?? {};
  assertEq(Object.keys(created).length, 300, 'de hele created-map');
  const names = new Map(useAppStore.getState().tasks.map((t) => [t.id, t.name]));
  for (let i = 0; i < 300; i++) assertEq(names.get(created[`tmp-t${i}`]), tasks[i].name, `tmp-t${i} wijst naar de juiste taak`);
  // De grens voor één id is gemeten, niet geschat: elk echt id blijft eronder.
  for (const id of Object.values(created)) {
    assert(JSON.stringify(id).length <= SITE_APP_REAL_ID_JSON_CHARS, `id ${id} langer dan ${SITE_APP_REAL_ID_JSON_CHARS} in JSON`);
  }
});

test('compact rapport: te veel nieuwe ids worden vóór uitvoering geweigerd, met het maximum, en dat maximum past', async () => {
  freshDocument();
  const app = install();
  const many = (prefix: string, n: number) => ({
    tasks: Array.from({ length: n }, (_, i) => ({ tempId: `tmp-${prefix}${i}`, name: `${prefix} ${i}`, duration: 1 })),
  });
  const batch = await failure(app, 'planner_batch', {
    steps: ['a', 'b', 'c', 'd'].map((prefix) => ({ tool: 'planner_add_tasks', args: many(prefix, 250) })),
  });
  assertEq(batch?.code, 'te_groot', `batch van 4 × 250: kreeg ${batch?.message ?? 'geen fout'}`);
  assert(batch!.message.includes('Nothing was changed'), 'zegt dat er niets veranderde');
  assertEq(useAppStore.getState().tasks.length, 0, 'de batch draaide niet');
  const max = Number(/at most (\d+) new items/.exec(batch!.message)?.[1]);
  assert(max >= 300, `maximum ${max} laat 300 toe`);
  // Het genoemde maximum moet echt passen, met de volledige maps, ook verdeeld over stappen.
  const half = Math.floor(max / 2);
  const ok = (await app.run('planner_batch', {
    steps: [{ tool: 'planner_add_tasks', args: many('a', half) }, { tool: 'planner_add_tasks', args: many('b', max - half) }],
  })) as Compacted;
  assertEq(ok.ok, true, 'het maximum is uitgevoerd');
  assert(fits(ok), `het maximum past (${JSON.stringify(ok).length} tekens)`);
  // Ingekort staat de map op de stap, onverkort in `data` van de stap.
  const mapOf = (st: { created?: object; data?: { created?: object } }) => st.created ?? st.data?.created ?? {};
  assertEq(ok.data.steps?.map((st) => Object.keys(mapOf(st)).length), [half, max - half], 'beide created-maps volledig');
  // Direct heeft een eigen, ruimer maximum (geen stapregels), berekend met de gemiddelde labellengte van die
  // aanroep: het genoemde maximum past.
  const big = await failure(app, 'planner_add_tasks', many('c', 1000));
  assertEq(big?.code, 'te_groot', 'direct 1000: geweigerd');
  const directMax = Number(/at most (\d+) new items/.exec(big!.message)?.[1]);
  assert(directMax >= max, `direct maximum ${directMax} ≥ batchmaximum ${max}`);
  const atMax = (await app.run('planner_add_tasks', many('c', directMax))) as Compacted;
  assert(fits(atMax), `het directe maximum past (${JSON.stringify(atMax).length} tekens)`);
  assertEq(Object.keys(atMax.data.created ?? {}).length, directMax, 'de volledige map');
});

test('compact rapport: de vaste ruimte past binnen de reserve van de echte aanroep (100 stappen, en één aanroep)', async () => {
  freshDocument();
  const app = install();
  await chain(app, 2);
  // 100 stappen zonder seqId: elke stap geeft een zachte weigering, samen te groot, dus een compact rapport.
  const tool = 'planner_update_dependencies';
  const res = (await app.run('planner_batch', {
    steps: Array.from({ length: 100 }, () => ({ tool, args: { updates: [{ fields: { lag: '1d' } }] } })),
  })) as Compacted & { data: { steps: unknown[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(res.data.compacted, 'compact rapport');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(res.data.steps.length, 100, 'een regel per stap');
  // De reserve dekt het geraamte: alles behalve de koppelingen en de vulling (velden die blijven, weigeringen).
  const reserve = SITE_APP_REPORT_BASE_CHARS + 100 * (SITE_APP_REPORT_STEP_CHARS + tool.length);
  const bare = (res.data.steps as { step: number; tool: string; status: string }[]).map(({ step, tool: t, status }) => ({ step, tool: t, status }));
  const { compacted, stepCount } = res.data as unknown as { compacted: unknown; stepCount: number };
  const fixed = JSON.stringify({ ok: res.ok, envelope: res.envelope, data: { compacted, stepCount, steps: bare } }).length;
  assert(fixed <= reserve, `vaste ruimte ${fixed} > reserve ${reserve}`);

  // Eén aanroep: alleen het vaste deel, zonder de created-map.
  const single = (await app.run('planner_add_tasks', {
    tasks: Array.from({ length: 300 }, (_, i) => ({ tempId: `tmp-s${i}`, name: `Taak ${i} met een lange naam zodat het antwoord flink groeit`, duration: 1 })),
  })) as Compacted;
  assert(single.data.compacted, 'compact rapport');
  const singleFixed = JSON.stringify({ ok: single.ok, envelope: single.envelope, data: { compacted: single.data.compacted, projectEnd: '2026-01-01T00:00' } }).length;
  assert(singleFixed <= SITE_APP_REPORT_BASE_CHARS, `vaste ruimte ${singleFixed} > ${SITE_APP_REPORT_BASE_CHARS}`);
});

test('voorcontrole: de reserve hoort bij de echte aanroep; 123 taken met tempIds van 114 tekens passen (review ronde 3)', async () => {
  freshDocument();
  const app = install();
  const tasks = Array.from({ length: 123 }, (_, i) => ({ tempId: `tmp-${String(i).padStart(3, '0')}-${'x'.repeat(106)}`, name: `T${i}`, duration: 1 }));
  assertEq(tasks[0].tempId.length, 114, 'tempId van 114 tekens');
  const res = (await app.run('planner_add_tasks', { tasks })) as Compacted;
  assertEq(res.ok, true, 'niet vooraf geweigerd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(Object.keys(res.data.created ?? {}).length, 123, 'alle 123 koppelingen');
});

/** Een nieuwe kalender in `planner_update_calendar`, met een vrij label als id. */
const newCalendar = (label: string) => ({ id: label, create: true, name: 'Ploegendienst' });

test('koppelingen: kalenders houden {requestedId, id} in een batch met een grote leesstap (review ronde 3)', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const res = (await app.run('planner_batch', {
    steps: [
      { tool: 'planner_update_calendar', args: { calendars: [newCalendar('gevraagde-a'), newCalendar('gevraagde-b')] } },
      { tool: 'planner_list_tasks', args: { limit: 200 } },
    ],
  })) as Compacted & { data: { steps: { status: string; data?: { calendars?: { requestedId: string; id: string }[] } }[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(res.data.compacted, 'compact rapport');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  const links = res.data.steps[0].data?.calendars ?? [];
  assertEq(links.map((l) => l.requestedId), ['gevraagde-a', 'gevraagde-b'], 'beide labels');
  const calendarIds = new Set(useAppStore.getState().calendars.map((c) => c.id));
  assert(links.every((l) => calendarIds.has(l.id)) && links[0].id !== links[1].id, 'twee verschillende echte kalenders');
});

test('koppelingen: veel nieuwe kalenders in één aanroep houden alle koppelingen, en te veel wordt vooraf geweigerd', async () => {
  freshDocument();
  const app = install();
  const before = useAppStore.getState().calendars.length;
  const res = (await app.run('planner_update_calendar', {
    calendars: Array.from({ length: 200 }, (_, i) => newCalendar(`kal-${i}`)),
  })) as Compacted & { data: { calendars?: { requestedId: string; id: string }[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(res.data.compacted, 'compact rapport');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq((res.data.calendars ?? []).map((l) => l.requestedId), Array.from({ length: 200 }, (_, i) => `kal-${i}`), 'alle 200 koppelingen');
  assertEq(useAppStore.getState().calendars.length, before + 200, '200 kalenders aangemaakt');

  const tooMany = await failure(app, 'planner_update_calendar', {
    calendars: Array.from({ length: 300 }, (_, i) => newCalendar(`kalender-met-een-lang-label-${i}-${'y'.repeat(40)}`)),
  });
  assertEq(tooMany?.code, 'te_groot', `kreeg ${tooMany?.message ?? 'geen fout'}`);
  assert(tooMany!.message.includes('Nothing was changed'), 'niets veranderd');
  assertEq(useAppStore.getState().calendars.length, before + 200, 'geen kalender bij');
});

test('foutpad: een CYCLE in een batch met 700 taken blijft binnen de grens, met code, terugrol en stapstatussen', async () => {
  freshDocument();
  const app = install();
  const ids = await chain(app, 700);
  const firstName = useAppStore.getState().tasks.find((t) => t.id === ids[0])!.name;
  const fail = await failure(app, 'planner_batch', {
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id: ids[0], fields: { name: 'Nieuwe naam' } }] } },
      { tool: 'planner_add_dependencies', args: { dependencies: [{ predecessorId: ids[699], successorId: ids[0], type: 'FS' }] } },
    ],
  });
  assertEq(fail?.code, 'CYCLE', `code, kreeg ${fail?.message.slice(0, 200) ?? 'geen fout'}`);
  assert(fail!.message.length <= SITE_APP_MAX_ERROR_CHARS, `melding past (${fail!.message.length} tekens)`);
  assert(fail!.message.includes('items in total'), 'de kring is samengevat met een aantal');
  assert(fail!.message.includes('1. planner_update_tasks — executed (rolled back)'), 'status van stap 1');
  assert(fail!.message.includes('2. planner_add_dependencies — failed'), 'status van stap 2');
  assert(fail!.message.includes('everything rolled back'), 'de terugrolmelding');
  assertEq(useAppStore.getState().tasks.find((t) => t.id === ids[0])!.name, firstName, 'de naam is teruggerold');
  assertEq(useAppStore.getState().sequences.length, 699, 'alle 699 relaties blijven');
});

/** Een bestaande taak met een toewijzing, en een bestaande mijlpaal. Geeft hun id's. */
async function phaseSetup(app: SiteAppTools): Promise<{ withAssignment: string; milestone: string; resource: string }> {
  const S = () => useAppStore.getState();
  await app.run('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-bestaand', name: 'Bestaand werk', duration: 5 }, { tempId: 'tmp-mijlpaal', name: 'Mijlpaal', isMilestone: true }],
  });
  const withAssignment = S().tasks.find((t) => t.name === 'Bestaand werk')!.id;
  const milestone = S().tasks.find((t) => t.name === 'Mijlpaal')!.id;
  const res = (await app.run('planner_manage_resources', { actions: [{ action: 'create', tempId: 'tmp-ploeg', name: 'Ploeg', type: 'LABOR', maxUnits: 2 }] })) as { data: { created: Record<string, string> } };
  const resource = res.data.created['tmp-ploeg'];
  await app.run('planner_manage_assignments', { actions: [{ action: 'add', taskId: withAssignment, resourceId: resource, unitsPerDay: 1 }] });
  return { withAssignment, milestone, resource };
}

/** De gewone batch uit de review van ronde 4: tien stappen, `n` nieuwe taken, de eerste twee als kind van een bestaande
 *  taak (die daardoor een fase wordt), relaties, toewijzingen, en tot slot de uitkomst lezen. */
function tenStepBatch(n: number, parents: { withAssignment: string; milestone: string; resource: string }, readLimit = 50) {
  const tasks = Array.from({ length: n }, (_, i) => ({
    tempId: `tmp-n${i}`,
    name: `Nieuwe taak ${i}`,
    duration: 2,
    ...(i === 0 ? { parentId: parents.withAssignment } : i === 1 ? { parentId: parents.milestone } : {}),
  }));
  const chainDeps = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => ({
    predecessorId: `tmp-n${from + k}`, successorId: `tmp-n${from + k + 1}`, type: 'FS',
  }));
  const half = Math.floor(n / 2);
  return {
    steps: [
      { tool: 'planner_add_tasks', args: { tasks } },
      { tool: 'planner_add_dependencies', args: { dependencies: chainDeps(2, half) } },
      { tool: 'planner_add_dependencies', args: { dependencies: chainDeps(half, n - 1) } },
      { tool: 'planner_manage_assignments', args: { actions: [{ action: 'add', taskId: 'tmp-n2', resourceId: parents.resource, unitsPerDay: 1 }] } },
      { tool: 'planner_manage_assignments', args: { actions: [{ action: 'add', taskId: 'tmp-n3', resourceId: parents.resource, unitsPerDay: 1 }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: 'tmp-n4', fields: { duration: 3 } }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: 'tmp-n5', fields: { name: 'Hernoemd' } }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: 'tmp-n6', fields: { duration: 4 } }] } },
      { tool: 'planner_get_critical_path', args: {} },
      { tool: 'planner_list_tasks', args: { limit: readLimit } },
    ],
  };
}

type PhaseReport = { phaseId: string; phaseName: string; milestoneCleared: boolean; assignmentsMovedTo?: { taskId: string; resourceIds: string[] } };

function assertPhaseTransitions(list: PhaseReport[] | undefined, parents: { withAssignment: string; milestone: string; resource: string }, label: string) {
  const S = () => useAppStore.getState();
  const byPhase = new Map((list ?? []).map((t) => [t.phaseId, t]));
  const moved = byPhase.get(parents.withAssignment);
  assert(moved, `${label}: de overgang van de taak met toewijzing ontbreekt`);
  const target = S().tasks.find((t) => t.name === 'Nieuwe taak 0')!.id;
  assertEq(moved!.assignmentsMovedTo?.taskId, target, `${label}: doel van de verplaatsing`);
  assertEq(moved!.assignmentsMovedTo?.resourceIds, [parents.resource], `${label}: aantal en welke toewijzingen`);
  assertEq(moved!.milestoneCleared, false, `${label}: geen mijlpaal`);
  assertEq(byPhase.get(parents.milestone)?.milestoneCleared, true, `${label}: de mijlpaalvlag van de mijlpaal`);
}

test('faseovergang: een gewone batch van tien stappen met 20 taken past volledig en meldt de overgangen (review ronde 4)', async () => {
  freshDocument();
  const app = install();
  const parents = await phaseSetup(app);
  const res = (await app.run('planner_batch', tenStepBatch(20, parents))) as { ok: boolean; data: { compacted?: unknown; substeps?: unknown; steps: { status: string; data?: { phaseTransitions?: PhaseReport[] } }[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(res.data.compacted, undefined, 'niet ingekort');
  assertEq(res.data.substeps, undefined, 'het activiteitenlog is eraf');
  assert(res.data.steps.every((st) => st.status === 'uitgevoerd'), 'alle stappen uitgevoerd');
  assertPhaseTransitions(res.data.steps[0].data?.phaseTransitions, parents, '20 taken');
});

test('faseovergang: dezelfde batch met 40 taken past zonder inkorten', async () => {
  freshDocument();
  const app = install();
  const parents = await phaseSetup(app);
  const res = (await app.run('planner_batch', tenStepBatch(40, parents))) as { ok: boolean; data: { compacted?: unknown; steps: { data?: { phaseTransitions?: PhaseReport[] } }[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(res.data.compacted, undefined, 'niet ingekort');
  assertPhaseTransitions(res.data.steps[0].data?.phaseTransitions, parents, '40 taken');
});

test('faseovergang: ook een ingekort antwoord houdt fase, doel, toewijzingen en mijlpaalvlag', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const parents = await phaseSetup(app);
  const res = (await app.run('planner_batch', tenStepBatch(20, parents, 200))) as { ok: boolean; data: { compacted?: unknown; steps: { data?: { phaseTransitions?: PhaseReport[]; created?: Record<string, string> } }[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(res.data.compacted, 'ingekort');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(Object.keys(res.data.steps[0].data?.created ?? {}).length, 20, 'de created-map blijft');
  assertPhaseTransitions(res.data.steps[0].data?.phaseTransitions, parents, 'ingekort');
});

/** Per aanmaaktool: echte invoer (labels) en de bewaarde uitvoer (label → id), en hoe je het juiste item vindt. */
const LINK_CASES: {
  tool: string;
  args: (labels: string[]) => Record<string, unknown>;
  links: (data: Record<string, any>) => [string, string][];
  nameOf: (id: string) => string | undefined;
}[] = [
  {
    tool: 'planner_add_tasks',
    args: (labels) => ({ tasks: labels.map((l) => ({ tempId: l, name: `naam ${l}`, duration: 1 })) }),
    links: (data) => Object.entries(data.created ?? {}) as [string, string][],
    nameOf: (id) => useAppStore.getState().tasks.find((t) => t.id === id)?.name,
  },
  {
    tool: 'planner_manage_resources',
    args: (labels) => ({ actions: labels.map((l) => ({ action: 'create', tempId: l, name: `naam ${l}`, type: 'LABOR', maxUnits: 1 })) }),
    links: (data) => Object.entries(data.created ?? {}) as [string, string][],
    nameOf: (id) => useAppStore.getState().resources.find((r) => r.id === id)?.name,
  },
  {
    tool: 'planner_update_calendar',
    args: (labels) => ({ calendars: labels.map((l) => ({ id: l, create: true, name: `naam ${l}` })) }),
    links: (data) => ((data.calendars ?? []) as { requestedId: string; id: string }[]).map((c) => [c.requestedId, c.id]),
    nameOf: (id) => useAppStore.getState().calendars.find((c) => c.id === id)?.name,
  },
];

test('koppelingen per aanmaaktool: echte invoer en bewaarde uitvoer, direct en in een batch, ingekort', async () => {
  assertEq(LINK_CASES.map((c) => c.tool).sort(), Object.keys(SITE_APP_ID_LINK_TOOLS).sort(), 'een geval per tool in SITE_APP_ID_LINK_TOOLS');
  for (const c of LINK_CASES) {
    // Direct: zoveel items dat het antwoord ingekort wordt.
    freshDocument();
    let app = install();
    const many = Array.from({ length: 300 }, (_, i) => `tmp-l${i}`);
    const direct = (await app.run(c.tool, c.args(many))) as { data: Record<string, any> };
    assert(direct.data.compacted, `${c.tool} direct: ingekort`);
    assert(fits(direct), `${c.tool} direct: past`);
    const directLinks = c.links(direct.data);
    assertEq(directLinks.map(([label]) => label).sort(), [...many].sort(), `${c.tool} direct: elk label`);
    for (const [label, id] of directLinks) assertEq(c.nameOf(id), `naam ${label}`, `${c.tool} direct: ${label} wijst naar het juiste item`);

    // In een batch, naast een grote leesstap.
    freshDocument();
    app = install();
    await chain(app, 200);
    const few = ['tmp-x1', 'tmp-x2'];
    const batch = (await app.run('planner_batch', {
      steps: [{ tool: c.tool, args: c.args(few) }, { tool: 'planner_list_tasks', args: { limit: 200 } }],
    })) as { data: { compacted?: unknown; steps: Record<string, any>[] } };
    assert(batch.data.compacted, `${c.tool} batch: ingekort`);
    const batchLinks = c.links(batch.data.steps[0].data);
    assertEq(batchLinks.map(([label]) => label).sort(), few, `${c.tool} batch: elk label`);
    for (const [label, id] of batchLinks) assertEq(c.nameOf(id), `naam ${label}`, `${c.tool} batch: ${label} wijst naar het juiste item`);

    // De controle vooraf telt de labels van deze tool mee.
    const tooMany = await failure(app, c.tool, c.args(Array.from({ length: 900 }, (_, i) => `tmp-te-veel-${i}`)));
    assertEq(tooMany?.code, 'te_groot', `${c.tool}: te veel labels vooraf geweigerd`);
  }
});

test('foutpad: ook een JSON-RPC-fout blijft binnen de grens en houdt zijn code', async () => {
  const fail = await failure(install(), `planner_${'x'.repeat(60_000)}`);
  assertEq(fail?.code, 'JSONRPC_-32602', 'code');
  assert(fail!.message.length <= SITE_APP_MAX_ERROR_CHARS, `melding past (${fail!.message.length} tekens)`);
  assert(fail!.message.startsWith('JSONRPC_-32602: Unknown tool: planner_xxx'), 'begin van de melding');
});

test('wijzigingsantwoord: niets valt weg, ook becameLiteral en clearedLagMinutes niet (review ronde 5)', async () => {
  freshDocument();
  const app = install();
  const ids = await chain(app, 80);
  const S = () => useAppStore.getState();
  // Een gegenereerde kalender (een nieuwe kalender krijgt de NL-feestdagen met hun herkomst mee).
  const created = (await app.run('planner_update_calendar', { calendars: [{ id: 'tmp-ploeg', create: true, name: 'Ploeg' }] })) as { data: { calendars: { id: string }[] } };
  const calendarId = created.data.calendars[0].id;
  assert(S().calendars.find((c) => c.id === calendarId)?.generation, 'voorwaarde: de kalender is gegenereerd');
  // Een relatie zoals na een import: 0 dagen én 90 minuten lag.
  const seq = S().sequences[0];
  useAppStore.setState((st) => {
    const target = st.sequences.find((x) => x.id === seq.id)!;
    target.lagDays = 0;
    target.lagMinutes = 90;
  });
  const res = (await app.run('planner_batch', {
    steps: [
      { tool: 'planner_update_calendar', args: { calendars: [{ id: calendarId, rawHolidays: [{ name: 'Sluiting', startDate: '2026-02-10', endDate: '2026-02-10' }] }] } },
      { tool: 'planner_update_dependencies', args: { updates: [{ seqId: seq.id, lag: '0d' }] } },
      { tool: 'planner_get_critical_path', args: {} },
      { tool: 'planner_list_tasks', args: { limit: 80 } },
    ],
  })) as { ok: boolean; data: { compacted?: { note: string }; steps: { status: string; readOutputOmitted?: boolean; data?: Record<string, any> }[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(res.data.compacted, 'ingekort');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  const [calendar, dependency, path, list] = res.data.steps;
  assertEq(calendar.data?.calendars?.[0]?.becameLiteral, true, 'becameLiteral blijft');
  assertEq(calendar.data?.calendars?.[0]?.id, calendarId, 'de kalenderregel blijft');
  assertEq(dependency.data?.updated?.[0]?.changes?.lag?.clearedLagMinutes, 90, 'clearedLagMinutes blijft');
  assertEq(dependency.data?.updated?.[0]?.id, seq.id, 'de relatieregel blijft');
  assertEq([path.readOutputOmitted, list.readOutputOmitted], [true, true], 'de leesuitvoer valt weg');
  assert(res.data.compacted!.note.includes('call such a step on its own'), 'met hoe je hem opvraagt');
  assert(!S().calendars.find((c) => c.id === calendarId)?.generation, 'de kalender is echt letterlijk geworden');
  void ids;
});

test('wijzigingsantwoord: planner_level_resources({dryRun: true}) in een batch, ingekort gelijk aan onverkort', async () => {
  freshDocument();
  const app = install();
  await chain(app, 200);
  const S = () => useAppStore.getState();
  const res = (await app.run('planner_manage_resources', { actions: [{ action: 'create', tempId: 'tmp-kraan', name: 'Kraan', type: 'LABOR', maxUnits: 1 }] })) as { data: { created: Record<string, string> } };
  const kraan = res.data.created['tmp-kraan'];
  const ids = S().tasks.map((t) => t.id);
  // Twee parallelle taken op één kraan: overbelast, dus nivelleren heeft iets te zeggen (delayMinutes, gaps).
  await app.run('planner_add_tasks', { tasks: [{ tempId: 'tmp-p1', name: 'Parallel 1', duration: 3 }, { tempId: 'tmp-p2', name: 'Parallel 2', duration: 3 }] });
  const [p1, p2] = S().tasks.filter((t) => t.name.startsWith('Parallel')).map((t) => t.id);
  await app.run('planner_manage_assignments', { actions: [p1, p2, ids[0]].map((taskId) => ({ action: 'add', taskId, resourceId: kraan, unitsPerDay: 1 })) });
  // Dezelfde batch twee keer: met een kleine leesstap (past onverkort) en met een grote (wordt ingekort).
  const run = (limit: number) => app.run('planner_batch', {
    steps: [{ tool: 'planner_level_resources', args: { dryRun: true } }, { tool: 'planner_list_tasks', args: { limit } }],
  }) as Promise<{ ok: boolean; data: { compacted?: unknown; steps: { data?: Record<string, unknown>; readOutputOmitted?: boolean }[] } }>;
  const whole = await run(2);
  assertEq(whole.data.compacted, undefined, 'met een kleine leesstap niet ingekort');
  const batch = await run(200);
  assertEq(batch.ok, true, 'geslaagd');
  assert(batch.data.compacted, 'ingekort');
  assert(fits(batch), 'past');
  assertEq(batch.data.steps[1].readOutputOmitted, true, 'de leesuitvoer valt weg');
  const alone = whole.data.steps[0].data ?? {};
  const inBatch = batch.data.steps[0].data ?? {};
  assert('delayMinutes' in inBatch && 'gaps' in inBatch, 'delayMinutes en gaps staan erin (review ronde 5, VERVOLG 2)');
  assertEq(inBatch, alone, 'de nivelleeruitvoer is volledig, veld voor veld');
});

await run();
