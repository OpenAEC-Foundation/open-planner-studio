# Een werkblok hoort bij de dag waarop het begint

`CalendarEngine` rekent op werkblokken als absolute intervallen op de tijdas (`bandsStartingOn`). Een blok hoort bij
de kalenderdag waarop het begint, ook een nachtblok dat na middernacht doorloopt (einde boven 1440 minuten). Dat is
dezelfde regel als de werkdag van een moment in de spec alleen uren (§0). Een feestdag onderdrukt daarom alleen de
blokken die op die dag beginnen: de staart van het nachtblok van de dag ervoor loopt door (`check-calendar-hours.ts`,
deel E). Overlapt een blok van een dag met de staart van de vorige nacht, dan krijgt die dag alleen het deel dat nog
niet bedekt is (`materializeDayBands`), zodat zo'n uur niet twee keer telt (de gevallen 462 in dezelfde check). Een
start valt in `[begin, einde)`, een eindmoment in `(begin, einde]` (ADR 0014).

## Gevolgen

- Omdat een blok tot twee dagen na zijn begindag kan reiken, kijken `findContaining` en
  `physicalWorkMinutesBetween` twee dagen terug en `workIntervalsBetween` één dag.
- De uitrol per dag zit in een cache op het kalenderobject (`bandCacheRegistry`, een `WeakMap`), niet op de engine.
  Engines op hetzelfde object delen hem (`check-calendar-hours.ts`, deel H); `calendarForEngine` geeft per kalender één
  engineweergave, ook voor een kalender zonder eigen werkblokken.
- `effectiveBandsOn` geeft de blokken van één datum zoals de rekenkern ze ziet: met werkende uitzonderingen,
  feestdagen en de afgesneden nachtstaart, in minuten vanaf het begin van die dag, als verse kopie. De weekdagtabel
  (`workTime.byWeekday`) ziet uitzonderingen en feestdagen niet; `calendarsAgreeOnSharedWorkdayBands`
  (`relationMath.ts`) vergelijkt twee kalenders daarom met `effectiveBandsOn` op één datum.
- Een kalender zonder werktijd na `calendarForEngine` krijgt een week zonder blokken (`EMPTY_WEEK`). Een
  uurmethode vindt daar geen werk in plaats van te falen op een ontbrekende cache. `isHourMode` blijft voor zo'n
  kalender onwaar; is ze de kalender van een taak of van het project, dan stopt `CPMSolver.prepareSolve` met
  `hourTaskWithoutWorkHours`, `taskWithoutWorkHours` of `noWorkingHours`. De naam `isHourMode` blijft omdat het contract `DurationCalendar` (`duration.ts`) hem draagt;
  `hasOwnWorkBlocks` is technische keuze T11 van de spec alleen uren (§3.9).
