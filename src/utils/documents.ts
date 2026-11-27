import type { Task } from '@/types/task';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { basename } from '@/utils/filePath';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { parseInstant } from '@/utils/dateUtils';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { maxOf, minOf } from '@/utils/collections';

export const DOC_PALETTE = [
  '#D97706', '#2563EB', '#16A34A', '#7C3AED',
  '#DB2777', '#0891B2', '#CA8A04', '#0D9488',
];

export function documentColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DOC_PALETTE[h % DOC_PALETTE.length];
}

export function documentCode(title: string): string {
  const words = title.trim().split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return '–';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function documentTitle(
  filePath: string | null,
  projectName: string,
  projectCode?: string | null,
): string {
  if (filePath) {
    return basename(filePath).replace(/\.[^.]+$/, '');
  }
  if (projectCode) return nameWithProjectCode(projectName, projectCode);
  return projectName || '';
}

export const DEFAULT_PROJECT_FILE_BASE = 'project';
export function projectFileBase(projectName: string): string {
  return (projectName ?? '').trim() || DEFAULT_PROJECT_FILE_BASE;
}

export function documentFileBase(projectName: string, projectCode?: string | null): string {
  return projectFileBase(projectCode ? nameWithProjectCode(projectName, projectCode) : projectName);
}

export function untitledOrdinals(rawTitles: string[]): (number | undefined)[] {
  const untitledCount = rawTitles.filter((t) => !t).length;
  let seen = 0;
  return rawTitles.map((t) => {
    if (t) return undefined;
    seen++;
    return untitledCount > 1 && seen > 1 ? seen : undefined;
  });
}

export function displayDocumentTitle(
  raw: string,
  ordinal: number | undefined,
  untitledLabel: string,
): string {
  if (raw) return raw;
  return ordinal === undefined ? untitledLabel : `${untitledLabel} (${ordinal})`;
}

export interface DocStats {
  taskCount: number;
  milestoneCount: number;
  criticalCount: number;
  endDate: string | null;
}

export function buildStats(tasks: Task[], cpm: CPMResult | null, projectEnd: string): DocStats {
  const leaves = tasks.filter(isLeafTask);
  const milestoneCount = tasks.filter((t) => t.isMilestone).length;
  const criticalCount = cpm
    ? cpm.criticalPath.length
    : tasks.filter((t) => t.time.isCritical).length;
  const endDate = (cpm?.projectEnd || projectEnd) || null;
  return { taskCount: leaves.length, milestoneCount, criticalCount, endDate };
}

export interface ThumbBar {
  topPct: number;
  leftPct: number;
  widthPct: number;
  color: string;
}

export function buildThumbnail(tasks: Task[], identityColor: string, maxBars = 9): ThumbBar[] {
  const points: { start: number; end: number; ms: boolean; crit: boolean }[] = [];
  for (const t of tasks) {
    if (isSummaryTask(t)) continue;
    const startStr = shownStart(t);
    if (!startStr) continue;
    const start = parseInstant(startStr).getTime();
    if (Number.isNaN(start)) continue;
    const finStr = shownFinish(t);
    const endRaw = finStr ? parseInstant(finStr).getTime() : start;
    const end = Number.isNaN(endRaw) ? start : Math.max(endRaw, start);
    points.push({ start, end, ms: t.isMilestone, crit: t.time.isCritical });
  }
  if (points.length === 0) return [];

  const min = minOf(points.map((p) => p.start));
  const max = maxOf(points.map((p) => p.end));
  const span = Math.max(1, max - min);

  points.sort((a, b) => a.start - b.start);
  const shown = points.slice(0, maxBars);
  return shown.map((p, i) => ({
    topPct: shown.length === 1 ? 46 : (i / (shown.length - 1)) * 84 + 8,
    leftPct: ((p.start - min) / span) * 100,
    widthPct: Math.max(3, ((p.end - p.start) / span) * 100),
    color: p.crit ? 'var(--theme-critical-text)' : p.ms ? 'var(--color-task-milestone)' : identityColor,
  }));
}
