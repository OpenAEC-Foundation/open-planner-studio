# Een taak heeft één maat, en die bepaalt welk duurveld de bron is

Elke taak heeft een eigen maat, `time.durationUnit` (besluit B1 van de eigenaar, 2026-10-20; spec
`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`, §3.2). Bij `'days'` (dagenmaat) is `scheduleDuration` de
bron: werkdagen op de taakkalender, een breuk mag (2,5). Bij `'hours'` (urenmaat) is `durationMinutes` de bron, in
werkminuten, en is `scheduleDuration` daarvan afgeleid: minuten gedeeld door werktijd per dag maal 60
(`hourTaskScheduleDuration`). Twee bronnen voor dezelfde duur zouden uit elkaar lopen; daarom is per maat één veld de
invoer en het andere de afgeleide. Of een taak in de dagenmaat ook in werkdagen rekent, beslist de conventie
`workdayDurationMeasure` (`taskCountsInWorkdays`); onder het P6- en het MS Project-profiel telt ze als urenmaat,
`scheduleDuration` maal werktijd per dag maal 60.

## Gevolgen

- Kalendertijd (`durationType: 'ELAPSEDTIME'`) telt kalenderdagen van 24 uur en klokminuten (ADR 0016).
- De maat verandert niet door een kalender, maar door een planningsbewerking: een maatwissel (`taskDurationInput.ts`,
  `taskEditPlan.ts`, `taskFields.ts`) of vast werk, dat een taak altijd in de urenmaat zet (besluit B1a; ADR 0202,
  `writeHourMeasure` en `writeDaysAsHours` in `workRuleApply.ts`). Uitzondering: bij een hammock en een
  samenvattingstaak kiest `writeDerivedSpan` de maat van de afgeleide span op `cal.isHourMode` (ADR 0023). De lezers
  zetten de maat uit het bestand; de IFC-lezer kiest haar op de vorm van de ISO-duur (`parseTaskTime`).
- Een nieuwe taak krijgt de standaardmaat van het project (`Project.defaultTaskDurationUnit`,
  `state/newTaskMeasure.ts`).
- Een document zonder `durationUnit` krijgt bij het laden de urenmaat als `durationMinutes` er staat, anders de
  dagenmaat (`normalizeTaskDurationUnits`, ADR 0212).
- De rest volgt dezelfde maat (besluit B3, spec §3.5): `remainingTime` in werkdagen, de bron bij de dagenmaat en exact
  (een breuk mag); `remainingMinutes` in werkminuten, de bron bij de urenmaat, met `remainingTime` als afgeleide.
  `applyRemainingDuration` rondt een rest uit een percentage bij de urenmaat af op een hele minuut.
- Speling: `totalFloat` en `freeFloat` in werkdagen, met een deel van een dag; `totalFloatMinutes` en
  `freeFloatMinutes` in werkminuten op de taakkalender, bij kalendertijd in klokminuten (spec §3.4).
  `interferingFloat` is `totalFloat` min `freeFloat`, met teken.
- `completion` is een fractie van 0 tot en met 1, geen percentage; de weergave vermenigvuldigt met 100.
