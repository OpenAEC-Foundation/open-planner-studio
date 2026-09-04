# Tabel-overhaul — performancebewijs

**Datum:** 2026-08-26, aangevuld 2026-08-27
**Branch:** `codex/tabel-overhaul`
**Basiscommit tijdens de meting:** `9b23b9730e200ee4d5bb08643ca96716c1115e7b`
**Machine:** Linux x64, Node v24.15.0, Intel Core i7-1260P, 16 logische CPU's

## Wat werkelijk wordt gemeten

`tests/planning/taskGridPerformanceHarness.ts` bouwt één deterministische fixture die zowel de
blokkerende planningcheck als `scripts/bench-task-grid.mjs` gebruikt:

- 50.000 zichtbare taakrijen;
- 24 zichtbare kolommen;
- 100.000 interne relaties, in twee vaste relatiegolven zonder self-links;
- rijhoogte 28 px, viewport 900 px en overscan 8;
- 1.000 navigatiecommando's en 1.000 enkelvoudige selectiecommando's per meetrun.
- een afzonderlijke selectie→adapterfixture van 3.000 taken en 2.999 relaties, waarbij het
  selectie-onafhankelijke adapterdomein één keer vooraf wordt gebouwd.

Iedere tijdmeting krijgt twee warmups. Het gerapporteerde getal is de mediaan van negen runs. De
generator- en rij-indexbouw vallen buiten de gemeten tijd; relation-index, navigatie, selectie en
`computeVirtualWindow` zijn de echte productie-implementaties.

De harde poorten zijn:

| Onderdeel | Poort |
|---|---:|
| Gemounte rijen | `<= ceil(900 / 28) + 16` = 49 |
| Gemounte datacellen | `<= gemounte rijen × 24` = 1.176 |
| Relation-index | mediaan `<= 500 ms` |
| 1.000 navigatiecommando's | mediaan `<= 100 ms` |
| 1.000 selectiecommando's | mediaan `<= 100 ms` |
| Selectie→adapterprojectie, 3.000/2.999 | mediaan `<= 2 ms` |
| Virtual-windowberekening | mediaan `<= 5 ms` |

De selectie→adaptergrens is bewust veel strakker dan de overige algemene poorten. Drie verse
Node 22-processen met de definitieve 2-ms-poort maten de nieuwe productroute op respectievelijk
0,34 ms, 0,48 ms en 0,32 ms mediaan. De langzaamste daarvan houdt 1,52 ms marge tot de poort. Als controlediagnose is in drie
aparte processen exact de oude foutconstructie gemeten — het domein en daarmee de relatie-index bij
iedere selectie opnieuw bouwen — op 4,76 ms, 7,62 ms en 10,35 ms mediaan. Die terugval overschrijdt
de 2-ms-poort dus in alle drie de processen; de extern gemeten browserregressie van circa 205 ms
valt er vanzelfsprekend nog veel ruimer buiten. Daarnaast bewaakt een structurele regressie dat
`FullTaskGrid` de domeinmemo niet van `selectedTaskIds` laat afhangen.

## Drie onafhankelijke blokkerende runs

De check is eenmaal gebundeld en daarna driemaal als nieuw Node-proces gestart met
`OPS_RELAX_PERF=0`. Alle drie processen eindigden met exitcode 0 en `23/23` groene checks. De twee
extra checks tellen de werkelijk door `DataGridCore` gerenderde servermarkup, niet een afgeleid
celgetal.

| Run | Relation-index | Navigatie | Selectie | Virtual window | Exit |
|---:|---:|---:|---:|---:|---:|
| 1 | 266,11 ms | 0,18 ms | 0,33 ms | 0,009 ms | 0 |
| 2 | 250,02 ms | 0,17 ms | 0,26 ms | 0,008 ms | 0 |
| 3 | 238,50 ms | 0,25 ms | 0,33 ms | 0,009 ms | 0 |

Alle runs monteerden werkelijk én berekend 49 rijen en 1.176 datacellen. De langzaamste
relation-indexrun houdt 233,89 ms, ongeveer 47%, marge tot de blokkerende grens.

## Onderzoek van de eerste uitschieter

De allereerste strenge run na het schrijven van het harnas eindigde rood op alleen de
relation-indexgrens. Die vroege versie drukte bij een fout de mediaan nog niet af, zodat van die run
geen verantwoord exact getal kan worden vermeld. Eerst is daarom de diagnose-uitvoer gerepareerd;
aan `buildTaskRelationIndex` is niets gewijzigd.

Daarna volgden, zonder productcodewijziging, een strenge run van 307,06 ms, een alleen-meten-run van
320,13 ms, meerdere JSON- en ontwikkelruns en uiteindelijk de drie formele runs hierboven. Geen van
die herhalingen overschreed 500 ms. De eerste fout is daarmee niet reproduceerbaar en past bij
tijdelijke hostbelasting; de grens is niet verruimd en de relation-index is niet op basis van één
koude uitschieter herschreven.

## Echte productvergelijking vóór en na

De eerdere vergelijking in dit hoofdstuk was niet geldig als vóór/na-bewijs: beide JSON-bestanden
draaiden dezelfde nieuwe implementatie. Die claim is ingetrokken en vervangen door een vergelijking
van twee verschillende productversies:

- vóór: plancommit `446324ce83bab363bb66f28a4cf2d805ce4a0d25`, met de oude volledige tabel;
- na: commit `77ceabec9bb36a5ab089db68e797adca2f9c22b9` plus de verwerkte reviewreparaties;
- dezelfde privacyvrije IFC van 6.701.772 bytes, met 10.000 taken en 11.700 relaties;
- dezelfde machine, Node v24.15.0 en Headless Chrome 151;
- dezelfde gebruikershandeling: vanuit Start op de linttab **Tabel** klikken;
- gereedcriterium: de tabelstate is actief en twee `requestAnimationFrame`-rondes zijn voltooid;
- per versie twee opwarmrondes en negen meetrondes; de mediaan is leidend.

Het reproduceerbare meetcommando is `scripts/bench-task-grid-product.mjs`. De twee ruwe rapporten
staan naast dit document als `tabel-overhaul-product-benchmark-base.json` en
`tabel-overhaul-product-benchmark-final.json`.

| Onderdeel | Plancommit | Nieuwe grid | Verschil |
|---|---:|---:|---:|
| Klik tot twee schilderrondes | 3.407,3 ms | 88,0 ms | -97,417% |
| Scripttijd | 1.925,310 ms | 78,788 ms | -95,908% |
| Layouttijd | 769,774 ms | 3,138 ms | -99,592% |
| Stijlherberekening | 439,518 ms | 2,879 ms | -99,345% |
| Totale browsertasktijd | 3.421,544 ms | 98,307 ms | -97,127% |
| Gemounte DOM-elementen | 230.303 | 926 | -99,598% |

De oude tabel had geen ARIA-grid en zette alle 10.000 taakrijen in de DOM. De nieuwe tabel meldde
`aria-rowcount=10001`, maar hield in iedere meetrun 26 taakrijen en 234 datacellen gemount. De
ruwe nieuwe waarden liepen van 69,2 tot 120,2 ms; de oude van 3.121,3 tot 3.643,1 ms. De uitkomst
ligt dus niet op één toevallige uitschieter en overschrijdt de 25%-onderzoeksgrens nergens in de
verkeerde richting.

Deze productmeting vervangt niet de afzonderlijke 50.000×24×100.000 headless poorten hierboven:
de productmeting bewijst de echte tabwissel en DOM-kosten, terwijl het harnas de interne
relation-index, navigatie, selectie en virtual-windowberekening bewaakt.

## Selectierestpost met 3.000 taken

De externe eindreview vroeg terecht om de eerder gemelde klikduur niet als één getal te behandelen.
Daarom laadt dezelfde productprobe nu een deterministische IFC met 3.000 taken en 2.999 relaties in
een schoon Headless-Chrome-profiel en meet hij vier afzonderlijke routes. De muis wordt vóór de klok
op het doel gezet, zodat hover en tooltipwerk niet in de klikduur vallen. Iedere route heeft twee
warmups en negen metingen; de mediaan is leidend. De actieve taak, taakselectie, actieve cel,
`aria-selected`, het aantal canvas-elementen en de toestand van de eigenschappenrail worden na de
klik gecontroleerd.

| Route | Wandtijd | Script | Layout | Stijl |
|---|---:|---:|---:|---:|
| Andere taak, eigenschappen open | 65,4 ms | 45,117 ms | 0,828 ms | 0,927 ms |
| Dezelfde actieve cel | 30,7 ms | 18,682 ms | 0 ms | 0 ms |
| Neutrale klik zonder gridactie | 30,2 ms | 0,125 ms | 0 ms | 0 ms |
| Andere taak, eigenschappen gesloten | 48,5 ms | 34,413 ms | 0,117 ms | 0,368 ms |

De ongeveer 30-ms wandtijdvloer komt door het gekozen gereedcriterium van twee
`requestAnimationFrame`-rondes. De herhaalde klik op dezelfde cel publiceert geen nieuwe
Zustand-toestand en bewaart ook het lokale selectieobject. Dat is eerst met drie bewust rode
regressies aangetoond en daarna met 34/34 groene selectiechecks. De gemeten wandtijd ligt daardoor
in de formele run praktisch op de neutrale vloer. Een onmiddellijke herhaling onder aantoonbaar
hogere hostbelasting kwam uit op 81,9 ms voor een andere taak, 63,3 ms voor dezelfde cel en 29,8 ms
voor de neutrale vloer. De ruwe scripttijden liepen daar eveneens op. Die herhaling laat zien waarom
de productmeting diagnosebewijs is en geen nieuwe harde millisecondepoort; de bestaande 2-ms-poort
voor de selectie-onafhankelijke adapterprojectie is niet gewijzigd.

Een apart CPU-profiel van een echte taakwissel is alleen gebruikt om kosten toe te rekenen, niet als
absolute duurmeting: profilering vertraagde die ene klik tot 177,9 ms en omvatte 365,241 ms aan
samples en profiler-/browserwerk. Van de benoemde bronkosten viel 120,647 ms in Reacts
ontwikkelruntime, 4,649 ms in het taakgrid, 3,145 ms in overige appcode, 1,723 ms in eigenschappen
en panelen en 0,312 ms in gedeelde rendererbron. De grootste herkenbare frame was
`react_jsx-dev-runtime` met 78,057 ms; `createTaskGridAdapter` was 0,794 ms. Daarnaast bleef
219,038 ms browser-/profilerwerk zonder bruikbare appbron.

De Tabel-weergave bevatte tijdens zowel de gewone als de geprofileerde route exact nul
canvas-elementen. Er vond dus geen Gantt-canvas-tekening plaats; het kleine sample uit gedeelde
rendererbron is daarom bewust niet als canvaswerk gelabeld. Met gesloten eigenschappen stonden
ook exact nul eigenschappenpanelen in de DOM. De conclusie is tweedelig: het opnieuw publiceren
van een ongewijzigde selectie was een echte tweede regressie en is gerepareerd; de resterende
taakwisselkosten zitten hoofdzakelijk in React-ontwikkelrenders van de zichtbare grid en, in mindere
mate, het bestaande eigenschappenpaneel. Er is geen ontwerpbesluit of acceptatiegrens aangepast.

De ruwe formele meting staat in
[`tabel-overhaul-selection-product.json`](./tabel-overhaul-selection-product.json); de onmiddellijke
hostbelaste herhaling staat in
[`tabel-overhaul-selection-product-repeat.json`](./tabel-overhaul-selection-product-repeat.json).

### Dezelfde proef tegen de productiebuild

Omdat het ontwikkelprofiel vooral `react_jsx-dev-runtime` aanwees, is dezelfde probe vervolgens
tegen een echte `vite build` en een gecontroleerde preview gedraaid. Alleen voor deze meetbuild zet
`VITE_OPS_BENCH_BRIDGE=1` de bestaande testbrug aan; `import.meta.env.DEV` bleef false en React/Vite
draaiden in productiemodus. Een broncontrole op de gebouwde assets vond geen `jsxDEV`,
`react-jsx-dev-runtime` of `react_jsx-dev-runtime`; alleen de afzonderlijke dynamische
`devBridge`-chunk bevatte `window.__OPS__`. Een gewone build zonder de expliciete variabele houdt
die import uit de productie-output.

De gecontroleerde preview luisterde op de werkelijk door Vite toegewezen poort 36653 en serveerde
hoofdasset `index-BQ_JuaBS.js` uit deze build. Dezelfde 3.000/2.999-fixture, schone Chrome 151,
twee warmups, negen runs, echte CDP-klikken en alle eindtoestandcontroles leverden:

| Route | Productiewand | Productiescript | Ontwikkelwand | Ontwikkelscript |
|---|---:|---:|---:|---:|
| Tabel-tab openen | 28,5 ms | 18,198 ms | 73,4 ms | 58,993 ms |
| Andere taak, eigenschappen open | 48,1 ms | 17,684 ms | 65,4 ms | 45,117 ms |
| Dezelfde actieve cel | 29,5 ms | 5,916 ms | 30,7 ms | 18,682 ms |
| Neutrale klik | 29,1 ms | 0,124 ms | 30,2 ms | 0,125 ms |
| Andere taak, eigenschappen gesloten | 48,4 ms | 14,034 ms | 48,5 ms | 34,413 ms |

Alle negen productieselecties lagen tussen 47,0 en 48,4 ms. De echte taakwissel ligt daarmee
ongeveer één schilderronde boven de vaste twee-rAF-vloer; dezelfde-cel blijft op die vloer. De
ontwikkelruntime verklaarde dus een groot deel van de eerder onverklaarde scripttijd, terwijl de
gebruikersbuild geen voelbare 114-ms-mediaan overhoudt. Er is nog steeds geen Gantt-canvas gemount
en geen adapterrebuild. Het proces eindigde met exitcode 0; het ruwe rapport staat in
[`tabel-overhaul-selection-product-production.json`](./tabel-overhaul-selection-product-production.json).
Na de meting is de preview gestopt en `npm run build` opnieuw zonder benchmarkvariabele uitgevoerd;
die gewone productie-`dist` bevatte aantoonbaar geen `devBridge`, `window.__OPS__` of JSX-dev-runtime.

## Horizontale scroll en gebruikersopslag

De zesde review vermoedde dat horizontaal scrollen kon haperen doordat `setTaskGridScrollX` bij elk
event de volledige gebruikersvoorkeur synchroon naar `localStorage` schreef. Brononderzoek
bevestigde dit: de Promise-wrapper maakte `localStorage.setItem` niet asynchroon. De zichtbare
scrollstate wordt daarom nog steeds onmiddellijk per event bijgewerkt, maar persistentie wacht 120
ms na het laatste event en leest dan de actuele volledige voorkeur uit de store.

De regressie stuurt vijf opeenvolgende scrollstanden `120, 240, 480, 760, 987` door de echte store.
Direct daarna staat de live Tabel-scroll op 987 en zijn nul opslagwrites uitgevoerd; na 180 ms is
precies één write gedaan en bevat die 987. Gewone kolom- of MRU-wijzigingen annuleren een wachtende
scrollwrite en slaan de nieuwste volledige payload meteen op, zodat een oud snapshot niet later kan
terugschrijven. `check-task-grid-preferences` eindigt 72/72 groen.

## CI- en relaxcontract

- Een directe run met `OPS_RELAX_PERF=1` print de fixtureaantallen en medianen en slaat alleen de
  tijdpoorten over; structuur-, tel- en geldigheidschecks blijven actief.
- `tests/planning/run.sh` zet voor de geregistreerde check altijd expliciet `OPS_RELAX_PERF=0`.
  Een geërfde shellvariabele kan de normale CI-poort dus niet stil uitschakelen.
- De zware check wordt na zijn ene normale uitvoering uit de tijdzonematrix gehaald. De gemeten
  functies zijn tijdzone-onafhankelijk; vijf extra kopieën zouden alleen looptijd en meetruis geven.

## Overige verificatie

- `npm run typecheck` — exitcode 0 na de finale harnaswijzigingen.
- De definitieve checkprocessen leveren na hun eindregel expliciet exitcode 0; de React-serverimport
  kan het Node-proces niet onbedoeld actief laten staan.
- Finale JSON-schema-smoke — exitcode 0; alle zes budgetvlaggen waar, inclusief gemounte rijen en
  datacellen, en negen ruwe samples per tijdmeting aanwezig. Deze extra hostmomentopname vervangt de
  drie formele runs hierboven niet.
- `git diff --check` — exitcode 0 vóór het schrijven van dit bewijsdocument.
- Het benchmarkwerk raakt geen resourceweergave of resourcecode.
- Na de selectie- en benchmarkbrugwijzigingen eindigde de volledige actuele `npm run verify` met
  exitcode 0: planning 560/560 in vijf tijdzones, alle overige testgroepen, voorbeelden,
  documentatie, i18n, 451 importmodules zonder cyclus en audit met nul kwetsbaarheden.
