# P6 XML lezen: welke kalenders, de werkweek en het einde van een blok

De lezer kent twee vormen voor het einde van een werktijdblok: de laatste minuut van het blok
(`<Finish>16:29:00</Finish>` voor een blok tot 16:30, de vorm van de huidige writer, `p6FinishClock`) en het exacte
einde (`16:30:00`, de vorm van de oudere eigen writer en van de exacte bestanden in `check-p6xml-calendar-rules.ts`
(1d) en (1e)). MPXJ schrijft de eerste vorm (`XmlWriter.getEndTime`). Eén regel voor beide vormen laat een van de twee een minuut per blok verliezen of winnen; op een
kalender met halve uren kostte dat een minuut per dag (`check-p6xml-calendar-rules.ts` (1), fixronde 2 van #330). De
regel geldt daarom per bestand (`p6FinishUsesLastMinute`): de laatste minuut als het een export van OPS is (ADR 0260)
met een `<StandardWorkHours>`, of als één eindtijd van een werktijdblok, behalve 23:59, niet op een veelvoud van vijf
minuten valt. Dan krijgt elke eindtijd een minuut erbij (`p6FinishClockToMinutes`). Anders blijft elke eindtijd exact
en is alleen 23:59 het einde van de dag (1440 minuten). In een bestand dat niet van OPS komt en waarvan elke eindtijd
op een veelvoud van vijf minuten valt, leest de lezer dus exact, ook als de schrijver de laatste minuut bedoelde
(knownbug 2301).

## Gevolgen

- De projectkalender is de `<Calendar>` uit `ActivityDefaultCalendarObjectId` van het project, anders de eerste
  `<Calendar>` (`check-p6xml-nested.ts` 4a). Van de andere kalenders worden alleen bibliotheekkalenders: die met
  `<Type>Resource</Type>` en die waar een activiteit of resource van het document naar verwijst; een ongebruikte
  globale kalender blijft weg (5a). Een kalender zonder geldig `ObjectId` of met hetzelfde `ObjectId` als een eerdere
  slaat de lezer over, en het aantal is niet begrensd (knownbug 2302). Een taak op de projectkalender krijgt geen
  `calendarId` (5g), en ook een taak met een verwijzing naar een kalender die de lezer niet las niet.
- De werkweek komt uit `<StandardWorkHours>`, de vorm van P6 en van de huidige writer, of `<StandardWorkHour>`, de
  vorm van de oudere eigen writer. Een dag is een werkdag als hij een bekende dagnaam (`P6_DAY_NAMES`) en minstens één
  leesbaar `<WorkTime>`-blok heeft. Begin en einde van de enkelvoudige werkdag komen van de laatst gelezen werkdag:
  het begin van zijn eerste en het einde van zijn laatste blok, op het hele uur naar beneden (knownbug 291). Zonder
  werkdag in het bestand blijven werkdagen en werktijd van `createDefaultCalendar()` staan.
- Een kalender wordt in twee stappen een dag- of uurkalender. Eerst `registerP6Bands`: in een export van OPS met op
  elke werkdag dezelfde twee blokken met een pauze ertussen (`opsDayWithBreak`) zijn die blokken geen afwijking, als
  de netto uren gelijk zijn aan `HoursPerDay` uit het bestand of het bestand geen `HoursPerDay` boven 0 draagt; de
  kalender krijgt dan begin, einde, uren per dag en, als `seedScalarBands` andere blokken zou geven, de pauzevelden.
  De eigen writer schrijft de effectieve blokken van een dagkalender, zoals de MSPDI-lezer die leest (ADR 0253). In
  elk ander geval maken meer dan één blok op een dag, een blok over middernacht of een blok van een hele dag de
  kalender een uurkalender (`canonicalizeBands`); werkdagen met elk één blok maar andere tijden doen dat niet. Daarna
  kan een activiteit op die kalender hem met een signaal alsnog tot uurkalender maken (ADR 0264); een uurkalender
  verliest de pauzevelden, omdat zijn blokken de pauze dragen.
- `HoursPerDay` boven 0 uit het bestand geldt aan het eind voor die kalender: `readP6XmlProject` zet hem na de
  promotie tot uurkalender terug. De opgeslagen uren per dag mogen afwijken van de blokken
  (`check-urenperdag-heropenen.ts` §1 en §2, ook voor een bibliotheekkalender). Zonder geldige waarde houdt een
  uurkalender de uren van zijn blokken (§2), de dagkalender met pauze de netto uren van zijn blokken en een andere
  dagkalender de 8 uur van `createDefaultCalendar()`.
- `readP6Calendar` haalt `generation` weg die `createDefaultCalendar()` zet: een kalender uit P6 is niet uit een
  regelset van feestdagen gemaakt.
