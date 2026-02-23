import { useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import {
  Plus, Link, Diamond, Play, Undo2, Redo2, ZoomIn, ZoomOut,
  FileText, FolderOpen, Save, Printer, Trash2,
  Calendar, Settings, Info, Clock,
  ArrowRightLeft, Eye, EyeOff,
} from 'lucide-react';
import { formatDate } from '@/utils/dateUtils';
import { createDefaultTaskTime } from '@/types/task';
import { RibbonTab } from '@/state/slices/types';
import './Ribbon.css';

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
                <RibbonSmallButton icon={<Save size={14} />} label={tMenu('ribbon.save')} />
                <RibbonSmallButton icon={<FolderOpen size={14} />} label={tMenu('ribbon.open')} />
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
                <select className="ribbon-select" value={timeScale} onChange={e => setTimeScale(e.target.value as 'day' | 'week' | 'month')}>
                  <option value="day">{tMenu('ribbon.day')}</option>
                  <option value="week">{tMenu('ribbon.week')}</option>
                  <option value="month">{tMenu('ribbon.month')}</option>
                </select>
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
