# Het ingevoerde einde van een urentaak volgt de invoer, niet de berekening

`scheduleFinish` is invoer: de berekening schrijft hem niet terug (`applyCpmResult`, zie ook ADR 0156). De solver leest
`scheduleFinish` onder de P6-conventies als het geplande einde uit de bron, bijvoorbeeld in
`p6CompletedTargetWindow.ts`; schreef de berekening hem terug, dan werd de uitkomst van de ene berekening invoer voor de
volgende. Het einde van een urentaak houdt de invoerkant daarom bij: na een bewerking `reconcileHourInputFinish`, bij
een nieuwe taak `seedNewHourTaskFinish`, en beide rekenen met `hourTaskInputFinish` (start plus duur op de kalender van
de taak). Zonder die afleiding bleef het einde na een duurwijziging oud staan, en dat einde gaat het bestand in
(`IfcTaskTime.ScheduleFinish`). Een dagtaak valt erbuiten (`hourInputFinishFollowsEdits`). Toets:
`check-hour-input-finish.ts`.

## Gevolgen

- Welke taak meebeweegt, beslist `hourInputFinishFollowsEdits`, met een reden per uitzondering. Bij een gestarte of
  voltooide taak is het geplande einde geschiedenis, zoals in P6. `p6ExplicitTargetWindow` zetten de XER- en de P6
  XML-lezer: dat venster is bronwaarde en mag planningsruimte bevatten. Bij een handmatig geplande taak is `scheduleFinish` het einde
  zelf (ADR 0024). Een hammock en een samenvattingstaak hebben een afgeleide spanne. De toets zet elke uitzondering
  apart vast.
- Zet dezelfde bewerking zelf een einde (de kolom *Gepland einde*, een uursleep, een extensie), dan wint dat einde.
  `reconcileHourInputFinish` herkent dat aan een `scheduleFinish` die verschilt van de basis van vóór de bewerking
  (`hourInputFinishBasis`); een meegegeven einde dat gelijk is aan het oude telt dus als niet gezet. De basis wordt vóór
  de bewerking vastgelegd; de volgorde in `updateTask` staat in ADR 0153.
- Aanroepers van `reconcileHourInputFinish`: `taskSlice.updateTask` en `setTaskCalendar`, de MCP-draft
  (`createMcpTransactions.ts`), het taakraster (`reconcileGridInputFinish` in `taskEditPlan.ts`) en
  `settleDurationAftermath` (`workRuleApply.ts`), waar een duur uit de werkdriehoek langskomt. Een route die deze
  functie niet bereikt, laat het einde staan tot de volgende invoerbewerking van de taak; de nivelleerder
  (`writeLevelingResult`) is zo'n route. Laden loopt er niet doorheen: een geopend bestand houdt het einde uit het
  bestand (toets, deel 18). `applyTaskSplits` zet het einde zelf (`splitScheduleFinish`).
- `hourTaskInputFinish` rekent op de kalender die de aanroeper meegeeft; alle aanroepers geven de taakkalender
  (`resolveCalendar` met `task.calendarId`), nooit een resourcekalender. Geeft de functie `undefined` (een onleesbare
  start, of een kalender zonder uurmodus bij werktijd), dan laat de aanroeper het einde staan.
- Bij een nieuwe taak wint een einde dat de aanroeper meegaf; `earlyFinish` en `lateFinish` volgen het afgeleide einde
  alleen als de aanroeper ze niet noemde. De extensie-API `api.data.addTask` vult een ontbrekend einde niet met de
  start (`fromExtTaskAddInput` in `extMappers.ts`), zodat de store het afleidt. `sdk.factory.createTask` leidt niets
  af: het is een bouwer zonder document of kalender.
- `createDefaultTaskTime` leidt het einde van een urentaak alleen af als het een kalender krijgt. Zonder kalender
  rekent het de duur als werkdagen; de XER-lezer roept het zo aan en zet daarna het einde uit de bron.
