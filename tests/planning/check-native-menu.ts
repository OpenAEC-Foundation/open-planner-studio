// Native menuacties headless tegen de echte store: geen alternatieve document-/undo-route.
import './domStub';
import assert from 'node:assert/strict';
import { useAppStore } from '@/state/appStore';
import { SHORTCUTS } from '@/hooks/keyboard/shortcutRegistry';
import { NATIVE_SHORTCUT_IDS, openNativeSettings, runNativeShortcut } from '@/hooks/keyboard/nativeMenuActions';

// Alleen focus is hier gestubd. Echte tekstgeschiedenis en blur worden in WebKit gecontroleerd.
const g = globalThis as unknown as Record<string, unknown>;
g.HTMLElement = class {};
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
// Een wachtende gebruikersvraag bevriest ook native Opslaan, net als de sneltoetsvoorpoort.
useAppStore.setState(s => ({ ui: { ...s.ui, pendingActualStartQuestion: {} as NonNullable<typeof s.ui.pendingActualStartQuestion> } }));
runNativeShortcut('file.save');
openNativeSettings();
assert.equal(saves, 1);
assert.equal(S().ui.showSettingsDialog, false);
useAppStore.setState(s => ({ ui: { ...s.ui, pendingActualStartQuestion: null } }));
console.log('OK native menu: bestaande acties, undo/redo, modale bewaking en opslaan');
