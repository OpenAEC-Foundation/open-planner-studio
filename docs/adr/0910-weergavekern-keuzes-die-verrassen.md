# Weergavekern: keuzes die verrassen

De weergavekern in `src/engine/view/` (filter, groeperen, sorteren, zichtbare rijen, layouts) is puur en heeft geen
commentaar meer. Drie keuzes daarin zie je niet aan de code af.

## Gevolgen

- **De indexen hangen aan de context zelf.** `indexesFor` in `filterEval.ts` bouwt de toewijzingen per taak en de
  resources per id één keer per `ViewContext` en bewaart ze in een `WeakMap` op dat object, in plaats van extra velden
  op de context die elke bouwplek zelf moet vullen. Dat is alleen juist zolang wie een `ViewContext` bouwt, een nieuwe
  maakt zodra resources of toewijzingen veranderen; anders geven filter, groepering en sortering verouderde
  resourcenamen.
- **Resourcetypen staan in een vaste volgorde, niet op naam.** `RESOURCE_TYPE_BAND_ORDER` (arbeid, ploeg,
  onderaannemer, materieel, materiaal, kosten) bepaalt de bandvolgorde en de sortering op resourcetype, op het scherm
  en in het rapport Resourcediagram. Sorteren op het vertaalde label zou een uitgedeeld vel in elke taal een andere
  blokvolgorde geven.
- **Een verbroken layout ruimt zichzelf op.** Wijzigt de gebruiker een deel dat een aangezette layout draagt, dan gaat
  de knop uit, en `dropBrokenLayouts` in `layoutPresets.ts` zet de andere delen van die layout die nog de waarde van de
  layout tonen terug naar het herstelpunt, net als bij uitzetten; wat afwijkt blijft staan. Die regel kijkt alleen naar
  het herstelpunt en het beeld van nu, niet naar het beeld vlak voor de wijziging, omdat een sessie ook in een ander
  document kan verbreken: de overlays gelden voor de hele app. Zonder deze opruiming wordt het halve beeld bij de
  volgende klik het nieuwe herstelpunt.
