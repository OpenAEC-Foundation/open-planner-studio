// Integriteit en afscherming rond extensie-code (K-item 38, pragmatische helft).
//
// Het rapport noemt de Web Worker "de echte grens" en dit item L. Wat hier staat is expliciet NIET
// die grens, maar de twee dingen die zonder herbouw van de uitvoeringslaag te doen zijn:
//
//   1. INTEGRITEIT — een catalogusentry mag een `sha256` dragen; is die er, dan wordt de download
//      geverifieerd en bij het kleinste verschil geweigerd. Zonder hash zijn "wat de catalogus
//      beschrijft" en "wat je installeert" alleen door TLS aan elkaar geknoopt.
//   2. AFSCHERMING — de rauwe host-globals (`__TAURI_INTERNALS__`, `__TAURI__`, `__OPS__`) worden in
//      de extensie-scope geschaduwd.
//
// WEES EERLIJK OVER (2): dit is GEEN sandbox. De code draait in dezelfde realm, dus
// `globalThis.__TAURI_INTERNALS__` en `Function('return this')()` komen er nog steeds bij. De laatste
// checks hieronder TONEN dat expliciet aan, in plaats van dat de suite de indruk wekt dat er een
// grens ligt. Wat de afscherming wél oplevert: de kansloze route (een kale identifier) is weg, dus
// wie er alsnog bij komt deed dat aantoonbaar met opzet — en dát is wat een toestemmingsmodel nodig
// heeft om iets te betekenen.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import {
  installFromZipBlob,
  parseZipEntries,
  sha256Hex,
  verifyCatalogDownload,
} from '@/extensions/extensionService';
import { executeExtensionCode } from '@/extensions/extensionLoader';
import { resetConsentAsker, setConsentAsker } from '@/extensions/consent';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const bytes = (s: string) => new TextEncoder().encode(s);

interface StoredZipFixtureEntry {
  name: string;
  data?: Uint8Array;
  declaredUncompressedSize?: number;
}

/** Kleine local-header-only ZIP-fixture; voldoende voor de echte fallbackparser. */
const storedZip = (entries: StoredZipFixtureEntry[]): Blob => {
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    const name = bytes(entry.name);
    const data = entry.data ?? bytes('x');
    const chunk = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, entry.declaredUncompressedSize ?? data.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    chunk.set(name, 30);
    chunk.set(data, 30 + name.length);
    chunks.push(chunk);
  }
  return new Blob(chunks as unknown as BlobPart[]);
};

const expectZipReject = async (label: string, entries: StoredZipFixtureEntry[]) => {
  let reason = '';
  try {
    await parseZipEntries(await storedZip(entries).arrayBuffer());
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }
  eq(`${label}: ZIP wordt geweigerd`, reason.length > 0, true);
};

const manifestJson = (patch: Record<string, unknown> = {}) => bytes(JSON.stringify({
  id: 'zip-demo',
  name: 'ZIP Demo',
  version: '1.2.3',
  apiVersion: '1.0',
  minAppVersion: '2026.8.1',
  author: 'OpenAEC',
  description: '',
  category: 'Utility',
  main: 'main.js',
  permissions: ['events'],
  ...patch,
}));

// ── 1. sha256Hex tegen bekende vectoren ─────────────────────────────────────
// Zelf-gerolde hex-codering is precies het soort ding dat er goed uitziet en één padStart mist.
eq('1 lege invoer', await sha256Hex(new Uint8Array(0)),
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
eq('2 "abc"', await sha256Hex(bytes('abc')),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq('3 "The quick brown fox jumps over the lazy dog"',
  await sha256Hex(bytes('The quick brown fox jumps over the lazy dog')),
  'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
// Een byte met een waarde < 16 moet als "0x" gecodeerd worden; zonder padStart schuift de hele
// string op en klopt er niets meer. Deze invoer is zo gekozen dat de hash met een nul-nibble begint.
{
  const h = await sha256Hex(bytes('avalanche'));
  eq('4 hex is 64 tekens lang', h.length, 64);
  eq('4a en uitsluitend hex', /^[0-9a-f]{64}$/.test(h), true);
}

// ── 2. De verificatie-beslissing ────────────────────────────────────────────
const data = bytes('dit is de zipinhoud');
const juist = await sha256Hex(data);

{
  const v = await verifyCatalogDownload({ id: 'e1', sha256: juist }, data);
  eq('5 kloppende hash ⇒ installeren mag', v.ok, true);
  eq('5a en het is een GEVERIFIEERDE installatie', v.unverified, undefined);
}
{
  const v = await verifyCatalogDownload({ id: 'e1', sha256: juist.toUpperCase() }, data);
  eq('6 hoofdletters in de hash zijn geen mismatch', v.ok, true);
}
{
  const v = await verifyCatalogDownload({ id: 'e1', sha256: `  ${juist}  ` }, data);
  eq('7 witruimte rond de hash ook niet', v.ok, true);
}
{
  // Eén byte verschil moet al fataal zijn.
  const v = await verifyCatalogDownload({ id: 'e1', sha256: juist }, bytes('dit is de zipinhoud!'));
  eq('8 één byte verschil ⇒ geweigerd', v.ok, false);
  eq('8a met een reden die de verwachte hash noemt', v.reason?.includes(juist), true);
  eq('8b en die zegt dat er niets geïnstalleerd is', v.reason?.includes('niet geïnstalleerd'), true);
}
{
  const v = await verifyCatalogDownload({ id: 'e1' }, data);
  eq('9 geen hash ⇒ installeren mag', v.ok, true);
  eq('9a maar gemarkeerd als ongeverifieerd', v.unverified, true);
  const leeg = await verifyCatalogDownload({ id: 'e1', sha256: '   ' }, data);
  eq('9b een lege hash telt als geen hash', leeg.unverified, true);
}
// Een AANWEZIGE maar onleesbare hash mag niet stilzwijgend omslaan in "dan maar niet verifiëren" —
// dat is precies de degradatie die de hele controle waardeloos maakt.
for (const rommel of ['abc', juist.slice(0, 63), `${juist}0`, `${juist.slice(0, 63)}g`, 'sha256:' + juist]) {
  const v = await verifyCatalogDownload({ id: 'e1', sha256: rommel }, data);
  eq(`10 onleesbare hash "${rommel.slice(0, 12)}…" ⇒ geweigerd`, v.ok, false);
  eq(`10a en niet stil als ongeverifieerd doorgelaten`, v.unverified, undefined);
}

// ── 3. Afscherming van de rauwe host-globals ────────────────────────────────
{
  const g = globalThis as unknown as Record<string, unknown>;
  const bewaard = { t: g.__TAURI_INTERNALS__, t2: g.__TAURI__, o: g.__OPS__ };
  g.__TAURI_INTERNALS__ = { invoke: () => 'ECHT' };
  g.__TAURI__ = { iets: 1 };
  g.__OPS__ = { store: 'ECHT' };

  // De extensie ziet de identifiers als `undefined`, niet als het echte object.
  const plugin = executeExtensionCode(`
    module.exports = {
      onLoad() {},
      gezien: {
        tauriInternals: typeof __TAURI_INTERNALS__,
        tauri: typeof __TAURI__,
        ops: typeof __OPS__,
      },
      // Ontsnappen kan nog steeds — dat is het punt van de eerlijkheid hieronder.
      viaGlobalThis: typeof globalThis.__TAURI_INTERNALS__,
      viaFunction: typeof Function('return this')().__TAURI_INTERNALS__,
    };
  `) as unknown as {
    gezien: Record<string, string>;
    viaGlobalThis: string;
    viaFunction: string;
  };

  eq('11 __TAURI_INTERNALS__ is afgeschermd', plugin.gezien.tauriInternals, 'undefined');
  eq('11a __TAURI__ ook', plugin.gezien.tauri, 'undefined');
  eq('11b de dev-bridge __OPS__ ook', plugin.gezien.ops, 'undefined');

  // EN DIT IS DE EERLIJKE HELFT. Zou een van deze twee ooit 'undefined' worden, dan is er een
  // echte grens bij gekomen en mag de tekst in docs/extensions.md worden aangescherpt — tot die
  // tijd staat hier zwart-op-wit dat de afscherming een drempel is en geen muur.
  eq('12 ontsnappen via globalThis kan nog steeds (geen sandbox)', plugin.viaGlobalThis, 'object');
  eq('12a en via Function("return this") ook', plugin.viaFunction, 'object');

  // De normale weg blijft werken: de SDK komt gewoon binnen.
  const sdkPlugin = executeExtensionCode(`
    const sdk = require('open-planner-studio');
    module.exports = { onLoad() {}, heeftVersie: typeof sdk.version, heeftApi: typeof sdk.apiVersion };
  `) as unknown as { heeftVersie: string; heeftApi: string };
  eq('13 require("open-planner-studio") werkt nog', sdkPlugin.heeftVersie, 'string');
  eq('13a inclusief de contractversie', sdkPlugin.heeftApi, 'string');

  // Een andere module blijft geweigerd.
  let gooide = false;
  try {
    executeExtensionCode(`require('fs'); module.exports = { onLoad() {} };`);
  } catch { gooide = true; }
  eq('14 require van iets anders gooit', gooide, true);

  // Zonder onLoad is het geen plugin.
  let geenOnLoad = false;
  try { executeExtensionCode(`module.exports = { iets: 1 };`); } catch { geenOnLoad = true; }
  eq('15 een module zonder onLoad wordt geweigerd', geenOnLoad, true);

  g.__TAURI_INTERNALS__ = bewaard.t;
  g.__TAURI__ = bewaard.t2;
  g.__OPS__ = bewaard.o;
}

// ── 4. ZIP-namen, selectie en payloadlimieten ──────────────────────────────
{
  const parsed = await parseZipEntries(await storedZip([
    { name: 'pakket/manifest.json', data: manifestJson() },
    { name: 'pakket/main.js', data: bytes('module.exports = { onLoad() {} };') },
    { name: 'pakket/assets/font.bin', data: bytes('font') },
  ]).arrayBuffer());
  eq('16 precies één gemeenschappelijke topmap wordt gestript',
    parsed.map((entry) => entry.name), ['manifest.json', 'main.js', 'assets/font.bin']);
}

for (const unsafeName of [
  '../main.js',
  '/main.js',
  'dir\\main.js',
  'nul\0main.js',
  'dir//main.js',
  './main.js',
  'dir/../main.js',
]) {
  await expectZipReject(`17 onveilige entrynaam ${JSON.stringify(unsafeName)}`, [
    { name: unsafeName },
  ]);
}

await expectZipReject('18 dubbele genormaliseerde naam', [
  { name: 'pakket/main.js', data: bytes('een') },
  { name: 'pakket/main.js', data: bytes('twee') },
]);
await expectZipReject('18a twee manifest.json-bestanden', [
  { name: 'manifest.json', data: manifestJson() },
  { name: 'manifest.json', data: manifestJson({ id: 'ander' }) },
]);
await expectZipReject('19 entry boven 24 MiB', [
  { name: 'asset.bin', declaredUncompressedSize: 24 * 1024 * 1024 + 1 },
]);
await expectZipReject('19a totaal boven 48 MiB', [
  { name: 'a.bin', declaredUncompressedSize: 17 * 1024 * 1024 },
  { name: 'b.bin', declaredUncompressedSize: 17 * 1024 * 1024 },
  { name: 'c.bin', declaredUncompressedSize: 17 * 1024 * 1024 },
]);

// ── 5. Hoofdbestand en catalogusidentiteit worden vóór consent gecontroleerd ────────────────
{
  const globals = globalThis as unknown as Record<string, unknown>;
  const hadWindow = Object.prototype.hasOwnProperty.call(globals, 'window');
  const previousWindow = globals.window;
  globals.window = {};
  let consentCalls = 0;
  setConsentAsker(() => {
    consentCalls++;
    return Promise.resolve(false);
  });

  const nestedOnly = storedZip([
    { name: 'manifest.json', data: manifestJson() },
    { name: 'nested/main.js', data: bytes('module.exports = { onLoad() {} };') },
  ]);
  eq('20 een main die alleen via endsWith matcht wordt geweigerd',
    await installFromZipBlob(nestedOnly), 'failed');
  eq('20a endsWith-mismatch bereikt consent niet', consentCalls, 0);

  const valid = storedZip([
    { name: 'manifest.json', data: manifestJson() },
    { name: 'main.js', data: bytes('module.exports = { onLoad() {} };') },
  ]);
  eq('21 catalogus-idmismatch wordt geweigerd',
    await installFromZipBlob(valid, { id: 'andere-id', version: '1.2.3' }), 'failed');
  eq('21a idmismatch bereikt consent niet', consentCalls, 0);
  eq('22 catalogus-versiemismatch wordt geweigerd',
    await installFromZipBlob(valid, { id: 'zip-demo', version: '9.9.9' }), 'failed');
  eq('22a versiemismatch bereikt consent niet', consentCalls, 0);

  eq('23 exacte identiteit en exact mainpad bereiken de bestaande consentpoort',
    await installFromZipBlob(valid, { id: 'zip-demo', version: '1.2.3' }), 'declined');
  eq('23a geldige ZIP vraagt precies eenmaal consent', consentCalls, 1);

  const invalidManifest = storedZip([
    { name: 'manifest.json', data: bytes('{ "id": }') },
    { name: 'main.js', data: bytes('module.exports = { onLoad() {} };') },
  ]);
  eq('24 ongeldige manifest-JSON wordt geweigerd',
    await installFromZipBlob(invalidManifest), 'failed');
  eq('24a ongeldige JSON bereikt consent niet', consentCalls, 1);

  const invalidField = storedZip([
    { name: 'manifest.json', data: manifestJson({ id: 'Niet-Geldig' }) },
    { name: 'main.js', data: bytes('module.exports = { onLoad() {} };') },
  ]);
  eq('25 ongeldig manifestveld wordt geweigerd',
    await installFromZipBlob(invalidField), 'failed');
  eq('25a ongeldig manifestveld bereikt consent niet', consentCalls, 1);

  resetConsentAsker();
  if (hadWindow) globals.window = previousWindow;
  else delete globals.window;
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensie-integriteit — ${checks} checks groen`);
} else {
  console.log(`XX extensie-integriteit — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
