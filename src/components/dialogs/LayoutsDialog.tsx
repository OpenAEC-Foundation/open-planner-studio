import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Info } from 'lucide-react';
import { snapshotLayout } from '@/components/viewControls/layoutSnapshot';
import { LAYOUT_ICON_KEYS, layoutIcon } from '@/components/viewControls/layoutIcons';
import { layoutParts, pickLayoutParts } from '@/engine/view/layoutPresets';
import { loadLayouts, saveLayouts } from '@/utils/settingsStore';
import { LAYOUT_PARTS, type Layout, type LayoutPart } from '@/types/view';
import { Dialog } from '@/components/common/Dialog';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';

/** Label- en tooltipsleutel per layoutdeel; de vijf bestaande delen hergebruiken hun eigen titel. */
const PART_KEYS: Record<LayoutPart, { label: string; info: string }> = {
  columns: { label: 'common:view.columns.title', info: 'common:view.layout.infoColumns' },
  filter: { label: 'common:view.filter.title', info: 'common:view.layout.infoFilter' },
  group: { label: 'common:view.group.title', info: 'common:view.layout.infoGroup' },
  sort: { label: 'common:view.sort.title', info: 'common:view.layout.infoSort' },
  timeScale: { label: 'menu:ribbon.timeScale', info: 'common:view.layout.infoTimeScale' },
  showRelations: { label: 'common:view.layout.partRelations', info: 'common:view.layout.infoRelations' },
};

/**
 * Layoutdialoog (issue #144): maakt een nieuwe layoutknop of bewerkt een bestaande
 * (`ui.layoutDialogTargetId`). Een layout legt alleen de AANGEVINKTE delen vast en neemt daarvoor
 * over wat er nu op het scherm staat; bij bewerken blijven de opgeslagen waarden staan tenzij de
 * gebruiker ze bewust door de huidige weergave laat vervangen. Opslag app-globaal via `settingsStore`.
 */
export function LayoutsDialog() {
  const { t } = useTranslation(['common', 'menu']);
  const setUI = useAppStore(s => s.setUI);
  const targetId = useAppStore(s => s.ui.layoutDialogTargetId);
  const view = useAppStore(s => s.view);
  const activeSurface = useAppStore(s => taskGridSurfaceForRibbonTab(s.ui.activeRibbonTab));
  const columns = useAppStore(s => s.taskGridSurfaces[activeSurface].columns);

  const close = () => setUI({ showLayoutsDialog: false, layoutDialogTargetId: null });

  const [layouts, setLayouts] = useState<Layout[] | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('layout');
  const [parts, setParts] = useState<LayoutPart[]>([...LAYOUT_PARTS]);
  const [useCurrentView, setUseCurrentView] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLayouts().then(all => {
      if (cancelled) return;
      setLayouts(all);
      const target = all.find(l => l.id === targetId);
      if (!target) return;
      setName(target.name);
      setIcon(target.icon ?? 'layout');
      setParts(layoutParts(target));
    });
    return () => { cancelled = true; };
  }, [targetId]);

  const target = useMemo(() => layouts?.find(l => l.id === targetId), [layouts, targetId]);
  const editing = target !== undefined;

  const togglePart = (part: LayoutPart) => {
    setParts(current => (current.includes(part) ? current.filter(p => p !== part) : [...current, part]));
  };

  const save = () => {
    if (!layouts || parts.length === 0) return;
    const finalName = name.trim() || t('common:view.layout.name');
    const fromScreen = snapshotLayout(view, columns, finalName, target?.id);
    // Bewerken: een aangevinkt deel houdt zijn opgeslagen waarde, tenzij het nieuw is aangevinkt of
    // de gebruiker de waarden bewust door de huidige weergave laat vervangen.
    const source: Layout = { ...fromScreen };
    if (target && !useCurrentView) {
      for (const part of layoutParts(target)) (source as unknown as Record<string, unknown>)[part] = target[part];
    }
    const layout: Layout = { ...pickLayoutParts(source, parts), icon };
    const next = target ? layouts.map(l => (l.id === target.id ? layout : l)) : [...layouts, layout];
    void saveLayouts(next).then(close);
  };

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[520px] max-h-[88vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t(editing ? 'common:view.layout.editTitle' : 'common:view.layout.newTitle')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]" aria-label={t('common:close')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs" data-ops-layout-dialog="true">
        <label className="flex flex-col gap-1">
          <span className="ui-card-header !text-xs">{t('common:view.layout.name')}</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="input !text-xs !px-2.5 !py-1.5"
            autoFocus
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="ui-card-header !text-xs">{t('common:view.layout.icon')}</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('common:view.layout.icon')}>
            {LAYOUT_ICON_KEYS.map(key => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={icon === key}
                aria-label={key}
                data-ops-layout-icon={key}
                onClick={() => setIcon(key)}
                className={`ribbon-btn small${icon === key ? ' active' : ''}`}
                style={{ minWidth: 0, padding: 6 }}
              >
                {layoutIcon(key, 18)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="ui-card-header !text-xs">{t('common:view.layout.partsTitle')}</span>
          <div
            className="rounded-[8px] px-3 py-2"
            style={{ background: 'color-mix(in srgb, var(--theme-accent, #d97706) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--theme-accent, #d97706) 45%, transparent)' }}
          >
            {t('common:view.layout.partsHint')}
          </div>
          <div className="flex flex-col">
            {LAYOUT_PARTS.map(part => (
              <label key={part} className="flex items-center gap-2 py-1 border-b border-border-light">
                <input
                  type="checkbox"
                  checked={parts.includes(part)}
                  onChange={() => togglePart(part)}
                  data-ops-layout-part={part}
                />
                <span className="flex-1">{t(PART_KEYS[part].label as 'common:view.layout.partRelations')}</span>
                <span
                  title={t(PART_KEYS[part].info as 'common:view.layout.infoRelations')}
                  aria-label={t(PART_KEYS[part].info as 'common:view.layout.infoRelations')}
                  style={{ color: 'var(--theme-text-dim)', display: 'inline-flex', cursor: 'help' }}
                >
                  <Info size={14} />
                </span>
              </label>
            ))}
          </div>
          {parts.length === 0 && (
            <div className="rounded-[8px] px-3 py-2" style={{ background: 'color-mix(in srgb, var(--error) 14%, transparent)', border: '1px solid var(--error)' }}>
              {t('common:view.layout.needOnePart')}
            </div>
          )}
        </div>

        {editing && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useCurrentView} onChange={e => setUseCurrentView(e.target.checked)} data-ops-layout-use-current="true" />
            <span className="flex-1">{t('common:view.layout.useCurrentView')}</span>
            <span
              title={t('common:view.layout.infoUseCurrentView')}
              aria-label={t('common:view.layout.infoUseCurrentView')}
              style={{ color: 'var(--theme-text-dim)', display: 'inline-flex', cursor: 'help' }}
            >
              <Info size={14} />
            </span>
          </label>
        )}
      </div>

      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--secondary">{t('common:cancel')}</button>
        <button
          onClick={save}
          disabled={!layouts || parts.length === 0}
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
          data-ops-layout-save="true"
        >
          {t('common:save')}
        </button>
      </div>
    </Dialog>
  );
}
