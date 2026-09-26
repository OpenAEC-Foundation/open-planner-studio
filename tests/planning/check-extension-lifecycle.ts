// Extensie-levenscyclus (audit 2026-09-26):
//  1. Verwijderen terwijl `onLoad` nog loopt ⇒ na afloop NIET actief, geen status `enabled`, en
//     het record wordt niet teruggeschreven (anders herleeft de extensie bij de volgende start).
//  2. Een `onLoad` die nooit afloopt ⇒ time-out, status `error`, en de volgende extensie laadt wél.
//  3. Een api na `_cleanup` is ingetrokken: een late registratie gooit in plaats van te lekken.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { enableExtension, getActivePlugins, loadAllExtensions, type ExtensionStorage } from '@/extensions/extensionLoader';
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
const register = (id: string) => {
  const m = parseExtensionManifest(manifestFor(id), 'fresh');
  if (!m.ok) throw new Error(m.error);
  useAppStore.getState().registerReadyExtension({ kind: 'ready', id, manifest: m.value, status: 'disabled' });
};

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

if (diffs.length === 0) {
  console.log(`OK  extension-lifecycle: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  extension-lifecycle: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
