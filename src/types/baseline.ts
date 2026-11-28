import type { MilestoneKind } from './task';

export interface BaselineTask {
  taskId: string;
  sourceTaskId?: string;
  sourceTaskCode?: string;
  start: string;
  finish: string;
  duration: number;
  isMilestone: boolean;
  milestoneKind?: MilestoneKind;
}

export interface BaselineOverlayEntry {
  start: string;
  finish: string;
  isMilestone: boolean;
}

export type BaselineOverlay = Map<string, BaselineOverlayEntry>;

export interface Baseline {
  id: string;
  sourceProjectId?: string;
  name: string;
  createdAt: string;
  tasks: BaselineTask[];
  projectEnd: string;
  projectDuration: number;
}

export function baselineStart(b: Baseline): string {
  let first = '';
  for (const t of b.tasks ?? []) if (t.start && (!first || t.start < first)) first = t.start;
  return first;
}

export function buildBaselineOverlay(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
): BaselineOverlay | undefined {
  if (!activeBaselineId) return undefined;
  const active = baselines.find(b => b.id === activeBaselineId);
  if (!active) return undefined;
  const map: BaselineOverlay = new Map();
  for (const task of active.tasks) {
    map.set(task.taskId, { start: task.start, finish: task.finish, isMilestone: task.isMilestone });
  }
  return map;
}

export type BaselineLayerSlot = 0 | 1 | 2;

export type ComparedBaselineIds = [string | null, string | null];

export const noComparedBaselines = (): ComparedBaselineIds => [null, null];

export interface BaselineLayer {
  slot: BaselineLayerSlot;
  baselineId: string;
  name: string;
  overlay: BaselineOverlay;
}

export const MAX_COMPARED_BASELINES = 2;

export function normalizeComparedBaselines(
  compared: readonly (string | null | undefined)[] | null | undefined,
  baselines: readonly Baseline[],
  activeBaselineId: string | null | undefined,
): ComparedBaselineIds {
  const seen = new Set<string>();
  const clean = (id: string | null | undefined): string | null => {
    if (!id || id === activeBaselineId || seen.has(id) || !baselines.some(b => b.id === id)) return null;
    seen.add(id);
    return id;
  };
  const next: ComparedBaselineIds = [clean(compared?.[0]), clean(compared?.[1])];
  if (Array.isArray(compared) && compared.length === 2 && compared[0] === next[0] && compared[1] === next[1]) {
    return compared as ComparedBaselineIds;
  }
  return next;
}

export function buildBaselineLayers(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
  compared: readonly (string | null)[],
): BaselineLayer[] {
  const layers: BaselineLayer[] = [];
  const add = (id: string | null | undefined, slot: BaselineLayerSlot) => {
    if (!id) return;
    if (slot !== 0 && id === activeBaselineId) return;
    const baseline = baselines.find(b => b.id === id);
    if (!baseline) return;
    const overlay = buildBaselineOverlay(baselines, id);
    if (!overlay) return;
    layers.push({ slot, baselineId: id, name: baseline.name, overlay });
  };
  add(activeBaselineId, 0);
  compared.slice(0, MAX_COMPARED_BASELINES).forEach((id, i) => add(id, (i + 1) as BaselineLayerSlot));
  return layers;
}

export function comparisonOverlays(layers: readonly BaselineLayer[]): { slot: 1 | 2; overlay: BaselineOverlay }[] {
  return layers
    .filter((layer): layer is BaselineLayer & { slot: 1 | 2 } => layer.slot !== 0)
    .map(layer => ({ slot: layer.slot, overlay: layer.overlay }));
}

export interface BaselineReach {
  earliest: string | null;
  latest: string | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

export function baselineReach(overlays: Iterable<BaselineOverlay>): BaselineReach {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const overlay of overlays) {
    for (const entry of overlay.values()) {
      const s = (entry.start || entry.finish).slice(0, 10);
      const f = (entry.finish || entry.start).slice(0, 10);
      if (DAY_RE.test(s) && (earliest === null || s < earliest)) earliest = s;
      if (DAY_RE.test(f) && (latest === null || f > latest)) latest = f;
    }
  }
  return { earliest, latest };
}

export function shownBaselineReach(
  baselines: Baseline[],
  activeBaselineId: string | null | undefined,
  compared: readonly (string | null)[] | undefined,
): BaselineReach {
  return baselineReach(buildBaselineLayers(baselines, activeBaselineId, compared ?? []).map(l => l.overlay));
}

export function toggleComparedBaseline(
  compared: readonly [string | null, string | null],
  id: string,
): ComparedBaselineIds {
  const next: ComparedBaselineIds = [compared[0], compared[1]];
  const at = next.indexOf(id);
  if (at >= 0) {
    next[at] = null;
    return next;
  }
  const free = next.indexOf(null);
  if (free < 0) return next;
  next[free] = id;
  return next;
}
