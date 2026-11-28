import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import type { CompanyPool } from '@/types/library';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { DocumentPayload } from '@/state/documentContract';
import {
  computeLibraryOccupancy,
  occupancySolveInputFor,
  type OccupancyDocInput,
  type OccupancyRow,
} from '@/services/library/occupancy';
import { documentTitle, untitledOrdinals, displayDocumentTitle, DOC_PALETTE } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { parseDate, formatDate, addCalendarDays, diffDays } from '@/utils/dateUtils';
import { StatusBanner } from './StatusBanner';
import { isAutoCalcHeld, onAutoCalcReleased } from '@/state/editHold';

const MAX_CONFLICT_DATES_SHOWN = 5;

export interface LibrarySlice {
  resources: Resource[];
  assignments: ResourceAssignment[];
  tasks: Task[];
}

type OccupancyPayload = Pick<
  DocumentPayload,
  | 'project'
  | 'filePath'
  | 'xerImportMetadata'
  | 'resources'
  | 'assignments'
  | 'tasks'
  | 'sequences'
  | 'calendar'
  | 'calendars'
  | 'scheduleStale'
>;

export interface LibrarySliceCache {
  companyId: string;
  pool: CompanyPool;
  slices: WeakMap<OccupancyPayload, LibrarySlice>;
}

function librarySlice(payload: OccupancyPayload, companyId: string, poolItemIds: Set<string>): LibrarySlice {
  const resources = payload.resources.filter(r =>
    r.libraryOrigin !== undefined &&
    r.libraryOrigin.companyId === companyId &&
    poolItemIds.has(r.libraryOrigin.libraryItemId));
  if (resources.length === 0) return { resources: [], assignments: [], tasks: [] };
  const resourceIds = new Set(resources.map(r => r.id));
  const assignments = payload.assignments.filter(a => resourceIds.has(a.resourceId));
  const taskIds = new Set(assignments.map(a => a.taskId));
  return { resources, assignments, tasks: payload.tasks.filter(task => taskIds.has(task.id)) };
}

export function resolveLibrarySliceCache(
  current: LibrarySliceCache | undefined,
  payload: OccupancyPayload,
  companyId: string,
  pool: CompanyPool,
): { cache: LibrarySliceCache; slice: LibrarySlice } {
  const cache = current?.companyId === companyId && current.pool === pool
    ? current
    : { companyId, pool, slices: new WeakMap<OccupancyPayload, LibrarySlice>() };
  let slice = cache.slices.get(payload);
  if (slice === undefined) {
    slice = librarySlice(payload, companyId, new Set(pool.resources.map(resource => resource.id)));
    cache.slices.set(payload, slice);
  }
  return { cache, slice };
}

export function ResourceOccupancyView({ companyId, pool }: { companyId: string; pool: CompanyPool }) {
  const { t, i18n } = useTranslation('common');

  const documents = useAppStore(s => s.documents);
  const activeProject = useAppStore(s => s.project);
  const activeFilePath = useAppStore(s => s.filePath);
  const activeXerImportMetadata = useAppStore(s => s.xerImportMetadata);
  const activeResources = useAppStore(s => s.resources);
  const activeAssignments = useAppStore(s => s.assignments);
  const activeTasks = useAppStore(s => s.tasks);
  const activeSequences = useAppStore(s => s.sequences);
  const activeCalendar = useAppStore(s => s.calendar);
  const activeCalendars = useAppStore(s => s.calendars);
  const activeScheduleStale = useAppStore(s => s.scheduleStale);

  const autoCalcCPM = useAppStore(s => s.ui.autoCalcCPM);
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const recalculateStaleSleepingDocuments = useAppStore(s => s.recalculateStaleSleepingDocuments);

  const openingAttempt = useRef<string | null>(null);
  useEffect(() => {
    const key = JSON.stringify([activeDocumentId, companyId]);
    const calculateOnOpen = () => {
      if (openingAttempt.current === key || isAutoCalcHeld()) return;
      const s = useAppStore.getState();
      if (s.activeDocumentId !== activeDocumentId || s.project.companyId !== companyId) return;
      openingAttempt.current = key;
      if (s.scheduleStale && !s.datesAsRecorded && !s.minuteModelPending) s.runCPM();
    };
    const unsubscribe = onAutoCalcReleased(calculateOnOpen);
    calculateOnOpen();
    return unsubscribe;
  }, [activeDocumentId, companyId]);

  const untitledLabel = t('project.untitled');

  const activeOccupancyPayload = useMemo<OccupancyPayload>(() => ({
    project: activeProject,
    filePath: activeFilePath,
    xerImportMetadata: activeXerImportMetadata,
    resources: activeResources,
    assignments: activeAssignments,
    tasks: activeTasks,
    sequences: activeSequences,
    calendar: activeCalendar,
    calendars: activeCalendars,
    scheduleStale: activeScheduleStale,
  }), [
    activeProject, activeFilePath, activeXerImportMetadata, activeResources, activeAssignments, activeTasks, activeSequences,
    activeCalendar, activeCalendars, activeScheduleStale,
  ]);

  const openDocumentPayloads = useMemo(
    () => documents.map(document => ({
      id: document.id,
      payload: document.id === activeDocumentId ? activeOccupancyPayload : document.payload!,
    })),
    [documents, activeDocumentId, activeOccupancyPayload],
  );

  const sliceCacheRef = useRef<LibrarySliceCache | undefined>(undefined);

  const staleSleepingCount = useMemo(
    () => documents.reduce(
      (n, d) => n + (d.id !== activeDocumentId && d.payload?.scheduleStale === true && !d.payload.minuteModelPending ? 1 : 0),
      0,
    ),
    [documents, activeDocumentId],
  );

  const recalcRunning = useRef(false);
  useEffect(() => {
    if (!autoCalcCPM || staleSleepingCount === 0 || recalcRunning.current) return;
    recalcRunning.current = true;
    try {
      recalculateStaleSleepingDocuments();
    } finally {
      recalcRunning.current = false;
    }
  }, [autoCalcCPM, staleSleepingCount, recalculateStaleSleepingDocuments]);

  const { rows, anyUncountedStale, anyCountedStale, anyStaleAsShown, docColors } = useMemo(() => {
    const payloads = openDocumentPayloads;
    const rawTitles = payloads.map(({ payload }) =>
      documentTitle(payload.filePath, payload.project.name, documentProjectCode(payload.project, payload.xerImportMetadata)));
    const ordinals = untitledOrdinals(rawTitles);
    const inputs: OccupancyDocInput[] = payloads.map(({ id, payload }, i) => {
      const isActive = id === activeDocumentId;
      const resolved = resolveLibrarySliceCache(sliceCacheRef.current, payload, companyId, pool);
      sliceCacheRef.current = resolved.cache;
      const { slice } = resolved;
      return {
        docId: id,
        title: displayDocumentTitle(rawTitles[i], ordinals[i], untitledLabel),
        scheduleStale: payload.scheduleStale,
        companyId: payload.project.companyId ?? null,
        resources: slice.resources,
        assignments: slice.assignments,
        tasks: slice.tasks,
        calendar: payload.calendar,
        calendars: payload.calendars,
        loadOptions: effectiveSchedulingOptions(payload.project),
        skipEphemeralSolve: isActive,
        ...(isActive ? {} : {
          solveInput: occupancySolveInputFor(payload),
        }),
      };
    });
    const result = computeLibraryOccupancy(companyId, pool, inputs);
    const sorted = [...result.rows].sort((a, b) =>
      (b.conflictDays.length - a.conflictDays.length) || a.name.localeCompare(b.name, i18n.language));
    let anyUncountedStale = false;
    let anyCountedStale = false;
    let anyStaleAsShown = false;
    const docColors = new Map<string, string>();
    for (const row of sorted) {
      for (const doc of row.docs) {
        if (!doc.counted) anyUncountedStale = true;
        else if (doc.scheduleStale) {
          if (doc.ephemeralComputed) anyCountedStale = true;
          else anyStaleAsShown = true;
        }
        if (!docColors.has(doc.docId)) {
          docColors.set(doc.docId, DOC_PALETTE[docColors.size % DOC_PALETTE.length]);
        }
      }
    }
    return { rows: sorted, anyUncountedStale, anyCountedStale, anyStaleAsShown, docColors };
  }, [
    openDocumentPayloads, activeDocumentId, pool, companyId, untitledLabel, i18n.language,
  ]);

  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const unitsFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [i18n.language],
  );

  const selectedRow = selectedItem !== null ? rows.find(r => r.libraryItemId === selectedItem) : undefined;
  const selectedPoolItem = selectedRow ? pool.resources.find(r => r.id === selectedRow.libraryItemId) : undefined;
  const selectedAllUncounted = selectedRow !== undefined && selectedRow.docs.every(d => !d.counted);

  const rowPeriod = (row: OccupancyRow): string => {
    let first: string | null = null;
    let last: string | null = null;
    for (const d of row.docs) {
      if (d.firstDay !== null && (first === null || d.firstDay < first)) first = d.firstDay;
      if (d.lastDay !== null && (last === null || d.lastDay > last)) last = d.lastDay;
    }
    return first !== null && last !== null ? `${first} – ${last}` : '—';
  };

  const conflictDatesLabel = (row: OccupancyRow): string => {
    const shown = row.conflictDays.slice(0, MAX_CONFLICT_DATES_SHOWN);
    const rest = row.conflictDays.length - shown.length;
    return rest > 0
      ? `${shown.join(', ')} ${t('resource.occupancy.moreDays', { count: rest })}`
      : shown.join(', ');
  };

  return (
    <div className="flex-1 overflow-auto" data-ops-occupancy-view>
      {anyUncountedStale ? (
        <StatusBanner tone="warning" bannerProps={{ 'data-ops-occupancy-stale-banner': true }}>
          {t('resource.occupancy.staleBanner')}
        </StatusBanner>
      ) : anyStaleAsShown ? (
        <StatusBanner tone="dim" bannerProps={{ 'data-ops-occupancy-stale-as-shown-banner': true }}>
          {t('resource.occupancy.staleAsShownBanner')}
        </StatusBanner>
      ) : anyCountedStale && (
        <StatusBanner tone="dim" bannerProps={{ 'data-ops-occupancy-stale-computed-banner': true }}>
          {t('resource.occupancy.staleComputedBanner')}
        </StatusBanner>
      )}

      {rows.length === 0 ? (
        <div className="p-4 text-text-secondary" data-ops-occupancy-empty>{t('resource.occupancy.empty')}</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10" style={{ background: 'var(--theme-surface-alt)' }}>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ minWidth: 160 }}>{t('resource.name')}</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 120 }}>{t('resource.occupancy.documents')}</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 190 }}>{t('resource.occupancy.period')}</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border" style={{ width: 130 }}>
                {t('resource.occupancy.peak')} / {t('resource.occupancy.capacity')}
              </th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border" style={{ width: 190 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const open = expandedItem === row.libraryItemId;
              const isSelected = selectedItem === row.libraryItemId;
              const allUncounted = row.docs.every(d => !d.counted);
              const hasConflict = row.conflictDays.length > 0 && !allUncounted;
              return (
                <Fragment key={row.libraryItemId}>
                  <tr
                    className={`border-b border-border-light cursor-pointer ${isSelected ? 'bg-surface-hover' : 'hover:bg-surface-hover'}`}
                    onClick={() => setSelectedItem(isSelected ? null : row.libraryItemId)}
                    aria-selected={isSelected}
                    data-ops-occupancy-row={row.libraryItemId}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedItem(open ? null : row.libraryItemId); }}
                          title={t('resource.occupancy.documents')}
                          className="p-0.5 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0"
                          data-ops-occupancy-expand
                        >
                          {open ? <Icon id="tree.collapse" size={13} /> : <Icon id="tree.expand" size={13} className="ops-icon-inline-flip" />}
                        </button>
                        <span className="truncate font-medium">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-text-secondary">
                      {t('resource.occupancy.docCount', { count: row.docs.length })}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-text-secondary">{rowPeriod(row)}</td>
                    <td
                      className="px-2 py-1.5 text-right tabular-nums"
                      style={hasConflict ? { color: 'var(--error)' } : undefined}
                    >
                      {allUncounted ? '—' : <>{unitsFmt.format(row.totalPeak)} / {unitsFmt.format(row.capacityAtPeak)}</>}
                    </td>
                    <td className="px-2 py-1.5">
                      {hasConflict && (
                        <span
                          className="badge badge--red"
                          title={conflictDatesLabel(row)}
                          data-ops-occupancy-conflict
                        >
                          {t('resource.occupancy.conflictDays', { count: row.conflictDays.length })}
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr style={{ background: 'var(--theme-surface-alt)' }} data-ops-occupancy-docs={row.libraryItemId}>
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {hasConflict && (
                            <span className="!text-small" style={{ color: 'var(--error)' }}>
                              {conflictDatesLabel(row)}
                            </span>
                          )}
                          {row.docs.map(doc => (
                            <div key={doc.docId} className="flex items-center gap-2 min-w-0">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ background: docColors.get(doc.docId) }}
                                aria-hidden
                              />
                              <span className="truncate font-medium">{doc.title || untitledLabel}</span>
                              <span className="tabular-nums text-text-secondary">
                                {doc.counted && doc.firstDay !== null && doc.lastDay !== null
                                  ? `${doc.firstDay} – ${doc.lastDay}` : '—'}
                              </span>
                              <span className="tabular-nums text-text-secondary">
                                {t('resource.occupancy.peak')}: {doc.counted ? unitsFmt.format(doc.peak) : '—'}
                              </span>
                              {!doc.counted ? (
                                <span
                                  className="inline-flex items-center gap-1 flex-shrink-0"
                                  style={{ color: 'var(--theme-warning-text)' }}
                                  title={t('resource.occupancy.staleDoc')}
                                  data-ops-occupancy-stale-doc
                                >
                                  <Icon id="status.warning" size={12} aria-hidden />
                                  <span className="!text-small">{t('resource.occupancy.staleDoc')}</span>
                                </span>
                              ) : doc.scheduleStale && (
                                <span
                                  className="inline-flex items-center gap-1 flex-shrink-0 text-text-secondary"
                                  title={doc.ephemeralComputed
                                    ? t('resource.occupancy.staleComputedDoc')
                                    : t('resource.occupancy.staleAsShownDoc')}
                                  {...(doc.ephemeralComputed
                                    ? { 'data-ops-occupancy-stale-computed-doc': '' }
                                    : { 'data-ops-occupancy-stale-as-shown-doc': '' })}
                                >
                                  <Icon id={doc.ephemeralComputed ? 'status.schedule-preview' : 'status.schedule-last-result'} size={12} aria-hidden />
                                  <span className="!text-small">
                                    {doc.ephemeralComputed
                                      ? t('resource.occupancy.staleComputedDoc')
                                      : t('resource.occupancy.staleAsShownDoc')}
                                  </span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {rows.length > 0 && (
        <div className="px-3 py-2 border-t border-border" data-ops-occupancy-histogram-section>
          {selectedRow && selectedPoolItem ? (
            selectedAllUncounted ? (
              <p
                className="flex items-center gap-1.5"
                style={{ color: 'var(--theme-warning-text)' }}
                data-ops-occupancy-chart-stale
              >
                <Icon id="status.warning" size={13} className="shrink-0" aria-hidden />
                {t('resource.occupancy.staleDoc')}
              </p>
            ) : (
              <OccupancyHistogram row={selectedRow} poolItem={selectedPoolItem} untitledLabel={untitledLabel} docColors={docColors} />
            )
          ) : (
            <p className="text-text-secondary">{t('resource.occupancy.selectHint')}</p>
          )}
        </div>
      )}

      <p className="px-3 py-2 !text-small" style={{ color: 'var(--theme-text-muted)' }} data-ops-occupancy-machine-only>
        {t('resource.occupancy.machineOnly')}
      </p>
    </div>
  );
}

const CHART = {
  plotHeight: 130,
  axisGap: 16,
  padLeft: 34,
  padRight: 8,
  padTop: 8,
  minDayWidth: 4,
  maxDayWidth: 16,
  targetWidth: 760,
  breakWidth: 14,
};

const GAP_COMPRESS_DAYS = 30;

const MIN_LABEL_GAP = 48;

interface ChartSegment {
  days: string[];
  x0: number;
}

function expandDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = parseDate(from); ; d = addCalendarDays(d, 1)) {
    const iso = formatDate(d);
    if (iso > to) break;
    days.push(iso);
  }
  return days;
}

function OccupancyHistogram({ row, poolItem, untitledLabel, docColors }: {
  row: OccupancyRow;
  poolItem: Resource;
  untitledLabel: string;
  docColors: Map<string, string>;
}) {
  const { t } = useTranslation('common');

  const chart = useMemo(() => {
    const countedDocs = row.docs.filter(d => d.counted);

    const bookedDays = new Set<string>();
    for (const d of countedDocs) for (const iso of Object.keys(d.dailyLoad)) bookedDays.add(iso);
    const sortedBooked = [...bookedDays].sort();
    if (sortedBooked.length === 0) return null;

    const ranges: { from: string; to: string }[] = [];
    let from = sortedBooked[0];
    let prev = from;
    for (let i = 1; i < sortedBooked.length; i++) {
      const iso = sortedBooked[i];
      if (diffDays(prev, iso) - 1 > GAP_COMPRESS_DAYS) {
        ranges.push({ from, to: prev });
        from = iso;
      }
      prev = iso;
    }
    ranges.push({ from, to: prev });

    const totalDays = ranges.reduce((n, r) => n + diffDays(r.from, r.to) + 1, 0);
    const dayWidth = Math.max(
      CHART.minDayWidth,
      Math.min(CHART.maxDayWidth, Math.floor(CHART.targetWidth / totalDays)),
    );

    const segments: ChartSegment[] = [];
    const breaks: number[] = [];
    let cursor = CHART.padLeft;
    for (const range of ranges) {
      if (segments.length > 0) {
        breaks.push(cursor + CHART.breakWidth / 2);
        cursor += CHART.breakWidth;
      }
      const days = expandDays(range.from, range.to);
      segments.push({ days, x0: cursor });
      cursor += days.length * dayWidth;
    }
    const width = cursor + CHART.padRight;
    const height = CHART.padTop + CHART.plotHeight + CHART.axisGap;

    const capacityOf = new Map<string, number>();
    let maxVal = 1;
    for (const seg of segments) {
      for (const iso of seg.days) {
        const cap = maxUnitsOn(poolItem, iso);
        capacityOf.set(iso, cap);
        let sum = 0;
        for (const d of countedDocs) sum += d.dailyLoad[iso] ?? 0;
        if (cap > maxVal) maxVal = cap;
        if (sum > maxVal) maxVal = sum;
      }
    }
    const maxY = maxVal * 1.1;
    const yOf = (units: number) => CHART.padTop + CHART.plotHeight * (1 - units / maxY);

    const conflictSet = new Set(row.conflictDays);
    const bars: { key: string; x: number; y: number; w: number; h: number; fill: string }[] = [];
    const conflictRects: { key: string; x: number }[] = [];
    const capPaths: string[] = [];

    const labels: { x: number; text: string; anchor: 'start' | 'end'; pinned: boolean }[] = [];
    const pushLabel = (x: number, text: string, anchor: 'start' | 'end', pinned: boolean) => {
      const last = labels[labels.length - 1];
      const needed = anchor === 'end' ? MIN_LABEL_GAP * 2 : MIN_LABEL_GAP;
      if (last !== undefined && x - last.x < needed) {
        if (!pinned || last.pinned) return;
        labels.pop();
      }
      labels.push({ x, text, anchor, pinned });
    };

    for (const seg of segments) {
      let capPath = '';
      let prevCap: number | null = null;
      for (let i = 0; i < seg.days.length; i++) {
        const iso = seg.days[i];
        const x = seg.x0 + i * dayWidth;
        if (conflictSet.has(iso)) conflictRects.push({ key: iso, x });
        let acc = 0;
        for (const doc of countedDocs) {
          const units = doc.dailyLoad[iso] ?? 0;
          if (units <= 0) continue;
          const y0 = yOf(acc);
          acc += units;
          const y1 = yOf(acc);
          bars.push({
            key: `${iso}-${doc.docId}`,
            x: x + 0.5,
            y: y1,
            w: Math.max(1, dayWidth - 1),
            h: Math.max(0.5, y0 - y1),
            fill: docColors.get(doc.docId) ?? DOC_PALETTE[0],
          });
        }
        const cap = capacityOf.get(iso)!;
        const y = yOf(cap);
        if (prevCap === null) capPath += `M ${x} ${y}`;
        else if (cap !== prevCap) capPath += ` L ${x} ${y}`;
        capPath += ` L ${x + dayWidth} ${y}`;
        prevCap = cap;
      }
      capPaths.push(capPath);
      pushLabel(seg.x0, seg.days[0], 'start', true);
      if (seg.days.length > 45) {
        seg.days.forEach((iso, i) => {
          if (i > 0 && iso.endsWith('-01')) pushLabel(seg.x0 + i * dayWidth, iso, 'start', false);
        });
      }
    }
    const lastSeg = segments[segments.length - 1];
    if (lastSeg.days.length > 1) {
      pushLabel(
        lastSeg.x0 + lastSeg.days.length * dayWidth,
        lastSeg.days[lastSeg.days.length - 1],
        'end',
        true,
      );
    }

    const capStart = capacityOf.get(segments[0].days[0])!;
    return {
      dayWidth, width, height,
      bars, conflictRects, capPaths, breaks, labels,
      baselineY: yOf(0),
      capStartY: yOf(capStart),
      capStartValue: capStart,
    };
  }, [row, poolItem, docColors]);

  if (chart === null) {
    return <p className="text-text-secondary">{t('resource.occupancy.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5" data-ops-occupancy-histogram={row.libraryItemId}>
      <span className="!text-small uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
        {row.name}
      </span>
      <div className="overflow-x-auto" dir="ltr" style={{ direction: 'ltr' }}>
        <svg
          width={chart.width}
          height={chart.height}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={row.name}
          style={{ display: 'block' }}
        >
          {chart.conflictRects.map(r => (
            <rect
              key={`c-${r.key}`}
              x={r.x}
              y={CHART.padTop}
              width={chart.dayWidth}
              height={CHART.plotHeight}
              fill="var(--error)"
              opacity={0.16}
            />
          ))}
          {chart.bars.map(b => (
            <rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} />
          ))}
          <line
            x1={CHART.padLeft} y1={chart.baselineY} x2={chart.width - CHART.padRight} y2={chart.baselineY}
            stroke="var(--theme-border)" strokeWidth={1}
          />
          <text x={CHART.padLeft - 4} y={chart.baselineY + 3} textAnchor="end" fontSize={9} fill="var(--theme-text-muted)">0</text>
          {chart.capPaths.map((d, i) => (
            <path key={`cap-${i}`} d={d} fill="none" stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" />
          ))}
          <text
            x={CHART.padLeft - 4}
            y={chart.capStartY + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--theme-text-dim)"
          >{chart.capStartValue}</text>
          {chart.breaks.map((x, i) => (
            <text
              key={`b-${i}`}
              x={x}
              y={CHART.padTop + CHART.plotHeight / 2}
              textAnchor="middle"
              fontSize={11}
              fill="var(--theme-text-muted)"
            >⋯</text>
          ))}
          {chart.labels.map((l, i) => (
            <text
              key={`l-${i}`}
              x={l.x}
              y={CHART.padTop + CHART.plotHeight + 11}
              textAnchor={l.anchor}
              fontSize={8}
              fill="var(--theme-text-muted)"
            >{l.text}</text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-ops-occupancy-legend>
        {row.docs.map(doc => (
          <span key={doc.docId} className="inline-flex items-center gap-1.5 min-w-0">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: docColors.get(doc.docId) }} aria-hidden />
            <span className="truncate !text-small text-text-secondary">{doc.title || untitledLabel}</span>
            {!doc.counted && (
              <Icon id="status.warning" size={11} style={{ color: 'var(--theme-warning-text)' }} aria-label={t('resource.occupancy.staleDoc')} />
            )}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg width={18} height={8} aria-hidden><line x1={0} y1={4} x2={18} y2={4} stroke="var(--theme-text-dim)" strokeWidth={1.5} strokeDasharray="5 3" /></svg>
          <span className="!text-small text-text-secondary">{t('resource.occupancy.capacity')}</span>
        </span>
      </div>
    </div>
  );
}
