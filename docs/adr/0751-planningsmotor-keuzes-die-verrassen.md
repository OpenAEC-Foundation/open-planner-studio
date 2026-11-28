# Keuzes in de planningsmotor die zonder uitleg verrassen

Een paar kleinere keuzes in `src/engine/scheduler/` lijken op het eerste gezicht te streng, te los of te omslachtig,
maar hebben een reden die niet uit de code blijkt. Ze staan hier bij elkaar; de grotere besluiten van de solver staan
in de ADR's 0010 tot en met 0031, die van het oprollen van verzameltaken in ADR 0750.

## Gevolgen

- `splitTotalSpanDays` (`duration.ts`) telt de duur in dagen exact (`durationDaysOf`) en alleen de toeslag van de
  splitgaten als breuk. Minuten terug delen door `hoursPerDay × 60` geeft bij een werktijd als 8,4 uur geen exacte 3
  maar 3,0000000000000004, en dan telt `addWorkDaysChecked` een werkdag te veel.
- `fromSplitPieces` (`splitEdit.ts`) geeft een ongewijzigd gat met zijn oorspronkelijke getallen terug: `(a − b) + b`
  is in floats niet altijd `a`, en alleen kijken mag een bestand niet wijzigen.
- Een kringtoets weigert alleen een kring die de bewerking toevoegt (`detectIntroducedCycle` in `graphWalk.ts`, via
  `relationCycle` en `introducedCycle` in `relationRules.ts`). Een kring die al in het document zat, bijvoorbeeld uit
  een import, blokkeert zo geen bewerking die er niets aan toevoegt.
- `isAncestorRelation` (`relationRules.ts`) volgt `parentId`, de guard van de solver `childIds`. Bij een corrupte boom
  blijven dat twee onafhankelijke vangnetten; de strengste van beide weert de relatie.
- Een taak die handmatig gepland is, mag het eindpunt van het langste pad zijn (`computeScheduleResults` in
  `scheduleAnalysis.ts`), anders dan een hammock: haar einde is een echt anker en geen afgeleide.
- `findLongFreePeriods` (`freePeriods.ts`) waarschuwt alleen voor een lange vrije periode met minstens één dag uit
  `calendar.holidays`. Een periode die alleen uit het weekpatroon bestaat, hoe lang ook, heeft geen uitzondering om
  voor te waarschuwen. De getoonde periode loopt ook buiten de taak door (tot `MAX_EXPAND_SCAN` dagen per richting) en draagt
  alleen de naam van een feestdag die minstens de helft ervan beslaat.
- `buildShiftReport` (`shiftExplanation.ts`) geeft de reden `unknown` als de vorige invoer ontbreekt of het verschil
  niet verklaart. Een gok tonen we niet als feit.
- A17, B3, B4, C1 en C4 staan in elk ingebouwd profiel uit (`CONVENTIONS` in `conventions/registry.ts`): aan of uit
  verandert geen cel van een door P6 doorgerekend bestand; alleen `rehab-2.xer`, P3-uitvoer, droeg ze (ADR 0182).
