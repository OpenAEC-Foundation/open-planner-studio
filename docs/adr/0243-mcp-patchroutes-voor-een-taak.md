# Twee patchroutes voor een taak in de MCP-draft, met de volgorde van updateTask

De draft heeft twee manieren om een taak te wijzigen. `draft.patchTaskFields` is de route van
`planner_update_tasks` (`taskTools.ts`), na de allowlist van `services/mcp/tools/taskFields.ts`. Zijn tijddeel is
geen genest object maar een vaste set sleutels (`timePatch`: `scheduleDuration`, `durationUnit`, `durationMinutes`,
`durationType`, `clearDurationMinutes`), dus een aanroeper kan via die route geen hele `time`-tak meegeven: de route
kopieert de bestaande tijd en zet alleen die sleutels (ADR 0212). `draft.updateTaskFields` voegt een `Partial<Task>`
samen met `mergeTaskUpdate` (ADR 0212); geen code in `src/` of `headless/` roept haar aan, alleen tests in
`tests/mcp/`.

Beide houden op deze punten de volgorde van `taskSlice.updateTask` aan (ADR 0153): de urenbron van vast werk vóór de
no-op-toets, de patch genormaliseerd naar de vergeleken taak (`normalizeTaskPatch`), zodat de gevolgregels en het
schrijven dezelfde waarden zien als die toets, de weigering van een te korte duur vóór de eerste mutatie, de
kalenderwissel vóór de momentopname van de werkdriehoek, `hourInputFinishBasis` vóór de kalenderwissel en
`reconcileHourInputFinish` na `clearLevelingGaps`. Een andere volgorde in de draft kan dezelfde bewerking via de
bridge een andere taak laten opleveren dan in het paneel, dat via `updateTask` schrijft. Bekende verschillen en
grenzen van deze routes: knownbug 2001 en 2002.

## Gevolgen

- `clearDurationMinutes` bestaat omdat bij een urentaak `durationMinutes` de bron van de duur is (`durationDaysOf`):
  een achtergebleven minutenwaarde zou een zojuist gezette duur in dagen stil overschrijven. Het haalt de sleutel weg
  met `delete` en zet hem niet op `undefined`, zodat het taakobject voor IFC schoon blijft (zoals bij
  `draft.updateResource`, ADR 0101).
- Geeft een aanroeper `top.time` mee, dan vervangt `patchTaskFields` de hele tak, met `timePatch` erover.
  `planner_update_tasks` geeft geen `top.time` mee (ADR 0212).
- Waar `updateTask` een te korte duur weigert met een melding, geven de draftroutes een uitkomst terug
  (`McpDurationProgressOutcome` met `refused`); `planner_update_tasks` maakt er een weigering per item van. Ook een
  meegeschoven voortgang komt terug (`progress`), in het antwoord van `planner_update_tasks` als `progressAdjusted`.
- Alleen `patchTaskFields` geeft `deferCompletion` door aan `settleEditedDuration`; `planner_update_tasks` zet het
  als hetzelfde item ook een voortgangsblok draagt.
- In *datums zoals opgeslagen* beslist `recordedDateRuleChange` (`state/recordedDateEditGate.ts`) wat een
  regelwissel met de modus doet, waar `updateTask` dat zelf via `keepsRecordedMode` en `finishMutation` doet.
