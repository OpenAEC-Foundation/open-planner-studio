# MSP-herkomst in een bewerkregel staat buiten de motor

Twee bewerkregels lezen de bewaarde MS Project-herkomst van één taak (`mspTaskType`): `effectiveEffortDriven` en
`contourKeepsWork` in `utils/taskDefaults.ts`. Ze bepalen hoe een bewerking uitpakt (de werkdriehoek, het herschalen
van een contour) en zijn geen invoer van de solver en geen conventie. `src/engine/` mag geen bronformaat lezen
(`verify:conventions`, regel `rekenprofielen`), dus staan ze in `src/utils/`; de werkregelbrug en het paneel roepen ze
aan.

## Gevolgen

- `effectiveEffortDriven` geeft alleen bij een taak met `mspTaskType` een waarde: `effortDriven`, en `false` als dat
  ontbreekt. De `.mpp`-lezer zet `effortDriven` alleen als het vinkje aan staat (`mppReader.ts`), dus een ontbrekend
  veld betekent daar "niet effort-driven". Zonder
  `mspTaskType` geeft het `undefined`: zo'n taak heeft geen MS Project-herkomst en het vinkje betekent er niets.
  `durationEditKeepsWorkOf` en `TaskWorkRuleField` lezen die uitkomst (ADR 0200, besluit V10).
- Wat `contourKeepsWork` beslist zonder eigen `workRule`, staat in de regel `contour`.
