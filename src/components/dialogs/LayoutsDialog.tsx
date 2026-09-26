import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { GroupEditor, defaultGroup, type GroupNode } from './FilterDialog';
import { LevelListEditor } from '@/components/viewControls/LevelListEditor';
import { groupFieldList, sortFieldList, filterFieldList, fieldOptions } from '@/components/viewControls/fieldCatalog';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { snapshotLayout } from '@/components/viewControls/layoutSnapshot';
import { LAYOUT_ICON_KEYS, layoutIcon } from '@/components/viewControls/layoutIcons';
import { layoutParts, pickLayoutParts } from '@/engine/view/layoutPresets';
import { loadLayouts, saveLayouts } from '@/utils/settingsStore';
import { LAYOUT_PARTS, type Layout, type LayoutPart, type TimeScale } from '@/types/view';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import { currentOverlays } from '@/state/layoutView';
import { barColorFieldOptions } from '@/components/viewControls/barColorFieldOptions';
import { decodeFieldRef, encodeFieldRef } from '@/components/layout/Ribbon/ribbonPrimitives';
import type { LayoutOverlays } from '@/types/view';
import type { BarColorSelection } from '@/types/barColor';

/** Label- en tooltipsleutel per layoutdeel; de vijf bestaande delen hergebruiken hun eigen titel. */
type LayoutKey = ParseKeys<['common', 'menu']>;

const PART_KEYS: Record<LayoutPart, { label: LayoutKey; info: LayoutKey }> = {
  columns: { label: 'common:view.columns.title', info: 'common:view.layout.infoColumns' },
  filter: { label: 'common:view.filter.title', info: 'common:view.layout.infoFilter' },
  group: { label: 'common:view.group.title', info: 'common:view.layout.infoGroup' },
  sort: { label: 'common:view.sort.title', info: 'common:view.layout.infoSort' },
  timeScale: { label: 'menu:ribbon.timeScale', info: 'common:view.layout.infoTimeScale' },
  showRelations: { label: 'common:view.layout.partRelations', info: 'common:view.layout.infoRelations' },
  overlays: { label: 'common:view.layout.partOverlays', info: 'common:view.layout.infoOverlays' },
};

/** De rijen van de dialoog. De relatielijnen staan sinds issue #173 onder de kop Overlay: in de data
 *  blijven ze een eigen deel (bestaande layouts), in de dialoog legt het vinkje Overlay beide vast. */
const DIALOG_ROWS = LAYOUT_PARTS.filter(part => part !== 'showRelations');
const partsOfRow = (row: LayoutPart): LayoutPart[] => (row === 'overlays' ? ['showRelations', 'overlays'] : [row]);

/** Aan/uit-overlays in lintvolgorde (Beeld → Basislijnen & voortgang), met hun lintlabel. */
const OVERLAY_FLAGS: { key: Exclude<keyof LayoutOverlays, 'barColors'>; label: LayoutKey }[] = [
  { key: 'baseline', label: 'menu:ribbon.toggleBaselineOverlay' },
  { key: 'progressLine', label: 'menu:ribbon.toggleProgressLine' },
  { key: 'statusDateLine', label: 'menu:ribbon.toggleStatusDateLine' },
  { key: 'resourceAccent', label: 'menu:ribbon.toggleResourceAccent' },
  { key: 'floatBand', label: 'menu:ribbon.toggleFloatBand' },
];

/** Eén keuzelijst voor de balkkleur: `critical`, `auto`, of `category:<veld>`. */
function encodeBarColors(selection: BarColorSelection): string {
  return selection.mode === 'category' ? `category:${encodeFieldRef(selection.field)}` : selection.mode;
}
function decodeBarColors(value: string): BarColorSelection {
  if (value === 'critical' || value === 'auto') return { mode: value };
  return { mode: 'category', field: decodeFieldRef(value.slice('category:'.length)) };
}

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
  const sortOptions = useMemo(() => fieldOptions(sortFieldList(ctx), ctx), [ctx]);
  const filterFields = useMemo(() => filterFieldList(ctx), [ctx]);
  const barColorFields = useMemo(() => barColorFieldOptions(ctx), [ctx]);

  // Het concept begint als het huidige scherm; bij bewerken winnen de opgeslagen delen.
  // De overlays zijn app-brede `ui`-velden; alleen gelezen op het moment dat het concept wordt gevuld.
  const fromScreen = () => snapshotLayout(view, columns, currentOverlays(useAppStore.getState().ui), '');
  const [layouts, setLayouts] = useState<Layout[] | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('layout');
  const [parts, setParts] = useState<LayoutPart[]>([...LAYOUT_PARTS]);
  const [draft, setDraft] = useState<Layout>(fromScreen);
  // Legt de layout de overlays vast? Een layout van vóór #173 droeg alleen de relatielijnen; bewerken
  // (zelfs alleen hernoemen) mag er niet stil de overlays van het scherm van nu bij stoppen. Pas als
  // de gebruiker hier een overlay omzet, gaan ze mee.
  const [overlaysStored, setOverlaysStored] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadLayouts().then(all => {
      if (cancelled) return;
      setLayouts(all);
      const target = all.find(l => l.id === targetId);
      if (!target) return;
      setName(target.name);
      setIcon(target.icon ?? 'layout');
      const carried = layoutParts(target);
      const overlayRow = carried.some(part => partsOfRow('overlays').includes(part)) ? partsOfRow('overlays') : [];
      setParts([...new Set([...carried, ...overlayRow])]);
      setOverlaysStored(target.overlays !== undefined);
      setDraft(current => ({ ...current, ...structuredClone(target) }));
    });
    return () => { cancelled = true; };
  }, [targetId]);

  const target = useMemo(() => layouts?.find(l => l.id === targetId), [layouts, targetId]);
  const editing = target !== undefined;

  const togglePart = (row: LayoutPart) => {
    const rowParts = partsOfRow(row);
    setParts(current => (current.includes(row)
      ? current.filter(p => !rowParts.includes(p))
      : [...new Set([...current, ...rowParts])]));
  };
  const filterRoot: GroupNode = draft.filter && draft.filter.kind === 'group' ? draft.filter : defaultGroup();
  const setFilterRoot = (root: GroupNode) => setDraft(d => ({ ...d, filter: root.children.length === 0 ? null : root }));

  /** De aangevinkte delen van het concept, als layout. */
  const build = (id: string, layoutName: string): Layout => ({
    ...pickLayoutParts({ ...draft, id, name: layoutName }, overlaysStored ? parts : parts.filter(p => p !== 'overlays')),
    icon,
  });

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

  const info = (key: LayoutKey) => (
    <span
      title={t(key)}
      aria-label={t(key)}
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
            className="input !text-small !leading-4 !px-1.5 !py-1"
            style={{ alignSelf: 'flex-start' }}
            aria-label={t('menu:ribbon.timeScale')}
          >
            {timeScales.map(scale => <option key={scale} value={scale}>{t(`menu:ribbon.${scale}`)}</option>)}
          </select>
        );
      case 'showRelations':
        return null;
      case 'overlays': {
        const overlays = draft.overlays ?? currentOverlays(useAppStore.getState().ui);
        const setOverlay = (patch: Partial<LayoutOverlays>) => {
          setOverlaysStored(true);
          setDraft(d => ({ ...d, overlays: { ...overlays, ...patch } }));
        };
        const colorOptions = [
          { value: 'critical', label: t('menu:ribbon.screenColors_critical') },
          { value: 'auto', label: t('menu:ribbon.screenColors_auto') },
          ...barColorFields.map(option => ({
            value: `category:${encodeFieldRef(option.field)}`,
            label: `${t('menu:ribbon.screenColors_category')}: ${option.label}`,
          })),
        ];
        const colorValue = encodeBarColors(overlays.barColors);
        // Een categorieveld dat in dit project niet bestaat, blijft zichtbaar als wat het is — anders
        // toonde de keuzelijst "kritiek pad" terwijl de layout iets anders opsloeg.
        if (!colorOptions.some(option => option.value === colorValue)) {
          colorOptions.push({ value: colorValue, label: t('common:view.layout.missingColorField') });
        }
        return (
          <>
            {!overlaysStored && (
              <div
                className="rounded-[8px] px-3 py-2"
                style={{ background: 'color-mix(in srgb, var(--theme-accent, #d97706) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--theme-accent, #d97706) 45%, transparent)' }}
                data-ops-layout-overlays-not-stored="true"
              >
                {t('common:view.layout.overlaysNotStored')}
              </div>
            )}
            {/* Eén vinkje per overlay, en dat is meteen de waarde — het model dat #144 voor de
                relatielijnen koos, nu voor de hele groep. */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showRelations ?? true}
                onChange={e => setDraft(d => ({ ...d, showRelations: e.target.checked }))}
                data-ops-layout-relations="true"
              />
              <span>{t('common:view.layout.relationsShow')}</span>
            </label>
            {OVERLAY_FLAGS.map(flag => (
              <label key={flag.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overlays[flag.key]}
                  onChange={e => setOverlay({ [flag.key]: e.target.checked })}
                  data-ops-layout-overlay={flag.key}
                />
                <span>{t(flag.label)}</span>
              </label>
            ))}
            <label className="flex items-center gap-2">
              <span>{t('menu:ribbon.screenColors')}</span>
              <select
                value={colorValue}
                onChange={e => setOverlay({ barColors: decodeBarColors(e.target.value) })}
                className="input !text-small !leading-4 !px-1.5 !py-1"
                style={{ width: 'auto' }}
                aria-label={t('menu:ribbon.screenColors')}
                data-ops-layout-bar-colors="true"
              >
                {colorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </>
        );
      }
    }
  };

  return (
    <Dialog
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
    >
      <DialogHeader
        title={t(editing ? 'common:view.layout.editTitle' : 'common:view.layout.newTitle')}
        onClose={close}
      />

      <div className="flex-1 overflow-y-auto p-4 text-small leading-4 flex flex-col gap-4" data-ops-layout-dialog="true">
        <label className="flex flex-col gap-1">
          <span className="ui-card-header !text-small">{t('common:view.layout.name')}</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="input !text-small !leading-4 !px-2.5 !py-1.5"
            data-ops-layout-name="true"
            autoFocus
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="ui-card-header !text-small">{t('common:view.layout.icon')}</span>
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
            <span className="ui-card-header !text-small flex-1">{t('common:view.layout.partsTitle')}</span>
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
            {DIALOG_ROWS.map(part => (
              <div key={part} className="flex flex-col gap-2 py-2 border-b border-border-light" data-ops-layout-part-row={part}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={parts.includes(part)}
                    onChange={() => togglePart(part)}
                    data-ops-layout-part={part}
                  />
                  <span className="flex-1 font-semibold">{t(PART_KEYS[part].label)}</span>
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
