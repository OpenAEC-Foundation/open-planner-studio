import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import {
  FileText, FolderOpen, Save, Undo2, Redo2, Minus, Square, Copy, X, Settings,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onResize: (callback: () => void) => () => void;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, contents: string) => Promise<void>;
      openFile: () => Promise<{ path: string; content: string } | null>;
      saveFile: (path: string, content: string) => Promise<string | null>;
      saveFileAs: (content: string, filterType?: string) => Promise<string | null>;
      autoSave: (content: string) => Promise<boolean>;
      checkRecovery: () => Promise<{ exists: boolean; content: string | null }>;
      clearRecovery: () => Promise<void>;
    };
  }
}

export function TitleBar() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const newProject = useAppStore(s => s.newProject);
  const isDirty = useAppStore(s => s.isDirty);
  const setUI = useAppStore(s => s.setUI);
  const saveFile = useAppStore(s => s.saveFile);
  const openFile = useAppStore(s => s.openFile);

  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.isMaximized().then(setMaximized);
    const cleanup = api.onResize(() => {
      api.isMaximized().then(setMaximized);
    });
    return cleanup;
  }, []);

  const handleMinimize = useCallback(() => window.electronAPI?.minimize(), []);
  const handleMaximize = useCallback(() => window.electronAPI?.maximize(), []);
  const handleClose = useCallback(() => window.electronAPI?.close(), []);

  return (
    <div className="title-bar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="title-bar-left">
        <div className="quick-access-toolbar">
          <img src="/icon.png" className="title-bar-app-icon" alt="Open Planner Studio" />
          <div className="quick-access-separator" />

          <button className="quick-access-btn" title={tMenu('ribbon.newProjectTitle')} onClick={() => { if (confirm(tCommon('confirm.newProject'))) newProject(); }}>
            <FileText size={16} />
          </button>
          <button className="quick-access-btn" title="Open" onClick={() => openFile()}>
            <FolderOpen size={16} />
          </button>
          <button className="quick-access-btn" title={tMenu('ribbon.saveTitle')} onClick={() => saveFile()}>
            <Save size={16} />
          </button>

          <div className="quick-access-separator" />

          <button
            className="quick-access-btn"
            title={tMenu('ribbon.undoTitle')}
            disabled={undoStack.length === 0}
            onClick={() => undo()}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="quick-access-btn"
            title={tMenu('ribbon.redoTitle')}
            disabled={redoStack.length === 0}
            onClick={() => redo()}
          >
            <Redo2 size={16} />
          </button>

          <div className="quick-access-separator" />

          <button
            className="quick-access-btn"
            title={tMenu('ribbon.settings')}
            onClick={() => setUI({ showSettingsDialog: true })}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="title-bar-center" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span className="title-bar-app-name">Open Planner Studio v{__APP_VERSION__}</span>
        {project.name && (
          <span className="title-bar-file-name">
            {isDirty ? '* ' : ''}{project.name}
          </span>
        )}
      </div>

      <div className="window-controls">
        <button className="window-btn" title="Minimize" onClick={handleMinimize}>
          <Minus size={14} />
        </button>
        <button className="window-btn" title={maximized ? 'Restore' : 'Maximize'} onClick={handleMaximize}>
          {maximized ? <Copy size={11} /> : <Square size={11} />}
        </button>
        <button className="window-btn window-btn-close" title="Close" onClick={handleClose}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
