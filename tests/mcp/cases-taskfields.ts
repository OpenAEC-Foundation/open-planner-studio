// Taak-VELDEN via de bridge: de duur-bug en de veld-allowlist (src/services/mcp/tools/taskFields.ts).
//
// AANLEIDING (echte agent-run): een agent bouwde een bouwplanning via `planner_batch` en kreeg ALLE
// taken op de default 5 werkdagen. Hij probeerde herhaaldelijk `planner_update_tasks` met
// `fields: { duration: 10 }` — de tool antwoordde steeds `ok`, maar de duur veranderde nooit.
// Twee oorzaken:
//   1. `add_tasks` kende helemaal geen duur-veld ⇒ altijd `createDefaultTaskTime(now, 5)`.
//   2. `fields` was een kale `Object.assign(task, fields)`-merge: `duration` landde als ROMMELVELD
//      op het Task-object (de echte duur woont op `time.scheduleDuration`) ⇒ stille no-op.
//      Diezelfde merge kon met `fields: { time: {...} }` de HELE time-tak (CPM-datums, floats,
//      actuals, completion) vervangen.
//
// Elke test hieronder pint precies één van die faalvormen vast, via de losse tools ÉN via
// `planner_batch` (twee ingangen naar dezelfde `*Core`-kern).
import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run, type McpContextOverrides } from './harness';
import { taskTools } from '@/services/mcp/tools/taskTools';
import { batchTools } from '@/services/mcp/tools/batchTool';
import { readTools } from '@/services/mcp/tools/readTools';
import { registerToolModules } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk, McpToolErr } from '@/services/mcp/contracts';

const store = useAppStore;

// Warm-up (zelfde reden als de andere case-bestanden): een verse store heeft `calendars: []`; het
// restore-pad promoot de projectkalender-cache tot bibliotheek-entry. Eén edit + undo haalt die
// benigne promotie vooraf weg.
store.getState().addTask({ name: 'warmup' });
store.getState().undo();

// De batch-tool heeft de echte taak-tools in de registry nodig.
registerToolModules([taskTools, batchTools, readTools]);
const batchDef = batchTools[0];

function makeCtx(over: McpContextOverrides = {}): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: store.getState().activeDocumentId,
    ...over,
  });
}

function tool(name: string) {
  const def = [...taskTools, ...readTools].find((t) => t.name === name);
  if (!def) throw new Error(`tool ontbreekt: ${name}`);
  return def;
}
async function call(name: string, args: unknown, ctx: McpContext = makeCtx()): Promise<McpToolResult> {
  return await tool(name).handler(args, ctx);
}
function okData(res: McpToolResult): any {
  assert(res.ok, `verwachtte ok, kreeg fout: ${res.ok ? '' : (res as McpToolErr).error}`);
  return (res as McpToolOk).data as any;
}
function rejections(res: McpToolResult): { id: string; reason: string }[] {
  assert(res.ok, `verwachtte ok (met zachte weigering), kreeg fout: ${res.ok ? '' : (res as McpToolErr).error}`);
  return (res as McpToolOk).itemRejections ?? [];
}
const taskById = (id: string) => store.getState().tasks.find((t) => t.id === id);
const byName = (name: string) => store.getState().tasks.find((t) => t.name === name)!;
function reset(): void {
  store.getState().newProject();
}
/** Voortgang registreren vereist een projectstatusdatum (mcpValidation stap 8). */
function withStatusDate(date = '2027-01-04'): void {
  store.setState((s) => { s.project.statusDate = date; });
}
/** Eén gewone taak in een schone store; retourneert het id. */
function seedTask(name = 'Taak', duration = 5): string {
  const id = store.getState().addTask({ name });
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === id)!;
    t.time.scheduleDuration = duration;
  });
  return id;
}

// =================================================================================================
// A. planner_add_tasks — duur bij het aanmaken
// =================================================================================================
test('add_tasks: `duration` landt ECHT op time.scheduleDuration (was: altijd de default 5)', async () => {
  reset();
  const res = await call('planner_add_tasks', {
    tasks: [
      { tempId: 'tmp-a', name: 'Fundering', duration: 10 },
      { tempId: 'tmp-b', name: 'Ruwbouw', duration: 3, durationType: 'ELAPSEDTIME' },
      { tempId: 'tmp-c', name: 'Zonder duur' },
    ],
  });
  okData(res);
  assertEq(byName('Fundering').time.scheduleDuration, 10, 'duration 10 landde op scheduleDuration');
  assertEq(byName('Ruwbouw').time.scheduleDuration, 3, 'duration 3 landde op scheduleDuration');
  assertEq(byName('Ruwbouw').time.durationType, 'ELAPSEDTIME', 'durationType landde');
  assertEq(byName('Fundering').time.durationType, 'WORKTIME', 'default durationType blijft WORKTIME');
  assertEq(byName('Zonder duur').time.scheduleDuration, 5, 'zonder duration blijft de default van 5 werkdagen');
  // De afgeleide finish moet bij de duur passen (createDefaultTaskTime, niet een half handgemaakt TaskTime).
  const f = byName('Fundering').time;
  assert(f.scheduleFinish > f.scheduleStart, 'scheduleFinish is uit de duur afgeleid');
  assert(f.earlyStart !== '' && f.earlyFinish !== '', 'de CPM-datums zijn na de eind-runCPM gevuld');
});

test('add_tasks: mijlpaal + duration > 0 ⇒ nette VALIDATION-fout, NIETS aangemaakt', async () => {
  reset();
  const before = store.getState().tasks.length;
  const res = await call('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-m', name: 'Oplevering', isMilestone: true, duration: 4 }],
  });
  assertEq(res.ok, false, 'een mijlpaal met duur > 0 hoort te falen');
  assertEq((res as McpToolErr).code, 'VALIDATION', 'de code is VALIDATION (geen throw uit de draft-laag)');
  assert(/mijlpaal/i.test((res as McpToolErr).error), `de fout benoemt de mijlpaal-regel: ${(res as McpToolErr).error}`);
  assertEq(store.getState().tasks.length, before, 'er is geen enkele taak aangemaakt');

  const ok = await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-m2', name: 'Oplevering', isMilestone: true }] });
  okData(ok);
  assertEq(byName('Oplevering').time.scheduleDuration, 0, 'een mijlpaal krijgt duur 0');
});

test('add_tasks: negatieve of niet-eindige duur ⇒ VALIDATION', async () => {
  reset();
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, '10']) {
    const res = await call('planner_add_tasks', { tasks: [{ tempId: 'tmp-x', name: 'X', duration: bad }] });
    assertEq(res.ok, false, `duration ${String(bad)} hoort geweigerd te worden`);
    assertEq((res as McpToolErr).code, 'VALIDATION', 'code VALIDATION');
  }
  assertEq(store.getState().tasks.length, 0, 'geen enkele taak aangemaakt');
});

test('add_tasks: een onbekende sleutel is een HARDE fout (nooit stil gedropt)', async () => {
  reset();
  const res = await call('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-a', name: 'Fundering', duration_days: 10 }],
  });
  assertEq(res.ok, false, 'een onbekend veld hoort de call te laten falen');
  const err = (res as McpToolErr).error;
  assert(err.includes('duration_days'), `de fout noemt de rotte sleutel: ${err}`);
  assert(err.includes('duration'), `de fout noemt de toegestane velden: ${err}`);
  assertEq(store.getState().tasks.length, 0, 'geen taak aangemaakt');
});

// =================================================================================================
// B. planner_update_tasks — fields.duration werkt, onbekend weigert
// =================================================================================================
test('update_tasks: fields.duration wijzigt de duur ECHT (regressie: stille no-op)', async () => {
  reset();
  withStatusDate();
  const id = seedTask('Fundering', 5);
  // Voortgang zetten, zodat we ná de duur-wijziging kunnen bewijzen dat de time-tak intact bleef.
  okData(await call('planner_update_tasks', { updates: [{ id, progress: { completion: 40 } }] }));
  const beforeEarlyStart = taskById(id)!.time.earlyStart;

  const res = await call('planner_update_tasks', { updates: [{ id, fields: { duration: 12 } }] });
  const data = okData(res);
  assertEq(rejections(res).length, 0, 'geen weigeringen');
  assertEq(data.updated, [id], 'de taak staat in updated');
  const t = taskById(id)!;
  assertEq(t.time.scheduleDuration, 12, 'de duur is ECHT gewijzigd (time.scheduleDuration)');
  assert(!('duration' in (t as unknown as Record<string, unknown>)), 'er staat geen rommelveld `duration` op de taak');
  // De time-tak is veld-voor-veld gepatcht, niet vervangen.
  assertEq(t.time.completion, 0.4, 'completion overleefde de duur-wijziging');
  assert(t.time.actualStart !== undefined, 'actualStart (uit het voortgangspad) overleefde');
  assert(t.time.earlyStart !== '' && t.time.lateFinish !== '', 'CPM-datums zijn gevuld gebleven');
  assertEq(t.time.earlyStart, beforeEarlyStart, 'de vroege start bleef gelijk (alleen de duur wijzigde)');
  assert(t.time.earlyFinish > t.time.earlyStart, 'de langere duur is doorgerekend');
});

test('update_tasks: onbekend veld ⇒ zachte weigering en GEEN enkele mutatie', async () => {
  reset();
  const id = seedTask('Fundering', 5);
  const res = await call('planner_update_tasks', {
    updates: [{ id, fields: { name: 'Nieuwe naam', duration_days: 10 } }],
  });
  const rej = rejections(res);
  assertEq(rej.length, 1, 'precies één zachte weigering');
  assertEq(rej[0].id, id, 'de weigering noemt de taak');
  assert(rej[0].reason.includes("onbekend veld 'duration_days'"), `bruikbare reden: ${rej[0].reason}`);
  assert(/duration, durationUnit, durationType/.test(rej[0].reason), `de reden somt de toegestane velden op: ${rej[0].reason}`);
  const t = taskById(id)!;
  assertEq(t.name, 'Fundering', 'de naam is NIET gewijzigd (alles-of-niets per item)');
  assertEq(t.time.scheduleDuration, 5, 'de duur is niet gewijzigd');
  assert(!('duration_days' in (t as unknown as Record<string, unknown>)), 'er is geen rommelveld op de taak beland');
  assertEq(okData(res).updated, [], 'niets als toegepast gerapporteerd');
});

// F5 (spec-review-fixronde op 526af9f9, plan-Z14 regel ~470) — de drie NIEUWE Z14b-velden
// (mspTaskType/effortDriven/timephasedContours) zijn puur .mpp-importdata en horen dus, net als
// isHammock/manuallyScheduled, met een GERICHTE `REJECT_HINTS`-reden geweigerd te worden — niet als
// kaal "onbekend veld" (dat zou een agent niets leren over WAAROM).
test('update_tasks: mspTaskType/effortDriven/timephasedContours zijn read-only (gerichte REJECT_HINTS, geen mutatie)', async () => {
  reset();
  const id = seedTask('Fundering', 5);

  const res1 = await call('planner_update_tasks', { updates: [{ id, fields: { mspTaskType: 'FIXED_WORK' } }] });
  assert(rejections(res1)[0].reason.includes("onbekend veld 'mspTaskType'"), `gerichte hint: ${rejections(res1)[0].reason}`);
  assert(/importdata|\.mpp/.test(rejections(res1)[0].reason), `de reden legt uit WAAROM: ${rejections(res1)[0].reason}`);

  const res2 = await call('planner_update_tasks', { updates: [{ id, fields: { effortDriven: true } }] });
  assert(rejections(res2)[0].reason.includes("onbekend veld 'effortDriven'"), `gerichte hint: ${rejections(res2)[0].reason}`);

  const res3 = await call('planner_update_tasks', {
    updates: [{ id, fields: { timephasedContours: [{ resourceUid: 1, periods: [] }] } }],
  });
  assert(rejections(res3)[0].reason.includes("onbekend veld 'timephasedContours'"), `gerichte hint: ${rejections(res3)[0].reason}`);

  const t = taskById(id)!;
  assert(t.mspTaskType === undefined, 'mspTaskType niet gezet');
  assert(t.effortDriven === undefined, 'effortDriven niet gezet');
  assert(t.timephasedContours === undefined, 'timephasedContours niet gezet');
});

test('update_tasks: fields.time wordt geweigerd en laat de hele time-tak intact', async () => {
  reset();
  withStatusDate();
  const id = seedTask('Fundering', 5);
  okData(await call('planner_update_tasks', { updates: [{ id, progress: { completion: 40 } }] }));
  const before = JSON.stringify(taskById(id)!.time);

  const res = await call('planner_update_tasks', {
    updates: [{ id, fields: { time: { durationType: 'WORKTIME', scheduleDuration: 99 } } }],
  });
  const rej = rejections(res);
  assertEq(rej.length, 1, 'de tak-overschrijving wordt geweigerd');
  assert(/time/.test(rej[0].reason) && /duration/.test(rej[0].reason), `de reden wijst naar \`duration\`: ${rej[0].reason}`);
  assertEq(JSON.stringify(taskById(id)!.time), before, 'de time-tak is byte-identiek gebleven');

  // Het bestaande voortgangs-verbod blijft óók staan (en wint, met zijn eigen boodschap).
  const res2 = await call('planner_update_tasks', { updates: [{ id, fields: { time: { completion: 1 } } }] });
  assert(/progress/.test(rejections(res2)[0].reason), 'voortgang in fields verwijst nog steeds naar `progress`');
  const res3 = await call('planner_update_tasks', { updates: [{ id, fields: { status: 'COMPLETED' } }] });
  assert(/progress/.test(rejections(res3)[0].reason), '`status` in fields verwijst nog steeds naar `progress`');
  assertEq(JSON.stringify(taskById(id)!.time), before, 'nog steeds byte-identiek');
});

test('update_tasks: mijlpaal + duration > 0 ⇒ zachte weigering, mijlpaal blijft 0', async () => {
  reset();
  const id = store.getState().addTask({ name: 'Oplevering', isMilestone: true });
  const res = await call('planner_update_tasks', { updates: [{ id, fields: { duration: 7 } }] });
  const rej = rejections(res);
  assertEq(rej.length, 1, 'geweigerd');
  assert(/mijlpaal/i.test(rej[0].reason), `de reden noemt de mijlpaal-regel: ${rej[0].reason}`);
  assertEq(taskById(id)!.time.scheduleDuration, 0, 'de mijlpaal houdt duur 0');
});

test('update_tasks: een duur-wijziging WIST een achtergebleven durationMinutes (uur-bron)', async () => {
  reset();
  const id = seedTask('Uur-taak', 2);
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === id)!;
    t.time.durationMinutes = 2 * 8 * 60; // alsof de taak op een uur-kalender is ingevoerd
  });
  okData(await call('planner_update_tasks', { updates: [{ id, fields: { duration: 6 } }] }));
  const t = taskById(id)!;
  assertEq(t.time.scheduleDuration, 6, 'de dag-duur is gezet');
  assertEq(t.time.durationMinutes, undefined, 'de minuten-bron is gewist (anders zou die de dag-duur stil overrulen)');
});

test('add/update/get_task: uren zijn een expliciete native eenheid en round-trippen via MCP', async () => {
  reset();
  store.setState((s) => {
    s.calendar.workTime = {
      byWeekday: {
        1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }],
        3: [{ start: 480, end: 960 }], 4: [{ start: 480, end: 960 }],
        5: [{ start: 480, end: 960 }], 6: [], 7: [],
      },
    };
  });
  const created = okData(await call('planner_add_tasks', {
    tasks: [{ tempId: 'tmp-hour', name: 'Uurtaak', duration: 12, durationUnit: 'hours' }],
  }));
  const id = created.created['tmp-hour'];
  let task = taskById(id)!;
  assertEq(task.time.durationUnit, 'hours', 'aanmaak bewaart hours als native eenheid');
  assertEq(task.time.durationMinutes, 720, 'aanmaak bewaart exact 720 minuten');
  assertEq(task.time.scheduleDuration, 1.5, 'afgeleid dagequivalent volgt de 8-uurskalender');

  okData(await call('planner_update_tasks', {
    updates: [{ id, fields: { duration: 10, durationUnit: 'hours' } }],
  }));
  task = taskById(id)!;
  assertEq(task.time.durationMinutes, 600, 'update wijzigt de native uurbron');
  const read = okData(await call('planner_get_task', { taskId: id }));
  assertEq(read.duration, 10, 'get_task geeft de native uurwaarde terug');
  assertEq(read.durationUnit, 'hours', 'get_task benoemt de native eenheid');
});

test('durationUnit zonder duration en uren zonder werkblokken worden geweigerd zonder herinterpretatie', async () => {
  reset();
  const id = seedTask('Dagen', 2);
  const unitOnly = await call('planner_update_tasks', { updates: [{ id, fields: { durationUnit: 'hours' } }] });
  assert(/samen met `duration`/.test(rejections(unitOnly)[0].reason), 'unit-only legt de atomaire wijzigingsregel uit');
  const noBlocks = await call('planner_update_tasks', {
    updates: [{ id, fields: { duration: 12, durationUnit: 'hours' } }],
  });
  assert(/concrete werkblokken/.test(rejections(noBlocks)[0].reason), 'urentaak zonder blokken wordt gericht geweigerd');
  assertEq(taskById(id)!.time.durationUnit, 'days', 'de bestaande dagidentiteit bleef behouden');
  assertEq(taskById(id)!.time.scheduleDuration, 2, 'de bestaande daghoeveelheid bleef behouden');
});

test('update_tasks: constraint / deadline / calendarId — gevalideerd, niet blind gemerged', async () => {
  reset();
  const id = seedTask('Fundering', 5);

  okData(await call('planner_update_tasks', {
    updates: [{ id, fields: { constraint: { type: 'SNET', date: '2026-05-04' }, deadline: '2026-06-01' } }],
  }));
  assertEq(taskById(id)!.constraint, { type: 'SNET', date: '2026-05-04' }, 'de constraint landde');
  assertEq(taskById(id)!.deadline, '2026-06-01', 'de deadline landde');

  // Wissen met null.
  okData(await call('planner_update_tasks', { updates: [{ id, fields: { constraint: null, deadline: null } }] }));
  assertEq(taskById(id)!.constraint, undefined, 'constraint gewist');
  assertEq(taskById(id)!.deadline, undefined, 'deadline gewist');

  // Ongeldige invoer weigert i.p.v. stil te landen.
  const bad = [
    { constraint: { type: 'SNET' } },                       // datum ontbreekt
    { constraint: { type: 'BESTAAT-NIET', date: '2026-05-04' } },
    { constraint: { type: 'SNET', date: '2026-05-04', hard: true } }, // hard alleen bij MSO/MFO
    { deadline: 'volgende week' },
    { calendarId: 'cal-bestaat-niet' },
    { priority: 5000 },
    { name: '' },
  ];
  for (const fields of bad) {
    const res = await call('planner_update_tasks', { updates: [{ id, fields }] });
    assertEq(rejections(res).length, 1, `geweigerd: ${JSON.stringify(fields)}`);
  }
  assertEq(taskById(id)!.constraint, undefined, 'geen enkele rotte constraint landde');
  assertEq(taskById(id)!.name, 'Fundering', 'de naam bleef geldig');

  // De projectkalender-id is wél een geldige taak-kalender.
  okData(await call('planner_update_tasks', { updates: [{ id, fields: { calendarId: store.getState().calendar.id } }] }));
  assertEq(taskById(id)!.calendarId, store.getState().calendar.id, 'een bestaande kalender-id landt');
});

test('update_tasks: isMilestone ⇒ duur 0; verzameltaak/taak-met-toewijzing wordt geweigerd', async () => {
  reset();
  const id = seedTask('Oplevering', 5);
  okData(await call('planner_update_tasks', { updates: [{ id, fields: { isMilestone: true } }] }));
  assertEq(taskById(id)!.isMilestone, true, 'de taak is nu een mijlpaal');
  assertEq(taskById(id)!.time.scheduleDuration, 0, 'de duur is op 0 gezet');

  const parent = store.getState().addTask({ name: 'Fase' });
  store.getState().addTask({ name: 'Kind', parentId: parent });
  const res = await call('planner_update_tasks', { updates: [{ id: parent, fields: { isMilestone: true } }] });
  assertEq(rejections(res).length, 1, 'een verzameltaak kan geen mijlpaal worden');
  assertEq(taskById(parent)!.isMilestone, false, 'de verzameltaak bleef ongewijzigd');
});

test('update_tasks: een geweigerd fields-blok blokkeert het progress-pad van hetzelfde item NIET', async () => {
  reset();
  withStatusDate();
  const id = seedTask('Fundering', 5);
  const res = await call('planner_update_tasks', {
    updates: [{ id, fields: { onzin: 1 }, progress: { completion: 25 } }],
  });
  assertEq(rejections(res).length, 1, 'het fields-blok is geweigerd');
  assertEq(okData(res).updated, [id], 'het progress-pad is wél toegepast (bewuste granulariteit)');
  assertEq(taskById(id)!.time.completion, 0.25, 'de voortgang landde');
});

// =================================================================================================
// C. Dezelfde paden via planner_batch (tweede ingang naar dezelfde *Core-kernen)
// =================================================================================================
test('batch: add_tasks-duur + update_tasks-duur landen ook via planner_batch', async () => {
  reset();
  const res = await batchDef.handler({
    steps: [
      { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-f', name: 'Fundering', duration: 10 }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: 'tmp-f', fields: { duration: 15, name: 'Fundering XL' } }] } },
    ],
  }, makeCtx());
  const data = okData(res);
  assertEq(data.steps.map((s: any) => s.status), ['uitgevoerd', 'uitgevoerd'], 'beide stappen liepen');
  const t = byName('Fundering XL');
  assertEq(t.time.scheduleDuration, 15, 'de duur uit de update-stap landde (via de tempId-resolutie)');
});

test('batch: een onbekend veld in update_tasks blijft een ZACHTE weigering (batch loopt door)', async () => {
  reset();
  const res = await batchDef.handler({
    steps: [
      { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-f', name: 'Fundering', duration: 8 }] } },
      { tool: 'planner_update_tasks', args: { updates: [{ id: 'tmp-f', fields: { duration_days: 20 } }] } },
    ],
  }, makeCtx());
  const data = okData(res);
  assertEq(data.steps.map((s: any) => s.status), ['uitgevoerd', 'uitgevoerd'], 'de batch loopt door');
  assert(
    data.rejections.some((r: any) => r.reason.includes("onbekend veld 'duration_days'")),
    `de weigering staat prominent in het batch-rapport: ${JSON.stringify(data.rejections)}`,
  );
  assertEq(byName('Fundering').time.scheduleDuration, 8, 'de duur is niet stilletjes gewijzigd');
});

test('batch: mijlpaal + duration > 0 rolt de HELE batch terug (structurele stapfout)', async () => {
  reset();
  const before = store.getState().tasks.length;
  const res = await batchDef.handler({
    steps: [
      { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-a', name: 'Blijft niet staan', duration: 3 }] } },
      { tool: 'planner_add_tasks', args: { tasks: [{ tempId: 'tmp-m', name: 'Mijlpaal', isMilestone: true, duration: 2 }] } },
    ],
  }, makeCtx());
  assertEq(res.ok, false, 'de batch faalt');
  assertEq((res as McpToolErr).code, 'VALIDATION', 'code VALIDATION');
  assertEq(store.getState().tasks.length, before, 'de eerste stap is teruggedraaid');
});

// =================================================================================================
// D. mpp-nul-data-etappe (P2, spec-review op 3fba671b) — het `timephasedGuidanceLost`-envelopveld.
// Additieve contractuitbreiding (McpEnvelope, zelfde precedent als `backupCreated` hierboven): een
// mutatie die aantoonbaar MSP-timephased-sturing loslaat (`clearTimephasedWindow`/
// `clearTimephasedDurationWalks` in taskDefaults.ts gaven `true` terug) draagt dit veld terug —
// ONAFHANKELIJK van de in-app K8a-melding, die aan de eenmalige-per-document-gate hangt
// (`timephasedLossNotice.ts`): het envelopveld draagt gewoon élke keer opnieuw mee, ook een TWEEDE
// keer op hetzelfde document waar de app-melding stil blijft (de AI-client mag het altijd zien).
// Deze cases toetsen daarom BEIDE kanalen apart, en steunen op `reset()` (== `newProject()`) tussen
// cases voor een schone `ui.notifications`-lei — precies het pad dat de P1-fix repareerde: zónder
// die fix zou de EERSTE case hier de meldings-gate voor dit docId voorgoed "al gemeld" maken, en zou
// de assertie op `ui.notifications` in een latere case hier stil (en ten onrechte) falen.
// =================================================================================================

/** Zet timephased-sturing rechtstreeks op de taak — dit veld is via `planner_update_tasks` bewust
 *  read-only (zie de REJECT_HINTS-test in sectie B hierboven), dus buiten de tool-allowlist om,
 *  net als `seedTask`/`withStatusDate` hierboven. */
function seedTimephasedWindow(id: string): void {
  store.setState((s) => {
    const t = s.tasks.find((x) => x.id === id)!;
    t.timephasedFinishFloor = '2026-08-10T17:00';
    t.timephasedStartAnchor = '2026-08-03T08:00';
  });
}

test('update_tasks: een duur-wijziging die sturing loslaat draagt timephasedGuidanceLost + meldt zich (K8a)', async () => {
  reset();
  store.setState((s) => { s.ui.notifications = []; }); // schone lei (P1: reset() geeft ook een schone meldings-gate).
  const id = seedTask('Met MSP-sturing', 5);
  seedTimephasedWindow(id);
  const res = await call('planner_update_tasks', { updates: [{ id, fields: { duration: 9 } }] });
  okData(res);
  assertEq(taskById(id)!.timephasedFinishFloor, undefined, 'opzet: het venster is écht gewist');
  assert(res.ok && res.envelope.timephasedGuidanceLost === 1,
    `envelope.timephasedGuidanceLost === 1 (kreeg: ${res.ok ? res.envelope.timephasedGuidanceLost : 'n/a'})`);
  assertEq(store.getState().ui.notifications.length, 1, 'de K8a-melding verschijnt óók (P1: de gate was vers)');
  assertEq(store.getState().ui.notifications[0]?.messageKey, 'notifications.mppTimephasedSteeringLost', 'met de juiste sleutel');
});

test('update_tasks: een duur-wijziging ZONDER sturing draagt het veld NIET en meldt niets', async () => {
  reset();
  store.setState((s) => { s.ui.notifications = []; });
  const id = seedTask('Zonder MSP-sturing', 5);
  const res = await call('planner_update_tasks', { updates: [{ id, fields: { duration: 9 } }] });
  okData(res);
  assert(res.ok && res.envelope.timephasedGuidanceLost === undefined,
    `envelope.timephasedGuidanceLost blijft afwezig (kreeg: ${res.ok ? res.envelope.timephasedGuidanceLost : 'n/a'})`);
  assertEq(store.getState().ui.notifications.length, 0, 'geen K8a-melding zonder een écht verlies');
});

test('batch: een update_tasks-stap die sturing loslaat draagt timephasedGuidanceLost mee via planner_batch', async () => {
  reset();
  store.setState((s) => { s.ui.notifications = []; });
  const id = seedTask('Batch-MSP-sturing', 5);
  seedTimephasedWindow(id);
  const res = await batchDef.handler({
    steps: [
      { tool: 'planner_update_tasks', args: { updates: [{ id, fields: { duration: 11 } }] } },
    ],
  }, makeCtx());
  const data = okData(res);
  assertEq(data.steps.map((s: any) => s.status), ['uitgevoerd'], 'de stap liep');
  assert(res.ok && res.envelope.timephasedGuidanceLost === 1,
    `envelope.timephasedGuidanceLost === 1 via planner_batch (kreeg: ${res.ok ? res.envelope.timephasedGuidanceLost : 'n/a'})`);
  assertEq(store.getState().ui.notifications.length, 1, 'de K8a-melding verschijnt ook via het batch-pad');
});

test('batch: een tweede sturingsverlies op hetzelfde document draagt het envelopveld WEER, ook al blijft de K8a-melding stil', async () => {
  // Vervolg op de vorige case (BEWUST geen reset()): zelfde document, dat net al gemeld heeft.
  const id2 = seedTask('Nog een MSP-sturing', 5);
  seedTimephasedWindow(id2);
  const res = await call('planner_update_tasks', { updates: [{ id: id2, fields: { duration: 6 } }] });
  okData(res);
  assert(res.ok && res.envelope.timephasedGuidanceLost === 1,
    `envelope.timephasedGuidanceLost draagt WEER mee, ongeacht de meldings-gate (kreeg: ${res.ok ? res.envelope.timephasedGuidanceLost : 'n/a'})`);
  assertEq(store.getState().ui.notifications.length, 1, 'maar de K8a-melding zelf blijft op 1 staan (eenmalig per document per sessie)');
});

await run();
