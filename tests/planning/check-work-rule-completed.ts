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

console.log(`${checks} checks, ${diffs.length} afwijkingen`);
for (const d of diffs) console.log(`XX ${d}`);
process.exit(diffs.length ? 1 : 0);
