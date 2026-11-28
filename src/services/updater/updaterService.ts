import { isTauri } from '@/utils/platform';
import { GITHUB_REPO } from '@/services/githubRepo';
import { flushRecoveryNow } from '@/services/recovery/recoveryFlush';
import { closeProjectFileWrites } from '@/services/fileAccess/writeCoordinator';
import { claimShutdownWhenFree } from '@/services/appQuit/shutdownPhase';

export interface UpdateInfo {
  version: string;
  body: string;
  date?: string;
}

export type InstallKind = 'appimage' | 'snap' | 'aur' | 'deb' | 'native';

export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export async function getInstallKind(): Promise<InstallKind> {
  if (!isTauri()) return 'native';
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const kind = await invoke<string>('install_kind');
    if (kind === 'appimage' || kind === 'snap' || kind === 'aur' || kind === 'deb' || kind === 'native') {
      return kind;
    }
    return 'native';
  } catch {
    return 'native';
  }
}

export type UpdateStatus =
  | { kind: 'upToDate' }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'downloading'; progress: number; indeterminate: boolean }
  | { kind: 'readyToInstall' }
  | { kind: 'installing' }
  | { kind: 'restarting' }
  | { kind: 'error'; message: string };

export async function checkForUpdates(
  silent: boolean,
  onStatus?: (status: UpdateStatus) => void,
): Promise<UpdateInfo | null> {
  if (!isTauri()) {
    onStatus?.({ kind: 'upToDate' });
    return null;
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (!update) {
      onStatus?.({ kind: 'upToDate' });
      return null;
    }

    const info: UpdateInfo = {
      version: update.version,
      body: update.body ?? '',
      date: update.date ?? undefined,
    };

    onStatus?.({ kind: 'available', info });
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!silent) {
      onStatus?.({ kind: 'error', message });
    }
    return null;
  }
}

export async function downloadAndInstall(
  onStatus?: (status: UpdateStatus) => void,
): Promise<void> {
  if (!isTauri()) {
    onStatus?.({ kind: 'upToDate' });
    return;
  }

  let releaseShutdown: (() => void) | undefined;
  let reopenWrites: (() => void) | undefined;
  try {
    const installKind = await getInstallKind();
    if (installKind === 'aur' || installKind === 'snap') {
      onStatus?.({ kind: 'upToDate' });
      return;
    }

    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');

    const update = await check();

    if (!update) {
      onStatus?.({ kind: 'upToDate' });
      return;
    }

    let totalLength = 0;
    let downloaded = 0;

    await update.download((event) => {
      switch (event.event) {
        case 'Started':
          totalLength = event.data.contentLength ?? 0;
          downloaded = 0;
          onStatus?.({ kind: 'downloading', progress: 0, indeterminate: totalLength === 0 });
          break;
        case 'Progress': {
          downloaded += event.data.chunkLength;
          const indeterminate = totalLength === 0;
          const progress = indeterminate ? 0 : Math.round((downloaded / totalLength) * 100);
          onStatus?.({ kind: 'downloading', progress, indeterminate });
          break;
        }
        case 'Finished':
          onStatus?.({ kind: 'readyToInstall' });
          break;
      }
    });

    releaseShutdown = await claimShutdownWhenFree('update');
    reopenWrites = await closeProjectFileWrites();
    await flushRecoveryNow();
    onStatus?.({ kind: 'installing' });
    await update.install();
    onStatus?.({ kind: 'restarting' });
    await relaunch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStatus?.({ kind: 'error', message });
  } finally {
    reopenWrites?.();
    releaseShutdown?.();
  }
}
