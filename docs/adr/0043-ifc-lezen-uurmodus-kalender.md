# De IFC-lezer kiest de uurmodus van een kalender pas na alle taken, en vertrouwt alleen de eigen markering

IFC kent geen onderscheid tussen een dagkalender en een uurkalender; een `IfcWorkCalendar` met één tijdvak per dag is
ambigu. De lezer leest daarom eerst alle kalenders en taken als dag, en beslist daarna per kalender (project en
bibliotheek) in `applyHourModeIFC`, als elke `task.calendarId` bekend is. Een kalender wordt uurkalender bij een
afwijking in zijn eigen tijdvakken (meer dan één tijdvak op een werkdag, of een tijdvak over middernacht of over een
hele dag) of bij sub-dag-informatie van een taak die hem gebruikt: een duur met een tijddeel dat niet op hele dagen
van die kalender valt, of een datum met een echte tijd anders dan het eigen anker `T07:00`. Zonder signaal blijft
alles dag. Alleen een kalender die OPS zelf schreef draagt `IsHourCalendar` in `OPS_Calendar`, en alleen die
markering wordt vertrouwd boven deze afleiding.

## Gevolgen

- `IsHourCalendar = .T.` houdt een kalender met één gewoon tijdvak toch in uurmodus. `IsHourCalendar = .F.` zegt
  dat de tijdvakken de afgeleide blokken van een scalaire kalender zijn (een urentaak gebruikte hem): zo'n kalender
  promoveert nooit, ook niet met meer tijdvakken of urentaken. Een urentaak op zo'n kalender leest toch
  minuutprecies (echte tijden en minuten), een dagtaak blijft dagprecies.
- Een kalender met seconden in zijn kloktijden blijft scalair zolang het één tijdvak is zonder andere afwijking; zonder
  `HoursPerDay` en zonder pauze krijgt hij een expliciete pauze van 0, zodat de netto werktijd niet uit afgeronde
  minuten wordt afgeleid. Alleen de werkelijk expliciete oude bandvorm promoveert.
- Een oudere OPS-versie schreef voor een scalaire kalender met urentaak de effectieve blokken (07–12 en 13–16) zonder
  markering, en die kwam dan terug als uurkalender 07:00–12:00. De lezer herkent zo'n kalender zonder melding
  (`legacyScalarFromEffectiveBands`) als alle drie gelden: er staat een scalair kenmerk in `OPS_Calendar`
  (`HoursPerDay`, of `SimpleBreakStart`/`SimpleBreakDuration`, die de writer alleen zonder `workTime` schrijft),
  er zijn precies twee tijdvakken niet over middernacht, en de scalar die eruit volgt (begin eerste tot eind laatste
  tijdvak, uren per dag uit de pset of eind min begin, pauze uit de pset) geeft via `seedScalarBands` precies
  dezelfde tijdvakken. Anders blijft de gewone afleiding staan. Bestanden van andere pakketten dragen geen
  `OPS_Calendar` en komen hier nooit langs.
- Een datum zonder tijd op een uurkalender blijft een datum: de normalisatie op de laadgrens zet hem per veld en
  kalender om (T17, D1 tot en met D7, `payloadFromImport`). Als 00:00 gelezen werd een werkelijk einde het begin van
  die dag.
- Tijdens het lezen van `IfcTaskTime` zet een kale `PT{n}H` om met de uren per dag van de projectkalender, niet met
  een vaste 8; de lezer kent de taakkalender dan nog niet en `applyHourModeIFC` corrigeert de duur daarna.
- Welke kalenders scalair gemarkeerd of letterlijk zijn, houdt de lezer bij in `WeakSet`s op de kalenderobjecten
  van één leesbeurt, net als het bandregister in `subdayIo`; er lekt niets tussen twee `readIFC`-aanroepen.
- Het dagengetal van een urentaak en de werktijd per dag staan in `docs/ifc-round-trip.md`. Toetsen:
  `check-ifc-calendar-identity.ts`, `check-ifc-kalendertijd.ts`, `check-ifc-werktijd-per-dag.ts`.
