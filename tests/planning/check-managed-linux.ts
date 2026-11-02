// Beheerde Linux-sessie: dezelfde publieke updatefuncties als de handmatige en stille UI-route.
import assert from 'node:assert/strict';
import { checkForUpdates, downloadAndInstall } from '@/services/updater/updaterService';
import { linuxEnvironment, isManagedLinux } from '@/utils/linuxEnvironment';
import { loadMcpPort, loadMcpToken } from '@/utils/settingsStore';
import { openFileDialogTauri, saveFileDialogTauri } from '@/services/fileAccess/tauriBackend';
import { createManagedShutdown } from '@/services/appQuit/managedShutdown';

const calls: string[] = [];
const argumentsByCommand = new Map<string, Record<string, unknown>>();
const fakeWindow = {
  __OPS_LINUX__: { managed: true, directory: '/openaec', initialFile: null, mcp: null },
  __TAURI_INTERNALS__: {
    invoke: async (command: string, args: Record<string, unknown>) => {
      calls.push(command);
      argumentsByCommand.set(command, args);
      if (command === 'plugin:path|join') return (args.paths as string[]).join('/');
      return null;
    },
    transformCallback: () => 1,
    unregisterCallback: () => {},
  },
};
Object.assign(globalThis, { window: fakeWindow });
await checkForUpdates(true);
await checkForUpdates(false);
await downloadAndInstall();
assert.equal(calls.length, 0, 'beheerde modus mag ook handmatig geen updater of installatiedetectie aanroepen');
console.log('OK beheerde modus: stille check, handmatige check en installatie doen geen updater-aanroep');
assert.equal(isManagedLinux(), true);
await openFileDialogTauri([]);
await saveFileDialogTauri('planning.ifc', '', [], { preferDownloads: true });
assert.equal((argumentsByCommand.get('plugin:dialog|open')?.options as { defaultPath: string }).defaultPath, '/openaec');
assert.equal((argumentsByCommand.get('plugin:dialog|save')?.options as { defaultPath: string }).defaultPath, '/openaec/planning.ifc');
console.log('OK openen en opslaan beginnen in de beheerde map, ook bij preferDownloads');

const env = linuxEnvironment()!;
Object.assign(env, { mcp: { port: 9123, token: 'test-token-alleen-voor-deze-check-123456' } });
assert.equal(loadMcpPort(), 9123);
assert.equal(loadMcpToken(), env.mcp!.token);
console.log('OK MCP leest de sessieconfiguratie zonder localStorage');

const order: string[] = [];
let release: (() => void) | undefined;
const pending = new Promise<void>(resolve => { release = resolve; });
const shutdown = createManagedShutdown({
  finishInput: () => { order.push('invoer'); },
  freeze: () => { order.push('blokkeren'); },
  flush: async () => { order.push('herstel'); await pending; },
  confirm: async () => { order.push('bevestigen'); },
});
const first = shutdown();
assert.equal(first, shutdown(), 'herhaalde SIGTERM-events delen één herstelronde');
await Promise.resolve();
assert.deepEqual(order, ['blokkeren', 'invoer', 'herstel']);
release!();
await first;
assert.deepEqual(order, ['blokkeren', 'invoer', 'herstel', 'bevestigen']);
let attempts = 0;
const retry = createManagedShutdown({
  finishInput: () => {}, freeze: () => {},
  flush: async () => { if (++attempts === 1) throw new Error('schijf vol'); },
  confirm: async () => { order.push('opnieuw bevestigd'); },
});
await assert.rejects(retry(), /schijf vol/);
assert.equal(order.includes('opnieuw bevestigd'), false);
await retry();
assert.equal(order.at(-1), 'opnieuw bevestigd');
console.log('OK SIGTERM wacht op opslag; schrijffout geeft geen bevestiging en staat een nieuwe poging toe');

calls.length = 0;
Object.assign(env, { managed: false });
await checkForUpdates(true);
assert.ok(calls.includes('plugin:updater|check'), 'gewone desktop behoudt de updater');
delete (globalThis as { window?: unknown }).window;
assert.equal(linuxEnvironment(), null, 'headless en browser krijgen geen native sessieconfiguratie');
console.log('OK gewone desktop en browser behouden hun platformgrenzen');
