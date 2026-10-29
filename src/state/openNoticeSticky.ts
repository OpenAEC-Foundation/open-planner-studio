import type { NotificationMessageKey, NotifyInput } from './slices/types';

/**
 * Welke openingsmelding blijft staan tot de gebruiker op het kruisje klikt (eigenaarsbesluit
 * 2026-10-12, optie 1)?
 *
 * De regel: een melding bij het OPENEN van een bestand (XER, CSV, MSPDI, P6 XML, .mpp, IFC) blijft
 * staan als de app bij het openen data heeft ingevuld, vervangen, gerepareerd of weggelaten. Dan moet
 * de gebruiker het kunnen lezen; een info die na 5 s verdwijnt, is dan te vluchtig. Zonder zulke
 * regels (alleen "N projecten gezien", het aantal documenten, de vastgestelde codering, gebruikte
 * baselines, bewaarde externe koppelingen) verdwijnt de melding gewoon na 5 s.
 *
 * Het is geen fout: de melding blijft `info` (blauw), alleen de timer valt weg (`sticky`).
 *
 * Elke sleutel hieronder is zo'n regel — als detailregel onder de XER-openingsmelding of als eigen
 * melding. Een nieuwe import-bevinding die data verandert, hoort hier ook bij; houd de gids
 * `ref-meldingen` (sectie Meldingen) gelijk met deze lijst.
 */
export const STICKY_OPEN_NOTICE_KEYS: ReadonlySet<string> = new Set<NotificationMessageKey | string>([
  // XER: de lezer viel terug of repareerde.
  'notifications.xerImportParserIssues',
  'notifications.xerImportCalendarIssues',
  'notifications.xerImportNumberIssues',
  'notifications.xerImportEnumFallbacks',
  'notifications.xerImportUnsupportedSemantics',
  'notifications.xerImportBaselineFallback',
  'notifications.xerImportDanglingBaselineReferences',
  // XER: activiteit zonder geplande start kreeg de statusdatum of projectstart (PR #296).
  'notifications.xerImportMissingPlannedStarts',
  // P6 XML (PR #330, `p6xmlImportNotice`): relaties tussen projecten zijn niet als relatie
  // overgenomen, activiteiten zonder project zijn niet ingelezen. Losse baselineverwijzingen
  // gebruiken `xerImportDanglingBaselineReferences` hierboven; het aantal projecten, lege
  // projecten en gekoppelde baselines veranderen niets en blijven dus buiten deze lijst (zoals bij XER).
  'notifications.p6xmlImportCrossProjectRelations',
  'notifications.p6xmlImportUnassignedActivities',
  // MS Project (MSPDI en .mpp, `msProjectImportNotice`): elke regel noemt iets dat niet is overgenomen.
  'notifications.msProjectLostBaselines',
  'notifications.msProjectLostExtraBaselines',
  'notifications.msProjectLostBaselineWorkCost',
  'notifications.msProjectLostAssignmentBaselineDates',
  'notifications.msProjectLostCustomFields',
  'notifications.msProjectLostNotes',
  'notifications.msProjectLostHyperlinks',
  'notifications.msProjectLostFixedCosts',
  'notifications.msProjectLostResourceRates',
  'notifications.msProjectLostSubprojects',
  'notifications.msProjectLostExternalTasks',
  'notifications.msProjectLostManualTasks',
  'notifications.msProjectLostLevelingDelays',
  'notifications.msProjectLostInactiveTasks',
  'notifications.msProjectLostCriticalSlack',
  // IFC: een onbruikbaar XER-bronarchief is weggelaten (als regel of als eigen melding).
  'notifications.xerArchiveUnusableLine',
  'notifications.xerArchiveUnusable',
  // Alle formaten: dubbele id's hernummerd, relaties die niet meerekenen.
  'notifications.duplicateIdsRenamed',
  'notifications.summaryRelationsDropped',
]);

/** Moet deze openingsmelding blijven staan? Kijkt naar de melding zelf en naar elke detailregel. */
export function isStickyOpenNotice(notice: Pick<NotifyInput, 'messageKey' | 'detailLines'>): boolean {
  return STICKY_OPEN_NOTICE_KEYS.has(notice.messageKey)
    || (notice.detailLines ?? []).some((line) => STICKY_OPEN_NOTICE_KEYS.has(line.messageKey));
}

/** Zet `sticky` op een openingsmelding volgens {@link isStickyOpenNotice}; anders ongewijzigd. */
export function withOpenNoticeSticky<T extends NotifyInput | undefined>(notice: T): T {
  if (!notice || !isStickyOpenNotice(notice)) return notice;
  return { ...notice, sticky: true };
}
