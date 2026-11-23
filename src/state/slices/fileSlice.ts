import { normalizeTaskDates } from '../migrations/minuteModel';
import { exportHitsOwnFile, literalCalendarIdsWritten, mergeLiteralCalendarIds, rememberLiteralCalendarsWritten } from '../savedLiteralCalendars';
import { minuteModelTransition, minuteModelNotice, recordMinuteModelTransition, type MinuteModelTransition } from '../minuteModelTransition';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { claimTaskTypesNotice, notifyTaskTypesUnlocked, notifyTaskTypesUnlockedClaimed, TASK_TYPES_DETAIL_LINE } from '../taskTypesNotice';
import { taskTypesNeedNotice } from '../taskTypesVisibility';
import { ifcObjectSeed } from '@/services/ifc/ifcWriter';
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
import { openFileDialog, saveFileDialog, saveDataDialog, saveNewBytesDialog, saveNewBytesToRef, pickSaveTarget, saveToRef, readFromRef, readBytesFromRef, readOpenedPath, sameFileRef, saveTargetRef, fileIdentityFs, writeTargetReaders, sourceTargetContent, handleWritePermission, type FileData, type FileFilter, type FileRef, type OpenedFile, type PickedSaveTarget, type SaveOutcome, type SaveTargetCheck } from '@/services/fileAccess';
import type { SourceTargetContent } from '@/services/fileAccess/sourceTargetContent';
import { ownPathReplaceNotices, remnantNotices, replaceOwnHandleWithRecovery, replaceOwnPathWithRecovery } from '../ownFileReplace';
import { ReadAfterSettleError } from '@/services/fileAccess/tauriBackend';
import {
  isSiteConflict, isSiteNotFound, siteErrorMessage, siteStorageAvailable, type SiteFileInfo, type SiteVersionInfo,
} from '@/services/fileAccess/siteHost';
import {
  latestSiteVersion, listSiteFiles, openSiteFile, readSiteSourceFile, saveNewSiteFile, saveSiteFileVersion, saveNewSiteFileBytes, saveSiteFileVersionBytes,
} from '@/services/fileAccess/siteBackend';
import { askSiteOpen, askSiteSave, type SiteOpenChoice } from '@/services/fileAccess/siteDialogs';
import { withXerArchiveIssueNotice } from '@/state/xerArchiveIssueNotice';
import { P6XmlImportError } from '@/services/p6/p6xmlErrors';
import { withOpenNoticeSticky } from '@/state/openNoticeSticky';
import { clearRefusals, refusalNotice } from '@/state/refusalNotice';
import {
  EXPORT_LOSS_HELP_ARTICLE_ID, P6XML_IMPORT_HELP_ARTICLE_ID, RECORDED_DATES_HELP_ARTICLE_ID, XER_IMPORT_HELP_ARTICLE_ID,
} from '@/state/helpArticles';
import { formatNoticeToShow } from '@/services/formatNotice';
import { openDialogFilters, binaryExtensions, readFormatForFile, readsAsBytes, parseOpenedFile, importErrorMessageKey, saveTargetFor, readIfcFromText, writeXerExport, type ExportFormat, type FormatReadOptions } from '@/services/formatRegistry';
import { ifcForeignContentEnabled } from '@/utils/featureFlags';
import {
  ifcWriteBlockedNotice, IFC_FOREIGN_TARGET_EXPORT_NOTICE, IFC_FOREIGN_TARGET_SAVE_NOTICE, IFC_UNREADABLE_TARGET_EXPORT_NOTICE,
  IFC_UNREADABLE_TARGET_SAVE_NOTICE, ifcFullWriteBlocked,
  IFC_FOREIGN_REPLACE_BLOCKED_NOTICE, IFC_FOREIGN_MERGE_REFUSED_NOTICE, IFC_SAVE_WORKER_FAILED_NOTICE,
  IFC_FOREIGN_TARGET_CHANGED_NOTICE, IFC_FOREIGN_TARGET_GONE_NOTICE, IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE,
  refusedWriteTarget, newTargetWriteNotice, downloadCopyNotice, IFC_FOREIGN_NEW_TARGET_ONLY_NOTICE,
  IFC_FOREIGN_TARGET_OPEN_IN_TAB_NOTICE, EXPORT_TARGET_OPEN_IN_TAB_NOTICE, EXPORT_TARGET_OPEN_DOCUMENT_NOTICE,
} from '../ifcForeignGuard';
import { MergeNeedsPhase2Error } from '@/services/ifc/foreign/mergeWriter';
import { askPlanOnly, type PlanOnlyConfirmation } from '@/services/ifc/planOnlyQuestion';
import { foreignSourceMarkFor, foreignSourceMarkFromRecord } from '@/services/ifc/foreign/foreignSourceMark';
import { hasBuildingModel, hasForeignContent, type PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { castDraft } from 'immer';
import { prepareIfcOutput, planOnlyQuestionApplies, IfcWriteBlockedError, type IfcOutput } from '../prepareIfcOutput';
import { ByteWriteError } from '@/services/fileAccess/byteWrite';
import type { TargetReaders } from '@/services/fileAccess/foreignSourceTarget';
import { scanForeignTargetBytesAsync, type TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { loadRecents, addRecent, removeRecent, type RecentEntry } from '@/services/fileAccess/recentFiles';
import { HOST_EVENTS } from '@/services/extensionEvents';
import type { AppSliceFactory, ExternalSourceUpdate, NotifyInput, NotificationDetailLine } from './types';
import type { AppState } from '../appStore';
import { isTauri } from '@/utils/platform';
import type { Task } from '@/types/task';
import type { Resource } from '@/types/resource';
import type { Project } from '@/types/project';
import { refreshProjectCalendarCache } from '../syncProjectCalendar';
import { stripLibraryOrigins } from '@/services/library/libraryOps';
import { isMultiDocumentImport, type ImportLabels, type ImportResult, type OpenedImport } from '@/services/importTypes';
import { ensureUniqueImportIds } from '@/services/importNormalize';
import { hydratePayload, isFreshImportOrigin, payloadFromImport, type DocumentPayload } from '../documentContract';
import { applyRecordedDatesOnLoad, materializeLibraryBoundary, prepareLoadedPayload } from '../documentActivation';
import { notifyCalendarLibrarySettle } from '../calendarTasks';
import { unrecordedExportGate } from '../recordedDatesSelectors';
import { buildExportIFCInput, buildWriteIFCInput, sameIFCSource, type IFCSaveSource, type IFCWriteInput } from '../ifcSaveInput';
import { documentFileBase } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import {
  externalSourceKey, externalSourceKeyOfDoc, externalSourceLocatorOf, externalSourceScope, externalSourceScopeOf,
  linkMatchesSource, refreshExternalAnchors,
  refreshFromSources, type ExternalSourceDoc, type ExternalSourceLocator,
} from '@/engine/externalLinks';
import { externalAnchorChanges } from '@/engine/externalRefreshPreview';
import { readExternalSiteSource, readExternalSource, readExternalSourceFile, type ExternalSourceRead } from '../externalSource';
import { IfcModelOpenTooLargeError, refuseModelAboveOpenLimit } from '@/services/ifc/modelOpenLimit';
import { fileFromHandleWeb, pickFilesWeb } from '@/services/fileAccess/webBackend';
import { loadExternalSourceHandles, rememberExternalSourceHandle } from '@/services/fileAccess/externalSourceHandles';
import { normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import {
  externalSourceFromOpenDocument, proposalFingerprint, openSourceDocument, openSourceName, unsavedOpenSources,
} from '../openSourceDocument';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { detectXerExportLoss, type XerExportLossWarning } from '@/services/xerExportLoss';
import { claimProjectFileWrite, runProjectFileWrite, whenProjectFilePlacementSettled } from '@/services/fileAccess/writeCoordinator';
import { IfcSaveWorkerError } from '@/services/ifc/saveWorker/ifcSaveWorkerError';
import {
  changeSaving, documentContentOf, replaceDocumentContent, sameDocumentContent, stampSaved, type DocumentContentRef,
} from '../documentSaveState';
import { saveQuestionOpen } from '@/state/blockingDialogs';
import { askIfcSchema, ifcSchemaQuestionFor } from '@/services/ifc/ifcSchemaQuestion';
import { tightAnchorsIfSaved } from '../dependentCandidates';
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

export function suggestedFileBase(s: Pick<AppState, 'project' | 'xerImportMetadata'>): string {
  return documentFileBase(s.project.name, documentProjectCode(s.project, s.xerImportMetadata));
}

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

export const OPEN_WAIT_POLL_MS = 200;

export function saveErrorDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

function documentFileName(s: Pick<AppState, 'filePath' | 'project' | 'xerImportMetadata'>): string {
  return s.filePath ? basename(s.filePath) : `${suggestedFileBase(s)}.ifc`;
}

export function siteSaveDefaultName(s: Pick<AppState, 'filePath' | 'project' | 'xerImportMetadata'>): string {
  return ensureExtension(documentFileName(s), 'ifc');
}

export function siteVersionCopyName(sourceName: string, version: string, copyLabel?: string): string {
  const ext = /\.[^.\\/]+$/.exec(sourceName)?.[0] ?? '';
  const base = ext ? sourceName.slice(0, -ext.length) : sourceName;
  return `${copyLabel || `${base} (${version})`}${ext}`;
}

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

export function xerImportNotice(
  results: readonly ImportResult[],
  datesAsRecordedShownTotal = 0,
): NotifyInput | undefined {
  results = results.filter(result => result.xerOrigin !== 'xer-archive');
  const xers = results.flatMap(result => result.xer ? [result.xer] : []);
  const xer = xers[0];
  if (!xer) return undefined;

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
  addCount(
    results.reduce((total, result) => total + (result.xerMissingPlannedStarts ?? 0), 0),
    'notifications.xerImportMissingPlannedStarts',
  );
  addCount(unsupportedSemantics, 'notifications.xerImportUnsupportedSemantics');
  addCount(datesAsRecordedShownTotal, 'notifications.xerImportDatesAsRecorded');

  return {
    severity: 'info',
    messageKey: 'notifications.xerImportOpened',
    params: { count: report.documentsOpened },
    detailLines,
    helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
  };
}

export function openFailureNotices(err: unknown): NotifyInput[] {
  if (!(err instanceof ReadAfterSettleError)) return [importFailureNotice(err, saveErrorDetail(err))];
  return [...remnantNotices(err.replaceRemnants), importFailureNotice(err.cause, saveErrorDetail(err.cause))];
}

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
  if (err instanceof IfcModelOpenTooLargeError) {
    return { severity: 'error', messageKey: 'notifications.ifcForeignOpenTooLarge', params: { limit: Math.floor(err.limit / (1024 * 1024)) }, detail };
  }
  return { severity: 'error', messageKey: importErrorMessageKey(err), detail };
}

export function p6xmlImportNotice(results: readonly ImportResult[]): NotifyInput | undefined {
  const report = results.find(result => result.p6xmlReport)?.p6xmlReport;
  if (!report) return undefined;
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

export { type ExportFormat };

export function exportGoesToRecents(format: ExportFormat): boolean {
  return format !== 'progress-xlsx';
}

export function exportSplitsLostNotice(format: ExportFormat, tasks: readonly Task[]): NotifyInput | null {
  if (format !== 'mspdi' && format !== 'p6') return null;
  const count = countSplitTasksWithoutContour(tasks);
  return count > 0 ? { severity: 'info', messageKey: 'notifications.exportSplitsLost', params: { count } } : null;
}

export function exportCostResourcesLostNotice(format: ExportFormat, resources: readonly Pick<Resource, 'type'>[]): NotifyInput | null {
  if (format !== 'mspdi') return null;
  const count = resources.filter(r => r.type === 'COST').length;
  return count > 0 ? { severity: 'info', messageKey: 'notifications.exportCostResourcesLost', params: { count } } : null;
}

export function exportP6TruncatedNotice(format: ExportFormat, truncated: number): NotifyInput | null {
  if (format !== 'p6' || truncated <= 0) return null;
  return { severity: 'info', messageKey: 'notifications.exportP6Truncated', params: { count: truncated } };
}

export function exportInvalidXmlCharsNotice(format: ExportFormat, replaced: number): NotifyInput | null {
  if ((format !== 'mspdi' && format !== 'p6') || replaced <= 0) return null;
  return { severity: 'info', messageKey: 'notifications.exportInvalidXmlChars', params: { count: replaced } };
}

export function exportCriticalHoursLostNotice(
  format: ExportFormat,
  project: Pick<Project, 'schedulingOptions'>,
): NotifyInput | null {
  if (format !== 'mspdi' || !mspdiDropsHourThreshold(project.schedulingOptions?.criticalDefinition)) return null;
  return { severity: 'info', messageKey: 'notifications.exportCriticalHoursLost' };
}

export function withPlanOnlyExportSentence(
  format: ExportFormat,
  buildingModel: boolean,
  notices: readonly (NotifyInput | null)[],
): NotifyInput[] {
  const shown = notices.filter((notice): notice is NotifyInput => notice !== null);
  if (format === 'ifc' || !buildingModel) return shown;
  const sentence = 'notifications.exportPlanOnly' as const;
  const last = shown[shown.length - 1] as NotifyInput | undefined;
  if (!last) return [{ severity: 'info', messageKey: sentence }];
  return [...shown.slice(0, -1), {
    ...last,
    detailLines: [...(last.detailLines ?? []), { messageKey: sentence }],
    ...(last.dedupeKey ? { dedupeKey: `${last.dedupeKey}:alleen-planning` } : {}),
  }];
}

export type ExportResult =
  | { ok: true; warnings: readonly XerExportLossWarning[]; cancelled?: true }
  | { ok: false; error: string; errorInfo?: ScheduleErrorInfo };

export interface ExportOptions { readonly withoutBuildingModel?: boolean }

export interface ApplyLoadedProjectOpts {
  intent?: 'edit';
  filePath?: string | null;
  fileHandle?: FileSystemFileHandle | null;
  siteFileId?: string | null;
  siteFileVersion?: string | null;
  recompute?: boolean;
  fit?: boolean;
  linkedOpen?: boolean;
  viewStartDate?: string;
  deferTaskTypesNotice?: boolean;
}

export interface OpenedFileSource {
  name: string;
  ref: FileRef | null;
  siteFileVersion?: string | null;
  saveTarget?: false;
}

export interface AppliedOpenedImport {
  documentIds: string[];
  activeDocumentId: string;
  reusedActiveTab: boolean;
  minuteModelConversions: (Pick<MinuteModelTransition, 'shifted' | 'maxWorkdays'> & { documentId: string })[];
}

/** Opties van `openOpenedFile`. */
export interface OpenOpenedFileOptions {
  /** Wacht vóór het activeren zolang dit waar geeft (slepen: een open dialoog, de formaatuitleg van het vorige bestand). */
  waitWhile?: () => boolean;
  /** Het open tabblad met dit bestand, of `null`. Gevraagd in dezelfde synchrone stap als het activeren, na het wachten:
   *  geeft het een tabblad, dan wisselt de app daarheen in plaats van het bestand nog eens te openen (een startbestand,
   *  #1091; voor Openen, Recent en slepen blijft dat knownbug 1957). */
  existingDocument?: () => string | null;
  /** Is wat gelezen is intussen mogelijk verouderd? In dezelfde synchrone stap, na `existingDocument`: `true` ⇒ niets
   *  activeren; de aanroeper leest opnieuw (een startbestand, #1091). */
  stale?: () => boolean;
  /** Alleen het crashherstel, voor zijn eigen bron na de controle op lengte en SHA-256 (`recoveryDocumentWithSource`):
   *  de productgrens voor het openen van een model (`refuseModelAboveOpenLimit`) geldt dan niet, zodat herstel gelijk
   *  blijft aan main. Elke andere aanroeper laat dit weg en krijgt de grens. */
  restoringVerifiedIfcSource?: boolean;
}

export interface FileSlice {
  openFile: (labels?: ImportLabels) => Promise<void>;
  openOpenedFile: (
    opened: OpenedFile, labels?: ImportLabels, options?: OpenOpenedFileOptions,
  ) => Promise<void>;
  saveFile: () => Promise<void>;
  saveFileForDocument: (documentId: string) => Promise<boolean>;
  saveFileAs: () => Promise<void>;
  commitSavedDocument: (document: DocumentContentRef, savedSource: IFCSaveSource, destination?: SaveDestination, prepared?: PreparedIfcWrite, missingSourceSaveAs?: boolean) => boolean;
  exportAs: (format: ExportFormat, options?: ExportOptions) => Promise<ExportResult>;
  exportProjectWithPool: () => Promise<ExportResult>;
  recordLiteralCalendarsWritten: (documentId: string, ids: readonly string[]) => void;
  foreignTargetCheck: (exceptDocumentId: string | null) => SaveTargetCheck;
  exportLibrary: (companyId: string) => Promise<void>;
  recentFiles: RecentEntry[];
  recentFilesLoaded: boolean;
  hydrateRecentFiles: () => Promise<void>;
  openRecentFile: (id: string, labels?: ImportLabels) => Promise<void>;
  openFromSite: (id: string, labels?: ImportLabels) => Promise<boolean>;
  parseExternalSource: (filePath: string, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  externalSourceVersion: (filePath: string) => Promise<string | undefined>;
  checkExternalSources: (labels?: ImportLabels) => Promise<void>;
  dismissExternalSourceUpdate: (key: string) => void;
  dropExternalSourceUpdates: (documentId: string, keys: ReadonlySet<string>) => void;
  acceptExternalSourceUpdate: (source: ExternalSourceDoc) => boolean;
  externalProjectSourceVersion: (projectId: string) => Promise<string | undefined>;
  parseExternalProjectSource: (projectId: string, opts: { prompt: boolean }, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  readExternalProjectSources: (projectIds: readonly string[], labels?: ImportLabels) => Promise<Map<string, ExternalSourceRead | null>>;
  externalSourceHandles: () => Promise<Map<string, FileSystemFileHandle>>;
  listExternalSiteSources: () => Promise<SiteFileInfo[] | null>;
  externalSiteSourceVersion: (siteFileId: string) => Promise<SiteVersionInfo | undefined>;
  parseExternalSiteSource: (siteFileId: string, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  readExternalSourceAt: (locator: ExternalSourceLocator, labels?: ImportLabels) => Promise<ExternalSourceRead | null>;
  chooseExternalSourceFile: (labels?: ImportLabels) => Promise<ChosenExternalSource>;
  refreshExternalAnchorsFromChosenFiles: (labels?: ImportLabels) => Promise<ChosenFilesRefresh | null>;
  refreshExternalAnchorsFrom: (filePath: string, labels?: ImportLabels) => Promise<{ refreshed: number; missing: number } | null>;
  refreshExternalProjectAnchors: (taskId: string, linkId: string, labels?: ImportLabels) => Promise<{ refreshed: number; missing: number } | null>;
  refreshAllExternalAnchors: (labels?: ImportLabels) => Promise<ExternalRefreshAllResult>;
  readExternalSourceUpdate: (
    update: Pick<ExternalSourceUpdate, 'locator' | 'openDocumentId'>, labels?: ImportLabels,
  ) => Promise<ExternalSourceRead | null>;
  openExampleFromString: (content: string, name: string, labels?: ImportLabels) => Promise<boolean>;
  applyLoadedProject: (parsed: ImportResult, opts: ApplyLoadedProjectOpts) => MinuteModelTransition | null;
  applyProjectEdit: (parsed: ImportResult, opts?: { viewStartDate?: string }) => void;
  applyOpenedImport: (parsed: OpenedImport, opts: ApplyLoadedProjectOpts) => AppliedOpenedImport;
  openAsDocument: (parsed: OpenedImport, source: OpenedFileSource) => AppliedOpenedImport;
}

export interface ExternalRefreshAllResult {
  refreshed: number;
  missing: number;
  sources: number;
  unread: number;
  unreadProjectIds: string[];
}

export interface ChosenFilesRefresh {
  refreshed: number;
  missing: number;
  sources: number;
  unmatched: number;
  readProjectIds: string[];
}

export type ChosenExternalSource =
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  | { kind: 'path'; filePath: string }
  | { kind: 'file'; source: ExternalSourceRead; handle: FileSystemFileHandle | null };

const SOURCE_FILE_FILTERS = [{ name: 'IFC', extensions: ['ifc'] }];
/** De bestandskiezer van een IFC-projectbestand (Opslaan, Opslaan als, de bibliotheek). */
const IFC_FILE_FILTERS: FileFilter[] = [{ name: 'IFC Files', extensions: ['ifc'] }];
const IFC_EXPORT_CHANGED_WHILE_WAITING_NOTICE = {
  severity: 'error', messageKey: 'notifications.ifcExportChangedWhileWaiting', dedupeKey: 'ifc-export-changed',
} as const;

export interface SaveDestination {
  filePath: string;
  fileHandle: FileSystemFileHandle | null;
  siteFileId: string | null;
  siteFileVersion: string | null;
}

export const createFileSlice: AppSliceFactory<FileSlice> = (runtime) => (set, get) => {
  const formatReadOptions = (): FormatReadOptions => ({ ifcBytes: ifcForeignContentEnabled(get().ui.featureFlags) });

  const refuseForeignDocumentWrite = (state: AppState = get()): boolean => {
    if (!ifcFullWriteBlocked(state)) return false;
    get().notify(ifcWriteBlockedNotice(state));
    return true;
  };

  const writerData = (write: Extract<IfcOutput, { readonly content: string }>): FileData => write.bytes ?? write.content;
  const missingSourceSaveAsAllowed = (state: Parameters<typeof ifcFullWriteBlocked>[0]) =>
    planOnlyQuestionApplies(state, 'missingSourceSaveAs');
  const prepareAppIfcWrite = async (state: AppState, input: IFCWriteInput, planOnly?: PlanOnlyConfirmation): Promise<IfcOutput | null> => {
    try { return await prepareIfcOutput(state, input, planOnly, runtime.ifcSaveCompute); }
    catch (error) {
      if (error instanceof IfcWriteBlockedError) get().notify(ifcWriteBlockedNotice(state));
      else if (error instanceof MergeNeedsPhase2Error) get().notify(IFC_FOREIGN_MERGE_REFUSED_NOTICE);
      else if (error instanceof IfcSaveWorkerError) {
        console.error('De opslagworker faalde:', error);
        get().notify(IFC_SAVE_WORKER_FAILED_NOTICE);
      } else throw error;
      return null;
    }
  };

  /**
   * #804 stap 8, fixronde 2 van de review van #1033: één volgorde voor een IFC-export, van de bronkeuze via de vraag
   * "alleen de planning" en het rekenen tot en met het schrijven. Vanaf het begin houdt de export voorrang
   * (`claimProjectFileWrite`): een ronde van Automatisch opslaan met een gebouwmodel die nog vóór haar grens is, wijkt
   * meteen, en zolang de export loopt wijkt elke nieuwe ronde ook, ook terwijl de vraag open staat. Een ronde die al
   * plaatst, maakt dat eerst af (`whenProjectFilePlacementSettled`); pas daarna neemt de export zijn bron op. Een
   * wijziging van de planner zelf en een geannuleerde vraag doen wat ze deden (`refuseExportBeforePicker`). Zonder zo'n ronde
   * (ook met de flag uit) begint de export zonder wachten, zoals vóór stap 8.
   * Fixronde 3: de export legt bij de aanroep vast voor welk document en welke inhoud hij bedoeld is, vóór de wachtstap.
   * Staat na de plaatsing een ander document in het actieve tabblad, of kreeg het tabblad een andere inhoud, dan weigert
   * hij met de bestaande melding, vóór de bestandskiezer; nooit exporteert hij een ander document. Hetzelfde document
   * exporteert hij met de bron van ná de plaatsing.
   */
  const withIfcExportPriority = async (run: () => Promise<ExportResult>): Promise<ExportResult> => {
    const requested = snapshotContent(get());
    const release = claimProjectFileWrite();
    try {
      const placement = whenProjectFilePlacementSettled();
      if (placement) {
        await placement;
        const now = get();
        if (now.activeDocumentId !== requested.id || !sameDocumentContent(now, requested)) {
          now.notify(IFC_EXPORT_CHANGED_WHILE_WAITING_NOTICE);
          return { ok: true, warnings: [], cancelled: true };
        }
      }
      return await run();
    } finally { release(); }
  };
  const prepareDocumentWrite = async (state: AppState, input: IFCWriteInput, planOnly?: PlanOnlyConfirmation): Promise<IfcOutput | null> => {
    const write = await prepareAppIfcWrite(state, input, planOnly);
    if (write && !write.prepared) rememberLiteralCalendarsWritten(state, write.literalCalendarIds);
    return write;
  };

  const SAVE_CHANGED_NOTICE = refusalNotice({ messageKey: 'notifications.ifcSaveChangedWhileWaiting', dedupeKey: 'ifc-save-changed' });
  const snapshotContent = (snapshot: AppState): DocumentContentRef => documentContentOf(snapshot, snapshot.activeDocumentId)!;
  /** Na voorbereiding én na iedere wachtende doelcontrole opnieuw toetsen, vlak vóór I/O. #804 stap 3: dit kijkt naar
   *  het document van de momentopname (`snapshot.activeDocumentId` is het document dat opgeslagen wordt), nooit naar het
   *  document dat nu actief is. Bestaat het nog en is zijn bron hetzelfde object, dan gaat de opslag door, ook als de
   *  planner intussen in een ander tabblad werkt; is het weg of is zijn bron vervangen, dan de weigering.
   *  `missingSourceSaveAs`: Opslaan als met een ontbrekende bron, na het ja op "alleen de planning". De bevestiging gaat
   *  los mee, naast de uitvoer: zo blijft de luie tekst van een workeruitvoer ongelezen (review van #1027). */
  const refuseChangedDocumentWrite = (snapshot: AppState, write: IfcOutput, missingSourceSaveAs = false): boolean => {
    const app = get();
    if (!sameDocumentContent(app, snapshotContent(snapshot))) {
      app.notify(SAVE_CHANGED_NOTICE);
      return true;
    }
    if (!missingSourceSaveAs && !write.prepared) return false;
    const current = saveSourceForDocument(app, snapshot.activeDocumentId);
    const doc = current && { ifcSource: current.ifcSource, foreignSourceMark: current.foreignSourceMark, ui: app.ui };
    if (missingSourceSaveAs) {
      if (doc && doc.ifcSource === snapshot.ifcSource && doc.foreignSourceMark === snapshot.foreignSourceMark
        && missingSourceSaveAsAllowed(doc)) return false;
    } else if (doc && ifcFullWriteBlocked(doc)) {
      app.notify(ifcWriteBlockedNotice(doc));
      return true;
    } else if (doc && doc.ifcSource === snapshot.ifcSource) return false;
    app.notify(SAVE_CHANGED_NOTICE);
    return true;
  };

  const lastWriteCheck = (snapshot: AppState, write: IfcOutput) => {
    let refused = false;
    return { refuse: () => (refused = refuseChangedDocumentWrite(snapshot, write)), refused: () => refused };
  };

  /** `ownTarget`: alleen Ctrl+S (en *Opslaan* in de sluitvraag) op het eigen doel van het document vraagt de
   *  uitzondering "eigen doel" voor een pad of handle; `refusedWriteTarget` toetst haar (eigen handle of eigen pad).
   *  Dan toetst hij ook of het actuele opslagdoel van het document nog `target` is (fixronde 1 van #1008). Dezelfde
   *  controle draait vóór de merge, erna, en bij het eigen pad nog eens na de eerste herstelronde (`replaceOwnPath`),
   *  zodat ook een tabblad dat intussen op hetzelfde bestand openging de vervanging tegenhoudt. Alleen voor *Opslaan als*
   *  op de desktop (`saveAsOnDesktop`): `readers` scant de inhoud die de bestandskiezer vastlegde in plaats van het pad
   *  (`capturedTargetReaders`). `openDocumentsExcept` (de bestandskiezer van Opslaan als en de
   *  vervanging daarna, met de id van het document dat opslaat) weigert ook een bestaand pad dat een ander open document
   *  als bestand heeft (fixronde 1 van #1019, #1022). `chosenTarget`: alleen *Opslaan als* op de desktop (#804 keuze 4, zie
   *  `WriteTargetDeps.chosenTarget`): het gekozen pad en zijn gelezen versie. */
  const documentTargetCheck = (
    snapshot: AppState, write?: IfcOutput, ownTarget = false,
    { readers = writeTargetReaders, openDocumentsExcept, chosenTarget, missingSourceSaveAs }: {
      readers?: () => TargetReaders; openDocumentsExcept?: string; chosenTarget?: PickedSaveTarget; missingSourceSaveAs?: boolean;
    } = {},
  ): SaveTargetCheck => async target => {
    if (write && refuseChangedDocumentWrite(snapshot, write, missingSourceSaveAs)) return true;
    const ownLocal = ownTarget && target.kind !== 'site' && hasForeignContent(snapshot.ifcSource);
    if (ownLocal && movedOwnTarget(snapshot, target)) return true;
    const ownVersion = write?.prepared && target.kind === 'site' && snapshot.siteFileId === target.id
      ? { documentId: snapshot.activeDocumentId, baseVersion: snapshot.siteFileVersion, source: snapshot.ifcSource! }
      : ownLocal ? { documentId: snapshot.activeDocumentId, source: snapshot.ifcSource! } : undefined;
    const reason = await refusedWriteTarget(get(), target,
      { identityFs: fileIdentityFs, readers, openDocumentsExcept, ...(chosenTarget ? { chosenTarget } : {}) }, ownVersion);
    if (reason) {
      get().notify(reason === 'open-document' ? IFC_FOREIGN_TARGET_OPEN_IN_TAB_NOTICE
        : hasForeignContent(snapshot.ifcSource) && reason === 'open-source' && target.kind !== 'site'
        ? IFC_FOREIGN_REPLACE_BLOCKED_NOTICE
        : reason === 'unreadable-target' ? IFC_UNREADABLE_TARGET_SAVE_NOTICE : IFC_FOREIGN_TARGET_SAVE_NOTICE);
      return true;
    }
    return write ? refuseChangedDocumentWrite(snapshot, write, missingSourceSaveAs) : false;
  };

  const movedOwnTarget = (snapshot: AppState, target: FileRef): boolean => {
    const current = saveSourceForDocument(get(), snapshot.activeDocumentId);
    const now = current && saveTargetRef(current);
    if (now && sameFileRef(now, target)) return false;
    get().notify(SAVE_CHANGED_NOTICE);
    return true;
  };

  /** De bestandskiezer van een document: Opslaan als, en Ctrl+S zonder bruikbaar doel (die is Opslaan als, fixronde 1
   *  van #1071). De doelcontrole direct na de
   *  kiezer weigert, voor elk document, ook een bestaand pad dat een ander open document als bestand heeft (#1022): op de
   *  desktop wijzigt de kiezer het bestand niet, dus dan is er niets geschreven. Een handle uit de opslaankiezer van de
   *  browser vergelijkt ze niet: die kiezer heeft een bestaand doel al leeggemaakt, en weigeren liet het andere tabblad
   *  dan een leeg bestand na (knownbug 1899, 1893). Hierlangs gaan de browser en, met de flag uit, de gewone planning op
   *  de desktop (zoals main). De merge op de desktop en met de flag elke planning op de desktop gaan via
   *  `saveAsOnDesktop`, de enige route met de toestemming van #804 keuze 4. */
  const documentSaveDialog = (snapshot: AppState, write: IfcOutput, name: string, missingSourceSaveAs = false) => {
    const options = {
      refuseTarget: documentTargetCheck(snapshot, write, false, { openDocumentsExcept: snapshot.activeDocumentId, missingSourceSaveAs }),
      refuseDownload: () => refuseChangedDocumentWrite(snapshot, write, missingSourceSaveAs),
      // Niet op de handle uit de opslaankiezer van de browser: die is al leeg, een weigering liet 0 bytes (knownbug 1899).
      refuseBeforePlace: isTauri() ? () => refuseChangedDocumentWrite(snapshot, write, missingSourceSaveAs) : null,
    };
    // De merge: alleen een nieuwe naam. De gewone writer overschrijft een bestaand bestand zoals altijd, atomair
    // (`saveDataDialog`, #804 stap 6: met de bytes van de worker).
    return write.prepared
      ? saveNewBytesDialog(name, write.prepared.bytes, IFC_FILE_FILTERS, options)
      : saveDataDialog(name, writerData(write), IFC_FILE_FILTERS, options);
  };

  /** De lezers van de doelcontrole voor het doel dat de bestandskiezer vastlegde (was knownbug 1891): één scan van de
   *  vastgelegde bytes, gedeeld door de controle direct na de kiezer en die na de eerste herstelronde. Zonder vastgelegde
   *  inhoud (een vrije naam, een link, een map) scant de controle het pad, zoals voorheen. Een onleesbaar bestand blijft
   *  een onleesbaar doel. */
  const capturedTargetReaders = (current: PickedSaveTarget['current']): (() => TargetReaders) => {
    if (current === null) return writeTargetReaders;
    let scan: Promise<TargetForeignScan> | undefined;
    return () => ({
      ...writeTargetReaders(),
      scanPath: async () => current === 'unreadable' ? 'unreadable' : (scan ??= scanForeignTargetBytesAsync(current)),
    });
  };

  const foreignTargetCheck = (exceptDocumentId: string | null): SaveTargetCheck => async (target) => {
    const reason = await refusedWriteTarget(get(), target,
      { identityFs: fileIdentityFs, readers: writeTargetReaders, openDocumentsExcept: exceptDocumentId });
    if (!reason) return false;
    get().notify(reason === 'open-document'
      ? exceptDocumentId === null ? EXPORT_TARGET_OPEN_DOCUMENT_NOTICE : EXPORT_TARGET_OPEN_IN_TAB_NOTICE
      : reason === 'unreadable-target' ? IFC_UNREADABLE_TARGET_EXPORT_NOTICE : IFC_FOREIGN_TARGET_EXPORT_NOTICE);
    return true;
  };

  // In de ene schrijfrij, zoals elke schrijfactie naar een projectbestand (inclusief de kiezer, zoals `exportAs`): een
  // startbestand dat intussen gelezen werd, leest de app dan opnieuw (`projectFileWriteTurns`, review ronde 5 van #1116).
  const saveLibraryFile = (name: string, content: string) => runProjectFileWrite(
    () => saveFileDialog(name, content, IFC_FILE_FILTERS, { refuseTarget: foreignTargetCheck(null) }), () => null);

  const settledSourceVersions = new Map<string, string>();
  const settledProposals = new Map<string, string>();
  const sourceKey = (documentId: string, key: string) => `${documentId}\u0000${key}`;
  const sourceGenerations = new Map<string, number>();
  const sourceGeneration = (documentId: string, key: string) => sourceGenerations.get(sourceKey(documentId, key)) ?? 0;
  let sourceCheckRunning = false;
  let sourceCheckAgain = false;

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

  const dropSourceUpdates = (documentId: string, keys: ReadonlySet<string>) => {
    for (const key of keys) sourceGenerations.set(sourceKey(documentId, key), sourceGeneration(documentId, key) + 1);
    const ui = get().ui;
    const next = ui.externalSourceUpdates.filter(u => u.documentId !== documentId || !keys.has(u.key));
    if (next.length === ui.externalSourceUpdates.length) return;
    get().setUI({
      externalSourceUpdates: next,
      ...(ui.externalSourceReview !== null && keys.has(ui.externalSourceReview) ? { externalSourceReview: null } : {}),
    });
  };

  const sleepingDocuments = () => {
    const s = get();
    return s.documents.flatMap(d => (d.id !== s.activeDocumentId && d.payload ? [{ id: d.id, payload: d.payload }] : []));
  };

  const openDirtySource = (locator: ExternalSourceLocator) => {
    if (!get().project.anchorsFromOpenDocuments) return null;
    const doc = openSourceDocument(locator, sleepingDocuments(), get().activeDocumentId);
    return doc?.payload.isDirty ? doc : null;
  };

  const readPreferringOpen = (
    locator: ExternalSourceLocator, labels: ImportLabels | undefined, readSaved: () => Promise<ExternalSourceRead | null>,
  ): Promise<ExternalSourceRead | null> => {
    const open = openDirtySource(locator);
    return open ? readOpenSource(open, locator, labels) : readSaved();
  };

  const readOpenSource = async (
    doc: { payload: DocumentPayload }, locator: ExternalSourceLocator, labels?: ImportLabels,
  ): Promise<ExternalSourceRead | null> => {
    try {
      return await externalSourceFromOpenDocument(doc.payload, locator, labels);
    } catch (err) {
      console.error('externalSourceFromOpenDocument: kon het geopende document niet lezen:', err);
      return null;
    }
  };

  const announceUnsavedOpenSources = (targetDocumentId: string, locators: readonly ExternalSourceLocator[]): void => {
    if (get().project.anchorsFromOpenDocuments) return;
    for (const source of unsavedOpenSources(locators, sleepingDocuments(), targetDocumentId)) {
      get().notify({
        severity: 'info',
        messageKey: 'notifications.externalOpenSourceUnsaved',
        params: { file: source.fileName },
        dedupeKey: `external-open-source:${targetDocumentId}:${source.key}`,
        replaceOnDedupe: true,
      });
    }
  };

  const sourceVersionAt = async (locator: ExternalSourceLocator) => {
    if (locator.kind === 'site') return (await get().externalSiteSourceVersion(locator.siteFileId))?.version;
    return locator.kind === 'path'
      ? get().externalSourceVersion(locator.filePath)
      : get().externalProjectSourceVersion(locator.projectId);
  };

  const sourceHandleFor = async (projectId: string): Promise<FileSystemFileHandle | null> =>
    (await get().externalSourceHandles()).get(projectId) ?? null;

  const readProjectFile = async (projectId: string, file: File, labels?: ImportLabels): Promise<ExternalSourceRead | null> => {
    try {
      const source = await readExternalSourceFile(file, labels, formatReadOptions());
      return source.projectId === projectId ? source : null;
    } catch (err) {
      console.error('readExternalSourceFile: kon bronbestand niet lezen:', err);
      return null;
    }
  };

  const fileNameOf = (filePath: string) => filePath.split(/[\\/]/).pop() || filePath;

  const checkExternalSourcesOnce = async (labels?: ImportLabels) => {
    const documentId = get().activeDocumentId;
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
    const generations = new Map([...sources.keys()].map(key => [key, sourceGeneration(documentId, key)]));
    const stale = (key: string) => sourceGeneration(documentId, key) !== generations.get(key);
    let discarded = false;
    const found = new Map<string, ExternalSourceUpdate>();
    const settled = new Set<string>();
    for (const [key, { locator, versions }] of sources) {
      const existing = () => get().ui.externalSourceUpdates.find(u => u.documentId === documentId && u.key === key);
      const open = openDirtySource(locator);
      if (open) {
        const src = await readOpenSource(open, locator, labels);
        if (get().activeDocumentId !== documentId) return;
        if (!src) continue;
        if (stale(key)) { discarded = true; continue; }
        const tasks = get().tasks;
        const changes = externalAnchorChanges(tasks, refreshExternalAnchors(tasks, src, externalSourceScopeOf(locator)).tasks);
        if (changes.length === 0) { settled.add(key); continue; }
        const fingerprint = proposalFingerprint(changes);
        if (existing()?.version === fingerprint) continue;
        if (settledProposals.get(sourceKey(documentId, key)) === fingerprint) { settled.add(key); continue; }
        found.set(key, {
          documentId, key, locator, fileName: openSourceName(locator, open.payload), version: fingerprint,
          proposal: fingerprint, openDocumentId: open.id, changedLinks: changes.length,
        });
        continue;
      }
      const siteVersion = locator.kind === 'site' ? await get().externalSiteSourceVersion(locator.siteFileId) : undefined;
      const version = locator.kind === 'site' ? siteVersion?.version : await sourceVersionAt(locator);
      if (get().activeDocumentId !== documentId) return;
      if (!version) continue;
      if (versions.size === 1 && versions.has(version)) { settled.add(key); continue; }
      if (existing()?.version === version) continue;
      if (settledSourceVersions.get(sourceKey(documentId, key)) === version) { settled.add(key); continue; }
      const src = await get().readExternalSourceAt(locator, labels);
      if (get().activeDocumentId !== documentId) return;
      if (!src) continue;
      if (stale(key)) { discarded = true; continue; }
      const tasks = get().tasks;
      const result = refreshExternalAnchors(tasks, src, externalSourceScopeOf(locator));
      const changes = externalAnchorChanges(tasks, result.tasks);
      const changedLinks = changes.length;
      const readVersion = locator.kind === 'site' ? version : src.version ?? version;
      if (changedLinks === 0) {
        settledSourceVersions.set(sourceKey(documentId, key), src.version ?? version);
        settled.add(key);
        continue;
      }
      found.set(key, {
        documentId, key, locator,
        fileName: locator.kind === 'path' ? fileNameOf(locator.filePath) : src.fileName ?? src.projectName,
        version: readVersion,
        proposal: proposalFingerprint(changes),
        ...(siteVersion ? { siteVersionLabel: siteVersion.label?.trim() || siteVersion.version } : {}),
        ...(siteVersion?.author?.trim() ? { author: siteVersion.author.trim() }
          : src.author ? { author: src.author } : {}),
        changedLinks,
      });
    }
    for (const key of sources.keys()) {
      if (!stale(key)) continue;
      discarded = true;
      found.delete(key);
      settled.delete(key);
    }
    if (discarded) sourceCheckAgain = true;
    const current = get().ui.externalSourceUpdates;
    const next = [
      ...current.filter(u => u.documentId !== documentId
        || (sources.has(u.key) && !settled.has(u.key) && !found.has(u.key))),
      ...found.values(),
    ];
    const same = next.length === current.length && next.every(u => current.includes(u));
    if (!same) get().setUI({ externalSourceUpdates: next });
  };

  const pushRecent = async (ref: FileRef | null, name: string) => {
    if (!ref) return;
    const list = await addRecent(ref, name);
    set((s) => { s.recentFiles = list; });
  };

  const downloadNotice = (outcome: SaveOutcome | null): NotifyInput | null => outcome?.viaDownload ? {
    severity: 'info',
    messageKey: 'notifications.savedViaDownload',
    params: { name: outcome.name },
    dedupeKey: 'saved-via-download',
  } : null;
  const noticeIfDownloaded = (outcome: SaveOutcome | null) => {
    const notice = downloadNotice(outcome);
    if (notice) get().notify(notice);
  };

  const saveSourceForDocument = (state: AppState, documentId: string): AppState | DocumentPayload | null => {
    if (state.activeDocumentId === documentId) return state;
    return state.documents.find(document => document.id === documentId)?.payload ?? null;
  };

  const commitSavedDocument = (
    document: DocumentContentRef,
    savedSource: IFCSaveSource,
    destination?: SaveDestination,
    prepared?: PreparedIfcWrite,
    missingSourceSaveAs = false,
  ): boolean => {
    if (!sameDocumentContent(get(), document)) return false;
    const documentId = document.id;
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
    const applyPrepared = (target: Pick<AppState, 'ifcSource' | 'foreignSourceMark' | keyof SaveDestination>) => {
      if (missingSourceSaveAs && savedSource.foreignSourceMark) {
        target.ifcSource = null;
        target.foreignSourceMark = { ...savedSource.foreignSourceMark, sourceMissing: false };
        return;
      }
      if (!prepared) return;
      target.ifcSource = castDraft(prepared.source);
      target.foreignSourceMark = foreignSourceMarkFor(prepared.source, target);
    };
    const written = prepared?.literalCalendarIds ?? literalCalendarIdsWritten(savedSource);
    const savedAt = Date.now();
    set((state) => {
      stampSaved(state, document, savedAt);
      if (state.activeDocumentId === documentId) {
        applyDestination(state);
        applyPrepared(state);
        state.ifcLiteralCalendarIds = mergeLiteralCalendarIds(state.ifcLiteralCalendarIds, written);
        if (unchanged) state.isDirty = false;
        return;
      }
      const entry = state.documents.find(document => document.id === documentId);
      if (!entry?.payload) return;
      applyDestination(entry.payload);
      applyPrepared(entry.payload);
      entry.payload.ifcLiteralCalendarIds = mergeLiteralCalendarIds(entry.payload.ifcLiteralCalendarIds, written);
      if (unchanged) entry.payload.isDirty = false;
    });
    return unchanged;
  };

  const recordOwnFileExport = async (state: AppState, outcome: SaveOutcome, ids: readonly string[]): Promise<void> => {
    if (ids.length === 0) return;
    const hitsOwnFile = await exportHitsOwnFile(saveTargetRef(state), outcome.ref, await fileIdentityFs());
    if (hitsOwnFile && !exportContentReplaced(state)) get().recordLiteralCalendarsWritten(state.activeDocumentId, ids);
  };

  const exportContentReplaced = (state: AppState): boolean => !sameDocumentContent(get(), snapshotContent(state));

  /** Review #872 ronde 5 (Terra): een IFC-export maakt zijn tekst vóór hij op de schrijflock wacht. Veranderde het
   *  document intussen (een opslag in de wachtrij legde de letterlijke kalenders vast, of de planner wijzigde iets), dan
   *  zou de export oude inhoud over een nieuwere opslag schrijven. Daarom weigert deze controle, met een melding, na de
   *  bestandskiezer (`refuseTarget`) en vlak vóór de plaatsing op de desktop (knownbug 1896). Ze kijkt naar het
   *  geëxporteerde document, ook als dat intussen in een ander tabblad staat: een tabbladwissel is geen wijziging van de
   *  planning (review van #1027 ronde 2, knownbug 1903). Weigeren: het document is gesloten of kreeg een andere inhoud
   *  (`sameDocumentContent`), de te schrijven inhoud of (met een vreemd deel, `hasForeignContent`) het bronobject is niet
   *  meer dat van de momentopname, of de app weigert nu de volledige IFC van dat document. `true` = weigeren (zoals `SaveTargetCheck`). */
  const refuseChangedExport = (snapshot: AppState): boolean => {
    const now = get();
    const foreign = hasForeignContent(snapshot.ifcSource);
    const exported = sameDocumentContent(now, snapshotContent(snapshot)) ? saveSourceForDocument(now, snapshot.activeDocumentId) : null;
    const doc = exported && { ifcSource: exported.ifcSource, foreignSourceMark: exported.foreignSourceMark, ui: now.ui };
    if (foreign && doc && ifcFullWriteBlocked(doc)) {
      now.notify(ifcWriteBlockedNotice(doc));
      return true;
    }
    if (exported && sameIFCSource(snapshot, exported) && (!foreign || exported.ifcSource === snapshot.ifcSource)) return false;
    now.notify(IFC_EXPORT_CHANGED_WHILE_WAITING_NOTICE);
    return true;
  };
  /** Onder het schrijfslot vóór de bestandskiezer, en vóór een download (die komt in plaats van de kiezer):
   *  `refuseChangedExport`, en het geëxporteerde document moet ook nog het actieve tabblad zijn. De kiezer opent anders
   *  voor een document dat de planner niet ziet. `true` = weigeren, met de melding. */
  const refuseExportBeforePicker = (snapshot: AppState): boolean => {
    if (get().activeDocumentId === snapshot.activeDocumentId) return refuseChangedExport(snapshot);
    get().notify(IFC_EXPORT_CHANGED_WHILE_WAITING_NOTICE);
    return true;
  };
  /** De twee controles van één IFC-export na de bestandskiezer. `refuseTarget`: het gekozen doel en `refuseChangedExport`.
   *  `refuseBeforePlace`, de late controle: op de desktop altijd, vlak vóór de plaatsing. In de browser, op de handle uit
   *  de opslaankiezer, heeft de kiezer een bestaand doel al leeggemaakt (knownbug 1899) en laat een weigering daar 0 bytes
   *  staan. Daarom wordt ze daar gekozen bij de geslaagde doelcontrole: stond het geëxporteerde document daar niet
   *  vooraan (waar main nog weigerde, knownbug 1903), dan loopt ze vlak vóór `close()`, welk tabblad dan ook vooraan
   *  staat (keuze (b) van de technisch beslisser, fixronde 3 van #1097). Stond het er wel vooraan, dan niet: de browser
   *  doet wat main deed, ook bij een wissel daarna (knownbug 1958). */
  const exportTargetChecks = (snapshot: AppState) => {
    const foreignCheck = foreignTargetCheck(snapshot.activeDocumentId);
    let inactiveAtTarget = false;
    const refuseTarget: SaveTargetCheck = async target => {
      if ((await foreignCheck(target)) || refuseChangedExport(snapshot)) return true;
      inactiveAtTarget = get().activeDocumentId !== snapshot.activeDocumentId;
      return false;
    };
    return { refuseTarget, refuseBeforePlace: () => (isTauri() || inactiveAtTarget) && refuseChangedExport(snapshot) };
  };

  /** De vraag "alleen de planning" vóór een IFC-export zonder gebouwmodel (#804 PR 13). `undefined`: geen vraag nodig
   *  (geen gebouwmodel, de gewone route); `null`: de planner annuleerde. Het ja geldt voor de momentopname `state`: de
   *  export bouwt daarop, en `refuseExportBeforePicker(state)` weigert onder het schrijfslot, vóór de bestandskiezer, als het
   *  document tijdens de vraag veranderde. */
  const askPlanOnlyExport = (state: AppState, reason: 'export' | 'exportWithPool'): Promise<PlanOnlyConfirmation | null | undefined> =>
    planOnlyQuestionApplies(state, reason) ? askPlanOnly(reason) : Promise.resolve(undefined);

  const localDestination = (outcome: SaveOutcome): SaveDestination => ({
    filePath: outcome.ref?.kind === 'path' ? outcome.ref.path : outcome.name,
    fileHandle: outcome.ref?.kind === 'handle' ? outcome.ref.handle : null,
    siteFileId: null,
    siteFileVersion: null,
  });

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

  const saveAsNewSiteFile = async (state: AppState, write: IfcOutput, name: string, missingSourceSaveAs = false): Promise<boolean> => {
    if (refuseChangedDocumentWrite(state, write, missingSourceSaveAs)) return false;
    const info = write.prepared ? await saveNewSiteFileBytes(name, write.prepared.bytes) : await saveNewSiteFile(name, writerData(write));
    const saved = commitSavedDocument(snapshotContent(state), state, {
      filePath: info.name, fileHandle: null, siteFileId: info.id, siteFileVersion: info.version,
    }, write.prepared, missingSourceSaveAs);
    await pushRecent({ kind: 'site', id: info.id }, info.name);
    return saved;
  };

  const openSiteChoice = async (choice: Extract<SiteOpenChoice, { kind: 'site' }>, labels?: ImportLabels) => {
    const readOptions = formatReadOptions();
    const opened = await openSiteFile(choice.id, { binaryExtensions: binaryExtensions(readOptions), version: choice.version });
    const parsed = await parseOpenedFile({ name: opened.name, text: opened.content, bytes: opened.bytes }, labels, readOptions);
    refuseModelAboveOpenLimit(parsed);
    if (choice.version === undefined && opened.readOnly) {
      get().openAsDocument(parsed, { name: opened.name, ref: null });
      offerFormatNotice(opened.name, opened.content);
      await pushRecent({ kind: 'site', id: choice.id }, opened.name);
      get().notify({ severity: 'info', sticky: true, messageKey: 'notifications.siteFileReadOnly', params: { name: opened.name } });
      return;
    }
    if (choice.version === undefined) {
      get().openAsDocument(parsed, { name: opened.name, ref: opened.ref, siteFileVersion: opened.version });
      offerFormatNotice(opened.name, opened.content);
      await pushRecent(opened.ref, opened.name);
      return;
    }
    get().openAsDocument(parsed, { name: siteVersionCopyName(opened.name, choice.version, choice.copyName), ref: null });
    offerFormatNotice(opened.name, opened.content);
  };

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

  const siteQuestionOpen = () => saveQuestionOpen(get().ui);

  const offerFormatNotice = (name: string, text: string | undefined) => {
    const kind = formatNoticeToShow(name, text, get().ui.formatNoticeHidden);
    if (kind) set((s) => { s.ui.pendingFormatNotice = kind; });
  };

  const settleIfcSchemaQuestion = async (): Promise<boolean> => {
    const before = get();
    const question = ifcSchemaQuestionFor(before.project, before.ifcSource);
    if (!question) return true;
    const documentId = before.activeDocumentId;
    const answer = await askIfcSchema(question);
    if (!answer) return false;
    if (get().activeDocumentId !== documentId) return false;
    set((s) => { applyIfcSchemaChoice(s.project, answer, s.ifcSource); });
    return true;
  };

  const settleDependentAnchors = async (): Promise<boolean> => {
    const before = get();
    const tight = await tightAnchorsIfSaved(before.ui.dependentProjects, before.activeDocumentId, before);
    if (tight.length === 0) return true;
    const documentId = before.activeDocumentId;
    if (!(await askDependentAnchors(tight))) return false;
    return get().activeDocumentId === documentId;
  };

  const ownTargetContentNotice = (content: Exclude<SourceTargetContent, 'same'>): NotifyInput =>
    content === 'changed' ? IFC_FOREIGN_TARGET_CHANGED_NOTICE : IFC_FOREIGN_TARGET_GONE_NOTICE;

  const replaceOwnHandle = async (
    documentId: string, state: AppState, prepared: PreparedIfcWrite, write: IfcOutput,
    ref: Extract<FileRef, { kind: 'handle' }>, failureNoticeKey: string,
  ): Promise<boolean> => {
    let committed = false;
    try {
      const result = await replaceOwnHandleWithRecovery({
        documentId, ref, prepared, source: state.ifcSource!.bytes,
        stopBeforeWrite: () => refuseChangedDocumentWrite(state, write),
        refuseBeforePlace: () => refuseChangedDocumentWrite(state, write),
        commit: () => { committed = commitSavedDocument(snapshotContent(state), state, undefined, prepared); },
      });
      if (result.code === 'replaced') return committed;
      if (result.code === 'not-recorded') get().notify(IFC_FOREIGN_REPLACE_NOT_RECORDED_NOTICE);
      else if (result.code === 'target-changed') get().notify(ownTargetContentNotice(result.content));
      return false;
    } catch (err) {
      console.error('Save failed:', err);
      get().notify({
        severity: 'error', messageKey: 'notifications.ifcForeignReplaceFailed',
        detail: saveErrorDetail(err instanceof ByteWriteError && err.cause !== undefined ? err.cause : err),
        dedupeKey: failureNoticeKey, replaceOnDedupe: true,
      });
      return false;
    }
  };

  const replaceOwnPath = async (
    documentId: string, state: AppState, prepared: PreparedIfcWrite, write: IfcOutput,
    ref: Extract<FileRef, { kind: 'path' }>, failureNoticeKey: string,
  ): Promise<boolean> => {
    let committed = false;
    try {
      const result = await replaceOwnPathWithRecovery({
        documentId, path: ref.path, prepared,
        source: { bytes: state.ifcSource!.bytes, sha256: state.ifcSource!.sha256 },
        stopBeforeWrite: () => documentTargetCheck(state, write, true)(ref),
        refuseBeforePlace: () => refuseChangedDocumentWrite(state, write),
        commit: () => { committed = commitSavedDocument(snapshotContent(state), state, undefined, prepared); },
      });
      for (const notice of ownPathReplaceNotices(result, ref.path)) get().notify(notice);
      return committed;
    } catch (err) {
      console.error('Save failed:', err);
      get().notify({
        severity: 'error', messageKey: 'notifications.ifcForeignReplaceFailed', detail: saveErrorDetail(err),
        dedupeKey: failureNoticeKey, replaceOnDedupe: true,
      });
      return false;
    }
  };

  /**
   * #804 keuze 4 (knownbug 1131 stap 8; was knownbug 1891): *Opslaan als* op de desktop van een document met een vreemd
   * deel (de merge), en met de flag ook van een gewone planning; ook de bestandskiezer van Ctrl+S bij een document zonder
   * opslagdoel (fixronde 1 van #1071). Eén doelwaarneming bepaalt wat er gebeurt (fixronde 2 van #1071): het pad en wat er
   * direct na de terugkeer van de kiezer stond (`pickSaveTarget`), voor elk document en elke inhoud van het doel.
   * - Een gewoon bestand dat de kiezer las: de planner bevestigde het vervangen van die versie, ook een gebouwmodel of
   *   gegevens van een ander programma (besluit van de eigenaar, 19 november 2026). Dezelfde vervanging als Ctrl+S
   *   (`replaceExistingPath`), met die bytes als verwachte versie: een andere inhoud op het doel stopt de opslag, en een
   *   versie die een ander programma intussen schreef, blijft als kopie bewaard.
   * - Niets, een link of een map: de exclusieve aanmaak van een nieuwe naam, die een bestaande naam weigert
   *   (`target-exists`, ook knownbug 1890).
   * - Onleesbaar: de doelcontrole weigert (besluit van de technisch beslisser, 20 november 2026).
   * De doelcontrole direct na de kiezer en die na de eerste herstelronde zijn dezelfde (`check`, met de waarneming als
   * `chosenTarget`) en delen één scan van de vastgelegde bytes. `null`: niets geschreven (geannuleerd, geweigerd of
   * mislukt, met de melding). Anders is het document vastgelegd (pad, bron); `committed` is de uitkomst van
   * `commitSavedDocument` (schoon). Een fout van de exclusieve aanmaak gooit, zoals bij elke andere route
   * (`newTargetWriteNotice`).
   */
  const saveAsOnDesktop = async (
    documentId: string, state: AppState, write: IfcOutput, name: string, missingSourceSaveAs = false,
  ): Promise<{ outcome: SaveOutcome; committed: boolean } | null> => {
    const picked = await pickSaveTarget(name, IFC_FILE_FILTERS);
    if (!picked) return null;
    const ref = { kind: 'path', path: picked.path } as const, outcome = { ref, name: basename(picked.path) };
    const check = documentTargetCheck(state, write, false, {
      readers: capturedTargetReaders(picked.current), openDocumentsExcept: documentId, chosenTarget: picked, missingSourceSaveAs,
    });
    if (await check(ref)) return null;
    // De doelcontrole weigert een onleesbaar doel al (met haar melding); dit houdt de route er ook zonder haar vanaf.
    if (picked.current === 'unreadable') return null;
    if (picked.current) {
      const replaced = await replaceExistingPath(documentId, state, write, picked.path, picked.current, () => check(ref), missingSourceSaveAs);
      return replaced && { outcome, committed: replaced.committed };
    }
    if (!(await saveNewBytesToRef(ref, writeBytes(write), () => refuseChangedDocumentWrite(state, write, missingSourceSaveAs)))) return null;
    return {
      outcome,
      committed: commitSavedDocument(snapshotContent(state), state, localDestination(outcome), write.prepared ?? undefined, missingSourceSaveAs),
    };
  };

  /** De bytes van een documentopslag: de voorbereide merge, of de uitvoer van de gewone writer (tekst als UTF-8, zoals
   *  plugin-fs `writeTextFile` die schrijft). */
  const writeBytes = (write: IfcOutput): Uint8Array => {
    if (write.prepared) return write.prepared.bytes;
    const data = writerData(write);
    return typeof data === 'string' ? new TextEncoder().encode(data) : data;
  };

  /**
   * De vervanging van een ANDER bestaand bestand bij *Opslaan als* (`saveAsOnDesktop`): dezelfde als Ctrl+S
   * (`replaceOwnPathWithRecovery`, §4.10 stap 0–6), binnen dezelfde `runProjectFileWrite` van de opslag; alleen de verwachte
   * inhoud is anders: de app opende dit bestand niet, dus het is wat de bestandskiezer vastlegde (`current`; zijn sha256
   * is `vorigeSha256` in het herstelrecord). Staat er vlak vóór het opzijzetten iets anders (stap 2), dan stopt de opslag
   * met de melding van Ctrl+S en blijft het doel zoals het is; schreef een ander programma daarna nog (stap 5), dan blijft
   * die versie als kopie. Ook voor een document zonder vreemd deel (fixronde 2 van #1071): dan zonder de manifeststap
   * (`documentId: null`), want zo'n document heeft geen bron in het herstelmanifest; het herstelrecord dekt de hulpnamen.
   * `stopBeforeWrite` is de doelcontrole van de kiezer, opnieuw na de eerste herstelronde: document, open tabbladen en
   * bronnen; de scan van `current` doet ze niet nog eens. Na een geslaagde vervanging is het document hetzelfde als na
   * Opslaan als naar een nieuwe naam (nieuw pad; bij de merge de geschreven bytes als bron). Waar de vervanging niet kan
   * (`save-as-only`: een map waar het tijdelijke bestand niet mag ontstaan, een link, een bestandssysteem zonder exclusieve
   * stap) blijft de melding van een nieuwe naam. Geen terugval op een routine die het bestand overschrijft. De identiteit
   * van de documentinhoud (#1020) toetst deze route twee keer: `stopBeforeWrite` (vóór het eigen tijdelijke bestand) en de
   * commit met de inhoud van de momentopname (`snapshotContent`), zodat een intussen geladen ander project geen pad of bron
   * krijgt. `null`: niet vervangen; anders vervangen, met de uitkomst van de commit (`committed`: het document is schoon).
   */
  const replaceExistingPath = async (
    documentId: string, state: AppState, write: IfcOutput, path: string, current: Uint8Array,
    stopBeforeWrite: () => Promise<boolean>, missingSourceSaveAs: boolean,
  ): Promise<{ committed: boolean } | null> => {
    let committed = false;
    try {
      const bytes = writeBytes(write);
      const result = await replaceOwnPathWithRecovery({
        documentId: write.prepared ? documentId : null, path,
        prepared: write.prepared ?? { bytes, sha256: await precomputeSha256(bytes) },
        source: { bytes: current, sha256: await precomputeSha256(current) }, stopBeforeWrite,
        refuseBeforePlace: () => refuseChangedDocumentWrite(state, write, missingSourceSaveAs),
        commit: () => {
          committed = commitSavedDocument(snapshotContent(state), state,
            localDestination({ ref: { kind: 'path', path }, name: basename(path) }), write.prepared ?? undefined, missingSourceSaveAs);
        },
      });
      for (const notice of result.code === 'save-as-only' ? [IFC_FOREIGN_NEW_TARGET_ONLY_NOTICE] : ownPathReplaceNotices(result, path)) {
        get().notify(notice);
      }
      return result.code === 'replaced' ? { committed } : null;
    } catch (err) {
      console.error('Save As failed:', err);
      get().notify({ severity: 'error', messageKey: 'notifications.ifcForeignReplaceFailed', detail: saveErrorDetail(err) });
      return null;
    }
  };

  const trackSave = <T,>(requested: DocumentContentRef, save: Promise<T>): Promise<T> => {
    set(s => { changeSaving(s, requested, 1); });
    return save.finally(() => set(s => { changeSaving(s, requested, -1); }));
  };

  let saveAttemptSequence = 0;
  const writeActiveDocument = (requested: DocumentContentRef, onTurn: () => void): Promise<boolean> => runProjectFileWrite(async () => {
    onTurn();
    const documentId = requested.id;
    if (get().activeDocumentId !== documentId || !sameDocumentContent(get(), requested)) return false;
    if (refuseForeignDocumentWrite()) return false;
    if (!(await settleIfcSchemaQuestion())) return false;
    if (!(await settleDependentAnchors())) return false;
    const state = get();
    if (state.activeDocumentId !== documentId || !sameDocumentContent(state, requested)) return false;
    if (refuseForeignDocumentWrite(state)) return false;
    let siteName: string | null = null;
    let handleWriteFailed = false;
    const failureNoticeKey = `project-save:${++saveAttemptSequence}`;
    const notifyWriteError = (err: unknown) => {
      console.error('Save failed:', err);
      const newTarget = newTargetWriteNotice(err);
      if (newTarget) { get().notify(newTarget); return; }
      get().notify({
        severity: 'error', messageKey: 'notifications.saveFailed', detail: saveErrorDetail(err),
        dedupeKey: failureNoticeKey, replaceOnDedupe: true,
      });
    };

    try {
      const ref = saveTargetRef(state);
      let ownHandle: Extract<FileRef, { kind: 'handle' }> | null = null;
      let ownPath: Extract<FileRef, { kind: 'path' }> | null = null;
      let handleRefused = false;
      if (!hasForeignContent(state.ifcSource) && ref?.kind === 'handle') {
        try { handleRefused = !(await handleWritePermission(ref)); } catch (err) {
          handleRefused = handleWriteFailed = true;
          notifyWriteError(err);
        }
      }
      if (hasForeignContent(state.ifcSource) && ref && ref.kind !== 'site') {
        if (await documentTargetCheck(state, undefined, true)(ref)) return false;
        if (ref.kind === 'path') ownPath = ref;
        else if (await handleWritePermission(ref)) {
          const content = await sourceTargetContent(ref, state.ifcSource!.bytes);
          if (content !== 'same') { get().notify(ownTargetContentNotice(content)); return false; }
          ownHandle = ref;
        }
      }
      const write = await prepareDocumentWrite(state, buildWriteIFCInput(state, 'merge'));
      if (!write || refuseChangedDocumentWrite(state, write)) return false;
      if (ref && await documentTargetCheck(state, write, true)(ref)) return false;
      if (ownHandle && write.prepared) return await replaceOwnHandle(documentId, state, write.prepared, write, ownHandle, failureNoticeKey);
      if (ownPath) return write.prepared ? await replaceOwnPath(documentId, state, write.prepared, write, ownPath, failureNoticeKey) : false;
      if (ref?.kind === 'site' && siteStorageAvailable()) {
        siteName = documentFileName(state);
        if (refuseChangedDocumentWrite(state, write)) return false;
        const saved = write.prepared
          ? await saveSiteFileVersionBytes(ref.id, siteName, write.prepared.bytes, state.siteFileVersion)
          : await saveSiteFileVersion(ref.id, siteName, writerData(write), state.siteFileVersion);
        if (saved.conflictCopy) {
          const committed = commitSavedDocument(snapshotContent(state), state, {
            filePath: saved.name, fileHandle: null, siteFileId: saved.id, siteFileVersion: saved.version,
          }, write.prepared);
          await pushRecent({ kind: 'site', id: saved.id }, saved.name);
          get().notify({
            severity: 'info', sticky: true, messageKey: 'notifications.siteSaveConflictCopy',
            params: { name: saved.name, original: siteName },
          });
          return committed;
        }
        return commitSavedDocument(snapshotContent(state), state, {
          filePath: state.filePath ?? saved.name, fileHandle: null, siteFileId: ref.id, siteFileVersion: saved.version,
        }, write.prepared);
      }
      if (ref && !handleRefused && !(write.prepared && ref.kind === 'handle')) {
        try {
          if (refuseChangedDocumentWrite(state, write)) return false;
          const last = lastWriteCheck(state, write);
          const saved = write.prepared
            ? await saveNewBytesToRef(ref, write.prepared.bytes, last.refuse)
            : await saveToRef(ref, writerData(write), last.refuse, ref.kind === 'handle');
          if (last.refused()) return false;
          if (saved) return commitSavedDocument(snapshotContent(state), state, undefined, write.prepared);
        } catch (err) {
          if (write.prepared || isTauri() || ref.kind !== 'handle') throw err;
          handleWriteFailed = true;
          notifyWriteError(err);
        }
      }

      if (siteStorageAvailable()) {
        const choice = await askSiteSave({ defaultName: siteSaveDefaultName(state) });
        if (!choice) return false;
        if (choice.kind === 'site') {
          siteName = choice.name;
          return await saveAsNewSiteFile(state, write, choice.name);
        }
      }

      const hadFile = !isTauri() && (state.fileHandle !== null || !!state.filePath);
      // Fixronde 1 van #1071: de bestandskiezer van Ctrl+S is Opslaan als, op de desktop met dezelfde bevestigde doelroute.
      if (isTauri() && (write.prepared || ifcForeignContentEnabled(state.ui.featureFlags))) {
        const saved = await saveAsOnDesktop(documentId, state, write, `${suggestedFileBase(state)}.ifc`);
        if (!saved || !sameDocumentContent(get(), snapshotContent(state))) return false;
        await pushRecent(saved.outcome.ref, saved.outcome.name);
        return saved.committed;
      }
      const outcome = await documentSaveDialog(state, write, `${suggestedFileBase(state)}.ifc`);
      if (!outcome) return false;
      if (write.prepared && outcome.viaDownload && ref?.kind === 'handle' && hasBuildingModel(state.ifcSource)) {
        get().notify(downloadCopyNotice(outcome.name));
        return false;
      }
      const saved = write.prepared && outcome.viaDownload
        ? commitSavedDocument(snapshotContent(state), state)
        : commitSavedDocument(snapshotContent(state), state, localDestination(outcome), write.prepared);
      if (!sameDocumentContent(get(), snapshotContent(state))) return false;
      await pushRecent(outcome.ref, outcome.name);
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
  }, () => false);

  const saveActiveDocumentAs = (): Promise<void> => {
    const requested = documentContentOf(get(), get().activeDocumentId)!;
    return trackSave(requested, runProjectFileWrite(() => saveDocumentAsOnTurn(requested), () => undefined));
  };
  const saveDocumentAsOnTurn = async (requested: DocumentContentRef): Promise<void> => {
    const before = get();
    const startDocumentId = before.activeDocumentId;
    if (startDocumentId !== requested.id || !sameDocumentContent(before, requested)) return;
    const missingSourceSaveAs = missingSourceSaveAsAllowed(before);
    let planOnly: PlanOnlyConfirmation | undefined;
    if (missingSourceSaveAs) {
      planOnly = await askPlanOnly('missingSourceSaveAs') ?? undefined;
      if (!planOnly) return;
      if (get().activeDocumentId !== startDocumentId || get().foreignSourceMark !== before.foreignSourceMark
        || get().ifcSource !== before.ifcSource || !missingSourceSaveAsAllowed(get())) return;
    } else if (refuseForeignDocumentWrite()) return;
    if (!(await settleIfcSchemaQuestion())) return;
    if (!(await settleDependentAnchors())) return;
    const state = get();
    const documentId = state.activeDocumentId;
    if (documentId !== startDocumentId || !sameDocumentContent(state, requested)) return;
    if (missingSourceSaveAs) {
      if (!missingSourceSaveAsAllowed(state) || state.foreignSourceMark !== before.foreignSourceMark
        || state.ifcSource !== before.ifcSource) return;
    } else if (refuseForeignDocumentWrite(state)) return;
    let siteName: string | null = null;

    try {
      const write = await prepareDocumentWrite(state, buildWriteIFCInput(state, missingSourceSaveAs ? 'planOnly' : 'merge'), planOnly);
      if (!write || refuseChangedDocumentWrite(state, write, missingSourceSaveAs)) return;
      if (siteStorageAvailable()) {
        const choice = await askSiteSave({ defaultName: siteSaveDefaultName(state) });
        if (!choice) return;
        if (choice.kind === 'site') {
          siteName = choice.name;
          await saveAsNewSiteFile(state, write, choice.name, missingSourceSaveAs);
          return;
        }
      }
      const defaultName = state.filePath ?? `${suggestedFileBase(state)}.ifc`;
      // Met de flag ook een gewone planning: de toestemming van de kiezer hoort bij het gekozen doel en zijn gelezen
      // versie (fixronde 1 van #1071, A). Met de flag uit de route van main hieronder.
      if (isTauri() && (write.prepared || ifcForeignContentEnabled(state.ui.featureFlags))) {
        const saved = await saveAsOnDesktop(documentId, state, write, defaultName, missingSourceSaveAs);
        // Zie hieronder: een vervangen inhoud krijgt geen Recent (knownbug 1899).
        if (saved && sameDocumentContent(get(), snapshotContent(state))) await pushRecent(saved.outcome.ref, saved.outcome.name);
        return;
      }
      const outcome = await documentSaveDialog(state, write, defaultName, missingSourceSaveAs);
      if (!outcome) return;
      if (write.prepared && outcome.viaDownload) commitSavedDocument(snapshotContent(state), state);
      else commitSavedDocument(snapshotContent(state), state, localDestination(outcome), write.prepared, missingSourceSaveAs);
      if (!sameDocumentContent(get(), snapshotContent(state))) return;
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
    } catch (err) {
      if (siteName !== null) {
        notifySiteSaveError(err, siteName);
        return;
      }
      console.error('Save As failed:', err);
      get().notify(newTargetWriteNotice(err)
        ?? { severity: 'error', messageKey: 'notifications.saveFailed', detail: saveErrorDetail(err) });
    }
  };

  const waitingSaves = new Map<string, Promise<boolean>>();
  const saveActiveDocument = (expectedDocumentId?: string): Promise<boolean> => {
    if (siteQuestionOpen()) return Promise.resolve(false);
    const requested = documentContentOf(get(), expectedDocumentId ?? get().activeDocumentId);
    if (!requested) return Promise.resolve(false);
    const key = `${requested.id}\u0000${requested.content}`;
    const waiting = waitingSaves.get(key);
    if (waiting) return waiting;
    const forget = () => { if (waitingSaves.get(key) === save) waitingSaves.delete(key); };
    const save: Promise<boolean> = trackSave(requested, writeActiveDocument(requested, forget));
    waitingSaves.set(key, save);
    void save.then(forget, forget);
    return save;
  };

  const slice: FileSlice = {
    commitSavedDocument,
    applyProjectEdit: (parsed, opts) => get().applyLoadedProject(parsed, {
      intent: 'edit',
      recompute: true,
      viewStartDate: opts?.viewStartDate,
    }),

    applyLoadedProject: (parsed, opts) => {
      runtime.finishPendingTextEdits();
      const current = get();
      const editing = opts.intent === 'edit';
      const filePath = opts.filePath !== undefined ? opts.filePath : current.filePath;
      const { result: uniqueParsed, renamed: duplicateIds } = ensureUniqueImportIds(parsed);
      const payload = payloadFromImport(uniqueParsed, filePath);
      const replacesContent = !editing && payload.project.id !== current.project.id;
      const inheritsTarget = opts.filePath === undefined && opts.fileHandle === undefined && opts.siteFileId === undefined;
      const ownSource = payload.ifcSource;
      if (!payload.ifcSource && inheritsTarget) payload.ifcSource = current.ifcSource;
      if (editing) {
        payload.ifcLiteralCalendarIds = mergeLiteralCalendarIds(current.ifcLiteralCalendarIds, payload.ifcLiteralCalendarIds);
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
        payload.project = {
          ...payload.project,
          id: current.project.id,
          companyId: current.project.companyId,
          companyName: current.project.companyName,
        };
        payload.autoSaveToFile = current.autoSaveToFile;
      }
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
      payload.foreignSourceMark = ownSource
        ? foreignSourceMarkFor(ownSource, { filePath: payload.filePath, siteFileId: payload.siteFileId, fileHandle: payload.fileHandle })
        : inheritsTarget ? current.foreignSourceMark : null;
      const recordMark = !editing && !payload.foreignSourceMark ? foreignSourceMarkFromRecord(uniqueParsed.recoveryForeignSource) : null;
      if (recordMark) {
        payload.foreignSourceMark = ifcForeignContentEnabled(current.ui.featureFlags)
          ? { ...recordMark, sourceMissing: true } : recordMark;
        payload.filePath = null;
        payload.fileHandle = null;
        payload.siteFileId = null;
        payload.siteFileVersion = null;
      }
      if (!opts.linkedOpen && !editing) {
        payload.project = { ...payload.project, companyId: undefined, companyName: undefined };
        stripLibraryOrigins(payload);
        refreshProjectCalendarCache(payload);
      }
      const prepared = prepareLoadedPayload(payload, { recompute: !!opts.recompute });
      if (opts.recompute && !editing) {
        applyRecordedDatesOnLoad(payload.tasks, prepared, parsed);
      }
      const activation = materializeLibraryBoundary({
        payload: prepared,
        companies: current.companies,
        pools: current.pools,
        mode: opts.linkedOpen && !editing ? 'open-boundary' : 'silent-switch',
      });
      const conversion = opts.recompute && !editing
        ? minuteModelTransition(payload, activation.payload,
            captureRecordedDates(payload.tasks, parsed.recordedFields, parsed.recordedTimes))
        : null;
      if (conversion) activation.payload = conversion.after;
      if (ownSource && !editing && hasForeignContent(ownSource) && activation.payload.ifcSource === ownSource) {
        activation.payload = { ...activation.payload, ifcSource: { ...ownSource, opened: buildWriteIFCInput(activation.payload, 'merge') } };
      }
      set((s) => {
        clearRefusals(s.ui);
        if (editing) runtime.beginUndoable(s, { label: 'IFC toepassen' });
        else {
          removeSessionHistoryForDocumentFromState(s, s.activeDocumentId);
          if (replacesContent) replaceDocumentContent(s, s.activeDocumentId);
        }
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
      notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, activation.workRuleSettle);
      {
        const st = get();
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
      if (opts.fit) get().requestFitToProject();
      if (duplicateIds > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.duplicateIdsRenamed',
          params: { total: duplicateIds },
          dedupeKey: 'duplicate-ids-renamed',
          sticky: true,
        });
      }
      const dropped = expandSummaryRelations(parsed.tasks, parsed.sequences).droppedSequenceIds.length;
      if (dropped > 0) {
        get().notify({
          severity: 'info',
          messageKey: 'notifications.summaryRelationsDropped',
          params: { total: dropped },
          dedupeKey: 'summary-relations-dropped',
          sticky: true,
        });
      }
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
      let datesAsRecordedShownTotal = 0;
      let taskTypesUnlockedDocs = 0;
      let freshShownTotal = 0;
      for (const result of results) {
        if (!isActivePristine(get())) get().newDocument();
        openedDocumentIds.push(get().activeDocumentId);
        const conversion = get().applyLoadedProject(result, { ...opts, deferTaskTypesNotice: true });
        if (conversion && conversion.shifted.length > 0) {
          minuteModelConversions.push({ documentId: get().activeDocumentId,
            shifted: [...conversion.shifted], maxWorkdays: conversion.maxWorkdays });
        }
        const cur = get();
        if (cur.taskTypesVisible && !cur.ui.showTaskTypes
          && taskTypesNeedNotice(cur.tasks, cur.assignments, cur.project)
          && claimTaskTypesNotice(cur.activeDocumentId)) {
          taskTypesUnlockedDocs++;
        }
        const fresh = isFreshImportOrigin(get().recordedDates?.origin);
        if (get().datesAsRecorded) {
          const shown = get().recordedDates?.total ?? 0;
          datesAsRecordedShownTotal += shown;
          if (fresh) freshShownTotal += shown;
        }
      }

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
      if (notice && taskTypesUnlockedDocs > 0) {
        get().notify({ ...notice, detailLines: [...(notice.detailLines ?? []), TASK_TYPES_DETAIL_LINE] });
      } else if (notice) {
        get().notify(notice);
      } else if (taskTypesUnlockedDocs > 0) {
        notifyTaskTypesUnlockedClaimed(get().notify);
      }

      if (results.some(result => result.ifcLegacySchemaLoss)) {
        get().notify({ severity: 'info', sticky: true, messageKey: 'notifications.ifc2x3PlanningOnly' });
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
      const target = source.saveTarget === false
        ? { filePath: null, fileHandle: null, siteFileId: null }
        : saveTargetFor(readFormatForFile(source.name), source.ref, source.name);

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
        for (const notice of openFailureNotices(err)) get().notify(notice);
        return;
      }
      if (opened) await get().openOpenedFile(opened, labels);
    },

    openOpenedFile: async (opened, labels, options) => {
      try {
        for (const notice of remnantNotices(opened.replaceRemnants ?? [])) get().notify(notice);
        const parsed = await parseOpenedFile({ name: opened.name, text: opened.content, bytes: opened.bytes }, labels, formatReadOptions());
        if (!options?.restoringVerifiedIfcSource) refuseModelAboveOpenLimit(parsed);
        if (options?.waitWhile) {
          while (options.waitWhile()) await new Promise((resolve) => setTimeout(resolve, OPEN_WAIT_POLL_MS));
        }
        // In dezelfde synchrone stap: staat dit bestand nu al in een tabblad, dan dat tabblad (een startbestand, #1091).
        const existing = options?.existingDocument?.() ?? null;
        if (existing !== null) {
          get().switchDocument(existing);
          return;
        }
        if (options?.stale?.()) return;

        get().openAsDocument(parsed, { name: opened.name, ref: opened.ref });
        offerFormatNotice(opened.name, opened.content);

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

    exportAs: async (format: ExportFormat, options?: ExportOptions): Promise<ExportResult> => {
      if (format === 'ifc' && refuseForeignDocumentWrite()) return { ok: true, warnings: [], cancelled: true };
      if (get().scheduleStale) get().runCPM();
      const cpmFailure = get().cpmResult;
      if (cpmFailure?.error) return { ok: false, error: cpmFailure.error, errorInfo: cpmFailure.errorInfo };

      const state = get();
      const withoutModel = format === 'ifc' && options?.withoutBuildingModel === true;
      const planOnly = withoutModel ? await askPlanOnlyExport(state, 'export') : undefined;
      if (planOnly === null) return { ok: true, warnings: [], cancelled: true };
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

      let payload: string | Uint8Array;
      let preparedExport: PreparedIfcWrite | undefined;
      let ext: string;
      let p6Truncated = 0;
      let xerLoss: readonly XerWriteLoss[] | null = null;
      let invalidXmlChars = 0;
      let filters: { name: string; extensions: string[] }[];
      let mime: string | undefined;
      let nameOverride: string | undefined;
      let exportedLiteral: readonly string[] = [];

      switch (format) {
        case 'progress-xlsx': {
          const [{ default: i18n }, { buildProgressHeaderNotes, buildProgressSummaryNote, buildProgressXlsxValidationText }, { writeProgressSheetXLSX }] = await Promise.all([
            import('@/i18n/config'),
            import('@/i18n/progressHeaderNotes'),
            import('@/services/xlsx/writeProgressXlsx'),
          ]);
          const menuT: ImportLabelT = (key) => i18n.t(key, { ns: 'menu' });
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
          const hourSuffix = i18next.isInitialized
            ? i18next.t('duration.suffixHour', { ns: 'common' })
            : undefined;
          payload = writeCSV(
            state.project, state.calendar, state.tasks,
            state.sequences, state.resources, state.assignments, state.customTaskTypes,
            unrecordedExportGate(state.recordedDates, state.datesAsRecorded),
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
          {
            const written = await prepareAppIfcWrite(state, buildExportIFCInput(state, withoutModel ? 'planOnly' : 'merge'), planOnly);
            if (!written) return { ok: true, warnings: [], cancelled: true };
            preparedExport = written.prepared;
            payload = written.prepared ? written.prepared.bytes : writerData(written);
            exportedLiteral = written.literalCalendarIds;
          }
          ext = 'ifc';
          filters = [{ name: 'IFC Files', extensions: ['ifc'] }];
          break;
      }

      const defaultName = nameOverride ?? `${suggestedFileBase(state)}.${ext}`;
      // Het voortgangsblad opent waar mogelijk meteen in de downloadmap.
      // Fixronde 1 (BLOKKEERT 2): elk formaat weigert het bronbestand van een document met een vreemd deel. Een
      // IFC-export wacht op de schrijflock (hieronder): na de kiezer ook kijken of het document nog gelijk is, en
      // (knownbug 1896) vlak vóór de plaatsing (`exportTargetChecks`).
      const { refuseTarget, refuseBeforePlace } = ext === 'ifc'
        ? exportTargetChecks(state) : { refuseTarget: foreignTargetCheck(state.activeDocumentId), refuseBeforePlace: null };
      const refuseDownload = ext === 'ifc' ? () => refuseExportBeforePicker(state) : null;
      const dialogOpts = format === 'progress-xlsx'
        ? { preferDownloads: true, mime, refuseTarget, refuseDownload }
        : { refuseTarget, refuseDownload, refuseBeforePlace };
      const writeAndRecord = async () => {
        if (ext === 'ifc' && refuseExportBeforePicker(state)) return null;
        let written: SaveOutcome | null;
        try {
          written = preparedExport
            ? await saveNewBytesDialog(defaultName, preparedExport.bytes, filters, dialogOpts)
            : await saveDataDialog(defaultName, payload, filters, dialogOpts);
        } catch (error) {
          if (!preparedExport) throw error;
          get().notify(newTargetWriteNotice(error)
            ?? refusalNotice({ messageKey: 'notifications.saveFailed', dedupeKey: 'ifc-export-write-failed' }));
          return null;
        }
        if (written && !preparedExport && !planOnly) await recordOwnFileExport(state, written, exportedLiteral);
        if (written && ext === 'ifc' && exportContentReplaced(state)) return null;
        return written;
      };
      // Review #872 ronde 4 (Terra): een IFC-export kan het eigen bestand schrijven. Schrijven en vastleggen staan dan
      // onder dezelfde lock als Opslaan als; anders schreef AutoSave er tussendoor de ankertekst en markeerde hij het
      // document als opgeslagen (knownbug 1026). Elk ander formaat loopt door dezelfde rij (review ronde 6 van #1116):
      // CSV, MSPDI, P6 en XER opent de app ook, en een startbestand dat tijdens de export gelezen wordt, herkent een
      // nieuwere versie alleen aan een beurt in die rij; afsluiten en de updater wachten ook alleen op die rij.
      // In de laatste fase van afsluiten of van de updater (fixronde 1) schrijft een export niets, net als na annuleren.
      const outcome = await runProjectFileWrite(writeAndRecord, () => null);
      if (!outcome) return { ok: true, warnings: [], cancelled: true };
      if (exportGoesToRecents(format)) await pushRecent(outcome.ref, outcome.name);
      const buildingModel = format !== 'ifc' && ifcForeignContentEnabled(state.ui.featureFlags) && hasBuildingModel(state.ifcSource);
      const notices: (NotifyInput | null)[] = [downloadNotice(outcome)];
      try {
        const lossFormat = format === 'mspdi' ? 'MSPDI' : format.toUpperCase();
        const categories = warnings.flatMap(warning => warning.categories);
        const lossNotice = xerLoss ? exportXerLossNotice(xerLoss, categories)
          : format === 'p6' ? exportP6XmlLossNotice({
            project: state.project, calendars: [state.calendar, ...state.calendars.filter(cal => cal.id !== state.calendar.id)], tasks: state.tasks,
            sequences: state.sequences, resources: state.resources, assignments: state.assignments,
            baselineCount: state.baselines.length,
          }, categories) : null;
        if (xerLoss || format === 'p6') {
          notices.push(lossNotice);
        } else if (warnings.some(warning => warning.code === 'XER_ONLY_DATA_NOT_EXPRESSIBLE')) {
          notices.push({
            severity: 'info',
            messageKey: 'notifications.xerExportLoss',
            params: { format: lossFormat },
            dedupeKey: `xer-export-loss:${state.activeDocumentId}:${format}`,
            helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
          });
        } else if (warnings.some(warning => warning.code === 'EXPORT_DATA_NOT_EXPRESSIBLE')) {
          notices.push({
            severity: 'info',
            messageKey: 'notifications.exportDataLoss',
            params: { format: lossFormat },
            dedupeKey: `export-data-loss:${state.activeDocumentId}:${format}`,
            helpArticleId: EXPORT_LOSS_HELP_ARTICLE_ID,
          });
        }
        notices.push(exportSplitsLostNotice(format, state.tasks));
        notices.push(exportCostResourcesLostNotice(format, state.resources));
        notices.push(exportP6TruncatedNotice(format, p6Truncated));
        notices.push(exportInvalidXmlCharsNotice(format, invalidXmlChars));
        notices.push(exportCriticalHoursLostNotice(format, state.project));
        if (!lossNotice?.detailLines?.some(line => line.messageKey === 'notifications.exportXerLossItem.schedulingRules')) {
          notices.push(exportProfileNotice(format, state.project.schedulingProfile, name => (
            i18next.isInitialized ? i18next.t('profiles.modified', { ns: 'common', name }) : name)));
        }
      } finally {
        for (const notice of withPlanOnlyExportSentence(format, buildingModel, notices)) get().notify(notice);
      }
      return { ok: true, warnings };
    },

    recordLiteralCalendarsWritten: (documentId, ids) => {
      set((state) => {
        if (state.activeDocumentId === documentId) {
          state.ifcLiteralCalendarIds = mergeLiteralCalendarIds(state.ifcLiteralCalendarIds, ids);
          return;
        }
        const entry = state.documents.find(document => document.id === documentId);
        if (entry?.payload) entry.payload.ifcLiteralCalendarIds = mergeLiteralCalendarIds(entry.payload.ifcLiteralCalendarIds, ids);
      });
    },

    exportProjectWithPool: async (): Promise<ExportResult> => {
      if (refuseForeignDocumentWrite()) return { ok: true, warnings: [], cancelled: true };
      if (get().scheduleStale) get().runCPM();
      const cpmFailure = get().cpmResult;
      if (cpmFailure?.error) return { ok: false, error: cpmFailure.error, errorInfo: cpmFailure.errorInfo };

      const state = get();
      const planOnly = await askPlanOnlyExport(state, 'exportWithPool');
      if (planOnly === null) return { ok: true, warnings: [], cancelled: true };
      const project = await prepareAppIfcWrite(state, buildExportIFCInput(state, 'planOnly'), planOnly);
      if (!project || project.prepared) return { ok: true, warnings: [], cancelled: true };
      const projectData = writerData(project);
      const base = suggestedFileBase(state);
      const { refuseTarget, refuseBeforePlace } = exportTargetChecks(state);
      // Review #872 ronde 4 (Terra): schrijven en vastleggen onder dezelfde lock als Opslaan als (zie `exportAs`); ronde 5:
      // direct vóór de write kijken of het document nog gelijk is (`refuseExportBeforePicker`).
      const outcome = await runProjectFileWrite(async () => {
        if (refuseExportBeforePicker(state)) return null;
        const written = await saveDataDialog(`${base}.ifc`, projectData, IFC_FILE_FILTERS,
          { refuseTarget, refuseDownload: () => refuseExportBeforePicker(state), refuseBeforePlace });
        if (written && !planOnly) await recordOwnFileExport(state, written, project.literalCalendarIds);
        if (written && exportContentReplaced(state)) return null;
        return written;
      }, () => null);
      if (!outcome) return { ok: true, warnings: [], cancelled: true };
      await pushRecent(outcome.ref, outcome.name);
      noticeIfDownloaded(outcome);
      const companyId = state.project.companyId;
      if (!companyId) return { ok: true, warnings: [] };
      const poolContent = state.exportPoolIFC(companyId);
      if (!poolContent) return { ok: true, warnings: [] };
      const poolOutcome = await saveLibraryFile(`${base}-${exportFileSuffix('library')}.ifc`, poolContent);
      if (!poolOutcome) return { ok: true, warnings: [], cancelled: true };
      noticeIfDownloaded(poolOutcome);
      return { ok: true, warnings: [] };
    },

    foreignTargetCheck,

    exportLibrary: async (companyId) => {
      const company = get().companies.find(c => c.id === companyId);
      const content = get().exportPoolIFC(companyId);
      if (!company || !content) return;
      noticeIfDownloaded(await saveLibraryFile(`bibliotheek-${company.name}.ifc`, content));
    },

    recentFiles: [],
    recentFilesLoaded: false,

    hydrateRecentFiles: async () => {
      try {
        const list = await loadRecents();
        set((s) => { s.recentFiles = list; });
      } finally {
        set((s) => { s.recentFilesLoaded = true; });
      }
    },

    parseExternalSource: async (filePath: string, labels) => {
      if (!isTauri()) return null;
      try {
        const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
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
      const src = await readPreferringOpen({ kind: 'path', filePath }, labels, () => get().parseExternalSource(filePath, labels));
      if (!src) return null;
      if (get().activeDocumentId !== targetDocumentId) return { refreshed: 0, missing: 0 };
      const result = refreshExternalAnchors(get().tasks, src);
      if (result.changed) applyRefreshedTasks(targetDocumentId, result.tasks);
      const key = normalizeExternalSourcePath(filePath);
      if (key !== null) dropSourceUpdates(targetDocumentId, new Set([key]));
      announceUnsavedOpenSources(targetDocumentId, [{ kind: 'path', filePath }]);
      return { refreshed: result.refreshed, missing: result.missing };
    },

    refreshExternalProjectAnchors: async (taskId, linkId, labels) => {
      if (isTauri() || siteStorageAvailable()) return null;
      const { activeDocumentId: documentId, tasks: tasksAtStart } = get();
      const findLink = (tasks: Task[]) => tasks.find(task => task.id === taskId)?.externalLinks?.find(link => link.id === linkId);
      const selected = findLink(tasksAtStart);
      const locator = selected ? externalSourceLocatorOf(selected.sourceRef) : null;
      if (locator?.kind !== 'project') return null;
      const { projectId } = locator;
      const key = externalSourceKey(locator)!;
      const generation = sourceGeneration(documentId, key);
      const src = await readPreferringOpen(locator, labels,
        () => get().parseExternalProjectSource(projectId, { prompt: true }, labels));
      if (!src || src.projectId !== projectId || src.filePath || src.siteFileId) return null;
      const current = get();
      if (current.activeDocumentId !== documentId || findLink(current.tasks) !== selected
        || sourceGeneration(documentId, key) !== generation) return null;
      const scope = externalSourceScopeOf(locator);
      if (current.tasks !== tasksAtStart) {
        const linksAtStart = new Set(tasksAtStart.flatMap(task => task.externalLinks ?? []));
        if (current.tasks.some(task => task.externalLinks?.some(link =>
          !linksAtStart.has(link) && linkMatchesSource(link, src, scope)))) return null;
      }
      const result = refreshExternalAnchors(current.tasks, src, scope);
      if (result.changed) applyRefreshedTasks(documentId, result.tasks);
      dropSourceUpdates(documentId, new Set([key]));
      announceUnsavedOpenSources(documentId, [locator]);
      return { refreshed: result.refreshed, missing: result.missing };
    },

    checkExternalSources: async (labels) => {
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
      if (update.proposal !== undefined) settledProposals.set(sourceKey(documentId, key), update.proposal);
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
      for (const [index, source] of sourceDocs.entries()) {
        const locator: ExternalSourceLocator = { kind: 'project', projectId: source.projectId };
        sourceDocs[index] = await readPreferringOpen(locator, labels, async () => source) ?? source;
      }
      const readProjectIds = [...new Set(sourceDocs.map(source => source.projectId))];
      if (get().activeDocumentId !== targetDocumentId) return { refreshed: 0, missing: 0, sources: 0, unmatched, readProjectIds: [] };
      const { tasks, refreshed, missing, changed } = refreshFromSources(get().tasks, sourceDocs);
      if (changed) applyRefreshedTasks(targetDocumentId, tasks);
      dropSourceUpdates(targetDocumentId, new Set(readProjectIds.map(projectId => externalSourceKey({ kind: 'project', projectId })!)));
      announceUnsavedOpenSources(targetDocumentId, sourceDocs.map(source => ({ kind: 'project', projectId: source.projectId })));
      return { refreshed, missing, sources: sourceDocs.length, unmatched, readProjectIds };
    },

    refreshAllExternalAnchors: async (labels) => {
      const targetDocumentId = get().activeDocumentId;
      const paths = new Map<string, string>();
      let unusablePathCount = 0;
      const projectIds = new Set<string>();
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

      const sourceDocs: ExternalSourceDoc[] = [];
      const readPaths = new Set<string>();
      let unread = 0;
      const readKeys = new Set<string>();
      const unreadProjectIds: string[] = [];
      const savedProjectIds = [...projectIds].filter(projectId => !openDirtySource({ kind: 'project', projectId }));
      const projectSources = savedProjectIds.length > 0
        ? await get().readExternalProjectSources(savedProjectIds, labels)
        : new Map<string, ExternalSourceRead | null>();
      const projectDocs: ExternalSourceDoc[] = [];
      const readSources: ExternalSourceLocator[] = [];
      for (const projectId of projectIds) {
        const locator: ExternalSourceLocator = { kind: 'project', projectId };
        const src = await readPreferringOpen(locator, labels, async () => projectSources.get(projectId) ?? null);
        if (!src) { unread++; unreadProjectIds.push(projectId); continue; }
        projectDocs.push(src);
        readSources.push(locator);
        readKeys.add(externalSourceKey(locator)!);
      }
      for (const [normalized, p] of paths) {
        const locator: ExternalSourceLocator = { kind: 'path', filePath: p };
        const src = await readPreferringOpen(locator, labels, () => get().parseExternalSource(p, labels));
        if (!src) { unread++; continue; }
        sourceDocs.push(src);
        readPaths.add(normalized);
        readSources.push(locator);
      }
      for (const path of readPaths) readKeys.add(path);
      sourceDocs.push(...projectDocs);
      for (const siteFileId of siteFileIds) {
        const locator: ExternalSourceLocator = { kind: 'site', siteFileId };
        const src = await readPreferringOpen(locator, labels, () => get().parseExternalSiteSource(siteFileId, labels));
        if (!src) { unread++; continue; }
        sourceDocs.push(src);
        readKeys.add(externalSourceKey(locator)!);
        readSources.push(locator);
      }

      if (get().activeDocumentId !== targetDocumentId) {
        return { refreshed: 0, missing: 0, sources: sourceDocs.length, unread, unreadProjectIds };
      }

      const result = refreshFromSources(get().tasks, sourceDocs, readPaths);
      const { tasks, refreshed, changed: anyChanged } = result;
      const missing = unusablePathCount + result.missing;

      if (anyChanged) applyRefreshedTasks(targetDocumentId, tasks);
      dropSourceUpdates(targetDocumentId, readKeys);
      announceUnsavedOpenSources(targetDocumentId, readSources);
      return { refreshed, missing, sources: sourceDocs.length, unread, unreadProjectIds };
    },

    readExternalSourceUpdate: async (update, labels) => {
      if (update.openDocumentId === undefined) return get().readExternalSourceAt(update.locator, labels);
      const open = openDirtySource(update.locator);
      return open?.id === update.openDocumentId ? readOpenSource(open, update.locator, labels) : null;
    },

    openRecentFile: async (id: string, labels) => {
      const entry = get().recentFiles.find((e) => e.id === id);
      if (!entry) return;
      if (entry.ref.kind === 'site') {
        await openRecentSiteFile(entry, labels);
        return;
      }
      try {
        const readOptions = formatReadOptions();
        const isBinary = readsAsBytes(entry.name, readOptions);
        let opened: OpenedFile;
        if (entry.ref.kind === 'path' && isTauri()) {
          opened = { ...await readOpenedPath(entry.ref.path, isBinary), name: entry.name };
        } else {
          const content = isBinary ? null : await readFromRef(entry.ref);
          const bytes = isBinary ? await readBytesFromRef(entry.ref) : null;
          if (isBinary ? bytes === null : content === null) {
            get().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: entry.name });
            return;
          }
          opened = { name: entry.name, content: content ?? '', ...(bytes ? { bytes } : {}), ref: entry.ref };
        }
        await get().openOpenedFile(opened, labels);
      } catch (err) {
        console.error('Failed to open recent file:', err);
        for (const notice of openFailureNotices(err)) get().notify(notice);
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
        const parsed = await readIfcFromText(content, labels, formatReadOptions());

        if (!isActivePristine(get())) get().newDocument();

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
        get().notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: saveErrorDetail(err) });
        return false;
      }
    },
  };
  return {
    ...slice,
    exportAs: (format, options) => format === 'ifc'
      ? withIfcExportPriority(() => slice.exportAs(format, options)) : slice.exportAs(format, options),
    exportProjectWithPool: () => withIfcExportPriority(slice.exportProjectWithPool),
  };
};
