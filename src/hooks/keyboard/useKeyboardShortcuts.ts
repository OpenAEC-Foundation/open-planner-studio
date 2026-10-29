import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { isAutoCalcHeld } from '@/state/editHold';
import { isTauri } from '@/utils/platform';
import { SHORTCUTS, isDocumentLeaveBlocked, isGlobalShortcutFrozen, matchesCombo } from './shortcutRegistry';
import { isTypingTarget } from './isTypingTarget';
// Zelfde bron als `shortcutRegistry` (dat al `i18n.t` gebruikt voor default-taaknamen): deze
// voorpoort spiegelt de `file.open`-entry daar, dus spiegelt hij ook hóé het label wordt opgehaald.
import i18n from '@/i18n/config';
import { buildImportLabels } from '@/i18n/importLabels';

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

/** Een component die dezelfde keydown al heeft afgehandeld, bezit het event volledig. */
export function shouldHandleGlobalShortcutEvent(
  event: Pick<KeyboardEvent, 'defaultPrevented'>,
): boolean {
  return !event.defaultPrevented;
}

type ClosestTarget = { closest?: (selector: string) => unknown };

/** Ctrl/Cmd+C/V blijft binnen een taakgrid van de native copy/paste-eventketen. */
export function shouldYieldClipboardShortcutToTaskGrid(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | ClosestTarget | null;
}): boolean {
  if (!(event.ctrlKey || event.metaKey) || !['c', 'v'].includes(event.key.toLowerCase())) return false;
  return !!(event.target as ClosestTarget | null)?.closest?.('.task-grid-core');
}

/**
 * Forceer een hangende onBlur-commit (inzet, werk, duur, …) vóór een sneltoets die opslaat of
 * herberekent. Alleen tekstvelden hebben zo'n commit; een keuzelijst-trigger houdt de focus.
 * Eén mechanisme voor het sneltoets-register én de productie-voorpoort hieronder.
 *
 * De blur commit synchroon (React-onBlur ⇒ store), dus de store is bijgewerkt vóór de actie draait.
 * De bewerking is daarmee af: staat Automatisch berekenen aan, dan rekent de planning hier meteen
 * door (wat de auto-calc anders 100 ms later deed), zodat Ctrl+S het doorgerekende schema opslaat.
 * Niet bij F5 (`recalculate: false`): die sneltoets rekent zelf, één keer.
 *
 * Daarna gaat de focus terug naar het veld als het nog in de pagina staat: anders ligt hij op
 * `body` en verwijdert een volgende Backspace de geselecteerde taak. Het veld heeft dan geen draft
 * meer, dus het terugzetten commit niet opnieuw. `data-ops-refocus` zegt tegen
 * `useTextEntryAutoCalcHold` dat deze focus geen nieuwe invoer is: zonder die markering nam het
 * terugzetten meteen weer een rekenblokkade en bleef de planning verouderd (review #401, punt 3).
 * Typt de gebruiker daarna verder, dan houdt `onInput` de berekening weer vast.
 */
function commitPendingTextEdit(target: EventTarget | null, opts: { recalculate: boolean }): void {
  const el = target as HTMLElement | null;
  if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  el.blur();
  // Alleen vóór opslaan; F5 rekent zelf al (anders twee solves en bij een kring een melding ×2).
  const s = useAppStore.getState();
  if (opts.recalculate && s.ui.autoCalcCPM && s.scheduleStale && !isAutoCalcHeld()) s.runCPM({ withinEvent: true });
  if (el.isConnected) {
    el.dataset.opsRefocus = 'true';
    try { el.focus({ preventScroll: true }); } finally { delete el.dataset.opsRefocus; }
  }
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
      if (!shouldHandleGlobalShortcutEvent(e)) return;
      // Een wachtende start- of samenvattingsvraag: geen enkele globale sneltoets voert iets
      // uit (ook F5/Ctrl+S van de voorpoort hieronder niet). Browsertoetsen (F5 = herladen, Ctrl+S =
      // pagina opslaan) blijven geblokkeerd, ook in dev: anders herlaadt F5 de pagina en is de vraag
      // met de wachtende handeling weg.
      if (isGlobalShortcutFrozen()) {
        if (isBrowserShortcut(e)) e.preventDefault();
        return;
      }
      // Block browser shortcuts in production but still run app actions
      if (isProduction && isBrowserShortcut(e)) {
        e.preventDefault();
        const ctrlB = e.ctrlKey || e.metaKey;
        // Herberekenen en opslaan lezen de store: commit eerst een getypte waarde in het actieve
        // veld (zelfde blur als het register hieronder), anders slaat Ctrl+S de oude waarde op.
        if (e.key === 'F5' || (ctrlB && e.key.toLowerCase() === 's')) {
          commitPendingTextEdit(e.target, { recalculate: e.key !== 'F5' });
        }
        if (e.key === 'F5') runCPM();
        else if (ctrlB && e.shiftKey && e.key.toLowerCase() === 's') void saveFileAs();
        else if (ctrlB && e.key.toLowerCase() === 's') void saveFile();
        // Zelfde "geen dialoog open"-guard als de Ctrl+N-tak hieronder — `openFile`
        // opent doorgaans in een NIEUW document (een documentwissel), die onmogelijk moet zijn
        // zolang een blokkerende dialoog (bv. de voortgangsimportdialoog) openstaat. Deze voorpoort
        // draait vóór het sneltoets-register, dus de `when` op de `file.open`-entry in
        // shortcutRegistry.ts dekt dit pad in een productiebuild niet — die tweede helft is hier nodig.
        // `isDocumentLeaveBlocked` = geen dialoog open (`isAnyDialogOpen`) én geen niet-toegepaste
        // Projectinfo-draft in Backstage — Ctrl+O/Ctrl+N wisselen van document en zouden die stil verwerpen.
        else if (ctrlB && e.key.toLowerCase() === 'o' && !isDocumentLeaveBlocked()) void openFile(buildImportLabels((key) => i18n.t(key, { ns: 'common' })));
        // Dezelfde "geen dialoog open"-guard als de `file.newProject`-entry in shortcutRegistry.ts —
        // zonder guard opent Ctrl+N de projectwizard óver een al openstaande dialoog heen (twee
        // overlays, wizard onbereikbaar).
        else if (ctrlB && e.key.toLowerCase() === 'n' && !isDocumentLeaveBlocked()) setUI({ showNewProjectDialog: true });
        return;
      }

      const target = e.target as HTMLElement;
      const typing = isTypingTarget(target, e);
      if (shouldYieldClipboardShortcutToTaskGrid(e)) return;

      // Sneltoets-register: matcht in volgorde, stopt bij de EERSTE hit (zie shortcutRegistry.ts
      // voor de volgorde-gevoelige gevallen, met name Escape: presentatie-afsluiten vóór deselecteren).
      for (const entry of SHORTCUTS) {
        if (entry.displayOnly) continue;
        if (!matchesCombo(e, entry.combo)) continue;
        // Invoerveld-guard: normaal negeren we ALLE sneltoetsen in een invoerveld zodat
        // tekstbewerking niet wordt gekaapt. `allowInInput` whitelist't uitzonderingen als
        // F5/Ctrl+S/F11/Escape-in-presentatie.
        if (typing && !entry.allowInInput) continue;
        if (entry.when && !entry.when()) continue;

        // Forceer een eventuele hangende onBlur-commit vóórdat we herberekenen/opslaan/etc.
        if (entry.allowInInput && typing) commitPendingTextEdit(target, { recalculate: entry.id !== 'file.recalculate' });
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
