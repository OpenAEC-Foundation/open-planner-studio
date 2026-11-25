# XER lezen: een project zonder kalender en een kalender zonder `clndr_data`

Hoe `readXerCalendars` (`xerCalendarData.ts`) de CALENDAR-tabel leest, staat in de regel `xer`. Wanneer een kalender
een uurkalender wordt, ook door een kloktijd in een taakdatum, en welke uren per dag hij daarna houdt, staat in ADR
0321. `readXerProject` vult daar twee dingen bij die alleen uit de activiteiten volgen: een kalender voor een project
zonder gelezen kalender, en de werkdag van een kalender met een lege `clndr_data`.

## Gevolgen

- Levert `readXerCalendars` geen kalender (geen CALENDAR-tabel, of geen rij die de decoder leest), dan krijgt het
  project één kalender `P6 Standard Calendar`: maandag tot en met vrijdag, 08:00 tot 16:00, 8 uur per dag, zonder
  feestdagen, met het id `PROJECT.clndr_id` of anders `xer-calendar:<proj_id>`. Er komt bewust geen instelling van de
  app en geen feestdagenlijst in, zodat de import niet van de machine afhangt. Dat P6 een geldige export zonder
  CALENDAR-tabel kan maken, komt uit het weggehaalde commentaar en is niet nagegaan.
- De projectkalender is de kalender van `PROJECT.clndr_id`, anders de eerste gelezen kalender. Een activiteit krijgt
  `calendarId` als haar `clndr_id` gevuld is en niet de projectkalender is, ook als er geen kalender met dat id
  gelezen is (de P6 XML-lezer laat het dan weg, ADR 0262). De lezer zelf rekent met de kalender van dat id, en zonder
  zo'n gelezen kalender met de projectkalender.
- Een lege `clndr_data` maakt de decoder tot maandag tot en met vrijdag 08:00 tot 16:00 (`check-xer-calendar-data.ts`
  6). `inferBlankCalendarBands` leidt daarna de werkdag af uit de geplande tijden van de activiteiten op die kalender
  (`clndr_id`, of leeg op de projectkalender). Het telt alleen activiteiten met een `target_drtn_hr_cnt` boven 0 die
  een geheel aantal keer de uren per dag van de kalender is, en met een kloktijd in `target_start_date` en
  `target_end_date` waarvan de eindtijd na de begintijd ligt. Het paar begin- en eindtijd dat het vaakst voorkomt
  wint; bij een gelijk aantal het paar met de kleinste sleutel `begin:einde` als tekst. Is de span gelijk aan de uren
  per dag, dan wordt het één blok; is hij langer, dan twee blokken met een pauze vanaf 12:00 ter lengte van het
  verschil, als de span vóór 12:00 begint en na het einde van de pauze eindigt. In elk ander geval blijft de kalender zoals de decoder hem gaf. De
  blokken gelden voor elke werkdag van de kalender, en `workStartHour` en `workEndHour` worden de tijden van het paar;
  twee blokken maken de kalender een uurkalender (ADR 0321).
- Reden: zonder `clndr_data` is de geplande invoer het enige bewijs van de werkdag. De afleiding leest geen
  rekenuitvoer van P6 (vroege en late datums, speling). `check-xer-reader.ts` 3a leidt uit een lege kalender met
  taken van 08:00 tot 17:00 de blokken 08:00 tot 12:00 en 13:00 tot 17:00 af. Het weggehaalde commentaar noemde de
  pauze de standaard lunchpauze van P6 van 12:00 tot 13:00; de code neemt elke pauzelengte vanaf 12:00, en dat P6
  die pauze zo schrijft, is niet nagegaan.
- Op zo'n kalender kan het geplande venster de duur herstellen (ADR 0394).
