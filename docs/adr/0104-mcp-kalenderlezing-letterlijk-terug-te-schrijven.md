# Een lezing van planner_get_calendars is terug te schrijven, op de IFC-bronklokken na

`planner_get_calendars` geeft de hele `WorkCalendar` plus drie afgeleide velden, bedoeld om een kalender in een ander
document te herbouwen. `planner_update_calendar` neemt die leesvorm daarom aan, ook `workTime`, `shift`,
`generation`, `workingExceptions` en de pauzevelden; anders bouwt een uurkalender in het doeldocument stil op als
dagkalender. Waar de namen verschillen, volgt de schrijfkant de leeskant en niet andersom: `generation` is het
opgeslagen veld (`WorkCalendar.generation`, het reist mee door IFC), en de leeskant hernoemen zou over het model
liegen.

## Gevolgen

- Overdraagbaar zijn `name`, `description`, `workDays`, `workStartHour`, `workEndHour`, `hoursPerDay`,
  `simpleBreakStartMinute`, `simpleBreakDurationMinutes`, `workTime`, `shift`, `workingExceptions`, `holidays` en
  `generation`. Mee mogen, maar zonder effect, de velden van de lijst hieronder. `ifcTimePeriods` (de klokken van een
  geopende IFC met tijdzone of fijnere bronprecisie) staat op geen van beide lijsten: een lezing van zo'n kalender
  wordt met `unknown field` geweigerd en maakt of wijzigt niets, los en in een batch (knownbug 1969). Een agent moet
  dat veld weglaten. De tool zet `ifcTimePeriods` nooit en laat het veld op een bestaande kalender staan.

- `generate` en `generation` bestaan naast elkaar en betekenen iets anders. `generate` is een actie: draai de
  generator over de spanne van dit project. `generation` schrijft alleen de herkomst van de dagen die meekomen. Samen
  zijn ze tegenstrijdig en worden ze geweigerd. Een sleutel van de generator (`country`, `bouwvak`) in `generation`
  krijgt een weigering die de namen van de leesvorm noemt.
- `holidays` (de leesvorm) zet de lijst exact. Samenvoegen zou bij aanmaken de standaardfeestdagen met de bronlijst
  vermengen. Daarom niet samen met `rawHolidays`, `holidaysMode` of `generate`. Komt `generation` mee, dan blijft de
  kalender gegenereerd; anders is de overgezette lijst letterlijk.
- `rawHolidays` voegt toe (samenvoegen zonder dubbele dagen, `resolveCalendarHolidays`); met `holidaysMode: "replace"`
  wordt de lijst precies de opgegeven dagen, ook leeg. Die vervangmodus staat in de tool en niet in
  `calendarGenerate.ts`, omdat `generate` al vervangt en alleen het pad zonder generator een vervangvariant nodig had.
  Een lege `rawHolidays` in de toevoegmodus verandert niets en wordt geweigerd: dat stuurt een agent die een feestdag
  wil verwijderen.
- Krijgt een gegenereerde kalender rauwe dagen of een vervangen lijst, dan vervalt `generation` en meldt de rij
  `becameLiteral`; anders brengt een latere regeneratie de gewiste dagen terug. Een meegestuurde `generation` (ook
  `null`) gaat voor wat de feestdagafhandeling daaruit afleidde.
- De afgeleide leesvelden (`isProjectDefault`, `usedByTasks`, `usedByResources`) en de herkomststempels
  (`libraryOrigin`, `p6Source`, `p6NonWorkPenaltyDates`, `p6NonWorkPenaltyDatesState`) mogen meekomen, schrijven niets
  en staan per rij in `ignoredFields`. Ze gaan over het brondocument; overnemen zou in een ander document een
  bibliotheekkoppeling of XER-herkomst vervalsen, die alleen de bibliotheek en de XER-lezer zetten. Ze staan niet in het
  schema; omdat de items geen `additionalProperties: false` hebben, blijft een teruggestuurde lezing geldig. Een item
  met alleen zulke velden verandert niets en wordt geweigerd. Elke andere onbekende sleutel wordt geweigerd met de
  lijst van wat wel mag.
- Per item: een id uit de bibliotheek wordt gewijzigd. Het id van de projectkalender die nog niet in de bibliotheek
  staat (op een vers document bestaat die alleen als `s.calendar`), wordt eerst opgenomen
  (`ensureProjectCalendarInLibrary`, dat alleen toevoegt, zonder undo-stap of herberekening) en de rij meldt
  `promoted`. Een onbekend id met `create: true` wordt aangemaakt met een nieuw id van dit document (`requestedId`
  naast `id`); zonder `create` volgt een zachte weigering. Kalender-id's gelden per document.
- Een nieuwe kalender begint bij `createNewCalendar`, dezelfde basis als de knop + in de kalenderdialogen. In
  bouwmodus, de standaard, draagt die de Nederlandse feestdagen met `generation`. Zonder feestdagvelden erft een
  nieuwe kalender die; de rij meldt `holidaysFrom: "app-default"` en het antwoord waarschuwt. `holidays: []` of
  `generate: { country: "none" }` geeft een kalender zonder feestdagen.
- De spanne van `generate` loopt bij wijzigen tot het latere van het ingevoerde en het berekende projecteinde. Bij
  aanmaken geeft de tool bewust geen einde mee, zodat de spanne voor aanmaken geldt (startjaar min 1 tot en met
  startjaar plus 3) en niet een einddatum die nog niets met de nieuwe kalender te maken heeft.
