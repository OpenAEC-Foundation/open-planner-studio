# Goal prompt — X12 naar nul (XER-getrouwheid), onder regel A en regel B

*De opdrachttekst voor elke sessie of subagent die aan het X12-restant werkt. Eigenaarsbesluiten
2026-09-22: het nuldoel van plan XER §1 is de lat; "geen pinnen met reden"; regel A en B zijn de
landingsregels. Eindtoestand van het hele programma: **0 zesassige afwijkingen tegen P6 op het orakelcorpus**
met `GOAL_ZERO_DEVIATIONS_XER` aan. Het orakelcorpus is sinds het eigenaarsbesluit van 2026-09-23 ("alleen die
P6-bestanden", overdracht §1a) uitsluitend de aantoonbaar door P6 doorgerekende bestanden (`role: oracle` in
`tests/planning/xer-corpus-manifest.json`, onderbouwd door `scripts/xer-p6-computed.ts`): 9 entries / 21
projecten / 5.983 taken, X12 **1.274** na die populatiewijziging (was 11.529 op 34 entries / 47 projecten /
13.982 taken; 15.056 bij de start). Sinds 2026-09-23 (tweede toepassing: DCP-03 Baseline is generatoruitvoer)
8 entries / 20 projecten / 5.923 taken, X12 **192**.*

## Het doel

`bash tests/planning/run.sh check-xer-product-fidelity-x12.ts` met `OPS_XER_CORPUS` geeft **exit 0**:
alle zes assen (es, ef, ls, lf, tf, ff) nul afwijkingen op elk corpusbestand, de sameday-categorie nul,
de driving-path-cellen niet slechter, en de cel-baseline leeg. Niet: "de som is lager". Niet: "gepind met
reden".

## Regel A — de landingsregel (per cel, elk profiel)

Een wijziging aan de gedeelde motor (`src/engine/scheduler/**`) landt alleen als **geen enkele cel die
exact was inexact wordt, geen enkele bucket verslechtert, en geen enkele cel binnen dezelfde bucket
`sameday`/`diff` verder van het orakel af komt te liggen, in geen enkel profiel met een orakel**:

- **Schuld alleen omlaag** (orkestratorbesluit 23-09, merge van de grootte-ratchet): 14 Roads-cellen die
  op de huidige motor groter afweken dan in de oude v2-kant staan als `ratchetDebt` in het cellenbestand
  (`reference` = oud, `current` = nieuw; `schuld=N` in de cel-deltaregel). Een schuldcel mag niet boven
  `current` groeien; komt hij op of onder `reference`, dan vervalt de schuld. Schuld ontstaat nooit meer:
  de eenmalige vlag `OPS_XER_CELLS_DEBT_INIT` is na gebruik verwijderd, een cellenbestand zonder
  schuldsectie wordt geweigerd, en `check-fidelity-cells-gate.ts` pint een digest over de schuldset
  (bestand, as, id, `reference`), dus de lijst kan alleen krimpen. De grootten zelf zijn tegen handwerk
  gepind via `cellMinutesSha256` in de v2-envelop. **Stand:** X12 brok 6 maakte alle 14 exact; de
  schuldsectie is sindsdien leeg (`ratchetDebt` = 0) en kan niet meer groeien (plan XER §9,
  "Ratchet-schuld 2026-09-23").
- **Grootte-clausule** (eigenaarsbesluit 23-09, "2. Invoeren"): het cellenbestand (versie 2) pint per
  inexacte cel ook de absolute afwijking `|ours − truth|` in minuten (datum-assen wandklok, tf/ff
  floatminuten; `missing` en `drivingPath` zonder grootte). Groter binnen dezelfde bucket is rood
  (`groter=N` in de cel-deltaregel), kleiner telt als verbeterd-grootte (`kleiner=M`) en wordt herpind
  met alleen `OPS_XER_CELLS_WRITE=1`. Een bucketverbetering (diff → sameday) telt alleen als verbetering
  bij gelijke of kleinere minuten; groeien de minuten daarbij, dan is het rood (`groter`) — de emmer is
  een kalenderdaggrens (sameday tot 1020 min, diff vanaf 840 min), geen maat.

- P6-profiel: `npm run measure:profiles` (X12 mét corpus + cel-ratchet, `xer-product-fidelity-cells.json`);
- MS Project-profiel: `check-mpp-fidelity.ts` — `GOAL_ZERO_DEVIATIONS` groen, 216 pins ongewijzigd
  (0 verbeterd / 0 verslechterd; het orakel meet alleen start/einde, en de baseline staat op nul, dus
  de grootte-clausule is daar al gedekt);
- OPS-profiel: de corpusloze planningssuite byte-identiek.

"Netto beter" bestaat niet. 1.200 cellen goed en 300 slecht = rood; splits de wijziging tot elk deel
alleen verbetert, en zoek per resterende verslechtering uit welke P6-regel daar anders uitpakt — dat is
de informatie voor een fix of een conventie. Een verbetering herpin je volgens het recept in `scripts/README.md` — in
één commit: `OPS_XER_V2_WRITE=1`, `OPS_XER_CELLS_WRITE=1`, `OPS_XER_GATE_PINS=write`, de vangrails
groen, en dan de twee tweede-orde pins met de hand: `xer-schedoptions-blast-radius.json`
(`check-xer-schedule-options-corpus`; bewaakt de detectie van de lezerdefaults, geen P6-getrouwheid —
alleen herpinnen als een detectie-/populatieteller door een bewuste wijziging beweegt) en
`xer-task-replay-public-pin.json` (`check-xer-task-replay`, o.a. `drop-p6-relation-finish-boundary`, sinds de
populatiewijziging van 2026-09-23 de negatieve controle i.p.v. A17;
detectievermogen, som per as gelijk) — en commit je mét het getal in het commitbericht: "X12 15.056 → 14.312 (−744, 0 slechter)".

## Regel B — verschil per school is een conventie, nooit een `if` op het formaat

Blijkt dat P6 en MS Project (of OPS) op een punt verschillend rekenen, dan is de oplossing een rij in
het conventieregister (`src/engine/scheduler/conventions/registry.ts`) met drie waarden — nooit
`if (p6Source)`, `if (importFormat === 'xer')` of een lezer-import in de motor. Verschilt het per
bestand (SCHEDOPTIONS/PROJECT), dan is het een projectoptie (`project.schedulingOptions`) waarvoor het
profiel de standaard geeft. `npm run verify:conventions` bewaakt de motor mechanisch; herkomstvelden op
taken zijn datagates met een gepinde telling die alleen omlaag mag. Het docblok van een nieuwe
conventie zegt wat P6 doet, wat MS Project doet, wat OPS vandaag doet, en de bron (P6-documentatie,
gemeten corpusgedrag — nooit MPXJ/ProjectLibre-code overnemen; CPL mengt niet met LGPL).

## Werkwijze per brok restant

1. **Meten vóór bouwen.** `OPS_XER_FIDELITY_REPORT=detail` → classificeer op bladniveau (plan XER §9:
   welk bestand, welke as, welke taakklasse). Begin bij de grootste homogene groep: de projecteinde-fout
   (`sched_use_project_end_date_for_float=Y` zonder einddatum, 36 van 39 rijen), dossier 7b-4 (forward-
   anker, ≤ 690 cellen op rehab-2), de 215 tf-cellen `TK_Complete`/`DT_FixedDUR2`, sameday (415, 280 in
   `groupdocs-conversion/sample.xer`). *(Stand 2026-09-22; rehab-2 en groupdocs zijn sinds het
   populatiebesluit van 2026-09-23 geen orakel meer — de actuele brokkentelling staat in
   `2026-09-23-x12-restant-classificatie.md`, kop "Populatie na besluit 23-09".)*
2. **Eén hypothese, één fix, één meting.** Geen twee regels tegelijk in de motor.
3. **Bewijs in de commit:** de X12-regels letterlijk, de cel-delta, mpp-fidelity-regel, corpusloos groen.
4. **Escaleren, niet pinnen.** Kun je een afwijking niet verklaren uit P6's eigen documentatie of het
   corpus, dan komt hij als open vraag in `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md` §9 —
   nooit in de baseline met een `reason`.
   **n = 1-criterium** (orkestratorbesluit bij brok 6, overdracht §1c): een regel met één corpusgeval
   mag alleen landen als hij een gedocumenteerd P6-principe is (Oracle-bron geciteerd in het docblok)
   en niet uit dat ene bestand is afgeleid; anders blijft het een open restant (zoals B10, B13/B14).
5. **Machineregel:** maximaal één zware suite tegelijk (`ps aux | grep run.sh`); gerichte checks
   tussendoor, de volledige suite bij het landen.

## Wat niet mag

- De populatie wijzigen om het getal te laten zakken — een entry uit het orakel halen, een rol omboeken,
  `included` omzetten. Het orakelcorpus is een eigenaarsbesluit. Eenmalige uitzondering, door de eigenaar
  zelf genomen op 2026-09-23 ("alleen die P6-bestanden"): de 32 entries zonder aantoonbare P6-doorrekening
  (rehab-2 = P3-uitvoer, synthetische/generatorbestanden, hb-intel, stack_data_center, DCP-03 As-Built)
  gingen naar `reader-only`, via het corpusgroei-recept (`=corpus`-schrijfmodi, `scripts/README.md`).
  Tweede toepassing (2026-09-23; bevestiging door de eigenaar gevraagd, overdracht §1d-11): de vier DCP-03-Baseline-kopieën
  hebben de kenmerken wél, maar zijn aantoonbaar generatoruitvoer (`build_programmes.py` naast het bestand);
  `build_programmes.py` reproduceert het bestand byte-exact — geen staande regel. X12 284 → 192. Elke volgende populatiewijziging vraagt een
  eigenaarsbesluit.
- Een cel of as pinnen om groen te worden.
- Een P6-tak achter een formaat- of herkomstcheck stoppen.
- Het OPS-profiel veranderen (inhoud is een eigenaarsbesluit ná nul).
- MSPDI/P6-XML van profiel wisselen (eigen, gemeten taak).
- Een baseline langs de schrijfmodi heen maken. Verboden zijn: de omleiding
  `OPS_XER_FIDELITY_REPORT=baseline … > xer-product-fidelity-baseline-v2.json` (de rapportmodus is
  alleen rapport: hij begint met een kopregel en weigert rechtstreeks naar het baselinebestand te
  schrijven), het cellenbestand weggooien om het met `OPS_XER_CELLS_WRITE=init` opnieuw te maken
  (`init` weigert zolang er een v2-baseline bij hetzelfde manifest bestaat), en `EXPECTED` in
  `check-xer-corpusless-fidelity-gate.ts` met de hand ophogen. Herpinnen gaat uitsluitend via
  `OPS_XER_V2_WRITE=1`, `OPS_XER_CELLS_WRITE=1` en `OPS_XER_GATE_PINS=write`, die alle drie alleen
  omlaag schrijven (recept in `scripts/README.md`).
- `OPS_XER_CELLS_V1_UPGRADE=1` gebruiken na het landen van `claude/x12-grootte-ratchet`, of bij een
  merge de v1-kant van het cellenbestand nemen: altijd de v2-kant plus `OPS_XER_CELLS_WRITE=1`; een
  `groter` daarna los je op in de motor of via een eigenaarsbesluit over de populatie, nooit met een
  "accepteer grotere cellen"-modus. `OPS_XER_CELLS_DEBT_INIT` was eenmalig zo'n modus (23-09) en is
  verwijderd; de X12-check weigert hem.
- een grootte, de schuldsectie, `cellMinutesSha256` of het schuldpin-blok met de hand bewerken.
