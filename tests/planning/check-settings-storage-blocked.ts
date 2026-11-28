import './domStub';

const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const blocked = () => { throw Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' }); };
const origWarn = console.warn;
console.warn = () => {};

for (const name of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, name, { get: blocked, configurable: true });
}
const {
  getSetting, setSetting, saveTheme, initTheme, saveLocale, loadConstructionMode, saveConstructionMode,
  loadMcpPort, saveMcpPort, MCP_DEFAULT_PORT, loadMcpToken, saveMcpToken, localStorageAvailable,
} = await import('@/utils/settingsStore');
const { loadAllSettings } = await import('@/utils/settingsRegistry');
let errA: unknown = null;
try {
  const { createAppStoreContext } = await import('@/state/appStoreFactory');
  ok('A localStorageAvailable ⇒ false bij gooiende getter', localStorageAvailable() === false);
  ok('A loadConstructionMode ⇒ true (standaard)', loadConstructionMode() === true);
  saveConstructionMode(false);
  ok('A loadMcpPort ⇒ standaardpoort', loadMcpPort() === MCP_DEFAULT_PORT);
  saveMcpPort(4000);
  ok('A loadMcpToken ⇒ null', loadMcpToken() === null);
  saveMcpToken('x');
  ok('A getSetting ⇒ undefined', (await getSetting('iets')) === undefined);
  await setSetting('iets', 1);
  await saveTheme('light');
  await saveLocale('nl');
  const patch = await loadAllSettings();
  ok('A loadAllSettings levert een patch', typeof patch === 'object' && patch !== null);
  const ctx = createAppStoreContext();
  ok('A store maken lukt zonder opslag', Array.isArray(ctx.store.getState().tasks));
} catch (e) {
  errA = e;
}
ok(`A niets gooit bij een gooiende getter, kreeg ${String(errA)}`, errA === null);

Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: undefined });
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: blocked, setItem: blocked, removeItem: blocked, key: blocked, get length() { return blocked(); },
};

let err: unknown = null;
try {
  ok('getSetting ⇒ undefined', (await getSetting('iets')) === undefined);
  await setSetting('iets', 1);
  await saveTheme('light');
  await saveLocale('nl');
  ok('initTheme ⇒ standaardthema', (await initTheme()) === 'dark');
  const patch = await loadAllSettings();
  ok('loadAllSettings levert een patch met standaardwaarden', typeof patch === 'object' && patch !== null);
} catch (e) {
  err = e;
}
console.warn = origWarn;
ok(`geen enkele instellingenactie gooit bij geblokkeerde opslag, kreeg ${String(err)}`, err === null);

if (diffs.length === 0) {
  console.log(`OK  settings-storage-blocked: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  settings-storage-blocked: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
