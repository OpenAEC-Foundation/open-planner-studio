# Bladgrenzen, voet en legenda van de Gantt-afdruk

De render bepaalt waar een blad mag eindigen en wat de voet toont; de pagineerders (`paginate.ts`, `paginateVector.ts`,
met `tileLayout.ts`) delen het rapport in bladen en herhalen kop en voet als daarom gevraagd is. Onder elke rij mag een
blad eindigen (`breakOffsets`), zodat geen rij over twee bladen wordt gesneden; de voet is één blok na de laatste rij.
De gedwongen overgangen van het resourcediagram staan in de regel `reports`. Een band direct onder een band (de
typelaag) krijgt geen eigen overgang, anders stond de typekop alleen op een verder leeg blad.

## Gevolgen

- De render tekent geen paginanummer: hij kent het aantal bladen niet, en de voet komt op elk blad terug. Beide
  pagineerders zetten zelf `n / totaal` in de ondermarge.
- `footerLayoutWidth` legt de inhoud van de voet (naam en datum links, legenda in het midden, merknaam rechts) binnen
  één paginabreedte; de grijze strook blijft zo breed als het rapport. De herhaalde voet komt uit één vast stuk van de
  bron, dus bij meer dan één kolom bladen moet de voet op één blad compleet zijn. De aanroepers geven de breedte uit
  `footerLayoutWidthFor` (`tileLayout.ts`) door: `exportGanttReportPdf.ts` en `reportPaperModel.ts`.
- De legenda staat tussen het linker- en het rechterblok. Is er te weinig ruimte, dan laat `drawFooter` items van
  achteren weg in plaats van over de blokken heen te tekenen. De regel die de lijnstijl van de relaties verklaart, staat
  daarom achteraan: hij is het minst nodig. Hij staat er alleen bij `showDeps` en `drivingSequenceIds`; zonder die ids
  is elke lijn doorgetrokken en zou de regel een onderscheid beloven dat er niet is (ADR 0235).
- Buiten de kleurmodus *Kritiek pad* (`barColorSelection.mode` niet `critical`) vervallen de blokjes Kritiek pad en
  Normaal, want de balken hebben dan een andere betekenis; er komt een regel voor de rode rand om een kritieke taak. In
  de modus `category` staan hoogstens acht categorieën (`LEGEND_CATEGORY_CAP`), plus een regel voor de rest als de
  aanroeper daar een tekst voor geeft (`barColorsLegendLabels.categoriesMore`).
- Het blokje Voltooid tekent met `paintProgressBarPiece`, dezelfde regel als de balken, zodat het laat zien wat het
  grijs in een balk betekent.
