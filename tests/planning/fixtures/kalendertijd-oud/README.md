# Oude werkende uitzondering

`werkende-uitzondering.ifc` is zonder tekstmutaties geproduceerd door `writeIFC`,
`minutesToClock` en `calendarExceptionKey` van commit
`d783c30fd75f09a31f5a8774f1c01ccbbed266c8`.

Invoer: een scalaire kalender 07:00–16:00, acht uur per dag, geen feestdagen,
en één werkende uitzondering `Werkzaterdag` op 1 mei 2027 met band
`{ start: 510.5, end: 720 }`. Taken, relaties, resources en toewijzingen zijn leeg.

De oude writer schrijft zowel de periode als de V1-inhoudssleutel met
`08:30.5:00` en `12:00:00`. De lezer moet deze expliciete markering herkennen,
ook als de huidige formatter dezelfde begintijd als `08:30:30` schrijft.

SHA-256 van het onveranderde writerresultaat:
`d95faf8047bdbe5f7b5fdfd47755d0eb9b03cebe1ae44f3bfad9f7ea9c09af6e`.

# Een week zonder werkblokken, alleen werkende uitzonderingen

`v2026.8.1-alleen-werkende-uitzonderingen.ifc` is zonder tekstmutaties geproduceerd
door `writeIFC` van tag `v2026.8.1` (`af71257f871394b46fd60278aad6cf1963295df5`),
in de review van PR #1253.

Invoer: één kalender `Alleen werkende uitzonderingen` met werkdagen ma–vr zonder
werkblokken (een lege `workTime`), acht uur per dag, geen feestdagen, en twee
werkende uitzonderingen: maandag 2 februari 2026 van 09:00 tot 10:00 en maandag
9 februari 2026 van 09:00 tot 13:00. Eén taak `Wand A bouwen` van 240 minuten
vanaf 2 februari 09:00.

De writer van die tag schrijft de week zonder tijdvak, de uitzonderingen in
`WorkingExceptionIds` en geen `IsHourCalendar`. De taak werkt dus één uur op
2 februari en drie uur op 9 februari, en eindigt daar om 12:00. Proef:
`check-ifc-kalender-zonder-werktijden.ts`.

SHA-256 van het onveranderde writerresultaat:
`28b4d28486a01e00f7af3b1cb035ee2cc5fb129966fc1d1be9c3bda2fd1853e3`.
