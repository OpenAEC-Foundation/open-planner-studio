/**
 * B1a aan de laadgrens (spec "alleen uren" §3.2, §5.2, §8 B5; review #581 r2, knownbug 253).
 *
 * Vast werk is altijd urenmaat. Een bestand van vóór B1a kan een gewone taak onder vast werk in de dagenmaat
 * hebben, met een eigen regel of met de geërfde projectstandaard. De migratie op de laadgrens
 * (`migrateToMinuteModel`) maakt die taak urenmaat, met dezelfde omzetting als een typewissel; de rest, de
 * inzet en het verricht werk blijven. Een datumverschuiving loopt via B5: twee snapshots, de vlag "omzetting
 * open" en de modus "datums zoals opgeslagen" als vóór-toestand.
 *
 * Fixture `fixtures/vast-werk-oude-writer.ifc`: gemaakt met de store en de IFC-writer van main `d991788db`
 * (vóór B1a). Kalender ma–do 07–15, vr 07–13 (werktijd per dag 8 u), projectstart wo 3 jun 2026,
 * statusdatum wo 3 jun, resource R, projectstandaard vast werk. Taken (allemaal vanaf wo 3 jun):
 *   Geerfd  3 d, geen eigen regel, R 1/dag                    → einde vr 13:00 in het bestand
 *   Eigen   3 d, eigen FIXED_WORK, R 1/dag (werk 1440)         → einde vr 13:00
 *   Lopend  5 d, eigen FIXED_WORK, begonnen ma 1 jun 07:00, 40 %, rest 3 d (werk 1440, verricht 960)
 *   Duur    3 d, eigen FIXED_DURATION_RATE (blijft dagenmaat)
 *   M       mijlpaal met eigen FIXED_WORK (blijft zoals hij is)
 *   E       2 d ELAPSEDTIME met eigen FIXED_WORK (blijft zoals hij is)
 * Recept: `git worktree add --detach <map> d991788db`, daar een script met `createAppStoreContext`,
 * `addTask`/`assignResource`/`setTaskWorkRule`, `setProject({ defaultWorkRule: 'FIXED_WORK' })`,
 * `setStatusDate`, `setActualStart`, `setTaskProgress(0.4)`, `runCPM` en
 * `writeIFC(buildWriteIFCInput(...))`, gedraaid met `node scripts/run-ts.mjs`.
 *
 * Verwacht na openen: 3 d vast werk = 24 u = 1440 min urenmaat. Wo 8 u + do 8 u + vr 6 u = 22 u, dus het
 * einde wordt ma 8 jun 09:00. Lopend: 5 d = 2400 min, rest 3 d = 1440 min, verricht werk 960 min.
 */
import './domStub';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { payloadFromImport } from '@/state/documentContract';
import { migrateToMinuteModel } from '@/state/migrations/minuteModel';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import type { ResourceAssignment } from '@/types/resource';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const OLD_IFC = readFileSync(join(HERE, 'fixtures', 'vast-werk-oude-writer.ifc'), 'utf8');
const VR_1300 = '2026-06-05T13:00';
const MA_0900 = '2026-06-08T09:00';
const CONVERTED = ['Geerfd', 'Eigen', 'Lopend'];

type Store = ReturnType<typeof createAppStoreContext>['store'];
const create = (): Store => createAppStoreContext().store;
const byName = (tasks: readonly Task[], name: string) => tasks.find(t => t.name === name)!;

/** Maat, rest en voortgang: [eenheid, scheduleDuration, durationMinutes, remainingMinutes, remainingTime, completion]. */
const measure = (t: Task) => [t.time.durationUnit, t.time.scheduleDuration, t.time.durationMinutes ?? null,
  t.time.remainingMinutes ?? null, t.time.remainingTime ?? null, t.time.completion];
/** Toewijzing: [taak, inzet, restwerk, verricht werk]. */
const work = (tasks: readonly Task[], a: ResourceAssignment) =>
  [tasks.find(t => t.id === a.taskId)!.name, a.unitsPerDay, a.remainingWorkMinutes ?? null, a.actualWorkMinutes ?? null];

const WANT_MEASURE: Record<string, unknown[]> = {
  Geerfd: ['hours', 3, 1440, null, null, 0],
  Eigen: ['hours', 3, 1440, null, null, 0],
  Lopend: ['hours', 5, 2400, 1440, 3, 0.4],
  Duur: ['days', 3, null, null, null, 0],
  M: ['days', 0, null, null, null, 0],
  E: ['days', 2, null, null, null, 0],
};
const WANT_WORK = [['Geerfd', 1, null, null], ['Eigen', 1, 1440, null], ['Lopend', 1, 1440, 960], ['Duur', 1, null, null]];
const WANT_FINISH: Record<string, string> = {
  Geerfd: MA_0900, Eigen: MA_0900, Lopend: MA_0900, Duur: VR_1300, E: '2026-06-05T07:00',
};

/** De vaste uitkomst na de omzetting: maat, rest, voortgang, toewijzingen en eindes. */
function expectConverted(label: string, s: Store) {
  const { tasks, assignments } = s.getState();
  for (const [name, want] of Object.entries(WANT_MEASURE)) eq(`${label}: maat ${name}`, measure(byName(tasks, name)), want);
  eq(`${label}: werkelijke start Lopend`, byName(tasks, 'Lopend').time.actualStart, '2026-06-01T07:00');
  eq(`${label}: mijlpaal en ELAPSEDTIME blijven`, [byName(tasks, 'M').isMilestone, byName(tasks, 'E').time.durationType],
    [true, 'ELAPSEDTIME']);
  eq(`${label}: toewijzingen`, assignments.map(a => work(tasks, a)), WANT_WORK);
  for (const [name, finish] of Object.entries(WANT_FINISH)) eq(`${label}: einde ${name}`, byName(tasks, name).time.earlyFinish, finish);
}

const flags = (s: Store) => {
  const st = s.getState();
  return {
    modus: st.datesAsRecorded, open: st.minuteModelPending, verouderd: st.scheduleStale, gewijzigd: st.isDirty,
    events: st.historyEvents.length,
    meldingen: st.ui.notifications.filter(n => n.messageKey === 'notifications.minuteModelConverted').length,
  };
};
const open = (parsed: ImportResult): Store => {
  const s = create();
  s.getState().applyLoadedProject(parsed, { recompute: true });
  return s;
};
const saveAndRead = (s: Store) => readIFC(writeIFC(buildWriteIFCInput(s.getState())));

// 0. De fixture is echt een bestand van vóór B1a.
{
  const parsed = readIFC(OLD_IFC);
  eq('0 bestand zonder minutenmodel', parsed.timeModel, undefined);
  eq('0 projectstandaard vast werk', parsed.project.defaultWorkRule, 'FIXED_WORK');
  eq('0 regels', parsed.tasks.map(t => [t.name, t.workRule ?? null]),
    [['Geerfd', null], ['Eigen', 'FIXED_WORK'], ['Lopend', 'FIXED_WORK'], ['Duur', 'FIXED_DURATION_RATE'], ['M', 'FIXED_WORK'], ['E', 'FIXED_WORK']]);
  eq('0 alles dagenmaat', parsed.tasks.map(t => [t.name, t.time.durationUnit, t.time.scheduleDuration]),
    [['Geerfd', 'days', 3], ['Eigen', 'days', 3], ['Lopend', 'days', 5], ['Duur', 'days', 3], ['M', 'days', 0], ['E', 'days', 2]]);
  eq('0 opgeslagen eindes', ['Geerfd', 'Eigen', 'Lopend'].map(n => byName(parsed.tasks, n).time.earlyFinish), [VR_1300, VR_1300, VR_1300]);
  eq('0 toewijzingen', parsed.assignments.map(a => work(parsed.tasks, a)), WANT_WORK);
}

// 1. De migratie zelf: welke taken, de vlag, en idempotent.
{
  const parsed = readIFC(OLD_IFC);
  const loaded = payloadFromImport(structuredClone(parsed), null);
  const ids = CONVERTED.map(n => byName(parsed.tasks, n).id);
  eq('1 laadgrens zet de vaste-werktaken om', CONVERTED.map(n => measure(byName(loaded.tasks, n))),
    CONVERTED.map(n => WANT_MEASURE[n]));
  eq('1 laadgrens laat de rest staan', ['Duur', 'M', 'E'].map(n => measure(byName(loaded.tasks, n))),
    ['Duur', 'M', 'E'].map(n => measure(byName(parsed.tasks, n))));
  eq('1 laadgrens zet de vlag', loaded.minuteModelPending, true);
  const again = migrateToMinuteModel(loaded, { timeModel: 'MINUTES-1' });
  eq('1 tweede keer: niets om te zetten', [again.report.fixedWorkToHours, again.report.conversionPending], [[], false]);
  eq('1 tweede keer: zelfde payload', again.payload === loaded, true);
  // Een bestand mét minutenmodel en toch een vaste-werktaak in de dagenmaat (geschreven vóór B1a op de
  // urenbranch): de omzetting zet zelf de vlag, anders verschuiven de datums zonder B5.
  const direct = migrateToMinuteModel({ ...loaded, tasks: parsed.tasks }, { timeModel: 'MINUTES-1' });
  eq('1 met minutenmodel: de omgezette taken', direct.report.fixedWorkToHours, ids);
  eq('1 met minutenmodel: toch omzetting open', [direct.report.legacyFile, direct.report.conversionPending], [false, true]);
  eq('1 invoer blijft intact', CONVERTED.map(n => byName(parsed.tasks, n).time.durationUnit), ['days', 'days', 'days']);
  const withModel = readIFC(OLD_IFC);
  withModel.timeModel = 'MINUTES-1';
  eq('1 laadgrens met minutenmodel zet de vlag', payloadFromImport(withModel, null).minuteModelPending, true);
  // Een beschadigde hersteldsnapshot (geen kinderlijst, zie check-recovery-integrity 8n): de laadgrens
  // loopt er niet op stuk en laat de taak staan, ook onder vast werk.
  const broken = { ...parsed.tasks.find(t => t.name === 'Eigen')!, childIds: null } as unknown as Task;
  let brokenOut: unknown = 'gooit';
  try {
    brokenOut = migrateToMinuteModel({ ...loaded, tasks: [broken] }, { timeModel: 'MINUTES-1' }).payload.tasks[0] === broken;
  } catch { /* blijft 'gooit' */ }
  eq('1 beschadigde taak: geen fout en ongemoeid', brokenOut, true);
}

// 2. Openen (de echte laadroute), Bereken, opslaan en heropenen.
{
  const s = open(readIFC(OLD_IFC));
  expectConverted('2 openen', s);
  eq('2 openen: B5 met één event, één melding en gewijzigd', flags(s),
    { modus: false, open: false, verouderd: false, gewijzigd: true, events: 1, meldingen: 1 });

  s.getState().runCPM();
  expectConverted('2 Bereken', s);
  eq('2 Bereken: vlag blijft uit', s.getState().minuteModelPending, false);

  const saved = saveAndRead(s);
  eq('2 opslaan: minutenmodel', saved.timeModel, 'MINUTES-1');
  eq('2 opslaan: urenmaat in het bestand', CONVERTED.map(n => [byName(saved.tasks, n).time.durationUnit, byName(saved.tasks, n).time.durationMinutes]),
    [['hours', 1440], ['hours', 1440], ['hours', 2400]]);

  const back = open(saved);
  expectConverted('2 heropenen', back);
  eq('2 heropenen: geen omzetting meer', flags(back),
    { modus: false, open: false, verouderd: false, gewijzigd: false, events: 0, meldingen: 0 });
  back.getState().runCPM();
  expectConverted('2 heropenen + Bereken', back);
  const twice = open(saveAndRead(back));
  expectConverted('2 tweede rondgang', twice);
}

// 3. Undo direct na openen: hetzelfde als bij andere B5-omzettingen (check-minute-model-transition).
{
  const s = open(readIFC(OLD_IFC));
  s.getState().undo();
  const { tasks } = s.getState();
  eq('3 undo: modus, vlag open, niet verouderd', [flags(s).modus, flags(s).open, flags(s).verouderd], [true, true, false]);
  eq('3 undo: de opgeslagen eindes', CONVERTED.map(n => byName(tasks, n).time.earlyFinish), [VR_1300, VR_1300, VR_1300]);
  for (const name of CONVERTED) eq(`3 undo: maat ${name} blijft urenmaat`, measure(byName(tasks, name)), WANT_MEASURE[name]);
  eq('3 undo: toewijzingen', s.getState().assignments.map(a => work(tasks, a)), WANT_WORK);
  const afterUndo = saveAndRead(s);
  eq('3 opslaan na undo: zonder minutenmodel', afterUndo.timeModel, undefined);
  s.getState().redo();
  expectConverted('3 redo', s);
  eq('3 redo: vlag uit', [flags(s).modus, flags(s).open], [false, false]);
  s.getState().undo();
  s.getState().runCPM();
  expectConverted('3 undo + Bereken', s);
  eq('3 undo + Bereken rondt de vlag af', [flags(s).modus, flags(s).open], [false, false]);
  const reopened = open(afterUndo);
  expectConverted('3 heropenen van de save na undo', reopened);
}

// 4. Een andere route langs dezelfde laadgrens: het slapende herstelde document.
{
  const s = create();
  const active = { ...readIFC(OLD_IFC), id: 'actief', filePath: null, isDirty: false, datesAsRecorded: false };
  const sleeping = { ...readIFC(OLD_IFC), id: 'slapend', filePath: null, isDirty: false, datesAsRecorded: false };
  s.getState().restoreDocuments([active, sleeping], 'actief');
  const payload = s.getState().documents.find(d => d.id === 'slapend')!.payload!;
  eq('4 slapend herstel: urenmaat', CONVERTED.map(n => [byName(payload.tasks, n).time.durationUnit, byName(payload.tasks, n).time.durationMinutes]),
    [['hours', 1440], ['hours', 1440], ['hours', 2400]]);
  eq('4 slapend herstel: vlag open', payload.minuteModelPending, true);
  eq('4 actief herstel: urenmaat', CONVERTED.map(n => byName(s.getState().tasks, n).time.durationUnit), ['hours', 'hours', 'hours']);
}

// 5. Een bestand mét minutenmodel: de omzetting zelf opent B5 (geen stille verschuiving).
{
  const parsed = readIFC(OLD_IFC);
  parsed.timeModel = 'MINUTES-1';
  const s = open(parsed);
  expectConverted('5 openen met minutenmodel', s);
  eq('5 openen met minutenmodel: B5', flags(s), { modus: false, open: false, verouderd: false, gewijzigd: true, events: 1, meldingen: 1 });
  s.getState().undo();
  eq('5 undo: modus en vlag, opgeslagen einde', [flags(s).modus, flags(s).open, byName(s.getState().tasks, 'Geerfd').time.earlyFinish],
    [true, true, VR_1300]);
}

if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
console.log(`B1a aan de laadgrens (knownbug 253): ${checks - errors.length}/${checks} groen`);
