# De kalender telt werkdagen rekenkundig, met de uitkomst van de daglus

`CalendarEngine` telde werkdagen dag voor dag; dat was de grootste kostenpost van elke berekening en van de
nivelleerder (audit 2026-09-26). `workDaysBetween` telt daarom per bereik: de werkdagen van het weekpatroon, min de
feestdagen op een werkweekdag, plus de werkende uitzonderingen op een niet-werkweekdag. `offsetOfNthWorkday` zoekt
met dezelfde telling de n-de werkdag voor `addWorkDaysChecked`, `subtractWorkDays` en `addWorkingDaysSigned`, en voor
de dagenmaat (`nthMeasureWorkday`, alleen als `measureLikeWorkDays` waar is). We kozen voor dezelfde uitkomst als de
daglus op `isWorkDay`, niet voor een eigen definitie: geeft `offsetOfNthWorkday` in die drie dagfuncties `null` (een
niet-eindig aantal, een ongeldige datum, of geen antwoord binnen `MAX_DAYS`), dan loopt de oude lus, met haar
afkapgedrag. `check-calendar-arith.ts` legt de drie dagfuncties naast
een letterlijke kopie van de oude lussen, voor willekeurige kalenders met feestdagen en werkende uitzonderingen en
voor breuken, negatieve en grote aantallen, NaN en oneindig.

## Gevolgen

- De constructor bouwt de werkende uitzonderingen vóór de gesorteerde feestdaglijst (`holidayWorkdayIdxSorted`), en
  die lijst laat een feestdag weg die ook een werkende uitzondering is. Anders noemde `isWorkDay` zo'n dag werkend en
  trok `workDaysBetween` hem toch af (`check-calendar-hours.ts`, M15 en M16). Een werkende uitzondering op een
  werkweekdag staat niet in `workingExceptionOnNonWorkWeekdayIdxSorted`, omdat het weekpatroon hem al telt (M20 tot
  en met M24).
- Twee grenzen houden een kapotte kalender (geen werkdagen) of een ongeldige datum uit een eindeloze lus: `MAX_SCAN`
  (366 dagen zoeken naar een werkdag) en `MAX_DAYS` (200.000 dagen tellen); `MAX_MINUTES` is `MAX_DAYS` in minuten
  voor de minutenwandeling. `addWorkDaysChecked` en `addMeasuredWorkdaysChecked` melden het raken van een grens als
  `capped`; de solver neemt dat van `addMeasuredWorkdaysChecked` over in `cappedTaskIds`, en `importDates.ts` laat bij
  `capped` van `addWorkDaysChecked` de datum leeg.
- `workIntervalsBetween` begrenst op `MAX_DAYS` en niet op `MAX_SCAN`: een urentaak van meer dan een jaar werd anders
  afgekapt getekend. De Gantt vraagt alleen het zichtbare venster op (`GanttRenderer`).
- `addWorkDays` telt de begindag als dag 1 en geeft de laatste werkdag; `addWorkingDaysSigned` is een zuivere
  verschuiving, waarbij 0 dezelfde werkdag is (`check-calendar-hours.ts`, I4 en I10). De tweede is nodig voor lag en
  lead, waar "n werkdagen verder" precies n moet zijn. `addWorkingDaysSigned` zet een begindatum die geen werkdag is
  eerst vooruit naar `nextWorkDay` (knownbug 2005).
