# Hoe de IFC-writer kalenders schrijft

De werkweek per groep, de klokprecisie, `HoursPerDay`, `IsHourCalendar = .F.` bij een dagkalender met een afwijkende
periode en de werkende uitzonderingen staan in `docs/ifc-round-trip.md` (*Kalenders: werkblokken per weekdag*, *Uren
per dag bij een blokkenkalender*, *Werkende kalenderuitzonderingen na vernummering*), de lezerkant in ADR 0043. Hier
staan de keuzes van de writer die daar niet staan. De rode draad: een kalender moet na heropenen dezelfde kalender
zijn, ook voor de oudere OPS-lezers die sinds H7 `OPS_Calendar` lezen, en de eigenschappen in `OPS_Calendar` staan
er alleen als de periodes zelf de waarde niet teruggeven.

## Gevolgen

- De projectkalender is de eerste `IFCWORKCALENDAR` in het bestand; zo onderscheidt de lezer hem van de
  bibliotheekkalenders. De bibliotheek bevat ook de projectkalender, dus `writeCalendarLibrary` krijgt de bibliotheek
  zonder het id van de projectkalender.
- Een bibliotheekkalender krijgt twee aparte `IFCRELASSIGNSTOCONTROL`: één naar de resources en één naar de taken die
  hem gebruiken, omdat de lezer resources en taken via hun eigen STEP-id-kaart uit elkaar houdt. Zonder gebruikers
  geen relatie. Een kalender met het id `NaN` (beschadigde invoer) krijgt zijn kalender en metadata, maar geen
  relaties, zoals de oude vergelijking met `===` deed.
- `WorkStartHour` en `WorkEndHour` staan er alleen als de eerste geschreven periode ze niet teruggeeft zoals een
  oudere lezer die leest: van de klok alleen het uurdeel, en bij meer periodes het begin afgerond naar beneden
  (`readerScalarHours`). Een werktijd van 07:30 krijgt dus `WorkStartHour`. Bij een week met meer groepen staan ze er
  altijd. Een kalender die nog de oude scalar van het eerste blok draagt (08:00 tot 12:00 bij blokken 08 tot 12 en 13
  tot 17), krijgt geen `WorkEndHour` en leest daarna als 8 tot 17.
- Een uurkalender krijgt altijd `IsHourCalendar = .T.`: één band van 08:00 tot 16:00 is in IFC niet te onderscheiden
  van een dagkalender met die uren. `IsHourCalendar = .F.` krijgt een scalaire kalender waarvan de periodes de
  effectieve blokken zijn (een urentaak gebruikt hem) of waarvan de lezer de ene periode als afwijkend ziet. Een
  pauzepatroon (`SimpleBreakStart`, `SimpleBreakDuration`) staat er alleen bij een scalaire kalender, en alleen als
  het gezet is. Zonder enige reden voor een eigenschap geen `OPS_Calendar`.
- Een blok over middernacht schrijft zijn einde als tijd van de dag; de lezer herkent de omloop aan een einde op of
  vóór het begin. Een blok dat precies om middernacht eindigt, eindigt op `24:00:00` (`minutesToClock` met
  `endOfDay`); oudere bestanden met `00:00:00` leest de omloopregel nog.
- De groepen (`weekBandGroups`) nemen alleen de dagen uit `workDays`. Een werkdag zonder eigen blokken krijgt die van
  de eerste werkdag, zodat een kalender die vóór de groepen verliesloos was één groep blijft. Twee dagen zitten in
  dezelfde groep als hun blokken, op begin gesorteerd, en hun bronklokken gelijk zijn.
- Een groep werkdagen zonder blokken krijgt bij meer groepen geen `IFCWORKTIME`: een WEEKLY-patroon zonder
  `TimePeriods` betekent in IFC de hele dag.
- De labels van de werkweken zijn Engels (`Standard work week`, met de dagen erbij bij meer groepen): ze staan in
  elk bestand, ongeacht de taal van de app. De lezer gebruikt van een werkweek alleen het RecurrencePattern, nooit de
  naam, dus het label mag veranderen. Een feestdag in `ExceptionTimes` draagt wel zijn naam in `Name`; die leest de
  lezer als feestdagnaam.
- Een werkende uitzondering staat in `ExceptionTimes` met een DAILY-patroon dat de blokken draagt (`DayComponent`
  `$`). Dat patroon is geen herkenningsteken, want een ander programma kan een terugkerende feestdag zo schrijven; de
  markering in `OPS_Calendar` beslist.
- `PredefinedType` volgt `calendar.shift`: `.SECONDSHIFT.`, `.THIRDSHIFT.`, `.USERDEFINED.`, anders `.FIRSTSHIFT.`.
  buildingSMART legt de betekenis van de ploegen niet vast; OPS gebruikt ze als ploegindeling. `ObjectType` is alleen
  bij `.USERDEFINED.` een label.
- Een ongewijzigd bronvak schrijft zijn oorspronkelijke klokken. Voor het einde telt "ongewijzigd" ook als de
  geschreven periode, met dezelfde omloop over middernacht als de lezer, op hoogstens 1e-9 minuut even lang is als het
  plannerblok. Een gewijzigde grens met een tijdzone in de bronklok weigert getypeerd
  (`IfcCalendarTimePrecisionError`): de writer leent geen zone van een andere grens en laat hem ook niet stil weg.
- Toetsen: `check-ifc-werktijd-per-dag.ts`, `check-ifc-calendar-identity.ts`, `check-ifc-kalendertijd.ts`,
  `check-ifc-dagkalender-hele-dag.ts`.
