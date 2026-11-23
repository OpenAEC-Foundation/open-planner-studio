# Werkminuten optellen en aftrekken zijn elkaars spiegel

De late kant van de solver telt terug met `subtractWorkMinutes` wat de vroege kant met `addWorkMinutes` vooruit telde;
`LS..LF` moet daarom evenveel werktijd overspannen als `ES..EF`. We kozen ervoor dat de twee wandelingen elkaars
exacte spiegel zijn: vanaf een werkmoment `t` geeft `subtractWorkMinutes(addWorkMinutes(t, n), n)` weer `t`. Er is
geen uitzondering per bronformaat: de bedoelde vrije dagen van een P6-kalender reconstrueert de XER-decoder
(`xerCalendarData.ts`), niet een scheve wandeling hier (deel C van de toets hieronder). Toets:
`check-calendar-mirror.ts` (deel A de kalender, deel B de solver, deel C geen bronuitzondering) en, voor de rekening in
hele milliseconden, §3.9 van de spec alleen uren met `check-kalender-ms-wandeling.ts`.

## Gevolgen

- Een wandeling met een lengte zet haar begin eerst op een werkmoment in haar eigen richting: `addWorkMinutes` met
  `nextWorkInstant`, `subtractWorkMinutes` met `prevWorkInstant`. Vanaf een moment buiten werktijd komt heen en terug
  dus aan de twee kanten van hetzelfde gat uit; daar geldt de spiegel niet.
- Het einde van een blok en het begin van het volgende hebben nul werkminuten ertussen. Twee plekken op de werkas
  vergelijk je daarom met `workMinutesBetween(a, b) === 0`, niet met gelijke tijden: terug komt op een blokbegin uit
  waar heen een blokeinde gaf.
- `walkMs` is openbaar omdat de werkplaatsing (`workPlacement.ts`) dezelfde omzetting naar hele milliseconden gebruikt
  (spec §3.9).
- Bij een lange spanne (de grens staat in `physicalWorkMinutesBetween`, met `PREFIX_MIN_DAYS`) telt
  `workMinutesBetween` de volle dagen uit een lopende som op het kalenderobject (`fullDayMinutes`) en alleen de
  randdagen blok voor blok, voor de speling in minuten over lange spannes. Valt een spanne buiten de som, dan bouwt
  `fullDayMinutes` haar opnieuw op met aan elke kant 366 dagen extra, of de huidige lengte als die groter is.
  `check-dagenmaat-lopers.ts`, deel D, legt de uitkomst naast een telling dag voor dag.
