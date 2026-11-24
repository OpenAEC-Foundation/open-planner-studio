# Kalenderherhaling: één beslissing per datum, in een vaste voorrang

Twee uitzonderingen in een bestand kunnen dezelfde datum claimen, ook als ze op een andere datum beginnen: een vrij
bereik van drie dagen en een werkende uitzondering op de middelste dag. `resolveContributions` beslist daarom per
datum. Het legt de bijdragen in volgorde over een kaart van ISO-datum naar de index van de bijdrage (`authority`); de
laatste wint. We kozen een kaart per dag in plaats van per begindatum, zodat elke datum precies één beslissing krijgt
en dus in hoogstens één van de twee lijsten van `ParsedExceptions` staat, zoals `WorkCalendar.workingExceptions`
vraagt. De rekenmotor heeft voor een datum in beide lijsten een eigen volgorde (ADR 0221) die de werkende uitzondering
laat winnen, en houdt bij twee werkende uitzonderingen op één datum de blokken van de laatste met eigen blokken
(knownbug 2004); met de kaart beslist de voorrang van het bestand, ook als die een vrije dag laat winnen. Dat MPXJ
alleen op de begindatum sleutelt en twee overlappende bereiken met een andere begindatum dus niet als botsing ziet,
komt uit het weggehaalde commentaar en is niet nagegaan. `check-mpp-calendars.ts` toetst de botsing met twee
verschillende begindatums (T3 invariant: de dag is werkend, het vrije bereik is in twee losse dagen gesplitst).

## Gevolgen

- De voorrang, van laag naar hoog: herhalingen per type in de volgorde van `RECURRENCE_PRECEDENCE_ORDER` (WEEKLY,
  MONTHLY, YEARLY, DAILY), dan de niet-herhalende uitzonderingen. Binnen een groep geldt de volgorde in het bestand.
  `buildContributions` levert de bijdragen in die volgorde. T3 precedentie (b) in `check-mpp-calendars.ts`
  toetst een niet-herhalende werkende uitzondering boven vrije herhalingen op dezelfde datum. De volgorde van de vier
  herhalingstypes onderling bewaakt geen toets: in T3 precedentie (a) zijn alle kandidaten vrij en levert de
  dagelijkse één datum op, en in T4 precedentie in `check-adapters-hours.ts` levert de jaarlijkse herhaling één datum
  op, zodat daar de volgorde in het bestand tussen twee niet-herhalende beslist.
- Een herhaling die tot precies één datum uitrekent, telt als niet-herhalend, wat haar type ook is, en komt op haar
  plaats in het bestand tussen de niet-herhalende uitzonderingen. Dat dit `populateExpandedExceptions()` van MPXJ
  volgt (dat op het aantal uitgerekende datums kijkt), komt uit het weggehaalde commentaar en is niet nagegaan.
  LAAG-1 in `check-mpp-calendars.ts` toetst een jaarlijkse herhaling van één datum, later in het bestand, die wint van
  een dagelijkse.
- De kaart bewaart de index van de bijdrage, niet haar waarde. Twee bijdragen met dezelfde waarde op dezelfde dag
  (twee naamloze vrije dagen zonder blokken) leveren zo één regel op, niet twee.
- In de uitvoer worden alleen opeenvolgende kalenderdagen van één bijdrage die de kaart aan die bijdrage gaf, samengevoegd
  tot één reeks; dagen van verschillende bijdragen nooit, ook als ze aansluiten. T6-hostile extreem exception-aantal
  in `check-mpp-calendars.ts` leest 2000 aansluitende losse dagen als 2000 vrije dagen.
- Een bijdrage is werkend als `periodCount > 0`; een werkende uitzondering krijgt haar blokken alleen als die lijst
  niet leeg is. Zonder naam krijgt een uitzondering `UNNAMED_HOLIDAY_NAME` (`'Holiday'`) of
  `UNNAMED_WORKING_EXCEPTION_NAME` (`'Working exception'`). Dat is één vaste naam in het Engels, zoals XER
  `'Calendar exception'`, en geen vertaalde tekst: de naam is projectdata die in het opgeslagen bestand komt en mag niet
  per taal van de app verschillen. De P6 XML-lezer gebruikt dezelfde twee namen (ADR 0263).
- Overerving (`mergeInherited`) gebruikt dezelfde kaart: de feestdagen en daarna de werkende uitzonderingen van de
  basiskalender, die al uitgerekend zijn, gaan per dag terug in bijdragen (`reExpandRange`) en komen vóór de eigen
  bijdragen van de afgeleide kalender. Bereiken beide de kaart, dan wint per datum de eigen uitzondering van de basis.
  `check-mspdi-feestdagen.ts` 5 toetst basis en eigen uitzondering alleen op verschillende datums: dat beide meekomen.
- Als het budget opraakt, beslist de afkap welke bijdrage wegvalt: `buildContributions` kapt af in de volgorde van het
  bestand, `resolveContributions` en `mergeInherited` in de volgorde van de kaart, waar de hoogste voorrang het laatst
  komt (knownbug 2319). Twee bijdragen op dezelfde datum kosten elk een plaats. Het budget zelf staat in ADR 0293.
