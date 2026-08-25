import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { isTauri } from '@/utils/platform';
import {
  FileText, FolderOpen, Save, Undo2, Redo2, Minus, Square, Copy, X, Settings,
} from 'lucide-react';
import { SwitcherPill } from '@/components/layout/DocumentChrome/SwitcherPill';
import { buildImportLabels } from '@/i18n/importLabels';
import { canRedo, canUndo } from '@/state/sessionHistory';

// Het label van de feedback-knop roteert elke 10 minuten door deze drie.
const FEEDBACK_LABEL_KEYS = ['feedback.rotateFeedback', 'feedback.rotateBug', 'feedback.rotateFeature'] as const;
const FEEDBACK_ROTATE_MS = 10 * 60 * 1000;

export function TitleBar() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);
  const undoAvailable = useAppStore(canUndo);
  const redoAvailable = useAppStore(canRedo);
  const isDirty = useAppStore(s => s.isDirty);
  const setUI = useAppStore(s => s.setUI);
  const saveFile = useAppStore(s => s.saveFile);
  const openFile = useAppStore(s => s.openFile);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);

  const [maximized, setMaximized] = useState(false);

  // Roteer het feedback-knoplabel elke 10 minuten.
  const [feedbackLabelIdx, setFeedbackLabelIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setFeedbackLabelIdx(i => (i + 1) % FEEDBACK_LABEL_KEYS.length),
      FEEDBACK_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      void appWindow.isMaximized().then(setMaximized);
      const unlisten = appWindow.onResized(() => {
        void appWindow.isMaximized().then(setMaximized);
      });
      return () => { void unlisten.then(fn => fn()); };
    })();
  }, []);

  const handleMinimize = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    void getCurrentWindow().minimize();
  }, []);
  const handleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    if (await appWindow.isMaximized()) {
      void appWindow.unmaximize();
    } else {
      void appWindow.maximize();
    }
  }, []);
  const handleClose = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    void getCurrentWindow().close();
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
          <button className="quick-access-btn" title={tMenu('ribbon.open')} onClick={() => { void openFile(buildImportLabels(tCommon)); }}>
            <FolderOpen size={16} />
          </button>
          <button className="quick-access-btn" title={tMenu('ribbon.saveTitle')} onClick={() => { void saveFile(); }}>
            <Save size={16} />
          </button>

          <div className="quick-access-separator" />

          <button
            className="quick-access-btn"
            title={tMenu('ribbon.undoTitle')}
            disabled={!undoAvailable}
            onClick={() => undo()}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="quick-access-btn"
            title={tMenu('ribbon.redoTitle')}
            disabled={!redoAvailable}
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

          <div className="quick-access-separator" />

          {/* data-tour-anchor (fase 2.10, onderdeel 3, tourstap 7): altijd zichtbaar bovenin,
              geen prepare() nodig — de "elk wissewasje mag"-afsluitstap van de rondleiding wijst
              hier direct naar toe i.p.v. naar een externe GitHub-link. */}
          <button
            className="title-bar-feedback-btn"
            data-tour-anchor="feedback-button"
            onClick={() => setUI({ showFeedbackDialog: true })}
          >
            {tCommon(FEEDBACK_LABEL_KEYS[feedbackLabelIdx])}
          </button>
        </div>
      </div>

      <div className="title-bar-center" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {documentChromeStyle === 'switcher' ? (
          <SwitcherPill />
        ) : (
          <>
            <span className="title-bar-app-name">Open Planner Studio v{__APP_VERSION__}</span>
            {/* Een naamloos project blijft in de data naamloos; de weergave valt terug op de
                vertaalde tekst (i.p.v. hier niets te tonen). */}
            <span className="title-bar-file-name">
              {isDirty ? '* ' : ''}{project.name || tCommon('project.untitled')}
            </span>
          </>
        )}
      </div>

      {/* Vensterknoppen alleen in Tauri. In de browserbuild — die productie-live staat op
          open-planner-studio.open-aec.com — beheert de browser het venster en beginnen alle drie
          de handlers hierboven met `if (!isTauri()) return;`. Ze renderden tot nu toe
          onvoorwaardelijk, dus de webgebruiker zag drie knoppen die niets deden. */}
      {isTauri() && (
        <div className="window-controls">
          <button className="window-btn" title={tCommon('window.minimize')} onClick={() => { void handleMinimize(); }}>
            <Minus size={14} />
          </button>
          <button className="window-btn" title={maximized ? tCommon('window.restore') : tCommon('window.maximize')} onClick={() => { void handleMaximize(); }}>
            {maximized ? <Copy size={11} /> : <Square size={11} />}
          </button>
          <button className="window-btn window-btn-close" title={tCommon('close')} onClick={() => { void handleClose(); }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
