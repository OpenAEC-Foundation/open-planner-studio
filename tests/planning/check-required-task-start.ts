// Verplichte startdatum in de store — headless tegen de ECHTE Zustand-store en CPM-motor.
//
// Paneel, "Taak bewerken" en de extensie-API schreven een lege `scheduleStart` rechtstreeks via
// `updateTask` weg. De volgende berekening faalde dan voor het HELE project ("Ongeldige startdatum
// voor taak …"), en na opslaan + heropenen werd het anker stil "vandaag". Het raster weigert een lege
// start al met `required`; `updateTask` is het vangnet onder alle andere routes: het bestaande anker
// blijft staan, de rest van de patch gaat door, en een patch die alleen uit die lege start bestond
// levert geen undo-stap op.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const task = (id: string) => S().tasks.find(candidate => candidate.id === id)!;
const undoDepth = () => S().historyEvents.filter(event => event.state === 'applied').length;

S().setProject({ startDate: '2027-03-01' });
const idA = S().addTask({ name: 'Wapening' });
S().updateTask(idA, { time: { ...task(idA).time, scheduleStart: '2027-03-01T07:00' } });
S().runCPM();
eq('01 sanity: de start staat met tijd', task(idA).time.scheduleStart, '2027-03-01T07:00');
eq('01b sanity: het project rekent', S().cpmResult?.error ?? null, null);

// Precies de payload van het paneel (TaskTimeFields: `{ time: { ...task.time, scheduleStart: '' } }`).
const before = undoDepth();
S().updateTask(idA, { time: { ...task(idA).time, scheduleStart: '' } }, { coalesceKey: `taskfield:${idA}:time.scheduleStart` });
eq('02 een lege start wordt niet vastgelegd', task(idA).time.scheduleStart, '2027-03-01T07:00');
eq('02b en levert geen loze undo-stap op', undoDepth(), before);
S().runCPM();
eq('02c het project rekent nog', S().cpmResult?.error ?? null, null);

// Alleen spaties en een onleesbare tekst: evenmin een startanker.
S().updateTask(idA, { time: { ...task(idA).time, scheduleStart: '   ' } });
eq('03 alleen spaties wordt niet vastgelegd', task(idA).time.scheduleStart, '2027-03-01T07:00');
S().updateTask(idA, { time: { ...task(idA).time, scheduleStart: 'gisteren' } });
eq('03b een onleesbare start wordt niet vastgelegd', task(idA).time.scheduleStart, '2027-03-01T07:00');

// De dialoog stuurt de start MÉT andere velden mee: die gaan gewoon door, alleen de start blijft.
S().updateTask(idA, { name: 'Wapening vloer', time: { ...task(idA).time, scheduleStart: '', scheduleDuration: 6 } });
eq('04 de rest van de patch gaat door (naam)', task(idA).name, 'Wapening vloer');
eq('04b de rest van de patch gaat door (duur)', task(idA).time.scheduleDuration, 6);
eq('04c de start blijft staan', task(idA).time.scheduleStart, '2027-03-01T07:00');

// Een geldige start (met of zonder tijd) blijft gewoon werken.
S().updateTask(idA, { time: { ...task(idA).time, scheduleStart: '2027-05-17T07:00' } });
eq('05 een geldige start met tijd wordt vastgelegd', task(idA).time.scheduleStart, '2027-05-17T07:00');
S().updateTask(idA, { time: { ...task(idA).time, scheduleStart: '2027-05-18' } });
eq('05b een geldige kale datum wordt vastgelegd', task(idA).time.scheduleStart, '2027-05-18');
S().runCPM();
eq('05c het project rekent', S().cpmResult?.error ?? null, null);

if (diffs.length > 0) {
  for (const diff of diffs) console.log(`XX ${diff}`);
  console.error(`\nverplichte start: ${diffs.length} van ${checks} checks afwijkend`);
  process.exit(1);
} else {
  console.log(`OK verplichte start: ${checks} checks`);
  process.exit(0);
}
