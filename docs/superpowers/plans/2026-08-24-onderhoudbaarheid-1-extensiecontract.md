# Onderhoudbaarheidsprogramma 1 — extensiecontract en quarantaine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Behandel catalogus-, JavaScript-, ZIP- en IndexedDB-invoer pas als een extensie nadat de runtimevorm is bewezen; houd onbruikbare opslag zichtbaar en verwijderbaar zonder ooit code te activeren.

**Architecture:** Eén pure validatiemodule reconstrueert bekende manifest-/catalogusvelden. De loader leest IndexedDB per record met zijn echte sleutel en classificeert elk record als `ready` of `quarantined`. Fresh invoer is strikt; bestaande legacy-opslag krijgt alleen expliciete veilige defaults. Documentmutaties vanuit een extensie gebruiken de vooraf ingevoerde `AppStoreContext`.

**Tech Stack:** TypeScript strict, IndexedDB, Web Crypto, browser-native ZIP-decompressie, Zustand + Immer, React 19, react-i18next, bestaande headless planningchecks en Playwright uit Plan 0.

**Spec:** [`docs/superpowers/specs/2026-08-24-onderhoudbaarheidsprogramma-design.md`](../specs/2026-08-24-onderhoudbaarheidsprogramma-design.md)

## Global Constraints

- **Prerequisite:** Plan 0 volledig groen én Task 1 van Plan 2
  (`AppStoreContext`/`StoreRuntime`/gebonden `BatchTransactions`-contract) voltooid.
- Geen `as ExtensionManifest`, `as ExtensionCatalog` of `as StoredExtension` op een niet-vertrouwde grens.
- Ongeldige extensiecode draait nooit, ook niet als het record na startup in IndexedDB is gewijzigd.
- Eén kapot IndexedDB-record blokkeert geen later geldig record.
- Startup normaliseert alleen in geheugen; geen stille writeback of schema-upgrade.
- Bestaande consent-, checksum-, permissie-, API-versie- en SVG-sanitizerpoorten blijven actief.
- Runtimevalidatie wordt niet als sandbox gepresenteerd.
- Alle nieuwe gebruikersstrings komen in alle veertien locales en de extensiedocumentatie.
- `tests/planning/run.sh` bevat bij de start een niet-gerelateerde
  `check-dependency-presentation.ts`-hunk. Stage de eigen extensieregistratie hunkgewijs en verifieer
  de cached diff; neem die bestaande hunk en het bijbehorende testbestand niet mee. Vallen beide
  regels in één patchhunk, splits met `s` of bewerk de cached patch met `e` tot alleen de eigen regel.
- Draai vóór de eerste edit `git status --short`. Draai vóór iedere commit
  `git diff --cached --name-only` en `git diff --cached --check`; inspecteer ieder overlappend bestand
  hunk voor hunk en breek af bij werk buiten de actieve task.
- Raak `docs/CHANGELOG.md` niet aan.

---

## Task 1: Definieer parse-uitkomsten en ready/quarantine-typen

**Files:**
- Modify: `src/extensions/types.ts`
- Create: `src/extensions/validation.ts`

- [ ] **Step 1: Definieer de typegrens zonder gedrag voor te wenden**

Voeg aan `types.ts` toe:

```ts
export type ParseResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; error: string };

export interface CatalogIssue {
  index: number;
  idHint?: string;
  error: string;
}

export interface ReadyExtension extends InstalledExtension {
  kind: 'ready';
}

export interface QuarantinedExtension {
  kind: 'quarantined';
  quarantineId: string;
  storageKey: IDBValidKey;
  displayName: string;
  reason: string;
  status: 'quarantined';
}

export type ExtensionRecord = ReadyExtension | QuarantinedExtension;
```

Laat het bestaande `InstalledExtension`-interface in deze contractcommit exact ongewijzigd. De vier
huidige constructiepaden bouwen nog geen `kind`; een alias naar `ReadyExtension` zou deze zogenaamd
groene commit rood maken. `ReadyExtension` is voorlopig de strengere nieuwe subtypegrens. Task 6
migreert alle constructiepaden atomair en verwijdert daarna pas `InstalledExtension`.

- [ ] **Step 2: Leg parserinputs en limieten vast**

Leg in `validation.ts` alleen de gedeelde runtimevrije contractvorm vast:

```ts
export type ManifestParseMode = 'fresh' | 'stored-legacy';
export const EXTENSION_LIMITS = {
  id: 128,
  name: 160,
  version: 64,
  author: 160,
  description: 4_000,
  main: 512,
  tags: 32,
  tag: 64,
  iconBytes: 128 * 1024,
} as const;
```

Exporteer hier nog geen parserfunctie: een functie die alleen herkenbaar faalt is een niet-toegestane
placeholder. Task 2 voegt test en werkende runtime-export in één groene commit toe.

- [ ] **Step 3: Typecheck de contractvorm en bestaande extensiepoorten**

```bash
npm run typecheck
bash tests/planning/run.sh
```

Verwacht: beide exit 0. Er is nog geen nieuw gedrag geclaimd.

- [ ] **Step 4: Commit uitsluitend het groene typecontract**

```bash
git add src/extensions/types.ts src/extensions/validation.ts
git commit -m "refactor(extensions): leg validatie en quarantainecontract vast"
```

---

## Task 2: Implementeer de manifestparser veld voor veld

**Files:**
- Modify: `src/extensions/validation.ts`
- Create: `tests/planning/check-extension-validation.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Registreer de batterij en schrijf eerst de rode manifestcases**

Voeg `check-extension-validation.ts` handmatig toe aan `tests/planning/run.sh` volgens het bestaande
`bundle_check ...; then node ... || STATUS=1`-patroon. De test importeert de nog niet bestaande
`parseExtensionManifest` en bevat minimaal: `null`, array, ontbrekend id, hoofdletters in id,
`__proto__`, te lang id, onbekende categorie, onbekende permission, niet-array permissions,
leeg/absoluut/traverserend `main`, ongeldige versies, te veel/lange tags, niet-http repository en te
groot icon.

```bash
bash tests/planning/run.sh
```

Verwacht: exit ongelijk aan 0 omdat de runtime-export nog ontbreekt. Implementeer hem in deze task
voordat er wordt gecommit.

- [ ] **Step 2: Voeg kleine onbekende-waardehelpers toe**

Alle helpers nemen `unknown` en geven een getypeerde `ParseResult` of voegen een veldspecifieke fout
toe. Gebruik geen generieke schema-afhankelijkheid voor dit kleine contract.

Gebruik de in Task 1 vastgelegde `EXTENSION_LIMITS`; voeg geen tweede limiettabel toe.

- [ ] **Step 3: Implementeer identity en padregels**

- `id`: exact `^[a-z0-9](?:[a-z0-9._-]{0,127})$`; niet trimmen/lowercasen.
- `main`: normaliseer niet; eis `/`-gescheiden relatief pad zonder leeg, `.`, `..`, NUL of
  backslashsegment.
- version/api/min-app: `^[0-9]+(?:\.[0-9]+){0,3}$`.

- [ ] **Step 4: Implementeer fresh beleid**

Fresh vereist alle bestaande verplichte velden. Permissions en category zijn gesloten unies.
Onbekende velden verdwijnen doordat een nieuw object wordt opgebouwd.

- [ ] **Step 5: Implementeer stored-legacy beleid**

Alleen deze defaults/normalisaties zijn toegestaan:

- ontbrekende `apiVersion` blijft afwezig;
- ontbrekende `minAppVersion` wordt `0.0.0` met warning;
- ontbrekende `permissions` wordt `[]` met warning;
- onbekende legacypermissions worden verwijderd met warning;
- ontbrekende `tags`, `repository`, `icon` blijven afwezig.

Ontbrekende identiteit, naam, versie, auteur, beschrijving, categorie of main blijft een harde fout.

- [ ] **Step 6: Voeg positieve en unknown-field-tegenproeven toe**

Bewijs:

- een volledig manifest round-tript naar een vers, niet-identiek object;
- mutatie van de bron na parse wijzigt de uitkomst niet;
- een onbekend genest/objectveld verschijnt niet in de uitkomst;
- duplicate permissions/tags worden deterministisch gededupliceerd zonder volgordedrift;
- fresh onbekende permission faalt, legacy stored waarschuwt en filtert.

- [ ] **Step 7: Draai gerichte test en typecheck**

```bash
bash tests/planning/run.sh
npm run typecheck
```

Verwacht: beide exit 0 voor alle nu geregistreerde manifestcases. Catalogus- en opslagcases worden
pas in hun eigen tasks toegevoegd; er staan geen skipped tests of toekomstige rode secties.

- [ ] **Step 8: Commit de manifestparser**

```bash
git add src/extensions/validation.ts tests/planning/check-extension-validation.ts
git add -p tests/planning/run.sh
git diff --cached -- tests/planning/run.sh
git diff --cached --name-only
git commit -m "feat(extensions): valideer manifestvelden aan de ingang"
```

Selecteer alleen de registratie van `check-extension-validation.ts`; de cached diff mag
`check-dependency-presentation.ts` niet bevatten.

---

## Task 3: Parse de catalogus per entry en houd fouten zichtbaar

**Files:**
- Modify: `src/extensions/validation.ts`
- Modify: `src/extensions/types.ts`
- Modify: `src/state/slices/extensionSlice.ts`
- Modify: `src/extensions/extensionService.ts`
- Modify: `src/state/documentContract.ts`
- Modify: `tests/planning/check-extension-validation.ts`

- [ ] **Step 1: Voeg catalogusfailures toe aan de test**

Cases:

- topniveau `null`, verkeerde version/lastUpdated/extensionsvorm => volledige fout;
- catalogus met geldig, ongeldig, geldig => twee entries plus één `CatalogIssue` op de echte index;
- entry met ongeldige downloadURL/category/tags/sha256 => alleen die entry overgeslagen;
- sha256 afwezig toegestaan; aanwezig moet exact 64 hextekens zijn;
- duplicate ids of dezelfde id met twee versies => latere entry als issue, geen onvoorspelbare kaart.

- [ ] **Step 2: Implementeer `parseCatalog`**

Gebruik `parseExtensionManifest` niet blind: een catalogusentry heeft geen `main`/permissions maar
wel `downloadUrl`/`sha256`. Deel alleen echte primitive helpers.

- [ ] **Step 3: Breid de store uit**

Voeg toe:

```ts
catalogIssues: CatalogIssue[];
setCatalog: (entries: CatalogEntry[], issues: CatalogIssue[], fetchedAt: number) => void;
```

Fresh state is `[]`. `setCatalogError` wist geldige oude catalogusdata niet automatisch; een
fetchfout mag de laatst bruikbare cache laten staan.

Classificeer `catalogIssues` in `documentContract.ts` expliciet als `AppGlobalKey`: cataloguskwaliteit
hoort bij de installatie, niet bij één geopend IFC-document. Laat de compile-time
`_assertNoUnclassifiedState` deze keuze bewaken.

- [ ] **Step 4: Verwijder de onveilige JSON-cast**

In `fetchCatalog`:

```ts
const parsed = parseCatalog(await res.json());
if (!parsed.ok) throw new Error(parsed.error);
store.setCatalog(parsed.value.catalog.extensions, parsed.value.issues, now);
```

Log issues samengevat; dump geen hele externe payload.

- [ ] **Step 5: Draai bestaande integriteitschecks mee**

```bash
bash tests/planning/run.sh
npm run typecheck
```

Verwacht: beide exit 0, inclusief bestaande checksumcases in `check-ext-integrity.ts` en de
top-level-stateclassificatie.

- [ ] **Step 6: Commit catalogusvalidatie**

```bash
git add src/extensions/validation.ts src/extensions/types.ts src/state/slices/extensionSlice.ts src/extensions/extensionService.ts src/state/documentContract.ts tests/planning/check-extension-validation.ts
git commit -m "feat(extensions): isoleer ongeldige catalogusentries"
```

---

## Task 4: Sluit JavaScript- en ZIP-ingangen vóór consent en opslag

**Files:**
- Modify: `src/extensions/extensionService.ts`
- Modify: `src/extensions/validation.ts`
- Modify: `src/utils/devBridge.ts`
- Modify: `tests/planning/check-extension-validation.ts`
- Modify: `tests/planning/check-ext-consent.ts`
- Modify: `tests/planning/check-ext-integrity.ts`

- [ ] **Step 1: Maak `@manifest`-extractie een getypeerd resultaat**

Exporteer puur:

```ts
export function manifestFromJavaScript(
  code: string,
  fileName: string,
): ParseResult<ExtensionManifest>;
```

Gedrag:

- marker ontbreekt => bestaand gegenereerd manifest, daarna fresh parser;
- marker aanwezig + ongeldige JSON => harde fout;
- marker aanwezig + geldige JSON maar ongeldig veld => harde fout;
- geen terugval op gegenereerde identiteit na een aangetroffen fout manifest.

Gebruik een afgebakend commentblok of brace-aware extractor; de huidige non-greedy regex mag niet de
eerste `}` als betrouwbare objectgrens behandelen.

- [ ] **Step 2: Schrijf ZIP-pad-/duplicaatcases**

Voeg fixtures toe met:

- `../main.js`, `/main.js`, `dir\\main.js`, NUL en dubbele genormaliseerde naam;
- twee `manifest.json`-bestanden;
- `main` dat alleen via `endsWith` een ander bestand matcht;
- asset >24 MiB en totaal >48 MiB;
- catalogus id- en versionmismatch.

- [ ] **Step 3: Valideer ZIP-entrynamen vóór selectie**

Laat `parseZipEntries` een fout geven op onveilige/duplicate namen. Selecteer daarna exact
`manifest.json` en exact het gevalideerde `manifest.main` binnen de reeds verwijderde ene topmap.
Gebruik geen vrije `endsWith(mainPath)`.

- [ ] **Step 4: Vervang `overrideId` door verwachte identiteit**

Productiesignatuur:

```ts
export interface ExpectedExtensionIdentity { id: string; version: string }
export async function installFromZipBlob(
  blob: Blob,
  expected?: ExpectedExtensionIdentity,
  opts?: InstallOptions,
): Promise<InstallOutcome>;
```

Bij `expected` moeten zowel id als versie exact overeenkomen vóór consent/deactivatie/opslag. Lokale
ZIP gebruikt geen `expected`. Pas de dev-bridge en tests aan; de dev-bridge omzeilt alleen consent,
niet validatie of identiteit.

- [ ] **Step 5: Behoud de bestaande consentvolgorde**

Parser, pad- en identitycontrole gebeuren vóór consent; alle schrijf-/deactiveeracties blijven ná
expliciete consent. Een decline laat vorige versie, DB en store exact ongemoeid.

- [ ] **Step 6: Draai validatie, consent en integrity**

```bash
bash tests/planning/run.sh
```

Verwacht: exit 0; bestaande SHA-, consent- en SVG-cases blijven groen.

- [ ] **Step 7: Commit de fresh ingangen**

```bash
git add src/extensions/extensionService.ts src/extensions/validation.ts src/utils/devBridge.ts tests/planning/check-extension-validation.ts tests/planning/check-ext-consent.ts tests/planning/check-ext-integrity.ts
git commit -m "fix(extensions): weiger ongeldige JS en ZIP voor installatie"
```

---

## Task 5: Lees IndexedDB per record inclusief echte opslagsleutel

**Files:**
- Modify: `src/extensions/extensionLoader.ts`
- Modify: `src/extensions/validation.ts`
- Modify: `src/extensions/types.ts`
- Modify: `src/utils/devBridge.ts`
- Modify: `tests/planning/check-extension-validation.ts`
- Create: `tests/browser/extensions-storage.spec.ts`

- [ ] **Step 1: Schrijf een echte IndexedDB-browserfixture**

Seed via `indexedDB.open('ops-extensions', 1)` in deze volgorde:

1. geldig legacyrecord zonder `permissions`/`minAppVersion`;
2. object met een geldige keyPath-`id`, maar een primitief manifest en ongeldige code/statusvelden;
3. record met een andere `manifest.id` dan zijn keyPath-`id`;
4. geldig modern record dat `enabled: true` draagt.

De test moet later bewijzen dat 1 en 4 ready zijn, 2 en 3 in quarantaine staan, en record 4 ondanks
de eerdere fouten bereikt wordt. Gebruik de echte bestaande objectstore met `keyPath: 'id'`; probeer
geen primitieve waarde of out-of-line key in die store te forceren, want IndexedDB weigert dat al met
`DataError` en zo'n fixture zou geen bereikbare appstaat bewijzen.

- [ ] **Step 2: Voeg `ReadyStoredExtension` toe**

```ts
export interface ReadyStoredExtension {
  id: string;
  manifest: ExtensionManifest;
  mainCode: string;
  enabled: boolean;
  assets?: Record<string, Uint8Array>;
  legacyWarnings: string[];
  storageKey: IDBValidKey;
}
```

`mainCode` is een begrensde niet-lege string, gemeten als UTF-8-bytes via `TextEncoder`. Gebruik voor
bestaande opslag exact 48 MiB: dat sluit
aan bij de maximale totale ZIP-payload uit Task 4 en voorkomt de onbewezen strengere 8-MiB-keuze.
Fresh ZIP-entries blijven aan hun afzonderlijke 24-MiB-grens gebonden. Test grens-1, grens en
grens+1; een bestaand groter record blijft zichtbaar/verwijderbaar in quarantaine met een concrete
reden in plaats van stil te verdwijnen.

- [ ] **Step 3: Lees met een cursor**

Vervang `getAllExtensionsFromDb()` door:

```ts
export interface RawStoredExtension {
  storageKey: IDBValidKey;
  value: unknown;
}
export async function getAllExtensionRecordsFromDb(): Promise<RawStoredExtension[]>;
```

Gebruik `openCursor()` en neem `cursor.primaryKey` exact over. Sluit/abort fouten netjes af.

- [ ] **Step 4: Implementeer stored parser**

Eisen:

- record object, veilige `mainCode`, boolean `enabled`;
- `storageKey === record.id === manifest.id`; geen stil herstel van identiteit;
- legacy manifestregels uit Task 2;
- assetnamen/bytes/limieten opnieuw controleren;
- onbekende recordvelden strippen;
- geen writeback.

- [ ] **Step 5: Maak verwijderen sleutelgebaseerd**

```ts
export async function removeExtensionFromDb(key: IDBValidKey): Promise<void>;
```

Ready verwijderen gebruikt zijn bekende stringkey; quarantaine gebruikt de exact bewaarde sleutel.

- [ ] **Step 6: Draai parser en browserstorage rood/groen**

Breid de dev-bridge uit met een read-only `extensions.scanStored()` die uitsluitend
`getAllExtensionRecordsFromDb()` plus `parseStoredExtension` aanroept en per record
`{ storageKey, ok, reason? }` teruggeeft. Hij registreert, activeert, verwijdert of herschrijft niets.
De browsercase roept deze echte appgrens aan en assert in Task 5 exact vier resultaten, behoud van
alle vier oorspronkelijke keys, ready voor records 1/4, parsefout voor 2/3 en nul `onLoad`-effecten.
Er is hier nog geen quarantine-UI-assertie en geen skipped toekomstige test; Task 6 breidt hetzelfde
specbestand pas uit met registratie, zichtbaarheid en verwijderen.

```bash
bash tests/planning/run.sh
npm run test:browser -- --grep "extension storage"
```

Verwacht na implementatie: beide exit 0.

- [ ] **Step 7: Commit veilige opslaglezing**

```bash
git add src/extensions/extensionLoader.ts src/extensions/validation.ts src/extensions/types.ts src/utils/devBridge.ts tests/planning/check-extension-validation.ts tests/browser/extensions-storage.spec.ts
git commit -m "feat(extensions): classificeer IndexedDB-records afzonderlijk"
```

---

## Task 6: Maak quarantaine zichtbaar maar niet activeerbaar

**Files:**
- Modify: `src/state/slices/extensionSlice.ts`
- Modify: `src/extensions/extensionLoader.ts`
- Modify: `src/extensions/extensionService.ts`
- Modify: `src/extensions/types.ts`
- Modify: `src/utils/devBridge.ts`
- Modify: `src/state/documentContract.ts`
- Modify: `src/components/backstage/ExtensionManagerPanel.tsx`
- Modify: `src/components/backstage/ExtensionManagerPanel.css`
- Modify: `src/i18n/locales/ar/menu.json`
- Modify: `src/i18n/locales/de/menu.json`
- Modify: `src/i18n/locales/en/menu.json`
- Modify: `src/i18n/locales/es/menu.json`
- Modify: `src/i18n/locales/fa/menu.json`
- Modify: `src/i18n/locales/fr/menu.json`
- Modify: `src/i18n/locales/it/menu.json`
- Modify: `src/i18n/locales/ja/menu.json`
- Modify: `src/i18n/locales/ko/menu.json`
- Modify: `src/i18n/locales/nl/menu.json`
- Modify: `src/i18n/locales/pl/menu.json`
- Modify: `src/i18n/locales/pt/menu.json`
- Modify: `src/i18n/locales/tr/menu.json`
- Modify: `src/i18n/locales/zh/menu.json`
- Modify: `tests/browser/extensions-storage.spec.ts`

- [ ] **Step 1: Splits statecollecties op typeniveau**

Voeg toe:

```ts
installedExtensions: Record<string, ReadyExtension>;
quarantinedExtensions: Record<string, QuarantinedExtension>;
registerReadyExtension(ext: ReadyExtension): void;
registerQuarantinedExtension(ext: QuarantinedExtension): void;
removeQuarantinedExtension(quarantineId: string): void;
```

Migreer in dezelfde task de vier actuele constructiepaden — twee in `extensionService.ts`, één in
`extensionLoader.ts` en één in `devBridge.ts` — naar objecten met `kind: 'ready'`. Wijzig de
sliceactie naar `registerReadyExtension`. Verwijder pas daarna het legacy-
`InstalledExtension`-interface en schrijf `ReadyExtension` uit met de concrete velden `kind`, `id`,
`manifest`, `status` en optioneel `error`; het mag niet langer een verwijderd interface extenden.
`ReadyExtension` blijft een harde discriminant, nooit `kind?`.

Voeg `quarantinedExtensions` in `documentContract.ts` aan `AppGlobalKey` toe. Quarantaine is
installatie-/opslagniveau en mag niet per document wisselen. De compile-time stateclassificatie moet
na deze task weer zonder ongeclassificeerde of stale key slagen.

- [ ] **Step 2: Classificeer per record in `loadAllExtensions`**

De buitenste `try` dekt alleen DB-open/cursorfalen. Binnen de loop heeft elk record een eigen
parse-/register-/enable-`try/catch`. Een parserfout maakt een `QuarantinedExtension` met een stabiele
`quarantineId` afgeleid van storagekeytype + keywaarde, zonder gevaarlijke key direct als
objectproperty te gebruiken.

Gebruik één pure `encodeIdbKey` met typeprefixen: lengtegecodeerde UTF-8 voor strings, canonieke
getaltekst voor numbers, ISO-tijd voor Date, hex voor `ArrayBuffer`/views en recursieve
lengtegecodeerde delen voor arrays. Encodeer dat resultaat naar hex achter prefix `q:`. Test dat
`'1'`, `1`, `new Date(1)`, een bytebuffer en samengestelde arrays verschillende stabiele ids geven.
Bewaar daarnaast altijd de oorspronkelijke `storageKey` voor de werkelijke delete; decodeer de id
niet terug naar een sleutel.

- [ ] **Step 3: Voeg een quarantinecard toe**

De kaart toont:

- veilige fallbacknaam;
- reden;
- label "Quarantaine";
- alleen "Verwijderen" met dezelfde tweeklikbevestiging als ready extensions;
- geen toggle, geen enable-handler en geen manifesticon uit het ongeldige record.

Voeg stabiele testids toe: `extension-quarantine-card` en `extension-quarantine-remove`.

- [ ] **Step 4: Toon catalogusissues zonder ongeldige kaarten**

Browse-tab toont boven de lijst een compacte, vertaalde waarschuwing met het aantal overgeslagen
entries. Details mogen naar `appLog`; externe rauwe JSON komt niet in de DOM.

- [ ] **Step 5: Voeg alle veertien vertalingen toe**

Minimaal de sleutels:

```text
extensions.quarantined
extensions.quarantineReason
extensions.quarantineRemove
extensions.quarantineEmptyName
extensions.catalogEntriesSkipped
extensions.storageWriteFailed
```

Gebruik de Nederlandse bronbetekenis consistent; laat `npm run verify:i18n` CLDR en sleuteldekking
bewaken.

- [ ] **Step 6: Bewijs de UI in de browser**

De storagebrowsercase opent Backstage > Extensies via echte UI, assert twee readykaarten en twee
quarantinekaarten, bevestigt afwezigheid van toggles, verwijdert één quarantainekaart en controleert
met IndexedDB dat exact de juiste key weg is.

- [ ] **Step 7: Draai typecheck, i18n en browser**

```bash
npm run typecheck
npm run verify:i18n
npm run test:browser -- --grep "extension storage"
```

Verwacht: alle drie exit 0.

- [ ] **Step 8: Commit quarantine-UI**

```bash
git add src/state/slices/extensionSlice.ts src/extensions/extensionLoader.ts src/extensions/extensionService.ts src/extensions/types.ts src/utils/devBridge.ts src/state/documentContract.ts src/components/backstage/ExtensionManagerPanel.tsx src/components/backstage/ExtensionManagerPanel.css src/i18n/locales/ar/menu.json src/i18n/locales/de/menu.json src/i18n/locales/en/menu.json src/i18n/locales/es/menu.json src/i18n/locales/fa/menu.json src/i18n/locales/fr/menu.json src/i18n/locales/it/menu.json src/i18n/locales/ja/menu.json src/i18n/locales/ko/menu.json src/i18n/locales/nl/menu.json src/i18n/locales/pl/menu.json src/i18n/locales/pt/menu.json src/i18n/locales/tr/menu.json src/i18n/locales/zh/menu.json tests/browser/extensions-storage.spec.ts
git commit -m "feat(extensions): toon corrupte opslag veilig in quarantaine"
```

---

## Task 7: Hercontroleer vlak vóór uitvoering en maak writefailure eerlijk

**Files:**
- Modify: `src/extensions/extensionLoader.ts`
- Modify: `src/extensions/extensionService.ts`
- Modify: `src/state/slices/extensionSlice.ts`
- Modify: `tests/browser/extensions-storage.spec.ts`
- Modify: `tests/planning/check-extension-validation.ts`

- [ ] **Step 1: Voeg een storage-tampering-case toe**

Laad een ready extensie als disabled, wijzig daarna het IndexedDB-record rechtstreeks naar een
ongeldige manifestvorm en klik de echte enabletoggle. Verwacht: geen `onLoad`-side-effect, record
verhuist naar quarantaine en de reden is zichtbaar.

- [ ] **Step 2: Parse opnieuw in `enableExtension`**

`enableExtension(id)`:

1. leest record plus key;
2. draait `parseStoredExtension`;
3. bij fout: verwijdert ready runtimekaart, registreert quarantaine, zet geen loadingstatus en voert
   geen code uit;
4. bij succes: voert bestaande app/API-versie-, permission- en `onLoad`-poorten uit.

- [ ] **Step 3: Houd writeback expliciet en niet-transactioneel**

Bij succesvolle enable/disable mag de genormaliseerde ready vorm worden opgeslagen. Als die write
faalt:

- een reeds enabled plugin blijft enabled;
- een reeds disabled plugin blijft disabled;
- de kaart krijgt een niet-blokkerende persistencyfout/melding;
- er wordt niet gelogen dat de volgende startup dezelfde status zal herstellen.

Maak de fout injecteerbaar in de test door DB-functies achter een klein `ExtensionStorage`-contract
te plaatsen; monkeypatch geen moduleglobals.

- [ ] **Step 4: Bewijs per-record loadisolatie inclusief onLoad-fout**

Een ready record waarvan `onLoad` gooit krijgt status `error`; het geldige record erna wordt nog
steeds geregistreerd/geactiveerd. Quarantaine en runtime-error blijven verschillende toestanden.

- [ ] **Step 5: Draai storage- en validatiesuites**

```bash
bash tests/planning/run.sh
npm run test:browser -- --grep "extension storage"
```

Verwacht: beide exit 0.

- [ ] **Step 6: Commit revalidatie en writefailure**

```bash
git add src/extensions/extensionLoader.ts src/extensions/extensionService.ts src/state/slices/extensionSlice.ts tests/browser/extensions-storage.spec.ts tests/planning/check-extension-validation.ts
git commit -m "fix(extensions): valideer opslag opnieuw voor code-uitvoering"
```

---

## Task 8: Bind documentmutaties uit extensies aan `AppStoreContext`

**Files:**
- Modify: `src/extensions/extensionApi.ts`
- Modify: `src/extensions/extensionLoader.ts`
- Modify: `src/extensions/sdk.ts`
- Modify: `src/extensions/types.ts`
- Modify: `tests/planning/check-ext-contract.ts`
- Modify: `tests/planning/check-store-factory.ts`

- [ ] **Step 1: Schrijf een twee-store extensietest**

Maak context A en B via `createAppStoreContext()`. Bouw een extension-API voor B, voer
`data.batch(() => addTask/addTask)` uit en assert:

- alleen B krijgt taken;
- alleen B krijgt één undo-stap;
- A blijft byte-inhoudelijk gelijk;
- `data.get*`, `loadProject` en `recalculate` lezen/werken op B;
- een afzonderlijke registratiecase bouwt dezelfde API met document B en host A en bewijst dat
  ribbonbuttons en importers alleen in A's hoststore landen en notificaties alleen A's geïnjecteerde
  host-sink aanroepen;
- het publieke factorycontract accepteert geen `BatchTransactions`; de batch voor B wordt intern
  uit B afgeleid, zodat een caller geen batch van A aan document B kan koppelen;
- eventbus, settingsprefix en PDF-fontregistry blijven app-global/per-extension zoals voorheen.

- [ ] **Step 2: Wijzig de factorysignatuur**

```ts
export interface ExtensionHostBinding {
  app: AppStoreContext;
  showNotification(
    extensionId: string,
    message: string,
    type: 'info' | 'warning' | 'error',
  ): void;
}

export function createExtensionApi(
  extensionId: string,
  permissions: ExtensionPermission[],
  assets: Record<string, Uint8Array> | undefined,
  document: AppStoreContext,
  host: ExtensionHostBinding,
): ExtensionApi;
```

Geen default in de corefactory en geen door callers leverbare batch. De factory maakt intern
`const batch = createBatchTransactions(document)`. Daarmee is een mismatch tussen document- en
batchcontext niet alleen getest maar onuitdrukbaar in het publieke contract.

Alleen een expliciete app-wrapper bindt voor productie `document` aan `appStoreContext` en levert
een `ExtensionHostBinding` waarvan `app` diezelfde context is en `showNotification` exact het
bestaande `appLog.emit`-gedrag bewaart: type `warning` wordt level `warn`, de overige typen blijven
`info`/`error`, source blijft `ext:${extensionId}` en message blijft ongewijzigd. Er wordt dus geen
nieuw toast- of i18n-contract geïntroduceerd.

`extensionLoader.ts` is die productie-composition root; het importeert `appLog` nu al en bouwt:

```ts
const appExtensionHost: ExtensionHostBinding = {
  app: appStoreContext,
  showNotification(extensionId, message, type) {
    const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
    appLog.emit(level, `ext:${extensionId}`, message);
  },
};
```

`extensionApi.ts` zelf importeert daarna geen `appLog`, `useAppStore`, `appStoreContext` of globale
`withTransaction` meer.

- [ ] **Step 3: Vervang alle documentreads en -mutaties**

`data.*` gebruikt uitsluitend `document.store`; `data.batch` gebruikt de intern uit precies die
documentcontext gemaakte batch. Importer-/ribbonregistratie en cleanup gebruiken `host.app.store`.
`ui.showNotification` roept uitsluitend `host.showNotification(extensionId, message, type)` aan;
de corefactory importeert `appLog` niet. PDF-fontregistry, eventbus en settings blijven
module-/installatieglobaal. Dit onderscheid voorkomt dat appchrome per ongeluk per documentcontext
verdwijnt terwijl documentmutaties wel correct op B landen, en maakt de bestaande logbus in tests
vervangbaar door een controleerbare host-sink.

- [ ] **Step 4: Laat loader/context de juiste API bouwen**

De app-loader krijgt expliciet de productie-documentcontext en productie-hostbinding; tests kunnen
B en een losse host-sink injecteren. Actieve pluginregistry blijft module- en appglobaal op
extensie-id, omdat pluginlifecycle bij `host` hoort. De
twee-store-datatest bouwt de API direct en activeert niet tweemaal dezelfde plugin-id; testcleanup
ruimt registries tussen cases expliciet op.

Voeg aan de contracttest een bron-/typegrens toe die de vijf parameters van `createExtensionApi`
vastlegt en controleer mechanisch dat `extensionApi.ts` geen van de vier bovengenoemde singleton- of
logimports bevat. De test hoeft geen opzettelijk niet-compilerende fixture in de productbuild te
plaatsen: het afwezige batchargument plus de interne factoryaanroep maken de mismatch al
constructief onmogelijk.

- [ ] **Step 5: Draai extensiecontract en storefactory**

```bash
bash tests/planning/run.sh
```

Verwacht: exit 0 en de oude vastpinning dat extensionbatch op de singleton landt is verwijderd.

- [ ] **Step 6: Commit contextbinding**

```bash
git add src/extensions/extensionApi.ts src/extensions/extensionLoader.ts src/extensions/sdk.ts src/extensions/types.ts tests/planning/check-ext-contract.ts tests/planning/check-store-factory.ts
git commit -m "refactor(extensions): bind documentdata aan een storecontext"
```

---

## Task 9: Documenteer quarantaine en de blijvende vertrouwensgrens

**Files:**
- Modify: `docs/extensions.md`
- Modify: `public/docs/nl/ref-extensies.md`
- Modify: `public/docs/en/ref-extensies.md`
- Modify: `docs/self-test-harness.md`

- [ ] **Step 1: Leg gebruikersgedrag feitelijk uit**

Documenteer:

- waarom een geïnstalleerde extensie in quarantaine kan verschijnen;
- dat hij dan niet wordt uitgevoerd en wel verwijderbaar blijft;
- hoe catalogusentries kunnen worden overgeslagen;
- dat legacy-normalisatie geen inhoud herschrijft bij startup;
- dat validatie geen sandbox is en consent nog steeds een vertrouwensbesluit vormt.

- [ ] **Step 2: Beschrijf ontwikkelaarscontract**

`docs/extensions.md` krijgt het veldbeleid, exacte identitymatch voor catalogus-ZIP en veilige
padregels. Verwijs naar `validation.ts` als uitvoerbare bron, niet naar een gekopieerde losse lijst
zonder codepointer.

- [ ] **Step 3: Werk self-testdocumentatie bij**

Leg de browserfixture voor echte IndexedDB-quarantaine uit. De dev-bridge mag consent omzeilen maar
nooit validatie.

- [ ] **Step 4: Draai documentpoorten**

```bash
npm run verify:docs
npm run verify:i18n
```

Verwacht: beide exit 0.

- [ ] **Step 5: Commit documentatie**

```bash
git add docs/extensions.md public/docs/nl/ref-extensies.md public/docs/en/ref-extensies.md docs/self-test-harness.md
git commit -m "docs(extensions): leg validatie en quarantaine uit"
```

---

## Task 10: Volledige Plan-1-verificatie en stopbesluit

**Files:** geen productwijzigingen; alleen bewijs verzamelen.

- [ ] **Step 1: Zoek resterende onveilige casts en ingangen**

```bash
rg -n "JSON\.parse\(.*\) as (ExtensionManifest|ExtensionCatalog|StoredExtension)|const .*: (ExtensionManifest|ExtensionCatalog) = (await .*\.json\(\)|JSON\.parse)" src/extensions
rg -n "endsWith\(mainPath\)|overrideId" src/extensions src/utils/devBridge.ts
```

Verwacht: beide commando's exit 1 zonder uitvoer.

- [ ] **Step 2: Bewijs dat quarantine niet kan activeren**

```bash
rg -n "enableExtension" src/components/backstage/ExtensionManagerPanel.tsx
npm run test:browser -- --grep "extension storage"
```

Inspecteer de enige enablecall: hij zit uitsluitend op de readycard. Browsercase exit 0.

- [ ] **Step 3: Draai alle bestaande en nieuwe extensiechecks**

```bash
bash tests/planning/run.sh
npm run test:browser -- --grep "extension"
npm run verify:i18n
npm run verify:docs
```

Verwacht: vier keer exit 0.

- [ ] **Step 4: Draai de werkelijke gate**

```bash
npm run verify
```

Verwacht: exit 0.

- [ ] **Step 5: Stop bij een contractlek**

Plan 2 mag niet verder wanneer een raw ingress een cast gebruikt, een kapot record latere records
blokkeert, catalogusidentiteit wordt overschreven, quarantaine kan togglen, of een storagewritefout
de runtimestatus terugdraait. Repareer binnen Plan 1.
