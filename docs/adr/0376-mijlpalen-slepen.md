# Mijlpalen slepen

Een nulduurmijlpaal (ruit) heeft alleen een body (ADR 0135, issue #691): hij verschuift en houdt duur 0. Met
momenten in start en finish rekent de sleep op het eigen moment van de mijlpaal en niet als balk, zodat de ruit na
F5 staat waar de planner hem losliet. Een mijlpaal met alleen datums loopt via de dagsleep (ADR 0373), die begin
en einde gelijk verschuift.

## Gevolgen

- Bij het grijpen legt `startBarDrag` drie dingen vast die in het gebaar niet meer wisselen: de landingskant
  (`milestoneSitsAtFinish`, uit soort, voorganger en B6), of B6 de mijlpaal op het dageinde zet
  (`looseDayEndMilestone`, `isLooseDayEndMilestone`), en de tijdvelden zoals ze waren.
- Elke beweging rekent vanaf het oorspronkelijke moment. Bij dagzoom per werkdag (`dragWorkdaySteps`, dan
  `resolveMilestoneDayDrag`), bij uurzoom naar de plek op de getekende as: het anker plus de pixelverschuiving via
  `dateToX` en `xToDate`, dan `resolveMilestoneHourDrag` met de snapstap van de zoom.
- Onder werkdagencompressie staat een mijlpaal op een verborgen vrije dag op de naad. Bij dagzoom begint het tellen
  daar: bij de eindkant op het vorige werkmoment, bij de beginkant op het volgende. Bij uurzoom geeft de plek op de
  getekende as dat vanzelf.
- Het landingsmoment gaat door `milestoneDragLanding` (`hourBarDragMath.ts`), met als stap 60 minuten bij dagzoom
  en anders de snapstap: voor een B6-mijlpaal op een dageinde dat ook een blokbegin is (24/7: middernacht), een
  moment dat F5 niet kan laten staan. De sleep schrijft het moment in alle vier de velden (`scheduleStart`,
  `scheduleFinish`, `earlyStart`, `earlyFinish`), met de constraint van ADR 0374.
- Zet een beweging netto geen snapstap, ook na heen en terug, dan komen de tijdvelden van het grijpen terug, met de
  constraint die bij het oorspronkelijke moment hoort.
- Een groepsruitje (#868): de coördinator geeft de andere leden mee (`DragState.companionIds`, uit
  `getMilestoneGroup`). Ze schuiven alleen mee bij een bodysleep van een mijlpaal met momenten, en alleen als het lid
  zelf een nulduurmijlpaal met een moment is. Elk lid rekent met zijn eigen kalender, kant, B6 en startregel; houdt
  er één de start tegen, dan staat de groep stil (ADR 0374), en een werkelijke datum van één lid vergrendelt de groep
  (ADR 0375).
- `check-milestone-drag.ts` roept de rekenstappen rechtstreeks aan en speelt het gebaar na met de echte store
  (dezelfde velden, kant en SNET als de hook, zonder compressie in de ketenstap), gevolgd door F5: de mijlpaal staat
  dan op het neergezette moment. Het roept de hook niet aan. `tests/browser/mijlpalenreeks.spec.ts` sleept een
  groepsruitje met de muis en controleert dat beide leden op dezelfde nieuwe dag staan.
