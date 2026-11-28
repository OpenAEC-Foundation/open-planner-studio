# Tests van datums, werkdagen en CPM: eigen orakels, bronguards en gekozen grenzen

Een paar checks in `tests/planning/` meten de productiecode tegen een eigen referentie die geen code deelt met wat ze
toetsen. Een referentie die de productiecode hergebruikt, maakt dezelfde fout en ziet haar dan niet; een eigen
referentie vangt ook een verkeerde maar consistente implementatie. Vervang zo'n referentie dus niet door de
productiefunctie, ook als dat korter is. Dezelfde regel voor de P6-tests staat in ADR 1240.

## Gevolgen

- `check-workday-axis.ts` rekent werkdag en werkdagindex na met een kale lus over de dagen (`isWorkDayRef`,
  `refWorkdayIndexOfDay`), zonder code uit `workdayAxis.ts` of `CalendarEngine`; `CalendarEngine` dient daar alleen
  voor de aparte consistentiecontrole.
- `check-dagenmaat-lopers.ts` legt de vooruit-loper naast een trage referentieloper die dag voor dag telt
  (`referenceForward`).
- `check-date-format.ts` heeft de oude implementatie van `formatDate` (`toISOString().split('T')[0]`) als orakel
  (`oudFormatDate`). `formatDate` gebruikt UTC-getters. De check hoort in de tijdzonematrix van `run.sh` te blijven:
  lokale getters geven in UTC hetzelfde antwoord en schuiven pas bij een negatieve offset, zoals America/New_York, een
  dag terug.
- `check-date-input-commit.ts` (delen e en f) en `check-advanced-cpm.ts` (08a en 08b) lezen de brontekst van
  `DateTextInput.tsx`, `useDialogKeys.ts` en `TaskCpmResultSection.tsx`. Zo liggen de standaard `commitMode = 'blur'`,
  de enige bestanden die live mogen vastleggen, het latest-callback-patroon in `useDialogKeys` en de gedeelde
  speling-opmaak vast: dat leeft in de React-laag, die de pure functies in die checks niet zien.
- `digest` in `check-advanced-cpm.ts` vergelijkt alleen de planning (vroege en late datums, speling, kritiek,
  kritiek pad, projecteinde, sturende relaties en geschonden constraints), niet de afgeleide analysevelden
  `interferingFloat`, `isNearCritical` en `floatPath`. De byte-identieke vergelijkingen gaan over de planning.
- De rollup-cases van `applyCpmResult` in `check-advanced-cpm.ts` gebruiken waarden die niet samenvallen met wat
  `createDefaultTaskTime` zet (late start gelijk aan de start, speling 0). Anders slagen ze ook als de rollup niet
  draait.
- Deel 8 van `check-workday-axis.ts` vraagt dagindex 150.000. Dat ligt voorbij het vensterplafond van de as
  (`MAX_WINDOW_DAYS`, 50.000 dagen in `workdayAxis.ts`) en onder het plafond van `CalendarEngine` (`MAX_DAYS`,
  200.000), dat de terugval van de as vanaf de epoch telt (`workDaysBetween(EPOCH, …)`). Zo toetst het deel het
  plafond van de as en niet dat van de engine. De delen 6 tot en met 8 bouwen elk een eigen as, zodat een venster dat
  in een uiterste groeide de volgende delen niet raakt.
