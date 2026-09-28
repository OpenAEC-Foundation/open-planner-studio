// Instellingen bij geblokkeerde of volle opslag (audit 2026-09-26). Een browser met geblokkeerde
// site-opslag gooit `SecurityError` bij élke localStorage-toegang; een volle opslag gooit
// `QuotaExceededError` bij schrijven. Eén kale toegang liet `loadAllSettings()` in zijn geheel
// verwerpen (alle instellingen terug naar de standaard) of werd een onafgehandelde rejection.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { getSetting, setSetting, saveTheme, initTheme, saveLocale } from '@/utils/settingsStore';
import { loadAllSettings } from '@/utils/settingsRegistry';

const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const blocked = () => { throw Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' }); };
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: blocked, setItem: blocked, removeItem: blocked, key: blocked, get length() { return blocked(); },
};
const origWarn = console.warn;
console.warn = () => {};

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
