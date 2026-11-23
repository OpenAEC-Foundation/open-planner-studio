# Relatiepijlen in de Gantt

`render()` tekent de relatiepijlen vóór de balken, dus een stuk pijl onder een balk is onzichtbaar. De routing in
`drawDependencyArrows` ontwijkt de balken daarom zelf, met twee bouwstenen. Horizontaal reist een pijl in de goot op
de rijgrens: een balk beslaat het midden van zijn rij, dus de grens is vrij. Verticaal reist hij in een kolom die
geen balk raakt in een rij strikt tussen voorganger en opvolger (`isColumnFree`). Past de klassieke elleboog
(de kolom naast de voorganger ligt aan de goede kant van de aankomst en is vrij), dan tekent hij die; anders een
trap door de goten. Bewaking: `check-arrow-routing`.

## Gevolgen

- `pickColumn` probeert eerst de kolom naast de opvolger, dan die naast de voorganger, en zoekt daarna het
  dichtstbijzijnde gat in de corridor ertussen, zodat een omweg niet buiten de eigen omhullende uitwaaiert. Vindt hij
  geen gat, dan wint de eerste kolom en ligt een deel van de pijl onder een balk (knownbug 1975): liever een deels
  bedekte pijl dan één die dwars door het diagram slingert.
- De obstakels (`buildRowObstacles`) komen alleen uit de zichtbare rijen met een kleine marge; een balk buiten beeld
  verbergt niets, en zo blijft de index klein bij duizenden taken. Een balk telt met 3 px marge, een nulduurmijlpaal
  met 6 px, een ingeklapte mijlpalenreeks van het eerste tot het laatste ruitje. Een bandkoprij telt niet: hij is
  bijna doorzichtig en zou over de volle breedte elke kolom blokkeren. De spelingsband, de baselinestrook, de
  constraintpins en de aantekeningstip tellen niet; de spelingsband kan tientallen dagen breed zijn en zou pijlen
  ver laten omlopen. Pijlen in de goot kunnen de baselinestrook raken (knownbug 1976).
- Is het verschil tussen begin en eind kleiner dan twee stubs, dan is de stub 4 px in plaats van 8 px, zodat de
  meest voorkomende relatie (FS zonder gat) geen brede zigzag wordt. Bij aangrenzende rijen vallen beide goten
  samen en is de kolomkeuze niet nodig.
- Na een berekening is een driving relatie doorgetrokken en een niet-driving relatie gestreept; rood als de driving
  relatie twee kritieke taken verbindt. Zonder berekening tekent alles neutraal doorgetrokken. Een pijl buiten een
  trace is fijn gestippeld én doorzichtig (0,15), zodat het onderscheid blijft waar alpha of kleur wegvalt (hoog
  contrast, geforceerde kleuren).
- Het anker (`relationAnchorX`) ligt bij een taak met alleen datums op de dagcelrand: het begin van de startdag of
  het einde van de einddag. Heeft start of einde een tijd, dan op de balkrand uit `barGeometry`. Een lid van een
  groep mijlpalen op dezelfde dag ankert op het ruitje van de groep, en twee leden van dezelfde groep krijgen geen
  pijl.
- Staat een taak op meer rijen (groeperen), dan krijgt de eerste rij (`firstRowIndexByTask`) de pijlen en de rest
  niet.
- Afkappen op de rij gebeurt vóór alles, met een marge van een halve rij plus 8 px: bij voorganger en opvolger op
  dezelfde rij kan een goot een halve rij buiten het paar liggen. Zo valt een net zichtbare pijl niet weg.
- Komt een punt van het pad verder dan 16 px buiten het canvas, dan knipt `strokeArrowPath` elk segment
  (Liang–Barsky) en tekent alleen de zichtbare stukken. Elk stuk krijgt `lineDashOffset` gelijk aan de afgelegde
  lengte, zodat het streeppatroon samenvalt met het ongeknipte pad. Zonder knippen rekende de rasteraar het
  streeppatroon over de hele lengte buiten beeld uit, ongeveer 1 s per frame bij 10.730 relaties
  (`check-gantt-arrow-clip`). Na de pijlenlaag staat `lineDashOffset` weer op 0.
