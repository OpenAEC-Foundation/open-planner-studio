# De bladindeling: schaal en kolommen

Bij *Vaste schaal* (`mode: 'actual'`) is de schaal `LOGICAL_PX_TO_PT` (0,75 pt per logische px) en volgt het aantal
kolommen uit de bronbreedte; bij *Passend maken* (`mode: 'fit-width'`) is het aantal kolommen `timelineColumns` en volgt
de schaal daaruit. Waarom beide standen bij een gewone tabel op 0,75 uitkomen, staat in ADR 0234. Over N
paginabreedtes staat de bevroren tabel N − 1 keer extra op papier, dus `computeTileLayout` deelt `N × printW` door
`logicalWidth + (N − 1) × frozenColumnWidthPx`, en niet door de bronbreedte alleen: alleen zo dekken de N kolommen samen
precies de bron. Bij N = 1 is dat `printW / logicalWidth`. Is de noemer 0 (een bron zonder breedte, bij één kolom of zonder
tabel), dan is de schaal 1 in plaats van oneindig.

## Gevolgen

- De bevroren strook (`frozenPx`) herhaalt bij `actual` en bij `fit-width` met meer dan één kolom, zodat elk blad
  zelfstandig leesbaar is. Bij `actual` rekent de functie haar altijd mee, ook als het bij één kolom blijft, omdat het
  aantal kolommen daar van haar breedte afhangt; bij `fit-width` met één kolom is `frozenPx` 0.
- Kolom 0 toont de bron vanaf x = 0, met de tabel erin. Elke volgende kolom begint met de tabel (`srcX` 0, op
  `marginPt`) zolang `frozenPx` en `frozenPtW` groter zijn dan 0, en daarna het stuk bron dat aansluit op de vorige
  kolom, zonder gat of overlap. Bij `fit-width` eindigt de laatste kolom wiskundig precies op `logicalWidth`.
- Bij `actual` is het aantal kolommen `1 + ⌈(logicalWidth − printW / scale) / ((printW − frozenPtW) / scale)⌉` als de
  bron breder is dan één blad en er naast de tabel ruimte overblijft; anders één kolom (een grens daarvan: knownbug
  2336).
- `timelineColumns` geldt alleen bij `fit-width`. De functie neemt er het gehele deel van, minstens 1 en hoogstens
  `MAX_TIMELINE_COLUMNS` (32); een niet-eindige waarde wordt 1. De bovengrens is er omdat de schaal en daarmee het
  aantal bladrijen meegroeit met N, zodat het paginatotaal ongeveer kwadratisch in N oploopt; zonder die grens bouwde
  een doorgegeven 1e6 volgens het weggehaalde commentaar een miljoen kolomobjecten. Het Rapport-tabblad biedt 1 tot en met 8
  (`TIMELINE_COLUMNS_MAX` in `reportSettings.ts` en de knoppen in `GanttReportStudio.tsx`); 32 laat daarboven ruim
  marge voor elke andere aanroeper.
- Een niet-eindige of negatieve `logicalWidth` of `logicalHeight` wordt 0, omdat schaal, aantallen en vensters delingen
  op die twee maten zijn en een NaN anders ongemerkt in de bladindeling doorloopt. Met 0 vangen de grenzen hierboven
  en in ADR 0352 en 0353 de lege bron op. Voor deze klemmen en voor `MAX_TIMELINE_COLUMNS` vond ik geen toets.
- `check-print-report.ts` (sectie 5) toetst de schaal 0,75 en het aantal kolommen bij *Passend maken* op A4 tot en met
  A1 en bij *Vaste schaal*; `check-print-raster-export-streaming.ts` toetst dat `fit-width` met `timelineColumns: 8`
  acht kolommen geeft.
