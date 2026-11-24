# Invoer en levensduur van de Gantt-renderer

Elke tekening van een Gantt-pane maakt een nieuwe `GanttRenderer` (`renderGantt` in `useGanttRendererHost.ts`), met
alles wat hij nodig heeft als opties uit `buildGanttRenderOptions`. Wat tussen frames bewaard moet blijven, staat
daarom op moduleniveau, niet op de instantie. De renderer leest de store niet zelf: de rijen zijn de gedeelde
`viewRows` uit de store (hij vouwt zelf niets uit, zodat rij i in de tabel en in de Gantt dezelfde rij is,
bandkoppen inbegrepen). Lettertype en tekstschaal komen als `fontFamily` en `fontScale` mee, omdat een canvas geen
CSS-variabelen leest. Het palet komt mee als `palette`, of de constructor leest het met `readGanttPalette()`, dat de
CSS-variabelen van `document.documentElement` opvraagt. De gewone Gantt geeft geen palet mee (`GanttCanvas`) en leest
dus CSS; een test zonder DOM kan de renderer draaien als hij een palet meegeeft.

## Gevolgen

- De caches op moduleniveau (`cachedRowIndexByTask`, `cachedArrowEntries`) zijn een `WeakMap` op de rijenlijst en de
  relatielijst, en gelden alleen voor bevroren lijsten. Een lijst uit de store is bevroren en kan dus niet na het
  cachen in place veranderen; een losse testlijst of een lijst van de afdruk krijgt elke keer een verse map
  (`check-render-caches`).
- Vulpatronen worden op moduleniveau gememoized per sleutel van kleur en maat (`tilePattern`), dus één keer getekend
  en niet per frame. Zonder bruikbare DOM (de planningssuite op Node) is er geen patroon en tekent de aanroeper
  zonder. Omdat het patroon gedeeld is, zet `anchorPattern` vóór elke vulling zijn oorsprong opnieuw.
- Binnen één render hergebruikt de renderer een `CalendarEngine` per kalender (`engineCache`); de engine van de
  projectkalender dient ook de arcering. De geometrie die de hittests lezen (`splitSegmentsByTask`, `baselineHits`,
  `outsideNameSpans`) wordt per render geleegd en gaat dus over de laatste tekening.
- De tijdas komt van buiten als `axis`. De primaire Gantt en de `HistogramRenderer` krijgen elk een eigen as
  (`sharedAxis` en `histogramAxis` in `useGanttViewportCoordinator`), gebouwd uit dezelfde kalender, compressie,
  zoom, scrollpositie en begindatum; anders staan de staafjes van de belasting onder andere kolommen dan de balken.
  De Gantt begint op x = 0, de histogramas aan de linkerrand van zijn plot (`histogramPlotInsets`): na de
  resourcekiezer als die links staat, op x = 0 als die rechts staat. Zonder `axis` (de tweede pane, tests) bouwt de
  renderer er zelf een. De x van een datum komt van die as (`dateToX`).
- `GanttCanvas` schaalt rij- en kophoogte met dezelfde factor als `fontScale`, zodat grotere tekst ook ruimte krijgt.
  De renderer stelt zijn fonts samen via `canvasFont` met een tekstrol (`font()`).
