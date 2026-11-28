import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { WORK_CONTROL_ARITY, workControlSlots } from '@/services/ifc/ifcWorkControlSlots';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();
const THIS_YEAR = new Date().getFullYear().toString();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`,
    JSON.stringify(got) === JSON.stringify(want));
}
const byName = (tasks: readonly Task[], name: string): Task => {
  const t = tasks.find(x => x.name === name);
  if (!t) throw new Error(`taak ${name} ontbreekt`);
  return t;
};

function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of inner) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function blankSlots(ifc: string, type: string, pick: (args: string[]) => boolean, slots: number[]): string {
  const lines = ifc.split('\n');
  const re = new RegExp(`^(#\\d+=${type}\\()(.*)(\\);\\s*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    const args = splitArgs(m[2]);
    if (!pick(args)) continue;
    for (const s of slots) args[s] = '$';
    lines[i] = `${m[1]}${args.join(',')}${m[3]}`;
    return lines.join('\n');
  }
  throw new Error(`geen ${type}-regel gevonden om te bewerken`);
}

S().newProject();
S().setProject({ startDate: '2015-01-05' });
S().setCalendar({
  ...S().calendar,
  holidays: [{ name: 'Carnaval', startDate: '2015-02-16', endDate: '2015-02-17' }],
});
const idA = S().addTask({ name: 'A', time: createDefaultTaskTime('2015-01-05', 5) });
const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-01-12', 5) });
S().addSequence({ predecessorId: idA, successorId: idB, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
S().updateTask(idA, { time: { ...byName(S().tasks, 'A').time, completion: 1 } });
S().runCPM();
const base = writeIFC(buildWriteIFCInput(S(), 'planOnly'));
const EARLY_LATE = [7, 8, 9, 10];
const isTaskTime = (name: string) => (args: string[]) => args[0] === `'${name} Time'`;

{
  const ifc = blankSlots(blankSlots(base, 'IFCTASKTIME', isTaskTime('A'), EARLY_LATE),
    'IFCTASKTIME', isTaskTime('B'), EARLY_LATE);
  const parsed = readIFC(ifc);
  const a = byName(parsed.tasks, 'A');
  const b = byName(parsed.tasks, 'B');
  eq('1a B: leeg EarlyStart ⇒ eigen ScheduleStart', b.time.earlyStart, b.time.scheduleStart);
  eq('1b B: leeg EarlyFinish ⇒ eigen ScheduleFinish', b.time.earlyFinish, b.time.scheduleFinish);
  eq('1c B: leeg LateStart ⇒ eigen ScheduleStart', b.time.lateStart, b.time.scheduleStart);
  eq('1d B: leeg LateFinish ⇒ eigen ScheduleFinish', b.time.lateFinish, b.time.scheduleFinish);
  ok(`1e B: geen enkel rekenslot is "vandaag" (${JSON.stringify([b.time.earlyStart, b.time.earlyFinish, b.time.lateStart, b.time.lateFinish])})`,
    ![b.time.earlyStart, b.time.earlyFinish, b.time.lateStart, b.time.lateFinish].some(d => d.startsWith(THIS_YEAR)));
  eq('1f A (100 %, geen actuals): AF = geplande finish, niet vandaag', a.time.actualFinish, '2015-01-09');
  eq('1g A (100 %, geen actuals): AS = geplande start, niet vandaag', a.time.actualStart, '2015-01-05');
  eq('1h recordedFields blijft de aanwezigheid melden: geen rekenslot van A was gevuld',
    (parsed.recordedFields?.[a.id] ?? []).filter(k => ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish'].includes(k)), []);
}

{
  const zonderPset = base.replace("'ProjectEndDate'", "'OnbekendVeld'");
  const ifc = blankSlots(zonderPset, 'IFCWORKPLAN', () => true, [workControlSlots(Array<string>(WORK_CONTROL_ARITY).fill('$')).finishTime]);
  eq('2a projecteinde bij leeg FinishTime-slot', readIFC(ifc).project.endDate, '');
  ok('2b zonder die bewerking levert de WORKPLAN nog gewoon zijn einde (controle)',
    readIFC(zonderPset).project.endDate.startsWith('2015'));
}

{
  const isCarnaval = (args: string[]) => args[0] === "'Carnaval'";
  const alleenStart = readIFC(blankSlots(base, 'IFCWORKTIME', isCarnaval, [5])).calendar.holidays;
  eq('3a lege FinishDate ⇒ één dag op de startdatum', alleenStart,
    [{ name: 'Carnaval', startDate: '2015-02-16', endDate: '2015-02-16' }]);
  const alleenEind = readIFC(blankSlots(base, 'IFCWORKTIME', isCarnaval, [4])).calendar.holidays;
  eq('3b lege StartDate ⇒ één dag op de einddatum', alleenEind,
    [{ name: 'Carnaval', startDate: '2015-02-17', endDate: '2015-02-17' }]);
  const geenDatum = readIFC(blankSlots(base, 'IFCWORKTIME', isCarnaval, [4, 5])).calendar.holidays;
  eq('3c beide leeg ⇒ geen (verzonnen) feestdag op vandaag', geenDatum, []);
  eq('3d controle: onbewerkt bestand houdt de feestdag', readIFC(base).calendar.holidays,
    [{ name: 'Carnaval', startDate: '2015-02-16', endDate: '2015-02-17' }]);
}

if (diffs.length === 0) {
  console.log(`OK  ifc-empty-date-slots: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  ifc-empty-date-slots: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
