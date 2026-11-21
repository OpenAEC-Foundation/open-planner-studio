// Issue #895: geen leeg of half getekend venster bij de start.
//
// 1. De desktopconfiguratie: het hoofdvenster start verborgen, ook op macOS (`tauri.macos.conf.json`
//    vervangt de hele `windows`-lijst), de webview mag het tonen, en de Rust-kant heeft het vangnet.
// 2. `revealAppWindow` toont het venster precies één keer, ook als gereed en fout allebei komen.
// 3. Recent kent "nog niet geladen": tot de lijst er is, toont Bestand een laadstand en niet "geen
//    recente projecten".
//
// Mutatiebewijs: `"visible": false` uit `tauri.macos.conf.json` ⇒ 1b rood; `reveal ??=` in `appWindow.ts`
// als `reveal =` ⇒ 2b rood; `recentFilesLoaded = true` uit `hydrateRecentFiles` ⇒ 3b rood.
import { readFileSync } from 'node:fs';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`ok ${name}`);
  else { failures++; console.log(`XX ${name}`); }
}

// ── 1. Configuratie ──────────────────────────────────────────────────────────────────────────────────
type WindowConf = { visible?: boolean; label?: string };
const windowsOf = (file: string) => (JSON.parse(readFileSync(file, 'utf8')) as { app: { windows: WindowConf[] } }).app.windows;
const mainConf = windowsOf('src-tauri/tauri.conf.json');
const macConf = windowsOf('src-tauri/tauri.macos.conf.json');
check('1a tauri.conf.json: het hoofdvenster start verborgen', mainConf.length === 1 && mainConf[0].visible === false);
check('1b tauri.macos.conf.json: het hoofdvenster start verborgen', macConf.length === 1 && macConf[0].visible === false);
const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8')) as { permissions: string[] };
check('1c de webview mag het venster tonen (core:window:allow-show)', capability.permissions.includes('core:window:allow-show'));
const mainRs = readFileSync('src-tauri/src/main.rs', 'utf8');
check('1d main.rs toont het venster alsnog als de webview dat niet deed', /fn reveal_window_fallback/.test(mainRs) && /reveal_window_fallback\(/.test(mainRs.replace(/fn reveal_window_fallback/, '')));

// ── 2. Eén keer tonen ────────────────────────────────────────────────────────────────────────────────
const g = globalThis as unknown as Record<string, unknown>;
const calls: string[] = [];
const win: Record<string, unknown> = {
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    invoke: async (cmd: string) => { calls.push(cmd); return null; },
    transformCallback: () => 0,
  },
};
win.parent = win;
g.window = win;
const mem = new Map<string, string>();
const storage = {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => { mem.set(key, value); },
  removeItem: (key: string) => { mem.delete(key); },
};
g.localStorage = storage;
g.sessionStorage = storage;

const { revealAppWindow } = await import('@/startup/appWindow');
await Promise.all([revealAppWindow('gereed'), revealAppWindow('fout')]);
await revealAppWindow('gereed');
const shows = calls.filter((cmd) => cmd === 'plugin:window|show');
check(`2a revealAppWindow vraagt het venster te tonen (aanroepen: ${JSON.stringify(calls)})`, shows.length >= 1);
check(`2b ... precies één keer (${shows.length}×)`, shows.length === 1);

// ── 3. Recent: geladen of nog niet ───────────────────────────────────────────────────────────────────
delete win.__TAURI_INTERNALS__;
installFakeRecoveryIndexedDb();
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { store } = createAppStoreContext();
check('3a een nieuwe store weet dat Recent nog niet geladen is', store.getState().recentFilesLoaded === false);
await store.getState().hydrateRecentFiles();
check('3b na het laden staat Recent op geladen', store.getState().recentFilesLoaded === true);

if (failures === 0) console.log('OK: venster bij de start (#895) — alles groen');
else console.log(`XX venster bij de start (#895) — ${failures} rood`);
process.exit(failures === 0 ? 0 : 1);
