# Headless kern: `@openaec/open-planner-core`

De headless kern is de rekenkern van Open Planner Studio als los Node-pakket. Het pakket heeft geen
React, geen DOM en geen desktopschil. Het opent een IFC-planning, rekent die door zoals de app en
geeft een JSON-samenvatting. Het kan de planning ook weer als IFC schrijven.

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
import { openIfc, PlannerCoreError, VERSION } from '@openaec/open-planner-core';

const doc = await openIfc(ifcTekst);  // PlannerDocument
const samenvatting = doc.schedule();  // doorrekenen zoals F5 in de app
const ifc = doc.toIfc();              // IFC-tekst met de berekende datums
```

| export | wat |
|---|---|
| `openIfc(text): Promise<PlannerDocument>` | Opent IFC-tekst zoals Bestand → Openen in de app (`openAsDocument`), zonder opslagdoel. Dat openen rekent al door, net als in de app (zie hieronder). |
| `PlannerDocument.schedule(): ScheduleSummary` | Draait `runCPM` op de store van dit document: dezelfde route als F5, met de werkregels en het rekenprofiel van het project. Geeft de samenvatting. |
| `PlannerDocument.toIfc(): string` | Schrijft het document als IFC (`writeIFC(buildWriteIFCInput(...))`), in het IFC-schema van het project. |
| `PlannerCoreError` | Het enige fouttype. Heeft `code` en `details`. |
| `VERSION` | De versie van het pakket (gelijk aan de appversie). |
| typen | `ScheduleSummary`, `ScheduleTaskSummary`, `ScheduleWarning`, `PlannerDocument`, `CoreErrorCode` |

**Openen rekent al door.** De kern volgt de app: Bestand → Openen rekent het project meteen door.
Wijkt die uitkomst af van de datums in het bestand, dan kan het document (zoals in de app) de datums
uit het bestand tonen ("datums zoals opgeslagen", `docs`-rule `state`). `toIfc()` direct na
`openIfc()` schrijft dus de stand van de app na het openen, niet per se de datums uit de invoer.
`schedule()` rekent opnieuw door zoals F5 en verlaat die stand; daarna bevat `toIfc()` de berekende
datums.

De samenvatting (`formatVersion: 1`) bevat:

- `project`: id, naam, rekenprofiel, start, berekend einde, duur in werkdagen;
- `counts`: taken, samenvattingstaken, mijlpalen, relaties, resources, toewijzingen, kritieke taken;
- `tasks`: per taak id, naam, WBS, ouder, samenvatting ja/nee, mijlpaal ja/nee, vroege start en einde,
  late start en einde, totale speling (werkdagen) en kritiek ja/nee, in de volgorde van het bestand;
- `criticalPath`: de taak-id's van het kritieke pad;
- `warnings`: waarschuwingen van de berekening met een vaste code en de betrokken id's
  (`CONSTRAINT_VIOLATED`, `DEADLINE_MISSED`, `OUT_OF_SEQUENCE`, `CALENDAR_CAPPED`,
  `RELATION_IGNORED`, `HAMMOCK_WITHOUT_FINISH_DRIVER`), plus één waarschuwing van het openen:
  `XER_ARCHIVE_DROPPED`. Die komt als het bestand een P6-bronarchief (XER) had dat niet bruikbaar is.
  De lezer laat het archief dan weg, en `toIfc()` schrijft het niet meer mee. `detail` geeft de
  reden (`bytes-missing`, `hash-mismatch`, …); de app meldt hetzelfde verlies bij het openen.

Datums zijn ISO-8601-tekst zoals de app ze bewaart: een datum (`2027-03-01`) of, bij urenplanning,
datum en tijd.

## Foutmodel

Elke fout is een `PlannerCoreError` met een vaste `code`. Ook een onverwachte fout in de app-route
(bij openen, rekenen of schrijven) komt als `PlannerCoreError` naar buiten. De `message` is Engels en is voor mensen,
niet om te parsen.

| code | wanneer |
|---|---|
| `INVALID_INPUT` | De invoer is geen tekst, is leeg, of begint niet met `ISO-10303-21;`. |
| `IFC_READ_FAILED` | De IFC-lezer kan het bestand niet lezen, of het openen in de store mislukt (bijv. bij een extreem diepe WBS, knownbugs.md). |
| `NO_TASKS` | Het bestand heeft geen taken. |
| `SCHEDULE_FAILED` | De planning is niet te berekenen, bijv. door een kring in de relaties, of de berekening gooit een fout. `details.reason` heeft de solvertekst, `details.taskIds` de taken van de kring. |
| `IFC_WRITE_FAILED` | Het schrijven naar IFC mislukt. |

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
```

Het voorbeeld importeert alleen `@openaec/open-planner-core`, nooit code uit `src/`.

- Node 22 of nieuwer, alleen ESM.
- Het pakket heeft geen runtime-dependencies; de bundel is ongeveer 2 MB.

## Tests

| test | wat hij bewijst |
|---|---|
| `tests/planning/check-headless-core.ts` | Voor elk voorbeeld in `examples/` en `public/examples/` geeft de kern dezelfde datums, speling, kritieke vlag, projecteinde en kritiek pad als de app-store (`loadState` → `runCPM`). Verder: `toIfc` → `openIfc` geeft dezelfde datums, twee documenten zijn los, de foutcodes kloppen (ook 6.000 geneste taken geeft een `PlannerCoreError`), een weggelaten XER-archief geeft `XER_ARCHIVE_DROPPED`, en `toIfc()` vóór `schedule()` is gelijk aan de app na openen. |
| `npm run verify:core-package` | Bouwt het pakket, maakt een tarball met `npm pack`, installeert die in een kopie van het consumeervoorbeeld, controleert `THIRD-PARTY-NOTICES.md`, draait het voorbeeld (verwachte uitkomst, herberekend IFC, foutcode) en typecheckt een kleine TypeScript-consument tegen de declaraties. |
| `tests/planning/check-store-runtime-boundaries.ts` | De grens: een waarde-import uit `appStore` in `src/core/` maakt `verify:store-boundaries` rood. |

## Wat de kern niet doet

- Geen andere invoerformaten (MSPDI, XER, `.mpp`, CSV). De lezers bestaan in de app; de kern
  biedt ze nog niet aan.
- Geen bewerkingen op de planning (taken toevoegen, nivelleren). Daarvoor zijn er de `planner_*`-tools:
  in de app via de MCP-koppeling, of zonder app via de [headless MCP-server](headless-mcp.md)
  (`npm run build:mcp-server`). Die server deelt de grenscontrole van de bundel met deze kern
  (`scripts/lib/headless-bundle.mjs`).
- Geen native DLL of `.so`. Dat is een apart punt van issue #429.
