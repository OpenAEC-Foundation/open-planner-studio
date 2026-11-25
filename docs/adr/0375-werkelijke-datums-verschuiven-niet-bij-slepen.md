# Werkelijke datums verschuiven niet bij slepen

Een werkelijke datum is een feit en verschuift niet door een sleep (eigenaarsbesluit 2026-10-12). Van een voltooide
taak (`finishIsActual`) staan begin en einde vast, van een gestarte taak (`startIsActual`) de start. De planner
wijzigt zo'n datum via de voortgang; de gids `howto-voortgang-bijwerken` zegt dat.

## Gevolgen

- De coördinator maakt van een vergrendelde rand al body (`dragHit` in `useGanttPointerCoordinator.ts`): bij een
  voltooide taak elke rand, en dan als één ongesplitste balk; bij een gestarte taak de linkerrand. De rechterrand van
  een gestarte taak blijft een duurgreep.
- `startBarDrag` vergrendelt het gebaar (`ActualDatesLock`) bij een voltooide taak, en bij een gestarte taak als het
  geen stuksleep en geen rechterrand is. Een voltooide balk krijgt geen stukgrepen: zijn pauzes liggen in het
  verleden. Een stuksleep op een gestarte taak (de pauze vóór stuk i > 0, of de rechterrand van een stuk) is niet
  vergrendeld.
- Een vergrendeld gebaar schrijft horizontaal niets: geen datum, geen anker, geen constraint. Verticaal blijft de
  rijsleep werken, want de richtingskeuze (ADR 0371) komt vóór de vergrendeling.
- Na het loslaten volgt één melding (`notifications.dragDatesAreActual` of `notifications.dragStartIsActual`, via
  `refusalNotice`), maar alleen als de planner horizontaal minstens `ROW_DRAG_THRESHOLD` pixels bewoog. De meldsleutel
  (`drag-actual:<soort>:<taakId>`) maakt van herhaald slepen aan dezelfde balk één regel met een teller.
  `tests/browser/actual-dates.spec.ts` sleept twee keer aan een voltooide balk en verwacht één melding met `×2`.
- Bij een groepsruitje (ADR 0376) vergrendelt een werkelijke datum van één meeschuivende mijlpaal de hele groep.
