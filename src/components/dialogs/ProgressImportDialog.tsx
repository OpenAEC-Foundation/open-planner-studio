import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { displayIsoTime } from '@/utils/displayTime';
import type { TimeNotation } from '@/types/view';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { PROGRESS_IMPORT_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { openFileDialog } from '@/services/fileAccess';
import { localTodayIso, parseDate } from '@/utils/dateUtils';
import { formatDisplayDate } from '@/i18n/dateFormat';
import { extensionOf } from '@/utils/filePath';
import { isTauri } from '@/utils/platform';
import { ProgressImportLinkPicker } from './ProgressImportLinkPicker';
import { detectDateOrder, finalizeProgressRows } from '@/services/progressImport/sheetValues';
import type {
  DateOrder,
  DateOrderDetection,
  ProgressConflictChoice,
  ProgressConflictChoices,
  ProgressFieldChange,
  ProgressFileIssue,
  ProgressImportPlan,
  ProgressOverrides,
  ProgressPlanRow,
  ProgressRow,
  ProgressSheet,
} from '@/services/progressImport/types';

type Stage = 'pick' | 'dateOrder' | 'preview' | 'result';

type ProgressImportPlanFn = (
  rows: readonly ProgressRow[],
  overrides?: ProgressOverrides,
  opts?: { today?: string; conflictChoices?: ProgressConflictChoices },
) => ProgressImportPlan;

const MAX_RENDERED_ROWS = 200;

function capRows<T>(rows: readonly T[]): { shown: readonly T[]; hiddenCount: number } {
  if (rows.length <= MAX_RENDERED_ROWS) return { shown: rows, hiddenCount: 0 };
  return { shown: rows.slice(0, MAX_RENDERED_ROWS), hiddenCount: rows.length - MAX_RENDERED_ROWS };
}

function formatIsoForDisplay(iso: string, locale: string, timeNotation: TimeNotation): string {
  const datePart = iso.slice(0, 10);
  const timePart = displayIsoTime(iso, timeNotation);
  const dateLabel = formatDisplayDate(parseDate(datePart), locale);
  return timePart ? `${dateLabel} ${timePart}` : dateLabel;
}

function localMinuteIso(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${localTodayIso(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPercent(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function formatChangeValue(
  field: ProgressFieldChange['field'],
  value: string | number | undefined,
  locale: string,
  emptyLabel: string,
  timeNotation: TimeNotation,
): string {
  if (value === undefined) return emptyLabel;
  if (field === 'completion') return formatPercent(value as number, locale);
  return formatIsoForDisplay(value as string, locale, timeNotation);
}

function findSheetRow(rows: readonly ProgressRow[] | null, rowNumber: number): ProgressRow | undefined {
  return rows?.find(r => r.rowNumber === rowNumber);
}

export function ProgressImportDialog() {
  const { t, i18n } = useTranslation();
  const open = useAppStore(s => s.ui.showProgressImportDialog);
  const setUI = useAppStore(s => s.setUI);
  const tasks = useAppStore(s => s.tasks);
  const timeNotation = useAppStore(s => s.ui.timeNotation);
  const previewProgressImport = useAppStore(s => s.previewProgressImport) as ProgressImportPlanFn;
  const applyProgressImport = useAppStore(s => s.applyProgressImport) as ProgressImportPlanFn;

  const [stage, setStage] = useState<Stage>('pick');
  const [fileIssue, setFileIssue] = useState<ProgressFileIssue | null>(null);
  const [sheet, setSheet] = useState<ProgressSheet | null>(null);
  const [detection, setDetection] = useState<DateOrderDetection | null>(null);
  const [rows, setRows] = useState<readonly ProgressRow[] | null>(null);
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());
  const [conflictChoices, setConflictChoices] = useState<Map<number, ProgressConflictChoice>>(new Map());
  const [result, setResult] = useState<ProgressImportPlan | null>(null);
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());

  const plan = useMemo(
    () => (stage === 'preview' && rows
      ? previewProgressImport(rows, overrides, { today: localTodayIso(), conflictChoices })
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage, rows, overrides, conflictChoices, tasks, previewProgressImport],
  );

  const takenTaskIds = useMemo(() => {
    const ids = new Set<string>();
    if (plan) for (const row of plan.rows) if (row.taskId) ids.add(row.taskId);
    return ids;
  }, [plan]);

  const needsLinkRows = useMemo(
    () => (plan ? plan.rows.filter(r => r.reason === 'unmatched' || r.reason === 'ambiguousWbs') : []),
    [plan],
  );
  const doubtfulRows = useMemo(() => (plan ? plan.rows.filter(r => r.needsConfirmation) : []), [plan]);
  const conflictRows = useMemo(() => (plan ? plan.rows.filter(r => r.conflicts) : []), [plan]);
  const appNewerRows = useMemo(
    () => (plan ? plan.rows.filter(r => r.outcome === 'noop' && r.keptApp && !r.conflicts) : []),
    [plan],
  );
  const generalRows = useMemo(
    () => (plan
      ? plan.rows.filter(r => r.outcome !== 'noop' && !r.conflicts && !r.needsConfirmation && r.reason !== 'unmatched' && r.reason !== 'ambiguousWbs')
      : []),
    [plan],
  );

  const loadSheet = async (res: { name: string; content: string; bytes?: Uint8Array }) => {
    const extension = extensionOf(res.name);
    if (extension === 'csv') { setFileIssue('csvNotSupported'); return; }
    if (extension !== 'xlsx' || !res.bytes) { setFileIssue('unreadable'); return; }
    const { parseProgressXlsx } = await import('@/services/progressImport/parseProgressXlsx');
    const parsed: ProgressSheet = await parseProgressXlsx(res.bytes);
    if (parsed.fileIssue) {
      setFileIssue(parsed.fileIssue);
      return;
    }
    setSheet(parsed);
    const det = detectDateOrder(parsed.detectionCells, tasks);
    setDetection(det);
    if (det.order === 'ambiguous') {
      setStage('dateOrder');
    } else {
      setRows(finalizeProgressRows(parsed, det.order));
      setStage('preview');
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV || isTauri()) return;
    void import('@/utils/devOpenLink').then(({ takeDevProgressSheet }) => {
      const opened = takeDevProgressSheet();
      if (opened) void loadSheet(opened);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const close = () => {
    setUI({ showProgressImportDialog: false });
  };

  const pick = async () => {
    setFileIssue(null);
    try {
      const res = await openFileDialog(
        [{ name: 'Progress sheet', extensions: ['xlsx', 'csv'] }],
        { binaryExtensions: ['xlsx'] },
      );
      if (!res) return;
      await loadSheet(res);
    } catch {
      setFileIssue('unreadable');
    }
  };

  const chooseOrder = (order: DateOrder) => {
    if (!sheet) return;
    setRows(finalizeProgressRows(sheet, order));
    setStage('preview');
  };

  const setOverride = (rowNumber: number, taskId: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.set(rowNumber, taskId);
      return next;
    });
  };

  const clearOverride = (rowNumber: number) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.delete(rowNumber);
      return next;
    });
  };

  const openPickerFor = (rowNumber: number) => {
    setEditingRows(prev => new Set(prev).add(rowNumber));
  };

  const pickAndClosePicker = (rowNumber: number, taskId: string) => {
    setOverride(rowNumber, taskId);
    setEditingRows(prev => {
      const next = new Set(prev);
      next.delete(rowNumber);
      return next;
    });
  };

  const chooseConflict = (rowNumber: number, choice: ProgressConflictChoice) => {
    setConflictChoices(prev => new Map(prev).set(rowNumber, choice));
  };

  const chooseAllConflicts = (choice: ProgressConflictChoice) => {
    setConflictChoices(new Map(conflictRows.map(row => [row.rowNumber, choice] as const)));
  };

  const confirm = () => {
    if (!rows) return;
    const applied = applyProgressImport(rows, overrides, { today: localTodayIso(), conflictChoices });
    if (applied.unresolvedConflictCount > 0) return;
    setResult(applied);
    setStage('result');
  };

  const applyAndClose = (): boolean => {
    if (stage !== 'preview' || !rows || !plan || plan.appliedCount === 0 || plan.unresolvedConflictCount > 0) return false;
    applyProgressImport(rows, overrides, { today: localTodayIso(), conflictChoices });
    close();
    return true;
  };

  const cappedNeedsLink = capRows(needsLinkRows);
  const cappedDoubtful = capRows(doubtfulRows);
  const cappedConflicts = capRows(conflictRows);
  const cappedAppNewer = capRows(appNewerRows);
  const cappedGeneral = capRows(generalRows);
  const refusedResultRows = result ? result.rows.filter(r => r.outcome === 'refused') : [];
  const cappedRefusedResult = capRows(refusedResultRows);

  const emptyLabel = t('progressImport.empty');

  const renderChanges = (row: ProgressPlanRow) => (
    <ul className="flex flex-col gap-0.5 pl-4 list-disc text-text-secondary">
      {row.changes.map(change => (
        <li key={change.field}>
          {t(`progressImport.field.${change.field}`)}:{' '}
          {formatChangeValue(change.field, change.before, i18n.language, emptyLabel, timeNotation)}
          {' → '}
          {formatChangeValue(change.field, change.after, i18n.language, emptyLabel, timeNotation)}
        </li>
      ))}
    </ul>
  );

  const showFieldValue = (field: ProgressFieldChange['field'], value: string | number | undefined) =>
    formatChangeValue(field, value, i18n.language, emptyLabel, timeNotation);

  const renderSinceExport = (row: ProgressPlanRow) => {
    if (!row.keptApp && !row.plannedShifts) return null;
    return (
      <ul className="flex flex-col gap-0.5 pl-4 list-disc text-text-secondary">
        {row.keptApp?.map(kept => (
          <li key={kept.field}>
            {t('progressImport.sinceExport.keptField', {
              field: t(`progressImport.field.${kept.field}`),
              exported: showFieldValue(kept.field, kept.exported),
              app: showFieldValue(kept.field, kept.app),
            })}
          </li>
        ))}
        {row.plannedShifts?.map(shift => (
          <li key={shift.field}>
            {t('progressImport.sinceExport.shiftedField', {
              field: t(`progressImport.sinceExport.plannedField.${shift.field}`),
              exported: formatDisplayDate(parseDate(shift.exported.slice(0, 10)), i18n.language),
              current: formatDisplayDate(parseDate(shift.current.slice(0, 10)), i18n.language),
            })}
          </li>
        ))}
      </ul>
    );
  };

  const renderChoiceButtons = (
    selected: ProgressConflictChoice | undefined,
    choose: (choice: ProgressConflictChoice) => void,
  ) => (
    <div className="flex gap-2 shrink-0">
      {(['app', 'sheet'] as const).map(choice => (
        <button
          key={choice}
          onClick={() => choose(choice)}
          aria-pressed={selected === choice}
          className={`btn btn--sm ${selected === choice ? 'btn--primary' : 'btn--secondary'}`}
          style={{ fontWeight: 600 }}
        >
          {t(choice === 'app' ? 'progressImport.sinceExport.keepApp' : 'progressImport.sinceExport.takeSheet')}
        </button>
      ))}
    </div>
  );

  const renderRowOutcome = (row: ProgressPlanRow) => {
    if (row.outcome === 'apply') return renderChanges(row);
    if (row.outcome === 'refused' && row.reason) {
      return <span style={{ color: 'var(--error)' }}>{t(`progressImport.reason.${row.reason}`)}</span>;
    }
    return null;
  };

  return (
    <Dialog
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[720px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-progress-import-dialog': true }}
    >
      <DialogHeader
        title={t('progressImport.title')}
        onClose={close}
        help={{
          articleId: PROGRESS_IMPORT_HELP_ARTICLE_ID,
          confirmLeave: { dirty: stage === 'dateOrder' || stage === 'preview', onSave: applyAndClose },
        }}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
        {stage === 'pick' && (
          <>
            <p>{t('progressImport.intro')}</p>
            <button onClick={() => { void pick(); }} className="btn btn--sm btn--secondary self-start">
              {t('progressImport.chooseFile')}
            </button>
            {fileIssue && (
              <p style={{ color: 'var(--error)' }}>{t(`progressImport.fileIssue.${fileIssue}`)}</p>
            )}
          </>
        )}

        {stage === 'dateOrder' && detection && detection.order === 'ambiguous' && (
          <div className="flex flex-col gap-3">
            <p className="font-medium">{t('progressImport.dateOrderTitle')}</p>
            <p>{t('progressImport.dateOrderQuestion', { sample: detection.sample })}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => chooseOrder('dmy')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderOptionA', { date: formatIsoForDisplay(detection.sampleAlternatives[0], i18n.language, timeNotation) })}
              </button>
              <button onClick={() => chooseOrder('mdy')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderOptionB', { date: formatIsoForDisplay(detection.sampleAlternatives[1], i18n.language, timeNotation) })}
              </button>
            </div>
          </div>
        )}

        {stage === 'preview' && plan && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5">
              {plan.exportedAt && (
                <span className="text-text-secondary">
                  {t('progressImport.sinceExport.exportedAt', {
                    date: formatIsoForDisplay(localMinuteIso(plan.exportedAt), i18n.language, timeNotation),
                  })}
                </span>
              )}
              <span>{t('progressImport.summaryApplied', { applied: plan.appliedCount })}</span>
              <span>{t('progressImport.summaryNoop', { noop: plan.noopCount })}</span>
              <span>{t('progressImport.summaryNeedsLink', { needsLink: plan.needsLinkCount })}</span>
              <span>{t('progressImport.summaryRefused', { refused: plan.refusedCount })}</span>
              {plan.conflictCount > 0 && (
                <span>{t('progressImport.sinceExport.summaryConflicts', { conflicts: plan.conflictCount, open: plan.unresolvedConflictCount })}</span>
              )}
              {plan.appNewerCount > 0 && (
                <span>{t('progressImport.sinceExport.summaryAppNewer', { kept: plan.appNewerCount })}</span>
              )}
              {plan.plannedShiftCount > 0 && (
                <span>{t('progressImport.sinceExport.summaryPlannedShift', { shifted: plan.plannedShiftCount })}</span>
              )}
            </div>

            {plan.withoutExportStateCount > 0 && (
              <div className="alert alert--warning">
                {t('progressImport.sinceExport.missingState', { rows: plan.withoutExportStateCount })}
              </div>
            )}

            {conflictRows.length > 0 && (
              <div className="flex flex-col gap-2" data-ops-progress-conflicts>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{t('progressImport.sinceExport.sectionConflicts')}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-text-secondary">{t('progressImport.sinceExport.allRows')}</span>
                    {renderChoiceButtons(
                      conflictRows.every(row => row.conflictChoice === 'app') ? 'app'
                        : conflictRows.every(row => row.conflictChoice === 'sheet') ? 'sheet' : undefined,
                      chooseAllConflicts,
                    )}
                  </div>
                </div>
                <p className="text-text-secondary">{t('progressImport.sinceExport.conflictIntro')}</p>
                {cappedConflicts.shown.map(row => (
                  <div
                    key={row.rowNumber}
                    data-ops-progress-row={row.rowNumber}
                    className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-text-primary">{row.taskLabel}</span>
                      {renderChoiceButtons(row.conflictChoice, choice => chooseConflict(row.rowNumber, choice))}
                    </div>
                    <ul className="flex flex-col gap-0.5 pl-4 list-disc text-text-secondary">
                      {row.conflicts?.map(conflict => (
                        <li key={conflict.field}>
                          {t('progressImport.sinceExport.conflictField', {
                            field: t(`progressImport.field.${conflict.field}`),
                            exported: showFieldValue(conflict.field, conflict.exported),
                            app: showFieldValue(conflict.field, conflict.app),
                            sheet: showFieldValue(conflict.field, conflict.sheet),
                          })}
                        </li>
                      ))}
                    </ul>
                    {row.outcome !== 'unresolved' && renderRowOutcome(row)}
                    {renderSinceExport(row)}
                  </div>
                ))}
                {cappedConflicts.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedConflicts.hiddenCount })}</span>
                )}
              </div>
            )}

            {detection && detection.order !== 'ambiguous' && detection.evidence === 'contradictoryNoSample' && (
              <div className="alert alert--warning flex items-center gap-2">
                <Icon id="status.warning" size={16} />
                {t('progressImport.dateOrderContradictory')}
              </div>
            )}

            {plan.ignoredOverrideRows.length > 0 && (
              <div className="alert alert--warning flex flex-col gap-1">
                <Icon id="status.warning" size={16} />
                {plan.ignoredOverrideRows.map(rowNumber => (
                  <span key={rowNumber}>{t('progressImport.overrideDropped', { row: rowNumber })}</span>
                ))}
              </div>
            )}

            {needsLinkRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t('progressImport.sectionNeedsLink')}</p>
                {cappedNeedsLink.shown.map(row => {
                  const sheetRow = findSheetRow(rows, row.rowNumber);
                  const sheetLabel = [sheetRow?.wbsCode, sheetRow?.name].filter(Boolean).join(' ');
                  const sheetTaskId = sheetRow?.taskId
                    ? t('progressImport.sheetTaskId', { id: sheetRow.taskId })
                    : null;
                  return (
                    <div
                      key={row.rowNumber}
                      data-ops-progress-row={row.rowNumber}
                      className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                    >
                      <span className="font-medium text-text-primary break-words">
                        {sheetLabel || sheetTaskId || t('progressImport.sheetRowHint', { row: row.rowNumber })}
                      </span>
                      {renderRowOutcome(row)}
                      {sheetLabel && sheetTaskId && (
                        <span className="text-text-secondary break-all">{sheetTaskId}</span>
                      )}
                      <span className="text-text-secondary">
                        {t('progressImport.sheetRowHint', { row: row.rowNumber })}
                      </span>
                      <ProgressImportLinkPicker
                        tasks={tasks}
                        takenTaskIds={takenTaskIds}
                        value={overrides.get(row.rowNumber)}
                        currentTaskId={row.taskId}
                        onChange={taskId => setOverride(row.rowNumber, taskId)}
                      />
                    </div>
                  );
                })}
                {cappedNeedsLink.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedNeedsLink.hiddenCount })}</span>
                )}
              </div>
            )}

            {doubtfulRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t('progressImport.sectionDoubtful')}</p>
                {cappedDoubtful.shown.map(row => (
                  <div
                    key={row.rowNumber}
                    data-ops-progress-row={row.rowNumber}
                    className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                  >
                    <span className="font-medium text-text-primary">{row.taskLabel}</span>
                    {renderRowOutcome(row)}
                    <div className="flex gap-2">
                      <button
                        onClick={() => row.taskId && setOverride(row.rowNumber, row.taskId)}
                        className="btn btn--sm btn--secondary"
                      >
                        {t('progressImport.confirmLink')}
                      </button>
                      <button
                        onClick={() => openPickerFor(row.rowNumber)}
                        className="btn btn--sm btn--secondary"
                      >
                        {t('progressImport.changeLink')}
                      </button>
                    </div>
                    {editingRows.has(row.rowNumber) && (
                      <ProgressImportLinkPicker
                        tasks={tasks}
                        takenTaskIds={takenTaskIds}
                        value={overrides.get(row.rowNumber)}
                        currentTaskId={row.taskId}
                        onChange={taskId => pickAndClosePicker(row.rowNumber, taskId)}
                      />
                    )}
                  </div>
                ))}
                {cappedDoubtful.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedDoubtful.hiddenCount })}</span>
                )}
              </div>
            )}

            {generalRows.length > 0 && (
              <div className="flex flex-col gap-2">
                {cappedGeneral.shown.map(row => (
                  <div
                    key={row.rowNumber}
                    data-ops-progress-row={row.rowNumber}
                    className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary">{row.taskLabel}</span>
                      {overrides.has(row.rowNumber) && (
                        <button onClick={() => clearOverride(row.rowNumber)} className="btn btn--sm btn--secondary">
                          {t('progressImport.clearLink')}
                        </button>
                      )}
                    </div>
                    {renderRowOutcome(row)}
                    {renderSinceExport(row)}
                  </div>
                ))}
                {cappedGeneral.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedGeneral.hiddenCount })}</span>
                )}
              </div>
            )}

            {appNewerRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t('progressImport.sinceExport.sectionAppNewer')}</p>
                {cappedAppNewer.shown.map(row => (
                  <div
                    key={row.rowNumber}
                    data-ops-progress-row={row.rowNumber}
                    className="flex flex-col gap-1.5 border border-border rounded-[10px] p-2.5"
                  >
                    <span className="font-medium text-text-primary">{row.taskLabel}</span>
                    {renderSinceExport(row)}
                  </div>
                ))}
                {cappedAppNewer.hiddenCount > 0 && (
                  <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedAppNewer.hiddenCount })}</span>
                )}
              </div>
            )}

            {detection?.order === 'ambiguous' && (
              <button onClick={() => setStage('dateOrder')} className="btn btn--sm btn--secondary self-start">
                {t('progressImport.dateOrderBack')}
              </button>
            )}
          </div>
        )}

        {stage === 'result' && result && (
          <div className="flex flex-col gap-3">
            <p className="font-medium">{t('progressImport.resultTitle')}</p>
            <div className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5">
              <span>{t('progressImport.summaryApplied', { applied: result.appliedCount })}</span>
              <span>{t('progressImport.summaryNoop', { noop: result.noopCount })}</span>
              <span>{t('progressImport.summaryNeedsLink', { needsLink: result.needsLinkCount })}</span>
              <span>{t('progressImport.summaryRefused', { refused: result.refusedCount })}</span>
            </div>
            {cappedRefusedResult.shown.map(row => (
              <div
                key={row.rowNumber}
                data-ops-progress-row={row.rowNumber}
                className="flex flex-col gap-1 border border-border rounded-[10px] p-2.5"
              >
                <span className="font-medium text-text-primary">
                  {row.taskLabel ?? t('progressImport.sheetRowHint', { row: row.rowNumber })}
                </span>
                {row.reason && <span style={{ color: 'var(--error)' }}>{t(`progressImport.reason.${row.reason}`)}</span>}
              </div>
            ))}
            {cappedRefusedResult.hiddenCount > 0 && (
              <span className="text-text-secondary">{t('progressImport.moreRows', { more: cappedRefusedResult.hiddenCount })}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end items-center gap-3 px-4 py-3 border-t border-border">
        {stage === 'preview' && plan && plan.unresolvedConflictCount > 0 && (
          <span className="mr-auto text-small text-text-secondary">{t('progressImport.sinceExport.chooseFirst')}</span>
        )}
        {stage === 'result' ? (
          <button onClick={close} className="btn btn--sm btn--primary">{t('progressImport.close')}</button>
        ) : (
          <>
            <button onClick={close} className="btn btn--sm btn--secondary">{t('cancel')}</button>
            {stage === 'preview' && (
              <button
                onClick={confirm}
                disabled={!plan || plan.appliedCount === 0 || plan.unresolvedConflictCount > 0}
                className="btn btn--sm btn--primary"
              >
                {t('progressImport.confirm')}
              </button>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
