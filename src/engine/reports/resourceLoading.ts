import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { type SolvedReportContext, resolvePeriodFor, round1 } from './reportCommon';
import type { ReportingPeriod } from './reportingPeriod';

export type ResourceLoadingBucket = 'week' | 'month';

export interface ResourceLoadingRow {
  resourceId: string;
  resourceName: string;
  resourceType: Resource['type'];
  bucketStart: string;
  bucketEnd: string;
  required: number;
  available: number;
  variance: number;
  peakDayLoad: number;
  overloaded: boolean;
  overloadedDays: number;
}

export interface ResourceLoadingOptions {
  period: ReportingPeriod;
  bucket: ResourceLoadingBucket;
  onlyOverloaded: boolean;
}

export interface ResourceLoadingResult {
  from: string;
  to: string;
  statusDateMissing: boolean;
  rows: ResourceLoadingRow[];
  counts: { resources: number; buckets: number; overloadedBuckets: number; overloadedResources: number };
}

export function computeResourceLoading(ctx: SolvedReportContext, opts: ResourceLoadingOptions): ResourceLoadingResult {
  const { from, to, statusDateMissing } = resolvePeriodFor(ctx, opts.period);
  const report = computeHistogramReport({
    tasks: ctx.tasks as Task[],
    sequences: ctx.sequences as Sequence[],
    assignments: ctx.assignments as ResourceAssignment[],
    resources: ctx.resources as Resource[],
    calendar: ctx.calendar,
    calendars: ctx.calendars as WorkCalendar[],
    cpmResult: ctx.cpmResult,
    from,
    to,
    bucket: opts.bucket === 'month' ? 'maand' : 'week',
    schedulingOptions: ctx.solveOptions.schedulingOptions,
  });
  const byId = new Map(ctx.resources.map(r => [r.id, r]));
  const rows: ResourceLoadingRow[] = [];
  const overloadedResources = new Set<string>();
  let buckets = 0;
  for (const entry of report.resources) {
    const res = byId.get(entry.resourceId);
    if (!res) continue;
    for (const b of entry.buckets) {
      if (b.load === 0) continue;
      const overloaded = b.overallocatedDays.length > 0;
      if (opts.onlyOverloaded && !overloaded) continue;
      buckets++;
      if (overloaded) overloadedResources.add(res.id);
      rows.push({
        resourceId: res.id,
        resourceName: res.name,
        resourceType: res.type,
        bucketStart: b.start,
        bucketEnd: b.end,
        required: round1(b.load),
        available: round1(b.capacity),
        variance: round1(b.capacity - b.load),
        peakDayLoad: round1(b.peakDayLoad),
        overloaded,
        overloadedDays: b.overallocatedDays.length,
      });
    }
  }
  const relative = opts.period.preset !== 'project' && opts.period.preset !== 'custom';
  return {
    from, to,
    statusDateMissing: relative && statusDateMissing,
    rows,
    counts: {
      resources: new Set(rows.map(r => r.resourceId)).size,
      buckets,
      overloadedBuckets: rows.filter(r => r.overloaded).length,
      overloadedResources: overloadedResources.size,
    },
  };
}
