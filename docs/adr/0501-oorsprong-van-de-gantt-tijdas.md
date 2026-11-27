# De oorsprong van de Gantt-tijdas

De datum die op scrollX = 0 valt, komt uit één functie: `computeEffectiveViewStart` in `src/utils/ganttViewport.ts`.
Hij neemt de vroegste van `viewStartDate`, de eerste dag van de getoonde baselines (`baselineEarliest`, uit
`shownBaselineReach`) en de start van elke taak (`resolveTaskStart`, ADR 0502), en trekt daar `ORIGIN_PADDING_DAYS`
(14) kalenderdagen van af (`addCalendarDays`). Reden: de horizontale scroll is nooit negatief (`setScroll` klemt op 0),
dus wat links van de oorsprong ligt, is onbereikbaar. `viewStartDate` staat in een verse weergave op vandaag
(`createDefaultView` in `src/state/defaults.ts`) en houdt geen rekening met taken die eerder beginnen. Een baseline
die vóór de taken begint, blijft zo ook bereikbaar (`check-baseline-vergelijking.ts`, de gevallen E).

## Gevolgen

- De marge telt kalenderdagen, ook op de werkdagen-as. Daar zijn het minder as-dagen: in de opzet van
  `check-workday-axis-nav.ts` 10 werkdagen.
- Feestdagen tellen niet mee voor de oorsprong, ook niet in een Gantt zonder taken. Een nieuw project begint zo bij
  `viewStartDate`, dat de wizard op de projectstart zet (`createNewProject` in `projectSlice.ts`). Trok een vroege
  feestdag de oorsprong naar links, dan toonde een nieuw document die feestdag in plaats van de projectstart. Dat
  bewaakt `tests/browser/new-project-timeline-start.spec.ts` (checkstap 14, 2026-10-15). Latere feestdagen blijven
  bereikbaar: `useGanttViewportCoordinator` verbreedt de inhoud van een Gantt zonder taken tot de laatste feestdag
  (`emptyReachDates`).
- Is `viewStartDate` geen leesbare datum, dan geeft de functie de invoer onveranderd terug; taakstarts en
  baselinedatums tellen dan niet mee. Is `viewStartDate` wel leesbaar, dan slaat de functie een onleesbare taakstart
  of baselinedatum over. Zonder die
  terugkeer gooit `formatDate` een `RangeError` op een ongeldige datum. Een route die de functie aanroept zonder dat
  de Gantt getekend is: Ctrl/Cmd+Home (`nav.scrollToToday` in `shortcutRegistry.ts`, zonder `when`) werkt ook als
  `GanttCanvas` niet gemonteerd is. Of een importer zo'n datum kan opleveren, staat volgens het weggehaalde
  commentaar niet vast. De aanroeper rekent daarna verder met die invoer; zie knownbug 2540.
- De functie staat in `ganttViewport.ts` en niet bij de renderopties, omdat `computeScrollToDate` en
  `computeFitToProject` hier hem gebruiken en `ganttRenderOptions.ts` dit bestand importeert: in die module zou het
  een kringimport geven. `check-gantt-render-options.ts` toetst de uitkomst tegen een eigen kopie van de formule (01
  tot en met 02), dat de startketen in geen ander bestand in `src/` staat (39), dat de viewportcoördinator de functie
  één keer aanroept (40a) en dat `computeScrollToDate` haar aanroept (41).
