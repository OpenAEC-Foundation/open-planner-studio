import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { isTauri } from '@/utils/platform';
import {
  FileText, FolderOpen, Save, Undo2, Redo2, Minus, Square, Copy, X, Settings,
} from 'lucide-react';
import { SwitcherPill } from '@/components/layout/DocumentChrome/SwitcherPill';

export function TitleBar() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const isDirty = useAppStore(s => s.isDirty);
  const setUI = useAppStore(s => s.setUI);
  const saveFile = useAppStore(s => s.saveFile);
  const openFile = useAppStore(s => s.openFile);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);

  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      appWindow.isMaximized().then(setMaximized);
      const unlisten = appWindow.onResized(() => {
        appWindow.isMaximized().then(setMaximized);
      });
      return () => { unlisten.then(fn => fn()); };
    })();
  }, []);

  const handleMinimize = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().minimize();
  }, []);
  const handleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    if (await appWindow.isMaximized()) {
      appWindow.unmaximize();
    } else {
      appWindow.maximize();
    }
  }, []);
  const handleClose = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().close();
  }, []);

  return (
    <div className="title-bar" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="title-bar-left">
        <div className="quick-access-toolbar">
          <img src="/icon.png" className="title-bar-app-icon" alt="Open Planner Studio" />
          <div className="quick-access-separator" />

          <button className="quick-access-btn" title={tMenu('ribbon.newProjectTitle')} onClick={() => setUI({ showNewProjectDialog: true })}>
            <FileText size={16} />
          </button>
          <button className="quick-access-btn" title={tMenu('ribbon.open')} onClick={() => openFile()}>
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

      <div className="title-bar-center" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {documentChromeStyle === 'switcher' ? (
          <SwitcherPill />
        ) : (
          <>
            <span className="title-bar-app-name">Open Planner Studio v{__APP_VERSION__}</span>
            {project.name && (
              <span className="title-bar-file-name">
                {isDirty ? '* ' : ''}{project.name}
              </span>
            )}
          </>
        )}
      </div>

      <div className="window-controls">
        <button className="window-btn" title={tCommon('window.minimize')} onClick={handleMinimize}>
          <Minus size={14} />
        </button>
        <button className="window-btn" title={maximized ? tCommon('window.restore') : tCommon('window.maximize')} onClick={handleMaximize}>
          {maximized ? <Copy size={11} /> : <Square size={11} />}
        </button>
        <button className="window-btn window-btn-close" title={tCommon('close')} onClick={handleClose}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
