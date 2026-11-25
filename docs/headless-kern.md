# Headless kern: `@openaec/open-planner-core`

De headless kern is de rekenkern van Open Planner Studio als los Node-pakket. Het pakket heeft geen
React, geen DOM en geen desktopschil. Het opent een IFC-planning, rekent die door zoals de app en
geeft een JSON-samenvatting. Het kan de planning ook weer als IFC schrijven. Een bestand met een
gebouwmodel of met gegevens van een ander programma opent en bewaart het als bytes (`openIfcBytes`).

Dit document hoort bij issue #429 (ecosystem readiness) en het gedeelde contract in
OpenAEC-style-book#12 (library en AWS).

## Grens van de library

| deel | waar | publiek? |
|---|---|---|
| API-module | `src/core/index.ts` | ja: alles wat hij exporteert |
| publieke typen | `src/core/api.ts` (importeert niets) | ja |
| store, solver, IFC-lezer en -schrijver | `src/state/`, `src/engine/`, `src/services/` | nee, intern |
| pakketbouw | `scripts/build-core.mjs` → `dist-core/` | nee |
| consumeervoorbeeld | `headless/consumer-example/` | voorbeeld, geen deel van het pakket |

- Elk document krijgt een eigen storecontext (`createAppStoreContext` uit
  `src/state/appStoreFactory.ts`). Documenten delen niets met elkaar.
- De kern gebruikt niet de app-singleton (`appStoreContext`/`useAppStore` in `src/state/appStore.ts`).
  `npm run verify:store-boundaries` weigert elke waarde-import uit `appStore.ts` in `src/core/`.
- `npm run build:core` controleert de bundel. De bouw faalt als React, React DOM, `@tauri-apps/*`,
  `src/state/appStore.ts`, `src/components/` of de i18n-UI-config (`src/i18n/config.ts` met alle
  taalbestanden) in de bundel komt.
- Code die alleen achter een dynamische import of een React-hook staat (bijv. Tauri-bestandstoegang),
  vervangt de bouw door een stub. Die stub gooit pas een fout als iemand hem gebruikt. De
  rekenroute gebruikt hem niet; `check-headless-core.ts` en `verify:core-package` bewijzen dat.
- `zustand` gebruikt in het pakket alleen de vanilla store, zonder React-hook.

## API

```js
import { openIfc, openIfcBytes, PlannerCoreError, VERSION } from '@openaec/open-planner-core';

const doc = await openIfc(ifcTekst);  // PlannerDocument
const samenvatting = doc.schedule();  // doorrekenen zoals F5 in de app
const ifc = doc.toIfc();              // IFC-tekst met de berekende datums

const metModel = await openIfcBytes(ifcBytes);   // bijv. readFileSync(pad): een Uint8Array
metModel.schedule().foreignContent;              // { format, schema, objectCount }, alleen als er iets bewaard blijft
const bytes = await metModel.toIfcBytes();       // alles naast de planning byte voor byte terug
```

| export | wat |
|---|---|
| `openIfc(text): Promise<PlannerDocument>` | Opent IFC-tekst zoals Bestand → Openen in de app (`openAsDocument`), zonder opslagdoel. Dat openen rekent al door, net als in de app (zie hieronder). De tekstroute van main: zie *Twee routes*. |
| `openIfcBytes(bytes): Promise<PlannerDocument>` | Opent een IFC als bytes (`Uint8Array`) via de bytes-route van de app met de flag `ifcForeignContent` aan: een gebouwmodel en gegevens van andere programma's blijven bewaard. Verder als `openIfc`. |
| `PlannerDocument.openWarnings: ScheduleWarning[]` | De waarschuwingen van het openen (`XER_ARCHIVE_DROPPED`, `MINUTE_MODEL_CONVERTED`), direct na `openIfc()`, dus ook vóór `toIfc()` zonder `schedule()`. Leeg als het openen niets te melden had. |
| `PlannerDocument.schedule(): ScheduleSummary` | Draait `runCPM` op de store van dit document: dezelfde route als F5, met de werkregels en het rekenprofiel van het project. Geeft de samenvatting. |
| `PlannerDocument.toIfc(): string` | Schrijft het document als IFC-tekst (`writeIFC(buildWriteIFCInput(...))`), in het IFC-schema van het project. Weigert een document met een vreemd deel. |
| `PlannerDocument.toIfcBytes(): Promise<Uint8Array>` | Schrijft het document als bytes, met dezelfde beslissing en samenvoeging als Ctrl+S in de app (`prepareIfcOutput`). Elke aanroep geeft een eigen buffer. |
| `PlannerCoreError` | Het enige fouttype. Heeft `code` en `details` (zie *Foutmodel*). |
| `VERSION` | De versie van het pakket (gelijk aan de appversie). |
| typen | `ScheduleSummary`, `ScheduleTaskSummary`, `ScheduleWarning`, `ForeignContentSummary`, `IfcWriteRefusalReason`, `PlannerDocument`, `CoreErrorCode` |

**Twee routes: tekst en bytes (#804).** In de app staat het openen en bewaren van een gebouwmodel achter de flag
`ifcForeignContent`. Die flag staat in de `localStorage` van het venster; de kern heeft geen venster. Het ontwerp
(`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`, §4.12) zegt niets over de flag in de kern.
Daarom is de keuze van de ingang hier de flag:

- `openIfc(text)` en `toIfc()` zijn de tekstroute van main, zoals de app met de flag uit. De lezer weigert een bestand met
  een gebouwmodel (`IFC_READ_FAILED`). Een bestand met alleen gegevens van een ander programma (bijv. een externe pset)
  opent en rekent, maar `toIfc()` weigert vóór uitvoer met `IFC_WRITE_FAILED`; `details.reason` is de uitkomst van de
  scan (`foreign`, `unreadable`, …): de tekstroute bewaart dat deel niet. De samenvatting heeft op deze route geen
  `foreignContent`, en is daarmee byte voor byte die van main.
  `toIfcBytes()` van zo'n document is de UTF-8 van `toIfc()`, met dezelfde weigering.
- **Sinds #1219 (herstelronde 3) weigert `toIfc()` ook een planning zonder vreemd stuk, als de gewone writer een slot van de
  planning niet teruggeeft.** De poort is `textWriteCheck` in `targetForeignScan.ts`, gedeeld met de headless MCP-server: na
  de scan op een model en op C, A en V vergelijkt hij de bron per slot met de uitvoer van de gewone writer voor de stand
  direct na het openen (de maat per slot staat in [headless-mcp.md](headless-mcp.md), *Bewezen eigen, per slot*). Die
  uitvoer maakt de kern pas bij de eerste `toIfc()`, zodat `openIfc` niet trager wordt. De fout is de bestaande:
  `IFC_WRITE_FAILED` met `details.reason` `foreign`; het contract (`api.ts`) verandert niet. Main had hier hetzelfde gat.
  Voorbeeld: het villavoorbeeld met taak #52 als `#52=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',$,'Set up site',$,$,'1.1',$,$,'Werkwijze uit ander pakket',.F.,$,#51,.LOGISTIC.);`
  (`OwnerHistory = $`, een `WorkMethod` van een ander programma). Main schreef met `toIfc()` een IFC met
  `#52=IFCTASK('1tOTGtWTg8bYqp7BjjuF0J',#6,'Set up site',$,$,'1.1',$,$,$,.F.,$,#51,.LOGISTIC.);`, dus zonder de werkwijze;
  nu weigert `toIfc()` (ook na `openIfcBytes`) vóór uitvoer met `IFC_WRITE_FAILED:foreign`. Openen, rekenen en de
  samenvatting blijven die van main. Oude eigen bestanden schrijven zoals op main: de toets kent voor de naam van het
  lopende werkschema ook de eerdere vaste waarde `Bouwplanning v1.0`, die OPS tot #39 (28 juli 2026) schreef.
- **`openIfcBytes(bytes)` kiest de bytes-route alleen voor een bestand waarvan ze een vreemd deel bewaart** (`src/core/index.ts`,
  `openIfcBytes` en `documentKeepingForeignContent`). De kern maakt één eigen kopie van de invoer; wie zijn buffer
  daarna wijzigt, verandert niets. Met die kopie probeert hij de bytes-route van de app met de flag aan
  (`readIfcBytes`, de scanner zonder Worker; de kern zet de flag in de eigen context van het document). Levert die een
  document waarvan de bron een vreemd deel draagt (`hasForeignContent(ifcSource)`, het kenmerk van de app), dan is dat
  het document, en blijft het vreemde deel bewaard. Main weigerde zo'n bestand: met een gebouwmodel al bij het openen,
  met alleen gegevens van een ander programma bij het schrijven. In **elk** ander
  geval (de bytes-route kan niet lezen; ze leest maar er is geen vreemd deel; de IFC2X3-terugval; nul taken; welke fout
  dan ook) opent dezelfde kopie via precies de tekstroute van main: decoderen als UTF-8 met de BOM erin (zoals
  `Buffer.toString` op main), dan `openIfc`. Dat document is in alles een tekstdocument van main: dezelfde samenvatting,
  dezelfde schrijfcontroles (ook de vreemdedeelscan vóór uitvoer), dezelfde bytes en dezelfde fouten. Een bestand
  zonder vreemd deel krijgt zo de uitkomst van `openIfc`: die van main, op de slottoets van #1219 na. Een bestand mét een vreemd deel
  leest de bytes-route volgens de regels van de app voor zulke bestanden, en dat kan een andere planning geven dan
  `openIfc` voor dezelfde bytes (knownbug 2252). De HTTP-API gebruikt alleen de tekstroute en geeft op elk verzoek
  precies het antwoord van main ([headless-api.md](headless-api.md)).
- Welk soort document het is, zegt `foreignContent` in de samenvatting: staat het erin, dan bewaart het document een
  vreemd deel; ontbreekt het, dan is het een tekstdocument. Schrijf een tekstdocument met `toIfc()` (zoals main; `toIfcBytes()` geeft er de
  UTF-8 van). Schrijf een document met een vreemd deel met `toIfcBytes()`: dat beslist en schrijft zoals Ctrl+S
  (`prepareIfcOutput` met `buildWriteIFCInput(…, 'merge')`). Byte voor byte blijven dan het vreemde deel en de kop staan,
  ook een UTF-8-BOM vóór de kop en bytes die geen geldige UTF-8 zijn; verandert de planning niet, dan komt het hele
  bestand byte-gelijk terug, ook na `schedule()`. Kan de samenvoeging het vreemde deel bij de wijziging nog niet
  bewaren, dan weigert hij vóór uitvoer met `IFC_WRITE_FAILED` en `details.reason` `merge-needs-phase2`; fase 2 van #804
  maakt die gevallen kleiner. `toIfc()` van zo'n document weigert met `details.reason` `foreign`. Alleen de technische
  grens van 300 MiB geldt (`IFC_FOREIGN_SCAN_MAX_BYTES`), niet de productgrens van 150 MiB van de app (ontwerp §4.13).
- Een IFC2X3-bestand bewaart de bytes-route niet (ontwerp §4.11), dus het loopt de tekstroute van main: een planning
  zonder iets ernaast schrijft, een planning met bijv. een externe pset weigert schrijven met `foreign`, met of zonder
  BOM.
- Het ontwerp zegt dat `openIfc(text)`/`toIfc()` blijven en alleen byte-gelijk zijn voor geldige UTF-8. Dat geldt pas als
  de flag er in de app af gaat (#804, PR 13): tot dan blijft de tekstroute gelijk aan main.

**Openen rekent al door.** De kern volgt de app: Bestand → Openen rekent het project meteen door.
Wijkt die uitkomst af van de datums in het bestand, dan kan het document (zoals in de app) de datums
uit het bestand tonen ("datums zoals opgeslagen", `docs`-rule `state`). `toIfc()` direct na
`openIfc()` schrijft dus de stand van de app na het openen, niet per se de datums uit de invoer.
`schedule()` rekent opnieuw door zoals F5 en verlaat die stand; daarna bevat `toIfc()` de berekende
datums.

**Een oud bestand wordt bij het openen omgerekend.** Een IFC zonder de markering `TimeModel` (van een
oudere versie van de app) is niet in minuten berekend. Het openen rekent het om, net als in de app
(besluit B5 in `docs/superpowers/specs/2026-10-20-alleen-uren-design.md`). Krijgen taken daardoor een
ander begin of einde, dan staat dat meteen in `openWarnings` als `MINUTE_MODEL_CONVERTED`: `ids` zijn
die taken, `maxShiftWorkdays` is de grootste verschuiving in werkdagen (één decimaal). De app meldt
hetzelfde met een melding. `toIfc()` schrijft de nieuwe datums, met de markering. Een nieuw bestand
meldt niets.

De samenvatting (`formatVersion: 1`) bevat:

- `project`: id, naam, rekenprofiel, start, berekend einde, duur in werkdagen;
- `counts`: taken, samenvattingstaken, mijlpalen, relaties, resources, toewijzingen, kritieke taken;
- `tasks`: per taak id, naam, WBS, ouder, samenvatting ja/nee, mijlpaal ja/nee, vroege start en einde,
  late start en einde, totale speling (werkdagen) en kritiek ja/nee, in de volgorde van het bestand;
- `criticalPath`: de taak-id's van het kritieke pad;
- `warnings`: waarschuwingen van de berekening met een vaste code en de betrokken id's
  (`CONSTRAINT_VIOLATED`, `DEADLINE_MISSED`, `OUT_OF_SEQUENCE`, `CALENDAR_CAPPED`,
  `RELATION_IGNORED`, `HAMMOCK_WITHOUT_FINISH_DRIVER`), plus de waarschuwingen van het openen (ook in
  `openWarnings`): `XER_ARCHIVE_DROPPED` en `MINUTE_MODEL_CONVERTED`. `XER_ARCHIVE_DROPPED` komt als
  het bestand een P6-bronarchief (XER) had dat niet bruikbaar is. De lezer laat het archief dan weg,
  en `toIfc()` schrijft het niet meer mee. `detail` geeft de reden (`bytes-missing`,
  `hash-mismatch`, …); de app meldt hetzelfde verlies bij het openen. `MINUTE_MODEL_CONVERTED` staat
  hierboven;
- `foreignContent`: wat het document naast de planning bewaart en ongewijzigd terugschrijft (een gebouwmodel, gegevens
  van andere programma's), als `{ format: 'ifc', schema, objectCount }`: `schema` is de schemanaam uit de kop
  (`IFC4X3_ADD2`, `IFC4`, …), `objectCount` het aantal entiteiten dat niet tot de eigen planning hoort. Het veld
  ontbreekt bij elk tekstdocument: van `openIfc`, en van `openIfcBytes` als de bytes-route niets bewaart (ook bij een
  IFC2X3-bestand met meer dan de planning). Zo is de samenvatting van een tekstdocument die van main. Een ontbrekend
  veld zegt dus niet dat de invoer niets naast de planning had. Samenvatten doet geen
  schrijfcontrole: of schrijven mag, zegt pas `toIfc()` of `toIfcBytes()`.

Datums zijn ISO-8601-tekst zoals de app ze bewaart: een datum (`2027-03-01`) of, bij urenplanning,
datum en tijd.

## Foutmodel

Elke fout is een `PlannerCoreError` met een vaste `code`. Ook een onverwachte fout in de app-route
(bij openen, rekenen of schrijven) komt als `PlannerCoreError` naar buiten. De `message` is Engels en is voor mensen,
niet om te parsen.

| code | wanneer |
|---|---|
| `INVALID_INPUT` | De invoer is geen tekst (`openIfc`) of geen `Uint8Array` (`openIfcBytes`), is leeg, of begint (na een eventuele BOM en witruimte) niet met `ISO-10303-21;`. |
| `IFC_READ_FAILED` | De IFC-lezer kan het bestand niet lezen, of het openen in de store mislukt (bijv. bij een extreem diepe WBS, knownbugs.md). Ook: een gebouwmodel op de tekstroute, zoals main. `openIfcBytes` opent zo'n bestand als de bytes-route het model bewaart en er een planning in staat; een model zonder taken of in een schema dat de bytes-route niet bewaart (bijv. IFC2X3) geeft ook daar deze fout. `openIfcBytes` geeft de fouten van de tekstroute van main, behalve voor een bestand waarvan de bytes-route het vreemde deel bewaart. |
| `NO_TASKS` | Het bestand heeft geen taken. |
| `SCHEDULE_FAILED` | De planning is niet te berekenen, bijv. door een kring in de relaties, of de berekening gooit een fout. `details.reason` heeft de solvertekst, `details.taskIds` de taken van de kring. |
| `IFC_WRITE_FAILED` | Het schrijven naar IFC mislukt of wordt vóór uitvoer geweigerd. `details.reason` (type `IfcWriteRefusalReason`): `foreign` (een vreemd deel dat deze route niet bewaart), `model` of `unreadable` (de andere scanuitkomsten van de tekstroute), `merge-needs-phase2` (de samenvoeging kan het vreemde deel bij deze wijziging nog niet bewaren). |

## Versiemodel

- De pakketversie is de appversie (`JJJJ.W.N`: ISO-weekjaar, ISO-week zonder voorloopnul, volgnummer vanaf 0). `npm run bump` kiest de volgende versie uit vandaag, actuele origin-tags en de huidige versie (en stopt als origin niet bereikbaar is); `build-core.mjs` neemt die uit `package.json` over. De API-server, het consumeervoorbeeld en de OpenAPI-documentversie volgen hetzelfde nummer.
- Het publieke contract is `src/core/api.ts` plus de exports van `src/core/index.ts`. Een wijziging
  daar is een contractwijziging en hoort in de releasetekst.
- Een nieuw veld of een nieuwe code is een uitbreiding. Een veld weghalen of een betekenis veranderen
  is brekend en verhoogt `formatVersion` van de samenvatting.
- Het pakket wordt (nog) niet naar npm gepubliceerd. Een consument installeert de tarball van
  `npm pack`.

## Licentie

Het pakket heeft dezelfde licentie als de repository: `LGPL-3.0-or-later`. De bouw kopieert
`LICENSE` en `LICENSE.GPL` in het pakket.

De bundel bevat ook code van dependencies: nu zustand, immer en i18next, alle drie MIT. De bouw
leidt die lijst af uit de esbuild-metafile en schrijft per pakket naam, versie, licentie en de
volledige licentietekst uit `node_modules` in `THIRD-PARTY-NOTICES.md`. Een gebundeld pakket zonder
licentiebestand laat de bouw falen. `verify:core-package` controleert dat het bestand in de tarball
zit, met de licentietekst van elk pakket.

## Bouwen en consumeervoorbeeld

```bash
npm run build:core                       # → dist-core/ (index.mjs, index.d.ts, api.d.ts, package.json, THIRD-PARTY-NOTICES.md, …)
cd headless/consumer-example
npm install                              # installeert dist-core als pakket
node index.mjs ../../examples/01-grachtenpand-amsterdam.ifc
node index.mjs ../../examples/01-grachtenpand-amsterdam.ifc --json --out /tmp/herberekend.ifc
node index.mjs ../../tests/fixtures/ifc-foreign/eigen-plus-model.ifc --bytes --out /tmp/met-model.ifc
```

Met `--bytes` gebruikt het voorbeeld `openIfcBytes` en `toIfcBytes()`. Het voorbeeld importeert alleen `@openaec/open-planner-core`, nooit code uit `src/`.

- Node 22 of nieuwer, alleen ESM.
- Het pakket heeft geen runtime-dependencies; de bundel is ongeveer 2 MB.

## Tests

| test | wat hij bewijst |
|---|---|
| `tests/planning/check-headless-core.ts` | Voor elk voorbeeld in `examples/` en `public/examples/` geeft de kern dezelfde datums, speling, kritieke vlag, projecteinde en kritiek pad als de app-store (`loadState` → `runCPM`). Verder: `toIfc` → `openIfc` geeft dezelfde datums, twee documenten zijn los, de foutcodes kloppen (ook 6.000 geneste taken geeft een `PlannerCoreError`), een weggelaten XER-archief geeft `XER_ARCHIVE_DROPPED`, `toIfc()` vóór `schedule()` is gelijk aan de app na openen, en een oud bestand meldt `MINUTE_MODEL_CONVERTED` in `openWarnings` (een nieuw bestand niet). De bytes-route: voor elk voorbeeld dezelfde samenvatting en byte voor byte dezelfde IFC als de tekstroute (bij één vaste schrijftijd); een eigen planning met een gebouwmodel en een model met een rauw Latin-1-byte komen byte-gelijk terug, vóór en na `schedule()`, met `foreignContent` en dezelfde datums als de app met de flag aan; een externe pset blijft staan; een IFC met UTF-8-BOM opent in kern en app met dezelfde samenvatting als via tekst, en een modelbestand met BOM komt byte-gelijk terug, ook na een merge met een gewijzigde taaknaam (BOM en modelregels blijven staan); een IFC2X3-planning met en zonder externe pset, met en zonder BOM, schrijft of weigert zoals main; een Bonsai-planning met een verouderde vroege start schrijft na `schedule()` met hetzelfde vreemde deel; de weigeringen (`foreign`, `merge-needs-phase2`) en de invoerfouten. En één lus die de regel van `openIfcBytes` pint: voor het hele corpus (de voorbeelden, de oude-tags-fixtures, een IFC2X3-planning, een leeg eigen werkschema met één baselinetaak), kaal, met BOM en met BOM en een spatie, geeft `openIfcBytes` dezelfde samenvatting, uitvoer en fouten als de tekstingang van main, en bewaart hij alleen een vreemd deel waar main het schrijven weigerde. Een samenvatting zonder vreemd deel heeft geen `foreignContent`, zoals main. |
| `npm run verify:core-package` | Bouwt het pakket, maakt een tarball met `npm pack`, installeert die in een kopie van het consumeervoorbeeld, controleert `THIRD-PARTY-NOTICES.md`, draait het voorbeeld (verwachte uitkomst, herberekend IFC, foutcode; met `--bytes` een modelbestand dat byte-gelijk terugkomt, en hetzelfde bestand als tekst geweigerd) en typecheckt een kleine TypeScript-consument tegen de declaraties. |
| `tests/planning/check-store-runtime-boundaries.ts` | De grens: een waarde-import uit `appStore` in `src/core/` maakt `verify:store-boundaries` rood. |

## Wat de kern niet doet

- Geen andere invoerformaten (MSPDI, XER, `.mpp`, CSV). De lezers bestaan in de app; de kern
  biedt ze nog niet aan.
- Geen bewerkingen op de planning (taken toevoegen, nivelleren). Daarvoor zijn er de `planner_*`-tools:
  in de app via de MCP-koppeling, of zonder app via de [headless MCP-server](headless-mcp.md)
  (`npm run build:mcp-server`). Die server deelt de grenscontrole van de bundel met deze kern
  (`scripts/lib/headless-bundle.mjs`).
- Geen native DLL of `.so`. Dat is een apart punt van issue #429.
