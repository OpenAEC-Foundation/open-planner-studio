# De kalender en de duur van een taak bij het schrijven

De IFC-, MSPDI-, P6 XML- en XER-writer hebben per taak haar effectieve kalender en haar duur in minuten nodig. Ze delen
daarvoor de helpers in `src/services/subdayIo.ts`, zodat de formaten dezelfde taak in dezelfde maat schrijven.

## Gevolgen

- `effectiveCalendarByTask` geeft per taak de kalender uit `task.calendarId` als die in de meegegeven bibliotheek
  staat, en anders de projectkalender, ook bij een `calendarId` dat nergens naar wijst. Gebruikers: `ifcWriter`,
  `GanttCanvas` en `exportCalendarLayout`.
- `exportCalendarLayout` (`mspdiWriter`, `p6xmlWriter`, `xerWriter`) geeft de projectkalender nummer 1 en de andere
  bibliotheekkalenders 2, 3 en verder in de volgorde van de bibliotheek. De bibliotheek die de writer meegeeft, bevat
  ook de projectkalender zelf; die valt er op id uit, anders kwam er twee keer een kalender 1. De nummering gebruiken
  `mspdiWriter` en `p6xmlWriter`.
- `taskMinutesForWrite` (`ifcWriter`, `mspdiWriter`, `p6xmlWriter`, `xerWriter`): een taak in de urenmaat schrijft
  `durationMinutes` (zonder waarde 0); een andere taak `scheduleDuration × uren per dag × 60`, afgerond op hele
  minuten, met de uren per dag die de writer meegeeft. Het is dezelfde regel als `durationMinutesOf` in
  `duration.ts`, maar met afronding en zonder de rekenmotor.
- In `taskMinutesForWrite`, `exportCalendarLayout` en `fileHasHourData` komt de maat van een taak uit
  `taskDurationUnit`, met dezelfde regel als het laden voor een taak zonder
  `durationUnit` (ADR 0301), omdat een writer ook taakobjecten zonder `durationUnit` krijgt, uit tests en extensies.
