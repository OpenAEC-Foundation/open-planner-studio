import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { computeHistogramReport } from '@/engine/scheduler/ResourceLoad';
import { type ReportContext, resolvePeriodFor, round1 } from './reportCommon';
import type { ReportingPeriod } from './reportingPeriod';

/**
 * Resourcebelasting per week of maand (discussie #31, rapport 8, tabelvorm; issue #119/#120): per
 * resource per periode de gevraagde inzet tegenover de beschikbare capaciteit, met het verschil en
 * een overbelastingsvlag.
 *
 * Rekenkern is `computeHistogramReport` (week- of maandbuckets) — exact dezelfde dagverdeling als
 * het histogram op het Resources-tabblad, dus een weekrij toont hetzelfde getal als de grafiek (de
 * maandbucket kent het scherm niet; die is dezelfde verdeling, anders opgeteld). Eenheid:
 * eenheid-dagen per bucket (som over de werkdagen van units/dag). De rapportageperiode kiest welke
 * buckets meedoen: elke kalenderweek/-maand die de periode raakt, in z'n geheel — de buckets
 * blijven hele kalenderweken/-maanden, net als in het histogram, zodat een rij altijd hetzelfde
 * getal toont als de grafiek. De histogramGRAFIEK zelf zit bewust niet in dit rapport: die staat
 * al op het scherm, en een tabel is wat je in een bemensingsoverleg naast elkaar legt.
 */
export type ResourceLoadingBucket = 'week' | 'month';

export interface ResourceLoadingRow {
  resourceId: string;
  resourceName: string;
  resourceType: Resource['type'];
  /** Eerste dag van de bucket (maandag resp. de 1e van de maand). */
  bucketStart: string;
  bucketEnd: string;
  required: number;
  available: number;
  /** available − required (negatief = tekort). */
  variance: number;
  peakDayLoad: number;
  overloaded: boolean;
  overloadedDays: number;
}

export interface ResourceLoadingOptions {
  /** Rapportageperiode (issue #120); `project` = de hele projectspanne. */
  period: ReportingPeriod;
  /** Aggregatie per kalenderweek of per kalendermaand (issue #119). */
  bucket: ResourceLoadingBucket;
  onlyOverloaded: boolean;
}

export interface ResourceLoadingResult {
  from: string;
  to: string;
  statusDateMissing: boolean;
  rows: ResourceLoadingRow[];
  /** Alle tellingen gaan over de rijen in de tabel — dus ná het `onlyOverloaded`-filter. */
  counts: { resources: number; buckets: number; overloadedBuckets: number; overloadedResources: number };
}

export function computeResourceLoading(ctx: ReportContext, opts: ResourceLoadingOptions): ResourceLoadingResult {
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
  });
  const byId = new Map(ctx.resources.map(r => [r.id, r]));
  const rows: ResourceLoadingRow[] = [];
  const overloadedResources = new Set<string>();
  let buckets = 0;
  for (const entry of report.resources) {
    const res = byId.get(entry.resourceId);
    if (!res) continue;
    for (const b of entry.buckets) {
      // Alleen buckets MET vraag: een lege week met capaciteit is geen belasting, en zou de tabel
      // voor elke resource over de hele projectspanne volspoelen met nullen.
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
      // Resources in de tabel — dezelfde telling als het toewijzingenrapport (#119).
      resources: new Set(rows.map(r => r.resourceId)).size,
      buckets,
      overloadedBuckets: rows.filter(r => r.overloaded).length,
      overloadedResources: overloadedResources.size,
    },
  };
}
