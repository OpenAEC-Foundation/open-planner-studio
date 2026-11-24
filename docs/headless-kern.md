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
metModel.schedule().foreignContent;              // { format, schema, objectCount } of null
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
| `PlannerCoreError` | Het enige fouttype. Heeft `code` en `details`. |
| `VERSION` | De versie van het pakket (gelijk aan de appversie). |
| typen | `ScheduleSummary`, `ScheduleTaskSummary`, `ScheduleWarning`, `ForeignContentSummary`, `PlannerDocument`, `CoreErrorCode` |

**Twee routes: tekst en bytes (#804).** In de app staat het openen en bewaren van een gebouwmodel achter de flag
`ifcForeignContent`. Die flag staat in de `localStorage` van het venster; de kern heeft geen venster. Het ontwerp
(`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`, §4.12) zegt niets over de flag in de kern.
Daarom is de keuze van de ingang hier de flag:

- `openIfc(text)` en `toIfc()` zijn de tekstroute van main, zoals de app met de flag uit. De lezer weigert een bestand met
  een gebouwmodel (`IFC_READ_FAILED`). Een bestand met alleen gegevens van een ander programma (bijv. een externe pset)
  opent en rekent, maar `toIfc()` weigert vóór uitvoer met `IFC_WRITE_FAILED`; `details.reason` is de uitkomst van de
  scan (`foreign`, `unreadable`, …): de tekstroute bewaart dat deel niet. `foreignContent` is op deze route altijd `null`.
  `toIfcBytes()` van zo'n document is de UTF-8 van `toIfc()`, met dezelfde weigering.
- `openIfcBytes(bytes)` en `toIfcBytes()` zijn de bytes-route, zoals de app met de flag aan: de kern zet de flag in de
  eigen context van het document. De app zelf gebruikt de kern niet; met de flag uit blijft zij gelijk aan main. De
  kern kopieert de invoer: wie zijn buffer daarna wijzigt, verandert het document niet. Het lezen is dezelfde
  bytes-route als Bestand → Openen (`readIfcBytes`, de scanner zonder Worker). Alleen de technische grens van 300 MiB
  geldt (`IFC_FOREIGN_SCAN_MAX_BYTES`), niet de productgrens van 150 MiB voor het openen in de app (ontwerp §4.13).
  `toIfcBytes()` beslist en schrijft zoals Ctrl+S (`prepareIfcOutput` met `buildWriteIFCInput(…, 'merge')`). Zonder
  vreemd deel is dat dezelfde IFC als `toIfc()`. Met een vreemd deel blijft alles wat niet de eigen planning is byte voor
  byte staan; verandert de planning niet, dan komt het hele bestand byte-gelijk terug, ook na `schedule()` en ook met
  bytes die geen geldige UTF-8 zijn. Kan de samenvoeging het vreemde deel bij de wijziging nog niet bewaren, dan weigert
  hij vóór uitvoer met `IFC_WRITE_FAILED` en `details.reason` `merge-needs-phase2`; fase 2 van #804 maakt die gevallen
  kleiner. `toIfc()` van een document met een vreemd deel weigert met `details.reason` `foreign`: als tekst zouden bytes
  die geen geldige UTF-8 zijn verloren gaan.
- Het ontwerp zegt dat `openIfc(text)`/`toIfc()` blijven en alleen byte-gelijk zijn voor geldige UTF-8. Dat geldt pas als
  de flag er in de app af gaat (#804, PR 13): tot dan blijft de tekstroute gelijk aan main.
- Een IFC met een UTF-8-BOM vóór de kop weigert de bytes-route nu, net als de app met de flag aan (knownbug 2212). Op de
  tekstroute opent hij.

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
  (`IFC4X3_ADD2`, `IFC4`, …), `objectCount` het aantal entiteiten dat niet tot de eigen planning hoort. `null` op de
  tekstroute en als er naast de planning niets is.

Datums zijn ISO-8601-tekst zoals de app ze bewaart: een datum (`2027-03-01`) of, bij urenplanning,
datum en tijd.

## Foutmodel

Elke fout is een `PlannerCoreError` met een vaste `code`. Ook een onverwachte fout in de app-route
(bij openen, rekenen of schrijven) komt als `PlannerCoreError` naar buiten. De `message` is Engels en is voor mensen,
niet om te parsen.

| code | wanneer |
|---|---|
| `INVALID_INPUT` | De invoer is geen tekst (`openIfc`) of geen `Uint8Array` (`openIfcBytes`), is leeg, of begint (na een eventuele BOM en witruimte) niet met `ISO-10303-21;`. |
| `IFC_READ_FAILED` | De IFC-lezer kan het bestand niet lezen, of het openen in de store mislukt (bijv. bij een extreem diepe WBS, knownbugs.md). Ook: een gebouwmodel op de tekstroute, en op de bytes-route een bestand dat de bytes-route niet veilig kan openen (een IFC2X3-model, een scan die faalt, boven 300 MiB met vreemde inhoud). |
| `NO_TASKS` | Het bestand heeft geen taken. |
| `SCHEDULE_FAILED` | De planning is niet te berekenen, bijv. door een kring in de relaties, of de berekening gooit een fout. `details.reason` heeft de solvertekst, `details.taskIds` de taken van de kring. |
| `IFC_WRITE_FAILED` | Het schrijven naar IFC mislukt of wordt vóór uitvoer geweigerd. `details.reason`: `foreign` of een andere scanuitkomst (een vreemd deel dat deze route niet bewaart), `merge-needs-phase2` (de samenvoeging kan het vreemde deel bij deze wijziging nog niet bewaren). |

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
| `tests/planning/check-headless-core.ts` | Voor elk voorbeeld in `examples/` en `public/examples/` geeft de kern dezelfde datums, speling, kritieke vlag, projecteinde en kritiek pad als de app-store (`loadState` → `runCPM`). Verder: `toIfc` → `openIfc` geeft dezelfde datums, twee documenten zijn los, de foutcodes kloppen (ook 6.000 geneste taken geeft een `PlannerCoreError`), een weggelaten XER-archief geeft `XER_ARCHIVE_DROPPED`, `toIfc()` vóór `schedule()` is gelijk aan de app na openen, en een oud bestand meldt `MINUTE_MODEL_CONVERTED` in `openWarnings` (een nieuw bestand niet). De bytes-route: voor elk voorbeeld dezelfde samenvatting en byte voor byte dezelfde IFC als de tekstroute (bij één vaste schrijftijd); een eigen planning met een gebouwmodel en een model met een rauw Latin-1-byte komen byte-gelijk terug, vóór en na `schedule()`, met `foreignContent` en dezelfde datums als de app met de flag aan; een externe pset blijft staan; de weigeringen (`foreign`, `merge-needs-phase2`) en de invoerfouten. |
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
