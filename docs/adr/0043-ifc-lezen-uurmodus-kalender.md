# De IFC-lezer beslist de uurmodus van een kalender in twee stappen

IFC kent geen onderscheid tussen een dagkalender en een uurkalender; een `IfcWorkCalendar` met één tijdvak per dag is
ambigu. OPS schrijft daarom naast de standaard-IFC eigen kenmerken in een `OPS_Calendar`-pset op de kalender:
`IsHourCalendar`, `WorkStartHour`/`WorkEndHour`, `HoursPerDay` en het pauzepatroon. De lezer controleert niet welk
programma die pset schreef: elke pset met die naam die via `IFCRELDEFINESBYPROPERTIES` aan de kalender hangt, telt.
De beslissing valt in twee stappen. Eerst, bij het inlezen van de kalender (`buildCalendarFromEntity`), op de pset en
de vorm van de kloktijden. Daarna, als alle taken gelezen zijn (`applyHourModeIFC`), op de tijdvakken en de taken voor
de kalenders die de eerste stap niet al besliste.

## Gevolgen

- Stap 1, in deze volgorde:
  - Eén tijdvak met seconden in de kloktijd, zonder de oude bandvorm, zonder `IsHourCalendar = .T.` en zonder andere
    afwijking: de kalender blijft scalair. Zonder `HoursPerDay` en zonder pauze krijgt hij een expliciete pauze van
    0, zodat de netto werktijd niet uit afgeronde minuten wordt afgeleid.
  - `IsHourCalendar = .T.`, of seconden of de oude bandvorm (een uur- of minuutfractie zoals `7.5:00:00`) zonder
    `IsHourCalendar = .F.`: de kalender wordt meteen uurkalender. `promoteHourCalendar` zet `hoursPerDay` op de modale
    dagsom van de tijdvakken; een `HoursPerDay` uit de pset wint daarna weer.
  - `IsHourCalendar = .F.`: de tijdvakken zijn de afgeleide blokken van een scalaire kalender (een urentaak gebruikte
    hem), of de ene periode van een dagkalender die de lezer anders als afwijkend zou zien (ADR 0144). De kalender
    promoveert ook in stap 2 nooit. Een urentaak erop leest toch minuutprecies, een dagtaak
    dagprecies.
  - Geen markering en geen `WorkStartHour`/`WorkEndHour`: de herkenning van een oude scalaire kalender, hieronder.
- Stap 2: een kalender die nog geen uurkalender is en niet scalair gemarkeerd, wordt uurkalender bij een afwijking in
  zijn tijdvakken (meer dan één op een werkdag, over middernacht, of een hele dag) of bij sub-dag-informatie van een
  taak die hem gebruikt: een duur met een tijddeel dat niet op hele dagen van die kalender valt, of een datum met een
  echte tijd anders dan het eigen anker `T07:00`. Ook hier zet `promoteHourCalendar` `hoursPerDay` op de modale dagsom
  van de tijdvakken, maar een `HoursPerDay` uit de pset wordt daarna niet teruggezet. Een eigen bestand loopt daar
  niet tegenaan, want de writer schrijft `HoursPerDay` bij een uurkalender altijd samen met `IsHourCalendar = .T.`
  (`docs/ifc-round-trip.md`, "Uren per dag bij een blokkenkalender"), en zo'n kalender is na stap 1 al uurkalender.
- Een oudere OPS-versie schreef voor een scalaire kalender met urentaak de effectieve blokken (07–12 en 13–16) zonder
  markering, en die kwam dan terug als uurkalender 07:00–12:00. `legacyScalarFromEffectiveBands` herkent zo'n
  kalender zonder melding als alle drie gelden: er staat `HoursPerDay`, `SimpleBreakStart` of `SimpleBreakDuration` in
  `OPS_Calendar`; er zijn precies twee tijdvakken, niet over middernacht; en de scalar die eruit volgt (begin eerste
  tot eind laatste tijdvak, uren per dag uit de pset of eind min begin, pauze uit de pset) geeft via
  `seedScalarBands` precies dezelfde tijdvakken. Dan is de kalender scalair gemarkeerd; anders beslist stap 2.
- Een datum zonder tijd op een uurkalender blijft een datum: de normalisatie op de laadgrens zet hem per veld en
  kalender om (T17, D1 tot en met D7, `payloadFromImport`). Als 00:00 gelezen werd een werkelijk einde het begin van
  die dag.
- Tijdens het lezen van `IfcTaskTime` zet een kale `PT{n}H` om met de uren per dag van de projectkalender; de lezer
  kent de taakkalender dan nog niet en stap 2 rekent de duur daarna opnieuw.
- Welke kalenders scalair gemarkeerd of letterlijk zijn, houdt de lezer bij in `WeakSet`s op de kalenderobjecten
  van één leesbeurt, net als het bandregister in `subdayIo`.
- Toetsen: `check-ifc-calendar-identity.ts` (§9 en §10, de oude scalaire kalender), `check-ifc-kalendertijd.ts`,
  `check-ifc-werktijd-per-dag.ts`.
