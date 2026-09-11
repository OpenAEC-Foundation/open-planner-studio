# Issue #27 — Etappe 3: het voortgangsblad als .xlsx (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De uitvoerder krijgt een blad waarin **meteen zichtbaar is wat hij moet doen en waar hij van
af moet blijven**: kolommen zo breed als hun inhoud, alleen de invulcellen bewerkbaar, een percentage
dat geweigerd wordt zodra het buiten 0–100 valt, en datums die als **datum** in de cel staan in plaats
van als tekst. Dat blad komt terug en wordt gelezen door dezelfde match/preview/apply-keten als de CSV
— **geen enkele wijziging aan `matchRows.ts`, `buildPlan.ts`, de store-acties of de dialoogflow**,
precies zoals *A9* van etappe 2 belooft.

Etappe 2 (`docs/superpowers/plans/2026-09-01-plan-issue27-voortgangsimport.md`, PR #102) staat op
`t3code/oplossen-issue-27` en is de bouwsteen waar dit plan op leunt. **Die PR moet eerst gemerged
zijn**; deze etappe is een eigen PR bovenop `main`.

---

## Eigenaarsbesluiten 2026-09-11 (niet heropenen)

| # | besluit | waar het in dit plan landt |
|---|---|---|
| **E9** | Letterlijke wens: *"de kolommen in de csv moeten net zo breed zijn als de tekst die erin staat"*. Dat kán niet in CSV — een CSV heeft geen kolombreedte, geen opmaak en geen celtype. Gekozen: een **.xlsx-voortgangsblad zonder externe bibliotheek**, met (a) kolombreedtes op maat, (b) vergrendelde kolommen zodat alleen de invulcellen open staan, (c) invoervalidatie — percentage 0–100 met decimalen toegestaan, datumkolommen als datum, (d) **echte datumcellen**, zodat terugimport nooit de dag/maand-vraag stelt, (e) de invulinstructies in de kopcel zoals nu (E8), (f) de verzameltaak-markering met dezelfde em-dash (fix 1 van de gebruikstest), en (g) **terugimport van .xlsx** via een nieuwe lezer die dezelfde `ProgressSheet` oplevert. | het hele plan; *X1*–*X12* |

**Wat E9 NIET zegt, en wat dit plan daarom zelf beslist** — zie *X10* (de knop levert voortaan .xlsx;
CSV blijft leesbaar en blijft als kaart in Backstage → Exporteren staan) en de vragen Q1–Q6 onderaan.

Eerdere bindende besluiten die **onverkort** overeind blijven: de preview is verplicht (E3/A8),
weigeringen zijn nooit stil, matching is intern id primair met WBS als terugval, percentages zijn
altijd percentages (E6), datums worden nooit geraden (E5), en meldingen blijven in-app (A7).

---

**Architecture:** Vier lagen, van onder naar boven. Alleen de bovenste twee weten wat een
voortgangsblad is.

1. **`src/services/zip/` (nieuw, puur).** `zipReader.ts` (de bestaande extensie-ZIP-lezer, gelift uit
   `src/extensions/extensionService.ts`, met injecteerbare limieten en een dichtgetimmerd zip-bom-gat)
   en `zipWriter.ts` + `crc32.ts` (nieuw). Geen store, geen React, geen `@tauri-apps/*`.
2. **`src/services/xlsx/` (nieuw, puur).** `xmlText.ts` (escaper/unescaper incl. stuurtekens),
   `serialDate.ts` (ISO ↔ Excel-serieel), `writeProgressXlsx.ts` (de partsbouwer + de schrijver) en
   `readXlsxSheet.ts` (de generieke celraster-lezer met eigen XML-scanner).
3. **`src/services/progressImport/` (bestaand, puur).** Krijgt er precies twee dingen bij:
   `sheetColumns.ts` (de kolomherkenning, **gelift** uit `parseProgressCsv.ts` zodat beide lezers
   dezelfde koppen begrijpen) en `parseProgressXlsx.ts` (de tweede formaat-bewuste lezer).
   `sheetValues.ts`, `matchRows.ts`, `buildPlan.ts` blijven **onaangeraakt**.
4. **Bedrading.** `fileAccess` krijgt `saveBytesDialog`, `fileSlice.exportAs` verbreedt naar
   `string | Uint8Array`, `formatRegistry` krijgt het exportformaat `progress-xlsx`, de ribbonknop
   wijst daarheen, en `ProgressImportDialog` accepteert beide extensies.

**Tech Stack:** TypeScript strict, **geen nieuwe dependencies** (zie *X1*). Tests als
`check-*.ts`-batterijen onder `tests/planning/` (geregistreerd in `tests/planning/run.sh`) plus
uitbreiding van `tests/browser/progress-import.spec.ts`. De poort is `npm run verify` — oordeel
**UITSLUITEND op de exitcode**. Machinebreed draait er maximaal **één** `verify` tegelijk.

---

## Scope

**In dit plan (etappe 3):**

- Een ZIP-**lezer** als eigen service met injecteerbare limieten, plus de zip-bom-fix en een expliciete
  Zip64-weigering. `extensionService` wordt afnemer; zijn gedrag blijft gelijk.
- Een ZIP-**schrijver** (store-only als bodem, deflate wanneer `CompressionStream` bestaat) met een
  eigen CRC-32.
- Een `.xlsx`-**schrijver** voor precies één blad: kolombreedtes, bevroren kopregel, vergrendeling,
  invoervalidatie, echte datum- en getalcellen, instructies in de kopcel, em-dash-markering op
  verzameltaken.
- Een `.xlsx`-**lezer** die hetzelfde `ProgressSheet` oplevert als `parseProgressCsv`, inclusief
  `sharedStrings`, stijl-gestuurde datum- en percentageherkenning en dezelfde harde grenzen.
- De bedrading: `saveBytesDialog`, `exportAs` met bytes, exportformaat + ribbonknop, dialoogfilter,
  i18n (14 locales), gids `nl` + `en`.

**NIET in dit plan:**

| onderwerp | reden |
|---|---|
| Een `comments`-part (celnotities) | E9 zegt expliciet: instructies in de **kopcel**, zoals nu. Een comments-part is een tweede partsoort met een eigen `vmlDrawing`-afhankelijkheid — veel oppervlak voor nul extra informatie. De `dataValidation`-prompt (*X5*) geeft dezelfde hint zonder extra parts. |
| `sharedStrings` **schrijven** | Onze bladen hebben weinig herhaalde tekst; `t="inlineStr"` is één part minder en één indirectie minder. **Let op: de lezer MOET `sharedStrings` wél aankunnen** — Excel herschrijft het bestand bij opslaan en gebruikt dan vrijwel altijd wél een `sharedStrings`-part. Scope-uit geldt uitsluitend voor de schrijfkant. |
| Zip64 | Onze bladen zijn kilobytes. De lezer **weigert** een Zip64-bestand expliciet (vandaag zou hij het stil verkeerd lezen — zie *X2*), de schrijver gooit boven de 32-bits grenzen. |
| `.xlsx` in `READ_FORMATS` / `loadState` / documentimport | Dit is géén documentimport, net zomin als de CSV-voortgangsimport dat was. Een `.xlsx` openen via Ctrl+O blijft onmogelijk. |
| Formules, meerdere bladen, tabellen, voorwaardelijke opmaak, thema's, `docProps` | Excel opent een werkmap zonder die parts probleemloos. Elk extra part is oppervlak zonder gebruikerswaarde. |
| Wachtwoordbeveiliging op het blad | Beveiliging zonder wachtwoord is precies wat hier bedoeld is: een **hekje tegen per ongeluk**, geen slot. Zie *X5*. |
| Wijzigingen aan `matchRows.ts`, `buildPlan.ts`, `sheetValues.ts`, de store-acties, de dialoogflow | *A9*. Als een van deze bestanden in je diff staat, is de naad kapot. |
| `.xlsx` **schrijven** van iets anders dan het voortgangsblad (rapport-export, volle takenlijst) | Niet gevraagd. De onderlagen (`zip/`, `xlsx/`) zijn er wel algemeen genoeg voor; dat is een vervolg, geen belofte. |

---

## Context voor wie hier koud instapt

Alles hieronder is **geverifieerd tegen de code op 2026-09-11** (worktree `t3code-8ed9f377`, branch
`t3code/issue-27-xlsx`, afgetakt van `t3code/oplossen-issue-27` op `1076a1f3`). Regelnummers zijn
indicatief; de ankers zijn functie-in-bestand.

### Er is al een ZIP-lezer, en hij staat op de verkeerde plek

`src/extensions/extensionService.ts` (r395–620) bevat een complete, zorgvuldige ZIP-lezer:
`parseZipEntries(buffer)` leest primair via de **central directory** en valt terug op een lineaire
local-header-scan, `inflateRaw` gebruikt de browser-native `DecompressionStream('deflate-raw')`,
`assertSafeZipEntryName` weert `..`/absolute paden/backslashes/NUL, `normalizeZipEntries` strijkt één
gedeelde topmap weg en weigert dubbele namen, en `addZipPayloadSize` bewaakt
`MAX_ZIP_ENTRY_BYTES = 24 MiB` / `MAX_ZIP_TOTAL_BYTES = 48 MiB`. Er is een testbatterij
(`tests/planning/check-ext-integrity.ts`, met een eigen store-only ZIP-fixturebouwer op r48).

Drie dingen kloppen er niet voor hergebruik (alle drie BEVESTIGD):

1. **Laagschending.** `extensionService.ts` importeert `useAppStore` (r17), `appLog` en `consent`. Een
   `.xlsx`-lezer die `parseZipEntries` daar vandaan haalt, trekt de hele store in de xlsx-chunk.
2. **Het zip-bom-gat.** In beide parseroutes staat de volgorde `const data = await
   decompressEntry(...)` **vóór** `actualTotal = addZipPayloadSize(actualTotal, data.length, name)`.
   De limiet wordt dus pas getoetst nadat de volledige uitpakking al in het geheugen staat; één entry
   van 40 KB die naar 4 GB inflateert zet de tab om zeep vóórdat de weigering afgaat. `inflateRaw`
   zelf accumuleert ongelimiteerd in `chunks`.
3. **Zip64 wordt stil verkeerd gelezen.** Alle maten komen uit `getUint32`; een Zip64-archief draagt
   daar `0xffffffff` als sentinel en de echte maat in een extra-veld. Dat leest vandaag als "4 GiB",
   wat verderop op een onbegrijpelijke fout stukloopt in plaats van op een duidelijke weigering.

Er is **geen** ZIP-schrijver en **geen** CRC-32 in `src/` (BEVESTIGD: `grep -rn "crc32" src/` is leeg).
`CompressionStream` komt in `src/` nergens voor.

### Wat de CSV-kant vandaag doet (en wat de xlsx-kant moet spiegelen)

- `writeProgressSheetCSV(tasks, headerNotes?, summaryNote?)` (`src/services/csv/csvWriter.ts` r174–207)
  schrijft acht kolommen: `OPS Task ID, WBS, Name, Start, Finish, Completion (%), Actual Start,
  Actual Finish`. `headerNotes` hangt ` — <instructie>` achter de sleutel (E8). Bij een verzameltaak
  (`task.childIds.length > 0`) krijgen de **drie invulcellen** `summaryNote` in plaats van een waarde.
  `Completion (%)` gaat door `formatCompletionPercent` (hele procenten — besluit A1).
- De teksten komen uit `src/i18n/progressHeaderNotes.ts`: `buildProgressHeaderNotes(t)` en
  `buildProgressSummaryNote(t)`, gevoed met `menu:export.progressCsvNotes.*`. De schrijver blijft puur;
  de aanroeper (`fileSlice.exportAs`, achter een **dynamic import** van `@/i18n/config` — zie het
  uitgebreide commentaar op r384 e.v., dat is geen stijlkeuze maar een testbaarheidseis) levert de
  vertaalde strings aan. **Diezelfde helpers hergebruikt de xlsx-schrijver ongewijzigd.**
- `buildProgressSummaryNote` levert een tekst die **met een em-dash (U+2014) begint**; `sheetValues.ts`
  r282–290 telt zo'n cel als **afwezig**, zodat een ongewijzigd teruggestuurd blad nul weigeringen
  oplevert. Die regel is formaat-agnostisch en werkt dus meteen voor xlsx.
- `parseProgressCsv.ts` r155–171 (`matchColumnKey`) matcht eerst op een exacte alias en daarna op het
  prefix vóór de instructiemarker (` — `, ` - `, `(`). r182–198 (`boundedCell`, `hasControlChar`)
  begrenzen elke cel; overschrijding is een **weigering**, nooit een afkapping.

### De bestandslaag

- `openFileDialog(filters, opts)` (`src/services/fileAccess/index.ts` r65) kent al
  `opts.binaryExtensions` en levert `OpenedFile.bytes` — zowel de Tauri-route (`tauriBackend.ts` r11–17,
  `readFile`) als beide web-routes (FSA op `webBackend.ts` r145–148, `<input type=file>` op r113–116).
  **Er hoeft dus niets aan de open-kant bij.**
- `saveFileDialog(defaultName, content: string, filters, opts?)` is **tekst-only**: de Tauri-backend
  doet `writeTextFile` (r42), de web-backend `writable.write(content)` (r183) of `downloadBlob(name,
  content: string)` (r125–133, hardcoded `new Blob([content])` met `application/octet-stream`).
  Bytes wegschrijven kan vandaag dus **alleen** in `ReportPanel.tsx` r760–779 (`writePdf`), dat de
  hele `isTauri()`-splitsing met de hand herhaalt inclusief `ensureExtension`. Dat is exact de
  duplicatie die `fileAccess` hoort op te heffen — zie *X8*.
- `fileSlice.exportAs(format)` (r384–482) is één `switch` die `content: string` zet, daarna
  `saveFileDialog(defaultName, content, filters, opts)`. Vóór de switch staat de **K7-cyclusguard**
  (stale ⇒ `runCPM`, daarna `cpmResult.error` ⇒ `{ ok: false }`), die ongewijzigd moet blijven staan
  en vóór de eerste `await`.
- `formatRegistry.ts`: `READ_FORMATS` (ifc/csv/xml/mpp, met `mpp` als precedent voor een **binair**
  formaat achter een **dynamic import**) en `EXPORT_FORMATS` (vijf entries, `progress-csv` bovenaan).
  `ExportFormat` is een string-union.
- `ProgressImportDialog.pick()` (r157–180) roept vandaag `openFileDialog([{ name: 'CSV', extensions:
  ['csv'] }])` aan en geeft `res.content` rechtstreeks aan `parseProgressCsv`. De hele `pick` staat al
  in een `try/catch` die naar `fileIssue: 'unreadable'` valt.

### De testomgeving

- `tests/planning/run.sh` bundelt elke check met esbuild (`--alias:@=src`, `--platform=node`,
  `--format=esm`) en draait hem in Node; registratie is één `bundle_check`+`node`-regel (r852/r855 voor
  de twee bestaande voortgangschecks). **De suite print "alles groen" ook bij exit 1** — oordeel op de
  exitcode.
- Node 22 heeft `CompressionStream`/`DecompressionStream` globaal, dus zowel de deflate- als de
  store-tak is headless testbaar. `DOMParser` bestaat er **niet**; `tests/planning/xmldom-shim.ts` is
  een minimale vervanger die **geen attributen** kent (geverifieerd: geen `getAttribute` in dat
  bestand). Een xlsx-lezer op `DOMParser` zou in de tests dus alle `r=`/`t=`/`s=`-attributen kwijt zijn.
  **Daarom een eigen XML-scanner** (*X7*) — dat is geen smaak, het is de enige werkende route.
- `tests/browser/progress-import.spec.ts` bewijst beide kanten al met échte handelingen: een download
  opvangen (`page.waitForEvent('download')` + `createReadStream`, r346–352) en een bestand aanbieden
  (`page.waitForEvent('filechooser')` + `chooser.setFiles({ name, mimeType, buffer })`, r55–63). Beide
  patronen werken in deze headless shell; de xlsx-case hoeft niets nieuws uit te vinden.

---

## Architectuurbesluiten

### X1 — Geen bibliotheek; eigen implementatie achter een dynamic import

Overwogen en **afgewezen**: ExcelJS (≈1 MB in de bundel, sleept `stream`/`buffer`-polyfills mee, doet
honderd dingen die wij niet willen) en SheetJS (`xlsx` op npm is de verlaten community-build; de
onderhouden versie komt van een eigen CDN — een dependency buiten het npm-audit-pad, dus buiten
`verify:audit`). Beide zijn bovendien volledige OOXML-implementaties waar wij één blad met acht
kolommen willen.

Gekozen: **eigen code**, zoals `src/services/mpp/` dat voor het MPP-formaat al doet. De schrijver is
~250 regels, de lezer ~300, de zip-laag ~250. Alles achter een **dynamic import** (`await
import('@/services/xlsx/...')`), precies zoals `READ_FORMATS` dat voor `readMPP` doet, zodat de
hoofdbundel er niets van merkt.

Het risico van eigen code is **niet** "krijgen we het werkend", maar "opent Excel het ook echt".
Daarom staan in *X4*/*X5* de kindvolgordes en de verplichte minima expliciet, en is er een handmatige
LibreOffice-controle in *Tests & poorten*.

### X2 — De ZIP-lezer verhuist naar `src/services/zip/zipReader.ts`, met injecteerbare limieten

**Verplaatsen, niet kopiëren.** `extensionService.ts` verliest r395–620 en importeert voortaan uit
`@/services/zip/zipReader`. De extensie-limieten worden een **geëxporteerde constante** in plaats van
module-locale getallen:

```ts
// src/services/zip/zipReader.ts
export interface ZipEntry { name: string; data: Uint8Array }
export class ZipValidationError extends Error { readonly bytesSeen?: number }

export interface ZipReadLimits {
  /** Per entry, ná uitpakken. */              maxEntryBytes: number;
  /** Som over alle entries, ná uitpakken. */  maxTotalBytes: number;
  /** Aantal entries dat we überhaupt bekijken. */ maxEntries: number;
  /** Uitgepakt ÷ ingepakt per entry — goedkope vroege uitstap. */ maxRatio: number;
}
export const EXTENSION_ZIP_LIMITS: ZipReadLimits =
  { maxEntryBytes: 24 * 1024 * 1024, maxTotalBytes: 48 * 1024 * 1024, maxEntries: 2048, maxRatio: 200 };

/** `select` bepaalt WELKE entries worden uitgepakt; de rest wordt overgeslagen zonder te inflaten
 *  (hardening + snelheid). Ontbreekt hij, dan worden alle entries uitgepakt — het bestaande gedrag. */
export function parseZipEntries(
  buffer: ArrayBuffer,
  limits?: ZipReadLimits,
  select?: (name: string) => boolean,
): Promise<ZipEntry[]>;
```

**De zip-bom-fix is een budget, geen nacontrole.** `inflateRaw` krijgt een `budget` en telt **per
chunk** op; zodra de som het budget passeert, wordt de reader gecancelled en vliegt er een
`ZipValidationError` met `bytesSeen` erop. Het budget per entry is
`min(maxEntryBytes, maxTotalBytes − reedsUitgepakt, compSize × maxRatio)`. De absolute grenzen zijn de
dragende garantie; `maxRatio` is de goedkope vroege uitstap. `bytesSeen` op de fout bestaat **om de
test mutatie-bewijsbaar te maken**: verplaats de toets naar ná de lus en `bytesSeen` springt van
"budget + één chunk" naar de volle payload.

**Zip64 wordt geweigerd, niet geraden.** Staat in de EOCD `totalEntries === 0xffff` of
`cdOffset === 0xffffffff`, of draagt een entry `compSize`/`uncompressedSize === 0xffffffff`, dan
`ZipValidationError('Zip64 wordt niet ondersteund')`. Vandaag leest zo'n bestand stil verkeerd.

**Gedragsbehoud voor extensies is een poort, geen belofte.** `check-ext-integrity.ts` en
`check-ext-consent.ts` draaien ongewijzigd; `check-ext-consent.ts` r177 grept op de **string**
`'parseZipEntries'` in de gebundelde extensie-code, dus de naam mag niet veranderen.

### X3 — De ZIP-schrijver: store als bodem, deflate als bonus, CRC-32 altijd

```ts
// src/services/zip/crc32.ts
export function crc32(data: Uint8Array): number;      // IEEE 802.3, unsigned

// src/services/zip/zipWriter.ts
export interface ZipFileInput { name: string; data: Uint8Array }
/** `deflate` is injecteerbaar zodat beide takken (deflate én store) getest kunnen worden zonder de
 *  omgeving te vervalsen; ontbreekt hij, dan kiest de schrijver `CompressionStream` als die bestaat. */
export function writeZip(
  files: readonly ZipFileInput[],
  opts?: { deflate?: ((data: Uint8Array) => Promise<Uint8Array>) | null },
): Promise<Uint8Array>;
```

- **Store-only is de bodem, niet de uitzondering.** Een ZIP met methode 0 is volledig geldig; Excel en
  LibreOffice openen hem zonder morren. Deflate scheelt alleen bestandsgrootte. Is
  `CompressionStream('deflate-raw')` er niet (oudere WebKitGTK-webviews zijn de reële twijfel — zie
  *Tests & poorten* voor de meting), dan blijft het blad gewoon werken, alleen wat groter. Een
  entry waarvan de deflate-uitkomst niet kleiner is dan de bron wordt **als store** opgeslagen.
- **CRC-32 altijd over de ONGECOMPRIMEERDE data.** Een fout CRC is precies het soort bug dat je pas bij
  de gebruiker ziet ("Excel wil het bestand herstellen"), dus de test pint drie bekende vectoren:
  `crc32('') === 0x00000000`, `crc32('123456789') === 0xCBF43926`,
  `crc32('The quick brown fox jumps over the lazy dog') === 0x414FA339`.
- **Geen data descriptor.** We kennen alle maten vóór het schrijven, dus vlag 0x08 blijft uit — dat
  scheelt de lezer de hele descriptor-scanroute.
- **Deterministische uitvoer.** Vaste DOS-datum/tijd (1980-01-01 00:00, de DOS-epoch), geen klok en
  geen locale. Twee exports van hetzelfde project geven dus byte-identieke bestanden; dat is wat een
  structurele test überhaupt assertabel maakt, en de wijzigingsdatum van een gegenereerd blad zegt
  toch niets (het bestandssysteem draagt die al).
- **ASCII-namen verplicht.** Al onze partnamen zijn ASCII; een niet-ASCII naam gooit in plaats van
  stilzwijgend in een onduidelijke codepage te belanden. Daarmee is de UTF-8-vlag (bit 11) een
  non-issue.
- **32-bits grenzen zijn een weigering.** > 65535 entries, een entry ≥ 4 GiB of een totaal ≥ 4 GiB
  gooit — geen stille Zip64-improvisatie.
- **Volgorde:** `[Content_Types].xml` als **eerste** entry. Dat is geen spec-eis maar wel wat elke
  echte OOXML-schrijver doet, en sommige strikte consumers leunen erop.

### X4 — De parts, en de kindvolgordes die Excel stilzwijgend afdwingt

Zes parts, geen zevende:

| part | inhoud |
|---|---|
| `[Content_Types].xml` | `Default` voor `rels` + `xml`, `Override` voor workbook, sheet1 en styles |
| `_rels/.rels` | `rId1` → `xl/workbook.xml` (officeDocument) |
| `xl/workbook.xml` | één `<sheet name="…" sheetId="1" r:id="rId1"/>` |
| `xl/_rels/workbook.xml.rels` | `rId1` → `worksheets/sheet1.xml` (worksheet), `rId2` → `styles.xml` (styles) |
| `xl/worksheets/sheet1.xml` | het blad |
| `xl/styles.xml` | de stijlen |

**OOXML-schema's zijn `xsd:sequence`, geen `xsd:all`.** Een element op de verkeerde plek geeft geen
nette foutmelding maar "Excel heeft onleesbare inhoud gevonden". De twee volgordes die wij raken, in
de volgorde waarin wij ze schrijven:

- **`CT_Worksheet`:** `dimension`, `sheetViews`, `sheetFormatPr`, `cols`, `sheetData`,
  **`sheetProtection`**, … , **`dataValidations`**, … (`sheetProtection` staat dus **vóór**
  `dataValidations`, en beide **ná** `sheetData`).
- **`CT_Stylesheet`:** `numFmts`, `fonts`, `fills`, `borders`, `cellStyleXfs`, `cellXfs`, `cellStyles`,
  `dxfs`, `tableStyles`.

Verplichte minima die Excel niet uitlegt maar wel eist: **≥ 1 `font`**, **≥ 2 `fills` waarvan de eerste
`none` en de tweede `gray125`** (een historische quirk — laat je er één weg, dan schuiven alle
fill-indexen op en kleurt het blad verkeerd), **≥ 1 `border`**, **≥ 1 `cellStyleXfs`**, en elk
`count`-attribuut moet kloppen met het werkelijke aantal kinderen.

Verder: `r`-attributen op rijen en cellen zijn **oplopend** en een cel-`r` (`"F2"`) moet in zijn eigen
rij staan; elke `<t>` krijgt `xml:space="preserve"`; de `r:`-namespace wordt in `workbook.xml`
gedeclareerd.

**De escaper is nieuw, en dat is geen NIH.** `escapeXML` in `mspdiWriter.ts` (r49) en `p6xmlWriter.ts`
(r57) vervangt vijf entiteiten en **laat stuurtekens staan** (BEVESTIGD). Een taaknaam met een
stuurteken erin — niet hypothetisch: die komt uit een geïmporteerd `.mpp`-bestand — maakt het blad
onleesbaar. `src/services/xlsx/xmlText.ts`:

```ts
/** XML 1.0 laat alleen \t \n \r en >= 0x20 toe. SpreadsheetML codeert de rest als `_xHHHH_`. */
export function escapeXmlText(s: string): string;
export function escapeXmlAttr(s: string): string;   // idem + " en '
export function unescapeXml(s: string): string;     // entiteiten + numerieke refs + _xHHHH_
```

**De valstrik waar dit op stukgaat als je hem mist:** een tekst die zélf `_x0041_` bevat, moet als
`_x005F_x0041_` het bestand in — anders leest hij terug als `A`. Dat is precies het soort bug dat een
round-trip-test vangt en een oogtest niet.

### X5 — Breedte, vergrendeling en validatie: wat E9 letterlijk vraagt

**Kolombreedte.** `<col min="n" max="n" width="w" customWidth="1" style="s"/>`. De breedte-eenheid is
"aantal `0`-tekens in het standaardlettertype", dus `w ≈ maxTekenlengte × 1.05 + 2`, geklemd op
`[10, 46]`.

> **De instructietekst telt NIET mee in de breedte.** Zou hij dat wel doen, dan werd elke kolom 70+
> tekens breed en zag de invuller nog vier kolommen op zijn scherm — het tegenovergestelde van wat E9
> vraagt. De breedte volgt de **data plus de kale kolomsleutel**; de kopcel krijgt
> `wrapText` en de kopregel een vaste hoogte (`<row r="1" ht="46" customHeight="1">`), zodat de
> instructie zichtbaar blijft zonder de kolom op te blazen.

**Vergrendeling.** `<sheetProtection sheet="1" selectLockedCells="0" selectUnlockedCells="0"
formatColumns="0" formatRows="0"/>` plus per-cel/per-kolom `<protection locked="0"/>` op de drie
invulkolommen.

> **Let op de polariteit: in `sheetProtection` betekent `true`/`1` dat de handeling VERBODEN is.**
> `selectLockedCells="0"` betekent dus "selecteren van vergrendelde cellen mág" (nodig om te kunnen
> lezen en kopiëren), en `formatColumns="0"` betekent "kolombreedte aanpassen mág". Een omgedraaide
> boolean levert hier een product op dat precies het omgekeerde doet van wat de eigenaar vroeg,
> **zonder dat er iets stukgaat** — daarom is dit de enige plek in dit plan met een verplichte
> handmatige controle in een echte spreadsheet (zie *Tests & poorten*).

**Geen wachtwoord.** Een `<sheetProtection password="…">` is triviaal te omzeilen, en een uitvoerder
die een cel écht moet corrigeren zou vastlopen. Dit is een hekje tegen per ongeluk, geen slot:
Controleren → Bladbeveiliging opheffen werkt en is toegestaan.

**Invoervalidatie.** Twee `dataValidation`-blokken, `sqref` begrensd tot de werkelijke laatste rij (géén
open `F2:F1048576`):

```xml
<dataValidations count="2">
  <dataValidation type="decimal" operator="between" allowBlank="1" showInputMessage="1"
                  showErrorMessage="1" errorStyle="stop" errorTitle="…" error="…"
                  promptTitle="…" prompt="…" sqref="F2:F42">
    <formula1>0</formula1><formula2>100</formula2></dataValidation>
  <dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1"
                  showErrorMessage="1" errorStyle="stop" errorTitle="…" error="…"
                  promptTitle="…" prompt="…" sqref="G2:H42">
    <formula1>1</formula1><formula2>2958465</formula2></dataValidation>
</dataValidations>
```

`allowBlank="1"` is bindend: leeg betekent "geen wijziging" (Q1 van etappe 2), dus een lege cel mag
nooit een foutmelding geven. De `prompt`-teksten hergebruiken **dezelfde** `progressCsvNotes.*`-strings
als de kopcel — nul extra i18n-sleutels voor de hint, alleen de foutteksten zijn nieuw (*X12*).

**Tien stijlen, bewust geteld.** `cellXfs`: `0` = standaard, `1` = kop (vet, `wrapText`, vergrendeld),
`2` = alleen-lezen tekst, `3` = alleen-lezen datum, `4` = alleen-lezen datumtijd, `5` = invul-tekst
(ontgrendeld), `6` = invul-percentage (ontgrendeld, `numFmt 0.####`), `7` = invul-datum (ontgrendeld,
`numFmt 164 = yyyy-mm-dd`), `8` = invul-datumtijd (ontgrendeld, `numFmt 165 = yyyy-mm-dd hh:mm`),
`9` = verzamelrij-markering (vergrendeld, grijze fill).

**Waarom ISO als datumweergave** en niet de locale-notatie: dezelfde reden als *A5.5* — een blad dat
`03-04-2026` toont, is voor de invuller niet te onderscheiden van 4 maart. `yyyy-mm-dd` is
ondubbelzinnig in alle veertien talen.

**Waarom óók een kolomstijl én een celstijl.** `<col style="7">` zorgt dat de kolom ónder de laatste
rij óók ontgrendeld en als datum opgemaakt is (anders kan de invuller geen rij eronder gebruiken, en
erger: een lege invulcel zonder eigen `<c>` erft de kolomstijl). De per-cel stijl is desondanks nodig,
want een **verzameltaakrij** moet binnen een ontgrendelde kolom juist vergrendeld zijn.

**Bevroren kopregel.** `<sheetView ...><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft"
state="frozen"/><selection pane="bottomLeft" .../></sheetView>` — `pane` vóór `selection`
(`CT_SheetView` is ook een sequence).

### X6 — Datums zijn datumcellen; getallen zijn getallen

`src/services/xlsx/serialDate.ts`:

```ts
export function isoToSerial(iso: string, epoch1904?: boolean): number | undefined;
export function serialToIso(serial: number, epoch1904?: boolean): string | undefined;
/** Onder 61 ligt het 1900-schrikkeljaargat; daar lezen we NIET (zie hieronder). */
export const MIN_READABLE_SERIAL_1900 = 61;
```

- **1900-systeem (de standaard):** serie 1 = 1900-01-01, maar Excel gelooft dat 1900 een schrikkeljaar
  was, dus serie 60 is de niet-bestaande 1900-02-29 en vanaf serie 61 geldt eenvoudig
  `1899-12-30 + n dagen`. Onze schrijver produceert altijd ≥ 61 (1900-03-01 = 61).
- **De lezer weigert `serial < 61`** als datum. Motivering: in een voortgangsblad is een getal onder de
  61 in een datumkolom vrijwel altijd een percentage of een dagnummer dat iemand in de verkeerde kolom
  typte — en in het gat zelf is er geen juiste lezing. Weigeren betekent `unreadableDate`, dus de rij
  wordt zichtbaar geweigerd in de preview; stil "1900-02-28" invullen zou precies de stille verkeerde
  datum zijn die E5 verbiedt.
- **1904-systeem:** `<workbookPr date1904="1"/>` (Mac-Excel-erfgoed) schuift de basis naar
  1904-01-01 = 0. Wij schrijven het nooit, maar we **lezen** de vlag; negeren zou een bestand vier jaar
  en een dag verschuiven zonder enig signaal.
- **Fractie = tijd.** `serial % 1` × 86400 s, afgerond op de seconde; is het resultaat 00:00:00, dan
  levert de lezer een **datum-only** ISO-string (dat is wat *A6* als no-op vergelijkt). Alle rekenwerk
  gaat via `Date.UTC`-arithmetiek — nooit `new Date(y, m, d)`, want de planningssuite draait een
  tijdzonematrix en een lokale constructor legt daar meteen een ei.

**Percentages: in .xlsx WÉL met decimalen.** Besluit A1 (hele procenten in de export) bestond om één
reden: *"8,38" wordt door een programma met de andere landinstelling als 838 gelezen*. In een
`.xlsx`-cel staat een **getal**, geen tekst — die valstrik bestaat daar domweg niet. De xlsx-export
schrijft daarom `Math.round(completion * 1_000_000) / 10_000` (percentage met vier decimalen) met
weergaveformaat `0.####`. Gevolg: een taak op 1/3 komt exact als no-op terug, waar de CSV-round-trip
daar per se een afrondingsverlies heeft. `buildPlan.ts` verandert **niet** — de vormbewuste
`isCompletionUnchanged` doet dit vanzelf goed.

**Percentage-opgemaakte cellen bij het LEZEN.** Typt de invuller `45%` in de cel, dan slaat Excel
`0.45` op met een percentage-`numFmt` (ingebouwd 9/10, of een custom code met een niet-ontsnapte `%`).
De lezer detecteert dat via `cellXfs` en levert `45` door. Zonder die stap wordt 45 % stil 0,45 %.

### X7 — De lezer: eigen XML-scanner, twee zip-passes, hetzelfde `ProgressSheet`

`src/services/xlsx/readXlsxSheet.ts` — generiek, weet niets van voortgang:

```ts
export interface XlsxCell {
  /** Kolomindex, 0-gebaseerd, afgeleid uit het `r`-attribuut (A → 0). */ col: number;
  /** Rauwe tekstwaarde, al ontdaan van sharedStrings-indirectie en XML-escapes. */ text: string;
  /** Numerieke waarde als de cel een getal droeg. */ num?: number;
  /** De cel draagt een datum-`numFmt` (ingebouwd 14–22 / 27–36 / 45–47 / 50–58, of custom met y/m/d). */
  isDate?: boolean;
  /** De cel draagt een percentage-`numFmt` (ingebouwd 9/10, of custom met een vrije `%`). */
  isPercent?: boolean;
}
export interface XlsxRow { /** Rijnummer uit het `r`-attribuut, 1-gebaseerd. */ rowNumber: number; cells: XlsxCell[] }
export interface XlsxSheet { rows: XlsxRow[]; epoch1904: boolean }
export type XlsxReadIssue = 'notAZip' | 'encrypted' | 'noSheet' | 'tooLarge' | 'tooManyRows' | 'malformed';
export class XlsxReadError extends Error { readonly issue: XlsxReadIssue }
export function readXlsxSheet(bytes: Uint8Array, limits?: XlsxLimits): Promise<XlsxSheet>;
```

- **Twee passes over dezelfde buffer.** Pass 1 pakt alleen de metadata uit (`[Content_Types].xml`,
  `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`,
  `xl/sharedStrings.xml`); daaruit volgt het **partpad van het eerste blad**, en pass 2 pakt alleen dát
  part uit. Het scannen van de central directory is goedkoop; inflaten is dat niet. Nooit "pak alles uit
  en zoek daarna".
- **Eigen scanner, geen `DOMParser`.** Naast de shim-reden uit *Context* is een tag-scanner hier ook
  gewoon het juiste gereedschap: we zoeken vier elementsoorten (`row`, `c`, `v`, `is/t`) met vijf
  attributen. De scanner kent zelfsluitende tags, attributen met enkele én dubbele quotes, commentaar
  en CDATA — en **geen** entiteitsdeclaraties (een XXE/billion-laughs-DTD wordt geweigerd, niet
  geïnterpreteerd).
- **Het rijnummer komt uit `r`, niet uit een teller.** Rijen in een xlsx mogen ontbreken en (in kapotte
  bestanden) door elkaar staan. Omdat `rowNumber` de sleutel van de handmatige koppelingen is (*A11*),
  zou een teller de overrides stil op de verkeerde rij laten landen.
- **Celtypes:** `s` (sharedString-index), geen `t` of `t="n"` (getal), `inlineStr`, `str`
  (formuleresultaat), `b` (0/1), `d` (ISO-datumtekst) en `e` (fout) — die laatste levert de rauwe
  fouttekst door, zodat de rij een **zichtbare weigering** wordt in plaats van stil leeg.
- **Grenzen** (`XLSX_LIMITS`, geëxporteerd): `maxBytes = 16 MiB` (gecomprimeerd, getoetst vóór er iets
  gealloceerd wordt), `maxUnpackedBytes = 64 MiB`, `maxEntryBytes = 32 MiB`, `maxEntries = 512`,
  `maxRatio = 200`, `maxRows = 50_000` (gelijk aan `PROGRESS_IMPORT_LIMITS.maxRows`),
  `maxCols = 256`, `maxSharedStrings = 200_000`. Overschrijding is **altijd** een weigering.

`src/services/progressImport/parseProgressXlsx.ts` — de formaat-bewuste laag, gespiegeld aan
`parseProgressCsv.ts`:

```ts
export function parseProgressXlsx(
  bytes: Uint8Array,
  limits?: ProgressImportLimits,
): Promise<ProgressSheet>;
```

Zelfde `ProgressSheet`, zelfde `rowNumber`-semantiek (1-gebaseerd inclusief kopregel — in xlsx is dat
letterlijk het Excel-rijnummer), zelfde `detectionCells`, zelfde kolomherkenning via de gedeelde
`sheetColumns.ts`, zelfde `boundedCell`/`hasControlChar`-begrenzing. Datumcellen worden als **ISO**
doorgegeven, waardoor `detectDateOrder` `noAmbiguity` teruggeeft en de dag/maand-vraag nooit verschijnt
— exact de belofte uit *A9*.

**Eén nieuwe `ProgressFileIssue`: `'encrypted'`.** Een met een wachtwoord beveiligde `.xlsx` is geen ZIP
maar een CFB/OLE2-container (magic `D0 CF 11 E0 A1 B1 1A E1`) met een `EncryptedPackage`-stream. Die
herkennen we en melden we als zodanig, met hetzelfde precedent als `readMPP`'s `MPP_ENCRYPTED`.
"Onleesbaar bestand" op een bestand dat gewoon een wachtwoord heeft is precies de nutteloze melding die
K8 aanklaagt. Dat is de **enige** uitbreiding van `types.ts` in deze etappe.

### X8 — `saveBytesDialog` hoort in `fileAccess`, en de PDF-export lift mee

```ts
// src/services/fileAccess/index.ts
export function saveBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null>;
```

Tauri: `save({ defaultPath })` + `ensureExtension` + `writeFile(path, bytes)`. Web: FSA
`createWritable().write(bytes)`, met dezelfde `platformRefusesWrites`/`isAbort`/`isPlatformRefusal`-
afhandeling als `saveFileDialogWeb`, en anders `downloadBlob`. `downloadBlob` verbreedt naar
`(name: string, content: string | Uint8Array, mime?: string)`.

`ReportPanel.writePdf` (r760–779) wordt vervangen door een aanroep van `saveBytesDialog` en verliest
zijn eigen `@tauri-apps/*`-imports. **Gedrag blijft gelijk:** `viaDownload` wordt daar nog steeds niet
gemeld (dat is vandaag ook zo) — zie Q3. Dit is geen opportunisme: `writePdf` is de enige bestaande
byte-schrijver, en hem laten staan zou betekenen dat er ná deze etappe **twee** byte-schrijfpaden zijn
met verschillende foutafhandeling. Precies de duplicatie waar K6 over gaat.

### X9 — `exportAs` draagt `string | Uint8Array`

Binnen `exportAs` wordt `content: string` een `payload: string | Uint8Array`; ná de `switch` staat
één afsplitsing:

```ts
const outcome = typeof payload === 'string'
  ? await saveFileDialog(defaultName, payload, filters, dialogOpts)
  : await saveBytesDialog(defaultName, payload, filters, dialogOpts);
```

De K7-cyclusguard blijft **ongewijzigd vóór de switch** staan. De `progress-xlsx`-tak hergebruikt
letterlijk het i18n-blok van `progress-csv` (dezelfde dynamic import van `@/i18n/config` en
`@/i18n/progressHeaderNotes`, met de daar uitgelegde reden) en laadt de schrijver zelf ook dynamisch:
`const { writeProgressSheetXLSX } = await import('@/services/xlsx/writeProgressXlsx')`.
`preferDownloads: true` geldt voor **beide** voortgangsformaten (E7).

### X10 — De knop levert voortaan `.xlsx`; CSV blijft leesbaar en blijft een exportkaart

**Beslist standpunt.** De ribbonknop *Voortgangsblad exporteren* roept `exportAs('progress-xlsx')` aan.
`progress-csv` blijft bestaan als **kaart** in Backstage → Exporteren, en `parseProgressCsv` blijft
onverkort de lezer voor CSV-bladen.

Waarom niet twee knoppen naast elkaar: E7 was letterlijk *"ik wil gewoon op een knop klikken en dan
krijg ik de juiste CSV met de juiste instellingen"*. De kern van die wens is **"de juiste"** — één
knop, geen keuze. Zet je er een tweede naast, dan dwing je de gebruiker elke keer een formaatkeuze te
maken waarvan hij de gevolgen niet kan overzien, terwijl één van de twee op elk punt dat E9 noemt
(breedte, vergrendeling, validatie, datumtrouw) simpelweg beter is. De ribbon is de plek voor het beste
antwoord; Backstage → Exporteren is de plek voor "ik wil iets specifieks" — en dáár hoort CSV, voor wie
zijn blad in een scriptje, een ERP-import of een tekstverwerker verder verwerkt.

Waarom CSV niet weggaat: het is één bestaande, geteste schrijver van 30 regels, en `.csv` is het enige
formaat dat werkelijk overal werkt. Weghalen kost meer dan houden.

Concreet: `EXPORT_FORMATS` krijgt `progress-xlsx` **bovenaan**, `progress-csv` schuift naar plek twee
met een bijgewerkte omschrijving; `menu:ribbon.progressExport` (het knoplabel) noemt geen formaat en
hoeft dus **niet** te veranderen.

### X11 — De dialoog accepteert beide, en dispatcht op de extensie

```ts
const res = await openFileDialog(
  [{ name: 'Progress sheet', extensions: ['xlsx', 'csv'] },
   { name: 'Excel Workbook', extensions: ['xlsx'] },
   { name: 'CSV Files', extensions: ['csv'] }],
  { binaryExtensions: ['xlsx'] },
);
if (!res) return;
const parsed = extensionOf(res.name) === 'xlsx'
  ? await (await import('@/services/progressImport/parseProgressXlsx'))
      .parseProgressXlsx(res.bytes ?? new Uint8Array())
  : parseProgressCsv(res.content);
```

**Dispatch op de extensie, niet op `res.bytes !== undefined`.** `bytes` is een gevolg van
`binaryExtensions`, niet een eigenschap van het bestand; duck-typen daarop betekent dat een vergeten
`binaryExtensions`-optie stilzwijgend de CSV-lezer op binaire rommel zet. Ontbreken de bytes terwijl de
extensie `.xlsx` zegt ⇒ `fileIssue: 'unreadable'`. De bestaande `try/catch` rond `pick()` blijft het
vangnet voor al het overige.

`READ_FORMATS` blijft **ongemoeid**: een voortgangsblad is geen document.

### X12 — Wat er aan teksten bijkomt (en wat expres niet)

| sleutel | namespace | waarvoor |
|---|---|---|
| `export.progressXlsxLabel` / `…Desc` / `…Short` | `menu` | de nieuwe exportkaart + dropdown |
| `export.progressCsvDesc` (**gewijzigd**) | `menu` | "voor wie liever met een CSV werkt" |
| `export.progressXlsxSheetName` | `menu` | de bladnaam in de werkmap (≤ 31 tekens, zonder `[]:*?/\`) |
| `export.progressXlsxValidation.percentTitle` / `percentError` / `dateTitle` / `dateError` | `menu` | de vier validatieteksten |
| `progressImport.fileIssue.encrypted` | `common` | de nieuwe `ProgressFileIssue` |

**Hergebruikt, dus géén nieuwe sleutels:** `export.progressCsvNotes.*` (kopinstructies én de
`dataValidation`-prompts), `export.progressCsvNotes.summaryRow` (de em-dash-markering),
`menu:ribbon.progressExport` (het knoplabel). Geen `{{count}}`-interpolatie — dat zou van elke sleutel
een CLDR-pluralfamilie in veertien locales maken (*A7*). Geen nieuwe `NotificationMessageKey`.

---

## Het contract (bindend — T1 schrijft dit letterlijk)

```ts
// ── src/services/progressImport/types.ts — de ENIGE wijziging in dit bestand ──
export type ProgressFileIssue =
  | 'tooLarge' | 'tooManyRows' | 'noKeyColumn' | 'noProgressColumns' | 'unreadable'
  /** Het bestand is met een wachtwoord beveiligd (CFB-container i.p.v. ZIP) — X7. */
  | 'encrypted';

// ── src/services/progressImport/sheetColumns.ts (NIEUW — gelift uit parseProgressCsv.ts) ──
/** De kolomsleutels die beide lezers herkennen: de canonieke sleutels van `RawProgressRow` plus de
 *  twee detectie-only kolommen `start`/`finish` (A5.4). */
export const PROGRESS_COLUMN_ALIASES: Readonly<Record<string, readonly string[]>>;
/** Exacte alias-match, daarna het prefix vóór de instructiemarker (E8). Formaat-agnostisch. */
export function matchColumnKey(header: string): string | undefined;
export function mapColumnIndex(headers: readonly string[]): Record<string, number>;
/** Trimt en begrenst; overschrijding is een WEIGERING (veld wordt afwezig), nooit een afkapping. */
export function boundedCell(raw: string | undefined, maxChars: number): string | undefined;
export function hasControlChar(value: string): boolean;

// ── src/services/zip/crc32.ts ──
export function crc32(data: Uint8Array): number;

// ── src/services/zip/zipReader.ts ──
export interface ZipEntry { name: string; data: Uint8Array }
export class ZipValidationError extends Error { readonly bytesSeen?: number }
export interface ZipReadLimits {
  maxEntryBytes: number; maxTotalBytes: number; maxEntries: number; maxRatio: number;
}
export const EXTENSION_ZIP_LIMITS: ZipReadLimits;
export function parseZipEntries(
  buffer: ArrayBuffer, limits?: ZipReadLimits, select?: (name: string) => boolean,
): Promise<ZipEntry[]>;
/** Geëxporteerd omdat de zip-bom-test hem los moet kunnen aanroepen om `bytesSeen` te toetsen. */
export function inflateRawBounded(compressed: Uint8Array, budget: number): Promise<Uint8Array>;

// ── src/services/zip/zipWriter.ts ──
export interface ZipFileInput { name: string; data: Uint8Array }
export function writeZip(
  files: readonly ZipFileInput[],
  opts?: { deflate?: ((data: Uint8Array) => Promise<Uint8Array>) | null },
): Promise<Uint8Array>;

// ── src/services/xlsx/xmlText.ts ──
export function escapeXmlText(s: string): string;
export function escapeXmlAttr(s: string): string;
export function unescapeXml(s: string): string;

// ── src/services/xlsx/serialDate.ts ──
export function isoToSerial(iso: string, epoch1904?: boolean): number | undefined;
export function serialToIso(serial: number, epoch1904?: boolean): string | undefined;
export const MIN_READABLE_SERIAL_1900 = 61;

// ── src/services/xlsx/writeProgressXlsx.ts ──
/** Alle gebruikerszichtbare tekst komt van BUITEN; de schrijver blijft puur (geen i18n in services/),
 *  precies zoals `writeProgressSheetCSV(tasks, headerNotes, summaryNote)`. */
export interface ProgressXlsxText {
  headerNotes?: Partial<Record<ProgressSheetColumnKey, string>>;
  summaryNote?: string;
  sheetName?: string;
  validation?: { percentTitle: string; percentError: string; dateTitle: string; dateError: string };
}
/** Bouwt de zes parts als losse, leesbare XML-strings — geëxporteerd zodat de structurele test de
 *  kindvolgordes kan asserteren ZONDER een ZIP te hoeven uitpakken. */
export function buildProgressXlsxParts(
  tasks: readonly Task[], text?: ProgressXlsxText,
): readonly { name: string; xml: string }[];
export function writeProgressSheetXLSX(
  tasks: readonly Task[], text?: ProgressXlsxText,
): Promise<Uint8Array>;

// ── src/services/xlsx/readXlsxSheet.ts ──  (XlsxCell/XlsxRow/XlsxSheet/XlsxReadError: zie X7)
export const XLSX_LIMITS: XlsxLimits;
export function readXlsxSheet(bytes: Uint8Array, limits?: XlsxLimits): Promise<XlsxSheet>;

// ── src/services/progressImport/parseProgressXlsx.ts ──
export function parseProgressXlsx(
  bytes: Uint8Array, limits?: ProgressImportLimits,
): Promise<ProgressSheet>;

// ── src/services/fileAccess/index.ts ──
export function saveBytesDialog(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null>;

// ── src/services/formatRegistry.ts ──
export type ExportFormat = 'ifc' | 'csv' | 'mspdi' | 'p6' | 'progress-csv' | 'progress-xlsx';
```

---

## Taken

### Taak T1 — Het contract (blokkeert alle banen)

Klein, eerst, daarna **bevroren**.

**Files:**
- Modify: `src/services/progressImport/types.ts` (uitsluitend `'encrypted'` toevoegen aan `ProgressFileIssue`)
- Modify: `src/services/formatRegistry.ts` (uitsluitend `'progress-xlsx'` aan de `ExportFormat`-union)
- Create: `src/services/zip/index.ts`, `src/services/xlsx/index.ts` (barrels; groeien in T4–T8)

- [ ] **Step 1:** De twee union-uitbreidingen; barrels met alleen `export type`-regels waar al iets bestaat.
- [ ] **Step 2:** `npm run typecheck` — groen (de `ExportFormat`-uitbreiding legt meteen bloot welke
      `switch`-statements exhaustief zijn; is dat er een, dan hoort de tak in T10, niet hier).

**Acceptatie:** `npm run typecheck` exitcode 0. Mutatiebewijs volgt in T4–T8.

---

### Taak T2 — `sheetColumns.ts`: de kolomherkenning liften (gedragsneutraal)

Zonder deze lift zou `parseProgressXlsx` de alias-tabel en de E8-prefixmatch moeten kopiëren, en dan
loopt de xlsx-lezer stil uit de pas zodra er een kolomalias bijkomt.

**Files:**
- Create: `src/services/progressImport/sheetColumns.ts`
- Modify: `src/services/progressImport/parseProgressCsv.ts` (verwijdert `COLUMN_ALIASES`,
  `HEADER_INSTRUCTION_MARKERS`, `matchColumnKey`, `mapColumnIndex`, `boundedCell`, `hasControlChar`;
  importeert ze)

- [ ] **Step 1:** Verplaats de zes symbolen letterlijk, inclusief hun commentaar. **Niets herschrijven.**
- [ ] **Step 2:** `bash tests/planning/run.sh; echo "exit: $?"`. `check-progress-import-csv.ts` moet
      **ongewijzigd groen** zijn; dat ís het bewijs van gedragsneutraliteit.
- [ ] **Step 3:** `npm run verify:cycles` — de nieuwe importrichting maakt geen kring.

**Acceptatie (mutatie-bewijsbaar):** de bestaande CSV-batterij blijft groen zonder ook maar één
assertie aan te passen; verandert er één alias in `sheetColumns.ts`, dan valt die batterij om.

---

### Taak T3 — `xmlText.ts` en `serialDate.ts` (bladmodules, geen afhankelijkheden)

**Files:**
- Create: `src/services/xlsx/xmlText.ts`
- Create: `src/services/xlsx/serialDate.ts`
- Create: `tests/planning/check-xlsx-primitives.ts`

- [ ] **Step 1: Schrijf de falende test.**

```ts
// ── escaper ──────────────────────────────────────────────────────────────────
eq('ampersand eerst',            escapeXmlText('a & <b>'), 'a &amp; &lt;b&gt;');
eq('attribuut ontsnapt quotes',  escapeXmlAttr('zeg "hoi"'), 'zeg &quot;hoi&quot;');
eq('stuurteken wordt _xHHHH_',   escapeXmlText('ab'), 'a_x0001_b');
eq('tab/nl/cr blijven staan',    escapeXmlText('a\tb\nc'), 'a\tb\nc');
eq('een letterlijke _x0041_ wordt zelf ontsnapt', escapeXmlText('_x0041_'), '_x005F_x0041_');
eq('…en komt onbeschadigd terug', unescapeXml(escapeXmlText('_x0041_')), '_x0041_');
eq('round-trip over alles',      unescapeXml(escapeXmlText('a&<>"\'_x0041_')), 'a&<>"\'_x0041_');
// ── seriële datums ───────────────────────────────────────────────────────────
eq('1900-03-01 is 61',           isoToSerial('1900-03-01'), 61);
eq('1901-01-01 is 367',          isoToSerial('1901-01-01'), 367);
eq('2026-06-09 round-trip',      serialToIso(isoToSerial('2026-06-09')!), '2026-06-09');
eq('tijddeel overleeft',         serialToIso(isoToSerial('2026-06-09T08:30')!), '2026-06-09T08:30');
eq('middernacht is datum-only',  serialToIso(isoToSerial('2026-06-09T00:00')!), '2026-06-09');
eq('onder 61 is onleesbaar',     serialToIso(59), undefined);
eq('1904-stelsel leest anders',  serialToIso(1, true), '1904-01-02');
eq('geen datum in een datumcel', isoToSerial('volgende week'), undefined);
```

- [ ] **Step 2:** Implementeer. `serialDate` rekent **uitsluitend** met `Date.UTC`-arithmetiek.
- [ ] **Step 3:** Groen, en daarna met `TZ=Pacific/Kiritimati` en `TZ=Pacific/Niue` (± 14 u) opnieuw —
      dezelfde uitkomsten. (De suite draait die matrix onderaan sowieso; dit is de snelle lokale check.)

**Acceptatie (mutatie-bewijsbaar):**
- De `_x`-ontsnapping weglaten ⇒ `…komt onbeschadigd terug` rood.
- Stuurtekens laten staan (zoals `mspdiWriter.escapeXML` doet) ⇒ `stuurteken wordt _xHHHH_` rood.
- `1899-12-30` vervangen door `1899-12-31` ⇒ `1900-03-01 is 61` rood.
- `MIN_READABLE_SERIAL_1900` op `1` zetten ⇒ `onder 61 is onleesbaar` rood.
- `new Date(y, m, d)` gebruiken i.p.v. `Date.UTC` ⇒ rood in de tijdzonematrix.

---

### Taak T4 — De ZIP-lezer liften, budgetteren en Zip64 weigeren  *(baan A)*

**Files:**
- Create: `src/services/zip/zipReader.ts`
- Modify: `src/extensions/extensionService.ts` (verwijdert r395–620; importeert `parseZipEntries`,
  `ZipValidationError`, `EXTENSION_ZIP_LIMITS`)
- Create: `tests/planning/check-zip.ts` (deel 1; T5 vult aan)

- [ ] **Step 1: Verplaats** r395–620 ongewijzigd naar `zipReader.ts`; maak `MAX_ZIP_*` tot velden van
      `EXTENSION_ZIP_LIMITS` en geef `limits` door. `bash tests/planning/run.sh; echo "exit: $?"` —
      `check-ext-integrity.ts` en `check-ext-consent.ts` moeten **ongewijzigd groen** zijn. Dit is een
      pure verplaatsing; commit apart.
- [ ] **Step 2: Schrijf de falende test** voor de drie nieuwe eigenschappen:

```ts
eq('bom: weigering',              bombError instanceof ZipValidationError, true);
ok('…vóórdat alles is uitgepakt', bombError.bytesSeen! <= BUDGET + 1024 * 1024);
eq('ratio-plafond weigert',       ratioError.message.includes('ratio'), true);
eq('te veel entries weigert',     manyEntriesError instanceof ZipValidationError, true);
eq('Zip64-sentinel weigert',      zip64Error.message.includes('Zip64'), true);
eq('select slaat entries over',   (await parseZipEntries(buf, LIM, n => n === 'a.txt')).length, 1);
ok('…en pakt de overgeslagene niet uit', inflateCalls === 1);
```

  De bom-fixture: 8 MiB nullen door `CompressionStream('deflate-raw')`, budget 64 KiB.
- [ ] **Step 3: Implementeer** `inflateRawBounded`, het per-entry budget, `maxEntries`, de
      Zip64-sentinelcontrole en `select`.
- [ ] **Step 4:** `bash tests/planning/run.sh; echo "exit: $?"` — exitcode 0.

**Acceptatie (mutatie-bewijsbaar):**
- De budgettoets ná de inflatielus zetten (het huidige gedrag) ⇒ `…vóórdat alles is uitgepakt` rood.
- `maxRatio` op `Infinity` ⇒ `ratio-plafond weigert` rood.
- De Zip64-sentinel als gewone maat lezen ⇒ `Zip64-sentinel weigert` rood.
- `select` negeren en alles uitpakken ⇒ `…en pakt de overgeslagene niet uit` rood.
- Elk van `check-ext-integrity.ts`'s bestaande weigeringen blijft rood-bij-mutatie zoals voorheen.

---

### Taak T5 — De ZIP-schrijver en CRC-32  *(baan A)*

**Files:**
- Create: `src/services/zip/crc32.ts`, `src/services/zip/zipWriter.ts`
- Modify: `tests/planning/check-zip.ts` (deel 2)

- [ ] **Step 1: Schrijf de falende test.**

```ts
eq('crc32 leeg',            crc32(bytes('')) >>> 0, 0x00000000);
eq('crc32 check-waarde',    crc32(bytes('123456789')) >>> 0, 0xCBF43926);
eq('crc32 quick brown fox', crc32(bytes('The quick brown fox jumps over the lazy dog')) >>> 0, 0x414FA339);
eq('store: round-trip',     await roundTrip(files, { deflate: null }), 'ok');
eq('deflate: round-trip',   await roundTrip(files, {}), 'ok');
eq('deflate is kleiner',    (await writeZip(big)).length < (await writeZip(big, { deflate: null })).length, true);
eq('incompressibel blijft store', methodOf(await writeZip(randomBytesEntry), 0), 0);
eq('Content_Types eerst',   firstEntryName(await writeZip(parts)), '[Content_Types].xml');
eq('deterministisch',       hex(await writeZip(files)), hex(await writeZip(files)));
eq('crc in de central directory klopt', await verifyCentralCrcs(await writeZip(files)), true);
eq('niet-ASCII naam gooit', await throws(() => writeZip([{ name: 'blad€.xml', data }])), true);
eq('>65535 entries gooit',  await throws(() => writeZip(tooMany)), true);
```

  `roundTrip` = `writeZip` → `parseZipEntries` → namen en bytes exact terug.
- [ ] **Step 2: Implementeer.** Local headers (30 B), central directory (46 B), EOCD (22 B), vaste
      DOS-datum 1980-01-01, methode 8 alleen als dat werkelijk kleiner is.
- [ ] **Step 3:** `bash tests/planning/run.sh; echo "exit: $?"` — exitcode 0.

**Acceptatie (mutatie-bewijsbaar):**
- CRC over de **gecomprimeerde** data berekenen ⇒ `crc in de central directory klopt` rood.
- `Date.now()` als DOS-tijd ⇒ `deterministisch` rood.
- De central-directory-offset in de EOCD één byte verkeerd ⇒ beide round-trips rood.
- Deflate altijd forceren ⇒ `incompressibel blijft store` rood.

---

### Taak T6 — De `.xlsx`-schrijver  *(baan B)*

**Files:**
- Create: `src/services/xlsx/writeProgressXlsx.ts`
- Create: `tests/planning/check-progress-xlsx-writer.ts`

Baan B schrijft tegen de **gepinde signaturen** van T5 (`writeZip`) en T3; de structurele asserties
draaien op `buildProgressXlsxParts` en hebben de ZIP dus niet nodig.

- [ ] **Step 1: Schrijf de falende test.**

```ts
// ── parts ────────────────────────────────────────────────────────────────────
eq('zes parts, niet meer',      parts.length, 6);
ok('geen sharedStrings',        !parts.some(p => p.name.includes('sharedStrings')));
// ── worksheet-volgorde (X4) ──────────────────────────────────────────────────
ok('cols vóór sheetData',       idx(ws, '<cols') < idx(ws, '<sheetData'));
ok('sheetProtection ná sheetData', idx(ws, '<sheetData') < idx(ws, '<sheetProtection'));
ok('dataValidations ná sheetProtection', idx(ws, '<sheetProtection') < idx(ws, '<dataValidations'));
ok('pane vóór selection',       idx(ws, '<pane ') < idx(ws, '<selection '));
// ── styleSheet-volgorde en minima ────────────────────────────────────────────
ok('numFmts → fonts → fills → borders → cellStyleXfs → cellXfs',
   ordered(st, ['<numFmts', '<fonts', '<fills', '<borders', '<cellStyleXfs', '<cellXfs']));
eq('twee fills',                countFills(st), 2);
ok('gray125 als tweede',        st.includes('gray125'));
eq('fills-count klopt met de kinderen', declaredCount(st, 'fills'), 2);
// ── E9: breedte, slot, validatie ─────────────────────────────────────────────
ok('elke kolom heeft een breedte',       colWidths(ws).every(w => w >= 10));
ok('de naamkolom is breder dan de wbs-kolom', colWidths(ws)[2] > colWidths(ws)[1]);
ok('de instructie blaast de kolom NIET op',   colWidths(ws).every(w => w <= 46));
ok('kopregel heeft een vaste hoogte',    ws.includes('ht="46" customHeight="1"'));
eq('blad is beveiligd',                  ws.includes('<sheetProtection sheet="1"'), true);
eq('selecteren blijft toegestaan',       ws.includes('selectLockedCells="0"'), true);
eq('kolombreedte aanpassen mag',         ws.includes('formatColumns="0"'), true);
eq('vier ontgrendelde stijlen',          unlockedStyleCount(st), 4); // tekst/percentage/datum/datumtijd
eq('percentagevalidatie 0..100',         validation(ws, 'decimal'), { f1: '0', f2: '100', allowBlank: '1' });
eq('datumvalidatie is type date',        validation(ws, 'date').type, 'date');
ok('sqref is begrensd tot de laatste rij', !ws.includes('1048576'));
// ── celtypen ─────────────────────────────────────────────────────────────────
ok('datums zijn getalcellen met datumopmaak', /<c r="D2" s="3"><v>\d+<\/v><\/c>/.test(ws));
ok('geen datum als tekst',      !/t="inlineStr"><is><t[^>]*>2026-/.test(ws));
ok('percentage met decimalen',  ws.includes('<v>33.3333</v>'));
ok('naam is een inline string', ws.includes('t="inlineStr"'));
ok('xml:space blijft behouden', ws.includes('xml:space="preserve"'));
// ── E8/E9: instructies en verzameltaken ──────────────────────────────────────
ok('kopcel draagt de instructie',  ws.includes('OPS Task ID — niet wijzigen'));
ok('verzamelrij draagt de em-dash', ws.includes('— niet invullen'));
ok('…en die cel is vergrendeld',    summaryCellStyle(ws) === lockedSummaryStyle(st));
// ── vijandige invoer ─────────────────────────────────────────────────────────
ok('stuurteken in een taaknaam breekt het blad niet', ws.includes('_x0001_'));
ok('& in een taaknaam',             ws.includes('Staal &amp; Beton'));
```

- [ ] **Step 2: Implementeer** `buildProgressXlsxParts` + `writeProgressSheetXLSX`.
- [ ] **Step 3:** `bash tests/planning/run.sh; echo "exit: $?"` — exitcode 0.

**Acceptatie (mutatie-bewijsbaar):**
- `sheetProtection` ná `dataValidations` zetten ⇒ die volgorde-assertie rood (en Excel weigert het
  bestand — dat is precies wat deze assertie afvangt zonder Excel).
- De `gray125`-fill weglaten ⇒ twee asserties rood.
- `selectLockedCells="1"` (de omgekeerde polariteit) ⇒ `selecteren blijft toegestaan` rood.
- De instructietekst in de breedteberekening meenemen ⇒ `de instructie blaast de kolom NIET op` rood.
- Datums als tekst schrijven ⇒ `datums zijn getalcellen` én `geen datum als tekst` rood.
- `formatCompletionPercent` (hele procenten) gebruiken ⇒ `percentage met decimalen` rood.
- De verzamelcel de gewone invulstijl geven ⇒ `…en die cel is vergrendeld` rood.

---

### Taak T7 — `readXlsxSheet`: de generieke lezer  *(baan C)*

**Files:**
- Create: `src/services/xlsx/readXlsxSheet.ts`
- Create: `tests/planning/check-progress-import-xlsx.ts` (deel 1; T8 vult aan)

- [ ] **Step 1: Schrijf de falende test.** Fixtures met de hand als XML-strings + `writeZip` (baan A's
      gepinde signatuur), zodat er geen binaire blob in de repo hoeft.

```ts
eq('rijnummer komt uit r=',        sheet.rows[1].rowNumber, 7);   // sparse blad: rij 2 ontbreekt
eq('kolom uit r=, niet uit volgorde', cell(sheet, 7, 'C').text, 'derde');
eq('sharedString wordt opgelost',  cell(sheet, 2, 'A').text, 'Fundering');
eq('inlineStr ook',                cell(sheet, 3, 'A').text, 'Ruwbouw');
eq('datumcel herkend via cellXfs', cell(sheet, 2, 'D').isDate, true);
eq('percentagecel herkend',        cell(sheet, 2, 'F').isPercent, true);
eq('custom numFmt met y/m/d telt als datum', cell(sheet, 4, 'D').isDate, true);
eq('date1904 wordt gelezen',       sheet1904.epoch1904, true);
eq('foutcel levert de fouttekst',  cell(sheet, 5, 'F').text, '#DIV/0!');
eq('geen zip ⇒ notAZip',           issueOf(await attempt(readXlsxSheet(bytes('hallo')))), 'notAZip');
eq('CFB-magic ⇒ encrypted',        issueOf(await attempt(readXlsxSheet(cfbHeader))), 'encrypted');
eq('te groot ⇒ tooLarge',          issueOf(await attempt(readXlsxSheet(huge))), 'tooLarge');
eq('te veel rijen ⇒ tooManyRows',  issueOf(await attempt(readXlsxSheet(manyRows, tiny))), 'tooManyRows');
eq('DTD wordt geweigerd',          issueOf(await attempt(readXlsxSheet(billionLaughs))), 'malformed');
ok('alleen de benodigde parts worden uitgepakt', inflatedNames.every(n => NEEDED.has(n)));
```

- [ ] **Step 2: Implementeer** de twee zip-passes, de rels-resolutie, `sharedStrings`, de
      `cellXfs`/`numFmt`-classificatie en de XML-scanner.
- [ ] **Step 3:** `bash tests/planning/run.sh; echo "exit: $?"` — exitcode 0.

**Acceptatie (mutatie-bewijsbaar):**
- Het rijnummer uit een teller halen ⇒ `rijnummer komt uit r=` rood.
- Alle entries uitpakken ⇒ `alleen de benodigde parts worden uitgepakt` rood.
- `sharedStrings` overslaan ⇒ `sharedString wordt opgelost` rood (en daarmee elk door Excel
  heropgeslagen blad stil leeg).
- De `numFmt`-classificatie weglaten ⇒ `datumcel herkend` rood.
- De DTD-weigering weghalen ⇒ `DTD wordt geweigerd` rood.

---

### Taak T8 — `parseProgressXlsx` en de round-trip-poort  *(baan C)*

**Files:**
- Create: `src/services/progressImport/parseProgressXlsx.ts`
- Modify: `tests/planning/check-progress-import-xlsx.ts` (deel 2)

De round-trip-test importeert baan B's `writeProgressSheetXLSX` en baan A's `writeZip`; **importeren
mag, wijzigen niet** — dat is wat de banen disjunct houdt.

- [ ] **Step 1: Schrijf de falende test.** Dit deel is **de** poort van deze etappe:

```ts
// ── round-trip: ons eigen blad terug ⇒ NUL wijzigingen ───────────────────────
eq('nul toepassingen',            plan.appliedCount, 0);
eq('nul weigeringen',             plan.refusedCount, 0);
eq('alles ongewijzigd',           plan.noopCount, tasks.length);
eq('geen rij wacht op koppeling', plan.needsLinkCount, 0);
eq('elke rij matcht op id',       plan.rows.every(r => r.match === 'id'), true);
eq('verzameltaken geven geen weigering', plan.rows.filter(r => r.reason === 'summaryTask').length, 0);
// ── A9: geen datumvraag, ooit ────────────────────────────────────────────────
eq('datums zijn ondubbelzinnig',  detectDateOrder(sheet.detectionCells, tasks).evidence, 'noAmbiguity');
// ── precisie ─────────────────────────────────────────────────────────────────
eq('een derde overleeft de round-trip', planFor(oneThird).noopCount, 1);
eq('een uur-modus-datetime overleeft',  planFor(withTime).noopCount, 1);
// ── één gewijzigde cel = één toepassing ──────────────────────────────────────
eq('één wijziging, één apply',    mutated.appliedCount, 1);
eq('…op de juiste taak',          mutated.rows.find(r => r.outcome === 'apply')!.taskId, B.id);
// ── Excel-realisme ───────────────────────────────────────────────────────────
eq('45% als percentagecel leest als 45', pctRow.completion, 0.45);
eq('kop met instructie matcht nog steeds', sheetFromExcel.rawRows.length, 2);
eq('rijnummer = Excel-rijnummer', sheetFromExcel.rawRows[0].rowNumber, 2);
eq('Start/Finish blijven detectie-only',
   Object.keys(sheet.rawRows[0]).some(k => /start|finish/i.test(k) && !/actual/i.test(k)), false);
eq('een gewijzigde Start-kolom verandert niets', planWithChangedStart.appliedCount, 0);
// ── grenzen ──────────────────────────────────────────────────────────────────
eq('blad zonder sleutelkolom',    (await parseProgressXlsx(noKey)).fileIssue, 'noKeyColumn');
eq('blad zonder voortgangskolommen', (await parseProgressXlsx(noProgress)).fileIssue, 'noProgressColumns');
eq('wachtwoordbestand',           (await parseProgressXlsx(cfb)).fileIssue, 'encrypted');
eq('zip-bom',                     (await parseProgressXlsx(bomb)).fileIssue, 'unreadable');
eq('te lang id telt als afwezig', longIdRow.taskId, undefined);
eq('id met stuurteken telt niet', ctrlIdRow.taskId, undefined);
```

- [ ] **Step 2: Implementeer.**
- [ ] **Step 3:** `bash tests/planning/run.sh; echo "exit: $?"` — exitcode 0, óók onder de tijdzonematrix.

**Acceptatie (mutatie-bewijsbaar):**
- Datums als tekst doorgeven i.p.v. als ISO ⇒ `datums zijn ondubbelzinnig` rood.
- De percentage-`numFmt`-omrekening weglaten ⇒ `45% als percentagecel leest als 45` rood.
- De verzamelcel als waarde doorgeven (zodat de em-dash-regel in `sheetValues.ts` niet meer grijpt) ⇒
  `verzameltaken geven geen weigering` rood.
- `Start`/`Finish` in `rawRows` opnemen ⇒ twee asserties rood.
- `boundedCell` overslaan ⇒ `te lang id telt als afwezig` rood.

---

### Taak T9 — `saveBytesDialog`, en de PDF-export erop  *(baan D)*

**Files:**
- Modify: `src/services/fileAccess/index.ts`, `tauriBackend.ts`, `webBackend.ts`
- Modify: `src/components/panels/ReportPanel.tsx` (`writePdf` → `saveBytesDialog`)

- [ ] **Step 1:** `saveBytesDialogTauri`/`…Web` naar het model van de tekstvarianten; `downloadBlob`
      verbreden naar `string | Uint8Array` + `mime`.
- [ ] **Step 2:** `writePdf` vervangen; de `@tauri-apps/*`-imports uit `ReportPanel.tsx` verdwijnen.
- [ ] **Step 3:** `npm run typecheck` + `npm run lint` — exitcode 0.
- [ ] **Step 4:** Handmatig in de browserbuild: Rapport → PDF exporteren levert nog steeds een
      bruikbare PDF (de bestaande Playwright-case `report-options.spec.ts` r62–65 dekt de download).

**Acceptatie:** `report-options.spec.ts` blijft groen zonder wijziging; `grep -n "@tauri-apps"
src/components/panels/ReportPanel.tsx` geeft nul treffers.

---

### Taak T10 — `exportAs`, het exportformaat en de knop  *(baan D)*

**Files:**
- Modify: `src/state/slices/fileSlice.ts` (`payload: string | Uint8Array`, tak `progress-xlsx`)
- Modify: `src/services/formatRegistry.ts` (`EXPORT_FORMATS`-entry, bovenaan)
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx` (`progressExportButton` → `'progress-xlsx'`)

- [ ] **Step 1:** De `progress-xlsx`-tak: dynamic import van `@/i18n/config`,
      `@/i18n/progressHeaderNotes` en `@/services/xlsx/writeProgressXlsx`; bestandsnaam
      `<projectnaam>-voortgang.xlsx` via `nameOverride`; `preferDownloads: true`.
- [ ] **Step 2:** De `saveFileDialog`/`saveBytesDialog`-afsplitsing ná de switch. K7-guard blijft staan.
- [ ] **Step 3:** `npm run typecheck` + `npm run build` — exitcode 0, en controleer in de
      buildoutput dat er een **aparte chunk** voor de xlsx/zip-code ontstaat (net als `mppReader`).

**Acceptatie (mutatie-bewijsbaar):** een statische `import` van `writeProgressXlsx` in `fileSlice.ts`
⇒ de aparte chunk verdwijnt uit de buildoutput en de hoofdbundel groeit meetbaar.

---

### Taak T11 — De dialoog accepteert beide formaten  *(baan D)*

**Files:**
- Modify: `src/components/dialogs/ProgressImportDialog.tsx` (filter + dispatch + `fileIssue.encrypted`)

- [ ] **Step 1:** Het filter met `binaryExtensions: ['xlsx']` en de extensiedispatch uit *X11*.
- [ ] **Step 2:** De `encrypted`-tekst in de bestaande `fileIssue`-weergave.
- [ ] **Step 3:** `npm run typecheck` + `npm run lint`.

**Acceptatie:** een `.csv` kiezen werkt exact als voorheen (`progress-import.spec.ts` blijft groen
zonder wijziging); T13 bewijst de `.xlsx`-kant.

---

### Taak T12 — i18n, veertien locales  *(baan D)*

**Files:**
- Modify: `src/i18n/locales/*/menu.json` (8 sleutels: label/desc/short, sheetName, 4 validatieteksten;
  `progressCsvDesc` herformuleren)
- Modify: `src/i18n/locales/*/common.json` (`progressImport.fileIssue.encrypted`)
- Modify: `src/i18n/progressHeaderNotes.ts` (`buildProgressXlsxValidationText(t)`, zelfde patroon als
  `buildProgressHeaderNotes`)

- [ ] **Step 1:** `nl` en `en` met de hand; de overige twaalf erbij.
- [ ] **Step 2:** `npm run verify:i18n` — exitcode 0. Geen `{{count}}`.
- [ ] **Step 3:** Controleer de bladnaam per locale: ≤ 31 tekens, geen `[ ] : * ? / \`.

**Acceptatie:** `verify:i18n` exitcode 0; een ontbrekende locale ⇒ rood.

---

### Taak T13 — De browsercases: exporteren én terugimporteren als échte handeling

**Files:**
- Modify: `tests/browser/progress-import.spec.ts`

- [ ] **Step 1:** Case *"voortgangsblad-export levert een .xlsx in de downloads"*: klik op de knop op
      Planning, vang de download, assert `suggestedFilename()` op `/-voortgang\.xlsx$/` en dat de eerste
      vier bytes `PK\x03\x04` zijn.
- [ ] **Step 2:** Case *"exporteren en meteen terugimporteren geeft nul wijzigingen"*: dezelfde
      gedownloade buffer via `chooser.setFiles({ name: 'voortgang.xlsx', mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer })` terug de
      importdialoog in; assert dat de preview **geen enkele** wijziging en **geen** koppelsectie toont.
      Dit is de sterkst mogelijke bewijsvoering: twee echte gebruikershandelingen, de hele keten
      ertussen, en geen `__OPS__`-fixture die een stap vervangt.
- [ ] **Step 3:** Een case *"één cel wijzigen geeft één wijziging"* in de browser vraagt een
      gemuteerd blad; een Playwright-spec kan `src/` niet via `@/` importeren, dus dat zou via
      `page.evaluate` met een dynamische import binnen de app moeten. **Default: doe dat niet** — die
      case staat al volwaardig in `check-progress-import-xlsx.ts` (T8), en een browsercase die de
      handeling niet écht uitvoert heeft geen waarde. Wijk je hiervan af, meld het.
- [ ] **Step 4:** `npm run test:browser` — exitcode 0.

**Acceptatie:** beide nieuwe cases groen; de bestaande cases in dat bestand ongewijzigd groen.

---

### Taak T14 — Integratie en poorten

**Files:**
- Modify: `tests/planning/run.sh` (vier registraties: `check-xlsx-primitives.ts`, `check-zip.ts`,
  `check-progress-xlsx-writer.ts`, `check-progress-import-xlsx.ts`)

- [ ] **Step 1:** Registreer de vier batterijen naar het model van r852/r855.
- [ ] **Step 2:** `bash tests/planning/run.sh; echo "exit: $?"` — exitcode 0, óók de tijdzonematrix.
- [ ] **Step 3:** `npm run verify` — **exitcode 0**. Machinebreed één tegelijk.
- [ ] **Step 4:** `git status --short`; stage alleen de eigen bestanden, geen `tests/planning/.*.mjs`.

---

### Taak T15 — Documentatie

**Files:**
- Modify: `public/docs/nl/gids-voortgang-importeren.md`, `public/docs/en/gids-voortgang-importeren.md`
- Modify: `docs/extensions.md` (**alleen** als de zip-lift iets aan de extensie-ZIP-eisen verandert —
  Zip64 wordt nu expliciet geweigerd, dus ja: één zin bij de verpakkingseisen)
- Modify: `docs/TODO.md` (afvinken wat af is)

- [ ] **Step 1:** In de gids: (1) de knop levert een Excel-blad, (2) wat er vastzit en waarom, (3) dat
      alleen de drie invulkolommen bewerkbaar zijn, (4) dat datums als datum ingevuld worden en dat de
      dag/maand-vraag daarom bij `.xlsx` nooit verschijnt, (5) dat het percentage tussen 0 en 100 moet
      liggen en decimalen mag hebben, (6) dat CSV blijft werken en waar die kaart staat, (7) dat een
      verzameltaakrij niet ingevuld wordt, (8) dat de planning na afloop herberekend moet worden (F5).
- [ ] **Step 2:** `npm run verify:docs` — exitcode 0.

---

## Parallelliseringsschema

`T1` eerst en alleen. Daarna `T2` en `T3` (twee kleine, onderling disjuncte fundamenten — mogen
parallel). Daarna vier banen met **strikt disjuncte bestandslijsten**:

| baan | taken | exclusieve bestanden |
|---|---|---|
| **A — zip** | T4, T5 | `src/services/zip/*`, `src/extensions/extensionService.ts`, `tests/planning/check-zip.ts` |
| **B — schrijver** | T6 | `src/services/xlsx/writeProgressXlsx.ts`, `tests/planning/check-progress-xlsx-writer.ts` |
| **C — lezer** | T7, T8 | `src/services/xlsx/readXlsxSheet.ts`, `src/services/progressImport/parseProgressXlsx.ts`, `tests/planning/check-progress-import-xlsx.ts` |
| **D — bedrading & teksten** | T9, T10, T11, T12, T15 | `src/services/fileAccess/{index,tauriBackend,webBackend}.ts`, `src/components/panels/ReportPanel.tsx`, `src/state/slices/fileSlice.ts`, `src/services/formatRegistry.ts`, `src/components/layout/Ribbon/ribbonConfig.tsx`, `src/components/dialogs/ProgressImportDialog.tsx`, `src/i18n/progressHeaderNotes.ts`, `src/i18n/locales/*/{common,menu}.json`, `public/docs/**`, `docs/extensions.md`, `docs/TODO.md` |

**Overlappen die bewust zijn opgelost:**

- `src/services/formatRegistry.ts` staat bij **D**, maar T1 raakt het één regel (de `ExportFormat`-union).
  T1 is klaar vóór D begint; D is daarna exclusief eigenaar.
- **B en C importeren uit A** (`writeZip`, `parseZipEntries`) en **C importeert uit B**
  (`writeProgressSheetXLSX`, voor de round-trip). Importeren mag; **wijzigen** niet. Zolang de
  signaturen uit *Het contract* niet bewegen kunnen B en C blind vooruit; typecheck-groen voor C komt
  pas ná de merge van A en B.
- `src/services/progressImport/types.ts` is ná T1 **bevroren**. Mist er een veld, dan meldt de baan dat
  aan de orkestrator in plaats van het bestand zelf te wijzigen.
- `src/services/progressImport/parseProgressCsv.ts` wordt **uitsluitend** in T2 aangeraakt, daarna door
  niemand meer. Staat hij in een diff van baan A/B/C/D, dan is er iets mis.
- `tests/planning/run.sh` raakt **niemand** tijdens de banen — dat doet T14. Elke baan draait zijn check
  standalone met het esbuild-commando uit `tests/planning/README.md`.
- `matchRows.ts`, `buildPlan.ts`, `sheetValues.ts`, `taskSlice.ts` staan bij **niemand**. Ze horen in
  geen enkele diff van deze etappe (*A9*).

**Volgorde:** T1 → {T2, T3} → {A, B, C, D parallel} → T13 (browsercases; heeft B, C en D nodig) →
T14 (poort). T15 mag met D mee.

---

## Hardening-checklist (élke implementer-prompt krijgt dit blok mee)

- **Geen allocaties of lussen die op ongevalideerde bestandswaarden zijn gemaat.** Bestandsgrootte,
  entry-aantal, entry-grootte, rij- en kolomaantallen worden vooraf tegen de limieten getoetst;
  overschrijding is een weigering, nooit een stille afkapping. Een uitpak-limiet die pas ná het
  uitpakken toetst, is geen limiet.
- **Elke lengte uit een bestandsheader is een leugen tot het tegendeel blijkt.** `compSize`,
  `uncompressedSize`, `nameLen`, `extraLen` en het EOCD-entryaantal komen uit het bestand; toets ze
  tegen `buffer.byteLength` vóór je er een `Uint8Array`-view of een lus op maakt.
- **Strings begrensd.** Ieder veld uit een bestand wordt getrimd, op lengte en op stuurtekens
  gecontroleerd vóór het in state of in een `Map`-sleutel belandt (`boundedCell`/`hasControlChar`).
- **Geen XML-entiteitsdeclaraties.** Een `<!DOCTYPE`/`<!ENTITY` in een part is een weigering, geen
  parseeropdracht.
- **Geen module-level muteerbare singletons.** Geen cache, geen "laatst gelezen werkmap", geen teller
  buiten een functie. De hele zip/xlsx-laag is puur en injecteerbaar.
- **Elke `try`/`catch`-wrapper krijgt een eigen rode-pad-fixture.** Een `catch` zonder test is een
  verborgen stille weigering.
- **Fixtures worden nooit naar de implementatie toe geschreven.** Schrijf op wat Excel/de gebruiker zou
  zien, niet wat de code toevallig teruggeeft. De CRC-32- en serieel-datumvectoren komen van buiten.
- **Testcommentaren claimen alleen wat mutatie-bewezen is.**
- **Vlak vóór `git commit`: eerst `git status --short`, en stage alleen je eigen bestanden.** Geen
  `git add -A`, geen `tests/planning/.*.mjs`-artefacten, geen `dist/`, geen andermans baan.
- **Poorten oordelen op de exitcode.** `bash tests/planning/run.sh` print "alles groen" óók bij exit 1.
  `echo "exit: $?"` is verplicht. `grep -c '^XX'` is géén poort.
- **Meldingen blijven in-app.** Geen `alert()`, geen `confirm()`, geen native dialoog behalve de
  bestandskiezer.
- **Nooit `s.scheduleStale` of `s.isDirty` direct zetten** — altijd via `finishMutation`/`markScheduleStale`.
- **Nooit een datum raden.** Een onleesbare cel is `unreadable`; een serieel getal onder 61 is
  onleesbaar. Er is in dit hele pad geen plek waar "vandaag" hoort.
- **Kom je een plek tegen waar Excel het bestand weigert en je niet weet waarom** — meld dat aan de
  orkestrator in plaats van parts bij te bouwen tot het toevallig werkt. De kindvolgordes in *X4* zijn
  de eerste plek om te kijken.

---

## Tests & poorten (samenvatting)

| poort | wat hij hier bewaakt |
|---|---|
| `tests/planning/check-xlsx-primitives.ts` | de escaper (incl. `_xHHHH_` en de `_x`-zelfontsnapping) en de seriële datums (1900-bug, 1904, tijddeel, weigering < 61), onder de tijdzonematrix |
| `tests/planning/check-zip.ts` | CRC-32 tegen bekende vectoren, schrijf/lees-round-trip in beide compressietakken, determinisme, en de drie nieuwe weigeringen: zip-bom (mét `bytesSeen`-bewijs), ratio, Zip64 |
| `tests/planning/check-progress-xlsx-writer.ts` | de partstructuur: kindvolgordes van worksheet en styleSheet, de fills/fonts/borders-minima, kolombreedtes, `sheetProtection`-polariteit, de twee `dataValidation`s, datum- en getalcellen, instructies en em-dash-markering |
| `tests/planning/check-progress-import-xlsx.ts` | **de poort van deze etappe**: round-trip met nul wijzigingen en nul weigeringen, `noAmbiguity` (geen datumvraag), één gewijzigde cel = één toepassing, sharedStrings, percentage-`numFmt`, sparse rijnummers, en alle bestandsgrenzen |
| bestaande `tests/planning/check-ext-integrity.ts` / `check-ext-consent.ts` | bewijzen dat de zip-lift gedragsneutraal is voor extensies |
| bestaande `tests/planning/check-progress-import-csv.ts` | bewijst dat de `sheetColumns`-lift gedragsneutraal is |
| `tests/browser/progress-import.spec.ts` | exporteren en terugimporteren als échte gebruikershandeling, met nul wijzigingen als uitkomst |
| `npm run verify:i18n` | veertien locales, twee namespaces |
| `npm run verify:docs` | gids `nl` + `en` |
| `npm run verify:cycles` | `zip/` en `xlsx/` zijn bladlagen; `progressImport` importeert er alleen ván |
| `npm run verify` | **de** eindpoort — exitcode, machinebreed één tegelijk |

**Twee controles die géén CI-poort zijn en dat ook niet moeten worden:**

1. **Een echte spreadsheet.** Geen enkele assertie hierboven bewijst dat *Excel* het bestand opent. Doe
   lokaal minstens: `soffice --headless --convert-to csv <blad>.xlsx` (exitcode én inhoud), en open het
   blad daarna handmatig één keer in LibreOffice Calc om de vier E9-eisen met het oog te controleren —
   breedtes, slot (typen in een vergrendelde cel moet geweigerd worden), validatie (typ `150` in de
   percentagekolom) en de datumweergave. Vooral de `sheetProtection`-polariteit uit *X5* is met het
   blote oog zichtbaar en met een test niet.
2. **`CompressionStream` in de Tauri-webview.** Meet het één keer op Linux (WebKitGTK) via de
   DebugTerminal: `typeof CompressionStream`. Bestaat hij niet, dan valt de schrijver terug op store en
   is het blad groter — dat is een gemeten feit dat in de gids en in dit plan hoort, geen aanname.
   Rapporteer de uitkomst aan de orkestrator.

---

## Openstaande eigenaarsvragen (met de default die dit plan kiest)

| # | vraag | default in dit plan |
|---|---|---|
| **Q1** | Vervangt `.xlsx` de knop, of komt er een tweede knop naast? | **Vervangt** (*X10*). Eén knop = het beste antwoord; CSV blijft als exportkaart en als leesformaat. Terugdraaien kost één extra `RibbonButtonSpec`. |
| **Q2** | Exporteert het `.xlsx`-blad het percentage met decimalen (afwijkend van CSV)? | **Ja** (*X6*). De landinstellingen-valstrik die A1 tot afronden dwong bestaat in een getalcel niet. Gevolg: de xlsx-round-trip is exacter dan de CSV-round-trip. |
| **Q3** | Meldt de PDF-export voortaan dat hij in de downloadmap is beland (`viaDownload`)? | **Nee, gedrag blijft gelijk.** Dat is een eigen verbetering met een eigen meldingsvraag; hem meenemen zou deze etappe stil uitbreiden. Kost later drie regels. |
| **Q4** | Krijgen de invulkolommen ook een `dataValidation`-**prompt** (het gele tooltipje bij selectie)? | **Ja**, met dezelfde teksten als de kopcel — nul extra i18n-sleutels, en precies de begeleiding die E8/E9 vragen. Storend? Eén attribuut weghalen. |
| **Q5** | Moet het blad ook beschermd zijn tegen rijen invoegen/verwijderen? | **Ja, via de standaard.** `insertRows`/`deleteRows` blijven op hun default (verboden onder bladbeveiliging); we zetten er niets voor. Een ingevoegde rij zou toch geen `OPS Task ID` dragen en netjes als `unmatched` in de koppelsectie belanden. |
| **Q6** | Moeten de onderlagen (`zip/`, `xlsx/`) ook door andere exports gebruikt worden (rapport als werkmap, volle takenlijst)? | **Niet in deze etappe.** De lagen zijn er algemeen genoeg voor; dat is een vervolg met een eigen ontwerpvraag, geen afgeleide belofte. |
