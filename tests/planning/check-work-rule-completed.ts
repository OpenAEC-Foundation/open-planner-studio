// Ook bij 100% blijft verricht resourcewerk vaststaan en begint een nieuwkomer zonder verleden.
// Store-acties met IFC-heropening tussen beide bewerkingen; de taakduur blijft bytegelijk.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { assignmentDayUnits } from '@/engine/scheduler/ResourceLoad';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { WORK_RULES } from '@/types/workRule';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(got)}, verwachtte ${JSON.stringify(want)}`);
  }
}

for (const rule of WORK_RULES) {
  for (const actual of [undefined, 0, 1920]) {
    for (const editFirst of [false, true]) {
      const name = `${rule}/actual=${actual}/inzet-eerst=${editFirst}`;
      const store = createAppStore();
      const S = () => store.getState();
      S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
      const id = S().addTask({ name, time: createDefaultTaskTime('2026-06-01', 4) });
      const rid = S().addResource({ name: 'Bestaande ploeg', description: '', type: 'LABOR', maxUnits: 7 });
      S().assignResource(id, rid, 1);
      if (rule !== 'FIXED_DURATION_RATE') S().setTaskWorkRule(id, rule);
      S().runCPM();
      eq(`${name}: voltooien geaccepteerd`, S().setTaskProgress(id, 1), true);
      const task = () => S().tasks.find(t => t.name === name)!;
      const own = () => S().assignments.filter(a => a.taskId === task().id);
      const load = (i: number) => assignmentDayUnits(task(), own()[i], 480).reduce((sum, v) => sum + v, 0) * 480;
      const snapshot = () => JSON.stringify({ time: task().time, assignments: own() });
      // Alleen de expliciet opgeslagen importwaarden worden buiten de store-acties gezet.
      if (actual !== undefined) store.setState(s => {
        const a = s.assignments.find(a => a.taskId === id)!;
        a.actualWorkMinutes = actual;
        a.remainingWorkMinutes = 0;
      });
      const expected = actual ?? 1920;
      const time = JSON.stringify(task().time);
      eq(`${name}: vooraf totaal`, load(0), expected);
      const roundTrip = () => {
        const fields = own().map(a => [a.unitsPerDay, a.actualWorkMinutes, a.remainingWorkMinutes]);
        S().applyLoadedProject(readIFC(writeIFC(buildWriteIFCInput(S()))), {
          linkedOpen: true, recompute: true, filePath: null,
        });
        eq(`${name}: werkvelden overleven IFC`, own().map(a => [a.unitsPerDay, a.actualWorkMinutes, a.remainingWorkMinutes]), fields);
        eq(`${name}: IFC behoudt totaal`, own().reduce((sum, _, i) => sum + load(i), 0), expected);
      };
      const edit = () => {
        const before = snapshot();
        S().updateAssignment(own()[0].id, { unitsPerDay: 7 });
        eq(`${name}: inzet is 7`, own()[0].unitsPerDay, 7);
        eq(`${name}: oude actual vastgelegd`, own()[0].actualWorkMinutes, expected);
        eq(`${name}: oude rest nul`, own()[0].remainingWorkMinutes, 0);
        eq(`${name}: totaal na inzetwijziging`, load(0), expected);
        const after = snapshot();
        S().undo();
        eq(`${name}: undo inzet`, snapshot(), before);
        S().redo();
        eq(`${name}: redo inzet`, snapshot(), after);
      };
      const add = () => {
        const r = S().addResource({ name: 'Nieuwe ploeg', description: '', type: 'LABOR', maxUnits: 3 });
        const before = snapshot();
        S().assignResource(task().id, r, 3);
        eq(`${name}: blijver actual vastgelegd`, own()[0].actualWorkMinutes, expected);
        eq(`${name}: blijver rest nul`, own()[0].remainingWorkMinutes, 0);
        eq(`${name}: nieuwkomer inzet is 3`, own()[1].unitsPerDay, 3);
        eq(`${name}: nieuwkomer actual nul`, own()[1].actualWorkMinutes, 0);
        eq(`${name}: nieuwkomer rest nul`, own()[1].remainingWorkMinutes, 0);
        eq(`${name}: nieuwkomer totaal nul`, load(1), 0);
        const after = snapshot();
        S().undo();
        eq(`${name}: undo toevoegen`, snapshot(), before);
        S().redo();
        eq(`${name}: redo toevoegen`, snapshot(), after);
      };
      if (editFirst) edit(); else add();
      eq(`${name}: eerste bewerking verandert geen duur of voortgang`, JSON.stringify(task().time), time);
      roundTrip();
      // IFC levert nieuwe ids; alle vervolgstappen gebruiken de heropende taak/toewijzingen.
      const loadedTime = JSON.stringify(task().time);
      if (editFirst) add(); else edit();
      eq(`${name}: tweede bewerking verandert geen duur of voortgang`, JSON.stringify(task().time), loadedTime);
      eq(`${name}: geen nieuw werk op een voltooide taak`, own().reduce((sum, _, i) => sum + load(i), 0), expected);
      roundTrip();
    }
  }
}

// B3 (spec "alleen uren" §3.5): de rest uit een percentage is exact, ook in de dagenmaat. Een taak van
// 4 d op 100 % en dan 90 % heeft 0,4 d rest (was `Math.round(0,4)` = 0, en dan verdween dat werk). Inzet
// 7 daarna: 1728 verricht + 0,4 × 7 × 480 = 1344 rest = 3072 werkminuten.
{
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
  const id = S().addTask({ name: 'B3', time: createDefaultTaskTime('2026-06-01', 4) });
  const rid = S().addResource({ name: 'Ploeg', description: '', type: 'LABOR', maxUnits: 7 });
  S().assignResource(id, rid, 1);
  S().runCPM();
  const task = () => S().tasks.find(t => t.id === id)!;
  const asg = () => S().assignments.find(a => a.taskId === id)!;
  const total = () => assignmentDayUnits(task(), asg(), 480).reduce((sum, v) => sum + v, 0) * 480;
  eq('B3 voltooien geaccepteerd', S().setTaskProgress(id, 1), true);
  eq('B3 terug naar 90 % geaccepteerd', S().setTaskProgress(id, 0.9), true);
  eq('B3 90 % van 4 d: rest exact 0,4 d', task().time.remainingTime, 0.4);
  S().updateAssignment(asg().id, { unitsPerDay: 7 });
  eq('B3 inzet 7: 1728 verricht + 1344 rest', [asg().actualWorkMinutes, asg().remainingWorkMinutes], [1728, 1344]);
  eq('B3 inzet 7: totaal 3072 werkminuten', total(), 3072);
}

// Knownbug 239: een voltooide taak met TEGENSTRIJDIG restwerk (uit een import: 100 %, nog 120 min rest,
// geen verricht werk) viel buiten de bescherming. Vast werk en vaste inzet gaven de taak dan een nieuwe
// duur en < 100 %; vaste duur telde het verleden opnieuw met de nieuwe inzet (2040 → 13560 min). Nu: het
// verleden (4 d × 1 = 1920) wordt vastgelegd, de rest blijft 120, duur en voortgang blijven staan.
for (const rule of WORK_RULES) {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01', statusDate: '2026-06-10' });
  const id = S().addTask({ name: rule, time: createDefaultTaskTime('2026-06-01', 4) });
  const rid = S().addResource({ name: 'Ploeg', description: '', type: 'LABOR', maxUnits: 7 });
  S().assignResource(id, rid, 1);
  if (rule !== 'FIXED_DURATION_RATE') S().setTaskWorkRule(id, rule);
  S().runCPM();
  S().setTaskProgress(id, 1);
  store.setState(s => {
    const a = s.assignments.find(a => a.taskId === id)!;
    a.remainingWorkMinutes = 120;
    delete a.actualWorkMinutes;
  });
  const task = () => S().tasks.find(t => t.id === id)!;
  const own = () => S().assignments.filter(a => a.taskId === id);
  const total = () => own().reduce((sum, a) => sum + assignmentDayUnits(task(), a, 480).reduce((s2, v) => s2 + v, 0) * 480, 0);
  const time = JSON.stringify(task().time);
  eq(`239 ${rule}: vooraf 1920 + 120`, total(), 2040);
  S().updateAssignment(own()[0].id, { unitsPerDay: 7 });
  eq(`239 ${rule}: inzet 7 legt het verleden vast en laat de rest staan`, own().map(a => [a.unitsPerDay, a.actualWorkMinutes, a.remainingWorkMinutes]), [[7, 1920, 120]]);
  eq(`239 ${rule}: inzet 7 verandert duur en voortgang niet`, JSON.stringify(task().time), time);
  eq(`239 ${rule}: inzet 7 houdt het totaal`, total(), 2040);
  const r2 = S().addResource({ name: 'Nieuw', description: '', type: 'LABOR', maxUnits: 3 });
  S().assignResource(id, r2, 3);
  eq(`239 ${rule}: een nieuwkomer begint zonder verleden en zonder rest`, own().map(a => [a.unitsPerDay, a.actualWorkMinutes, a.remainingWorkMinutes]), [[7, 1920, 120], [3, 0, 0]]);
  eq(`239 ${rule}: toevoegen verandert duur en voortgang niet`, JSON.stringify(task().time), time);
  eq(`239 ${rule}: toevoegen houdt het totaal`, total(), 2040);
}

console.log(`${checks} checks, ${diffs.length} afwijkingen`);
for (const d of diffs) console.log(`XX ${d}`);
process.exit(diffs.length ? 1 : 0);
