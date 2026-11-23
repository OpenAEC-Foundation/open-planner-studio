# Een bewerking laat afgeleide sturing los, nooit de bron

Een taak uit een `.mpp` kan gelezen sturing dragen (ADR 0026): laag 3 is het gelezen finishvenster
(`timephasedFinishFloor`) met de gelezen toewijzingsstart (`timephasedStartAnchor`), laag 4 de kalenderwandelingen
(`timephasedDurationWalks`). Daarnaast legt de nivelleerder gaten in `splitGaps` met `source: 'leveling'`. Geen van
die drie reageert op een latere bewerking: een gelezen datum blijft een gelezen datum, een wandeling met `workMinutes`
houdt dat getal, en een nivelleergat ligt op een plek van de werkas. Een bewerking die de tijdbasis verzet, laat ze
daarom los. De bron wist geen van deze functies: `timephasedContours` en de importsplits (gaten zonder `source`) zijn
gegevens uit het bestand, en de afgeleide sturing is dat niet. Het wissen staat in `utils/taskDefaults.ts`
(`clearTimephasedWindow`, `clearTimephasedDurationWalks`, `clearLevelingGaps`, en de bundels
`invalidateForTimeBaseChange` en `invalidateForAssignmentChange`), zodat store, MCP-draft en taakraster dezelfde regel
volgen. Of een bewerking de tijdbasis verzet, beslist `taskTriggerChanges` op de waarde (ADR 0153).

## Gevolgen

- De lagen hebben elk hun eigen aanleiding. Bij een duur- of datumwijziging (`TIMEPHASED_WINDOW_TIME_TRIGGERS`) wist
  `invalidateForTimeBaseChange` laag 3, en laag 4 alleen als een wandeling `workMinutes` draagt
  (`timephasedDurationWalksHaveFrozenWork`). Een wandeling
  zonder `workMinutes` rekent met de actuele duur, dus hoeft ze daarvoor niet weg. De toets gaat per item
  (`.some`), niet over de lengte van de lijst, zoals in de solver (ADR 0026).
- Bij een wijziging van de toewijzingen wist `invalidateForAssignmentChange` laag 3 en laag 4 zonder voorwaarde, plus
  de nivelleergaten: elke wandeling hoort bij één toewijzing met haar resourcekalender, en een andere
  set toewijzingen maakt de lijst onwaar.
- Een bewerking van een resourcekalender is geen aanleiding om laag 4 te wissen: een wandeling verwijst naar de
  kalender, en de solver zoekt die bij elke berekening op (`resolveCalendar` met `walk.resourceCalendarId` in
  `CPMSolver.ts`).
- `resourceSlice.removeCalendar` en `commitCalendarLibrary` zetten `calendarId` rechtstreeks leeg, buiten
  `setTaskCalendar` om, en roepen daarom zelf `clearTimephasedWindow` en `clearLevelingGaps` aan.
- Voor een gewiste laag 4 komt geen herberekende lijst in de plaats; alleen een nieuwe `.mpp`-import vult hem.
- Nivelleergaten wissen bij een ruimere set dan laag 3 (`LEVELING_GAP_TIME_TRIGGERS`, `LEVELING_GAP_TASK_TRIGGERS`):
  ook bij voortgang (`completion`, `actualStart`, `actualFinish`) en bij `constraint` en `constraint2`. Een nivelleergat
  ligt op de werkas van de taak (`TaskSplitGap.afterMinutes`), en voortgang verzet die as, want een lopende taak plant
  op haar werkelijke datums en restwerk (ADR 0026); een datumconstraint verzet de taak zoals een handmatige datum.
  Voortgang wist laag 3 niet. `priority` staat niet in de set: het is invoer voor de nivelleerder en verzet geen datum van de taak zelf.
  `applyLeveling` schrijft zijn gaten op de draft en gaat niet door `updateTask`, dus wist het zijn eigen gaten niet.
- Blijft er na `clearLevelingGaps` geen gat over, dan wordt `splitGaps` `undefined` en geen lege lijst; de writer
  schrijft voor een lege of ontbrekende lijst niets (`ifcPsets.ts`, de pset `Splits`).
- Het wissen van nivelleergaten geeft geen melding: het is uitvoer van de app zelf, geen sturing uit een import (ADR
  0200). De wisfuncties voor laag 3 en 4 geven `true` alleen als er werkelijk iets weg is; die uitkomst gebruikt de
  aanroeper voor de melding (`state/timephasedLossNotice.ts`).
- Het eigenschappenpaneel onderscheidt twee toestanden: `taskHasActiveTimephasedSteering` (laag 3 of 4 staat er nog)
  en `taskHasTimephasedContours` (de bron staat er nog, de sturing kan al losgelaten zijn).
- `invalidateForTimeBaseChange` en `invalidateForAssignmentChange` wissen ook `progressBeforeRecalculation`.
- Een kalenderwissel wist via `updateTask` en de MCP-draft laag 3 en laag 4 met `workMinutes`
  (`invalidateForTimeBaseChange`); `setTaskCalendar` roept zelf alleen `clearTimephasedWindow` aan (knownbug 2002).
