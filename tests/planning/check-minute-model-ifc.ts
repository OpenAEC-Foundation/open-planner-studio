import { parseInstant, MS_PER_DAY } from '@/utils/dateUtils';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import './domStub';
import { freshPayload, payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { minuteModelWriteView } from '@/services/ifc/minuteModelWrite';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { computeCalendarHash } from '@/services/library/libraryOps';
import { migrateToMinuteModel } from '@/state/migrations/minuteModel';
import { createAppStoreContext } from '@/state/appStoreFactory';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}
function task(id: string, start: string, finish: string): Task {
  return { id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2026-06-01', 1), scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish, lateStart: start, lateFinish: finish } };
}
for (const variant of ['W0', 'W1', 'W2']) {
  const payload = freshPayload();
  payload.calendar = { ...payload.calendar, holidays: [] };
  payload.tasks = [task('dag', '2026-06-01T07:00', '2026-06-01T16:00')];
  if (variant !== 'W0') {
    const completed = task('voltooid', '2026-06-01T11:00', '2026-06-01T16:00');
    completed.time = { ...completed.time, completion: 1, actualStart: '2026-06-01T11:00', actualFinish: '2026-06-01T16:00' };
    completed.constraint = { type: 'SNET', date: '2026-06-01T11:00' };
    completed.deadline = '2026-06-02T07:00';
    completed.time.stop = '2026-06-01T14:00'; completed.time.resume = '2026-06-02T09:00';
    payload.tasks.push(completed);
    const elapsed = task('kalendertijd', '2026-06-01T00:00', '2026-06-02T00:00');
    elapsed.time.durationType = 'ELAPSEDTIME';
    payload.tasks.push(elapsed);
    if (variant === 'W1') {
      const hour = task('uur', '2026-06-01T07:00', '2026-06-01T16:00');
      hour.time.durationUnit = 'hours'; hour.time.durationMinutes = 480;
      payload.tasks.push(hour);
    }
  }
  const hashBefore = computeCalendarHash(payload.calendar);
  const input = buildWriteIFCInput(payload);
  const view = minuteModelWriteView(input);
  const text = writeIFC(input);
  const compatOut = process.env.OPS_MINUTE_MODEL_COMPAT_OUT;
  if (compatOut) { mkdirSync(compatOut, { recursive: true }); writeFileSync(join(compatOut, `${variant}.ifc`), text); }
  const parsed = readIFC(text);
  const roundtrip = payloadFromImport(parsed, null);
  eq(`${variant} kalenderkeuze`, text.includes("'LiteralTimes'"), variant !== 'W0');
  eq(`${variant} kalender blijft scalair`, parsed.calendar.workTime, undefined);
  eq(`${variant} kalenderhash verandert niet door save`, computeCalendarHash(payload.calendar), hashBefore);
  eq(`${variant} markering`, parsed.timeModel, 'MINUTES-1');
  for (const original of payload.tasks) {
    const back = roundtrip.tasks.find(t => t.id === original.id)!;
    eq(`${variant} ${original.id} begin`, back.time.earlyStart, original.time.earlyStart);
    eq(`${variant} ${original.id} einde`, back.time.earlyFinish, original.time.earlyFinish);
    eq(`${variant} ${original.id} beperking`, back.constraint, original.constraint);
    eq(`${variant} ${original.id} deadline`, back.deadline, original.deadline);
  }
  if (variant === 'W0') eq('W0 schrijft datums als anker', view.tasks[0].time.earlyFinish, '2026-06-01');
  else eq(`${variant} dagtaak blijft letterlijk op de kalender`, view.tasks[0].time.earlyFinish, '2026-06-01T16:00');
}
// D7: zonder soort kan een anker alleen met de hint hetzelfde eindmoment herstellen.
{
  const payload = freshPayload();
  payload.calendar.holidays = [];
  const ms = task('mijlpaal', '2026-06-01T16:00', '2026-06-01T16:00');
  ms.isMilestone = true; ms.time.scheduleDuration = 0;
  payload.tasks = [ms];
  const text = writeIFC(buildWriteIFCInput(payload));
  eq('D7 hint geschreven', text.includes("'AtDayEnd'"), true);
  const back = payloadFromImport(readIFC(text), null).tasks[0];
  eq('D7 begin en einde één moment', [back.time.earlyStart, back.time.earlyFinish], ['2026-06-01T16:00', '2026-06-01T16:00']);
  eq('D7 soort blijft oningevuld', back.milestoneKind, undefined);
}
// D3: de baseline van een voltooide kalendertijd-taak houdt haar afstand tot het getoonde einde.
{
  const payload = freshPayload();
  const t = task('kalender', '2026-06-01', '2026-06-02');
  t.time.durationType = 'ELAPSEDTIME'; t.time.completion = 1;
  t.time.actualStart = '2026-06-01'; t.time.actualFinish = '2026-06-02';
  payload.tasks = [t];
  payload.baselines = [{ id: 'baseline', name: 'Basis', createdAt: '', projectDuration: 1, projectEnd: '2026-06-02', tasks: [{
    taskId: t.id, start: '2026-06-01', finish: '2026-06-02', duration: 1, isMilestone: false,
  }] }];
  const out = migrateToMinuteModel(payload).payload;
  eq('baseline-einde volgt werkelijk einde', out.baselines[0].tasks[0].finish, out.tasks[0].time.actualFinish);
  const earlier = { ...payload, baselines: payload.baselines.map(b => ({ ...b, tasks: b.tasks.map(bt => ({ ...bt, finish: '2026-05-31' })) })) };
  const normalized = migrateToMinuteModel(earlier).payload;
  eq('baseline behoudt twee kalenderdagen afstand',
    (parseInstant(normalized.tasks[0].time.actualFinish!).getTime() - parseInstant(normalized.baselines[0].tasks[0].finish).getTime()) / MS_PER_DAY, 2);

}
// Datumloze actuals op een minutenkalender (review ronde 1 van PR #559, deel B, punt 3; spec §3.6 en
// §5.2 geval 9). Een ander programma (hier: de tijden met de hand uit het slot gehaald) schrijft een
// voltooide dagtaak met werkelijk begin 1 juni en einde 2 juni zonder tijd. De lezer maakte daar 00:00
// van, en de normalisatie liet dat moment staan; na opslaan bleef het fout. Nu blijft de datum een datum
// tot de normalisatie: D1 voor het begin, D2 voor het einde, op de kalender van de taak.
//  - `literal`: scalaire kalender met `LiteralTimes` (een urentaak maakt hem letterlijk), 07:00–16:00.
//  - `blokken`: kalender met eigen werkblokken 08:00–17:00 (een urenkalender van een ander programma).
for (const variant of ['literal', 'blokken'] as const) {
  const p = freshPayload();
  p.project = { ...p.project, startDate: '2026-06-01', statusDate: '2026-06-05' };
  p.calendar = { ...p.calendar, holidays: [] };
  if (variant === 'blokken') {
    const band = [{ start: 480, end: 1020 }];
    p.calendar = { ...p.calendar, workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } } };
    p.calendars = p.calendars.map(c => (c.id === p.calendar.id ? p.calendar : c));
  }
  const [begin, eind] = variant === 'blokken' ? ['08:00', '17:00'] : ['07:00', '16:00'];
  const dag = task('Dag', `2026-06-01T${begin}`, `2026-06-02T${eind}`);
  dag.status = 'COMPLETED';
  dag.time = { ...dag.time, scheduleDuration: 2, completion: 1, actualStart: `2026-06-01T${begin}`, actualFinish: `2026-06-02T${eind}` };
  const uur = task('Uur', `2026-06-01T${begin}`, `2026-06-01T${eind}`);
  uur.time = { ...uur.time, durationUnit: 'hours', durationMinutes: 480 };
  p.tasks = [dag, uur];
  const own = writeIFC(buildWriteIFCInput(p));
  if (variant === 'literal') eq('datumloze actuals: kalender is letterlijk', own.includes("'LiteralTimes'"), true);
  // Alleen het tijdslot van de dagtaak verliest zijn tijden.
  const external = own.replace(/^(#\d+=IFCTASKTIME\('Dag Time'.*)$/m,
    line => line.replace(/'(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}'/g, "'$1'"));
  eq(`${variant} voorwaarde: het slot draagt datums zonder tijd`,
    /IFCTASKTIME\('Dag Time'[^\n]*'2026-06-02'/.test(external) && !/IFCTASKTIME\('Dag Time'[^\n]*T\d{2}:/.test(external), true);
  const read = readIFC(external);
  const actuals = (tasks: readonly Task[]) => {
    const t = tasks.find(x => x.name === 'Dag')!;
    return [t.time.actualStart, t.time.actualFinish];
  };
  eq(`${variant} lezer houdt de datum tot de normalisatie`, actuals(read.tasks), ['2026-06-01', '2026-06-02']);
  const want = [`2026-06-01T${begin}`, `2026-06-02T${eind}`];
  eq(`${variant} normalisatie op de laadgrens: D1 en D2`, actuals(payloadFromImport(read, null).tasks), want);
  const loaded = createAppStoreContext().store;
  loaded.getState().applyLoadedProject(readIFC(external), { recompute: true });
  eq(`${variant} na openen (met berekening)`, actuals(loaded.getState().tasks), want);
  const reopened = payloadFromImport(readIFC(writeIFC(buildWriteIFCInput(loaded.getState()))), null);
  eq(`${variant} na opslaan en heropenen`, actuals(reopened.tasks), want);
}

if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
console.log(`minutenmodel IFC: ${checks - errors.length}/${checks} groen`);
