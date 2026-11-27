import type { Task, ExternalLink } from '@/types/task';
import { externalSourceSide, isValidExternalLagValue, normalizeExternalSourcePath } from '@/engine/taskGrid/relationFormat';
import { isRecord } from '@/utils/guards';
import { computedStart, computedFinish } from '@/utils/taskDates';
import { isPinnedComplete } from '@/engine/scheduler/duration';

export { externalSourceSide };

export interface ExternalSourceDoc {
  projectId: string;
  filePath?: string;
  siteFileId?: string;
  projectName?: string;
  tasks: Task[];
  lateDatesInFile?: Readonly<Record<string, LateDatesInFile>>;
  version?: string;
  readAt?: string;
}

export interface LateDatesInFile {
  start: boolean;
  finish: boolean;
}

export interface RefreshResult {
  tasks: Task[];
  refreshed: number;
  missing: number;
  changed: boolean;
}

export type ExternalSourceMatchScope = 'project-or-path' | 'file-path' | 'project-without-path' | 'site-file';

export type ExternalSourceLocator =
  | { kind: 'path'; filePath: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'site'; siteFileId: string };

export function externalSourceLocatorOf(
  ref: Pick<ExternalLink['sourceRef'], 'projectId' | 'filePath' | 'siteFileId'>,
): ExternalSourceLocator | null {
  const siteFileId = ref.siteFileId?.trim();
  if (siteFileId) return { kind: 'site', siteFileId };
  if (ref.filePath) return normalizeExternalSourcePath(ref.filePath) === null ? null : { kind: 'path', filePath: ref.filePath };
  const projectId = ref.projectId.trim();
  return projectId ? { kind: 'project', projectId } : null;
}

const PROJECT_KEY_PREFIX = 'project:';
const SITE_KEY_PREFIX = 'site:';

export function externalSourceKey(locator: ExternalSourceLocator): string | null {
  if (locator.kind === 'path') return normalizeExternalSourcePath(locator.filePath);
  return locator.kind === 'site'
    ? `${SITE_KEY_PREFIX}${locator.siteFileId}`
    : `${PROJECT_KEY_PREFIX}${locator.projectId}`;
}

export function externalSourceKeyOfDoc(source: Pick<ExternalSourceDoc, 'projectId' | 'filePath' | 'siteFileId'>): string | null {
  const locator = externalSourceLocatorOf(source);
  return locator ? externalSourceKey(locator) : null;
}

export function remainingUnreadSources(unreadProjectIds: readonly string[], readProjectIds: readonly string[]): string[] {
  const read = new Set(readProjectIds);
  return unreadProjectIds.filter(projectId => !read.has(projectId));
}

export function externalSourceScope(source: Pick<ExternalSourceDoc, 'filePath' | 'siteFileId'>): ExternalSourceMatchScope {
  if (source.siteFileId) return 'site-file';
  return source.filePath ? 'file-path' : 'project-without-path';
}

export function externalSourceScopeOf(locator: ExternalSourceLocator): ExternalSourceMatchScope {
  return locator.kind === 'site' ? 'site-file' : locator.kind === 'path' ? 'file-path' : 'project-without-path';
}

function sourceSideHappened(task: Task, side: 'start' | 'finish'): boolean {
  const done = isPinnedComplete(task.time);
  return side === 'finish' ? done : done || !!task.time.actualStart;
}

export function sourceAnchorDate(
  link: Pick<ExternalLink, 'direction' | 'relType'>,
  srcTask: Task,
  source?: Pick<ExternalSourceDoc, 'lateDatesInFile'>,
): string {
  const side = externalSourceSide(link.direction, link.relType);
  if (link.direction === 'successor') {
    const inFile = source?.lateDatesInFile ? source.lateDatesInFile[srcTask.id]?.[side] === true : true;
    const late = side === 'finish' ? srcTask.time.lateFinish : srcTask.time.lateStart;
    if (inFile && late && !sourceSideHappened(srcTask, side)) return late;
  }
  return side === 'finish'
    ? computedFinish(srcTask)
    : computedStart(srcTask);
}

export function linkMatchesSource(
  link: ExternalLink,
  source: ExternalSourceDoc,
  matchScope: ExternalSourceMatchScope = 'project-or-path',
): boolean {
  const linkSiteId = link.sourceRef.siteFileId?.trim();
  if (matchScope === 'site-file') {
    const sourceSiteId = source.siteFileId?.trim();
    return !!linkSiteId && !!sourceSiteId && linkSiteId === sourceSiteId;
  }
  if (linkSiteId) return false;
  if (matchScope === 'project-without-path') {
    return !link.sourceRef.filePath && !!link.sourceRef.projectId && link.sourceRef.projectId === source.projectId;
  }
  if (matchScope === 'project-or-path'
    && link.sourceRef.projectId
    && link.sourceRef.projectId === source.projectId) return true;
  if (!link.sourceRef.filePath || !source.filePath) return false;
  const linkPath = normalizeExternalSourcePath(link.sourceRef.filePath);
  const sourcePath = normalizeExternalSourcePath(source.filePath);
  return linkPath !== null && sourcePath !== null && linkPath === sourcePath;
}

export function withKeptAnchorProvenance<T extends Omit<ExternalLink, 'id'>>(next: T, old: ExternalLink | undefined): T {
  if (!old) return next;
  const a = old.sourceRef;
  const b = next.sourceRef;
  if (a.projectId !== b.projectId || a.taskId !== b.taskId || (a.filePath ?? '') !== (b.filePath ?? '')) return next;
  const out: T = { ...next };
  if (a.siteFileId !== undefined && b.siteFileId === undefined) out.sourceRef = { ...b, siteFileId: a.siteFileId };
  if (next.anchorDate === old.anchorDate) {
    if (next.sourceVersion === undefined && old.sourceVersion !== undefined) out.sourceVersion = old.sourceVersion;
    if (next.anchorReadAt === undefined && old.anchorReadAt !== undefined) out.anchorReadAt = old.anchorReadAt;
  }
  return out;
}

export function refreshExternalAnchors(
  tasks: Task[],
  source: ExternalSourceDoc,
  matchScope: ExternalSourceMatchScope = 'project-or-path',
  skip?: (link: ExternalLink) => boolean,
): RefreshResult {
  const srcById = new Map(source.tasks.map((t) => [t.id, t]));
  let refreshed = 0;
  let missing = 0;
  let anyChanged = false;

  const outTasks = tasks.map((task) => {
    if (!task.externalLinks || task.externalLinks.length === 0) return task;
    let taskChanged = false;
    const links = task.externalLinks.map((link): ExternalLink => {
      if (skip?.(link) || !linkMatchesSource(link, source, matchScope)) return link;

      const srcTask = srcById.get(link.sourceRef.taskId);
      if (!srcTask) {
        missing++;
        if (link.sourceMissing === true) return link;
        taskChanged = true;
        return { ...link, sourceMissing: true };
      }

      const anchorDate = sourceAnchorDate(link, srcTask, source);
      refreshed++;
      const nextRef = {
        ...link.sourceRef,
        projectId: source.projectId,
        projectName: source.projectName ?? link.sourceRef.projectName,
        taskName: srcTask.name,
        filePath: source.filePath ?? link.sourceRef.filePath,
      };
      const nextAnchor = anchorDate || link.anchorDate;
      const sameProvenance = (source.version ?? undefined) === link.sourceVersion && nextAnchor === link.anchorDate
        && (link.anchorReadAt !== undefined || source.readAt === undefined);
      if (
        link.anchorDate === anchorDate &&
        link.sourceMissing === false &&
        sameProvenance &&
        link.sourceRef.projectId === nextRef.projectId &&
        link.sourceRef.projectName === nextRef.projectName &&
        link.sourceRef.taskName === nextRef.taskName &&
        link.sourceRef.filePath === nextRef.filePath
      ) {
        return link;
      }
      taskChanged = true;
      const next: ExternalLink = { ...link, anchorDate: nextAnchor, sourceMissing: false, sourceRef: nextRef };
      if (!sameProvenance) {
        delete next.sourceVersion;
        delete next.anchorReadAt;
        if (source.version !== undefined) next.sourceVersion = source.version;
        if (source.readAt !== undefined) next.anchorReadAt = source.readAt;
      }
      return next;
    });
    if (!taskChanged) return task;
    anyChanged = true;
    return { ...task, externalLinks: links };
  });

  return { tasks: anyChanged ? outTasks : tasks, refreshed, missing, changed: anyChanged };
}

export function refreshFromSources(
  tasks: Task[],
  sources: readonly ExternalSourceDoc[],
  readPaths?: ReadonlySet<string>,
): RefreshResult {
  const pathsByProjectId = new Map<string, Set<string>>();
  for (const source of sources) {
    const projectId = source.projectId.trim();
    const sourcePath = normalizeExternalSourcePath(source.filePath ?? '');
    if (!projectId || sourcePath === null || source.siteFileId) continue;
    const sourcePaths = pathsByProjectId.get(projectId) ?? new Set<string>();
    sourcePaths.add(sourcePath);
    pathsByProjectId.set(projectId, sourcePaths);
  }
  const ambiguousProjectIds = new Set(
    [...pathsByProjectId].filter(([, sourcePaths]) => sourcePaths.size > 1).map(([projectId]) => projectId),
  );

  const skip = readPaths === undefined ? undefined : (link: ExternalLink) => {
    const locator = externalSourceLocatorOf(link.sourceRef);
    if (locator?.kind !== 'path') return false;
    const path = normalizeExternalSourcePath(locator.filePath);
    return path !== null && !readPaths.has(path);
  };

  let out = tasks;
  let refreshed = 0;
  let missing = 0;
  let changed = false;
  for (const source of sources) {
    const result = refreshExternalAnchors(
      out,
      source,
      externalSourceScope(source) !== 'file-path' ? externalSourceScope(source)
        : ambiguousProjectIds.has(source.projectId.trim()) ? 'file-path' : 'project-or-path',
      skip,
    );
    out = result.tasks;
    refreshed += result.refreshed;
    missing += result.missing;
    if (result.changed) changed = true;
  }
  return { tasks: out, refreshed, missing, changed };
}

export type ExternalAnchorProvenance =
  | { kind: 'site'; version: string; readAt?: Date }
  | { kind: 'file'; modified: Date; readAt?: Date }
  | { kind: 'read'; readAt: Date }
  | { kind: 'none' };

export function externalAnchorProvenance(
  link: Pick<ExternalLink, 'sourceVersion' | 'anchorReadAt' | 'sourceRef'>,
): ExternalAnchorProvenance {
  const time = (iso: string | undefined): Date | undefined => {
    if (!iso) return undefined;
    const date = new Date(iso);
    return isNaN(date.getTime()) ? undefined : date;
  };
  const readAt = time(link.anchorReadAt);
  const withRead = readAt ? { readAt } : {};
  if (link.sourceVersion) {
    if (link.sourceRef.siteFileId) return { kind: 'site', version: link.sourceVersion, ...withRead };
    const modified = time(link.sourceVersion);
    if (modified) return { kind: 'file', modified, ...withRead };
  }
  return readAt ? { kind: 'read', readAt } : { kind: 'none' };
}

const DIRECTIONS: readonly string[] = ['predecessor', 'successor'];
const RELATION_TYPES: readonly string[] = ['FS', 'SS', 'FF', 'SF'];
const OPTIONAL_SOURCE_FIELDS = ['projectName', 'taskName', 'filePath', 'siteFileId'] as const;
const OPTIONAL_PROVENANCE_FIELDS = ['sourceVersion', 'anchorReadAt'] as const;

export function storedExternalLinks(value: unknown): ExternalLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const used = new Set<string>();
  const uniqueId = (wanted: string): string => {
    let id = wanted;
    for (let n = 2; used.has(id); n++) id = `${wanted}-${n}`;
    used.add(id);
    return id;
  };
  const links: ExternalLink[] = [];
  value.forEach((raw, index) => {
    if (!isRecord(raw) || !isRecord(raw.sourceRef)) return;
    const { direction, relType, anchorDate, sourceRef } = raw;
    if (typeof direction !== 'string' || !DIRECTIONS.includes(direction)) return;
    if (typeof relType !== 'string' || !RELATION_TYPES.includes(relType)) return;
    if (typeof anchorDate !== 'string') return;
    if (typeof sourceRef.projectId !== 'string') return;
    if (typeof sourceRef.taskId !== 'string' || sourceRef.taskId === '') return;
    const ref: Record<string, unknown> = { ...sourceRef };
    for (const key of OPTIONAL_SOURCE_FIELDS) if (key in ref && typeof ref[key] !== 'string') delete ref[key];
    const link: Record<string, unknown> = {
      ...raw,
      id: uniqueId(typeof raw.id === 'string' && raw.id !== '' ? raw.id : `extlink-ifc-${index + 1}`),
      sourceRef: ref,
      sourceMissing: typeof raw.sourceMissing === 'boolean' ? raw.sourceMissing : true,
    };
    for (const key of ['lagDays', 'lagMinutes'] as const) {
      if (key in link && !isValidExternalLagValue(key, link[key])) delete link[key];
    }
    for (const key of OPTIONAL_PROVENANCE_FIELDS) if (key in link && typeof link[key] !== 'string') delete link[key];
    links.push(link as unknown as ExternalLink);
  });
  return links.length > 0 ? links : undefined;
}
