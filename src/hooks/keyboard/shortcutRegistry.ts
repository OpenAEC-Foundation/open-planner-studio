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
import { isAnyDialogOpen } from '@/hooks/useDialogKeys';
// DOM-vrij en JSX-vrij bij constructie (zie de kop van dat bestand): de anker- en weergaveregels
// voor nieuwe taken wonen daar zodat sneltoets, menu, lintknop én regressiebatterij letterlijk
// dezelfde functie draaien.
import { insertTaskRelativeToScope } from '@/state/taskInsertActions';
import { computeScrollToDate } from '@/utils/ganttViewport';
// K-item 34: de acties die het lint EN het toetsenbord delen, staan nu één keer gedefinieerd.
import { COMMANDS } from '@/state/commands';
import i18n from '@/i18n/config';

export type ShortcutCategory = 'file' | 'edit' | 'structure' | 'view' | 'nav' | 'grid';

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
 *  bestaande Escape-sluitlijst in `edit.deselect` hieronder, die ook met de hand is opgesomd.
 *  Fix-golf (onderdeel 3, item 2): `showTourOverlay`/`showWelcomeDialog` toegevoegd — beide zijn
 *  net zo goed modale overlays (welkomstdialoog: los dialoogvenster; rondleiding: sinds de
 *  fix voor doorklik-corruptie een écht modale overlay, zie TourOverlay.tsx) en ontbraken hier
 *  per abuis, waardoor bv. F2/Insert/Ctrl+A tijdens de rondleiding gewoon doorvuurden. */
export function hasBlockingDialogOpen(): boolean {
  const ui = useAppStore.getState().ui;
  return (
    ui.showTaskDialog || ui.showProjectSettings || ui.showProjectInfoDialog ||
    ui.showSettingsDialog || ui.showCalendarDialog || ui.showUpdateDialog ||
    ui.showNewProjectDialog || ui.showFeedbackDialog || ui.showStructureDialog ||
    ui.showLevelingDialog || ui.showBaselineDialog || ui.showColumnsDialog ||
    ui.showFilterDialog || ui.showLayoutsDialog || ui.showProjectOverview ||
    ui.presentationMode || ui.showTourOverlay || ui.showWelcomeDialog ||
    // K-item 38: de toestemmingsvraag bij een extensie-installatie is net zo goed modaal — hij
    // wacht op een antwoord en er mag intussen niets aan de planning gebeuren.
    ui.pendingExtensionConsent !== null
  );
}

function hasSelection(): boolean {
  return useAppStore.getState().selectedTaskIds.length > 0;
}

/** Fix-golf (onderdeel 3, item 2), gebruikt door `view.showShortcuts` hieronder: BEWUST geen
 *  hergebruik van `hasBlockingDialogOpen()` — die functie retourneert nu óók `true` voor allerlei
 *  ándere dialogen (TaskDialog, SettingsDialog, …), terwijl Ctrl+/ juist tijdens die dialogen moet
 *  blijven werken (bestaand, gewenst gedrag — zie de toelichting bij de entry zelf). Deze guard is
 *  bewust smaller: alléén de rondleiding/welkomstdialoog blokkeren Ctrl+/. */
function isTourOrWelcomeOpen(): boolean {
  const ui = useAppStore.getState().ui;
  return ui.showTourOverlay || ui.showWelcomeDialog;
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
    // Golf 3 (i18n-hergebruik): zelfde tekst als de "Bereken"-ribbonknop (F5 doet exact dat).
    labelKey: 'menu:ribbon.calculate',
    allowInInput: true,
    run: (store) => store.runCPM(),
  },
  {
    id: 'file.save',
    combo: { key: 's', mod: true },
    category: 'file',
    labelKey: 'menu:ribbon.save',
    allowInInput: true,
    run: COMMANDS.save.run,
  },
  {
    id: 'file.saveAs',
    combo: { key: 's', mod: true, shift: true },
    category: 'file',
    labelKey: 'menu:backstage.saveAs',
    run: COMMANDS.saveAs.run,
  },
  {
    id: 'file.open',
    combo: { key: 'o', mod: true },
    category: 'file',
    labelKey: 'menu:ribbon.open',
    run: COMMANDS.open.run,
  },
  {
    id: 'file.newProject',
    combo: { key: 'n', mod: true },
    category: 'file',
    labelKey: 'menu:commands.newProject',
    // S2 (V1/V3-vondst, dialoog-stapeling): zonder guard opende Ctrl+N de projectwizard óver een
    // reeds openstaande dialoog heen — twee overlays gestapeld, de wizard onbereikbaar, en één
    // Escape sloot dan meteen beide. `isAnyDialogOpen()` is de generieke stapel-check uit
    // `useDialogKeys` (zie daar); dit is dezelfde guard als de productie-voorpoort hieronder in
    // `useKeyboardShortcuts.ts`.
    when: () => !isAnyDialogOpen(),
    run: (store) => store.setUI({ showNewProjectDialog: true }),
  },

  // --- Weergave: presentatie (Escape-prioriteit, zie bestandskop) ---
  {
    id: 'view.toggleFullscreen',
    combo: { key: 'F11' },
    category: 'view',
    labelKey: 'menu:ribbon.presentationMode',
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
    labelKey: 'context.paste',
    run: (store) => store.pasteTasks(),
  },
  {
    id: 'edit.undo',
    combo: { key: 'z', mod: true },
    category: 'edit',
    labelKey: 'menu:commands.undo',
    run: COMMANDS.undo.run,
  },
  {
    id: 'edit.redo',
    combo: { key: 'y', mod: true },
    category: 'edit',
    labelKey: 'menu:commands.redo',
    run: COMMANDS.redo.run,
  },
  {
    id: 'edit.redoShiftZ',
    combo: { key: 'z', mod: true, shift: true },
    category: 'edit',
    labelKey: 'menu:commands.redo', // zelfde actie/label als edit.redo — alternatieve combinatie
    run: COMMANDS.redo.run,
  },
  {
    id: 'edit.delete',
    combo: { key: 'Delete' },
    category: 'edit',
    labelKey: 'context.delete',
    when: hasSelection,
    run: COMMANDS.delete.run,
  },
  {
    id: 'edit.deleteBackspace',
    combo: { key: 'Backspace' },
    category: 'edit',
    labelKey: 'context.delete',
    when: hasSelection,
    run: COMMANDS.delete.run,
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
    labelKey: 'context.indent',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: COMMANDS.indent.run,
  },
  {
    id: 'structure.outdent',
    combo: { key: 'ArrowLeft', alt: true, shift: true },
    category: 'structure',
    labelKey: 'context.outdent',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: COMMANDS.outdent.run,
  },
  // Aliassen (user-besluit tijdens golf 2): Alt+→/← naast de MS Project-conventie Alt+Shift+→/←
  // hierboven (die blijft bestaan). Zelfde `run`/`when` — puur een extra combo voor dezelfde actie.
  // Exact-modifier-match in `matchesCombo` houdt deze en de Alt+Shift-variant strikt gescheiden.
  // Zelfde `labelKey` als hierboven is BEWUST: de overzichtsdialoog (golf 3) groepeert entries met
  // een gedeelde labelKey tot één rij met beide toetscombinaties (zie ShortcutsDialog).
  {
    id: 'structure.indentAlt',
    combo: { key: 'ArrowRight', alt: true },
    category: 'structure',
    labelKey: 'context.indent',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: COMMANDS.indent.run,
  },
  {
    id: 'structure.outdentAlt',
    combo: { key: 'ArrowLeft', alt: true },
    category: 'structure',
    labelKey: 'context.outdent',
    when: () => hasSelection() && !hasBlockingDialogOpen(),
    run: COMMANDS.outdent.run,
  },
  {
    id: 'structure.insertAbove',
    combo: { key: 'Insert' },
    category: 'structure',
    labelKey: 'context.insertAbove',
    when: () => !hasBlockingDialogOpen(),
    // Issue #45-nasleep: NIET `selectedTaskIds[0]` — dat is de EERST AANGEKLIKTE taak, dus wie
    // van onder naar boven selecteert kreeg de nieuwe taak midden in zijn selectie. Dezelfde
    // ankerregel als het menu-item ernaast (bovenste taak in schermvolgorde), gedeeld via
    // `insertTaskRelativeToScope`, zodat sneltoets en contextmenu niet uit elkaar kunnen lopen.
    // Issue #49: die gedeelde route bewaakt nu ook de boommodus — buiten pure boommodus is de
    // getoonde volgorde niet de documentvolgorde, dus wordt de invoeging geweigerd met dezelfde
    // melding als bij in-/uitspringen hierboven.
    run: (store) => {
      insertTaskRelativeToScope(store.selectedTaskIds, 'above', { name: i18n.t('defaultTask', { ns: 'task' }) });
    },
  },
  {
    // Issue #49 (aanvullend verzoek van de melder): "in veel gevallen wil je juist ónder de
    // geselecteerde taak invoegen". De melder stelde Ctrl+I of Ctrl+T voor; het is Ctrl+I geworden.
    //
    // Waarom niet Ctrl+T: Chrome en Firefox reserveren dat op browser-chrome-niveau (nieuw
    // tabblad) — `preventDefault()` haalt daar niets uit. De web-build is een échte
    // productie-deploy (`live.yml`), dus een sneltoets die daar structureel dood is valt af.
    //
    // Waarom Ctrl+I wél kan: vrij in `SHORTCUTS` (de enige `i`-combinatie in dit bestand is er
    // niet, en de browser-blokkadelijst in `useKeyboardShortcuts` kent alleen Ctrl+SHIFT+I voor
    // devtools), en te onderscheppen in Chrome/Firefox/Safari. De bekende "Ctrl+I = inspringen"-
    // associatie uit andere planningstools botst hier op niets: in-/uitspringen zit in deze app op
    // Alt(+Shift)+→/← en op Tab in de tabel, en Ctrl+I is nergens aan iets anders gebonden.
    //
    // Zelfde `when`, zelfde route en dezelfde boommodus-poort als `structure.insertAbove`; de
    // overzichtsdialoog toont hem automatisch, want die rendert uit dit register.
    id: 'structure.insertBelow',
    combo: { key: 'i', mod: true },
    category: 'structure',
    labelKey: 'context.insertBelow',
    when: () => !hasBlockingDialogOpen(),
    run: (store) => {
      insertTaskRelativeToScope(store.selectedTaskIds, 'below', { name: i18n.t('defaultTask', { ns: 'task' }) });
    },
  },
  {
    id: 'structure.addMilestone',
    combo: { key: 'm', mod: true },
    category: 'structure',
    labelKey: 'context.addMilestone',
    when: () => !hasBlockingDialogOpen(),
    run: (store) => {
      store.addTask({
        name: i18n.t('defaultMilestone', { ns: 'task' }),
        isMilestone: true,
        taskType: 'ATTENDANCE',
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
    labelKey: 'context.edit',
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
    labelKey: 'menu:commands.zoomIn',
    run: COMMANDS.zoomIn.run,
  },
  {
    id: 'view.zoomOut',
    combo: { key: '-', mod: true },
    category: 'view',
    labelKey: 'menu:commands.zoomOut',
    run: COMMANDS.zoomOut.run,
  },
  {
    id: 'view.showShortcuts',
    combo: { key: '/', mod: true },
    category: 'view',
    labelKey: 'shortcuts.view.showShortcuts',
    // Fase 2.10 fix-golf 4: echte toggle (was altijd `true`, dus Ctrl+/ kon de dialoog niet meer
    // dichttoetsen). Geen `hasBlockingDialogOpen()`-guard hier — deze entry heeft er nooit een gehad
    // en moet, net als voorheen, ook vuren terwijl een ándere dialoog open staat; de ShortcutsDialog
    // zelf zit niet in `hasBlockingDialogOpen()`'s lijst, dus die blokkeert het togglen sowieso niet.
    // Fix-golf (onderdeel 3, item 2): WEL geblokkeerd tijdens de rondleiding/welkomstdialoog — anders
    // opent Ctrl+/ de overzichtsdialoog bovenop de tour, en sluit een volgende Escape beide lagen
    // tegelijk (geen enkele van de twee roept `stopPropagation()` op de Escape-keydown aan).
    when: () => !isTourOrWelcomeOpen(),
    run: (store) => store.setUI({ showShortcutsDialog: !store.ui.showShortcutsDialog }),
  },
  {
    // Histogram aan/uit (user-verzoek): spiegelt de ribbon-knop 'toggleHistogram' (Resources-tab)
    // exact — zelfde `ui.showHistogram`-toggle + `saveShowHistogram`-persistentie; het hergebruik van
    // labelKey `menu:ribbon.toggleHistogram` houdt het bij één entry zónder nieuwe i18n-key.
    // Ctrl+Shift+H i.p.v. kale Ctrl+H: Chrome/Firefox reserveren Ctrl+H voor Geschiedenis op
    // browser-chrome-niveau, waar preventDefault() niets tegen doet — en de web-build is een echte
    // productie-deploy (live.yml), dus een daar structureel dood combo valt af (exact de reden dat
    // Ctrl+T niet werd gekozen voor structure.insertBelow hierboven). Ctrl+Shift+H is nergens
    // gereserveerd en overal te onderscheppen; de H-mnemonic blijft behouden.
    id: 'view.toggleHistogram',
    combo: { key: 'h', mod: true, shift: true },
    category: 'view',
    labelKey: 'menu:ribbon.toggleHistogram',
    run: COMMANDS.toggleHistogram.run,
  },

  // --- Navigatie ---
  {
    id: 'nav.reportTab',
    combo: { key: 'p', mod: true },
    category: 'nav',
    labelKey: 'shortcuts.nav.reportTab',
    run: (store) => store.setUI({ activeRibbonTab: 'report' }),
  },
  // Fase 2.10, onderdeel 5 (golf 1, architect-besluit 5): F1 opent de in-app help-viewer via de
  // Backstage-sectie 'help' (§2.1 ontwerpdocument — geen aparte ribbon-knop). `allowInInput` is
  // BEWUST niet gezet: F1 in een invoerveld (bv. een taaknaam typen) mag niet ineens de help
  // openen — net als de andere nav-entries hierboven/onder. `hasBlockingDialogOpen()`-guard: F1
  // mag niet vuren terwijl een dialoog/overlay open staat (user-eis in de opdracht).
  {
    id: 'nav.help',
    combo: { key: 'F1' },
    category: 'nav',
    labelKey: 'shortcuts.nav.help',
    when: () => !hasBlockingDialogOpen(),
    run: (store) => store.setUI({ activeRibbonTab: 'file', backstageSection: 'help' }),
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
  //     overzichtsdialoog (golf 3) zodat die compleet is zonder een dubbele handler.
  //     zoomInBare/zoomOutBare delen bewust dezelfde labelKey als view.zoomIn/zoomOut hierboven —
  //     zelfde conceptuele actie, andere combo → de dialoog groepeert ze tot één rij
  //     ("Inzoomen" met zowel Ctrl+= als +/=). zoomResetBare/zoomFitBare zijn wél losstaande
  //     acties (reset resp. fit-to-project) en krijgen elk hun eigen (hergebruikte) label. ---
  {
    id: 'view.zoomInBare',
    combo: { key: '=' }, // toont "+/=" — useZoomShortcuts matcht zelf zowel '+' als '='
    category: 'view',
    labelKey: 'menu:commands.zoomIn',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
  {
    id: 'view.zoomOutBare',
    combo: { key: '-' },
    category: 'view',
    labelKey: 'menu:commands.zoomOut',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
  {
    id: 'view.zoomResetBare',
    combo: { key: '0' },
    category: 'view',
    labelKey: 'context.zoomReset',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },
  {
    id: 'view.zoomFitBare',
    combo: { key: '0', mod: true },
    category: 'view',
    labelKey: 'context.fitToProject',
    displayOnly: true,
    run: () => { /* displayOnly: useZoomShortcuts.ts handelt dit af */ },
  },

  // --- displayOnly: taakgridtoetsen (zie src/engine/taskGrid/navigation.ts). Deze toetsen worden
  //     al binnen de gridcontainer zelf afgehandeld (DataGridCore.tsx → resolveTaskGridCommand,
  //     vóór ze deze globale matcher ooit bereiken); ze staan hier uitsluitend zodat het
  //     Sneltoetsen-venster de VOLLEDIGE lijst toont, niet alleen de globale sneltoetsen.
  //     Tab/Shift+Tab en Enter/F2 delen elk hun labelKey (twee combo's -> één rij).
  {
    id: 'grid.navigateNext',
    combo: { key: 'Tab' },
    category: 'grid',
    labelKey: 'shortcuts.grid.navigate',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    id: 'grid.navigatePrevious',
    combo: { key: 'Tab', shift: true },
    category: 'grid',
    labelKey: 'shortcuts.grid.navigate',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    id: 'grid.editEnter',
    combo: { key: 'Enter' },
    category: 'grid',
    labelKey: 'shortcuts.grid.edit',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    id: 'grid.editF2',
    combo: { key: 'F2' },
    category: 'grid',
    labelKey: 'shortcuts.grid.edit',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    // Geen letterlijke toetscombinatie — ieder afdrukbaar teken start bewerken. `keyGlyph` in
    // shortcutFormat.ts laat een meerkarakter-`key` ongewijzigd staan (zelfde mechanisme als de
    // "+ / ="-uitzondering voor zoom), dus dit rendert precies als geschreven.
    id: 'grid.typeToReplace',
    combo: { key: 'A–Z, 0–9, …' },
    category: 'grid',
    labelKey: 'shortcuts.grid.typeToReplace',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    // Zelfde betekenis als de globale `structure.insertAbove` (zie FullTaskGrid.tsx: de grid volgt
    // hier bewust de globale richting) — hergebruikt daarom dezelfde, al vertaalde labelKey.
    id: 'grid.insertAbove',
    combo: { key: 'Insert' },
    category: 'grid',
    labelKey: 'context.insertAbove',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    // Wist alleen de inhoud van de geselecteerde cellen — niet de taak/taken zelf (dat is
    // `context.delete`). Zie FIX 1 in tabel-overhaul-review-fixes.md voor de eerdere val hier.
    id: 'grid.clearCell',
    combo: { key: 'Delete' },
    category: 'grid',
    labelKey: 'shortcuts.grid.clearCell',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
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
