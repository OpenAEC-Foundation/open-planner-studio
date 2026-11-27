# Oude baselines van een urentaak

Sinds het besluit van de eigenaar van 2026-10-15 is het dagengetal van een urentaak de werkminuten gedeeld door de
werktijd per dag van de taakkalender; daarvóór deelde de app door de opgeslagen `hoursPerDay`. Een baseline bewaart
het dagengetal van het moment waarop ze werd gemaakt, dus een oude baseline kan een afwijking tonen die alleen uit de
andere telling komt. Besluit van de eigenaar op dezelfde dag: oude baselines worden niet omgerekend; de tabel toont in
dat geval een waarschuwing. De herkenning staat in `baselineHasOldDayCount` en `createBaselineOldDayCheck`
(`src/engine/baselineOldDay.ts`).

## Gevolgen

- De herkenning is bewust zuinig: geen waarschuwing als de duur bij beide tellingen past of bij geen van beide.
- Eerst telt de span van de baseline zelf (werkminuten tussen baseline-start en -einde op de taakkalender), pas
  daarna de huidige werkminuten van de taak. Wijst de span een telling aan, dan verandert een latere
  duurwijziging de waarschuwing niet. Wat deze volgorde niet kan scheiden, staat in knownbug 2591.
