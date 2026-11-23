# Vast werk is urenmaat, ook bij openen

Een taak onder vast werk staat in de urenmaat (besluit B1a van de eigenaar, 2026-10-20, spec
`docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §3.2 en B1a). De werkregelbrug zet dat door bij een
typewissel (`settleRuleChange`, en `settleDefaultRuleChange` voor een taak die de projectstandaard erft), bij een
duurinvoer in werkdagen (`routeFixedWorkDurationToHours`) en bij het openen van een bestand (`settleFixedWorkMeasure`,
aangeroepen door `migrateToMinuteModel`). Het openen is een uitzondering op spec taaktypes §3.1 punt 5, waar de
werkregel alleen op bewerkingen werkt. We kozen ervoor omdat een bestand van vóór B1a een gewone taak onder vast werk in
de dagenmaat kan hebben. De uitzondering kwam in commit 7e4186f30, na reviewronde 2 van #581; de toets is
`check-work-rule-load-measure.ts`.

## Gevolgen

- `settleFixedWorkMeasure` schrijft alleen `task.time` (via `writeHourMeasure`); de toewijzingen raakt het niet, en de
  werkdriehoek rekent niet. Mijlpalen, samenvattingstaken, hangmatten en ELAPSEDTIME-taken vallen erbuiten
  (`workRuleApplies`). De datums kunnen door de omzetting wel verschuiven; dat loopt via besluit B5 van de spec alleen
  uren (`report.conversionPending` in `migrateToMinuteModel`). In `check-work-rule-load-measure.ts` gaat het einde van
  een taak van 3 d van vr 13:00 naar ma 09:00, met één geschiedenisstap en één melding.
- `routeFixedWorkDurationToHours` zet om bij een duur in werkdagen; welke invoer daarvoor telt, staat in de functie.
  Een naamswijziging op een oude dagtaak onder vast werk verandert `scheduleDuration` en `durationUnit` niet, en zet de
  taak dus niet om.
- `settleEffectiveRuleChange` zet alleen om naar de urenmaat. Terug van vast werk naar een andere projectstandaard laat
  de urenmaat dus staan (`check-default-work-rule-switch.ts`, gevallen d2 en m4).
- Een maatwijziging door een typewissel komt terug als `durationUnitChanged` en telt als planningsbewerking (ADR 0153,
  toets `check-work-rule-measure-switch.ts`).
