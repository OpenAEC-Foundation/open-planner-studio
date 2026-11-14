// Het desktopvenster pas tonen als de eerste weergave af is (issue #895).
//
// `tauri.conf.json` (en `tauri.macos.conf.json`) maken het venster verborgen aan (`visible: false`).
// Zonder dat zag de gebruiker eerst een leeg of half gestyled venster: de webview tekent zodra hij iets
// heeft, terwijl taal, instellingen en de eerste React-weergave nog onderweg zijn. Er zijn twee
// signalen om het venster te tonen, en geen vaste wachttijd:
//   - `gereed`: App.tsx heeft de eerste weergave vastgelegd en de lettertypen zijn geladen
//     (`useRevealWindowWhenReady`);
//   - `fout`: de start of de app liep vast; het foutscherm staat er (`fatalError.ts`).
// Voor het geval dat er helemaal geen JavaScript draait (een kapotte bundel), toont de Rust-kant het
// venster na 10 s alsnog (`reveal_window_fallback` in `src-tauri/src/main.rs`). Dat is een vangnet,
// niet het signaal.
//
// In de browser is er geen venster om te tonen; dan gebeurt er alleen de regel in de app-log.
import { isTauri } from '@/utils/platform';
import { appLog } from '@/services/debug/appLog';

export type RevealReason = 'gereed' | 'fout';

let reveal: Promise<void> | null = null;

/** Toont het venster, één keer per start; een volgende aanroep geeft dezelfde belofte terug. Gooit nooit:
 *  lukt tonen niet, dan komt het vangnet van de Rust-kant. */
export function revealAppWindow(reason: RevealReason): Promise<void> {
  reveal ??= (async () => {
    appLog.emit('event', 'opstart', `venster tonen (${reason})`);
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().show();
    } catch (error) {
      console.error('Het venster kon niet getoond worden:', error);
    }
  })();
  return reveal;
}

/** De lettertypen die de eerste weergave gebruikt, zijn geladen (`document.fonts.ready`), of `maxMs` is
 *  om. De bovengrens houdt een haperend lettertype weg van het tonen; de lettertypen zitten in de bundel,
 *  dus normaal is dit een kwestie van milliseconden. */
export function fontsSettled(maxMs = 1000): Promise<void> {
  const ready = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
  if (!ready) return Promise.resolve();
  return Promise.race([
    ready.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}
