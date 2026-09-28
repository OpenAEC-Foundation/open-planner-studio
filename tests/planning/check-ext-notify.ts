// Extensie-API — `api.ui.showNotification` bereikt de gebruiker.
//
// WAT HIER VASTLIGT.
//  - De melding landt in het ene meldingenkanaal van de store (`ui.notifications`), onder de vaste
//    sleutel `notifications.extensionMessage` met de extensienaam en de onvertaalde tekst.
//  - Niveaus: `error` → `error` (blijft staan), `warning`/`info` → `info` (verdwijnt na 5 s).
//  - Overspoel-bescherming: dezelfde tekst vouwt samen tot één melding met een teller; per extensie
//    hooguit EXT_NOTIFY_MAX_PER_WINDOW nieuwe meldingen per EXT_NOTIFY_WINDOW_MS; een andere
//    extensie heeft een eigen budget; na het venster mag het weer.
//  - Elke aanroep gaat óók naar de debuglog (`appLog`), ook een onderdrukte.
//  - De extensietekst blijft platte tekst: de vertaalde zin bevat de HTML letterlijk (geen escaping,
//    geen interpretatie — React zet hem als tekstnode neer).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import { createAppStoreContext } from '@/state/appStore';
import { createExtensionApi, type ExtensionHostBinding } from '@/extensions/extensionApi';
import {
  EXT_NOTIFY_MAX_LENGTH, EXT_NOTIFY_MAX_PER_WINDOW, EXT_NOTIFY_WINDOW_MS, createExtensionNotifier,
} from '@/extensions/extensionNotifications';
import { parseExtensionManifest } from '@/extensions/validation';
import { appLog } from '@/services/debug/appLog';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

let clock = 1_000_000;
const ctx = createAppStoreContext();
const host: ExtensionHostBinding = { app: ctx, showNotification: createExtensionNotifier(ctx, { now: () => clock }) };

function install(id: string, name: string) {
  const parsed = parseExtensionManifest({
    id, name, version: '1.0.0', apiVersion: '1.4', minAppVersion: '0.0.0',
    author: 'OpenAEC', description: '', category: 'Other', main: 'main.js', permissions: [],
  }, 'fresh');
  if (!parsed.ok) throw new Error(`manifest ongeldig: ${JSON.stringify(parsed)}`);
  ctx.store.getState().registerReadyExtension({ kind: 'ready', id, manifest: parsed.value, status: 'enabled' });
  return createExtensionApi(id, [], undefined, ctx, host);
}
const notes = () => ctx.store.getState().ui.notifications;
const clear = () => { for (const n of [...notes()]) ctx.store.getState().dismissNotification(n.id); };

// ── 1. Melding in het kanaal, met extensienaam ───────────────────────────────
const api = install('rapport-ext', 'Rapportmaker');
appLog.clear();
api.ui.showNotification('Gedaan!');
eq('1 één melding in ui.notifications', notes().length, 1);
eq('1a sleutel, niveau en parameters',
  notes().map(n => [n.messageKey, n.severity, n.params, n.count]),
  [['notifications.extensionMessage', 'info', { name: 'Rapportmaker', message: 'Gedaan!' }, 1]]);
eq('1b de debuglog krijgt de melding ook',
  appLog.snapshot().map(e => [e.level, e.channel, e.text]),
  [['info', 'ext:rapport-ext', 'Gedaan!']]);

// ── 2. Niveaus ───────────────────────────────────────────────────────────────
clear();
api.ui.showNotification('Let op', 'warning');
api.ui.showNotification('Mislukt', 'error');
eq('2 warning → info, error → error', notes().map(n => n.severity), ['info', 'error']);
eq('2a debuglog-niveaus warn/error', appLog.snapshot().slice(-2).map(e => e.level), ['warn', 'error']);

// ── 3. Dezelfde tekst vouwt samen ────────────────────────────────────────────
clear();
clock += EXT_NOTIFY_WINDOW_MS;
for (let i = 0; i < 10; i++) api.ui.showNotification('Nog bezig');
eq('3 tien keer dezelfde tekst = één melding met teller 10',
  notes().map(n => [n.params?.message, n.count]), [['Nog bezig', 10]]);

// ── 4. Limiet per extensie per venster ───────────────────────────────────────
clear();
clock += EXT_NOTIFY_WINDOW_MS;
appLog.clear();
for (let i = 1; i <= 10; i++) api.ui.showNotification(`Stap ${i}`);
eq('4 hooguit het maximum aan nieuwe meldingen', notes().length, EXT_NOTIFY_MAX_PER_WINDOW);
eq('4a de eerste komen door', notes().map(n => n.params?.message),
  Array.from({ length: EXT_NOTIFY_MAX_PER_WINDOW }, (_, i) => `Stap ${i + 1}`));
eq('4b alle tien staan wel in de debuglog',
  appLog.snapshot().filter(e => e.channel === 'ext:rapport-ext' && e.text.startsWith('Stap')).length, 10);
eq('4c onderdrukking staat in de debuglog',
  appLog.snapshot().filter(e => e.text.includes('overspoel-bescherming')).length, 10 - EXT_NOTIFY_MAX_PER_WINDOW);

// Een andere extensie heeft een eigen budget.
clear();
const other = install('andere-ext', 'Andere');
other.ui.showNotification('Hallo');
eq('4d andere extensie wordt niet geremd door de eerste',
  notes().map(n => [n.params?.name, n.params?.message]), [['Andere', 'Hallo']]);
api.ui.showNotification('Nog eentje');
eq('4e de eerste blijft binnen het venster geremd', notes().length, 1);

// Na het venster mag het weer.
clock += EXT_NOTIFY_WINDOW_MS;
api.ui.showNotification('Weer toegestaan');
eq('4f na het venster komt een nieuwe melding door',
  notes().map(n => n.params?.message), ['Hallo', 'Weer toegestaan']);

// ── 5. Platte tekst, geen injectie; lengte begrensd; onbekende extensie ──────
clear();
clock += EXT_NOTIFY_WINDOW_MS;
const html = '<img src=x onerror=alert(1)> **vet** $t(notifications.saveFailed) {{name}}';
api.ui.showNotification(html);
const note = notes()[0];
eq('5 de tekst gaat ongewijzigd als parameter mee', note?.params?.message, html);
const translator = i18next.createInstance();
await translator.init({
  lng: 'nl', resources: { nl: { common: nlCommon } }, defaultNS: 'common', interpolation: { escapeValue: false },
});
eq('5a de vertaalde zin bevat de tekst letterlijk (geen escaping, geen nesting, geen herinterpolatie)',
  translator.t('notifications.extensionMessage', { ...note?.params }), `Extensie Rapportmaker: ${html}`);

clear();
api.ui.showNotification('x'.repeat(EXT_NOTIFY_MAX_LENGTH + 50));
eq('5b te lange tekst wordt afgekapt', String(notes()[0]?.params?.message).length, EXT_NOTIFY_MAX_LENGTH + 1);

clear();
const orphan = createExtensionApi('zonder-record', [], undefined, ctx, host);
orphan.ui.showNotification('Hoi');
eq('5c zonder geïnstalleerd record valt de naam terug op de id', notes()[0]?.params?.name, 'zonder-record');

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensie-meldingen — ${checks} checks groen`);
} else {
  console.log(`XX extensie-meldingen — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
