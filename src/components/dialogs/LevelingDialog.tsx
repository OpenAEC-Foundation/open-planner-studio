import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { LevelingResult } from '@/engine/scheduler/ResourceLeveler';
import { distributeUnits } from '@/engine/scheduler/ResourceLoad';
import { parseDate } from '@/utils/dateUtils';

function fmt(iso: string): string {
  if (!iso) return '—';
  try {
    const d = parseDate(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
  } catch {
    return iso;
  }
}

/**
 * Nivelleer-dialoog (fase 2.5, §5.8). Opties → Berekenen (roept `levelResources` aan, GEEN
 * mutatie) → preview-diff (taak, oude start, nieuwe start, dagen verschoven) + einddatum-regel +
 * resterende-conflicten-sectie → Toepassen (`applyLeveling`) / Annuleren.
 */
export function LevelingDialog() {
  const { t, i18n } = useTranslation('common');
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);
  const levelResources = useAppStore(s => s.levelResources);
  const applyLeveling = useAppStore(s => s.applyLeveling);
  const setUI = useAppStore(s => s.setUI);

  const renewables = useMemo(() => resources.filter(r => r.type !== 'MATERIAL'), [resources]);

  const [constrainToFloat, setConstrainToFloat] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(renewables.map(r => r.id)));
  const [result, setResult] = useState<LevelingResult | null>(null);

  const close = () => setUI({ showLevelingDialog: false });

  const needsCPM = !cpmResult || !!cpmResult.error;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleResource = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setResult(null);
  };

  const calculate = () => {
    if (needsCPM) return;
    setResult(levelResources({ constrainToFloat, resourceIds: [...selectedIds] }));
  };

  const apply = () => {
    if (!result) return;
    applyLeveling(result);
    close();
  };

  // Preview-rijen uit `result.shifts` (A1): ELKE taak wiens start wijzigt — ook niet-geresourcete
  // FS-opvolgers die alleen via de forward pass meeschuiven (die zaten niet in `delays`).
  const rows = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.shifts).map(([taskId, shift]) => {
      const task = tasks.find(t => t.id === taskId);
      return { taskId, name: task?.name || taskId, oldStart: shift.oldStart, newStart: shift.newStart, delay: shift.delta };
    }).sort((a, b) => a.oldStart.localeCompare(b.oldStart));
  }, [result, tasks]);

  const conflicts = result ? Object.entries(result.unresolved) : [];
  const endChanged = result ? result.projectEndBefore !== result.projectEndAfter : false;

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }),
    [i18n.language],
  );

  // Intrinsieke overvraag (bevinding 5): een taak waarvan één toewijzing op zijn curve-piek méér
  // eenheden/dag vraagt dan de resource-capaciteit kan nooit door schuiven opgelost worden — de
  // dag zelf is al overbelast. Detecteer per onopgeloste taak de zwaarst overvragende toewijzing.
  const intrinsicByTask = useMemo(() => {
    const map: Record<string, { resource: string; peak: number; capacity: number } | null> = {};
    if (!result) return map;
    for (const taskId of Object.keys(result.unresolved)) {
      const task = tasks.find(t => t.id === taskId);
      let worst: { resource: string; peak: number; capacity: number } | null = null;
      if (task) {
        for (const a of assignments.filter(x => x.taskId === taskId)) {
          const res = resources.find(r => r.id === a.resourceId);
          if (!res) continue;
          const days = distributeUnits(a.unitsPerDay, task.time.scheduleDuration, a.curve ?? 'UNIFORM');
          const peak = days.length > 0 ? Math.max(...days) : 0;
          if (peak > res.maxUnits + 1e-9) {
            const gap = peak - res.maxUnits;
            if (!worst || gap > worst.peak - worst.capacity) {
              worst = { resource: res.name || res.id, peak, capacity: res.maxUnits };
            }
          }
        }
      }
      map[taskId] = worst;
    }
    return map;
  }, [result, tasks, assignments, resources]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[720px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('resource.leveling.dialogTitle')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {/* Opties */}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={constrainToFloat}
              onChange={e => { setConstrainToFloat(e.target.checked); setResult(null); }}
              className="mt-0.5 accent-accent"
            />
            <span>{t('resource.leveling.constrainToFloat')}</span>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
              {t('resource.leveling.resourceSelect')}
            </span>
            {renewables.length === 0 ? (
              <span className="text-text-secondary">{t('resource.panel.empty')}</span>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {renewables.map(r => (
                  <label key={r.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleResource(r.id)}
                      className="accent-accent"
                    />
                    <span>{r.name || r.id}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {needsCPM && (
            <div className="text-[11px]" style={{ color: 'var(--error)' }}>
              {t('resource.leveling.needsCPM')}
            </div>
          )}

          <div>
            <button
              onClick={calculate}
              disabled={needsCPM || selectedIds.size === 0}
              className="btn btn--sm btn--secondary disabled:opacity-40"
            >
              {t('resource.leveling.calculate')}
            </button>
          </div>

          {/* Preview */}
          {result && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <div className="text-[11px]" style={{ color: endChanged ? 'var(--error)' : 'var(--theme-text-dim)' }}>
                {endChanged
                  ? t('resource.leveling.projectEndChanged', { before: fmt(result.projectEndBefore), after: fmt(result.projectEndAfter) })
                  : t('resource.leveling.projectEndUnchanged', { date: fmt(result.projectEndAfter) })}
              </div>

              {rows.length === 0 ? (
                <div className="text-text-secondary">{t('resource.leveling.noChanges')}</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ color: 'var(--theme-text-dim)' }}>
                      <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colTask')}</th>
                      <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colOldStart')}</th>
                      <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colNewStart')}</th>
                      <th className="text-right px-2 py-1 font-semibold border-b border-border">{t('resource.leveling.colShift')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.taskId} className="border-b border-border-light">
                        <td className="px-2 py-1 truncate" style={{ maxWidth: 260 }} title={row.name}>{row.name}</td>
                        <td className="px-2 py-1">{fmt(row.oldStart)}</td>
                        <td className="px-2 py-1">{fmt(row.newStart)}</td>
                        <td className="px-2 py-1 text-right">{t('resource.leveling.shiftDays', { count: row.delay })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {conflicts.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="ui-card-header !text-xs" style={{ color: 'var(--error)' }}>
                    {t('resource.leveling.remainingConflicts')}
                  </span>
                  <span className="text-[10px] text-text-secondary">{t('resource.leveling.remainingConflictsHint')}</span>
                  {conflicts.map(([taskId, days]) => {
                    const task = tasks.find(t => t.id === taskId);
                    const reason = result?.unresolvedReasons[taskId];
                    const intrinsic = intrinsicByTask[taskId];
                    // Reden-specifieke uitleg (A3), gededupliceerd met de leveler-classificatie: de
                    // leveler kiest de reden, de dialoog vult alleen de weergavedetails in.
                    let explain: string | null = null;
                    if (reason === 'INTRINSIC_OVERRUN' && intrinsic) {
                      explain = t('resource.leveling.intrinsicOverrun', {
                        resource: intrinsic.resource,
                        peak: numberFmt.format(intrinsic.peak),
                        capacity: numberFmt.format(intrinsic.capacity),
                      });
                    } else if (reason === 'CALENDAR_MISMATCH') {
                      explain = t('resource.leveling.reason.calendarMismatch');
                    } else if (reason === 'INSUFFICIENT_CAPACITY') {
                      explain = t('resource.leveling.reason.insufficientCapacity');
                    } else if (intrinsic) {
                      // Vangnet (geen reden meegegeven, maar intrinsiek gedetecteerd).
                      explain = t('resource.leveling.intrinsicOverrun', {
                        resource: intrinsic.resource,
                        peak: numberFmt.format(intrinsic.peak),
                        capacity: numberFmt.format(intrinsic.capacity),
                      });
                    }
                    return (
                      <div key={taskId} className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="truncate" style={{ maxWidth: 360 }}>{task?.name || taskId}</span>
                          <span style={{ color: 'var(--error)' }}>{t('resource.leveling.conflictDays', { count: days.length })}</span>
                        </div>
                        {explain && (
                          <span className="text-[10px] pl-3" style={{ color: 'var(--error)' }}>{explain}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--secondary">
            {t('resource.leveling.cancel')}
          </button>
          <button
            onClick={apply}
            disabled={!result}
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] disabled:opacity-40"
          >
            {t('resource.leveling.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
