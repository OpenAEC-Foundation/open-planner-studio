# Scrollen naar een datum in de Gantt, en de afstand op de as

`computeScrollToDate` in `src/utils/ganttViewport.ts` geeft de horizontale scroll waarbij een datum links in beeld
komt, met `SCROLL_TO_DATE_MARGIN_DAYS` (3) as-dagen ervoor zolang de scroll niet op 0 klemt, zodat de datum niet tegen de linkerrand plakt. Zonder
datum is het doel de statusdatum van het project, anders vandaag (`localTodayIso`). Zoom en `viewStartDate`
veranderen niet. Ctrl/Cmd+Home (`nav.scrollToToday` in `shortcutRegistry.ts`) zet de uitkomst met `setScroll`. De
oorsprong komt uit dezelfde `computeEffectiveViewStart` als die van de getekende Gantt (ADR 0501), met de getoonde
baselines, zodat de sprong klopt met wat er getekend wordt (`check-gantt-render-options.ts` 41,
`check-baseline-vergelijking.ts` E). De invoer is het kleine type `ScrollToDateState` en niet `AppState`, zodat dit
bestand de store niet importeert; een volledige store-snapshot past erin.

`axisDayDistance` geeft de afstand in de dagen van de as die de Gantt tekent. Met een kalender en
`compressNonWorkdays` bouwt hij de as met dezelfde `resolveGanttAxis` als de renderer, die bij een kalender zonder
werkdag zelf terugvalt op de kalender-as; anders telt hij kalenderdagen. Ctrl+Home en de fit van Ctrl+0 (ADR 0502)
gebruiken hem, zodat ze op de werkdagen-as geen twee dagen per weekend te veel tellen; zo schoof Ctrl+0 het project
deels uit beeld. `check-workday-axis-nav.ts` toetst beide op de kalender-as en de werkdagen-as.

Een doel of oorsprong die geen leesbare datum is, geeft geen bruikbare scroll; zie knownbug 2540.
