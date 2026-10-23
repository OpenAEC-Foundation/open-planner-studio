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

186. **B3-voltooidvenster met een dagkalender kan een TypeError geven.** Gemeld bij de onafhankelijke
    review van PR #480 op `620c9e775`: ook op basiscommit `522589202` zou de volledige CPM-route
    met `p6CompletedDataDateWindow` en een dagkalender falen. Exacte invoer en stack nog niet
    zelfstandig bevestigd; staat los van de PF-optimalisatie en is daar niet aangepast. — S

187. **Drie einddatumafwijkingen van de MPP-fidelitypin, ook met main.** Bij de integratie van
    PR #480 op main `3a2f597f3` geeft `check-mpp-fidelity.ts` voor het publieke
    `mpxj/junit/data/timephased-cost-rollup.mpp` `finishExact: 6` (pin 9) en `finishDiff: 3`
    (pin 0); ook de verzameling afwijkende bestanden wijkt daardoor af. Dezelfde uitslag met
    `CPMSolver.ts` en `ResourceLeveler.ts` uit die main-commit, zonder de PF-optimalisatie.
    De gecombineerde `measure:profiles` eindigt op exit 1; de P6-cellen zijn ongewijzigd.
    Geen baseline of motorcode hiervoor aangepast; oorzaak niet verder onderzocht. — B

## Tabel, invoer en bediening

13. **Tabelkolom *Kleur*** wordt in IFC bewaard, maar geen balk of rapport gebruikt hem. — B
16. **Taken kopiëren** heeft geen zichtbare bediening; alleen Ctrl+C/V met de Gantt in focus. — B
17. **Verwijderen zonder bevestiging**: `confirm.deleteTask` staat in de locales maar wordt nergens gebruikt. — S
60. **Duur-kolom afgeknipt** in de standaard Gantt-weergave (WBS 60 + Taaknaam 240 + Duur 60 + de
    "+"-kolom): je leest "2c" in plaats van "2d", op 1600 én 1366 px breed. — B

## Kalenders

22. **Goede Vrijdag en Bevrijdingsdag** hebben `optional: true`, maar dat wordt nergens gelezen: ze worden
    altijd gegenereerd. — B

198. **Een onparseerbare projecteinddatum kan een ongeldige kalendergeneratie-spanne geven.**
    `computeGenerateSpan` in `src/engine/calendar/generateCalendarHolidays.ts` haalt uit een
    geselecteerde einddatum direct het UTC-jaar. Bij bijvoorbeeld `endDate = 'ongeldig'` kan
    daardoor `to: NaN` ontstaan. Dit bestaande pad is niet afgedekt door de einddatummatrix;
    PR #535 verhelpt alleen de keuze van het UI-projectbereik en wijzigt dit foutpad niet.
    Statisch afgeleid bij de review op `71112e97`, niet lokaal uitgevoerd of in de app nagespeeld. — S

## Bibliotheek, bezetting, extensies, AI

28. **Bezettingsoverzicht bij een verouderd actief project** mengt oude startdatums met een nieuwe duur of
    inzet, onder de tekst "laatst berekende cijfers". — B
29. **Hardgecodeerd Nederlands**: "Het bestaande projectbestand is niet schrijfbaar."
    (`actualAutoSave.ts`), het CFB-citaat (`cfb.ts`) en bestandsnaamdelen
    `-voortgang`/`-bibliotheek`. Zie ook 61 voor PDF-bestandsnamen. — S
32. ***Herkennen*: "Geen voorstel — kies handmatig"** zonder knop om handmatig te kiezen. — B
33. **Bibliotheekkalender verwijderen** gaat zonder bevestiging; daarna staat hij nog als *al gekoppeld*. — S
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

## Bestanden en herstel

35. **Showcase-voorbeelden openen als gewijzigd** (`applyDemoLibraryToShowcaseProject`). — S
36. **Herstelvenster na een gewone herlaad** in de browser, ook als alles was opgeslagen. — S
38. **Firefox: *Recent*** opent een lege pagina (de knop staat er wel). — B
46. **`.mpp` neemt de kritiek-drempel uit MS Project niet over als projectinstelling** (wel voor *Datums zoals
    opgeslagen*; MSPDI doet het wel). Gevolg: drempel 0 na openen. — B

97. **De sluitvraag van een tabblad ligt op een vaste z-index 80**, de gewone dialogen op 50/60. Elke vraag die
    vanuit *Opslaan* in die sluitvraag opent, valt eronder en lijkt te hangen. De twee site-dialogen liggen
    daarom op `z-[90]`; een volgende vraag op die route moet hetzelfde doen. Gezien bij #309 met een
    browsertest. — B

98. **Browseropslag hangt niet aan de ingelogde gebruiker van de site.** Crashherstel (`ops-recovery`, met
    `siteFileId`) en de recente bestanden staan per browserprofiel, niet per gebruiker. Logt gebruiker A uit en B in
    op dezelfde browser, dan krijgt B de herstelvraag van A, en schrijft Ctrl+S na herstel naar het bestand van A
    met de rechten van B. Voorstel: de host levert een gebruikers-id en de tool sleutelt zijn opslag daarop.
    Gemeld door de review van #312. — S
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
118. **Een XER-activiteit met een onbekende `status_code` blijft "niet gestart", ook op 100 % of met een
    werkelijk einde.** `statusOf` (`src/services/xer/xerReader.ts`) geeft bij een onbekende tekst (bv.
    `TK_Weird`) de enum-fallback NOT_STARTED, met melding. Een lege of ontbrekende status leidt de lezer sinds
    de fix van 117 wel af uit de voortgang. MPXJ maakt van een onbekende tekst `null`, net als van een lege
    (`ActivityStatusHelper.getInstanceFromXer`, een `HashMap.get`). Check 117-20 in
    `tests/planning/check-xer-status-afleiden.ts` pint het huidige gedrag vast. In het XER-corpus komt het
    geval 0 keer voor. Gevonden bij de review van #358. Voorstel: een onbekende status behandelen als een lege
    (afleiden uit de voortgang, melding blijft), zoals MPXJ; besluit van de eigenaar nodig. — B

162. **Desktop (Linux/macOS): Opslaan overschrijft een alleen-lezen projectbestand als de map schrijfbaar
    is.** `replaceUserFile` (`atomicWrite.ts`) schrijft een halffabricaat met de rechten van het origineel
    (0444) en hernoemt het over het doel; op POSIX mag dat. Het bestand krijgt de nieuwe inhoud en blijft
    0444. Een editor als vim weigert hier zonder `!`. Gemeten met het echte bestandssysteem in
    `check-save-failure-status.ts` §1R (MEETING-regel 1R-d). Is de map ook alleen-lezen, of Windows met het
    kenmerk alleen-lezen, dan faalt opslaan wel netjes (zelfde check, §1 en §2). Voorstel: bij een doel zonder
    schrijfbit eerst vragen of melden. Een besluit voor de eigenaar. — B

201. **Het versieloze webherstelmanifest met `docIds` forceert `isDirty=true`.** In
    `recoveryStore.ts`, `loadWeb`, krijgt de terugvalmetadata voor `docIds` `isDirty: true`;
    `document.isDirty ?? rec.isDirty ?? true` kiest daardoor die `true`, ook als het oude
    documentrecord `isDirty: false` bevat. Statisch gezien bij het versiecontract van knownbug 96;
    de bestaande legacysemantiek is in die fix behouden. Mogelijk verwant aan de herstelmelding
    van 36, maar niet vastgesteld als dezelfde oorzaak. De bedoeling en runtimegevolgen zijn niet
    onderzocht. — S

203. **De updater gaat na een afgewezen recovery-flush door naar installatie.** Brononderzoek,
    niet uitgevoerd: `updaterService.ts`, `downloadAndInstall`, vangt een rejection van
    `flushRecoveryNow()` op en logt die, zonder de updateroute af te breken. Daarna probeert hij
    `update.install()` en, als die slaagt, `relaunch()`. De bronroute bestond al vóór fix 96; dit
    punt zegt niet dat iedere mislukte snapshotwrite als rejection uit de flush komt. Geen
    runtime-repro of concreet dataverlies vastgesteld; bedoeling en gewenste foutafhandeling
    niet onderzocht. — S

## Rondleiding, Help en extensie-gidsen

62. **Melding schuift over de knoppen van het begeleidingspaneel** (1600×950, venster Baselines open):
    `toastPlacement.ts` houdt geen rekening met het paneel. — B (gezien), oorzaak afgeleid
68. **Een gidsstap die eenmaal "gedaan" is, blijft gedaan**, ook na wisselen naar een leeg project. Gezien bij
    tutorial 6 stap 8; niet uitgezocht of dat bedoeld is. — S


## Teksten en helpteksten

57. **Statusdatum-label in de Gantt** toont ISO (`2027-06-28`), de rest dd-mm-jjjj. Mogelijk bewust. — S
73. **Namen en beschrijvingen van de voorbeeldprojecten zijn Engels in elke interfacetaal.** Gezien in de
    nl-interface bij *Bestand › Voorbeelden*; de Help-artikelen noemen daarom de Engelse namen. Niet
    nagegaan of dat voor alle voorbeelden geldt. Voorstel: bewust laten, of per taal vertalen. — B

200. **De strikte UI-vertaalpoort kan een volledig ontbrekende taalmap overslaan.**
    `status` in `scripts/translate/cli.ts` bepaalt zonder expliciete taal de UI-talen via de aanwezige
    mappen onder `src/i18n/locales/`. Ontbreekt bijvoorbeeld `lo/`, dan kan `status --strict` groen
    blijven wanneer de overige UI actueel is en de Lao-termbase geldig is. De bestaande mapinventarisatie
    staat los van de termbasedekking uit PR #537; die PR herstelt deze UI-inventarisatie niet.
    Statisch afgeleid bij de review op `78583d1b` (regels 896–900), niet lokaal uitgevoerd.
    De nieuwe CLI-test herstelt de verwijderde UI-map evenmin vóór zijn groene verwachting. — S

102. **`apply-terms` vertrouwt `terms-NN.json` en `terms-check-01.map.json` zonder zegel.** De UI- en
     docs-pakketten hebben sinds #323 een zegel (`build/translate-seal/`); de termbase-pakketten niet, terwijl
     agents in dezelfde map schrijven. Voorstel: dezelfde `seal`/`sealErrors` in `prepare`/`apply-terms`.
     Gevonden in de review van #323 (Opus, 2026-10-12), in de code aangewezen. — S

173. **Toewijzingen: lange kolomkoppen laten in veel talen weinig ruimte voor de resourcenaam.** De bron is kort
    (`task.json` `properties.assignments.units` "Units"/"Inzet", `workHours` "Work (h)"), maar de straat
    vertaalde naar de volle term (uk "Одиниця призначення", ru "Единицы назначения", bg, hu, ro, sk, da, nb,
    sv, cs, sr, hr). Gemeten bij een paneel van 320 px: in uk blijft voor de naamkolom 25 px over, in ru 47 px
    (nl 182 px). Bij 200 px en 125 % duwden ze in 13 talen de regels buiten het paneel; dat is in de release
    van v2026.10.0 opgelost met afkappen (`TaskAssignmentsSection.tsx`), de koppen zelf niet. Voorstel: korte
    koppen in die talen, en de Help-artikelen die ze citeren mee. — B


205. **Termbase kent nog het begrip *AI-assistent*.** `i18n/termbase/concepts.json` (`ai-assistant`, ook in
   `read-only`) en de doeltalen. De UI zegt nu *MCP-client*. Voorstel: het begrip omzetten via de
   vertaalstraat (`concepts-merge`, `apply-terms`) vóór de volgende release. — B

## Tests

79. **`check-task-grid-performance` (relationIndex-mediaan ≤ 500 ms) zit lokaal op het randje.** Los gedraaid
    496–499 ms (5-10-2026); rood (535–790 ms) in `npm run verify` zodra de container druk is (meerdere agents
    tegelijk). In CI steeds groen. De grens meet de machine mee. Voorstel: grens relatief aan een
    referentiemeting in dezelfde run, of alleen in CI hard. — B
199. **Linux-PR-CI kan stranden op de APT-updategrens via het officiële Ubuntu-archief.**
    Bij PR #536 op `cc7d2aef` haalde de update metadata op via `https://archive.ubuntu.com/ubuntu/`,
    maar na de start van de 14,1 MB `jammy/universe`-index brak de grens van twee minuten af met TERM.
    Frontendinstallatie en build waren nog niet gestart. Zie
    https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39859111765/job/120105089448.
    Dit is een afzonderlijke netwerk-/doorlooptijdbevinding na #515/#523; oorzaak en herhaalbaarheid
    zijn niet vastgesteld. De limieten en CI-poorten zijn niet verruimd. — B (CI-uitval), S (oorzaak)

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

104. **Geen automatische test voor de zegels en `check-docs`** (`scripts/translate/cli.ts`). In #323 alleen met
     de hand nagespeeld. De CLI werkt vanuit `process.cwd()`, dus een test in een tijdelijke map kan. — S

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

169. **`tests/browser/document-switch.spec.ts:75` (Gantt documenttabs herstellen beide paneviews en
   DOM-scrollbars) faalt soms in CI.** In de opbouw (`configureDocument`, regel 41) zet de test
   `setScroll(…, 190)` en leest daarna `scrollY: 0` terug. Gezien één keer in CI op PR #439
   (https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39577861612, job 119147770916),
   op een head die verder alleen de MCP-laag raakt; op de vier eerdere heads van die PR was hij groen.
   Lokaal 5× groen op `main` (b4ee5be3) en 25× groen op de PR na merge met main. Vermoedelijk zet iets de
   verticale scroll terug (begrenzing op de inhoudshoogte) voordat de inhoud er is; niet onderzocht. — S

178. **`gh pr edit --body-file` faalt op deze host door Projects Classic.** Bij het bijwerken
    van PR #479 op 2026-10-22 gaf de CLI `GraphQL: Projects (classic) is being deprecated`
    op `repository.pullRequest.projectCards`. De body is wel bijgewerkt via
    `gh api --method PATCH repos/OpenAEC-Foundation/open-planner-studio/pulls/479 -F body=@<bestand>`.
    Voorstel: de GitHub CLI op de host bijwerken; de repo zelf is niet aangepast hiervoor. — B

## Wensen en open taken (geen bug)

45. **Extensie-API**: extensies kunnen geen relatie of kalender gericht wijzigen en de selectie niet lezen.
    `updateSequence`/`updateCalendar` zou de tutorials eenvoudiger maken. Ook een alleen-lezen
    `api.settings.getApp(key)`: tutorial 4 leest nu `localStorage['ops-enableHourPlanning']`. — B
49. **Release-notes, volgende release**: een nieuw MS Project-project rekent de speling nu *Automatisch*
    (#277); projecten die eerder via de wizard *Kleinste* kregen, houden dat (geen migratie). — B
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
