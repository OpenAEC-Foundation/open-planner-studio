# Een uurkalender herkennen: de gedeelde afwijkingsregel van de lezers

Bijna elk bestand van een ander programma geeft per werkdag werktijden. Zou een lezer die altijd als werkblokken
(`workTime`) overnemen, dan werd elk geïmporteerd project een uurplanning en kwam een dagbestand na een rondgang anders
terug. Een lezer zet `workTime` daarom alleen bij een afwijking van één enkelvoudige werkdag, of bij informatie binnen
een dag elders in het bestand (de normatieve regel in `docs/superpowers/specs/2026-07-06-uren-scheduling-design.md`
§7, punten (a), (b) en (c)). De helpers voor die regel staan één keer in `src/services/subdayIo.ts`; welke velden en
welk anker een lezer gebruikt, staat in ADR 0043 (IFC), 0252 (MSPDI), 0264 (P6 XML) en 0283 (`.mpp`).

## Gevolgen

- `canonicalizeBands` meldt een afwijking bij (a) meer dan één blok op een weekdag, (b) een blok dat na de
  canonieke vorm eindigt na minuut 1440, of (b2) een blok van 1440 minuten of meer (einde min begin). De canonieke vorm:
  een einde op of vóór het begin krijgt 1440 erbij, en de blokken van een dag staan op begin gesorteerd. Een blok dat
  precies op 1440 eindigt, is dus geen (b).
- (b2) staat niet in de spec. Reden: een werkdag van één blok van 0 tot 1440 is geen (a) en geen (b), dus zonder (b2)
  werd zo'n kalender alleen een uurkalender als een taak erop een signaal gaf, en een resourcekalender die alleen via
  een toewijzing gebruikt wordt, krijgt dat signaal nooit. `check-mpp-import.ts` ("Z8 instrumentfix 1") eist een
  afwijking voor 0 tot 1440, geen afwijking voor 0 tot 1439, en een uurkalender met 24 uur per dag uit
  `promoteHourCalendar` zonder signaal. Dat dit de ingebouwde kalender "24 Hours" van MS Project is, en dat de
  resourcekalenders in `mpp14timephased.mpp` zo zijn, komt uit het weggehaalde commentaar en het commentaar in die
  toets; dat corpusbestand staat niet in de repo.
- De helpers voor (c) bij een duur: `isoDurationToMinutes` geeft `null` bij een lege waarde, `$` of een duur zonder
  `T`, en anders de minuten van het tijddeel (ADR 0050 over de dagen vóór de `T`); een vorm die `parseIfcDuration`
  niet leest, geeft diens fout. `isSubDayMinutes` is waar als de afgeronde minuten geen veelvoud zijn van de
  afgeronde minuten per dag; bij 0 of minder minuten per dag is het altijd waar.
- De helper voor (c) bij een datum: `hasNonAnchorTime` is onwaar zonder `T`. Anders haalt hij een `Z` met alles
  erachter en een zone van de vorm `+hh:mm` of `+hhmm` (ook met `-`) aan het eind weg, en vergelijkt hij alleen de
  eerste vijf tekens (uren en minuten) met die van het anker. Seconden tellen dus niet mee.
