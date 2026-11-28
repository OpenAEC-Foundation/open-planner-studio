# Weergavebediening: keuzes die verrassen

De bediening van layouts, filter, groeperen, sorteren en balkkleuren in `src/components/viewControls/` heeft geen
commentaar meer. Drie keuzes daarin zie je niet aan de code af.

## Gevolgen

- **Het meegeleverde Resourcediagram legt alleen groepering, sortering en relatielijnen vast.** `BUILTIN_LAYOUT_DEFS`
  in `builtinLayouts.ts` geeft het geen kolommen, filter of tijdschaal, zodat wie midden in een overleg naar het
  resourcediagram schakelt zijn zoom, kolommen en filter houdt. Binnen een band sorteert het op start, zoals het
  afdrukrapport Resourcediagram (`resourceGantt.ts`), en de relatielijnen gaan uit omdat een taak met meer resources
  onder meer banden staat.
- **Een layout bewaart een icoonsleutel, geen icoon-id.** `Layout.icon` is een sleutel uit `LAYOUT_ICONS` in
  `layoutIcons.tsx`, zodat een opgeslagen layout een wissel van icoon in de app overleeft; `layoutIcon` valt bij een
  onbekende sleutel terug op het standaardicoon.
- **Resourcetype staat in de groepeer- en sorteerlijst, niet in de filterlijst.** `sortFieldList` en `groupFieldList`
  in `fieldCatalog.ts` bieden het aan, `filterFieldList` niet, hoewel de filterkern het veld kan lezen: het is een
  afgeleide indeling van de taken, geen waarde om op te filteren.
