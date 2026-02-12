import { useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useI18n } from '@/i18n/i18n';
import { Locale } from '@/i18n/i18n';
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

const LANGUAGES: [Locale, string, string][] = [
  ['nl', 'NL', 'Nederlands'],
  ['en', 'EN', 'English'],
  ['fr', 'FR', 'Fran\u00e7ais'],
  ['de', 'DE', 'Deutsch'],
  ['es', 'ES', 'Espa\u00f1ol'],
  ['zh', 'ZH', '\u4E2D\u6587'],
];

export function Ribbon() {
  const { t, locale, setLocale } = useI18n();

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
      name: 'Nieuwe taak',
      time: createDefaultTaskTime(project.startDate || formatDate(new Date()), 5),
    });
  }, [addTask, project.startDate]);

  const handleAddMilestone = useCallback(() => {
    addTask({
      name: 'Nieuwe mijlpaal',
      isMilestone: true,
      taskType: 'ATTENDANCE',
      time: createDefaultTaskTime(project.startDate || formatDate(new Date()), 0),
    });
  }, [addTask, project.startDate]);

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
    if (confirm(t('confirm.newProject'))) newProject();
  }, [newProject, t]);

  return (
    <div className="ribbon">
      <div className="ribbon-tabs">
        {(['start', 'planning', 'beeld', 'instellingen', 'table', 'ifc', 'report'] as RibbonTab[]).map(tab => (
          <button
            key={tab}
            className={`ribbon-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`ribbon.${tab === 'beeld' ? 'view' : tab === 'instellingen' ? 'settings' : tab}`)}
          </button>
        ))}
      </div>

      <div className="ribbon-content">
        {activeTab === 'start' && (
          <>
            {/* File */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.file')}</div>
              <div className="ribbon-group-content grid-2x2">
                <button className="ribbon-button small" onClick={handleNewProject} title={t('ribbon.newProject.title')}>
                  <span className="ribbon-icon"><FileText size={14} /></span>
                  <span>{t('ribbon.new')}</span>
                </button>
                <button className="ribbon-button small" title={t('ribbon.save.title')}>
                  <span className="ribbon-icon"><Save size={14} /></span>
                  <span>{t('ribbon.save')}</span>
                </button>
                <button className="ribbon-button small" title={t('ribbon.open.title')}>
                  <span className="ribbon-icon"><FolderOpen size={14} /></span>
                  <span>{t('ribbon.open')}</span>
                </button>
                <button className="ribbon-button small" onClick={handlePrint} title={t('ribbon.print.title')}>
                  <span className="ribbon-icon"><Printer size={14} /></span>
                  <span>{t('ribbon.print')}</span>
                </button>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Edit */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.edit')}</div>
              <div className="ribbon-group-content grid-2x2">
                <button className="ribbon-button small" onClick={undo} disabled={undoStack.length === 0} title={t('ribbon.undo.title')}>
                  <span className="ribbon-icon"><Undo2 size={14} /></span>
                  <span>{t('ribbon.undo')}</span>
                </button>
                <button className="ribbon-button small" onClick={redo} disabled={redoStack.length === 0} title={t('ribbon.redo.title')}>
                  <span className="ribbon-icon"><Redo2 size={14} /></span>
                  <span>{t('ribbon.redo')}</span>
                </button>
                <button className="ribbon-button small danger" onClick={handleDeleteSelected} disabled={selectedTaskIds.length === 0} title={t('ribbon.delete.title')}>
                  <span className="ribbon-icon"><Trash2 size={14} /></span>
                  <span>{t('ribbon.delete')}</span>
                </button>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Tasks */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.tasks')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large" onClick={handleAddTask} title={t('ribbon.task.title')}>
                  <span className="ribbon-icon"><Plus size={20} /></span>
                  <span>{t('ribbon.task')}</span>
                </button>
                <button className="ribbon-button large" onClick={handleAddMilestone} title={t('ribbon.milestone.title')}>
                  <span className="ribbon-icon"><Diamond size={20} /></span>
                  <span>{t('ribbon.milestone')}</span>
                </button>
                <button className={`ribbon-button large ${showDependencyMode ? 'active' : ''}`} onClick={handleToggleDependency} title={t('ribbon.relation.title')}>
                  <span className="ribbon-icon"><Link size={20} /></span>
                  <span>{t('ribbon.relation')}</span>
                </button>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Calculate */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.schedule')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large primary" onClick={runCPM} title={t('ribbon.calculate.title')}>
                  <span className="ribbon-icon"><Play size={20} /></span>
                  <span>{t('ribbon.calculate')}</span>
                </button>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Zoom */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.zoom')}</div>
              <div className="ribbon-group-content grid-2x2">
                <button className="ribbon-button small" onClick={() => setZoom(zoom + 10)} title={t('ribbon.zoomIn.title')}>
                  <span className="ribbon-icon"><ZoomIn size={14} /></span>
                  <span>{t('ribbon.zoomIn')}</span>
                </button>
                <button className="ribbon-button small" onClick={() => setZoom(zoom - 5)} title={t('ribbon.zoomOut.title')}>
                  <span className="ribbon-icon"><ZoomOut size={14} /></span>
                  <span>{t('ribbon.zoomOut')}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'planning' && (
          <>
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.schedule')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large primary" onClick={runCPM} title={t('ribbon.calculate.title')}>
                  <span className="ribbon-icon"><Play size={20} /></span>
                  <span>CPM</span>
                </button>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.relations')}</div>
              <div className="ribbon-group-content">
                <button className={`ribbon-button large ${showDependencyMode ? 'active' : ''}`} onClick={handleToggleDependency}>
                  <span className="ribbon-icon"><Link size={20} /></span>
                  <span>{t('ribbon.relation')}</span>
                </button>
                <button className="ribbon-button large" title={t('ribbon.manage.title')}>
                  <span className="ribbon-icon"><ArrowRightLeft size={20} /></span>
                  <span>{t('ribbon.manage')}</span>
                </button>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.calendar')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large">
                  <span className="ribbon-icon"><Calendar size={20} /></span>
                  <span>{t('ribbon.calendar')}</span>
                </button>
                <button className="ribbon-button large">
                  <span className="ribbon-icon"><Clock size={20} /></span>
                  <span>{t('ribbon.holidays')}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'beeld' && (
          <>
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.zoom')}</div>
              <div className="ribbon-group-content grid-2x2">
                <button className="ribbon-button small" onClick={() => setZoom(zoom + 10)}>
                  <span className="ribbon-icon"><ZoomIn size={14} /></span>
                  <span>{t('ribbon.zoomIn')}</span>
                </button>
                <button className="ribbon-button small" onClick={() => setZoom(zoom - 5)}>
                  <span className="ribbon-icon"><ZoomOut size={14} /></span>
                  <span>{t('ribbon.zoomOut')}</span>
                </button>
                <button className="ribbon-button small" onClick={() => setZoom(30)}>
                  <span className="ribbon-icon"><Eye size={14} /></span>
                  <span>{t('ribbon.zoomReset')}</span>
                </button>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.timeScale')}</div>
              <div className="ribbon-group-content vertical">
                <select className="ribbon-select" value={timeScale} onChange={e => setTimeScale(e.target.value as 'day' | 'week' | 'month')}>
                  <option value="day">{t('ribbon.day')}</option>
                  <option value="week">{t('ribbon.week')}</option>
                  <option value="month">{t('ribbon.month')}</option>
                </select>
                <span className="ribbon-info">{t('ribbon.zoomLevel', Math.round(zoom))}</span>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.panels')}</div>
              <div className="ribbon-group-content">
                <button className={`ribbon-button large ${!rightPanelCollapsed ? 'active' : ''}`} onClick={() => setUI({ rightPanelCollapsed: !rightPanelCollapsed })} title={t('ribbon.properties.title')}>
                  <span className="ribbon-icon">{!rightPanelCollapsed ? <Eye size={20} /> : <EyeOff size={20} />}</span>
                  <span>{t('ribbon.properties')}</span>
                </button>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.printing')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large" onClick={handlePrint} title={t('ribbon.printPreview.title')}>
                  <span className="ribbon-icon"><Printer size={20} /></span>
                  <span>{t('ribbon.printPreview')}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'instellingen' && (
          <>
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.project')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large" onClick={() => setUI({ showProjectInfoDialog: true })} title={t('ribbon.projectInfo.title')}>
                  <span className="ribbon-icon"><Info size={20} /></span>
                  <span>{t('ribbon.projectInfo')}</span>
                </button>
                <button className="ribbon-button large" title={t('ribbon.projectSettings.title')}>
                  <span className="ribbon-icon"><Settings size={20} /></span>
                  <span>{t('ribbon.projectSettings')}</span>
                </button>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.calendar')}</div>
              <div className="ribbon-group-content">
                <button className="ribbon-button large">
                  <span className="ribbon-icon"><Calendar size={20} /></span>
                  <span>{t('ribbon.calendar')}</span>
                </button>
              </div>
            </div>
            <div className="ribbon-separator" />
            <div className="ribbon-group">
              <div className="ribbon-group-title">{t('ribbon.language')}</div>
              <div className="ribbon-group-content" style={{ flexWrap: 'wrap', maxWidth: 220 }}>
                {LANGUAGES.map(([code, short, label]) => (
                  <button
                    key={code}
                    className={`ribbon-button small ${locale === code ? 'active' : ''}`}
                    onClick={() => setLocale(code)}
                    title={label}
                    style={{ minWidth: 52, fontSize: 11 }}
                  >
                    <span>{short}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'table' && (
          <div className="ribbon-group">
            <div className="ribbon-group-title">{t('table.title')}</div>
            <div className="ribbon-group-content">
              <button className="ribbon-button large primary" onClick={runCPM} title={t('ribbon.calculate.title')}>
                <span className="ribbon-icon"><Play size={20} /></span>
                <span>{t('ribbon.calculate')}</span>
              </button>
              <button className="ribbon-button large" onClick={handleAddTask}>
                <span className="ribbon-icon"><Plus size={20} /></span>
                <span>{t('ribbon.task')}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ifc' && (
          <div className="ribbon-group">
            <div className="ribbon-group-title">IFC</div>
            <div className="ribbon-group-content">
              <span className="ribbon-info">IFC 4x3 - Industry Foundation Classes</span>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="ribbon-group">
            <div className="ribbon-group-title">Rapportage</div>
            <div className="ribbon-group-content">
              <button className="ribbon-button large" onClick={handlePrint}>
                <span className="ribbon-icon"><Printer size={20} /></span>
                <span>{t('ribbon.printPreview')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
