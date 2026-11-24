# MSPDI lezen: duur, rest, lag en baseline in de maat van de schrijver

Voor duur, rest en lag volgt `readMSPDI` de spec alleen-uren (`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`
§3.3 en §3.10; T13, T15, T21): het standaardveld draagt de lengte in minuten, en de dagenmaat komt alleen terug met
de OPS-markering en een record dat nog bij die lengte past (`readMeasure`, `lagRecordHolds`). Hier staan de keuzes
in de lezer die de spec niet uitschrijft. Ze komen uit één regel: de lezer rekent een dag om met dezelfde maat als
de schrijver die het bestand maakte, anders verandert een getal bij elke rondgang. `check-uren-f5a2-adapters.ts`
toetst de rondgangen, tenzij hieronder een andere toets staat.

## Gevolgen

- Een dag in de dagenmaat is de werktijd per dag van de taakkalender (`dayMeasureMinutesPerDay`; bij een
  kalendertijdtaak 1440 minuten) als de projectkop de definitie `OPS_DayMeasureDurations` draagt
  (`workdayIsWorkTime`). Zonder die definitie komt het bestand van OPS tot en met F5a-1 of van een ander programma,
  en telt een dag de opgeslagen uren per dag van de kalender (`hoursPerDay`), zoals die writer schreef ((8)).
  `workdayIsWorkTime` geldt ook voor het werk van een toewijzing (ADR 0257) en, via `dayMinutesPerDay`, voor de
  baselineduur.
- `LinkLag` telt in tienden van een minuut en de lezer rondt niet af (`lagMinutes = LinkLag / 10`, review #591 r2). `LagFormat` 19 en
  20 geven een procentlag (`lagPercent = LinkLag / 10`, 20 in kalendertijd), 8 kalenderdagen (`lagDays`), 4, 6, 10 en
  12 kalenderminuten; elk ander formaat is werktijd. Getoetst: de procentlag in `check-uren-f5a-adapters.ts`,
  LagFormat 6, 7 en 8 in `check-xml-adapter-fidelity.ts` #4.
- Een lagrecord uit `OPS_DayMeasureLags` telt alleen bij een werktijdformaat, alleen met twee elementen (een record
  met een eenheid erbij hoort bij P6 XML, spec §3.3) en alleen als zijn sleutel (voorganger-UID plus relatietype,
  `lagRecordKey`) bij die opvolger één keer voorkomt: twee relaties met dezelfde sleutel maken het record
  dubbelzinnig. De lagkalender komt uit `OPS_LagCalendar` op de projectsamenvattingstaak (UID 0, `OutlineLevel` 0,
  direct onder `<Tasks>`); zonder dat veld rekent `lagRecordHolds` met de standaard, en een record dat met een andere
  lagkalender is geschreven telt dan niet ((5)).
- Een onbekend relatietype wordt FS (`mspTypeToSequenceType`); de `.mpp`-lezer gebruikt dezelfde functie. Dat MPXJ
  dezelfde codes en dezelfde terugval heeft, komt uit het weggehaalde commentaar en is niet in de repo nagegaan.
- `mspDurationMinutes` telt een dagcomponent (`P2D`, `P2DT4H`) als 1440 minuten, ook in werktijd (knownbug 2010).
  Alleen een taak met de duureenheid `days` leest een kale `PnD` als dagen (`wholeDays`).
- De baselineduur rekent met dezelfde dag als de taakduur (`mspdiBaselineDays`): bij een urentaak werkminuten ÷ de
  werktijd per dag van de taakkalender (`hourTaskScheduleDuration`), anders `parseMSPDuration` met
  `dayMinutesPerDay`. `check-dag-is-werktijd.ts` §8 toetst een urentaak op een kalender met 8 u per dag en blokken
  van 10 u; een kalendertijdtaak is niet getoetst. Een baseline zonder leesbare start of einde krijgt geen regel:
  `BaselineTask` eist beide datums, en vandaag invullen zou een afwijking tonen die het bestand niet heeft
  (`check-mspdi-hour-baseline.ts`).
