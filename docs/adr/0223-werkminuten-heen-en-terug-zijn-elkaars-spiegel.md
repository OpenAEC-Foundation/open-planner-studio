# Werkminuten optellen en aftrekken zijn elkaars spiegel

Voor een taak in de urenmaat telt `CPMSolver.addDurationChecked` een duur vooruit met `addWorkMinutes` en
`CPMSolver.subDuration` een duur terug met `subtractWorkMinutes`; een taak in de dagenmaat loopt via de lopers van ADR
0224, die door de afronding op hele minuten geen exacte spiegel zijn. We kozen ervoor dat de twee minutenwandelingen
elkaars spiegel zijn: vanaf een werkmoment `t` komt `subtractWorkMinutes(addWorkMinutes(t, n), n)` op dezelfde plek op
de werkas uit als `t`, met nul werkminuten ertussen. Die spiegel geldt alleen als de wandeling haar lengte kan
afleggen. Is een vrij blok langer dan `MAX_SCAN`, dan stopt `addWorkMinutes` op het blokeinde vóór dat blok met een
rest, en komt de terugwandeling eerder uit: in een proef gaf +481 min vanaf vr 08:00 (ma-vr 08:00–16:00, daarna ruim
een jaar vrij) vr 16:00, en −481 min daarvandaan do 15:59. De spiegel is een eigenschap van de twee kalenderfuncties,
geen uitspraak over de vroege en late start van een taak: met welk einde en welke duur de solver ze aanroept, staat in
`CPMSolver`. `check-kalender-ms-wandeling.ts`, deel (d), toetst voor de laatste taak van een `.mpp` van twee taken, met
512 en 512,2 min, dat haar late start gelijk is aan haar vroege start en haar speling nul. Er is geen uitzondering per
bronformaat in de wandeling: een vrij blok dat P6 in de kalenderdata afkapt, herstelt de XER-decoder
(`xerCalendarData.ts`).

## Gevolgen

- Toetsen: `check-calendar-mirror.ts`, deel A, toetst de spiegel op kalenders met 1, 2 en 3 blokken per dag en
  verschillende weekpatronen, vanaf werkmomenten op elk half uur van het meetvenster, voor lengtes van 1 tot 20 volle
  werkdagen, en accepteert een ander tijdstip met nul werkminuten ertussen. `check-kalender-ms-wandeling.ts`, deel
  (a), toetst vanaf ma 08:00 dat de terugwandeling op de milliseconde terugkomt (spec alleen uren, §3.9). Deel C van
  de spiegeltoets bouwt zelf een kalender met de XER-bronstempel en strafdagen en toetst dat die even ver heen en
  terug wandelt als een neutrale; het herstel in de decoder toetst `check-xer-calendar-data.ts`, geval 22a.
- Een wandeling met een lengte zet haar begin eerst op een werkmoment in haar eigen richting: `addWorkMinutes` met
  `nextWorkInstant`, `subtractWorkMinutes` met `prevWorkInstant`. Vanaf een moment buiten werktijd komen heen en terug
  dus aan de twee kanten van hetzelfde gat uit; daar geldt de spiegel niet.
- Het einde van een blok en het begin van het volgende hebben nul werkminuten ertussen. Twee plekken op de werkas
  vergelijk je daarom met `workMinutesBetween(a, b) === 0`, niet met gelijke tijden.
- `walkMs` is openbaar omdat de werkplaatsing (`workPlacement.ts`) dezelfde omzetting naar hele milliseconden gebruikt
  (spec §3.9).
- Bij een lange spanne (de grens staat in `physicalWorkMinutesBetween`, met `PREFIX_MIN_DAYS`) telt
  `workMinutesBetween` de volle dagen uit een lopende som op het kalenderobject (`fullDayMinutes`, per kalenderdag de
  werkminuten van de blokken die op die dag beginnen) en alleen de randdagen blok voor blok, voor de speling in
  minuten over lange spannes. Valt een spanne buiten de som, dan bouwt `fullDayMinutes` haar opnieuw op met aan elke
  kant 366 dagen extra, of de huidige lengte als die groter is. `check-dagenmaat-lopers.ts`, deel D, legt de uitkomst
  naast een telling dag voor dag.
