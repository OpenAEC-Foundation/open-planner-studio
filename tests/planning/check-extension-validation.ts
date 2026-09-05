// Runtimevalidatie voor niet-vertrouwde extensiemanifesten.
//
// Deze batterij toetst bewust de herbouwde uitkomst en niet alleen foutmeldingen: onbekende velden
// moeten verdwijnen, arrays moeten losstaan van de invoer en legacydefaults mogen uitsluitend de
// expliciet toegestane gaten vullen. Draait via run.sh. Exit 0 = alles groen.
import {
  EXTENSION_LIMITS,
  manifestFromJavaScript,
  parseCatalog,
  parseExtensionManifest,
  parseStoredExtension,
} from '@/extensions/validation';
import type {
  CatalogEntry,
  CatalogIssue,
  ExtensionManifest,
  ParseResult,
} from '@/extensions/types';
import {
  disableExtension,
  enableExtension,
  getActivePlugins,
  type ExtensionStorage,
} from '@/extensions/extensionLoader';
import { createAppStoreContext, useAppStore } from '@/state/appStore';
import { KNOWN_PERMISSIONS } from '@/extensions/permissions';

const diffs: string[] = [];
let checks = 0;

const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const expectOk = (
  label: string,
  result: ParseResult<ExtensionManifest>,
): Extract<ParseResult<ExtensionManifest>, { ok: true }> | null => {
  eq(`${label}: parse slaagt`, result.ok, true);
  return result.ok ? result : null;
};

const expectFail = (label: string, input: unknown, mode: 'fresh' | 'stored-legacy' = 'fresh') => {
  const result = parseExtensionManifest(input, mode);
  eq(`${label}: parse faalt`, result.ok, false);
  if (!result.ok) eq(`${label}: fout is concreet`, result.error.length > 0, true);
};

const volledig = (): Record<string, unknown> => ({
  id: 'demo.planning-tools',
  name: 'Planning Tools',
  version: '1.2.3',
  apiVersion: '1.0',
  minAppVersion: '2026.8.1',
  author: 'OpenAEC',
  description: 'Voorbeeldextensie',
  category: 'Utility',
  main: 'src/main.js',
  permissions: ['ribbon', 'events', 'ribbon'],
  repository: 'https://example.invalid/open-aec/planning-tools',
  tags: ['planning', 'tools', 'planning'],
  icon: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
  onbekend: { genest: { magNietLekken: true } },
});

const catalogEntry = (
  id: string,
  patch: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  name: `Catalogus ${id}`,
  version: '1.2.3',
  apiVersion: '1.0',
  minAppVersion: '2026.8.1',
  author: 'OpenAEC',
  description: '',
  category: 'Utility',
  tags: ['planning', 'planning'],
  repository: `https://example.invalid/${id}`,
  downloadUrl: `https://downloads.example.invalid/${id}.zip`,
  icon: '',
  onbekend: { niet: 'doorgeven' },
  ...patch,
});

const catalog = (extensions: unknown): Record<string, unknown> => ({
  version: '1.0',
  lastUpdated: '2026-08-24T12:00:00Z',
  extensions,
});

const expectCatalogFail = (label: string, input: unknown) => {
  const result = parseCatalog(input);
  eq(`${label}: catalogusparse faalt`, result.ok, false);
  if (!result.ok) eq(`${label}: catalogusfout is concreet`, result.error.length > 0, true);
};

const expectCatalogOk = (
  label: string,
  input: unknown,
): Extract<ReturnType<typeof parseCatalog>, { ok: true }> | null => {
  const result = parseCatalog(input);
  eq(`${label}: catalogusparse slaagt`, result.ok, true);
  return result.ok ? result : null;
};

const storedRecord = (
  id = 'opslag-extensie',
  patch: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  manifest: { ...volledig(), id },
  mainCode: 'module.exports = { onLoad() {} };',
  enabled: false,
  ...patch,
});

const expectStoredFail = (
  label: string,
  input: unknown,
  storageKey: IDBValidKey = 'opslag-extensie',
) => {
  const result = parseStoredExtension(input, storageKey);
  eq(`${label}: opgeslagen extensie faalt`, result.ok, false);
  if (!result.ok) eq(`${label}: opslagfout is concreet`, result.error.length > 0, true);
};

// ── 1. Topniveau en verplichte identiteit ───────────────────────────────────
expectFail('null is geen manifest', null);
expectFail('een array is geen manifest', []);
expectFail('een string is geen manifest', 'manifest');
expectFail('ontbrekend id', { ...volledig(), id: undefined });
expectFail('id met hoofdletters', { ...volledig(), id: 'Demo.extension' });
expectFail('prototype-id', { ...volledig(), id: '__proto__' });
expectFail('id langer dan de grens', { ...volledig(), id: `a${'b'.repeat(EXTENSION_LIMITS.id)}` });

// ── 2. Gesloten unies en verplichte veldvormen ──────────────────────────────
expectFail('onbekende categorie', { ...volledig(), category: 'Security' });
expectFail('onbekende fresh permission', { ...volledig(), permissions: ['ribbon', 'commands'] });
expectFail('permissions is geen array', { ...volledig(), permissions: 'ribbon' });
expectFail('permission is geen string', { ...volledig(), permissions: ['ribbon', 1] });

// ── 2a. `permissions.ts` (KNOWN_PERMISSIONS) is de ENE bron voor deze validator ─────────────
// Her-review 2 vond een tweede, handgekopieerde permissielijst in validation.ts die
// 'importSource' miste: de permissie bestond in de guard-tabel en KNOWN_PERMISSIONS, maar géén
// installatiepad (ZIP/catalogus, los .js, dev-bridge) kon een manifest met die permissie ooit
// parsen — 'fresh' weigerde hem exact als de typefout 'bogus'. Dit haalt ELKE permissie die de
// app kent door de echte 'fresh'-validatieroute en eist dat hij overleeft; een nieuwe permissie
// die alleen aan permissions.ts wordt toegevoegd kan dus niet meer stil onbereikbaar blijven.
// Mutatiebewijs: ontkoppel `EXTENSION_PERMISSIONS` in validation.ts weer van `KNOWN_PERMISSIONS`
// (bv. terug naar de oude losse lijst zonder 'importSource') en dit blok kleurt rood.
for (const permissie of KNOWN_PERMISSIONS) {
  const parsed = expectOk(`KNOWN_PERMISSIONS bevat een bereikbare permissie: ${permissie}`,
    parseExtensionManifest({ ...volledig(), permissions: [permissie] }, 'fresh'));
  if (parsed) {
    eq(`${permissie}: fresh-parse bewaart exact deze permissie`, parsed.value.permissions, [permissie]);
  }
}
expectFail('een niet-gekende permissie blijft geweigerd (regressiegrens)', { ...volledig(), permissions: ['bogus'] });
for (const veld of ['name', 'version', 'minAppVersion', 'author', 'description', 'category', 'main', 'permissions']) {
  expectFail(`fresh vereist ${veld}`, { ...volledig(), [veld]: undefined });
}

// ── 3. Relatieve hoofdpaden worden niet genormaliseerd ─────────────────────
for (const main of [
  '', '/main.js', '../main.js', 'dir/../main.js', './main.js', 'dir//main.js',
  'dir\\main.js', 'dir/./main.js', 'main\0.js', `${'a'.repeat(EXTENSION_LIMITS.main)}.js`,
]) {
  expectFail(`onveilig main-pad ${JSON.stringify(main)}`, { ...volledig(), main });
}

// ── 4. Versies, tags, repository en icoon ──────────────────────────────────
for (const [veld, waarde] of [
  ['version', 'v1.2.3'], ['version', '1.2.3.4.5'], ['version', '1..2'],
  ['apiVersion', '1.x'], ['apiVersion', ''],
  ['minAppVersion', '2026.08-beta'], ['minAppVersion', '1.2.3.4.5'],
] as const) {
  expectFail(`ongeldige ${veld} ${JSON.stringify(waarde)}`, { ...volledig(), [veld]: waarde });
}
expectFail('tags is geen array', { ...volledig(), tags: 'planning' });
expectFail('te veel tags', {
  ...volledig(),
  tags: Array.from({ length: EXTENSION_LIMITS.tags + 1 }, (_, i) => `tag-${i}`),
});
expectFail('te lange tag', { ...volledig(), tags: ['x'.repeat(EXTENSION_LIMITS.tag + 1)] });
expectFail('niet-http repository', { ...volledig(), repository: 'file:///tmp/plugin' });
expectFail('ongeldige repository', { ...volledig(), repository: 'dit is geen url' });
expectFail('te groot icoon meet UTF-8-bytes', {
  ...volledig(),
  icon: '🙂'.repeat(Math.floor(EXTENSION_LIMITS.iconBytes / 4) + 1),
});
for (const [label, patch] of [
  ['lege beschrijving', { description: '' }],
  ['lege tag', { tags: [''] }],
  ['leeg icoon', { icon: '' }],
] as const) {
  expectOk(`${label} blijft een geldige begrensde string`,
    parseExtensionManifest({ ...volledig(), ...patch }, 'fresh'));
}

// ── 5. Positieve reconstructie en losstaandheid ─────────────────────────────
{
  const bron = volledig();
  const parsed = expectOk('volledig fresh manifest', parseExtensionManifest(bron, 'fresh'));
  if (parsed) {
    eq('fresh parse waarschuwt niet', parsed.warnings, []);
    eq('uitkomst is een vers object', Object.is(parsed.value, bron), false);
    eq('fresh parse reconstrueert uitsluitend bekende velden',
      Object.fromEntries(Object.entries(parsed.value).sort(([a], [b]) => a.localeCompare(b))),
      Object.fromEntries(Object.entries({
        id: 'demo.planning-tools',
        name: 'Planning Tools',
        version: '1.2.3',
        apiVersion: '1.0',
        minAppVersion: '2026.8.1',
        author: 'OpenAEC',
        description: 'Voorbeeldextensie',
        category: 'Utility',
        main: 'src/main.js',
        permissions: ['ribbon', 'events'],
        repository: 'https://example.invalid/open-aec/planning-tools',
        tags: ['planning', 'tools'],
        icon: '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>',
      }).sort(([a], [b]) => a.localeCompare(b))));
    eq('permissions zijn stabiel gededupliceerd', parsed.value.permissions, ['ribbon', 'events']);
    eq('tags zijn stabiel gededupliceerd', parsed.value.tags, ['planning', 'tools']);
    eq('onbekend topniveauveld verdwijnt', 'onbekend' in parsed.value, false);

    const permissions = bron.permissions as unknown[];
    const tags = bron.tags as unknown[];
    bron.name = 'NA PARSE GEWIJZIGD';
    permissions.push('network');
    tags[0] = 'gewijzigd';
    (bron.onbekend as { genest: { magNietLekken: boolean } }).genest.magNietLekken = false;
    eq('bronmutatie wijzigt naamuitkomst niet', parsed.value.name, 'Planning Tools');
    eq('bronmutatie wijzigt permissionsuitkomst niet', parsed.value.permissions, ['ribbon', 'events']);
    eq('bronmutatie wijzigt tagsuitkomst niet', parsed.value.tags, ['planning', 'tools']);
  }
}

// ── 6. Legacybeleid is beperkt en zichtbaar ─────────────────────────────────
{
  const legacy = volledig();
  delete legacy.apiVersion;
  delete legacy.minAppVersion;
  delete legacy.permissions;
  delete legacy.tags;
  delete legacy.repository;
  delete legacy.icon;
  const parsed = expectOk('legacy met toegestane ontbrekende velden',
    parseExtensionManifest(legacy, 'stored-legacy'));
  if (parsed) {
    eq('legacy default min-app', parsed.value.minAppVersion, '0.0.0');
    eq('legacy default permissions', parsed.value.permissions, []);
    eq('legacy apiVersion blijft afwezig', parsed.value.apiVersion, undefined);
    eq('legacy tags blijven afwezig', parsed.value.tags, undefined);
    eq('legacy repository blijft afwezig', parsed.value.repository, undefined);
    eq('legacy icon blijft afwezig', parsed.value.icon, undefined);
    eq('legacydefaults geven twee waarschuwingen', parsed.warnings.length, 2);
  }

  const metOnbekend = expectOk('legacy filtert onbekende permissions', parseExtensionManifest({
    ...volledig(),
    permissions: ['network', 'commands', 'ribbon', 'commands'],
  }, 'stored-legacy'));
  if (metOnbekend) {
    eq('legacy behoudt bekende permissions in volgorde', metOnbekend.value.permissions, ['network', 'ribbon']);
    eq('legacy meldt gefilterde permissions', metOnbekend.warnings.length, 1);
  }

  for (const veld of ['id', 'name', 'version', 'author', 'description', 'category', 'main']) {
    expectFail(`legacy vereist ${veld}`, { ...volledig(), [veld]: undefined }, 'stored-legacy');
  }
}

// ── 7. Catalogustopniveau is atomair ────────────────────────────────────────
expectCatalogFail('null is geen catalogus', null);
expectCatalogFail('catalogusarray is geen catalogus', []);
expectCatalogFail('ongeldige catalogusversie', { ...catalog([]), version: 'v1' });
expectCatalogFail('ontbrekende catalogusversie', { ...catalog([]), version: undefined });
expectCatalogFail('ongeldige lastUpdated', { ...catalog([]), lastUpdated: '24 augustus 2026' });
expectCatalogFail('onmogelijke lastUpdated', { ...catalog([]), lastUpdated: '2026-02-31' });
expectCatalogFail('extensions is geen array', catalog({}));

// ── 8. Entries falen geïsoleerd en bewaren hun echte index ──────────────────
{
  const parsed = expectCatalogOk('geldig-ongeldig-geldig blijft bruikbaar', catalog([
    catalogEntry('eerste'),
    catalogEntry('kapot', { name: undefined }),
    catalogEntry('laatste', { sha256: 'a'.repeat(64) }),
  ]));
  if (parsed) {
    eq('geldige catalogusburen blijven staan',
      parsed.value.catalog.extensions.map((entry) => entry.id), ['eerste', 'laatste']);
    eq('entryfout gebruikt de echte bronindex',
      parsed.value.issues.map(({ index, idHint }) => ({ index, idHint })),
      [{ index: 1, idHint: 'kapot' }]);
    eq('catalogusissues worden niet als parserwarnings verstopt', parsed.warnings, []);
  }
}

{
  const parsed = expectCatalogOk('onafhankelijke entryveldafwijkingen', catalog([
    catalogEntry('goed-zonder-hash', { sha256: undefined }),
    catalogEntry('foute-download', { downloadUrl: 'file:///tmp/extensie.zip' }),
    catalogEntry('foute-categorie', { category: 'Security' }),
    catalogEntry('foute-tags', {
      tags: Array.from({ length: EXTENSION_LIMITS.tags + 1 }, (_, i) => `tag-${i}`),
    }),
    catalogEntry('foute-hash-kort', { sha256: 'a'.repeat(63) }),
    catalogEntry('foute-hash-te-lang', { sha256: 'a'.repeat(65) }),
    catalogEntry('foute-hash-teken', { sha256: `${'a'.repeat(63)}g` }),
    catalogEntry('goed-met-uppercase-hash', { sha256: 'A'.repeat(64) }),
  ]));
  if (parsed) {
    eq('alleen geldige entries blijven over',
      parsed.value.catalog.extensions.map((entry) => entry.id),
      ['goed-zonder-hash', 'goed-met-uppercase-hash']);
    eq('iedere ongeldige entry levert één issue op zijn bronindex',
      parsed.value.issues.map((issue) => issue.index), [1, 2, 3, 4, 5, 6]);
    eq('afwezige sha256 blijft afwezig',
      parsed.value.catalog.extensions[0]?.sha256, undefined);
    eq('exacte uppercase hex blijft geldig en ongewijzigd',
      parsed.value.catalog.extensions[1]?.sha256, 'A'.repeat(64));
  }
}

// ── 9. De eerste geldige id wint deterministisch ────────────────────────────
for (const [label, entries] of [
  ['dezelfde id en versie', [
    catalogEntry('dubbel', { version: '1.0' }),
    catalogEntry('dubbel', { version: '1.0' }),
  ]],
  ['dezelfde id met twee versies', [
    catalogEntry('dubbel', { version: '1.0' }),
    catalogEntry('dubbel', { version: '2.0' }),
  ]],
] as const) {
  const parsed = expectCatalogOk(label, catalog(entries));
  if (parsed) {
    eq(`${label}: alleen de eerste kaart blijft`,
      parsed.value.catalog.extensions.map((entry) => `${entry.id}@${entry.version}`),
      ['dubbel@1.0']);
    eq(`${label}: de latere entry is issue index 1`,
      parsed.value.issues.map(({ index, idHint }) => ({ index, idHint })),
      [{ index: 1, idHint: 'dubbel' }]);
  }
}

{
  const parsed = expectCatalogOk('ongeldige entry reserveert zijn id niet', catalog([
    catalogEntry('herstelbaar', { name: undefined }),
    catalogEntry('herstelbaar'),
  ]));
  if (parsed) {
    eq('latere geldige entry met dezelfde id blijft bruikbaar',
      parsed.value.catalog.extensions.map((entry) => entry.id), ['herstelbaar']);
    eq('alleen de ongeldige eerste entry is een issue',
      parsed.value.issues.map(({ index, idHint }) => ({ index, idHint })),
      [{ index: 0, idHint: 'herstelbaar' }]);
  }
}

// ── 10. Een geldige catalogus wordt losstaand en zonder onbekende velden herbouwd ─────────────
{
  const bronEntry = catalogEntry('losstaand', { tags: ['een', 'twee', 'een'] });
  const bron = catalog([bronEntry]);
  const parsed = expectCatalogOk('volledige catalogusreconstructie', bron);
  if (parsed) {
    const entry: CatalogEntry | undefined = parsed.value.catalog.extensions[0];
    eq('catalogusentrytags zijn stabiel gededupliceerd', entry?.tags, ['een', 'twee']);
    eq('onbekend entryveld verdwijnt', entry ? 'onbekend' in entry : true, false);
    eq('catalogustopobject is vers', Object.is(parsed.value.catalog, bron), false);
    bronEntry.name = 'NA PARSE GEWIJZIGD';
    (bronEntry.tags as unknown[]).push('drie');
    eq('bronmutatie wijzigt catalogusnaam niet', entry?.name, 'Catalogus losstaand');
    eq('bronmutatie wijzigt catalogustags niet', entry?.tags, ['een', 'twee']);
  }
}

// ── 11. Cataloguskwaliteit is appglobale, niet-destructieve storestate ───────
{
  const context = createAppStoreContext();
  eq('catalogusissues starten leeg', context.store.getState().catalogIssues, []);

  const parsed = expectCatalogOk('storefixture gebruikt een gevalideerde entry', catalog([
    catalogEntry('store-entry'),
  ]));
  if (parsed) {
    const entries: CatalogEntry[] = parsed.value.catalog.extensions;
    const issues: CatalogIssue[] = [{ index: 4, idHint: 'kapot', error: 'testreden' }];
    context.store.getState().setCatalog(entries, issues, 1234);
    eq('setCatalog bewaart gevalideerde entries', context.store.getState().catalogEntries, entries);
    eq('setCatalog bewaart issues', context.store.getState().catalogIssues, issues);
    eq('setCatalog bewaart fetchtijd', context.store.getState().catalogLastFetched, 1234);

    context.store.getState().setCatalogError('netwerkfout');
    eq('fetchfout bewaart de bruikbare catalogus', context.store.getState().catalogEntries, entries);
    eq('fetchfout bewaart de bijbehorende issues', context.store.getState().catalogIssues, issues);
    eq('fetchfout bewaart de laatste succesvolle fetchtijd',
      context.store.getState().catalogLastFetched, 1234);
    eq('fetchfout wordt wel zichtbaar', context.store.getState().catalogError, 'netwerkfout');
  }
}

// ── 12. Losse JavaScript-manifesten falen gesloten ──────────────────────────
{
  const generated = manifestFromJavaScript('module.exports = { onLoad() {} };', 'Mijn Tool.js');
  eq('JS zonder marker krijgt een gevalideerd gegenereerd manifest', generated.ok, true);
  if (generated.ok) {
    eq('gegenereerde JS-identiteit behoudt bestaand beleid', generated.value.id, 'mijn-tool');
    eq('gegenereerde JS-naam behoudt bestaand beleid', generated.value.name, 'Mijn Tool');
    eq('gegenereerd manifest declareert alleen events', generated.value.permissions, ['events']);
  }

  const markerInCode = manifestFromJavaScript(
    'const tekst = "@manifest { dit is geen commentaar }"; module.exports = { onLoad() {} };',
    'fallback.js',
  );
  eq('marker buiten een commentblok telt als afwezig',
    markerInCode.ok ? markerInCode.value.id : markerInCode, 'fallback');

  const rawManifest = {
    ...volledig(),
    id: 'js-brace-aware',
    permissions: ['events'],
    onbekend: { sluitaccoladeInString: '}', genest: { waarde: 1 } },
  };
  const braceAware = manifestFromJavaScript(
    `/** @manifest ${JSON.stringify(rawManifest)} */\nmodule.exports = { onLoad() {} };`,
    'genegeerd.js',
  );
  eq('brace-aware extractor accepteert geneste JSON en } in een string', braceAware.ok, true);
  if (braceAware.ok) {
    eq('JS-manifest gebruikt de expliciete identiteit', braceAware.value.id, 'js-brace-aware');
    eq('onbekende geneste JS-velden verdwijnen', 'onbekend' in braceAware.value, false);
  }

  for (const [label, code] of [
    ['ongeldige JSON valt niet terug', '/** @manifest { "id": } */'],
    ['onafgesloten JSON valt niet terug', '/** @manifest { "id": "kapot" */'],
    ['geldig JSON-object met ongeldig id valt niet terug',
      `/** @manifest ${JSON.stringify({ ...volledig(), id: 'Niet-Geldig' })} */`],
    ['tekst na het JSON-object maakt het blok ongeldig',
      `/** @manifest ${JSON.stringify({ ...volledig(), id: 'geldig-id' })} extra */`],
  ] as const) {
    const parsed = manifestFromJavaScript(code, 'veilige-fallback.js');
    eq(`${label}: parse faalt`, parsed.ok, false);
    if (!parsed.ok) eq(`${label}: fout is concreet`, parsed.error.length > 0, true);
  }

  const onbruikbareFallback = manifestFromJavaScript('module.exports = {};', '💥.js');
  eq('ook een gegenereerd manifest gaat door de fresh parser', onbruikbareFallback.ok, false);
}

// ── 13. Opgeslagen records worden per echte sleutel opnieuw opgebouwd ──────────────
{
  const legacyManifest = volledig();
  delete legacyManifest.minAppVersion;
  delete legacyManifest.permissions;
  const bronAssets: Record<string, Uint8Array> = Object.create(null);
  bronAssets['fonts/voorbeeld.ttf'] = new Uint8Array([1, 2, 3]);
  const bron = storedRecord('legacy-opslag', {
    manifest: { ...legacyManifest, id: 'legacy-opslag' },
    assets: bronAssets,
    onbekend: 'verdwijnt',
  });
  const parsed = parseStoredExtension(bron, 'legacy-opslag');
  eq('geldig legacy-opslagrecord parseert', parsed.ok, true);
  if (parsed.ok) {
    eq('echte opslagsleutel blijft behouden', parsed.value.storageKey, 'legacy-opslag');
    eq('legacywaarschuwingen blijven zichtbaar', parsed.value.legacyWarnings.length, 2);
    eq('opslagparser reconstrueert alleen bekende velden',
      Object.keys(parsed.value).sort(),
      ['assets', 'enabled', 'id', 'legacyWarnings', 'mainCode', 'manifest', 'storageKey']);
    eq('assetbytes worden gekopieerd',
      Array.from(parsed.value.assets?.['fonts/voorbeeld.ttf'] ?? []), [1, 2, 3]);
    eq('assetmap staat los van de bron', Object.is(parsed.value.assets, bronAssets), false);
    bronAssets['fonts/voorbeeld.ttf'][0] = 9;
    eq('bronmutatie wijzigt opgeslagen asset niet',
      Array.from(parsed.value.assets?.['fonts/voorbeeld.ttf'] ?? []), [1, 2, 3]);
  }
}

expectStoredFail('opslagrecord moet een object zijn', null);
expectStoredFail('mainCode moet een string zijn', storedRecord('opslag-extensie', { mainCode: 7 }));
expectStoredFail('mainCode mag niet leeg zijn', storedRecord('opslag-extensie', { mainCode: '' }));
expectStoredFail('enabled moet boolean zijn', storedRecord('opslag-extensie', { enabled: 'true' }));
expectStoredFail('record-id moet string zijn', storedRecord('opslag-extensie', { id: 1 }), 1);
expectStoredFail('opslagsleutel moet exact record-id zijn', storedRecord(), 'andere-sleutel');
expectStoredFail('manifest-id moet exact record-id zijn', storedRecord('opslag-extensie', {
  manifest: { ...volledig(), id: 'andere-manifest-id' },
}));
expectStoredFail('primitief manifest blijft ongeldig', storedRecord('opslag-extensie', { manifest: 42 }));

{
  const limiet = 48 * 1024 * 1024;
  const checkCodegrens = (label: string, code: string, wantOk: boolean) => {
    const parsed = parseStoredExtension(storedRecord('opslag-extensie', { mainCode: code }), 'opslag-extensie');
    eq(label, parsed.ok, wantOk);
  };
  checkCodegrens('mainCode accepteert 48 MiB min 1 UTF-8-byte', 'a'.repeat(limiet - 1), true);
  checkCodegrens('mainCode accepteert exact 48 MiB UTF-8-bytes', '🙂' + 'a'.repeat(limiet - 4), true);
  checkCodegrens('mainCode weigert 48 MiB plus 1 UTF-8-byte', '🙂' + 'a'.repeat(limiet - 3), false);
}

for (const name of ['', '/absoluut.bin', '../traversal.bin', 'map/../bestand.bin',
  './bestand.bin', 'map//bestand.bin', 'map\\bestand.bin', 'nul\0bestand.bin']) {
  const assets: Record<string, Uint8Array> = Object.create(null);
  assets[name] = new Uint8Array([1]);
  expectStoredFail(`onveilige assetnaam ${JSON.stringify(name)}`, storedRecord('opslag-extensie', { assets }));
}
expectStoredFail('assetwaarde moet echte Uint8Array zijn', storedRecord('opslag-extensie', {
  assets: { 'font.ttf': [1, 2, 3] },
}));
expectStoredFail('assets moet een echt record zijn', storedRecord('opslag-extensie', {
  assets: new Date(0),
}));
expectStoredFail('één opgeslagen asset blijft maximaal 24 MiB', storedRecord('opslag-extensie', {
  assets: { 'te-groot.bin': new Uint8Array((24 * 1024 * 1024) + 1) },
}));
expectStoredFail('opgeslagen assets blijven samen maximaal 48 MiB', storedRecord('opslag-extensie', {
  assets: {
    'een.bin': new Uint8Array(16 * 1024 * 1024),
    'twee.bin': new Uint8Array(16 * 1024 * 1024),
    'drie.bin': new Uint8Array((16 * 1024 * 1024) + 1),
  },
}));

// ── 14. Een status-writefailure verandert de gekozen runtimestatus niet ──────────
{
  const id = 'writefailure-test';
  const manifestInput = { ...volledig(), id, minAppVersion: '0.0.0' };
  const value = storedRecord(id, { manifest: manifestInput });
  const manifest = parseExtensionManifest(manifestInput, 'fresh');
  if (!manifest.ok) throw new Error(manifest.error);
  let saveAttempts = 0;
  const failingStorage: ExtensionStorage = {
    get: async (key) => ({ storageKey: key, value }),
    getAll: async () => [{ storageKey: id, value }],
    save: async () => {
      saveAttempts++;
      throw new Error('bewuste test-opslagfout');
    },
    remove: async () => undefined,
  };
  useAppStore.getState().registerReadyExtension({
    kind: 'ready',
    id,
    manifest: manifest.value,
    status: 'disabled',
  });

  await enableExtension(id, failingStorage);
  eq('enable-writefailure laat runtime enabled',
    useAppStore.getState().installedExtensions[id]?.status, 'enabled');
  eq('enable-writefailure laat plugin actief', getActivePlugins().has(id), true);
  eq('enable-writefailure blijft concreet zichtbaar',
    useAppStore.getState().installedExtensions[id]?.error?.includes('bewuste test-opslagfout'), true);

  await disableExtension(id, failingStorage);
  eq('disable-writefailure laat runtime disabled',
    useAppStore.getState().installedExtensions[id]?.status, 'disabled');
  eq('disable-writefailure ruimt actieve plugin op', getActivePlugins().has(id), false);
  eq('disable-writefailure blijft concreet zichtbaar',
    useAppStore.getState().installedExtensions[id]?.error?.includes('bewuste test-opslagfout'), true);
  eq('beide expliciete statuswrites zijn geprobeerd', saveAttempts, 2);
  useAppStore.getState().unregisterExtension(id);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensievalidatie — ${checks} checks groen`);
} else {
  console.log(`XX extensievalidatie — ${diffs.length} van ${checks} checks rood:`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
