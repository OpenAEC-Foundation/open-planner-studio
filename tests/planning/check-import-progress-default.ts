// Import/export-audit, bevinding 6: de voortgangsinvariant "100 % zonder werkelijk einde" bestond
// twee keer. De store (`applyProgressInvariants`, sinds H1/check-task-slice.ts) koos
// AF = statusdatum ‖ eigen geplande finish; alle lezers (`normalizeImportedProgress`: CSV, IFC,
// MSPDI, P6, MPP) kozen nog AF = statusdatum ‖ VANDAAG. Gevolg: een CSV/MSPDI/IFC met 100 % en geen
// werkelijk einde opende met AF = vandaag, de voltooide taak "gebeurde vandaag" en alle opvolgers
// schoven naar na vandaag — bij elke opening opnieuw, want `isDirty` bleef false.
//
// De fix: één gedeelde helper voor alleen de AF-default (`defaultActualFinish`,
// engine/taskMutationRules.ts), die beide kopieën aanroepen. Bewust GEEN drop-in
// `applyProgressInvariants` in de import: die zou de bewuste STARTED-status voor
// "completion > 0 zonder actualStart" veranderen (solver-vangnet §4.2 tak 2b) — sectie 4 pint die
// afwijking vast.
//
// Ankerdatum ver in het verleden (2015, zoals check-task-slice.ts): "vandaag" kan daar nooit
// toevallig mee samenvallen. Draait via run.sh. Exit 0 = alles groen.

import { installDOMParser } from './xmldom-shim';
import { useAppStore } from '@/state/appStore';
import { applyProgressInvariants } from '@/engine/taskMutationRules';
import { normalizeImportedProgress } from '@/services/importNormalize';
import { readCSV } from '@/services/csv/csvReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';

installDOMParser();

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
/** Open een geparsed bestand zoals Bestand → Openen (zelfde store-actie). */
function open(parsed: ImportResult, name: string): void {
  S().openAsDocument(parsed, { name, ref: null });
}

// ── 1. Eén regel: store-invariant en import-normalisatie geven dezelfde AF-default ─────────────
{
  const make = (earlyFinish: string): Task => ({
    id: 'x', name: 'X', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2015-01-05', 5), scheduleFinish: '2015-01-09', earlyFinish, completion: 1 },
  });
  for (const statusDate of [undefined, '2015-01-07']) {
    for (const earlyFinish of ['2015-01-12', '']) {
      const store = make(earlyFinish);
      const imported = make(earlyFinish);
      applyProgressInvariants(store, statusDate);
      normalizeImportedProgress([imported], statusDate);
      const tag = `1 [statusDate=${statusDate ?? '-'}, earlyFinish=${earlyFinish || '-'}]`;
      eq(`${tag} import-AF === store-AF`, imported.time.actualFinish, store.time.actualFinish);
      eq(`${tag} import-AS === store-AS`, imported.time.actualStart, store.time.actualStart);
      eq(`${tag} import-status === store-status`, imported.status, store.status);
      eq(`${tag} import-remainingTime === store-remainingTime`, imported.time.remainingTime, store.time.remainingTime);
      eq(`${tag} AF = statusdatum ‖ earlyFinish ‖ scheduleFinish`,
        imported.time.actualFinish, statusDate || earlyFinish || '2015-01-09');
    }
  }
}

// ── 2. CSV (spreadsheet met alleen "100" in Completion (%), geen Actual Finish) ─────────────────
{
  const csv = [
    'WBS;Name;Duration;Start;Finish;Predecessors;Completion (%);Actual Start;Actual Finish',
    '1;A;5;2015-01-05;2015-01-09;;100;;',
    '2;B;5;2015-01-12;2015-01-16;1FS;0;;',
  ].join('\r\n');
  const parsed = readCSV(csv);
  const a = byName(parsed.tasks, 'A');
  eq('2a CSV: 100 % zonder AF ⇒ AF = eigen geplande finish', a.time.actualFinish, '2015-01-09');
  ok(`2b CSV: AF is niet "vandaag" (${a.time.actualFinish})`, !a.time.actualFinish?.startsWith(THIS_YEAR));
  eq('2c CSV: status COMPLETED', a.status, 'COMPLETED');

  open(parsed, 'spreadsheet.csv');
  const b = byName(S().tasks, 'B');
  eq('2d CSV → Openen: opvolger B start direct ná A, niet ná vandaag', b.time.earlyStart, '2015-01-12');
  eq('2e CSV → Openen: A blijft op zijn geplande finish', byName(S().tasks, 'A').time.actualFinish, '2015-01-09');
}

// ── 3. Eigen IFC (100 % zonder AF, zoals updateTask/extensie-API hem achterlaat) en MSPDI ───────
{
  S().newProject();
  S().setProject({ startDate: '2015-01-05' });
  ok('3 setup: geen statusdatum', S().project.statusDate === undefined);
  const idA = S().addTask({ name: 'A', time: createDefaultTaskTime('2015-01-05', 5) });
  const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-01-12', 5) });
  S().addSequence({ predecessorId: idA, successorId: idB, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const plannedFinish = byName(S().tasks, 'A').time.earlyFinish;
  eq('3 setup: geplande finish van A', plannedFinish, '2015-01-09');
  // updateTask draait bewust geen invarianten (extensie-API `data.updateTask`, TaskDialog).
  S().updateTask(idA, { time: { ...byName(S().tasks, 'A').time, completion: 1 } });
  S().runCPM();
  ok('3 setup: A staat op 100 % zonder AF', byName(S().tasks, 'A').time.completion === 1
    && !byName(S().tasks, 'A').time.actualFinish);

  const s = S();
  const ifc = writeIFC(buildWriteIFCInput(s));
  const mspdi = writeMSPDI(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments, s.calendars);

  // Referentie: wat de store zelf zou kiezen voor dezelfde taak (setTaskProgress → applyProgressInvariants).
  S().setTaskProgress(idA, 1);
  const storeAF = byName(S().tasks, 'A').time.actualFinish;
  eq('3 store: setTaskProgress(1) zonder statusdatum ⇒ AF = geplande finish', storeAF, plannedFinish);

  const fromIfc = byName(readIFC(ifc).tasks, 'A');
  eq('3a IFC-lezer: AF === store-AF (geplande finish)', fromIfc.time.actualFinish, storeAF);
  ok(`3b IFC-lezer: AF is niet "vandaag" (${fromIfc.time.actualFinish})`, !fromIfc.time.actualFinish?.startsWith(THIS_YEAR));

  const fromMspdi = byName(readMSPDI(mspdi).tasks, 'A');
  eq('3c MSPDI-lezer: AF === store-AF (geplande finish)', fromMspdi.time.actualFinish, storeAF);
  ok(`3d MSPDI-lezer: AF is niet "vandaag" (${fromMspdi.time.actualFinish})`, !fromMspdi.time.actualFinish?.startsWith(THIS_YEAR));

  open(readIFC(ifc), 'eigen.ifc');
  eq('3e IFC → Openen: opvolger B start direct ná A, niet ná vandaag', byName(S().tasks, 'B').time.earlyStart, '2015-01-12');
  eq('3f IFC → Openen: A eindigt op zijn geplande finish, niet vandaag', byName(S().tasks, 'A').time.earlyFinish, '2015-01-09');
  eq('3g IFC → Openen: opvolger B eindigt waar het bestand hem had', byName(S().tasks, 'B').time.earlyFinish, '2015-01-16');
  eq('3h IFC → Openen: document ongewijzigd', S().isDirty, false);
}

// ── 4. Bewuste afwijking blijft: import zet STARTED bij completion > 0 zonder actualStart ────────
// (solver-vangnet §4.2 tak 2b; de store kan die toestand niet maken — setTaskProgress zet dan zelf
// een actualStart). De import verzint GEEN actualStart.
{
  const half: Task = {
    id: 'h', name: 'H', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: { ...createDefaultTaskTime('2015-01-05', 4), completion: 0.5 },
  };
  normalizeImportedProgress([half], undefined);
  eq('4a import: completion 0,5 zonder AS ⇒ STARTED', half.status, 'STARTED');
  eq('4b import: geen verzonnen actualStart', half.time.actualStart, undefined);
  eq('4c import: geen actualFinish', half.time.actualFinish, undefined);
}

if (diffs.length === 0) {
  console.log(`OK  import-progress-default: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-progress-default: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
