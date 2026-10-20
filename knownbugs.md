# Bekende bugs en bijvangst

Alles wat een sessie of agent tegenkomt en **niet bij de eigen taak hoort** komt hier: bugs, vreemd gedrag,
verouderde teksten of interne docs, wensen. Fix het niet stilletjes in een PR over iets anders; zet het hier
en noem het in je rapport of PR-tekst.

**Zo voeg je iets toe**

- Onderaan in de passende sectie, met het volgende vrije nummer. Nummers worden nooit hergebruikt, ook niet
  na een fix (andere teksten verwijzen ernaar).
- Eén punt: **wat er misgaat** (vetgedrukt, kort), dan waar (`bestand:regel`, scherm of stap) en hoe je het
  zag, en een voorstel als je er een hebt. Sluit af met de zekerheid:
  - **B** = bevestigd: nagespeeld in de app, met een test of script, of door een tweede agent in de code
    gecontroleerd.
  - **S** = alleen gemeld: gezien of afgeleid, maar niet onafhankelijk getoetst.
- Verzin niets: wat je niet hebt gezien of gemeten, schrijf je niet als feit op.
- Opgelost? Haal het punt weg in dezelfde PR als de fix, en noem het nummer in de PR-tekst.

## Rekenen en planning

1. **Uur-lag op een externe relatie wordt bij een dagtaak genegeerd** (een interne relatie rondt hem wél
   af). `CPMSolver` `externalForwardBound`/`externalBackwardBound` gebruiken in dagmodus alleen `lagDays`. — B
2. **Dagtaak na urentaak op een kalender met werktijdblokken** eindigt te vroeg (1,6 in plaats van 2
   werkdagen), en de urentaak krijgt −0,5 speling zonder constraint. — B
3. **Constraint en deadline op een fase** zijn invulbaar (paneel, Taak bewerken), maar de motor negeert ze. — B
4. **Harde MFO ver vóór de eerste taak** kan een start vóór de projectstart geven. — S
5. **Afgekapte lead** (FS −5 vanaf de eerste taak): vrije speling 2 bij totale speling 0 (vrij > totaal). — S
6. **Externe opvolger met te krap anker** geeft alleen negatieve speling, geen melding over een geschonden
   constraint. — B
7. **Hammock zonder finish-driver**: de melding zegt "nul-lengte", het Duur-veld toont 1 dag. — S
8. **Twee botsende taken op nivelleerprioriteit 1000**: de overbezetting blijft, maar het venster zegt
   "al conflictvrij". — B
9. **Nivelleervenster** toont tegelijk "Geen taken hoeven te verschuiven — de planning is al conflictvrij" en
   "Resterende conflicten". — S
10. **Splitsen van een taak met voortgang**: cursor en geleidelijn tonen "splitsbaar" in het al gedane deel;
    een klik doet niets. — B
47. **Speling *Automatisch* telt voortgang alleen mét statusdatum.** MS Project rekent een gestarte taak ook
    zonder statusdatum met de finish-speling. Zonder statusdatum wijken *Automatisch* en *Kleinste* dus
    allebei af van MSP. — B (code), niet gemeten op bestanden
55. **Voltooide urentaak met alleen datums als actuals** (tutorialproject, "Fundering storten" 21-06 zonder
    kloktijd): na Bereken vroege start en einde `2027-06-18T16:00`, vóór de werkelijke start, met speling 1.
    Dagtaken volgen hun actuals wel. — S
58. **Voortgangsrapport:** voltooide taken krijgen "Near-critical" en in de tabel totale speling 1d. Bedoeld? — S
81. **Voortgang zonder werkelijke datums legt een verkeerde werkelijke start of een verkeerd einde vast.** Bij
    `completion: 100` zonder `actualFinish` wordt het werkelijke einde de statusdatum (`defaultActualFinish`,
    `taskMutationRules.ts:29-34`); zonder `actualStart` wordt de werkelijke start de geplande start
    (`defaultActualStart`, r.44-46); alleen `actualFinish` opgeven zet de start op dezelfde dag
    (`applyProgressInvariants`). Welke geplande start dat is, hangt af van de route (zie 85): in losse calls
    heeft de statusdatum niet-gestart werk al naar die datum geschoven, binnen één `planner_batch` niet.
    Nagespeeld via de echte MCP-dispatcher op Grondwerk (3 wd, gepland 7–9 juni 2027), Fundering storten (2),
    Metselwerk (5), Dak (3), statusdatum vrijdag 11 juni, baseline-einde 23 juni: losse calls met alleen
    `completion: 100` ⇒ Grondwerk werkelijk 11–11 juni, +2 werkdagen; in één batch ⇒ werkelijk 7–11 juni.
    De skill `progress-update` laat een agent daarom altijd beide datums meegeven. Dat het grid en de panelen
    hetzelfde doen, is afgeleid (gedeelde regel), niet nagespeeld. **Besluit eigenaar (2026-10-07, nog niet
    gebouwd):** de afgeleide werkelijke start moet het oorspronkelijk geplande begin van vóór de
    statusdatumverschuiving zijn. — B (MCP), S (UI)

105. **In "Datums zoals opgeslagen" tonen het taakpaneel, path tracing en de MCP-tool "geen driving"**, omdat
    ze de driving-lijst nog rechtstreeks lezen. De Gantt en het rapport gebruiken sinds deze PR de helper
    `drivingInfo.ts`, die "geen driving-informatie" onderscheidt van "berekend, niets driving"; de andere
    lezers nog niet. Gevonden bij de prestatiefixes voor grote planningen (rehab-2). Voorstel: dezelfde helper
    in die drie lezers. — S
114. **De motor plant een lopende taak op 100 % niet met zijn vastgelegde restduur.** Zo'n taak (status
    STARTED, `completion` 1, geen werkelijk einde) komt uit P6 als `TK_Active` op 100 %. In P6 eindigt
    "Duration 100 %" (rest 0) op de statusdatum; "Physical 100 %" (rest > 0) plant de rest in. OPS zet beide
    op het geplande einde; alleen de tweede klopt dan met P6. Gezien bij de corpusmeting van #353: 9 taken in
    4 bestanden (rehab-2 4, `p6_torture_test_v1.xer` A3040, `percent-complete-8.4.xer` 2, `invalid-8.4.xer`
    2). Het voorbeeld met 800 u rest staat in `percent-complete-8.4.xer` en `invalid-8.4.xer` (MPXJ-corpus),
    taak 101724 *Physical 100%*: `remainingMinutes` 48000, statusdatum 2015-02-24, in OPS einde 2015-07-13 16:00;
    taak 101720 *Duration 100%* (rest 0) eindigt in OPS op dezelfde datum. Besluit eigenaar 2026-10-14: IFC
    bewaart "lopend" nu (`IfcTask.Status` = 'STARTED', #357); de motor plant de
    vastgelegde rest in (optie 3) na de release, in het rekenprofielen-spoor. — B voor de OPS-kant (gemeten),
    S voor de P6-kant
122. **Een nachtband en een werkende uitzondering op de dag erna tellen dubbel.** Kalender met vrijdag
    22:00–06:00 (`workTime`, band tot minuut 1800) en een werkende zaterdaguitzondering 00:00–24:00: `CalendarEngine`
    telt op zaterdag 1.800 werkminuten, terwijl de dag er maar 1.440 heeft (de ochtendstaart van vrijdag en de
    uitzondering overlappen 00:00–06:00). Nagespeeld met `workMinutesBetween(za, zo)` = 1800. De XER-schrijver
    (`xerWriter.ts`, `workOnDate`) verenigt de banden tot 1.440, zonder melding; zie de vervolgpunten van PR #393
    (punt G). Voorstel: overlappende banden in de engine verenigen. — B

## Tabel, invoer en bediening

12. **Tabelkolom *Kalender*** toont en bewerkt het interne kalender-id (`cal-…`) in plaats van de naam. — B
13. **Tabelkolom *Kleur*** wordt in IFC bewaard, maar geen balk of rapport gebruikt hem. — B
14. **Ctrl+M en rechtsklik *Mijlpaal toevoegen*** maken een mijlpaal van type Keuring. Ctrl+M zet hem
    bovendien altijd onderaan en opent het paneel niet (gaat buiten `taskInsertActions` om). — B
15. **Rechtsklikmenu op een lege plek** (*Nieuwe taak*, *Plakken*) is dode code: geen route opent het. — B
16. **Taken kopiëren** heeft geen zichtbare bediening; alleen Ctrl+C/V met de Gantt in focus. — B
17. **Verwijderen zonder bevestiging**: `confirm.deleteTask` staat in de locales maar wordt nergens gebruikt. — S
18. **Hint *Sjabloon invoegen*** zegt "onder de geselecteerde taak"; de code maakt er de laatste subtaak van. — S
19. ***Spring naar vandaag* (Ctrl+Home)** springt naar de statusdatum als die er is. — S
20. **Hint *Taakbalken bij onderbrekingen*** zegt "rond niet-werkdagen"; de code stuurt alleen urentaken. — S
21. ***Rapport › Afdruk*** doet op het tabblad Rapport niets. — B
60. **Duur-kolom afgeknipt** in de standaard Gantt-weergave (WBS 60 + Taaknaam 240 + Duur 60 + de
    "+"-kolom): je leest "2c" in plaats van "2d", op 1600 én 1366 px breed. — B
63. **"Werkelijke einde"** (kolomnaam, `task.json:55`) tegenover "Werkelijk einde" elders (`common.json`). — S
90. **Een klik in een getalveld selecteert de waarde niet: typen voegt toe.** Duur in Eigenschappen: na één klik
    staat de cursor achter de 5 (selectie 1–1), dus `2` wordt 52 dagen en bij een urentaak `6h` na de 1 wordt
    16h; Max. eenheden in de nieuwe rij van het resourcepaneel: `2` wordt 21. Een dubbelklik selecteert de
    waarde wel. Gemeten met de stapscripts van de tutorials (`tests/browser/tutorials/`) en losse
    Playwright-proeven; de tutorials zeggen daarom nu "dubbelklik". Voorstel: de inhoud selecteren bij focus,
    zoals de tabelcel waarin typen al vervangt. Eenh./dag (Toewijzen ▾ en het blok Toewijzingen) niet apart
    gemeten. — B

## Kalenders

22. **Goede Vrijdag en Bevrijdingsdag** hebben `optional: true`, maar dat wordt nergens gelezen: ze worden
    altijd gegenereerd. — B
23. **Dagknoppen en werktijdblokken lopen uit elkaar**: *Za* aan telt voor dagtaken, niet voor urentaken. — S
24. **Urenplanning uit bij een kalender met werktijdblokken**: Begin/Einde/Pauze wijzigen `hoursPerDay`, maar
    niet de blokken. — S
25. **Kalendernaam in de wizard** is hardgecodeerd *Bouwkalender NL*, ook in het Engels (de
    tutorialgenerator schrijft *Construction calendar NL*). — B

## Bibliotheek, bezetting, extensies, AI

26. **AI-poortveld blijft vergrendeld** na *Poort bezet*/*Fout* terwijl de bridge niet draait
    (`portLocked = serverState !== 'off'`; voorstel `=== 'live'`). — B
27. **Mislukte ZIP/JS-installatie van een extensie** geeft geen melding, alleen `console.error`
    (`ExtensionManagerPanel` negeert `InstallOutcome`). — B
28. **Bezettingsoverzicht bij een verouderd actief project** mengt oude startdatums met een nieuwe duur of
    inzet, onder de tekst "laatst berekende cijfers". — B
29. **Hardgecodeerd Nederlands**: *Vereist Open Planner Studio ≥…* (`extensionLoader.ts:341`), foutmelding
    bij een ontbrekende permissie, "Het bestaande projectbestand is niet schrijfbaar." (`actualAutoSave.ts`),
    het CFB-citaat (`cfb.ts`) en bestandsnaamdelen `-voortgang`/`-bibliotheek`. Zie ook 61. — B (eerste),
    S (rest)
30. **Onbekende extensiepermissie** laat de installatie mislukken; de code-commentaren zeggen "wordt
    gefilterd". — S
31. **`companyLibrary.promoteHint`** noemt promoveren van resources via een knop die alleen voor kalenders
    bestaat. — S
32. ***Herkennen*: "Geen voorstel — kies handmatig"** zonder knop om handmatig te kiezen. — B
33. **Bibliotheekkalender verwijderen** gaat zonder bevestiging; daarna staat hij nog als *al gekoppeld*. — S
61. **PDF-bestandsnamen altijd Nederlands** (`-voortgang`, `-afwijkingen`), ook in het Engels
    (`ReportPanel.tsx:1143`, `useTableReportSpec.tsx`). — B
64. **Een uitgeschakelde `tutorials`-extensie wordt weer aangezet, ongeacht waar hij vandaan kwam**
    (review #261, punt O2). — S
65. **Andere extensies kunnen `host:`-events uitzenden** via `api.events.emit` (`extensionApi.ts:~322`;
    review #261, punt O3). — S
74. **Nederlandse parameternamen en enumwaarden in het MCP-contract.** Na de vertaling naar Engels zijn deze
    sleutels bewust gebleven (ze zijn invoercontract): `planner_list_tasks` `kritiek`/`van`/`tot`/
    `zonder_relaties`, `planner_get_resource_histogram` `van`/`tot` en `bucket: dag|week|maand`,
    `update_calendar` `generate.bouwvak: geen|noord|midden|zuid`, en de stapstatus van `planner_batch`
    (`uitgevoerd`/`gefaald`/`niet bereikt`). De beschrijvingen leggen ze in het Engels uit. Voorstel: Engelse
    aliassen, oude namen nog een tijd accepteren. — B
75. **AI-activiteitenpaneel toont tekst die niet via `t(...)` loopt.** De vaste markeringen
    "onparseerbaar request", "onparseerbaar antwoord", "fout" (`services/mcp/server.ts:~274/285/293`) en
    "… afgekapt" (`activityLog.ts`, `TRUNCATE_MARKER`) zijn hardgecodeerd Nederlands; daarnaast toont het
    paneel de rauwe foutmelding van een tool (sinds de vertaling Engels) en de rauwe JSON. Ook de knop
    *Nu backup maken* zet de rauwe foutmelding (`backup.ts` `makeManualBackup`, Nederlands) in
    `aiSafety.backupErr`. Voorstel: in het paneel de foutcode (`code`) via `t(...)` tonen en de ruwe tekst
    als detail. — B
76. **Nog Nederlandse tekst die via MCP bij de agent kan komen, buiten de vertaalde MCP-laag.** De
    solverfouten uit `scheduleErrorLegacyText` (`CPMSolver.ts:~339`, bv. "Kalender heeft geen werkdagen
    ingesteld"; MCP én extensies lezen die letterlijk), en meldingen uit gedeelde importcode die
    `import_schedule` doorgeeft (bv. `formatRegistry.ts:~99` "Onbekend XML-formaat…", `xerSourceArchive.ts`,
    `libraryOps.ts`). Of elk importpad werkelijk bij de agent uitkomt is afgeleid, niet nagespeeld. (De fout
    van `planner_get_planning_guide` is sinds de Engelse agentgids Engels.) — S (solver: B)
77. **`planner_batch` met alleen een `planner_level_resources`-stap op een verouderde planning laat een undo-stap
    achter, ook als er niets genivelleerd wordt.** De levelkern roept `ensureFreshSchedule` BINNEN de
    batch-transactie aan (`calendarResourceTools.ts:~1665`); de transactie meet die herrekening als datawijziging
    (`documentDataChanged` in `createMcpTransactions.ts`), dus volgt er een "MCP-bewerking"-undo-stap met
    `isDirty`. Nagespeeld met een tijdelijke case tegen de echte dispatcher: A→B, duur van A gewijzigd via de
    store, batch `[{ tool: 'planner_level_resources' }]` zonder resources ⇒ `delays: {}`, toch +1 undo-stap en
    vuil. Leesstappen hebben dit niet meer (de batch rekent ze vóór de transactie door, PR #285). Voorstel:
    dezelfde voor-de-transactie-verversing ook voor een levelstap. — B
78. **`planner_level_resources` meldt in "datums zoals opgeslagen" verschuivingen die geen nivellering zijn.**
    De preview rekent tegen een verse solve, niet tegen de opgeslagen datums. Nagespeeld met de fixture
    `tests/fixtures/recordedDatesIfc.ts` (geen resources), zonder `dryRun`: `delays: {}`, de modus blijft aan en
    er komt geen undo-stap, maar `shifts` meldt taak 1.2 `oldStart 2026-03-16 → newStart 2026-03-09` (het
    verschil tussen opgeslagen en herberekend). Een agent leest dat als effect van de nivellering. Dat `dryRun`
    hetzelfde meldt, is afgeleid (zelfde preview), niet nagespeeld. — B
82. **`planner_update_tasks` meldt een duur op een samenvattingstaak als `updated`, maar er verandert niets.**
    `fields.duration: 20` op een fase met één subtaak van 2 dagen: antwoord `ok`, de fase staat in `updated`,
    `planner_get_task` blijft `duration: 2` (afgeleid). Strijdig met "never silently ignored" in de
    tool-beschrijving. Nagespeeld via de echte dispatcher. Voorstel: per item weigeren met een reden ("de duur
    van een samenvattingstaak is afgeleid van zijn subtaken"); `planner_add_tasks` met een duur op een item dat
    kinderen krijgt idem nakijken. — B
83. **Leestool-beschrijvingen noemen `wbsCode` als schrijfveld, maar de schrijftools weigeren het.**
    `planner_get_project_overview` en `planner_get_task` (`readTools.ts:~1063`, `~1119`): "`wbs` here and
    `wbsCode` when writing (add_tasks/update_tasks)"; `taskFields.ts:153` weigert `wbsCode` ("the WBS code is
    derived"). Nagespeeld: `fields.wbsCode` ⇒ `itemRejections`. Voorstel: de zin uit beide beschrijvingen
    halen. — B
84. **`planner_get_project_overview` beschrijft `dur` als werkdagen**, maar de rij geeft de duur in de eigen
    eenheid van de taak met `durUnit` ernaast (`readTools.ts:~315`, `nativeDuration`); bij een urentaak zijn
    het dus uren. Alleen in de code gezien. — S
85. **Dezelfde voortgang geeft in één `planner_batch` een ander resultaat dan in losse calls.** Binnen een
    batch rekent `recomputeMidBatch` alleen vóór een lees- of levelstap (`batchTool.ts:~320`), dus tussen
    `planner_update_project` (statusdatum) en `planner_update_tasks` niet: de voortgang ziet de geplande
    datums van vóór de statusdatum. Nagespeeld via de echte dispatcher (netwerk en datums als bij 81, alleen
    percentages, geen datums): batch ⇒ Grondwerk werkelijk 7–11 juni, Fundering storten (50%) gestart op 10
    juni, projecteinde donderdag 24 juni (+1); losse calls ⇒ Grondwerk werkelijk 11–11 juni, Fundering
    storten geweigerd (geplande start na de statusdatum), projecteinde vrijdag 25 juni (+2). Met expliciete
    werkelijke datums zijn beide routes gelijk (23 juni, +0). Voorstel: na een statusdatumwijziging binnen
    een batch tussentijds herrekenen, of 81 oplossen zodat de afleiding niet van de route afhangt. — B
86. **`planner_list_tasks` met `zonder_relaties: true` meldt bladtaken die via hun fase in het netwerk zitten.**
    Het filter telt alleen relaties op de taak zelf (`readTools.ts:~392`), terwijl de solver een relatie op
    een samenvattingstaak doorgeeft aan haar bladtaken. Nagespeeld: Other —SS→ Fase X —FS→ Last, met
    bladtaak LeafA onder Fase X ⇒ het filter geeft `LeafA`, terwijl LeafA kritiek is en aan het netwerk
    hangt. De agentgids en `goed-plannen` waarschuwen er nu voor. Voorstel: relaties van voorouders
    meetellen, of het veld uitbreiden met "via fase". — B
87. **De beschrijving van `planner_update_calendar` zegt dat een ongebruikte kalender opslaan niet
    overleeft**, maar dat is sinds de A2-fix niet meer waar: `ifcReader.ts:~2801-2816` leest elke overige
    IFCWORKCALENDAR terug, en `tests/mcp/cases-uurkalender.ts:~615-624` pint dat vast. Gevonden doordat de
    eerste versie van de agentgids de zin overnam. Voorstel: de zin uit de beschrijving
    (`calendarResourceTools.ts:~1042`) halen; alleen het behoud van urenbanden van een ongebruikte
    urenkalender is apart te toetsen. — B
88. **Feestdagen gegenereerd vóór de taken dekken een lang project niet.** Zonder rekenresultaat geeft
    `calendarSpan` geen projecteinde door en neemt `computeGenerateSpan` startjaar−1 t/m startjaar+3
    (`calendarResourceTools.ts:~585`, `generateCalendarHolidays.ts:~62`). Nagespeeld: start 7 juni 2027,
    `generate` NL ⇒ 2026–2030; daarna een taak van 1500 werkdagen ⇒ einde 2033, nog steeds geen feestdagen
    na 2030; `generate` opnieuw ⇒ 2026–2034. De agentgids zegt nu dat je opnieuw genereert als het einde
    voorbij `generatedToYear` ligt. Voorstel: bij een herberekening waarvan het einde de spanne verlaat
    melden of bijgenereren. — B
89. **De publieke agentgids-URL is niet versiegebonden** (ontwerppunt). `/agent/planning-guide.md` op de
    website volgt de laatste deploy, terwijl een desktopversie zijn eigen kopie meelevert; een oudere app kan
    dus naar een gids wijzen die tools beschrijft die hij niet heeft. De gids zegt nu dat de kopie van de tool
    voorgaat. Voorstel: een versiepad (bv. `/agent/<versie>/planning-guide.md`) of de versie in de gids. — S
113. **`planner_export_ifc` herkent het eigen bestand niet bij een ander hoofdlettergebruik op macOS.** De
    weigering voor een stille schemawijziging (`fileTools.ts`, `refuseSilentSchemaChange`) vergelijkt paden
    alleen hoofdletterongevoelig bij een Windows-station. Op macOS is het bestandssysteem meestal
    hoofdletterongevoelig, dus `Model.ifc` tegenover `model.ifc` is hetzelfde bestand maar komt door de
    vergelijking. Symbolische links worden ook niet opgelost. Afgeleid uit de code door de review van #336,
    niet op een Mac nagespeeld. — S

## Bestanden en herstel

34. **Opslaan-knop in de titelbalk** heeft de tooltip "Opslaan als…". — S
35. **Showcase-voorbeelden openen als gewijzigd** (`applyDemoLibraryToShowcaseProject`). — S
36. **Herstelvenster na een gewone herlaad** in de browser, ook als alles was opgeslagen. — S
37. ***Herstellen* verwijdert ook onleesbare kopieën.** — S
38. **Firefox: *Recent*** opent een lege pagina (de knop staat er wel). — B
39. **Annuleren vanuit *Bestand › Exporteren*** springt terug naar Start (`exportAs` geeft `ok: true`). — S
46. **`.mpp` neemt de kritiek-drempel uit MS Project niet over als projectinstelling** (wel voor *Datums zoals
    opgeslagen*; MSPDI doet het wel). Gevolg: drempel 0 na openen. — B

95. **Recent opent een site-bestand met de bewaarde naam.** Is het bestand op de site hernoemd, dan zie je de
    nieuwe naam pas na openen via *Openen van de site*. Gemeld door de bouwer van #309. — S
96. **Het herstelmanifest schrijft een `version`, maar niemand controleert die** (`recoveryStore.ts`). Een
    oudere build leest een nieuwer manifest dus zonder waarschuwing. Gemeld door de bouwer van #309. — S
97. **De sluitvraag van een tabblad ligt op een vaste z-index 80**, de gewone dialogen op 50/60. Elke vraag die
    vanuit *Opslaan* in die sluitvraag opent, valt eronder en lijkt te hangen. De twee site-dialogen liggen
    daarom op `z-[90]`; een volgende vraag op die route moet hetzelfde doen. Gezien bij #309 met een
    browsertest. — B

98. **Browseropslag hangt niet aan de ingelogde gebruiker van de site.** Crashherstel (`ops-recovery`, met
    `siteFileId`) en de recente bestanden staan per browserprofiel, niet per gebruiker. Logt gebruiker A uit en B in
    op dezelfde browser, dan krijgt B de herstelvraag van A, en schrijft Ctrl+S na herstel naar het bestand van A
    met de rechten van B. Voorstel: de host levert een gebruikers-id en de tool sleutelt zijn opslag daarop.
    Gemeld door de review van #312. — S
99. **Crashherstel gebruikt `crypto.randomUUID` zonder terugval op twee plekken** (`recoveryStore.ts`, het nemen
    van een nieuwe sessie-id na een bezet tabblad). Die functie bestaat alleen in een veilige context (https of
    localhost); op een gewoon http-adres gooit hij. Gezien bij #309 in de nep-site op de dev-server via
    Tailscale (daar hersteld). Productie draait op https; de dev-server via een IP-adres niet. — S
107. **`IfcTaskTime.Completion` krijgt `0.00` bij een taak zonder voortgang.** Het attribuut is een
    `IfcPositiveRatioMeasure`, en die moet groter dan 0 zijn (regel WR1). `ifcTaskSlots.ts`, slot `completion`
    (`ifcCompletionReal(... ?? 0)`). IfcOpenShell 0.9.0 (`ifcopenshell.validate`) geeft één melding per taak
    zonder voortgang: 1155 in de 24 voorbeelden, 17 in het rijke testproject van `check-ifc-arity.ts`. Voorstel:
    `$` bij 0 (de reader leest `$` al als 0); niet uitgezocht of de aanwezigheidsregistratie in hetzelfde
    bestand dat toelaat. Gevonden bij #292, niet daar opgelost. — B
108. **Gehele getallen in `IFCREAL(...)` en `IFCMONETARYMEASURE(...)` zonder decimale punt.** STEP vraagt voor
    een REAL een punt (`8.`), de writer schrijft `8`. IfcOpenShell meldt dan
    `IfcPropertySingleValue :: NominalValue: Not valid`: 210 keer in de 24 voorbeelden, 17 keer in het rijke
    testproject (precies de 17 gehele waarden). Met `8.` in plaats van `8` verdwijnen de meldingen (met een
    script nagemeten). Plekken: `ifcWriter.ts`: eigen velden `number`/`cost` (`case 'number'`), de
    kalender-pset (`HoursPerDay`, `WorkStartHour`, `WorkEndHour`) en de resource-pset (`MaxUnits`,
    `CostPerHour`). Voorstel: één hulpfunctie voor een STEP-REAL, zoals `ifcCompletionReal`. Gevonden bij
    #292, niet daar opgelost. — B
109. **`StartTime`/`FinishTime` van `IfcWorkPlan` en `IfcWorkSchedule` komen uit de invoerdatums, niet uit de
    berekende planning.** `ifcWriter.ts` (blok `// Work plan & schedule`) neemt het minimum en maximum van
    `time.scheduleStart`/`time.scheduleFinish`. Dat zijn invoervelden (`ifcTaskSlots.ts`,
    `RECORDED_INPUT_SLOT_KEYS`). Het commentaar bij `ProjectStartDate` zegt dat deze plekken "de afgeleide
    plan-omvang (min/max van de taak-span)" dragen. Gezien in `examples/10-villa-wassenaar.ifc`: het
    werkschema eindigt op 2027-03-16, maar de laatste taak (Handover) eindigt volgens `IfcTaskTime`
    (EarlyFinish/LateFinish) op 2027-12-01. Zo staat het ook op main (1e192b31a en later). Na
    `MergeProjects` neemt IfcOpenShell deze datums over. Voorstel: de getoonde datums gebruiken (werkelijk,
    anders early, anders invoer), zoals de baseline doet. Gevonden bij #292, niet daar opgelost. — B
110. **Een samengevoegd 4D-bestand (bouwmodel plus planning) openen en weer opslaan wist het bouwmodel.** De
    writer schrijft alleen wat de app zelf kent; vreemde entiteiten zoals `IFCWALL`, `IFCBUILDING` en
    `IFCSITE` gaan niet mee (`ifcWriter.ts`). Nagemeten: `examples/10-villa-wassenaar.ifc` met ifcpatch
    `MergeProjects` (IfcOpenShell 0.9.0) samengevoegd met een model met 3 muren, daarna `readIFC` →
    `writeIFC`: 0 muren, 0 gebouwen, 0 terreinen; de 47 taken en 40 relaties blijven. Zo ook met de
    lezer en writer van main. De schemavraag maakt dit niet erger, maar *IFC4 houden* op een
    IFC4-bouwmodel kan doen denken dat het bestand heel blijft. De gids `howto-ifc-schema-kiezen`
    waarschuwt daarom: samenvoegen als laatste stap. Voorstel: bij openen melden dat opslaan de
    modelinhoud niet bewaart, of vreemde entiteiten letterlijk meenemen. Gevonden bij de review van
    #336. — B
112. **Na IfcOpenShell `MergeProjects` wordt een werkende uitzondering van een kalender een feestdag.** Het
    pset `OPS_Calendar` bewaart de werkende uitzonderingen als STEP-nummers (`WorkingExceptionIds`,
    `ifcWriter.ts` `writeCalendarGenerationMeta`). MergeProjects nummert alle regels opnieuw, dus die nummers
    wijzen daarna naar iets anders. Nagemeten met het rijke testproject van de oude writer
    (`tests/planning/fixtures/ifc-arity-oude-writer.ifc` en `…-merged.ifc`): `#37` (werkende uitzondering
    *Inhaalzaterdag*) is na de merge een `IFCTASKTIME`, `#192` (*Zaterdagdienst*) een `IFCPROPERTYSET`. De
    lezer leest beide daarna als feestdag: de projectkalender heeft 19 feestdagen en 0 werkende
    uitzonderingen in plaats van 18 en 1, de bibliotheekkalender *Tweeploegen* 2 feestdagen in plaats van 1.
    Zo ook met de lezer van main; de huidige writer bewaart de nummers op dezelfde manier. Voorstel: de
    uitzonderingen herkennen op iets dat een merge overleeft (naam en datum, of een GlobalId-achtige
    sleutel). Gevonden bij de herbeoordeling van #336. — B
115. **Na een IFC-round-trip veranderen status of percentage van XER-taken waarvan de P6-status de werkelijke
    datums tegenspreekt**, zonder datumwijziging. De XER-lezer houdt de P6-status aan; de IFC-lezer leidt de
    status af uit de actuals (`normalizeImportedProgress`). Gemeten over het XER-corpus (openen, opslaan als
    IFC, heropenen), met `IfcTask.Status` = 'STARTED' (zie 114): 11 taken. In `sample.xer` worden 9 taken
    met `TK_NotStart` en een werkelijk einde voltooid (van 0 % naar 100 %); in `synthetic_v2212.xer` worden 2
    taken met `TK_Active` op 0 % zonder actuals niet gestart. Daardoor verandert bij 4 fasen ook de rollup
    (`sample.xer` `xer-wbs:1:1` 0,171 → 0,951 en `xer-wbs:1:2` 0,583 → 0,833; `synthetic_v2212.xer`
    `xer-wbs:100:1` en `xer-wbs:100:2` van gestart naar niet gestart). De 101 taken in de twee MER-bestanden
    (geen `status_code`) veranderden vroeger ook; sinds de XER-lezer daar de status uit de voortgang afleidt
    (fix van punt 117) blijven ze gelijk. Opnieuw gemeten na die fix: 11 taken en 4 fasen, alleen in deze
    twee bestanden. Gemeld in het eindrapport bij #353
    (niet in de PR) als 120 taken in 6 documenten; de meting bij #357 vond vóór die fix 120 in 5 documenten,
    waaronder de 4 lopende taken op 100 % in rehab-2 die nu gelijk blijven. Voorstel: besluiten welke kant
    wint (P6-status of actuals) en dat in beide lezers gelijk trekken. — B
116. **`readIFC` geeft een fase op 100 % zonder werkelijk einde een verzonnen werkelijk einde** (en maakt een
    lopende fase voltooid). De writer schrijft de fase-rollup (`summaryProgress.ts`). Die kan een fase op
    100 % zonder werkelijk einde geven: STARTED als een niet-gestarte mijlpaal onder voltooide taken hangt, of
    COMPLETED als de taken eronder alleen voltooid of lopend op 100 % zijn. `normalizeImportedProgress` maakt
    van zo'n fase bij het lezen COMPLETED, met een werkelijk einde op de statusdatum. Na de solve rekent de rollup de fase opnieuw uit en is het weg; het telt dus alleen op
    paden zonder solve, zoals "Datums zoals opgeslagen" (`documentActivation.ts`). Gemeten met een script, op
    main en met #357 gelijk: fase P met alleen een lopende taak op 100 % (statusdatum 2015-01-07) krijgt AF
    2015-01-07; fase *Pre-Construction* in `demo-sample.xer` krijgt AF 2024-06-01T08:00. Direct na de
    XER-import (zonder IFC) heeft de fase geen werkelijk einde. Met #357 houdt de taak geen werkelijk einde
    meer, dus spreekt het einde van de fase haar taak nu tegen. Voorstel: fasen in de lezer niet door de
    voortgang-invarianten halen. — B (lezer), S (gevolg in "Datums zoals opgeslagen" niet nagespeeld)
118. **Een XER-activiteit met een onbekende `status_code` blijft "niet gestart", ook op 100 % of met een
    werkelijk einde.** `statusOf` (`src/services/xer/xerReader.ts`) geeft bij een onbekende tekst (bv.
    `TK_Weird`) de enum-fallback NOT_STARTED, met melding. Een lege of ontbrekende status leidt de lezer sinds
    de fix van 117 wel af uit de voortgang. MPXJ maakt van een onbekende tekst `null`, net als van een lege
    (`ActivityStatusHelper.getInstanceFromXer`, een `HashMap.get`). Check 117-20 in
    `tests/planning/check-xer-status-afleiden.ts` pint het huidige gedrag vast. In het XER-corpus komt het
    geval 0 keer voor. Gevonden bij de review van #358. Voorstel: een onbekende status behandelen als een lege
    (afleiden uit de voortgang, melding blijft), zoals MPXJ; besluit van de eigenaar nodig. — B

## Rondleiding, Help en extensie-gidsen

51. **Histogram-tooltip "0 taken dragen bij"** op de startdag van een urentaak: `contributingTaskNames` in
    `useGanttHistogramInteraction.ts` vergelijkt "2027-06-28" met "2027-06-28T07:00". Voorstel: vergelijken
    op `.slice(0,10)`. De balken zelf kloppen. — S
62. **Melding schuift over de knoppen van het begeleidingspaneel** (1600×950, venster Baselines open):
    `toastPlacement.ts` houdt geen rekening met het paneel. — B (gezien), oorzaak afgeleid
66. **Het UpdateDialog opent over een lopende gids heen** (review #261, punt O4). — S
67. **`pendingHelpSection` blijft hangen** (review #261, punt O7). — S
68. **Een gidsstap die eenmaal "gedaan" is, blijft gedaan**, ook na wisselen naar een leeg project. Gezien bij
    tutorial 6 stap 8; niet uitgezocht of dat bedoeld is. — S
72. **Tutorials-extensie linkt nog naar twee id's van vóór fase 4.** `extensions/tutorials/main.js` (branch
    `claude/tutorials-tut2-7`, ZIP 1.2.0) linkt in tutorial 5 met de tekst *Nivelleringsopties* / *Leveling
    options* naar `docs://ref-nivellering`, en in tutorial 4 naar `docs://ref-instellingen-lijst`. Beide werken
    via een alias (→ `howto-overbezetting-oplossen`, → `ref-instellingen`; in de productiebuild aangeklikt),
    maar de linktekst *Nivelleringsopties* past niet meer bij het artikel *Overbezetting oplossen*.
    Voorstel: in de extensie de nieuwe id's en titels gebruiken. — B

## Teksten en helpteksten

40. **Helptekst *Restwerk hervat na de al verstreken duur*** zegt in alle talen "niet op de statusdatum";
    de statusdatum blijft ook een ondergrens. Idem codecommentaar `CPMSolver.ts` ~2367, `types/project.ts`
    ~128. — B
41. **Intro *Instellingen uit het bronbestand*** zegt "uit een .xer"; verschijnt ook bij *Nieuw project* met
    Primavera P6. — B
42. **Helpteksten van enkele conventies** noemen hun voorwaarden niet (alleen urenkalender, alleen
    `.xer`-herkomst). — B
43. **EN-melding lege rapportperiode** zegt "Whole project"; de optie heet *Project duration*. — S
44. **Oude interne documentatie**: `docs/library.md` (standaardweergave resourcepaneel),
    `.claude/rules/mcp.md` (`MAX_PER_DOC`). — B
56. **nl-label "Orientatie:"** in de rapportopties mist het trema. — S
57. **Statusdatum-label in de Gantt** toont ISO (`2027-06-28`), de rest dd-mm-jjjj. Mogelijk bewust. — S
70. **`howto-structuur-aanpassen` zegt dat slepen in de Gantt "hetzelfde werkt als slepen in de lijst".** De
    oude gids `gids-plannen-wbs` en `docs/TODO.md` ("balk-mousedown") zeggen dat de balk altijd één taak
    verplaatst, ook bij een meervoudige selectie; in de lijst verhuist de hele selectie. Niet in de app
    nagespeeld. Voorstel: de zin nalopen en zo nodig "één taak" toevoegen (nl + en). — S
73. **Namen en beschrijvingen van de voorbeeldprojecten zijn Engels in elke interfacetaal.** Gezien in de
    nl-interface bij *Bestand › Voorbeelden*; de Help-artikelen noemen daarom de Engelse namen. Niet
    nagegaan of dat voor alle voorbeelden geldt. Voorstel: bewust laten, of per taal vertalen. — B

102. **`apply-terms` vertrouwt `terms-NN.json` en `terms-check-01.map.json` zonder zegel.** De UI- en
     docs-pakketten hebben sinds #323 een zegel (`build/translate-seal/`); de termbase-pakketten niet, terwijl
     agents in dezelfde map schrijven. Voorstel: dezelfde `seal`/`sealErrors` in `prepare`/`apply-terms`.
     Gevonden in de review van #323 (Opus, 2026-10-12), in de code aangewezen. — S

## Tests

50. **`check-ifc-roundtrip` faalde op 30-09-2026** omdat het aanmaaktijdstempel toevallig de gezochte datum
    bevatte (CI op #261). Niet aangepast sindsdien; afgeleid: hij faalt alleen op die ene datum en die is
    voorbij. Het profieldeel van dit punt is opgelost in #278. — B (gezien), S (afgeleid)
79. **`check-task-grid-performance` (relationIndex-mediaan ≤ 500 ms) zit lokaal op het randje.** Los gedraaid
    496–499 ms (5-10-2026); rood (535–790 ms) in `npm run verify` zodra de container druk is (meerdere agents
    tegelijk). In CI steeds groen. De grens meet de machine mee. Voorstel: grens relatief aan een
    referentiemeting in dezelfde run, of alleen in CI hard. — B
90. **`check-xer-tables` is rood als de `TextDecoder` van Node byte 0x80 (CP1252) niet naar € vertaalt**
    ("Café €" wordt "Café "; 6 asserties in deel 5). Gezien 7-10-2026 in een cloudcontainer (Node 22.22.0,
    ICU 77.1), óók op de onaangeraakte commit `c00163a`; daar geeft `new TextDecoder('windows-1252')` voor
    byte 0x80 geen €. De check hangt dus af van de ICU-build van Node, niet van de code. Voorstel: de
    check slaat deel 5 over (met melding) als die decoder 0x80 niet naar € vertaalt, of de reader decodeert
    CP1252 met een eigen tabel. — B (nagespeeld), oorzaak in de ICU-build afgeleid
91. **De browsersuite start niet in een container met alleen de voorgeïnstalleerde Chromium-1194**
    (`@playwright/test` 1.62.1 verwacht een nieuwere headless shell; `scripts/run-browser-tests.mjs`
    stopt dan met "Playwright headless shell ontbreekt"). Met `executablePath` naar
    `/opt/pw-browsers/chromium-1194` draaien de tests wel, maar elke test eindigt rood op één
    "Failed to load resource: 404" in de console, ook de bestaande `table-reports.spec.ts` (gedraaid op de
    branch van de DCMA-PR, die dat rapport niet raakt). Welke URL dat is, is niet vastgesteld. — S

100. **Tailwind v4 scant ook bestanden buiten `src/`**, zoals `scripts/`. Een token als `[a:b]` in een
    logtekst wordt dan een CSS-regel in de bundel. Gezien bij #308 met `[build:platform]` (+36 bytes CSS);
    de logtekst is daarom aangepast. Voorstel: de bronnen van Tailwind beperken tot `src/` en `index.html`. — B

103. **`scripts/run-ts.mjs` ruimt zijn tijdelijke map niet op.** Op de server stonden 1432 mappen
     `ops-runts-*` in `/tmp`. Gezien door de reviewer van #323 (2026-10-12), niet verder nagegaan. — S

104. **Geen automatische test voor de zegels en `check-docs`** (`scripts/translate/cli.ts`). In #323 alleen met
     de hand nagespeeld. De CLI werkt vanuit `process.cwd()`, dus een test in een tijdelijke map kan. — S

## Wensen en open taken (geen bug)

45. **Extensie-API**: extensies kunnen geen relatie of kalender gericht wijzigen en de selectie niet lezen.
    `updateSequence`/`updateCalendar` zou de tutorials eenvoudiger maken. Ook een alleen-lezen
    `api.settings.getApp(key)`: tutorial 4 leest nu `localStorage['ops-enableHourPlanning']`. — B
49. **Release-notes, volgende release**: een nieuw MS Project-project rekent de speling nu *Automatisch*
    (#277); projecten die eerder via de wizard *Kleinste* kregen, houden dat (geen migratie). — B
69. **Twee lege bestanden in de repo-root**: `dn.txt` en `dv.txt`, meegekomen in commit `b635c15c`
    ("merge: geen verzonnen projecteinde-anker …"). Voorstel: weghalen. — B
71. **De dode-link-check uit de `wiki`-skill meldt `project://start.ifc`** in `Extensions-Authoring.md`: dat
    staat in een codevoorbeeld (inline code), geen echte link. De check slaat inline code niet over, dus de
    dry-run is nooit "dead: 0". Voorstel: in de check eerst `` `…` `` strippen. — B
93. **Het venster *Nieuw project* heeft geen ?-knop**, terwijl `ref-projectinfo` (*Nieuw project en
    Projectinfo*) het ook beschrijft. De ?-knop van `ProjectInfoDialog` staat bewust alleen in de modus
    Projectinformatie (besluit eigenaar: zes vensters, de wizard hoort er niet bij). Voorstel: als de eigenaar
    dat wil, `help` ook in de wizard zetten, met `confirmLeave` zonder `dirty` (de wizard kent geen
    "niet toegepast"). — B
94. **Tab in een open tabelcel legt niets vast.** De cel-editor van het taakraster (`GridEditorHost`) kent
    alleen Enter en Escape; Tab verplaatst de browserfocus uit het invoerveld, zonder vast te leggen en
    zonder naar de volgende kolom te gaan. Bij snel invoeren via de spookregel (typ naam, Tab, typ duur)
    verwacht je het Excel-gedrag: vastleggen en een kolom verder (Shift+Tab terug). Gezien bij review
    vader, punt 1. — B
106. **De feedbackknop zet bij een gewone gebruiker geen label `bug`/`enhancement`.** `feedbackService.ts`
    (`buildGitHubUrl`) zet het label via `labels=` in de `/issues/new`-URL; GitHub past die parameter alleen toe
    voor wie labelrechten op de repo heeft. Het issue komt dus zonder soortlabel binnen. `needs-triage` komt er
    sinds `.github/workflows/triage-new-issues.yml` wel bij. Voorstel: die workflow leidt het soortlabel af uit de
    regel `Type: Bug`/`Type: Feature request` onderaan de body. Afgeleid uit de GitHub-documentatie over
    query-parameters, niet nagespeeld met een account zonder rechten. — S
