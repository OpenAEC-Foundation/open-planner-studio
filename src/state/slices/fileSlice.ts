import { normalizeTaskDates } from '../migrations/minuteModel';
import { minuteModelTransition, minuteModelNotice, recordMinuteModelTransition, type MinuteModelTransition } from '../minuteModelTransition';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { claimTaskTypesNotice, notifyTaskTypesUnlocked, notifyTaskTypesUnlockedClaimed, TASK_TYPES_DETAIL_LINE } from '../taskTypesNotice';
import { taskTypesNeedNotice } from '../taskTypesVisibility';
import { writeIFC, ifcObjectSeed } from '@/services/ifc/ifcWriter';
import { writeCSV } from '@/services/csv/csvWriter';
import { CsvDateImportError } from '@/services/csv/csvReader';
import { flattenOrder, inferWbsAutoNumberOnOpen } from '@/utils/wbs';
import { writeMSPDIWithReport } from '@/services/msproject/mspdiWriter';
import { mspdiDropsHourThreshold } from '@/services/msproject/mspdiCriticalSlackLimit';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import type { XerWriteLoss } from '@/services/xerWriteTypes';
import { exportXerLossNotice } from '@/state/xerExportNotice';
import { exportProfileNotice } from '@/state/exportProfileAdvice';
import { exportP6XmlLossNotice } from '@/state/p6XmlExportNotice';
import { countSplitTasksWithoutContour } from '@/services/contourIo';
import { openFileDialog, saveFileDialog, saveBytesDialog, saveToRef, readFromRef, readBytesFromRef, saveTargetRef, fileIdentityFs, type FileRef, type OpenedFile, type SaveOutcome, type SaveTargetCheck } from '@/services/fileAccess';
import {
  isSiteConflict, isSiteNotFound, siteErrorMessage, siteStorageAvailable, type SiteFileInfo, type SiteVersionInfo,
} from '@/services/fileAccess/siteHost';
import {
  latestSiteVersion, listSiteFiles, openSiteFile, readSiteSourceFile, saveNewSiteFile, saveSiteFileVersion,
} from '@/services/fileAccess/siteBackend';
import { askSiteOpen, askSiteSave, type SiteOpenChoice } from '@/services/fileAccess/siteDialogs';
import { withXerArchiveIssueNotice } from '@/state/xerArchiveIssueNotice';
import { P6XmlImportError } from '@/services/p6/p6xmlErrors';
import { withOpenNoticeSticky } from '@/state/openNoticeSticky';
import { clearRefusals } from '@/state/refusalNotice';
import {
  EXPORT_LOSS_HELP_ARTICLE_ID, P6XML_IMPORT_HELP_ARTICLE_ID, RECORDED_DATES_HELP_ARTICLE_ID, XER_IMPORT_HELP_ARTICLE_ID,
} from '@/state/helpArticles';
import { formatNoticeToShow } from '@/services/formatNotice';
import { openDialogFilters, binaryExtensions, readFormatForFile, readsAsBytes, parseOpenedFile, importErrorMessageKey, saveTargetFor, readIfcFromText, writeXerExport, type ExportFormat, type FormatReadOptions } from '@/services/formatRegistry';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import {
  IFC_FOREIGN_SAVE_BLOCKED_NOTICE, IFC_FOREIGN_TARGET_EXPORT_NOTICE, IFC_FOREIGN_TARGET_SAVE_NOTICE, ifcSaveBlocked,
  isOpenForeignSourceTarget,
} from '../ifcForeignGuard';
import { foreignSourceMarkFor } from '@/services/ifc/foreign/foreignSourceMark';
import { loadRecents, addRecent, removeRecent, type RecentEntry } from '@/services/fileAccess/recentFiles';
import { HOST_EVENTS } from '@/services/extensionEvents';
import type { AppSliceFactory, ExternalSourceUpdate, NotifyInput, NotificationDetailLine } from './types';
import type { AppState } from '../appStore';
import { isTauri } from '@/utils/platform';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import { refreshProjectCalendarCache } from '../syncProjectCalendar';
import { stripLibraryOrigins } from '@/services/library/libraryOps';
import { isMultiDocumentImport, type ImportLabels, type ImportResult, type OpenedImport } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import { hydratePayload, isFreshImportOrigin, payloadFromImport, type DocumentPayload } from '../documentContract';
import { applyRecordedDatesOnLoad, materializeLibraryBoundary, prepareLoadedPayload } from '../documentActivation';
import { notifyCalendarLibrarySettle } from '../calendarTasks';
import { unrecordedExportGate } from '../recordedDatesSelectors';
import { buildExportIFCInput, buildWriteIFCInput, sameIFCSource } from '../ifcSaveInput';
import { documentFileBase } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import {
  externalSourceKey, externalSourceKeyOfDoc, externalSourceLocatorOf, externalSourceScope, externalSourceScopeOf,
  refreshExternalAnchors,
  refreshFromSources, type ExternalSourceDoc, type ExternalSourceLocator,
} from '@/engine/externalLinks';
import { externalAnchorChanges } from '@/engine/externalRefreshPreview';
import { readExternalSiteSource, readExternalSource, readExternalSourceFile, type ExternalSourceRead } from '../externalSource';
import { fileFromHandleWeb, pickFilesWeb } from '@/services/fileAccess/webBackend';
import { loadExternalSourceHandles, rememberExternalSourceHandle } from '@/services/fileAccess/externalSourceHandles';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { detectXerExportLoss, type XerExportLossWarning } from '@/services/xerExportLoss';
import { runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import { askIfcSchema, ifcSchemaQuestionFor } from '@/services/ifc/ifcSchemaQuestion';
import { tightDependentAnchors } from '@/engine/dependentProjects';
import { dependentAnchorsAsSaved } from '../dependentCandidates';
import { askDependentAnchors } from '../dependentAnchorQuestion';
import { applyIfcSchemaChoice } from '../ifcSchemaChoice';
import { withSchedulingProfileNotice } from '../schedulingProfileNotice';
import { msProjectImportNotice } from '../msProjectImportNotice';
import type { ImportLabelT } from '@/i18n/importLabels';
import { parseableHourSuffix } from '@/utils/durationFormat';
import i18next from 'i18next';
import { exportFileSuffix } from '@/i18n/exportFileSuffix';
import { invalidateDocumentRedo, removeSessionHistoryForDocumentFromState } from '../sessionHistory';
import { scheduleFailedNotice } from '../scheduleErrorNotice';
import { browserSaveNotice } from '../browserSaveNotice';
import { basename, ensureExtension } from '@/utils/filePath';
import type { ScheduleErrorInfo } from '@/engine/scheduler/CPMSolver';

/**
 * Voorgestelde bestandsnaambasis voor opslaan/exporteren: bij een XER- of P6 XML-document
 * "Projectnaam (P6 Project-ID)", zodat tab en titelbalk na het opslaan dezelfde naam houden.
 */
export function suggestedFileBase(s: Pick<AppState, 'project' | 'xerImportMetadata'>): string {
  return documentFileBase(s.project.name, documentProjectCode(s.project, s.xerImportMetadata));
}

/** Een vers, ongewijzigd, leeg document — dan mag de open-actie het hergebruiken
 *  i.p.v. een nieuw tabblad te openen (anders krijg je een leeg eerste tabblad).
 *  Eén definitie, geen tweede die kan afdrijven: élk echt open-pad (ook de MCP-tool
 *  `planner_import_schedule`) gebruikt hem via `openAsDocument`. */
export function isActivePristine(s: AppState): boolean {
  return (
    s.tasks.length === 0 &&
    s.sequences.length === 0 &&
    s.resources.length === 0 &&
    s.filePath === null &&
    s.siteFileId === null &&
    !s.isDirty
  );
}

/**
 * De reden van mislukte bestands-I/O als tekst, voor openen/importeren en opslaan.
 * Tauri-plugins (plugin-fs, plugin-dialog) weigeren met een STRING, niet met een `Error`
 * ("failed to open file at path: … Permission denied (os error 13)"); `(err as Error).message` gaf
 * daar `undefined` en de gebruiker zag alleen "Opslaan mislukt" zonder reden.
 */
/** Hoe vaak `openOpenedFile` met `waitWhile` opnieuw kijkt. De poort van slepen leest ook de
 *  dialoogstapel buiten de store (`isAnyDialogOpen`), dus een abonnement op de store is niet genoeg. */
export const OPEN_WAIT_POLL_MS = 200;

export function saveErrorDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

/** De bestandsnaam waaronder het document nu bekend is (`filePath` is in de browser al een naam, in
 *  Tauri een pad), of de voorgestelde naam voor een naamloos document. */
function documentFileName(s: Pick<AppState, 'filePath' | 'project' | 'xerImportMetadata'>): string {
  return s.filePath ? basename(s.filePath) : `${suggestedFileBase(s)}.ifc`;
}

/** Voorgevulde naam in "Opslaan op de site": de huidige naam, eindigend op `.ifc` (opslaan schrijft
 *  altijd IFC). */
export function siteSaveDefaultName(s: Pick<AppState, 'filePath' | 'project' | 'xerImportMetadata'>): string {
  return ensureExtension(documentFileName(s), 'ifc');
}

/** Naam van de kopie bij het openen van een OUDERE site-versie: het label uit de dialoog (vertaald,
 *  bijv. "Planning (versie 2)") plus de oorspronkelijke extensie, zodat het formaat — en daarmee de
 *  opslagdoel-regel van `saveTargetFor` — gelijk blijft aan het bronbestand. Zonder label (headless
 *  vrager) een taalneutrale terugval. */
export function siteVersionCopyName(sourceName: string, version: string, copyLabel?: string): string {
  const ext = /\.[^.\\/]+$/.exec(sourceName)?.[0] ?? '';
  const base = ext ? sourceName.slice(0, -ext.length) : sourceName;
  return `${copyLabel || `${base} (${version})`}${ext}`;
}

/**
 * De formaatneutrale "datums zoals opgeslagen"-regel voor één geopend bestand, samengevoegd met de
 * openingsmelding die er al is. De meldingspoort mag de datumregel NIET via `!notice` laten
 * verdringen: zodra er een andere melding is, bv. de rekenprofielmelding bij een `.mpp`, zou de
 * regel dan stil wegvallen.
 *
 *  - `freshShown` = taken die in een vers geopend document IN de modus de opgeslagen datums tonen
 *    (`recordedDates.total`).
 *  - 0 (o.a. elke HEROPENING van een eigen IFC) ⇒ `notice` ongewijzigd.
 *  - De melding draagt al een eigen datumregel (de XER-openingsmelding, `xerImportDatesAsRecorded*`)
 *    ⇒ ongewijzigd, anders stond het er twee keer.
 *  - Er is een andere melding ⇒ de regel komt er als detailregel onder.
 *  - Geen melding ⇒ de regel wordt zelf de melding, met de gids erachter.
 */
export function withRecordedDatesNotice(
  notice: NotifyInput | undefined,
  freshShown: number,
): NotifyInput | undefined {
  if (freshShown <= 0) return notice;
  const line: NotificationDetailLine = {
    messageKey: 'notifications.importDatesAsRecorded',
    params: { count: freshShown },
  };
  if (!notice) {
    return { severity: 'info', ...line, helpArticleId: RECORDED_DATES_HELP_ARTICLE_ID };
  }
  const lines = notice.detailLines ?? [];
  if (lines.some(l => l.messageKey.startsWith('notifications.xerImportDatesAsRecorded'))) return notice;
  return { ...notice, detailLines: [...lines, line] };
}

/**
 * Vorm één gebruikerszichtbaar verslag uit uitsluitend de feiten die de XER-lezer bestandsbreed
 * bewaart. Deze helper zit nadrukkelijk buiten `applyLoadedProject`: één XER kan twaalf documenten
 * openen, maar is nog steeds één bestandsactie en dus één melding.
 */
export function xerImportNotice(
  results: readonly ImportResult[],
  /** Som van `recordedDates.total` (taken die de opgeslagen datums TONEN) over de zojuist geopende
   *  documenten waar de modus aanging. Bewust een aparte parameter i.p.v. iets uit `results` zelf
   *  afgeleid: het aantal vastgelegde taken bestaat pas ná de solve op elk document
   *  (`applyLoadedProject` → `applyRecordedDatesOnLoad`). `xerImportDatesAsRecorded` zegt letterlijk
   *  "niet herberekend", en dat mag alleen staan wanneer de modus daadwerkelijk aanging. (Een
   *  heropende IFC met XER-archief meldt hier niets.) `0` ⇒ geen detailregel. */
  datesAsRecordedShownTotal = 0,
): NotifyInput | undefined {
  // Alleen een VERSE XER-import meldt. Een heropende IFC
  // draagt via het bronarchief óók `xer`-metadata, maar is geen import — de modus "datums zoals
  // opgeslagen" meldt zich daar via `RecordedDatesNotice`, niet via deze melding.
  results = results.filter(result => result.xerOrigin !== 'xer-archive');
  const xers = results.flatMap(result => result.xer ? [result.xer] : []);
  const xer = xers[0];
  if (!xer) return undefined;

  // Het onveranderlijke bronarchief bewaart de bestandsbrede diagnostiek precies eenmaal. De
  // documentviews bevatten daarnaast de werkelijk projectgebonden keuzes (enum- en
  // scheduling-terugvallen). Gebruik het archief zodra het er is, maar blijf ook bruikbaar voor
  // een directe XER-resultaatview vóórdat die in een archief is gebonden.
  const archive = results.find(result => result.xerSourceArchive)?.xerSourceArchive;
  const fileDiagnostics = archive?.diagnostics.file;
  const report = fileDiagnostics?.importReport ?? xer.report;
  const tableReport = fileDiagnostics?.tableReport ?? xer.tableReport;
  const enumFallbacks = xers.reduce((total, item) => total + item.enumFallbacks.length, 0);
  const scheduleFallbacks = xers.reduce((total, item) => total + item.scheduleOptions.fallbacks.length, 0);
  const calendarIssues = xer.calendarIssues.length;
  const numberIssues = tableReport.issues.filter(issue => /(?:NUMBER|DECIMAL)/.test(issue.code)).length
    + xer.calendarIssues.filter(issue => issue.code === 'XER_CALENDAR_INVALID_PERIOD_HOURS').length;
  const parserIssues = tableReport.issues.length - tableReport.issues
    .filter(issue => /(?:NUMBER|DECIMAL)/.test(issue.code)).length;
  // Deze regel is bewust smaller dan alle overige importdiagnostiek: alleen de P6-
  // schedulingopties die naar een veilige semantische default terugvallen horen onder
  // "unsupported semantics". Resource-/metadatacatalogusissues zijn afzonderlijke
  // bron- of koppelproblemen, geen planningsemantiek, en mogen deze teller niet opblazen.
  const unsupportedSemantics = scheduleFallbacks;
  const detailLines: NotificationDetailLine[] = [
    { messageKey: 'notifications.xerImportProjectsSeen', params: { count: report.projectsSeen } },
  ];
  const addCount = (count: number, messageKey: NotificationDetailLine['messageKey']) => {
    if (count > 0) detailLines.push({ messageKey, params: { count } });
  };

  addCount(report.emptyProjectsSkipped, 'notifications.xerImportEmptyProjectsSkipped');
  addCount(report.baselineProjectsExcluded, 'notifications.xerImportBaselineProjectsExcluded');
  addCount(report.baselinesMaterialized, 'notifications.xerImportBaselinesMaterialized');
  addCount(report.danglingBaselineReferences, 'notifications.xerImportDanglingBaselineReferences');
  if (report.baselineExclusionReverted || report.baselineFallbackReasons.length > 0) {
    detailLines.push({ messageKey: 'notifications.xerImportBaselineFallback' });
  }
  addCount(report.externalLinksPreserved, 'notifications.xerImportExternalLinks');

  // UTF-8 zonder BOM is de standaard. Iedere andere gerapporteerde keuze is een daadwerkelijk
  // detecteerbare bronfeit (BOM of Windows-1252-terugval) en verdient daarom uitleg; we beweren
  // nadrukkelijk niet dat afzonderlijke rijen werden overgeslagen.
  if (tableReport.encoding !== 'utf-8') {
    detailLines.push({
      messageKey: 'notifications.xerImportEncoding',
      params: { encoding: tableReport.encoding },
    });
  }
  addCount(parserIssues, 'notifications.xerImportParserIssues');
  addCount(calendarIssues, 'notifications.xerImportCalendarIssues');
  addCount(numberIssues, 'notifications.xerImportNumberIssues');
  addCount(enumFallbacks, 'notifications.xerImportEnumFallbacks');
  // Activiteiten zonder `target_start_date` kregen het projectanker (review PR #109, N1) — dat is
  // geen bestandsfeit maar een keuze van de lezer, dus de melding noemt het.
  addCount(
    results.reduce((total, result) => total + (result.xerMissingPlannedStarts ?? 0), 0),
    'notifications.xerImportMissingPlannedStarts',
  );
  addCount(unsupportedSemantics, 'notifications.xerImportUnsupportedSemantics');
  // "Datums zoals opgeslagen" staat standaard aan zodra
  // er restverschillen zijn. Eén regel voor het HELE bestand, ook bij twaalf documenten — de teller
  // is de som over alle zojuist geopende documenten (zie `applyOpenedImport`), niet per document.
  addCount(datesAsRecordedShownTotal, 'notifications.xerImportDatesAsRecorded');

  return {
    severity: 'info',
    messageKey: 'notifications.xerImportOpened',
    params: { count: report.documentsOpened },
    detailLines,
    helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
  };
}

/**
 * De melding bij een MISLUKTE import (elk open-pad). Een P6 XML-bestand zonder leesbare activiteit
 * (`P6XmlImportError`) krijgt `notifications.p6xmlImportEmpty` met de reden als detailregel; elke
 * onherkende CSV-datum zijn rij/kolom/celwaarde; andere fouten de bestaande sleutel
 * (`importErrorMessageKey`) met de technische tekst als detail.
 */
export function importFailureNotice(err: unknown, detail: string): NotifyInput {
  if (err instanceof CsvDateImportError) {
    return {
      severity: 'error',
      messageKey: 'notifications.csvInvalidDate',
      params: { row: err.row, column: err.column, value: err.value },
    };
  }
  if (err instanceof P6XmlImportError) {
    const reasonKey = err.reason === 'no-object-ids' ? 'notifications.p6xmlImportEmptyNoObjectIds' as const
      : err.reason === 'xer-columns' ? 'notifications.p6xmlImportEmptyXerColumns' as const
      : undefined;
    return {
      severity: 'error',
      messageKey: 'notifications.p6xmlImportEmpty',
      ...(reasonKey ? { detailLines: [{ messageKey: reasonKey }] } : {}),
      helpArticleId: P6XML_IMPORT_HELP_ARTICLE_ID,
    };
  }
  return { severity: 'error', messageKey: importErrorMessageKey(err), detail };
}

/**
 * De ene openingsmelding van een verse P6 XML-import, uit het verslag dat de lezer bestandsbreed op
 * elk resultaat hangt (`ImportResult.p6xmlReport`). Meerdere projecten, baselines, relaties tussen
 * projecten of iets dat niet is ingelezen ⇒ één verslag (zoals `xerImportNotice`). Een gewoon
 * bestand met één project ⇒ geen melding. Een bestand zonder leesbare activiteit opent niet
 * (`importFailureNotice`).
 */
export function p6xmlImportNotice(results: readonly ImportResult[]): NotifyInput | undefined {
  const report = results.find(result => result.p6xmlReport)?.p6xmlReport;
  if (!report) return undefined;
  // Één verslag, zoals bij XER (de telregels zijn formaatneutraal verwoord en worden hergebruikt).
  if (report.projectsSeen <= 1 && report.baselinesMaterialized === 0 && report.crossProjectRelations === 0
    && report.danglingBaselineReferences === 0 && report.unassignedActivities === 0) return undefined;
  const detailLines: NotificationDetailLine[] = [
    { messageKey: 'notifications.xerImportProjectsSeen', params: { count: report.projectsSeen } },
  ];
  const addCount = (count: number, messageKey: NotificationDetailLine['messageKey']) => {
    if (count > 0) detailLines.push({ messageKey, params: { count } });
  };
  addCount(report.emptyProjectsSkipped, 'notifications.xerImportEmptyProjectsSkipped');
  addCount(report.baselinesMaterialized, 'notifications.xerImportBaselinesMaterialized');
  addCount(report.danglingBaselineReferences, 'notifications.xerImportDanglingBaselineReferences');
  addCount(report.crossProjectRelations, 'notifications.p6xmlImportCrossProjectRelations');
  addCount(report.unassignedActivities, 'notifications.p6xmlImportUnassignedActivities');
  return {
    severity: 'info',
    messageKey: 'notifications.p6xmlImportOpened',
    params: { count: report.documentsOpened },
    detailLines,
    helpArticleId: P6XML_IMPORT_HELP_ARTICLE_ID,
  };
}

// `ExportFormat` woont in de formatRegistry; hier her-exporteren voor bestaande importeurs
// (Backstage, via appStore).
export { type ExportFormat };

/**
 * Hoort het resultaat van deze export in **Recente bestanden**?
 *
 * Ja voor de formaten die de app zelf terug kan openen als PROJECT (`ifc`, `csv`, `mspdi`, `p6`):
 * daar is een recents-entry precies wat de gebruiker wil.
 *
 * Nee voor de twee voortgangsbladen. Die zijn geen project
 * maar een invulformulier met acht kolommen; ze komen terug via **Importeren → Voortgang**, niet
 * via Openen. Stonden ze in de recents, dan levert één klik op `<project>-voortgang.xlsx` daar de
 * openroute op — die het bestand als project probeert te lezen en met een foutmelding eindigt.
 * Een lijst die de gebruiker naar een gegarandeerde fout stuurt is erger dan een lege lijst.
 *
 * Los geëxporteerd zodat de regel toetsbaar is zonder een bestandsdialoog te hoeven simuleren:
 * `tests/planning/check-export-guard.ts` loopt hem over álle `ExportFormat`-waarden.
 */
export function exportGoesToRecents(format: ExportFormat): boolean {
  return format !== 'progress-xlsx';
}

/**
 * MS Project en P6 kennen een onderbreking
 * alleen als urenverdeling van een toewijzing, dus een onderbroken taak ZONDER contour komt daar
 * zonder onderbreking aan. Dat mag niet alleen in de console staan: na een geslaagde MSPDI-/P6-export
 * meldt `exportAs` het aantal via het meldingenkanaal — als `info`, net als de andere
 * verliesmeldingen (`timephasedLossNotice.ts`): de export zelf is geslaagd, het kanaal kent geen
 * aparte waarschuwing. De telling is dezelfde als die van de writers
 * (`countSplitTasksWithoutContour`). Los geëxporteerd, net als `exportGoesToRecents`, zodat
 * `tests/planning/check-export-guard.ts` de regel zonder bestandsdialoog kan toetsen.
 */
export function exportSplitsLostNotice(format: ExportFormat, tasks: readonly Task[]): NotifyInput | null {
  if (format !== 'mspdi' && format !== 'p6') return null;
  const count = countSplitTasksWithoutContour(tasks);
  return count > 0 ? { severity: 'info', messageKey: 'notifications.exportSplitsLost', params: { count } } : null;
}

/**
 * P6 weigert een XML-import met een te lange naam of code (schema `xs:maxLength`). De P6 XML-export
 * kort ze daarom in en telt dat zelf (`renderP6XmlWithReport`, de enige telling); hier wordt dat
 * aantal een `info`-melding, zoals de andere verliesmeldingen.
 */
export function exportP6TruncatedNotice(format: ExportFormat, truncated: number): NotifyInput | null {
  if (format !== 'p6' || truncated <= 0) return null;
  return { severity: 'info', messageKey: 'notifications.exportP6Truncated', params: { count: truncated } };
}

/**
 * MSPDI en P6 XML vervangen een teken dat XML 1.0 niet toestaat door U+FFFD (`replaceInvalidXmlChars`, #588);
 * de writer telt dat zelf. Hier wordt dat aantal een `info`-melding, zoals de andere verliesmeldingen.
 */
export function exportInvalidXmlCharsNotice(format: ExportFormat, replaced: number): NotifyInput | null {
  if ((format !== 'mspdi' && format !== 'p6') || replaced <= 0) return null;
  return { severity: 'info', messageKey: 'notifications.exportInvalidXmlChars', params: { count: replaced } };
}

/**
 * MS Project XML kent de kritiek-drempel alleen in hele dagen (`CriticalSlackLimit`). Een drempel in uren
 * (behalve 0 uur) gaat bij de export verloren; dat meldt `exportAs` na een geslaagde MSPDI-export, voor elk
 * document, ook een eigen project (#561). Dezelfde beslissing als de writer en de verliesdetector
 * (`mspdiCriticalSlackLimit`). Los geëxporteerd, zodat een test de regel zonder bestandsdialoog toetst.
 */
export function exportCriticalHoursLostNotice(
  format: ExportFormat,
  project: Pick<Project, 'schedulingOptions'>,
): NotifyInput | null {
  if (format !== 'mspdi' || !mspdiDropsHourThreshold(project.schedulingOptions?.criticalDefinition)) return null;
  return { severity: 'info', messageKey: 'notifications.exportCriticalHoursLost' };
}

/** Resultaat van `exportAs`: bij een cyclische planning wordt de export afgebroken vóór de
 *  opslaan-dialoog en de CPM-fout (`cpmResult.error` + `errorInfo`) meegegeven, zodat de aanroeper
 *  die kan tonen i.p.v. stilletjes niets te doen — vertaald via `scheduleErrorText`.
 *  Annuleren is geen fout, maar draagt `cancelled` zodat de UI niet als na succes sluit. */
export type ExportResult =
  | { ok: true; warnings: readonly XerExportLossWarning[]; cancelled?: true }
  | { ok: false; error: string; errorInfo?: ScheduleErrorInfo };

/** Opties voor `applyLoadedProject` — de één gedeelde "vul de actieve document-state met een
 *  geparsed project"-implementatie. Elke variant (de drie open-paden + `loadState`) kiest zijn
 *  gedrag met deze vlaggen; defaults staan bewust op "niets doen". */
export interface ApplyLoadedProjectOpts {
  /** IFC-editor: bewerk het huidige document als één undo-stap, met behoud van binding en
   *  opslagdoel. Weglaten = laad een vervangend project met een nieuwe, lege geschiedenis. */
  intent?: 'edit';
  /** Nieuw bestandspad (string), `null` voor naamloos (voorbeeld/import), of weglaten
   *  (`undefined`) om `filePath` ongemoeid te laten — dat laatste is de loadState-semantiek
   *  (in-place vervangen zonder het pad te raken). De recente-bestandenlijst wordt door de
   *  AANROEPER bijgewerkt (die kent de herbruikbare `FileRef`). */
  filePath?: string | null;
  /** Web-opslaan-doel voor het geladen document. undefined = laat de huidige handle ongemoeid
   *  (loadState-semantiek); null = geen handle (voorbeeld/fallback-web); een handle = FSA-openen. */
  fileHandle?: FileSystemFileHandle | null;
  /** Site-opslaan-doel (issue #309), zelfde semantiek als `fileHandle`: undefined = ongemoeid
   *  (loadState), null = geen site-doel, een id = het bestand op de site. */
  siteFileId?: string | null;
  /** De site-versie waarop het geladen document rust (de `baseVersion` van zijn volgende opslag).
   *  undefined = ongemoeid als ook `siteFileId` undefined is; geeft de aanroeper wél een `siteFileId`
   *  maar geen versie, dan `null` (een nieuw doel erft nooit de basis van het vorige). */
  siteFileVersion?: string | null;
  /** Direct doorrekenen op de geïsoleerde laadpayload, vóór publicatie. */
  recompute?: boolean;
  /** Canvas op het hele project passen (requestFitToProject). Open-paden: true; loadState: false. */
  fit?: boolean;
  /** True = een echt open-pad (`openAsDocument`: openFile/openRecentFile/MCP-import): behoud
   *  bedrijfsbinding + stempels en draai de grens-1-check. False (default) = een volledig-
   *  vervangende load (loadState: Backstage/extensie-import): laad LOS — strip
   *  companyId/companyName + alle libraryOrigin-stempels.
   *  Bij `intent: 'edit'` blijft de bestaande binding behouden, zonder open-grens.
   *  (Crash-herstel loopt NIET door applyLoadedProject maar via `restoreDocuments`, dat de opgeslagen —
   *  dus gekoppelde — staat exact herstelt en de grens-1-check apart draait.) */
  linkedOpen?: boolean;
  /** Optionele view-start die samen met de nieuwe brondata wordt gepubliceerd (IFC-tab). */
  viewStartDate?: string;
  /** `applyOpenedImport` meldt de taaktypes-ontsluiting zelf, samen met de bestandsmelding ("één
   *  melding per geopend bestand"). */
  deferTaskTypesNotice?: boolean;
}

/** Herkomst van een echt geopend bestand (`openAsDocument`): de bestandsnaam (bepaalt via de
 *  formatRegistry of het bronformaat een opslagdoel mag worden) en de herbruikbare ref — een
 *  Tauri-pad of een FSA-handle, `null` bij de download-/input-terugval. */
export interface OpenedFileSource {
  name: string;
  ref: FileRef | null;
  /** Alleen bij een site-ref: de gelezen (nieuwste) versie, de basis voor de volgende opslag. */
  siteFileVersion?: string | null;
  /** `false`: deze bron is nooit een opslagdoel, ongeacht de bestandsnaam. Voor een extensie-importer:
   *  `readFormatForFile` valt bij een onbekende extensie terug op IFC, en dan zou Ctrl+S IFC-tekst naar
   *  het bronbestand van de importer schrijven. */
  saveTarget?: false;
}

/** Feitelijke uitkomst van de centrale opennaad; gebruikt door DevBridge en MCP voor eerlijke ids.
 *  `reusedActiveTab`: heeft de open-actie het lege, ongewijzigde actieve tabblad hergebruikt? */
export interface AppliedOpenedImport {
  documentIds: string[];
  activeDocumentId: string;
  reusedActiveTab: boolean;
  /** B5: per geopend oud document waarvan het openen taken verschoof, dezelfde telling en grootste
   *  verschuiving als de melding `notifications.minuteModelConverted`. Voor aanroepers die het
   *  meldingenkanaal niet zien (MCP, de headless kern); leeg als niets verschoof. */
  minuteModelConversions: (Pick<MinuteModelTransition, 'shifted' | 'maxWorkdays'> & { documentId: string })[];
}

export interface FileSlice {
  /** `labels` — vertaalde teksten die de UI aanlevert omdat de store-laag geen `t(...)` heeft (zie
   *  `ImportLabels`); weglaten geeft de Engelse default. Geldt voor elk laadpad hieronder. */
  openFile: (labels?: ImportLabels) => Promise<void>;
  /** De rest van `openFile` zodra er een bestand is: herkennen, openen als document, meldingen,
   *  recents. Ook voor de dev-link `?open=` (`src/utils/devOpenLink.ts`) en slepen en neerzetten
   *  (`state/fileDrop.ts`), zodat die geen eigen inleesroute hebben. Met `waitWhile` wacht het
   *  activeren na het herkennen zolang die waar geeft: slepen wacht daar tot geen dialoog meer
   *  openstaat, want het lezen en herkennen gebeurt terwijl de planner verder werkt. */
  openOpenedFile: (
    opened: OpenedFile, labels?: ImportLabels, options?: { waitWhile?: () => boolean },
  ) => Promise<void>;
  saveFile: () => Promise<void>;
  /** Bewaar exact het bedoelde document en meld of zijn ongewijzigde snapshot is vastgelegd. */
  saveFileForDocument: (documentId: string) => Promise<boolean>;
  saveFileAs: () => Promise<void>;
  exportAs: (format: ExportFormat) => Promise<ExportResult>;
  /** Exporteer het project + schrijf de gebonden bedrijfs-pool als tweede, LOS bestand
   *  ernaast. Géén embed. No-op op de pool-kant als het project niet aan een bedrijf gebonden is.
   *  Geeft hetzelfde `ExportResult` terug als `exportAs` — inclusief de cyclusguard. */
  exportProjectWithPool: () => Promise<ExportResult>;
  /**
   * #804 fase 1a, fixronde 1: de doelcontrole voor elke opslag- of exportdialoog (`CheckedSaveDialogOpts.refuseTarget`).
   * Weigert het bronbestand van een open document met een vreemd deel, met de melding voor `purpose` ("op te slaan" of
   * "naar te exporteren"). Ook voor de dialogen buiten de store (bibliotheek, rapport).
   */
  foreignTargetCheck: (purpose: 'save' | 'export') => SaveTargetCheck;
  /** App-globale MRU-lijst van recente bestanden. Async gehydrateerd bij opstart. */
  recentFiles: RecentEntry[];
  /** Lees de recents uit IndexedDB (met eenmalige localStorage-migratie) in de store. */
  hydrateRecentFiles: () => Promise<void>;
  openRecentFile: (id: string, labels?: ImportLabels) => Promise<void>;
  /** Open de NIEUWSTE versie van een bestand op de site (issue #309), met de site als opslagdoel en
   *  in de recente bestanden. Gebruikt door het startbestand van de host. `true` als het geopend
   *  is; `false` na een fout (die is dan al gemeld). */
  openFromSite: (id: string, labels?: ImportLabels) => Promise<boolean>;
  /** Read-only parse van een bronbestand voor externe koppelingen: geeft de
   *  projectidentiteit + taken terug ZONDER het als document te openen (hergebruikt de bestaande
   *  readers). null bij een leesfout/onbekend formaat/niet-Tauri. */
  parseExternalSource: (filePath: string, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  /** De versie van een bronbestand: zijn wijzigingstijd (ISO). `undefined` als die niet te lezen is
   *  (browser zonder toegang, bestand weg). Ook `parseExternalSource` neemt de versie hier vandaan. */
  externalSourceVersion: (filePath: string) => Promise<string | undefined>;
  /**
   * Stap 1.5 (keuze 1 en het vangnet van keuze 6): kijkt per bron van het actieve document of de versie
   * anders is dan in de koppelingen (`sourceVersion`). Zo ja, dan leest de app de bron en telt de
   * koppelingen die veranderen (`externalAnchorChanges`). Verandert er minstens één, dan komt er een
   * balk (`ui.externalSourceUpdates`). De app neemt niets over: dat doet alleen *Accepteren*.
   * Een bron zonder wijziging, of een versie waarop de planner *Later* koos, leest de app in deze
   * sessie niet opnieuw.
   */
  checkExternalSources: (labels?: ImportLabels) => Promise<void>;
  /** *Later*: de balk van deze bron (`ExternalSourceUpdate.key`) gaat weg tot er weer een nieuwe versie is. */
  dismissExternalSourceUpdate: (key: string) => void;
  /** *Accepteren*: ververst de koppelingen naar deze bron als één undo-stap, met herberekening, en haalt de
   *  balk weg. Een bron met pad raakt alleen de koppelingen naar dat pad; een bron zonder pad (browser) alleen
   *  de koppelingen zonder pad met hetzelfde project-id (`externalSourceScope`). `false` als er niets
   *  veranderde. */
  /** Haalt de balk weg voor deze bronnen (`ExternalSourceUpdate.key`; voor een bron met pad het genormaliseerde
   *  pad) van dit document, zonder ze als *Later* te onthouden: na een verversing staan de ankers op de gelezen
   *  versie. Voor `planner_refresh_external_links`. */
  dropExternalSourceUpdates: (documentId: string, keys: ReadonlySet<string>) => void;
  acceptExternalSourceUpdate: (source: ExternalSourceDoc) => boolean;
  /**
   * Stap 1.8: de versie van een bron zonder pad (een koppeling die in de browser gekozen is): de
   * wijzigingstijd (ISO) van het bestand achter het onthouden handvat van dit project-id. Alleen met
   * toestemming `granted`; nooit een vraag. `undefined` zonder handvat of toestemming, en op de desktop.
   */
  externalProjectSourceVersion: (projectId: string) => Promise<string | undefined>;
  /**
   * Stap 1.8: leest de bron zonder pad via het onthouden handvat van dit project-id, alleen-lezen. `prompt`
   * mag om toestemming vragen en hoort alleen bij een klik van de planner. `null` zonder handvat, bij een
   * geweigerde toestemming of een leesfout, en op de desktop.
   */
  parseExternalProjectSource: (projectId: string, opts: { prompt: boolean }, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  /**
   * Stap 1.8: leest meerdere bronnen zonder pad na een klik (*Alle externe relaties vernieuwen*). Alle
   * toestemmingsvragen starten tegelijk, meteen na de klik en vóór het lezen: Chromium eist bij elke
   * `requestPermission` een recente gebruikersactie (ongeveer 5 s). Zou de app wachten op het antwoord op de
   * eerste vraag, of op het lezen van de eerste bron, dan kan de tweede vraag te laat komen (review #858). Per
   * project-id de gelezen bron, of `null` (geen handvat, geweigerd, leesfout).
   */
  readExternalProjectSources: (projectIds: readonly string[], labels?: ImportLabels) => Promise<Map<string, ExternalSourceRead | null>>;
  /** De onthouden handvatten per project-id (browser zonder host); leeg op de desktop en met een site-host.
   *  Een eigen actie, zodat de tests nep-handvatten kunnen geven. */
  externalSourceHandles: () => Promise<Map<string, FileSystemFileHandle>>;
  /**
   * Stap 1.9: de projecten op de site die de koppeldialoog als bron aanbiedt: wat de host bij
   * `list({ extensions: ['ifc'] })` teruggeeft ("dezelfde map"), zonder het eigen geopende bestand. `null`
   * zonder host of als de site de lijst weigert.
   */
  listExternalSiteSources: () => Promise<SiteFileInfo[] | null>;
  /** Stap 1.9: de nieuwste versie van een bron op de site (`versions(id)`), met label en auteur voor de balk.
   *  `undefined` zonder host of als de site weigert. Leest de inhoud niet. */
  externalSiteSourceVersion: (siteFileId: string) => Promise<SiteVersionInfo | undefined>;
  /**
   * Stap 1.9: leest een bron op de site (`open(id)`, de nieuwste versie), alleen-lezen, door de laadgrens. De
   * bron is geen document en geen opslagdoel. `null` zonder host, of als lezen mislukt (`not-found`, geen
   * recht, netwerk, onleesbaar bestand).
   */
  parseExternalSiteSource: (siteFileId: string, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  /** De bron achter een plek uit de balk (`ExternalSourceUpdate.locator`). Leest zonder toestemmingsvraag. */
  readExternalSourceAt: (locator: ExternalSourceLocator, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  /**
   * Stap 1.8, *Bronbestand kiezen…* in de koppeldialoog. Desktop: de bestandskiezer van Tauri (IFC); het
   * pad gaat terug en de dialoog leest het zoals een recent bestand. Browser zonder host: de kiezer van de
   * browser; het bestand is meteen gelezen, zonder pad, met het handvat als de browser dat geeft.
   */
  chooseExternalSourceFile: (labels?: ImportLabels) => Promise<ChosenExternalSource>;
  /**
   * Stap 1.8, *Bronbestanden kiezen…* na *Alle externe relaties vernieuwen* in de browser: de planner kiest
   * de bronbestanden die de app niet kon lezen (meerdere tegelijk). Elk gekozen bestand ververst de
   * koppelingen zonder pad met zijn project-id, samen één undo-stap; het handvat wordt onthouden als de
   * browser het geeft. `null` = geannuleerd. `unmatched`: gekozen bestanden zonder koppeling in dit plan.
   */
  refreshExternalAnchorsFromChosenFiles: (labels?: ImportLabels) => Promise<ChosenFilesRefresh | null>;
  /** Ververs alle externe ankers die naar `filePath` verwijzen uit de actuele bron.
   *  Parset de bron read-only, herberekent de ankers + `sourceMissing`, en herrekent de planning. */
  refreshExternalAnchorsFrom: (filePath: string, labels?: ImportLabels) => Promise<{ refreshed: number; missing: number } | null>;
  /** Projectbrede ververs-actie ("Ververs externe ankers"): ververs elke gerefereerde bron één keer. */
  refreshAllExternalAnchors: (labels?: ImportLabels) => Promise<ExternalRefreshAllResult>;
  /** Open een meegeleverd voorbeeldproject uit een IFC-string als NIEUW document
   *  (geen filePath — opslaan wordt opslaan-als; isDirty=false). Werkt in web én
   *  Tauri; het bestand wordt door de aanroeper via fetch('/examples/…') geladen. */
  /** `true` als het project geopend is; `false` na een fout (die is dan al gemeld). */
  openExampleFromString: (content: string, name: string, labels?: ImportLabels) => Promise<boolean>;
  /** Eén gedeelde load-implementatie: vul de ACTIEVE document-state met een geparsed
   *  project en voer de opt-afhankelijke nastappen uit (runCPM/fit/uur-melding/extensie-event).
   *  Neemt géén besluit over een nieuw tabblad — dat blijft bij de aanroeper vóór de load.
   *  `loadState`, `applyProjectEdit` en de drie open-paden lopen hier allemaal doorheen.
   *  Geeft de B5-overgang van het geladen document terug (`null` zonder overgang); de melding gaat
   *  daarnaast zoals altijd via het meldingenkanaal. */
  applyLoadedProject: (parsed: ImportResult, opts: ApplyLoadedProjectOpts) => MinuteModelTransition | null;
  /** Pas IFC-editorinhoud toe als bewerking van het actieve document, met één undo-stap. */
  applyProjectEdit: (parsed: ImportResult, opts?: { viewStartDate?: string }) => void;
  /**
   * Centrale open-naad voor één of meer geparste projectpayloads. Alleen XER gebruikt vandaag de
   * meervoudige vorm; de individuele documenten lopen daarna letterlijk door hetzelfde
   * applyLoadedProject-pad als IFC/CSV/MSPDI/MPP/P6XML.
   */
  applyOpenedImport: (parsed: OpenedImport, opts: ApplyLoadedProjectOpts) => AppliedOpenedImport;
  /** DE open-semantiek van élk echt open-pad — Bestand → Openen, Recente bestanden en de AI-import
   *  (`planner_import_schedule`) — op één plek, zodat geen aanroeper een deel kan vergeten (bv.
   *  `linkedOpen`, anders wist Ctrl+S de bibliotheekkoppeling uit het bronbestand). Leidt het
   *  opslagdoel af (`saveTargetFor`: alleen een `canBeSaveTarget`-formaat krijgt er een) en laadt
   *  via `applyOpenedImport` (pristine tabblad hergebruiken of nieuwe documenten, ook de
   *  meervoudige XER-vorm) GEKOPPELD (`linkedOpen: true`: bibliotheekbinding + herkomststempels
   *  blijven, de open-grens draait), met doorrekenen, fitten en de uur-melding. Bewust NIET
   *  hierdoor: IFC-editorbewerkingen (`applyProjectEdit`), losse loads (`loadState`: extensie-import,
   *  devBridge, plus voorbeeldprojecten: die laden los). */
  openAsDocument: (parsed: OpenedImport, source: OpenedFileSource) => AppliedOpenedImport;
}

/** De uitkomst van *Alle externe relaties vernieuwen*. */
export interface ExternalRefreshAllResult {
  refreshed: number;
  missing: number;
  /** Hoeveel bronnen gelezen zijn. */
  sources: number;
  /** Hoeveel bronnen niet gelezen zijn (geen toegang, geen handvat, bestand weg, geweigerd). Geen bron gaat
   *  stil verloren: de melding noemt dit aantal (stap 1.8). */
  unread: number;
  /** De project-id's van de niet gelezen bronnen zonder pad: die kan de planner in de browser opnieuw kiezen. */
  unreadProjectIds: string[];
}

/** De uitkomst van *Bronbestanden kiezen…* (`refreshExternalAnchorsFromChosenFiles`). */
export interface ChosenFilesRefresh {
  refreshed: number;
  missing: number;
  /** Gekozen bestanden die gelezen zijn en bij een koppeling van dit plan horen. */
  sources: number;
  /** Gekozen bestanden die niet te lezen waren, of bij geen koppeling zonder pad van dit plan horen. */
  unmatched: number;
  /** De project-id's van de gelezen bronnen; de rest van de eerder niet gelezen bronnen blijft open. */
  readProjectIds: string[];
}

/** Wat *Bronbestand kiezen…* opleverde (`chooseExternalSourceFile`). */
export type ChosenExternalSource =
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  /** Desktop: het gekozen pad; de dialoog leest het via `parseExternalSource`. */
  | { kind: 'path'; filePath: string }
  /** Browser: de gelezen bron (zonder pad) en het handvat, als de browser dat gaf. */
  | { kind: 'file'; source: ExternalSourceRead; handle: FileSystemFileHandle | null };

/** Het filter van de kiezer voor een bronbestand. */
const SOURCE_FILE_FILTERS = [{ name: 'IFC', extensions: ['ifc'] }];

/** Het opslagdoel van een document na een geslaagde opslag (zie `commitSavedDocument`). */
interface SaveDestination {
  filePath: string;
  fileHandle: FileSystemFileHandle | null;
  siteFileId: string | null;
  /** De net geschreven site-versie (de nieuwe basis); `null` zonder site-doel. */
  siteFileVersion: string | null;
}

export const createFileSlice: AppSliceFactory<FileSlice> = (runtime) => (set, get) => {
  /** De leeskeuze van een open-actie (#804 fase 1a): met de flag `ifcForeignContent` leest IFC als bytes. Eén keer per
   *  actie gelezen, zodat bestandslaag en lezer dezelfde keuze maken. */
  const formatReadOptions = (): FormatReadOptions => ({ ifcBytes: ifcForeignContentEnabled(get().ui.featureFlags) });

  /** Weigert de IFC-uitvoer van het actieve document (fase 1a: een vreemd deel) en meldt dat. */
  const refuseForeignIfcWrite = (state: AppState = get()): boolean => {
    if (!ifcSaveBlocked(state)) return false;
    get().notify(IFC_FOREIGN_SAVE_BLOCKED_NOTICE);
    return true;
  };

  /** Fixronde 1: weigert het doel als het de bron is van een open document met een vreemd deel (zie `foreignTargetCheck`). */
  const foreignTargetCheck = (purpose: 'save' | 'export'): SaveTargetCheck => async (target) => {
    if (!(await isOpenForeignSourceTarget(get(), target, fileIdentityFs))) return false;
    get().notify(purpose === 'save' ? IFC_FOREIGN_TARGET_SAVE_NOTICE : IFC_FOREIGN_TARGET_EXPORT_NOTICE);
    return true;
  };

  // ── Externe bronnen (stap 1.5) ────────────────────────────────────────────────────────────────
  // Per document en bron de versie die de app al las zonder wijziging, of waarop de planner *Later*
  // koos. Sessie-only en per storecontext.
  const settledSourceVersions = new Map<string, string>();
  const sourceKey = (documentId: string, key: string) => `${documentId}\u0000${key}`;
  let sourceCheckRunning = false;
  let sourceCheckAgain = false;

  /** Ververste taken als één undo-stap in het document zetten, met herberekening. Wél een snapshot:
   *  `finishMutation` verlaat de modus "datums zoals opgeslagen", en zonder snapshot is de modus dan
   *  onherstelbaar weg (laden → modus → ankers verversen → weg, zonder weg terug). Bovendien breekt
   *  het anders de snapshot-invariant: een undo van een OUDERE bewerking zou `datesAsRecorded: true`
   *  terugzetten terwijl de ankers al ververst zijn. Een verversing verandert taakdatums en draait
   *  meteen `runCPM` — een gewone, zichtbare datamutatie dus, en die hoort ongedaan te kunnen. */
  const applyRefreshedTasks = (targetDocumentId: string, tasks: Task[]): boolean => {
    let applied = false;
    set((s) => {
      if (s.activeDocumentId !== targetDocumentId) return;
      runtime.beginUndoable(s);
      s.tasks = tasks.map(task => normalizeTaskDates(task, s));
      runtime.finishMutation(s, { stale: true });
      applied = true;
    });
    if (applied) {
      get().recomputeViewRows();
      get().runCPM({ withinEvent: true });
    }
    return applied;
  };

  /** Haalt de balk weg voor deze bronnen (`ExternalSourceUpdate.key`) van dit document (na verversen of
   *  accepteren). */
  const dropSourceUpdates = (documentId: string, keys: ReadonlySet<string>) => {
    const ui = get().ui;
    const next = ui.externalSourceUpdates.filter(u => u.documentId !== documentId || !keys.has(u.key));
    if (next.length === ui.externalSourceUpdates.length) return;
    get().setUI({
      externalSourceUpdates: next,
      ...(ui.externalSourceReview !== null && keys.has(ui.externalSourceReview) ? { externalSourceReview: null } : {}),
    });
  };

  /** De versie van een bron, zonder toestemmingsvraag. */
  const sourceVersionAt = async (locator: ExternalSourceLocator) => {
    if (locator.kind === 'site') return (await get().externalSiteSourceVersion(locator.siteFileId))?.version;
    return locator.kind === 'path'
      ? get().externalSourceVersion(locator.filePath)
      : get().externalProjectSourceVersion(locator.projectId);
  };

  /** Het onthouden handvat van een bron zonder pad (browser zonder host). */
  const sourceHandleFor = async (projectId: string): Promise<FileSystemFileHandle | null> =>
    (await get().externalSourceHandles()).get(projectId) ?? null;

  /** Leest een gekozen of onthouden bestand als bron van dit project; een ander project of een leesfout ⇒ `null`. */
  const readProjectFile = async (projectId: string, file: File, labels?: ImportLabels): Promise<ExternalSourceRead | null> => {
    try {
      const source = await readExternalSourceFile(file, labels, formatReadOptions());
      // Een ander project achter het handvat (het bestand is vervangen door een ander plan): niet deze bron.
      return source.projectId === projectId ? source : null;
    } catch (err) {
      console.error('readExternalSourceFile: kon bronbestand niet lezen:', err);
      return null;
    }
  };

  const fileNameOf = (filePath: string) => filePath.split(/[\\/]/).pop() || filePath;

  const checkExternalSourcesOnce = async (labels?: ImportLabels) => {
    const documentId = get().activeDocumentId;
    // Per bron (`externalSourceKey`): waar de app hem leest en de versies in de koppelingen. Een koppeling
    // met een pad leest via dat pad (desktop); een koppeling zonder pad via het onthouden handvat van haar
    // project-id (browser, stap 1.8); een koppeling met een site-id via de site (`versions(id)`, stap 1.9). Een
    // relatief pad kan de app niet lezen (zie `refreshAllExternalAnchors`).
    const sources = new Map<string, { locator: ExternalSourceLocator; versions: Set<string | undefined> }>();
    for (const task of get().tasks) {
      for (const link of task.externalLinks ?? []) {
        const locator = externalSourceLocatorOf(link.sourceRef);
        if (!locator) continue;
        const key = externalSourceKey(locator);
        if (key === null) continue;
        const entry = sources.get(key) ?? { locator, versions: new Set<string | undefined>() };
        entry.versions.add(link.sourceVersion);
        sources.set(key, entry);
      }
    }
    const found = new Map<string, ExternalSourceUpdate>();
    // Bronnen zonder balk: dezelfde versie als in de koppelingen, of al gelezen zonder wijziging.
    const settled = new Set<string>();
    for (const [key, { locator, versions }] of sources) {
      // Zonder toestemmingsvraag: in de browser alleen een handvat met toestemming `granted` (keuze 6). Op de
      // site de nieuwste versie uit `versions(id)`, met label en auteur.
      const siteVersion = locator.kind === 'site' ? await get().externalSiteSourceVersion(locator.siteFileId) : undefined;
      const version = locator.kind === 'site' ? siteVersion?.version : await sourceVersionAt(locator);
      if (get().activeDocumentId !== documentId) return;
      // Niet te lezen (geen toegang, bestand weg): een bestaande balk blijft staan, er komt geen nieuwe.
      if (!version) continue;
      if (versions.size === 1 && versions.has(version)) { settled.add(key); continue; }
      const existing = get().ui.externalSourceUpdates.find(u => u.documentId === documentId && u.key === key);
      // Al een balk voor deze versie: niets te doen. De eindfilter laat de balk staan zolang hij er nog is;
      // koos de planner intussen *Later*, dan komt hij niet terug (review #811 ronde 2).
      if (existing?.version === version) continue;
      if (settledSourceVersions.get(sourceKey(documentId, key)) === version) { settled.add(key); continue; }
      const src = await get().readExternalSourceAt(locator, labels);
      if (get().activeDocumentId !== documentId) return;
      if (!src) continue;
      const tasks = get().tasks;
      // Alleen de koppelingen naar dít bestand (met pad of site-id), of zonder pad naar dit project: een kopie
      // met hetzelfde project-id elders telt niet mee.
      const result = refreshExternalAnchors(tasks, src, externalSourceScopeOf(locator));
      const changedLinks = externalAnchorChanges(tasks, result.tasks).length;
      // Op de site telt de versie uit `versions(id)`: de balk vergelijkt daarmee, ook als `open` geen versie gaf.
      const readVersion = locator.kind === 'site' ? version : src.version ?? version;
      if (changedLinks === 0) {
        // Afgehandeld is de versie die de app echt las. Gaf `open(id)` een andere versie dan `versions(id)` (de
        // site loopt achter), dan leest de volgende controle opnieuw (review #859 ronde 1).
        settledSourceVersions.set(sourceKey(documentId, key), src.version ?? version);
        settled.add(key);
        continue;
      }
      found.set(key, {
        documentId, key, locator,
        fileName: locator.kind === 'path' ? fileNameOf(locator.filePath) : src.fileName ?? src.projectName,
        version: readVersion,
        ...(siteVersion ? { siteVersionLabel: siteVersion.label?.trim() || siteVersion.version } : {}),
        // Op de site: wie de versie opsloeg (`versions`); anders de auteur uit de projectgegevens.
        ...(siteVersion?.author?.trim() ? { author: siteVersion.author.trim() }
          : src.author ? { author: src.author } : {}),
        changedLinks,
      });
    }
    const current = get().ui.externalSourceUpdates;
    const next = [
      ...current.filter(u => u.documentId !== documentId
        || (sources.has(u.key) && !settled.has(u.key) && !found.has(u.key))),
      ...found.values(),
    ];
    const same = next.length === current.length && next.every(u => current.includes(u));
    if (!same) get().setUI({ externalSourceUpdates: next });
  };

  // Voeg een geopend/opgeslagen bestand toe aan de recents (elke herbruikbare ref).
  const pushRecent = async (ref: FileRef | null, name: string) => {
    if (!ref) return; // fallback-web: geen herbruikbare ref → niet aan recents
    const list = await addRecent(ref, name);
    set((s) => { s.recentFiles = list; });
  };

  /**
   * Kwam het bestand via de download-terugval binnen in plaats van op de gekozen plek? Zeg dat dan,
   * want anders zoekt de gebruiker zijn bestand op een locatie waar het niet staat. Dit is
   * nadrukkelijk GEEN fout (severity `info`): het opslaan is geslaagd, alleen langs een andere weg.
   * Eén gedeelde helper zodat alle vier de opslaan/exporteer-paden dezelfde melding geven.
   */
  const noticeIfDownloaded = (outcome: SaveOutcome | null) => {
    if (!outcome?.viaDownload) return;
    get().notify({
      severity: 'info',
      messageKey: 'notifications.savedViaDownload',
      params: { name: outcome.name },
      // Bij "project + bibliotheek" vallen twee downloads vlak na elkaar; die horen niet als twee
      // losse toasts de stapel te vullen.
      dedupeKey: 'saved-via-download',
    });
  };

  const saveSourceForDocument = (state: AppState, documentId: string): AppState | DocumentPayload | null => {
    if (state.activeDocumentId === documentId) return state;
    return state.documents.find(document => document.id === documentId)?.payload ?? null;
  };

  // Een opslagdoel zet ALLE vier de doelvelden: wie naar een lokaal bestand opslaat, verliest zijn
  // site-doel, en omgekeerd. Anders schreef de volgende Ctrl+S naar het oude doel. Bij een site-doel
  // is `siteFileVersion` de net geschreven versie: de nieuwe basis van DIT document. Een site-doel
  // zet ook AutoSave uit (automatisch opslaan naar de site bestaat niet).
  const commitSavedDocument = (
    documentId: string,
    savedSource: AppState,
    destination?: SaveDestination,
  ): boolean => {
    const currentSource = saveSourceForDocument(get(), documentId);
    if (!currentSource) return false;
    const unchanged = sameIFCSource(savedSource, currentSource);
    const applyDestination = (target: Pick<AppState, keyof SaveDestination | 'autoSaveToFile'>) => {
      if (!destination) return;
      target.filePath = destination.filePath;
      target.fileHandle = destination.fileHandle;
      target.siteFileId = destination.siteFileId;
      target.siteFileVersion = destination.siteFileId ? destination.siteFileVersion : null;
      if (destination.siteFileId) target.autoSaveToFile = false;
    };
    set((state) => {
      if (state.activeDocumentId === documentId) {
        applyDestination(state);
        if (unchanged) state.isDirty = false;
        return;
      }
      const entry = state.documents.find(document => document.id === documentId);
      if (!entry?.payload) return;
      applyDestination(entry.payload);
      if (unchanged) entry.payload.isDirty = false;
    });
    return unchanged;
  };

  /** Het opslagdoel van een lokale opslaan-als-uitkomst (Tauri-pad, handle of alleen een naam). */
  const localDestination = (outcome: SaveOutcome): SaveDestination => ({
    filePath: outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name,
    fileHandle: outcome.ref?.kind === 'handle' ? outcome.ref.handle : null,
    siteFileId: null,
    siteFileVersion: null,
  });

  /**
   * Een fout van de SITE bij opslaan. Een conflict (`code === 'conflict'`) krijgt een eigen melding:
   * iemand anders sloeg het bestand intussen op, en de gebruiker moet weten dat zijn werk NIET is
   * opgeslagen maar nog wel in de app staat. Elke andere fout: de gewone opslaanfout met de tekst van
   * de site. Het document blijft in beide gevallen gewijzigd (er is niets gecommit).
   */
  const notifySiteSaveError = (err: unknown, name: string, dedupeKey?: string) => {
    console.error('Opslaan op de site mislukt:', err);
    if (isSiteConflict(err)) {
      get().notify({
        severity: 'error', messageKey: 'notifications.siteSaveConflict', params: { name }, detail: siteErrorMessage(err),
        dedupeKey, replaceOnDedupe: true,
      });
      return;
    }
    get().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: siteErrorMessage(err), dedupeKey, replaceOnDedupe: true });
  };

  /** Sla het document op als NIEUW bestand op de site; daarna is de site het opslagdoel. Gooit bij
   *  een fout van de site (de aanroeper meldt hem). */
  const saveAsNewSiteFile = async (documentId: string, state: AppState, content: string, name: string): Promise<boolean> => {
    const info = await saveNewSiteFile(name, content);
    const saved = commitSavedDocument(documentId, state, {
      filePath: info.name, fileHandle: null, siteFileId: info.id, siteFileVersion: info.version,
    });
    await pushRecent({ kind: 'site', id: info.id }, info.name);
    return saved;
  };

  /**
   * Open de keuze uit "Openen van de site". De NIEUWSTE versie krijgt de site als opslagdoel en komt
   * in de recente bestanden. Een OUDERE versie opent als kopie zonder opslagdoel (naam met de versie
   * erin) en niet in de recente bestanden: zo overschrijft Ctrl+S nooit per ongeluk de nieuwste
   * versie. Gooit bij een lees- of parsefout.
   *
   * Geeft de site de nieuwste versie als ALLEEN-LEZEN (#818), dan opent het document zonder
   * opslagdoel en zonder basis, onder zijn eigen naam, met een melding dat Opslaan een nieuw bestand
   * maakt. Het blijft in de recente bestanden: het is het bestand zelf, geen oudere versie, en bij een
   * volgende keer kan het weer schrijfbaar zijn.
   */
  const openSiteChoice = async (choice: Extract<SiteOpenChoice, { kind: 'site' }>, labels?: ImportLabels) => {
    const readOptions = formatReadOptions();
    const opened = await openSiteFile(choice.id, { binaryExtensions: binaryExtensions(readOptions), version: choice.version });
    const parsed = await parseOpenedFile({ name: opened.name, text: opened.content, bytes: opened.bytes }, labels, readOptions);
    if (choice.version === undefined && opened.readOnly) {
      get().openAsDocument(parsed, { name: opened.name, ref: null });
      offerFormatNotice(opened.name, opened.content);
      await pushRecent({ kind: 'site', id: choice.id }, opened.name);
      // Blijvend: de gebruiker moet weten dat Opslaan hier een nieuw bestand maakt.
      get().notify({ severity: 'info', sticky: true, messageKey: 'notifications.siteFileReadOnly', params: { name: opened.name } });
      return;
    }
    if (choice.version === undefined) {
      // De gelezen versie wordt pas NA een geslaagde parse de basis, en alleen van dít document.
      get().openAsDocument(parsed, { name: opened.name, ref: opened.ref, siteFileVersion: opened.version });
      offerFormatNotice(opened.name, opened.content);
      await pushRecent(opened.ref, opened.name);
      return;
    }
    get().openAsDocument(parsed, { name: siteVersionCopyName(opened.name, choice.version, choice.copyName), ref: null });
    offerFormatNotice(opened.name, opened.content);
  };

  /**
   * Heropen een recent bestand van de site: de nieuwste versie, met de site als doel en de gelezen
   * versie als basis. Zegt de site dat het bestand niet meer bestaat (`code === 'not-found'`), dan gaat
   * het uit Recent, met een melding. Elke andere fout (netwerk, rechten, een storing, een bestand dat
   * niet te lezen is) geeft een melding met de tekst van de site en laat het bestand in Recent staan:
   * de volgende poging kan gewoon lukken.
   */
  const openRecentSiteFile = async (entry: RecentEntry, labels?: ImportLabels) => {
    if (entry.ref.kind !== 'site') return;
    try {
      await openSiteChoice({ kind: 'site', id: entry.ref.id }, labels);
    } catch (err) {
      console.error('Openen van de site mislukt:', err);
      if (isSiteNotFound(err)) {
        const list = await removeRecent(entry.id);
        set((s) => { s.recentFiles = list; });
        get().notify({ severity: 'error', messageKey: 'notifications.siteFileGone', params: { name: entry.name } });
        return;
      }
      get().notify(importFailureNotice(err, siteErrorMessage(err)));
    }
  };

  /** Staat er al een site-vraag open? Dan start Opslaan/Openen geen tweede ronde: Ctrl+S in het
   *  naamveld van "Opslaan op de site" zou anders na het antwoord nog een versie schrijven. Zonder
   *  site zijn beide vlaggen altijd `null`. Ook de schemavraag bij opslaan telt mee (issue #292). */
  const siteQuestionOpen = () => get().ui.pendingSiteSave !== null || get().ui.pendingSiteOpen !== null
    || get().ui.pendingIfcSchemaQuestion !== null || get().ui.pendingDependentAnchorWarning !== null;

  /** Uitleg na het openen van een ander formaat dan IFC (`services/formatNotice.ts`). Alleen de
   *  open-routes die de GEBRUIKER start roepen dit aan (Bestand → Openen, Recente bestanden, Openen
   *  van de site), ná een geslaagde `openAsDocument`: één uitleg per open-actie, ook als een XER
   *  drie tabbladen opent. MCP (`openAsDocument` rechtstreeks), extensies en voorbeelden
   *  (`applyLoadedProject`) en crashherstel komen hier niet langs. */
  const offerFormatNotice = (name: string, text: string | undefined) => {
    const kind = formatNoticeToShow(name, text, get().ui.formatNoticeHidden);
    if (kind) set((s) => { s.ui.pendingFormatNotice = kind; });
  };

  /**
   * De schemavraag bij het eerste EXPLICIETE opslaan (issue #292, besluit eigenaar 2026-10-13: "we
   * veranderen niet zomaar bestandstypes"). Is het actieve document een geopend IFC-bestand met een
   * ander schema dan de standaard, en heeft de gebruiker nog niet gekozen (`Project.ifcSchemaUnconfirmed`),
   * dan vraagt de app eerst: naar IFC4X3_ADD2, of het schema van het bestand houden.
   *
   * Het antwoord hoort bij het bestand, niet bij de bewerkingen: het zet `project.ifcSchema` en wist de
   * open vraag ZONDER eigen undo-stap en zonder het document gewijzigd te maken. Ongedaan maken en
   * opnieuw doen veranderen het schema daarna niet meer: `restoreSnapshot` houdt het schema van het
   * bestand aan (`state/ifcSchemaChoice.ts`, review #336). Anders schreef AutoSave na een undo stil
   * weer het oude schema. Annuleren ⇒ `false`:
   * er wordt niets opgeslagen. Alleen Opslaan en Opslaan als roepen dit aan; automatisch opslaan,
   * crashherstel, export en MCP schrijven het huidige schema zonder vraag.
   */
  const settleIfcSchemaQuestion = async (): Promise<boolean> => {
    const before = get();
    const question = ifcSchemaQuestionFor(before.project);
    if (!question) return true;
    const documentId = before.activeDocumentId;
    const answer = await askIfcSchema(question);
    if (!answer) return false;
    // De dialoog blokkeert een documentwissel; dit is het vangnet.
    if (get().activeDocumentId !== documentId) return false;
    set((s) => { applyIfcSchemaChoice(s.project, answer); });
    return true;
  };

  /**
   * De waarschuwing vóór opslaan bij de bron (stap 1.11, keuze 3 zonder cloud). Is er voor dit document
   * een zoekresultaat *Afhankelijke projecten*, dan rekent de app per gevonden koppeling het anker opnieuw
   * zoals het afhankelijke project het straks uit het opgeslagen bestand leest (`dependentAnchorsAsSaved`:
   * schrijven, lezen en doorrekenen op een kopie; review #857 ronde 1). Ook zonder F5 ziet de vraag zo de
   * datums die de afnemer krijgt; het geopende document zelf rekent niet. Wordt er een te krap, dan vraagt de app eerst:
   * *Toch opslaan* of *Annuleren* (`false`: niets opslaan). Alleen Opslaan en Opslaan als door de planner;
   * automatisch opslaan, crashherstel en MCP komen hier niet langs.
   */
  const settleDependentAnchors = async (): Promise<boolean> => {
    const before = get();
    const result = before.ui.dependentProjects.find(r => r.documentId === before.activeDocumentId);
    if (!result || result.projectId !== before.project.id || result.links.length === 0) return true;
    let tight;
    try {
      tight = await dependentAnchorsAsSaved(result.links, writeIFC(buildWriteIFCInput(before)));
    } catch (err) {
      // Het eigen bestand niet terug te lezen: dan de huidige taken, zoals ze op het scherm staan.
      console.warn('Afhankelijke projecten: bron als opgeslagen niet te lezen:', err);
      tight = tightDependentAnchors(result.links, before.tasks);
    }
    if (tight.length === 0) return true;
    const documentId = before.activeDocumentId;
    if (!(await askDependentAnchors(tight))) return false;
    // De dialoog blokkeert een documentwissel; dit is het vangnet.
    return get().activeDocumentId === documentId;
  };

  let saveAttemptSequence = 0;
  const writeActiveDocument = (expectedDocumentId?: string): Promise<boolean> => runProjectFileWrite(async () => {
    // Fixronde 1 (BLOKKEERT 1): het document van de start. Wisselt het actieve document tijdens het wachten (de
    // schemavraag, de afhankelijke projecten met een luie import), dan stopt opslaan stil, zoals bij een verwacht id.
    const startDocumentId = get().activeDocumentId;
    if (expectedDocumentId && expectedDocumentId !== startDocumentId) return false;
    if (refuseForeignIfcWrite()) return false;
    if (!(await settleIfcSchemaQuestion())) return false;
    if (!(await settleDependentAnchors())) return false;
    const state = get();
    const documentId = state.activeDocumentId;
    if (documentId !== startDocumentId) return false;
    // Opnieuw op de momentopname die de app echt schrijft: niets mag tijdens het wachten een vreemd deel binnenbrengen.
    if (refuseForeignIfcWrite(state)) return false;
    const content = writeIFC(buildWriteIFCInput(state));
    // Gezet zolang er naar de SITE geschreven wordt: dan meldt de catch een sitefout (met conflict-
    // melding) in plaats van de gewone opslaanfout. Zonder site blijft hij `null`.
    let siteName: string | null = null;
    let handleWriteFailed = false;
    // Eén melding per opslagpoging: faalt ook de terugval, ververs dan de reden zonder een tweede
    // toast of ×2. Een volgende Ctrl+S is een nieuwe poging met een eigen melding.
    const failureNoticeKey = `project-save:${++saveAttemptSequence}`;
    const notifyWriteError = (err: unknown) => {
      console.error('Save failed:', err);
      get().notify({
        severity: 'error', messageKey: 'notifications.saveFailed', detail: saveErrorDetail(err),
        dedupeKey: failureNoticeKey, replaceOnDedupe: true,
      });
    };

    try {
      const ref = saveTargetRef(state);
      // Fixronde 1: het eigen doel is de bron van een (ander) open document met een vreemd deel. Vóór elke write: site,
      // pad en handle.
      if (ref && await foreignTargetCheck('save')(ref)) return false;
      // Een site-doel: een nieuwe versie van dat bestand, met de basis van DIT document. De net
      // geschreven versie wordt zijn nieuwe basis. Is de site-opslag weg (bijv. een hersteld
      // site-document buiten de site), dan geldt het als "geen doel" en loopt de gewone route.
      if (ref?.kind === 'site' && siteStorageAvailable()) {
        siteName = documentFileName(state);
        const saved = await saveSiteFileVersion(ref.id, siteName, content, state.siteFileVersion);
        if (saved.conflictCopy) {
          // De SuperCloud bewaarde het werk na een conflict in een KOPIE (#818). Die kopie wordt het
          // opslagdoel van dit document; het telt als opgeslagen, en de gebruiker hoort de naam.
          const committed = commitSavedDocument(documentId, state, {
            filePath: saved.name, fileHandle: null, siteFileId: saved.id, siteFileVersion: saved.version,
          });
          await pushRecent({ kind: 'site', id: saved.id }, saved.name);
          get().notify({
            // Blijvend: het werk staat nu onder een andere naam.
            severity: 'info', sticky: true, messageKey: 'notifications.siteSaveConflictCopy',
            params: { name: saved.name, original: siteName },
          });
          return committed;
        }
        return commitSavedDocument(documentId, state, {
          filePath: state.filePath ?? saved.name, fileHandle: null, siteFileId: ref.id, siteFileVersion: saved.version,
        });
      }
      // Een site-ref geeft hier altijd `false` (zie `saveToRef`): dan loopt de route hieronder.
      if (ref) {
        try {
          if (await saveToRef(ref, content)) return commitSavedDocument(documentId, state);
        } catch (err) {
          // Alleen de browser biedt na een echte handle-schrijffout de bestaande uitweg Opslaan als.
          // Meld de fout eerst; `false` (geen toestemming/annulering) blijft zonder foutmelding.
          if (isTauri() || ref.kind !== 'handle') throw err;
          handleWriteFailed = true;
          notifyWriteError(err);
        }
      }

      // Geen (bruikbaar) doel en wel site-opslag: eerst "Opslaan op de site" met de keuze voor deze
      // pc. Zonder site-opslag komt deze vraag nooit en blijft alles hieronder zoals het was.
      if (siteStorageAvailable()) {
        const choice = await askSiteSave({ defaultName: siteSaveDefaultName(state) });
        if (!choice) return false;
        if (choice.kind === 'site') {
          siteName = choice.name;
          return await saveAsNewSiteFile(documentId, state, content, choice.name);
        }
      }

      // Hier is de opslag NIET teruggeschreven naar een bestaand bestand. In de browser legt
      // `browserSaveNotice` één keer per sessie uit waarom er weer een venster of download komt.
      const hadFile = !isTauri() && (state.fileHandle !== null || !!state.filePath);
      const outcome = await saveFileDialog(
        `${suggestedFileBase(state)}.ifc`,
        content,
        [{ name: 'IFC Files', extensions: ['ifc'] }],
        { refuseTarget: foreignTargetCheck('save') },
      );
      if (!outcome) return false;
      const saved = commitSavedDocument(documentId, state, localDestination(outcome));
      await pushRecent(outcome.ref, outcome.name);
      // Een geslaagde kopie na een schrijffout bewijst geen browserbeperking. De echte fout is al
      // gemeld; alleen een download vraagt dan nog om uitleg over de nieuwe locatie.
      if (!isTauri() && (!handleWriteFailed || outcome.viaDownload)) {
        const notice = browserSaveNotice({ hadFile, existingName: state.filePath ? basename(state.filePath) : null, outcome });
        if (notice) get().notify(notice);
      }
      return saved;
    } catch (err) {
      if (siteName !== null) {
        notifySiteSaveError(err, siteName, failureNoticeKey);
        return false;
      }
      notifyWriteError(err);
      return false;
    }
  });

  /** Opslaan als (Ctrl+Shift+S / Bestand → Opslaan als). */
  const saveActiveDocumentAs = (): Promise<void> => runProjectFileWrite(async () => {
    // Fixronde 1 (BLOKKEERT 1): zie `writeActiveDocument`.
    const startDocumentId = get().activeDocumentId;
    if (refuseForeignIfcWrite()) return;
    if (!(await settleIfcSchemaQuestion())) return;
    if (!(await settleDependentAnchors())) return;
    const state = get();
    const documentId = state.activeDocumentId;
    if (documentId !== startDocumentId) return;
    if (refuseForeignIfcWrite(state)) return;
    // Gedeelde helper: één plek voor het state→IFC-options-object, zodat dit
    // pad geen velden kan laten vallen.
    const content = writeIFC(buildWriteIFCInput(state));
    // `state` = momentopname vóór de eerste await; zelfde reden als bij saveFile: isDirty pas
    // wissen als er tijdens de opslaan-als-dialoog niets gewijzigd is.
    let siteName: string | null = null;

    try {
      // Site-opslag aanwezig: "Opslaan op de site" maakt altijd een NIEUW site-bestand (opslaan
      // als); "Op deze pc…" valt door naar de bestaande route hieronder.
      if (siteStorageAvailable()) {
        const choice = await askSiteSave({ defaultName: siteSaveDefaultName(state) });
        if (!choice) return;
        if (choice.kind === 'site') {
          siteName = choice.name;
          await saveAsNewSiteFile(documentId, state, content, choice.name);
          return;
        }
      }
      const outcome = await saveFileDialog(
        state.filePath ?? `${suggestedFileBase(state)}.ifc`,
        content,
        [{ name: 'IFC Files', extensions: ['ifc'] }],
        { refuseTarget: foreignTargetCheck('save') },
      );
      if (!outcome) return;
      commitSavedDocument(documentId, state, localDestination(outcome));
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
    } catch (err) {
      if (siteName !== null) {
        notifySiteSaveError(err, siteName);
        return;
      }
      console.error('Save As failed:', err);
      get().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: saveErrorDetail(err) });
    }
  });

  const saveActiveDocument = (expectedDocumentId?: string): Promise<boolean> => (
    siteQuestionOpen() ? Promise.resolve(false) : writeActiveDocument(expectedDocumentId)
  );

  return {
    applyProjectEdit: (parsed, opts) => get().applyLoadedProject(parsed, {
      intent: 'edit',
      recompute: true,
      viewStartDate: opts?.viewStartDate,
    }),

    applyLoadedProject: (parsed, opts) => {
      // Open veldinvoer hoort bij het document dat nu vervangen wordt (zie pendingTextEdits.ts).
      runtime.finishPendingTextEdits();
      const current = get();
      const editing = opts.intent === 'edit';
      const filePath = opts.filePath !== undefined ? opts.filePath : current.filePath;
      // Dubbele id's uit een kapot of vreemd bestand eerst uniek maken; de store sleutelt op id.
      const { result: uniqueParsed, renamed: duplicateIds } = ensureUniqueImportIds(parsed);
      const payload = payloadFromImport(uniqueParsed, filePath);
      // #804 fase 1a: vervangt dit de inhoud op hetzelfde opslagdoel (IFC-paneel, `loadState`) zonder eigen bron, dan
      // blijft de bron van het document staan. Anders verdween het vreemde deel uit de bewaking, en schreef Ctrl+S het
      // modelbestand over met alleen planning.
      const inheritsTarget = opts.filePath === undefined && opts.fileHandle === undefined && opts.siteFileId === undefined;
      const ownSource = payload.ifcSource;
      if (!payload.ifcSource && inheritsTarget) payload.ifcSource = current.ifcSource;
      if (editing) {
        // InternalProjectId kan in de tekst gewijzigd zijn. De reader sleutelt deze drie
        // ankers op dat ingelezen id, terwijl de editor de sessie-identiteit hieronder behoudt.
        // Verplaats de sleutels mee, anders vindt de writer de bewaarde GlobalIds niet terug.
        if (payload.ifcGlobalIds && payload.project.id !== current.project.id) {
          const globalIds = { ...payload.ifcGlobalIds };
          for (const kind of ['proj', 'wp', 'ws'] as const) {
            const sourceKey = ifcObjectSeed(kind, payload.project.id);
            const guid = globalIds[sourceKey];
            if (guid === undefined) continue;
            globalIds[ifcObjectSeed(kind, current.project.id)] = guid;
            delete globalIds[sourceKey];
          }
          payload.ifcGlobalIds = globalIds;
        }
        // De tekst vervangt de inhoud, niet het document, zijn bibliotheek of de sessiekeuze
        // voor AutoSave. Pad, handle en site-versie blijven via de bestaande opties hieronder.
        payload.project = {
          ...payload.project,
          id: current.project.id,
          companyId: current.project.companyId,
          companyName: current.project.companyName,
        };
        payload.autoSaveToFile = current.autoSaveToFile;
      }
      // WBS auto bij het openen (eigenaarsbesluit 2026-10-17): één generieke stap voor élk
      // formaat, op de geïsoleerde payload vóór publicatie. Daardoor geen undo-stap en blijft
      // `isDirty` false — het hoort bij het openen. Alleen op de echte open-paden (`linkedOpen`:
      // `openAsDocument`), niet bij de IFC-editor of `loadState` (extensie-`loadProject`:
      // die mogen het project niet stil veranderen). Bewust niet in
      // `payloadFromImport`: die bouwt ook het crashherstel (`payloadFromInput`).
      if (opts.linkedOpen && !editing) payload.project = inferWbsAutoNumberOnOpen(payload.project, payload.tasks);
      payload.view = opts.viewStartDate === undefined
        ? { ...current.view }
        : { ...current.view, viewStartDate: opts.viewStartDate };
      payload.collapsedTaskIds = current.ui.collapsedTaskIds;
      payload.fileHandle = opts.fileHandle !== undefined ? opts.fileHandle : current.fileHandle;
      payload.siteFileId = opts.siteFileId !== undefined ? opts.siteFileId : current.siteFileId;
      payload.siteFileVersion = !payload.siteFileId
        ? null
        : opts.siteFileVersion !== undefined
          ? opts.siteFileVersion
          : (opts.siteFileId !== undefined ? null : current.siteFileVersion);
      // Fixronde 1: het kenmerk van een bron met een vreemd deel, met het doel van die bron (pad, handle, site-bestand).
      // Een eigen bron geeft een nieuw kenmerk; zonder eigen bron op hetzelfde doel blijft het kenmerk van het document
      // (ook na crashherstel, als `ifcSource` al weg is).
      payload.foreignSourceMark = ownSource
        ? foreignSourceMarkFor(ownSource, { filePath: payload.filePath, siteFileId: payload.siteFileId, fileHandle: payload.fileHandle })
        : inheritsTarget ? current.foreignSourceMark : null;
      if (!opts.linkedOpen && !editing) {
        payload.project = { ...payload.project, companyId: undefined, companyName: undefined };
        stripLibraryOrigins(payload);
        refreshProjectCalendarCache(payload);
      }
      const prepared = prepareLoadedPayload(payload, { recompute: !!opts.recompute });
      if (opts.recompute && !editing) {
        // Een editorbewerking toont de nieuwe berekening. Alleen een laadpad kan de opgeslagen
        // datums activeren; de undo-snapshot bewaart de eventuele modus van vóór de bewerking.
        // Of de modus aangaat, beslist `applyRecordedDatesOnLoad` (verse import vs. heropening met
        // `importPristine`); anders vergeet het document de opgeslagen datums (geen aanbod-stand). `payload.tasks`
        // is hier bewust de PRE-solve
        // array (zie de docstring van `applyRecordedDatesOnLoad`): `prepareLoadedPayload` muteert
        // zijn `input`-argument niet.
        applyRecordedDatesOnLoad(payload.tasks, prepared, parsed);
      }
      const activation = materializeLibraryBoundary({
        payload: prepared,
        companies: current.companies,
        pools: current.pools,
        mode: opts.linkedOpen && !editing ? 'open-boundary' : 'silent-switch',
      });
      const conversion = opts.recompute && !editing
        // `minuteModelTransition` normaliseert de vastlegging zelf (één normalisatie per grens).
        ? minuteModelTransition(payload, activation.payload,
            captureRecordedDates(payload.tasks, parsed.recordedFields, parsed.recordedTimes))
        : null;
      if (conversion) activation.payload = conversion.after;
      set((s) => {
        // Een nieuwe projectinhoud: de vorige weigeringen gaan weg, net als bij een documentwissel
        // of een bewerking (eigenaarsbesluit 2026-10-19 5b). Vóór de meldingen hieronder.
        clearRefusals(s.ui);
        if (editing) runtime.beginUndoable(s, { label: 'IFC toepassen' });
        else removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
        if (activation.invalidateRedoScope) {
          invalidateDocumentRedo(s, s.activeDocumentId);
        }
        hydratePayload(s, activation.payload);
        if (conversion) recordMinuteModelTransition(s, conversion);
        s.viewRows = [...activation.viewRows];
        s.resourceLoadResult = activation.resourceLoadResult;
        s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
        s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
        if (editing) runtime.finishMutation(s);
      });
      for (const cal of [payload.calendar, ...payload.calendars].filter((cal, i, all) => all.findIndex(c => c.id === cal.id) === i)) {
        const source = cal.id === parsed.calendar.id ? parsed.calendar : parsed.resourceCalendars?.find(c => c.id === cal.id);
        if (source && (source.workEndHour !== cal.workEndHour || source.simpleBreakStartMinute !== cal.simpleBreakStartMinute
          || source.simpleBreakDurationMinutes !== cal.simpleBreakDurationMinutes)) {
          get().notify({ severity: 'info', messageKey: 'notifications.minuteModelCalendarRepaired', params: { calendar: cal.name }, sticky: true });
        }
      }
      const conversionNotice = conversion && minuteModelNotice(conversion);
      if (conversionNotice) get().notify(conversionNotice);
      // De open-grens ververste een achterlopende bibliotheekkalender en de werkregel paste taken
      // aan — dezelfde melding als de kalenderdialoog.
      notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, activation.workRuleSettle);
      // Het bestand draagt taaktypedata terwijl de instelling uit staat
      // ⇒ de werkregel-UI is voor dit document ontsloten; meld dat één keer (met gids-link).
      {
        const st = get();
        // Alleen een AFGELEIDE regel (uit mspTaskType/p6DurationType) ontsluit stil.
        if (!opts.deferTaskTypesNotice && st.taskTypesVisible && !st.ui.showTaskTypes
          && taskTypesNeedNotice(st.tasks, st.assignments, st.project)) {
          notifyTaskTypesUnlocked(st.notify, st.activeDocumentId);
        }
      }
      if (opts.recompute) {
        const cpm = activation.payload.cpmResult;
        const failed = scheduleFailedNotice(cpm);
        if (failed) get().notify(failed);
        runtime.emitHostEvent(HOST_EVENTS.scheduleCalculated, {
          hasError: !!cpm?.error,
          error: cpm?.error ?? null,
          criticalTasks: activation.payload.tasks.filter(task => task.time.isCritical).length,
        });
      }
      if (opts.fit) get().requestFitToProject(); // canvas op het HELE project passen.
      // Relaties die de solver ECHT niet kon meerekenen: een verzameltaak-eindpunt op zich is
      // (dankzij `expandSummaryRelations`) GEEN reden om te melden — die relaties rekenen gewoon
      // mee. Wat overblijft is de voorouder-guard (een taak gekoppeld aan zijn eigen
      // (voor)ouder-samenvatting), een lege/kapotte tak, of de MAX_EXPANDED_RELATIONS-klem — stuk
      // voor stuk gevallen waarin de relatie écht geen effect heeft. Rechtstreeks
      // `expandSummaryRelations` aanroepen i.p.v. op `cpmResult.droppedSequenceIds` leunen: de
      // pure expansiefunctie geeft hier hetzelfde antwoord zonder timing-afhankelijkheid van
      // `cpmResult`. Bewust NIET gefilterd uit het document — dat zou logica uit het bronbestand
      // vernietigen bij open + opslaan — maar wel één keer gemeld, want anders merkt niemand die
      // een P6/MSP-plan importeert dat er logica stilvalt.
      if (duplicateIds > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.duplicateIdsRenamed',
          params: { total: duplicateIds },
          dedupeKey: 'duplicate-ids-renamed',
          sticky: true, // hernummerd bij het openen: blijft staan (openNoticeSticky.ts)
        });
      }
      const dropped = expandSummaryRelations(parsed.tasks, parsed.sequences).droppedSequenceIds.length;
      if (dropped > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.summaryRelationsDropped',
          params: { total: dropped },
          dedupeKey: 'summary-relations-dropped',
          sticky: true, // relaties rekenen niet mee: blijft staan (openNoticeSticky.ts)
        });
      }
      // Een `.mpp`-bestand met aantoonbaar onderbroken, genivelleerde of resource-gedreven
      // (nivellering/splits/timephased-vensters) taken. De motor rekent die taken door zoals MS
      // Project (zie `CPMSolver.ts`, `mppReader.ts`'s `countScheduleNotes`), dus de melding is
      // uitsluitend INFORMATIEF: ze vertelt dát het bestand zulke taken bevat,
      // niet dat de datums onbetrouwbaar zouden zijn. Alleen `readMPP` vult `sourceScheduleNotes`
      // (ander formaat ⇒ `undefined` ⇒ geen melding). Zelfde patroon als `summaryRelationsDropped`
      // hierboven: info, één keer per open, gededupliceerd op dedupeKey. Géén taakveld —
      // puur een import-tijd-telling voor deze melding.
      const scheduleNotesTotal = parsed.sourceScheduleNotes?.total ?? 0;
      if (scheduleNotesTotal > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.mppSourceScheduleNotes',
          params: { count: scheduleNotesTotal },
          dedupeKey: 'mpp-split-leveled',
        });
      }
      runtime.emitHostEvent(HOST_EVENTS.projectLoaded, {
        tasks: parsed.tasks.length,
        sequences: parsed.sequences.length,
        resources: parsed.resources.length,
      });
      return conversion;
    },

    applyOpenedImport: (parsed, opts) => {
      const results = isMultiDocumentImport(parsed) ? parsed.results : [parsed];
      if (results.length === 0) throw new Error('Openroute ontving geen projectdocumenten');

      const reusedActiveTab = isActivePristine(get());
      const openedDocumentIds: string[] = [];
      const minuteModelConversions: AppliedOpenedImport['minuteModelConversions'] = [];
      // Som over alle zojuist geopende documenten in de modus van `recordedDates.total` (het aantal
      // taken dat de opgeslagen datums TOONT) — per document eigen vlag/eigen vastlegging (elk
      // document leest zijn eigen `recordedTimes` uit zijn eigen `ImportResult`), maar de MELDING
      // blijft er één per bestand.
      let datesAsRecordedShownTotal = 0;
      let taskTypesUnlockedDocs = 0;
      // De formaatneutrale
      // melding hieronder telt uitsluitend VERSE imports.
      // Een heropend eigen IFC ('ifc-own'/'xer-archive') krijgt de strook (die zegt het al), maar geen
      // openingsmelding — dat is het eigen projectbestand, geen import; ook niet als `importPristine`
      // de modus bij een ongewijzigd bestand automatisch weer aanzet.
      let freshShownTotal = 0;
      for (const result of results) {
        // De eerste payload mag het lege starttabblad hergebruiken; elk volgend project krijgt
        // gegarandeerd een eigen tab. Dit leest de actuele state per iteratie, want de vorige load
        // heeft die state bewust niet-pristine gemaakt.
        if (!isActivePristine(get())) get().newDocument();
        openedDocumentIds.push(get().activeDocumentId);
        // `applyLoadedProject` draait de open-/bibliotheekgrens zelf (materializeLibraryBoundary),
        // dus elk document krijgt hem — geen aparte runOpenBoundary-aanroep meer nodig.
        const conversion = get().applyLoadedProject(result, { ...opts, deferTaskTypesNotice: true });
        // Dezelfde voorwaarde als `minuteModelNotice`: alleen een daadwerkelijke verschuiving telt.
        if (conversion && conversion.shifted.length > 0) {
          minuteModelConversions.push({ documentId: get().activeDocumentId,
            shifted: [...conversion.shifted], maxWorkdays: conversion.maxWorkdays });
        }
        // Taaktypes: ontsloten door de bestandsdata terwijl de instelling uit staat ⇒ één keer
        // per document geclaimd, maar gemeld in de ene bestandsmelding hieronder.
        // Alleen melden bij opgeslagen werk, een projectstandaard of
        // een eigen regel; een regel die de lezer alleen uit het importveld afleidde ontsluit stil.
        const cur = get();
        if (cur.taskTypesVisible && !cur.ui.showTaskTypes
          && taskTypesNeedNotice(cur.tasks, cur.assignments, cur.project)
          && claimTaskTypesNotice(cur.activeDocumentId)) {
          taskTypesUnlockedDocs++;
        }
        // Lees DIRECT ná deze aanroep: `applyLoadedProject` maakt het zojuist geladen document
        // actief, dus `get().recordedDates` is op dit punt exact dát document z'n eigen vastlegging.
        const fresh = isFreshImportOrigin(get().recordedDates?.origin);
        if (get().datesAsRecorded) {
          // In de modus tonen ALLE taken met een vastlegging de opgeslagen datums, niet alleen de
          // afwijkende: de regel "N taken tonen de datums zoals opgeslagen" telt dus `total`, niet
          // `shifted` (review #109: rehab-2 meldde 2882 waar alle 6976 de vastgelegde datums tonen).
          // Het aantal dat bij herberekenen verschuift noemt de strook (`recordedDates.shifted`).
          const shown = get().recordedDates?.total ?? 0;
          datesAsRecordedShownTotal += shown;
          if (fresh) freshShownTotal += shown;
        }
      }

      // De XER-rapportage is bestandsbreed en identiek op iedere XER-resultaatview. Plaats deze
      // pas ná de volledige lus, anders ontstaat er één toast per nieuw document. Andere formats
      // leveren geen `xer`-metadata en houden hun bestaande, stille openpad.
      // MSPDI/.mpp melden wat niet is overgenomen (`msProjectImportNotice`). De andere formaten hebben
      // geen eigen openingsmelding, maar wél dezelfde ene regel over
      // "datums zoals opgeslagen" — formaatneutraal verwoord. `withRecordedDatesNotice` hangt die
      // regel aan een al bestaande melding (bv. de profielmelding van een `.mpp`) in plaats van hem
      // via `!notice` te laten verdringen (zie de helper). Rekenprofielen: één melding per geopend
      // bestand — bij XER samengevoegd met de openingsmelding, anders een eigen melding met de
      // actie naar Bestand → Projectinfo. Een onbruikbaar XER-bronarchief is weggelaten door
      // `readIFC`; dat meldt zich als BUITENSTE laag, als detailregels in de bestandsmelding als
      // die er is, anders als eigen melding. Nooit stil — zie `withXerArchiveIssueNotice`.
      // Laatste stap: heeft de app bij het openen data ingevuld, vervangen, gerepareerd of weggelaten,
      // dan blijft de melding staan tot het kruisje (`withOpenNoticeSticky`, eigenaarsbesluit 2026-10-12).
      const notice = withOpenNoticeSticky(withXerArchiveIssueNotice(
        withRecordedDatesNotice(
          withSchedulingProfileNotice(
            results,
            xerImportNotice(results, datesAsRecordedShownTotal)
              ?? p6xmlImportNotice(results)
              ?? msProjectImportNotice(results),
            openedDocumentIds[0] ?? '',
          ),
          freshShownTotal,
        ),
        results.map(result => result.xerArchiveIssue),
      ));
      // De taaktypes-melding is een
      // detailregel in díe ene bestandsmelding — geen extra toast — met een EIGEN gidslink naar
      // `howto-werkregel-kiezen` (`TASK_TYPES_DETAIL_LINE`; de "Lees meer" van de melding zelf gaat naar het
      // bestand/rekenprofiel). Zonder bestandsmelding (bv. MSPDI/IFC onder het ops-profiel) blijft
      // het een eigen melding met gids-link.
      if (notice && taskTypesUnlockedDocs > 0) {
        get().notify({ ...notice, detailLines: [...(notice.detailLines ?? []), TASK_TYPES_DETAIL_LINE] });
      } else if (notice) {
        get().notify(notice);
      } else if (taskTypesUnlockedDocs > 0) {
        notifyTaskTypesUnlockedClaimed(get().notify);
      }

      const activeIndex = isMultiDocumentImport(parsed) ? parsed.activeDocumentIndex : 0;
      const activeId = openedDocumentIds[activeIndex];
      if (activeId && activeId !== get().activeDocumentId) get().switchDocument(activeId);
      return {
        documentIds: openedDocumentIds,
        activeDocumentId: get().activeDocumentId,
        reusedActiveTab,
        minuteModelConversions,
      };
    },

    openAsDocument: (parsed, source) => {
      // Opslagdoel-guard (via `canBeSaveTarget` op de registry-entry). Opslaan schrijft altijd
      // IFC-TEKST, dus élk ANDER bronformaat (csv/xml/mpp/xer — niet uitsluitend binaire formaten)
      // zou bij een naïeve toewijzing zijn eigen bronbestand met IFC-inhoud laten overschrijven
      // door de eerstvolgende Ctrl+S. "Opslaan" wordt dan "opslaan-als".
      const target = source.saveTarget === false
        ? { filePath: null, fileHandle: null, siteFileId: null }
        : saveTargetFor(readFormatForFile(source.name), source.ref, source.name);

      // Gedeelde load-implementatie (`applyOpenedImport`: pristine tabblad of nieuwe documenten);
      // open-pad-semantiek: opslagdoel zetten, GEKOPPELD laden (opslagdoel en `linkedOpen` horen
      // bij elkaar: wie naar het bronbestand terugschrijft, moet ook alles laden wat erin stond),
      // direct doorrekenen + fitten en de uur-melding evalueren.
      return get().applyOpenedImport(parsed, {
        filePath: target.filePath,
        fileHandle: target.fileHandle,
        siteFileId: target.siteFileId,
        siteFileVersion: target.siteFileId ? source.siteFileVersion ?? null : null,
        recompute: true,
        fit: true,
        linkedOpen: true,
      });
    },

    openFile: async (labels) => {
      if (siteQuestionOpen()) return;
      let opened: OpenedFile | null;
      try {
        // Site-opslag aanwezig: eerst "Openen van de site" (met "Van deze pc…" voor de gewone
        // kiezer). Zonder site-opslag komt deze vraag nooit en blijft alles zoals het was.
        if (siteStorageAvailable()) {
          const extensions = [...new Set(openDialogFilters().flatMap((filter) => filter.extensions))];
          const choice = await askSiteOpen({ extensions });
          if (!choice) return;
          if (choice.kind === 'site') {
            await openSiteChoice(choice, labels);
            return;
          }
        }
        opened = await openFileDialog(openDialogFilters(), { binaryExtensions: binaryExtensions(formatReadOptions()) });
      } catch (err) {
        console.error('Failed to open file:', err);
        get().notify(importFailureNotice(err, saveErrorDetail(err)));
        return;
      }
      if (opened) await get().openOpenedFile(opened, labels);
    },

    openOpenedFile: async (opened, labels, options) => {
      try {
        const parsed = await parseOpenedFile({ name: opened.name, text: opened.content, bytes: opened.bytes }, labels, formatReadOptions());
        // De laatste controle en het activeren gebeuren in één synchrone stap: niets (een klik, een
        // tweede neerzetting) kan ertussen een dialoog openen of een formaatuitleg zetten.
        if (options?.waitWhile) {
          while (options.waitWhile()) await new Promise((resolve) => setTimeout(resolve, OPEN_WAIT_POLL_MS));
        }

        // Eén open-semantiek voor elk echt open-pad (tabblad, opslagdoel, gekoppeld laden),
        // ook voor de meervoudige XER-vorm.
        get().openAsDocument(parsed, { name: opened.name, ref: opened.ref });
        offerFormatNotice(opened.name, opened.content);

        // Recents: elke herbruikbare ref (Tauri-pad óf Chromium-handle) — óók bij een niet-IFC
        // bronformaat: heropenen via recents moet blijven werken, alleen het OPSLAGDOEL wordt niet
        // gezet (zie `saveTargetFor` in `openAsDocument`).
        await pushRecent(opened.ref, opened.name);
      } catch (err) {
        console.error('Failed to open file:', err);
        get().notify(importFailureNotice(err, saveErrorDetail(err)));
      }
    },

    saveFile: async () => { await saveActiveDocument(); },
    saveFileForDocument: (documentId) => saveActiveDocument(documentId),

    saveFileAs: async () => {
      if (siteQuestionOpen()) return;
      await saveActiveDocumentAs();
    },

    exportAs: async (format: ExportFormat): Promise<ExportResult> => {
      // Alle vier exporters schrijven de CPM-uitvoer
      // (task.time.earlyStart en afgeleiden) weg naar derden die die datums contractueel lezen.
      // Een verouderde of cyclische planning mag dus niet stil worden uitgevoerd. Daarom: bij een
      // stale schema eerst runCPM, en dán expliciet op cpmResult.error controleren vóór de
      // opslaan-dialoog. Die tweede check is nodig omdat runCPM op zijn EERSTE regel al
      // scheduleStale=false zet (vóór de solve); bij een cyclus breekt hij af mét cpmResult.error
      // gezet én task.time nog op de oude waarden — een guard die alleen op scheduleStale kijkt
      // zou de export in dat geval wél met verouderde datums doorlaten. De guard staat vóór de
      // eerste await (saveFileDialog), zodat er niets half gebeurt.
      // Fase 1a (#804): een IFC-export zou het vreemde deel weglaten. Geweigerd, met de melding; telt als geannuleerd.
      // De andere formaten dragen alleen planning en blijven mogelijk.
      if (format === 'ifc' && refuseForeignIfcWrite()) return { ok: true, warnings: [], cancelled: true };
      if (get().scheduleStale) get().runCPM();
      const cpmFailure = get().cpmResult;
      if (cpmFailure?.error) return { ok: false, error: cpmFailure.error, errorInfo: cpmFailure.errorInfo };

      const state = get();
      const warnings = detectXerExportLoss(format, {
        sourceArchive: state.xerSourceArchive,
        importMetadata: state.xerImportMetadata,
        project: state.project,
        tasks: state.tasks,
        sequences: state.sequences,
        assignments: state.assignments,
        activityCodeTypes: state.activityCodeTypes,
        customFieldDefs: state.customFieldDefs,
        baselines: state.baselines,
        activeBaselineId: state.activeBaselineId,
      });

      // De export draagt tekst ÓF bytes (het `.xlsx`-voortgangsblad). De afsplitsing
      // staat één keer, ná de switch — niet per tak — zodat de recents-, download- en
      // meldingsafhandeling voor beide vormen letterlijk dezelfde regels zijn.
      let payload: string | Uint8Array;
      let ext: string;
      let p6Truncated = 0;
      let xerLoss: readonly XerWriteLoss[] | null = null;
      let invalidXmlChars = 0;
      let filters: { name: string; extensions: string[] }[];
      let mime: string | undefined;
      // Het voortgangsblad krijgt een eigen bestandsnaamsuffix (`<projectnaam>-voortgang.xlsx`), en
      // waar mogelijk landt het ook echt in de downloadmap (preferDownloads hieronder).
      let nameOverride: string | undefined;

      switch (format) {
        case 'progress-xlsx': {
          // Dynamische import: `@/i18n/config` initialiseert i18next en raakt DIRECT bij het laden
          // al `document.documentElement.dir` aan (RTL-afhandeling) — een top-level import hier zou
          // dat in `fileSlice.ts` trekken, en daarmee in ELKE headless test die `appStore` importeert.
          // De schrijver zelf ook: de ZIP/XLSX-laag hoort niet in de hoofdbundel (net als
          // `mppReader`), en een statische import hier zou hem er stilzwijgend in trekken.
          const [{ default: i18n }, { buildProgressHeaderNotes, buildProgressSummaryNote, buildProgressXlsxValidationText }, { writeProgressSheetXLSX }] = await Promise.all([
            import('@/i18n/config'),
            import('@/i18n/progressHeaderNotes'),
            import('@/services/xlsx/writeProgressXlsx'),
          ]);
          const menuT: ImportLabelT = (key) => i18n.t(key, { ns: 'menu' });
          // Rijen in boomvolgorde: de store-volgorde is na een P6-/IFC-import
          // "samenvattingen eerst" — onleesbaar als rondgestuurd blad. Terugimport matcht op OPS Task ID.
          payload = await writeProgressSheetXLSX([...flattenOrder(state.tasks)], {
            headerNotes: buildProgressHeaderNotes(menuT),
            summaryNote: buildProgressSummaryNote(menuT),
            sheetName: menuT('export.progressXlsxSheetName'),
            validation: buildProgressXlsxValidationText(menuT),
          }, { exportedAt: new Date().toISOString() });
          ext = 'xlsx';
          filters = [{ name: 'Excel Workbook', extensions: ['xlsx'] }];
          mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          nameOverride = `${suggestedFileBase(state)}-${exportFileSuffix('progress')}.${ext}`;
          break;
        }
        case 'csv': {
          // Uurteken van de lag uit de i18next-singleton die `@/i18n/config` in de app initialiseert.
          // Bewust NIET `@/i18n/config` laden: dat raakt bij het laden `document` aan en breekt
          // headless checks (zie check-xer-export-loss). Niet geïnitialiseerd ⇒ terugval `u`.
          const hourSuffix = i18next.isInitialized
            ? i18next.t('duration.suffixHour', { ns: 'common' })
            : undefined;
          payload = writeCSV(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments, state.customTaskTypes,
            // In "datums zoals opgeslagen" mag een niet-vastgelegde as niet als verzonnen 0/No
            // het bestand in. Buiten de modus: `undefined`.
            unrecordedExportGate(state.recordedDates, state.datesAsRecorded),
            // Lag in uren met het teken van de app-taal (eigenaarsbesluit 2026-10-20, optie 2).
            parseableHourSuffix(hourSuffix),
          );
          ext = 'csv';
          filters = [{ name: 'CSV Files', extensions: ['csv'] }];
          break;
        }
        case 'mspdi':
          {
            const written = writeMSPDIWithReport(
              state.project, state.calendar, state.tasks,
              state.sequences, state.resources, state.assignments, state.calendars,
              // Baselines meegeven: de actieve baseline gaat naar MSPDI-slot 0. Zonder deze twee
              // argumenten valt de writer terug op zijn defaults ([] / null) en gaat de baseline stil
              // verloren bij export, terwijl de reader hem wél inleest.
              state.baselines, state.activeBaselineId, state.customTaskTypes,
            );
            payload = written.xml;
            invalidXmlChars = written.invalidXmlChars;
          }
          ext = 'xml';
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'p6':
          {
            const written = writeP6XMLWithReport(
              state.project, state.calendar, state.tasks,
              state.sequences, state.resources, state.assignments, state.calendars, state.customTaskTypes,
              documentProjectCode(state.project, state.xerImportMetadata),
            );
            payload = written.xml;
            p6Truncated = written.truncated;
            invalidXmlChars = written.invalidXmlChars;
          }
          ext = 'xml';
          filters = [{ name: 'XML Files', extensions: ['xml'] }];
          break;
        case 'xer': {
          // P6 Resource-ID's uit een eerdere XER-import gaan ongewijzigd terug (`rsrc_short_name`).
          const resourceCodes = new Map<string, string>();
          for (const source of state.xerSourceArchive?.readModel.resourceCatalog.rows.resources ?? []) {
            const code = source.rawRow?.cells.rsrc_short_name?.trim();
            if (code) resourceCodes.set(source.internalId, code);
          }
          const written = await writeXerExport({
            project: state.project, calendar: state.calendar, calendars: state.calendars,
            tasks: state.tasks, sequences: state.sequences, resources: state.resources, assignments: state.assignments,
            baselineCount: state.baselines.length,
            projectCode: documentProjectCode(state.project, state.xerImportMetadata),
            resourceCodes,
          });
          payload = written.bytes;
          xerLoss = written.loss;
          ext = 'xer';
          filters = [{ name: 'Primavera XER', extensions: ['xer'] }];
          break;
        }
        case 'ifc':
        default:
          // Een export vraagt niets; een open vraag die niet bij de kop past gaat niet mee (#336).
          payload = writeIFC(buildExportIFCInput(state));
          ext = 'ifc';
          filters = [{ name: 'IFC Files', extensions: ['ifc'] }];
          break;
      }

      const defaultName = nameOverride ?? `${suggestedFileBase(state)}.${ext}`;
      // Het voortgangsblad opent waar mogelijk meteen in de downloadmap.
      // Fixronde 1 (BLOKKEERT 2): elk formaat weigert het bronbestand van een document met een vreemd deel.
      const refuseTarget = foreignTargetCheck('export');
      const dialogOpts = format === 'progress-xlsx'
        ? { preferDownloads: true, mime, refuseTarget }
        : { refuseTarget };
      const outcome = typeof payload === 'string'
        ? await saveFileDialog(defaultName, payload, filters, dialogOpts)
        : await saveBytesDialog(defaultName, payload, filters, dialogOpts);
      // Cancel is geen export: geen toast en ook geen latente warnings in de succes-envelope.
      // De centrale plaatsing hier maakt Backstage en ribbon automatisch één meldschrijver.
      if (!outcome) return { ok: true, warnings: [], cancelled: true };
      if (exportGoesToRecents(format)) await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      // Eén verliesmelding per export. XER: de writer telt zelf per soort, plus de XER-broninformatie.
      // Anders: de XER-melding noemt XER-broninformatie en hoort alleen bij een XER-document; een
      // document zonder XER-herkomst krijgt de algemene melding (#554).
      const lossFormat = format === 'mspdi' ? 'MSPDI' : format.toUpperCase();
      const categories = warnings.flatMap(warning => warning.categories);
      const lossNotice = xerLoss ? exportXerLossNotice(xerLoss, categories)
        : format === 'p6' ? exportP6XmlLossNotice({
          project: state.project, calendars: [state.calendar, ...state.calendars.filter(cal => cal.id !== state.calendar.id)], tasks: state.tasks,
          sequences: state.sequences, resources: state.resources, assignments: state.assignments,
          baselineCount: state.baselines.length,
        }, categories) : null;
      if (xerLoss || format === 'p6') {
        if (lossNotice) get().notify(lossNotice);
      } else if (warnings.some(warning => warning.code === 'XER_ONLY_DATA_NOT_EXPRESSIBLE')) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.xerExportLoss',
          params: { format: lossFormat },
          dedupeKey: `xer-export-loss:${state.activeDocumentId}:${format}`,
          helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
        });
      } else if (warnings.some(warning => warning.code === 'EXPORT_DATA_NOT_EXPRESSIBLE')) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.exportDataLoss',
          params: { format: lossFormat },
          dedupeKey: `export-data-loss:${state.activeDocumentId}:${format}`,
          helpArticleId: EXPORT_LOSS_HELP_ARTICLE_ID,
        });
      }
      // Alleen na een GESLAAGDE export (geannuleerde dialoog ⇒ hierboven al teruggekeerd).
      const splitsLost = exportSplitsLostNotice(format, state.tasks);
      if (splitsLost) get().notify(splitsLost);
      const truncated = exportP6TruncatedNotice(format, p6Truncated);
      if (truncated) get().notify(truncated);
      const invalidChars = exportInvalidXmlCharsNotice(format, invalidXmlChars);
      if (invalidChars) get().notify(invalidChars);
      const criticalHoursLost = exportCriticalHoursLostNotice(format, state.project);
      if (criticalHoursLost) get().notify(criticalHoursLost);
      if (!lossNotice?.detailLines?.some(line => line.messageKey === 'notifications.exportXerLossItem.schedulingRules')) {
        const profileNotice = exportProfileNotice(format, state.project.schedulingProfile, name => (
          i18next.isInitialized ? i18next.t('profiles.modified', { ns: 'common', name }) : name));
        if (profileNotice) get().notify(profileNotice);
      }
      return { ok: true, warnings };
    },

    exportProjectWithPool: async (): Promise<ExportResult> => {
      // Zelfde stale/cyclus-guard als `exportAs`: dit pad schrijft óók de CPM-uitvoer weg, dus een
      // stale of cyclische planning mag hier evenmin stil worden geëxporteerd.
      // Fase 1a (#804): geen IFC zonder het vreemde deel; telt als geannuleerd, de melding zegt waarom.
      if (refuseForeignIfcWrite()) return { ok: true, warnings: [], cancelled: true };
      if (get().scheduleStale) get().runCPM();
      const cpmFailure = get().cpmResult;
      if (cpmFailure?.error) return { ok: false, error: cpmFailure.error, errorInfo: cpmFailure.errorInfo };

      const state = get();
      // 1. Het project zelf (bevat altijd al alle gebruikte items). Een export: zie `buildExportIFCInput`.
      const projectContent = writeIFC(buildExportIFCInput(state));
      const base = suggestedFileBase(state);
      const refuseTarget = foreignTargetCheck('export');
      const outcome = await saveFileDialog(`${base}.ifc`, projectContent, [{ name: 'IFC Files', extensions: ['ifc'] }], { refuseTarget });
      if (!outcome) return { ok: true, warnings: [], cancelled: true }; // dialoog geannuleerd — geen fout
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      // 2. De pool ernaast (los bestand), alleen als het project aan een bedrijf gebonden is.
      const companyId = state.project.companyId;
      if (!companyId) return { ok: true, warnings: [] };
      const poolContent = state.exportPoolIFC(companyId);
      if (!poolContent) return { ok: true, warnings: [] };
      const poolOutcome = await saveFileDialog(`${base}-${exportFileSuffix('library')}.ifc`, poolContent, [{ name: 'IFC Files', extensions: ['ifc'] }], { refuseTarget });
      // Het projectbestand bestaat dan al; annuleren van het tweede bestand is geen voltooide export.
      if (!poolOutcome) return { ok: true, warnings: [], cancelled: true };
      noticeIfDownloaded(poolOutcome);
      return { ok: true, warnings: [] };
    },

    foreignTargetCheck,

    recentFiles: [],

    hydrateRecentFiles: async () => {
      const list = await loadRecents();
      set((s) => { s.recentFiles = list; });
    },

    parseExternalSource: async (filePath: string, labels) => {
      if (!isTauri()) return null;
      try {
        const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
        // Herkomst (keuze 4): de wijzigingstijd VÓÓR het lezen. Verandert het bestand tijdens het lezen,
        // dan is de bewaarde versie ouder dan de inhoud en meldt de volgende controle het als nieuw; nooit
        // andersom. Lukt `stat` niet, dan blijft de versie onbekend.
        const version = await get().externalSourceVersion(filePath);
        const source = await readExternalSource(filePath, { readTextFile, readFile }, labels, formatReadOptions());
        return { ...source, ...(version ? { version } : {}), readAt: new Date().toISOString() };
      } catch (err) {
        console.error('parseExternalSource: kon bronbestand niet lezen:', err);
        return null;
      }
    },

    externalSourceVersion: async (filePath: string) => {
      if (!isTauri()) return undefined;
      try {
        const { stat } = await import('@tauri-apps/plugin-fs');
        return (await stat(filePath)).mtime?.toISOString();
      } catch {
        return undefined;
      }
    },

    refreshExternalAnchorsFrom: async (filePath: string, labels) => {
      const targetDocumentId = get().activeDocumentId;
      const src = await get().parseExternalSource(filePath, labels);
      if (!src) return null;
      if (get().activeDocumentId !== targetDocumentId) return { refreshed: 0, missing: 0 };
      const result = refreshExternalAnchors(get().tasks, src);
      // Snapshot en herberekening: zie `applyRefreshedTasks`.
      if (result.changed) applyRefreshedTasks(targetDocumentId, result.tasks);
      const key = normalizeExternalSourcePath(filePath);
      if (key !== null) dropSourceUpdates(targetDocumentId, new Set([key]));
      return { refreshed: result.refreshed, missing: result.missing };
    },

    checkExternalSources: async (labels) => {
      // Eén controle tegelijk; een verzoek tijdens een controle geeft één extra ronde erna.
      if (sourceCheckRunning) { sourceCheckAgain = true; return; }
      sourceCheckRunning = true;
      try {
        do {
          sourceCheckAgain = false;
          await checkExternalSourcesOnce(labels);
        } while (sourceCheckAgain);
      } catch (err) {
        console.error('checkExternalSources:', err);
      } finally {
        sourceCheckRunning = false;
      }
    },

    dismissExternalSourceUpdate: (key: string) => {
      const documentId = get().activeDocumentId;
      const update = get().ui.externalSourceUpdates.find(u => u.documentId === documentId && u.key === key);
      if (!update) return;
      settledSourceVersions.set(sourceKey(documentId, key), update.version);
      dropSourceUpdates(documentId, new Set([key]));
    },

    dropExternalSourceUpdates: (documentId, keys) => dropSourceUpdates(documentId, keys),

    acceptExternalSourceUpdate: (source: ExternalSourceDoc) => {
      const documentId = get().activeDocumentId;
      const result = refreshExternalAnchors(get().tasks, source, externalSourceScope(source));
      const applied = result.changed && applyRefreshedTasks(documentId, result.tasks);
      const key = externalSourceKeyOfDoc(source);
      if (key !== null) dropSourceUpdates(documentId, new Set([key]));
      return applied;
    },

    externalProjectSourceVersion: async (projectId: string) => {
      const handle = await sourceHandleFor(projectId);
      if (!handle) return undefined;
      const file = await fileFromHandleWeb(handle, false);
      if (!file) return undefined;
      const modified = new Date(file.lastModified);
      return isNaN(modified.getTime()) ? undefined : modified.toISOString();
    },

    parseExternalProjectSource: async (projectId: string, opts, labels) => {
      const handle = await sourceHandleFor(projectId);
      if (!handle) return null;
      const file = await fileFromHandleWeb(handle, opts.prompt);
      return file ? readProjectFile(projectId, file, labels) : null;
    },

    externalSourceHandles: async () => {
      if (isTauri() || siteStorageAvailable()) return new Map();
      return loadExternalSourceHandles();
    },

    readExternalProjectSources: async (projectIds, labels) => {
      const handles = await get().externalSourceHandles();
      // Eerst alle toestemmingen, tegelijk; pas daarna lezen (zie de interface).
      const files = await Promise.all(projectIds.map((projectId) => {
        const handle = handles.get(projectId);
        return handle ? fileFromHandleWeb(handle, true) : Promise.resolve(null);
      }));
      const out = new Map<string, ExternalSourceRead | null>();
      for (const [index, projectId] of projectIds.entries()) {
        const file = files[index];
        out.set(projectId, file ? await readProjectFile(projectId, file, labels) : null);
      }
      return out;
    },

    listExternalSiteSources: async () => {
      if (isTauri() || !siteStorageAvailable()) return null;
      try {
        const own = get().siteFileId;
        return (await listSiteFiles(['ifc'])).filter(file => file.id !== own);
      } catch (err) {
        console.error('listExternalSiteSources:', err);
        return null;
      }
    },

    externalSiteSourceVersion: async (siteFileId) => {
      if (isTauri() || !siteStorageAvailable()) return undefined;
      try {
        return (await latestSiteVersion(siteFileId)) ?? undefined;
      } catch (err) {
        console.warn('externalSiteSourceVersion: geen versie van de site:', siteFileId, err);
        return undefined;
      }
    },

    parseExternalSiteSource: async (siteFileId, labels) => {
      if (isTauri() || !siteStorageAvailable()) return null;
      try {
        return await readExternalSiteSource(await readSiteSourceFile(siteFileId), labels, formatReadOptions());
      } catch (err) {
        console.error('parseExternalSiteSource: kon de bron op de site niet lezen:', siteFileId, err);
        return null;
      }
    },

    readExternalSourceAt: (locator, labels) => (locator.kind === 'site'
      ? get().parseExternalSiteSource(locator.siteFileId, labels)
      : locator.kind === 'path'
        ? get().parseExternalSource(locator.filePath, labels)
        : get().parseExternalProjectSource(locator.projectId, { prompt: false }, labels)),

    chooseExternalSourceFile: async (labels) => {
      if (isTauri()) {
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const selected = await open({ multiple: false, filters: SOURCE_FILE_FILTERS });
          return typeof selected === 'string' ? { kind: 'path', filePath: selected } : { kind: 'cancelled' };
        } catch (err) {
          console.error('chooseExternalSourceFile:', err);
          return { kind: 'failed' };
        }
      }
      try {
        const picked = await pickFilesWeb(SOURCE_FILE_FILTERS, false);
        if (!picked) return { kind: 'cancelled' };
        const [{ file, handle }] = picked;
        return { kind: 'file', source: await readExternalSourceFile(file, labels, formatReadOptions()), handle };
      } catch (err) {
        console.error('chooseExternalSourceFile:', err);
        return { kind: 'failed' };
      }
    },

    refreshExternalAnchorsFromChosenFiles: async (labels) => {
      const targetDocumentId = get().activeDocumentId;
      let picked;
      try {
        picked = await pickFilesWeb(SOURCE_FILE_FILTERS, true);
      } catch (err) {
        console.error('refreshExternalAnchorsFromChosenFiles:', err);
        return null;
      }
      if (!picked) return null;
      // Alleen de project-id's van koppelingen zonder pad: een koppeling met pad wijst naar een bepaald bestand.
      const projectIds = new Set<string>();
      for (const task of get().tasks) {
        for (const link of task.externalLinks ?? []) {
          const locator = externalSourceLocatorOf(link.sourceRef);
          if (locator?.kind === 'project') projectIds.add(locator.projectId);
        }
      }
      const sourceDocs: ExternalSourceRead[] = [];
      let unmatched = 0;
      for (const { file, handle } of picked) {
        let source: ExternalSourceRead;
        try {
          source = await readExternalSourceFile(file, labels, formatReadOptions());
        } catch (err) {
          console.error('refreshExternalAnchorsFromChosenFiles: kon bestand niet lezen:', file.name, err);
          unmatched++;
          continue;
        }
        if (!projectIds.has(source.projectId)) { unmatched++; continue; }
        sourceDocs.push(source);
        if (handle) await rememberExternalSourceHandle(source.projectId, handle);
      }
      const readProjectIds = [...new Set(sourceDocs.map(source => source.projectId))];
      if (get().activeDocumentId !== targetDocumentId) return { refreshed: 0, missing: 0, sources: 0, unmatched, readProjectIds: [] };
      // Alle bronnen zijn zonder pad: `refreshFromSources` raakt dan alleen koppelingen zonder pad.
      const { tasks, refreshed, missing, changed } = refreshFromSources(get().tasks, sourceDocs);
      if (changed) applyRefreshedTasks(targetDocumentId, tasks);
      dropSourceUpdates(targetDocumentId, new Set(readProjectIds.map(projectId => externalSourceKey({ kind: 'project', projectId })!)));
      return { refreshed, missing, sources: sourceDocs.length, unmatched, readProjectIds };
    },

    refreshAllExternalAnchors: async (labels) => {
      const targetDocumentId = get().activeDocumentId;
      // Verzamel de distinct bron-bestandspaden uit alle links (fallback: geen pad ⇒ niet verversbaar).
      const paths = new Map<string, string>();
      // `normalizeExternalSourcePath` geeft null voor zowel "geen
      // pad" als "een pad dat niet lexicaal absoluut is" (relatief). Het tweede geval is BEREIKBAAR:
      // `OPS_ExternalLink` schrijft `task.externalLinks` ongefilterd als één JSON-blob weg
      // (ifcPsets.ts) en leest 'm bij het laden ook ongevalideerd terug — een van elders aangeleverd
      // of met de hand bewerkt IFC-bestand kan dus een relatief `sourceRef.filePath` bevatten. Zo'n
      // pad kan de app nooit betrouwbaar herlezen (er is geen vaste "relatief-ten-opzichte-van"-map),
      // dus het blijft terecht overgeslagen als bron — maar hij mag niet onzichtbaar uit de hele
      // bewerking verdwijnen (niet in `refreshed`, niet in `missing`). Hij telt mee in `missing`,
      // zodat de bestaande toast ("N ververst, M ontbrekend") de gebruiker
      // tenminste laat weten dat er iets niet kon, in plaats van stilzwijgend niets te doen.
      let unusablePathCount = 0;
      // Bronnen zonder pad (stap 1.8, gekozen in de browser): op project-id, via het onthouden handvat.
      const projectIds = new Set<string>();
      // Bronnen op de site (stap 1.9): op het site-id, via `open(id)`.
      const siteFileIds = new Set<string>();
      for (const task of get().tasks) {
        for (const link of task.externalLinks ?? []) {
          const locator = externalSourceLocatorOf(link.sourceRef);
          if (locator?.kind === 'site') { siteFileIds.add(locator.siteFileId); continue; }
          const originalPath = link.sourceRef.filePath;
          if (!originalPath) {
            if (locator?.kind === 'project') projectIds.add(locator.projectId);
            continue;
          }
          const normalizedPath = normalizeExternalSourcePath(originalPath);
          if (normalizedPath === null) { unusablePathCount++; continue; }
          if (!paths.has(normalizedPath)) paths.set(normalizedPath, originalPath);
        }
      }

      // ÉÉN GEBAAR = ÉÉN UNDO-STAP. Lussen over `refreshExternalAnchorsFrom` (dat zelf een snapshot
      // pusht) zou bij twee gewijzigde bronnen twee keer Ctrl+Z kosten.
      //
      // De oplossing is NIET `withTransaction`/`enterBatch` om de lus heen: er zit een `await` in
      // (bestanden inlezen), en de bulk-suppressie geldt voor de hele storecontext. Alles wat de
      // gebruiker tijdens dat inlezen doet zou dan zijn eigen undo-stap verliezen en in deze stap
      // opgaan.
      //
      // Daarom in twee fasen: eerst ALLE bronnen async inlezen zonder iets te muteren, dan de pure
      // `refreshExternalAnchors` (die muteert niets in-place) over de takenlijst KETENEN, en pas
      // daarna één keer schrijven. Levert meteen één `runCPM` in plaats van N.
      const sourceDocs: ExternalSourceDoc[] = [];
      // Gelezen bronpaden. Alleen hun koppelingen worden ververst: een koppeling naar een onleesbare bron,
      // of een koppeling die de planner tijdens het lezen naar een ander bronbestand zette, houdt haar anker
      // en pad, ook als een gelezen bron hetzelfde project-id heeft (`refreshFromSources`, review #813).
      // Hun balk (#811) gaat weg (`dropSourceUpdates`).
      const readPaths = new Set<string>();
      let unread = 0;
      // Eerst de bronnen zonder pad: hun toestemmingsvragen moeten meteen na de klik starten, alle tegelijk
      // (`readExternalProjectSources`). Geweigerd, geen handvat of een andere browser ⇒ niet gelezen; de planner
      // kan het bestand opnieuw kiezen.
      const readKeys = new Set<string>();
      const unreadProjectIds: string[] = [];
      const projectSources = projectIds.size > 0
        ? await get().readExternalProjectSources([...projectIds], labels)
        : new Map<string, ExternalSourceRead | null>();
      const projectDocs: ExternalSourceDoc[] = [];
      for (const projectId of projectIds) {
        const src = projectSources.get(projectId) ?? null;
        if (!src) { unread++; unreadProjectIds.push(projectId); continue; }
        projectDocs.push(src);
        readKeys.add(externalSourceKey({ kind: 'project', projectId })!);
      }
      for (const [normalized, p] of paths) {
        const src = await get().parseExternalSource(p, labels);
        if (!src) { unread++; continue; } // onleesbaar/geen Tauri ⇒ deze bron telt als niet gelezen
        sourceDocs.push(src);
        readPaths.add(normalized);
      }
      for (const path of readPaths) readKeys.add(path);
      // Na de bronnen met pad, zoals voorheen: een bron zonder pad ververst daarna alleen koppelingen zonder pad.
      sourceDocs.push(...projectDocs);
      // Op de site de nieuwste versie. Geen host, geen recht, weg of netwerk ⇒ niet gelezen: de koppeling houdt
      // haar anker (`refreshFromSources`) en telt mee in `unread`.
      for (const siteFileId of siteFileIds) {
        const src = await get().parseExternalSiteSource(siteFileId, labels);
        if (!src) { unread++; continue; }
        sourceDocs.push(src);
        readKeys.add(externalSourceKey({ kind: 'site', siteFileId })!);
      }

      if (get().activeDocumentId !== targetDocumentId) {
        return { refreshed: 0, missing: 0, sources: sourceDocs.length, unread, unreadProjectIds };
      }

      // Alle bronnen samen, met de regel voor kopieën met hetzelfde project-id (`refreshFromSources`).
      // `missing` begint bij `unusablePathCount` (zie hierboven): een link met een pad dat nooit een bron
      // kon worden telt mee als "ontbrekend", net als een link waarvan de bron wél gelezen werd maar de
      // betreffende taak niet meer bevatte.
      const result = refreshFromSources(get().tasks, sourceDocs, readPaths);
      const { tasks, refreshed, changed: anyChanged } = result;
      const missing = unusablePathCount + result.missing;

      if (anyChanged) applyRefreshedTasks(targetDocumentId, tasks);
      dropSourceUpdates(targetDocumentId, readKeys);
      return { refreshed, missing, sources: sourceDocs.length, unread, unreadProjectIds };
    },

    openRecentFile: async (id: string, labels) => {
      const entry = get().recentFiles.find((e) => e.id === id);
      if (!entry) return;
      if (entry.ref.kind === 'site') {
        await openRecentSiteFile(entry, labels);
        return;
      }
      try {
        // Ook lezen hoort bij de foutafhandeling: een verdwenen bestand of verlopen toegang
        // mag geen stille verwijdering uit Recent opleveren. Een volgende poging blijft mogelijk.
        const readOptions = formatReadOptions();
        const isBinary = readsAsBytes(entry.name, readOptions);
        const content = isBinary ? null : await readFromRef(entry.ref);
        const bytes = isBinary ? await readBytesFromRef(entry.ref) : null;
        if (isBinary ? bytes === null : content === null) {
          get().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: entry.name });
          return;
        }
        const parsed = await parseOpenedFile(
          { name: entry.name, text: content ?? undefined, bytes: bytes ?? undefined },
          labels,
          readOptions,
        );

        // Zelfde open-semantiek als openFile: tabblad, opslagdoel (`saveTargetFor`) en gekoppeld
        // laden komen uit de ene gedeelde actie, ook voor de meervoudige XER-vorm.
        get().openAsDocument(parsed, { name: entry.name, ref: entry.ref });
        offerFormatNotice(entry.name, content ?? undefined);

        // MRU verversen: het net-geopende bestand naar boven (óók bij een niet-IFC bronformaat —
        // alleen het opslagdoel blijft leeg, zie `saveTargetFor` in `openAsDocument`).
        await pushRecent(entry.ref, entry.name);
      } catch (err) {
        console.error('Failed to open recent file:', err);
        get().notify(importFailureNotice(err, saveErrorDetail(err)));
      }
    },

    openFromSite: async (id, labels) => {
      try {
        await openSiteChoice({ kind: 'site', id }, labels);
        return true;
      } catch (err) {
        console.error('Openen van de site mislukt:', err);
        get().notify(importFailureNotice(err, siteErrorMessage(err)));
        return false;
      }
    },

    openExampleFromString: async (content: string, name: string, labels) => {
      try {
        // Voorbeelden blijven tekst (§4.9 punt 1); met de flag gaan ze via de bytes-route met `TextEncoder`.
        const parsed = await readIfcFromText(content, labels, formatReadOptions());

        // Zelfde multi-document-gedrag als openFile: hergebruik het actieve
        // tabblad alleen als dat nog leeg en ongewijzigd is, anders nieuw tabblad.
        if (!isActivePristine(get())) get().newDocument();

        // Voorbeeld = geen bronbestand: filePath=null + geen opslaan-doel (opslaan wordt
        // opslaan-als, geen recent-entry). Verder de open-pad-semantiek: doorrekenen + fitten
        // + uur-melding.
        get().applyLoadedProject(parsed, {
          filePath: null,
          fileHandle: null,
          siteFileId: null,
          recompute: true,
          fit: true,
        });
        const archiveNotice = withOpenNoticeSticky(withXerArchiveIssueNotice(undefined, [parsed.xerArchiveIssue]));
        if (archiveNotice) get().notify(archiveNotice);
        return true;
      } catch (err) {
        console.error(`Failed to open example "${name}":`, err);
        // `params: { name }` achterwege gelaten: de bestaande `notifications.openFailed`-string
        // bevat geen {{name}}-placeholder, en i18n niet aanraken is een harde grens. De naam staat
        // wel in de debug-terminal (console.error hierboven).
        get().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: saveErrorDetail(err) });
        return false;
      }
    },
  };
};
