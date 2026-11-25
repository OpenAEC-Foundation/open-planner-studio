# Een celbewerking toepassen in de rastertransactie

`applyCellEdits` in `src/state/gridTransaction.ts` past alle celwrites van één taak samen toe met `planTaskCellEdits`.
Een celbewerking volgt daarbij dezelfde regels als de patchroute `updateTask` (ADR 0153): datums in de opgeslagen
vorm, een kalenderwissel vóór de rest, de werkregelbrug rond de mutatie (regel `taaktypes`) en de startregel (ADR
0374). Verschillende regels voor raster en paneel zouden dezelfde invoer twee uitkomsten geven. Waar de transactie
daar nu van afwijkt, staat hieronder met het nummer in `knownbugs.md`.

## Gevolgen

- Een datumtekst krijgt vóór de validatie en vóór de vergelijking met de taak de vorm van de opgeslagen taak, zodat
  een ongewijzigde start geen nieuwe SNET maakt. Een werkelijke start of werkelijk einde gaat door
  `normalizeActualDate` (bij een mijlpaal de klokketijd uit de planning van vóór de invoer, besluit B10 van
  2026-10-29, spec `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §4.2), met `project.statusDate` als
  statusdatum. De andere datumkolommen gaan door `normalizeTaskDateInput`: een einde zonder tijd is het einde van die
  dag zoals de tabel het toont, ook bij een taak in kalendertijd; de exclusieve lezing van D3 voor zo'n taak geldt
  alleen op de laadgrens (`normalizeTaskDate`). Voor een constraintdatum kiest `constraintDateField` het veld bij het
  geplakte type, anders bij het type van de taak. Zit er een kalenderwrite in dezelfde groep, dan normaliseert de
  transactie tegen die kalender.
- Zonder fouten draait `normalizeTaskDates` daarna op elke taak met een celwrite die niet is overgeslagen, een
  toewijzingswrite of een relatiewrite (`wroteTaskIds`; technische keuze T17 in dezelfde spec: de normalisatie draait
  op elke invoer), ook na één gewone datumcel.
- Een kalenderwissel is een eigen stap vóór de rest van de cellen, in dezelfde volgorde als `updateTask`:
  `captureCalendarChange`, het plan van alleen de kalenderwrites en, als dat iets verandert, `settleCalendarChange`.
  Die laatste aanroep staat rechts van `timephasedGuidanceLost ||=` en draait dus niet als het plan van de
  kalenderwrites al tijdgefaseerde sturing liet vervallen. Inzet en werk volgen de nieuwe kalender dan niet, anders
  dan via `updateTask` (knownbug 2486). De andere cellen worden daarna gepland, met een nieuwe momentopname van de
  driehoek in de nieuwe slot; de omgeving is al met de geplakte kalender gebouwd (`taskForCalendar`). Beide stappen
  lopen, er is geen `else`: anders viel een duur in dezelfde plakactie weg.
- De klembordparser (`parseScheduledTaskDuration` in `taskColumnRegistry.ts`) leest de duurtekst vóór de transactie,
  met de kalender die de taak op dat moment heeft. Invoer die `parseTaskDurationInput` niet leest, zoals `2d 4u`,
  wordt zo een aantal minuten in de oude kalender, en de transactie plant die minuten in de geplakte kalender. Een
  kalender en zo'n duur in dezelfde rij geven daardoor een andere duur dan dezelfde duur na de kalenderwissel
  (knownbug 2484).
- `captureTriangle` en `captureProgressWork` komen vóór het plan van de overige cellen; bij een wijziging volgen
  `settleDurationEdit` en `settleProgressWork`. Het afwijkende restwerk dat `settleDurationEdit` over alle taken van
  de transactie herschreef, geeft samen één melding (`remainingWorkRecomputedNotice`).
  `check-restwerk-duurwijziging.ts` (h3 en h7) toetst één melding met de naam bij één cel en één melding met het
  aantal taken bij twee rijen in één transactie. Bij een gewone, ongestarte taak onder `FIXED_DURATION_RATE` zonder
  opgeslagen werk laat een duurbewerking de inzet staan en schrijft ze geen werkvelden. Verkort een bewerking een taak
  precies tot het werk dat al gedaan was (`completedByShortening` in `settleDurationEdit`: geen rest, voltooiing 1 en
  een nieuwe totale duur gelijk aan het gedane deel van vóór de bewerking), dan zet `completedByDurationEdit` het
  restwerk van elke duursturende toewijzing op nul (regel `taaktypes`). `assignmentsForTask` komt uit de index die
  `prepareGridWrites` één keer per transactie bouwt en geldt ook na de kalenderstap; het contract daarvoor staat in
  ADR 0200.
- Verandert de werkregel van de taak, dan volgt `settleRuleChange`, net als bij `setTaskWorkRule`, en wordt
  `taskTypesVisible` waar. `check-work-rule-store.ts` (n8 en n9) toetst dat een cel naar `FIXED_WORK` de regel zet en
  het restwerk vastlegt. Meldt `settleRuleChange` een maatwijziging (`durationUnitChanged`, ADR 0202), dan telt de
  bewerking als planning: `markDateMutation` zet de modus *datums zoals opgeslagen* uit en de planning op verouderd
  (spec §5.2, geval 11c). Anders beslist de `scheduleStale` van de plannen.
- `buildTaskEditPlanEnvironment` is de ene bouwer van de planomgeving, ook voor het voortgangsblad
  (`progressImportDeps` in `taskSlice.ts`). `contourKeepsWork` (werkbehoud bij het herschalen van de contour volgens
  de effectieve werkregel) en `defaultWorkRule` (zodat de effectieve werkregel, vast werk is urenmaat, ook de
  projectstandaard ziet) staan daarom in die bouwer, zodat het voortgangsblad ze ook krijgt. `applyCellEdits` geeft
  hem de taak met de geplakte kalender (`taskForCalendar`).
- Of een voorganger de start bepaalt (`startDrivenByPredecessor`), vraagt de transactie alleen bij een write in een
  kolom waarin je een start typt (`TYPED_START_COLUMN_IDS`: `task.time.start`, `task.time.scheduleStart`), en dan één
  keer per transactie. Celwrites verzetten geen relaties of hiërarchie, dus de stand van vóór de transactie volstaat;
  na een toegepaste relatiewrite rekent de transactie het opnieuw op de kopie.
- De startmelding: een SNET alleen als het plan iets veranderde en een SNET zette; een start die een andere constraint
  tegenhield ook zonder wijziging, want die laat de taak juist ongemoeid. De meldingen van alle taken gaan samen door
  `startEditNotifications`.
- `taskIndexById` bouwt de transactie één keer. `applyCellEdits` vervangt alleen het element op dezelfde index van
  `state.tasks`, en `applyTaskAssignmentPlan` en `applyRelationMutationPlan` voegen geen taak toe en halen er geen
  weg. Daardoor blijft de index geldig.
