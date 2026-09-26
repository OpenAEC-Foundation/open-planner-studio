// Import/export-audit, vervolg op bevinding 6: `parseDateFromIFC` maakt van een leeg `$`-slot de
// datum van VANDAAG. Per veld nagelopen wat een leeg slot hoort te betekenen:
//
//   1. IfcTaskTime Early/Late Start/Finish (rekenslots). Het laden rekent ze opnieuw uit en "datums
//      zoals opgeslagen" leest hun aanwezigheid uit `recordedFields`, niet uit de waarde. Maar vóór
//      die solve lezen `normalizeImportedProgress` (AS/AF-default van een taak op 100 %) en een
//      slapend hersteld document ze wél: een leeg slot werd dan "vandaag". Leeg ⇒ de eigen geplande
//      start/finish van de taak, zoals de CSV-lezer het doet.
//   2. IFCWORKPLAN.FinishTime zonder OPS-pset ⇒ projecteinde leeg (zoals StartTime al deed), niet
//      vandaag.
//   3. Feestdag/werkende uitzondering (IfcWorkTime Start/FinishDate, allebei OPTIONEEL in IFC 4.3):
//      één datum leeg ⇒ de andere (één dag); allebei leeg ⇒ geen datum, dus geen uitzondering —
//      nooit een verzonnen feestdag op de leesdatum.
//
// Bewust NIET veranderd: ScheduleStart/ScheduleFinish (verplichte invoervelden; alle lezers vallen
// daar op vandaag terug — zie het rapport). Ankerjaar 2015, zodat "vandaag" nooit toevallig klopt.
// Draait via run.sh. Exit 0 = alles groen.

import { useAppStore } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
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

/** Splits de argumentlijst van één STEP-regel op topniveau (respecteert quotes en haakjes). */
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
/** Zet in de eerste STEP-regel van `type` waarvoor `pick(args)` klopt de gegeven slots op `$`. */
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

// ── Opzet: A (5 d) → B, A op 100 % zonder actuals (zoals updateTask hem achterlaat), één feestdag. ──
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
const base = writeIFC(buildWriteIFCInput(S()));
// IfcTaskTime: 5 ScheduleStart, 6 ScheduleFinish, 7 EarlyStart, 8 EarlyFinish, 9 LateStart, 10 LateFinish.
const EARLY_LATE = [7, 8, 9, 10];
const isTaskTime = (name: string) => (args: string[]) => args[0] === `'${name} Time'`;

// ── 1. Lege Early/Late-slots ⇒ de eigen geplande datums, niet vandaag ─────────────────────────────
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

// ── 2. Leeg IFCWORKPLAN.FinishTime zonder OPS-pset ⇒ projecteinde leeg ────────────────────────────
{
  // Een extern bestand kent het OPS-pset niet: hernoem de eigenschap zodat alleen WORKPLAN overblijft.
  const zonderPset = base.replace("'ProjectEndDate'", "'OnbekendVeld'");
  const ifc = blankSlots(zonderPset, 'IFCWORKPLAN', () => true, [13]);
  eq('2a projecteinde bij leeg FinishTime-slot', readIFC(ifc).project.endDate, '');
  ok('2b zonder die bewerking levert de WORKPLAN nog gewoon zijn einde (controle)',
    readIFC(zonderPset).project.endDate.startsWith('2015'));
}

// ── 3. Feestdag met lege datum(s) ─────────────────────────────────────────────────────────────────
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
