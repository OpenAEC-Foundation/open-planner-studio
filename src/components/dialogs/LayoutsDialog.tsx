import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Info } from 'lucide-react';
import { GroupEditor, defaultGroup, type GroupNode } from './FilterDialog';
import { LevelListEditor } from '@/components/viewControls/LevelListEditor';
import { groupFieldList, fullFieldList, filterFieldList, fieldOptions } from '@/components/viewControls/fieldCatalog';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { snapshotLayout } from '@/components/viewControls/layoutSnapshot';
import { LAYOUT_ICON_KEYS, layoutIcon } from '@/components/viewControls/layoutIcons';
import { layoutParts, pickLayoutParts } from '@/engine/view/layoutPresets';
import { loadLayouts, saveLayouts } from '@/utils/settingsStore';
import { LAYOUT_PARTS, type Layout, type LayoutPart, type TimeScale } from '@/types/view';
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
 * (`ui.layoutDialogTargetId`). De dialoog werkt op een CONCEPT: filter, groepering, sortering,
 * tijdschaal en relatielijnen stel je hier zelf in (dezelfde editors als de klassieke lintknoppen),
 * en alleen de AANGEVINKTE delen worden vastgelegd. "Toepassen zonder opslaan" zet het concept op
 * het scherm zonder er een knop van te maken — de opvolger van het snelle, tijdelijke filter.
 * Opslag app-globaal via `settingsStore`.
 */
export function LayoutsDialog() {
  const { t } = useTranslation(['common', 'menu']);
  const setUI = useAppStore(s => s.setUI);
  const targetId = useAppStore(s => s.ui.layoutDialogTargetId);
  const view = useAppStore(s => s.view);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);
  const applyViewSettings = useAppStore(s => s.applyViewSettings);
  const activeSurface = useAppStore(s => taskGridSurfaceForRibbonTab(s.ui.activeRibbonTab));
  const columns = useAppStore(s => s.taskGridSurfaces[activeSurface].columns);

  const close = () => setUI({ showLayoutsDialog: false, layoutDialogTargetId: null });

  const ctx = useFieldCatalogCtx();
  const groupOptions = useMemo(() => fieldOptions(groupFieldList(ctx), ctx), [ctx]);
  const sortOptions = useMemo(() => fieldOptions(fullFieldList(ctx), ctx), [ctx]);
  const filterFields = useMemo(() => filterFieldList(ctx), [ctx]);

  // Het concept begint als het huidige scherm; bij bewerken winnen de opgeslagen delen.
  const fromScreen = () => snapshotLayout(view, columns, '');
  const [layouts, setLayouts] = useState<Layout[] | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('layout');
  const [parts, setParts] = useState<LayoutPart[]>([...LAYOUT_PARTS]);
  const [draft, setDraft] = useState<Layout>(fromScreen);

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
      setDraft(current => ({ ...current, ...structuredClone(target) }));
    });
    return () => { cancelled = true; };
  }, [targetId]);

  const target = useMemo(() => layouts?.find(l => l.id === targetId), [layouts, targetId]);
  const editing = target !== undefined;

  const togglePart = (part: LayoutPart) => {
    setParts(current => (current.includes(part) ? current.filter(p => p !== part) : [...current, part]));
  };
  const filterRoot: GroupNode = draft.filter && draft.filter.kind === 'group' ? draft.filter : defaultGroup();
  const setFilterRoot = (root: GroupNode) => setDraft(d => ({ ...d, filter: root.children.length === 0 ? null : root }));

  /** De aangevinkte delen van het concept, als layout. */
  const build = (id: string, layoutName: string): Layout => ({ ...pickLayoutParts({ ...draft, id, name: layoutName }, parts), icon });

  const save = () => {
    if (!layouts || parts.length === 0) return;
    const finalName = name.trim() || t('common:view.layout.name');
    const layout = build(target?.id ?? fromScreen().id, finalName);
    const next = target ? layouts.map(l => (l.id === target.id ? layout : l)) : [...layouts, layout];
    void saveLayouts(next).then(close);
  };

  const applyOnly = () => {
    if (parts.length === 0) return;
    const { icon: _icon, ...settings } = build('adhoc', name.trim());
    applyViewSettings(settings, t('common:view.layout.applyOnly'));
    close();
  };

  const info = (key: string) => (
    <span
      title={t(key as 'common:view.layout.infoRelations')}
      aria-label={t(key as 'common:view.layout.infoRelations')}
      data-tooltip-instant="true"
      style={{ color: 'var(--theme-text-dim)', display: 'inline-flex' }}
    >
      <Info size={14} />
    </span>
  );

  const timeScales: TimeScale[] = ['year', 'quarter', 'month', 'week', 'day', ...(enableHourPlanning ? ['hour' as TimeScale] : [])];

  const partEditor = (part: LayoutPart) => {
    switch (part) {
      case 'columns':
        return <span className="ribbon-info" style={{ whiteSpace: 'normal' }}>{t('common:view.layout.columnsNote')}</span>;
      case 'filter':
        return <GroupEditor node={filterRoot} depth={0} ctx={ctx} fields={filterFields} onChange={fn => setFilterRoot(fn(filterRoot))} />;
      case 'group':
        return (
          <LevelListEditor
            levels={draft.group ?? []} onChange={group => setDraft(d => ({ ...d, group }))} options={groupOptions} maxLevels={2}
            emptyLabel={t('common:view.group.noLevels')} addLabel={t('common:view.group.addLevel')}
          />
        );
      case 'sort':
        return (
          <LevelListEditor
            levels={draft.sort ?? []} onChange={sort => setDraft(d => ({ ...d, sort }))} options={sortOptions}
            emptyLabel={t('common:view.sort.noLevels')} addLabel={t('common:view.sort.addLevel')}
          />
        );
      case 'timeScale':
        return (
          <select
            value={draft.timeScale}
            onChange={e => setDraft(d => ({ ...d, timeScale: e.target.value as TimeScale }))}
            className="input !text-[11px] !px-1.5 !py-1"
            style={{ alignSelf: 'flex-start' }}
            aria-label={t('menu:ribbon.timeScale')}
          >
            {timeScales.map(scale => <option key={scale} value={scale}>{t(`menu:ribbon.${scale}` as 'menu:ribbon.week')}</option>)}
          </select>
        );
      case 'showRelations':
        // Geen tweede vinkje onder het vinkje "vastleggen": een keuze tonen/verbergen.
        return (
          <select
            value={draft.showRelations ?? true ? 'show' : 'hide'}
            onChange={e => setDraft(d => ({ ...d, showRelations: e.target.value === 'show' }))}
            className="input !text-[11px] !px-1.5 !py-1"
            style={{ alignSelf: 'flex-start' }}
            data-ops-layout-relations="true"
            aria-label={t('common:view.layout.partRelations')}
          >
            <option value="show">{t('common:view.layout.relationsShow')}</option>
            <option value="hide">{t('common:view.layout.relationsHide')}</option>
          </select>
        );
    }
  };

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
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
            data-ops-layout-name="true"
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
                // De lint-'active'-stijl draagt een afwijkende randkleur; hier valt de rand samen met de vulling.
                style={{ minWidth: 0, padding: 6, ...(icon === key ? { borderColor: 'var(--theme-active)' } : {}) }}
              >
                {layoutIcon(key, 18)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="ui-card-header !text-xs flex-1">{t('common:view.layout.partsTitle')}</span>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...fromScreen(), id: d.id, name: d.name }))}
              className="btn btn--sm btn--secondary"
              data-ops-layout-use-current="true"
            >
              {t('common:view.layout.useCurrentView')}
            </button>
            {info('common:view.layout.infoUseCurrentView')}
          </div>
          <div
            className="rounded-[8px] px-3 py-2"
            style={{ background: 'color-mix(in srgb, var(--theme-accent, #d97706) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--theme-accent, #d97706) 45%, transparent)' }}
          >
            {t('common:view.layout.partsHint')}
          </div>
          <div className="flex flex-col">
            {LAYOUT_PARTS.map(part => (
              <div key={part} className="flex flex-col gap-2 py-2 border-b border-border-light" data-ops-layout-part-row={part}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={parts.includes(part)}
                    onChange={() => togglePart(part)}
                    data-ops-layout-part={part}
                  />
                  <span className="flex-1 font-semibold">{t(PART_KEYS[part].label as 'common:view.layout.partRelations')}</span>
                  {info(PART_KEYS[part].info)}
                </label>
                {parts.includes(part) && (
                  <div className="flex flex-col gap-1.5" style={{ paddingInlineStart: 24 }}>{partEditor(part)}</div>
                )}
              </div>
            ))}
          </div>
          {parts.length === 0 && (
            <div className="rounded-[8px] px-3 py-2" style={{ background: 'color-mix(in srgb, var(--error) 14%, transparent)', border: '1px solid var(--error)' }}>
              {t('common:view.layout.needOnePart')}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--secondary">{t('common:cancel')}</button>
        <button
          onClick={applyOnly}
          disabled={parts.length === 0}
          className="btn btn--sm btn--secondary"
          title={t('common:view.layout.infoApplyOnly')}
          data-ops-layout-apply-only="true"
        >
          {t('common:view.layout.applyOnly')}
        </button>
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
