import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { type ReportContext, round1 } from './reportCommon';

/**
 * Resourcebelasting per week (discussie #31, rapport 8, tabelvorm): per resource per week de
 * gevraagde inzet tegenover de beschikbare capaciteit, met het verschil en een overbelastingsvlag.
 *
 * Rekenkern is `computeHistogramReport` (week-buckets) — exact dezelfde verdeling als het
 * histogram op het Resources-tabblad, dus tabel en scherm spreken elkaar nooit tegen. Eenheid:
 * eenheid-dagen per week (som over de werkdagen van units/dag). De histogramGRAFIEK zelf zit
 * bewust niet in dit rapport: die staat al op het scherm, en een tabel is wat je in een
 * bemensingsoverleg naast elkaar legt.
 */
export interface ResourceLoadingRow {
  resourceId: string;
  resourceName: string;
  resourceType: Resource['type'];
  weekStart: string;
  weekEnd: string;
  required: number;
  available: number;
  /** available − required (negatief = tekort). */
  variance: number;
  peakDayLoad: number;
  overloaded: boolean;
  overloadedDays: number;
}

export interface ResourceLoadingOptions {
  onlyOverloaded: boolean;
}

export interface ResourceLoadingResult {
  rows: ResourceLoadingRow[];
  counts: { resources: number; weeks: number; overloadedWeeks: number; overloadedResources: number };
}

export function computeResourceLoading(ctx: ReportContext, opts: ResourceLoadingOptions): ResourceLoadingResult {
  const report = computeHistogramReport({
    tasks: ctx.tasks as Task[],
    sequences: ctx.sequences as Sequence[],
    assignments: ctx.assignments as ResourceAssignment[],
    resources: ctx.resources as Resource[],
    calendar: ctx.calendar,
    calendars: ctx.calendars as WorkCalendar[],
    cpmResult: ctx.cpmResult,
    bucket: 'week',
  });
  const byId = new Map(ctx.resources.map(r => [r.id, r]));
  const rows: ResourceLoadingRow[] = [];
  const overloadedResources = new Set<string>();
  let weeks = 0;
  for (const entry of report.resources) {
    const res = byId.get(entry.resourceId);
    if (!res) continue;
    for (const b of entry.buckets) {
      // Alleen weken MET vraag: een lege week met capaciteit is geen belasting, en zou de tabel
      // voor elke resource over de hele projectspanne volspoelen met nullen.
      if (b.load === 0) continue;
      weeks++;
      const overloaded = b.overallocatedDays.length > 0;
      if (overloaded) overloadedResources.add(res.id);
      if (opts.onlyOverloaded && !overloaded) continue;
      rows.push({
        resourceId: res.id,
        resourceName: res.name,
        resourceType: res.type,
        weekStart: b.start,
        weekEnd: b.end,
        required: round1(b.load),
        available: round1(b.capacity),
        variance: round1(b.capacity - b.load),
        peakDayLoad: round1(b.peakDayLoad),
        overloaded,
        overloadedDays: b.overallocatedDays.length,
      });
    }
  }
  return {
    rows,
    counts: {
      resources: report.resources.length,
      weeks,
      overloadedWeeks: rows.filter(r => r.overloaded).length,
      overloadedResources: overloadedResources.size,
    },
  };
}
