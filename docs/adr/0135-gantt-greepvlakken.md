# Greepvlakken in de Gantt

De renderer bezit rijpositie, tijdas en de geometrie van wat hij tekende, dus ook de hittests: wat onder de muis
staat, leest hij uit dezelfde geometrie als het beeld. Slepen en rekken (`getTaskBarBounds`) en een relatie beginnen
(`getRelationSourceAt`) zijn twee aparte vragen met eigen regels. `getRelationSourceAt` is bewust geen versoepelde
`getTaskBarBounds`: die tweede weigert verzamelbalken, omdat hun datums uit de kinderen komen, maar een relatie mag
wel vanaf een verzamelbalk beginnen. `expandSummaryRelations` rekent zo'n relatie door naar de bladtaken, en droppen
op een verzamelbalk werkt via `relationVerdict`; slepen vanaf een verzamelbalk loopt daarmee gelijk. Of een relatie
mag, beslist `createRelationWithFeedback` bij het loslaten, niet de hittest (`check-renderer-dateless`).

## Gevolgen

- Een taak zonder enige datum tekent als één dagcel op de viewstart, zodat hij zichtbaar is. Mist een taak met duur
  haar start of einde, dan geven `getTaskBarBounds`, `getTaskBarRect` en `getRelationSourceAt` er niets voor: de
  sleephooks zouden zonder datums rekenen.
- Een nulduurmijlpaal is verplaatsbaar en niet rekbaar (issue #691): zijn greepvlak (`milestoneGrab`) ligt rond de
  getekende ruit, minstens 6 px naar elke kant, en geeft alleen `body`. Dat geldt ook met één datum; de ruit leent
  dan het anker van de andere kant. Een mijlpaal met duur tekent als balk en heeft randen zoals elke balk.
- Als relatiebron heeft een mijlpaal met één datum een zone van 6 px rond zijn anker. Met beide datums geldt de
  balkzone met 6 px marge; in uurmodus is `x1` gelijk aan `x2` en is die marge het hele grijpvlak.
- In een ingeklapte mijlpalenreeks geeft `getTaskAt` het dichtstbijzijnde ruitje binnen zijn greepvlak, en voor een
  groep de voorman; `getMilestoneGroup` geeft de andere leden, zodat klik, slepen en tooltip voor de hele groep
  gelden.
- De baselinehover (`getBaselineAt`) test eerst de getekende vormen zelf (een ruit als ruit), in omgekeerde
  tekenvolgorde, op de eigen rij en beide buurrijen, want een ruit kan over de rijgrens steken: de bovenste vorm wint.
  Pas als geen vorm geraakt is, telt een marge van 2 px en wint de dichtstbijzijnde. De vormen staan per rij, niet
  per taak: bij groeperen op resource staat een taak op meer rijen (`check-baseline-vergelijking`).
- De renderer importeert niets uit `@/state`; de regels voor relaties staan in `state/relationRules.ts`.
  `verify:gantt-boundaries` weert React, Zustand en `src/components/` uit de renderer.
- `getTaskBarRect` en `getDrawnSegmentCount` zijn naden voor tests en de dev-bridge. Ze staan in de renderer, zodat
  een test de getekende balk vindt zonder de geometrie na te bouwen; `getDrawnSegmentCount` leest de laatste render,
  zodat een test op de repaint kan wachten.
