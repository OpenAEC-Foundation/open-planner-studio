const backing = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => { backing.set(k, v); },
  removeItem: (k: string) => { backing.delete(k); },
};

import { test, assert, assertEq, run } from './harness';
import { openBackupFolder, BACKUP_ROOT } from '@/services/mcp/backup';

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

  const mkdirIdx = ipc.calls.findIndex((c) => c.command === 'plugin:fs|mkdir');
  const mkdir = mkdirIdx >= 0 ? ipc.calls[mkdirIdx] : undefined;
  assert(mkdir !== undefined && mkdir.args.path === expectedDir, 'de map wordt aangemaakt (plugin-fs mkdir)');

  const openCalls = ipc.calls.filter((c) => c.command === 'open_backup_folder');
  assertEq(openCalls, [{ command: 'open_backup_folder', args: {} }],
    'het commando krijgt geen pad mee: Rust bepaalt zelf <appDataDir>/ai-backups en weigert als die geen bestaande map is');

  const openIdx = ipc.calls.findIndex((c) => c.command === 'open_backup_folder');
  assert(mkdirIdx >= 0 && openIdx > mkdirIdx, 'mkdir gaat vóór open_backup_folder (de map bestaat als het commando hem controleert)');
});

test('openBackupFolder doet in de web-build (geen Tauri) niets', async () => {
  assert(typeof (globalThis as any).window === 'undefined', 'proef start zonder window');
  await openBackupFolder();
});

await run();
