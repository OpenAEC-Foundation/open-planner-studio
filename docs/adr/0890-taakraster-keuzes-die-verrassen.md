# Taakraster: keuzes die verrassen

Een paar keuzes in de componenten van `src/components/task-grid/` lijken overbodig of omslachtig, maar houden
gedrag overeind dat de code zelf niet uitlegt. Ze staan hier, zodat niemand ze terugdraait.

## Gevolgen

- **Laag van de kolomkoppen** (`columnHeaderZIndex` in `DataGridHeader.tsx`). Een gewone kolomkop krijgt geen
  `z-index`. De breedtegreep hangt deels over de volgende kop; met een eigen laag per kop lag die volgende kop
  (later in de DOM) over dat deel en was de greep maar 2 à 3 px pakbaar. Alleen vastgezette koppen krijgen een laag,
  aflopend binnen het vastgezette blok, zodat ze boven de wegscrollende koppen blijven en ook daar elke greep heel
  pakbaar is.
- **Kolom slepen via het venster** (`DataGridHeader`). Zolang een kolom gesleept wordt, luisteren `dragover` en
  `drop` op `window`, niet per kolomkop. Een drop net naast de koppen (voorbij de laatste kolom of over de rijen)
  bereikt anders geen kop en werd stil genegeerd; `resolveColumnDropTarget` klemt de positie naar de dichtstbijzijnde
  geldige grens. `onDragEnd` op de kop blijft voor een sleep die buiten het venster eindigt zonder `drop`.
- **Eén tooltip in de relatiecel** (`RelationCellContent` in `RelationCellEditor.tsx`). De link naar de andere taak
  draagt `title=""`: daarboven toont de hoverkaart de taak met de relatiedetails, en de lege titel onderdrukt de
  gewone celtooltip. De iconen voor sturend en waarschuwing staan buiten de link en houden hun eigen `title`.
- **Grens om de relatie-editor** (`RelationCellEditor`). De editor stopt `pointerdown` en `mousedown`. Zonder die
  grens behandelde de Gantt-surface een klik op type, lag of verwijderen als nieuwe cel- of rijselectie en bouwde de
  editor opnieuw op voordat de klik zijn eigen state kon bijwerken.
- **Toetsen in de keuzelijst-editor** (`TaskCellEditor`). `Select` stopt Escape in een open lijst en de propagatie
  van zijn eigen Enter bij een keuze. Daarom vangt de omhulling Escape al in de capture-fase af (één Escape sluit
  lijst en celbewerking), en legt een keuze vast via een nagebootste Enter naar `inputProps.onKeyDown`, zodat
  Shift+Enter en de rest van de rasternavigatie gelijk blijven aan typen.
