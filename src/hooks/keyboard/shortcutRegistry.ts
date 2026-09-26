// Sneltoets-register — DE ENIGE bron van waarheid voor alle globale sneltoetsen.
// `useKeyboardShortcuts` matcht hiertegen i.p.v. een handmatige if-keten; de overzichtsdialoog
// (Ctrl/Cmd+/) rendert er rechtstreeks uit. Een toets toevoegen = één entry hier + één i18n-key.
//
// - De productie-only "blokkeer-browser-sneltoets"-voorpoort in `useKeyboardShortcuts.ts`
//   (F5/Ctrl+Shift+S/Ctrl+S/Ctrl+O/Ctrl+N moeten de browser/webview vóór zijn, ook ver vóórdat een
//   isTypingTarget-check ooit gebeurt) staat bewust los hiervan — dat is webview-hardening. De
//   entries hieronder zijn wél de bron van waarheid voor WAT die toetsen doen; de voorpoort roept
//   dezelfde store-acties aan.
// - `Ctrl/Cmd+Shift+S` is in dev/test NIET whitelisted voor invoervelden (dat geldt alleen in
//   productiebuilds, via de voorpoort). De entry hieronder zet `allowInInput` dus bewust NIET.
// - De matcher toetst Alt/Shift/mod altijd EXACT (afwezig ⇒ moet losgelaten zijn), zodat
//   niet-bedoelde combinaties (bv. Ctrl+Alt+S) niet doorlekken.
//
// Volgorde is betekenisvol: `useKeyboardShortcuts` stopt bij de EERSTE match. `view.exitFullscreen`
// (Escape tijdens presentatie) staat daarom vóór `edit.deselect` (de "gewone" Escape) — anders zou
// een kale Escape-entry zonder `when` de presentatie-afsluiting nooit meer bereiken.

import { useAppStore } from '@/state/appStore';
import type { ParseKeys } from 'i18next';
import type { UIState } from '@/state/slices/types';
import type { AppState } from '@/state/appStore';
import { isAnyDialogOpen } from '@/hooks/useDialogKeys';
import { isBackstageLeaveGuardActive, leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';
// DOM-vrij en JSX-vrij bij constructie (zie de kop van dat bestand): de anker- en weergaveregels
// voor nieuwe taken wonen daar zodat sneltoets, menu, lintknop én regressiebatterij letterlijk
// dezelfde functie draaien.
import { insertTaskRelativeToScope } from '@/state/taskInsertActions';
import { computeScrollToDate } from '@/utils/ganttViewport';
// De acties die het lint EN het toetsenbord delen, staan één keer gedefinieerd.
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
  labelKey: ParseKeys<['common', 'menu']>;    // i18n-key voor de overzichtsdialoog
  run: (store: AppState) => void;             // roept bestaande store-acties aan
  allowInInput?: boolean;                     // werkt óók in invoervelden (zoals Ctrl+S/F5/F11)
  when?: () => boolean;                       // optionele extra-guard
  displayOnly?: boolean;                      // alleen tonen in de dialoog, niet zelf afhandelen
  /** Uitzondering voor `edit.deselect`: roept `e.preventDefault()` NIET aan. Voor elke andere entry
   *  wordt preventDefault altijd aangeroepen. */
  skipPreventDefault?: boolean;
}

/** "Niet in een dialoog" (F2/Insert/Ctrl+A/Alt+↑/↓): deze structuur-acties werken alleen als de
 *  aandacht op de planning zelf ligt, niet terwijl een dialoog/overlay open staat. Met de hand
 *  opgesomd, net als de Escape-sluitlijst in `edit.deselect` hieronder. Ook de rondleiding en de
 *  welkomstdialoog tellen mee: beide zijn modale overlays (zie TourOverlay.tsx). */
export function hasBlockingDialogOpen(ui: UIState = useAppStore.getState().ui): boolean {
  return (
    ui.showTaskDialog || ui.showProjectSettings || ui.showProjectInfoDialog ||
    ui.showSettingsDialog || ui.showCalendarDialog || ui.showUpdateDialog ||
    ui.showNewProjectDialog || ui.showFeedbackDialog || ui.showStructureDialog ||
    ui.showLevelingDialog || ui.showBaselineDialog || ui.showColumnsDialog ||
    ui.showFilterDialog || ui.showLayoutsDialog || ui.showProjectOverview ||
    ui.presentationMode || ui.showTourOverlay || ui.showWelcomeDialog || ui.showStatsDialog ||
    // De toestemmingsvraag bij een extensie-installatie is net zo goed modaal — hij
    // wacht op een antwoord en er mag intussen niets aan de planning gebeuren.
    ui.pendingExtensionConsent !== null ||
    // De vraag naar de werkelijke start wacht op een antwoord; intussen verandert er niets.
    ui.pendingActualStartQuestion !== null ||
    // Handmatig koppelwerk in de voortgangsimportdialoog hangt aan taak-id's van
    // ÉÉN document en leeft alleen in de dialoog — een documentwissel moet onmogelijk zijn zolang
    // hij openstaat, niet: dat werk over de wissel heen bewaren.
    ui.showProgressImportDialog
  );
}

/**
 * De sneltoetsvariant van {@link hasBlockingDialogOpen}: óók elke gemounte dialoog op de
 * dialoogstapel (`isAnyDialogOpen`) blokkeert — dialogen zonder eigen `ui.show*`-vlag, zoals de
 * niet-toegepast-keuzedialoog van Backstage → Projectinfo of een `ConfirmDialog`, waren anders
 * doorzichtig voor Ctrl/⌘+1–9, F1 en de bewerktoetsen. Bewust een aparte functie:
 * `hasBlockingDialogOpen(ui)` blijft de vlag-gebaseerde poort van de MCP-runtime, die per vlag
 * benoemt wélke dialoog blokkeert en tegen een meegegeven (eventueel headless) `ui` evalueert.
 */
export function isShortcutBlockedByDialog(): boolean {
  return hasBlockingDialogOpen() || isAnyDialogOpen();
}

/**
 * Documentwissels (Ctrl/⌘+1–9, Ctrl/⌘+N, Ctrl/⌘+O): geblokkeerd zolang een dialoog openstaat én
 * zolang Backstage → Projectinfo een niet-toegepaste draft bewaakt. Een wissel kan niet via de
 * keuzedialoog lopen — de draft hoort bij het actieve document — dus blokkeren is de veilige route;
 * de gebruiker past eerst toe of verwerpt.
 */
export function isDocumentLeaveBlocked(): boolean {
  return isShortcutBlockedByDialog() || isBackstageLeaveGuardActive();
}

function hasSelection(): boolean {
  return useAppStore.getState().selectedTaskIds.length > 0;
}

/** Gebruikt door `view.showShortcuts` hieronder: BEWUST geen hergebruik van
 *  `hasBlockingDialogOpen()` — die retourneert óók `true` voor allerlei ándere dialogen (TaskDialog,
 *  SettingsDialog, …), terwijl Ctrl+/ juist tijdens die dialogen moet blijven werken. Deze guard is
 *  smaller: alléén de rondleiding/welkomstdialoog blokkeren Ctrl+/. */
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
    // Een documentwissel is onmogelijk zolang er een blokkerende dialoog openstaat (onder meer de
    // voortgangsimportdialoog — handmatig koppelwerk hangt aan taak-id's van dit ene document). Een
    // modale dialoog hoort modaal te zijn; anders sluit `resetDocumentScopedUI` hem na de wissel.
    // Óók geblokkeerd bij een dialoog zonder ui-vlag en bij een niet-toegepaste Projectinfo-draft.
    when: () => !isDocumentLeaveBlocked(),
    // preventDefault() altijd bij Ctrl+1..9 (ook zonder zóveel open documenten) — de "bestaat dit
    // document?"-guard zit in de actie zelf, niet ervóór.
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
    // Zelfde tekst als de "Bereken"-ribbonknop (F5 doet exact dat).
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
    // `openFile` opent doorgaans in een NIEUW document — dat is zelf een documentwissel
    // en moet dus dicht zolang een blokkerende dialoog (bv. de voortgangsimportdialoog) openstaat.
    // Zelfde guard als `documentSwitchShortcuts`. Let op: in PRODUCTIEBUILDS vangt de browser-
    // sneltoets-voorpoort in `useKeyboardShortcuts.ts` Ctrl+O al vóór dit register af — díe tak heeft
    // zijn EIGEN `!isAnyDialogOpen()`-guard nodig, deze `when` alleen dekt dev/test.
    when: () => !isDocumentLeaveBlocked(),
    run: COMMANDS.open.run,
  },
  {
    id: 'file.newProject',
    combo: { key: 'n', mod: true },
    category: 'file',
    labelKey: 'menu:commands.newProject',
    // Zonder guard opent Ctrl+N de projectwizard óver een openstaande dialoog heen — twee overlays
    // gestapeld, de wizard onbereikbaar, en één Escape sluit meteen beide. `isAnyDialogOpen()` is de
    // generieke stapel-check uit `useDialogKeys`; dezelfde guard als de productie-voorpoort in
    // `useKeyboardShortcuts.ts`. Plus de Projectinfo-draftbewaking (`isDocumentLeaveBlocked` omvat
    // `isAnyDialogOpen`).
    when: () => !isDocumentLeaveBlocked(),
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
    skipPreventDefault: true, // geen e.preventDefault() voor de gewone Escape
    run: (store) => {
      store.deselectAll();
      store.setUI({
        showTaskDialog: false, editingTaskId: null, showDependencyMode: false, showSplitMode: false,
        showProjectOverview: false, pendingCloseDocId: null, traceMode: 'off',
      });
    },
  },

  // --- Structuur (indent/outdent, invoegen, mijlpaal, herordenen) ---
  {
    id: 'structure.indent',
    combo: { key: 'ArrowRight', alt: true, shift: true },
    category: 'structure',
    labelKey: 'context.indent',
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
    run: COMMANDS.indent.run,
  },
  {
    id: 'structure.outdent',
    combo: { key: 'ArrowLeft', alt: true, shift: true },
    category: 'structure',
    labelKey: 'context.outdent',
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
    run: COMMANDS.outdent.run,
  },
  // Aliassen: Alt+→/← naast de MS Project-conventie Alt+Shift+→/←
  // hierboven (die blijft bestaan). Zelfde `run`/`when` — puur een extra combo voor dezelfde actie.
  // Exact-modifier-match in `matchesCombo` houdt deze en de Alt+Shift-variant strikt gescheiden.
  // Zelfde `labelKey` als hierboven is BEWUST: de overzichtsdialoog groepeert entries met
  // een gedeelde labelKey tot één rij met beide toetscombinaties (zie ShortcutsDialog).
  {
    id: 'structure.indentAlt',
    combo: { key: 'ArrowRight', alt: true },
    category: 'structure',
    labelKey: 'context.indent',
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
    run: COMMANDS.indent.run,
  },
  {
    id: 'structure.outdentAlt',
    combo: { key: 'ArrowLeft', alt: true },
    category: 'structure',
    labelKey: 'context.outdent',
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
    run: COMMANDS.outdent.run,
  },
  {
    id: 'structure.insertAbove',
    combo: { key: 'Insert' },
    category: 'structure',
    labelKey: 'context.insertAbove',
    when: () => !isShortcutBlockedByDialog(),
    // NIET `selectedTaskIds[0]` — dat is de EERST AANGEKLIKTE taak, dus wie van onder naar boven
    // selecteert zou de nieuwe taak midden in zijn selectie krijgen. Dezelfde ankerregel als het
    // menu-item ernaast (bovenste taak in schermvolgorde), gedeeld via `insertTaskRelativeToScope`,
    // zodat sneltoets en contextmenu niet uit elkaar kunnen lopen. Die route bewaakt ook de
    // boommodus — buiten pure boommodus is de getoonde volgorde niet de documentvolgorde, dus wordt
    // de invoeging geweigerd met dezelfde melding als bij in-/uitspringen hierboven.
    run: (store) => {
      insertTaskRelativeToScope(store.selectedTaskIds, 'above', { name: i18n.t('defaultTask', { ns: 'task' }) });
    },
  },
  {
    // Invoegen ónder de geselecteerde taak.
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
    when: () => !isShortcutBlockedByDialog(),
    run: (store) => {
      insertTaskRelativeToScope(store.selectedTaskIds, 'below', { name: i18n.t('defaultTask', { ns: 'task' }) });
    },
  },
  {
    id: 'structure.addMilestone',
    combo: { key: 'm', mod: true },
    category: 'structure',
    labelKey: 'context.addMilestone',
    when: () => !isShortcutBlockedByDialog(),
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
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
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
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
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
    when: () => hasSelection() && !isShortcutBlockedByDialog(),
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
    when: () => !isShortcutBlockedByDialog(),
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
    // Echte toggle, zodat Ctrl+/ de dialoog ook weer dichttoetst. Geen `hasBlockingDialogOpen()`-
    // guard: deze entry moet ook vuren terwijl een ándere dialoog open staat; de ShortcutsDialog
    // zelf zit niet in `hasBlockingDialogOpen()`'s lijst, dus die blokkeert het togglen sowieso niet.
    // WEL geblokkeerd tijdens de rondleiding/welkomstdialoog — anders
    // opent Ctrl+/ de overzichtsdialoog bovenop de tour, en sluit een volgende Escape beide lagen
    // tegelijk (geen enkele van de twee roept `stopPropagation()` op de Escape-keydown aan).
    when: () => !isTourOrWelcomeOpen(),
    run: (store) => store.setUI({ showShortcutsDialog: !store.ui.showShortcutsDialog }),
  },
  {
    // Histogram aan/uit: spiegelt de ribbon-knop 'toggleHistogram' (Resources-tab)
    // exact — zelfde `ui.showHistogram`-toggle + `saveShowHistogram`-persistentie; het hergebruik van
    // labelKey `menu:ribbon.toggleHistogram` houdt het bij één entry zónder nieuwe i18n-key.
    // Ctrl+Shift+H i.p.v. kale Ctrl+H: Chrome/Firefox reserveren Ctrl+H voor Geschiedenis op
    // browser-chrome-niveau, waar preventDefault() niets tegen doet — en de web-build is een echte
    // productie-deploy (live.yml), dus een daar structureel dood combo valt af (zelfde reden als bij
    // structure.insertBelow hierboven). Ctrl+Shift+H is nergens
    // gereserveerd en overal te onderscheppen; de H-mnemonic blijft behouden.
    id: 'view.toggleHistogram',
    combo: { key: 'h', mod: true, shift: true },
    category: 'view',
    labelKey: 'menu:ribbon.toggleHistogram',
    run: COMMANDS.toggleHistogram.run,
  },
  {
    // Waarschuwingenpaneel aan/uit: spiegelt de lintknop 'warningsPanel' (Beeld →
    // Panelen en Planning → Planning) via hetzelfde commando — één definitie, zoals
    // `check-commands.ts` afdwingt. Ctrl+Shift+L ("lijst"): Ctrl+Shift+W sluit in Chrome het
    // venster en Ctrl+Shift+M opent daar het profielmenu, allebei op browser-chrome-niveau en dus
    // niet te onderscheppen in de web-build; L is nergens gereserveerd.
    id: 'view.toggleWarningsPanel',
    combo: { key: 'l', mod: true, shift: true },
    category: 'view',
    labelKey: 'menu:ribbon.warningsPanel',
    run: COMMANDS.toggleWarningsPanel.run,
  },

  // --- Navigatie ---
  {
    id: 'nav.reportTab',
    combo: { key: 'p', mod: true },
    category: 'nav',
    labelKey: 'shortcuts.nav.reportTab',
    // Verlaat Backstage → Projectinfo via de bewaker (keuzedialoog bij een niet-toegepaste draft).
    when: () => !isShortcutBlockedByDialog(),
    run: (store) => leaveBackstageGuarded(() => store.setUI({ activeRibbonTab: 'report' })),
  },
  // F1 opent de in-app help-viewer via de Backstage-sectie 'help' (geen aparte ribbon-knop).
  // `allowInInput` is BEWUST niet gezet: F1 in een invoerveld (bv. een taaknaam typen) mag niet
  // ineens de help openen — net als de andere nav-entries. `hasBlockingDialogOpen()`-guard: F1 mag
  // niet vuren terwijl een dialoog/overlay open staat.
  {
    id: 'nav.help',
    combo: { key: 'F1' },
    category: 'nav',
    labelKey: 'shortcuts.nav.help',
    // Ook niet door een vlagloze dialoog heen (bv. de niet-toegepast-keuzedialoog), en vanuit
    // Backstage → Projectinfo via de bewaker — anders verdwijnt een niet-toegepaste draft stil.
    when: () => !isShortcutBlockedByDialog(),
    run: (store) => leaveBackstageGuarded(() => store.setUI({ activeRibbonTab: 'file', backstageSection: 'help' })),
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
  //     overzichtsdialoog zodat die compleet is zonder een dubbele handler.
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
    // `context.delete`).
    id: 'grid.clearCell',
    combo: { key: 'Delete' },
    category: 'grid',
    labelKey: 'shortcuts.grid.clearCell',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af */ },
  },
  {
    // Escape in selectiemodus verplaatst de
    // focus naar de gridcontainer ÉN laat het event doorbubbelen naar `edit.deselect` hierboven
    // (dispatchDataGridKeyCommand slaat preventDefault/stopPropagation bewust over voor dit
    // commando) — functioneel dezelfde uitkomst als de globale Escape, dus dezelfde, al vertaalde
    // labelKey hergebruikt in plaats van een bijna-identieke nieuwe sleutel toe te voegen.
    id: 'grid.exitSelection',
    combo: { key: 'Escape' },
    category: 'grid',
    labelKey: 'shortcuts.edit.deselect',
    displayOnly: true,
    run: () => { /* displayOnly: DataGridCore.tsx handelt dit af; bubbelt door naar edit.deselect */ },
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
