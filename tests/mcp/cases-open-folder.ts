// #1245 — "Backup-map openen" op de desktop: de ai-backups-map moet open in de bestandsbeheerder
// van het OS, via het eigen Rust-commando `open_folder` (`src-tauri/src/commands/open_folder.rs`).
// NOOIT via `open()` van `@tauri-apps/plugin-shell`: met `"shell": { "open": true }` staat die in
// de capability alleen de standaard-regex toe (`mailto:`/`tel:`/`https?://`), dus een lokaal pad
// weigert die — op Windows opende de knop daardoor niets.
//
// Headless proef: een nep `window.__TAURI_INTERNALS__.invoke` registreert elke aanroep. De echte
// plugin-clients (`@tauri-apps/api/path`, `@tauri-apps/plugin-fs`, `@tauri-apps/api/core`) praten
// daarlangs, dus de hele route van `openBackupFolder()` is hier te zien.

// --- localStorage-shim (vóór elke @/-import; zelfde reden als cases-backup.ts) --------------------
const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { test, assert, assertEq, run } from './harness';
import { openBackupFolder, BACKUP_ROOT } from '@/services/mcp/backup';
import { openFolder, openFolderWith } from '@/services/shell/openFolder';

type IpcCall = { command: string; args: Record<string, unknown> };

/** Nep-Tauri-IPC: registreert alles; beantwoordt alleen de commando's die `openBackupFolder` nodig heeft. */
function installFakeTauriIpc(appDataDir: string) {
  const calls: IpcCall[] = [];
  const invoke = async (command: string, args: Record<string, unknown> = {}) => {
    calls.push({ command, args });
    switch (command) {
      case 'plugin:path|resolve_directory': return appDataDir;
      case 'plugin:path|join': return (args.paths as string[]).join('/');
      case 'plugin:fs|mkdir': return null;
      case 'open_folder': return null;
      default: return null; // o.a. `plugin:shell|open` — registreert, zodat de assertie hem kan afkeuren
    }
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { __TAURI_INTERNALS__: { invoke } },
  });
  return {
    calls,
    dispose: () => { Reflect.deleteProperty(globalThis, 'window'); },
  };
}

// --- (1) de map gaat naar het open_folder-commando, nóóit naar plugin-shell `open` --------------

test('openBackupFolder geeft de ai-backups-map aan open_folder en niet aan plugin-shell open', async () => {
  const ipc = installFakeTauriIpc('/appdata');
  try {
    await openBackupFolder();
  } finally {
    ipc.dispose();
  }
  const expectedDir = `/appdata/${BACKUP_ROOT}`;

  const shellOpen = ipc.calls.filter((c) => c.command === 'plugin:shell|open');
  assertEq(shellOpen.length, 0, `plugin-shell open mag geen map aanroepen (kreeg: ${JSON.stringify(shellOpen)})`);

  const openFolderCalls = ipc.calls.filter((c) => c.command === 'open_folder');
  assertEq(openFolderCalls.length, 1, `precies één open_folder-aanroep verwacht, kreeg ${JSON.stringify(openFolderCalls)}`);
  assertEq(openFolderCalls[0].args.path, expectedDir, 'open_folder krijgt het absolute pad van de backup-map');

  const mkdir = ipc.calls.find((c) => c.command === 'plugin:fs|mkdir');
  assert(mkdir !== undefined && mkdir.args.path === expectedDir, 'de map wordt vóór het openen aangemaakt (plugin-fs mkdir)');
});

// --- (2) de seam zelf: openFolder/openFolderWith roepen het commando aan met het pad -------------

test('openFolderWith roept open_folder aan met het gegeven pad', async () => {
  const seen: IpcCall[] = [];
  const fakeInvoke = (async (command: string, args: Record<string, unknown>) => {
    seen.push({ command, args });
    return null;
  }) as any;
  await openFolderWith(fakeInvoke, '/appdata/ai-backups');
  assertEq(seen, [{ command: 'open_folder', args: { path: '/appdata/ai-backups' } }],
    'openFolderWith stuurt (command, { path }) naar de Rust-kant');
});

test('openFolder doet in de web-build (geen Tauri) niets', async () => {
  // Geen `window.__TAURI_INTERNALS__` ⇒ isTauri() false ⇒ no-op, zonder ook maar één aanroep.
  assert(typeof (globalThis as any).window === 'undefined', 'proef start zonder window');
  await openFolder('/appdata/ai-backups'); // mag niet throwen
  await openBackupFolder(); // idem
});

// --- (3) via de echte Tauri-gate: met nep-IPC aan gaat openFolder wel door ------------------------

test('openFolder gaat met Tauri aan via invoke naar open_folder', async () => {
  const ipc = installFakeTauriIpc('/appdata');
  try {
    await openFolder('/appdata/ai-backups');
  } finally {
    ipc.dispose();
  }
  assertEq(ipc.calls, [{ command: 'open_folder', args: { path: '/appdata/ai-backups' } }],
    'met Tauri aan is openFolder precies één open_folder-aanroep');
});

await run();
