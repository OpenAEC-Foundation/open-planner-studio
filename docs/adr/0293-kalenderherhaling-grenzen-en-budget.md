# Kalenderherhaling: grenzen en een gedeeld budget voor uitzonderingsdagen

Elke uitzondering wordt per dag uitgeschreven, en een klein bestand kan veel dagen vragen: één record over het
hele datumbereik, een herhaling op elke dag, duizenden records, of veel kalenders die van één volle basis erven. De
kern zet daarom vaste grenzen op elke lus en allocatie die het bestand stuurt, en neemt bij een grens minder dagen
dan het bestand vraagt in plaats van te falen. We kozen ruime vaste getallen boven wat een echte planning vraagt.

## De grenzen

- `MAX_CALENDAR_EXCEPTIONS` (2000): het aantal uitzonderingsrecords per kalender. De lezers kappen af (`.mpp`: het
  aantal in het blok, `readRawExceptions`; MSPDI: de `<Exception>`-elementen, `readRawMspdiExceptions`).
  T6-hostile extreem exception-aantal in `check-mpp-calendars.ts` biedt 5000 records en krijgt er 2000. De grens
  geldt voor beide vormen, omdat de kosten per record met de lengte van het bereik groeien, niet met de bytes van het
  record.
- `MAX_HOLIDAY_RANGE_DAYS` (366): het aantal dagen van één niet-herhalend bereik, inclusief begin en einde
  (`buildContributions`: vanaf een verschil van 366 dagen wordt het einde begin plus 365). T6-hostile extreem bereik
  toetst een bereik over het hele `.mpp`-datumbereik (dag 0 tot 65534) op precies 366 dagen. Ook de rekenmotor zet een
  feestdag per dag in zijn verzameling (`buildHolidaySet` in `CalendarEngine.ts`). Per kalender geeft dat hoogstens
  2000 maal 366 dagen, voordat het budget hieronder telt. Een bereik met het einde
  vóór het begin wordt één dag; een niet-herhalend record zonder einde levert niets.
- `MAX_RECURRENCE_DATES` (3660): het aantal datums dat één herhaling oplevert, in de lusvoorwaarde van elke generator.
  T3-hostile in `check-mpp-calendars.ts` (wekelijks op alle dagen, `occurrences` 65535, 165 jaar) toetst precies 3660
  dagen. Het `.mpp`-corpus van `docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md` (§1.2) telde 368
  niet-werkende herhalende records, waarvan 295 jaarlijks op een vaste datum. 3660 is ongeveer tien jaar dagelijks.
- `MAX_RECURRENCE_ITERATIONS` (`MAX_RECURRENCE_DATES + 16`): het aantal doorlopen van de lus van een generator, ook
  als een doorloop niets toevoegt. De datumgrens alleen houdt een lus die nooit een datum toevoegt niet tegen: een
  wekelijkse herhaling zonder aangevinkte dag en zonder einde. Een lus die per doorloop een datum toevoegt, haalt de
  datumgrens eerst. `getMonthlyRelativeDates` stopt daarnaast zodra de maandcursor niet vooruitgaat (een eigen
  controle, los van deze grens). Een record dat niets oplevert, kost geen budget, dus het aantal doorlopen telt per
  kalender op tot `MAX_CALENDAR_EXCEPTIONS` maal deze grens, en over de kalenders van een bestand verder; met een
  grens van 100.000 kostte dat 46,3 s voor 2000 zulke records (commit c0221dc98). HOOG-1b in
  `check-mpp-calendars.ts` toetst dat de wekelijkse herhaling 0 datums geeft binnen 200 ms; HOOG-1a toetst hetzelfde
  voor een maandelijkse relatieve herhaling met een stilstaande cursor, en MIDDEN-A 2000 zulke maandelijkse records
  op 0 datums binnen 5 s (beide blijven groen zonder deze grens in die tak, door de cursorcontrole), en MIDDEN-A-regressie een wekelijkse herhaling op alle dagen van 2020
  op 366 datums.
- `MAX_TOTAL_HOLIDAY_SLOTS` (100.000): het gedeelde budget (`HolidayBudget`, nieuw vol via `newHolidayBudget`) voor
  alle uitgeschreven dagen van de kalenders die een lezer erop laat lopen, ook de overerving. De crawl-basislijn in
  `check-mpp-calendars.ts` (`CRAWL_HOLIDAY_BASELINE`, alleen met corpus) is de ondergrens van 2968 eigen
  feestdagreeksen: per kalender de eigen reeksen (`ownHolidayCountByUniqueId`), zonder de geërfde reeksen van een
  basiskalender opnieuw te tellen, opgeteld over alle kalenders. De 2968 is gemeten op 49 bestanden (2026-08-15); de
  toets past de ondergrens toe op de som over alle `.mpp`-bestanden in de ingestelde corpusmap, ook in submappen
  (`resolveMppCrawlScopes`: `OPS_MPP_CRAWL_SMOKE`, anders `crawl-mpp` onder de crawlwortel). Per kalender begrenzen
  alleen gaat niet, omdat veel kalenders elk binnen hun grenzen samen onbegrensd veel dagen kunnen vragen (ADR 0254
  voor MSPDI). `buildContributions` telt vanaf een momentopname van `budget.remaining` af en stopt de opbouw als die
  op is (het record dat loopt wordt afgekapt, de rest overgeslagen), zodat ook de piek in het geheugen begrensd is;
  het verlaagt het gedeelde budget zelf niet. `resolveContributions` verlaagt het met één per dag die het in de kaart
  zet. `mergeInherited` schrijft de dagen van de basis alleen uit zolang het budget ruimte heeft. Zonder die stappen
  gaf een MSPDI-bestand met veel afgeleide kalenders een geheugenfout (PR #335). MIDDEN-1 in `check-mpp-calendars.ts` toetst
  dat `buildContributions` met budget 100 hoogstens 100 dagen oplevert; `check-mspdi-feestdagen.ts` 12 toetst het
  budget over overerving en 12 zwaar 1023 afgeleide kalenders op een basis van ongeveer 100.000 vrije dagen binnen 3 s.
  Waar het budget een uitzondering met hoge voorrang laat wegvallen, staat in knownbug 2319.
- `reExpandRange` schrijft een al uitgerekende reeks van de basis hoogstens `MAX_RECURRENCE_DATES` dagen uit, los van
  het budget.
- `MAX_BASE_CHAIN_DEPTH` (32) begrenst het volgen van basiskalenders, omdat een bestand een kalender naar zichzelf of
  in een kring kan laten verwijzen. De `.mpp`-lezer doet hoogstens zoveel rondes (`mppCalendars.ts`); in de MSPDI-lezer
  erft een kalender met een langere keten of een kring niets (ADR 0254). Een `.mpp`-kalender die na die rondes nog
  niet erft, krijgt haar eigen gegevens zonder basis (`materializeDerived` met `null`). MPXJ herkent een kring
  in MSPDI (`MSPDIReader.childIsNotParent`), maar in een `.mpp` niet (`AbstractCalendarFactory.updateBaseCalendarNames`).
