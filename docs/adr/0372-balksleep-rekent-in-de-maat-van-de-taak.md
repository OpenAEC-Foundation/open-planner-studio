# Een balksleep rekent in de maat van de taak

Sinds het minutenmodel heeft ook een dagtaak momenten, maar niet elke taak telt haar duur op dezelfde manier. Een
sleep die anders rekent dan de motor, geeft na F5 een andere balk dan de planner losliet. Daarom kiest
`useBarDrag` bij het begin van het effect één rekenwijze uit de taak en het rekenprofiel (`dragKind`), en volgt die
de maat waarin de motor dezelfde taak rekent.

## Gevolgen

- De keuze, in deze volgorde: een urentaak (`taskDurationUnit` is `hours`) rekent in werkminuten
  (`resolveHourBarDrag`). Mist de oorspronkelijke start of finish een tijd, dan rekent de sleep in hele werkdagen
  (ADR 0373). Telt het profiel de taak in de dagenmaat (`taskCountsInWorkdays` met `workdayDurationMeasure`,
  zonder opgave aan zoals in het OPS-profiel), dan rekent hij in werkdagen met een breuk
  (`resolveDayMeasureBarDrag`). Anders, onder P6 en MS Project waar een dag de urenmaat is, rekent hij als een
  urentaak (`daysAsHours`).
- Bij `daysAsHours` gaat de duur terug als `scheduleDuration`: de werkminuten gedeeld door de werktijd per dag,
  afgerond op zes decimalen; bij kalendertijd door 1440 minuten. Bij een urentaak gaat ze terug als `durationMinutes`, bij de dagenmaat als
  `scheduleDuration` in werkdagen.
- Kalendertijd (ELAPSEDTIME) telt nooit in de dagenmaat (`taskCountsInWorkdays`) en loopt dus via de uursleep, op
  de klok zoals de motor: `ELAPSED_DRAG_CLOCK` (`hourBarDragMath.ts`), een dag van 1440 minuten en geen snap naar
  een werkmoment. Een taak in kalendertijd sleept zonder splitpauzes.
- De uursleep en de dagenmaatsleep bouwen hun engine met `calendarForEngine`, dezelfde kalenderfabriek als de
  scheduler, en lezen de muispositie terug via dezelfde `GanttAxis` als de renderer. Onder werkdagencompressie
  betekent een getoonde kolom zo ook voor een urentaak de kolom die de planner zag.
- De stap volgt de zoom (`hourSnapMinutesFor` in `timelineSnap.ts`): hele dagen onder `MAX_DAY_ZOOM`
  (400 px per dag), daarboven uren of kwartieren. Bij dagzoom telt de dagenmaatsleep (en de mijlpaal, ADR 0376)
  per getoonde kolom met `dragWorkdaySteps`: de kolommen op de getekende as van de projectkalender, daarna de
  werkdagen van de taakkalender vanaf de werkdag van de gegrepen rand. `check-f4b-splits.ts` roept
  `dragWorkdaySteps` en `resolveDayMeasureBarDrag` rechtstreeks aan; `check-hour-bar-drag.ts` doet dat voor
  `resolveHourBarDrag`. Geen van beide roept de hook aan.
- Een gesplitste balk die als geheel sleept (stuk 0, of een balk zonder bewerkbare stukken, ADR 0377), rekent zijn
  einde uit de pauzes zoals de motor. Nivelleerpauzes (`source: 'leveling'`) tellen daarbij niet mee: een
  schrijfactie die de datums of de duur verandert, wist ze in `taskSlice.updateTask` (`taskTriggerChanges`,
  `clearLevelingGaps`). Wat er dan met de linkergreep misgaat, staat in knownbug 366 en 371.
