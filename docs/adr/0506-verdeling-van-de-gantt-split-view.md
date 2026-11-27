# Verdeling van de twee tijdlijnpanelen in de split view

In de split view verdeelt de verhouding alleen de ruimte naast de splitter: eerst gaat de splitterbreedte van de
totale breedte af, daarna krijgt het eerste paneel `ratio` daarvan en het tweede de rest. Zo valt de splitter niet
in een van de panelen. `computeSplitPaneWidths` in `src/utils/ganttViewport.ts` rekent dat uit, met de verhouding
geklemd op 0 tot 1 en de beschikbare ruimte minstens 0. `GanttCanvas` zet de breedte als CSS met
`splitPanePrimaryWidthCss`: `calc(ratio × 100% - splitter × ratio px)`, gelijk aan `(100% - splitter) × ratio`. Volgens
het weggehaalde commentaar vermijdt die vorm een CSS-vermenigvuldiging die nog niet in elke ingebouwde webview werkt;
dat is niet nagegaan. `check-gantt-coordinate-contracts.ts` vergelijkt beide functies bij 20/80 en 80/20 met een
splitter van 5 px, toetst een smalle split en zoekt de twee aanroepen in `GanttCanvas.tsx`. `computeSplitPaneWidths`
heeft in `src/` geen aanroeper.
