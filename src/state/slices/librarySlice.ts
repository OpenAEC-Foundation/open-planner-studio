import { castDraft, current } from 'immer';
import i18next from 'i18next';
import type { AppSlice, AppSliceFactory, NotifyInput } from './types';
import type { Company, CompanyPool, CompanyLibrary } from '@/types/library';
import { createNameMatcher } from '@/services/library/libraryOps';
import { createDefaultLibrary, createEmptyPool, DEFAULT_COMPANY_ID } from '@/types/library';
import { generateId } from '@/utils/id';
import { clearCostResourceFields, isCostResource } from '@/types/resource';
import { sameValue } from '@/utils/sameValue';
import { nextFreePaletteColor } from '@/engine/renderer/resourcePalette';
import { loadLibrary, saveLibrary, stripLibraryOrigins, bumpPool, makeOrigin, copyCalendarToProject, copyResourceToProject, diffCalendarVsPool, diffResourceVsPool, applyCalendarUpdate, applyResourceUpdate, resourceUpdateBlocked, writePoolIFC, isPoolNewer, computeCalendarHash, computeResourceHash, classifyCalendarOnOpen, classifyResourceOnOpen, matchByName, normalizePoolShape, resolveUniqueCompanyName, isReservedCompanyId, isSafeFileCompanyId, buildDemoLibrarySeed, migrateDemoLibrarySeed, DEMO_COMPANY_ID, DEMO_LIBRARY_SEED_VERSION, CALENDAR_DIFF_FIELDS as CALENDAR_DIFF_FIELDS_LOCAL, RESOURCE_DIFF_FIELDS as RESOURCE_DIFF_FIELDS_LOCAL } from '@/services/library';
import { markScheduleStale } from '../transaction';
import { refreshProjectCalendarCache, syncProjectCalendar } from '../syncProjectCalendar';
import { appLog } from '@/services/debug/appLog';
import { runInScratchDocument } from '../runtime/scratchDocument';
import {
  planDistributionWrites,
  type DistributionApplyRecord,
  type DistributionApplyResult,
  type DistributionUndoReport,
} from '@/services/library/applyDistribution';
import type { DistributionProposal } from '@/services/library/distribute';
import {
  invalidateDocumentRedo,
  recordSessionHistoryDeltas,
  selectUndoHistoryEvent,
  type SessionHistoryEvent,
} from '../sessionHistory';
import { snapshotOfPayload, type Snapshot } from '../snapshot';
import { capturePayload, hydratePayload, type DocumentPayload } from '../documentContract';
import { materializeLibraryBoundary, recountShiftedAfterLibraryRefresh } from '../documentActivation';
import { markDocumentEdited } from '@/state/documentEdited';
import {
  applyCalendarLibraryChange, mergeCalendarLibrarySettle, notifyCalendarLibrarySettle, NO_CALENDAR_LIBRARY_SETTLE,
} from '../calendarTasks';

const DISTRIBUTION_HISTORY_LABEL = 'Verdeling toepassen';

function latestDocumentDataEventSince(
  events: readonly SessionHistoryEvent[],
  documentId: string,
  minSequence: number,
): { id: string; sequence: number } | null {
  let selected: SessionHistoryEvent | null = null;
  for (const event of events) {
    if (event.state !== 'applied' || event.sequence < minSequence) continue;
    if (!event.deltas.some((d) => d.kind === 'document-data' && d.documentId === documentId)) continue;
    if (selected === null || event.sequence > selected.sequence) selected = event;
  }
  return selected === null ? null : { id: selected.id, sequence: selected.sequence };
}

function distributionUndoTarget(
  events: readonly SessionHistoryEvent[],
  documentId: string,
  eventId: string,
): SessionHistoryEvent | null {
  const event = events.find((e) => e.id === eventId);
  if (!event || event.state !== 'applied') return null;
  return selectUndoHistoryEvent(events, documentId)?.id === eventId ? event : null;
}

export interface RecognitionCandidate {
  kind: 'resource' | 'calendar';
  projectId: string;
  projectName: string;
  suggestedPoolId: string | null;
  suggestedPoolName: string | null;
}
export interface RecognitionLink {
  kind: 'resource' | 'calendar';
  projectId: string;
  poolId: string;
}

export interface LibrarySlice {
  companies: Company[];
  defaultCompanyId: string;
  pools: Record<string, CompanyPool>;
  libraryLoaded: boolean;

  initLibrary: () => Promise<void>;
  addCompany: (name: string) => string;
  seedDemoLibrary: () => string;
  renameCompany: (id: string, name: string) => void;
  removeCompany: (id: string) => void;
  countDocumentsLinkedTo: (companyId: string) => number;
  setDefaultCompany: (id: string) => void;
  promoteCalendarToPool: (companyId: string, calendar: import('@/types/calendar').WorkCalendar) => string | null;
  promoteResourceToPool: (companyId: string, resource: import('@/types/resource').Resource, opts?: { dedupByName?: boolean }) => string | null;
  updatePoolCalendar: (companyId: string, calendarId: string, updates: Partial<import('@/types/calendar').WorkCalendar>) => void;
  updatePoolResource: (companyId: string, resourceId: string, updates: Partial<import('@/types/resource').Resource>) => void;
  removePoolCalendar: (companyId: string, calendarId: string) => void;
  removePoolResource: (companyId: string, resourceId: string) => void;
  addPoolResource: (companyId: string, resource: Omit<import('@/types/resource').Resource, 'id'>) => string | null;
  addPoolCalendar: (companyId: string, calendar: Omit<import('@/types/calendar').WorkCalendar, 'id'>) => string | null;

  bindProjectToCompany: (companyId: string) => void;
  computeRecognition: () => RecognitionCandidate[];
  linkRecognizedItems: (links: RecognitionLink[]) => void;
  unbindProject: () => void;
  addLibraryCalendarToProject: (companyId: string, poolCalendarId: string) => { added: boolean; calendarId: string | null };
  addLibraryResourceToProject: (companyId: string, poolResourceId: string) => { added: boolean; resourceId: string | null };

  diffProjectCalendar: (calendarId: string) => import('@/services/library').ItemDiff | null;
  diffProjectResource: (resourceId: string) => import('@/services/library').ItemDiff | null;
  updateProjectCalendarFromLibrary: (calendarId: string) => void;
  updateProjectResourceFromLibrary: (resourceId: string) => void;

  exportPoolIFC: (companyId: string) => string | null;
  replacePool: (companyId: string, pool: import('@/types/library').CompanyPool) => void;
  importPoolAsNewCompany: (pool: import('@/types/library').CompanyPool) => string;
  isLocalPoolNewer: (companyId: string, imported: import('@/types/library').CompanyPool) => boolean;

  refreshBehindItems: (companyId: string) => number;

  refreshAllDocumentsFromPool: (companyId: string) => number;


  onOpenStatusForResource: (resourceId: string) => import('@/services/library').OnOpenStatus | null;
  onOpenStatusForCalendar: (calendarId: string) => import('@/services/library').OnOpenStatus | null;

  resolveDeviation: (ref: { kind: 'resource' | 'calendar'; projectId: string }, choice: 'company' | 'file') => void;

  unlinkResourceFromLibrary: (resourceId: string) => void;

  applyDistribution: (
    proposal: DistributionProposal,
    scopeTaskIdsByDoc: Record<string, string[]>,
  ) => DistributionApplyResult;

  undoDistribution: (record: DistributionApplyRecord) => DistributionUndoReport;
}

export function normalizePool(cid: string, raw: Partial<CompanyPool> | null | undefined, companies: Company[]): CompanyPool {
  return normalizePoolShape(cid, raw, companies);
}

export function normalizeLoadedLibrary(lib: Partial<CompanyLibrary> | null | undefined): CompanyLibrary {
  const companies = lib?.companies && lib.companies.length > 0 ? lib.companies : createDefaultLibrary().companies;
  const companyIds = new Set(companies.map((c) => c.id));
  const rawPools = lib?.pools ?? {};
  const pools = Object.fromEntries(
    Object.entries(rawPools)
      .filter(([cid]) => companyIds.has(cid))
      .map(([cid, p]): [string, CompanyPool] => [cid, normalizePool(cid, p, companies)]),
  );
  const defaultCompanyId = lib?.defaultCompanyId && companyIds.has(lib.defaultCompanyId)
    ? lib.defaultCompanyId
    : companies[0].id;
  return { companies, defaultCompanyId, pools };
}

type LibraryPersistenceState = {
  companies: Company[];
  defaultCompanyId: string;
  pools: Record<string, CompanyPool>;
  libraryLoaded: boolean;
  notify: (notification: NotifyInput) => void;
};

export async function persistLibrary(
  get: () => LibraryPersistenceState,
  save: (library: CompanyLibrary) => Promise<void> = saveLibrary,
): Promise<void> {
  if (!get().libraryLoaded) return;
  const s = get();
  const lib: CompanyLibrary = { companies: s.companies, defaultCompanyId: s.defaultCompanyId, pools: s.pools };
  try {
    await save(lib);
  } catch (err) {
    appLog.emit('error', 'library', 'saveLibrary faalde', err);
    s.notify({
      severity: 'error',
      messageKey: 'notifications.librarySaveFailed',
      detail: err instanceof Error ? err.message : String(err),
      dedupeKey: 'library-save',
    });
  }
}

function notifyCostTypeChangeRefused(notify: (n: NotifyInput) => void): void {
  notify({ severity: 'info', messageKey: 'notifications.costTypeChangeRefused', dedupeKey: 'cost-type-change-refused' });
}

function persist(get: () => LibraryPersistenceState): void {
  void persistLibrary(get);
}

type LibrarySliceSet = Parameters<AppSlice<LibrarySlice>>[0];
type LibrarySliceGet = Parameters<AppSlice<LibrarySlice>>[1];

function recountRecordedShift(set: LibrarySliceSet, get: LibrarySliceGet, documentIds: readonly string[]): void {
  const st = get();
  const updates: Array<[string, ReturnType<typeof recountShiftedAfterLibraryRefresh>]> = [];
  for (const id of documentIds) {
    if (id === st.activeDocumentId) {
      if (st.recordedDates) updates.push([id, recountShiftedAfterLibraryRefresh(st)]);
      continue;
    }
    const payload = st.documents.find((d) => d.id === id)?.payload;
    if (payload?.recordedDates) updates.push([id, recountShiftedAfterLibraryRefresh(payload)]);
  }
  if (updates.length === 0) return;
  set((s) => {
    for (const [id, recorded] of updates) {
      if (id === s.activeDocumentId) {
        s.recordedDates = castDraft(recorded);
        continue;
      }
      const doc = s.documents.find((d) => d.id === id);
      if (doc?.payload) doc.payload.recordedDates = castDraft(recorded);
    }
  });
}

export const createLibrarySlice: AppSliceFactory<LibrarySlice> = (runtime) => (set, get) => ({
  companies: createDefaultLibrary().companies,
  defaultCompanyId: DEFAULT_COMPANY_ID,
  pools: createDefaultLibrary().pools,
  libraryLoaded: false,

  initLibrary: async () => {
    const raw = await loadLibrary();
    const lib = normalizeLoadedLibrary(raw);
    set((s) => {
      s.companies = lib.companies;
      s.defaultCompanyId = lib.defaultCompanyId;
      s.pools = lib.pools;
      for (const c of s.companies) {
        if (!s.pools[c.id]) s.pools[c.id] = createEmptyPool(c);
      }
      s.libraryLoaded = true;
    });
  },

  addCompany: (name) => {
    const id = generateId('company');
    const company: Company = {
      id,
      name: name.trim() || (i18next.isInitialized
        ? i18next.t('companyLibrary.newCompany', { ns: 'common' })
        : 'Nieuwe resourcebibliotheek'),
    };
    set((s) => {
      s.companies.push(company);
      s.pools[id] = createEmptyPool(company);
    });
    persist(get);
    return id;
  },

  seedDemoLibrary: () => {
    if (get().companies.some((c) => c.id === DEMO_COMPANY_ID)) {
      const existing = get().pools[DEMO_COMPANY_ID];
      if (existing && (existing.seedVersion ?? 0) < DEMO_LIBRARY_SEED_VERSION) {
        const { pool: migrated, changed } = migrateDemoLibrarySeed(existing);
        set((s) => { s.pools[DEMO_COMPANY_ID] = changed ? bumpPool(migrated) : migrated; });
        persist(get);
      }
      return DEMO_COMPANY_ID;
    }
    set((s) => {
      const { company, pool } = buildDemoLibrarySeed();
      s.companies.push(company);
      s.pools[company.id] = pool;
    });
    persist(get);
    return DEMO_COMPANY_ID;
  },

  renameCompany: (id, name) => {
    set((s) => {
      const c = s.companies.find(c => c.id === id);
      if (!c) return;
      c.name = name.trim() || c.name;
      if (s.pools[id]) s.pools[id].companyName = c.name;
      if (s.project.companyId === id) s.project.companyName = c.name;
      for (const d of s.documents) {
        if (d.payload?.project.companyId !== id) continue;
        d.payload.project = { ...d.payload.project, companyName: c.name };
      }
    });
    persist(get);
  },

  removeCompany: (id) => {
    const wasActiveCompany = get().companies.length > 1 && get().project.companyId === id;
    set((s) => {
      if (s.companies.length <= 1) return;
      s.companies = s.companies.filter(c => c.id !== id);
      delete s.pools[id];
      if (s.defaultCompanyId === id) s.defaultCompanyId = s.companies[0].id;
      if (s.project.companyId === id) {
        s.project.companyId = undefined;
        s.project.companyName = undefined;
        stripLibraryOrigins(s, id);
        refreshProjectCalendarCache(s);
      }
      for (const d of s.documents) {
        if (!d.payload) continue;
        const payload = d.payload;
        if (payload.project.companyId !== id) continue;
        payload.project = { ...payload.project, companyId: undefined, companyName: undefined };
        stripLibraryOrigins(payload, id);
        refreshProjectCalendarCache(payload);
      }
    });
    persist(get);
    if (wasActiveCompany) {
      get().setUI({ showLibraryLinkDialog: false, libraryRefreshNotice: null });
    }
  },

  countDocumentsLinkedTo: (companyId) => {
    const s = get();
    let n = s.project.companyId === companyId ? 1 : 0;
    for (const d of s.documents) if (d.payload && d.payload.project.companyId === companyId) n++;
    return n;
  },

  setDefaultCompany: (id) => {
    set((s) => {
      if (s.companies.some(c => c.id === id)) s.defaultCompanyId = id;
    });
    persist(get);
  },

  promoteCalendarToPool: (companyId, calendar) => {
    let newId: string | null = null;
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('cal');
      const { libraryOrigin: _drop, ...rest } = calendar;
      pool.calendars.push({ ...structuredClone(rest), id });
      const bumped = bumpPool(pool);
      s.pools[companyId] = bumped;
      const src = s.calendars.find((c) => c.id === calendar.id);
      if (src) {
        runtime.beginUndoable(s);
        const poolCal = bumped.calendars.find((c) => c.id === id)!;
        src.libraryOrigin = makeOrigin(bumped, id, computeCalendarHash(poolCal));
        syncProjectCalendar(s);
        runtime.finishMutation(s);
      }
      newId = id;
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
    return newId;
  },

  promoteResourceToPool: (companyId, resource, opts) => {
    let newId: string | null = null;
    const existingPool = opts?.dedupByName ? get().pools[companyId] : undefined;
    const existingMatch = existingPool ? matchByName(resource.name, existingPool.resources) : null;
    if (existingMatch) {
      let linked = false;
      set((s) => {
        const idx = s.resources.findIndex((r) => r.id === resource.id);
        if (idx < 0 || s.resources[idx].libraryOrigin) return;
        runtime.beginUndoable(s);
        const pool = s.pools[companyId];
        s.resources[idx].libraryOrigin = makeOrigin(pool, existingMatch.id, computeResourceHash(existingMatch));
        runtime.finishMutation(s);
        linked = true;
      });
      if (linked) get().recomputeViewRows();
      return linked ? existingMatch.id : null;
    }
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('res');
      const { libraryOrigin: _drop, parentId: _p, ...rest } = resource;
      pool.resources.push({ ...structuredClone(rest), id, calendarId: undefined });
      const bumped = bumpPool(pool);
      s.pools[companyId] = bumped;
      const src = s.resources.find((r) => r.id === resource.id);
      if (src) {
        runtime.beginUndoable(s);
        const poolRes = bumped.resources.find((r) => r.id === id)!;
        src.libraryOrigin = makeOrigin(bumped, id, computeResourceHash(poolRes));
        runtime.finishMutation(s);
      }
      newId = id;
    });
    persist(get);
    get().recomputeViewRows();
    get().refreshAllDocumentsFromPool(companyId);
    return newId;
  },

  updatePoolCalendar: (companyId, calendarId, updates) => {
    let changed = false;
    set((s) => {
      const pool = s.pools[companyId];
      const idx = pool?.calendars.findIndex(c => c.id === calendarId) ?? -1;
      if (!pool || idx < 0) return;
      const currentCal = pool.calendars[idx] as unknown as Record<string, unknown>;
      if (Object.entries(updates).every(([k, v]) => sameValue(currentCal[k], v))) return;
      Object.assign(pool.calendars[idx], updates);
      s.pools[companyId] = bumpPool(pool);
      changed = true;
    });
    if (!changed) return;
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  updatePoolResource: (companyId, resourceId, updates) => {
    set((s) => {
      const pool = s.pools[companyId];
      const idx = pool?.resources.findIndex(r => r.id === resourceId) ?? -1;
      if (!pool || idx < 0) return;
      Object.assign(pool.resources[idx], updates);
      if (isCostResource(pool.resources[idx])) clearCostResourceFields(pool.resources[idx]);
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  removePoolCalendar: (companyId, calendarId) => {
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      pool.calendars = pool.calendars.filter(c => c.id !== calendarId);
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  removePoolResource: (companyId, resourceId) => {
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      pool.resources = pool.resources.filter(r => r.id !== resourceId);
      for (const r of pool.resources) {
        if (r.parentId === resourceId) r.parentId = undefined;
      }
      s.pools[companyId] = bumpPool(pool);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  addPoolResource: (companyId, resource) => {
    let newId: string | null = null;
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('res');
      const { libraryOrigin: _o, parentId: _p, calendarId: _c, ...rest } = resource as import('@/types/resource').Resource;
      const color = rest.color ?? nextFreePaletteColor(pool.resources);
      pool.resources.push({ ...structuredClone(rest), id, color });
      s.pools[companyId] = bumpPool(pool);
      newId = id;
    });
    persist(get);
    return newId;
  },
  addPoolCalendar: (companyId, calendar) => {
    let newId: string | null = null;
    set((s) => {
      const pool = s.pools[companyId];
      if (!pool) return;
      const id = generateId('cal');
      const { libraryOrigin: _o, ...rest } = calendar as import('@/types/calendar').WorkCalendar;
      pool.calendars.push({ ...structuredClone(rest), id });
      s.pools[companyId] = bumpPool(pool);
      newId = id;
    });
    persist(get);
    return newId;
  },

  bindProjectToCompany: (companyId) => {
    set((s) => {
      const company = s.companies.find(c => c.id === companyId);
      if (!company) return;
      const previous = s.project.companyId;
      const isRebind = !!previous && previous !== companyId;
      if (isRebind) runtime.beginUndoable(s);
      s.project.companyId = company.id;
      s.project.companyName = company.name;
      s.project.modifiedAt = new Date().toISOString();
      if (isRebind) {
        stripLibraryOrigins(s, previous);
        refreshProjectCalendarCache(s);
      }
      runtime.finishMutation(s);
    });
  },

  addLibraryCalendarToProject: (companyId, poolCalendarId) => {
    if (get().project.companyId !== companyId) {
      appLog.emit('warn', 'library', `materialisatie genegeerd: actief project niet aan bedrijf ${companyId} gekoppeld (project=${get().project.companyId ?? 'geen'})`);
      return { added: false, calendarId: null };
    }
    let result: { added: boolean; calendarId: string | null } = { added: false, calendarId: null };
    set((s) => {
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      const pool = current(draftPool);
      const copy = copyCalendarToProject(pool, poolCalendarId, s.calendars, generateId);
      if (!copy) return;
      if (copy.reused) {
        result = { added: false, calendarId: copy.calendar.id };
        return;
      }
      runtime.beginUndoable(s);
      s.calendars = [...s.calendars, copy.calendar];
      markDocumentEdited(s);
      result = { added: true, calendarId: copy.calendar.id };
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    return result;
  },

  addLibraryResourceToProject: (companyId, poolResourceId) => {
    if (get().project.companyId !== companyId) {
      appLog.emit('warn', 'library', `materialisatie genegeerd: actief project niet aan bedrijf ${companyId} gekoppeld (project=${get().project.companyId ?? 'geen'})`);
      return { added: false, resourceId: null };
    }
    let result: { added: boolean; resourceId: string | null } = { added: false, resourceId: null };
    set((s) => {
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      const pool = current(draftPool);
      const copy = copyResourceToProject(pool, poolResourceId, s.resources, s.calendars, generateId);
      if (!copy) return;
      if (copy.reused) {
        result = { added: false, resourceId: copy.resource.id };
        return;
      }
      runtime.beginUndoable(s);
      if (copy.travelingCalendar && !copy.travelingCalendar.reused) {
        s.calendars = [...s.calendars, copy.travelingCalendar.calendar];
      }
      s.resources = [...s.resources, copy.resource];
      result = { added: true, resourceId: copy.resource.id };
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
    return result;
  },

  diffProjectCalendar: (calendarId) => {
    const s = get();
    const cal = s.calendars.find(c => c.id === calendarId);
    const companyId = cal?.libraryOrigin?.companyId;
    const pool = companyId ? s.pools[companyId] : undefined;
    if (!cal || !cal.libraryOrigin || !pool) return null;
    return diffCalendarVsPool(cal, pool);
  },

  diffProjectResource: (resourceId) => {
    const s = get();
    const res = s.resources.find(r => r.id === resourceId);
    const companyId = res?.libraryOrigin?.companyId;
    const pool = companyId ? s.pools[companyId] : undefined;
    if (!res || !res.libraryOrigin || !pool) return null;
    return diffResourceVsPool(res, pool);
  },

  updateProjectCalendarFromLibrary: (calendarId) => {
    let settled = NO_CALENDAR_LIBRARY_SETTLE;
    set((s) => {
      const idx = s.calendars.findIndex(c => c.id === calendarId);
      const cal = idx >= 0 ? s.calendars[idx] : undefined;
      const companyId = cal?.libraryOrigin?.companyId;
      const draftPool = companyId ? s.pools[companyId] : undefined;
      if (!cal || !cal.libraryOrigin || !draftPool) return;
      const pool = current(draftPool);
      const snapCal = current(cal);
      if (diffCalendarVsPool(snapCal, pool).status !== 'changed') return;
      runtime.beginUndoable(s);
      settled = applyCalendarLibraryChange(s, (d) => {
        d.calendars[idx] = applyCalendarUpdate(snapCal, pool);
        syncProjectCalendar(d);
      });
      runtime.finishMutation(s, { stale: true });
    });
    notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, settled);
    get().recomputeResourceLoad();
  },

  updateProjectResourceFromLibrary: (resourceId) => {
    let refusedCostTypeChange = false;
    set((s) => {
      const idx = s.resources.findIndex(r => r.id === resourceId);
      const res = idx >= 0 ? s.resources[idx] : undefined;
      const companyId = res?.libraryOrigin?.companyId;
      const draftPool = companyId ? s.pools[companyId] : undefined;
      if (!res || !res.libraryOrigin || !draftPool) return;
      const pool = current(draftPool);
      const snapRes = current(res);
      if (diffResourceVsPool(snapRes, pool).status !== 'changed') return;
      if (resourceUpdateBlocked(snapRes, pool, s.assignments)) { refusedCostTypeChange = true; return; }
      runtime.beginUndoable(s);
      s.resources[idx] = applyResourceUpdate(snapRes, pool, s.assignments);
      runtime.finishMutation(s);
    });
    if (refusedCostTypeChange) notifyCostTypeChangeRefused(get().notify);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  exportPoolIFC: (companyId) => {
    const pool = get().pools[companyId];
    return pool ? writePoolIFC(pool) : null;
  },

  replacePool: (companyId, pool) => {
    const state = get();
    const company = state.companies.find(c => c.id === companyId);
    if (!company) return;
    const normalized = {
      ...normalizePool(companyId, pool, state.companies),
      companyName: company.name,
    };
    const pools = { ...state.pools, [companyId]: normalized };
    const activation = materializeLibraryBoundary({
      payload: capturePayload(state),
      companies: state.companies,
      pools,
      mode: 'open-boundary',
    });
    set((s) => {
      s.pools[companyId] = normalized;
      hydratePayload(s, activation.payload);
      s.viewRows = [...activation.viewRows];
      s.resourceLoadResult = activation.resourceLoadResult;
      s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
      s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, s.activeDocumentId);
    });
    notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, activation.workRuleSettle);
    persist(get);
  },

  importPoolAsNewCompany: (pool) => {
    const state = get();
    const name = resolveUniqueCompanyName(pool.companyName ?? '', state.companies.map((c) => c.name));
    const fileId = pool.companyId;
    const canKeepFileId = !!fileId
      && isSafeFileCompanyId(fileId)
      && !isReservedCompanyId(fileId)
      && !state.companies.some((c) => c.id === fileId);
    const id = canKeepFileId ? fileId : generateId('company');
    const company: Company = { id, name };
    const companies = [...state.companies, company];
    const normalized = { ...normalizePoolShape(id, pool, companies), companyName: name };
    const pools = { ...state.pools, [id]: normalized };
    const activation = materializeLibraryBoundary({
      payload: capturePayload(state),
      companies,
      pools,
      mode: 'open-boundary',
    });
    set((s) => {
      s.companies.push(company);
      s.pools[id] = normalized;
      hydratePayload(s, activation.payload);
      s.viewRows = [...activation.viewRows];
      s.resourceLoadResult = activation.resourceLoadResult;
      s.ui.showLibraryLinkDialog = activation.signals.showLibraryLinkDialog;
      s.ui.libraryRefreshNotice = activation.signals.libraryRefreshNotice;
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, s.activeDocumentId);
    });
    notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, activation.workRuleSettle);
    persist(get);
    return id;
  },

  isLocalPoolNewer: (companyId, imported) => {
    return isPoolNewer(get().pools[companyId], imported);
  },

  refreshBehindItems: (companyId) => {
    const state = get();
    if (state.project.companyId !== companyId) return 0;
    const activation = materializeLibraryBoundary({
      payload: capturePayload(state),
      companies: state.companies,
      pools: state.pools,
      mode: 'silent-switch',
    });
    const changed = activation.signals.refreshed;
    if (changed === 0) return 0;
    set((s) => {
      hydratePayload(s, activation.payload);
      s.viewRows = [...activation.viewRows];
      s.resourceLoadResult = activation.resourceLoadResult;
      if (activation.invalidateRedoScope) invalidateDocumentRedo(s, s.activeDocumentId);
    });
    notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, activation.workRuleSettle);
    return changed;
  },

  refreshAllDocumentsFromPool: (companyId) => {
    let changed = 0;
    let activeSettle = NO_CALENDAR_LIBRARY_SETTLE;
    const calendarRefreshed: string[] = [];
    set((s) => {
      if (!s.companies.some((c) => c.id === companyId)) return;
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      const pool = current(draftPool);

      const refreshCalendars = (
        cals: import('@/types/calendar').WorkCalendar[],
      ): { items: import('@/types/calendar').WorkCalendar[]; calChanged: number } => {
        let calChanged = 0;
        const items = cals.map((cal) => {
          if (cal.libraryOrigin?.companyId !== companyId) return cal;
          if (classifyCalendarOnOpen(cal, pool) !== 'behind') return cal;
          calChanged++;
          return applyCalendarUpdate(cal, pool);
        });
        return { items, calChanged };
      };
      const refreshResources = (
        ress: import('@/types/resource').Resource[],
        assignments: readonly import('@/types/resource').ResourceAssignment[],
      ): { items: import('@/types/resource').Resource[]; resChanged: number } => {
        let resChanged = 0;
        const items = ress.map((res) => {
          if (res.libraryOrigin?.companyId !== companyId) return res;
          if (classifyResourceOnOpen(res, pool) !== 'behind') return res;
          resChanged++;
          return applyResourceUpdate(res, pool, assignments);
        });
        return { items, resChanged };
      };

      if (s.project.companyId === companyId) {
        const cals = refreshCalendars(s.calendars.map((c) => current(c)));
        const ress = refreshResources(s.resources.map((r) => current(r)), s.assignments);
        const docChanged = cals.calChanged + ress.resChanged;
        invalidateDocumentRedo(s, s.activeDocumentId);
        if (docChanged > 0) {
          if (ress.resChanged > 0) s.resources = ress.items;
          if (cals.calChanged > 0) {
            activeSettle = applyCalendarLibraryChange(s, (d) => {
              d.calendars = cals.items;
              refreshProjectCalendarCache(d);
            });
          }
          refreshProjectCalendarCache(s);
          if (cals.calChanged > 0) {
            markScheduleStale(s);
            calendarRefreshed.push(s.activeDocumentId);
          }
          changed += docChanged;
        }
      }

      for (const doc of s.documents) {
        if (!doc.payload) continue;
        const payload = doc.payload;
        if (payload.project.companyId !== companyId) continue;
        const cals = refreshCalendars(payload.calendars.map((c) => current(c)));
        const ress = refreshResources(payload.resources.map((r) => current(r)), payload.assignments);
        const docChanged = cals.calChanged + ress.resChanged;
        invalidateDocumentRedo(s, doc.id);
        if (docChanged > 0) {
          if (ress.resChanged > 0) payload.resources = ress.items;
          if (cals.calChanged > 0) {
            const settled = applyCalendarLibraryChange(payload, (p) => {
              p.calendars = cals.items;
              refreshProjectCalendarCache(p);
            });
            if (settled.changed + settled.lost > 0) {
              doc.pendingWorkRuleSettle = mergeCalendarLibrarySettle(doc.pendingWorkRuleSettle ?? NO_CALENDAR_LIBRARY_SETTLE, settled);
            }
            markScheduleStale(payload);
            calendarRefreshed.push(doc.id);
          }
          changed += docChanged;
        }
      }
    });
    recountRecordedShift(set, get, calendarRefreshed);
    notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, activeSettle);
    if (changed > 0) {
      get().recomputeResourceLoad();
      get().recomputeViewRows();
    }
    return changed;
  },

  onOpenStatusForResource: (resourceId) => {
    const s = get();
    const res = s.resources.find((r) => r.id === resourceId);
    const companyId = res?.libraryOrigin?.companyId;
    if (!res || !companyId || companyId !== s.project.companyId || !s.companies.some((c) => c.id === companyId)) return null;
    const pool = s.pools[companyId];
    return pool ? classifyResourceOnOpen(res, pool) : null;
  },
  onOpenStatusForCalendar: (calendarId) => {
    const s = get();
    const cal = s.calendars.find((c) => c.id === calendarId);
    const companyId = cal?.libraryOrigin?.companyId;
    if (!cal || !companyId || companyId !== s.project.companyId || !s.companies.some((c) => c.id === companyId)) return null;
    const pool = s.pools[companyId];
    return pool ? classifyCalendarOnOpen(cal, pool) : null;
  },

  computeRecognition: () => {
    const s = get();
    const companyId = s.project.companyId;
    if (!companyId || !s.companies.some((c) => c.id === companyId)) return [];
    const pool = s.pools[companyId];
    if (!pool) return [];
    const out: RecognitionCandidate[] = [];
    let matchResourceName: ReturnType<typeof createNameMatcher<typeof pool.resources[number]>> | undefined;
    let matchCalendarName: ReturnType<typeof createNameMatcher<typeof pool.calendars[number]>> | undefined;
    for (const r of s.resources) {
      if (r.libraryOrigin) continue;
      matchResourceName ??= createNameMatcher(pool.resources);
      const m = matchResourceName(r.name);
      out.push({ kind: 'resource', projectId: r.id, projectName: r.name, suggestedPoolId: m?.id ?? null, suggestedPoolName: m?.name ?? null });
    }
    for (const c of s.calendars) {
      if (c.libraryOrigin) continue;
      matchCalendarName ??= createNameMatcher(pool.calendars);
      const m = matchCalendarName(c.name);
      out.push({ kind: 'calendar', projectId: c.id, projectName: c.name, suggestedPoolId: m?.id ?? null, suggestedPoolName: m?.name ?? null });
    }
    return out;
  },

  linkRecognizedItems: (links) => {
    let settled = NO_CALENDAR_LIBRARY_SETTLE;
    set((s) => {
      const companyId = s.project.companyId;
      if (!companyId) return;
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      const pool = current(draftPool);
      const anyApplicable = links.some((link) => link.kind === 'resource'
        ? pool.resources.some((r) => r.id === link.poolId)
        : pool.calendars.some((c) => c.id === link.poolId));
      if (!anyApplicable) return;
      runtime.beginUndoable(s);
      let calendarLinked = false;
      for (const link of links) {
        if (link.kind !== 'resource') continue;
        if (!pool.resources.some((r) => r.id === link.poolId)) continue;
        const idx = s.resources.findIndex((r) => r.id === link.projectId);
        if (idx < 0) continue;
        const stamped = { ...current(s.resources[idx]), libraryOrigin: makeOrigin(pool, link.poolId) };
        s.resources[idx] = applyResourceUpdate(stamped, pool, s.assignments);
      }
      const calendarLinks = links.filter((link) => link.kind === 'calendar'
        && pool.calendars.some((c) => c.id === link.poolId));
      if (calendarLinks.length > 0) {
        settled = applyCalendarLibraryChange(s, (d) => {
          for (const link of calendarLinks) {
            const idx = d.calendars.findIndex((c) => c.id === link.projectId);
            if (idx < 0) continue;
            const stamped = { ...current(d.calendars[idx]), libraryOrigin: makeOrigin(pool, link.poolId) };
            d.calendars[idx] = applyCalendarUpdate(stamped, pool);
            calendarLinked = true;
          }
          refreshProjectCalendarCache(d);
        });
      }
      refreshProjectCalendarCache(s);
      runtime.finishMutation(s, { stale: calendarLinked });
    });
    notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, settled);
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  unbindProject: () => {
    set((s) => {
      if (!s.project.companyId) return;
      runtime.beginUndoable(s);
      s.project.companyId = undefined;
      s.project.companyName = undefined;
      stripLibraryOrigins(s);
      s.calendar = s.calendars.find((c) => c.id === s.project.calendarId) ?? { ...s.calendar };
      runtime.finishMutation(s);
    });
    get().recomputeResourceLoad();
    get().recomputeViewRows();
  },

  resolveDeviation: (ref, choice) => {
    const companyId = get().project.companyId;
    if (!companyId) return;
    if (choice === 'company') {
      let refusedCostTypeChange = false;
      let settled = NO_CALENDAR_LIBRARY_SETTLE;
      let calendarRefreshed = false;
      set((s) => {
        const draftPool = s.pools[companyId];
        if (!draftPool) return;
        const pool = current(draftPool);
        if (ref.kind === 'resource') {
          const idx = s.resources.findIndex((r) => r.id === ref.projectId);
          if (idx < 0 || diffResourceVsPool(current(s.resources[idx]), pool).status !== 'changed') return;
          if (resourceUpdateBlocked(current(s.resources[idx]), pool, s.assignments)) { refusedCostTypeChange = true; return; }
          s.resources[idx] = applyResourceUpdate(current(s.resources[idx]), pool, s.assignments);
        } else {
          const idx = s.calendars.findIndex((c) => c.id === ref.projectId);
          if (idx < 0 || diffCalendarVsPool(current(s.calendars[idx]), pool).status !== 'changed') return;
          settled = applyCalendarLibraryChange(s, (d) => {
            d.calendars[idx] = applyCalendarUpdate(current(d.calendars[idx]), pool);
            refreshProjectCalendarCache(d);
          });
          markScheduleStale(s);
          calendarRefreshed = true;
        }
        invalidateDocumentRedo(s, s.activeDocumentId);
      });
      if (calendarRefreshed) recountRecordedShift(set, get, [get().activeDocumentId]);
      if (refusedCostTypeChange) notifyCostTypeChangeRefused(get().notify);
      notifyCalendarLibrarySettle(get().notify, get().activeDocumentId, settled);
      get().recomputeResourceLoad();
      get().recomputeViewRows();
      return;
    }
    set((s) => {
      const draftPool = s.pools[companyId];
      if (!draftPool) return;
      if (ref.kind === 'resource') {
        const rIdx = s.resources.findIndex((r) => r.id === ref.projectId);
        if (rIdx < 0) return;
        const item = current(s.resources[rIdx]);
        const libId = item.libraryOrigin?.libraryItemId;
        const pIdx = libId ? draftPool.resources.findIndex((r) => r.id === libId) : -1;
        if (pIdx < 0) return;
        for (const f of RESOURCE_DIFF_FIELDS_LOCAL) (draftPool.resources[pIdx] as unknown as Record<string, unknown>)[f] = (item as unknown as Record<string, unknown>)[f];
        if (isCostResource(draftPool.resources[pIdx])) clearCostResourceFields(draftPool.resources[pIdx]);
        const bumped = bumpPool(draftPool);
        s.pools[companyId] = bumped;
        const newHash = computeResourceHash(bumped.resources[pIdx]);
        s.resources[rIdx] = { ...item, libraryOrigin: makeOrigin(bumped, libId!, newHash) };
      } else {
        const cIdx = s.calendars.findIndex((c) => c.id === ref.projectId);
        if (cIdx < 0) return;
        const item = current(s.calendars[cIdx]);
        const libId = item.libraryOrigin?.libraryItemId;
        const pIdx = libId ? draftPool.calendars.findIndex((c) => c.id === libId) : -1;
        if (pIdx < 0) return;
        for (const f of CALENDAR_DIFF_FIELDS_LOCAL) (draftPool.calendars[pIdx] as unknown as Record<string, unknown>)[f] = (item as unknown as Record<string, unknown>)[f];
        const bumped = bumpPool(draftPool);
        s.pools[companyId] = bumped;
        const newHash = computeCalendarHash(bumped.calendars[pIdx]);
        s.calendars[cIdx] = { ...item, libraryOrigin: makeOrigin(bumped, libId!, newHash) };
        refreshProjectCalendarCache(s);
      }
      invalidateDocumentRedo(s, s.activeDocumentId);
    });
    persist(get);
    get().refreshAllDocumentsFromPool(companyId);
  },

  unlinkResourceFromLibrary: (resourceId) => {
    set((s) => {
      const idx = s.resources.findIndex((r) => r.id === resourceId);
      if (idx < 0 || !s.resources[idx].libraryOrigin) return;
      runtime.beginUndoable(s);
      const calendarId = s.resources[idx].calendarId;
      const { libraryOrigin: _drop, ...rest } = s.resources[idx];
      s.resources[idx] = rest;
      if (calendarId) {
        const calIdx = s.calendars.findIndex((c) => c.id === calendarId);
        const cal = calIdx >= 0 ? s.calendars[calIdx] : undefined;
        if (cal?.libraryOrigin) {
          const stillFollowed = s.resources.some(
            (r) => r.id !== resourceId && r.calendarId === calendarId && !!r.libraryOrigin,
          );
          if (!stillFollowed) {
            const { libraryOrigin: _calDrop, ...calRest } = cal;
            s.calendars[calIdx] = calRest;
            refreshProjectCalendarCache(s);
          }
        }
      }
      runtime.finishMutation(s);
    });
  },

  applyDistribution: (proposal, scopeTaskIdsByDoc) => {
    const plan = planDistributionWrites(proposal, scopeTaskIdsByDoc);
    if (!plan.ok) return { ok: false, reason: plan.reason };

    runtime.resetUndoCoalescing();

    const state = get();
    const activeWrite = plan.writes.find((w) => w.docId === state.activeDocumentId);
    const sleepingWrites = plan.writes.filter((w) => w.docId !== state.activeDocumentId);

    const sleepingResults: { docId: string; before: DocumentPayload; after: DocumentPayload }[] = [];
    const pendingNotifications: NotifyInput[] = [];
    for (const w of sleepingWrites) {
      const entry = state.documents.find((d) => d.id === w.docId);
      if (!entry?.payload) continue;
      const out = runInScratchDocument(entry.payload, (s) => {
        s.applyLeveling(w.write, { scopeTaskIds: w.scopeTaskIds });
      }, w.docId);
      pendingNotifications.push(...out.notifications);
      const cpmError = out.ok ? out.payload.cpmResult?.error : undefined;
      if (!out.ok || cpmError) {
        return { ok: false, reason: 'scratch-failed', docId: w.docId, error: out.error ?? cpmError };
      }
      sleepingResults.push({ docId: w.docId, before: entry.payload, after: out.payload });
    }

    let activeEvent: { id: string; sequence: number } | null = null;
    if (activeWrite) {
      const sequenceBefore = get().nextHistorySequence;
      get().applyLeveling(activeWrite.write, { scopeTaskIds: activeWrite.scopeTaskIds });
      activeEvent = latestDocumentDataEventSince(
        get().historyEvents, activeWrite.docId, sequenceBefore,
      );
    }

    const sleepingEvents = new Map<string, { id: string; sequence: number }>();
    if (sleepingResults.length > 0) {
      set((s) => {
        for (const r of sleepingResults) {
          const entry = s.documents.find((d) => d.id === r.docId);
          if (!entry || entry.payload === null) continue;
          entry.payload = castDraft(r.after);
          const event = recordSessionHistoryDeltas(s, DISTRIBUTION_HISTORY_LABEL, [{
            kind: 'document-data',
            documentId: r.docId,
            before: snapshotOfPayload(r.before),
            after: snapshotOfPayload(r.after),
          }]);
          if (event) sleepingEvents.set(r.docId, { id: event.id, sequence: event.sequence });
        }
      });
    }

    const docs: DistributionApplyRecord['docs'] = [];
    if (activeWrite && activeEvent) {
      const docResult = proposal.docs.find((d) => d.docId === activeWrite.docId);
      if (docResult) {
        docs.push({
          docId: activeWrite.docId, title: docResult.title,
          historyEventId: activeEvent.id, historySequence: activeEvent.sequence,
        });
      }
    }
    for (const r of sleepingResults) {
      const event = sleepingEvents.get(r.docId);
      const docResult = proposal.docs.find((d) => d.docId === r.docId);
      if (!event || !docResult) continue;
      docs.push({
        docId: r.docId, title: docResult.title,
        historyEventId: event.id, historySequence: event.sequence,
      });
    }
    if (docs.length === 0) return { ok: false, reason: 'nothing-to-write' };

    for (const n of pendingNotifications) get().notify(n);

    return {
      ok: true,
      record: { libraryItemId: proposal.libraryItemId, appliedAt: new Date().toISOString(), docs },
    };
  },

  undoDistribution: (record) => {
    const state = get();
    const undoneDocIds: string[] = [];
    const skippedDocIds: string[] = [];

    const activeEntry = record.docs.find((d) => d.docId === state.activeDocumentId);
    const sleepingEntries = record.docs.filter((d) => d.docId !== state.activeDocumentId);

    const restores: { docId: string; before: Snapshot; eventId: string }[] = [];
    for (const d of sleepingEntries) {
      const entry = state.documents.find((x) => x.id === d.docId);
      const event = distributionUndoTarget(state.historyEvents, d.docId, d.historyEventId);
      const delta = event?.deltas.find((x) => x.kind === 'document-data' && x.documentId === d.docId);
      if (!entry?.payload || !event || delta?.kind !== 'document-data') {
        skippedDocIds.push(d.docId);
        continue;
      }
      restores.push({ docId: d.docId, before: delta.before, eventId: event.id });
    }

    if (activeEntry) {
      if (distributionUndoTarget(state.historyEvents, activeEntry.docId, activeEntry.historyEventId)) {
        get().undo();
        undoneDocIds.push(activeEntry.docId);
      } else {
        skippedDocIds.push(activeEntry.docId);
      }
    }

    const restoredDocIds: string[] = [];
    if (restores.length > 0) {
      set((s) => {
        for (const r of restores) {
          const entry = s.documents.find((x) => x.id === r.docId);
          const stored = s.historyEvents.find((e) => e.id === r.eventId);
          if (!entry || entry.payload === null || !stored || stored.state !== 'applied') continue;
          entry.payload = { ...entry.payload, ...r.before, isDirty: true, resourceLoadResult: null };
          stored.state = 'undone';
          restoredDocIds.push(r.docId);
        }
      });
    }
    for (const r of restores) {
      if (restoredDocIds.includes(r.docId)) undoneDocIds.push(r.docId);
      else skippedDocIds.push(r.docId);
    }

    return { undoneDocIds, skippedDocIds };
  },
});
