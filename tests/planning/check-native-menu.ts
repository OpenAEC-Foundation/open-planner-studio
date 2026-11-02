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
  closest() { return null; }
  blur() { this.blurs++; }
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
assert.deepEqual(textCommands, ['undo', 'redo']);
assert.equal(S().tasks, tasks);

// De expliciet toegestane acties blijven de invoer eerst committen.
runNativeShortcut('file.save');
assert.equal(input.blurs, 1);
assert.equal(saves, 2);
let calculations = 0;
useAppStore.setState({ recalculate: () => { calculations++; } });
runNativeShortcut('file.recalculate');
assert.equal(input.blurs, 2);
assert.equal(calculations, 1);
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
