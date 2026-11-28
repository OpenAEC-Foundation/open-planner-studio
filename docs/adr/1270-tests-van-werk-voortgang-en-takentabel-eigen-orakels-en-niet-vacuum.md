# Tests van werk, voortgang en de takentabel: eigen orakels, de echte keten en asserties die niet leeg mogen lopen

De checks in `tests/planning/` over de werkregels, de voortgang en het voortgangsblad, de vastgelegde datums, het
minutenmodel en de takentabel halen hun verwachting niet uit de code die ze toetsen, en laten een rondgang door de
echte schrijver en lezer lopen in plaats van door een nagebouwde tussenvorm. Een verwachting die uit de productiecode
komt of een blad dat de test zelf nabouwt, maakt dezelfde fout als de code en ziet haar dan niet. Maak ze dus niet
korter door verwachtingen af te leiden of de keten over te slaan.

## Gevolgen

- `check-progress-entry.ts` schrijft "vandaag" (de lokale kalenderdag) zelf uit en importeert `localTodayIso` niet:
  de check toetst juist die dag.
- `check-task-slice.ts` zet de taak op 5 januari 2015. Een terugval op vandaag kan daar niet toevallig de verwachte
  datum geven.
- `check-progress-import.ts` deel 5 zet de percentages als tekst in een blad en leest ze met `sheetFromText` en
  `finalizeProgressRows`, niet als handgebouwde `ProgressRow`. Uit "33,4" komt 0.33399999999999996 en niet 0.334, en
  `isCompletionUnchanged` moet met de waarde van de lezer kloppen. `sheetFromText` loopt langs de gedeelde
  kolomherkenning (`sheetColumns.ts`) maar slaat de bestandslezer over; de echte lezer van een `.xlsx` toetst
  `check-progress-import-xlsx.ts`.
- `check-progress-import-xlsx.ts` toetst de rondgang op de echte `writeProgressSheetXLSX`. De handgebouwde bladen
  daar dekken vormen die die schrijver niet maakt (een percentage als fractie met percentage-opmaak, gedeelde
  strings, een foutcel). De kopteksten van de export staan er als vaste tekst (`EXPORT_TEXT`): de check draait
  zonder i18n, en de rondgang mag niet van een vertaalsleutel afhangen.
- `check-progress-sheet-middernacht.ts` past het teruggelezen blad toe op de taak zonder voortgang (`pasToe`). Tegen
  de al voltooide taak zou de vergelijking een verloren tijdstip als ongewijzigd zien.
- `check-progress-xlsx-writer.ts` schrijft de verwachte volgorde van de elementen, de minimale aantallen, de
  polariteit van `sheetProtection` en de `_xHHHH_`-notatie letterlijk uit en leest ze niet terug uit
  `buildProgressXlsxParts`. Die verwachtingen komen uit ECMA-376 (Office Open XML) en uit wat de invuller op zijn
  scherm hoort te zien.
- `check-minute-model-examples.ts` leest de voorbeelden uit `fixtures/minute-model-examples-f0/`, zoals ze vóór het
  minutenmodel waren (zonder `OPS_Project.TimeModel`). Zo toetst hij dat een oud bestand door de migratie op de
  laadgrens gaat. Vervang die bestanden niet door de huidige `public/examples/`. De snapshot werk je alleen bij met
  `OPS_MINUTE_MODEL_EXAMPLES_UPDATE=1`.
- `check-recorded-bak4-differential.ts` bundelt de vier lezers twee keer, de tweede keer met de vastlegging
  uitgezet door tekstvervanging in de bron (`OFF_MUTATIONS`). Elke vervanging moet precies één keer raken, zodat
  een verbouwde lezer de check niet stil laat slagen. Esbuild laadt hij via een import op een berekende naam
  (`esbuildName`); een letterlijke import zou esbuild in de checkbundel trekken.
- Asserties die anders niets meten: `check-recorded-dates-mark.ts` toetst een ontbrekende functie met `=== undefined`
  en niet met `eq`, want `eq` vergelijkt via `JSON.stringify`, en dat geeft ook voor een functie `undefined`. `near`
  in `check-work-triangle.ts` keurt af met `!(verschil <= tol)`, zodat NaN rood is. `check-task-tree.ts` toetst een
  negatieve index met −1: `splice` zet −5 op een lijst van twee zelf al op 0, en dan meet de case de klem niet.
  `check-uren-zonder-spatie.ts` vergelijkt de lagparser met een vaste waarde en niet de twee invoervormen met
  elkaar, zodat twee keer `null` niet slaagt.
- Broncontroles: `check-recorded-dates.ts` §11 zoekt `src/` naast de bundel en vanuit de werkmap, en is rood als hij
  `src/` niet vindt of minder dan honderd bestanden leest; een controle die zichzelf overslaat, bewaakt niets.
  `check-task-tree.ts` zoekt in `taskSlice.ts` op de vorm van de losmaaktoewijzing (`x.childIds = x.childIds.filter(`)
  en niet op een functienaam: een ingeplakte kopie gedraagt zich hetzelfde, dus alleen de bron laat haar zien.
- `check-task-grid-clipboard.ts` legt vast dat een plak van een kalender plus een duurtekst gelijk aan de getoonde
  alleen de kalender schrijft: de duur blijft 5 d onder de nieuwe kalender van 4 u per dag. De duur is een dagenteller
  op de kalender van de taak; de 2400 minuten van de oude kalender omrekenen naar de nieuwe zou 10 d geven, een getal
  dat de gebruiker niet typte.
