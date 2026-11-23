# Een werkende uitzondering wint van een feestdag op dezelfde datum

Een kalender kan een datum vrij maken (`holidays`) en werkend maken (`workingExceptions`). Valt een datum in beide, dan
is hij werkend: in `isWorkDay`, `isHoliday`, `workDaysBetween` en de werkblokken van die dag (`sourceBandsOn`). We
kozen één volgorde voor al die functies, omdat een dag die in de ene werkend en in de andere vrij is, een verkeerde
speling gaf (`check-calendar-hours.ts`, M13 tot en met M18). Een feestdag op een andere datum blijft vrij, ook als de
kalender elders werkende uitzonderingen heeft. `isWorkDay` heeft daarom één feestdagtoets voor kalenders met en zonder
uitzonderingen: met twee takken verdween die toets in één ervan zonder dat een case rood werd (M27 tot en met M29).

## Gevolgen

- Een werkende uitzondering met eigen blokken werkt in die blokken. Zonder eigen blokken krijgt ze de blokken van haar
  weekdag, en heeft die weekdag geen blokken, dan `standardWorkdayBands`. Zonder die laatste stap was een werkende
  zaterdag in een ma-vr-kalender een werkdag zonder werkminuten (M25 en M26).
- `computeStandardWorkdayBands` kiest de werkweekdag met de meest voorkomende minutensom, bij gelijkspel de hoogste som
  en dan de laagste weekdag, zoals `hoursPerDay` de meest voorkomende dagsom kiest (`modalHighest`). Met de eerste
  weekdag met blokken kreeg een werkende zaterdag op een kalender met ma 4 u en di-vr 8 u 240 minuten bij
  `hoursPerDay` 8 (M30 en M31). Beide kiezen hun weekdagen niet op dezelfde manier (knownbug 2003).
- `buildWorkingExceptions` kopieert de blokken van een uitzondering, zodat een latere wijziging van die lijst de engine
  niet raakt. Staat een datum in twee uitzonderingen, dan houdt hij de blokken van de laatste met eigen blokken
  (knownbug 2004).
- `buildHolidaySet` en `buildWorkingExceptions` zijn twee losse lussen van dezelfde vorm. Een gedeelde hulpfunctie
  zou een fout in de ene ook in de andere zetten.
