import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { SHORTCUTS, matchesCombo } from './shortcutRegistry';

const isProduction = import.meta.env.PROD;

/** Browser shortcuts to block in production (Tauri WebView). */
const BLOCKED_SHORTCUTS: Array<{ key: string; ctrl?: boolean; shift?: boolean }> = [
  { key: 'r', ctrl: true },              // Ctrl+R  reload
  { key: 'r', ctrl: true, shift: true },  // Ctrl+Shift+R  hard reload
  { key: 'F5' },                          // handled by app (runCPM), but also block browser reload
  { key: 'F12' },                         // DevTools
  { key: 'i', ctrl: true, shift: true },  // Ctrl+Shift+I  DevTools
  { key: 'j', ctrl: true, shift: true },  // Ctrl+Shift+J  Console
  { key: 'u', ctrl: true },               // Ctrl+U  View Source
  { key: 'g', ctrl: true },               // Ctrl+G  Find
  { key: 'f', ctrl: true },               // Ctrl+F  Find (browser)
  { key: 'l', ctrl: true },               // Ctrl+L  Address bar
  { key: 's', ctrl: true },               // Ctrl+S  handled by app (save)
  { key: 's', ctrl: true, shift: true },  // Ctrl+Shift+S  handled by app (save as)
  { key: 'o', ctrl: true },               // Ctrl+O  handled by app (open)
  { key: 'n', ctrl: true },               // Ctrl+N  handled by app (new project)
];

function isBrowserShortcut(e: KeyboardEvent): boolean {
  const ctrl = e.ctrlKey || e.metaKey;
  return BLOCKED_SHORTCUTS.some(s =>
    e.key.toLowerCase() === s.key.toLowerCase()
    && (s.ctrl ? ctrl : !ctrl)
    && (s.shift ? e.shiftKey : !e.shiftKey)
  );
}

export function useKeyboardShortcuts() {
  // Alleen nog nodig voor de losstaande productie-only browser-sneltoets-voorpoort hieronder
  // (bewust ongemoeid gelaten, zie shortcutRegistry.ts). Alle overige sneltoetsen lopen via
  // `SHORTCUTS` + een verse `useAppStore.getState()` op het moment van afvuren.
  const runCPM = useAppStore(s => s.runCPM);
  const saveFile = useAppStore(s => s.saveFile);
  const saveFileAs = useAppStore(s => s.saveFileAs);
  const openFile = useAppStore(s => s.openFile);
  const setUI = useAppStore(s => s.setUI);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block browser shortcuts in production but still run app actions
      if (isProduction && isBrowserShortcut(e)) {
        e.preventDefault();
        const ctrlB = e.ctrlKey || e.metaKey;
        if (e.key === 'F5') runCPM();
        else if (ctrlB && e.shiftKey && e.key.toLowerCase() === 's') saveFileAs();
        else if (ctrlB && e.key.toLowerCase() === 's') saveFile();
        else if (ctrlB && e.key.toLowerCase() === 'o') openFile();
        else if (ctrlB && e.key.toLowerCase() === 'n') setUI({ showNewProjectDialog: true });
        return;
      }

      const target = e.target as HTMLElement;
      const isTypingTarget = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Sneltoets-register (fase 2.10): matcht in volgorde, stopt bij de EERSTE hit — exact het
      // prioriteitsgedrag van de vroegere if-keten (zie shortcutRegistry.ts voor de
      // volgorde-gevoelige gevallen, met name Escape: presentatie-afsluiten vóór deselecteren).
      for (const entry of SHORTCUTS) {
        if (entry.displayOnly) continue;
        if (!matchesCombo(e, entry.combo)) continue;
        // Invoerveld-guard (QA-bevinding 2.6b, ongewijzigd): normaal negeren we ALLE sneltoetsen in
        // een invoerveld zodat tekstbewerking niet wordt gekaapt. `allowInInput` whitelist't de
        // vier toetsen die dat al deden (F5/Ctrl+S/F11/Escape-in-presentatie).
        if (isTypingTarget && !entry.allowInInput) continue;
        if (entry.when && !entry.when()) continue;

        if (entry.allowInInput && isTypingTarget) {
          // Forceer een eventuele hangende onBlur-commit vóórdat we herberekenen/opslaan/etc.
          target.blur();
        }
        if (!entry.skipPreventDefault) e.preventDefault();
        entry.run(useAppStore.getState());
        return;
      }
    };

    // Onderdruk het native webview-contextmenu (rechtsklik → Inspecteren/Herladen) in de
    // Tauri-desktopschil (dev én prod) en in de web-productiebuild. In de web-dev-build
    // (`npm run dev` in een browser) blijft het menu bestaan zodat devtools/zelftest bereikbaar
    // blijven; in een Tauri-dev-run opent F12 nog steeds devtools (die keydown-blokkade is prod-only).
    const contextHandler = (e: MouseEvent) => {
      if (isProduction || isTauri()) e.preventDefault();
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('contextmenu', contextHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('contextmenu', contextHandler);
    };
  }, [runCPM, saveFile, saveFileAs, openFile, setUI]);
}
