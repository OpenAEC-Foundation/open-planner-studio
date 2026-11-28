# P6 XML schrijven: kalenders, werkweek, uitzonderingen en de tijd van een datum

`writeP6XMLWithReport` schrijft de projectkalender en de bibliotheekkalenders als `<Calendar>` met een
`<StandardWorkWeek>` en per datum een `<HolidayOrException>`. De lezer neemt die vorm terug zoals in ADR 0262 en 0263;
de keuzes hieronder zijn de spiegel daarvan.

## Gevolgen

- `HoursPerDay` is de opgeslagen `hoursPerDay` van de kalender, niet de werktijd van de blokken; `HoursPerWeek` is die
  maal het aantal werkdagen en `HoursPerMonth` die maal 20 (`check-dag-is-werktijd.ts` §4 toetst `HoursPerDay` 8 bij
  blokken van 10 uur).
- `<Type>` is `Global` voor de projectkalender en voor elke kalender die een taak in `calendarId` noemt, ook een
  samenvattingstaak, anders `Resource`. De lezer neemt van de andere kalenders een `Resource`-kalender mee, en een
  `Global`-kalender alleen als een activiteit of resource ernaar verwijst; een kalender met een ongeldig of al gelezen
  `ObjectId` slaat hij over (ADR 0262). Een `<WBS>` krijgt geen `CalendarObjectId`, dus de kalenderkeuze van een
  samenvattingstaak valt altijd weg; de kalender zelf gaat verloren als geen activiteit of resource ernaar verwijst
  (knownbug 2342). Toets (9) heeft alleen de projectkalender en kalenders van bladtaken, en onderscheidt
  `Global` van `Resource` dus niet.
- Een activiteit en een resource verwijzen met `CalendarObjectId` naar hun kalender; zonder `calendarId`, of met een
  die niet in de nummering staat, is dat 1, de projectkalender.
- De werkweek (`standardWorkWeekNode`) heeft per dag één `<StandardWorkHours>`. De blokken komen uit `cal.workTime`,
  anders uit `effectiveWorkTimeBands`, dus een dagkalender gaat met zijn effectieve blokken en daarmee met zijn pauze,
  zoals de MSPDI-writer (`mspdiWriter.ts`); pas zonder effectieve blokken wordt het één blok van `workStartHour` tot
  `workEndHour` op een werkdag. Reden: sinds T13 telt een dag in de export de werktijd per dag (ADR 0363), en één blok
  van begin tot einde gaf een andere werktijd dan de kalender heeft. Een voorbeeld:
  07:00 tot 16:00 met 8 uur gaf 9 uur per dag, en 3 dagen kwamen terug als 2,67 dagen. De lezer herkent zo'n
  dagkalender met pauze (`opsDayWithBreak`, ADR 0262).
- Een dag zonder blokken krijgt `<WorkTime xsi:nil="true"/>` (toets 2c); het P6 XML-schema stelt `<WorkTime>` verplicht
  en laat nil toe (`CalendarType`). Het einde van een blok is de laatste minuut
  (`p6FinishClock`, toets 2b); de leesregel staat in ADR 0262 en de tekstvorm in ADR 0322. Een blok over middernacht
  (einde boven 1440) gaat met het einde als tijd van de volgende dag; de lezer laat een blok dat op of vóór zijn
  begin eindigt doorlopen (ADR 0263).
- `holidayOrExceptionsNode` schrijft één `<HolidayOrException>` per datum, op datum gesorteerd, zonder naam en zonder
  einddatum (toets 3a en 3b); een kalender zonder uitzonderingen krijgt geen `<HolidayOrExceptions>`. Een feestdag
  wordt een vrije datum (`<WorkTime xsi:nil="true"/>`). Een werkende uitzondering krijgt haar eigen blokken, anders de
  blokken van haar weekdag, anders die van de werkdag met het laagste ISO-nummer, anders het blok van `workStartHour`
  tot `workEndHour`; een blok van een hele dag gaat als twee blokken (`splitWholeDay`, ADR 0263). De XER-writer heeft
  dezelfde terugval (`xerWriter.ts`). Valt een werkende uitzondering op een datum van een feestdag, dan wint de werkende
  uitzondering, omdat ze daarna in dezelfde kaart wordt gezet; bij twee werkende uitzonderingen op één datum wint de
  laatste, ook zonder eigen blokken (knownbug 2345). Elke feestdag en werkende uitzondering telt hoogstens 3660 datums
  (`isoDaysInclusive`); de rest valt weg zonder verliesregel (knownbug 2343). De naam van een feestdag gaat verloren
  (toets 6c; ADR 0367).
- De datums van een taak gaan met hun echte tijd (`minuteModelWriteView` met `realTimes` en
  `literalAutomaticMilestones`, dezelfde opties als de MSPDI-writer; spec alleen-uren I8 en F5b). De letterlijke
  kalenders van de export staan als lijst van kalender-`ObjectId`'s in `OPS_LiteralCalendars`
  (`literalCalendarsJson`, ADR 0361), zodat de lezer voor die kalenders niet op een tijdsignaal hoeft te raden (ADR
  0264). `toXmlDateTime` zet alleen op een datum zonder tijd 08:00: zo komen een uitzonderingsdatum en een
  projectdatum zonder tijd in het bestand (knownbug 302 en 303).
