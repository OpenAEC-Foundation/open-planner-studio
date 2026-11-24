# Twee patchroutes voor een taak in de draft, en de route van planner_update_tasks

De publieke tool `planner_update_tasks` (`taskTools.ts`) haalt `fields` door de allowlist van `parseTaskFields`
(`services/mcp/tools/taskFields.ts`, via `resolveFieldsPatch`). Die weigert de tak `time` zelf, omdat die de berekende
datums, de speling en de werkelijke datums zou wissen (`REJECT_HINTS`), en zet een duur om in losse duursleutels. De
tool schrijft daarmee via `draft.patchTaskFields`, en een `workRule` daarna apart via `draft.setTaskWorkRule`, zodat een
duur in hetzelfde item onder de oude werkregel wordt verwerkt. Toets: `cases-work-rule.ts`, "workRule + duration in één
call …" (een taak met één toewijzing krijgt `duration: 8` en `FIXED_WORK`; de toets eist inzet 1 en daarna restwerk van
8 dagen).

In de interne laag zijn er twee routes. `draft.patchTaskFields` zet de losse duursleutels op een kopie van de tijd
(`patchTime`), of op een meegegeven `top.time`, die de tool niet geeft. `draft.updateTaskFields` voegt een
`Partial<Task>` samen met `mergeTaskUpdate` (ADR 0212); geen code in `src/` of `headless/` roept haar aan, alleen tests
in `tests/mcp/`. Wat ze met `taskSlice.updateTask` gemeen hebben, doen ze in de volgorde van ADR 0153; de toetsen vooraf
op een onleesbare start en op `milestoneRefusal` hebben ze niet, en `patchTaskFields` mist de stap voor voortgangswerk
(`captureProgressWork`). Een andere volgorde in de draft kan dezelfde bewerking via de bridge een andere taak laten
opleveren dan in het paneel, dat via `updateTask` schrijft. Bekende verschillen en grenzen: knownbug 2001 en 2002.

## Gevolgen

- `parseTaskFields` zet `clearDurationMinutes` bij een duur in dagen en bij `isMilestone: true`. `patchTime` verwijdert
  `durationMinutes` dan, zodat de minutenbron van de urenmaat niet achterblijft, zoals `mergeTaskTime` bij een wissel
  naar dagenmaat (ADR 0212). Het verwijdert de sleutel met `delete` en zet hem niet op `undefined`, zodat het taakobject
  voor IFC schoon blijft, zoals bij `draft.updateResource` (ADR 0101).
- Een te korte duur geeft in de draft geen melding maar `refused` terug (ADR 0241); een meegeschoven voortgang komt
  terug als `progress` en staat in het antwoord van `planner_update_tasks` als `progressAdjusted`.
- Alleen `draft.patchTaskFields` neemt `deferCompletion` aan; `planner_update_tasks` geeft het mee als hetzelfde item
  ook een voortgangsblok draagt.
