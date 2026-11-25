# Een balksleep is één bewerking

Een sleep op een Gantt-balk (`useBarDrag`) schrijft bij elke muisbeweging naar de taak, zodat de balk onder de muis
meeloopt. Voor de planner is het toch één handeling: één stap in Ongedaan, en Escape zet alles terug. We kozen
daarom voor één samenvoegsleutel per gebaar en één bewerksessie per gebaar, en niet voor één schrijfactie bij het
loslaten: dan zou de balk tijdens het slepen niet de echte uitkomst van de store tonen.

## Gevolgen

- Elk gebaar krijgt bij het grijpen een eigen sleutel uit een teller die alleen oploopt (`bardrag:<taakId>:<n>`,
  bij een stuksleep `splitdrag:<taakId>:<n>`). Alle schrijfacties van het gebaar gebruiken die sleutel en vloeien
  samen tot één undo-stap; twee opeenvolgende gebaren vloeien nooit samen, ook niet binnen dezelfde milliseconde.
- Wat bij het gebaar hoort (de sleutel, de richtingskeuze, de laatst toegepaste verschuiving, de startregel, de
  vergrendeling door werkelijke datums, de mijlpaalkant, de meeschuivende mijlpalen en de bewerksessie) staat in
  refs en niet in variabelen van het effect. Het effect herstart midden in een sleep, onder meer omdat
  `effectiveCalById` na elke geschreven `updateTask` een nieuwe identiteit krijgt. Een variabele van het effect zou
  dan terugvallen op haar beginwaarde: een tweede richtingskeuze halverwege, of dezelfde verschuiving die na de
  herstart nog een keer geschreven wordt. Alleen `startBarDrag` zet deze refs terug.
- De bewerksessie (`historyMark` in `historySlice`) opent pas bij de eerste schrijfactie van het gebaar, zodat
  eerdere bewerkingen erbuiten vallen. Loslaten sluit haar (`endHistorySession`). Escape draait haar terug met
  `revertHistorySince`; dat is geen undo, dus er blijft geen redo-stap over, en ook de constraint en wat een
  schrijfactie verder wiste (zoals nivelleerpauzes) komen terug. Escape luistert in de capture-fase met
  `stopImmediatePropagation`, net als de rijsleep (`useTableRowDrag`) en de kaderselectie (`useBoxSelect`), omdat
  de globale Escape-sneltoets anders de selectie wist. De click na zo'n afgebroken gebaar wordt ingeslikt
  (`suppressClickRef`).
- Een documentwissel midden in het gebaar stopt het zoals loslaten, zonder meldingen: wat al geschreven was, blijft
  in het startdocument als één undo-stap. Terugdraaien zoals Escape kan daar niet, want `revertHistorySince` werkt
  op het actieve document en dat is dan het nieuwe (review #1004, ronde 11). Unmount midden in een gebaar sluit de
  sessie ook, anders zou een open sessie latere bewerkingen blijven merken.
- Zolang er een sleep loopt, houdt het gebaar Automatisch berekenen vast (`holdAutoCalc` uit `state/editHold.ts`):
  een berekening midden in het gebaar laat de balk onder de muis verspringen. Het effect laat de rem ook los bij een
  afgebroken gebaar of unmount. Wanneer een verdwenen taak de sessie laat hangen, staat in knownbug 586.
- De browsertests in `tests/browser/gantt-drag-undo.spec.ts` slepen met echte muisgebaren en controleren dat Ctrl+Z
  na een bodysleep precies één handeling terugneemt, dat een randsleep de undo-diepte met één verhoogt, en dat na
  Escape de tijdvelden en de constraint van een gesleepte balk en mijlpaal weer gelijk zijn aan die bij het grijpen.
