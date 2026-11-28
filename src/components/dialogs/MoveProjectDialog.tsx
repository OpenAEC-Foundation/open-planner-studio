import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { displayDate } from '@/utils/displayDate';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { DateTextInput } from '@/components/common/DateTextInput';
import { localTodayIso } from '@/utils/dateUtils';
import type { MoveProjectPreview } from '@/state/slices/projectSlice';
import { MOVE_PROJECT_HELP_ARTICLE_ID } from '@/state/helpArticles';

export function MoveProjectDialog() {
  const { t } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const baselines = useAppStore(s => s.baselines);
  const previewMoveProject = useAppStore(s => s.previewMoveProject);
  const moveProject = useAppStore(s => s.moveProject);
  const setUI = useAppStore(s => s.setUI);
  const notation = useAppStore(s => s.ui.dateNotation);

  const close = () => setUI({ showMoveProjectDialog: false });

  const [newStart, setNewStart] = useState(project.startDate?.slice(0, 10) ?? '');
  const [initialStart] = useState(newStart);
  const [shiftBaselines, setShiftBaselines] = useState(false);
  const [preview, setPreview] = useState<MoveProjectPreview | null>(null);

  const changeStart = (v: string) => { setNewStart(v); setPreview(null); };
  const changeShiftBaselines = (v: boolean) => { setShiftBaselines(v); setPreview(null); };

  const hasCurrentStart = !!project.startDate && !isNaN(new Date(project.startDate).getTime());
  const [draftValid, setDraftValid] = useState(true);
  const validNewStart = draftValid && /^\d{4}-\d{2}-\d{2}$/.test(newStart) && !isNaN(new Date(newStart).getTime());
  const delta = preview?.deltaDays ?? NaN;
  const isZero = validNewStart && hasCurrentStart && newStart === project.startDate.slice(0, 10);

  const calculate = () => {
    if (!hasCurrentStart || !validNewStart) return;
    setPreview(previewMoveProject(newStart, { shiftBaselines }));
  };

  const canApply = validNewStart && !!preview && !preview.error && Number.isFinite(delta) && delta !== 0;

  const apply = (): boolean => {
    if (!canApply) return false;
    const res = moveProject(newStart, { shiftBaselines });
    if (res.moved) close();
    return res.moved;
  };
  const isPast = validNewStart && newStart < localTodayIso();
  const fmt = (iso: string) => displayDate(iso, notation) || '—';

  const endShifted = !!preview && !preview.error && preview.endAfter !== '' &&
    preview.endDeltaDays !== preview.deltaDays;
  const durationShifted = !!preview && !preview.error && preview.endAfter !== '' &&
    preview.durationBefore !== preview.durationAfter;
  const calendarIntervened = endShifted || durationShifted;
  const interventionKey = endShifted && durationShifted ? 'durationChanged'
    : endShifted ? 'endShiftedOnly'
    : 'durationOnly';

  const detailItems = !preview || preview.error ? [] : ([
    ['detailConstraints', preview.impact.constraintCount],
    ['detailDeadlines', preview.impact.deadlineCount],
    ['detailActuals', preview.impact.actualCount],
    ['detailSteps', preview.impact.availabilityStepCount],
  ] as const)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${t(`moveProject.${key}`)}: ${n}`);

  return (
    <Dialog
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-move-project-dialog': true }}
    >
      <DialogHeader
        title={t('moveProject.title')}
        onClose={close}
        help={{
          articleId: MOVE_PROJECT_HELP_ARTICLE_ID,
          confirmLeave: { dirty: newStart !== initialStart || shiftBaselines, onSave: apply },
        }}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
        {!hasCurrentStart ? (
          <div className="!text-body" style={{ color: 'var(--error)' }}>
            {t('moveProject.invalidCurrentStart')}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.currentStart')}</span>
              <span className="font-medium">{fmt(project.startDate)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.newStart')}</span>
              <span className="w-[160px]" data-ops-move-project-new-start>
                <DateTextInput
                  value={newStart}
                  ariaLabel={t('moveProject.newStart')}
                  required
                  commitMode="live"
                  onDraftValidChange={setDraftValid}
                  onCommit={changeStart}
                  className="input w-full !text-small !leading-4 !px-2 !py-1"
                />
              </span>
            </div>

            {!validNewStart ? (
              <div className="!text-body" style={{ color: 'var(--error)' }}>{t('moveProject.invalidDate')}</div>
            ) : isZero ? (
              <div className="!text-body" style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.deltaZero')}</div>
            ) : null}

            {isPast && (
              <div className="!text-body" style={{ color: 'var(--theme-warning-text)' }}>
                {t('moveProject.warnPast')}
              </div>
            )}

            {baselines.length > 0 && (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={shiftBaselines}
                  onChange={e => changeShiftBaselines(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span className="flex flex-col gap-0.5">
                  <span>{t('moveProject.shiftBaselines')}</span>
                  <span className="!text-small" style={{ color: 'var(--theme-text-dim)' }}>
                    {t('moveProject.shiftBaselinesHint')}
                  </span>
                </span>
              </label>
            )}

            <div>
              <button
                onClick={calculate}
                disabled={!validNewStart || isZero}
                className="btn btn--sm btn--secondary disabled:opacity-40"
              >
                {t('moveProject.calculate')}
              </button>
            </div>

            {preview && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <span className="!text-small uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('moveProject.previewTitle')}
                </span>

                {preview.error ? (
                  <div className="!text-body" style={{ color: 'var(--error)' }}>
                    {t('moveProject.calcError', { error: preview.error })}
                  </div>
                ) : (
                  <>
                    <div>
                      {preview.deltaDays >= 0
                        ? t('moveProject.delta', { days: preview.deltaDays })
                        : t('moveProject.deltaBack', { days: Math.abs(preview.deltaDays) })}
                    </div>
                    <div>{t('moveProject.startRow', { before: fmt(preview.startBefore), after: fmt(preview.startAfter) })}</div>

                    {preview.impact.taskCount === 0 ? (
                      <div style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.noTasks')}</div>
                    ) : (
                      <>
                        <div>{t('moveProject.endRow', { before: fmt(preview.endBefore), after: fmt(preview.endAfter) })}</div>

                        {calendarIntervened ? (
                          <div
                            className="flex items-start gap-2 rounded-[8px] p-2 !text-body"
                            style={{ color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 12%, transparent)' }}
                          >
                            <Icon id="status.warning" size={14} className="shrink-0 mt-px" />
                            <span>
                              {t(`moveProject.${interventionKey}`, {
                                endDays: preview.endDeltaDays,
                                days: preview.deltaDays,
                                before: preview.durationBefore,
                                after: preview.durationAfter,
                                duration: preview.durationAfter,
                              })}
                            </span>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--theme-text-dim)' }}>
                            {t('moveProject.durationUnchanged', { days: preview.durationAfter })}
                          </div>
                        )}

                        <div>{t('moveProject.affectedTasks', { count: preview.impact.taskCount })}</div>
                        {detailItems.length > 0 && (
                          <div className="!text-body" style={{ color: 'var(--theme-text-dim)' }}>
                            {t('moveProject.affectedDetail', { items: detailItems.join(' · ') })}
                          </div>
                        )}
                      </>
                    )}

                    {(preview.impact.actualCount > 0 || preview.impact.hardPinCount > 0 ||
                      preview.impact.externalLinkCount > 0 || preview.holidayGapCalendars.length > 0 ||
                      preview.impact.dateCustomFieldCount > 0) && (
                      <ul className="flex flex-col gap-1 !text-body" style={{ color: 'var(--theme-text-dim)' }}>
                        {preview.impact.actualCount > 0 && (
                          <li>{t('moveProject.warnActuals', { count: preview.impact.actualCount })}</li>
                        )}
                        {preview.impact.hardPinCount > 0 && (
                          <li>{t('moveProject.warnHardPins', { count: preview.impact.hardPinCount })}</li>
                        )}
                        {preview.impact.externalLinkCount > 0 && (
                          <li>{t('moveProject.warnExternalKept', { count: preview.impact.externalLinkCount })}</li>
                        )}
                        {preview.holidayGapCalendars.map(g => (
                          <li key={`${g.name}-${g.year}`} style={{ color: 'var(--error)' }}>
                            {t('moveProject.warnHolidayGap', { name: g.name, from: g.from, to: g.to, year: g.year })}
                          </li>
                        ))}
                        {preview.impact.dateCustomFieldCount > 0 && (
                          <li>{t('moveProject.warnCustomDateFields', { count: preview.impact.dateCustomFieldCount })}</li>
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-surface">
        <button onClick={close} className="btn btn--sm btn--ghost">{t('cancel')}</button>
        <button onClick={apply} disabled={!canApply} className="btn btn--sm btn--primary disabled:opacity-40">
          {t('moveProject.apply')}
        </button>
      </div>
    </Dialog>
  );
}
