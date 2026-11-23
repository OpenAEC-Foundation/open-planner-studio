# De solver laat verweesde relaties vallen en meldt fouten met een vaste tekst

`CPMSolver` krijgt alleen semantische bladtaken mee. Een samenvattingstaak krijgt haar datums uit de rollup in
`applyCpmResult`, en de gewone aanroepers schrijven een relatie op een WBS-samenvattingstaak vooraf om met
`expandSummaryRelations`. Een relatie waarvan voorganger of opvolger niet in de meegegeven taken zit, laat de
constructor vallen in plaats van te crashen: zo'n fantoom-id zou de topologische sortering in gaan en de passes
laten vallen op een ontbrekende taak. Wie `expandSummaryRelations` overslaat, krijgt de genegeerde relaties terug in
`droppedSequenceIds`.

## Gevolgen

- De waarschuwing over genegeerde relaties logt alleen als de set genegeerde ids verandert. De sleutel is statisch
  over alle instanties, omdat de nivelleerder per aanroep tientallen tot honderden solvers bouwt met dezelfde set.
- Kan de solver niet rekenen, dan geeft `solve()` een leeg resultaat met `errorInfo` (een `ScheduleErrorCode` met
  parameters, vertaald in de UI via `scheduleErrors.<code>`) en `error`, een vaste Engelse tekst per code. Die tekst
  is een compatibiliteitscontract: MCP-tools en extensies lezen hem letterlijk, en `mapTransactionError` herkent een
  kring aan "Circular dependency". Bij een kring noemt de tekst de lus in loopvolgorde met de eerste taak ook
  achteraan. De bewaker voor een urentaak zonder werktijd staat vóór de algemene bewaker voor een taak zonder
  werktijd, zodat haar code en tekst gelijk blijven.
- De kringdetectie is een iteratieve diepte-eerst-zoektocht: de recursieve versie liep bij een lineaire keten van
  ongeveer 6000 taken op een stack overflow. De topologische sortering loopt met een kopindex en een `Set`, omdat
  `shift()` en `includes()` samen kwadratisch waren (0,8 s op 20.000 taken). Beide houden dezelfde volgorde.
