# De bladindeling: de herhaalde kop en voet

Kop en voet zijn stroken van de bron: de kop meet `repeatHeaderHeightPx` vanaf de bovenkant (projectkop en tijdschaal),
de voet `repeatFooterHeightPx` vanaf de onderkant (projectnaam, afdrukdatum en legenda; ADR 0236). De kop komt boven
elk kolomvenster met hetzelfde x-venster als de body eronder, zodat de tijdschaal boven de goede dagen staat (beide
pagineerders, in hun lus over `xWindows`). Een herhaalde voet komt op elk blad uit één vast venster, `footerWindow`:
vanaf x = 0, `min(logicalWidth, footerLayoutWidthPx)` breed, op `marginPt`. Hij wordt niet per kolom gesneden, omdat
de legenda anders alleen op het blad staat waar hij toevallig valt, en een uitdeelvel zonder legenda is onleesbaar
("een blad per persoon", issue #113). De render legt de voetinhoud daarvoor binnen `footerLayoutWidthPx` (ADR 0236).

## Gevolgen

- De kop wordt herhaald als `repeatHeaderHeightPx` groter is dan 0 en kleiner dan zowel de bronhoogte van een blad
  (`printH / scale`) als `logicalHeight`; anders is `repeatHeaderPx` 0. Zo blijft er onder de kop ruimte voor de body;
  de lus van de tegeling stopt zelf al als een blad geen voortgang maakt (`end <= srcY`).
- De voet wordt alleen herhaald als hij gevraagd is, als kop en voet samen kleiner zijn dan de bronhoogte van een blad
  en dan `logicalHeight`, en als de afdruk meer dan één blad telt: de bron is hoger dan één blad, er is meer dan één
  kolom, of er ligt een gedwongen breekpositie tussen de kop en `logicalHeight − repeatFooterHeightPx`. Past alles op
  één blad, dan blijft de voet onder de laatste rij; volgens het weggehaalde commentaar kreeg de gewone afdruk anders
  twintig centimeter wit tussen tabel en voet. Een gedwongen positie in de voetstrook telt hier niet mee, omdat ze bij
  een herhaalde voet buiten de body valt en dan als breekpositie wegvalt (ADR 0353).
- Zonder herhaalde voet loopt de body tot `logicalHeight`: de voet blijft een deel van de bron en wordt met de gewone
  vensters gesneden. Hij staat dan op de laatste rij bladen, en bij meer dan één kolom verdeeld over de bladen van die
  rij, naar de x-vensters van de kolommen.
- De kop begint op `marginPt`, de body op `bodyTopPt` (onder de herhaalde kop) en de voet op `footerTopPt`, onderaan
  het printgebied; zonder herhaalde voet is `footerTopPt` de onderrand van het printgebied. `printH` is de
  papierhoogte min twee marges min `PAGE_NUMBER_PT` (14 pt), dus de voet staat boven die ruimte. Beide pagineerders
  zetten het paginanummer op een halve marge boven de onderrand van het papier.
- `footerLayoutWidthPx` is de bronbreedte van een volle paginabreedte van kolom 0 (`printW / scale`), ook als de bron
  smaller is. `footerRelayoutWidth` geeft alleen een breedte als de voet herhaald wordt en die breedte meer dan 0,5 px
  kleiner is dan de render. Bij `fit-width` met één kolom zijn de twee wiskundig gelijk, maar als drijvende-kommagetallen
  soms een fractie uit elkaar; zonder die marge renderen het papier (`reportPaperModel.ts`) en de vector-PDF een tweede
  keer voor niets. De rasterexport gebruikt `footerLayoutWidthFor` zonder die marge (ADR 0236).
- `check-print-report.ts` (de gevallen bij de voet op elke pagina) toetst onder meer: één blad geeft geen herhaling en
  dezelfde tegeling, één rij over twee kolommen wel, een gedwongen positie in de voetstrook zet de herhaling niet aan,
  een te hoge voet wordt niet herhaald, en bij twee kolommen is het voetvenster één paginabreedte vanaf x = 0.
