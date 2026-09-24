import type { Task } from '@/types/task';
import type { Baseline, BaselineTask } from '@/types/baseline';
import type { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseDate } from '@/utils/dateUtils';
import { shownStart, shownFinish } from '@/utils/taskDates';

/**
 * Variance-berekening (fase 2.6): vergelijkt de huidige (CPM-)datums met een actieve baseline.
 * Puur (geen store/React) zodat de headless testharnas en de latere React-hook (golf 3) dezelfde
 * bron delen.
 */
export type VarianceStatus = 'onSchedule' | 'late' | 'early' | 'new' | 'dropped';

export interface VarianceRow {
  taskId: string;
  wbs: string;
  name: string;
  baselineStart?: string;   // undefined bij "nieuw"
  baselineFinish?: string;
  currentStart?: string;    // undefined bij "vervallen"
  currentFinish?: string;
  deltaStart?: number;      // werkdagen, signed (+later, −eerder)
  deltaFinish?: number;
  status: VarianceStatus;
}

export interface VarianceResult {
  rows: VarianceRow[];
  /** Projecteinde-delta in werkdagen (signed) — undefined als baseline/huidig geen einde heeft. */
  projectEndDelta?: number;
}

/** Getekend werkdag-verschil tussen twee ISO-datums (op dagniveau): a≤b ⇒ +stappen, a>b ⇒
 *  −stappen — `CalendarEngine.signedWorkDaysBetween`, dezelfde telling als de CPM-speling. */
export function signedWorkDaysBetween(cal: CalendarEngine, aIso: string, bIso: string): number {
  return cal.signedWorkDaysBetween(parseDate(aIso), parseDate(bIso));
}

function statusFromDelta(deltaFinish: number): VarianceStatus {
  if (deltaFinish > 0) return 'late';
  if (deltaFinish < 0) return 'early';
  return 'onSchedule';
}

/**
 * Bereken de variance-rijen (leaf-taken) tegen de actieve baseline.
 * @param tasks       de huidige taken (summary + leaf); alleen leaves tellen mee.
 * @param baseline    de actieve baseline of null ⇒ lege uitkomst.
 * @param cal         kalender-engine voor werkdag-deltas.
 * @param currentEnd  het huidige projecteinde (cpmResult.projectEnd) voor de samenvatting.
 */
export function computeVariance(
  tasks: Task[],
  baseline: Baseline | null,
  cal: CalendarEngine,
  currentEnd?: string,
): VarianceResult {
  if (!baseline) return { rows: [] };

  const leaves = tasks.filter((t) => t.childIds.length === 0);
  const baseMap = new Map<string, BaselineTask>();
  for (const bt of baseline.tasks) baseMap.set(bt.taskId, bt);
  const currentIds = new Set(leaves.map((t) => t.id));

  const rows: VarianceRow[] = [];

  for (const t of leaves) {
    const currentStart = shownStart(t);
    const currentFinish = shownFinish(t);
    const bt = baseMap.get(t.id);
    if (!bt) {
      rows.push({
        taskId: t.id, wbs: t.wbsCode, name: t.name,
        currentStart, currentFinish, status: 'new',
      });
      continue;
    }
    const deltaStart = signedWorkDaysBetween(cal, bt.start, currentStart);
    const deltaFinish = signedWorkDaysBetween(cal, bt.finish, currentFinish);
    rows.push({
      taskId: t.id, wbs: t.wbsCode, name: t.name,
      baselineStart: bt.start, baselineFinish: bt.finish,
      currentStart, currentFinish,
      deltaStart, deltaFinish,
      status: statusFromDelta(deltaFinish),
    });
  }

  // Vervallen: in de baseline, niet meer in het huidige plan.
  for (const bt of baseline.tasks) {
    if (currentIds.has(bt.taskId)) continue;
    rows.push({
      taskId: bt.taskId, wbs: '', name: '',
      baselineStart: bt.start, baselineFinish: bt.finish,
      status: 'dropped',
    });
  }

  const result: VarianceResult = { rows };
  if (baseline.projectEnd && currentEnd) {
    result.projectEndDelta = signedWorkDaysBetween(cal, baseline.projectEnd, currentEnd);
  }
  return result;
}
