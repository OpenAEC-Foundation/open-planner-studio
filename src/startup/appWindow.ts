import { isTauri } from '@/utils/platform';
import { appLog } from '@/services/debug/appLog';

export type RevealReason = 'gereed' | 'fout';

let reveal: Promise<void> | null = null;

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

export function fontsSettled(maxMs = 1000): Promise<void> {
  const ready = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
  if (!ready) return Promise.resolve();
  return Promise.race([
    ready.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ]);
}
