// Extensie-levenscyclus (audit 2026-09-26):
//  1. Verwijderen terwijl `onLoad` nog loopt ⇒ na afloop NIET actief, geen status `enabled`, en
//     het record wordt niet teruggeschreven (anders herleeft de extensie bij de volgende start).
//  2. Een `onLoad` die nooit afloopt ⇒ time-out, status `error`, en de volgende extensie laadt wél.
//  3. Een api na `_cleanup` is ingetrokken: een late registratie gooit in plaats van te lekken.
//  4. Verwijderen tijdens laden en direct opnieuw installeren ⇒ de nieuwe installatie wordt actief.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import i18next from 'i18next';
import nlMenu from '@/i18n/locales/nl/menu.json';
import enMenu from '@/i18n/locales/en/menu.json';
import { disableExtension, enableExtension, getActivePlugins, loadAllExtensions, type ExtensionStorage } from '@/extensions/extensionLoader';
import { removeExtension } from '@/extensions/extensionService';
import { parseExtensionManifest } from '@/extensions/validation';
import { useAppStore } from '@/state/appStore';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const g = globalThis as unknown as Record<string, unknown>;
const ls = new Map<string, string>();
g.localStorage = {
  get length() { return ls.size; },
  key: (i: number) => [...ls.keys()][i] ?? null,
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v); },
  removeItem: (k: string) => { ls.delete(k); },
};

const manifestFor = (id: string) => ({
  id, name: id, version: '1.0.0', apiVersion: '1.0', minAppVersion: '0.0.0', author: 'test',
  description: 'test', category: 'Utility', main: 'main.js', permissions: ['ribbon'],
});
const record = (id: string, mainCode: string, enabled = false) => ({ id, manifest: manifestFor(id), mainCode, enabled });

function memoryStorage(records: Record<string, ReturnType<typeof record>>) {
  const saved: string[] = [];
  const storage: ExtensionStorage = {
    get: async (key) => (records[String(key)] ? { storageKey: key, value: records[String(key)] } : undefined),
    getAll: async () => Object.keys(records).map((k) => ({ storageKey: k, value: records[k] })),
    save: async (ext) => { saved.push(ext.id); records[ext.id] = record(ext.id, ext.mainCode, ext.enabled); },
    remove: async (key) => { delete records[String(key)]; },
  };
  return { storage, saved, records };
}
const register = (id: string, manifest = manifestFor(id)) => {
  const m = parseExtensionManifest(manifest, 'fresh');
  if (!m.ok) throw new Error(m.error);
  useAppStore.getState().registerReadyExtension({ kind: 'ready', id, manifest: m.value, status: 'disabled' });
};

// Knownbug 64: het echte tutorial-id krijgt bij opstart geen speciale inschakelroute meer.
// Geen aanname over auteur/catalogus: dit is zelf aangeleverde code met hetzelfde id.
{
  const id = 'tutorials';
  g.__tutorialStartupEffects = 0;
  const code = `globalThis.__tutorialStartupEffects += 1;
    module.exports = { onLoad() { globalThis.__tutorialStartupEffects += 1; } };`;
  const mem = memoryStorage({ [id]: record(id, code, false) });
  await loadAllExtensions(mem.storage);
  eq('64 uitgeschakelde tutorials blijft disabled bij opstart',
    useAppStore.getState().installedExtensions[id]?.status, 'disabled');
  eq('64 geen evaluatie of onLoad zonder expliciet inschakelen', g.__tutorialStartupEffects, 0);
  eq('64 geen actieve plugin of stil teruggeschreven enabled-vlag',
    [getActivePlugins().has(id), mem.records[id].enabled, mem.saved], [false, false, []]);
  await loadAllExtensions(mem.storage);
  eq('64 herhaalde bootstrap voert geen code uit', g.__tutorialStartupEffects, 0);

  // Positieve controle: expliciet inschakelen blijft werken (ook gebruikt door de tutorialvraag).
  await enableExtension(id, mem.storage);
  eq('64 expliciete keuze evalueert module en voert onLoad uit', g.__tutorialStartupEffects, 2);
  eq('64 expliciete keuze activeert en bewaart enabled',
    [getActivePlugins().has(id), mem.records[id].enabled], [true, true]);
  await disableExtension(id, mem.storage);
  eq('64 handmatig uitschakelen wordt bewaard', mem.records[id].enabled, false);
  useAppStore.getState().unregisterExtension(id);
  const writesBeforeReload = mem.saved.length;
  await loadAllExtensions(mem.storage);
  eq('64 opnieuw laden uit opslag respecteert de nieuwe uitschakeling',
    [useAppStore.getState().installedExtensions[id]?.status, getActivePlugins().has(id),
      g.__tutorialStartupEffects, mem.saved.length], ['disabled', false, 2, writesBeforeReload]);
  useAppStore.getState().unregisterExtension(id);
  delete g.__tutorialStartupEffects;
}

// 1. Verwijderen tijdens onLoad.
{
  const id = 'traag.verwijderd';
  (g as Record<string, unknown>).__releaseTraag = undefined;
  const code = `module.exports = { onLoad(api) { globalThis.__traagApi = api; return new Promise((r) => { globalThis.__releaseTraag = r; }); } };`;
  const mem = memoryStorage({ [id]: record(id, code) });
  register(id);
  const enabling = enableExtension(id, mem.storage);
  for (let i = 0; i < 20 && !g.__releaseTraag; i++) await new Promise((r) => setTimeout(r, 0));
  eq('1 voorwaarde: status laden', useAppStore.getState().installedExtensions[id]?.status, 'loading');
  await removeExtension(id, mem.storage);
  (g.__releaseTraag as () => void)();
  await enabling;
  eq('1 niet actief na afloop', getActivePlugins().has(id), false);
  eq('1 niet teruggeschreven naar opslag', [mem.saved, Object.keys(mem.records)], [[], []]);
  eq('1 niet meer geregistreerd', useAppStore.getState().installedExtensions[id], undefined);
}

// 2. Hangende onLoad blokkeert de volgende niet meer.
{
  const hang = 'hangt.altijd';
  const ok = 'laadt.gewoon';
  const mem = memoryStorage({
    [hang]: record(hang, 'module.exports = { onLoad() { return new Promise(() => {}); } };', true),
    [ok]: record(ok, 'module.exports = { onLoad() {} };', true),
  });
  // Korte time-out via de testnaad: loadAllExtensions gebruikt de standaard, dus hier per extensie.
  await enableExtension(hang, mem.storage, 20).catch(() => undefined);
  eq('2 hangende extensie krijgt status error', useAppStore.getState().installedExtensions[hang]?.status ?? 'error', 'error');
  eq('2 hangende extensie is niet actief', getActivePlugins().has(hang), false);
  await loadAllExtensions({ ...mem.storage, getAll: async () => [{ storageKey: ok, value: mem.records[ok] }] });
  eq('2 de volgende extensie laadt', getActivePlugins().has(ok), true);
}

// 3. Late registratie na cleanup gooit (de api van de verwijderde extensie uit scenario 1).
{
  let late = '';
  try {
    (g.__traagApi as { ui: { addRibbonButton: (b: unknown) => void } }).ui.addRibbonButton({ id: 'x', label: 'x', onClick() {} });
  } catch (e) { late = String(e); }
  eq('3 late addRibbonButton na verwijderen gooit (ingetrokken api)', late.includes('gedeactiveerd'), true);
  eq('3 geen lintknop van de verwijderde extensie', useAppStore.getState().extensionRibbonButtons.some((b: { extensionId?: string }) => b.extensionId === 'traag.verwijderd'), false);
}

// 4. Verwijderen tijdens onLoad en meteen opnieuw installeren ⇒ de nieuwe installatie wordt actief
//    zodra de oude (geannuleerde) lading klaar is (review 2026-09-28).
{
  const id = 'traag.herinstalleerd';
  g.__releaseHer = undefined;
  const slow = `module.exports = { onLoad() { return new Promise((r) => { globalThis.__releaseHer = r; }); } };`;
  const mem = memoryStorage({ [id]: record(id, slow) });
  register(id);
  const first = enableExtension(id, mem.storage);
  for (let i = 0; i < 20 && !g.__releaseHer; i++) await new Promise((r) => setTimeout(r, 0));
  await removeExtension(id, mem.storage);
  // Herinstallatie (zelfde id, nieuwe code die direct laadt), zoals installFromZip dat doet.
  mem.records[id] = record(id, 'module.exports = { onLoad() {} };');
  register(id);
  const second = enableExtension(id, mem.storage);
  (g.__releaseHer as () => void)();
  await first; await second;
  eq('4 nieuwe installatie is actief', getActivePlugins().has(id), true);
  eq('4 status enabled', useAppStore.getState().installedExtensions[id]?.status, 'enabled');
}

// 5. De echte activatieroute bewaart taal én concrete context in de bestaande statusfout.
//    Een te nieuwe extensie wordt zelfs vóór code-uitvoering geweigerd; een permissiefout ruimt
//    eerdere registraties op. De positieve controle blijft inschakelen en uitschakelen.
await i18next.init({
  lng: 'en', fallbackLng: 'en', ns: ['menu'],
  resources: { nl: { menu: nlMenu }, en: { menu: enMenu } },
  interpolation: { escapeValue: false },
});
const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
for (const { lng, versionMessage, permissionMessage } of [
  {
    lng: 'nl',
    versionMessage: `Vereist Open Planner Studio ≥ 9999.12.3 (huidige versie: ${appVersion})`,
    permissionMessage: 'Extensie "geen-events-nl" mist permissie: events',
  },
  {
    lng: 'en',
    versionMessage: `Requires Open Planner Studio ≥ 9999.12.3 (current version: ${appVersion})`,
    permissionMessage: 'Extension "geen-events-en" is missing permission: events',
  },
]) {
  await i18next.changeLanguage(lng);
  const tooNew = `te-nieuw-${lng}`;
  const denied = `geen-events-${lng}`;
  const allowed = `met-events-${lng}`;
  g.__versionGuardEffects = 0;
  g.__permissionGuardEffects = 0;
  const versionRecord = record(tooNew,
    'globalThis.__versionGuardEffects += 1; module.exports = { onLoad() { globalThis.__versionGuardEffects += 1; } };');
  versionRecord.manifest.minAppVersion = '9999.12.3';
  const permissionRecord = record(denied, `module.exports = { onLoad(api) {
    api.ui.addRibbonButton({ tab: 'start', group: 'Test', label: 'Tijdelijk', onClick() {} });
    api.events.emit('fixture:permission-denied');
    globalThis.__permissionGuardEffects += 1;
  } };`);
  const allowedRecord = record(allowed,
    "module.exports = { onLoad(api) { api.events.emit('fixture:permission-allowed'); globalThis.__permissionGuardEffects += 1; } };");
  allowedRecord.manifest.permissions = ['events'];
  const mem = memoryStorage({ [tooNew]: versionRecord, [denied]: permissionRecord, [allowed]: allowedRecord });
  for (const ext of [versionRecord, permissionRecord, allowedRecord]) register(ext.id, ext.manifest);

  await enableExtension(tooNew, mem.storage);
  eq(`5 ${lng} versiepoort toont beide versies in de UI-taal`,
    useAppStore.getState().installedExtensions[tooNew]?.error, versionMessage);
  eq(`5 ${lng} versiepoort weigert vóór uitvoering`, g.__versionGuardEffects, 0);
  await enableExtension(denied, mem.storage);
  eq(`5 ${lng} permissiepoort toont extensie-id en permissie in de UI-taal`,
    useAppStore.getState().installedExtensions[denied]?.error, permissionMessage);
  eq(`5 ${lng} beide weigeringen behouden foutstatus`,
    [tooNew, denied].map(id => useAppStore.getState().installedExtensions[id]?.status), ['error', 'error']);
  eq(`5 ${lng} beide weigeringen blijven inactief`, [tooNew, denied].map(id => getActivePlugins().has(id)), [false, false]);
  eq(`5 ${lng} fouten worden niet als succesvolle activatie opgeslagen`, mem.saved, []);
  eq(`5 ${lng} registratie vóór permissiefout is opgeruimd`,
    useAppStore.getState().extensionRibbonButtons.some(button => button.extensionId === denied), false);
  eq(`5 ${lng} na de permissiefout is niets uitgevoerd`, g.__permissionGuardEffects, 0);

  await enableExtension(allowed, mem.storage);
  eq(`5 ${lng} toegestane extensie voert onLoad uit`, g.__permissionGuardEffects, 1);
  eq(`5 ${lng} toegestane extensie wordt actief`, getActivePlugins().has(allowed), true);
  eq(`5 ${lng} alleen de toegestane extensie wordt opgeslagen`, mem.saved, [allowed]);
  await disableExtension(allowed, mem.storage);
  eq(`5 ${lng} uitschakelen behoudt status en opruiming`,
    [useAppStore.getState().installedExtensions[allowed]?.status, getActivePlugins().has(allowed)], ['disabled', false]);
  for (const id of [tooNew, denied, allowed]) useAppStore.getState().unregisterExtension(id);
}
delete g.__versionGuardEffects;
delete g.__permissionGuardEffects;

if (diffs.length === 0) {
  console.log(`OK  extension-lifecycle: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  extension-lifecycle: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
