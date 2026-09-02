// SYNC-2 — de INTEGRATIEdraden tussen de tool-banen. Elke baan testte zijn eigen module; dit bestand
// test uitsluitend wat pas ontstaat als ze samen in één binary zitten:
//
//   A. het T16-backupcontract slaat duplicate-born documenten aantoonbaar over;
//   B. elke batchbare mutatietool draagt een synchrone `batchStep`-kern, en een draaiboek met
//      add_tasks → add_dependencies → update_calendar → update_project loopt end-to-end (spec-usecase 1);
//   C. de registratie draait op een PRODUCTIEpad, niet alleen in tests;
//   D. de toolstelling: het aantal, de `planner_`-prefix, een niet-lege description en alle vier de
//      MCP-annotaties op élke tool.

// --- localStorage-shim (vóór elke @/-import; server.ts sleept settingsStore mee) ------------------
const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { getTool, getTools } from '@/services/mcp/toolRegistry';
import { handleMcpMessage } from '@/services/mcp/dispatcher';
import { createBackupService } from '@/services/mcp/backup';
// Het IMPORTEREN van server.ts draait `initMcpRuntime()` — precies het productiepad dat draad A en C
// leggen. Niets uit deze import wordt hier aangeroepen; de side-effect ÍS wat we testen.
import { initMcpRuntime } from '@/services/mcp/server';
import type { McpContext, McpToolDef, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import type { BatchStepTool } from '@/services/mcp/tools/batchTool';

const S = () => useAppStore.getState();

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    ...over,
  });
}

// =================================================================================================
// D. Toolstelling — het contract dat de AI te zien krijgt
// =================================================================================================

/**
 * De VERWACHTE toolstelling, per baan uitgesplitst. Dit getal is met opzet hard: raakt een baan een
 * tool kwijt (of registreert iemand een module dubbel), dan valt deze test om in plaats van dat
 * `tools/list` stilletjes verschuift.
 */
const EXPECTED_TOOLS = {
  read: 11,          // T18/T18b + retained XER-provenance — leestools
  taskMutate: 6,     // T19 — add/update/delete_tasks, move_task, add/remove_dependencies
  dependency: 1,     // dependencyTools — update_dependencies (bestaande relatie wijzigen)
  taskOther: 3,      // T19 — undo, redo, run_cpm
  calResMutate: 7,   // T20 — update_calendar, manage_assignments, level_resources, clear_leveling,
                     //        update_project, move_project, save_baseline
  resource: 1,       // resourcebeheer — manage_resources
  baseline: 4,       // baselineTools — list/activate/rename/delete_baseline (beheer náást save_baseline)
  document: 4,       // T21 — list/new/switch/duplicate_document
  file: 2,           // T21 — export_ifc, import_schedule
  batch: 1,          // T22 — planner_batch
};
const EXPECTED_TOTAL = Object.values(EXPECTED_TOOLS).reduce((a, b) => a + b, 0); // = 40

test('tools/list levert exact de verwachte toolstelling (40) via de dispatcher', async () => {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    makeCtx(),
  );
  const resp = JSON.parse(raw);
  assert(resp.result !== undefined, `tools/list gaf een fout terug: ${raw.slice(0, 300)}`);
  const tools = resp.result.tools as { name: string; description?: string; annotations?: unknown }[];
  assertEq(tools.length, EXPECTED_TOTAL, `tools/list moet ${EXPECTED_TOTAL} tools tellen`);
  // De dispatcher put uit dezelfde registry; als die twee uiteenlopen klopt er iets fundamenteels niet.
  assertEq(getTools().length, EXPECTED_TOTAL, 'de registry telt hetzelfde aantal als tools/list');
});

test('élke tool draagt planner_-prefix, een niet-lege description en alle VIER de annotaties', async () => {
  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    makeCtx(),
  );
  const tools = JSON.parse(raw).result.tools as {
    name: string;
    description?: string;
    annotations?: Record<string, unknown>;
  }[];
  const ANNOT = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];
  for (const t of tools) {
    assert(t.name.startsWith('planner_'), `tool '${t.name}' mist de planner_-prefix`);
    assert(
      typeof t.description === 'string' && t.description.trim() !== '',
      `tool '${t.name}' heeft een lege description (de AI kiest tools op beschrijving)`,
    );
    for (const key of ANNOT) {
      assert(
        t.annotations !== undefined && typeof t.annotations[key] === 'boolean',
        `tool '${t.name}' mist de annotatie '${key}'`,
      );
    }
  }
});

test('geen dubbele toolnamen over de zes modules heen', async () => {
  const names = getTools().map((t) => t.name);
  assertEq(new Set(names).size, names.length, 'alle toolnamen zijn uniek');
});

// Reviewbevinding (2026-08-15, ná het eigenaarsbesluit over verzameltaakrelaties): de tool-
// descriptions van add_dependencies/update_dependencies beweerden nog dat een verzameltaak-eindpunt
// zacht geweigerd wordt — dat is sinds `expandSummaryRelations` niet meer waar (zo'n relatie rekent
// mee), alleen de voorouder-relatie wordt nog geweigerd. Een agent die op de description afgaat mag
// niet aannemen dat een verzameltaak-eindpunt sowieso mislukt.
test('add_dependencies/update_dependencies-descriptions beloven de HUIDIGE weigering, niet de oude', async () => {
  for (const name of ['planner_add_dependencies', 'planner_update_dependencies']) {
    const def = getTool(name);
    assert(def !== undefined, `tool '${name}' ontbreekt in de registry`);
    const desc = def!.description ?? '';
    assert(
      /voorouder/i.test(desc),
      `'${name}': description noemt de voorouder-weigering niet: ${desc}`,
    );
    assert(
      /verzameltaak.{0,80}TOEGESTAAN|TOEGESTAAN.{0,80}verzameltaak/i.test(desc),
      `'${name}': description zegt niet expliciet dat een verzameltaak-eindpunt is toegestaan: ${desc}`,
    );
    // De oude, nu onjuiste claim ("verzameltaak ... wordt/is ... geweigerd") mag niet meer voorkomen.
    assert(
      !/verzameltaak[^.]{0,80}geweigerd/i.test(desc),
      `'${name}': description belooft nog steeds dat een verzameltaak-eindpunt geweigerd wordt: ${desc}`,
    );
  }
});

// =================================================================================================
// C. Registratie draait op een PRODUCTIEpad
// =================================================================================================

test('initMcpRuntime is idempotent en herstelt een afgeknotte registratie', async () => {
  const before = getTools().length;
  initMcpRuntime();
  assertEq(getTools().length, before, 'een tweede aanroep verandert de registratie niet');
  assert(getTool('planner_batch') !== undefined, 'planner_batch is opzoekbaar na de init');
});

// =================================================================================================
// A. Het T16-backupcontract werkt gedragsmatig
// =================================================================================================

test('een duplicate-born document slaat de auto-backup over', async () => {
  // Bewijst het EFFECT waar de naad voor bestaat, op een eigen service-instantie (de echte
  // module-singleton schrijft naar de Tauri-fs, die hier niet bestaat).
  let writes = 0;
  const svc = createBackupService({
    getFs: async () => ({
      appDataDir: async () => '/app',
      join: async (...p: string[]) => p.join('/'),
      mkdir: async () => {},
      writeTextFile: async () => { writes += 1; },
      readDir: async () => [],
      remove: async () => {},
    }),
    getDoc: () => ({ projectName: 'Test', ifc: 'ISO-10303-21;' }),
    activeDocId: () => 'doc-dup',
    autoBackupEnabled: async () => true,
    now: () => 1_700_000_000_000,
  });

  await svc.ensureBackup('doc-normaal', 'mutate');
  assertEq(writes, 1, 'een gewoon document krijgt wél een auto-backup');

  svc.markDuplicateBorn('doc-dup');
  await svc.ensureBackup('doc-dup', 'mutate');
  assertEq(writes, 1, 'een duplicate-born document krijgt GEEN extra auto-backup');
});

// =================================================================================================
// B. batchStep-kernen
// =================================================================================================

/** Tools die per spec §Compositie nooit een batch-stap zijn en dus geen kern hoeven te hebben. */
const NO_CORE_EXPECTED = new Set([
  'planner_save_baseline',   // batchable: false — een baseline hoort een losse, bewuste nulmeting te zijn
  'planner_undo', 'planner_redo', 'planner_run_cpm',
  'planner_export_ifc', 'planner_import_schedule',
  'planner_new_document', 'planner_switch_document', 'planner_duplicate_document', 'planner_list_documents',
  'planner_batch',
]);

test('élke batchbare mutatietool draagt een synchrone batchStep-kern', async () => {
  const missing: string[] = [];
  for (const def of getTools() as BatchStepTool[]) {
    if (def.kind === 'read' || NO_CORE_EXPECTED.has(def.name)) continue;
    if ((def as McpToolDef & { batchable?: boolean }).batchable === false) continue;
    if (typeof def.batchStep !== 'function') missing.push(def.name);
  }
  assertEq(missing, [], `deze batchbare mutatietools missen een batchStep-kern: ${missing.join(', ')}`);
});

test('save_baseline heeft bewust GEEN kern (batchable: false)', async () => {
  const def = getTool('planner_save_baseline') as BatchStepTool;
  assert(def !== undefined, 'planner_save_baseline is geregistreerd');
  assertEq((def as McpToolDef & { batchable?: boolean }).batchable, false, 'save_baseline is niet batchbaar');
  assertEq(def.batchStep, undefined, 'save_baseline draagt bewust geen batchStep-kern');
});

test('spec-usecase 1: bestek → planning in ÉÉN batch (tasks + relaties + kalender + project)', async () => {
  S().newProject();
  const ctx = makeCtx();
  const before = S().tasks.length;

  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: {
          steps: [
            { tool: 'planner_update_project', args: { name: 'Bestek A', startDate: '2026-03-02' } },
            {
              tool: 'planner_update_calendar',
              args: { calendars: [{ id: 'cal-bouw', create: true, name: 'Bouwkalender', hoursPerDay: 8 }] },
            },
            {
              tool: 'planner_add_tasks',
              args: {
                tasks: [
                  { tempId: 'tmp-fundering', name: 'Fundering', duration: 10 },
                  { tempId: 'tmp-ruwbouw', name: 'Ruwbouw', duration: 20 },
                ],
              },
            },
            {
              tool: 'planner_add_dependencies',
              args: {
                dependencies: [
                  { predecessorId: 'tmp-fundering', successorId: 'tmp-ruwbouw', type: 'FINISH_START' },
                ],
              },
            },
          ],
        },
      },
    }),
    ctx,
  );

  const resp = JSON.parse(raw);
  assert(resp.result !== undefined, `de batch faalde: ${raw.slice(0, 600)}`);
  const payload = JSON.parse(resp.result.content[0].text) as McpToolResult;
  assert(payload.ok === true, `de batch gaf een fout terug: ${raw.slice(0, 600)}`);
  const data = (payload as McpToolOk).data as { stepCount: number; steps: { status: string }[] };
  assertEq(data.stepCount, 4, 'alle vier de stappen zijn ingezonden');
  assertEq(
    data.steps.map((s) => s.status),
    ['uitgevoerd', 'uitgevoerd', 'uitgevoerd', 'uitgevoerd'],
    'alle vier de stappen zijn uitgevoerd',
  );

  // De echte bewijslast: de store draagt het resultaat van álle vier de banen.
  assertEq(S().project.name, 'Bestek A', 'update_project (baan f2) landde');
  assert(S().calendars.some((c) => c.name === 'Bouwkalender'), 'update_calendar (baan f2) landde');
  assertEq(S().tasks.length, before + 2, 'add_tasks (baan f2) landde');
  assertEq(S().sequences.length, 1, 'add_dependencies (baan f2) landde');
  // tempId-resolutie over stapgrenzen heen (baan f4) — de relatie wijst naar de ECHTE id's.
  const fundering = S().tasks.find((t) => t.name === 'Fundering')!;
  const ruwbouw = S().tasks.find((t) => t.name === 'Ruwbouw')!;
  assertEq(S().sequences[0].predecessorId, fundering.id, 'de tempId van de voorganger is opgelost');
  assertEq(S().sequences[0].successorId, ruwbouw.id, 'de tempId van de opvolger is opgelost');
  // Eén batch = één undo-stap (WP0-invariant).
  assert(S().historyEvents.filter(event => event.state === 'applied').length >= 1, 'de batch pushte een undo-snapshot');
});

test('de OVERIGE batchStep-kernen draaien echt als stap (niet alleen aanwezig)', async () => {
  // De coverage-test hierboven bewijst dat de kernen BESTAAN; usecase 1 draait er vier. Deze test
  // draait de overige acht, zodat een verkeerd uitgetilde kern niet stil blijft zitten.
  S().newProject();
  const ctx = makeCtx();

  // Voorbereiding buiten de batch: twee taken, een relatie en een resource om mee te werken.
  const prep = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 20, method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: {
          steps: [
            { tool: 'planner_update_project', args: { startDate: '2026-03-02' } },
            {
              tool: 'planner_add_tasks',
              args: {
                tasks: [
                  { tempId: 'tmp-a', name: 'Taak A', duration: 5 },
                  { tempId: 'tmp-b', name: 'Taak B', duration: 5 },
                  { tempId: 'tmp-ouder', name: 'Fase', duration: 1 },
                ],
              },
            },
            {
              tool: 'planner_add_dependencies',
              args: { dependencies: [{ predecessorId: 'tmp-a', successorId: 'tmp-b', type: 'FINISH_START' }] },
            },
          ],
        },
      },
    }),
    ctx,
  );
  assert(
    (JSON.parse(JSON.parse(prep).result.content[0].text) as McpToolResult).ok === true,
    'de voorbereidende batch slaagde',
  );

  const taskA = S().tasks.find((t) => t.name === 'Taak A')!;
  const taskB = S().tasks.find((t) => t.name === 'Taak B')!;
  const fase = S().tasks.find((t) => t.name === 'Fase')!;
  const seqId = S().sequences[0].id;
  const resourceId = S().resources[0]?.id;

  const steps: { tool: string; args: unknown }[] = [
    { tool: 'planner_update_tasks', args: { updates: [{ id: taskA.id, fields: { name: 'Taak A (herzien)' } }] } },
    { tool: 'planner_move_task', args: { id: taskB.id, newParentId: fase.id } },
    { tool: 'planner_remove_dependencies', args: { ids: [seqId] } },
    { tool: 'planner_clear_leveling', args: {} },
    { tool: 'planner_level_resources', args: { constrainToFloat: true } },
    { tool: 'planner_move_project', args: { newStartDate: '2026-04-01' } },
    { tool: 'planner_delete_tasks', args: { ids: [taskA.id] } },
  ];
  if (resourceId) {
    steps.splice(3, 0, {
      tool: 'planner_manage_assignments',
      args: { actions: [{ action: 'add', taskId: taskB.id, resourceId, unitsPerDay: 1 }] },
    });
  }

  const raw = await handleMcpMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'planner_batch', arguments: { steps } } }),
    ctx,
  );
  const payload = JSON.parse(JSON.parse(raw).result.content[0].text) as McpToolResult;
  assert(payload.ok === true, `de batch met de overige kernen faalde: ${raw.slice(0, 800)}`);
  const data = (payload as McpToolOk).data as { steps: { tool: string; status: string; error?: string }[] };
  const gefaald = data.steps.filter((s) => s.status !== 'uitgevoerd');
  assertEq(gefaald, [], `alle stappen moeten uitgevoerd zijn; gefaald: ${JSON.stringify(gefaald)}`);

  // Steekproef op het EFFECT van een paar kernen (niet alleen op de statusregel).
  assertEq(S().sequences.length, 0, 'remove_dependencies-kern verwijderde de relatie');
  assertEq(S().project.startDate, '2026-04-01', 'move_project-kern verschoof het project');
  assert(!S().tasks.some((t) => t.id === taskA.id), 'delete_tasks-kern verwijderde Taak A');
});

test('een batch met een onbekende tool rolt ALLES terug (de vangrail werkt over de banen heen)', async () => {
  S().newProject();
  const before = S().tasks.length;
  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: {
          steps: [
            // `tmp-`-prefix: anders zou de batch al op de GERESERVEERDE tempId-syntax (T22) stranden
            // en zou deze case de onbekende-tool-vangrail niet meer bewijzen.
            { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-x', name: 'Wordt teruggedraaid', duration: 5 }] } },
            { tool: 'planner_bestaat_niet', args: {} },
          ],
        },
      },
    }),
    makeCtx(),
  );
  const payload = JSON.parse(JSON.parse(raw).result.content[0].text) as McpToolResult;
  assertEq(payload.ok, false, 'de batch weigert');
  assertEq(S().tasks.length, before, 'de eerste (geslaagde) stap is teruggedraaid');
});

// =================================================================================================
// E. De curve-guard geldt óók op het batchStep-pad (eindintegratie)
//
// De T20-reviewfix zette `isCurve` in `classifyAssignments`; SYNC-2 tilde de synchrone kern daarna
// uit als `manageAssignmentsCore` en gaf `planner_batch` daarmee een TWEEDE ingang naar diezelfde
// logica. cases-mutate-cal-res.ts test alleen de losse-tool-ingang. Deze case pint de batch-ingang:
// zou de guard ooit naar de handler-wikkel zakken, dan zou een onbekende curve via een batch
// alsnog in de store belanden en `recomputeResourceLoad()` (stap 5, BUITEN de try/catch van
// runInMcpTransaction) laten klappen — uncaught, dus voorbij het rollback-pad.
// =================================================================================================
test('batchStep-pad: een onbekende curve wordt óók binnen planner_batch zacht geweigerd', async () => {
  S().newProject();
  const ctx = makeCtx();

  const addTask = (name: string): string => {
    const id = S().addTask({ name });
    const t = S().tasks.find((x) => x.id === id)!;
    S().updateTask(id, { time: { ...t.time, scheduleDuration: 5 } });
    return id;
  };
  const taskId = addTask('Curve-taak');
  const taskB = addTask('Curve-taak-B');
  const resourceId = S().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2 });

  const raw = await handleMcpMessage(
    JSON.stringify({
      jsonrpc: '2.0', id: 30, method: 'tools/call',
      params: {
        name: 'planner_batch',
        arguments: {
          steps: [
            {
              tool: 'planner_manage_assignments',
              args: {
                actions: [
                  { action: 'add', taskId, resourceId, unitsPerDay: 1, curve: 'bell' },   // kleine letters ⇒ ONGELDIG
                  { action: 'add', taskId: taskB, resourceId, unitsPerDay: 1, curve: 'BELL' }, // geldig
                ],
              },
            },
          ],
        },
      },
    }),
    ctx,
  );

  // Géén uncaught crash: er komt gewoon een JSON-RPC-antwoord terug.
  const payload = JSON.parse(JSON.parse(raw).result.content[0].text) as McpToolResult;
  assertEq(payload.ok, true, `de batch hoort te slagen (zachte weigering), kreeg: ${raw.slice(0, 500)}`);

  const asgns = S().assignments;
  assertEq(asgns.filter((x) => x.taskId === taskId).length, 0, 'het item met de ongeldige curve is NIET aangemaakt');
  const goed = asgns.find((x) => x.taskId === taskB);
  assert(!!goed, 'het geldige item in dezelfde batchstap is wél aangemaakt');
  assertEq(goed!.curve, 'BELL', 'en draagt de geldige curve');
  assert(
    !asgns.some((x) => x.curve !== undefined && !['UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK', 'DOUBLE_PEAK', 'TURTLE'].includes(x.curve)),
    'er staat na de batch geen enkele onbekende curve in de store',
  );
});

run();
