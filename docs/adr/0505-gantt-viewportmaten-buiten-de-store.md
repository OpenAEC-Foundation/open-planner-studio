# Maten van de Gantt-viewport buiten de store

De store kent de maten van het tijdlijnpaneel niet, maar twee store-acties hebben ze nodig. Daarom houdt
`src/utils/ganttViewport.ts` drie waarden op moduleniveau bij: de breedte van het primaire tijdlijnpaneel
(`setGanttChartWidth`) en de grootste horizontale en verticale scroll (`setGanttScrollBounds`). Zo hangt de store niet
aan React of de DOM. `onPrimarySize` in `useGanttViewportCoordinator.ts` zet ze bij elke tekening van het primaire
canvas (`drawPrimary` in `useGanttRendererHost.ts`). Zolang er geen Gantt getekend is, zoals in de planningssuite,
zijn ze `null`.

## Gevolgen

- `setTimeScale` in `viewSlice.ts` houdt met de breedte de datum onder het midden van het paneel vast; is de breedte
  `null` of verandert de zoom niet, dan zet hij alleen de zoom. `setGanttChartWidth` neemt alleen een eindige breedte groter dan 0 aan, anders
  `null`. `clearGanttScrollBounds` wist de breedte niet.
- `setScroll` klemt met `clampGanttScroll` op de bovengrenzen; de ondergrens 0 zet `setScroll` zelf. Zonder bovengrens
  kon een overscroll (het wiel, of horizontaal scrollen na extreem uit- en inzoomen) de balken helemaal uit beeld
  duwen, en geen tekening haalde ze terug. Zijn de grenzen `null`, dan geldt alleen de ondergrens.
  `setGanttScrollBounds` maakt een niet-eindige grens `null` en een negatieve 0.
- `computeGanttScrollBounds` is de ene formule voor de grenzen: inhoudsbreedte min canvasbreedte, en inhoudshoogte min
  (canvashoogte min kophoogte), elk minstens 0. De inhoudshoogte is `taskListScrollContentHeight`, dezelfde als die
  van de takenlijst, zodat beide even ver verticaal schuiven. Behalve bij elke tekening rekent de coördinator de
  grenzen vooruit voor een nieuwe zoom vóór de bijbehorende `setScroll`: bij zoomen via `zoomAt`, bij de fit en bij
  "spring naar taak" (`registerBoundsForZoom` en het focuseffect). Anders klemt `setScroll` op de grens van de vorige
  zoom; die vooruitrekening komt uit "spring naar taak" (issue #65). `check-focus-task.ts` (08 tot en met 10) toetst de formule.
- Gaat de Gantt uit beeld, dan wist de coördinator de grenzen (`clearGanttScrollBounds` bij het afkoppelen). Anders
  klemde de oude Gantt-grens de store in de Tabel-weergave, die een ander venster heeft: de store bleef achter bij de
  DOM en het raster toonde lege rijen (review #362).
- `getGanttScrollBounds` lezen de wielafhandelingen (`useGanttZoom.ts` en de tweede pane in de coördinator). Doet het
  wiel een verticale scroll en is `maxScrollY` 0 of kleiner (het hele project past verticaal), dan scrollen ze
  horizontaal, zodat het wiel iets zichtbaars doet; bij `null` blijft het verticaal.
