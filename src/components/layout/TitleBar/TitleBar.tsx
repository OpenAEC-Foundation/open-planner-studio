import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { useTranslation } from 'react-i18next';
import { isTauri } from '@/utils/platform';
import { Icon } from '@/components/icons';
import { AppLogo } from '@/components/common/AppLogo';
import { isMacPlatform } from '@/hooks/keyboard/shortcutFormat';
import { SwitcherPill } from '@/components/layout/DocumentChrome/SwitcherPill';
import { canRedo, canUndo } from '@/state/sessionHistory';
import { isGlobalShortcutFrozen } from '@/hooks/keyboard/shortcutRegistry';
import { canWriteToRefWithoutPrompt, saveTargetRef } from '@/services/fileAccess';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { FEEDBACK_AVAILABLE } from '@/utils/buildFlags';

const FEEDBACK_LABEL_KEYS = ['feedback.rotateFeedback', 'feedback.rotateBug', 'feedback.rotateFeature'] as const;
const FEEDBACK_ROTATE_MS = 10 * 60 * 1000;

type AppWindow = import('@tauri-apps/api/window').Window;

async function withAppWindow(fn: (appWindow: AppWindow) => unknown): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await fn(getCurrentWindow());
}

export function TitleBar() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const activeCode = useAppStore(s => documentProjectCode(s.project, s.xerImportMetadata));
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);
  const undoAvailable = useAppStore(canUndo);
  const redoAvailable = useAppStore(canRedo);
  const questionPending = useAppStore(s => isGlobalShortcutFrozen(s.ui));
  const isDirty = useAppStore(s => s.isDirty);
  const setUI = useAppStore(s => s.setUI);
  const filePath = useAppStore(s => s.filePath);
  const fileHandle = useAppStore(s => s.fileHandle);
  const siteFileId = useAppStore(s => s.siteFileId);
  const autoSaveToFile = useAppStore(s => s.autoSaveToFile);
  const setAutoSaveToFile = useAppStore(s => s.setAutoSaveToFile);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);
  const demoAnimation = useAppStore(s => isFeatureEnabled(s.ui.featureFlags, 'demo-topbar-animation'));

  const [maximized, setMaximized] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      const reserve = Math.max(
        leftRef.current?.getBoundingClientRect().width ?? 0,
        rightRef.current?.getBoundingClientRect().width ?? 0,
      );
      root.style.setProperty('--title-bar-side-reserve', `${Math.ceil(reserve)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    if (leftRef.current) observer.observe(leftRef.current);
    if (rightRef.current) observer.observe(rightRef.current);
    return () => observer.disconnect();
  }, []);

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
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void withAppWindow(async appWindow => {
      if (disposed) return;
      void appWindow.isMaximized().then(setMaximized);
      const stop = await appWindow.onResized(() => {
        void appWindow.isMaximized().then(setMaximized);
      });
      if (disposed) stop();
      else unlisten = stop;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const handleMinimize = useCallback(() => withAppWindow(w => { void w.minimize(); }), []);
  const handleMaximize = useCallback(() => withAppWindow(async w => {
    if (await w.isMaximized()) void w.unmaximize();
    else void w.maximize();
  }), []);
  const handleClose = useCallback(() => withAppWindow(w => { void w.close(); }), []);

  const autoSaveTarget = useMemo(
    () => saveTargetRef({ filePath, fileHandle, siteFileId }),
    [fileHandle, filePath, siteFileId],
  );
  const autoSaveOnSite = autoSaveTarget?.kind === 'site';
  const autoSaveRef = autoSaveOnSite ? null : autoSaveTarget;
  const autoSaveActive = autoSaveToFile && !autoSaveOnSite;
  const autoSaveTitle = autoSaveOnSite
    ? tCommon('autosave.siteDisabled')
    : !autoSaveRef
      ? tCommon('autosave.noFile')
      : tCommon(autoSaveToFile ? 'autosave.onHint' : 'autosave.offHint');
  const toggleAutoSave = useCallback(() => {
    if (!autoSaveRef) return;
    if (autoSaveToFile) { setAutoSaveToFile(false); return; }
    void canWriteToRefWithoutPrompt(autoSaveRef).then((canWrite) => {
      if (canWrite) setAutoSaveToFile(true);
    });
  }, [autoSaveRef, autoSaveToFile, setAutoSaveToFile]);

  return (
    <div ref={rootRef} className="title-bar" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {demoAnimation && (
        <span className="title-bar-demo-animation" data-ops-topbar-animation aria-hidden="true" />
      )}
      <div ref={leftRef} className="title-bar-left">
        <div className="quick-access-toolbar">
          <AppLogo size={18} className="title-bar-app-icon" />
          <div className="quick-access-separator" />

          <button
            className={`title-bar-autosave${autoSaveActive ? ' active' : ''}`}
            role="switch"
            aria-checked={autoSaveActive}
            aria-label={tCommon('autosave.label')}
            disabled={questionPending || !autoSaveRef}
            title={autoSaveTitle}
            onClick={toggleAutoSave}
            data-ops-autosave
          >
            <span>{tCommon('autosave.label')}</span>
            <span className="title-bar-autosave-track" aria-hidden><span /></span>
          </button>

          <div className="quick-access-separator" />

          <button
            className="quick-access-btn"
            title={tMenu('ribbon.undoTitle')}
            disabled={questionPending || !undoAvailable}
            onClick={() => { if (!isGlobalShortcutFrozen()) undo(); }}
          >
            <Icon id="edit.undo" size={16} className="ops-icon-inline-flip" />
          </button>
          <button
            className="quick-access-btn"
            title={tMenu('ribbon.redoTitle')}
            disabled={questionPending || !redoAvailable}
            onClick={() => { if (!isGlobalShortcutFrozen()) redo(); }}
          >
            <Icon id="edit.redo" size={16} className="ops-icon-inline-flip" />
          </button>

          <div className="quick-access-separator" />

          <button
            className="quick-access-btn"
            title={tMenu('ribbon.projectSettings')}
            disabled={questionPending}
            onClick={() => setUI({ showSettingsDialog: true })}
          >
            <Icon id="ui.settings" size={16} />
          </button>

          {FEEDBACK_AVAILABLE && (
            <>
              <div className="quick-access-separator" />

              <button
                className="title-bar-feedback-btn"
                data-tour-anchor="feedback-button"
                disabled={questionPending}
                onClick={() => setUI({ showFeedbackDialog: true })}
              >
                {tCommon(FEEDBACK_LABEL_KEYS[feedbackLabelIdx])}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="title-bar-center" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {documentChromeStyle === 'switcher' ? (
          <SwitcherPill />
        ) : (
          <>
            <span className="title-bar-app-name" data-ops-title-app-name>Open Planner Studio v{__APP_VERSION__}</span>
            <span className="title-bar-file-name" data-ops-title-file-name>
              {isDirty ? '* ' : ''}{nameWithProjectCode(project.name, activeCode) || tCommon('project.untitled')}
            </span>
          </>
        )}
      </div>

      {isTauri() && !isMacPlatform() && (
        <div ref={rightRef} className="window-controls">
          <button className="window-btn" title={tCommon('window.minimize')} onClick={() => { void handleMinimize(); }}>
            <Icon id="window.minimize" size={14} />
          </button>
          <button className="window-btn" title={maximized ? tCommon('window.restore') : tCommon('window.maximize')} onClick={() => { void handleMaximize(); }}>
            {maximized ? <Icon id="window.restore" size={11} /> : <Icon id="window.maximize" size={11} />}
          </button>
          <button className="window-btn window-btn-close" title={tCommon('close')} onClick={() => { void handleClose(); }}>
            <Icon id="window.close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
