// MCP-backup: de Tauri-gated appwrappers rond de app-singleton. De kern (uitdunbeleid, bestandsnamen,
// `createBackupService`, `createAppBackupService`) staat in `backupService.ts`, zonder app-singleton,
// zodat de headless MCP-server hem kan bundelen (issue #570). Alles daaruit wordt hier opnieuw
// geëxporteerd; bestaande imports blijven werken.

import type { EnsureBackupFn } from './contracts';
import { isTauri } from '@/utils/platform';
import { appStoreContext } from '@/state/appStore';
import { BACKUP_ROOT, createAppBackupService, type BackupService } from './backupService';

export * from './backupService';

// --- Appwrapper + publieke Tauri-gated wrappers --------------------------------------------------

function service(): BackupService {
  return createAppBackupService(appStoreContext);
}

let warnedWeb = false;
function warnWebOnce(): null {
  if (!warnedWeb) {
    warnedWeb = true;
    console.warn('MCP-backup: geen bridge in de web-build; backup overgeslagen (theoretisch pad).');
  }
  return null;
}

/** Auto-backup-hook voor `buildMcpContext`. Web/niet-Tauri ⇒ null (met één waarschuwing). */
export const ensureBackup: EnsureBackupFn = (docId, kind) =>
  isTauri() ? service().ensureBackup(docId, kind) : Promise.resolve(warnWebOnce());

/** "Nu backup maken". Web/niet-Tauri ⇒ reject (er is geen fs-bestemming). */
export function makeManualBackup(): Promise<string> {
  if (!isTauri()) return Promise.reject(new Error('MCP-backup: alleen in de desktop-app beschikbaar'));
  return service().makeManualBackup();
}

/**
 * Registreer een via `duplicate_document` in DEZE sessie geboren document, zodat het de
 * automatische backup overslaat (zijn geboortestaat is de nog-openstaande bron). CONTRACT voor de
 * document-tools: roep dit aan direct nadat een `duplicate_document`-kopie het actieve document is
 * geworden, met het id van de kopie. "Nu backup maken" blijft op zo'n document gewoon werken.
 */
export function markDuplicateBorn(docId: string): void {
  if (!isTauri()) return;
  service().markDuplicateBorn(docId);
}

/** Reset de per-sessie-tellers; aanroepen bij het (her)starten van de bridge. */
export function resetBackupSession(): void {
  if (!isTauri()) return;
  service().resetSession();
}

/** Open de ai-backups-map in de bestandsbeheerder (shell-open-plugin); maakt hem eerst aan. */
export async function openBackupFolder(): Promise<void> {
  if (!isTauri()) return;
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const { open } = await import('@tauri-apps/plugin-shell');
  const dir = await join(await appDataDir(), BACKUP_ROOT);
  await mkdir(dir, { recursive: true }); // op een verse installatie bestaat de map nog niet
  await open(dir);
}
