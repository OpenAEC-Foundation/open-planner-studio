import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import type { ResourceType } from '@/types/resource';
import { localTodayIso } from '@/utils/dateUtils';
import { makeMonthLabeler } from '@/utils/monthLabel';
import { formatReportNumber, formatSignedReportNumber, localizeDecimalPoint } from '@/utils/reportNumber';
import type { ReportType, TableReportOptions } from '@/utils/reportSettings';
import type { ReportingPeriod } from '@/engine/reports';
import { isTableReportType } from '@/utils/reportSettings';
import {
  type ReportContext, type LookAheadRow, type CriticalRow, type ProgressRow, type HealthCheck, type HealthItem,
  type ResourceLoadingRow, type ResourceAssignmentRow, type WbsSummaryRow,
  computeLookAhead, computeCriticalReport, computeProgressReport, computeScheduleHealth,
  computeResourceLoading, computeResourceAssignments, computeWbsSummary,
} from '@/engine/reports';
import { REPORT_COLORS, section, type ReportColumn, type ReportSummaryItem, type TableReportSpec } from './tableReportSpec';

/**
 * Bouwt per tabelrapporttype de `TableReportSpec` uit de live store: engine-uitvoer → vertaalde
 * kolommen, samenvatting en secties. Eén hook voor alle zeven rapporten, zodat `ReportPanel` er
 * niets van hoeft te weten behalve "is dit een tabelrapport, en wat is de spec".
 *
 * Alle store-lezingen zijn echte subscriptions (geen `getState`): het rapport moet mee-verversen
 * met een F5/Bereken, een voortgangsinvoer of een baselinewissel.
 */
type T = TFunction<'report'>;
/** Datum- én getalnotatie van het rapport, gebonden aan de app-instellingen en -taal. */
type DD = ReturnType<typeof useDisplayDate> & { num: (n: number) => string; signed: (n: number) => string; lagText: (lag: string) => string };

/** Zelfde sleutelmap als `ResourcePanel.tsx` — `t()` is strikt getypeerd, dus geen template-sleutel. */
const RESOURCE_TYPE_KEY = {
  LABOR: 'resource.type.labor',
  EQUIPMENT: 'resource.type.equipment',
  MATERIAL: 'resource.type.material',
  SUBCONTRACTOR: 'resource.type.subcontractor',
  CREW: 'resource.type.crew',
} as const satisfies Record<ResourceType, string>;

const pct = (c: number) => `${Math.round(c * 100)}%`;
const floatColor = (tf: number) => (tf < 0 ? REPORT_COLORS.error : tf === 0 ? REPORT_COLORS.warn : undefined);

function useReportContext(): { ctx: ReportContext; stale: boolean } {
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const cpmResult = useAppStore(s => s.cpmResult);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const statusDate = useAppStore(s => s.project.statusDate);
  const stale = useAppStore(s => s.scheduleStale);
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  // "Vandaag" één keer per dag stabiel: een nieuwe dag geeft een nieuwe waarde, binnen de dag niet.
  const today = localTodayIso();
  const ctx = useMemo<ReportContext>(() => ({
    tasks, sequences, resources, assignments, calendar, calendars, cpmResult,
    baseline: activeBaselineId ? baselines.find(b => b.id === activeBaselineId) ?? null : null,
    statusDate, today, datesAsRecorded,
  }), [tasks, sequences, resources, assignments, calendar, calendars, cpmResult, baselines, activeBaselineId, statusDate, today, datesAsRecorded]);
  return { ctx, stale };
}

// ── Gedeelde kolommen ────────────────────────────────────────────────────────────────────────────
function wbsCol<R extends { wbs: string }>(t: T): ReportColumn<R> {
  return { key: 'wbs', header: t('tableReports.common.wbs'), width: 70, align: 'left', text: r => r.wbs };
}
function nameCol<R extends { name: string }>(t: T, width = 220): ReportColumn<R> {
  return { key: 'name', header: t('tableReports.common.name'), width, align: 'left', text: r => r.name };
}
function dateCol<R>(key: string, header: string, get: (r: R) => string | undefined, dd: DD, width = 95): ReportColumn<R> {
  return { key, header, width, align: 'left', text: r => dd.date(get(r)) || '—' };
}
function remainingCol<R extends { remainingDays: number }>(t: T, dd: DD): ReportColumn<R> {
  return { key: 'remaining', header: t('tableReports.common.remaining'), width: 70, align: 'right', text: r => dd.num(r.remainingDays) };
}
function completionCol<R extends { completion: number }>(t: T): ReportColumn<R> {
  return { key: 'completion', header: t('tableReports.common.completion'), width: 60, align: 'right', text: r => pct(r.completion) };
}
function tfCol<R extends { totalFloat: number }>(t: T, dd: DD): ReportColumn<R> {
  return {
    key: 'tf', header: t('tableReports.common.totalFloat'), width: 70, align: 'right',
    text: r => dd.num(r.totalFloat), color: r => floatColor(r.totalFloat), bold: r => r.totalFloat < 0,
  };
}
function statusCol<R>(t: T, text: (r: R) => string, color: (r: R) => string | undefined, width = 110): ReportColumn<R> {
  return { key: 'status', header: t('tableReports.common.status'), width, align: 'left', text, color, bold: () => true };
}
function criticalCol<R extends { isCritical: boolean; isNearCritical: boolean }>(t: T): ReportColumn<R> {
  return {
    key: 'critical', header: t('tableReports.common.critical'), width: 95, align: 'left',
    text: r => (r.isCritical ? t('tableReports.common.yes') : r.isNearCritical ? t('tableReports.common.nearCritical') : ''),
    color: r => (r.isCritical ? REPORT_COLORS.error : r.isNearCritical ? REPORT_COLORS.warn : undefined),
    bold: r => r.isCritical,
  };
}

const LOOK_AHEAD_COLOR: Record<LookAheadRow['status'], string> = {
  overdue: REPORT_COLORS.error, lateStart: REPORT_COLORS.warn, inProgress: REPORT_COLORS.info, starting: REPORT_COLORS.ok,
};
const PROGRESS_COLOR: Record<ProgressRow['status'], string> = {
  complete: REPORT_COLORS.ok, inProgress: REPORT_COLORS.info, notStarted: REPORT_COLORS.muted,
  overdueStart: REPORT_COLORS.warn, overdueFinish: REPORT_COLORS.error,
};
const SEVERITY_COLOR: Record<HealthCheck['severity'], string> = {
  error: REPORT_COLORS.error, warning: REPORT_COLORS.warn, info: REPORT_COLORS.info,
};

function commonNotes(t: T, dd: DD, ctx: ReportContext, stale: boolean, statusDateMissing?: boolean): string[] {
  const notes: string[] = [];
  if (!ctx.cpmResult || ctx.cpmResult.error) notes.push(t('tableReports.notCalculatedNote'));
  else if (stale) notes.push(t('tableReports.staleNote'));
  if (statusDateMissing) notes.push(t('tableReports.statusDateMissingNote', { date: dd.date(ctx.today) }));
  return notes;
}

/** Kort de resourcelijst in: "A, B, +2". */
function resourcesText(names: string[]): string {
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

// ── Rapportbouwers ───────────────────────────────────────────────────────────────────────────────
/**
 * "Periode: 10 sep 2026 – 7 okt 2026" — dezelfde ondertitel voor elk rapport met een venster; bij
 * *Hele project* staat de presetnaam erachter, zodat je ziet wélke spanne dat is.
 */
function periodSubtitle(t: T, dd: DD, from: string, to: string, preset?: ReportingPeriod['preset']): string {
  const base = `${t('tableReports.period')}: ${dd.date(from)} – ${dd.date(to)}`;
  return preset === 'project' ? `${base} · ${t('tableReports.periodPresets.project')}` : base;
}

function buildLookAhead(ctx: ReportContext, o: TableReportOptions, t: T, dd: DD, stale: boolean): TableReportSpec {
  const r = computeLookAhead(ctx, { period: o.lookAheadPeriod, nearCriticalDays: o.nearCriticalDays });
  const p = 'tableReports.lookAhead';
  const columns: ReportColumn<LookAheadRow>[] = [
    wbsCol(t), nameCol(t),
    dateCol('start', t('tableReports.common.start'), r => r.start, dd),
    dateCol('finish', t('tableReports.common.finish'), r => r.finish, dd),
    remainingCol(t, dd), completionCol(t), tfCol(t, dd), criticalCol(t),
    { key: 'resources', header: t('tableReports.common.resources'), width: 150, align: 'left', text: r => resourcesText(r.resources) },
    statusCol(t, r => t(`tableReports.lookAhead.status_${r.status}`), r => LOOK_AHEAD_COLOR[r.status], 120),
  ];
  return {
    title: t(`${p}.title`),
    subtitle: periodSubtitle(t, dd, r.from, r.to, o.lookAheadPeriod.preset),
    notes: commonNotes(t, dd, ctx, stale, r.statusDateMissing),
    summary: [
      { label: t(`${p}.total`), value: String(r.counts.total) },
      { label: t(`${p}.status_overdue`), value: String(r.counts.overdue), color: r.counts.overdue ? REPORT_COLORS.error : undefined },
      { label: t(`${p}.status_inProgress`), value: String(r.counts.inProgress) },
      { label: t(`${p}.status_lateStart`), value: String(r.counts.lateStart), color: r.counts.lateStart ? REPORT_COLORS.warn : undefined },
      { label: t(`${p}.status_starting`), value: String(r.counts.starting) },
      { label: t('tableReports.common.critical'), value: String(r.counts.critical), color: r.counts.critical ? REPORT_COLORS.error : undefined },
      { label: t('tableReports.common.nearCritical'), value: String(r.counts.nearCritical), color: r.counts.nearCritical ? REPORT_COLORS.warn : undefined },
    ],
    sections: [section<LookAheadRow>({ key: 'rows', columns, rows: r.rows, emptyText: t(`${p}.empty`) })],
    fileSuffix: 'look-ahead',
  };
}

function buildCritical(ctx: ReportContext, o: TableReportOptions, t: T, dd: DD, stale: boolean): TableReportSpec {
  const r = computeCriticalReport(ctx, { nearCriticalDays: o.nearCriticalDays });
  const p = 'tableReports.critical';
  const columns: ReportColumn<CriticalRow>[] = [
    wbsCol(t), nameCol(t, 260),
    dateCol('start', t('tableReports.common.start'), r => r.start, dd),
    dateCol('finish', t('tableReports.common.finish'), r => r.finish, dd),
    remainingCol(t, dd), tfCol(t, dd),
    { key: 'ff', header: t('tableReports.common.freeFloat'), width: 70, align: 'right', text: r => dd.num(r.freeFloat) },
    { key: 'path', header: t(`${p}.floatPath`), width: 60, align: 'right', text: r => (r.floatPath === undefined ? '—' : String(r.floatPath)) },
    statusCol(t, r => t(`tableReports.critical.status_${r.status}`), r => (r.status === 'critical' ? REPORT_COLORS.error : REPORT_COLORS.warn)),
  ];
  return {
    title: t(`${p}.title`),
    subtitle: t(`${p}.subtitle`, { days: o.nearCriticalDays }),
    notes: commonNotes(t, dd, ctx, stale),
    summary: [
      { label: t(`${p}.status_critical`), value: String(r.counts.critical), color: r.counts.critical ? REPORT_COLORS.error : undefined },
      { label: t(`${p}.status_nearCritical`), value: String(r.counts.nearCritical), color: r.counts.nearCritical ? REPORT_COLORS.warn : undefined },
      { label: t(`${p}.paths`), value: String(r.pathCount) },
      { label: t('tableReports.health.leaves'), value: String(r.counts.leaves) },
    ],
    sections: [section<CriticalRow>({ key: 'rows', columns, rows: r.rows, emptyText: t(`${p}.empty`) })],
    fileSuffix: 'kritiek',
  };
}

function buildProgress(ctx: ReportContext, o: TableReportOptions, t: T, dd: DD, stale: boolean): TableReportSpec {
  const r = computeProgressReport(ctx, { period: o.progressPeriod, nearCriticalDays: o.nearCriticalDays });
  const p = 'tableReports.progress';
  const s = r.summary;
  const columns: ReportColumn<ProgressRow>[] = [
    wbsCol(t), nameCol(t),
    dateCol('baselineFinish', t(`${p}.baselineFinish`), r => r.baselineFinish, dd),
    dateCol('finish', t(`${p}.forecastFinish`), r => r.finish, dd),
    completionCol(t), remainingCol(t, dd), tfCol(t, dd), criticalCol(t),
    statusCol(t, r => t(`tableReports.progress.status_${r.status}`), r => PROGRESS_COLOR[r.status], 130),
  ];
  const sec = (key: 'completed' | 'inProgress' | 'startingNext' | 'overdue' | 'critical', rows: ProgressRow[]) =>
    section<ProgressRow>({ key, heading: t(`tableReports.progress.sections.${key}`), columns, rows, emptyText: t(`${p}.empty`) });
  const varianceColor = s.finishVarianceDays === undefined ? undefined
    : s.finishVarianceDays > 0 ? REPORT_COLORS.error : s.finishVarianceDays < 0 ? REPORT_COLORS.info : REPORT_COLORS.ok;
  const summary: ReportSummaryItem[] = [
    { label: t('tableReports.statusDate'), value: dd.date(s.statusDate) },
    { label: t('tableReports.period'), value: `${dd.date(s.periodFrom)} – ${dd.date(s.periodTo)}` },
    { label: t(`${p}.lookAheadUntil`), value: dd.date(s.lookAheadTo) },
    { label: t(`${p}.baselineFinish`), value: dd.date(s.baselineFinish) || '—' },
    { label: t(`${p}.forecastFinish`), value: dd.date(s.forecastFinish) || '—' },
    { label: t(`${p}.finishVariance`), value: s.finishVarianceDays === undefined ? '—' : dd.signed(s.finishVarianceDays), color: varianceColor },
    { label: `${t(`${p}.planned`)} ${t(`${p}.plannedBasis_${s.plannedBasis}`)}`, value: `${dd.num(s.plannedPct)}%` },
    { label: t(`${p}.actual`), value: `${dd.num(s.actualPct)}%`, color: s.actualPct + 0.05 < s.plannedPct ? REPORT_COLORS.error : REPORT_COLORS.ok },
    { label: t(`${p}.status_complete`), value: `${s.counts.complete} / ${s.counts.total}` },
    { label: t(`${p}.status_inProgress`), value: String(s.counts.inProgress) },
    { label: t(`${p}.status_notStarted`), value: String(s.counts.notStarted) },
    { label: t(`${p}.overdue`), value: String(s.counts.overdue), color: s.counts.overdue ? REPORT_COLORS.error : undefined },
    { label: t('tableReports.common.critical'), value: String(s.counts.critical), color: s.counts.critical ? REPORT_COLORS.error : undefined },
  ];
  return {
    title: t(`${p}.title`),
    // Geen ondertitel: de statusdatum staat al als eerste regel van de samenvatting (issue #110 punt 4).
    notes: commonNotes(t, dd, ctx, stale, s.statusDateMissing),
    summary,
    sections: [
      sec('completed', r.completedInPeriod),
      sec('inProgress', r.inProgress),
      sec('startingNext', r.startingNext),
      sec('overdue', r.overdue),
      sec('critical', r.critical),
    ],
    fileSuffix: 'voortgang',
  };
}

interface HealthSummaryRow { id: HealthCheck['id']; severity: HealthCheck['severity']; count: number }
interface HealthDetailRow { id: HealthCheck['id']; severity: HealthCheck['severity']; item: HealthItem }

function healthDetailText(t: T, dd: DD, item: HealthItem): string {
  const d = item.detail;
  const parts: string[] = [];
  if (d.reason) parts.push(t(`tableReports.health.reason_${d.reason}`));
  if (d.constraintType) parts.push(d.constraintType);
  // De engine levert de lag taalneutraal ("+1.5d", `formatLagShort`); hier krijgt hij hetzelfde
  // decimaalteken als `dd.num(d.float)` verderop in dezelfde cel (review #139, bevinding 5).
  if (d.lag) parts.push(t('tableReports.health.detail_lag', { value: dd.lagText(d.lag) }));
  else if (d.days !== undefined) parts.push(t('tableReports.health.detail_days', { value: dd.num(d.days) }));
  if (d.float !== undefined) parts.push(t('tableReports.health.detail_float', { value: dd.num(d.float) }));
  if (d.date) parts.push(dd.date(d.date));
  return parts.join(' · ');
}

function buildHealth(ctx: ReportContext, o: TableReportOptions, t: T, dd: DD, stale: boolean): TableReportSpec {
  const r = computeScheduleHealth(ctx, {
    highFloatDays: o.healthHighFloatDays, longDurationDays: o.healthLongDurationDays,
    lagDays: o.healthLagDays, nearCriticalDays: o.nearCriticalDays,
  });
  const p = 'tableReports.health';
  const summaryRows: HealthSummaryRow[] = r.checks.map(c => ({ id: c.id, severity: c.severity, count: c.items.length }));
  const detailRows: HealthDetailRow[] = r.checks.flatMap(c => c.items.map(item => ({ id: c.id, severity: c.severity, item })));
  const sevColor = (row: { severity: HealthCheck['severity']; count?: number }) =>
    (row.count === 0 ? REPORT_COLORS.muted : SEVERITY_COLOR[row.severity]);
  const summaryColumns: ReportColumn<HealthSummaryRow>[] = [
    { key: 'check', header: t(`${p}.check`), width: 320, align: 'left', text: r => t(`${p}.check_${r.id}`) },
    { key: 'severity', header: t(`${p}.severity`), width: 110, align: 'left', text: r => t(`${p}.severity_${r.severity}`), color: sevColor, bold: r => r.count > 0 },
    { key: 'count', header: t(`${p}.count`), width: 80, align: 'right', text: r => String(r.count), color: sevColor, bold: r => r.count > 0 },
  ];
  const detailColumns: ReportColumn<HealthDetailRow>[] = [
    { key: 'check', header: t(`${p}.check`), width: 220, align: 'left', text: r => t(`${p}.check_${r.id}`), color: r => SEVERITY_COLOR[r.severity], bold: () => true },
    { key: 'wbs', header: t('tableReports.common.wbs'), width: 110, align: 'left', text: r => r.item.wbs },
    { key: 'name', header: t(`${p}.item`), width: 300, align: 'left', text: r => r.item.name },
    { key: 'detail', header: t(`${p}.detail`), width: 260, align: 'left', text: r => healthDetailText(t, dd, r.item) },
  ];
  return {
    title: t(`${p}.title`),
    subtitle: t(`${p}.subtitle`, { float: o.healthHighFloatDays, duration: o.healthLongDurationDays, lag: o.healthLagDays, near: o.nearCriticalDays }),
    notes: commonNotes(t, dd, ctx, stale),
    summary: [
      { label: t(`${p}.errors`), value: String(r.totals.errors), color: r.totals.errors ? REPORT_COLORS.error : REPORT_COLORS.ok },
      { label: t(`${p}.warnings`), value: String(r.totals.warnings), color: r.totals.warnings ? REPORT_COLORS.warn : undefined },
      { label: t(`${p}.infos`), value: String(r.totals.infos) },
      { label: t(`${p}.leaves`), value: String(r.leafCount) },
      { label: t(`${p}.relations`), value: String(r.relationCount) },
    ],
    sections: [
      section<HealthSummaryRow>({ key: 'summary', heading: t(`${p}.sectionSummary`), columns: summaryColumns, rows: summaryRows }),
      section<HealthDetailRow>({ key: 'details', heading: t(`${p}.sectionDetails`), columns: detailColumns, rows: detailRows, emptyText: t(`${p}.empty`) }),
    ],
    fileSuffix: 'gezondheid',
  };
}

/**
 * Groepering per resource (issue #119): de resourcenaam en het type alleen op de eerste rij van elke
 * groep, vet — DOM én PDF. Vooraf bepaald op de rijenlijst: een teller in `text()` zou bij een
 * her-render (StrictMode, PDF ná DOM) met de vorige eindstand beginnen en de eerste groepsnaam
 * laten wegvallen.
 */
function firstOfResourceGroup<R extends { resourceId: string }>(rows: R[], keyOf: (r: R) => string): Set<string> {
  const first = new Set<string>();
  let prev = '';
  for (const row of rows) {
    if (row.resourceId !== prev) first.add(keyOf(row));
    prev = row.resourceId;
  }
  return first;
}


function buildResourceLoading(ctx: ReportContext, o: TableReportOptions, t: T, tCommon: TFunction<'common'>, dd: DD, stale: boolean, locale: string): TableReportSpec {
  const r = computeResourceLoading(ctx, { period: o.resourceLoadPeriod, bucket: o.resourceLoadBucket, onlyOverloaded: o.resourceLoadOnlyOverloaded });
  const p = 'tableReports.resourceLoading';
  const monthly = o.resourceLoadBucket === 'month';
  const rowKey = (row: ResourceLoadingRow) => `${row.resourceId}\u0000${row.bucketStart}`;
  const firstOfGroup = firstOfResourceGroup(r.rows, rowKey);
  // Eén formatter per rapport, niet per cel; Gregoriaans + Latijnse cijfers (zie `monthLabel.ts`).
  const monthLabel = makeMonthLabeler(locale);
  const columns: ReportColumn<ResourceLoadingRow>[] = [
    { key: 'resource', header: t(`${p}.resource`), width: 180, align: 'left', text: row => (firstOfGroup.has(rowKey(row)) ? row.resourceName : ''), bold: () => true },
    { key: 'type', header: t(`${p}.type`), width: 100, align: 'left', text: row => (firstOfGroup.has(rowKey(row)) ? tCommon(RESOURCE_TYPE_KEY[row.resourceType]) : '') },
    monthly
      ? { key: 'month', header: t(`${p}.month`), width: 95, align: 'left', text: row => monthLabel(row.bucketStart) }
      : dateCol('week', t(`${p}.week`), row => row.bucketStart, dd),
    { key: 'required', header: t(`${p}.required`), width: 85, align: 'right', text: r => dd.num(r.required) },
    { key: 'available', header: t(`${p}.available`), width: 90, align: 'right', text: r => dd.num(r.available) },
    { key: 'variance', header: t(`${p}.variance`), width: 80, align: 'right', text: r => dd.signed(r.variance), color: r => (r.variance < 0 ? REPORT_COLORS.error : undefined), bold: r => r.variance < 0 },
    { key: 'peak', header: t(`${p}.peak`), width: 80, align: 'right', text: r => dd.num(r.peakDayLoad) },
    // Aantal overbelaste dagen als getal: geen taalkundig meervoud nodig (Pools "dni" was fout bij 1).
    { key: 'overloaded', header: t(`${p}.overloaded`), width: 100, align: 'right', text: r => (r.overloaded ? String(r.overloadedDays) : ''), color: r => (r.overloaded ? REPORT_COLORS.error : undefined), bold: r => r.overloaded },
  ];
  const subtitleParts = [
    periodSubtitle(t, dd, r.from, r.to, o.resourceLoadPeriod.preset),
    t(`tableReports.options.aggregation_${o.resourceLoadBucket}`),
    ...(o.resourceLoadOnlyOverloaded ? [t('tableReports.options.onlyOverloaded')] : []),
  ];
  return {
    title: t(`${p}.title`),
    subtitle: subtitleParts.join(' · '),
    notes: commonNotes(t, dd, ctx, stale, r.statusDateMissing),
    summary: [
      { label: t(`${p}.resources`), value: String(r.counts.resources) },
      { label: t(monthly ? `${p}.months` : `${p}.weeks`), value: String(r.counts.buckets) },
      { label: t(monthly ? `${p}.overloadedMonths` : `${p}.overloadedWeeks`), value: String(r.counts.overloadedBuckets), color: r.counts.overloadedBuckets ? REPORT_COLORS.error : REPORT_COLORS.ok },
      { label: t(`${p}.overloadedResources`), value: String(r.counts.overloadedResources), color: r.counts.overloadedResources ? REPORT_COLORS.error : undefined },
    ],
    sections: [section<ResourceLoadingRow>({ key: 'rows', columns, rows: r.rows, emptyText: t(`${p}.empty`) })],
    fileSuffix: 'resourcebelasting',
  };
}

function buildResourceAssignments(ctx: ReportContext, o: TableReportOptions, t: T, tCommon: TFunction<'common'>, dd: DD, stale: boolean): TableReportSpec {
  const r = computeResourceAssignments(ctx, { period: o.resourceAssignmentPeriod, includeCompleted: o.resourceAssignmentIncludeCompleted });
  const p = 'tableReports.resourceAssignments';
  // Groepering per resource: naam en type alleen op de eerste rij van elke groep (DOM én PDF) —
  // dezelfde stijl als het belastingsrapport (issue #119).
  const firstOfGroup = firstOfResourceGroup(r.rows, row => row.assignmentId);
  const columns: ReportColumn<ResourceAssignmentRow>[] = [
    { key: 'resource', header: t(`${p}.resource`), width: 170, align: 'left', text: row => (firstOfGroup.has(row.assignmentId) ? row.resourceName : ''), bold: () => true },
    { key: 'type', header: t('tableReports.resourceLoading.type'), width: 95, align: 'left', text: row => (firstOfGroup.has(row.assignmentId) ? tCommon(RESOURCE_TYPE_KEY[row.resourceType]) : '') },
    wbsCol(t), nameCol(t, 200),
    dateCol('start', t('tableReports.common.start'), r => r.start, dd),
    dateCol('finish', t('tableReports.common.finish'), r => r.finish, dd),
    remainingCol(t, dd),
    { key: 'units', header: t(`${p}.units`), width: 75, align: 'right', text: r => dd.num(r.unitsPerDay) },
    completionCol(t),
    { key: 'critical', header: t('tableReports.common.critical'), width: 60, align: 'left', text: r => (r.isCritical ? t('tableReports.common.yes') : ''), color: r => (r.isCritical ? REPORT_COLORS.error : undefined), bold: r => r.isCritical },
    statusCol(t, r => t(`tableReports.progress.status_${r.state}`), r => PROGRESS_COLOR[r.state], 110),
  ];
  return {
    title: t(`${p}.title`),
    subtitle: periodSubtitle(t, dd, r.from, r.to, o.resourceAssignmentPeriod.preset),
    notes: commonNotes(t, dd, ctx, stale, r.statusDateMissing),
    summary: [
      { label: t(`${p}.resources`), value: String(r.counts.resources) },
      { label: t(`${p}.assignments`), value: String(r.counts.assignments) },
      { label: t(`${p}.unassigned`), value: String(r.counts.unassignedTasks), color: r.counts.unassignedTasks ? REPORT_COLORS.warn : undefined },
    ],
    sections: [section<ResourceAssignmentRow>({ key: 'rows', columns, rows: r.rows, emptyText: t(`${p}.empty`) })],
    fileSuffix: 'toewijzingen',
  };
}

function buildWbsSummary(ctx: ReportContext, o: TableReportOptions, t: T, dd: DD, stale: boolean): TableReportSpec {
  const r = computeWbsSummary(ctx, { maxLevel: o.wbsSummaryLevel, includeActivities: o.wbsSummaryIncludeActivities });
  const p = 'tableReports.wbsSummary';
  const columns: ReportColumn<WbsSummaryRow>[] = [
    { key: 'wbs', header: t('tableReports.common.wbs'), width: 80, align: 'left', text: r => r.wbs, bold: r => r.isSummary },
    { key: 'name', header: t('tableReports.common.name'), width: 240, align: 'left', text: r => r.name, bold: r => r.isSummary, indent: r => Math.max(0, r.level - 1) * 14 },
    dateCol('start', t('tableReports.common.start'), r => r.start, dd),
    dateCol('finish', t('tableReports.common.finish'), r => r.finish, dd),
    dateCol('baselineStart', t(`${p}.baselineStart`), r => r.baselineStart, dd),
    dateCol('baselineFinish', t(`${p}.baselineFinish`), r => r.baselineFinish, dd),
    { key: 'duration', header: t(`${p}.duration`), width: 70, align: 'right', text: r => dd.num(r.durationDays) },
    { key: 'completion', header: t('tableReports.common.completion'), width: 60, align: 'right', text: r => pct(r.completion) },
    { key: 'variance', header: t(`${p}.finishVariance`), width: 80, align: 'right', text: r => (r.finishVarianceDays === undefined ? '—' : dd.signed(r.finishVarianceDays)), color: r => (r.finishVarianceDays !== undefined && r.finishVarianceDays > 0 ? REPORT_COLORS.error : undefined), bold: r => r.finishVarianceDays !== undefined && r.finishVarianceDays > 0 },
    { key: 'minFloat', header: t(`${p}.minFloat`), width: 70, align: 'right', text: r => dd.num(r.minTotalFloat), color: r => floatColor(r.minTotalFloat), bold: r => r.minTotalFloat < 0 },
    { key: 'activities', header: t(`${p}.activities`), width: 55, align: 'right', text: r => (r.isSummary ? String(r.counts.total) : '') },
    { key: 'critical', header: t(`${p}.critical`), width: 55, align: 'right', text: r => (r.isSummary ? String(r.counts.critical) : ''), color: r => (r.counts.critical ? REPORT_COLORS.error : undefined) },
    { key: 'inProgress', header: t(`${p}.inProgress`), width: 55, align: 'right', text: r => (r.isSummary ? String(r.counts.inProgress) : '') },
    { key: 'complete', header: t(`${p}.complete`), width: 55, align: 'right', text: r => (r.isSummary ? String(r.counts.complete) : '') },
  ];
  return {
    title: t(`${p}.title`),
    subtitle: o.wbsSummaryLevel > 0 ? t(`${p}.levelSubtitle`, { level: o.wbsSummaryLevel }) : t('tableReports.options.wbsLevelAll'),
    notes: commonNotes(t, dd, ctx, stale),
    summary: [
      { label: t(`${p}.elements`), value: String(r.counts.elements) },
      { label: t(`${p}.activitiesLabel`), value: String(r.counts.activities) },
    ],
    sections: [section<WbsSummaryRow>({ key: 'rows', columns, rows: r.rows, emptyText: t(`${p}.empty`) })],
    fileSuffix: 'wbs',
  };
}

/** De spec voor `reportType`, of null wanneer het geen tabelrapport is (gantt/milestones/variance). */
export function useTableReportSpec(reportType: ReportType, options: TableReportOptions): TableReportSpec | null {
  const { t, i18n } = useTranslation('report');
  const { t: tCommon } = useTranslation('common');
  const dates = useDisplayDate();
  const { ctx, stale } = useReportContext();
  const locale = i18n.language;
  // Getallen in de app-taal (komma in nl/de/fr): dezelfde notatie als de toewijzingskolommen van het
  // resourcediagram (`formatReportNumber`), zodat de rapporten in één paneel niet uiteenlopen.
  const dd = useMemo<DD>(() => ({
    ...dates,
    num: n => formatReportNumber(n, locale),
    signed: n => formatSignedReportNumber(n, locale),
    lagText: lag => localizeDecimalPoint(lag, locale),
  }), [dates, locale]);
  // "Datums zoals opgeslagen" (issue #63; eindreview XER-etappe bevinding 6): in de modus lezen de
  // rapporten `task.time` zoals de tabel, maar zónder de "niet vastgelegd"-poort van de kolommen —
  // een as die het bestand niet vastlegde staat er dan als leeg/0. Eén melding bovenaan elk rapport
  // (en dus ook in de PDF, die dezelfde spec tekent) zegt waar die nullen vandaan komen.
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  return useMemo(() => {
    if (!isTableReportType(reportType)) return null;
    const build = (): TableReportSpec | null => {
      switch (reportType) {
        case 'lookAhead': return buildLookAhead(ctx, options, t, dd, stale);
        case 'critical': return buildCritical(ctx, options, t, dd, stale);
        case 'progress': return buildProgress(ctx, options, t, dd, stale);
        case 'health': return buildHealth(ctx, options, t, dd, stale);
        case 'resourceLoading': return buildResourceLoading(ctx, options, t, tCommon, dd, stale, locale);
        case 'resourceAssignments': return buildResourceAssignments(ctx, options, t, tCommon, dd, stale);
        case 'wbsSummary': return buildWbsSummary(ctx, options, t, dd, stale);
        default: return null;
      }
    };
    const spec = build();
    if (spec && datesAsRecorded) spec.notes = [t('tableReports.recordedDatesNote'), ...spec.notes];
    return spec;
  }, [reportType, options, ctx, stale, datesAsRecorded, t, tCommon, dd, locale]);
}
