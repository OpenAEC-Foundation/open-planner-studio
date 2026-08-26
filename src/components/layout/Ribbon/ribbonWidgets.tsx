import { useCallback, useState, useRef, useEffect } from 'react';
import { Popover } from '@/components/common/Popover';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import {
  Diamond, ZoomIn, ZoomOut, Trash2, Eye,
  History, Download, Puzzle,
  LayoutTemplate, UserPlus, Flag, GitCompareArrows, CalendarClock, X,
  Columns3, Filter, Layers, ArrowUpDown, Maximize2, Minimize2, SplitSquareHorizontal,
  Map as MapIcon, AlertTriangle, Save, RefreshCw, Settings2,
} from 'lucide-react';
import { listWbsTemplates, deleteWbsTemplate, type WbsTemplate } from '@/utils/wbsTemplates';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import {
  saveShowMiniMap, loadLayouts, saveLayouts, loadLastLayoutId, saveLastLayoutId,
} from '@/utils/settingsStore';
import { ExportFormat } from '@/state/appStore';
import { EXPORT_FORMATS } from '@/services/formatRegistry';
import { addTaskNearSelection } from '@/state/taskInsertActions';
import { supportsHandles } from '@/services/fileAccess';
import { DateTextInput } from '@/components/common/DateTextInput';
import { ExtensionIcon } from '@/components/common/ExtensionIcon';
import { RibbonTab, type GroupLevel, type SortLevel, type Layout, type TimeScale } from '@/state/slices/types';
import type { ResourceCurve } from '@/types/resource';
import { RESOURCE_CURVES, CURVE_KEY } from '@/components/task-sections/shared';
import { UnitsInput } from '@/components/common/UnitsInput';
import { groupFieldList, fullFieldList, fieldOptions } from '@/components/viewControls/fieldCatalog';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { buildImportLabels } from '@/i18n/importLabels';
import { snapshotLayout } from '@/components/viewControls/layoutSnapshot';
import { taskGridSurfaceForRibbonTab } from '@/engine/taskGrid/preferences';
import {
  RibbonButton, RibbonSmallButton, RibbonGroup, RibbonButtonStack, RibbonDropdown,
  encodeFieldRef, decodeFieldRef,
} from './ribbonPrimitives';
import { useRibbonDensity } from './ribbonDensity';
import { ZOOM_STEP, DEFAULT_ZOOM } from '@/utils/ganttViewport';

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
          style={{
            padding: '3px 6px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', background: 'var(--theme-input-bg)',
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
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
            fontSize: 'calc(11px * var(--ui-font-scale, 1))', border: 'none', background: 'transparent',
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
        <div style={{ padding: '8px 12px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)' }}>
          {tMenu('ribbon.noTemplates')}
        </div>
      ) : (
        templates.map(tpl => (
          <div key={tpl.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              style={{
                flex: 1, textAlign: 'left', padding: '6px 12px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', border: 'none',
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
              <span style={{ display: 'block', fontSize: 'calc(9px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)', marginTop: 1 }}>
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
        <div style={{ padding: '8px 12px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)' }}>
          {tMenu('ribbon.noRecentFiles')}
        </div>
      ) : (
        recentFiles.map(e => {
          // Subregel: het echte pad (Tauri) of de bestandsnaam (web-handle, geen pad beschikbaar).
          const sub = e.ref.kind === 'path' ? e.ref.path : e.name;
          return (
            <button
              key={e.id}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', border: 'none',
                background: 'transparent', color: 'var(--theme-text)',
                cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              title={sub}
              onMouseOver={ev => (ev.currentTarget.style.background = 'var(--theme-hover)')}
              onMouseOut={ev => (ev.currentTarget.style.background = 'transparent')}
              onClick={() => { void openRecentFile(e.id, buildImportLabels(tCommon)); setOpen(false); }}
            >
              {e.name}
              <span style={{ display: 'block', fontSize: 'calc(9px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)', marginTop: 1 }}>
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
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '6px 12px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', border: 'none',
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
            <div style={{ padding: '8px 12px', fontSize: 'calc(11px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)' }}>
              {resources.length === 0 ? tTask('properties.assignments.noResources') : tTask('properties.assignments.allAssigned')}
            </div>
          ) : (
            <>
              {/* Eenheden/dag + curve gelden voor de volgende toewijzing die je aanklikt. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
                <label style={{ fontSize: 'calc(10px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)' }}>{tTask('properties.assignments.unitsPerDay')}</label>
                <UnitsInput
                  value={units}
                  ariaLabel={tTask('properties.assignments.unitsPerDay')}
                  onCommit={setUnits}
                  className="input !text-[11px] !px-1.5 !py-1 !w-16 text-right"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 6px' }}>
                <label style={{ fontSize: 'calc(10px * var(--ui-font-scale, 1))', color: 'var(--theme-text-dim)' }}>{tTask('properties.assignments.curve')}</label>
                <select
                  value={curve}
                  aria-label={tTask('properties.assignments.curve')}
                  onChange={e => setCurve(e.target.value as ResourceCurve)}
                  className="input !text-[11px] !px-1.5 !py-1 flex-1"
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
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                    fontSize: 'calc(11px * var(--ui-font-scale, 1))', border: 'none', background: 'transparent', color: 'var(--theme-text)',
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
export function GroupPopoverButton() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const group = useAppStore(s => s.view.group);
  const setGroup = useAppStore(s => s.setGroup);
  const ctx = useFieldCatalogCtx();
  const fields = groupFieldList(ctx);
  const options = fieldOptions(fields, ctx);
  const [open, setOpen] = useState(false);

  const setLevel = (i: number, changes: Partial<GroupLevel>) => {
    setGroup(group.map((g, gi) => (gi === i ? { ...g, ...changes } : g)));
  };
  const addLevel = () => {
    if (group.length >= 2 || fields.length === 0) return;
    setGroup([...group, { field: fields[0], dir: 'asc' }]);
  };
  const removeLevel = (i: number) => setGroup(group.filter((_, gi) => gi !== i));

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
      {group.length === 0 && (
        <span className="ribbon-info">{tCommon('view.group.noLevels')}</span>
      )}
      {group.map((lvl, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select
            value={encodeFieldRef(lvl.field)}
            onChange={e => setLevel(i, { field: decodeFieldRef(e.target.value) })}
            className="input !text-[11px] !px-1.5 !py-1 flex-1"
            aria-label={tCommon('view.filter.field')}
          >
            {options.map(({ field: f, label }) => (
              <option key={encodeFieldRef(f)} value={encodeFieldRef(f)}>{label}</option>
            ))}
          </select>
          <select
            value={lvl.dir}
            onChange={e => setLevel(i, { dir: e.target.value as 'asc' | 'desc' })}
            className="input !text-[11px] !px-1.5 !py-1 !w-32"
            aria-label={tCommon('view.group.direction')}
          >
            <option value="asc">{tCommon('view.sort.ascending')}</option>
            <option value="desc">{tCommon('view.sort.descending')}</option>
          </select>
          <button onClick={() => removeLevel(i)} style={{ color: 'var(--error)' }} title={tCommon('delete')}>
            <X size={13} />
          </button>
        </div>
      ))}
      {group.length < 2 && (
        <button onClick={addLevel} className="btn btn--sm btn--secondary" style={{ alignSelf: 'flex-start' }}>
          {tCommon('view.group.addLevel')}
        </button>
      )}
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

  const setLevel = (i: number, changes: Partial<SortLevel>) => {
    setSort(sort.map((lvl, li) => (li === i ? { ...lvl, ...changes } : lvl)));
  };
  const addLevel = () => {
    if (fields.length === 0) return;
    setSort([...sort, { field: fields[0], dir: 'asc' }]);
  };
  const removeLevel = (i: number) => setSort(sort.filter((_, li) => li !== i));

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
      {sort.length === 0 && (
        <span className="ribbon-info">{tCommon('view.sort.noLevels')}</span>
      )}
      {sort.map((lvl, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select
            value={encodeFieldRef(lvl.field)}
            onChange={e => setLevel(i, { field: decodeFieldRef(e.target.value) })}
            className="input !text-[11px] !px-1.5 !py-1 flex-1"
            aria-label={tCommon('view.filter.field')}
          >
            {options.map(({ field: f, label }) => (
              <option key={encodeFieldRef(f)} value={encodeFieldRef(f)}>{label}</option>
            ))}
          </select>
          <select
            value={lvl.dir}
            onChange={e => setLevel(i, { dir: e.target.value as 'asc' | 'desc' })}
            className="input !text-[11px] !px-1.5 !py-1 !w-32"
            aria-label={tCommon('view.group.direction')}
          >
            <option value="asc">{tCommon('view.sort.ascending')}</option>
            <option value="desc">{tCommon('view.sort.descending')}</option>
          </select>
          <button onClick={() => removeLevel(i)} style={{ color: 'var(--error)' }} title={tCommon('delete')}>
            <X size={13} />
          </button>
        </div>
      ))}
      <button onClick={addLevel} className="btn btn--sm btn--secondary" style={{ alignSelf: 'flex-start' }}>
        {tCommon('view.sort.addLevel')}
      </button>
    </Popover>
  );
}

/**
 * Layout-groep (fase 2.7, §8/§13): actieve-layout-dropdown (kies + toepassen) + Opslaan als…/
 * Bijwerken/Beheren…. Opslag app-globaal via `settingsStore` (§8.2); `ops-lastLayoutId` alleen als
 * dropdown-voorselectie (BIJ opstart/documentwissel NIET automatisch toegepast, §8.3).
 */
export function LayoutGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const compact = useRibbonDensity() !== 'full';
  const showLayoutsDialog = useAppStore(s => s.ui.showLayoutsDialog);
  const applyLayout = useAppStore(s => s.applyLayout);
  const view = useAppStore(s => s.view);
  const activeSurface = useAppStore(s => taskGridSurfaceForRibbonTab(s.ui.activeRibbonTab));
  const columns = useAppStore(s => s.taskGridSurfaces[activeSurface].columns);

  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const reload = useCallback(() => {
    void loadLayouts().then(setLayouts);
  }, []);

  useEffect(() => {
    reload();
    void loadLastLayoutId().then(id => { if (id) setSelectedId(id); });
  }, [reload]);

  // Ná het sluiten van de layouts-dialoog (mogelijke CRUD) de lijst verversen.
  const prevOpenRef = useRef(showLayoutsDialog);
  useEffect(() => {
    if (prevOpenRef.current && !showLayoutsDialog) reload();
    prevOpenRef.current = showLayoutsDialog;
  }, [showLayoutsDialog, reload]);

  const activeLayout = layouts.find(l => l.id === selectedId);

  const pick = (id: string) => {
    setSelectedId(id);
    const layout = layouts.find(l => l.id === id);
    if (layout) {
      applyLayout(layout);
      void saveLastLayoutId(id);
    }
  };

  const update = () => {
    if (!activeLayout) return;
    const next = layouts.map(l => (l.id === activeLayout.id
      ? snapshotLayout(view, columns, l.name, l.id)
      : l));
    setLayouts(next);
    void saveLayouts(next);
  };

  return (
    // minWidth 150 → 210 (issue #29): bij 150 kregen de drie knoppen elk maar ~46px — te weinig
    // voor "Opslaan als…"/"Beheren…" (NL) en zeker voor langere talen (bv. FR "Enregistrer sous…"),
    // wat de labels rauw liet afknippen i.p.v. netjes met "…" (zie de ellipsis-fix in Ribbon.css
    // hierboven, die als vangnet blijft voor talen die ook bij 210px nog niet passen).
    // In compacte dichtheid vervalt die ondergrens: alles staat dan op één platte rij (A2-fix,
    // issue #38 punt 4) i.p.v. een 2-regelige kolom die boven de 40px-strip uitstak.
    <div style={{
      display: 'flex',
      flexDirection: compact ? 'row' : 'column',
      alignItems: compact ? 'center' : 'stretch',
      gap: 4, padding: '2px 4px', minWidth: compact ? 0 : 210,
    }}>
      <select
        value={selectedId}
        onChange={e => pick(e.target.value)}
        className="input !text-[11px] !px-1.5 !py-1"
        style={compact ? { width: 120 } : undefined}
        aria-label={tCommon('view.layout.activeLayout')}
      >
        <option value="">{tCommon('view.layout.none')}</option>
        {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 2 }}>
        {/* Iconen zijn hier niet decoratief: in de icoon-dichtheid verbergt de CSS élk
            `.ribbon-btn-label`, dus een knop zonder icoon bleef als leeg stompje van ~14px over.
            Met een icoon houdt elke knop betekenis, en de tooltip draagt het label. */}
        <button
          className="ribbon-btn small"
          style={{ minWidth: 0, flex: '0 0 auto' }}
          onClick={() => setUI({ showLayoutsDialog: true })}
          title={tMenu('ribbon.saveLayoutAs')}
        >
          <span className="ribbon-btn-icon"><Save size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.saveLayoutAs')}</span>
        </button>
        <button
          className="ribbon-btn small"
          style={{ minWidth: 0, flex: '0 0 auto' }}
          onClick={update}
          disabled={!activeLayout}
          title={tMenu('ribbon.updateLayout')}
        >
          <span className="ribbon-btn-icon"><RefreshCw size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.updateLayout')}</span>
        </button>
        <button
          className="ribbon-btn small"
          style={{ minWidth: 0, flex: '0 0 auto' }}
          onClick={() => setUI({ showLayoutsDialog: true })}
          title={tMenu('ribbon.manageLayouts')}
        >
          <span className="ribbon-btn-icon"><Settings2 size={14} /></span>
          <span className="ribbon-btn-label">{tMenu('ribbon.manageLayouts')}</span>
        </button>
      </div>
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

  const zoomButtons = (
    <>
      <RibbonSmallButton icon={<ZoomIn size={14} />} label={tMenu('ribbon.zoomIn')} title={tMenu('ribbon.zoomInTitle')} onClick={() => setZoom(zoom + ZOOM_STEP)} />
      <RibbonSmallButton icon={<ZoomOut size={14} />} label={tMenu('ribbon.zoomOut')} title={tMenu('ribbon.zoomOutTitle')} onClick={() => setZoom(zoom - ZOOM_STEP)} />
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
        {zoomButtons}
        <div style={{ minWidth: 96 }}>{dropdown}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <RibbonButtonStack>{zoomButtons}</RibbonButtonStack>
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
export function DisplayGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);
  const filter = useAppStore(s => s.view.filter);
  const columns = useColumnsButtonBinding();

  return (
    <div className="ribbon-display-grid icons">
      <RibbonSmallButton icon={<Columns3 size={14} />} label={tMenu('ribbon.columns')} title={columns.title} onClick={columns.onClick} />
      <RibbonSmallButton icon={<Filter size={14} />} label={tMenu('ribbon.filter')} title={tMenu('ribbon.filter')} onClick={() => setUI({ showFilterDialog: true })} active={filter !== null} />
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
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', fontSize: 'calc(12px * var(--ui-font-scale, 1))',
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
