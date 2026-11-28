import './domStub';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useAppStore } from '@/state/appStore';
import { refusalNotice } from '@/state/refusalNotice';
import { addTaskNearSelection } from '@/state/taskInsertActions';

const S = () => useAppStore.getState();
const N = () => S().ui.notifications;
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const clearAll = () => { for (const n of [...N()]) S().dismissNotification(n.id); };
const keys = () => N().map(n => n.messageKey);
const weiger = () => S().notify(refusalNotice({ messageKey: 'notifications.relationDuplicate' }));
const echteFout = () => S().notify({ severity: 'error', messageKey: 'notifications.saveFailed' });
const info = () => S().notify({ severity: 'info', messageKey: 'notifications.statusDateSetToday', params: { date: 'x' } });
const strookOpen = () => S().ui.structureLockedNotice > S().ui.structureLockedClearedAt;

function opzet(): string {
  S().newDocument();
  clearAll();
  const id = S().addTask({ name: 'A' });
  S().updateTask(id, { name: 'B' });
  return id;
}

{
  const id = opzet();
  weiger();
  echteFout();
  info();
  eq('1a opzet: drie meldingen', keys(), ['notifications.relationDuplicate', 'notifications.saveFailed', 'notifications.statusDateSetToday']);
  S().undo();
  eq('1b undo draait terug', S().tasks.find(t => t.id === id)?.name, 'A');
  eq('1c undo wist de weigering, de echte fout en de info blijven', keys(), ['notifications.saveFailed', 'notifications.statusDateSetToday']);
  eq('1d de info houdt zijn eigen timer (blijft info, niet sticky)', [N()[1]?.severity, N()[1]?.sticky ?? false], ['info', false]);
}

{
  const id = opzet();
  S().undo();
  clearAll();
  weiger();
  echteFout();
  S().redo();
  eq('2a redo zet de bewerking terug', S().tasks.find(t => t.id === id)?.name, 'B');
  eq('2b redo wist de weigering, de echte fout blijft', keys(), ['notifications.saveFailed']);
}

{
  S().newDocument();
  clearAll();
  weiger();
  S().undo();
  eq('3a undo zonder stap laat de weigering staan', keys(), ['notifications.relationDuplicate']);
  S().redo();
  eq('3b redo zonder stap laat de weigering staan', keys(), ['notifications.relationDuplicate']);
}

{
  opzet();
  weiger();
  S().undo();
  weiger();
  eq('4a een weigering ná de undo blijft staan', keys(), ['notifications.relationDuplicate']);
}

{
  S().newDocument();
  const docA = S().activeDocumentId;
  clearAll();
  weiger();
  echteFout();
  S().newDocument();
  const docB = S().activeDocumentId;
  eq('5a nieuw document wist de weigering, de echte fout blijft', keys(), ['notifications.saveFailed']);
  S().switchDocument(docA);
  eq('5b terugwisselen brengt de weigering niet terug', keys(), ['notifications.saveFailed']);
  clearAll();
  weiger();
  S().switchDocument(docB);
  eq('5c tabwissel wist de weigering', keys(), []);
  weiger();
  S().closeDocument(docB);
  eq('5d het actieve document sluiten wist de weigering', keys(), []);
  weiger();
  S().duplicateDocument();
  eq('5e een kopie openen wist de weigering', keys(), []);
}

{
  S().newDocument();
  clearAll();
  weiger();
  const HERE = fileURLToPath(new URL('.', import.meta.url));
  const ifc = readFileSync(join(HERE, '..', '..', 'public', 'examples', 'showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const docVoor = S().activeDocumentId;
  await S().openExampleFromString(ifc, 'voorbeeld.ifc');
  eq('6a opzet: het voorbeeld hergebruikt het lege tabblad', S().activeDocumentId, docVoor);
  eq('6b openen in hetzelfde tabblad wist de weigering', N().filter(n => n.refusal).length, 0);
}

{
  opzet();
  S().notifyStructureLocked();
  eq('7a opzet: strook open', strookOpen(), true);
  S().undo();
  eq('7b undo sluit de strook', strookOpen(), false);
  S().notifyStructureLocked();
  eq('7c een poging ná de undo opent hem weer', strookOpen(), true);
  S().redo();
  eq('7d redo sluit de strook', strookOpen(), false);
  S().notifyStructureLocked();
  S().newDocument();
  eq('7e documentwissel sluit de strook', strookOpen(), false);
}

{
  S().newDocument();
  clearAll();
  const a = S().addTask({ name: 'A' });
  S().addTask({ name: 'B' });
  S().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'desc' }]);
  S().selectTasks([a], false);
  addTaskNearSelection({ name: 'Nieuw' });
  eq('8a *Taak* gesorteerd ⇒ rode toast', N().map(n => [n.messageKey, n.severity, n.refusal]), [['notifications.taskAddedAtEnd', 'error', true]]);
  eq('8b en geen strook', strookOpen(), false);
  S().undo();
  eq('8c undo (de nieuwe taak weg) ⇒ toast weg', [S().tasks.some(t => t.name === 'Nieuw'), N().length], [false, 0]);
  S().setSort([]);
}

if (diffs.length > 0) {
  console.log(`XX  refusal-lifetime-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  refusal-lifetime-check: ${checks} checks`);
