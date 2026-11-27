import { SCHEDULE_SHIFT_NOTICE_KEY } from '../scheduleShift';
import type { PreparedIfcWrite } from '@/services/ifc/foreign/ifcSource';
import { minuteModelTransition, minuteModelNotice, recordMinuteModelTransition, type MinuteModelTransition } from '../minuteModelTransition';
import { captureRecordedDates } from '@/engine/scheduler/recordedDates';
import { castDraft } from 'immer';
import type { AppState } from '../appStore';
import type { AppSliceFactory } from './types';
import { generateId } from '@/utils/id';
import {
  capturePayload,
  hydratePayload,
  freshPayload,
  payloadFromInput,
  type DocumentPayload,
  type TargetFingerprint,
  type RecoveryDocInput,
} from '../documentContract';
import { HOST_EVENTS } from '@/services/extensionEvents';
import { whenProjectFileWritesIdle } from '@/services/fileAccess/writeCoordinator';
import { documentTitle, untitledOrdinals } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import type { XerImportMetadata, XerResourceMetadata } from '@/services/importTypes';
import {
  bindXerImportMetadataToArchive,
  XerSourceArchiveValidationError,
  type XerSourceArchive,
} from '@/services/xerSourceArchive';
import {
  invalidateDocumentRedo,
  removeSessionHistoryForDocumentFromState,
  replaceSessionHistoryState,
} from '../sessionHistory';
import {
  applyRecordedDatesOnLoad,
  applyRestoredRecordedMode,
  materializeLibraryBoundary,
  prepareLoadedPayload,
  type DocumentActivationMaterialization,
} from '../documentActivation';
import type { IFCSaveSource } from '../ifcSaveInput';
import { withXerArchiveIssueNotice } from '../xerArchiveIssueNotice';
import { scheduleFailedNotice } from '../scheduleErrorNotice';
import { clearRefusals } from '../refusalNotice';
import type { DocumentContentRef, DocumentSaveState } from '../documentSaveState';
import {
  mergeCalendarLibrarySettle, notifyCalendarLibrarySettle, NO_CALENDAR_LIBRARY_SETTLE, type CalendarLibrarySettle,
} from '../calendarTasks';

export type { DocumentPayload, RecoveryDocInput } from '../documentContract';

export interface DocumentEntry {
  id: string;
  payload: DocumentPayload | null;
  pendingWorkRuleSettle?: CalendarLibrarySettle;
  saveState?: DocumentSaveState;
  content?: number;
  changedOnDisk?: true;
}

function resetDocumentScopedUI(s: AppState): void {
  s.ui.showTaskDialog = false;
  s.ui.editingTaskId = null;
  s.ui.selectionAnchor = null;
  s.ui.pendingRelationAssign = null;
  s.ui.showLibraryLinkDialog = false;
  s.ui.libraryRefreshNotice = null;
  s.ui.showProgressImportDialog = false;
  s.ui.pendingPhaseAssignmentQuestion = null;
  clearRefusals(s.ui);
  s.scheduleShift = null;
  s.ui.notifications = s.ui.notifications.filter(n => n.dedupeKey !== SCHEDULE_SHIFT_NOTICE_KEY);
}

function publishActivation(s: AppState, activation: DocumentActivationMaterialization): void {
  hydratePayload(s, activation.payload);
  s.viewRows = [...activation.viewRows];
  s.resourceLoadResult = activation.resourceLoadResult;
  s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
  s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
}

function announceWorkRuleSettle(
  notify: AppState['notify'],
  documentId: string,
  entry: Pick<DocumentEntry, 'pendingWorkRuleSettle'> | null,
  activation: DocumentActivationMaterialization,
): void {
  const pending = entry?.pendingWorkRuleSettle ?? NO_CALENDAR_LIBRARY_SETTLE;
  notifyCalendarLibrarySettle(notify, documentId, mergeCalendarLibrarySettle(pending, activation.workRuleSettle));
}

export interface DocumentInfo {
  id: string;
  title: string;
  isDirty: boolean;
  isActive: boolean;
  untitledOrdinal?: number;
}

export interface DocumentSlice {
  documents: DocumentEntry[];
  activeDocumentId: string;
  newDocument: () => string;
  duplicateDocument: (name?: string) => string;
  switchDocument: (id: string) => void;
  closeDocument: (id: string, options?: { onlyIfClean?: boolean }) => boolean;
  waitForSavesBeforeClose: () => Promise<void> | null;
  requestCloseDocument: (id: string) => void;
  closeDocumentAfterSaves: (id: string, options?: { onlyIfClean?: boolean }) => Promise<boolean>;
  getOpenDocuments: () => DocumentInfo[];
  getOpenDocumentPayloads: () => { id: string; payload: DocumentPayload }[];
  restoreDocuments: (docs: RecoveryDocInput[], activeId: string | null) => { skippedIds: string[] };
  recalculateStaleSleepingDocuments: () => number;
  setAutoSaveToFile: (enabled: boolean) => void;
  markAutoSaveVersionSaved: (document: DocumentContentRef, source: IFCSaveSource, prepared?: PreparedIfcWrite, written?: TargetFingerprint | null, writtenName?: string) => void;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function cloneXerResourceMetadata(source: XerResourceMetadata): XerResourceMetadata {
  return {
    catalog: source.catalog,
    assignments: source.assignments.map(assignment => ({
      ...assignment,
      entity: { ...assignment.entity },
      ...(assignment.assignedRole ? { assignedRole: { ...assignment.assignedRole } } : {}),
      quantities: { ...assignment.quantities },
      rawCurves: { ...assignment.rawCurves },
      costs: { ...assignment.costs },
    })),
    issues: source.issues.map(issue => ({ ...issue })),
  };
}

function cloneXerImportMetadata(
  source: XerImportMetadata,
  archive: XerSourceArchive | null,
): XerImportMetadata {
  if (archive && source.sourceProjectId) {
    return bindXerImportMetadataToArchive(archive, source.sourceProjectId);
  }
  const { resources, metadata, ...withoutCatalogs } = source;
  const clone = deepClone(withoutCatalogs);
  return {
    ...clone,
    ...(resources ? { resources: cloneXerResourceMetadata(resources) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function shareRecoveredXerArchives(docs: readonly RecoveryDocInput[]): RecoveryDocInput[] {
  const canonicalByDigest = new Map<string, XerSourceArchive[]>();
  const metadataCache = new WeakMap<XerSourceArchive, string>();
  const canonicalMetadata = (archive: XerSourceArchive): string => {
    const cached = metadataCache.get(archive);
    if (cached !== undefined) return cached;
    const stable = (value: unknown): string => {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(',')}}`;
    };
    const result = stable({ diagnostics: archive.diagnostics, readModel: archive.readModel });
    metadataCache.set(archive, result);
    return result;
  };
  const sameArchive = (left: XerSourceArchive, right: XerSourceArchive): boolean =>
    left.schemaVersion === right.schemaVersion
    && left.format === right.format
    && left.byteLength === right.byteLength
    && left.sha256 === right.sha256
    && left.encoding === right.encoding
    && left.bom === right.bom
    && left.newline === right.newline
    && left.byteChunks.length === right.byteChunks.length
    && left.byteChunks.every((chunk, index) => chunk === right.byteChunks[index])
    && canonicalMetadata(left) === canonicalMetadata(right);
  const bindDocumentToArchive = (
    doc: RecoveryDocInput,
    archive: XerSourceArchive,
  ): RecoveryDocInput => {
    const selector = doc.xerSourceProjectId ?? doc.xer?.sourceProjectId;
    if (!selector) {
      throw new XerSourceArchiveValidationError('XER-recovery mist een documentselector');
    }
    const metadata = bindXerImportMetadataToArchive(archive, selector);
    return {
      ...doc,
      xerSourceArchive: archive,
      xerSourceProjectId: selector,
      xer: metadata,
    };
  };
  return docs.map(doc => {
    const archive = doc.xerSourceArchive;
    if (!archive) return doc;
    const key = `${archive.byteLength}:${archive.sha256}`;
    const candidates = canonicalByDigest.get(key) ?? [];
    const canonical = candidates.find(candidate => sameArchive(candidate, archive));
    if (canonical) return bindDocumentToArchive(doc, canonical);
    candidates.push(archive);
    canonicalByDigest.set(key, candidates);
    return bindDocumentToArchive(doc, archive);
  });
}

const VARIANT_RE = /^(.*) \(variant (\d+)\)$/;
function variantBaseName(name: string): string {
  const m = VARIANT_RE.exec(name);
  return m ? m[1] : name;
}

function nextVariantName(sourceName: string, openNames: string[]): string {
  const base = variantBaseName(sourceName);
  const used = new Set<number>();
  for (const nm of openNames) {
    const m = VARIANT_RE.exec(nm);
    if (m && m[1] === base) used.add(parseInt(m[2], 10));
  }
  let n = 2;
  while (used.has(n)) n++;
  return `${base} (variant ${n})`;
}

function openProjectNames(s: AppState): string[] {
  return s.documents.map((d) => (d.id === s.activeDocumentId ? s.project.name : d.payload!.project.name));
}

function saveWaitWithNotice(setShown: (shown: boolean) => void): () => Promise<void> | null {
  let waiters = 0;
  return () => {
    const idle = whenProjectFileWritesIdle();
    if (!idle) return null;
    if (waiters++ === 0) setShown(true);
    return idle.finally(() => { if (--waiters === 0) setShown(false); });
  };
}

function initialDocumentRegistry(): Pick<DocumentSlice, 'documents' | 'activeDocumentId'> {
  const id = generateId('doc');
  return { documents: [{ id, payload: null }], activeDocumentId: id };
}

export const createDocumentSlice: AppSliceFactory<DocumentSlice> = (runtime) => (set, get) => ({
  ...initialDocumentRegistry(),

  newDocument: () => {
    runtime.finishPendingTextEdits();
    const state = get();
    const outgoing = capturePayload(state);
    const newId = generateId('doc');
    const activation = materializeLibraryBoundary({
      payload: freshPayload(), companies: state.companies, pools: state.pools, mode: 'silent-switch',
    });
    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = castDraft(outgoing);
      s.documents.push({ id: newId, payload: null });
      s.activeDocumentId = newId;
      resetDocumentScopedUI(s);
      publishActivation(s, activation);
    });
    runtime.emitHostEvent(HOST_EVENTS.projectNew);
    return newId;
  },

  duplicateDocument: (name) => {
    runtime.finishPendingTextEdits();
    runtime.resetUndoCoalescing();
    const source = get();
    const src = capturePayload(source);
    const copyName = name ?? (src.project.name ? nextVariantName(src.project.name, openProjectNames(source)) : '');
    const newId = generateId('doc');

    const copy: DocumentPayload = {
      project: { ...deepClone(src.project), name: copyName },
      calendar: deepClone(src.calendar),
      tasks: deepClone(src.tasks),
      sequences: deepClone(src.sequences),
      resources: deepClone(src.resources),
      assignments: deepClone(src.assignments),
      calendars: deepClone(src.calendars),
      activityCodeTypes: deepClone(src.activityCodeTypes),
      customFieldDefs: deepClone(src.customFieldDefs),
      customTaskTypes: deepClone(src.customTaskTypes),
      baselines: deepClone(src.baselines),
      activeBaselineId: src.activeBaselineId,
      comparedBaselineIds: [src.comparedBaselineIds[0], src.comparedBaselineIds[1]],
      cpmResult: src.cpmResult,
      resourceLoadResult: src.resourceLoadResult,
      scheduleStale: src.scheduleStale,
      recordedDates: src.recordedDates,
      datesAsRecorded: src.datesAsRecorded,
      minuteModelPending: src.minuteModelPending,
      selectedTaskIds: [],
      activeTaskId: null,
      view: deepClone(src.view),
      collapsedTaskIds: deepClone(src.collapsedTaskIds),
      filePath: null,
      fileHandle: null,
      siteFileId: null,
      siteFileVersion: null,
      knownTargetFingerprint: null,
      fileFormat: src.fileFormat,
      autoSaveToFile: false,
      isDirty: true,
      xerImportMetadata: src.xerImportMetadata
        ? cloneXerImportMetadata(src.xerImportMetadata, src.xerSourceArchive)
        : null,
      xerSourceArchive: src.xerSourceArchive,
      xerSourceProjectId: src.xerSourceProjectId,
      ifcSource: src.ifcSource,
      foreignSourceMark: src.foreignSourceMark,
      taskTypesVisible: src.taskTypesVisible,
      importPristine: false,
      xerArchiveIssue: src.xerArchiveIssue,
      ifcGlobalIds: src.ifcGlobalIds,
      ifcLiteralCalendarIds: src.ifcLiteralCalendarIds,
    };
    const activation = materializeLibraryBoundary({
      payload: copy, companies: source.companies, pools: source.pools, mode: 'silent-switch',
    });

    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = castDraft(src);
      s.documents.push({ id: newId, payload: null });
      s.activeDocumentId = newId;
      resetDocumentScopedUI(s);
      publishActivation(s, activation);
    });
    announceWorkRuleSettle(get().notify, newId, null, activation);
    get().settleLayoutSession();
    runtime.emitHostEvent(HOST_EVENTS.projectLoaded, {
      tasks: copy.tasks.length,
      sequences: copy.sequences.length,
      resources: copy.resources.length,
    });
    return newId;
  },

  switchDocument: (id) => {
    if (id === get().activeDocumentId) return;
    runtime.finishPendingTextEdits();
    const state = get();
    runtime.resetUndoCoalescing();
    const target = state.documents.find((d) => d.id === id);
    if (!target || !target.payload) return;
    const outgoing = capturePayload(state);
    const incoming = target.payload;
    const activation = materializeLibraryBoundary({
      payload: incoming, companies: state.companies, pools: state.pools, mode: 'silent-switch',
    });
    set((s) => {
      const cur = s.documents.find((d) => d.id === s.activeDocumentId);
      if (cur) cur.payload = castDraft(outgoing);
      const inc = s.documents.find((d) => d.id === id);
      if (inc) {
        inc.payload = null;
        delete inc.pendingWorkRuleSettle;
      }
      s.activeDocumentId = id;
      resetDocumentScopedUI(s);
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, id);
      publishActivation(s, activation);
    });
    announceWorkRuleSettle(get().notify, id, target, activation);
    runtime.emitHostEvent(HOST_EVENTS.projectLoaded, {
      tasks: incoming.tasks.length,
      sequences: incoming.sequences.length,
      resources: incoming.resources.length,
    });
  },

  closeDocument: (id, options) => {
    runtime.finishPendingTextEdits();
    const state = get();
    if (!state.documents.some((d) => d.id === id)) return false;
    if (options?.onlyIfClean && state.getOpenDocuments().some((doc) => doc.id === id && doc.isDirty)) return false;

    if (state.documents.length === 1) {
      const newId = generateId('doc');
      const activation = materializeLibraryBoundary({
        payload: freshPayload(), companies: state.companies, pools: state.pools, mode: 'silent-switch',
      });
      set((s) => {
        removeSessionHistoryForDocumentFromState(s, id);
        s.documents = [{ id: newId, payload: null }];
        s.activeDocumentId = newId;
        resetDocumentScopedUI(s);
        publishActivation(s, activation);
      });
      runtime.emitHostEvent(HOST_EVENTS.projectNew);
      return true;
    }

    if (id !== state.activeDocumentId) {
      set((s) => {
        removeSessionHistoryForDocumentFromState(s, id);
        s.documents = s.documents.filter((d) => d.id !== id);
      });
      return true;
    }

    const idx = state.documents.findIndex((d) => d.id === id);
    const neighbor = state.documents[idx + 1] ?? state.documents[idx - 1];
    const incoming = neighbor.payload!;
    const activation = materializeLibraryBoundary({
      payload: incoming, companies: state.companies, pools: state.pools, mode: 'silent-switch',
    });
    set((s) => {
      removeSessionHistoryForDocumentFromState(s, id);
      s.documents = s.documents.filter((d) => d.id !== id);
      const n = s.documents.find((d) => d.id === neighbor.id);
      if (n) {
        n.payload = null;
        delete n.pendingWorkRuleSettle;
      }
      s.activeDocumentId = neighbor.id;
      resetDocumentScopedUI(s);
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, neighbor.id);
      publishActivation(s, activation);
    });
    announceWorkRuleSettle(get().notify, neighbor.id, neighbor, activation);
    runtime.emitHostEvent(HOST_EVENTS.projectLoaded, {
      tasks: incoming.tasks.length,
      sequences: incoming.sequences.length,
      resources: incoming.resources.length,
    });
    return true;
  },

  waitForSavesBeforeClose: saveWaitWithNotice((shown) => set((s) => { s.ui.savingBeforeClose = shown; })),

  requestCloseDocument: (id) => {
    const saving = get().waitForSavesBeforeClose();
    if (saving) {
      void saving.then(() => get().requestCloseDocument(id));
      return;
    }
    if (!get().documents.some((document) => document.id === id)) return;
    runtime.finishPendingTextEdits();
    const doc = get().getOpenDocuments().find((d) => d.id === id);
    if (!doc) return;
    if (doc.isDirty) get().setUI({ pendingCloseDocId: id });
    else get().closeDocument(id);
  },

  closeDocumentAfterSaves: async (id, options) => {
    for (let saving = get().waitForSavesBeforeClose(); saving; saving = get().waitForSavesBeforeClose()) await saving;
    return get().closeDocument(id, options);
  },

  getOpenDocuments: () => {
    const s = get();
    const rows = s.documents.map((d) => {
      const active = d.id === s.activeDocumentId;
      const filePath = active ? s.filePath : d.payload!.filePath;
      const project = active ? s.project : d.payload!.project;
      const isDirty = active ? s.isDirty : d.payload!.isDirty;
      const xerMeta = active ? s.xerImportMetadata : d.payload!.xerImportMetadata;
      return { id: d.id, title: documentTitle(filePath, project.name, documentProjectCode(project, xerMeta)), isDirty, isActive: active };
    });
    const ordinals = untitledOrdinals(rows.map((r) => r.title));
    return rows.map((r, i) => (ordinals[i] === undefined ? r : { ...r, untitledOrdinal: ordinals[i] }));
  },

  getOpenDocumentPayloads: () => {
    const s = get();
    return s.documents.map((d) => ({
      id: d.id,
      payload: d.id === s.activeDocumentId ? capturePayload(s) : d.payload!,
    }));
  },

  setAutoSaveToFile: (enabled) => {
    set((s) => { s.autoSaveToFile = enabled; });
  },

  markAutoSaveVersionSaved: (document, source, prepared, written = null, writtenName) => {
    get().commitSavedDocument(document, source, undefined, prepared, false, written, writtenName);
  },

  restoreDocuments: (docs, activeId) => {
    if (docs.length === 0) return { skippedIds: [] };
    runtime.finishPendingTextEdits();
    const sharedDocs = shareRecoveredXerArchives(docs);
    const state = get();
    const skippedIds: string[] = [];

    const tryOrder = [
      ...sharedDocs.filter((d) => d.id === activeId),
      ...sharedDocs.filter((d) => d.id !== activeId),
    ];
    let active: RecoveryDocInput | null = null;
    let prepared: DocumentPayload | null = null;
    let activation: DocumentActivationMaterialization | null = null;
    let conversion: MinuteModelTransition | null = null;
    for (const candidate of tryOrder) {
      try {
        const rawPayload = payloadFromInput(candidate);
        const p = prepareLoadedPayload(rawPayload, { recompute: true });
        applyRecordedDatesOnLoad(rawPayload.tasks, p, candidate, candidate.datesAsRecorded);
        const a = materializeLibraryBoundary({
          payload: p, companies: state.companies, pools: state.pools, mode: 'open-boundary',
        });
        conversion = minuteModelTransition(rawPayload, a.payload,
          captureRecordedDates(rawPayload.tasks, candidate.recordedFields, candidate.recordedTimes));
        a.payload = conversion.after;
        active = candidate;
        prepared = conversion.after;
        activation = a;
        break;
      } catch (err) {
        console.error('Recovery: hersteld document kon niet worden doorgerekend — overgeslagen:', candidate.id, err);
        skippedIds.push(candidate.id);
      }
    }

    const sleepingById = new Map<string, DocumentPayload>();
    for (const d of sharedDocs) {
      if (active && d.id === active.id) continue;
      if (skippedIds.includes(d.id)) continue;
      try {
        const sleeping = payloadFromInput(d);
        if (d.datesAsRecorded) applyRestoredRecordedMode(sleeping, d);
        sleepingById.set(d.id, sleeping);
      } catch (err) {
        console.error('Recovery: hersteld document kon niet worden voorbereid — overgeslagen:', d.id, err);
        skippedIds.push(d.id);
      }
    }

    if (skippedIds.length > 0) {
      get().notify({
        severity: 'error',
        messageKey: 'notifications.recoveryDocumentsSkipped',
        params: { count: skippedIds.length },
        dedupeKey: 'recovery-restore-skipped',
      });
    }

    if (!active || !prepared || !activation) {
      return { skippedIds };
    }
    const activeDoc = active;
    const activePayload = prepared;
    const activation2 = activation;

    set((s) => {
      replaceSessionHistoryState(s, [], 1);
      s.documents = castDraft(sharedDocs
        .filter((d) => !skippedIds.includes(d.id))
        .map((d) => ({
          id: d.id,
          payload: d.id === activeDoc.id ? null : (sleepingById.get(d.id) ?? null),
        })));
      s.activeDocumentId = activeDoc.id;
      resetDocumentScopedUI(s);
      if (activation2.invalidateRedoScope) invalidateDocumentRedo(s, activeDoc.id);
      publishActivation(s, activation2);
      if (conversion) recordMinuteModelTransition(s, conversion, activeDoc.id);
    });
    announceWorkRuleSettle(get().notify, activeDoc.id, null, activation2);
    const conversionNotice = conversion && minuteModelNotice(conversion);
    if (conversionNotice) get().notify(conversionNotice);
    const cpm = activePayload.cpmResult;
    const failed = scheduleFailedNotice(cpm);
    if (failed) get().notify(failed);
    const archiveNotice = withXerArchiveIssueNotice(undefined, sharedDocs
      .filter(d => !skippedIds.includes(d.id))
      .map(d => d.xerArchiveIssue));
    if (archiveNotice) get().notify(archiveNotice);
    runtime.emitHostEvent(HOST_EVENTS.scheduleCalculated, {
      hasError: !!cpm?.error,
      error: cpm?.error ?? null,
      criticalTasks: activePayload.tasks.filter(task => task.time.isCritical).length,
    });
    runtime.emitHostEvent(HOST_EVENTS.projectLoaded, {
      tasks: activeDoc.tasks.length,
      sequences: activeDoc.sequences.length,
      resources: activeDoc.resources.length,
    });
    return { skippedIds };
  },

  recalculateStaleSleepingDocuments: () => {
    const state = get();
    const updates: { id: string; payload: DocumentPayload }[] = [];
    for (const entry of state.documents) {
      if (entry.id === state.activeDocumentId) continue;
      const payload = entry.payload;
      if (!payload || !payload.scheduleStale || payload.minuteModelPending) continue;

      let next: DocumentPayload;
      try {
        const tasks = cloneTasksForSolve(payload.tasks);
        const result = solveProject(
          solveInputFor(payload.project, tasks, payload.sequences, payload.calendar, payload.calendars), payload.tasks);
        if (result.error) continue;
        next = {
          ...payload, tasks, cpmResult: result, scheduleStale: false, resourceLoadResult: null,
          datesAsRecorded: false, recordedDates: null,
        };
      } catch {
        continue;
      }
      updates.push({ id: entry.id, payload: next });
    }

    if (updates.length === 0) return 0;
    set((s) => {
      for (const u of updates) {
        const entry = s.documents.find((d) => d.id === u.id);
        if (!entry || entry.payload === null) continue;
        entry.payload = castDraft(u.payload);
      }
    });
    return updates.length;
  },
});
