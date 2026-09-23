# Eindreview PR #169 door Fable (orkestrator) — voorlopige bevindingen, 2026-09-24

*In gewone taal: dit is de eindreview van de etappe rekenprofielen + X12 naar nul, gedaan door het
hoofdmodel zelf (op verzoek van de eigenaar), naast de Opus-critreviews per brok. Deel 1 is gelezen op
de kop vóór de merge van de besluiten van 24-09; deel 2 volgt op de eindstand. Status: VOORLOPIG.*

## Deel 1 — kernlagen (gelezen op `d981ed33`, X12 175)

Gelezen: `conventions/registry.ts`, `schedulingProfileMigration.ts`, `solveInput.ts`,
`schedulingOptionsRead.ts`, `ifcWriter.ts` (psets), `ifcReader.ts` (profiel), `scheduleAnalysis.ts`
(vrije-spelingblok C2/C12/C13), `CPMSolver.ts` (C6-helpers, `actualStart`-anker),
`SchedulingProfileSection.tsx`, `schedulingProfileNotice.ts`, `xerScheduleOptions.ts` (nieuwe optie).

**Gezond [BEVESTIGD]:**
- Twee lagen zijn strikt gescheiden: `ProjectOptionKey` is het complement van `ConventionKey`
  (compile-time `_disjoint`); de solver krijgt uitsluitend `EffectiveSchedulingOptions` via
  `solveOptionsFor` — een aanroeper die het profiel overslaat compileert niet.
- IFC: profiel-pset alleen als ≠ standaardprofiel (`carriesProfile`), alle conventies OPGELOST
  weggeschreven plus de letterlijke afwijkingen; sanitizer negeert onbekende sleutels, weigert
  te grote/corrupte JSON, en een letterlijke afwijking die de opgeloste set tegenspreekt wordt
  genegeerd. `OPS_SchedulingOptions` draagt alleen opties + A22/A23 als `true` (compat).
- Migratie van oude XER-IFC's is een GEPINDE lijst (`LEGACY_XER_ALWAYS_ON` B1–B5,
  `LEGACY_XER_ALSO_ON_X12` C1–C12 op hun P6-waarde), geen "elke groep-C". Goed.
- Het vrije-spelingblok: C2-breed, C12-ff-kant en C5-ff-kant overschrijven `ff` na elkaar (geen
  optelling); gestarte taken houden letterlijk het oude C2-predicaat; SF/ELAPSEDTIME/procentlag en
  andere lagkalenders vallen bewust buiten C2. Klopt met de docblokken.
- De nieuwe projectoptie `startToStartLagFrom` zit in lezer (Y/leeg ⇒ earlyStart, N ⇒ actualStart),
  grondwaarheid, sanitizer, IFC, UI (uit als C6 of A19 uit), MCP. Het `actualStart`-anker en de
  achterwaartse spiegel delen één poort (`inProgressStartLag`).

**Bevindingen (te verwerken in deel 2):**
1. [BEVESTIGD, tekst] `registry.ts` r. 33–37: het docblok van `legacyValue` zegt "Nooit de
   basiswaarde", maar `convention()` zet `legacyValue: builtIn.ops` — dus ALTIJD de OPS-basiswaarde
   (voor alle 26: `false`). De semantiek is goed (een bestand van vóór de conventie rekende zonder de
   regel; ontbrekende sleutel ⇒ uit ⇒ verschijnt als afwijking van de P6-basis), de tekst niet.
   Fix: "= de OPS-waarde (uit), bewust: een ouder bestand rekende zonder de regel; nooit de waarde
   van de gekozen basis".
2. [BEVESTIGD, UI] `SchedulingProfileSection.tsx` r. 199–213: de 26 conventies zijn één platte lijst
   checkboxes zonder groepering (A/B/C of thema), zonder markering "per bestand" (A19) en zonder
   zichtbaar onderscheid tussen de basiswaarde en de afwijking (alleen het label "(aangepast)" op het
   profiel). Met 26 regels is dat voor een planner niet meer te overzien. Voorstel: groepen
   (Voltooid werk / Relaties en lag / Mijlpalen / Speling / Weergave-instanten) met de basiswaarde
   grijs erachter en een "terug naar basis"-knop per regel. Wachten op de gebruikstest.
3. [BEVESTIGD, samenhang] `p6OptionDefaults()` zet A21 `p6CompletedLateFromRemainingWindow: true`,
   maar A21 werkt alleen samen met B3 — en B3 gaat na vraag 7 in het P6-profiel uit. Dan is A21 in
   een nieuw P6-project een dode optie tot B3 per project aan staat. Fix: in het docblok van A21 en
   in de UI (tooltip) benoemen, of A21 gelijk mee uit als default (meting nodig: 0 cellen verwacht).
4. [VERMOED, laag] `inProgressStartLag` eist `lagMinutes > 0`; onder `actualStart` en lag 0 gebeurt
   niets — Oracle: "data date plus any remaining lag" ⇒ met lag 0 zou de opvolger op de statusdatum
   ankeren. Onder A19 is de restwerkstart van de voorganger ook de statusdatum, dus gelijk; zonder A19
   staat de optie toch uit. Inert in het corpus; het docblok zegt dat al. Geen actie.
5. [BEVESTIGD, proces] Drie populatiewijzigingen (rehab-2/synthetisch, DCP-03, uitsluitingen 24-09)
   zijn nu allemaal eigenaarsbesluiten; de policytekst is weer onvoorwaardelijk. Wel blijft
   `generatorEvidence` een heuristiek (alleen `.py` in dezelfde map) — dat staat er eerlijk bij.

## Deel 2 — eindstand (gelezen op `c9a83604`, X12 104, 2026-09-24 ~00:30)

*Wat er sinds deel 1 is geland: vraag 7 (A17/B3/B4 uit), de drie uitsluitingen (manifest met
`decision`), UI B2/B5, de heropen-melding, blast-radius v11, het nivelleringsfundament. Nog niet
geland: de B1-datumfix met invoercoherentie (tweede fixronde loopt) en het UI-groepenvoorstel
(eigenaar). Gemeten: `measure:profiles` NULDOEL 104, `nieuw=0 verslechterd=0 groter=0 schuld=0`,
`uitgesloten 41 taken in 3 projecten`; `verify` groen op `1c1c2f70`, keten op `e3d0cd51` loopt.*

**Gezond [BEVESTIGD]:**
- **Manifest en populatie.** De policy is weer onvoorwaardelijk; elke rolwissel citeert een
  eigenaarsbesluit met datum; de drie uitsluitingen dragen per regel het letterlijke woord van de
  eigenaar en een reden per taak/project; de uitgesloten afwijkingen blijven zichtbaar als
  niet-stijgende pin (`excludedHidden` 71/23). Dat is geen pinnen met reden: niets van de motor
  wordt "goed gerekend", er wordt alleen niet-P6-uitvoer uit de meetlat gehaald.
- **Ratchet.** Cellen v2 met minuten, schuld 0, minuten- en schuld-digests, geen aanmaakroute meer.
- **Vraag 7.** `legacyXerDefault` geeft voor de B-set nu `builtIn.p6` terug: een oud XER-IFC zonder
  B3/B4 rekent ze uit, een expliciete `true` blijft een afwijking. A21 zonder B3 is inert en staat zo
  in docblok en gids; de `backwardFloatTrace` blijft aan B3 hangen en is onder P6 leeg (gepind).
- **Nivelleringsfundament.** Puur data; geen `enabled`-veld meer (besluit 1 open); `levelingInput.ts`
  legt de gesloten mapping P6-kolomnaam → eigen grootheid vast en filtert hangende ids; de check voert
  elke bak-2/4-kolomnaam als sleutel. Dat is precies de vangrail die de motoretappe nodig heeft.
- **UI B2/B5.** Vertrekbewaking via één module-globale haak, sneltoetsen respecteren de dialoogstapel,
  meldingen zonder poller. Sluit aan bij het bestaande `Dialog`/K8a-patroon.

**Bevindingen deel 2:**
6. [BEVESTIGD, klein] `toastPlacement` meet met `getBoundingClientRect` op elk `resize`/`scroll`
   (capture) — bij scrollen in een groot raster is dat een layout-read per scroll-event; met rAF-
   coalescing is het aanvaardbaar, maar het hoort in het docblok. Geen actie vóór de merge.
7. [BEVESTIGD] Deel-1-bevinding 1 (legacyValue-docblok) is gefixt in dit deel; bevinding 3 (A21) is
   door de vraag-7-merge gedekt; bevinding 2 (26 platte checkboxes) wacht op het UI-groepenvoorstel
   van de eigenaar.
8. [VERMOED, laag] De `excludedHidden`-pin telt per bestand; een motorregressie die een uitgesloten
   cel slechter maakt terwijl een andere uitgesloten cel beter wordt, blijft onzichtbaar (netto gelijk).
   Aanvaardbaar voor uitgesloten populatie; benoemd, geen actie.
9. [BEVESTIGD] Het restant van 104 is volledig verklaard en niet bouwbaar zonder nieuw bewijs of
   nieuw besluit: HarbourPointe 89 (48 opvolgers van verouderde taken, 34 ALAP achter EC1420 —
   vraag 13, 7 mijlpaalvloer n=1), Sample 12 (SF-minuut n=1 zonder bron), Hotel 3 (ALAP-eindmijlpaal).

**Oordeel Fable (voorlopig, B1 uitgezonderd): GO voor de etappe als geheel.** De motor kent geen
bronformaat, elke P6-regel is een benoemde conventie met bron en meting, de meetlat is eerlijk
(alleen P6-uitvoer, ratchet per cel op emmer én grootte, uitsluitingen alleen per eigenaarsbesluit),
en de documentatie volgt de code. B1 (invoercoherentie) volgt na zijn tweede fixronde als eigen
merge met eigen her-check.

## Deel 3 — B1 gemerged (`520c1bf7` + `7f2fc214`, 2026-09-24 ~00:33)

Eigen her-check van de tweede fixronde (`8b9358b0..f0bbf901`, Opus 5.5): de reconcile staat in alle
vier de paden ná `clearLevelingGaps` (taskSlice `updateTask`/`setTaskCalendar`, MCP
`updateTaskFields`/`patchTaskFields`; het gridpad stond al goed: `applyOneCellEdit` en de groepsroute
in `taskEditPlan.ts`), met per pad een check met een nivelleergat die met de oude volgorde rood wordt.
De mutantentabel in de testkop noemt nu de echte aantallen. De niet-herleidende paden (project-/gedeelde
kalender, split zonder duur, nivelleerder, `moveProject`, `.mpp`-resourcekalender) staan als bewuste keuze
in docblok en gids. Eén spelfout (`hamock`) in de merge gecorrigeerd. [BEVESTIGD]

Eén rode gerichte check ná de merge, `check-profile-switch-dates` 08/09 (3 verwacht, 2 gekregen): geen
regressie maar de vraag-7-merge — A1 (voltooid) verliest onder P6 zijn statusdatumvenster niet meer omdat
B3 in P6 uit staat, dus P6 en OPS geven A1 dezelfde datums; alleen A4 en M1 schuiven nog. Telling en
kopcommentaar bijgewerkt (`7f2fc214`). [BEVESTIGD met een ES/EF-dump per taak]

**Oordeel Fable: GO voor de hele etappe, B1 inbegrepen**, onder voorbehoud van de lopende keten
(`measure:profiles` moet 104/0/0/0 blijven, `verify` EXIT=0) — uitslag in de overdracht §2.
