# Stukken van een gesplitste balk slepen

Op een gesplitste balk heeft een sleep twee extra betekenissen, vóór de gewone balksleep. De body van stuk i > 0
stelt de pauze ervóór bij (`setGapLength`; tegen het vorige stuk aan is samenvoegen). De rechterrand van stuk i zet
de lengte van dat stuk (`setWorkLength`), ook bij het laatste stuk, en dan verandert de duur mee. Stuk 0 (body en
linkerrand) en elke ongesplitste balk lopen over de gewone sleep. Zo blijft het verplaatsen van de hele taak bij
stuk 0, en rekent elk oppervlak via `splitEdit.ts` (regel `gantt-splits`).

## Gevolgen

- `prepareSplitDrag` bevriest bij het grijpen de stukkenlijst (`SplitDragContext.pieces0`). Elke beweging rekent
  vanaf die lijst en niet vanaf de vorige beweging, anders maakt terugslepen niets ongedaan. Elke beweging schrijft
  via `setTaskSplits`, de enige schrijfweg voor gebruikerssplits, met de sleutel van het gebaar (ADR 0370).
  Zonder `setTaskSplits` (tests) sleept een gesplitste balk als geheel. Het einde dat `applyTaskSplits` daarbij
  meteen schrijft, is voorlopig (`splitScheduleFinish`); bij een taak in de dagenmaat kan de getekende rand tot F5
  afwijken van het einde dat de solver geeft (knownbug 2348).
- `editableSplitPieces` geeft `null`, en dan sleept de balk als één geheel, als de taak niet splitsbaar is
  (`canSplitTask`; ook een niet-welgevormde importsplit, die alleen-lezen is) of als het aantal getekende stukken
  (`segmentCount`) niet gelijk is aan het aantal werkstukken in de stukkenlijst. Een stukindex zou dan naar het
  verkeerde werkstuk wijzen. Coördinator en sleep gebruiken deze ene functie.
- De as van de stuksleep (`axisKind`) volgt de maat van de taak, met dezelfde keuze als de Gantt-stukken
  (`taskSplitMeasure`): hele werkdagen voor een taak met alleen datums, dagslots in de dagenmaat, anders werkminuten.
  Bij dagzoom valt het grijppunt op het begin van de werkdag onder de muis (`splitWorkdayStart`), voor elke taak met
  momenten.
- De ondergrens (`minimumMinutes`) hangt af van zoom en as. Bij dagzoom op een as met momenten is een pauze ten
  minste één werkdag en loopt een werkstuk ten minste tot de volgende werkdaggrens (`splitWorkdayMinutes`,
  `splitWorkMinimum`, op de dagslot-as `dagslotMinutes`, `dagslotWorkMinimum`). Buiten dagzoom is het op de
  dagslot-as één snapstap, en anders `splitUnitMinutes`: één snapstap bij een urentaak, de werkminuten van een
  werkdag bij een dagtaak. Een pauze die op 0 of minder uitkomt, heft `setGapLength` op.
- De verschuiving heeft een teken: naar links is negatief. `workAxisMinutesBetween` telt alleen vooruit, dus de sleep
  draait de twee momenten om en keert het teken om.
- Een stuksleep kiest geen richting: alleen stuk 0 draagt de verticale rijsleep, zoals een ongesplitste balk
  (ADR 0371). Een voltooide balk heeft geen stukgrepen (ADR 0375).
- Het sleeplabel (`SplitDragLabel`, in `GanttCanvas`) leest de nieuwe lengte uit de uitkomst van `setGapLength` of
  `setWorkLength`, dus gesnapt en geklemd, en niet uit de ruwe muisafstand. Een samengevoegde pauze bestaat niet meer:
  de hook geeft dan 0 door en het label toont `task:split.merged` (*Samenvoegen*). De eenheid is werkdagen, of uren bij een urentaak op de minutenas buiten dagzoom (bij kwartierzoom
  knownbug 2346).
- De browsertests in `tests/browser/task-split.spec.ts` slepen een stuk en een stukrand met de muis, ook het
  samenvoegen tegen het vorige stuk.
