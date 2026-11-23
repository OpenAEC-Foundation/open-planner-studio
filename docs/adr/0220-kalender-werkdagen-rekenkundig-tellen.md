# De kalender telt werkdagen rekenkundig, met de uitkomst van de daglus

`CalendarEngine` telde werkdagen dag voor dag; dat was de grootste kostenpost van elke berekening en van de
nivelleerder (audit 2026-09-26). `workDaysBetween` telt daarom per bereik: de werkdagen van het weekpatroon, min de
feestdagen op een werkweekdag, plus de werkende uitzonderingen op een niet-werkweekdag (welke dag werkend is bij een
feestdag en een uitzondering op dezelfde datum: ADR 0221). Het bereik loopt vanaf het oorspronkelijke tijdstip van
`start` in stappen van 24 uur (UTC-dagen) zolang de stap niet voorbij `end` komt, met hoogstens `MAX_DAYS + 1` dagen;
ligt `end` vóór `start`, of is een van beide ongeldig, dan is de uitkomst 0. Ma 16:00 tot di 08:00 is daardoor één
werkdag en ma 08:00 tot di 08:00 twee. `offsetOfNthWorkday` zoekt met dezelfde telling de n-de werkdag voor
`addWorkDaysChecked`, `subtractWorkDays` en `addWorkingDaysSigned`, en voor de dagenmaat (`nthMeasureWorkday`, alleen
als `measureLikeWorkDays` waar is). We kozen voor dezelfde uitkomst als de daglus op `isWorkDay`, niet voor een eigen
definitie: geeft `offsetOfNthWorkday` in die drie dagfuncties `null` (een niet-eindig aantal, een ongeldige datum, of
geen antwoord binnen `MAX_DAYS`), dan loopt de oude lus, met haar afkapgedrag. `check-calendar-arith.ts` legt de drie
dagfuncties naast een letterlijke kopie van de oude lussen, voor willekeurige kalenders met feestdagen en werkende
uitzonderingen en voor breuken, negatieve en grote aantallen, NaN en oneindig.

## Gevolgen

- Een werkende uitzondering op een werkweekdag staat niet in `workingExceptionOnNonWorkWeekdayIdxSorted`, omdat het
  weekpatroon haar al telt (`check-calendar-hours.ts`, M20 tot en met M24).
- Twee grenzen houden een kapotte kalender (geen werkdagen) of een ongeldige datum uit een eindeloze lus: `MAX_SCAN`
  (366 dagen zoeken naar een werkdag) en `MAX_DAYS` (200.000 dagen tellen); `MAX_MINUTES` is `MAX_DAYS` in minuten:
  `walkMs` kort een langere duur daartoe in. `addWorkDaysChecked` en `addMeasuredWorkdaysChecked` melden het raken van
  een grens als `capped`, en de datum is dan niet betekenisvol; de solver neemt dat van `addMeasuredWorkdaysChecked`
  over in `cappedTaskIds`, en `importDates.ts` laat bij `capped` van `addWorkDaysChecked` de datum leeg.
- `workIntervalsBetween` begrenst op `MAX_DAYS` en niet op `MAX_SCAN`: met `MAX_SCAN` werd een urentaak van meer dan
  een jaar afgekapt getekend. De Gantt vraagt alleen het zichtbare venster op (`GanttRenderer`).
- `addWorkDays` telt de begindag als dag 1 en geeft de laatste werkdag; `addWorkingDaysSigned` is een zuivere
  verschuiving, waarbij 0 dezelfde werkdag is. `check-calendar-hours.ts` toetst `addWorkDays(ma, 5)` = vr (I4) en
  `addWorkingDaysSigned(ma, 3)` = do (I10). De solver gebruikt de tweede onder meer voor een nivelleervertraging in
  hele dagen (`shiftByLevelingDelay`). `addWorkingDaysSigned` zet een begindatum die geen werkdag is eerst vooruit naar
  `nextWorkDay` (knownbug 2005).
