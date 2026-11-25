# MPP lezen: de decoder levert werkminuten en wandelt geen kalender, anders dan MPXJ

Volgens het weggehaalde commentaar weeft MPXJ het irreguliere en het reguliere blok samen (kalenderbewust, `splitItem`)
en zet het de periodegrenzen om in echte kalendermomenten (`ProjectCalendar.getDate`, `getNextWorkStart`): de
verstreken werkminuten in het bestand zijn werktijd, geen 24-uursklok. `mppTimephased.ts` doet bewust minder. Het
blijft een pure omzetting van bytes in periodes, zonder kalender en zonder planningsgedrag, zodat de enige
kalenderwandeling op één plek staat: de verschuiving van een toewijzing naar de as van de taak in `mppReader.ts`
(`computeShiftedAssignmentPeriods`, ADR 0287). Het primaire resultaat van formaat A en B is daarom de positie op de
werkminutenas, `elapsedWorkMinutesStart` en `elapsedWorkMinutesEnd` (`TimephasedWorkPeriod`).

## Gevolgen

- `approxStart` en `approxFinish` zijn een benadering: `referenceStart` plus de werkminuten als 24-uurs klokminuten
  (`addClockMinutes`). Ze horen niet in een beslissing over een datum of de planning. `addClockMinutes` is een eigen
  helper en geen import uit de engine, omdat de decoder geen afhankelijkheid van de engine heeft. `shiftPeriods`
  verschuift alleen de werkminuten en laat de benadering op het oude anker (`check-mpp-import.ts`, `[Z4 shift]`).
- Het reguliere en het irreguliere blok worden niet samengeweven. `decodeIrregularTimephasedWork` levert zijn
  periodes als eigen type (`TimephasedIrregularPeriod`) met de absolute tijdstempels uit het bestand. Omdat dat blok
  geen veld voor de hoeveelheid werk heeft (volgens het weggehaalde commentaar gebruikt MPXJ het alleen om een
  regulier record te corrigeren), telt de decoder het hele tijdvak als werk: een eigen keuze van OPS, geen poort van
  MPXJ. `[Z3 1c]` toetst twee records van 60 en 120 minuten.
- Formaat B met N 0 (ADR 0410 en 0411) is één samenvattend record voor de hele toewijzing. Volgens het weggehaalde
  commentaar ankert MPXJ het op de start of hervatting en het einde van de toewijzing. De decoder heeft daarvoor een
  tweede anker nodig: zonder `referenceFinish` levert hij een lege lijst, met `referenceFinish` één periode van werkminuut
  0 tot de klokminuten tussen `referenceStart` en `referenceFinish`, met de ankers zelf als `approxStart` en
  `approxFinish` (`[Z3 F1]`). Dat einde is dus een lengte in klokminuten op de werkminutenas. Wie welk anker meegeeft,
  staat in ADR 0287 (splits en contouren: zonder) en ADR 0288 (het venster: zonder; het werk van een wandeling: met).
