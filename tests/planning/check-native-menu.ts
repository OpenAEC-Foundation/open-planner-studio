// Native menuacties headless tegen de echte store: geen alternatieve document-/undo-route.
import './domStub';
import assert from 'node:assert/strict';
import { useAppStore } from '@/state/appStore';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { NATIVE_SHORTCUT_IDS, openNativeSettings, runNativeShortcut } from '@/hooks/keyboard/nativeMenuActions';

// Alleen focus is hier gestubd. Echte tekstgeschiedenis en blur horen bij de browsertests.
const g = globalThis as unknown as Record<string, unknown>;
class FocusedInput {
  tagName = 'INPUT';
  dataset: Record<string, string> = {};
  isConnected = true;
  blurs = 0;
  onBlur?: () => void;
  closest() { return null; }
  blur() { this.blurs++; this.onBlur?.(); }
  focus() { /* Alleen focusherstel; geen nagebootste tekstgeschiedenis. */ }
}
g.HTMLElement = FocusedInput;
Object.defineProperty(document, 'activeElement', { value: null, configurable: true });
const S = () => useAppStore.getState();
for (const id of NATIVE_SHORTCUT_IDS) assert.ok(SHORTCUTS.some(s => s.id === id), id);
S().newProject();
S().setUI({ showWelcomeDialog: false, showTourOverlay: false, showTutorialOffer: false });
const task = S().addTask({ name: 'Fundering' });
runNativeShortcut('edit.undo');
assert.equal(S().tasks.some(t => t.id === task), false);
runNativeShortcut('edit.redoShiftZ');
assert.equal(S().tasks.some(t => t.id === task), true);
S().setUI({ showSettingsDialog: true });
runNativeShortcut('edit.undo');
assert.equal(S().tasks.some(t => t.id === task), true, 'undo achter modale instellingen');
runNativeShortcut('file.newProject');
assert.equal(S().ui.showNewProjectDialog, false, 'geen tweede dialoog via Nieuw');
S().setUI({ showSettingsDialog: false });

// Zonder tekstfocus selecteert het menu taken, met dezelfde dialoogbewaking als Cmd+A.
const secondTask = S().addTask({ name: 'Ruwbouw' });
S().selectTask(task);
runNativeShortcut('edit.selectAll');
assert.deepEqual(new Set(S().selectedTaskIds), new Set([task, secondTask]));
S().selectTask(task);
S().setUI({ showSettingsDialog: true });
runNativeShortcut('edit.selectAll');
assert.deepEqual(S().selectedTaskIds, [task], 'geen taakselectie achter een dialoog');
S().setUI({ showSettingsDialog: false });
runNativeShortcut('file.newProject');
assert.equal(S().ui.showNewProjectDialog, true);
S().setUI({ showNewProjectDialog: false });
openNativeSettings();
assert.equal(S().ui.showSettingsDialog, true);
S().setUI({ showSettingsDialog: false });

// De opslaanroute moet de bestaande saveFile/saveFileAs gebruiken, met de verse store.
let saves = 0;
let savesAs = 0;
useAppStore.setState({ saveFile: async () => { saves++; }, saveFileAs: async () => { savesAs++; } });
runNativeShortcut('file.save');
runNativeShortcut('file.saveAs');
assert.equal(saves, 1);
assert.equal(savesAs, 1);

// Een nog niet gecommitteerde veldbewerking mag niet verdwijnen door Rapport of Help.
const input = new FocusedInput();
Object.defineProperty(document, 'activeElement', { value: input, configurable: true });
S().setUI({ activeRibbonTab: 'start' });
for (const id of ['nav.reportTab', 'nav.help', 'file.newProject', 'file.open', 'view.showShortcuts'] as const) {
  runNativeShortcut(id);
  assert.equal(S().ui.activeRibbonTab, 'start', `${id} verlaat het invoerveld niet`);
  assert.equal(S().ui.showNewProjectDialog, false);
  assert.equal(S().ui.showShortcutsDialog, false);
}
assert.equal(input.blurs, 0, 'geblokkeerde acties committen de draft niet');

// Tekst-undo/redo blijft bij het veld en raakt de planningsgeschiedenis niet.
const textCommands: string[] = [];
Object.defineProperty(document, 'execCommand', { value: (command: string) => { textCommands.push(command); }, configurable: true });
const tasks = S().tasks;
runNativeShortcut('edit.undo');
runNativeShortcut('edit.redoShiftZ');
runNativeShortcut('edit.selectAll');
assert.deepEqual(textCommands, ['undo', 'redo', 'selectAll']);
assert.equal(S().tasks, tasks);
assert.deepEqual(S().selectedTaskIds, [task], 'tekstselectie wijzigt de taakselectie niet');
S().setUI({ showSettingsDialog: true });
runNativeShortcut('edit.selectAll');
assert.deepEqual(textCommands, ['undo', 'redo', 'selectAll', 'selectAll'], 'tekstselectie werkt ook binnen een dialoog');
assert.deepEqual(S().selectedTaskIds, [task]);
S().setUI({ showSettingsDialog: false });

// De expliciet toegestane acties blijven de invoer eerst committen.
runNativeShortcut('file.save');
assert.equal(input.blurs, 1);
assert.equal(saves, 2);
let calculations = 0;
useAppStore.setState({ recalculate: () => { calculations++; } });
runNativeShortcut('file.recalculate');
assert.equal(input.blurs, 2);
assert.equal(calculations, 1);

// Native Opslaan als volgt de productie-sneltoets: commit eerst, lees daarna de verse store.
// De blur schrijft dezelfde duurwijziging als een veld dat pas bij focusverlies commit.
const setDuration = (duration: number) => {
  const current = S().tasks.find(t => t.id === task)!;
  S().updateTask(task, { time: { ...current.time, scheduleDuration: duration } });
};
setDuration(5);
input.onBlur = () => { setDuration(7); };
let savedDuration: number | undefined;
useAppStore.setState({ saveFileAs: async () => {
  savesAs++;
  savedDuration = S().tasks.find(t => t.id === task)!.time.scheduleDuration;
} });
runNativeShortcut('file.saveAs');
assert.equal(input.blurs, 3, 'Opslaan als commit het actieve invoerveld');
assert.equal(savesAs, 2, 'Opslaan als voert de opslagactie precies één keer uit');
assert.equal(savedDuration, 7, 'Opslaan als leest de gecommitteerde duur, niet de oude 5');

// De wachtende-vraagpoort blijft sterker dan de invoeruitzondering voor Opslaan als.
useAppStore.setState(s => ({ ui: { ...s.ui, pendingActualStartQuestion: {} as NonNullable<typeof s.ui.pendingActualStartQuestion> } }));
runNativeShortcut('file.saveAs');
const textCommandCount = textCommands.length;
runNativeShortcut('edit.selectAll');
assert.equal(textCommands.length, textCommandCount, 'een wachtende vraag blokkeert ook tekstselectie');
assert.equal(input.blurs, 3);
assert.equal(savesAs, 2);
useAppStore.setState(s => ({ ui: { ...s.ui, pendingActualStartQuestion: null } }));

// Presentatie commit vóór de actie die de zijpanelen verwijdert, precies zoals F11.
const previousWindow = g.window;
g.window = { __TAURI_INTERNALS__: {} };
const setPresentationMode = S().setPresentationMode;
let presentationDuration: number | undefined;
useAppStore.setState({ setPresentationMode: on => {
  presentationDuration = S().tasks.find(t => t.id === task)!.time.scheduleDuration;
  setPresentationMode(on);
} });
input.onBlur = () => { setDuration(9); };
runNativeShortcut('view.toggleFullscreen');
assert.equal(input.blurs, 4, 'Presentatie commit het actieve veld');
assert.equal(presentationDuration, 9, 'Presentatie leest de gecommitteerde duur');
assert.equal(S().ui.presentationMode, true);
setPresentationMode(false);
useAppStore.setState({ setPresentationMode });
if (previousWindow === undefined) delete g.window;
else g.window = previousWindow;
input.onBlur = undefined;
Object.defineProperty(document, 'activeElement', { value: null, configurable: true });
runNativeShortcut('nav.reportTab');
assert.equal(S().ui.activeRibbonTab, 'report', 'Rapport werkt buiten invoer');
runNativeShortcut('nav.help');
assert.equal(S().ui.activeRibbonTab, 'file', 'Help werkt buiten invoer');
assert.equal(S().ui.backstageSection, 'help');
// Een wachtende gebruikersvraag bevriest ook native Opslaan, net als de sneltoetsvoorpoort.
useAppStore.setState(s => ({ ui: { ...s.ui, pendingActualStartQuestion: {} as NonNullable<typeof s.ui.pendingActualStartQuestion> } }));
runNativeShortcut('file.save');
openNativeSettings();
assert.equal(saves, 2);
assert.equal(S().ui.showSettingsDialog, false);
useAppStore.setState(s => ({ ui: { ...s.ui, pendingActualStartQuestion: null } }));
console.log('OK native menu: bestaande acties, invoerbewaking, tekst-undo/redo, modale bewaking en opslaan');
