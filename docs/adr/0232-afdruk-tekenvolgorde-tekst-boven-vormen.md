# De tekenvolgorde van de afdruk: tekst boven vormen, in elke tekenroute

In de vector-PDF staat tekst altijd boven de vormen: `paginateVector.ts` zet alle vormen van `PdfVectorDraw2D`
(`operators`) in één gedeeld Form-XObject en plaatst de tekst (`texts`) daarna per blad. In de SVG-opname van het papier
en in het canvas van de rasterexport geldt de volgorde van de aanroepen (de drie routes: ADR 0230). `renderReport`
tekent de labels daarom na de lijnen, zodat ze ook op het papier en in het raster boven de lijnen liggen, en lost
botsingen tussen tekst en vorm op met geometrie (iets weglaten of verplaatsen), niet met een vlak dat iets toedekt: zo'n
vlak ligt in de PDF onder de tekst.

## Gevolgen

- In het chartgebied, na arcering, raster en vandaaglijn: eerst de balken met hun baselinestrook, dan de relatielijnen,
  dan de labels bij de balken, en als laatste de status- of voortgangslijn. Relatielijnen komen na de balken, anders
  tekent een balk een lijn die hem kruist weg. De labels komen na de lijnen: een relatie tussen twee andere taken knikt
  verticaal door de rij van een derde, en de tekst gaat dan boven de lijn. De status- of voortgangslijn komt als
  laatste, omdat ze een referentielijn is die balken, relatielijnen en labels niet mogen bedekken. Op het papier en in
  het raster ligt ze daardoor ook boven de labels, in de vector-PDF eronder (knownbug 2006).
- Een label rechts begint `BAR_LABEL_GAP` (`DEP_STUB` + 8) voorbij de rechterrand die de aanroeper meegeeft: met datums
  bij de balken het balkeinde (ADR 0237), zonder datums kan dat het einde van een zichtbare spelingsband zijn. Die
  afstand is gekozen om ruimte te laten voor de knik van een uitgaande relatie; label en relatie kunnen een ander
  anker hebben, dus het is geen vaste marge tussen die twee. Ze schaalt niet met de lettergrootte, want de knik schaalt
  ook niet (ADR 0231).
- Een label heeft geen halo (een vlak in de papierkleur erachter). Boven de lijnen staat het al door de volgorde, en een
  halo stanst per label een wit blok uit de weekend- en feestdagarcering en de dagrasterlijnen.
- Het label bij de vandaaglijn en bij de status- of voortgangslijn staat in de onderste regel van de tijdschaalkop en
  wordt in `drawTimelineHeader` getekend, niet bij de lijn (toets voor het vandaaglabel: `check-today-label.ts`). De
  dagcijfers die eronder zouden vallen, laat die functie weg. Past het label niet binnen het chartgebied, dan vervalt
  het (`reserveTodayLabel`, `reserveHeaderLineLabel`). Overlappen het vandaaglabel en het statuslabel, dan staat alleen
  het vandaaglabel er. Het label zet zijn eigen `textBaseline`: bij een lage zoom tekent de functie geen dagcijfers en
  erfde het label anders de basislijn van de weeklabels.
- Maand- en weeklabels in de kop slaan een label over dat het vorige zou raken.
