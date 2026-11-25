# Een taak heeft één maat, en die bepaalt welk duurveld de bron is

Elke taak heeft een eigen maat, `time.durationUnit` (besluit B1 van de eigenaar, 2026-10-20; spec
`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`, §3.2). Bij `'days'` (dagenmaat) is `scheduleDuration` de
bron: werkdagen op de taakkalender, een breuk mag (2,5). Bij `'hours'` (urenmaat) is `durationMinutes` de bron, in
werkminuten, en is `scheduleDuration` daarvan afgeleid: `minuten / (urenPerDag × 60)`, met de effectieve uren per dag
van de kalender (`effHoursPerDay`); bij nul werkuren per dag geeft de deling 0 (`hourTaskScheduleDuration` in
`utils/taskDuration.ts`). Twee bronnen voor dezelfde duur zouden uit elkaar lopen; daarom is per maat
één veld de invoer en het andere de afgeleide. Of een taak in de dagenmaat ook in werkdagen rekent, beslist de
conventie `workdayDurationMeasure` (`taskCountsInWorkdays`); onder het P6- en het MS Project-profiel telt ze als
urenmaat, `scheduleDuration` maal werktijd per dag maal 60.

## Gevolgen

- Kalendertijd (`durationType: 'ELAPSEDTIME'`) telt kalenderdagen van 24 uur en klokminuten (ADR 0016).
- De maat verandert niet door een kalender, maar door een planningsbewerking: een maatwissel (`taskDurationInput.ts`,
  `taskEditPlan.ts`, `taskFields.ts`) of vast werk, dat een taak altijd in de urenmaat zet (besluit B1a; ADR 0202,
  `writeHourMeasure` en `writeDaysAsHours` in `workRuleApply.ts`). Uitzondering: bij een hammock en een
  samenvattingstaak kiest `writeDerivedSpan` (`duration.ts`) de maat van de afgeleide span op `cal.isHourMode`
  (ADR 0023). Een automatische verzameltaak (`applyDerivedSummaryDuration` in `applyCpmResult.ts`) houdt daarbij een
  spanne van een geheel aantal dagen op een scalaire kalender (`hasOwnWorkBlocks === false`) in de dagenmaat. Een
  handmatige verzameltaak houdt haar opgeslagen duur: die tak komt niet bij `writeDerivedSpan`. De lezers
  zetten de maat uit het bestand; de IFC-lezer kiest haar op de vorm van de ISO-duur (`parseTaskTime`).
- Een nieuwe taak krijgt de standaardmaat van het project (`Project.defaultTaskDurationUnit`,
  `state/newTaskMeasure.ts`), met de uitzonderingen van `settleNewTaskMeasure`. Telt het rekenprofiel een dagenmaat
  niet in werkdagen, dan staat de standaardmaat vast op de urenmaat (`defaultTaskMeasureLocked`); gaf de aanroeper
  zelf een dagenmaat (`measureGiven`), dan blijft de taak in de dagenmaat. Geldt de werkregel
  (`workRuleApplies`) en is die vast werk, dan wordt de taak altijd urenmaat. Een mijlpaal en een kalendertijdtaak
  blijven zoals ze gemaakt zijn.
- Een document zonder `durationUnit` krijgt bij het laden de urenmaat als `durationMinutes` er staat, anders de
  dagenmaat (`normalizeTaskDurationUnits`, ADR 0212).
- De rest volgt dezelfde maat (besluit B3, spec §3.5): `remainingTime` in werkdagen, de bron bij de dagenmaat en exact
  (een breuk mag); `remainingMinutes` in werkminuten, de bron bij de urenmaat, met `remainingTime` als afgeleide.
  `applyRemainingDuration` rondt een rest uit een percentage bij de urenmaat af op een hele minuut. Bij kalendertijd
  staat de rest in klokdagen en klokminuten (ADR 0016). Ingelezen restminuten kunnen een breuk hebben: alleen de
  XER-lezer zet `keepSourceMinutes`, en dan houdt `readMeasure` (`xmlDayMeasure.ts`) in de urenmaat de duur- en
  restminuten zoals de lezer ze gaf, als er geen geldig `ExactMinutes`-record voorgaat; zonder die vlag rondt hij ze
  in dat geval af op hele minuten. Bij de urenmaat geeft `readMeasure` alleen `remainingMinutes`, dus na een import
  kan `remainingTime` ontbreken terwijl `remainingMinutes` gevuld is.
- Speling: `totalFloat` en `freeFloat` in werkdagen, met een deel van een dag; `totalFloatMinutes` en
  `freeFloatMinutes` in werkminuten op de taakkalender, bij kalendertijd in klokminuten (spec §3.4). Dat laatste geldt
  voor de totale speling en voor de vrije speling van een eindtaak (`scheduleAnalysis.ts`). Via een relatie meet de
  gewone regel de vrije speling over de opvolgerkalender in werktijd, ook voor een kalendertijdtaak (ADR 0016, geval
  `msp-21`). Een conventie kan dat per relatie vervangen: zo meet C2 (`p6FreeFloatOnOwnCalendar`) bij een open taak
  met eigen werkblokken, ook in kalendertijd, en een FS-relatie zonder lag de vrije speling in werktijd op de eigen
  kalender.
  `interferingFloat` is `totalFloat` min `freeFloat`, met teken.
- `completion` is een fractie van 0 tot en met 1, geen percentage; de weergave vermenigvuldigt met 100.
