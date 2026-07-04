import { useCallback, useState, useRef, useEffect, useId } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import {
  Plus, Link, Diamond, Play, Undo2, Redo2, ZoomIn, ZoomOut,
  FileText, FolderOpen, Save, Printer, Trash2,
  Calendar, Settings, Info, Clock,
  ArrowRightLeft, Eye, EyeOff, History, SaveAll,
  Download, Puzzle, ArrowLeftToLine, ArrowRightToLine,
  Tags, ListOrdered, Hash, LayoutTemplate,
  IndentIncrease, IndentDecrease, ChevronUp, ChevronDown,
  Users, UserPlus, BarChart3, Scale, Eraser, AlertTriangle, ChevronLeft, ChevronRight,
  Flag, GitCompareArrows, CalendarClock, LayoutGrid, TrendingUp, CalendarDays, X,
  Columns3, Filter, Layers, ArrowUpDown, Maximize2, Minimize2, SplitSquareHorizontal, Map as MapIcon,
} from 'lucide-react';
import { listWbsTemplates, deleteWbsTemplate, type WbsTemplate } from '@/utils/wbsTemplates';
import { scaleFromZoom } from '@/engine/renderer/timelineTiers';
import { isTreeMode } from '@/engine/view/visibleRows';
import {
  saveRibbonCompact, saveShowHistogram, saveShowBaselineOverlay, saveShowProgressLine,
  saveShowStatusDateLine, saveShowMiniMap, loadLayouts, saveLayouts, loadLastLayoutId, saveLastLayoutId,
} from '@/utils/settingsStore';
import { ExportFormat } from '@/state/appStore';
import { formatDate } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/types/task';
import { RibbonTab, type FieldRef, type GroupLevel, type SortLevel, type Layout } from '@/state/slices/types';
import type { ResourceCurve } from '@/types/resource';
import { RESOURCE_CURVES, CURVE_KEY } from '@/components/panels/TaskPropertiesPanel';
import { UnitsInput } from '@/components/common/UnitsInput';
import { groupFieldList, fullFieldList, fieldLabel } from '@/components/viewControls/fieldCatalog';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { snapshotLayout } from '@/components/viewControls/layoutSnapshot';
import './Ribbon.css';

function encodeFieldRef(f: FieldRef): string {
  return JSON.stringify(f);
}
function decodeFieldRef(s: string): FieldRef {
  return JSON.parse(s) as FieldRef;
}

function RibbonDropdown<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 100 }}>
      <button
        id={id}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '4px 8px',
          background: 'var(--theme-input-bg)',
          border: '1px solid var(--theme-control-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--theme-text)',
          fontSize: 11,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <span>{current?.label ?? value}</span>
        <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 2,
          minWidth: '100%',
          background: 'var(--theme-dropdown-bg)',
          border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)',
          zIndex: 9999,
          boxShadow: 'var(--shadow-pop)',
        }}>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '5px 8px',
                background: o.value === value ? 'var(--theme-active)' : 'var(--theme-dropdown-bg)',
                color: 'var(--theme-text)',
                border: 'none',
                textAlign: 'left',
                fontSize: 11,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (o.value !== value) (e.target as HTMLElement).style.background = 'var(--theme-hover)'; }}
              onMouseLeave={e => { if (o.value !== value) (e.target as HTMLElement).style.background = 'var(--theme-dropdown-bg)'; }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RibbonButton({ icon, label, onClick, active, disabled, primary, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const cls = ['ribbon-btn'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (primary) cls.push('primary');
  if (danger) cls.push('danger');
  return (
    <button className={cls.join(' ')} onClick={disabled ? undefined : onClick}>
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}</span>
    </button>
  );
}

function RibbonSmallButton({ icon, label, onClick, active, disabled, danger, title }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const cls = ['ribbon-btn', 'small'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (danger) cls.push('danger');
  return (
    <button className={cls.join(' ')} onClick={disabled ? undefined : onClick} title={title}>
      <span className="ribbon-btn-icon">{icon}</span>
      <span className="ribbon-btn-label">{label}</span>
    </button>
  );
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-content">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}

function RibbonButtonStack({ children }: { children: React.ReactNode }) {
  return <div className="ribbon-btn-stack">{children}</div>;
}

/**
 * Baselines & voortgang-groep (fase 2.6, §11.1): Save/Manage baseline-knoppen +
 * statusdatum + voortgangsmodus. In de normale lint-modus staan alle vier altijd
 * zichtbaar naast elkaar; in compacte modus (QA-bevinding 2.6a) is dat samen te
 * breed voor de Planning-tab (die met de bestaande groepen al bijna de volledige
 * 1280px in beslag neemt) — de vier controls overlapten buren en de inklap-pijl.
 * Daarom gaat de hele groep in compacte modus achter één knop met popover (zelfde
 * patroon als MilestoneDropdown/TemplatesDropdown hierboven).
 */
function BaselinesProgressGroupContent({
  compact, onSaveBaseline, onManageBaselines,
  statusDate, setStatusDate, progressMode, setProgressMode,
}: {
  compact: boolean;
  onSaveBaseline: () => void;
  onManageBaselines: () => void;
  statusDate: string | undefined;
  setStatusDate: (v: string | undefined) => void;
  progressMode: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE' | undefined;
  setProgressMode: (v: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE') => void;
}) {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const statusDateControl = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px' }}>
      <span className="ribbon-info">{tMenu('ribbon.statusDate')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <CalendarClock size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
        <input
          type="date"
          value={statusDate ?? ''}
          onChange={e => setStatusDate(e.target.value || undefined)}
          aria-label={tMenu('ribbon.statusDate')}
          style={{
            padding: '3px 6px', fontSize: 11, background: 'var(--theme-input-bg)',
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
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="ribbon-btn small"
        onClick={() => setOpen(o => !o)}
        title={tMenu('ribbon.baselines')}
        aria-label={tMenu('ribbon.baselines')}
        style={{ minWidth: 0, padding: '2px 5px', gap: 0 }}
      >
        <span className="ribbon-btn-icon" style={{ width: 16, height: 16 }}><Flag size={14} /></span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 2, zIndex: 9999,
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)',
          padding: 8, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200,
        }}>
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
        </div>
      )}
    </div>
  );
}

/** Sjablonen (fase 2.2): lijst uit localStorage; klik = invoegen onder de selectie (of root). */
/**
 * Mijlpaal-knop met keuzemenu (fase 2.4): startmijlpaal, eindmijlpaal of
 * inspectiemoment (eindmijlpaal + taaktype Keuring/Inspectie + verplicht).
 */
function MilestoneDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  const [open, setOpen] = useState(false);
  const addTask = useAppStore(s => s.addTask);
  const project = useAppStore(s => s.project);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const add = (kind: 'START' | 'FINISH', inspection: boolean) => {
    addTask({
      name: tTask(inspection ? 'defaultInspection' : 'defaultMilestone'),
      isMilestone: true,
      milestoneKind: kind,
      taskType: inspection ? 'ATTENDANCE' : 'USERDEFINED',
      ...(inspection ? { mandatory: true } : {}),
      time: createDefaultTaskTime(project.startDate || formatDate(new Date()), 0),
    });
    setOpen(false);
  };

  const items: { key: string; label: string; onClick: () => void }[] = [
    { key: 'start', label: tMenu('ribbon.startMilestone'), onClick: () => add('START', false) },
    { key: 'finish', label: tMenu('ribbon.finishMilestone'), onClick: () => add('FINISH', false) },
    { key: 'inspection', label: tMenu('ribbon.inspectionMilestone'), onClick: () => add('FINISH', true) },
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="ribbon-btn" onClick={() => setOpen(!open)}>
        <span className="ribbon-btn-icon"><Diamond size={20} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.milestone')} ▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000, minWidth: 200,
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: '4px 0',
        }}>
          {items.map(item => (
            <button
              key={item.key}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                fontSize: 11, border: 'none', background: 'transparent',
                color: 'var(--theme-text)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<WbsTemplate[]>([]);
  const insertWbsTemplate = useAppStore(s => s.insertWbsTemplate);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTemplates(listWbsTemplates());
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="ribbon-btn small" onClick={() => setOpen(!open)}>
        <span className="ribbon-btn-icon"><LayoutTemplate size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.templates')}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          minWidth: 240, maxWidth: 360,
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: '4px 0',
        }}>
          {templates.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--theme-text-dim)' }}>
              {tMenu('ribbon.noTemplates')}
            </div>
          ) : (
            templates.map(tpl => (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  style={{
                    flex: 1, textAlign: 'left', padding: '6px 12px', fontSize: 11, border: 'none',
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
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--theme-text-dim)', marginTop: 1 }}>
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
        </div>
      )}
    </div>
  );
}

function RecentFilesDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const recentFiles = useAppStore(s => s.getRecentFiles)();
  const openRecentFile = useAppStore(s => s.openRecentFile);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="ribbon-btn small"
        onClick={() => setOpen(!open)}
      >
        <span className="ribbon-btn-icon"><History size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('backstage.recent')}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          minWidth: 280, maxWidth: 400,
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: '4px 0',
        }}>
          {recentFiles.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--theme-text-dim)' }}>
              {tMenu('ribbon.noRecentFiles')}
            </div>
          ) : (
            recentFiles.map((fp, i) => (
              <button
                key={i}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 12px', fontSize: 11, border: 'none',
                  background: 'transparent', color: 'var(--theme-text)',
                  cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                title={fp}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { openRecentFile(fp); setOpen(false); }}
              >
                {fp.split(/[/\\]/).pop()}
                <span style={{ display: 'block', fontSize: 9, color: 'var(--theme-text-dim)', marginTop: 1 }}>
                  {fp}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ExportDropdown() {
  const { t: tMenu } = useTranslation('menu');
  const [open, setOpen] = useState(false);
  const exportAs = useAppStore(s => s.exportAs);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const formats: { label: string; format: ExportFormat }[] = [
    { label: tMenu('export.csvShort'), format: 'csv' },
    { label: tMenu('export.mspdiLabel'), format: 'mspdi' },
    { label: tMenu('export.p6Label'), format: 'p6' },
    { label: tMenu('export.ifcLabel'), format: 'ifc' },
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="ribbon-btn small"
        onClick={() => setOpen(!open)}
      >
        <span className="ribbon-btn-icon"><Download size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('backstage.export')}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          minWidth: 180,
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: '4px 0',
        }}>
          {formats.map((f) => (
            <button
              key={f.format}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', fontSize: 11, border: 'none',
                background: 'transparent', color: 'var(--theme-text)',
                cursor: 'pointer',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--theme-hover)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { exportAs(f.format); setOpen(false); }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Extensie-knoppen: door extensies geregistreerde ribbon-knoppen, gegroepeerd
 * per groepslabel, achteraan de actieve tab gerenderd.
 */
function ExtensionRibbonGroups({ tab }: { tab: RibbonTab }) {
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
                icon={
                  b.icon
                    ? <span style={{ display: 'inline-flex', width: 20, height: 20 }} dangerouslySetInnerHTML={{ __html: b.icon }} />
                    : <Puzzle size={20} />
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
function ResourceAssignDropdown() {
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const task = selectedTaskIds.length === 1 ? tasks.find(t => t.id === selectedTaskIds[0]) : undefined;
  const valid = !!task && !task.isMilestone && task.childIds.length === 0;
  const assignedIds = new Set(assignments.filter(a => a.taskId === task?.id).map(a => a.resourceId));
  const available = resources.filter(r => !assignedIds.has(r.id));

  if (!valid) {
    return <RibbonButton icon={<UserPlus size={20} />} label={tMenu('ribbon.assignResource')} disabled />;
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`ribbon-btn${open ? ' active' : ''}`} onClick={() => setOpen(!open)}>
        <span className="ribbon-btn-icon"><UserPlus size={20} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.assignResource')} ▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000, minWidth: 200, maxHeight: 300, overflowY: 'auto',
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: '4px 0',
        }}>
          {available.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--theme-text-dim)' }}>
              {resources.length === 0 ? tTask('properties.assignments.noResources') : tTask('properties.assignments.allAssigned')}
            </div>
          ) : (
            <>
              {/* Eenheden/dag + curve gelden voor de volgende toewijzing die je aanklikt. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
                <label style={{ fontSize: 10, color: 'var(--theme-text-dim)' }}>{tTask('properties.assignments.unitsPerDay')}</label>
                <UnitsInput
                  value={units}
                  ariaLabel={tTask('properties.assignments.unitsPerDay')}
                  onCommit={setUnits}
                  className="input !text-[11px] !px-1.5 !py-1 !w-16 text-right"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 6px' }}>
                <label style={{ fontSize: 10, color: 'var(--theme-text-dim)' }}>{tTask('properties.assignments.curve')}</label>
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
                    fontSize: 11, border: 'none', background: 'transparent', color: 'var(--theme-text)',
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
        </div>
      )}
    </div>
  );
}

/**
 * Groeperen-popover (fase 2.7, §7.4): tot 2 rijen {veld ▾, richting}. Vervangt de tijdelijke
 * één-niveau-groupdropdown uit golf 2. Live via `setGroup` (geen apart "toepassen").
 */
function GroupPopoverButton() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const group = useAppStore(s => s.view.group);
  const setGroup = useAppStore(s => s.setGroup);
  const ctx = useFieldCatalogCtx();
  const fields = groupFieldList(ctx);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const setLevel = (i: number, changes: Partial<GroupLevel>) => {
    setGroup(group.map((g, gi) => (gi === i ? { ...g, ...changes } : g)));
  };
  const addLevel = () => {
    if (group.length >= 2 || fields.length === 0) return;
    setGroup([...group, { field: fields[0], dir: 'asc' }]);
  };
  const removeLevel = (i: number) => setGroup(group.filter((_, gi) => gi !== i));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`ribbon-btn small${group.length > 0 ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="ribbon-btn-icon"><Layers size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.group')}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 9999, minWidth: 260,
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: 8,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
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
                {fields.map(f => (
                  <option key={encodeFieldRef(f)} value={encodeFieldRef(f)}>{fieldLabel(f, ctx)}</option>
                ))}
              </select>
              <select
                value={lvl.dir}
                onChange={e => setLevel(i, { dir: e.target.value as 'asc' | 'desc' })}
                className="input !text-[11px] !px-1.5 !py-1"
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
        </div>
      )}
    </div>
  );
}

/**
 * Sorteren-popover (fase 2.7, §7.4): herhaalbare rijen {veld ▾, richting}, "+ niveau" onbeperkt.
 * Live via `setSort`.
 */
function SortPopoverButton() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const sort = useAppStore(s => s.view.sort);
  const setSort = useAppStore(s => s.setSort);
  const ctx = useFieldCatalogCtx();
  const fields = fullFieldList(ctx);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const setLevel = (i: number, changes: Partial<SortLevel>) => {
    setSort(sort.map((lvl, li) => (li === i ? { ...lvl, ...changes } : lvl)));
  };
  const addLevel = () => {
    if (fields.length === 0) return;
    setSort([...sort, { field: fields[0], dir: 'asc' }]);
  };
  const removeLevel = (i: number) => setSort(sort.filter((_, li) => li !== i));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`ribbon-btn small${sort.length > 0 ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="ribbon-btn-icon"><ArrowUpDown size={14} /></span>
        <span className="ribbon-btn-label">{tMenu('ribbon.sort')}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 9999, minWidth: 260,
          maxHeight: 320, overflowY: 'auto',
          background: 'var(--theme-dropdown-bg)', border: '1px solid var(--theme-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-pop)', padding: 8,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
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
                {fields.map(f => (
                  <option key={encodeFieldRef(f)} value={encodeFieldRef(f)}>{fieldLabel(f, ctx)}</option>
                ))}
              </select>
              <select
                value={lvl.dir}
                onChange={e => setLevel(i, { dir: e.target.value as 'asc' | 'desc' })}
                className="input !text-[11px] !px-1.5 !py-1"
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
        </div>
      )}
    </div>
  );
}

/**
 * Layout-groep (fase 2.7, §8/§13): actieve-layout-dropdown (kies + toepassen) + Opslaan als…/
 * Bijwerken/Beheren…. Opslag app-globaal via `settingsStore` (§8.2); `ops-lastLayoutId` alleen als
 * dropdown-voorselectie (BIJ opstart/documentwissel NIET automatisch toegepast, §8.3).
 */
function LayoutGroupContent() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const showLayoutsDialog = useAppStore(s => s.ui.showLayoutsDialog);
  const applyLayout = useAppStore(s => s.applyLayout);
  const view = useAppStore(s => s.view);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);

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
      ? snapshotLayout(view, activityCodeTypes, customFieldDefs, l.name, l.id)
      : l));
    setLayouts(next);
    void saveLayouts(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px', minWidth: 150 }}>
      <select
        value={selectedId}
        onChange={e => pick(e.target.value)}
        className="input !text-[11px] !px-1.5 !py-1"
        aria-label={tCommon('view.layout.activeLayout')}
      >
        <option value="">{tCommon('view.layout.none')}</option>
        {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          className="ribbon-btn small"
          style={{ minWidth: 0, flex: 1 }}
          onClick={() => setUI({ showLayoutsDialog: true })}
          title={tMenu('ribbon.saveLayoutAs')}
        >
          <span className="ribbon-btn-label">{tMenu('ribbon.saveLayoutAs')}</span>
        </button>
        <button
          className="ribbon-btn small"
          style={{ minWidth: 0, flex: 1 }}
          onClick={update}
          disabled={!activeLayout}
          title={tMenu('ribbon.updateLayout')}
        >
          <span className="ribbon-btn-label">{tMenu('ribbon.updateLayout')}</span>
        </button>
        <button
          className="ribbon-btn small"
          style={{ minWidth: 0, flex: 1 }}
          onClick={() => setUI({ showLayoutsDialog: true })}
          title={tMenu('ribbon.manageLayouts')}
        >
          <span className="ribbon-btn-label">{tMenu('ribbon.manageLayouts')}</span>
        </button>
      </div>
    </div>
  );
}

/** Presentatie-groep (fase 2.7, §9/§10/§11): presentation-toggle (F11), split view, mini-map. */
function PresentationGroupContent() {
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
    <>
      <RibbonButton
        icon={presentationMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        label={tMenu('ribbon.presentationMode')}
        onClick={() => setPresentationMode(!presentationMode)}
        active={presentationMode}
      />
      <RibbonButton
        icon={<SplitSquareHorizontal size={20} />}
        label={tMenu('ribbon.splitView')}
        onClick={toggleSplitView}
        active={!!splitView}
      />
      <RibbonButton
        icon={<MapIcon size={20} />}
        label={tMenu('ribbon.miniMap')}
        onClick={toggleMiniMap}
        active={showMiniMap}
      />
    </>
  );
}

export function Ribbon() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');

  const addTask = useAppStore(s => s.addTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const runCPM = useAppStore(s => s.runCPM);
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);
  const setZoom = useAppStore(s => s.setZoom);
  const zoom = useAppStore(s => s.view.zoom);
  const setUI = useAppStore(s => s.setUI);
  const showDependencyMode = useAppStore(s => s.ui.showDependencyMode);
  const traceMode = useAppStore(s => s.ui.traceMode);
  const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
  const view = useAppStore(s => s.view);
  const setWbsAutoNumber = useAppStore(s => s.setWbsAutoNumber);
  const renumberWbs = useAppStore(s => s.renumberWbs);
  const indentTasks = useAppStore(s => s.indentTasks);
  const outdentTasks = useAppStore(s => s.outdentTasks);
  const ribbonCompact = useAppStore(s => s.ui.ribbonCompact);
  const project = useAppStore(s => s.project);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const setTimeScale = useAppStore(s => s.setTimeScale);
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const saveFile = useAppStore(s => s.saveFile);
  const saveFileAs = useAppStore(s => s.saveFileAs);
  const openFileAction = useAppStore(s => s.openFile);
  // Resources (fase 2.5)
  const tasks = useAppStore(s => s.tasks);
  const addResource = useAppStore(s => s.addResource);
  const resources = useAppStore(s => s.resources);
  const resourceLoadResult = useAppStore(s => s.resourceLoadResult);
  const showHistogram = useAppStore(s => s.ui.showHistogram);
  const histogramResourceId = useAppStore(s => s.view.histogramResourceId);
  const setHistogramResource = useAppStore(s => s.setHistogramResource);
  const clearLeveling = useAppStore(s => s.clearLeveling);
  const showResourcePanel = useAppStore(s => s.ui.showResourcePanel);
  // Baselines & voortgang (fase 2.6)
  const statusDate = useAppStore(s => s.project.statusDate);
  const progressMode = useAppStore(s => s.project.progressMode);
  const setStatusDate = useAppStore(s => s.setStatusDate);
  const setProgressMode = useAppStore(s => s.setProgressMode);
  const showBaselineOverlay = useAppStore(s => s.ui.showBaselineOverlay);
  const showProgressLine = useAppStore(s => s.ui.showProgressLine);
  const showStatusDateLine = useAppStore(s => s.ui.showStatusDateLine);

  const setActiveTab = useCallback((tab: RibbonTab) => {
    setUI({ activeRibbonTab: tab });
  }, [setUI]);

  const handleAddTask = useCallback(() => {
    addTask({
      name: tTask('defaultTask'),
      time: createDefaultTaskTime(project.startDate || formatDate(new Date()), 5),
    });
  }, [addTask, project.startDate, tTask]);

  const handleToggleDependency = useCallback(() => {
    setUI({ showDependencyMode: !showDependencyMode, dependencySourceId: null });
  }, [setUI, showDependencyMode]);

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedTaskIds) deleteTask(id);
  }, [selectedTaskIds, deleteTask]);

  const handlePrint = useCallback(() => {
    setUI({ activeRibbonTab: 'report' });
  }, [setUI]);

  // Structuur-mutaties alleen in pure boommodus (§4.5): dezelfde gedeelde selector als
  // tabel en Gantt, met een tooltip-hint wanneer vergrendeld.
  const treeMode = isTreeMode(view);
  const structureLockedHint = !treeMode ? tCommon('view.structureLockedHint') : undefined;

  const handleNewProject = useCallback(() => {
    // Nieuw-project-wizard (kies metadata, kalender en fasering-template).
    setUI({ showNewProjectDialog: true });
  }, [setUI]);

  // Resources-tab afgeleide waarden (fase 2.5). Defensieve guard (bevinding 3): zonder resources
  // kan er geen overallocatie zijn — voorkomt een fantoomvlag als een oud resourceLoadResult nog
  // in de store staat na een document-swap/leegmaken (de diepere reset zit in de scheduler-slices).
  const overallocatedCount = resources.length === 0
    ? 0
    : Object.values(resourceLoadResult?.overallocatedDays ?? {})
        .filter(d => (d?.length ?? 0) > 0).length;
  const hasLeveling = tasks.some(t => t.levelingDelay !== undefined);
  const cycleHistogramResource = (dir: 1 | -1) => {
    const ids: (string | undefined)[] = [undefined, ...resources.map(r => r.id)];
    const cur = ids.findIndex(id => id === histogramResourceId);
    const next = (cur + dir + ids.length) % ids.length;
    setHistogramResource(ids[next]);
  };
  const toggleHistogram = () => {
    const next = !showHistogram;
    setUI({ showHistogram: next });
    void saveShowHistogram(next);
  };
  const toggleBaselineOverlay = () => {
    const next = !showBaselineOverlay;
    setUI({ showBaselineOverlay: next });
    void saveShowBaselineOverlay(next);
  };
  const toggleProgressLine = () => {
    const next = !showProgressLine;
    setUI({ showProgressLine: next });
    void saveShowProgressLine(next);
  };
  const toggleStatusDateLine = () => {
    const next = !showStatusDateLine;
    setUI({ showStatusDateLine: next });
    void saveShowStatusDateLine(next);
  };
  const newResource = () => {
    addResource({ name: '', type: 'LABOR', description: '', maxUnits: 1 });
    setUI({ showResourcePanel: true });
  };

  // Path tracing (MSP Task Path): beide knoppen aan = 'both'; werkt op de geselecteerde taak.
  // Gedeeld door de Planning- en Relaties-tab (op de Planning-tab is de Gantt zichtbaar).
  const traceGroup = (
    <RibbonGroup label={tMenu('ribbon.trace')}>
      <RibbonButton
        icon={<ArrowLeftToLine size={20} />}
        label={tMenu('ribbon.tracePredecessors')}
        active={traceMode === 'predecessors' || traceMode === 'both'}
        onClick={() => setUI({
          traceMode:
            traceMode === 'off' ? 'predecessors'
            : traceMode === 'predecessors' ? 'off'
            : traceMode === 'successors' ? 'both'
            : 'successors',
        })}
      />
      <RibbonButton
        icon={<ArrowRightToLine size={20} />}
        label={tMenu('ribbon.traceSuccessors')}
        active={traceMode === 'successors' || traceMode === 'both'}
        onClick={() => setUI({
          traceMode:
            traceMode === 'off' ? 'successors'
            : traceMode === 'successors' ? 'off'
            : traceMode === 'predecessors' ? 'both'
            : 'predecessors',
        })}
      />
    </RibbonGroup>
  );

  return (
    <div className={`ribbon-container${ribbonCompact ? ' compact' : ''}`}>
      {/* Tabs — 'file' is de speciale amber backstage-tab links */}
      <div className="ribbon-tabs">
        <button
          key="file"
          className={`ribbon-tab ribbon-tab--file ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          {tMenu('ribbon.file')}
        </button>
        {(['start', 'planning', 'resources', 'relations', 'beeld', 'instellingen', 'table', 'ifc', 'report'] as RibbonTab[]).map(tab => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tMenu(`ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`)}
          </button>
        ))}
      </div>

      {/* Content — verborgen wanneer File-tab actief is (Backstage neemt de hele body over) */}
      {activeTab !== 'file' && (
      <div className="ribbon-content">
        {activeTab === 'start' && (
          <>
            <RibbonGroup label={tMenu('ribbon.file')}>
              <RibbonButtonStack>
                <RibbonSmallButton icon={<FileText size={14} />} label={tMenu('ribbon.new')} onClick={handleNewProject} />
                <RibbonSmallButton icon={<Save size={14} />} label={tMenu('ribbon.save')} onClick={() => saveFile()} />
                <RibbonSmallButton icon={<FolderOpen size={14} />} label={tMenu('ribbon.open')} onClick={() => openFileAction()} />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton icon={<SaveAll size={14} />} label={tMenu('backstage.saveAs')} onClick={() => saveFileAs()} />
                <RecentFilesDropdown />
                <ExportDropdown />
              </RibbonButtonStack>
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.edit')}>
              <RibbonButtonStack>
                <RibbonSmallButton icon={<Undo2 size={14} />} label={tMenu('ribbon.undo')} onClick={undo} disabled={undoStack.length === 0} />
                <RibbonSmallButton icon={<Redo2 size={14} />} label={tMenu('ribbon.redo')} onClick={redo} disabled={redoStack.length === 0} />
                <RibbonSmallButton icon={<Trash2 size={14} />} label={tMenu('ribbon.delete')} onClick={handleDeleteSelected} disabled={selectedTaskIds.length === 0} danger />
              </RibbonButtonStack>
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.tasks')}>
              <RibbonButton icon={<Plus size={20} />} label={tMenu('ribbon.task')} onClick={handleAddTask} />
              <MilestoneDropdown />
              <RibbonButton icon={<Link size={20} />} label={tMenu('ribbon.relation')} onClick={handleToggleDependency} active={showDependencyMode} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.schedule')}>
              <RibbonButton icon={<Play size={20} />} label={tMenu('ribbon.calculate')} onClick={runCPM} primary />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.zoom')}>
              <RibbonButtonStack>
                <RibbonSmallButton icon={<ZoomIn size={14} />} label={tMenu('ribbon.zoomIn')} onClick={() => setZoom(zoom + 10)} />
                <RibbonSmallButton icon={<ZoomOut size={14} />} label={tMenu('ribbon.zoomOut')} onClick={() => setZoom(zoom - 5)} />
              </RibbonButtonStack>
            </RibbonGroup>
          </>
        )}

        {activeTab === 'planning' && (
          <>
            <RibbonGroup label={tMenu('ribbon.schedule')}>
              <RibbonButton icon={<Play size={20} />} label={tMenu('ribbon.cpm')} onClick={runCPM} primary />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.relations')}>
              <RibbonButton icon={<Link size={20} />} label={tMenu('ribbon.relation')} onClick={handleToggleDependency} active={showDependencyMode} />
              <RibbonButton icon={<ArrowRightLeft size={20} />} label={tMenu('ribbon.manage')} onClick={() => setActiveTab('relations')} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            {traceGroup}

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.calendar')}>
              <RibbonButton icon={<Calendar size={20} />} label={tMenu('ribbon.calendar')} onClick={() => setUI({ showCalendarDialog: true })} />
              <RibbonButton icon={<Clock size={20} />} label={tMenu('ribbon.holidays')} onClick={() => setUI({ showCalendarDialog: true })} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.structure')}>
              <RibbonButton icon={<Tags size={20} />} label={tMenu('ribbon.codesFields')} onClick={() => setUI({ showStructureDialog: true })} />
              <RibbonButtonStack>
                <RibbonSmallButton icon={<Hash size={14} />} label={tMenu('ribbon.wbsAuto')} onClick={() => setWbsAutoNumber(!wbsAutoNumber)} active={wbsAutoNumber} />
                <RibbonSmallButton icon={<ListOrdered size={14} />} label={tMenu('ribbon.renumberWbs')} onClick={renumberWbs} disabled={wbsAutoNumber} />
                <TemplatesDropdown />
              </RibbonButtonStack>
              <RibbonButtonStack>
                <RibbonSmallButton icon={<IndentIncrease size={14} />} label={tMenu('ribbon.indent')} onClick={() => indentTasks(selectedTaskIds)} disabled={selectedTaskIds.length === 0 || !treeMode} title={structureLockedHint} />
                <RibbonSmallButton icon={<IndentDecrease size={14} />} label={tMenu('ribbon.outdent')} onClick={() => outdentTasks(selectedTaskIds)} disabled={selectedTaskIds.length === 0 || !treeMode} title={structureLockedHint} />
              </RibbonButtonStack>
            </RibbonGroup>

            <div className="ribbon-separator" />

            {/* Baselines & voortgang (fase 2.6, §11.1) */}
            <RibbonGroup label={tMenu('ribbon.baselines')}>
              <BaselinesProgressGroupContent
                compact={ribbonCompact}
                onSaveBaseline={() => setUI({ showBaselineDialog: true })}
                onManageBaselines={() => setUI({ showBaselineDialog: true })}
                statusDate={statusDate}
                setStatusDate={setStatusDate}
                progressMode={progressMode}
                setProgressMode={setProgressMode}
              />
            </RibbonGroup>
          </>
        )}

        {activeTab === 'resources' && (
          <>
            <RibbonGroup label={tMenu('ribbon.resourceManagement')}>
              <RibbonButton icon={<Users size={20} />} label={tMenu('ribbon.openResourcePanel')} onClick={() => setUI({ showResourcePanel: true })} active={showResourcePanel} />
              <RibbonButton icon={<Plus size={20} />} label={tMenu('ribbon.newResource')} onClick={newResource} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.resourceAssignment')}>
              <ResourceAssignDropdown />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.histogram')}>
              <RibbonButton icon={<BarChart3 size={20} />} label={tMenu('ribbon.toggleHistogram')} onClick={toggleHistogram} active={showHistogram} />
              <RibbonButtonStack>
                <RibbonSmallButton icon={<ChevronLeft size={14} />} label={tMenu('ribbon.prevResource')} onClick={() => cycleHistogramResource(-1)} disabled={!showHistogram || resources.length === 0} />
                <RibbonSmallButton icon={<ChevronRight size={14} />} label={tMenu('ribbon.nextResource')} onClick={() => cycleHistogramResource(1)} disabled={!showHistogram || resources.length === 0} />
              </RibbonButtonStack>
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.leveling')}>
              <RibbonButton icon={<Scale size={20} />} label={tMenu('ribbon.levelResourcesDialog')} onClick={() => setUI({ showLevelingDialog: true })} />
              <RibbonButton icon={<Eraser size={20} />} label={tMenu('ribbon.clearLeveling')} onClick={clearLeveling} disabled={!hasLeveling} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.overallocationIndicator')}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', fontSize: 12,
                color: overallocatedCount > 0 ? 'var(--error)' : 'var(--theme-text-dim)',
              }}>
                {overallocatedCount > 0 && <AlertTriangle size={16} />}
                <span>
                  {overallocatedCount > 0
                    ? tMenu('ribbon.overallocationCount', { count: overallocatedCount })
                    : tMenu('ribbon.overallocationNone')}
                </span>
              </div>
            </RibbonGroup>
          </>
        )}

        {activeTab === 'relations' && (
          <>
            <RibbonGroup label={tMenu('ribbon.relations')}>
              <RibbonButton icon={<Link size={20} />} label={tMenu('ribbon.relation')} onClick={handleToggleDependency} active={showDependencyMode} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            {traceGroup}

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.schedule')}>
              <RibbonButton icon={<Play size={20} />} label={tMenu('ribbon.cpm')} onClick={runCPM} primary />
            </RibbonGroup>
          </>
        )}

        {activeTab === 'beeld' && (
          <>
            {/* [Tijdschaal] (§13): zoom +/-/reset + schaal-dropdown. De keuze mapt naar een
                zoom-preset; de getoonde waarde wordt AFGELEID uit zoom via scaleFromZoom (§3.5) —
                kan dus nooit desyncen van de as. */}
            <RibbonGroup label={tMenu('ribbon.timeScale')}>
              <div style={{ display: 'flex', gap: 6 }}>
                <RibbonButtonStack>
                  <RibbonSmallButton icon={<ZoomIn size={14} />} label={tMenu('ribbon.zoomIn')} onClick={() => setZoom(zoom + 10)} />
                  <RibbonSmallButton icon={<ZoomOut size={14} />} label={tMenu('ribbon.zoomOut')} onClick={() => setZoom(zoom - 5)} />
                  <RibbonSmallButton icon={<Eye size={14} />} label={tMenu('ribbon.zoomReset')} onClick={() => setZoom(30)} />
                </RibbonButtonStack>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px' }}>
                  <RibbonDropdown
                    value={scaleFromZoom(zoom)}
                    options={[
                      { value: 'year', label: tMenu('ribbon.year') },
                      { value: 'quarter', label: tMenu('ribbon.quarter') },
                      { value: 'month', label: tMenu('ribbon.month') },
                      { value: 'week', label: tMenu('ribbon.week') },
                      { value: 'day', label: tMenu('ribbon.day') },
                    ]}
                    onChange={v => setTimeScale(v)}
                  />
                  <span className="ribbon-info">{tMenu('ribbon.zoomLevel', { level: Math.round(zoom) })}</span>
                </div>
              </div>
            </RibbonGroup>

            <div className="ribbon-separator" />

            {/* [Weergave] (§13/§5.5/§6/§7.4): kolommen-dialoog, filter-editor, groepeer-/
                sorteer-popovers. Narrow "small"-knoppen (i.p.v. grote 66px-tegels) zodat de groep
                smal blijft en in compacte modus niet overlapt (zelfde valkuil als de 2.6-fix). */}
            <RibbonGroup label={tMenu('ribbon.display')}>
              <div style={{ display: 'flex', gap: 2 }}>
                <RibbonSmallButton icon={<Columns3 size={14} />} label={tMenu('ribbon.columns')} onClick={() => setUI({ showColumnsDialog: true })} />
                <RibbonSmallButton icon={<Filter size={14} />} label={tMenu('ribbon.filter')} onClick={() => setUI({ showFilterDialog: true })} active={view.filter !== null} />
                <GroupPopoverButton />
                <SortPopoverButton />
              </div>
            </RibbonGroup>

            <div className="ribbon-separator" />

            {/* [Layout] (§13/§8): actieve-layout-dropdown + opslaan als/bijwerken/beheren. */}
            <RibbonGroup label={tMenu('ribbon.layout')}>
              <LayoutGroupContent />
            </RibbonGroup>

            <div className="ribbon-separator" />

            {/* [Presentatie] (§13/§9/§10/§11): presentation-toggle (F11), split view, mini-map. */}
            <RibbonGroup label={tMenu('ribbon.presentationMode')}>
              <PresentationGroupContent />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.panels')}>
              <RibbonButton
                icon={!rightPanelCollapsed ? <Eye size={20} /> : <EyeOff size={20} />}
                label={tMenu('ribbon.properties')}
                onClick={() => setUI({ rightPanelCollapsed: !rightPanelCollapsed })}
                active={!rightPanelCollapsed}
              />
            </RibbonGroup>

            <div className="ribbon-separator" />

            {/* [Overlays] — baseline-/voortgang-overlays (fase 2.6, §11.1). Gereserveerde plek
                (B14, §1/§13): 2.6 plugt hier zijn document-toggles in, buiten het Layout-object. */}
            <RibbonGroup label={tMenu('ribbon.baselines')}>
              <RibbonButton icon={<LayoutGrid size={20} />} label={tMenu('ribbon.toggleBaselineOverlay')} onClick={toggleBaselineOverlay} active={showBaselineOverlay} />
              <RibbonButton icon={<TrendingUp size={20} />} label={tMenu('ribbon.toggleProgressLine')} onClick={toggleProgressLine} active={showProgressLine} />
              <RibbonButton icon={<CalendarDays size={20} />} label={tMenu('ribbon.toggleStatusDateLine')} onClick={toggleStatusDateLine} active={showStatusDateLine} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.printing')}>
              <RibbonButton icon={<Printer size={20} />} label={tMenu('ribbon.printPreview')} onClick={handlePrint} />
            </RibbonGroup>
          </>
        )}

        {activeTab === 'instellingen' && (
          <>
            <RibbonGroup label={tMenu('ribbon.project')}>
              <RibbonButton icon={<Info size={20} />} label={tMenu('ribbon.projectInfo')} onClick={() => setUI({ showProjectInfoDialog: true })} />
              <RibbonButton icon={<Settings size={20} />} label={tMenu('ribbon.projectSettings')} onClick={() => setUI({ showSettingsDialog: true })} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.calendar')}>
              <RibbonButton icon={<Calendar size={20} />} label={tMenu('ribbon.calendar')} onClick={() => setUI({ showCalendarDialog: true })} />
            </RibbonGroup>
          </>
        )}

        {activeTab === 'table' && (
          <RibbonGroup label={tTask('table.title')}>
            <RibbonButton icon={<Play size={20} />} label={tMenu('ribbon.calculate')} onClick={runCPM} primary />
            <RibbonButton icon={<Plus size={20} />} label={tMenu('ribbon.task')} onClick={handleAddTask} />
          </RibbonGroup>
        )}

        {activeTab === 'ifc' && (
          <RibbonGroup label={tMenu('ribbon.ifc')}>
            <span className="ribbon-info">{tMenu('ribbon.ifcInfo')}</span>
          </RibbonGroup>
        )}

        {activeTab === 'report' && (
          <RibbonGroup label={tMenu('ribbon.reporting')}>
            <RibbonButton icon={<Printer size={20} />} label={tMenu('ribbon.printPreview')} onClick={handlePrint} />
          </RibbonGroup>
        )}
        <ExtensionRibbonGroups tab={activeTab} />
        {/* Compacte-modus-toggle rechtsonder (Word-web-stijl): ↑ = inklappen, ↓ = uitklappen.
            position:absolute (zie CSS) zodat de pijl een vaste plek in de hoek houdt en
            nooit kan worden dichtgeschoven/onklikbaar gemaakt door drukke tab-inhoud
            (QA-bevinding 2.6a) — onafhankelijk van de flex-flow van de groepen ernaast. */}
        <button
          className="ribbon-collapse-toggle"
          title={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
          aria-label={tMenu(ribbonCompact ? 'ribbon.expandRibbon' : 'ribbon.collapseRibbon')}
          onClick={() => {
            const next = !ribbonCompact;
            setUI({ ribbonCompact: next });
            void saveRibbonCompact(next);
          }}
        >
          {ribbonCompact ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      )}
    </div>
  );
}
