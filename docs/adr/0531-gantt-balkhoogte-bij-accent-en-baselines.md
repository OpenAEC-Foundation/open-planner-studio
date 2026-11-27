# Balkhoogte als resource-accent en baselines samen onder de balk staan

Staan het resource-accent en de baselinestrook allebei aan, dan wordt de taakbalk iets lager, zodat accent en
strook elk hun eigen dikte houden (besluit eigenaar 2026-10-20). De baseline is zo even dik met of zonder accent. De
balk houdt zijn bovenkant en krimpt alleen zoveel als nodig is, tot een ondergrens (`MIN_BAR_HEIGHT_RATIO`,
`MIN_BAR_HEIGHT_PX`); daaronder schuift hij omhoog. De regel staat in `barLayout` (`src/engine/renderer/rowGeometry.ts`),
de toets in `check-baseline-vergelijking.ts`.

## Overwogen

De baselinestrook laten krimpen als het accent erbij komt, en het accent boven de balk zetten. Beide afgewezen door de
eigenaar.
