# Een tijdpatch wordt samengevoegd: verplicht op waarde, optioneel op sleutel

`mergeTaskTime` (`utils/taskDefaults.ts`) voegt een gedeeltelijke `TaskTime` samen met een basis. Aanroepers buiten de
typechecker kunnen een onvolledig object sturen: de extensie-sandbox draait ongetypeerde code en de MCP-payloads worden
alleen tegen een JSON-schema getoetst. Bij aanmaken is de basis een verse `createDefaultTaskTime` (ADR 0211); bij een
bewerking is het de bestaande tijd van de taak, nooit een verse standaard, want dan wiste een patch met alleen
`scheduleStart` de voortgang en de speling (ADR 0153).

Een verplicht veld neemt de patch over met `??`, zodat `false` en `0` blijven staan. Een optioneel veld neemt de patch
over als de sleutel in de patch staat (`'veld' in partial`), ook met de waarde `undefined`; staat de sleutel er niet,
dan blijft de basis. Alleen zo is "bewust gewist" te onderscheiden van "niet genoemd": Taak bewerken wist een veld door
de sleutel met `undefined` mee te sturen (bijvoorbeeld `actualStart: undefined` in `state/taskDialogSave.ts`), en een
patch die het veld niet noemt, laat het staan.

## Gevolgen

- `durationMinutes` volgt de sleutelregel niet helemaal: bij een urentaak is het de bron van de duur, dus een losse
  `undefined` wist het niet; een wissel naar `durationUnit: 'days'` wist het wel (`check-task-duration-unit.ts`).
- Een taak uit een oud document zonder `durationUnit` krijgt de eenheid uit `durationMinutes` (de migratie van de spec
  `docs/superpowers/specs/2026-07-06-uren-scheduling-design.md`, §3.1). Dezelfde afleiding doen
  `normalizeTaskDurationUnits` bij het laden en `taskTriggerChanges`, die zo'n ingevulde eenheid niet als wijziging
  telt (`check-task-trigger-changes.ts`). `normalizeTaskDurationUnits` geeft dezelfde array terug als er niets te
  doen is, omdat `sameIFCSource` op referentie vergelijkt (`check-document-switch-identity.ts`); een taak zonder
  `time` laat het ongemoeid.
- `mergeTaskTime` noemt elk veld van `TaskTime` met naam en spreidt de basis niet. Een veld dat er niet in staat, valt
  bij elke samenvoeging weg, en `tsc` ziet dat niet omdat het optionele veld mag ontbreken (knownbug 2001).
- `mergeTaskUpdate` is de vorm van een patch zonder te muteren: velden overschreven, `time` samengevoegd. Hiermee
  vergelijken `updateTask` en de MCP-draft voor hun no-op-toets en voor `taskTriggerChanges` (ADR 0153).
