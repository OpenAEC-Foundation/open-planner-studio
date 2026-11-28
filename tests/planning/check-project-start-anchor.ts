import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();
const N = () => S().ui.notifications;
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
const clearAll = () => { for (const n of [...N()]) S().dismissNotification(n.id); };

const HOUR_CAL: Pick<WorkCalendar, 'workTime'> = {
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};

S().newProject();
S().setProject({ startDate: '2026-06-01' });
clearAll();

const tA = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-01', 5) });
const finishABefore = S().tasks.find(t => t.id === tA)!.time.scheduleFinish;
const tA2 = S().addTask({ name: 'A2', time: createDefaultTaskTime('2026-05-15', 3) });
const tC = S().addTask({ name: 'C', time: createDefaultTaskTime('2026-05-01', 2) });
const tB = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-05-01', 2) });
S().addSequence({ predecessorId: tC, successorId: tB, type: 'FINISH_START', lagDays: 0 } as Omit<Sequence, 'id'>);
const tD = S().addTask({
  name: 'D', time: createDefaultTaskTime('2026-05-01', 2),
  constraint: { type: 'SNET', date: '2026-05-10' },
});
const tE = S().addTask({ name: 'E', time: createDefaultTaskTime('2026-09-01', 2) });
const tAsap = S().addTask({
  name: 'Asap', time: createDefaultTaskTime('2026-05-01', 2), constraint: { type: 'ASAP' },
});
const tHammock = S().addTask({ name: 'Hammock', time: createDefaultTaskTime('2026-05-01', 2), isHammock: true });

const undoLenBeforeClamp = S().historyEvents.filter(event => event.state === 'applied').length;
S().setProject({ startDate: '2026-08-17' });

eq('01 A (wortel, geen voorganger/constraint) klemt naar de nieuwe startdatum',
  S().tasks.find(t => t.id === tA)?.time.scheduleStart, "2026-08-17T07:00");
eq('02 A2 klemt eveneens', S().tasks.find(t => t.id === tA2)?.time.scheduleStart, "2026-08-17T07:00");
eq('03 B (heeft een voorganger C) blijft ongemoeid', S().tasks.find(t => t.id === tB)?.time.scheduleStart, "2026-05-01T07:00");
eq('04 C (zelf ook wortel, geen voorganger/constraint) klemt', S().tasks.find(t => t.id === tC)?.time.scheduleStart, "2026-08-17T07:00");
eq('05 D (expliciete SNET-constraint) blijft ongemoeid ondanks een vroeg eigen anker',
  S().tasks.find(t => t.id === tD)?.time.scheduleStart, "2026-05-01T07:00");
eq('06 D.constraint zelf blijft ongemoeid', S().tasks.find(t => t.id === tD)?.constraint, { type: 'SNET', date: "2026-05-10T07:00" });
eq('07 E (eigen anker al ná de nieuwe startdatum) blijft ongemoeid', S().tasks.find(t => t.id === tE)?.time.scheduleStart, "2026-09-01T07:00");
eq('08 project.startDate is de nieuwe datum', S().project.startDate, '2026-08-17');
eq('09 precies ÉÉN undo-stap voor de hele klem-transactie (klem + startDate samen)', S().historyEvents.filter(event => event.state === 'applied').length, undoLenBeforeClamp + 1);
eq('L1: dateless ASAP blokkeert de klem niet', S().tasks.find(t => t.id === tAsap)?.time.scheduleStart, "2026-08-17T07:00");
eq('L2: de hammock-wortel wordt overgeslagen (eigen scheduleStart blijft ongemoeid)',
  S().tasks.find(t => t.id === tHammock)?.time.scheduleStart, "2026-05-01T07:00");

const aAfter = S().tasks.find(t => t.id === tA)!;
truthy('H3b: A.scheduleFinish is meegeschoven (≠ de waarde vóór de klem)', aAfter.time.scheduleFinish !== finishABefore);
truthy('H3b: A.scheduleFinish ligt nog steeds NÁ scheduleStart (geen finish<start)',
  aAfter.time.scheduleFinish > aAfter.time.scheduleStart);

eq('10 precies één melding', N().length, 1);
eq('11 severity info', N()[0]?.severity, 'info');
eq('12 messageKey', N()[0]?.messageKey, 'notifications.projectStartAnchorsClamped');
eq('13 count = precies de geklemde ankers (A, A2, C, Asap — niet B/D/E/Hammock)', N()[0]?.params, { count: 4 });
eq('14 dedupeKey', N()[0]?.dedupeKey, 'project-start-anchors-clamped');

eq('15 H3c: scheduleStale is af (runCPM draaide al mee)', S().scheduleStale, false);
truthy('16 H3c: er staat een vers cpmResult (geen undefined ná de klem)', !!S().cpmResult);

S().undo();
eq('20 undo herstelt project.startDate', S().project.startDate, '2026-06-01');
eq('21 undo herstelt het geklemde taakanker A', S().tasks.find(t => t.id === tA)?.time.scheduleStart, "2026-05-01T07:00");
eq('22 undo herstelt het geklemde taakanker A2', S().tasks.find(t => t.id === tA2)?.time.scheduleStart, "2026-05-15T07:00");
eq('23 undo herstelt het geklemde taakanker C', S().tasks.find(t => t.id === tC)?.time.scheduleStart, "2026-05-01T07:00");
eq('L3: de melding overleeft de undo (app-globaal, geen documentveld)', N().length, 1);
S().redo();
eq('24 redo klemt opnieuw', S().tasks.find(t => t.id === tA)?.time.scheduleStart, "2026-08-17T07:00");
eq('25 redo herstelt project.startDate', S().project.startDate, '2026-08-17');

S().newProject();
S().setProject({ startDate: '2026-06-01' });
S().addTask({ name: 'G1', time: createDefaultTaskTime('2026-05-01', 2) });
S().addTask({ name: 'G2', time: createDefaultTaskTime('2026-05-01', 2) });
S().addTask({ name: 'G3', time: createDefaultTaskTime('2026-05-01', 2) });
clearAll();
S().setProject({ startDate: '2026-08-17' });
eq('L4-voorwaarde: eerste klem telt 3', N()[0]?.params, { count: 3 });
const tF = S().addTask({ name: 'F', time: createDefaultTaskTime('2026-05-01', 2) });
S().setProject({ startDate: '2026-08-24' });
eq('L4: params vervangt (niet optelt) bij een herhaalde dedupeKey — het aantal van de LAATSTE call',
  N()[0]?.params, { count: 4 });
eq('L4: de dedupe-badge (count) telt wél de OCCURRENCES op', N()[0]?.count, 2);
eq('L4-controle: F is ook echt geklemd', S().tasks.find(t => t.id === tF)?.time.scheduleStart, "2026-08-24T07:00");

S().newProject();
S().setProject({ startDate: '2026-08-17' });
const t3 = S().addTask({ name: 'X', time: createDefaultTaskTime('2026-05-01', 5) });
clearAll();

S().setProject({ startDate: '2026-06-01' });
eq('30 een EERDERE startDate klemt niets', S().tasks.find(t => t.id === t3)?.time.scheduleStart, "2026-05-01T07:00");
eq('31 geen melding bij een eerdere startDate', N().length, 0);
eq('32 project.startDate is wél gewoon bijgewerkt', S().project.startDate, '2026-06-01');

clearAll();
const undoLenBeforeSame = S().historyEvents.filter(event => event.state === 'applied').length;
S().setProject({ startDate: '2026-06-01' });
eq('33 identieke startDate is een volledige no-op (geen undo-stap)', S().historyEvents.filter(event => event.state === 'applied').length, undoLenBeforeSame);
eq('34 geen melding bij een ongewijzigde startDate', N().length, 0);

S().newProject();
S().setProject({ startDate: '2026-06-01' });
const t3c = S().addTask({ name: 'Y', time: createDefaultTaskTime('2026-09-01', 2) });
clearAll();
S().setProject({ startDate: '2026-08-17' });
eq('35 niets te klemmen => geen melding', N().length, 0);
eq('36 taak Y blijft op zijn eigen (latere) anker', S().tasks.find(t => t.id === t3c)?.time.scheduleStart, "2026-09-01T07:00");

S().newProject();
S().setProject({ startDate: '2026-05-01' });
const t4 = S().addTask({ name: 'Geïmporteerde taak', time: createDefaultTaskTime('2026-05-01', 5) });
const loadedProject = { ...S().project, startDate: '2026-08-17' };
const loadedTasks = S().tasks;
clearAll();
S().loadState({
  project: loadedProject,
  calendar: createDefaultCalendar(),
  tasks: loadedTasks,
  sequences: [],
  resources: [],
  assignments: [],
});
eq('40 loadState klemt het geïmporteerde taakanker NIET', S().tasks.find(t => t.id === t4)?.time.scheduleStart, "2026-05-01T07:00");
eq('41 loadState vuurt de klem-melding niet af', N().some(n => n.messageKey === 'notifications.projectStartAnchorsClamped'), false);
eq('42 project.startDate komt wél gewoon over uit het geladen bestand', S().project.startDate, '2026-08-17');

S().newProject();
S().setCalendar({ ...S().calendar, ...HOUR_CAL } as WorkCalendar);
S().setProject({ startDate: '2026-08-17' });
const tH = S().addTask({ name: 'H', time: createDefaultTaskTime('2026-08-14', 3) });
const finishHBefore = S().tasks.find(t => t.id === tH)!.time.scheduleFinish;
clearAll();

S().setProject({ startDate: '2026-08-24' });

eq('50 uurmodus: het anker snapt naar de eerste werk-instant (08:00), geen kale middernacht',
  S().tasks.find(t => t.id === tH)?.time.scheduleStart, '2026-08-24T08:00');
eq('51 uurmodus-melding met precies 1 geklemd anker', N()[0]?.params, { count: 1 });
const hAfter = S().tasks.find(t => t.id === tH)!;
truthy('52 uurmodus H3b: scheduleFinish is meegeschoven', hAfter.time.scheduleFinish !== finishHBefore);
truthy('53 uurmodus H3b: scheduleFinish ligt nog steeds NÁ scheduleStart', hAfter.time.scheduleFinish > hAfter.time.scheduleStart);

S().newProject();
S().setProject({ startDate: '2026-06-01' });
eq('60 voorwaarde: de standaardprojectkalender is scalair (geen workTime)', S().calendar.workTime, undefined);
const tSd = S().addTask({ name: 'Sd', time: createDefaultTaskTime('2026-05-04', 2) });
const tSu = S().addTask({ name: 'Su', time: createDefaultTaskTime('2026-05-04T08:00', 4, 'hours') });
S().runCPM();
clearAll();

S().setProject({ startDate: '2026-08-17' });

const suAfter = S().tasks.find(t => t.id === tSu)!;
eq('61 scalaire kalender, uurtaak: anker = eerste werkmoment (07:00), geen kale middernacht',
  suAfter.time.scheduleStart, '2026-08-17T07:00');
eq('62 klem en solver kiezen hetzelfde moment (anker = door setProject herberekende earlyStart)',
  suAfter.time.earlyStart, suAfter.time.scheduleStart);
eq('63 scalaire kalender, dagtaak: kale datum zonder tijd (ongewijzigd)',
  S().tasks.find(t => t.id === tSd)?.time.scheduleStart, "2026-08-17T07:00");
eq('64 melding telt beide geklemde ankers', N()[0]?.params, { count: 2 });

if (diffs.length === 0) {
  console.log(`OK  project-start-anchor: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  project-start-anchor: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
