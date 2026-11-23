# Een bewerking laat afgeleide sturing los; de wisfuncties laten de bron staan

Een taak kan gelezen sturing uit een `.mpp` dragen (ADR 0026): laag 3 is het gelezen finishvenster
(`timephasedFinishFloor`) met de gelezen toewijzingsstart (`timephasedStartAnchor`), laag 4 de kalenderwandelingen
(`timephasedDurationWalks`). Daarnaast legt de nivelleerder gaten in `splitGaps` met `source: 'leveling'`. Een gelezen
datum en een wandeling met `workMinutes` reageren niet op een latere bewerking, en een nivelleergat ligt op een vaste
plek van de werkas. Een bewerking die de tijdbasis verzet, laat ze daarom los, met de wisfuncties in
`utils/taskDefaults.ts` (`clearTimephasedWindow`, `clearTimephasedDurationWalks`, `clearLevelingGaps` en de bundels
`invalidateForTimeBaseChange` en `invalidateForAssignmentChange`). Die functies laten `timephasedContours` en de
importsplits (gaten zonder `source`) staan: dat zijn gegevens uit het bestand, de afgeleide sturing niet. De planner
kan importsplits wel zelf weghalen, bijvoorbeeld met *Alle onderbrekingen opheffen* (`setTaskSplits(id, null)`). Of
een bewerking de tijdbasis verzet, beslist `taskTriggerChanges` op de waarde (ADR 0153).

## Gevolgen

- Bij een duur- of datumwijziging (`TIMEPHASED_WINDOW_TIME_TRIGGERS`) wist `invalidateForTimeBaseChange` laag 3, en
  laag 4 alleen als een wandeling `workMinutes` draagt (`timephasedDurationWalksHaveFrozenWork`). Een wandeling zonder
  `workMinutes` rekent met de actuele duur, dus hoeft ze daarvoor niet weg. De toets gaat per item (`.some`), niet
  over de lengte van de lijst, zoals in de solver (ADR 0026).
- Een kalenderwissel van de taak is een aanleiding voor laag 3, niet voor laag 4: de solver zoekt per wandeling haar
  eigen `resourceCalendarId` op (`CPMSolver.ts`), niet `task.calendarId`. `setTaskCalendar` roept daarom zelf
  `clearTimephasedWindow` aan, en het taakraster `clearScheduleGuidance(task, false)` (`taskEditPlan.ts`). Verandert
  de werkdriehoek bij die wissel de duur van een dagtaak, dan bereikt `settleCalendarChange` via
  `settleDurationAftermath` wel `invalidateForTimeBaseChange`. `updateTask` en de MCP-draft roepen bij een andere
  `calendarId` `invalidateForTimeBaseChange` aan en wissen zo ook laag 4 met `workMinutes` (knownbug 2002).
- Bij een wijziging van de toewijzingen wist `invalidateForAssignmentChange` laag 3 en laag 4 zonder voorwaarde, plus
  de nivelleergaten: elke wandeling hoort bij één toewijzing met haar resourcekalender, en een andere set toewijzingen
  maakt de lijst onwaar.
- Een bewerking van een resourcekalender is geen aanleiding om laag 4 te wissen: de solver zoekt de kalender van een
  wandeling bij elke berekening op (`resolveCalendar` met `walk.resourceCalendarId`).
- `resourceSlice.removeCalendar` en `commitCalendarLibrary` zetten `calendarId` rechtstreeks leeg, buiten
  `setTaskCalendar` om, en roepen daarom zelf `clearTimephasedWindow` en `clearLevelingGaps` aan.
- Voor gewiste sturing komt geen herberekende lijst in de plaats.
- `invalidateForTimeBaseChange` en `invalidateForAssignmentChange` wissen ook `progressBeforeRecalculation`, de
  voortgang van vóór de eerste nog niet doorgerekende voortgangsinvoer. Zolang die basis staat, leidt
  `progressPlannedDates` (`state/progressPlannedDates.ts`) bij een taak met `actualStart` en zonder `actualFinish` de
  geplande datums af uit de taak met die oude voortgang; met `datesAsRecorded` en zonder `placementEdited` leidt die
  functie niets af.
- Nivelleergaten hebben een ruimere aanleiding dan laag 3 (`LEVELING_GAP_TIME_TRIGGERS`,
  `LEVELING_GAP_TASK_TRIGGERS`): ook voortgang (`completion`, `actualStart`, `actualFinish`) en `constraint` en
  `constraint2`. Een nivelleergat ligt op de werkas van de taak (`TaskSplitGap.afterMinutes`), en voortgang verzet die
  as, want een lopende taak plant op haar werkelijke datums en restwerk (ADR 0026); een datumconstraint verzet de taak
  zoals een handmatige datum. `taskTriggerChanges` telt voortgang niet als tijdbasis. `priority` staat niet in de set:
  het is invoer voor de nivelleerder en verzet geen datum van de taak zelf. `applyLeveling` schrijft zijn gaten met
  `writeLevelingResult` en gaat niet door `updateTask`, dus wist het zijn eigen gaten niet.
- Blijft er na `clearLevelingGaps` geen gat over, dan wordt `splitGaps` `undefined` en geen lege lijst; de writer
  schrijft voor een lege of ontbrekende lijst niets (`ifcPsets.ts`, de pset `Splits`).
- Het wissen van nivelleergaten geeft geen melding: het is uitvoer van de app zelf, geen sturing uit een import (ADR
  0200). `clearTimephasedWindow` en `clearTimephasedDurationWalks` geven `true` alleen als er werkelijk iets weg is;
  die uitkomst gebruikt de aanroeper voor de melding (`state/timephasedLossNotice.ts`).
- Het eigenschappenpaneel onderscheidt twee toestanden: `taskHasActiveTimephasedSteering` (laag 3 of 4 staat er nog)
  en `taskHasTimephasedContours` (de bron staat er nog, de sturing kan al losgelaten zijn).
