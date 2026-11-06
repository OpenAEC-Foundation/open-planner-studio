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
  SITE_APP_REPORT_RESERVE_CHARS,
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
  assertEq((await app.run('planner_add_tasks', { tasks }) as { ok: boolean }).ok, true, 'taken toegevoegd');
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
    ok: boolean; data: { compacted?: { note: string }; steps: { status: string; data?: unknown; omitted?: string }[]; substeps?: unknown };
  };
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assert(res.data.compacted?.note.includes('shortened'), 'meldt dat het ingekort is');
  assertEq(res.data.substeps, undefined, 'substeps weg');
  assertEq(res.data.steps[0].status, 'uitgevoerd', 'status van de stap blijft');
  assertEq(res.data.steps[0].data, undefined, 'de leesuitvoer is weg');
  assertEq(res.data.steps[0].omitted, 'read output', 'zegt dat de leesuitvoer weg is');
  assert(JSON.stringify(res.data.compacted).includes('call a read step on its own'), 'zegt hoe je hem volledig opvraagt');
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
  })) as { ok: boolean; data: { steps: { status: string; created?: Record<string, string>; omitted?: string }[] } };
  assertEq(res.ok, true, 'de batch is geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(useAppStore.getState().tasks.length, before + 1, 'de wijziging is uitgevoerd');
  assertEq(res.data.steps.map((st) => st.status), ['uitgevoerd', 'uitgevoerd'], 'status per stap');
  assert(typeof res.data.steps[0].created?.['tmp-extra'] === 'string', 'de created-map van de wijziging blijft');
  assertEq(res.data.steps[1].omitted, 'read output', 'de leesuitvoer is weg');
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
  envelope: { remainingWorkRecomputed?: unknown[]; remainingWorkRecomputedSummary?: { count: number; tasks: number; beforeHours: number; afterHours: number } };
  data: { compacted?: { counts: Record<string, number> }; created?: Record<string, string>; steps?: { status: string; created?: Record<string, string> }[] };
  itemRejections?: { id: string; reason: string }[];
};

test('compact rapport: 230 restwerkcorrecties in één planner_update_tasks blijven binnen de grens, met samenvatting', async () => {
  const ids = hourTasksWithRemainingWork(230);
  const app = install();
  const res = (await app.run('planner_update_tasks', {
    updates: ids.map((id) => ({ id, fields: { duration: 72, durationUnit: 'hours' } })),
  })) as Compacted;
  assertEq(res.ok, true, 'geslaagd');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(useAppStore.getState().assignments.filter((a) => a.remainingWorkMinutes === 72 * 60).length, 230, 'alle 230 uitgevoerd');
  assertEq(res.envelope.remainingWorkRecomputedSummary, { count: 230, tasks: 230, beforeHours: 230 * 320, afterHours: 230 * 72 }, 'samenvatting');
  assert((res.envelope.remainingWorkRecomputed?.length ?? 0) > 0, 'de eerste correcties die passen staan erbij');
  assertEq(res.data.compacted?.counts.remainingWorkRecomputed, 230, 'aantal in counts');
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
  assertEq(res.data.compacted?.counts.itemRejections, 40, 'aantal weigeringen');
  assert((res.itemRejections?.length ?? 0) > 0, 'de eerste weigeringen die passen staan erbij');
  assert((res.itemRejections ?? []).every((r) => r.id.length <= 81 && r.reason.length <= 201), 'weigeringen ingekort per regel');
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
  assertEq(ok.data.steps?.map((st) => Object.keys(st.created ?? {}).length), [half, max - half], 'beide created-maps volledig');
  const direct = await failure(app, 'planner_add_tasks', many('c', max + 1));
  assertEq(direct?.code, 'te_groot', 'één meer dan het maximum, direct: geweigerd');
});

test('compact rapport: de vaste ruimte voor 100 stappen met een lange toolnaam past binnen de reserve', async () => {
  freshDocument();
  const app = install();
  await chain(app, 2);
  // 100 stappen zonder seqId: elke stap geeft een zachte weigering, samen te groot, dus een compact rapport.
  const res = (await app.run('planner_batch', {
    steps: Array.from({ length: 100 }, () => ({ tool: 'planner_update_dependencies', args: { updates: [{ fields: { lag: '1d' } }] } })),
  })) as Compacted & { data: { steps: unknown[] } };
  assertEq(res.ok, true, 'geslaagd');
  assert(res.data.compacted, 'compact rapport');
  assert(fits(res), `past (${JSON.stringify(res).length} tekens)`);
  assertEq(res.data.steps.length, 100, 'een regel per stap');
  // De reserve dekt alles behalve de created-maps en de aanvullingen (weigeringen, restwerkregels).
  const fixed = JSON.stringify({ ...res, itemRejections: undefined }).length;
  assert(fixed <= SITE_APP_REPORT_RESERVE_CHARS, `vaste ruimte ${fixed} > reserve ${SITE_APP_REPORT_RESERVE_CHARS}`);
});

await run();
