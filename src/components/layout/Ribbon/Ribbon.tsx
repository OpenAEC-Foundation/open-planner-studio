import { useCallback, useState, useRef, useEffect, useId } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import {
  Plus, Link, Diamond, Play, Undo2, Redo2, ZoomIn, ZoomOut,
  FileText, FolderOpen, Save, Printer, Trash2,
  Calendar, Settings, Info, Clock,
  ArrowRightLeft, Eye, EyeOff, History, SaveAll,
  Download,
} from 'lucide-react';
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
          border: '1px solid var(--theme-border-light)',
          borderRadius: 3,
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
          background: 'var(--theme-input-bg)',
          border: '1px solid var(--theme-border-light)',
          borderRadius: 3,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '5px 8px',
                background: o.value === value ? 'var(--theme-active)' : 'transparent',
                color: 'var(--theme-text)',
                border: 'none',
                textAlign: 'left',
                fontSize: 11,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (o.value !== value) (e.target as HTMLElement).style.background = 'var(--theme-hover)'; }}
              onMouseLeave={e => { if (o.value !== value) (e.target as HTMLElement).style.background = 'transparent'; }}
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

function RecentFilesDropdown() {
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
        <span className="ribbon-btn-label">Recent</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          minWidth: 280, maxWidth: 400,
          background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: '4px 0',
        }}>
          {recentFiles.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              No recent files
            </div>
          ) : (
            recentFiles.map((fp, i) => (
              <button
                key={i}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 12px', fontSize: 11, border: 'none',
                  background: 'transparent', color: 'var(--color-text-primary)',
                  cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                title={fp}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { openRecentFile(fp); setOpen(false); }}
              >
                {fp.split(/[/\\]/).pop()}
                <span style={{ display: 'block', fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 1 }}>
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
    { label: 'CSV (;)', format: 'csv' },
    { label: 'MS Project XML', format: 'mspdi' },
    { label: 'Primavera P6 XML', format: 'p6' },
    { label: 'IFC 4x3', format: 'ifc' },
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="ribbon-btn small"
        onClick={() => setOpen(!open)}
      >
        <span className="ribbon-btn-icon"><Download size={14} /></span>
        <span className="ribbon-btn-label">Export</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1000,
          minWidth: 180,
          background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
          borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: '4px 0',
        }}>
          {formats.map((f) => (
            <button
              key={f.format}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', fontSize: 11, border: 'none',
                background: 'transparent', color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
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

export function Ribbon() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
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
  const project = useAppStore(s => s.project);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const rightPanelCollapsed = useAppStore(s => s.ui.rightPanelCollapsed);
  const setTimeScale = useAppStore(s => s.setTimeScale);
  const timeScale = useAppStore(s => s.view.timeScale);
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const newProject = useAppStore(s => s.newProject);
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

  const handleAddMilestone = useCallback(() => {
    addTask({
      name: tTask('defaultMilestone'),
      isMilestone: true,
      taskType: 'ATTENDANCE',
      time: createDefaultTaskTime(project.startDate || formatDate(new Date()), 0),
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
    if (confirm(tCommon('confirm.newProject'))) newProject();
  }, [newProject, tCommon]);

  return (
    <div className="ribbon-container">
      {/* Tabs */}
      <div className="ribbon-tabs">
        {(['start', 'planning', 'beeld', 'instellingen', 'table', 'ifc', 'report'] as RibbonTab[]).map(tab => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tMenu(`ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`)}
          </button>
        ))}
      </div>

      {/* Content */}
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
                <RibbonSmallButton icon={<SaveAll size={14} />} label="Save As" onClick={() => saveFileAs()} />
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
              <RibbonButton icon={<Diamond size={20} />} label={tMenu('ribbon.milestone')} onClick={handleAddMilestone} />
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
              <RibbonButton icon={<Play size={20} />} label="CPM" onClick={runCPM} primary />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.relations')}>
              <RibbonButton icon={<Link size={20} />} label={tMenu('ribbon.relation')} onClick={handleToggleDependency} active={showDependencyMode} />
              <RibbonButton icon={<ArrowRightLeft size={20} />} label={tMenu('ribbon.manage')} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.calendar')}>
              <RibbonButton icon={<Calendar size={20} />} label={tMenu('ribbon.calendar')} />
              <RibbonButton icon={<Clock size={20} />} label={tMenu('ribbon.holidays')} />
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
              <RibbonButton icon={<Settings size={20} />} label={tMenu('ribbon.projectSettings')} />
            </RibbonGroup>

            <div className="ribbon-separator" />

            <RibbonGroup label={tMenu('ribbon.calendar')}>
              <RibbonButton icon={<Calendar size={20} />} label={tMenu('ribbon.calendar')} />
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
          <RibbonGroup label="IFC">
            <span className="ribbon-info">{tMenu('ribbon.ifcInfo')}</span>
          </RibbonGroup>
        )}

        {activeTab === 'report' && (
          <RibbonGroup label={tMenu('ribbon.reporting')}>
            <RibbonButton icon={<Printer size={20} />} label={tMenu('ribbon.printPreview')} onClick={handlePrint} />
          </RibbonGroup>
        )}
      </div>
    </div>
  );
}
