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
