# De werktijd van een kalender via MCP volgt de kalenderdialoog

Elke duur op een kalender hangt aan haar werktijd. Geeft dezelfde invoer via `planner_update_calendar` een andere
kalender dan in de kalenderdialoog, dan klopt de planning van de planner niet meer met wat hij in het venster zou
zien. Waar het venster een waarde afleidt, leidt de tool haar daarom op dezelfde manier af, met dezelfde functies; en
waar het venster invoer niet toelaat, weigert de tool met een reden die de te wijzigen velden noemt.

## Gevolgen

- `workTime` (uurbanden) wordt streng getoetst, want een half toegepaste uurkalender is erger dan een weigering.
  `byWeekday` moet alle dagen "1" tot en met "7" bevatten: een gedeeltelijke opgave zou de ontbrekende dagen stil
  niet-werkend maken. Een band is `[start, end)` in minuten vanaf middernacht van de startdag, met start van 0 tot en
  met 1439 en een einde na de start tot hoogstens 2880. Een dienst over middernacht telt door (22:00 tot 06:00 is
  1320 tot 1800); een band die niet oploopt, wordt geweigerd en niet als nachtdienst gelezen. De banden van een dag
  lopen op zonder overlap, en het deel van een nachtband na middernacht mag niet over de eerste band van de volgende
  dag lopen (zondag gaat over in maandag). `workingExceptions[].bands` heeft dezelfde vorm.
- Die regels toetst de handler (`workTimeReason`, `bandListReason`), want de schemapoort toetst de binnenkant van de
  kalenderitems niet. Het schema blijft daarom klein: `WORKTIME_SCHEMA` beschrijft de banden en hun grenzen één keer
  in tekst, en één kaal dagschema (`WORKTIME_DAY_SCHEMA`) geldt via `additionalProperties` voor elke dagsleutel en
  voor `workingExceptions[].bands`, in plaats van zeven gelijke `properties`. Van `generation` staat alleen de
  buitenvorm in het schema; `generationReason` weigert een foute vorm met de geldige sleutels en waarden.
- `workDays` volgt de banden, zoals in het venster (`CalendarForm.applyBands`). Met `workTime` erbij wordt `workDays`
  afgeleid; een opgegeven `workDays` die de banden tegenspreekt, wordt geweigerd. Anders ziet de solver een werkdag
  waarop geen band werktijd geeft.
- Alleen `workDays` op een uurkalender loopt door dezelfde functie als de werkdagknoppen (`workDaysSetPatch`): een
  nieuwe werkdag krijgt de banden van de eerste dag met banden (zondag, maandag en zo verder tot zaterdag), en zonder
  zo'n dag die van de eigen enkelvoudige werkdag; een vervallen werkdag verliest zijn banden. Het startpunt zijn de
  werkdagen volgens de banden, niet de opgeslagen `workDays`, zodat een kalender die al tegenstrijdig was, wordt
  hersteld.
- `hoursPerDay` volgt nieuwe banden alleen als hij gelijk was aan de modale dagsom van de banden van vóór de aanroep
  (`hoursPerDayForBlocks`); een bewuste afwijking, zoals P6 `day_hr_cnt` bij een late ploeg van 14 tot 24 uur met 8
  uur, blijft staan. Eén aanroep geldt als één sessie in het venster. Een `hoursPerDay` in het item zelf gaat voor.
- Op een dagkalender met een pauzepatroon zijn de netto uren een afleiding, werkdag min pauze (`simpleBreakPatch`),
  zoals de niet-bewerkbare Standaard werkdag in de dialoog. Raakt een item de pauze, of de werkdag van een kalender die
  al een expliciete pauze heeft, dan wordt een oude impliciete pauze expliciet en volgt `hoursPerDay`. Een meegegeven
  `hoursPerDay` die meer dan een halve minuut afwijkt, wordt geweigerd met de velden die de agent wel kan wijzigen;
  een gelijke waarde verandert niets. De grens is een minuut omdat de dialoog twee decimalen toont. Een kalender
  zonder pauzevelden houdt `hoursPerDay` als opgave. Het pauzepatroon wordt alleen getoetst als het item de werkdag of
  de pauze raakt, zodat een naamswijziging op een kalender met oude, ongeldige gegevens mogelijk blijft.
- Een wissel tussen dag- en uurkalender verandert alleen de plaatsing: `durationUnit`, `scheduleDuration` en
  `durationMinutes` van de taken blijven staan. De rij meldt `modeChangedFrom` en het antwoord waarschuwt dat datums
  kunnen schuiven. `workTime: null` faalt als er een urentaak op de kalender staat en de kalender daarna geen
  effectieve werkblokken meer heeft.
- `draft.updateCalendar` voegt samen en kan geen sleutel verwijderen. Wat weg moet (`generation`, `workTime`, `shift`,
  een lege `workingExceptions`), verwijdert een eigen producer, die daarna `syncProjectCalendar` en
  `markDocumentEdited` aanroept: hij maakt een nieuw kalenderobject, en de projectkalender in de cache zou anders naar
  het oude object wijzen. Een gewist veld is een afwezige sleutel, geen sleutel met `undefined`.
- Valt een taak na de wijziging buiten elk werkbaar venster, dan is dat een waarschuwing met `cappedTaskIds`, geen
  fout: de kalenderwijziging blijft staan.
