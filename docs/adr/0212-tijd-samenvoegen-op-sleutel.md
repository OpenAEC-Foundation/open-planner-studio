# Een tijdpatch wordt samengevoegd: verplicht op waarde, optioneel op sleutel

`mergeTaskTime` (`utils/taskDefaults.ts`) voegt een gedeeltelijke `TaskTime` samen met een basis. Een aanroeper buiten
de typechecker kan een onvolledig object sturen; de extensie-sandbox draait bijvoorbeeld ongetypeerde code. In
`taskSlice.addTask` en `draft.addTask` is de basis een verse `createDefaultTaskTime` (ADR 0211). In `updateTask` en
`draft.updateTaskFields` is ze de bestaande tijd van de taak (via `mergeTaskUpdate`), want een verse standaard zou bij
een patch met alleen `scheduleStart` de voortgang en de speling wissen (ADR 0153). `draft.patchTaskFields` gebruikt
`mergeTaskTime` niet. `planner_update_tasks` (`taskTools.ts`) roept het aan zonder `top.time`; dan kopieert het de
bestaande tijd en zet het alleen de losse duursleutels (`patchTime` in `createMcpTransactions.ts`).

Een verplicht veld neemt de patch over met `??`, zodat `false` en `0` blijven staan; `durationUnit` heeft een eigen
afleiding (hieronder). Een optioneel veld neemt de patch over als de sleutel in de patch staat (`'veld' in partial`),
ook met de waarde `undefined`; staat de sleutel er niet, dan blijft de basis. Zo is "bewust gewist" te onderscheiden
van "niet genoemd": Taak bewerken wist een veld door de sleutel met `undefined` mee te sturen (bijvoorbeeld
`actualStart: undefined` in `state/taskDialogSave.ts`).

## Gevolgen

- `durationMinutes` volgt de sleutelregel niet helemaal: bij een urentaak is het de bron van de duur, dus een losse
  `undefined` wist het niet; een wissel naar `durationUnit: 'days'` wist het wel (`check-task-duration-unit.ts`).
- Hoe de eenheid volgt als de patch haar niet noemt, staat in `mergeTaskTime`. Voor een taak uit een oud document
  zonder `durationUnit` is dat de migratie van de spec `docs/superpowers/specs/2026-07-06-uren-scheduling-design.md`,
  §3.1; `normalizeTaskDurationUnits` doet die bij het laden, en `taskTriggerChanges` telt zo'n ingevulde eenheid niet
  als wijziging (`check-task-trigger-changes.ts`). `normalizeTaskDurationUnits` geeft dezelfde array terug als er
  niets te doen is, omdat `sameIFCSource` op referentie vergelijkt (`check-document-switch-identity.ts`), en laat een
  taak zonder `time` ongemoeid.
- `mergeTaskTime` somt de velden op die het samenvoegt en spreidt de basis niet. Een veld van `TaskTime` dat er niet
  bij staat, valt bij de samenvoeging weg, en `tsc` ziet dat niet omdat het veld optioneel is (knownbug 2001).
