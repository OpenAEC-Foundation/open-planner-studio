# Tabel-overhaul: uitgangstoestand en Gantt-eventeigenaars

## Meetomgeving

- Basiskop: `446324ce83bab363bb66f28a4cf2d805ce4a0d25`.
- Basistak: `codex/tabel-overhaul`; deze geïsoleerde worktree werkt op de afgeleide tak `codex/task-0-gantt-baseline`.
- Node: `v24.15.0`.
- npm: `11.12.1`.
- `npm run typecheck`: exitcode `0` (2026-08-25, na de Task-0-wijzigingen).
- `bash tests/planning/run.sh`: exitcode `0` (2026-08-25, na de Task-0-wijzigingen; 560/560 planningscases en de tijdzonematrix groen).

## Geautomatiseerde uitgangscontrole

De volledige planningssuite bevat de bestaande Gantt-checks `check-gantt-render-options.ts`,
`check-axis-consolidation.ts` en `check-focus-task.ts`. De Task-0-check wordt daar als
`check-gantt-event-ownership.ts` aan toegevoegd. Een verwachting is niet aangepast om een
bestaande afwijking te maskeren.

De gerichte bundel- en uitvoerrun van deze vier checks eindigde met exitcode `0`:
`gantt-event-ownership` (17), `gantt-render-options` (124), `axis-consolidation` (4836) en
`focus-task` (15) controles.

## Eigenaarschap vóór de canvasknip

`canvas` in de manifestkolom betekent de huidige `GanttCanvas`-route: sommige invoer begint op
een DOM-overlay (de twee scrollbalken), maar wordt daar door `GanttCanvas` afgehandeld en deelt
dezelfde canvasgestuurde viewportstaat. De beoogde eigenaar is de contractwaarde voor de latere
migratie, geen bewering dat die migratie al bestaat.

| Handeling | Manifestactie | Huidige eigenaar en route | Beoogde eigenaar |
| --- | --- | --- | --- |
| Rijselectie | `rowselect` | `canvas`: `GanttCanvas.handleClick` → `selectTask` | DOM-grid/workspace |
| Ctrl-/Cmd-selectie | `rowselect` | `canvas`: `handleClick` → toggle-selectie | DOM-grid/workspace |
| Shift-selectie | `rowselect` | `canvas`: `handleClick` → range-selectie | DOM-grid/workspace |
| Disclosure | `disclosure` | `canvas`: `handleClick` → `isCollapseToggle`/`toggleCollapse` | DOM-grid/workspace |
| Nieuwe taak | `add` | `canvas`: `handleClick` → `isAddButton`/`addTask` | DOM-grid/workspace |
| Dubbelklik op rij | `row-dubbelklik` | `canvas`: `handleDoubleClick` → bestaande bewerkdialoog | DOM-grid/workspace |
| Contextmenu op rij | `rowcontextmenu` | `canvas`: `handleContextMenu` | DOM-grid/workspace |
| Rijsleep | `rowdrag` | `canvas`: `handleMouseDown` → `useRowDrag` | DOM-grid/workspace |
| Rijhover en tooltip | `tooltip` | `canvas`: `handleMouseMove` → `HoverTooltip` | DOM-grid/workspace |
| Tabel/tijdlijn-splitterdrag | `splitter` | `canvas`: `handleMouseDown` → `useSplitter` | DOM-grid/workspace |
| Verticale scroll | `vertical-scroll` | `canvas`: DOM-overlay `handleVScroll` → `setScroll` | DOM-grid/workspace |
| Horizontale tijdscroll | `horizontal-time-scroll` | `canvas`: DOM-overlay `handleHScroll` → `setScroll` | timelinecanvas |
| Fit-to-project | `fit-to-project` | `canvas`: `pendingFit`-effect en contextmenuactie | timelinecanvas |
| Focus-on-task | `focus-on-task` | `canvas`: `pendingFocusTaskId`-effect | timelinecanvas |
| Taakbalken en resize | `bars` | `canvas`: renderer-hit-test → `useBarDrag` | timelinecanvas |
| Relaties tekenen | `dependencies` | `canvas`: renderer-hit-test → `useDependencyDraw` | timelinecanvas |
| Pannen | `pan` | `canvas`: `handleMouseDown` → `usePan` | timelinecanvas |
| Boxselectie | `boxselect` | `canvas`: `handleMouseDown` → `useBoxSelect` | timelinecanvas |

## Browseruitgangscontrole

Controllermeting in de echte app op `http://localhost:3008/`, met het privacyvrije repository-
voorbeeld `examples/01-grachtenpand-amsterdam.ifc`. De geladen titel was **New-Build Canal House,
Amsterdam**, met 44 taken en 4 mijlpalen. De huidige implementatie is één overlaid Gantt-canvas
over takentabel en tijdlijn.

1. Een gewone rij-klik op WBS 1.1 selecteerde precies één taak en vulde de eigenschappenrail.
2. Ctrl-klik (Control-modifier) op de volgende rij gaf `Selection: 2 task(s)`.
3. Shift-klik tot en met WBS 1.4 gaf `Selection: 4 task(s)`.
4. Een disclosure-klik op samenvatting WBS 1 klapte de kinderen in; de volgende zichtbare rij was
   samenvatting WBS 2. Na controle is de tak weer geopend.
5. De plus op een samenvattingsrij maakte één taak: 44 → 45; Undo herstelde 44.
6. Dubbelklik op WBS 2.1 opende de bestaande modal **Edit task** voor **Excavate building pit**.
   Dit is de huidige bewerkdialoog, niet de eigenschappenrail; het DOM-grid/workspace-doel hoort
   bij de toekomstige implementatie.
7. Rechtsklik op WBS 2.1 opende het rijcontextmenu met Edit, Insert above/below, Add
   subtask/milestone/relation, Indent/Outdent, Toggle milestone, assignment/progress/priority,
   Trace path en Delete.
8. Rijsleep verplaatste **Drive foundation piles** vóór **Excavate building pit**; de WBS-volgorde
   wijzigde en Undo herstelde de oorspronkelijke volgorde.
9. De takentabelsplitter verschoof de canvasgrens tussen tabel en tijdlijn van ongeveer x=361 naar
   x=430 en is hersteld.
10. De verticale overlay-scrollbalk `[data-testid=gantt-vscroll]` ging van `scrollTop` 0 naar 420;
    zichtbare rijen wijzigden naar WBS 3.5 t/m 5.3 terwijl gridrijen en balken uitgelijnd bleven.
    Daarna hersteld naar 0.
11. De horizontale tijdscrollbalk `[data-testid=gantt-hscroll]` ging van `scrollLeft` 0 naar 92 en
    is hersteld naar 0.
12. Na twee Zoom+-kliks gaf Fit-to-project via Ctrl+0 een wijziging van 21px/day naar 3px/day.
13. In de focusOnTask-route selecteerde de gebruiker WBS 2.1 en klikte de bestaande
    eigenschappenknoop **Go to task 3.1**. De selectie werd **Ground floor masonry**,
    verticale scroll 81 en horizontale scroll 53.

De capture is daarna teruggezet naar thema Dark, met split view en histogram weer uit.

| Screenshot | Controle |
| --- | --- |
| `artifacts/tabel-overhaul/baseline-gantt-dark-split-histogram.jpg` | JPEG 1280×720, split view en volledig histogram; SHA-256 `d9474687416cf6b92789d4f3aea20ad26ba190340f7b8ac30c8573ab7cea1011` |
| `artifacts/tabel-overhaul/baseline-gantt-light-split-histogram.jpg` | JPEG 1280×720, split view en volledig histogram; SHA-256 `f6a16ed45725efb4dac6558ffcfb7dea204031bb5d6c8086582998bcf885d367` |
