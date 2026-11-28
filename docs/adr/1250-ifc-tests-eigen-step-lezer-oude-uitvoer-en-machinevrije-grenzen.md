# IFC-tests: een eigen STEP-lezer, uitvoer van een oudere writer en grenzen die niet van de machine afhangen

De IFC-tests in `tests/planning/` toetsen wat de writer schrijft en wat de lezer leest. Een toets die het bestand met de
productielezer naleest, ziet een attribuut op de verkeerde plek niet: de lezer leest het van dezelfde verkeerde plek
terug (`docs/ifc-round-trip.md`, *Schemageldigheid*). De tests lezen de STEP-tekst daarom met een eigen parser of
hulpfunctie, en leggen de productielezer er pas naast. Bestanden en regels van een oudere writer blijven zoals ze zijn,
en een schaaltoets keurt op een telling, niet op tijd.

## Gevolgen

- `ifcSchemaCheck.ts` (`parseStep` en de schematoets) importeert niets uit `src/`. `check-ifc-calendar-index.ts` en
  `check-ifc-projectdatum-tijd.ts` gebruiken die parser; `check-ifc-arity.ts`, `check-ifc-globalid.ts` en
  `check-ifc-werktijd-per-dag.ts` tellen argumenten of lezen slots met een eigen hulpfunctie. Vervang die niet door
  `parseSTEP` of de slothelpers van de lezer.
- De fixtures `ifc-arity-oude-writer.ifc`, `h7-kalender-oude-writer.ifc` en `h7-tijden-oude-writer.ifc` zijn
  geschreven met een oudere writer; `ifc-arity-oude-writer-merged.ifc` is zo'n oud bestand na `MergeProjects` van
  IfcOpenShell 0.9.0. De `.json` naast de twee H7-fixtures legt vast wat er vóór het opslaan in het geheugen stond
  (writer 531940ac). Schrijf ze niet opnieuw met de huidige writer. Per fixture verschilt wat ze beschermen:
  `check-ifc-legacy-arity.ts` toetst eerst dat een ariteitsfixture echt de oude ariteit heeft; de MergeProjects-fixture
  bevat een terrein en een muur, en de test leest de planning pas nadat die twee modelregels zijn weggefilterd
  (knownbug 110). De H7-tests verwachten de kalenderwaarden van vóór het opslaan, ook waar de oude writer een
  ongeldige tijd schreef (`7.5:00:00`, dat de lezer van toen tot 07:00 afkapte).
- `GOLDEN` in `check-ifc-werktijd-per-dag.ts` legt de kalenderregels vast (met relatieve STEP-verwijzingen `#+n`) van
  een uniforme uurweek en van een dagkalender, zoals de writer van main 1e192b31a ze schreef, vóór de indeling per
  weekdag (`docs/ifc-round-trip.md`, *Kalenders: werkblokken per weekdag*). Twee verschillen zijn bewust, van de
  schemafix (*Schemageldigheid*): REAL met decimale punt (`IFCREAL(16.)`) en het slot `Identification` in
  `IFCWORKCALENDAR`. Een ander verschil is een fout in de writer; werk de lijst alleen bij met een besluit over de
  bestandsvorm.
- `check-ifc-calendar-index.ts` telt kalenderlezingen tegen een lineair budget, en `check-ifc-nesting-index.ts` toetst
  bij 1.000 tot 10.000 taken alleen de uitkomst. Een tijdsgrens
  zou van de runner afhangen. De vergelijkende tijdmeting draait apart in CI (`perf-ifc-nesting.yml`,
  `perf-ifc-kalenderindex.yml`, `perf-ifc-ploegindex.yml`), op dezelfde invoer uit `ifcNestingFixture.ts`,
  `ifcCalendarIndexFixture.ts` en `ifcCrewIndexFixture.ts`.
