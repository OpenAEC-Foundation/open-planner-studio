import { assertMinuteModelTaskDates } from './migrations/minuteModel';
import { documentDataFromImport } from '@/services/documentData';
import type { Project } from '@/types/project';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { ActivityCodeType, CustomFieldDef } from '@/types/structure';
import type { CustomTaskType } from '@/types/taskType';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import { normalizeComparedBaselines, noComparedBaselines, type Baseline, type ComparedBaselineIds } from '@/types/baseline';
export { isFreshImportOrigin } from '@/services/documentData';
import type { ImportResult } from '@/services/importTypes';
import type { XerArchiveIssue, XerImportMetadata } from '@/services/importTypes';
import type { XerSourceArchive } from '@/services/xerSourceArchive';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import type { ForeignSourceMark, ForeignSourceTarget } from '@/services/ifc/foreign/foreignSourceMark';
import { foreignSourceMarkFor, foreignSourceMarkFromRecovery } from '@/services/ifc/foreign/foreignSourceMark';
import type { ColumnConfig, ViewState } from './slices/types';
import type { AppState } from './appStore';
import { createDefaultProject } from './defaults';
import { projectForIfcx } from './ifcSchemaChoice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultView } from './defaults';
import { syncProjectCalendar, promoteProjectCalendarToLibrary } from './syncProjectCalendar';
import { normalizeTaskDurationUnits } from '@/utils/taskDefaults';

export interface DocumentPayload {
  project: Project;
  calendar: WorkCalendar;
  tasks: Task[];
  sequences: Sequence[];
  resources: Resource[];
  assignments: ResourceAssignment[];
  calendars: WorkCalendar[];
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  customTaskTypes: CustomTaskType[];
  selectedTaskIds: string[];
  activeTaskId: string | null;
  cpmResult: CPMResult | null;
  resourceLoadResult: ResourceLoadResult | null;
  scheduleStale: boolean;
  recordedDates: RecordedDatesState | null;
  datesAsRecorded: boolean;
  minuteModelPending: boolean;
  baselines: Baseline[];
  activeBaselineId: string | null;
  comparedBaselineIds: ComparedBaselineIds;
  view: ViewState;
  collapsedTaskIds: string[];
  filePath: string | null;
  fileHandle: FileSystemFileHandle | null;
  siteFileId: string | null;
  siteFileVersion: string | null;
  knownTargetFingerprint: TargetFingerprint | null;
  fileFormat: DocumentFileFormat;
  autoSaveToFile: boolean;
  isDirty: boolean;
  xerImportMetadata: XerImportMetadata | null;
  xerSourceArchive: XerSourceArchive | null;
  xerSourceProjectId: string | null;
  ifcSource: IfcSource | null;
  ifcxReferences: import('@/services/ifc/ifcx/modelReferences').IfcxModelReferences | null;
  foreignSourceMark: ForeignSourceMark | null;
  taskTypesVisible: boolean;
  importPristine: boolean;
  xerArchiveIssue: XerArchiveIssue | null;
  ifcGlobalIds: Readonly<Record<string, string>> | null;
  ifcLiteralCalendarIds: string[] | null;
}

export interface TargetFingerprint {
  readonly sha256: string;
  readonly byteLength: number;
  readonly origin: 'opened' | 'written';
  readonly utf8Bom?: true;
}

export type DocumentFileFormat = 'ifc' | 'ifcx';

export interface RecoveryIfcxMark {
  readonly known: TargetFingerprint | null;
}

export type RecoveryDocInput = ImportResult & {
  sourceRestored?: true;
  fileHandle?: FileSystemFileHandle | null;
  id: string;
  filePath: string | null;
  siteFileId?: string | null;
  siteFileVersion?: string | null;
  foreignSource?: ForeignSourceTarget | null;
  isDirty: boolean;
  datesAsRecorded: boolean;
  ifcx?: RecoveryIfcxMark;
};

export interface RecoveryDocMeta {
  id: string;
  filePath: string | null;
  siteFileId?: string | null;
  siteFileVersion?: string | null;
  foreignSource?: ForeignSourceTarget | null;
  isDirty: boolean;
  datesAsRecorded: boolean;
  ifcx?: RecoveryIfcxMark;
}

export function recoveryInputFromParsed(parsed: ImportResult, meta: RecoveryDocMeta): RecoveryDocInput {
  return { ...parsed, ...meta };
}

export type SnapshotRole =
  | 'data'
  | 'derived'
  | 'none';

interface FieldDesc<K extends keyof DocumentPayload, R extends SnapshotRole = SnapshotRole> {
  readonly key: K;
  readonly get: (s: AppState) => DocumentPayload[K];
  readonly set: (s: AppState, v: DocumentPayload[K]) => void;
  readonly fresh: () => DocumentPayload[K];
  readonly snapshot: R;
  readonly fromPayload?: (p: DocumentPayload) => DocumentPayload[K];
}

function field<K extends keyof DocumentPayload, R extends SnapshotRole>(d: FieldDesc<K, R>): FieldDesc<K, R> {
  return d;
}

export function normalizeView(v: ViewState): ViewState {
  const legacyGroupBy = (v as ViewState & { groupBy?: string }).groupBy;
  const group = v.group && v.group.length > 0
    ? v.group
    : legacyGroupBy
      ? [{ field: { src: 'activityCode' as const, typeId: legacyGroupBy }, dir: 'asc' as const }]
      : [];
  const out: ViewState & { groupBy?: string; columns?: unknown } = {
    ...v,
    filter: v.filter ?? null,
    group,
    sort: v.sort ?? [],
    collapsedGroupKeys: v.collapsedGroupKeys ?? [],
  };
  delete out.groupBy;
  delete out.columns;
  return out;
}

export const DOCUMENT_FIELDS = [
  field({
    key: 'project', get: (s) => s.project, set: (s, v) => { s.project = v; }, fresh: createDefaultProject, snapshot: 'data',
    fromPayload: (p) => p.fileFormat === 'ifcx' ? projectForIfcx(p.project) : p.project,
  }),
  field({ key: 'calendar', get: (s) => s.calendar, set: (s, v) => { s.calendar = v; }, fresh: createDefaultCalendar, snapshot: 'data' }),
  field({
    key: 'tasks', get: (s) => s.tasks, set: (s, v) => { s.tasks = v; }, fresh: () => [], snapshot: 'data',
    fromPayload: (p) => normalizeTaskDurationUnits(p.tasks ?? []),
  }),
  field({ key: 'sequences', get: (s) => s.sequences, set: (s, v) => { s.sequences = v; }, fresh: () => [], snapshot: 'data' }),
  field({ key: 'resources', get: (s) => s.resources, set: (s, v) => { s.resources = v; }, fresh: () => [], snapshot: 'data' }),
  field({ key: 'assignments', get: (s) => s.assignments, set: (s, v) => { s.assignments = v; }, fresh: () => [], snapshot: 'data' }),
  field({
    key: 'calendars', get: (s) => s.calendars, set: (s, v) => { s.calendars = v; }, fresh: () => [], snapshot: 'data',
    fromPayload: (p) => p.calendars ?? (p as { resourceCalendars?: WorkCalendar[] }).resourceCalendars ?? [],
  }),
  field({ key: 'activityCodeTypes', get: (s) => s.activityCodeTypes, set: (s, v) => { s.activityCodeTypes = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.activityCodeTypes ?? [] }),
  field({ key: 'customFieldDefs', get: (s) => s.customFieldDefs, set: (s, v) => { s.customFieldDefs = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.customFieldDefs ?? [] }),
  field({ key: 'customTaskTypes', get: (s) => s.customTaskTypes, set: (s, v) => { s.customTaskTypes = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.customTaskTypes ?? [] }),
  field({ key: 'selectedTaskIds', get: (s) => s.selectedTaskIds, set: (s, v) => { s.selectedTaskIds = v; }, fresh: () => [], snapshot: 'none' }),
  field({ key: 'activeTaskId', get: (s) => s.activeTaskId, set: (s, v) => { s.activeTaskId = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.activeTaskId ?? null }),
  field({ key: 'cpmResult', get: (s) => s.cpmResult, set: (s, v) => { s.cpmResult = v; }, fresh: () => null, snapshot: 'derived' }),
  field({ key: 'resourceLoadResult', get: (s) => s.resourceLoadResult, set: (s, v) => { s.resourceLoadResult = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.resourceLoadResult ?? null }),
  field({ key: 'scheduleStale', get: (s) => s.scheduleStale, set: (s, v) => { s.scheduleStale = v; }, fresh: () => false, snapshot: 'derived', fromPayload: (p) => p.scheduleStale ?? false }),
  field({ key: 'recordedDates', get: (s) => s.recordedDates, set: (s, v) => { s.recordedDates = v; }, fresh: () => null, snapshot: 'derived', fromPayload: (p) => p.recordedDates ?? null }),
  field({ key: 'datesAsRecorded', get: (s) => s.datesAsRecorded, set: (s, v) => { s.datesAsRecorded = v; }, fresh: () => false, snapshot: 'derived', fromPayload: (p) => p.datesAsRecorded ?? false }),
  field({ key: 'minuteModelPending', get: (s) => s.minuteModelPending, set: (s, v) => { s.minuteModelPending = v; }, fresh: () => false, snapshot: 'derived', fromPayload: (p) => p.minuteModelPending ?? false }),
  field({ key: 'baselines', get: (s) => s.baselines, set: (s, v) => { s.baselines = v; }, fresh: () => [], snapshot: 'data', fromPayload: (p) => p.baselines ?? [] }),
  field({ key: 'activeBaselineId', get: (s) => s.activeBaselineId, set: (s, v) => { s.activeBaselineId = v; }, fresh: () => null, snapshot: 'data', fromPayload: (p) => p.activeBaselineId ?? null }),
  field({ key: 'comparedBaselineIds', get: (s) => s.comparedBaselineIds, set: (s, v) => { s.comparedBaselineIds = v; }, fresh: noComparedBaselines, snapshot: 'data', fromPayload: (p) => normalizeComparedBaselines(p.comparedBaselineIds, p.baselines ?? [], p.activeBaselineId ?? null) }),
  field({ key: 'view', get: (s) => s.view, set: (s, v) => { s.view = v; }, fresh: createDefaultView, snapshot: 'none', fromPayload: (p) => normalizeView(p.view) }),
  field({ key: 'collapsedTaskIds', get: (s) => s.ui.collapsedTaskIds, set: (s, v) => { s.ui.collapsedTaskIds = v; }, fresh: () => [], snapshot: 'none' }),
  field({ key: 'filePath', get: (s) => s.filePath, set: (s, v) => { s.filePath = v; }, fresh: () => null, snapshot: 'none' }),
  field({ key: 'fileHandle', get: (s) => s.fileHandle, set: (s, v) => { s.fileHandle = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.fileHandle ?? null }),
  field({ key: 'siteFileId', get: (s) => s.siteFileId, set: (s, v) => { s.siteFileId = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.siteFileId ?? null }),
  field({ key: 'siteFileVersion', get: (s) => s.siteFileVersion, set: (s, v) => { s.siteFileVersion = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.siteFileVersion ?? null }),
  field({ key: 'knownTargetFingerprint', get: (s) => s.knownTargetFingerprint, set: (s, v) => { s.knownTargetFingerprint = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.knownTargetFingerprint ?? null }),
  field({ key: 'fileFormat', get: (s) => s.fileFormat, set: (s, v) => { s.fileFormat = v; }, fresh: (): DocumentFileFormat => 'ifc', snapshot: 'none', fromPayload: (p) => p.fileFormat ?? 'ifc' }),
  field({ key: 'autoSaveToFile', get: (s) => s.autoSaveToFile, set: (s, v) => { s.autoSaveToFile = v; }, fresh: () => false, snapshot: 'none', fromPayload: (p) => p.autoSaveToFile ?? false }),
  field({ key: 'isDirty', get: (s) => s.isDirty, set: (s, v) => { s.isDirty = v; }, fresh: () => false, snapshot: 'none' }),
  field({ key: 'xerImportMetadata', get: (s) => s.xerImportMetadata, set: (s, v) => { s.xerImportMetadata = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.xerImportMetadata ?? null }),
  field({ key: 'xerSourceArchive', get: (s) => s.xerSourceArchive, set: (s, v) => { s.xerSourceArchive = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.xerSourceArchive ?? null }),
  field({ key: 'xerSourceProjectId', get: (s) => s.xerSourceProjectId, set: (s, v) => { s.xerSourceProjectId = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.xerSourceProjectId ?? null }),
  field({ key: 'ifcSource', get: (s) => s.ifcSource, set: (s, v) => { s.ifcSource = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.ifcSource ?? null }),
  field({ key: 'ifcxReferences', get: (s) => s.ifcxReferences, set: (s, v) => { s.ifcxReferences = v; }, fresh: () => null, snapshot: 'data', fromPayload: p => p.ifcxReferences ?? null }),
  field({ key: 'foreignSourceMark', get: (s) => s.foreignSourceMark, set: (s, v) => { s.foreignSourceMark = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.foreignSourceMark ?? null }),
  field({ key: 'taskTypesVisible', get: (s) => s.taskTypesVisible, set: (s, v) => { s.taskTypesVisible = v; }, fresh: () => false, snapshot: 'none', fromPayload: (p) => p.taskTypesVisible ?? false }),
  field({ key: 'importPristine', get: (s) => s.importPristine, set: (s, v) => { s.importPristine = v; }, fresh: () => false, snapshot: 'none', fromPayload: (p) => p.importPristine ?? false }),
  field({ key: 'xerArchiveIssue', get: (s) => s.xerArchiveIssue, set: (s, v) => { s.xerArchiveIssue = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.xerArchiveIssue ?? null }),
  field({ key: 'ifcGlobalIds', get: (s) => s.ifcGlobalIds, set: (s, v) => { s.ifcGlobalIds = v; }, fresh: () => null, snapshot: 'data', fromPayload: (p) => p.ifcGlobalIds ?? null }),
  field({ key: 'ifcLiteralCalendarIds', get: (s) => s.ifcLiteralCalendarIds, set: (s, v) => { s.ifcLiteralCalendarIds = v; }, fresh: () => null, snapshot: 'none', fromPayload: (p) => p.ifcLiteralCalendarIds ?? null }),
];

type CoveredKey = typeof DOCUMENT_FIELDS[number]['key'];
type MissingFields = Exclude<keyof DocumentPayload, CoveredKey>;
const _assertAllFieldsCovered: MissingFields extends never ? true : ['DOCUMENT_FIELDS mist velden:', MissingFields] = true;
void _assertAllFieldsCovered;

type StateDataKey<T> = { [K in keyof T]-?: T[K] extends (...a: never[]) => unknown ? never : K }[keyof T];

type AppGlobalKey =
  | 'ui'
  | 'taskClipboard'
  | 'recentFiles'
  | 'recentFilesLoaded'
  | 'documents' | 'activeDocumentId'
  | 'historyEvents' | 'nextHistorySequence'
  | 'scheduleShift'
  | 'installedExtensions' | 'quarantinedExtensions' | 'extensionRibbonButtons' | 'extensionImporters'
  | 'catalogEntries' | 'catalogIssues' | 'catalogLoading' | 'catalogError' | 'catalogLastFetched'
  | 'companies' | 'defaultCompanyId' | 'pools' | 'libraryLoaded'
  | 'taskGridSurfaces' | 'recentTaskColumns' | 'taskGridAutoWriteAllowed';

type DerivedKey = 'viewRows';

type Unclassified = Exclude<StateDataKey<AppState>, keyof DocumentPayload | AppGlobalKey | DerivedKey>;
const _assertNoUnclassifiedState: Unclassified extends never ? true : [
  'Nieuw state-veld zonder keuze. Zet het in DocumentPayload (per document), in AppGlobalKey (gedeeld) of in DerivedKey (herberekend):',
  Unclassified,
] = true;
void _assertNoUnclassifiedState;

type TaskGridContractMutationFixture = AppState & { __taskGridContractMutationFixture: string };
type FixtureUnclassified = Exclude<
  StateDataKey<TaskGridContractMutationFixture>,
  keyof DocumentPayload | AppGlobalKey | DerivedKey
>;
const _assertMutationFixtureIsCaught: FixtureUnclassified extends '__taskGridContractMutationFixture'
  ? true
  : ['Mutatiefixture werd niet als ongeclassificeerd stateveld gevangen:', FixtureUnclassified] = true;
void _assertMutationFixtureIsCaught;

type StaleClassification = Exclude<AppGlobalKey | DerivedKey, StateDataKey<AppState>>;
const _assertNoStaleClassification: StaleClassification extends never ? true : [
  'Geclassificeerd veld bestaat niet (meer) in AppState:',
  StaleClassification,
] = true;
void _assertNoStaleClassification;

type AnyField = typeof DOCUMENT_FIELDS[number];
function readField(f: AnyField, s: AppState): unknown {
  return f.get(s);
}
function writeField(f: AnyField, s: AppState, v: unknown): void {
  (f.set as (s: AppState, v: unknown) => void)(s, v);
}

export function capturePayload(s: AppState): DocumentPayload {
  const out: Record<string, unknown> = {};
  for (const f of DOCUMENT_FIELDS) out[f.key] = readField(f, s);
  return out as unknown as DocumentPayload;
}

export function hydratePayload(s: AppState, p: DocumentPayload): void {
  const raw = p as unknown as Record<string, unknown>;
  s.stageLegacyTaskGridColumns(p.project.id,
    (p.view as ViewState & { columns?: ColumnConfig[] }).columns);
  for (const f of DOCUMENT_FIELDS) {
    writeField(f, s, f.fromPayload ? f.fromPayload(p) : raw[f.key]);
  }
  promoteProjectCalendarToLibrary(s);
  syncProjectCalendar(s);
  if (import.meta.env?.DEV) assertMinuteModelTaskDates(s.tasks);
}

export function freshPayload(): DocumentPayload {
  const out: Record<string, unknown> = {};
  for (const f of DOCUMENT_FIELDS) out[f.key] = f.fresh();
  return out as unknown as DocumentPayload;
}

const restoredMark = (mark: ForeignSourceMark | null): ForeignSourceMark | null => mark && { ...mark, sourceMissing: mark.sourceMissing !== false };

export function payloadFromInput(d: RecoveryDocInput): DocumentPayload {
  const siteFileId = d.siteFileId ?? null;
  return {
    ...payloadFromImport(d, d.filePath),
    foreignSourceMark: d.sourceRestored
      ? foreignSourceMarkFor(d.ifcSource, { filePath: d.filePath, siteFileId, fileHandle: d.fileHandle ?? null })
      : restoredMark(foreignSourceMarkFromRecovery(d.recoveryForeignSource, d.foreignSource)),
    fileHandle: d.sourceRestored ? d.fileHandle ?? null : null,
    siteFileId,
    siteFileVersion: siteFileId ? d.siteFileVersion ?? null : null,
    ...(d.ifcx ? { fileFormat: 'ifcx' as const, knownTargetFingerprint: siteFileId ? null : d.ifcx.known } : {}),
    isDirty: d.isDirty,
    scheduleStale: true,
  };
}


export function payloadFromImport(parsed: ImportResult, filePath: string | null): DocumentPayload {
  return { ...freshPayload(), ...documentDataFromImport(parsed), filePath, isDirty: false };
}
