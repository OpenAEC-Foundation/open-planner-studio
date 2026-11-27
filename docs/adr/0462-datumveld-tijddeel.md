# Het datumveld bewerkt alleen het datumdeel van een datum met tijd

Een taak op een kalender met werktijden draagt een datum met tijd, zoals `2027-05-13T07:00`. Het datumveld
(`DateTextInput`, ADR 0460) bewerkt alleen de datum. `splitDateValue` scheidt een waarde in het datumdeel
(`YYYY-MM-DD`) en wat erachter staat vanaf de `T`; de vakjes tonen het datumdeel (`isoToSegments`). Bij een write
vergelijkt `dateCommitValue` met het datumdeel van `value`, en een echte wijziging krijgt het oorspronkelijke tijddeel
terug (`2027-05-17T07:00`). Zo maakt wie zo'n veld onaangeroerd verlaat geen wijziging en geen undo-stap. Een tijd
invoeren doet dit veld niet; voor de taakdatums zet `TaskDateTimeInput` er een tijdveld naast
(`check-f4b-datuminvoer.ts`).

## Gevolgen

- `dateCommitValue` brengt `''` alleen naar buiten als `value` een datumdeel had; een leeg of onleesbaar veld dat
  onaangeroerd blijft, schrijft geen `''`. Een waarde die niet `YYYY-MM-DD` is, met hoogstens een deel erachter dat
  met `T` begint, toont lege vakjes.
- Dezelfde regel geldt bij het afronden, bij plakken en bij een kalenderkeuze: alle drie gaan door
  `dateCommitValue`. Blok *g* van `tests/planning/check-date-input-commit.ts` bewaakt de splitsing, het onaangeroerd
  verlaten, het teruggezette tijddeel (ook met seconden) en de lege gevallen, en rendert het veld voor een datum met
  tijd.
- Een geplakte datum met tijd leest de parser niet als datum: knownbug 2501.
