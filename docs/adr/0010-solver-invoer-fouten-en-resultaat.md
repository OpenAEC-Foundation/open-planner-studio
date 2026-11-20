# De solver rekent alleen op bladtaken en meldt fouten als code

`CPMSolver` krijgt alleen semantische bladtaken mee. Een samenvattingstaak krijgt haar datums uit de rollup in
`applyCpmResult`, en de gewone aanroepers schrijven een relatie op een WBS-samenvattingstaak vooraf om met
`expandSummaryRelations`. Een relatie waarvan voorganger of opvolger niet in de meegegeven taken zit, gooit de
constructor weg in plaats van te crashen: zo'n fantoom-id zou de topologische sortering in gaan en de passes laten
vallen op een ontbrekende taak, en `openFile` slokt die fout op zodat de planning stil onberekend blijft. Wie
`expandSummaryRelations` overslaat, krijgt dus genegeerde relaties in `droppedSequenceIds` en geen crash.

## Gevolgen

- De waarschuwing over genegeerde relaties logt alleen als de set genegeerde ids verandert. De sleutel is statisch
  over alle instanties, omdat de nivelleerder per aanroep tientallen tot honderden solvers bouwt met dezelfde set.
- Kan de solver niet rekenen, dan geeft `solve()` een leeg resultaat met `errorInfo` (een `ScheduleErrorCode` met
  parameters, vertaald in de UI via `scheduleErrors.<code>`) en `error`, een vaste Engelse tekst per code.
  MCP-tools en extensies lezen die tekst letterlijk, en `mapTransactionError` herkent een kring aan
  "Circular dependency". Wijzig die teksten dus niet.
- De bewakers in `prepareSolve` stoppen vóór er een datum of duur wordt teruggeschreven: een kring, een
  projectkalender zonder werkdagen (anders levert de scangrens stil datums ver in de toekomst), een ontbrekende of
  negatieve duur in de eigen eenheid van de taak (anders plant `?? 0` stil een nulpunt), een urentaak in werktijd op
  een kalender zonder werkblokken, elke taak of projectkalender zonder geldige werktijd (er is geen dagpad meer) en
  een onleesbare startdatum. De urentaak-bewaker staat vóór de algemene, zodat haar melding gelijk blijft.
- Bij een kring noemt `cycleNames` de lus in loopvolgorde met de eerste taak ook achteraan; `cycleTaskIds` bevat
  dezelfde taken uniek, zodat het waarschuwingenpaneel kan navigeren zonder de fouttekst te ontleden.
- Zachte waarschuwingen (`cappedTaskIds`, `externalSuccessorViolations`, `externalLagCalendarFallbackTaskIds`,
  `droppedSequenceIds`) laten `error` leeg; de andere taken rekenen gewoon door. Een optioneel veld is afwezig als
  het leeg zou zijn. `cappedTaskIds` meldt een taak die tegen de scangrens van de kalender liep (bijvoorbeeld een
  aaneengesloten blok feestdagen); de kalenderwijziging is legitiem, de melding wijst de taak aan.
- `projectDuration` is een aantal werkdagen op de projectkalender (`projectDurationOf`).
- `criticalPaths` is er altijd en heeft minstens één element; zonder `floatPaths` is het precies `[criticalPath]`.
- Een solverinstantie is herbruikbaar: `prepareSolve` zet alle per-berekening verzamelde toestand terug, zodat een
  tweede `solve()` gelijk is aan een verse instantie. De enginecache blijft staan; die is deterministisch per
  kalender-id en leeft niet langer dan de instantie.
- Elke taak rekent in haar eigen kalender (`calendarFor`, met de projectkalender als terugval), met één engine per
  effectieve kalender (`engineForTaskCalendar`). De opgeslagen kalender blijft ongemoeid; scalaire werkuren worden
  alleen in de engine werkblokken. De projectstartklem gebruikt dezelfde fabriek.
- De kringdetectie is een iteratieve diepte-eerst-zoektocht: de recursieve versie liep bij een lineaire keten van
  ongeveer 6000 taken op een stack overflow. De topologische sortering loopt met een kopindex en een `Set`, omdat
  `shift()` en `includes()` samen kwadratisch waren (0,8 s op 20.000 taken). Beide houden dezelfde volgorde.
