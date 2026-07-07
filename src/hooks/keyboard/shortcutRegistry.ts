// Sneltoets-register (fase 2.10, golf 1) — DE ENIGE bron van waarheid voor alle globale
// sneltoetsen (bestaand + nieuw). `useKeyboardShortcuts` matcht hiertegen i.p.v. een handmatige
// if-keten; de overzichtsdialoog (Ctrl/Cmd+/, golf 3) rendert er rechtstreeks uit. Doel (user-eis,
// zie het ontwerpdocument): een toets toevoegen = één entry hier + één i18n-key — verder niets.
//
// Migratie-opmerkingen (golf 1, zie ook het eindrapport):
// - De productie-only "blokkeer-browser-sneltoets"-voorpoort in `useKeyboardShortcuts.ts`
//   (F5/Ctrl+Shift+S/Ctrl+S/Ctrl+O/Ctrl+N moeten de browser/webview vóór zijn, ook ver vóórdat een
//   isTypingTarget-check ooit gebeurt) is BEWUST ongemoeid gelaten — dat is losstaande
//   webview-hardening, geen "sneltoets-if-keten". De entries hieronder zijn wél de bron van
//   waarheid voor WAT die toetsen doen; de voorpoort roept dezelfde store-acties aan.
// - `Ctrl/Cmd+Shift+S` is in het HUIDIGE dev/test-gedrag NIET whitelisted voor invoervelden (dat
//   geldt alleen in productiebuilds, via de hierboven genoemde voorpoort). De entry hieronder is
//   dus bewust `allowInInput` NIET gezet — dat is byte-identiek aan de bestaande dev-gedraging.
// - Een paar bestaande combinaties negeerden Alt (bv. Ctrl+Alt+S sloeg ook al op via de oude
//   `ctrl && key==='s'`-check, zonder Alt te toetsen). De matcher hieronder toetst Alt/Shift/mod
//   altijd EXACT (afwezig ⇒ moet losgelaten zijn) — een bewuste opschoning die aansluit bij het
//   "bewust conflictarm"-ontwerpdoel; geen van de gedocumenteerde/bedoelde sneltoetsen verandert,
//   alleen toevallige Alt-doorlek bij niet-bedoelde combinaties verdwijnt.
//
// Volgorde is betekenisvol: `useKeyboardShortcuts` stopt bij de EERSTE match (net als de oude
// if-keten). `view.exitFullscreen` (Escape tijdens presentatie) staat daarom vóór
// `edit.deselect` (de "gewone" Escape) — anders zou een kale Escape-entry zonder `when` de
// presentatie-afsluiting nooit meer bereiken.

import { useAppStore } from '@/state/appStore';
import type { AppState } from '@/state/appStore';
import { isTreeMode } from '@/engine/view/visibleRows';
import { createDefaultTaskTime } from '@/types/task';
import { formatDate } from '@/utils/dateUtils';
import { computeScrollToDate } from '@/utils/ganttViewport';
import i18n from '@/i18n/config';

export type ShortcutCategory = 'file' | 'edit' | 'structure' | 'view' | 'nav';

export interface ShortcutCombo {
  key: string;                 // KeyboardEvent.key, case-insensitive vergeleken
  mod?: boolean;                // Ctrl (Win/Linux) of Cmd (mac) — e.ctrlKey || e.metaKey
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDef {
  id: string;                                 // stabiel, bv. 'edit.editTask'
  combo: ShortcutCombo;
  category: ShortcutCategory;
  labelKey: string;                           // i18n-key voor de overzichtsdialoog (golf 3)
  run: (store: AppState) => void;             // roept bestaande store-acties aan
  allowInInput?: boolean;                     // werkt óók in invoervelden (zoals Ctrl+S/F5/F11)
  when?: () => boolean;                       // optionele extra-guard
  displayOnly?: boolean;                      // alleen tonen in de dialoog, niet zelf afhandelen
  /** Uitzondering, byte-identiek aan de HUIDIGE `edit.deselect`-gedraging: het origineel riep hier
   *  nooit `e.preventDefault()`. Voor elke andere entry wordt preventDefault altijd aangeroepen. */
  skipPreventDefault?: boolean;
}

/** Golf 1 (F2/Insert/Ctrl+A/Alt+↑/↓): "niet in een dialoog" — deze structuur-acties werken
 *  alleen als de aandacht op de planning zelf ligt, niet terwijl een dialoog/overlay open staat.
 *  Puur redelijke, expliciete keuze (het ontwerp specificeert geen exacte lijst) — analoog aan de
 *  bestaande Escape-sluitlijst in `edit.deselect` hieronder, die ook met de hand is opgesomd. */
function hasBlockingDialogOpen(): boolean {
  const ui = useAppStore.getState().ui;
  return (
    ui.showTaskDialog || ui.showProjectSettings || ui.showProjectInfoDialog ||
    ui.showSettingsDialog || ui.showCalendarDialog || ui.showUpdateDialog ||
    ui.showNewProjectDialog || ui.showFeedbackDialog || ui.showStructureDialog ||
    ui.showLevelingDialog || ui.showBaselineDialog || ui.showColumnsDialog ||
    ui.showFilterDialog || ui.showLayoutsDialog || ui.showProjectOverview ||
    ui.presentationMode
  );
}

function hasSelection(): boolean {
  return useAppStore.getState().selectedTaskIds.length > 0;
}

const documentSwitchShortcuts: ShortcutDef[] = Array.from({ length: 9 }, (_, i) => {
  const n = i + 1;
  return {
    id: `nav.switchDocument${n}`,
    combo: { key: String(n), mod: true },
    category: 'nav',
    labelKey: 'shortcuts.nav.switchDocument',
    // Byte-identiek: het origineel riep altijd preventDefault() bij Ctrl+1..9 (ook zonder zóveel
    // open documenten) — de "bestaat dit document?"-guard zat in de actie zelf, niet ervóór.
    run: (store) => {
      const doc = store.documents[n - 1];
      if (doc) store.switchDocument(doc.id);
    },
  };
});

export const SHORTCUTS: ShortcutDef[] = [
  // --- Bestand ---
  {
    id: 'file.recalculate',
    combo: { key: 'F5' },
    category: 'file',
    labelKey: 'shortcuts.file.recalculate',
    allowInInput: true,
    run: (store) => store.runCPM(),
  },
  {
    id: 'file.save',
    combo: { key: 's', mod: true },
    category: 'file',
    labelKey: 'shortcuts.file.save',
    allowInInput: true,
    run: (store) => store.saveFile(),
  },
  {
    id: 'file.saveAs',
    combo: { key: 's', mod: true, shift: true },
    category: 'file',
    labelKey: 'shortcuts.file.saveAs',
    run: (store) => store.saveFileAs(),
  },
  {
    id: 'file.open',
    combo: { key: 'o', mod: true },
    category: 'file',
    labelKey: 'shortcuts.file.open',
    run: (store) => store.openFile(),
  },
  {
    id: 'file.newProject',
    combo: { key: 'n', mod: true },
    category: 'file',
    labelKey: 'shortcuts.file.newProject',
    run: (store) => store.setUI({ showNewProjectDialog: true }),
  },

  // --- Weergave: presentatie (Escape-prioriteit, zie bestandskop) ---
  {
    id: 'view.toggleFullscreen',
    combo: { key: 'F11' },
    category: 'view',
    labelKey: 'shortcuts.view.toggleFullscreen',
    allowInInput: true,
    run: (store) => store.setPresentationMode(!store.ui.presentationMode),
  },
  {
    id: 'view.exitFullscreen',
    combo: { key: 'Escape' },
    category: 'view',
    labelKey: 'shortcuts.view.exitFullscreen',
    allowInInput: true,
    when: () => useAppStore.getState().ui.presentationMode,
    run: (store) => store.setPresentationMode(false),
  },

  // --- Bewerken ---
  {
    id: 'edit.copy',
    combo: { key: 'c', mod: true },
    category: 'edit',
    labelKey: 'shortcuts.edit.copy',
    when: hasSelection,
    run: (store) => store.copyTasks(),
  },
  {
    id: 'edit.paste',
    combo: { key: 'v', mod: true },
    category: 'edit',
    labelKey: 'shortcuts.edit.paste',
    run: (store) => store.pasteTasks(),
  },
  {
    id: 'edit.undo',
    combo: { key: 'z', mod: true },
    category: 'edit',
    labelKey: 'shortcuts.edit.undo',
    run: (store) => store.undo(),
  },
  {
    id: 'edit.redo',
    combo: { key: 'y', mod: true },
    category: 'edit',
    labelKey: 'shortcuts.edit.redo',
    run: (store) => store.redo(),
  },
  {
    id: 'edit.redoShiftZ',
    combo: { key: 'z', mod: true, shift: true },
    category: 'edit',
    labelKey: 'shortcuts.edit.redo', // zelfde actie/label als edit.redo — alternatieve combinatie
    run: (store) => store.redo(),
  },
  {
    id: 'edit.delete',
    combo: { key: 'Delete' },
    category: 'edit',
    labelKey: 'shortcuts.edit.delete',
    when: hasSelection,
    run: (store) => { for (const id of store.selectedTaskIds) store.deleteTask(id); },
  },
  {
    id: 'edit.deleteBackspace',
    combo: { key: 'Backspace' },
    category: 'edit',
    labelKey: 'shortcuts.edit.delete',
    when: hasSelection,
    run: (store) => { for (const id of store.selectedTaskIds) store.deleteTask(id); },
  },
  // Let op volgorde: MOET na `view.exitFullscreen` staan (zie bestandskop).
  {
    id: 'edit.deselect',
    combo: { key: 'Escape' },
    category: 'edit',
    labelKey: 'shortcuts.edit.deselect',
    skipPreventDefault: true, // byte-identiek: het origineel riep hier nooit e.preventDefault()
    run: (store) => {
      store.deselectAll();
      store.setUI({
        showTaskDialog: false, editingTaskId: null, showDependencyMode: false,
        showProjectOverview: false, pendingCloseDocId: null, traceMode: 'off',
      });
    },
  },

  // --- Structuur (indent/outdent bestonden al; golf 1 voegt insert/milestone/reorder toe) ---
  {
    id: 'structure.indent',
    combo: { key: 'ArrowRight', alt: true, shift: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.indent',
    when: hasSelection,
    run: (store) => { if (isTreeMode(store.view)) store.indentTasks(store.selectedTaskIds); },
  },
  {
    id: 'structure.outdent',
    combo: { key: 'ArrowLeft', alt: true, shift: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.outdent',
    when: hasSelection,
    run: (store) => { if (isTreeMode(store.view)) store.outdentTasks(store.selectedTaskIds); },
  },
  // Aliassen (user-besluit tijdens golf 2): Alt+→/← naast de MS Project-conventie Alt+Shift+→/←
  // hierboven (die blijft bestaan). Zelfde `run`/`when` — puur een extra combo voor dezelfde actie.
  // Exact-modifier-match in `matchesCombo` houdt deze en de Alt+Shift-variant strikt gescheiden.
  {
    id: 'structure.indentAlt',
    combo: { key: 'ArrowRight', alt: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.indent',
    when: hasSelection,
    run: (store) => { if (isTreeMode(store.view)) store.indentTasks(store.selectedTaskIds); },
  },
  {
    id: 'structure.outdentAlt',
    combo: { key: 'ArrowLeft', alt: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.outdent',
    when: hasSelection,
    run: (store) => { if (isTreeMode(store.view)) store.outdentTasks(store.selectedTaskIds); },
  },
  {
    id: 'structure.insertAbove',
    combo: { key: 'Insert' },
    category: 'structure',
    labelKey: 'shortcuts.structure.insertAbove',
    when: () => !hasBlockingDialogOpen(),
    run: (store) => {
      const startDate = store.project.startDate || formatDate(new Date());
      const name = i18n.t('defaultTask', { ns: 'task' });
      const anchorId = store.selectedTaskIds[0];
      const time = createDefaultTaskTime(startDate, 5);
      if (anchorId) {
        store.addTask({ name, time, position: { anchorId, where: 'above' } });
      } else {
        store.addTask({ name, time });
      }
    },
  },
  {
    id: 'structure.addMilestone',
    combo: { key: 'm', mod: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.addMilestone',
    when: () => !hasBlockingDialogOpen(),
    run: (store) => {
      const startDate = store.project.startDate || formatDate(new Date());
      store.addTask({
        name: i18n.t('defaultMilestone', { ns: 'task' }),
        isMilestone: true,
        taskType: 'ATTENDANCE',
        time: createDefaultTaskTime(startDate, 0),
      });
    },
  },
  {
    id: 'structure.moveUp',
    combo: { key: 'ArrowUp', alt: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.moveUp',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: (store) => {
      const id = store.selectedTaskIds[0];
      if (id) store.reorderSibling(id, 'up');
    },
  },
  {
    id: 'structure.moveDown',
    combo: { key: 'ArrowDown', alt: true },
    category: 'structure',
    labelKey: 'shortcuts.structure.moveDown',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: (store) => {
      const id = store.selectedTaskIds[0];
      if (id) store.reorderSibling(id, 'down');
    },
  },
  {
    id: 'edit.editTask',
    combo: { key: 'F2' },
    category: 'edit',
    labelKey: 'shortcuts.edit.editTask',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: (store) => {
      const id = store.selectedTaskIds[0];
      if (id) store.setUI({ showTaskDialog: true, editingTaskId: id });
    },
  },
  {
    id: 'edit.selectAll',
    combo: { key: 'a', mod: true },
    category: 'edit',
    labelKey: 'shortcuts.edit.selectAll',
    when: () => !hasBlockingDialogOpen(),
    run: (store) => store.selectAllTasks(),
  },

  // --- Weergave: zoom (Ctrl+=/-) + rapport-navigatie + sneltoetsen-overzicht ---
  {
    id: 'view.zoomIn',
    combo: { key: '=', mod: true },
    category: 'view',
    labelKey: 'shortcuts.view.zoomIn',
    run: (store) => store.setZoom(store.view.zoom + 10),
  },
  {
    id: 'view.zoomOut',
    combo: { key: '-', mod: true },
    category: 'view',
    labelKey: 'shortcuts.view.zoomOut',
    run: (store) => store.setZoom(store.view.zoom - 10),
  },
  {
    id: 'view.showShortcuts',
    combo: { key: '/', mod: true },
    category: 'view',
    labelKey: 'shortcuts.view.showShortcuts',
    run: (store) => store.setUI({ showShortcutsDialog: true }),
  },

  // --- Navigatie ---
  {
    id: 'nav.reportTab',
    combo: { key: 'p', mod: true },
    category: 'nav',
    labelKey: 'shortcuts.nav.reportTab',
    run: (store) => store.setUI({ activeRibbonTab: 'report' }),
  },
  ...documentSwitchShortcuts,
  {
    id: 'nav.scrollToToday',
    combo: { key: 'Home', mod: true },
    category: 'nav',
    labelKey: 'shortcuts.nav.scrollToToday',
    run: (store) => {
      const scrollX = computeScrollToDate(undefined, store);
      store.setScroll(scrollX, store.view.scrollY);
    },
  },

  // --- displayOnly: leven functioneel in useZoomShortcuts.ts, hier alleen voor de
  //     overzichtsdialoog (golf 3) zodat die compleet is zonder een dubbele handler. ---
  {
    id: 'view.zoomInBare',
    combo: { key: '=' }, // toont "+/=" — useZoomShortcuts matcht zelf zowel '+' als '='
    category: 'view',
    labelKey: 'shortcuts.view.zoomInBare',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
  {
    id: 'view.zoomOutBare',
    combo: { key: '-' },
    category: 'view',
    labelKey: 'shortcuts.view.zoomOutBare',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
  {
    id: 'view.zoomResetBare',
    combo: { key: '0' },
    category: 'view',
    labelKey: 'shortcuts.view.zoomResetBare',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
  {
    id: 'view.zoomFitBare',
    combo: { key: '0', mod: true },
    category: 'view',
    labelKey: 'shortcuts.view.zoomFitBare',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
];

/** Vergelijkt een KeyboardEvent met een combo: elk veld moet EXACT overeenkomen (afwezig ⇒ moet
 *  losgelaten zijn). `key` case-insensitief (matcht zowel 'z' als 'Z'; Shift wordt apart getoetst
 *  via `combo.shift`, niet via de casing van `e.key`). */
export function matchesCombo(e: KeyboardEvent, combo: ShortcutCombo): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (Boolean(combo.mod) !== mod) return false;
  if (Boolean(combo.shift) !== e.shiftKey) return false;
  if (Boolean(combo.alt) !== e.altKey) return false;
  return e.key.toLowerCase() === combo.key.toLowerCase();
}
