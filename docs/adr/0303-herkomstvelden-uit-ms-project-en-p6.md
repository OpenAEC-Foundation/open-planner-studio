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
- De P6-velden zijn herkomstpoorten: `src/engine/` leest ze alleen in de P6-conventietakken, en
  `verify:conventions` telt en pint elke lezing (regel `rekenprofielen`).
- De XER-lezer vergelijkt de tokens van `duration_type` en `task_type` zonder hoofdlettergevoeligheid. Een onbekend
  token vervangt hij door een standaard en neemt hij op in de terugvallen van het openen (`durationTypeOf`,
  `activityTypeOf` met `TT_Task`). Hoe de P6 XML-lezer een onbekend label leest, staat in ADR 0267.
- `p6TaskId` is in P6 alleen uniek binnen een project; daarom bewaart een taak `p6ProjectId` en `p6TaskId` samen.
- `p6ExplicitTargetWindow` legt alleen vast dat de bron beide geplande datums droeg (XER `target_start_date` en
  `target_end_date`; P6 XML ADR 0267), niet de berekende datums van P6, zodat een terugval van de lezer of een later
  berekende `scheduleStart` niet als bronwaarde telt (ADR 0210).
- `time.resume` en `time.stop` zijn brondata. Een taak uit P6 volgt de route van suspend en resume alleen met
  `p6SuspendResume` en een geldig, chronologisch paar (`hasValidP6SuspendResume`, ADR 0025);
  `reconcileP6SuspendResume` wist een vlag zonder geldig paar en laat de datums staan. De solver rekent niet met de
  waarde van `stop`; hij gebruikt het veld in die poort en in `p6OpenLoeTargetSpanTrace`.
- `p6ExpectedFinish` (XER `expect_end_date`) telt alleen met de projectoptie `useExpectedFinishDates` en bij een taak
  met `p6ProjectId`, in de restwerkroute van een gestarte taak in `CPMSolver.ts`.
