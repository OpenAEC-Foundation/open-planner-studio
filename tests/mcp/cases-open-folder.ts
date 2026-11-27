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

function installFakeTauriIpc(appDataDir: string) {
  const calls: IpcCall[] = [];
  const invoke = async (command: string, args: Record<string, unknown> = {}) => {
    calls.push({ command, args });
    switch (command) {
      case 'plugin:path|resolve_directory': return appDataDir;
      case 'plugin:path|join': return (args.paths as string[]).join('/');
      default: return null;
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
  assert(typeof (globalThis as any).window === 'undefined', 'proef start zonder window');
  await openFolder('/appdata/ai-backups');
  await openBackupFolder();
});

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
