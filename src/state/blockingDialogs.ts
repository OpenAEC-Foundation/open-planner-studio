// Welke modale dialogen en vragen de planning stilleggen. Pure functie op de ui-state, zonder
// app-singleton, React of i18n: de toetsenbordlaag (`shortcutRegistry.ts`) en de MCP-tool-runtime
// (`services/mcp/tools/runtime.ts`) delen hem, en de headless MCP-server (issue #570) bundelt hem zonder
// de UI-laag mee te nemen.
import type { UIState } from '@/state/slices/types';

/** "Niet in een dialoog" (F2/Insert/Ctrl+A/Alt+↑/↓): deze structuur-acties werken alleen als de
 *  aandacht op de planning zelf ligt, niet terwijl een dialoog/overlay open staat. Met de hand
 *  opgesomd, net als de Escape-sluitlijst in `edit.deselect` (`hooks/keyboard/shortcutRegistry.ts`). Ook de rondleiding en de
 *  welkomstdialoog tellen mee: beide zijn modale overlays (zie TourOverlay.tsx). */
export function isBlockingDialogOpen(ui: UIState): boolean {
  return (
    ui.showTaskDialog || ui.showProjectSettings || ui.showProjectInfoDialog ||
    ui.showSettingsDialog || ui.showCalendarDialog || ui.showUpdateDialog ||
    ui.showNewProjectDialog || ui.showFeedbackDialog || ui.showStructureDialog ||
    ui.showLevelingDialog || ui.showBaselineDialog || ui.showColumnsDialog ||
    ui.showFilterDialog || ui.showLayoutsDialog || ui.showProjectOverview ||
    ui.presentationMode || ui.showTourOverlay || ui.showWelcomeDialog || ui.showTutorialOffer || ui.showStatsDialog ||
    // De toestemmingsvraag bij een extensie-installatie is net zo goed modaal — hij
    // wacht op een antwoord en er mag intussen niets aan de planning gebeuren.
    ui.pendingExtensionConsent !== null ||
    // De vraag naar de werkelijke start wacht op een antwoord; intussen verandert er niets.
    ui.pendingActualStartQuestion !== null ||
    // "Taak wordt een samenvattingstaak" wacht op een keuze; de handeling is nog niet uitgevoerd.
    ui.pendingPhaseAssignmentQuestion !== null ||
    // Openen van/opslaan op de site wacht op een keuze; de opslaanroute houdt intussen de
    // schrijfvergrendeling vast.
    ui.pendingSiteOpen !== null || ui.pendingSiteSave !== null ||
    // De schemavraag bij opslaan wacht op een keuze; de opslaanroute houdt intussen de
    // schrijfvergrendeling vast.
    ui.pendingIfcSchemaQuestion !== null || ui.pendingPlanOnlyQuestion !== null ||
    ui.pendingFolderAccessQuestion !== null ||
    // De vraag over te krappe ankers van afhankelijke projecten (stap 1.11) wacht op een keuze; de
    // opslaanroute houdt intussen de schrijfvergrendeling vast.
    ui.pendingDependentAnchorWarning !== null ||
    // De sluitvraag ("wijzigingen opslaan?") is modaal, maar gebruikt geen `Dialog` en staat dus
    // niet op de dialoogstapel. Zonder deze vlag verwijderde Delete een taak terwijl de vraag
    // openstond, en zette *Opslaan* die verwijdering daarna in het bestand.
    ui.pendingCloseDocId !== null ||
    // "Wordt nog opgeslagen…" (#804 stap 3): afsluiten of sluiten wacht op een opslag; niets mag intussen wijzigen.
    ui.savingBeforeClose ||
    // De laatste fase van afsluiten (fixronde 1): de poort voor projectopslag is dicht, het venster gaat weg.
    ui.appClosing ||
    // Handmatig koppelwerk in de voortgangsimportdialoog hangt aan taak-id's van
    // ÉÉN document en leeft alleen in de dialoog — een documentwissel moet onmogelijk zijn zolang
    // hij openstaat, niet: dat werk over de wissel heen bewaren.
    ui.showProgressImportDialog
  );
}

/** Een vraag waarop een opslag onder het schrijfslot wacht (site, IFC-schema, alleen de planning, afhankelijke
 *  projecten). Zolang die openstaat start Ctrl+S geen nieuwe opslag, en staat "Wordt nog opgeslagen…" er niet overheen:
 *  het wachten hangt dan aan het antwoord van de planner (#804 stap 3). */
export function saveQuestionOpen(ui: UIState): boolean {
  return ui.pendingSiteSave !== null || ui.pendingSiteOpen !== null || ui.pendingIfcSchemaQuestion !== null
    || ui.pendingDependentAnchorWarning !== null || ui.pendingPlanOnlyQuestion !== null || ui.pendingFolderAccessQuestion !== null;
}
