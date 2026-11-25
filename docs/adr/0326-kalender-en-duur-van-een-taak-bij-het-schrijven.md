# De kalender en de duur van een taak bij het schrijven

De IFC-, MSPDI-, P6 XML- en XER-writer hebben per taak haar effectieve kalender en haar duur in minuten nodig. Ze delen
daarvoor de helpers in `src/services/subdayIo.ts`. Een taak in de urenmaat krijgt zo in de vier writers dezelfde
minutenwaarde (`taskMinutesForWrite`). Een dagtaak niet: de IFC-writer heeft daarvoor een eigen schrijfpad in
`ifcWriter.ts`, en de MSPDI-, P6 XML- en XER-writer schrijven haar via `writeDays` (`xmlDayMeasure.ts`) met de
minuten per dag die de adapter kiest.

## Gevolgen

- `effectiveCalendarByTask` geeft per taak de kalender uit `task.calendarId` als die in de meegegeven bibliotheek
  staat, en anders de projectkalender, ook bij een `calendarId` dat nergens naar wijst. Gebruikers: `ifcWriter`,
  `GanttCanvas` en `exportCalendarLayout`.
- `exportCalendarLayout` (`mspdiWriter`, `p6xmlWriter`, `xerWriter`) geeft in `calendarNumber` de projectkalender
  nummer 1 en de andere bibliotheekkalenders 2, 3 en verder in de volgorde van de bibliotheek. De bibliotheek die de
  writer meegeeft, mag de projectkalender zelf bevatten; die valt er op id uit (`libraryCalendars`). Dat filter
  voorkomt dat een writer de projectkalender twee keer schrijft en dat de lus over de bibliotheek haar nummer in de
  gedeelde nummering overschrijft. `calendarNumber` gebruiken `mspdiWriter` en `p6xmlWriter`; `xerWriter` geeft zijn
  kalenders eigen id's (`allocateIds`).
- `taskMinutesForWrite` (`ifcWriter`, `mspdiWriter`, `p6xmlWriter`, `xerWriter`): een taak in de urenmaat schrijft
  `durationMinutes` (zonder waarde 0); een andere taak `scheduleDuration × uren per dag × 60`, afgerond op hele
  minuten, met de uren per dag die de writer meegeeft. De vier writers roepen de functie aan voor de duur van een
  urentaak. `p6xmlWriter` roept haar voor elke geëxporteerde bladtaak aan (de lus over `leafTasks`; een fase valt
  daarbuiten), maar schrijft de geplande duur van een dagtaak daarna met `writeDays`. De uitkomst van de tak voor een
  andere taak telt alleen bij een lag in procenten, als duur van de voorganger in `p6RelationshipLag`
  (`p6xmlWriter.ts`), die ook `xerWriter` gebruikt. Het is dezelfde regel als `durationMinutesOf` in `duration.ts`,
  maar met afronding en zonder de rekenmotor.
- In `taskMinutesForWrite`, `exportCalendarLayout` en `fileHasHourData` komt de maat van een taak uit
  `taskDurationUnit`, met dezelfde regel als het laden voor een taak zonder `durationUnit` (ADR 0301), omdat een
  writer ook taakobjecten zonder `durationUnit` krijgt, uit tests en extensies.
