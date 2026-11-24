# De tekenvolgorde van de afdruk: tekst boven vormen, in beide backends

In de vector-PDF staat tekst altijd boven de vormen: `paginateVector.ts` zet alle vormen van `PdfVectorDraw2D`
(`operators`) in één gedeeld Form-XObject en plaatst de tekst (`texts`) daarna per blad. Op het canvas van het papier en
de rasterexport geldt de volgorde van de aanroepen. `renderReport` tekent de labels daarom in het raster na de lijnen,
zodat ze ook daar boven de lijnen liggen, en lost botsingen tussen tekst en vorm op met geometrie (iets weglaten of
verplaatsen), niet met een vlak dat iets toedekt: zo'n vlak ligt in de PDF onder de tekst.

## Gevolgen

- In het chartgebied, na arcering, raster en vandaaglijn: eerst de balken met hun baselinestrook, dan de relatielijnen,
  dan de labels bij de balken, en als laatste de status- of voortgangslijn. Relatielijnen komen na de balken, anders
  tekent een balk een lijn die hem kruist weg. De labels komen na de lijnen: een relatie tussen twee andere taken knikt
  verticaal door de rij van een derde, en de tekst gaat dan boven de lijn. De statuslijn komt na de labels; in het
  raster ligt ze daardoor ook boven de tekst, in de PDF eronder (knownbug 2006).
- Een label begint rechts op `BAR_LABEL_GAP` (`DEP_STUB` + 8) van de balk, voorbij de knik van de eigen uitgaande
  relatie. Die afstand schaalt niet met de lettergrootte, want de knik schaalt ook niet (ADR 0231).
- Een label heeft geen halo (een vlak in de papierkleur erachter). Boven de lijnen staat het al door de volgorde, en een
  halo stanst per label een wit blok uit de weekend- en feestdagarcering en de dagrasterlijnen.
- Het label bij de vandaaglijn en bij de status- of voortgangslijn staat in de onderste regel van de tijdschaalkop en
  wordt in `drawTimelineHeader` getekend, niet bij de lijn (toets voor het vandaaglabel: `check-today-label.ts`). De
  dagcijfers die eronder zouden vallen, laat die functie weg. Past het label niet binnen het chartgebied, dan vervalt
  het (`reserveTodayLabel`, `reserveHeaderLineLabel`). Overlappen het vandaaglabel en het statuslabel, dan staat alleen
  het vandaaglabel er.
- Maand- en weeklabels in de kop slaan een label over dat het vorige zou raken.
