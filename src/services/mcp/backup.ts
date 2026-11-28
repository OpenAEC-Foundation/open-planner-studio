import type { EnsureBackupFn } from './contracts';
import { isTauri } from '@/utils/platform';
import { appStoreContext } from '@/state/appStore';
import { BACKUP_ROOT, createAppBackupService, type BackupService } from './backupService';

export * from './backupService';

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

export const ensureBackup: EnsureBackupFn = (docId, kind) =>
  isTauri() ? service().ensureBackup(docId, kind) : Promise.resolve(warnWebOnce());

export function makeManualBackup(): Promise<string> {
  if (!isTauri()) return Promise.reject(new Error('MCP-backup: alleen in de desktop-app beschikbaar'));
  return service().makeManualBackup();
}

export function markDuplicateBorn(docId: string): void {
  if (!isTauri()) return;
  service().markDuplicateBorn(docId);
}

export function resetBackupSession(): void {
  if (!isTauri()) return;
  service().resetSession();
}

export async function openBackupFolder(): Promise<void> {
  if (!isTauri()) return;
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const dir = await join(await appDataDir(), BACKUP_ROOT);
  await mkdir(dir, { recursive: true });
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_backup_folder', {});
}
