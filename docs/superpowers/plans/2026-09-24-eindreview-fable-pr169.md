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

## Deel 2 — eindstand (na merge van de besluiten van 24-09): volgt.
