# Een werkblok hoort bij de dag waarop het begint

`CalendarEngine` rekent op werkblokken als absolute intervallen op de tijdas (`bandsStartingOn`). Een blok hoort bij
de kalenderdag waarop het begint, ook een nachtblok dat na middernacht doorloopt (einde boven 1440 minuten). Dat is
dezelfde regel als de werkdag van een moment in de spec alleen uren (§0). Een feestdag zonder werkende uitzondering op
dezelfde datum (ADR 0221) onderdrukt daarom alleen de blokken die op die dag beginnen: de staart van het nachtblok van
de dag ervoor loopt door (`check-calendar-hours.ts`, deel E). Overlapt een blok van een dag met de staart van de
vorige nacht, dan krijgt die dag alleen het deel dat nog niet bedekt is (`materializeDayBands`), zodat zo'n uur niet
twee keer telt (de gevallen 462 in dezelfde check). `measureLikeWorkDays` (ADR 0224) gebruikt dezelfde afsnijding,
zodat de snelle dagtelling dezelfde dagblokken toetst als de uitrol. Een start valt in `[begin, einde)`, een
eindmoment in `(begin, einde]` (ADR 0014).

## Gevolgen

- De engine gaat ervan uit dat een blok uiterlijk 2880 minuten na het begin van zijn begindag eindigt
  (`prevBandEndBound`). Daarom kijken `findContaining` en `physicalWorkMinutesBetween` twee dagen terug en
  `workIntervalsBetween` één dag.
- De uitrol per dag zit in een cache op het kalenderobject (`bandCacheRegistry`, een `WeakMap`), niet op de engine.
  Engines op hetzelfde object delen hem (`check-calendar-hours.ts`, deel H); `calendarForEngine` geeft per kalender
  één engineweergave, ook voor een kalender zonder eigen werkblokken.
- `effectiveBandsOn` geeft de blokken van één datum zoals de rekenkern ze ziet: met werkende uitzonderingen,
  feestdagen en de afgesneden nachtstaart, in minuten vanaf het begin van die dag, als verse kopie, en een lege lijst
  op een dag zonder werkblokken. De weekdagtabel (`workTime.byWeekday`) ziet uitzonderingen en feestdagen niet;
  `calendarsAgreeOnSharedWorkdayBands` (`relationMath.ts`) vergelijkt twee kalenders daarom met `effectiveBandsOn` op
  één datum.
- Een opgeslagen `workTime` met zeven lege weekdagen en een ontbrekende `workTime` zijn twee gevallen. Het eerste
  geeft `isHourMode` waar. Bij het tweede (geen `workTime` en geen geldige begin, einde en uren per dag, zodat
  `calendarWithEffectiveWorkTime` niets geeft) vult de engine een week zonder blokken in (`EMPTY_WEEK`), zodat een
  uurmethode geen werk vindt in plaats van te falen op een ontbrekende cache; `isHourMode` blijft dan onwaar,
  `proposeTaskDurationConversion` (`taskDurationInput.ts`) geeft dan geen voorstel en `hourTaskInputFinish`
  (`taskDefaults.ts`) geen einde, behalve bij kalendertijd. In beide gevallen geeft een werkende uitzondering met
  eigen blokken nog werktijd (in een proef 480 minuten op die dag). Welke fout een berekening met zo'n kalender geeft,
  en in welke volgorde (onder meer `noWorkingDays` voor een projectkalender zonder `workDays` vóór de fouten over
  werkuren), staat in `CPMSolver.prepareSolve`. De naam `isHourMode` blijft omdat het contract `DurationCalendar`
  (`duration.ts`) hem draagt; `hasOwnWorkBlocks` is technische keuze T11 van de spec alleen uren (§3.9).
