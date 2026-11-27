const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { test, assert, assertEq, run } from './harness';
import { openBackupFolder, openBackupFolderWith, BACKUP_ROOT } from '@/services/mcp/backup';

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

test('BACKUP_ROOT is ai-backups (zelfde literal als BACKUP_DIR in open_backup_folder.rs)', () => {
  assertEq(BACKUP_ROOT, 'ai-backups', 'de Rust-kant joining appDataDir + deze string; bij wijziging beide kanten aanpassen');
});

test('openBackupFolder maakt de map aan en roept open_backup_folder aan zónder padargument', async () => {
  const ipc = installFakeTauriIpc('/appdata');
  try {
    await openBackupFolder();
  } finally {
    ipc.dispose();
  }
  const expectedDir = `/appdata/${BACKUP_ROOT}`;

  const shellOpen = ipc.calls.filter((c) => c.command === 'plugin:shell|open');
  assertEq(shellOpen.length, 0, `plugin-shell open mag niet aangeroepen worden (kreeg: ${JSON.stringify(shellOpen)})`);

  const mkdir = ipc.calls.find((c) => c.command === 'plugin:fs|mkdir');
  assert(mkdir !== undefined && mkdir.args.path === expectedDir, 'de map wordt vóór het openen aangemaakt (plugin-fs mkdir)');

  const openCalls = ipc.calls.filter((c) => c.command === 'open_backup_folder');
  assertEq(openCalls, [{ command: 'open_backup_folder', args: {} }],
    'het commando krijgt geen pad mee: Rust bepaalt zelf <appDataDir>/ai-backups en weigert als die geen bestaande map is');
});

test('openBackupFolderWith roept open_backup_folder aan met lege args', async () => {
  const seen: IpcCall[] = [];
  const fakeInvoke = (async (command: string, args: Record<string, unknown>) => {
    seen.push({ command, args });
    return null;
  }) as any;
  await openBackupFolderWith(fakeInvoke);
  assertEq(seen, [{ command: 'open_backup_folder', args: {} }], 'alleen het commandonaam, geen pad');
});

test('openBackupFolder doet in de web-build (geen Tauri) niets', async () => {
  assert(typeof (globalThis as any).window === 'undefined', 'proef start zonder window');
  await openBackupFolder();
});

await run();
