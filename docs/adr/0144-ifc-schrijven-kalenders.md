# Hoe de IFC-writer kalenders schrijft

De werkweek per groep, de klokprecisie en de bronklokken, `HoursPerDay`, `IsHourCalendar = .F.` bij een dagkalender
met een afwijkende periode en de werkende uitzonderingen staan in `docs/ifc-round-trip.md` (*Kalenders: werkblokken per
weekdag*, *Uren per dag bij een blokkenkalender*, *Werkende kalenderuitzonderingen na vernummering*); dat is het
contract. De lezerkant staat in ADR 0043. Hier staan de keuzes van de writer die daar niet staan. Het doel is dat een
kalender na heropenen dezelfde kalender is, ook voor de oudere OPS-lezers die sinds H7 `OPS_Calendar` lezen. Een deel
van de eigenschappen in `OPS_Calendar` (`HoursPerDay`, `WorkStartHour`, `WorkEndHour`) staat er alleen als de lezer
zonder die eigenschap een andere waarde zou afleiden; andere zijn een markering die er staat zodra hun voorwaarde
geldt, zoals `IsHourCalendar = .T.` bij elke uurkalender.

## Gevolgen

- De writer schrijft de projectkalender als eerste `IFCWORKCALENDAR`; zo onderscheidt de lezer hem van de
  bibliotheekkalenders. `writeCalendarLibrary` krijgt de bibliotheek zonder de kalender met `project.calendarId`, die
  als projectkalender al geschreven is.
- Een bibliotheekkalender krijgt twee aparte `IFCRELASSIGNSTOCONTROL`: één naar de resources en één naar de taken die
  hem gebruiken, omdat de lezer resources en taken via hun eigen STEP-id-kaart uit elkaar houdt. Zonder resources of
  zonder taken valt die relatie weg. Een kalender met het id `NaN` (beschadigde invoer) krijgt zijn kalender en
  metadata, maar geen relaties, zoals de oude vergelijking met `===` deed.
- `WorkStartHour` en `WorkEndHour` (elk alleen bij een eindige waarde) staan er als de eerste periode die de writer
  werkelijk schrijft ze niet teruggeeft zoals een oudere lezer die leest: van de klok alleen het getal vóór de eerste
  `:`, en bij meer periodes het begin afgerond naar beneden (`readerScalarHours`). Het hangt dus af van de klokvorm
  die er komt te staan. Een begin van 07:30 in de huidige vorm `07:30:00` geeft 7 en krijgt `WorkStartHour`; blijft een
  ongewijzigde oude bronklok `7.5:00:00` staan, dan geeft die 7,5 terug en komt er geen `WorkStartHour`. Bij meer dan
  één geschreven weekgroep staan ze er wel. Een kalender die nog de oude scalar van het eerste blok draagt (08:00 tot
  12:00 bij blokken 08 tot 12 en 13 tot 17), krijgt geen `WorkEndHour` en leest daarna als 8 tot 17.
- Een uurkalender krijgt altijd `IsHourCalendar = .T.`: één band van 08:00 tot 16:00 is in IFC niet te onderscheiden
  van een dagkalender met die uren. Een scalaire kalender krijgt `IsHourCalendar = .F.` als de writer haar effectieve
  blokken uitschrijft (de kalender is letterlijk, of de merge gaf haar als bronvorm mee, ADR 0146) of als de lezer de
  ene geschreven periode als afwijkend zou zien. Een pauzepatroon (`SimpleBreakStart`, `SimpleBreakDuration`) staat er
  alleen bij een scalaire kalender, en alleen als het gezet is. Geldt geen enkele voorwaarde, dan geen `OPS_Calendar`.
- Een blok over middernacht schrijft de writer met zijn einde als tijd van de dag; de lezer herkent de omloop aan een
  einde op of vóór het begin. Een blok dat precies om middernacht eindigt, eindigt op `24:00:00` (`minutesToClock` met
  `endOfDay`); oudere bestanden met `00:00:00` leest de omloopregel nog. Een ongewijzigde bronklok kan een andere vorm
  houden (contract hierboven).
- De groepen (`weekBandGroups`) nemen de dagen uit `workDays`. Een werkdag zonder eigen blokken krijgt die van de
  eerste werkdag, zodat een kalender die vóór de groepen verliesloos was één groep blijft. Twee dagen zitten in
  dezelfde groep als hun blokken, op begin gesorteerd, en hun bronklokken gelijk zijn.
- Een groep werkdagen zonder blokken krijgt bij meer groepen geen `IFCWORKTIME`: een WEEKLY-patroon zonder
  `TimePeriods` betekent in IFC de hele dag.
- De labels van de werkweken zijn Engels (`Standard work week`, met de dagen erbij bij meer groepen): ze staan in
  elk bestand, ongeacht de taal van de app. De lezer leest de naam van een werkweek niet (wel haar patroon en haar
  datums), dus het label mag veranderen. Een feestdag in `ExceptionTimes` draagt wel zijn naam in `Name`; die leest de
  lezer als feestdagnaam.
- Een werkende uitzondering staat in `ExceptionTimes` met een DAILY-patroon dat de blokken draagt (`DayComponent`
  `$`). Dat patroon is geen herkenningsteken, want een ander programma kan een terugkerende feestdag zo schrijven; de
  markering in `OPS_Calendar` beslist.
- `PredefinedType` volgt `calendar.shift`: `.SECONDSHIFT.`, `.THIRDSHIFT.`, `.USERDEFINED.`, anders `.FIRSTSHIFT.`.
  buildingSMART legt de betekenis van de ploegen niet vast; OPS gebruikt ze als ploegindeling. `ObjectType` is alleen
  bij `.USERDEFINED.` een label.
- Bij de bronklokken (`calendarPeriodClocks`) telt het einde van een periode ook als ongewijzigd als de geschreven
  periode, met dezelfde omloop over middernacht als de lezer, op hoogstens 1e-9 minuut even lang is als het
  plannerblok. Moet een grens met een tijdzone in de bronklok toch in de vorm van de writer, dan weigert de writer
  getypeerd (`IfcCalendarTimePrecisionError`): hij leent geen zone van een andere grens en laat hem ook niet stil weg.
- Toetsen: `check-ifc-werktijd-per-dag.ts`, `check-ifc-calendar-identity.ts`, `check-ifc-kalendertijd.ts`,
  `check-ifc-dagkalender-hele-dag.ts`.
