import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { isTauri } from '@/utils/platform';
import {
  FileText, FolderOpen, Save, Undo2, Redo2, Minus, Square, Copy, X, Settings,
} from 'lucide-react';
import { SwitcherPill } from '@/components/layout/DocumentChrome/SwitcherPill';
import { buildImportLabels } from '@/i18n/importLabels';
import { canRedo, canUndo } from '@/state/sessionHistory';
import { canWriteToRefWithoutPrompt, type FileRef } from '@/services/fileAccess';

// Het label van de feedback-knop roteert elke 10 minuten door deze drie.
const FEEDBACK_LABEL_KEYS = ['feedback.rotateFeedback', 'feedback.rotateBug', 'feedback.rotateFeature'] as const;
const FEEDBACK_ROTATE_MS = 10 * 60 * 1000;

type AppWindow = import('@tauri-apps/api/window').Window;

/** Voer `fn` uit op het Tauri-venster; in de browser een no-op. De Tauri-API alleen dynamisch. */
async function withAppWindow(fn: (appWindow: AppWindow) => unknown): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await fn(getCurrentWindow());
}

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
  const filePath = useAppStore(s => s.filePath);
  const fileHandle = useAppStore(s => s.fileHandle);
  const autoSaveToFile = useAppStore(s => s.autoSaveToFile);
  const setAutoSaveToFile = useAppStore(s => s.setAutoSaveToFile);
  const documentChromeStyle = useAppStore(s => s.ui.documentChromeStyle);

  const [maximized, setMaximized] = useState(false);

  // De gecentreerde titel staat absoluut op 50% en moet aan beide kanten evenveel ruimte
  // vrijhouden als het breedste zijcluster inneemt — anders schuift hij bij een lange
  // projectnaam over de feedbackknop heen. Die breedte is niet statisch (AutoSave-label,
  // roterend feedbacklabel, taal, vensterknoppen alleen in Tauri), dus we meten hem en
  // geven hem als CSS-variabele door; `.title-bar-center` rekent daar zijn breedte uit.
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
    // De rechterzijde bestaat alleen in Tauri; die conditie verandert nooit tijdens de sessie.
  }, []);

  // Roteer het feedback-knoplabel elke 10 minuten.
  const [feedbackLabelIdx, setFeedbackLabelIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setFeedbackLabelIdx(i => (i + 1) % FEEDBACK_LABEL_KEYS.length),
      FEEDBACK_ROTATE_MS,
    );
    return () => clearInterval(id);
  }, []);

  // De opruimfunctie moet uit het effect zélf komen: een `return` binnen de async IIFE bereikte
  // React nooit, waardoor de onResized-listener bleef hangen. `disposed` vangt een unmount op die
  // valt vóórdat de dynamische import of de listen-registratie klaar is.
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

  // Een naamloos document heeft geen bestaand doel dat veilig overschreven mag worden. Recovery
  // draait onafhankelijk hiervan door; de schakelaar belooft uitsluitend échte bestandsopslag.
  const autoSaveRef = useMemo<FileRef | null>(() => (
    fileHandle
      ? { kind: 'handle', handle: fileHandle }
      : (isTauri() && filePath ? { kind: 'path', path: filePath } : null)
  ), [fileHandle, filePath]);
  const autoSaveTitle = !autoSaveRef
    ? tCommon('autosave.noFile')
    : tCommon(autoSaveToFile ? 'autosave.onHint' : 'autosave.offHint');
  const toggleAutoSave = useCallback(() => {
    if (!autoSaveRef) return;
    if (autoSaveToFile) { setAutoSaveToFile(false); return; }
    // Een FSA-handle die alleen leesrecht heeft mag nooit vanuit een timer een permissieprompt
    // opleveren. Pas na een bewuste handmatige Opslaan is de knop beschikbaar.
    void canWriteToRefWithoutPrompt(autoSaveRef).then((canWrite) => {
      if (canWrite) setAutoSaveToFile(true);
    });
  }, [autoSaveRef, autoSaveToFile, setAutoSaveToFile]);

  return (
    <div ref={rootRef} className="title-bar" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div ref={leftRef} className="title-bar-left">
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

          <button
            className={`title-bar-autosave${autoSaveToFile ? ' active' : ''}`}
            role="switch"
            aria-checked={autoSaveToFile}
            aria-label={tCommon('autosave.label')}
            disabled={!autoSaveRef}
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
            <span className="title-bar-app-name" data-ops-title-app-name>Open Planner Studio v{__APP_VERSION__}</span>
            {/* Een naamloos project blijft in de data naamloos; de weergave valt terug op de
                vertaalde tekst (i.p.v. hier niets te tonen). */}
            <span className="title-bar-file-name" data-ops-title-file-name>
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
        <div ref={rightRef} className="window-controls">
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
