# Een werkende uitzondering wint van een feestdag op dezelfde datum

Een kalender kan een datum vrij maken (`holidays`) en werkend maken (`workingExceptions`). Valt een datum in beide,
dan is hij werkend: in `isWorkDay`, `isHoliday`, `workDaysBetween` en bij de keuze van de bronblokken van die dag
(`sourceBandsOn`). We kozen één volgorde voor al die functies, omdat anders `workDaysBetween` een dag aftrekt die
`isWorkDay` werkend noemt. `check-calendar-hours.ts` toetst de eerste drie op een maandag die feestdag en uitzondering
is (M13 tot en met M16, met M17 en M18 als controle zonder uitzondering) en de bronblokken op zo'n zaterdag (M11, met
M12 als controle). Een feestdag op een andere datum blijft vrij, ook als de kalender elders werkende uitzonderingen
heeft. `isWorkDay` heeft daarom één feestdagtoets voor kalenders met en zonder uitzonderingen, zodat twee takken niet
uit elkaar kunnen lopen; M27 toetst `isWorkDay` op een feestdag bij een kalender met een werkende uitzondering op een
andere datum.

## Gevolgen

- De constructor bouwt de werkende uitzonderingen vóór de gesorteerde feestdaglijst (`holidayWorkdayIdxSorted`), en
  die lijst laat een feestdag weg die ook een werkende uitzondering is. Zo trekt de rekenkundige telling (ADR 0220)
  zo'n dag niet af (M15 en M16).
- `sourceBandsOn` kiest voor een werkende uitzondering de bronblokken: haar eigen blokken; zonder eigen blokken die
  van haar weekdag; en heeft die weekdag geen blokken, dan `standardWorkdayBands`. Zonder die laatste stap zou een
  werkende zaterdag in een ma-vr-kalender een werkdag zonder werkminuten zijn (M25 en M26). Welk deel van die blokken
  na de nachtstaart van de vorige dag overblijft, staat in ADR 0222.
- `computeStandardWorkdayBands` kiest uit de weekdagen in `workDays` met blokken die met de meest voorkomende
  minutensom, bij gelijkspel de hoogste som en dan de laagste weekdag (zodat de keuze vastligt als twee weekdagen
  dezelfde som maar andere blokken hebben), zoals `hoursPerDay` de meest voorkomende dagsom kiest (`modalHighest`).
  Met de eerste weekdag met blokken zou een werkende zaterdag op een kalender met ma 4 u en di-vr 8 u 240 minuten
  krijgen bij `hoursPerDay` 8; M30 en M31 toetsen 480 minuten. Heeft geen weekdag in `workDays` blokken, dan neemt de
  functie de eerste weekdag die wel blokken heeft, en anders een lege lijst. `hoursPerDay` en deze functie kiezen hun
  weekdagen niet op dezelfde manier (knownbug 2003).
- `buildWorkingExceptions` kopieert de blokken van een uitzondering, zodat een latere wijziging van die lijst de
  engine niet raakt. Staat een datum in twee uitzonderingen, dan houdt hij de blokken van de laatste met eigen
  blokken. Dat is bewust niet verder afgevangen, omdat de invoer per datum één uitzondering hoort te leveren; waar dat
  niet zo is, staat in knownbug 2004.
- `buildHolidaySet` en `buildWorkingExceptions` zijn twee losse lussen van dezelfde vorm. Een gedeelde hulpfunctie zou
  een fout in de ene ook in de andere zetten.
