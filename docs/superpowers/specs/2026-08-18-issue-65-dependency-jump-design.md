# Issue #65 — WBS-sprongknop bij afhankelijkheden

Bron: [issue #65](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/65) (Manu Varkey).

## Wat er gevraagd wordt

In het eigenschappenpaneel, sectie Afhankelijkheden (`TaskDependenciesSection.tsx`), staat per
regel een pijl (richting), het relatietype, de lag en een verwijderknop — maar geen manier om
naar de gekoppelde taak te springen. Manu wil:

1. een knopje bij elke afhankelijkheidsregel met het WBS-nummer van de gekoppelde taak;
2. hover op dat knopje toont dezelfde details als hover over een taakbalk op het canvas;
3. klik selecteert die taak en het canvas scrollt/zoomt ernaartoe;
4. zit de taak in een ingeklapte oudertaak, dan klapt die keten automatisch open.

Gebouwd als zelfstandig stuk, los van de grotere (nog niet gestarte) tabel-weergave-revisie —
die twee raken elkaar niet genoeg om te wachten.

## 1. Gedeelde tooltip-inhoud

De canvas-hovertooltip (`GanttCanvas.tsx:1412-1448`) is nu volledig inline JSX: naam, WBS, duur,
start, finish, status, kritiek, total float — gelezen van `tooltip.task`. `HoverTooltip`
(`src/components/canvas/HoverTooltip.tsx`) is los daarvan al een generieke `{left, top, children}`
positioneerder zonder canvas-koppeling.

Trek de content-JSX (regels 1417-1447) over naar een nieuw component
`src/components/canvas/TaskTooltipContent.tsx` met signatuur `{ task: Task }`. `GanttCanvas`
gebruikt 'm dan als children van zijn bestaande `HoverTooltip`-aanroep. `TaskDependenciesSection`
gebruikt straks dezelfde combinatie (`HoverTooltip` + `TaskTooltipContent`) voor zijn eigen hover,
zodat de twee tooltips per definitie gelijk blijven.

**Correctie t.o.v. de eerste opzet:** `HoverTooltip` positioneert nu `position: absolute` binnen
zijn dichtstbijzijnde gepositioneerde voorouder, met een clip-berekening die expliciet rekening
houdt met een `overflow: hidden`-ouder (zie de docstring in `HoverTooltip.tsx` over de Gantt-pane).
Het eigenschappenpaneel scrolt zelf (`overflow-y-auto`, `TaskPropertiesPanel.tsx:85`) — exact het
scenario waarvoor deze app al een oplossing heeft: `Popover.tsx` en `Tooltip.tsx` renderen via
`createPortal` naar `document.body` met `position: fixed`, precies om dit soort clipping te
ontsnappen. `HoverTooltip` wordt daarom aangepast naar diezelfde portal-aanpak (`position: fixed`,
`left`/`top` in viewport-coördinaten, clamp alleen tegen het venster — de "positionerende
ouder"-clip vervalt want een portal zit niet meer in die boom). Zijn twee huidige aanroepers in
`GanttCanvas` (de taak-tooltip én de histogram-overallocatie-tooltip) gaan dan simpelweg
`x + offset` / `y - 10` (viewport-coördinaten) doorgeven in plaats van de container-relatieve
berekening van nu. Zichtbaar gedrag en uiterlijk blijven ongewijzigd — alleen de
positioneringstechniek wordt robuuster, en `TaskDependenciesSection` kan 'm zo zonder aanpassing
hergebruiken.

## 2. Het knopje in de dependency-rij

In `TaskDependenciesSection.tsx` (regel 38-40) wordt de huidige opzet:

```tsx
<span>{role}</span>
<span className="flex-1 truncate">{other?.name || '?'}</span>
```

vervangen door één klikbaar element dat pijl + WBS-nummer combineert (gekozen vormgeving, optie
B uit de mockups):

```tsx
<button
  className="flex items-center gap-1 ..."
  onMouseMove={e => setHoverTask({ x: e.clientX, y: e.clientY, task: other })}
  onMouseLeave={() => setHoverTask(null)}
  onClick={() => other && focusOnTask(other.id)}
  disabled={!other}
>
  <span>{role}</span>
  <span>{other?.wbsCode || '?'}</span>
</button>
```

`other.wbsCode` ligt al klaar op het taakobject (`src/utils/wbs.ts` schrijft het bij elke
structurele wijziging weg via `applyWbsNumbering`) — geen opzoekwerk nodig. De taaknaam zelf
verdwijnt niet uit beeld: die staat al in de tooltip (`TaskTooltipContent`), en het WBS-nummer is
compacter dan de volledige naam, dus de rij blijft even smal als nu.

Hoverstate (`hoverTask`) is lokaal aan `TaskDependenciesSection` (`useState`), naar hetzelfde
patroon als `GanttCanvas`'s `tooltip`-state — positie volgt de cursor, geen vaste ankering aan de
knop.

## 3. `focusOnTask(taskId)`

Nieuwe store-actie (cross-slice, dus als losse functie naast de slices of in `uiSlice`/
`selectionSlice` — exacte plek een implementatiedetail) die drie dingen doet, in deze volgorde:

1. **Oudersketen uitklappen.** Nieuwe helper die vanaf `taskId` via `task.parentId` omhoog loopt
   tot de root, alle ids verzamelt die in `s.ui.collapsedTaskIds` staan, en die in één keer
   doorgeeft aan de bestaande `expandTasks(ids)` (`uiSlice.ts:325`) — die filtert al correct op
   echte summary-taken en roept zelf `recomputeViewRows()` aan.
2. **Selecteren.** Bestaande `selectTask(taskId)`.
3. **Focus-signaal zetten.** `s.view.pendingFocusTaskId = taskId` — naar het patroon van het
   bestaande `view.pendingFit`-signaal (`viewSlice.ts:138-146`): de store kent de
   canvas-afmetingen niet, dus zet hij alleen een vlag; `GanttCanvas` voert de echte berekening
   uit en wist het signaal. Reden om een apart signaal te zijn i.p.v. `pendingFit` te hergebruiken:
   `pendingFit` past het HELE project in beeld, dit moet juist op één taak inzoomen.

`GanttCanvas` krijgt een nieuwe `useEffect`, naast de bestaande `pendingFit`-effect
(`GanttCanvas.tsx:766-780`), die op `view.pendingFocusTaskId` reageert: zodra gezet (en ná de
render-pass die volgt op de expand van stap 1, dus `viewRows` is al bijgewerkt), roept hij de
nieuwe `computeFocusTaskView(...)` aan (§4) en past `setZoom`/`setScroll` toe, en wist het signaal.

## 4. Zoomberekening — `computeFocusTaskView`

Nieuwe pure helper in `src/utils/ganttViewport.ts`, naast de bestaande `computeFitToProject` en
`computeScrollToDate`.

**Horizontaal:** de taakbalk krijgt een vast aandeel van de bruikbare breedte (richtwaarde 20%),
met context ervoor/erna:

```
zoom = (bruikbareBreedte × 0.2) / max(1, duurInDagen)
zoom = clamp(zoom, MIN_FOCUS_ZOOM, MAX_FOCUS_ZOOM)
```

- `duurInDagen` van 0 (milestone) telt als 1, anders deling door nul.
- `MIN_FOCUS_ZOOM` ≈ het niveau van de bestaande 'kwartaal'-preset (8 px/dag,
  `TIMESCALE_ZOOM.quarter` in `timelineTiers.ts`) — een taak van maanden/jaren verschrompelt zo
  niet tot een streepje.
- `MAX_FOCUS_ZOOM` ≈ het niveau van de bestaande 'dag'-preset (100 px/dag,
  `TIMESCALE_ZOOM.day`) — een milestone of taak van één dag zoomt zo niet zo ver in dat alle
  context verdwijnt.
- Het globale zoombereik (`view.zoom` geklemd op 0.5–400/1000, zie `setZoom`) blijft de
  buitenste grens; deze twee constanten liggen daarbinnen.

De taak wordt horizontaal gecentreerd in het bruikbare canvas-gedeelte (rechts van de taaktabel)
op dit nieuwe zoomniveau — dus `scrollX` zo dat het midden van de taakbalk op het midden van dat
gedeelte valt. Dit is bewust anders dan `revealTaskIfOffscreen`, die tegen de linkerrand plakt met
een vaste marge; die functie blijft ongewijzigd voor zijn eigen doel (reveal-on-select vanuit de
linker takenlijst, geen zoomwijziging).

**Verticaal:** na het uitklappen in stap 1 van `focusOnTask` is `viewRows` al bijgewerkt. De
helper zoekt de rij-index van `taskId` in `viewRows` op en centreert die verticaal in de
zichtbare canvas-hoogte: `scrollY = rijIndex × rowHeight − (viewportHoogte / 2) + rowHeight / 2`,
geklemd op `[0, maxScrollY]` (bestaande `clampGanttScroll`).

De exacte constanten (20% aandeel, 8–100 px/dag-grenzen) zijn een eerste aanname, tijdens het
bouwen bijgesteld op basis van hoe het in de praktijk aanvoelt.

## 5. Documentatie

Klein stuk toevoegen aan `public/docs/nl/gids-relaties-constraints.md` en de `en/`-tegenhanger
over het nieuwe knopje — geen nieuw manifest-artikel, dit hoort bij de bestaande relatiegids.

## 6. Verificatie

Dit raakt canvas-rendering en UI-interactie, niet de CPM/kalenderkern — geen nieuwe case in
`tests/planning/`. Verificatie via de browserpreview: knop klikken op een regel waarvan de taak
buiten beeld staat, tooltip-inhoud vergelijken met de canvas-hovertooltip, een taak in een
ingeklapte oudertaak testen (moet vanzelf uitklappen), en het zoom-/scrolgedrag bij een milestone
en bij een taak van meerdere maanden. Plus `npm run typecheck` en `npm run verify:docs`.
