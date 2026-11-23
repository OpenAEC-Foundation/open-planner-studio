# Invoer en levensduur van de Gantt-renderer

Elke tekening van een Gantt-pane maakt een nieuwe `GanttRenderer` (`renderGantt` in `useGanttRendererHost.ts`), met
alles wat hij nodig heeft als opties uit `buildGanttRenderOptions`. De
renderer leest geen store en geen CSS: de rijen zijn de gedeelde `viewRows` uit de store (hij vouwt zelf niets
uit, zodat rij i in de tabel en in de Gantt dezelfde rij is, bandkoppen inbegrepen), het palet komt mee of uit
`readGanttPalette()`, en lettertype en tekstschaal komen als `fontFamily` en `fontScale` mee, omdat een canvas geen
CSS-variabelen leest. Zo is hij zonder DOM te testen. Wat tussen frames bewaard moet blijven, staat daarom op
moduleniveau, niet op de instantie.

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
- De tijdas komt van buiten als `axis`: `GanttCanvas` geeft de primaire Gantt en de `HistogramRenderer` dezelfde
  instantie, anders staan de staafjes van de belasting onder andere kolommen dan de balken. Zonder `axis` (de tweede
  pane, tests) bouwt de renderer er zelf een. Elke datum gaat via `dateToX` van die as.
- `GanttCanvas` schaalt rij- en kophoogte met dezelfde factor als `fontScale`, zodat grotere tekst ook ruimte krijgt.
  De renderer stelt elk font samen via `canvasFont` met een tekstrol (`font()`).
- De tekenvolgorde in `render()` is: raster, vandaaglijn, relatiepijlen, balken, feestdagnamen, duurpilletje,
  tijdschaalkop, voortgangslijn, statusdatumlijn en statusdatumlabel. De volgorde draagt de besluiten van
  ADR 0130, 0131, 0132 en 0136.
