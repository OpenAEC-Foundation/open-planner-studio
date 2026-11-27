/**
 * Ingang van het Rust-commando `open_folder` (#1245): een map openen in de bestandsbeheerder
 * van het OS (Windows `explorer`, macOS `open`, Linux `xdg-open`; zie
 * `src-tauri/src/commands/open_folder.rs`).
 *
 * Waarom niet `open()` van `@tauri-apps/plugin-shell`: met `"shell": { "open": true }` in
 * `tauri.conf.json` staat die in de capability alleen de standaard-regex toe
 * (`mailto:`/`tel:`/`https?://`), dus een lokaal pad weigert die — op Windows opende de knop
 * "Backup-map openen" daardoor niets. `tauri-plugin-opener` is niet meegeïnstalleerd; het eigen
 * commando controleert además dat het pad binnen de app-datamap ligt, zodat extensiecode in
 * dezelfde realm geen willekeurige map kan tonen.
 *
 * Buiten Tauri: no-op (de web-build heeft geen bestandsbeheerder).
 */

import { isTauri } from '@/utils/platform';
import type { invoke as TauriInvoke } from '@tauri-apps/api/core';

/** Open `path` (een absolute map binnen de app-datamap) in de bestandsbeheerder van het OS. */
export async function openFolder(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await openFolderWith(invoke, path);
}

/** Dezelfde aanroep met een eigen `invoke` (voor headless proeven). */
export async function openFolderWith(invoke: typeof TauriInvoke, path: string): Promise<void> {
  await invoke('open_folder', { path });
}
