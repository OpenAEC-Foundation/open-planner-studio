# MPP lezen: de decoder levert werkminuten en wandelt geen kalender, anders dan MPXJ

MPXJ weeft het irreguliere en het reguliere blok samen en zet de periodegrenzen om in echte kalendermomenten
(`ProjectCalendar.getDate`, `getNextWorkStart`). In MPXJ 2b43a48417 (de versie van ADR 0411) gebeurt het samenweven
kalenderbewust in `splitItem`; MPXJ 63cdc4e8dd bouwt eerst met de extra uren een tijdelijke werkkalender en splitst
daarna de periodes (`TimephasedAdditionalHoursHelper.splitItems`, in `getCompleteWork`). In beide versies geldt: de
verstreken werkminuten in het bestand zijn werktijd, geen 24-uursklok. `mppTimephased.ts` doet bewust minder. Het
blijft een pure omzetting van bytes in periodes, zonder kalender en zonder planningsgedrag, zodat de enige
kalenderwandeling op één plek staat: de verschuiving van een toewijzing naar de as van de taak in `mppReader.ts`
(`computeShiftedAssignmentPeriods`, ADR 0287). Het primaire resultaat van formaat A en B is daarom de positie op de
werkminutenas, `elapsedWorkMinutesStart` en `elapsedWorkMinutesEnd` (`TimephasedWorkPeriod`).

## Gevolgen

- `approxStart` en `approxFinish` zijn een benadering: `referenceStart` plus de werkminuten als 24-uurs klokminuten
  (`addClockMinutes`). Ze horen niet in een beslissing over een datum of de planning. `addClockMinutes` is een eigen
  helper en geen import uit de engine, omdat de decoder geen afhankelijkheid van de engine heeft. `shiftPeriods`
  verschuift alleen de werkminuten en laat de benadering op het oude anker. `check-mpp-import.ts` (`[Z4 shift]`)
  vergelijkt bij een verschuiving van 100 minuten de werkminuten en `workMinutes` van beide periodes en `approxStart`
  van de eerste, niet `approxFinish`, en bij een verschuiving van 0 dat dezelfde lijst terugkomt.
- Het reguliere en het irreguliere blok worden niet samengeweven. `decodeIrregularTimephasedWork` levert zijn
  periodes als eigen type (`TimephasedIrregularPeriod`) met de absolute tijdstempels uit het bestand. Omdat dat blok
  geen veld voor de hoeveelheid werk heeft (MPXJ gebruikt het in `TimephasedDataFactory.getCompleteWork` alleen om
  een regulier record te splitsen of bij te stellen), telt de decoder het hele tijdvak als werk: een eigen keuze van OPS, geen poort van
  MPXJ. `[Z3 1c]` vergelijkt bij twee records de start, het einde en `workMinutes` (60 en 120).
- Formaat B met N 0 (ADR 0410 en 0411) is één samenvattend record voor de hele toewijzing. MPXJ ankert het op de
  start of hervatting en het einde van de toewijzing (`TimephasedDataFactory.getPlannedWork`). De decoder heeft daarvoor een
  tweede anker nodig: zonder `referenceFinish` levert hij een lege lijst, met `referenceFinish` één periode van
  werkminuut 0 tot de klokminuten tussen `referenceStart` en `referenceFinish` (niet onder 0), met de ankers zelf
  als `approxStart` en `approxFinish`. Dat einde is dus een lengte in klokminuten op de werkminutenas. `[Z3 F1]`
  toetst bij dit record dat er zonder `referenceFinish` niets en met `referenceFinish` één periode komt, met het
  totale werk en de twee ankers als `approxStart` en `approxFinish`; de lengte op de werkminutenas vergelijkt de
  toets niet. Wie welk anker meegeeft, staat in ADR 0287 (splits en contouren: zonder) en ADR 0288 (het venster:
  zonder; het werk van een wandeling: met).
