# Taken toevoegen via MCP: de standaardduur en de duur van een nieuwe ouder

`planner_add_tasks` neemt per item dezelfde velden als `fields` van `planner_update_tasks`, via dezelfde allowlist
(`parseTaskFields`, ADR 0243). Toets: `cases-taskfields.ts`, "update_tasks.fields kent precies de velden van
add_tasks …". Een onbekend of ongeldig veld laat de hele aanroep falen (ADR 0490). Wat de draft daarna met de items
doet, staat in ADR 0242; de verse tijd en velden van een nieuwe taak in ADR 0210 en 0211.

## Gevolgen

- De tijd van een nieuw item maakt `addTasksCore` alleen als de veldpatch een tijddeel heeft (`duration`,
  `durationType` of `isMilestone: true`), met `createDefaultTaskTime` vanaf `project.startDate` (anders vandaag), op de
  kalender die het item als `calendarId` noemt en anders de projectkalender. Een tijddeel zonder `duration` heeft alleen `durationType`; dan wordt het een taak van 5 in de
  dagenmaat. Zonder tijddeel geeft de kern geen tijd mee en kiest `draft.addTask`: 5 in de maat van `newTaskTimeUnit`,
  een mijlpaal 0. Bij een project met de urenmaat als standaard zijn dat twee verschillende duren (knownbug 2530). Het
  weggehaalde commentaar noemde beide dezelfde standaard.
- Een item dat de ouder is van een ander item in dezelfde aanroep, mag geen `duration` dragen
  (`SUMMARY_DURATION_READ_ONLY`), want de duur van een verzameltaak volgt uit haar kinderen. `parseAddTasks` toetst dat
  pas als alle items gelezen zijn, omdat een ouder vóór of na zijn kinderen mag staan; een duur in uren telt mee,
  want `parseTaskFields` zet dan ook `scheduleDuration`. Toets: `cases-taskfields.ts`, "knownbug 82: add_tasks
  weigert een expliciete duur op een nieuwe ouder, ongeacht volgorde" (een fase met duur 20 en een kind met duur 2,
  in beide volgordes; de toets eist `VALIDATION`, ongewijzigde taken en geen nieuwe geschiedenisstap, en zonder
  ouderduur krijgt de fase de duur 2 van haar kind).
- Een `customTaskType` in een item komt vóór het aanmaken in de catalogus van het project
  (`draft.ensureCustomTaskType`).
