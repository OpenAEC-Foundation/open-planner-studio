import { isTauri } from '@/utils/platform';
import type { invoke as TauriInvoke } from '@tauri-apps/api/core';

export async function openFolder(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await openFolderWith(invoke, path);
}

export async function openFolderWith(invoke: typeof TauriInvoke, path: string): Promise<void> {
  await invoke('open_folder', { path });
}
