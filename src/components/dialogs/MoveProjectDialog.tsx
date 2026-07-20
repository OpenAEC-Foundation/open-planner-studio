import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';
import { displayDate } from '@/utils/displayDate';
import { Dialog } from '@/components/common/Dialog';
import { formatDate } from '@/utils/dateUtils';
import type { MoveProjectPreview } from '@/state/slices/projectSlice';

/**
 * "Project verplaatsen…" (pakket D1) — verschuif de HELE planning naar een nieuwe startdatum.
 *
 * Vorm gemodelleerd op `LevelingDialog`: opties → expliciet Berekenen → preview van een PUUR
 * (niet-muterend) rekenresultaat → Toepassen/Annuleren. Elke optiewijziging wist de preview, zodat
 * er nooit een voorbeeld van ándere opties op het scherm staat.
 *
 * De preview draait een volwaardige droogrun-CPM, geen schatting. Dat is essentieel: de KALENDER
 * schuift bewust NIET mee (feestdagen/bouwvak/winterstop liggen op absolute datums), dus het
 * projecteinde kan met een ánder aantal kalenderdagen verspringen dan de verschuiving zelf. Een
 * goedkope schatting kan per definitie alleen "oude einddatum + Δ" opleveren — precies het antwoord
 * dat fout is. Die afwijking is de prominente waarschuwing hieronder.
 */
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
  const [shiftBaselines, setShiftBaselines] = useState(false);
  const [preview, setPreview] = useState<MoveProjectPreview | null>(null);

  // Elke optiewijziging wist de preview (LevelingDialog-patroon).
  const changeStart = (v: string) => { setNewStart(v); setPreview(null); };
  const changeShiftBaselines = (v: boolean) => { setShiftBaselines(v); setPreview(null); };

  const hasCurrentStart = !!project.startDate && !isNaN(new Date(project.startDate).getTime());
  const validNewStart = /^\d{4}-\d{2}-\d{2}$/.test(newStart) && !isNaN(new Date(newStart).getTime());
  const delta = preview?.deltaDays ?? NaN;
  const isZero = validNewStart && hasCurrentStart && newStart === project.startDate.slice(0, 10);

  const calculate = () => {
    if (!hasCurrentStart || !validNewStart) return;
    setPreview(previewMoveProject(newStart, { shiftBaselines }));
  };

  const apply = () => {
    const res = moveProject(newStart, { shiftBaselines });
    if (res.moved) close();
  };

  const canApply = !!preview && !preview.error && Number.isFinite(delta) && delta !== 0;
  const isPast = validNewStart && newStart < formatDate(new Date());
  const fmt = (iso: string) => displayDate(iso, notation) || '—';

  // R2/ontwerpbesluit 2: schuift het EINDE met een ander aantal dagen op dan de verschuiving zelf,
  // of verandert de duur in werkdagen, dan heeft de kalender ingegrepen.
  //
  // Het zijn twee ONAFHANKELIJKE symptomen en ze treden los van elkaar op: verplaats je een planning
  // over een bouwvak heen zonder dat het aantal werkdagen verandert, dan verspringt alleen het einde;
  // valt er juist een feestdag weg én bij, dan kan het einde precies meeschuiven terwijl de duur
  // verandert. Eén tekst die altijd béíde noemt levert dan een lege mededeling op ("de projectduur
  // gaat van 177 naar 177 werkdagen"). Daarom per geval een eigen sleutel.
  const endShifted = !!preview && !preview.error && preview.endAfter !== '' &&
    preview.endDeltaDays !== preview.deltaDays;
  const durationShifted = !!preview && !preview.error && preview.endAfter !== '' &&
    preview.durationBefore !== preview.durationAfter;
  const calendarIntervened = endShifted || durationShifted;
  const interventionKey = endShifted && durationShifted ? 'durationChanged'
    : endShifted ? 'endShiftedOnly'
    : 'durationOnly';

  // Meeverschoven-detailregel. Bewust GEEN doorlopende zin met vijf tellingen erin: die kan per
  // telling enkelvoud of meervoud nodig hebben ("1 deadlines") en dat is met één sleutel niet op te
  // lossen. In de "label: aantal"-vorm congrueert het label niet met het getal, dus is de regel in
  // elke taal correct zonder pluralisatie. Nul-categorieën vallen weg — "0 deadlines" was ruis.
  const detailItems = !preview || preview.error ? [] : ([
    ['detailConstraints', preview.impact.constraintCount],
    ['detailDeadlines', preview.impact.deadlineCount],
    ['detailActuals', preview.impact.actualCount],
    ['detailExternal', preview.impact.externalLinkCount],
    ['detailSteps', preview.impact.availabilityStepCount],
  ] as const)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${t(`moveProject.${key}`)}: ${n}`);

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-move-project-dialog': true }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('moveProject.title')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]" aria-label={t('cancel')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
        {/* R9 — zonder geldige huidige startdatum valt er niets te berekenen. */}
        {!hasCurrentStart ? (
          <div className="text-[11px]" style={{ color: 'var(--error)' }}>
            {t('moveProject.invalidCurrentStart')}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.currentStart')}</span>
              <span className="font-medium">{fmt(project.startDate)}</span>
            </div>

            <label className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.newStart')}</span>
              <input
                type="date"
                value={newStart}
                onChange={e => changeStart(e.target.value)}
                className="input !text-xs !px-2 !py-1 w-[160px]"
              />
            </label>

            {!validNewStart ? (
              <div className="text-[11px]" style={{ color: 'var(--error)' }}>{t('moveProject.invalidDate')}</div>
            ) : isZero ? (
              <div className="text-[11px]" style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.deltaZero')}</div>
            ) : null}

            {isPast && (
              <div className="text-[11px]" style={{ color: 'var(--warning)' }}>
                {t('moveProject.warnPast')}
              </div>
            )}

            {/* §1.6 — default UIT; alleen tonen als er baselines zijn. */}
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
                  <span className="text-[10px]" style={{ color: 'var(--theme-text-dim)' }}>
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
                <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
                  {t('moveProject.previewTitle')}
                </span>

                {preview.error ? (
                  <div className="text-[11px]" style={{ color: 'var(--error)' }}>
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

                    {/* R3 — een project zonder taken heeft geen projecteinde om te tonen. */}
                    {preview.impact.taskCount === 0 ? (
                      <div style={{ color: 'var(--theme-text-dim)' }}>{t('moveProject.noTasks')}</div>
                    ) : (
                      <>
                        <div>{t('moveProject.endRow', { before: fmt(preview.endBefore), after: fmt(preview.endAfter) })}</div>

                        {/* HET hart van de preview: hier wordt zichtbaar dat de kalender niet meeschuift. */}
                        {calendarIntervened ? (
                          <div
                            className="flex items-start gap-2 rounded-[8px] p-2 text-[11px]"
                            style={{ color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 12%, transparent)' }}
                          >
                            <AlertTriangle size={14} className="shrink-0 mt-px" />
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
                          <div className="text-[11px]" style={{ color: 'var(--theme-text-dim)' }}>
                            {t('moveProject.affectedDetail', { items: detailItems.join(' · ') })}
                          </div>
                        )}
                      </>
                    )}

                    {/* Overige waarschuwingen (§7.4) — allemaal informatief, geen blokkade. */}
                    {(preview.impact.actualCount > 0 || preview.impact.hardPinCount > 0 ||
                      preview.impact.externalLinkCount > 0 || preview.holidayGapCalendars.length > 0 ||
                      preview.impact.dateCustomFieldCount > 0) && (
                      <ul className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--theme-text-dim)' }}>
                        {preview.impact.actualCount > 0 && (
                          <li>{t('moveProject.warnActuals', { count: preview.impact.actualCount })}</li>
                        )}
                        {preview.impact.hardPinCount > 0 && (
                          <li>{t('moveProject.warnHardPins', { count: preview.impact.hardPinCount })}</li>
                        )}
                        {preview.impact.externalLinkCount > 0 && (
                          <li>{t('moveProject.warnExternal', { count: preview.impact.externalLinkCount })}</li>
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
