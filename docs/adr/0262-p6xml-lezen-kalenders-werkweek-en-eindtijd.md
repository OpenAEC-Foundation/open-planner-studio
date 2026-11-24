# P6 XML lezen: welke kalenders, de werkweek en het einde van een blok

P6 schrijft het einde van een werktijdblok als de laatste minuut ervan: 08:00 tot 16:30 staat als
`<Finish>16:29:00</Finish>`. Andere programma's en de oudere eigen writer schrijven het exacte einde (`16:30:00`).
Eén regel voor beide zou een van de twee een minuut per blok laten winnen of verliezen; op een kalender met halve
uren kostte dat een minuut per dag (`check-p6xml-calendar-rules.ts` (1), fixronde 2 van #330). De regel geldt daarom
per bestand (`p6FinishUsesLastMinute`): de laatste minuut als het een export van OPS is (ADR 0260) met een
`<StandardWorkHours>`, of als één eindtijd van een werktijdblok, behalve 23:59, niet op een veelvoud van vijf minuten
valt. Dan krijgt elke eindtijd een minuut erbij (`p6FinishClockToMinutes`). Anders blijft elke eindtijd exact en is
alleen 23:59 het einde van de dag (1440 minuten). Een bestand waarvan elke eindtijd op een veelvoud van vijf minuten
valt, leest dus exact, ook als het uit P6 komt (knownbug 2301).

## Gevolgen

- De projectkalender is de `<Calendar>` uit `ActivityDefaultCalendarObjectId` van het project, anders de eerste
  `<Calendar>` (`check-p6xml-nested.ts` 4a). Van de andere kalenders worden alleen bibliotheekkalenders: die met
  `<Type>Resource</Type>` en die waar een activiteit of resource van het document naar verwijst; een ongebruikte globale kalender
  blijft weg (5a). Een taak op de projectkalender krijgt geen `calendarId` (5g), en ook een taak met een verwijzing
  naar een kalender die de lezer niet las niet.
- De werkweek komt uit `<StandardWorkHours>`, de vorm van P6 en van de huidige writer, of `<StandardWorkHour>`, de vorm
  van de oudere eigen writer; een werkweek in een vorm die de lezer niet kent, valt terug op de standaardkalender. Een dag is een
  werkdag als hij een bekende dagnaam (`P6_DAY_NAMES`) en minstens één leesbaar `<WorkTime>`-blok heeft. Begin en
  einde van de enkelvoudige werkdag komen van de laatst gelezen werkdag: het begin van zijn eerste en het einde van zijn
  laatste blok, op het hele uur naar beneden (knownbug 291). Zonder `<StandardWorkWeek>` blijven werkdagen en werktijd
  van `createDefaultCalendar()` staan.
- Een export van OPS met op elke werkdag dezelfde twee blokken met een pauze ertussen (`opsDayWithBreak`) wordt een
  dagkalender met pauze, als de netto uren gelijk zijn aan `HoursPerDay` uit het bestand of het bestand geen
  `HoursPerDay` draagt (`registerP6Bands`), omdat de eigen writer de effectieve blokken van een dagkalender schrijft,
  zoals de MSPDI-lezer (ADR 0253). Of de pauze eigen velden krijgt, beslist `seedScalarBands`. In elk ander geval
  geven afwijkende blokken een uurkalender (`canonicalizeBands`).
- `HoursPerDay` boven 0 uit het bestand geldt voor die kalender, en `readP6XmlProject` zet hem na de promotie tot
  uurkalender terug: de opgeslagen uren per dag mogen afwijken van de blokken (`check-urenperdag-heropenen.ts` §1 en
  §2, ook voor een bibliotheekkalender). Een uurkalender verliest de pauzevelden, omdat zijn blokken de pauze dragen.
- `readP6Calendar` haalt `generation` weg die `createDefaultCalendar()` zet: een kalender uit P6 is niet uit een
  regelset van feestdagen gemaakt.
