import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Popover } from '@/components/common/Popover';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import {
  Diamond, Link, ZoomIn, ZoomOut, Trash2, Eye,
  History, Download, Puzzle,
  LayoutTemplate, UserPlus, Flag, GitCompareArrows, CalendarClock, X,
  Columns3, Filter, Layers, ArrowUpDown, Maximize2, Minimize2, SplitSquareHorizontal, Palette,
  Map as MapIcon, AlertTriangle, Plus,
} from 'lucide-react';
import { listWbsTemplates, deleteWbsTemplate, type WbsTemplate } from '@/utils/wbsTemplates';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import {
  saveShowMiniMap, loadLayouts, saveLayouts,
} from '@/utils/settingsStore';
import { saveBarColorSelection } from '@/utils/barColorSettings';
import { ExportFormat } from '@/state/appStore';
import { EXPORT_FORMATS } from '@/services/formatRegistry';
import { addTaskNearSelection } from '@/state/taskInsertActions';
import { supportsHandles } from '@/services/fileAccess';
import { DateTextInput } from '@/components/common/DateTextInput';
import { ExtensionIcon } from '@/components/common/ExtensionIcon';
import { RibbonTab, type Layout, type TimeScale } from '@/state/slices/types';
import type { ResourceCurve } from '@/types/resource';
import { RESOURCE_CURVES, CURVE_KEY } from '@/components/task-sections/shared';
import { UnitsInput } from '@/components/common/UnitsInput';
import { groupFieldList, fullFieldList, fieldOptions } from '@/components/viewControls/fieldCatalog';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import {
  barColorFieldOptions,
  effectiveBarColorControl,
} from '@/components/viewControls/barColorFieldOptions';
import { buildImportLabels } from '@/i18n/importLabels';
import { builtinLayouts } from '@/components/viewControls/builtinLayouts';
import { layoutIcon } from '@/components/viewControls/layoutIcons';
import { LevelListEditor } from '@/components/viewControls/LevelListEditor';
import { activeLayoutIds } from '@/state/layoutView';
import { isBuiltinLayoutId, isFilterOnlyLayout } from '@/engine/view/layoutPresets';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { generateId } from '@/utils/id';
import {
  RibbonButton, RibbonSmallButton, RibbonGroup, RibbonButtonStack, RibbonDropdown,
  RibbonInlineSelect,
  encodeFieldRef, decodeFieldRef,
} from './ribbonPrimitives';
import { useRibbonDensity } from './ribbonDensity';
import { ZOOM_STEP, DEFAULT_ZOOM } from '@/utils/ganttViewport';
import { createRelationWithFeedback } from '@/state/relationActions';
import { ExternalLinkDialog } from '@/components/dialogs/ExternalLinkDialog';

/**
 * Ribbon-widgets (audit P18): de "component-escape-hatch" uit de config-registry — de
 * onderdelen die te complex zijn voor pure data (eigen state, popovers, inputs, dropdowns).
 * Elke widget haalt zijn eigen store-state op (geen props uit een god-functie meer), zodat de
 * registry ze zonder plumbing kan opnemen. Markup/CSS-klassen zijn ONgewijzigd t.o.v. de
 * inline-JSX die vroeger in Ribbon.tsx stond.
 */

/**
 * Baselines & voortgang-groep (fase 2.6, §11.1): Save/Manage baseline-knoppen +
 * statusdatum + voortgangsmodus. In de normale lint-modus staan alle vier altijd
 * zichtbaar naast elkaar; in compacte modus (QA-bevinding 2.6a) is dat samen te
 * breed voor de Planning-tab (die met de bestaande groepen al bijna de volledige
 * 1280px in beslag neemt) — de vier controls overlapten buren en de inklap-pijl.
 * Daarom gaat de hele groep in compacte modus achter één knop met popover (zelfde
 * patroon als MilestoneDropdown/TemplatesDropdown hieronder).
 */
export function BaselinesProgressGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const compact = useRibbonDensity() !== 'full';
  const setUI = useAppStore(s => s.setUI);
  const statusDate = useAppStore(s => s.project.statusDate);
  const progressMode = useAppStore(s => s.project.progressMode);
  const setStatusDate = useAppStore(s => s.setStatusDate);
  const setProgressMode = useAppStore(s => s.setProgressMode);

  const onSaveBaseline = () => setUI({ showBaselineDialog: true });
  const onManageBaselines = () => setUI({ showBaselineDialog: true });

  const statusDateControl = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px' }}>
      <span className="ribbon-info">{tMenu('ribbon.statusDate')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <CalendarClock size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
        <DateTextInput
          value={statusDate ?? ''}
          onCommit={v => setStatusDate(v || undefined)}
          ariaLabel={tMenu('ribbon.statusDate')}
          className="!text-body"
          style={{
            padding: '3px 6px', background: 'var(--theme-input-bg)',
            border: '1px solid var(--theme-control-border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--theme-text)',
          }}
        />
        {statusDate && (
          <button
            className="ribbon-btn small"
            title={tMenu('ribbon.statusDateClear')}
            aria-label={tMenu('ribbon.statusDateClear')}
            onClick={() => setStatusDate(undefined)}
            style={{ padding: 2 }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );

  const progressModeControl = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px' }}>
      <span className="ribbon-info">{tMenu('ribbon.progressMode')}</span>
      <RibbonDropdown
        value={progressMode ?? 'RETAINED_LOGIC'}
        options={[
          { value: 'RETAINED_LOGIC', label: tMenu('ribbon.progressModeRetained') },
          { value: 'PROGRESS_OVERRIDE', label: tMenu('ribbon.progressModeOverride') },
        ]}
        onChange={v => setProgressMode(v as 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE')}
      />
    </div>
  );

  if (!compact) {
    return (
      <>
        <RibbonButton icon={<Flag size={20} />} label={tMenu('ribbon.saveBaseline')} onClick={onSaveBaseline} />
        <RibbonButton icon={<GitCompareArrows size={20} />} label={tMenu('ribbon.manageBaselines')} onClick={onManageBaselines} />
        {statusDateControl}
        {progressModeControl}
      </>
    );
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      panelStyle={{
        marginTop: 2, zIndex: 9999,
        padding: 8, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200,
      }}
      trigger={
        <button
          className="ribbon-btn small"
          onClick={() => setOpen(o => !o)}
          title={tMenu('ribbon.baselines')}
          aria-label={tMenu('ribbon.baselines')}
          style={{ minWidth: 0, padding: '2px 5px', gap: 0 }}
        >
          <span className="ribbon-btn-icon" style={{ width: 16, height: 16 }}><Flag size={14} /></span>
        </button>
      }
    >
      <button
        className="ribbon-btn small"
        style={{ width: '100%' }}
        onClick={() => { onSaveBaseline(); setOpen(false); }}
      >
        <span className="ribbon-btn-icon"><Flag size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.saveBaseline')}</span>
      </button>
      <button
        className="ribbon-btn small"
        style={{ width: '100%' }}
        onClick={() => { onManageBaselines(); setOpen(false); }}
      >
        <span className="ribbon-btn-icon"><GitCompareArrows size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.manageBaselines')}</span>
      </button>
      <div style={{ height: 1, background: 'var(--theme-border-light)', margin: '4px 0' }} />
      {statusDateControl}
      {progressModeControl}
    </Popover>
  );
}

/**
 * Mijlpaal-knop met keuzemenu (fase 2.4): startmijlpaal, eindmijlpaal of
 * inspectiemoment (eindmijlpaal + taaktype Keuring/Inspectie + verplicht).
 *
 * Issue #49: plaatst de mijlpaal onder de selectie i.p.v. altijd achteraan — exact dezelfde regel
 * en dezelfde gedeelde route als de lintknop "+ Taak" (`addTaskNearSelection`).
 */
export function MilestoneDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  const [open, setOpen] = useState(false);

  const add = (kind: 'START' | 'FINISH', inspection: boolean) => {
    addTaskNearSelection({
      name: tTask(inspection ? 'defaultInspection' : 'defaultMilestone'),
      isMilestone: true,
      milestoneKind: kind,
      taskType: inspection ? 'ATTENDANCE' : 'USERDEFINED',
      ...(inspection ? { mandatory: true } : {}),
    });
    setOpen(false);
  };

  const items: { key: string; label: string; onClick: () => void }[] = [
    { key: 'start', label: tMenu('ribbon.startMilestone'), onClick: () => add('START', false) },
    { key: 'finish', label: tMenu('ribbon.finishMilestone'), onClick: () => add('FINISH', false) },
    { key: 'inspection', label: tMenu('ribbon.inspectionMilestone'), onClick: () => add('FINISH', true) },
  ];

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{ zIndex: 1000, minWidth: 200, padding: '4px 0' }}
      trigger={
        <button className="ribbon-btn" onClick={() => setOpen(!open)}>
          <span className="ribbon-btn-icon"><Diamond size={20} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.milestone')} ▾</span>
        </button>
      }
    >
      {items.map(item => (
        <button
          key={item.key}
          className="!text-body"
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
            border: 'none', background: 'transparent',
            color: 'var(--theme-text)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </Popover>
  );
}

export interface RelationActionAvailability {
  linkSelected: boolean;
  addExternal: boolean;
  refreshExternal: boolean;
}

/** Pure beschikbaarheidsregels achter de vier vaste dropdownacties. */
export function relationActionAvailability(
  selectedTaskCount: number,
  externalRelationCount: number,
): RelationActionAvailability {
  return {
    linkSelected: selectedTaskCount === 2,
    addExternal: selectedTaskCount === 1,
    refreshExternal: externalRelationCount > 0,
  };
}

/**
 * Relatie is bewust een keuzemenu met vier vaste betekenissen. De selectie bepaalt alleen of een
 * actie beschikbaar is; de hoofdknop verandert nooit meer stil van gedrag.
 */
export function RelationDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [externalTaskId, setExternalTaskId] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState('');
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const dependencyMode = useAppStore(s => s.ui.showDependencyMode);
  const externalRelationCount = useAppStore(s => s.tasks.reduce(
    (count, task) => count + (task.externalLinks?.length ?? 0),
    0,
  ));
  const setUI = useAppStore(s => s.setUI);
  const refreshAllExternalAnchors = useAppStore(s => s.refreshAllExternalAnchors);
  const availability = relationActionAvailability(selectedTaskIds.length, externalRelationCount);

  const items: Array<{
    key: 'draw' | 'linkSelected' | 'addExternal' | 'refreshExternal';
    label: string;
    disabled: boolean;
    title: string;
    active?: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'draw',
      label: tMenu('ribbon.relationDraw'),
      disabled: false,
      active: dependencyMode,
      title: tMenu(dependencyMode ? 'ribbon.relationDrawOffHint' : 'ribbon.relationDrawOnHint'),
      onClick: () => {
        setUI({ showDependencyMode: !dependencyMode });
        setOpen(false);
      },
    },
    {
      key: 'linkSelected',
      label: tMenu('ribbon.relationLinkSelected'),
      disabled: !availability.linkSelected,
      title: availability.linkSelected
        ? tMenu('ribbon.relationLinkSelectedHint')
        : tMenu('ribbon.relationSelectExactlyTwo'),
      onClick: () => {
        createRelationWithFeedback(selectedTaskIds[0], selectedTaskIds[1], 'FINISH_START');
        setOpen(false);
      },
    },
    {
      key: 'addExternal',
      label: tMenu('ribbon.relationAddExternal'),
      disabled: !availability.addExternal,
      title: availability.addExternal
        ? tMenu('ribbon.relationAddExternalHint')
        : tMenu('ribbon.relationSelectOne'),
      onClick: () => {
        setExternalTaskId(selectedTaskIds[0]);
        setOpen(false);
      },
    },
    {
      key: 'refreshExternal',
      label: tMenu('ribbon.relationRefreshExternal'),
      disabled: !availability.refreshExternal,
      title: availability.refreshExternal
        ? tTask('externalLinks.refreshAllHint')
        : tMenu('ribbon.relationNoExternal'),
      onClick: () => {
        void (async () => {
          const result = await refreshAllExternalAnchors(buildImportLabels(tCommon));
          setRefreshStatus(result.sources === 0
            ? tTask('externalLinks.noSourcesToast')
            : tTask('externalLinks.refreshedToast', { refreshed: result.refreshed, missing: result.missing }));
        })();
      },
    },
  ];

  return (
    <>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        panelStyle={{ zIndex: 1000, minWidth: 260, padding: '4px 0' }}
        trigger={
          <button
            className={`ribbon-btn${dependencyMode ? ' active' : ''}`}
            onClick={() => setOpen(current => !current)}
            title={tMenu('ribbon.relation')}
            aria-label={tMenu('ribbon.relation')}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="ribbon-btn-icon"><Link size={20} /></span>
            <span className="ribbon-btn-label">{tMenu('ribbon.relation')} ▾</span>
          </button>
        }
      >
        <div role="menu" aria-label={tMenu('ribbon.relation')}>
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-disabled={item.disabled || undefined}
              title={item.title}
              className="ribbon-relation-menu-item"
              onClick={item.disabled ? undefined : item.onClick}
            >
              <span className="ribbon-relation-menu-mark" aria-hidden="true">{item.active ? '✓' : ''}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {refreshStatus && <div className="ribbon-relation-menu-status" role="status">{refreshStatus}</div>}
        </div>
      </Popover>
      {externalTaskId && (
        <ExternalLinkDialog taskId={externalTaskId} onClose={() => setExternalTaskId(null)} />
      )}
    </>
  );
}

/** Sjablonen (fase 2.2): lijst uit localStorage; klik = invoegen onder de selectie (of root). */
export function TemplatesDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<WbsTemplate[]>([]);
  const insertWbsTemplate = useAppStore(s => s.insertWbsTemplate);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);

  // Sjablonenlijst verversen bij elk openen (localStorage kan intussen gewijzigd zijn).
  useEffect(() => {
    if (open) setTemplates(listWbsTemplates());
  }, [open]);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{ zIndex: 1000, minWidth: 240, maxWidth: 360, padding: '4px 0' }}
      trigger={
        <button className="ribbon-btn small" onClick={() => setOpen(!open)}>
          <span className="ribbon-btn-icon"><LayoutTemplate size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.templates')}</span>
        </button>
      }
    >
      {templates.length === 0 ? (
        <div className="!text-body" style={{ padding: '8px 12px', color: 'var(--theme-text-dim)' }}>
          {tMenu('ribbon.noTemplates')}
        </div>
      ) : (
        templates.map(tpl => (
          <div key={tpl.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="!text-body"
              style={{
                flex: 1, textAlign: 'left', padding: '6px 12px', border: 'none',
                background: 'transparent', color: 'var(--theme-text)', cursor: 'pointer',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={tMenu('ribbon.insertTemplateHint')}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                insertWbsTemplate(tpl, selectedTaskIds[0] ?? null);
                setOpen(false);
              }}
            >
              {tpl.name}
              <span className="!text-caption" style={{ display: 'block', color: 'var(--theme-text-dim)', marginTop: 1 }}>
                {tMenu('ribbon.templateMeta', { tasks: tpl.tasks.length, relations: tpl.sequences.length })}
              </span>
            </button>
            <button
              style={{ padding: '0 10px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
              title={tMenu('ribbon.deleteTemplate')}
              onClick={() => { deleteWbsTemplate(tpl.id); setTemplates(listWbsTemplates()); }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}
    </Popover>
  );
}

export function RecentFilesDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const recentFiles = useAppStore(s => s.recentFiles);
  const openRecentFile = useAppStore(s => s.openRecentFile);

  // Fallback-web (Firefox/Safari): geen herbruikbare refs → geen (dode) recents tonen (spec §6).
  if (!supportsHandles()) return null;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{ zIndex: 1000, minWidth: 280, maxWidth: 400, padding: '4px 0' }}
      trigger={
        <button
          className="ribbon-btn small"
          onClick={() => setOpen(!open)}
        >
          <span className="ribbon-btn-icon"><History size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('backstage.recent')}</span>
        </button>
      }
    >
      {recentFiles.length === 0 ? (
        <div className="!text-body" style={{ padding: '8px 12px', color: 'var(--theme-text-dim)' }}>
          {tMenu('ribbon.noRecentFiles')}
        </div>
      ) : (
        recentFiles.map(e => {
          // Subregel: het echte pad (Tauri) of de bestandsnaam (web-handle, geen pad beschikbaar).
          const sub = e.ref.kind === 'path' ? e.ref.path : e.name;
          return (
            <button
              key={e.id}
              className="!text-body"
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', border: 'none',
                background: 'transparent', color: 'var(--theme-text)',
                cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={sub}
              onMouseOver={ev => (ev.currentTarget.style.background = 'var(--theme-hover)')}
              onMouseOut={ev => (ev.currentTarget.style.background = 'transparent')}
              onClick={() => { void openRecentFile(e.id, buildImportLabels(tCommon)); setOpen(false); }}
            >
              {e.name}
              <span className="!text-caption" style={{ display: 'block', color: 'var(--theme-text-dim)', marginTop: 1 }}>
                {sub}
              </span>
            </button>
          );
        })
      )}
    </Popover>
  );
}

export function ExportDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const exportAs = useAppStore(s => s.exportAs);

  const formats: { label: string; format: ExportFormat }[] = EXPORT_FORMATS.map(
    (f) => ({ label: tMenu(f.shortLabelKey ?? f.labelKey), format: f.format }),
  );

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{ zIndex: 1000, minWidth: 180, padding: '4px 0' }}
      trigger={
        <button
          className="ribbon-btn small"
          onClick={() => setOpen(!open)}
        >
          <span className="ribbon-btn-icon"><Download size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('backstage.export')}</span>
        </button>
      }
    >
      {formats.map((f) => (
        <button
          key={f.format}
          className="!text-body"
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '6px 12px', border: 'none',
            background: 'transparent', color: 'var(--theme-text)',
            cursor: 'pointer',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => {
            // K7: exportAs geeft sinds deze wijziging een resultaat terug. Op dit tabblad is
            // GanttCanvas gemonteerd, dus bij een cyclus (ok===false) vuurt daar al de
            // cyclus-toast — bewust géén tweede meldmechanisme hier. Tussenstand: K8 trekt het
            // foutkanaal samen tot één toast in uiSlice. Popover direct dicht, vóór de dialoog.
            void exportAs(f.format);
            setOpen(false);
          }}
        >
          {f.label}
        </button>
      ))}
    </Popover>
  );
}

/**
 * Extensie-knoppen: door extensies geregistreerde ribbon-knoppen, gegroepeerd
 * per groepslabel, achteraan de actieve tab gerenderd.
 */
export function ExtensionRibbonGroups({ tab }: { tab: RibbonTab }) {
  const buttons = useAppStore(s => s.extensionRibbonButtons);
  const forTab = buttons.filter(b => b.tab === tab);
  if (forTab.length === 0) return null;

  const groups = new Map<string, typeof forTab>();
  for (const b of forTab) {
    const list = groups.get(b.group) ?? [];
    list.push(b);
    groups.set(b.group, list);
  }

  return (
    <>
      {[...groups.entries()].map(([group, btns]) => (
        <span key={group} style={{ display: 'contents' }}>
          <div className="ribbon-separator" />
          <RibbonGroup label={group}>
            {btns.map(b => (
              <RibbonButton
                key={`${b.extensionId}:${b.label}`}
                label={b.label}
                // K6a: ribbon-iconen komen uit draaiende extensiecode — hygiëne, maar loopt
                // langs dezelfde sanitizer als de manifest-iconen.
                icon={
                  <ExtensionIcon
                    raw={b.icon}
                    fallback={<Puzzle size={20} />}
                    style={{ display: 'inline-flex', width: 20, height: 20 }}
                  />
                }
                onClick={b.onClick}
              />
            ))}
          </RibbonGroup>
        </span>
      ))}
    </>
  );
}

/**
 * Toewijs-popover (fase 2.5, §6.1): alleen actief bij precies één geselecteerde leaf-, niet-
 * milestone-taak; toont de nog-niet-toegewezen resources en roept `assignResource` direct aan.
 */
export function ResourceAssignDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const [open, setOpen] = useState(false);
  // Toewijzingsparameters in de popover (bevinding 2): eenheden/dag + verdeelcurve, zodat een
  // toewijzing in één beweging compleet is (voorheen hardgecodeerd op 1 / UNIFORM).
  const [units, setUnits] = useState(1);
  const [curve, setCurve] = useState<ResourceCurve>('UNIFORM');
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const tasks = useAppStore(s => s.tasks);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const assignResource = useAppStore(s => s.assignResource);

  const task = selectedTaskIds.length === 1 ? tasks.find(t => t.id === selectedTaskIds[0]) : undefined;
  const valid = !!task && !task.isMilestone && task.childIds.length === 0;
  const assignedIds = new Set(assignments.filter(a => a.taskId === task?.id).map(a => a.resourceId));
  const available = resources.filter(r => !assignedIds.has(r.id));

  if (!valid) {
    return <RibbonButton icon={<UserPlus size={20} />} label={tMenu('ribbon.assignResource')} disabled />;
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{ zIndex: 1000, minWidth: 200, maxHeight: 300, overflowY: 'auto', padding: '4px 0' }}
      trigger={
        <button className={`ribbon-btn${open ? ' active' : ''}`} onClick={() => setOpen(!open)}>
          <span className="ribbon-btn-icon"><UserPlus size={20} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.assignResource')} ▾</span>
        </button>
      }
    >
      {available.length === 0 ? (
            <div className="!text-body" style={{ padding: '8px 12px', color: 'var(--theme-text-dim)' }}>
              {resources.length === 0 ? tTask('properties.assignments.noResources') : tTask('properties.assignments.allAssigned')}
            </div>
          ) : (
            <>
              {/* Eenheden/dag + curve gelden voor de volgende toewijzing die je aanklikt. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
                <label className="!text-small" style={{ color: 'var(--theme-text-dim)' }}>{tTask('properties.assignments.unitsPerDay')}</label>
                <UnitsInput
                  value={units}
                  ariaLabel={tTask('properties.assignments.unitsPerDay')}
                  onCommit={setUnits}
                  className="input !text-body !px-1.5 !py-1 !w-16 text-right"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 6px' }}>
                <label className="!text-small" style={{ color: 'var(--theme-text-dim)' }}>{tTask('properties.assignments.curve')}</label>
                <select
                  value={curve}
                  aria-label={tTask('properties.assignments.curve')}
                  onChange={e => setCurve(e.target.value as ResourceCurve)}
                  className="input !text-body !px-1.5 !py-1 flex-1"
                >
                  {RESOURCE_CURVES.map(c => (
                    <option key={c} value={c}>{tCommon(CURVE_KEY[c])}</option>
                  ))}
                </select>
              </div>
              <div style={{ height: 1, background: 'var(--theme-border)', margin: '2px 0' }} />
              {available.map(r => (
                <button
                  key={r.id}
                  className="!text-body"
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                    border: 'none', background: 'transparent', color: 'var(--theme-text)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => { assignResource(task!.id, r.id, units, curve); setOpen(false); }}
                >
                  {r.name || r.id}
                </button>
              ))}
            </>
          )}
    </Popover>
  );
}

/**
 * Groeperen-popover (fase 2.7, §7.4): tot 2 rijen {veld ▾, richting}. Vervangt de tijdelijke
 * één-niveau-groupdropdown uit golf 2. Live via `setGroup` (geen apart "toepassen").
 *
 * Let op de `!w-32` op de richting-select. `.input` staat in `globals.css` **buiten** elke
 * cascade-layer met `width: 100%`, terwijl Tailwind-utilities in `@layer utilities` zitten —
 * unlayered wint altijd van layered, dus een gewone `w-28` doet niets. Zonder die vaste breedte
 * eiste de richting-select 100% van de rij en hield het veld-dropdown (`flex-1`, dus
 * flex-basis 0) ~12px over: een sliver zonder leesbare tekst. Zelfde valkuil als issue #46.
 */
/**
 * Eén app-globale bediening voor scherm én rapport. Categorievelden komen rechtstreeks uit Group;
 * een projectgebonden veld dat hier ontbreekt blijft bewaard maar gebruikt tijdelijk Taaktype.
 */
export function ScreenColorsPopoverButton() {
  const { t: tMenu } = useTranslation('menu');
  const selection = useAppStore(s => s.ui.barColorSelection);
  const setUI = useAppStore(s => s.setUI);
  const ctx = useFieldCatalogCtx();
  const fields = barColorFieldOptions(ctx);
  const control = effectiveBarColorControl(selection, ctx);
  const [open, setOpen] = useState(false);

  const updateSelection = (next: typeof selection) => {
    setUI({ barColorSelection: next });
    void saveBarColorSelection(next);
  };
  const selectMode = (mode: 'critical' | 'auto' | 'category') => {
    if (mode === 'critical' || mode === 'auto') {
      updateSelection({ mode });
      setOpen(false);
      return;
    }
    const effectiveField = control.effective.mode === 'category'
      ? control.effective.field
      : fields[0]?.field;
    if (effectiveField) updateSelection({ mode: 'category', field: effectiveField });
  };
  const effectiveFieldValue = control.effective.mode === 'category'
    ? encodeFieldRef(control.effective.field)
    : (fields[0] ? encodeFieldRef(fields[0].field) : '');

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{
        marginTop: 2, zIndex: 9999, minWidth: 230, padding: 8,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
      trigger={
        <button
          className={`ribbon-btn small${selection.mode !== 'critical' ? ' active' : ''}`}
          title={tMenu('ribbon.screenColors')}
          aria-label={tMenu('ribbon.screenColors')}
          onClick={() => setOpen(o => !o)}
        >
          <span className="ribbon-btn-icon"><Palette size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.screenColors')}</span>
        </button>
      }
    >
      <span className="ribbon-info" style={{ fontWeight: 600 }}>{tMenu('ribbon.screenColors')}</span>
      {(['critical', 'auto', 'category'] as const).map(mode => (
        <button
          key={mode}
          className={`ribbon-btn small w-full justify-start${selection.mode === mode ? ' active' : ''}`}
          onClick={() => selectMode(mode)}
        >
          <span className="ribbon-btn-label">{tMenu(`ribbon.screenColors_${mode}`)}</span>
        </button>
      ))}
      {selection.mode === 'category' && fields.length > 0 && (
        <RibbonInlineSelect
          value={effectiveFieldValue}
          options={fields.map(option => ({ value: encodeFieldRef(option.field), label: option.label }))}
          onChange={value => updateSelection({ mode: 'category', field: decodeFieldRef(value) })}
          ariaLabel={tMenu('ribbon.screenColors_category')}
        />
      )}
      {control.missingField && (
        <span className="ribbon-info" role="status">
          {tMenu('ribbon.screenColorsMissingField')}
        </span>
      )}
      <span className="ribbon-info">{tMenu('ribbon.screenColorsHint')}</span>
    </Popover>
  );
}

export function GroupPopoverButton() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const group = useAppStore(s => s.view.group);
  const setGroup = useAppStore(s => s.setGroup);
  const ctx = useFieldCatalogCtx();
  const fields = groupFieldList(ctx);
  const options = fieldOptions(fields, ctx);
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{
        marginTop: 2, zIndex: 9999, minWidth: 300, padding: 8,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
      trigger={
        <button
          className={`ribbon-btn small${group.length > 0 ? ' active' : ''}`}
          title={tMenu('ribbon.group')}
          aria-label={tMenu('ribbon.group')}
          onClick={() => setOpen(o => !o)}
        >
          <span className="ribbon-btn-icon"><Layers size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.group')}</span>
        </button>
      }
    >
      <span className="ribbon-info" style={{ fontWeight: 600 }}>{tCommon('view.group.title')}</span>
      <LevelListEditor
        levels={group}
        onChange={setGroup}
        options={options}
        maxLevels={2}
        emptyLabel={tCommon('view.group.noLevels')}
        addLabel={tCommon('view.group.addLevel')}
      />
    </Popover>
  );
}

/**
 * Sorteren-popover (fase 2.7, §7.4): herhaalbare rijen {veld ▾, richting}, "+ niveau" onbeperkt.
 * Live via `setSort`.
 */
export function SortPopoverButton() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const sort = useAppStore(s => s.view.sort);
  const setSort = useAppStore(s => s.setSort);
  const ctx = useFieldCatalogCtx();
  const fields = fullFieldList(ctx);
  const options = fieldOptions(fields, ctx);
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{
        marginTop: 2, zIndex: 9999, minWidth: 300, maxHeight: 320, overflowY: 'auto', padding: 8,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
      trigger={
        <button
          className={`ribbon-btn small${sort.length > 0 ? ' active' : ''}`}
          title={tMenu('ribbon.sort')}
          aria-label={tMenu('ribbon.sort')}
          onClick={() => setOpen(o => !o)}
        >
          <span className="ribbon-btn-icon"><ArrowUpDown size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.sort')}</span>
        </button>
      }
    >
      <span className="ribbon-info" style={{ fontWeight: 600 }}>{tCommon('view.sort.title')}</span>
      <LevelListEditor
        levels={sort}
        onChange={setSort}
        options={options}
        emptyLabel={tCommon('view.sort.noLevels')}
        addLabel={tCommon('view.sort.addLevel')}
      />
    </Popover>
  );
}

/**
 * Layout-groep (issue #144): elke layout is een eigen lintknop met icoon en naam — één klik zet hem
 * aan, nogmaals klikken zet hem uit en brengt het beeld van vóór de klik terug (`toggleLayout`). De
 * plusknop opent de layoutdialoog. Knoppen die verschillende delen dragen kunnen samen aanstaan
 * (resourcediagram + een filterknop); een opgeslagen filter van vóór #144 is zo'n filterknop.
 * Opslag app-globaal via `settingsStore`; meegeleverde layouts komen uit code (`builtinLayouts`).
 */
export function LayoutGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const showLayoutsDialog = useAppStore(s => s.ui.showLayoutsDialog);
  const toggleLayout = useAppStore(s => s.toggleLayout);
  // Als tekst geselecteerd: een selector die telkens een nieuwe array teruggeeft zou elke render
  // als wijziging tellen.
  const activeKey = useAppStore(s => activeLayoutIds(s).join('\n'));
  const activeIds = useMemo(() => new Set(activeKey ? activeKey.split('\n') : []), [activeKey]);

  const [layouts, setLayouts] = useState<Layout[]>([]);
  const reload = useCallback(() => { void loadLayouts().then(setLayouts); }, []);
  useEffect(() => { reload(); }, [reload]);

  // Ná het sluiten van de layouts-dialoog (mogelijke CRUD) de knoppenrij verversen.
  const prevOpenRef = useRef(showLayoutsDialog);
  useEffect(() => {
    if (prevOpenRef.current && !showLayoutsDialog) reload();
    prevOpenRef.current = showLayoutsDialog;
  }, [showLayoutsDialog, reload]);

  const buttons = useMemo(
    () => [...builtinLayouts(tCommon), ...layouts],
    [tCommon, layouts],
  );

  // Rechtsklik op een layoutknop: bewerken / dupliceren / verwijderen. Meegeleverde layouts zijn
  // alleen te dupliceren. Verwijderen vraagt eerst een bevestiging (geen native dialoog).
  const [menuId, setMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Layout | null>(null);
  const persist = (next: Layout[]) => { setLayouts(next); void saveLayouts(next); };
  const duplicate = (layout: Layout) => {
    const { id: _id, ...rest } = layout;
    persist([...layouts, { ...structuredClone(rest), id: generateId('layout'), name: tCommon('view.layout.copyName', { name: layout.name }) }]);
    setMenuId(null);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 2 }} data-ops-layout-buttons="true">
      {buttons.map(layout => {
        const builtin = isBuiltinLayoutId(layout.id);
        return (
          <Popover
            key={layout.id}
            open={menuId === layout.id}
            onClose={() => setMenuId(null)}
            panelStyle={{ marginTop: 2, zIndex: 9999, minWidth: 170, padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}
            trigger={
              <span
                data-ops-layout-button={layout.id}
                style={{ display: 'flex', height: '100%' }}
                onContextMenu={e => { e.preventDefault(); setMenuId(layout.id); }}
              >
                <RibbonButton
                  icon={layoutIcon(layout.icon ?? (isFilterOnlyLayout(layout) ? 'filter' : undefined))}
                  label={layout.name}
                  active={activeIds.has(layout.id)}
                  onClick={() => toggleLayout(layout)}
                />
              </span>
            }
          >
            {builtin ? (
              <span className="ribbon-info" style={{ padding: '4px 6px', maxWidth: 220, whiteSpace: 'normal' }}>
                {tCommon('view.layout.builtinReadonly')}
              </span>
            ) : (
              <button className="ribbon-btn small" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { setMenuId(null); setUI({ showLayoutsDialog: true, layoutDialogTargetId: layout.id }); }}>
                <span className="ribbon-btn-label">{tCommon('view.layout.edit')}</span>
              </button>
            )}
            <button className="ribbon-btn small" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => duplicate(layout)}>
              <span className="ribbon-btn-label">{tCommon('view.layout.duplicate')}</span>
            </button>
            {!builtin && (
              <button className="ribbon-btn small" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--error)' }} onClick={() => { setMenuId(null); setPendingDelete(layout); }}>
                <span className="ribbon-btn-label">{tCommon('view.layout.delete')}</span>
              </button>
            )}
          </Popover>
        );
      })}
      <RibbonButton
        icon={<Plus size={20} />}
        label={tMenu('ribbon.addLayout')}
        onClick={() => setUI({ showLayoutsDialog: true, layoutDialogTargetId: null })}
      />
      {pendingDelete && (
        <ConfirmDialog
          message={`${tCommon('view.layout.delete')}: ${pendingDelete.name}?`}
          danger
          onConfirm={() => { persist(layouts.filter(l => l.id !== pendingDelete.id)); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

/** Presentatie-groep (fase 2.7, §9/§10/§11): presentation-toggle (F11), split view, mini-map. */
export function PresentationGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const presentationMode = useAppStore(s => s.ui.presentationMode);
  const setPresentationMode = useAppStore(s => s.setPresentationMode);
  const splitView = useAppStore(s => s.view.splitView);
  const setSplitView = useAppStore(s => s.setSplitView);
  const showMiniMap = useAppStore(s => s.ui.showMiniMap);
  const setUI = useAppStore(s => s.setUI);
  const zoom = useAppStore(s => s.view.zoom);
  const scrollX = useAppStore(s => s.view.scrollX);

  const toggleSplitView = () => {
    if (splitView) setSplitView(undefined);
    else setSplitView({ ratio: 0.5, secondaryZoom: zoom, secondaryScrollX: scrollX });
  };
  const toggleMiniMap = () => {
    const next = !showMiniMap;
    setUI({ showMiniMap: next });
    void saveShowMiniMap(next);
  };

  return (
    <RibbonButtonStack>
      <RibbonSmallButton
        icon={presentationMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        label={tMenu('ribbon.presentationMode')}
        title={tMenu('ribbon.presentationMode')}
        onClick={() => setPresentationMode(!presentationMode)}
        active={presentationMode}
      />
      <RibbonSmallButton
        icon={<SplitSquareHorizontal size={14} />}
        label={tMenu('ribbon.splitView')}
        title={tMenu('ribbon.splitView')}
        onClick={toggleSplitView}
        active={!!splitView}
      />
      <RibbonSmallButton
        icon={<MapIcon size={14} />}
        label={tMenu('ribbon.miniMap')}
        title={tMenu('ribbon.miniMap')}
        onClick={toggleMiniMap}
        active={showMiniMap}
      />
    </RibbonButtonStack>
  );
}

/**
 * Tijdschaal-groep (beeld, §13): zoom +/-/reset + schaal-dropdown. De keuze mapt naar een
 * zoom-preset; de getoonde waarde wordt AFGELEID uit zoom via scaleFromZoom (§3.5) — kan dus
 * nooit desyncen van de as.
 */
export function TimeScaleGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const compact = useRibbonDensity() !== 'full';
  const zoom = useAppStore(s => s.view.zoom);
  const setZoom = useAppStore(s => s.setZoom);
  const setTimeScale = useAppStore(s => s.setTimeScale);
  const requestFitToProject = useAppStore(s => s.requestFitToProject);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);

  const zoomInOutButtons = (
    <>
      <RibbonSmallButton icon={<ZoomIn size={14} />} label={tMenu('ribbon.zoomIn')} title={tMenu('ribbon.zoomInTitle')} onClick={() => setZoom(zoom + ZOOM_STEP)} />
      <RibbonSmallButton icon={<ZoomOut size={14} />} label={tMenu('ribbon.zoomOut')} title={tMenu('ribbon.zoomOutTitle')} onClick={() => setZoom(zoom - ZOOM_STEP)} />
    </>
  );
  const resetFitButtons = (
    <>
      <RibbonSmallButton icon={<Eye size={14} />} label={tMenu('ribbon.zoomReset')} title={tMenu('ribbon.zoomResetTitle')} onClick={() => setZoom(DEFAULT_ZOOM)} />
      {/* Issue #78: "Passend op project" was alleen bereikbaar via het canvas-contextmenu, dat
          verdwijnt zodra de takentabel volledig gevuld is. `requestFitToProject` is dezelfde
          pendingFit-route als na het openen van een bestand (issue #16) — GanttCanvas kent de
          viewport-breedte en voert de echte berekening uit. */}
      <RibbonSmallButton icon={<Maximize2 size={14} />} label={tMenu('ribbon.zoomFit')} title={tMenu('ribbon.zoomFitTitle')} onClick={() => requestFitToProject()} />
    </>
  );
  const dropdown = (
    <RibbonDropdown
      value={scaleFromZoom(zoom, enableHourPlanning)}
      options={[
        { value: 'year', label: tMenu('ribbon.year') },
        { value: 'quarter', label: tMenu('ribbon.quarter') },
        { value: 'month', label: tMenu('ribbon.month') },
        { value: 'week', label: tMenu('ribbon.week') },
        { value: 'day', label: tMenu('ribbon.day') },
        // Fase 2.8b (§6.2): de uur-schaal is alleen bereikbaar met Urenplanning aan.
        ...(enableHourPlanning ? [{ value: 'hour' as TimeScale, label: tMenu('ribbon.hour') }] : []),
      ]}
      onChange={v => setTimeScale(v as TimeScale)}
    />
  );

  // Compacte modus (A1-fix): alles op één platte rij i.p.v. een 2-regelige kolom die boven de
  // 40px-strip uitstak. De afgeleide zoom-tekst valt weg (secundair); knoppen collapsen via CSS.
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {zoomInOutButtons}
        {resetFitButtons}
        <div style={{ minWidth: 96 }}>{dropdown}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div className="ribbon-time-scale-controls">
        <RibbonButtonStack>{zoomInOutButtons}</RibbonButtonStack>
        <RibbonButtonStack>{resetFitButtons}</RibbonButtonStack>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px' }}>
        {dropdown}
        <span className="ribbon-info">{tMenu('ribbon.zoomLevel', { level: Math.round(zoom) })}</span>
      </div>
    </div>
  );
}

/**
 * Kolommen-knop — gedeelde binding voor de Beeld-tab (kleine knop) en de Tabel-tab (grote knop).
 *
 * De Tabel-surface bezit de ene gedeelde `ColumnChooser`. Vanaf Beeld schakelt deze binding daarom
 * eerst naar Tabel en opent vervolgens diezelfde kiezer; er bestaat geen tweede kolomdefinitie meer.
 */
export function useColumnsButtonBinding() {
  const { t: tMenu } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  // Precies de conditie waaronder App.tsx de TableEditor mount.
  const tableVisible = useAppStore(s => s.ui.activeRibbonTab === 'table' && !s.ui.showResourcePanel);
  return {
    title: tMenu(tableVisible ? 'ribbon.columnsHintTable' : 'ribbon.columnsHintGoToTable'),
    onClick: () => setUI({ activeRibbonTab: 'table', showColumnsDialog: true }),
  };
}

/**
 * Weergave-groep (beeld, §13/§5.5/§6/§7.4): kolommen-dialoog, filter-editor, groepeer-/
 * sorteer-popovers. Narrow "small"-knoppen zodat de groep smal blijft en in compacte modus
 * niet overlapt.
 */
function SavedFilterDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const filter = useAppStore(s => s.view.filter);
  const setFilter = useAppStore(s => s.setFilter);
  const applyLayout = useAppStore(s => s.applyLayout);
  const showFilterDialog = useAppStore(s => s.ui.showFilterDialog);
  const showLayoutsDialog = useAppStore(s => s.ui.showLayoutsDialog);
  const [open, setOpen] = useState(false);
  // Issue #144: opgeslagen filters zijn layouts die alleen een filter dragen — één opslag, en
  // toepassen loopt via `applyLayout` (dus mét undo-stap), net als in de layoutlijst.
  const [savedFilters, setSavedFilters] = useState<Layout[]>([]);

  const loadFilterLayouts = useCallback(() => loadLayouts().then(all => all.filter(isFilterOnlyLayout)), []);
  const reload = useCallback(() => { void loadFilterLayouts().then(setSavedFilters); }, [loadFilterLayouts]);
  useEffect(() => { reload(); }, [reload]);
  const dialogOpen = showFilterDialog || showLayoutsDialog;
  const previousDialogOpen = useRef(dialogOpen);
  useEffect(() => {
    if (previousDialogOpen.current && !dialogOpen) reload();
    previousDialogOpen.current = dialogOpen;
  }, [dialogOpen, reload]);

  const openFilterControls = () => {
    // Lees bij de klik opnieuw: bij het openen van de app kan de asynchrone initiële laadactie
    // nog lopen. Daardoor wordt een bestaande preset nooit ten onrechte als een lege lijst gezien.
    void loadFilterLayouts().then(filters => {
      setSavedFilters(filters);
      if (filters.length === 0) {
        setUI({ showFilterDialog: true });
        setOpen(false);
        return;
      }
      setOpen(value => !value);
    });
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      panelStyle={{ marginTop: 2, zIndex: 9999, minWidth: 190, padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}
      trigger={
        <button
          className={`ribbon-btn small${filter !== null ? ' active' : ''}`}
          onClick={openFilterControls}
          title={tMenu('ribbon.filter')}
          aria-label={tMenu('ribbon.filter')}
        >
          <span className="ribbon-btn-icon"><Filter size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.filter')} ▾</span>
        </button>
      }
    >
      <button className="ribbon-btn small" style={{ width: '100%' }} onClick={() => { setUI({ showFilterDialog: true }); setOpen(false); }}>
        <span className="ribbon-btn-icon"><Filter size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.filter')}</span>
      </button>
      {filter !== null && (
        <button className="ribbon-btn small" style={{ width: '100%' }} onClick={() => { setFilter(null); setOpen(false); }}>
          <span className="ribbon-btn-label">{tCommon('view.filter.clear')}</span>
        </button>
      )}
      {savedFilters.map(saved => (
        <button key={saved.id} className="ribbon-btn small" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { applyLayout(saved); setOpen(false); }}>
          <span className="ribbon-btn-label">{saved.name}</span>
        </button>
      ))}
    </Popover>
  );
}

export function DisplayGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const columns = useColumnsButtonBinding();

  return (
    <div className="ribbon-display-grid icons">
      <RibbonSmallButton icon={<Columns3 size={14} />} label={tMenu('ribbon.columns')} title={columns.title} onClick={columns.onClick} />
      <SavedFilterDropdown />
      <GroupPopoverButton />
      <SortPopoverButton />
    </div>
  );
}

/**
 * Overallocatie-indicator (resources). Defensieve guard (bevinding 3): zonder resources kan er
 * geen overallocatie zijn — voorkomt een fantoomvlag als een oud resourceLoadResult nog in de
 * store staat na een document-swap/leegmaken.
 */
export function OverallocationIndicator() {
  const { t: tMenu } = useTranslation('menu');
  const resources = useAppStore(s => s.resources);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);

  const overallocatedCount = resources.length === 0
    ? 0
    : Object.values(resourceLoadResult?.overallocatedDays ?? {})
        .filter(d => (d?.length ?? 0) > 0).length;

  return (
    <div className="!text-large" style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px',
      color: overallocatedCount > 0 ? 'var(--error)' : 'var(--theme-text-dim)',
    }}>
      {overallocatedCount > 0 && <AlertTriangle size={16} />}
      <span>
        {overallocatedCount > 0
          ? tMenu('ribbon.overallocationCount', { count: overallocatedCount })
          : tMenu('ribbon.overallocationNone')}
      </span>
    </div>
  );
}

/** IFC-tab: puur informatief label (de IFC-workflow leeft in het rechter IFC-paneel). */
export function IfcInfo() {
  const { t: tMenu } = useTranslation('menu');
  return <span className="ribbon-info">{tMenu('ribbon.ifcInfo')}</span>;
}
