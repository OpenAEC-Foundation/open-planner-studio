# Zoom en scroll bij "spring naar taak" in de Gantt

"Spring naar taak" (`focusOnTask` in `viewSlice.ts`) zet een signaal; `useGanttViewportCoordinator.ts` rekent de zoom
en de scroll uit met de functies in `src/utils/ganttViewport.ts`. `computeFocusTaskHorizontal` mikt op een balk van
`FOCUS_TASK_WIDTH_FRACTION` (0,2) van de paneelbreedte, vóór de zoomklem hieronder, en probeert hem in het midden te zetten. Dat laat context ervoor en erna en
oogt niet van rand tot rand zoals de fit (ADR 0502). De zoom klemt tussen `FOCUS_TASK_MIN_ZOOM`
(`TIMESCALE_ZOOM.quarter`) en `FOCUS_TASK_MAX_ZOOM` (`TIMESCALE_ZOOM.day`): zonder
bovengrens zoomt een mijlpaal zo ver in dat de context verdwijnt. De grenzen zijn
tijdschalen die de gebruiker ook in het lint kan kiezen. Een duur onder 1 dag telt als 1 dag. Anders dan de fit zoomt
dit op één taak, en anders dan Ctrl+Home (ADR 0503) en `revealTaskIfOffscreen` in `GanttCanvas.tsx`, die alleen
scrollen en de zoom laten staan, verandert dit de zoom.

## Gevolgen

- De functie krijgt duur en midden al in as-dagen (breuken mogen, voor urentaken); de coördinator rekent ze uit met de
  as van de renderer. Zo blijft de functie puur, zonder datums te lezen.
- Met `preserveZoom` (`taskInsertActions.ts`) houdt de coördinator de zoom en centreert hij de taak zelf, zonder deze
  functie.
- `computeFocusTaskScrollY` zet rij `rowIndex` in het midden van de zichtbare hoogte (canvashoogte min kophoogte),
  minstens 0: de omgekeerde van `GanttRenderer.rowToY`.
- `check-focus-task.ts` (01 tot en met 07) toetst de breedte, beide grenzen, de duur 0 en 1, de klem op 0 en de
  verticale scroll.
