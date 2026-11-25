# De modus zet de vastlegging terug in de taken en wist wat de verworpen berekening schreef

Bij het laden rekent de app eerst; gaat het document daarna in "datums zoals opgeslagen", dan moeten de taken weer
tonen wat het bestand zei. `applyRecordedTimesToTasks` (`src/engine/scheduler/recordedDates.ts`) schrijft de
vastlegging in place in `task.time` en geeft `cpmResultFromRecorded` op de bijgewerkte taken terug (ADR 0331,
`check-recorded-dates.ts` 3s). Ze heeft twee aanroepers: `enterRecordedDatesMode` (`documentActivation.ts`, voor
de laadroute en voor slapende herstelde documenten) en `minuteModelTransition`, voor de vóór-toestand van de
minutenomzetting. Een taak zonder record blijft onaangeroerd, op de stappen hieronder voor verzameltaken na.

## Gevolgen

- De velden van `TaskTimeComputed` zijn verplicht (ADR 0300), dus de functie schrijft dezelfde terugvallen als
  ADR 0331: de late datum is de vroege, speling 0, niet kritiek. "Niet vastgelegd" staat alleen in het record
  (`times[id].lateStart === undefined` enzovoort); `recordedDatesSelectors.ts` leest dat voor de taaktabel
  (`unrecordedAxes`) en de uitgangen (`unrecordedExportGate`). Dat de velden optioneel maken renderer, taakraster,
  rapport, MCP en export zou raken, komt uit het weggehaalde commentaar.
- De spelingminuten worden de waarde uit het record of `undefined`, zonder terugval. De verworpen berekening schreef
  eigen minuten, en die naast de dagen uit het bestand gaven een tegenstrijdige speling die opslaan vastlegt
  (aanval na #600, a05; `docs/ifc-round-trip.md`, Speling; `check-recorded-dates.ts` §19).
- Een record met `summaryProgress` zet via `writeSummaryProgress` voortgang, status en werkelijke datums van de
  verzameltaak terug; een werkelijke datum die het record niet draagt, wordt daarbij gewist. De berekening bij het
  laden leidde die waarden uit de bladen af (ADR 0300).
- Een hammock met `hammockDuration` krijgt `scheduleDuration`, `durationUnit` en `durationMinutes` uit het record
  terug, ook een `durationMinutes` van `undefined`. De berekening overschrijft de duurbron van een hammock met haar
  span (ADR 0023); het record is een kopie van vóór die berekening (`captureHammockDuration`).
- Verzameltaken zonder eigen record rollen op uit hun kinderen met `rollupSummaryTasks`, met `skip` voor taken met
  een record en `projectCalendar` voor de afgeleide duur, zonder `progressCalendars`, dus zonder voortgangsrollup.
  Anders hield een fasebalk de datums van de verworpen berekening. De rollup leest de terugvallen van de kinderen als
  hun waarden. Een handmatige fase (`manuallyScheduled`) houdt daarbij haar eigen plandatums en duur. Een
  verzameltaak met eigen record (de IFC-route) blijft zoals het bestand haar gaf (`check-recorded-dates.ts` §15).
  Dat P6 alleen op TASK-rijen een vastlegging schrijft en een WBS-rij er dus nooit een heeft, komt uit het
  weggehaalde commentaar. Een fase zonder record krijgt, wat haar afgeleide speling ook is, geen markering *Niet
  vastgelegd* (`unrecordedAxes` geeft zonder record niets). Het projecteinde telt alleen taken met een record, de
  rollup van een fase alle kinderen, dus een fase kan later eindigen dan het projecteinde (knownbug 2328, issue #1231).
- `interferingFloat`, `isNearCritical` en `floatPath` worden gewist op elke taak met record en op elke taak die geen
  blad is en geen record heeft: ze komen uit de verworpen berekening (`check-recorded-dates.ts` 3ab tot en met 3ad, op
  een blad met record). Op een fase zonder record bewijst 15c alleen het wissen van `interferingFloat`: daar
  begint de fase met `isNearCritical` en `floatPath` al op `undefined`. `applyCpmResult` zet `isNearCritical` en
  `floatPath` op dezelfde manier op `undefined` als een resultaat ze niet draagt (ADR 0300).
