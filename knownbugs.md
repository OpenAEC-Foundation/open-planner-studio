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
    ingesteld"; MCP én extensies lezen die letterlijk), de fout van `planner_get_planning_guide` als de gids
    niet laadt (`guideTools.ts:~141`), en meldingen uit gedeelde importcode die `import_schedule` doorgeeft
    (bv. `formatRegistry.ts:~99` "Onbekend XML-formaat…", `xerSourceArchive.ts`, `libraryOps.ts`). Of elk
    importpad werkelijk bij de agent uitkomt is afgeleid, niet nagespeeld. — S (solver en gids: B)
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

## Bestanden en herstel

34. **Opslaan-knop in de titelbalk** heeft de tooltip "Opslaan als…". — S
35. **Showcase-voorbeelden openen als gewijzigd** (`applyDemoLibraryToShowcaseProject`). — S
36. **Herstelvenster na een gewone herlaad** in de browser, ook als alles was opgeslagen. — S
37. ***Herstellen* verwijdert ook onleesbare kopieën.** — S
38. **Firefox: *Recent*** opent een lege pagina (de knop staat er wel). — B
39. **Annuleren vanuit *Bestand › Exporteren*** springt terug naar Start (`exportAs` geeft `ok: true`). — S
46. **`.mpp` neemt de kritiek-drempel uit MS Project niet over als projectinstelling** (wel voor *Datums zoals
    opgeslagen*; MSPDI doet het wel). Gevolg: drempel 0 na openen. — B

## Rondleiding, Help en extensie-gidsen

54. **Rondleiding slaat stap 6 (*Voorbeelden*) over als de Backstage nog niet geladen is.** `Backstage` is
    lazy (`App.tsx:81`); `TourOverlay` zoekt het anker na twee rAF's en gaat bij een ontbrekend anker meteen
    door. Op een trage verbinding of machine mist de gebruiker die stap. Gezien in CI (#278) en lokaal
    nagespeeld met een vertraagde module. Voorstel: het anker kort laten afwachten voordat de stap wordt
    overgeslagen. — B
51. **Histogram-tooltip "0 taken dragen bij"** op de startdag van een urentaak: `contributingTaskNames` in
    `useGanttHistogramInteraction.ts` vergelijkt "2027-06-28" met "2027-06-28T07:00". Voorstel: vergelijken
    op `.slice(0,10)`. De balken zelf kloppen. — S
52. **Tour-anker `ribbon:resources:resourceAssign` verdwijnt** zodra een extensie met lintknoppen is
    geïnstalleerd en de taakselectie wisselt; de markering valt dan terug op de linttab. — S
59. **Begeleidingspaneel van een extensie-gids** wijkt uit voor een anker eronder, maar springt daarna niet
    terug; op 1366×768 bedekt het zo de histogramlijst. — S
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

## Tests

50. **`check-ifc-roundtrip` faalde op 30-09-2026** omdat het aanmaaktijdstempel toevallig de gezochte datum
    bevatte (CI op #261). Niet aangepast sindsdien; afgeleid: hij faalt alleen op die ene datum en die is
    voorbij. Het profieldeel van dit punt is opgelost in #278. — B (gezien), S (afgeleid)
79. **`check-task-grid-performance` (relationIndex-mediaan ≤ 500 ms) zit lokaal op het randje.** Los gedraaid
    496–499 ms (5-10-2026); rood (535–790 ms) in `npm run verify` zodra de container druk is (meerdere agents
    tegelijk). In CI steeds groen. De grens meet de machine mee. Voorstel: grens relatief aan een
    referentiemeting in dezelfde run, of alleen in CI hard. — B
80. **Rondleidingstests soms rood in CI: de knop *Close* van de laatste stap is "not visible"**
    (`tests/browser/first-start-tutorial.spec.ts`, 3 tests tegelijk; CI-job 112313353930 op #285, 6-10-2026).
    De herhaalde job was groen, lokaal 20/20 groen; de diff van #285 raakte de rondleiding niet. Oorzaak
    onbekend; mogelijk verwant aan 54 (stap overslaan bij een nog niet geladen Backstage). — B (gezien),
    oorzaak onbekend

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
