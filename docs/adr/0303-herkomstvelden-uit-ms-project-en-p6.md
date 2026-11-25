# Herkomst uit MS Project en P6 staat in eigen velden, los van de werkregel

Een taak uit MS Project of P6 bewaart het taaktype van haar bron in een eigen veld per formaat: `mspTaskType` en
`effortDriven` voor MS Project, `p6DurationType` en `p6ActivityType` voor P6, plus de P6-bronidentiteit en
-signalen (`p6ProjectId`, `p6TaskId`, `p6ExplicitTargetWindow`, `p6CompletePctType`, `p6ExpectedFinish`,
`p6SuspendResume`). De formaten kennen elk een ander begrip van taaktype en een andere waardenverzameling; één
gedeeld veld zou de ene herkomst in de andere vertalen. Het neutrale gedrag bij een bewerking draagt `workRule`.
`deriveImportedWorkRules` (`services/importNormalize.ts`) leidt die bij het lezen af uit `mspTaskType` met
`effortDriven`, of anders uit `p6DurationType`, en laat een taak die al een `workRule` heeft staan. De werkregel staat
apart opgeslagen, zodat een latere wissel van de werkregel de herkomst niet wist. Toets: `check-work-rule-mapping.ts`.

## Gevolgen

- De solver leest `mspTaskType`, `effortDriven` en `workRule` niet; de bewerkingslaag wel (regel `taaktypes`,
  ADR 0215).
- Een ontbrekend `mspTaskType` betekent onbekend, niet Fixed Units. De `.mpp`-lezer laat het weg als het veld in het
  record niet te lezen is (`mspTaskTypeFromRaw` met een ruwe waarde `null`).
- In de rekenroutes zijn de P6-velden herkomstpoorten: de solver gebruikt ze als voorwaarde in de P6-conventietakken.
  Buiten de solver lezen ook andere delen van `src/engine/` ze: het taakraster leest alle acht velden voor de weergave
  (`p6ProvenanceOf` in `taskGrid/taskColumnRegistry.ts`), en `moveProject` (`moveProject.ts`) leest
  `p6ExpectedFinish` en verschuift die datum mee. `verify:conventions` (`scripts/verify-conventions.mjs`) telt per veld
  de herkenbare sleuteltoegangen in `src/engine/` en pint die aantallen, die alleen omlaag mogen
  (`verify-conventions.datagates.json`); welke voorwaarde om een toegang staat, toetst hij niet (regel
  `rekenprofielen`).
- De XER-lezer vergelijkt de tokens van `duration_type` en `task_type` zonder hoofdlettergevoeligheid. Een onbekend
  token vervangt hij door een standaard en neemt hij op in de terugvallen van het openen (`durationTypeOf`,
  `activityTypeOf` met `TT_Task`). Hoe de P6 XML-lezer een onbekend label leest, staat in ADR 0267.
- De XER-lezer bewaart de bronidentiteit van een activiteit als de combinatie van `p6ProjectId` (de `proj_id` van haar
  project) en `p6TaskId` (haar `task_id`).
- `p6ExplicitTargetWindow` legt alleen vast dat de bron beide geplande datums droeg (XER `target_start_date` en
  `target_end_date`; P6 XML ADR 0267), niet de berekende datums van P6, zodat een terugval van de lezer of een later
  berekende `scheduleStart` niet als bronwaarde telt (ADR 0210).
- `time.resume` en `time.stop` zijn brondata. Een taak uit P6 volgt de route van suspend en resume alleen met
  `p6SuspendResume` en een geldig, chronologisch paar (`hasValidP6SuspendResume`, ADR 0025);
  `reconcileP6SuspendResume` wist een vlag zonder geldig paar en laat de datums staan. De solver rekent geen datum uit
  `stop`: die poort vergelijkt alleen de volgorde van `stop` en `resume`, en `p6OpenLoeTargetSpanTrace` en
  `p6CompletedRouteTrace.ts` toetsen alleen of het veld er is.
- `p6ExpectedFinish` (XER `expect_end_date`) telt alleen met de projectoptie `useExpectedFinishDates` en bij een taak
  met `p6ProjectId`, in de restwerkroute van een gestarte taak in `CPMSolver.ts`.
