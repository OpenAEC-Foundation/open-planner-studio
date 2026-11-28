# Taken toevoegen via MCP: de standaardduur en de duur van een nieuwe ouder

`planner_add_tasks` neemt per item dezelfde velden als `fields` van `planner_update_tasks`, via dezelfde allowlist
(`parseTaskFields`, ADR 0243). Toets: `cases-taskfields.ts`, "update_tasks.fields kent precies de velden van
add_tasks …". Een onbekend of ongeldig veld laat de hele aanroep falen (ADR 0490). Wat de draft daarna met de items
doet, staat in ADR 0242; de verse tijd en velden van een nieuwe taak in ADR 0210 en 0211.

## Gevolgen

- `parseTaskFields` geeft een tijddeel bij `duration`, bij `durationType` en bij `isMilestone: true`; die laatste zet
  zelf `scheduleDuration` 0. Alleen met een tijddeel maakt `addTasksCore` de tijd van het item, met
  `createDefaultTaskTime` vanaf `project.startDate` (anders vandaag), op de kalender die het item als `calendarId`
  noemt en anders de projectkalender. Zonder `scheduleDuration` in het tijddeel, dus met alleen `durationType`, geeft
  de kern de draft 5 in de dagenmaat als invoer. Zonder tijddeel geeft de kern geen tijd mee en begint `draft.addTask`
  bij 5 in de maat van `newTaskTimeUnit`. In beide gevallen beslist daarna `settleNewTaskMeasure` in `draft.addTask`
  over de maat die de taak krijgt (ADR 0156), bijvoorbeeld de urenmaat bij `FIXED_WORK`. In het nagespeelde geval
  van knownbug 2530 (het rekenprofiel van een nieuw project, de urenmaat als standaard, geen vast werk) geven de twee
  invoeren verschillende duren.
- Een item dat de ouder is van een ander item in dezelfde aanroep, mag geen tijddeel met `scheduleDuration` dragen
  (`SUMMARY_DURATION_READ_ONLY`), want de duur van een verzameltaak volgt uit haar kinderen. Dat geldt voor `duration`,
  ook in uren (`parseTaskFields` zet dan ook `scheduleDuration`), en voor `isMilestone: true`. `parseAddTasks` toetst
  het pas als alle items gelezen zijn, omdat een ouder vóór of na zijn kinderen mag staan. Toets:
  `cases-taskfields.ts`, "knownbug 82: add_tasks weigert een expliciete duur op een nieuwe ouder, ongeacht volgorde" (een fase met duur 20 en een kind met duur 2,
  in beide volgordes; de toets eist `VALIDATION`, ongewijzigde taken en geen nieuwe geschiedenisstap, en zonder
  ouderduur krijgt de fase de duur 2 van haar kind).
