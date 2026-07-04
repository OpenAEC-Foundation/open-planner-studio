import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Trash2, Check } from 'lucide-react';
import { snapshotLayout } from '@/components/viewControls/layoutSnapshot';
import { loadLayouts, saveLayouts, saveLastLayoutId } from '@/utils/settingsStore';
import type { Layout } from '@/state/slices/types';

/**
 * Layouts-dialoog (fase 2.7, §8): combineert "Opslaan als…" en "Beheren…" in één lijst-dialoog
 * (patroon van `BaselineDialog`) — lijst met inline-hernoemen, toepassen en verwijderen, plus een
 * "opslaan als nieuwe layout"-sectie onderaan. Opslag app-globaal via `settingsStore` (§8.2), buiten
 * de 3-plekken-regel (dit is view-state, geen instelling).
 */
export function LayoutsDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const view = useAppStore(s => s.view);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const applyLayout = useAppStore(s => s.applyLayout);

  const close = () => setUI({ showLayoutsDialog: false });

  const [layouts, setLayoutsState] = useState<Layout[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadLayouts().then(l => { if (!cancelled) { setLayoutsState(l); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: Layout[]) => {
    setLayoutsState(next);
    void saveLayouts(next);
  };

  const saveNew = () => {
    const name = newName.trim() || t('view.layout.name');
    const layout = snapshotLayout(view, activityCodeTypes, customFieldDefs, name);
    persist([...layouts, layout]);
    void saveLastLayoutId(layout.id);
    setNewName('');
  };

  const rename = (id: string, name: string) => {
    persist(layouts.map(l => (l.id === id ? { ...l, name } : l)));
  };

  const remove = (id: string) => {
    if (!window.confirm(t('view.layout.delete') + '?')) return;
    persist(layouts.filter(l => l.id !== id));
  };

  const update = (id: string) => {
    const current = layouts.find(l => l.id === id);
    if (!current) return;
    persist(layouts.map(l => (l.id === id ? snapshotLayout(view, activityCodeTypes, customFieldDefs, l.name, l.id) : l)));
  };

  const apply = (layout: Layout) => {
    if (!window.confirm(t('view.layout.applyConfirm', { name: layout.name }))) return;
    applyLayout(layout);
    void saveLastLayoutId(layout.id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('view.layout.manageTitle')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {loaded && layouts.length === 0 ? (
            <span className="text-text-secondary">{t('view.layout.noLayouts')}</span>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ color: 'var(--theme-text-dim)' }}>
                  <th className="text-left px-2 py-1 font-semibold border-b border-border">{t('view.layout.name')}</th>
                  <th className="border-b border-border w-16" />
                  <th className="border-b border-border w-16" />
                  <th className="border-b border-border w-8" />
                </tr>
              </thead>
              <tbody>
                {layouts.map(l => (
                  <tr key={l.id} className="border-b border-border-light">
                    <td className="px-2 py-1">
                      <input
                        value={l.name}
                        onChange={e => rename(l.id, e.target.value)}
                        className="input !text-xs !px-2 !py-1 w-full"
                        aria-label={t('view.layout.name')}
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={() => apply(l)} className="btn btn--sm btn--secondary" title={t('view.layout.apply')}>
                        <Check size={12} />
                      </button>
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={() => update(l.id)} className="btn btn--sm btn--secondary" title={t('view.layout.update')}>
                        {t('view.layout.update')}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button onClick={() => remove(l.id)} style={{ color: 'var(--error)' }} title={t('view.layout.delete')}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="ui-card-header !text-xs">{t('view.layout.saveTitle')}</span>
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t('view.layout.name')}
                className="input !text-xs !px-2.5 !py-1.5 flex-1"
                aria-label={t('view.layout.name')}
              />
              <button onClick={saveNew} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]">
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
