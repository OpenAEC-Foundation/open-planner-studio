# De horizontale schuifbalk van de Gantt bij zeer brede inhoud

De horizontale schuifbalk hangt aan een spacer ter breedte van de inhoud (`scrollbarWidth` in
`useGanttViewportCoordinator.ts` is de inhoudsbreedte maal `scrollbarScale`). Boven `MAX_SCROLL_SPACER_PX`
(15.000.000 px) schaalt `scrollbarScale` in `src/utils/ganttViewport.ts` de spacer naar die breedte; daaronder is de
schaal 1. Reden: een browser begrenst de breedte van een element. `tests/browser/gantt-viewport.spec.ts` (20 jaar op
kwartierzoom, 4000 px per dag, ongeveer 35 miljoen px) legt vast dat Chromium de spacer op 33.554.428 px afkapte en dat
de scrollafhandeling de afgekapte `scrollLeft` terugschreef, zodat het einde onbereikbaar was. De grens van Firefox
(ongeveer 17,9 miljoen px) komt uit het weggehaalde commentaar en is niet nagegaan; de 15 miljoen ligt onder beide
getallen.

De omrekening tussen balk en scroll is `scrollLeft = scrollX × scrollbarRangeRatio(inhoud, venster)`, niet de kale
schaal. De balk loopt maar tot spacer min venster, de inhoud tot inhoud min venster; met de kale schaal haalde de duim
het einde niet en sprong een scroll naar het einde terug zodra de browser de te grote `scrollLeft` afkapte (review
2026-09-28). `scrollbarRangeRatio` beeldt die twee bereiken op elkaar af; is een van beide 0 of kleiner, dan geeft hij
de schaal, en onder de grens 1. Het venster is de breedte van de pane, de ouder van de balk (`hScrollViewportWidth`).
De browsertest toetst dat het einde bereikbaar blijft met `setScroll` en met de balk helemaal naar rechts;
`check-gantt-coordinate-contracts.ts` zoekt in de coördinator naar de spacerbreedte en naar de vier omrekeningen met
de pane-breedte.
