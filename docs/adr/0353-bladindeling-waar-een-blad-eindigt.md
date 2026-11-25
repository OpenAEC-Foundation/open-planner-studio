# De bladindeling: waar een blad eindigt

De render geeft de rijgrenzen mee als `breakOffsetsPx` en de gedwongen overgangen als `forcedBreakOffsetsPx`, beide
als y in logische px vanaf de bovenkant van de bron (ADR 0230 en 0236, regel `reports`). `computeTileLayout` laat
een body-tegel eindigen op de eerste gedwongen positie na de start van de tegel die op het blad past, zonder drempel,
ook als het blad dan bijna leeg blijft: bij een blad per resource is dat de bedoeling. Anders, zolang de rest van de
body niet op het blad past, eindigt de tegel op de laatste gewone positie die past, maar alleen als het blad dan
minstens voor `MIN_BREAK_FILL` (de helft) van de bodyhoogte gevuld is.
Past er geen positie (een rij hoger dan een blad) of zou het blad minder dan de helft gevuld zijn, dan loopt de tegel
over de volle bodyhoogte en snijdt hij door een rij. Eindigen gaat voor netheid. De drempel geldt alleen voor gewone
posities: ze voorkomt dat een blad na zo'n snede al op de eerstvolgende rijgrens eindigt en bijna leeg blijft. Het
laatste blad, met de rest van de body, kan wel dun zijn.

## Gevolgen

- Een gedwongen positie voorbij het blad telt op dat blad niet mee. Zodra de eerstvolgende op een later blad past,
  wint die daar als gedwongen positie.
- Alleen eindige posities tellen, strikt tussen de herhaalde kop (`repeatHeaderPx`) en het einde van de body
  (`logicalHeight` min de herhaalde voet); de lijsten hoeven niet gesorteerd binnen te komen.
- Past de rest van de body op het blad, dan eindigt de tegel op het einde van de body zonder een toegestane positie te
  zoeken; een gedwongen positie die daarvóór ligt, geldt ook dan.
- Zonder posities is het de vaste tegeling op bodyhoogte; zo pagineert de raster-terugval van de tabelrapporten
  (`exportTableRaster` in `ReportPanel.tsx` geeft geen posities mee).
- Een lege body geeft precies één lege tegel, dus er is altijd minstens één blad.
- De functie zoekt met twee wijzers over de gesorteerde lijsten, omdat de start van de tegel alleen oploopt; volgens
  het verslag `docs/superpowers/specs/2026-11-07-rapport-tabblad-bevindingen.md` scheelde dat bij 5000 rijen en 100
  bladen een half miljoen stappen.
- `check-print-report.ts` (sectie 6) toetst dat elke tegel behalve de laatste op een rijgrens eindigt, dat bij rijen
  hoger dan een blad elke tegel binnen de bodyhoogte blijft en geen tegel behalve de laatste onder de helft gevuld is,
  dat een vroege breekpositie de eerste pagina niet dun maakt, het dunne blad van een gedwongen positie, het latere
  blad van een verre gedwongen positie, en dat lege lijsten dezelfde tegeling geven als geen lijsten; de gevallen bij
  het resourcediagram toetsen een blad per band ook zonder kopherhaling, bij `actual` en over twee kolommen.
