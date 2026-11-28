import { appStoreContext, makeMcpContext, useAppStore, test, assert, assertEq, run } from './harness';
import { getTool } from '@/services/mcp/toolRegistry';
import type { McpContext, McpToolResult, McpToolOk } from '@/services/mcp/contracts';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();

function makeCtx(): McpContext {
  return makeMcpContext(appStoreContext, {
    expectedDocId: S().activeDocumentId,
  });
}

function def(name: string) {
  const t = getTool(name);
  assert(!!t, `tool ${name} niet geregistreerd`);
  return t!;
}

async function callOk(name: string, args: unknown = {}): Promise<any> {
  const res = (await def(name).handler(args, makeCtx())) as McpToolResult;
  assert(res.ok, `tool ${name} gaf een fout: ${res.ok ? '' : res.error}`);
  return (res as McpToolOk).data;
}

function versProject(): void {
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
}

test('LATERE startDate klemt een wortel-taak zonder voorganger/constraint, en de respons meldt het aantal', async () => {
  versProject();
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
  S().runCPM();

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === a)!.time.scheduleStart, '2026-08-17T07:00',
    'het taakanker is naar de nieuwe startdatum geklemd');
  assertEq(data.anchorsClamped, 1, 'de respons meldt precies 1 geklemd anker');
  assertEq(S().scheduleStale, false, 'H3c: de transactie herrekent al — geen stale planning ná de call');
});

test('scheduleFinish schuift consistent mee (H3b) — duurbehoudend, klokbehoudend', async () => {
  versProject();
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
  const finishVoor = S().tasks.find((t) => t.id === a)!.time.scheduleFinish;

  await callOk('planner_update_project', { startDate: '2026-08-17' });

  const t = S().tasks.find((x) => x.id === a)!;
  assert(t.time.scheduleFinish > t.time.scheduleStart, 'scheduleFinish ligt nog steeds NÁ scheduleStart (geen finish<start)');
  assert(t.time.scheduleFinish !== finishVoor, 'scheduleFinish is daadwerkelijk meegeschoven, niet blijven staan');
});

test('een taak MET voorganger blijft ongemoeid, ook met een even vroeg eigen anker', async () => {
  versProject();
  const c = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-05-01', 2) });
  const b = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-05-01', 2) });
  S().addSequence({ predecessorId: c, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === b)!.time.scheduleStart, '2026-05-01T07:00', 'B (heeft een voorganger) blijft op zijn eigen anker');
  assertEq(data.anchorsClamped, 1, 'alleen C (de wortel) telt mee, niet B');
});

test('een taak MET een expliciete SNET-constraint blijft ongemoeid', async () => {
  versProject();
  const d = S().addTask({
    name: 'D', time: createDefaultTaskTime('2026-05-01', 2),
    constraint: { type: 'SNET', date: '2026-05-10' },
  });

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === d)!.time.scheduleStart, '2026-05-01T07:00', 'D blijft op zijn eigen anker — de constraint wint');
  assertEq(data.anchorsClamped, undefined, 'niets geklemd ⇒ geen `anchorsClamped` in de respons (geen ruis)');
});

test('L1 — een dateless ASAP-constraint blokkeert de klem NIET', async () => {
  versProject();
  const e = S().addTask({
    name: 'E', time: createDefaultTaskTime('2026-05-01', 2),
    constraint: { type: 'ASAP' },
  });

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === e)!.time.scheduleStart, '2026-08-17T07:00',
    'ASAP heeft geen forward-effect in de solver — de klem behandelt hem als geen constraint');
  assertEq(data.anchorsClamped, 1, 'E telt gewoon mee');
});

test('L2 — een hammock-wortel telt niet mee (de solver negeert zijn anker toch)', async () => {
  versProject();
  const hamm = S().addTask({ name: 'Hammock', time: createDefaultTaskTime('2026-05-01', 2), isHammock: true });
  const f = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-05-01', 2) });

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === hamm)!.time.scheduleStart, '2026-05-01T07:00',
    'de hammock-taak zijn eigen scheduleStart blijft ongemoeid — de klem-lus slaat hem over');
  assertEq(S().tasks.find((t) => t.id === f)!.time.scheduleStart, '2026-08-17T07:00', 'de gewone wortel-taak klemt gewoon');
  assertEq(data.anchorsClamped, 1, 'alleen F telt mee, de hammock blaast het aantal niet op');
});

test('EERDERE startDate klemt niets — geen anchorsClamped in de respons', async () => {
  versProject();
  S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });

  const data = await callOk('planner_update_project', { startDate: '2026-01-01' });

  assertEq(data.anchorsClamped, undefined, 'een eerdere startDate klemt niets');
});

test('M4 — een uurtaak later diezelfde kalenderdag (ná de eerste werkband) wordt NIET meegeklemd', async () => {
  versProject();
  S().setCalendar({
    ...S().calendar,
    workTime: { byWeekday: {
      1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
      4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
    } },
  } as WorkCalendar);
  const g = S().addTask({ name: 'G', time: createDefaultTaskTime('2026-08-17T09:00', 2) });

  await callOk('planner_update_project', { startDate: '2026-08-17' });

  assertEq(S().tasks.find((t) => t.id === g)!.time.scheduleStart, '2026-08-17T09:00',
    'anker ná de eerste werkband van de nieuwe startdatum zelf — niets te klemmen');
});

test('uurtaak op de scalaire standaardkalender klemt naar het eerste werkmoment (07:00) — dezelfde keuze als de solver', async () => {
  versProject();
  assertEq(S().calendar.workTime, undefined, 'voorwaarde: de standaardprojectkalender is scalair (geen workTime)');
  const u = S().addTask({ name: 'U', time: createDefaultTaskTime('2026-05-04T08:00', 4, 'hours') });
  const d = S().addTask({ name: 'D', time: createDefaultTaskTime('2026-05-04', 2) });
  S().runCPM();

  const data = await callOk('planner_update_project', { startDate: '2026-08-17' });

  const uNa = S().tasks.find((t) => t.id === u)!;
  assertEq(uNa.time.scheduleStart, '2026-08-17T07:00',
    'uurtaak-anker = eerste werkmoment van de effectieve uurbanden, geen middernacht');
  assertEq(uNa.time.earlyStart, uNa.time.scheduleStart,
    'klem en solver kiezen hetzelfde moment (anker = door de transactie herberekende vroegste start)');
  assertEq(S().tasks.find((t) => t.id === d)!.time.scheduleStart, '2026-08-17T07:00',
    'dagtaak op dezelfde kalender: startmoment volgens D1');
  assertEq(data.anchorsClamped, 2, 'beide wortel-ankers tellen mee');
});

test('uurtaak op een scalaire BIBLIOTHEEKkalender (task.calendarId) klemt naar diens eerste werkmoment', async () => {
  versProject();
  const vroeg = S().addCalendar({
    ...S().calendar, name: 'Vroege ploeg', workStartHour: 6, workEndHour: 15, hoursPerDay: 8, workTime: undefined,
  });
  const d = S().addTask({ name: 'D', time: createDefaultTaskTime('2026-05-04', 2), calendarId: vroeg });
  const u = S().addTask({ name: 'U', time: createDefaultTaskTime('2026-05-04T08:00', 4, 'hours'), calendarId: vroeg });
  S().runCPM();

  await callOk('planner_update_project', { startDate: '2026-08-17' });

  const uNa = S().tasks.find((t) => t.id === u)!;
  assertEq(uNa.time.scheduleStart, '2026-08-17T06:00', 'de taak-eigen kalender bepaalt het werkmoment (06:00)');
  assertEq(uNa.time.earlyStart, uNa.time.scheduleStart, 'klem en solver kiezen hetzelfde moment');
  assertEq(S().tasks.find((t) => t.id === d)!.time.scheduleStart, '2026-08-17T06:00', 'ook de dagtaak krijgt het werkmoment van zijn eigen kalender');
});

test('batch-pad: de klem werkt óók door `planner_batch`, en het aantal komt mee in de stap-data', async () => {
  versProject();
  S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });

  const data = await callOk('planner_batch', {
    steps: [{ tool: 'planner_update_project', args: { startDate: '2026-08-17' } }],
  });
  const blob = JSON.stringify(data);
  assert(/"anchorsClamped":1/.test(blob), `de batch-stap verzwijgt het geklemde aantal: ${blob}`);
});

test('undo herstelt de klem samen met de startDate', async () => {
  versProject();
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
  await callOk('planner_update_project', { startDate: '2026-08-17' });
  assertEq(S().tasks.find((t) => t.id === a)!.time.scheduleStart, '2026-08-17T07:00', 'voorwaarde: geklemd');

  await callOk('planner_undo', {});

  assertEq(S().project.startDate, '2026-06-01', 'undo herstelt project.startDate');
  assertEq(S().tasks.find((t) => t.id === a)!.time.scheduleStart, '2026-05-01T07:00', 'undo herstelt het taakanker');
});

test('beschrijving: update_project verzwijgt de bewerkbescherming niet meer', () => {
  const up = def('planner_update_project').description;
  assert(/anchorsClamped|edit protection|before the new/.test(up), 'update_project noemt de klem-uitzondering niet meer');
});

await run();
