# Het ingevoerde einde van een urentaak volgt de invoer, niet de berekening

`scheduleFinish` is invoer: de berekening schrijft hem niet terug (`applyCpmResult`, zie ook ADR 0156). De solver
leest `scheduleFinish` onder de P6-conventies als het geplande einde uit de bron, bijvoorbeeld in
`p6CompletedTargetWindow.ts`; schreef de berekening hem terug, dan werd de uitkomst van de ene berekening invoer voor
de volgende. Het einde van een urentaak houdt daarom de invoerkant bij: `reconcileHourInputFinish` na een bewerking en
`seedNewHourTaskFinish` bij een nieuwe taak, beide met `hourTaskInputFinish`. Of een taak meebeweegt, beslist
`hourInputFinishFollowsEdits`. Toets: `check-hour-input-finish.ts`.

## Gevolgen

- De uitzonderingen in `hourInputFinishFollowsEdits` en hun reden. Een dagtaak beweegt niet mee. Bij een taak met een
  andere `status` dan `NOT_STARTED`, werkelijke datums of voortgang is het geplande einde geschiedenis, zoals in P6.
  `p6ExplicitTargetWindow` zetten de XER- en de P6 XML-lezer: dat venster is bronwaarde en mag planningsruimte
  bevatten. Bij een handmatig geplande taak is `scheduleFinish` het einde zelf (ADR 0024). Een hammock en een
  samenvattingstaak hebben een afgeleide spanne.
- `reconcileHourInputFinish` verandert het einde alleen als de sleutel van `hourInputFinishBasis` (start, eenheid,
  duur, duurtype, `calendarId`, mijlpaal) na de bewerking anders is dan ervoor, en als de bewerking `scheduleFinish`
  zelf niet veranderde. Een einde uit dezelfde bewerking wint dus (de kolom *Gepland einde*, een uursleep); een
  meegegeven einde dat gelijk is aan het oude telt als niet gezet. Een naamswijziging verandert de sleutel niet en
  laat het einde staan. De volgorde in `updateTask` staat in ADR 0153.
- `reconcileHourInputFinish` wordt aangeroepen door `taskSlice.updateTask` en `setTaskCalendar`, de MCP-draft, het
  taakraster (`reconcileGridInputFinish` in `taskEditPlan.ts`) en `settleDurationAftermath`. Deze routes roepen haar
  niet aan, dus daar blijft het einde staan tot een latere bewerking via een van die aanroepers de sleutel verandert:
  de project- en de gedeelde kalenders bewerken (`setCalendar`, `setProjectCalendar`, `updateCalendar`,
  `commitCalendarLibrary`) en een taakkalender verwijderen (`removeCalendar`); waar die `settleCalendarChange`
  gebruiken, keert dat voor een urentaak terug voordat het `settleDurationAftermath` bereikt. Verder de nivelleerder
  (`writeLevelingResult`) en project verplaatsen (`moveProject.ts`), dat `scheduleFinish` verschuift en niet opnieuw
  afleidt. `applyTaskSplits` zet het einde zelf (`splitScheduleFinish`). Een geopend bestand houdt het einde uit het
  bestand (toets, deel 18).
- `hourTaskInputFinish` telt bij `ELAPSEDTIME` klokminuten en bij werktijd werkminuten plus de splitgaten
  (`splitTotalSpanMinutes`). Het geeft `undefined` bij een onleesbare start of, bij werktijd, een kalender zonder
  uurmodus; dan laat de aanroeper het einde staan.
- In `taskSlice.addTask` en `draft.addTask` wint een meegegeven einde, behalve als de taak daar naar urenmaat ging
  (ADR 0156). `api.data.addTask` haalt bij een meebewegende urentaak zonder `scheduleFinish` ook een meegegeven
  `earlyFinish` en `lateFinish` weg (`fromExtTaskAddInput` in `extMappers.ts`), zodat de store het einde afleidt.
- `createDefaultTaskTime` gebruikt het einde van `hourTaskInputFinish` alleen bij een urentaak met kalender, en als
  dat een einde geeft; anders rekent het de duur als werkdagen. De XER-lezer roept het zonder kalender aan en zet
  daarna het einde uit de bron.
