import i18next from 'i18next';
import type { WorkCalendar } from '@/types/calendar';
import { clearCostResourceFields, isCostResource, type Resource, type ResourceAssignment } from '@/types/resource';
import type { Company, CompanyPool, LibraryOrigin } from '@/types/library';
import { DEFAULT_COMPANY_ID } from '@/types/library';
import { DEMO_COMPANY_ID } from './demoLibrary';
import { firstBlockScalarVariant, withRepairedFirstBlockScalar } from '@/services/subdayIo';

export const RESERVED_COMPANY_IDS: ReadonlySet<string> = new Set([DEFAULT_COMPANY_ID, DEMO_COMPANY_ID]);

export function isReservedCompanyId(id: string): boolean {
  return RESERVED_COMPANY_IDS.has(id);
}

const SAFE_COMPANY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const UNSAFE_COMPANY_IDS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

export function isSafeFileCompanyId(id: string): boolean {
  return SAFE_COMPANY_ID_PATTERN.test(id) && !UNSAFE_COMPANY_IDS.has(id);
}

export type PoolImportPreselection =
  | { action: 'add' }
  | { action: 'replace'; companyId: string };

export function resolvePoolImportPreselection(
  importedCompanyId: string,
  companies: { id: string }[],
): PoolImportPreselection {
  const canMatchById = !!importedCompanyId && isSafeFileCompanyId(importedCompanyId) && !isReservedCompanyId(importedCompanyId);
  const match = canMatchById ? companies.find((c) => c.id === importedCompanyId) : undefined;
  return match ? { action: 'replace', companyId: match.id } : { action: 'add' };
}

export type PoolImportIdentityHint = 'collision' | 'fresh-identity' | 'none';
export function classifyPoolImportIdentityHint(importedCompanyId: string, companies: { id: string }[]): PoolImportIdentityHint {
  if (isReservedCompanyId(importedCompanyId) || !isSafeFileCompanyId(importedCompanyId)) return 'fresh-identity';
  if (companies.some((c) => c.id === importedCompanyId)) return 'collision';
  return 'none';
}

export function bumpPool(pool: CompanyPool): CompanyPool {
  return { ...pool, poolVersion: pool.poolVersion + 1, modifiedAt: new Date().toISOString() };
}

export function normalizePoolShape(cid: string, raw: Partial<CompanyPool> | null | undefined, companies: Company[]): CompanyPool {
  const p = raw ?? {};
  return {
    companyId: cid,
    companyName: typeof p.companyName === 'string'
      ? p.companyName
      : (companies.find((c) => c.id === cid)?.name ?? cid),
    poolVersion: (typeof p.poolVersion === 'number' && Number.isInteger(p.poolVersion))
      ? Math.max(1, p.poolVersion)
      : 1,
    modifiedAt: typeof p.modifiedAt === 'string' ? p.modifiedAt : new Date().toISOString(),
    ...(typeof p.seedVersion === 'number' && Number.isInteger(p.seedVersion) && p.seedVersion >= 0
      ? { seedVersion: p.seedVersion }
      : {}),
    calendars: Array.isArray(p.calendars)
      ? p.calendars.map((c) => (c && typeof c === 'object' ? withRepairedFirstBlockScalar(c) : c))
      : [],
    resources: Array.isArray(p.resources) ? p.resources : [],
  };
}

function parseTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function isPoolNewer(local: CompanyPool | undefined, imported: CompanyPool): boolean {
  if (!local) return false;
  return local.poolVersion > imported.poolVersion || parseTime(local.modifiedAt) > parseTime(imported.modifiedAt);
}

export function makeOrigin(pool: CompanyPool, libraryItemId: string, syncedHash?: string): LibraryOrigin {
  return {
    companyId: pool.companyId,
    libraryItemId,
    poolVersion: pool.poolVersion,
    ...(syncedHash !== undefined ? { syncedHash } : {}),
  };
}

export function stripLibraryOrigins(
  target: { resources: Resource[]; calendars: WorkCalendar[] },
  companyId?: string,
): void {
  const strip = <T extends { libraryOrigin?: LibraryOrigin }>(item: T): T => {
    if (companyId !== undefined && item.libraryOrigin?.companyId !== companyId) return item;
    const { libraryOrigin: _drop, ...rest } = item;
    return rest as T;
  };
  target.resources = target.resources.map(strip);
  target.calendars = target.calendars.map(strip);
}

export function findCopyByOrigin<T extends { libraryOrigin?: LibraryOrigin }>(
  items: T[], companyId: string, libraryItemId: string,
): T | undefined {
  if (!companyId || !libraryItemId) return undefined;
  return items.find(
    (i) => i.libraryOrigin?.companyId === companyId && i.libraryOrigin?.libraryItemId === libraryItemId,
  );
}

export interface CalendarCopyResult {
  calendar: WorkCalendar;
  reused: boolean;
}

function poolCalendarById(pool: CompanyPool, id: string | undefined): WorkCalendar | undefined {
  const cal = id ? pool.calendars.find((c) => c.id === id) : undefined;
  return cal ? withRepairedFirstBlockScalar(cal) : undefined;
}

export function copyCalendarToProject(
  pool: CompanyPool,
  poolCalendarId: string,
  existingCalendars: WorkCalendar[],
  genId: (prefix: string) => string,
): CalendarCopyResult | null {
  const source = poolCalendarById(pool, poolCalendarId);
  if (!source) return null;
  const existing = findCopyByOrigin(existingCalendars, pool.companyId, poolCalendarId);
  if (existing) return { calendar: existing, reused: true };
  const calendar: WorkCalendar = {
    ...structuredClone(source),
    id: genId('cal'),
    libraryOrigin: makeOrigin(pool, poolCalendarId, computeCalendarHash(source)),
  };
  return { calendar, reused: false };
}

export interface ResourceCopyResult {
  resource: Resource;
  reused: boolean;
  travelingCalendar?: CalendarCopyResult;
}

export function copyResourceToProject(
  pool: CompanyPool,
  poolResourceId: string,
  existingResources: Resource[],
  existingCalendars: WorkCalendar[],
  genId: (prefix: string) => string,
): ResourceCopyResult | null {
  const source = pool.resources.find((r) => r.id === poolResourceId);
  if (!source) return null;
  const existing = findCopyByOrigin(existingResources, pool.companyId, poolResourceId);
  if (existing) return { resource: existing, reused: true };

  let travelingCalendar: CalendarCopyResult | undefined;
  let calendarId = source.calendarId;
  if (isCostResource(source)) {
    calendarId = undefined;
  } else if (source.calendarId && pool.calendars.some((c) => c.id === source.calendarId)) {
    travelingCalendar = copyCalendarToProject(pool, source.calendarId, existingCalendars, genId) ?? undefined;
    calendarId = travelingCalendar?.calendar.id;
  } else {
    calendarId = undefined;
  }

  const resource: Resource = {
    ...structuredClone(source),
    id: genId('res'),
    calendarId,
    libraryOrigin: makeOrigin(pool, poolResourceId, computeResourceHash(source)),
    parentId: undefined,
  };
  if (isCostResource(resource)) clearCostResourceFields(resource);
  return { resource, reused: false, travelingCalendar };
}

export type ItemDiff =
  | { status: 'removed' }
  | { status: 'up-to-date' }
  | { status: 'changed'; fields: DiffField[] };

export interface DiffField {
  field: string;
  project: unknown;
  library: unknown;
}

const CALENDAR_HASH_V1_FIELDS: readonly (keyof WorkCalendar)[] = [
  'name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
  'holidays', 'generation', 'workTime', 'shift',
];

const CALENDAR_FIELDS_AFTER_V1: readonly (keyof WorkCalendar)[] = [
  'simpleBreakStartMinute', 'simpleBreakDurationMinutes', 'workingExceptions',
];

export const CALENDAR_DIFF_FIELDS: (keyof WorkCalendar)[] = [...CALENDAR_HASH_V1_FIELDS, ...CALENDAR_FIELDS_AFTER_V1];

export const RESOURCE_DIFF_FIELDS: (keyof Resource)[] = [
  'name', 'type', 'description', 'costPerHour', 'unitOfMeasure',
];

export function diffKey(value: unknown): string {
  if (Array.isArray(value)) {
    const sorted = value
      .map((el) => JSON.stringify(el))
      .sort();
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

function diffFields<T>(project: T, library: T, fields: (keyof T)[]): DiffField[] {
  const out: DiffField[] = [];
  for (const f of fields) {
    const a = project[f];
    const b = library[f];
    if (diffKey(a) !== diffKey(b)) {
      out.push({ field: String(f), project: a, library: b });
    }
  }
  return out;
}

function hashFields<T>(item: T, fields: readonly (keyof T)[]): string {
  return JSON.stringify(fields.map((f) => diffKey(item[f])));
}

export function computeCalendarHash(cal: WorkCalendar): string {
  const later = CALENDAR_FIELDS_AFTER_V1.some((f) => cal[f] !== undefined);
  return hashFields(cal, later ? CALENDAR_DIFF_FIELDS : CALENDAR_HASH_V1_FIELDS);
}

function calendarMatchesStamp(projectCal: WorkCalendar, source: WorkCalendar | undefined, syncedHash: string): boolean {
  const matches = (cal: WorkCalendar) => computeCalendarHash(cal) === syncedHash
    || (source !== undefined
      && hashFields(cal, CALENDAR_HASH_V1_FIELDS) === syncedHash
      && CALENDAR_FIELDS_AFTER_V1.every((f) => diffKey(cal[f]) === diffKey(source[f])));
  if (matches(projectCal)) return true;
  const legacy = firstBlockScalarVariant(projectCal);
  return legacy !== undefined && matches(legacy);
}

export function computeResourceHash(res: Resource): string {
  return hashFields(res, RESOURCE_DIFF_FIELDS);
}

const INVISIBLE_FORMATTING_CHARS = /[\u200B-\u200D\uFEFF\u00AD]/g;

export function normalizeName(name: string): string {
  return name.normalize('NFC').replace(INVISIBLE_FORMATTING_CHARS, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function matchByName<T extends { name: string }>(name: string, candidates: T[]): T | null {
  const target = normalizeName(name);
  if (!target) return null;
  const hits = candidates.filter((c) => normalizeName(c.name) === target);
  return hits.length === 1 ? hits[0] : null;
}

export function createNameMatcher<T extends { name: string }>(candidates: T[]): (name: string) => T | null {
  const byName = new Map<string, T | null>();
  for (const candidate of candidates) {
    const name = normalizeName(candidate.name);
    if (!name) continue;
    byName.set(name, byName.has(name) ? null : candidate);
  }
  return (name) => byName.get(normalizeName(name)) ?? null;
}

export function resolveUniqueCompanyName(rawName: string, existingNames: string[]): string {
  const base = normalizeName(rawName) ? rawName.trim() : (i18next.isInitialized
    ? i18next.t('companyLibrary.newCompany', { ns: 'common' })
    : 'Nieuwe resourcebibliotheek');
  const existing = new Set(existingNames.map(normalizeName));
  if (!existing.has(normalizeName(base))) return base;
  let n = 2;
  while (existing.has(normalizeName(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}

export function diffCalendarVsPool(projectCal: WorkCalendar, pool: CompanyPool): ItemDiff {
  const id = projectCal.libraryOrigin?.libraryItemId;
  const source = poolCalendarById(pool, id);
  if (!source) return { status: 'removed' };
  const fields = diffFields(projectCal, source, CALENDAR_DIFF_FIELDS);
  return fields.length === 0 ? { status: 'up-to-date' } : { status: 'changed', fields };
}

export function diffResourceVsPool(projectRes: Resource, pool: CompanyPool): ItemDiff {
  const id = projectRes.libraryOrigin?.libraryItemId;
  const source = id ? pool.resources.find((r) => r.id === id) : undefined;
  if (!source) return { status: 'removed' };
  const fields = diffFields(projectRes, source, RESOURCE_DIFF_FIELDS);
  return fields.length === 0 ? { status: 'up-to-date' } : { status: 'changed', fields };
}

export type OnOpenStatus =
  | 'in-sync'
  | 'behind'
  | 'deviated'
  | 'removed'
  | 'unbound';

function classifyOnOpen(
  diffStatus: ItemDiff['status'],
  syncedHash: string | undefined,
  fileMatchesStamp: (syncedHash: string) => boolean,
): OnOpenStatus {
  if (diffStatus === 'removed') return 'removed';
  if (diffStatus === 'up-to-date') return 'in-sync';
  if (syncedHash === undefined) return 'deviated';
  return fileMatchesStamp(syncedHash) ? 'behind' : 'deviated';
}

export function classifyCalendarOnOpen(projectCal: WorkCalendar, pool: CompanyPool): OnOpenStatus {
  if (!projectCal.libraryOrigin) return 'unbound';
  const source = poolCalendarById(pool, projectCal.libraryOrigin.libraryItemId);
  return classifyOnOpen(diffCalendarVsPool(projectCal, pool).status, projectCal.libraryOrigin.syncedHash,
    (synced) => calendarMatchesStamp(projectCal, source, synced));
}

export function classifyResourceOnOpen(projectRes: Resource, pool: CompanyPool): OnOpenStatus {
  if (!projectRes.libraryOrigin) return 'unbound';
  return classifyOnOpen(diffResourceVsPool(projectRes, pool).status, projectRes.libraryOrigin.syncedHash,
    (synced) => computeResourceHash(projectRes) === synced);
}

export function isResourceFieldLocked(status: OnOpenStatus | null): boolean {
  return status !== null && status !== 'removed' && status !== 'unbound';
}

function applyDiffFields<T>(target: T, source: T, fields: readonly (keyof T)[]): T {
  const patched: T = structuredClone(target);
  for (const f of fields) {
    patched[f] = structuredClone(source[f]);
  }
  return patched;
}

export function applyCalendarUpdate(projectCal: WorkCalendar, pool: CompanyPool): WorkCalendar {
  const id = projectCal.libraryOrigin?.libraryItemId;
  const source = poolCalendarById(pool, id);
  if (!source) {
    throw new Error(`applyCalendarUpdate: pool-origineel niet gevonden voor kalender "${projectCal.name}" (id=${projectCal.id}, libraryItemId=${id ?? 'ontbreekt'})`);
  }
  const patched = applyDiffFields(projectCal, source, CALENDAR_DIFF_FIELDS);
  patched.libraryOrigin = makeOrigin(pool, id!, computeCalendarHash(source));
  return patched;
}

export function applyResourceUpdate(
  projectRes: Resource,
  pool: CompanyPool,
  assignments: readonly Pick<ResourceAssignment, 'resourceId'>[],
): Resource {
  const id = projectRes.libraryOrigin?.libraryItemId;
  const source = id ? pool.resources.find((r) => r.id === id) : undefined;
  if (!source) {
    throw new Error(`applyResourceUpdate: pool-origineel niet gevonden voor resource "${projectRes.name}" (id=${projectRes.id}, libraryItemId=${id ?? 'ontbreekt'})`);
  }
  if (resourceUpdateBlocked(projectRes, pool, assignments)) {
    const kept = structuredClone(projectRes);
    kept.libraryOrigin = makeOrigin(pool, id!, computeResourceHash(source));
    return kept;
  }
  const patched = applyDiffFields(projectRes, source, RESOURCE_DIFF_FIELDS);
  if (isCostResource(patched)) clearCostResourceFields(patched);
  patched.libraryOrigin = makeOrigin(pool, id!, computeResourceHash(source));
  return patched;
}

export function resourceUpdateBlocked(
  projectRes: Resource,
  pool: CompanyPool,
  assignments: readonly Pick<ResourceAssignment, 'resourceId'>[],
): boolean {
  const id = projectRes.libraryOrigin?.libraryItemId;
  const source = id ? pool.resources.find((r) => r.id === id) : undefined;
  if (!source || source.type === projectRes.type) return false;
  if (source.type !== 'COST' && projectRes.type !== 'COST') return false;
  return assignments.some((a) => a.resourceId === projectRes.id);
}
