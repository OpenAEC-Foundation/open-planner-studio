import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from 'lucide-react';
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
 * Baseline-dialoog (fase 2.6, §11.2). Lijst met inline-hernoemen, actief-radio en verwijderen
 * (bevestiging als het de actieve is); "nieuwe baseline opslaan" met default-naam en een
 * scheduleStale-hint ("herbereken eerst") — een hint, geen harde blokkade.
 */
export function BaselineDialog() {
  const { t } = useTranslation('common');
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const saveBaseline = useAppStore(s => s.saveBaseline);
  const deleteBaseline = useAppStore(s => s.deleteBaseline);
  const renameBaseline = useAppStore(s => s.renameBaseline);
  const setActiveBaseline = useAppStore(s => s.setActiveBaseline);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const setUI = useAppStore(s => s.setUI);

  const close = () => setUI({ showBaselineDialog: false });

  const defaultName = useMemo(() => {
    const n = baselines.length + 1;
    return t('baseline.dialog.defaultName', { n, date: fmt(new Date().toISOString()) });
  }, [baselines.length, t]);

  const [newName, setNewName] = useState(defaultName);

  // Nieuwe default-naam wanneer het aantal baselines wijzigt (bv. na opslaan/verwijderen).
  useEffect(() => { setNewName(defaultName); }, [defaultName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    saveBaseline(newName.trim() || defaultName);
  };

  const remove = (id: string) => {
    if (id === activeBaselineId && !window.confirm(t('baseline.dialog.deleteActiveConfirm'))) return;
    deleteBaseline(id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('baseline.dialog.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {/* Lijst van baselines */}
          {baselines.length === 0 ? (
            <span className="text-text-secondary">{t('baseline.dialog.noBaselines')}</span>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ color: 'var(--theme-text-dim)' }}>
                  <th className="text-center px-2 py-1 font-semibold border-b border-border w-10">{t('baseline.dialog.active')}</th>
                  <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('baseline.dialog.name')}</th>
                  <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('baseline.dialog.created')}</th>
                  <th className="border-b border-border w-8" />
                </tr>
              </thead>
              <tbody>
                {baselines.map(b => (
                  <tr key={b.id} className="border-b border-border-light">
                    <td className="px-2 py-1 text-center">
                      <input
                        type="radio"
                        name="activeBaseline"
                        checked={b.id === activeBaselineId}
                        onChange={() => setActiveBaseline(b.id)}
                        className="accent-accent"
                        aria-label={t('baseline.dialog.active')}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={b.name}
                        onChange={e => renameBaseline(b.id, e.target.value)}
                        className="input !text-xs !px-2 !py-1 w-full"
                        aria-label={t('baseline.dialog.name')}
                      />
                    </td>
                    <td className="px-2 py-1">{fmt(b.createdAt)}</td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={() => remove(b.id)} style={{ color: 'var(--error)' }} title={t('baseline.dialog.delete')}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Nieuwe baseline opslaan */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="ui-card-header !text-xs">{t('baseline.dialog.saveNew')}</span>
            {scheduleStale && (
              <div className="text-[11px]" style={{ color: 'var(--theme-warning-text)' }}>
                ⚠ {t('baseline.dialog.staleHint')}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="input !text-xs !px-2.5 !py-1.5 flex-1"
                aria-label={t('baseline.dialog.name')}
              />
              <button onClick={save} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]">
                {t('save')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--secondary">
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
