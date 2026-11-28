# Weergavebediening: keuzes die verrassen

De bediening van layouts, filter, groeperen, sorteren en balkkleuren in `src/components/viewControls/` heeft geen
commentaar meer. Drie keuzes daarin zie je niet aan de code af.

## Gevolgen

- **Het meegeleverde Resourcediagram legt alleen groepering, sortering en relatielijnen vast.** `BUILTIN_LAYOUT_DEFS`
  in `builtinLayouts.ts` geeft het geen kolommen, filter of tijdschaal: het Resourcediagram zelf laat zoom, kolommen
  en filter van wie midden in een overleg schakelt staan (vervangt het een actieve layout met een overlappend deel,
  dan kunnen die wel terug naar hun eerdere stand). Binnen een band sorteert het op start, zoals het
  afdrukrapport Resourcediagram (`resourceGantt.ts`), en de relatielijnen gaan uit omdat een taak met meer resources
  onder meer banden staat.
- **Een layout bewaart een icoonsleutel, geen icoon-id.** `Layout.icon` is een sleutel uit `LAYOUT_ICONS` in
  `layoutIcons.tsx`, zodat een opgeslagen layout een wissel van icoon in de app overleeft.
- **Resourcetype staat in de groepeer- en sorteerlijst, niet in de filterlijst.** `sortFieldList` en `groupFieldList`
  in `fieldCatalog.ts` bieden het aan, `filterFieldList` niet, hoewel de filterkern het veld kan lezen: het is een
  afgeleide indeling van de taken, geen waarde om op te filteren.
