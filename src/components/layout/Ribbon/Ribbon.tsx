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
  IndentIncrease, IndentDecrease,
} from 'lucide-react';
import { listWbsTemplates, deleteWbsTemplate, type WbsTemplate } from '@/utils/wbsTemplates';
import { ExportFormat } from '@/state/appStore';
import { formatDate } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/types/task';
import { RibbonTab } from '@/state/slices/types';
import './Ribbon.css';

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

function RibbonSmallButton({ icon, label, onClick, active, disabled, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const cls = ['ribbon-btn', 'small'];
  if (active) cls.push('active');
  if (disabled) cls.push('disabled');
  if (danger) cls.push('danger');
  return (
    <button className={cls.join(' ')} onClick={disabled ? undefined : onClick}>
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

export function Ribbon() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tTask } = useTranslation('task');

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
  const groupBy = useAppStore(s => s.view.groupBy);
  const setGroupBy = useAppStore(s => s.setGroupBy);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const setWbsAutoNumber = useAppStore(s => s.setWbsAutoNumber);
  const renumberWbs = useAppStore(s => s.renumberWbs);
  const indentTasks = useAppStore(s => s.indentTasks);
  const outdentTasks = useAppStore(s => s.outdentTasks);
  const ribbonCompact = useAppStore(s => s.ui.ribbonCompact);
  const project = useAppStore(s => s.project);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const setTimeScale = useAppStore(s => s.setTimeScale);
  const timeScale = useAppStore(s => s.view.timeScale);
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const activeTab = useAppStore(s => s.ui.activeRibbonTab);
  const saveFile = useAppStore(s => s.saveFile);
  const saveFileAs = useAppStore(s => s.saveFileAs);
  const openFileAction = useAppStore(s => s.openFile);

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

  const handleNewProject = useCallback(() => {
    // Nieuw-project-wizard (kies metadata, kalender en fasering-template).
    setUI({ showNewProjectDialog: true });
  }, [setUI]);

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
        {(['start', 'planning', 'relations', 'beeld', 'instellingen', 'table', 'ifc', 'report'] as RibbonTab[]).map(tab => (
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
                <RibbonSmallButton icon={<IndentIncrease size={14} />} label={tMenu('ribbon.indent')} onClick={() => indentTasks(selectedTaskIds)} disabled={selectedTaskIds.length === 0} />
                <RibbonSmallButton icon={<IndentDecrease size={14} />} label={tMenu('ribbon.outdent')} onClick={() => outdentTasks(selectedTaskIds)} disabled={selectedTaskIds.length === 0} />
              </RibbonButtonStack>
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
            <RibbonGroup label={tMenu('ribbon.zoom')}>
              <RibbonButtonStack>
                <RibbonSmallButton icon={<ZoomIn size={14} />} label={tMenu('ribbon.zoomIn')} onClick={() => setZoom(zoom + 10)} />
                <RibbonSmallButton icon={<ZoomOut size={14} />} label={tMenu('ribbon.zoomOut')} onClick={() => setZoom(zoom - 5)} />
                <RibbonSmallButton icon={<Eye size={14} />} label={tMenu('ribbon.zoomReset')} onClick={() => setZoom(30)} />
              </RibbonButtonStack>
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.timeScale')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 4px' }}>
                <RibbonDropdown
                  value={timeScale}
                  options={[
                    { value: 'day', label: tMenu('ribbon.day') },
                    { value: 'week', label: tMenu('ribbon.week') },
                    { value: 'month', label: tMenu('ribbon.month') },
                  ]}
                  onChange={v => setTimeScale(v as 'day' | 'week' | 'month')}
                />
                <span className="ribbon-info">{tMenu('ribbon.zoomLevel', { level: Math.round(zoom) })}</span>
              </div>
            </RibbonGroup>

            <div className="ribbon-separator" />

            {/* Groeperen op activity-code-type ("meerdere WBS-indelingen", fase 2.2) */}
            <RibbonGroup label={tMenu('ribbon.groupBy')}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '2px 4px' }}>
                <RibbonDropdown
                  value={groupBy ?? '__wbs'}
                  options={[
                    { value: '__wbs', label: tMenu('ribbon.groupByWbs') },
                    ...activityCodeTypes.map(t2 => ({ value: t2.id, label: t2.name })),
                  ]}
                  onChange={v => setGroupBy(v === '__wbs' ? undefined : v)}
                />
              </div>
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
      </div>
      )}
    </div>
  );
}
