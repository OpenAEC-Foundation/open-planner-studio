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

121. **Nivelleervenster: de piekmelding blijft leeg bij een eigen urenverdeling of capaciteitsstappen.** De
    nivelleerder kiest `INTRINSIC_OVERRUN` op de echte dagwaarden (`assignmentDayUnits`) en op
    `maxCapacityOf` met stappen (`ResourceLeveler.ts`); het venster vult de details in met `distributeUnits` en
    de vlakke `res.maxUnits` (`LevelingDialog.tsx:141-165`, `:293-304`). Dan ontbreken resource, piek en
    capaciteit in de melding. Niet nagespeeld. Zie ook 9. — S

## Tabel, invoer en bediening

12. **Tabelkolom *Kalender*** toont en bewerkt het interne kalender-id (`cal-…`) in plaats van de naam. — B
13. **Tabelkolom *Kleur*** wordt in IFC bewaard, maar geen balk of rapport gebruikt hem. — B
14. **Ctrl+M en rechtsklik *Mijlpaal toevoegen*** maken een mijlpaal van type Keuring. Ctrl+M zet hem
    bovendien altijd onderaan en opent het paneel niet (gaat buiten `taskInsertActions` om). Het lint geeft
    een mijlpaal een ander type: *Startmijlpaal* en *Eindmijlpaal* zetten `USERDEFINED` (werksoort *Overig*),
    en `check-tutorial-project.ts` legt dat laatste vast als bedoeld. Het type hangt dus van de route af
    (`shortcutRegistry.ts:376-380`, `GanttCanvas.tsx:403,1020`, `FullTaskGrid.tsx:799,1313`,
    `ribbonWidgets.tsx:188`). — B
15. **Rechtsklikmenu op een lege plek** (*Nieuwe taak*, *Plakken*) is dode code: geen route opent het. — B
16. **Taken kopiëren** heeft geen zichtbare bediening; alleen Ctrl+C/V met de Gantt in focus. — B
17. **Verwijderen zonder bevestiging**: `confirm.deleteTask` staat in de locales maar wordt nergens gebruikt. — S
18. **Hint *Sjabloon invoegen*** zegt "onder de geselecteerde taak"; de code maakt er de laatste subtaak van. — S
19. ***Spring naar vandaag* (Ctrl+Home)** springt naar de statusdatum als die er is. — S
20. **Hint *Taakbalken bij onderbrekingen*** zegt "rond niet-werkdagen"; de code stuurt alleen urentaken. — S
21. ***Rapport › Afdruk*** doet op het tabblad Rapport niets. — B
60. **Duur-kolom afgeknipt** in de standaard Gantt-weergave (WBS 60 + Taaknaam 240 + Duur 60 + de
    "+"-kolom): je leest "2c" in plaats van "2d", op 1600 én 1366 px breed. — B
135. **Vinkjes lijken op keuzerondjes.** De app-brede stijl `input[type="checkbox"]`
    (`src/styles/globals.css:2477`) geeft een vak van 15 px met `border-radius: var(--radius-sm)` (6 px) en
    zonder vinkteken. Het vak oogt daardoor rond, en aangevinkt is het een gevuld oranje rondje. Gezien bij
    *Screenshot bijvoegen* in het feedbackvenster. Voorstel: een kleinere radius (2–3 px) en een vinkteken. — S
136. **`.btn--secondary` valt meer op dan de primaire knop ernaast.** De stijl (`src/styles/globals.css:2207`)
    heeft een rand van 2 px in tekstkleur. Naast de oranje primaire knop trekt de secundaire knop zo de
    aandacht, bijvoorbeeld *Annuleren* naast *Versturen* in het feedbackvenster. Voorstel: een rand van 1 px in
    `--theme-control-border`. — S

## Kalenders

22. **Goede Vrijdag en Bevrijdingsdag** hebben `optional: true`, maar dat wordt nergens gelezen: ze worden
    altijd gegenereerd. — B


## Bibliotheek, bezetting, extensies, AI

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
78. **`planner_level_resources` meldt in "datums zoals opgeslagen" verschuivingen die geen nivellering zijn.**
    De preview rekent tegen een verse solve, niet tegen de opgeslagen datums. Nagespeeld met de fixture
    `tests/fixtures/recordedDatesIfc.ts` (geen resources), zonder `dryRun`: `delays: {}`, de modus blijft aan en
    er komt geen undo-stap, maar `shifts` meldt taak 1.2 `oldStart 2026-03-16 → newStart 2026-03-09` (het
    verschil tussen opgeslagen en herberekend). Een agent leest dat als effect van de nivellering. Dat `dryRun`
    hetzelfde meldt, is afgeleid (zelfde preview), niet nagespeeld. — B
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

124. **`planner_update_calendar` `generate` dekt het projecteinde niet als `endDate` gezet is.**
    `calendarSpan` (`calendarResourceTools.ts:585-590`) neemt `project.endDate || cpmResult.projectEnd`. Een
    `endDate` gaat dus voor het berekende einde. Loopt de planning daarna door, dan krijgen die jaren geen
    feestdagen en komt er geen waarschuwing; opnieuw genereren helpt niet, want de spanne blijft op `endDate`
    staan. Nagespeeld in een scratch-script (agent-audit 2026-10-19). Anders dan 88 (geen rekenresultaat).
    De UI-regeneratie gebruikt dezelfde `computeGenerateSpan` (`ResourceCalendarDialog.tsx:57`); of dat daar
    bedoeld is, is niet uitgezocht. Voorstel: het latere van `endDate` en het berekende einde nemen, of een
    `warnings`-regel geven. — B
125. **De eerste bibliotheek heet hardgecodeerd "Mijn resourcebibliotheek"**, ook in de Engelse app
    (`types/library.ts:63`). Ook de terugvalnamen "Nieuwe resourcebibliotheek" (`librarySlice.ts:414`,
    `libraryOps.ts:463`). Valt buiten 29. — B
126. **Updatevenster: de tekst *Bezig met installeren…* is niet te bereiken.** De balk met
    `updates.installing` staat achter `isDownloading` (`status.kind === 'downloading'`), terwijl de tekst
    `isReadyToInstall` (`'readyToInstall'`) vraagt (`UpdateDialog.tsx:125-128,205-208`). Na de download springt
    het venster naar *Herstarten…* (`:225-229`). Alleen in de code gezien. — S
137. **De MCP-bridge antwoordt op een notificatie met `200` en een lege body, niet met `202 Accepted`.** De
    MCP-spec (2025-06-18, Streamable HTTP) zegt: een geaccepteerde notificatie krijgt "MUST return HTTP status
    code 202 Accepted with no body". `handleMcpMessage` geeft dan `''` (`dispatcher.ts`), en `forward_to_webview`
    stuurt dat als `200 application/json` terug (`mcp_bridge.rs:331`). De officiële SDK-client (1.32.1), Claude
    Code 2.1.306 en `mcp-remote` 0.15.2 accepteren het (gemeten met `tests/mcp/cases-externe-client.ts`); een
    strikte client kan het weigeren. Gevolg bij de SDK: na `notifications/initialized` opent hij de GET-stream
    niet (die is er ook niet, 405). Voorstel: in Rust bij een lege antwoordbody `202` zonder Content-Type, en
    `bridgeMirror.ts` mee aanpassen. — B

164. **Nivelleren bij 10.000 taken: tijdens *Berekenen* blokkeert de UI toch 2,8–4,1 s.** De berekening zelf
    loopt in een Web Worker, maar de nulmeting (`npm run measure:large-plans`, 21-10-2026) zag in die fase één
    long task van 2.825–4.115 ms op de hoofdthread (5.000 taken: 741–802 ms). Vermoedelijke oorzaak: de
    voorsteltabel in `LevelingDialog.tsx:265` rendert alle 8.920 rijen zonder virtualisatie. Niet met een
    profiel bevestigd. — S

## Bestanden en herstel

35. **Showcase-voorbeelden openen als gewijzigd** (`applyDemoLibraryToShowcaseProject`). — S
36. **Herstelvenster na een gewone herlaad** in de browser, ook als alles was opgeslagen. — S
38. **Firefox: *Recent*** opent een lege pagina (de knop staat er wel). — B
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
119. **`.mpp`: een werkresource kan als materiaal binnenkomen.** `readResources`
    (`src/services/mpp/mppEntities.ts`) koppelt een resource aan het EERSTE FixedData-record met dezelfde
    uid, ook als dat een kort plaatshoudersrecord van 16 bytes is. MPXJ's `createResourceMap` slaat records
    korter dan de volle maat over. Gevolg: type (meta-item van de verkeerde index) en `maxUnits` komen uit het
    plaatshoudersrecord. Gemeten met MPXJ's `junit/data/mpp14resource.mpp`: *Wade Golden* en *Jon Iles*
    worden MATERIAL, in `mspdiresource.xml` (dezelfde planning) LABOR. Gevonden bij het importverslag
    (#391). Voorstel: records korter dan de volle maat overslaan, zoals MPXJ. — B

127. **IFC-tab *Toepassen* wist de bibliotheekkoppeling en zet *Niet opgeslagen* uit.** *Toepassen*
    (`IFCPanel.tsx:57-62`) roept `loadState` aan zonder `linkedOpen`; `applyLoadedProject` wist dan `companyId`
    en `companyName` (`fileSlice.ts:797-799`) en `isDirty` wordt `false` (`documentContract.ts:489`). Een
    gewijzigd project lijkt zo opgeslagen, en sluiten vraagt niets. Nagespeeld met het voorbeeld plus
    bibliotheek en een gewijzigde taaknaam: vóór `isDirty` true, erna false, `companyName` null, de wijziging
    blijft aanwezig. Voorstel: `isDirty` laten staan en de koppeling behouden. — B
128. **CSV: een datum in een onleesbare vorm wordt stil "vandaag".** `csvDateOrToday` valt terug op
    `localTodayIso()` (`importDates.ts:71-74`, gebruikt door `csvReader.ts:135`). De Help noemt alleen de drie
    geldige vormen. Of er elders een melding voor komt, is niet nagegaan. Niet nagespeeld. — S
153. **MSPDI: een onleesbare taakdatum bij een urentaak breekt de hele import af.** `<Start>NA</Start>` (of
    `<Finish>`, `<ActualStart>`, `<ConstraintDate>`, `<Deadline>`, `<EarlyStart>`, `<LateFinish>`) op een taak
    met een uurkalender gaat door `importDateTime(raw, true)` (`importDates.ts`) → `formatInstant` →
    `toISOString()` en geeft `RangeError: Invalid time value` (`mspdiReader.ts`, taakdatums, actuals,
    constraint, deadline en "datums zoals opgeslagen"). Nagespeeld met een tijdelijke check op main én op de
    lezer van vóór #392: in beide gevallen dezelfde `RangeError`, dus niet door #392 ingevoerd. Alleen
    ongeldige invoer (het schema eist `xsd:dateTime`). Gevonden bij de fix van VERVOLG 13 van #392.
    Voorstel: dezelfde regel als de baseline (`importDateTimeOrUndefined`): onleesbaar = ontbrekend, met de
    bestaande terugval per veld. — B
154. **P6 XML: dezelfde `RangeError` bij een onleesbare datum op een urentaak.** `p6xmlReader.ts` roept
    `importDateTime(raw, hourDates)` aan voor geplande start/finish, actuals, constraints en de opgeslagen
    datums (rond regel 920–982). Afgeleid uit de code, niet nagespeeld; de lezer is niet door #392
    veranderd. Voorstel: zoals 153. — S
155. **`.mpp` zonder veldkaarten: vaste kosten en tarieven ontbreken in het importverslag.** De terugval op de
    standaardveldkaarten kent die velden niet, dus het verslag meldt hun verlies niet. VERVOLG 5 van #392,
    gemeld door de reviewer. Niet nagespeeld. — S
156. **MSPDI-importverslag: één tariefrecord in tabel A met overwerktarief of gebruikskosten wordt niet
    bekeken.** `scanMspdiImportLoss` (`mspdiImportLoss.ts`, tarieven) kijkt bij tabel A alleen of er meer dan
    één record is; `OvertimeRate`/`CostPerUse` onder één `Rates/Rate` in tabel A geven geen melding.
    VERVOLG 6 van #392, gemeld door de reviewer. Niet nagespeeld. — S
157. **`.mpp`: een gedeelde lange aantekening wordt per verwijzing opnieuw verwerkt.** 1.000 taken × 64 KiB
    kost ongeveer 1,4 s. VERVOLG 8 van #392 (meting van de reviewer). Voorstel: cache per gedeeld datablok. — S
158. **`.mpp`-importverslag: een lege baselinedatum kan vals verlies geven.** `mppImportLoss.ts` controleert
    de ruwe bytes in plaats van `getTimestamp()`; de bytes `00 00 FF FF`, `FF FF 00 00` en `00 00 01 00`
    tellen dan als datum. Synthetisch; niet gezien in 34 echte bestanden. VERVOLG 9 van #392. — S
159. **`.mpp`-importverslag: verborgen RTF-metadata kan een niet-bestaande afbeelding of object melden.**
    Bijvoorbeeld `{\info{\title \\pict}}` in een aantekening. Voorstel: herkennen via de tokenizer. VERVOLG 10
    van #392. Niet nagespeeld. — S
160. **MSPDI-importverslag vergelijkt numerieke XML-waarden als tekst.** `<Number>00</Number>` telt niet als
    Baseline 0 (`baseline0Dates` in `mspdiImportLoss.ts` vergelijkt met `'0'`), terwijl de lezer
    (`getElementInt`) hem wel als Baseline 0 leest. `<TaskUID>01</TaskUID>` geeft bij gelijke baselines
    telling 1, terwijl de lezer wel aan taak 1 koppelt. VERVOLG 11 van #392. Voorstel: baselinenummer en
    taak-UID numeriek parsen zoals de lezer. — S
161. **Voortgangsblad: de preview maakt geen verschil tussen een onbekende taak-ID en een dubbele WBS.** Beide
    staan onder *Wacht op koppeling* (`ProgressImportDialog.tsx:147-149`), met alleen WBS en naam uit het blad,
    het bladrijnummer en *Kies een taak…* (r. 369-400). De reden (`unmatched` of `ambiguousWbs`) en de
    `OPS Task ID` uit het blad staan pas in het venster *Resultaat*, na *Toepassen* (r. 500). Een rij met
    alleen een onbekende ID en geen WBS of naam toont dus een lege kop. Dubbele rijen (`duplicateRow`) staan
    wel apart, met hun reden. De store-uitkomst is wel per soort apart: `check-progress-import-ronde.ts` deel D.
    Voorstel: in *Wacht op koppeling* de reden en de ID uit het blad tonen (#405 deel 5). — B (code en test)
162. **Desktop (Linux/macOS): Opslaan overschrijft een alleen-lezen projectbestand als de map schrijfbaar
    is.** `replaceUserFile` (`atomicWrite.ts`) schrijft een halffabricaat met de rechten van het origineel
    (0444) en hernoemt het over het doel; op POSIX mag dat. Het bestand krijgt de nieuwe inhoud en blijft
    0444. Een editor als vim weigert hier zonder `!`. Gemeten met het echte bestandssysteem in
    `check-save-failure-status.ts` §1R (MEETING-regel 1R-d). Is de map ook alleen-lezen, of Windows met het
    kenmerk alleen-lezen, dan faalt opslaan wel netjes (zelfde check, §1 en §2). Voorstel: bij een doel zonder
    schrijfbit eerst vragen of melden. Een besluit voor de eigenaar. — B
163. **Web: Ctrl+S op een vergrendeld bestand opent zonder uitleg de bestandskiezer.** `saveToRefWeb`
    (`webBackend.ts`) slikt elke fout (ook `NoModificationAllowedError`) en geeft `false`; `writeActiveDocument`
    valt dan terug op Opslaan als. Annuleert de gebruiker, dan komt er geen melding (het document blijft
    terecht gewijzigd). Gezien in `check-save-failure-status.ts` §3a/3b. Voorstel: een echte schrijffout
    melden vóór de kiezer verschijnt. — B
166. **Desktop: bij Openen en Importeren mist de reden in de foutmelding.** `fileSlice.ts` geeft daar
    `(err as Error).message` door (`openFailed` en `importFailureNotice`, drie plekken). Tauri-plugins weigeren
    met een tekst, niet met een `Error`, dus het detail is `undefined`. Bij Opslaan is dat in #434 opgelost met
    `saveErrorDetail`. Afgeleid uit de code, niet nagespeeld. Voorstel: dezelfde helper gebruiken. — S

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

130. **De omschrijving van het voorbeeld *Refurbishment & Extension of a Family Home*** belooft een conflict
    dat "'Distribute' can resolve" (`public/examples/manifest.json:7`, getoond in `Backstage.tsx`). Er is geen
    Verdelen-knop; alleen de kern bestaat (`distributeUnits`, `ResourceLoad.ts`). — B
131. **Engelse titel van het venster na een update is "You're up to date!"** (`en/common.json`
    `updates.justUpdated.title`). De Nederlandse is "Je bent bijgewerkt!". In het Engels leest dat als "geen
    update nodig". Voorstel: "You've been updated!". — B
170. **Vertaalstraat: een nieuw concept zonder doelterm valt niet op.** Na #376 stond `work-category`
    (werksoort) in `i18n/termbase/concepts.json`, maar in geen enkele `<taal>.json`. `validate-termbase` en
    `verify:translations` bleven groen. De straat hield toen de oude taaktype-term aan (bijv. de: `Neue Vorgangsart`),
    en de labelpoort dwong die oude tekst af. In de release-ronde van 2026-10-21 hersteld (termen +
    `--keys`-ronde). Voorstel: `validate-termbase` rood bij een concept zonder term in een taal. — B
171. **Meldingen met naam óf aantal verliezen de naam in talen met één meervoudsvorm.** `common.json`
    `notifications.milestoneRefusedAssignments_one`/`_other` (en `milestoneRefusedSummary`, `milestoneClearedOnPhase`)
    wisselen tussen "'{{task}}' heeft …" en "{{count}} taken hebben …". zh, ja, ko en lo kennen alleen `other`, dus
    bij één taak tonen ze "1 个任务…" zonder naam. De Help-labelpoort eist dan in `ref-meldingen` die `other`-vorm,
    terwijl het bronartikel de vorm met naam citeert: het artikel blijft rood in zh, ko en lo (ronde 2026-10-21).
    Voorstel: twee sleutels (met naam, met aantal) in plaats van een meervoud. — B
172. **Vertaalstraat: de korte uureenheid werd in ar en fa vertaald, tegen het besluit "10h".** `menu.json`
    `…hoursValue` werd in de ronde van 2026-10-21 `{{hours}}س`. De test
    `tests/browser/calendar-file-hours-notice.spec.ts:266` eist in ar/fa "10h" (besluit eigenaar 2026-10-20: geen
    spatie, getal en "h" als één LTR-reeks). Alleen de browsersuite in CI ving het; `verify:translations` en de
    straat zelf zagen niets. Met de hand teruggezet op `{{hours}}h`. Voorstel: in de straat een vaste-tekstregel
    per sleutel (bijv. in `i18n/termbase/`), zodat een volgende ronde dit niet opnieuw vertaalt. — B
173. **Toewijzingen: lange kolomkoppen laten in veel talen weinig ruimte voor de resourcenaam.** De bron is kort
    (`task.json` `properties.assignments.units` "Units"/"Inzet", `workHours` "Work (h)"), maar de straat
    vertaalde naar de volle term (uk "Одиниця призначення", ru "Единицы назначения", bg, hu, ro, sk, da, nb,
    sv, cs, sr, hr). Gemeten bij een paneel van 320 px: in uk blijft voor de naamkolom 25 px over, in ru 47 px
    (nl 182 px). Bij 200 px en 125 % duwden ze in 13 talen de regels buiten het paneel; dat is in de release
    van v2026.10.0 opgelost met afkappen (`TaskAssignmentsSection.tsx`), de koppen zelf niet. Voorstel: korte
    koppen in die talen, en de Help-artikelen die ze citeren mee. — B

## Tests

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

104. **Geen automatische test voor de zegels en `check-docs`** (`scripts/translate/cli.ts`). In #323 alleen met
     de hand nagespeeld. De CLI werkt vanuit `process.cwd()`, dus een test in een tijdelijke map kan. — S

120. **`delete-under-dialog.spec.ts` (regel 40) faalt soms op focus.** In CI-run 39384273333 (PR #392, browser
    1-4): `expect(locator).toBeFocused()` gaf `inactive`. Na een herhaling van de job groen, zonder wijziging;
    de PR raakt geen dialoog- of focuscode. Wisselvallig, oorzaak niet onderzocht. — S

165. **`window.__OPS__.gantt.paintCount` telt alleen in een dev-build.** `useGanttRendererHost.ts:32` roept
    `recordGanttPaint` aan achter `import.meta.env.DEV`; in een productiebuild met `VITE_OPS_BENCH_BRIDGE=1`
    blijft de teller 0. Een meting op die build moet de tekening zelf herkennen
    (`scripts/measure-large-plans.mjs` doet dat met een passieve wrapper om `fillRect`). Voorstel: de
    teller ook laten lopen als de brug in een productiebuild aan staat. — B

167. **Een browsershard van `ci.yml` blijft hangen voorbij `timeout-minutes: 45`.** Op 2026-10-21 bleef
   `verify (browser 2-4)` van run 39559601987 (PR #440) ruim 50 minuten `in_progress` in de stap
   *Verify (browser 2-4)*. Ook `gh run cancel` stopte hem niet; pas `force-cancel` via de API deed dat.
   Een herhaling slaagde in 12 minuten, en dezelfde shard slaagde lokaal (213 passed). Rond dezelfde tijd
   bleven ook shards van andere branches en van `main` lang `in_progress`. Dat wijst eerder op de runners
   dan op een test. — S

168. **Een IFC met een heel diepe WBS (6.000 niveaus) laat het openen vastlopen op een `RangeError`
   (Maximum call stack size exceeded).** Gezien via de headless kern: `openAsDocument` gooit die fout op
   een gegenereerd bestand met 6.000 geneste taken (`tests/planning/check-headless-core.ts` §4g). De kern
   vangt hem nu af als `PlannerCoreError` (`IFC_READ_FAILED`); de recursie zelf is niet opgelost. In de
   app zelf niet nagespeeld. Gemeld in de review van PR #440. — B
169. **`tests/browser/document-switch.spec.ts:75` (Gantt documenttabs herstellen beide paneviews en
   DOM-scrollbars) faalt soms in CI.** In de opbouw (`configureDocument`, regel 41) zet de test
   `setScroll(…, 190)` en leest daarna `scrollY: 0` terug. Gezien één keer in CI op PR #439
   (https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39577861612, job 119147770916),
   op een head die verder alleen de MCP-laag raakt; op de vier eerdere heads van die PR was hij groen.
   Lokaal 5× groen op `main` (b4ee5be3) en 25× groen op de PR na merge met main. Vermoedelijk zet iets de
   verticale scroll terug (begrenzing op de inhoudshoogte) voordat de inhoud er is; niet onderzocht. — S

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
133. **Het venster *Werkelijke start opgeven* heeft geen ?-knop** (`ActualStartDialog.tsx:82`,
    `DialogHeader` zonder `help`). Het doel zou `howto-voortgang-bijwerken` zijn. — B
134. **Werkelijke start en einde: paneel en dialoog weigeren een start na het einde niet, raster en startvraag
    wel.** `planProgressEntry` controleert `isActualFinishBeforeStart` alleen bij een antwoord op de startvraag
    (`progressEntry.ts:181`), terwijl `taskEditPlan.ts:625-632` het in het raster altijd doet. Een getypte start
    10-09 bij een einde 10-05 (of een einde 09-20 bij een start 10-01) wordt in het paneel en de
    taakdialoog geaccepteerd. Nagespeeld met `planProgressEntry` in een scratch-script (2026-10-19). Voorstel:
    de controle ook zonder antwoord uitvoeren. De Help (`ref-taak-eigenschappen`) beschrijft nu het raster
    en de startvraag. — B

137. **Lintmenu's sluiten niet met Escape.** De gedeelde `Popover` (`src/components/common/Popover.tsx`) sluit
    alleen bij een klik buiten het menu (`useClickOutside`); Escape doet niets. Dat geldt voor elk lintmenu
    dat `Popover` gebruikt, ook het nieuwe menu *Toon in de Gantt* van Baseline-overlay. Gezien in
    `tests/browser/multi-baselines.spec.ts` (2026-10-20). Voorstel: Escape in `Popover` laten sluiten en
    de focus terugzetten op de trigger. — B
