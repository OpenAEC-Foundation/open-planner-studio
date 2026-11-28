# Benchmark: keuzes die verrassen

De ingebouwde benchmark (`src/services/benchmark/`, *Benchmark…* in Instellingen) en `npm run measure:large-plans`
meten op een gegenereerde planning (`generateBenchmarkProject`). Twee metingen zijn alleen vergelijkbaar als de
generator bij dezelfde grootte en seed dezelfde planning geeft en de runner hetzelfde werk doet als de app. Drie
keuzes volgen daaruit; een collega zou ze zonder uitleg terugdraaien, omdat de eenvoudiger vorm hetzelfde lijkt te
doen.

## Gevolgen

- `buildCalendar` in `generateProject.ts` bouwt een eigen vaste kalender en gebruikt `createDefaultCalendar` niet.
  Die leest de bouwmodus uit `localStorage` (`loadConstructionMode`) en kiest zijn feestdagen bij het huidige jaar,
  dus dezelfde benchmark zou per apparaat en per jaar een andere planning rekenen.
- `runBenchmark` in `runner.ts` gebruikt bouwstenen van F5 (`leafTasksForSolve`, `expandSummaryRelations`,
  `solveOptionsFor`, `applyCpmResult`), ook waar een stap voor de gegenereerde data niets doet (de generator legt geen
  relaties op verzameltaken). Het is niet de route van F5 zelf, en de CPM-fase klokt alleen `solver.solve()`.
- `formatResultsMarkdown` en `phaseDetailEnglish` zijn Engels en gaan niet via `t(...)`. De dialoog kopieert die tekst
  naar het klembord om in een issue of bij een AI te plakken; zo leest elk rapport hetzelfde, in welke taal de app ook
  staat. De tabel in de dialoog zelf gaat wel via `t(...)` (`phaseDetail` in `BenchmarkDialog.tsx`).
