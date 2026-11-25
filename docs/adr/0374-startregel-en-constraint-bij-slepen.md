# De startregel en de constraint bij slepen

Een gesleepte start volgt dezelfde regel als een getypte start: bepaalt een voorganger de start, dan legt de app de
nieuwe start vast als SNET, en houdt een andere constraint de start tegen, dan verschuift er niets en meldt de app
dat. Verschillende regels voor typen en slepen zouden dezelfde wens twee uitkomsten geven. De regel zelf, ook voor
welke taken hij niet geldt (`startRuleApplies`), staat in `constraintForDraggedStart` en `constraintBlockingStart`
(`src/engine/startEditConstraint.ts`); de gids
`howto-gantt-bedienen` beschrijft het gedrag voor de planner.

## Gevolgen

- Alleen een gebaar dat de start verzet, valt onder de regel: de body en de linkerrand. De rechterrand en een stuk-
  of stukrandsleep op een gesplitste balk niet, en ook niet een gebaar dat door werkelijke datums vergrendeld is
  (ADR 0375). Of een voorganger de start bepaalt, komt van `isStartDrivenByPredecessor`; zonder die functie nooit.
- Bij het grijpen legt `startBarDrag` de taak zoals ze toen was vast (`StartRuleGesture.original`). Elke
  muisbeweging rekent de constraint opnieuw vanaf die taak, zodat terugslepen naar de oorspronkelijke start de
  oorspronkelijke constraint terugzet.
- Houdt een andere constraint de start tegen, dan past een beweging van body of linkerrand niets toe, ook geen
  anker dat daarna toch niets zou doen. Bij een groepsruitje (#868, ADR 0376) houdt de constraint van elk lid de
  hele groep tegen.
- Na het loslaten volgt één melding per gebaar, over het netto resultaat: de gezette SNET, of de constraint die de
  start tegenhield als de planner de start echt probeerde te verzetten. Het zijn dezelfde meldingen als bij typen
  (`notifyStartEdit`, `startEditNotifications` in `state/startConstraintNotice.ts`); bij een groepsruitje komen die
  van de meeschuivers erbij. Escape en een documentwissel melden niets.
- `check-milestone-drag.ts` speelt de mijlpaalsleep na met `constraintForDraggedStart` en de echte store en
  controleert dat de mijlpaal na F5 op het gesleepte moment staat; het roept de hook niet aan.
