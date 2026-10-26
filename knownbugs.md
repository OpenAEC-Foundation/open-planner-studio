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

## Kalenders

22. **Goede Vrijdag en Bevrijdingsdag** hebben `optional: true`, maar dat wordt nergens gelezen: ze worden
    altijd gegenereerd. — B

## Bibliotheek, bezetting, extensies, AI

28. **Bezettingsoverzicht bij een verouderd actief project** mengt oude startdatums met een nieuwe duur of
    inzet, onder de tekst "laatst berekende cijfers". — B
33. **Bibliotheekkalender verwijderen** gaat zonder bevestiging; daarna staat hij nog als *al gekoppeld*. — S
74. **Nederlandse parameternamen en enumwaarden in het MCP-contract.** Na de vertaling naar Engels zijn deze
    sleutels bewust gebleven (ze zijn invoercontract): `planner_list_tasks` `kritiek`/`van`/`tot`/
    `zonder_relaties`, `planner_get_resource_histogram` `van`/`tot` en `bucket: dag|week|maand`,
    `update_calendar` `generate.bouwvak: geen|noord|midden|zuid`, en de stapstatus van `planner_batch`
    (`uitgevoerd`/`gefaald`/`niet bereikt`). De beschrijvingen leggen ze in het Engels uit. Voorstel: Engelse
    aliassen, oude namen nog een tijd accepteren. — B
75. **AI-activiteitenpaneel en handmatige backup tonen nog ruwe foutteksten.** Het paneel toont de
    rauwe foutmelding van een tool (Engels) en de rauwe JSON. De knop *Nu backup maken* zet de
    rauwe foutmelding (`backup.ts` `makeManualBackup`, Nederlands) in `aiSafety.backupErr`.
    Voorstel: in het paneel de foutcode (`code`) via `t(...)` tonen en de ruwe tekst als detail. — B

76. **Nog Nederlandse importtekst die via MCP bij de agent kan komen, buiten de vertaalde MCP-laag.**
    Meldingen uit gedeelde importcode die `import_schedule` doorgeeft (bv. `xerSourceArchive.ts`,
    `libraryOps.ts`). Of elk importpad werkelijk bij de agent uitkomt is afgeleid, niet nagespeeld. De
    solverfouten zijn inmiddels Engels; de UI blijft ze via code en parameters vertalen. — S
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
214. **De eigen XML-parser van de headless MCP-server heeft nog namespace- en encodinggaten.**
    `headless/mcp-server/src/xmlDom.ts` accepteert ongebonden prefixen; de bestandsroute in
    `headless/mcp-server/src/nodeFs.ts` detecteert geen UTF-16. Gevonden in review ronde 2 van PR #572
    (GPT-6.1-Sol). De aparte teken-/entiteitsproblemen en CRLF-normalisatie zijn gericht afgedekt.
    Voorstel: `@xmldom/xmldom` bundelen met een kleine adapter (DOCTYPE-beleid, strikte fouten), of
    namespacevalidatie en XML-byte-decoding gericht toevoegen met tests. — B
215. **Directory-durability bij headless opslaan blijft op Windows en nieuwe bovenmappen beperkt.**
    Linux/macOS synchroniseren nu de doelmap na `rename`, met een expliciete fout als dat mislukt nadat
    het bestand al vervangen is. Windows houdt alleen de bestands-fsync; nieuw aangemaakte bovenmappen
    worden niet als hele keten gesynchroniseerd. Echte stroomuitval is niet getest. Restpunt van review
    ronde 2 van PR #572. Voorstel: afzonderlijke platform-/crashbestendigheidstest en Windows-route. — B
217. **Het eigen tijdelijke bestand wordt na een mapwissel niet altijd opgeruimd.**
    `headless/mcp-server/src/nodeFs.ts:370`: is de map weg of niet meer bereikbaar, dan blijft
    `.<naam>.<willekeurig>.ops-save.tmp` staan (de docs zeggen dat nu ook). Gevonden in review ronde 2 van PR
    #572 (GPT-6.1-Sol). Voorstel: een opruimronde voor oude `ops-save.tmp`-bestanden bij de start, of melden
    waar het bestand staat. — B

218. **Headless MCP-server: de HTTP-time-out begrenst synchrone bestandstoegang niet.**
    `headless/mcp-server/src/nodeFs.ts:285` en `writeFileSync`/`fsyncSync` op 333–335 draaien synchroon; hangt
    lezen of synchroniseren op een trage schijf, dan staan alle sessies stil en kan de 120-secondentimer in
    `headless/mcp-server/src/http.ts` niet afgaan. Documentatie en broncommentaar benoemen nu expliciet
    de wachtrij-/eventloopgrens en dat een 504 geen lopende bewerking annuleert. Gevonden in review ronde 3
    van PR #572 (GPT-6.1-Sol). Resterend: grote bestanden op trage opslag meten voordat er een andere
    procesopzet komt; geen harde deadline of verholpen runtimeblokkade geclaimd. — B

210. **MCP-ontdekking: een update via de updater ruimt `runtime.json` en `open-files.json` niet op.** Alleen
    `src/hooks/useAppCloseGuard.ts:33` roept `shutdown()` aan;
    `src/services/updater/updaterService.ts:170–182` installeert en herstart rechtstreeks, en op Windows
    beëindigt de installer de app. De lezer herkent de resten aan het dode pid. Gevonden in review ronde 1 en
    2 van PR #573 (GPT-6.1-Sol). Voorstel: opruimen vóór de installatie, en opnieuw publiceren als de
    installatie mislukt. — B

211. **MCP-ontdekking: op Windows is niet bewezen dat alleen de gebruiker het tokenbestand kan lezen.**
    `src/services/mcp/discoveryFiles.ts:237–253` vertrouwt op de geërfde ACL van de profielmap; `plugin-fs`
    past `mode` alleen op Unix toe. Een bestaande of omgeleide gegevensmap met ruimere rechten maakt ook het
    tijdelijke tokenbestand leesbaar. Doc en gids zeggen nu dat dit niet apart gecontroleerd is. Gevonden in
    review ronde 1 van PR #573 (GPT-6.1-Sol). Voorstel: de ACL op Windows controleren (ook tijdelijk bestand
    en bestaande map), of geen token publiceren als de bescherming onvoldoende is. — B

322. **Een conflict tussen vastgepinde taken heeft geen reden.** `src/engine/scheduler/ResourceLeveler.ts:811`
    vult voor pinconflicten alleen `unresolved`. `src/services/library/distribute.ts:475` maakt daaruit een
    `DistributionShortfall` waarvan `reason` volgens regel 101 verplicht is: twee botsende pins plus één
    verplaatsbare taak geven twee tekorten met `reason: undefined`. De MCP-waarschuwing in
    `calendarResourceTools.ts:1621` verwijst dan naar een lege `unresolvedReasons`. De dialoog toont de
    conflicten wel goed. Voorstel: een ontbrekende reden expliciet in het typecontract, en de MCP-uitleg daarop
    aanpassen. Gevonden in review r1 van #594 (GPT-6.1-Sol). — B

320. **De koppeldialoog bouwt dezelfde optielijst drie keer per kandidaat.** `src/components/dialogs/LibraryLinkDialog.tsx:47`
    mapt de volledige bronlijst; regels 96–98 roepen dat apart aan voor `options`, `disabled` en `placeholder`.
    Dat maakt bij elke render onnodige arrays; een merkbare vertraging is niet aangetoond. Voorstel: één
    resourcelijst en één kalenderlijst per render, en die hergebruiken. Gevonden in review r1 van #635
    (GPT-6.1-Sol). — B

324. **Een tak in de herstelcontrole van de MCP-proxy is onbereikbaar.** `integrations/claude-desktop/src/proxy.ts:396`:
    de tak `toolName === null` kan niet meer optreden zodra `mutates` waar is. Voorstel: die deelvoorwaarde weg;
    de concrete herstelset blijft voldoende. Gevonden in review r1 van #605 (GPT-6.1-Sol). — B

331. **Met de werkmap `/` weigert de MCP-server `~/plan.ifc` als UNC-pad.** `src/services/mcp/tools/fileTools.ts:142–145`:
    bij `home="/"` maakt de tilde-expansie van `~/plan.ifc` eerst `//plan.ifc`, en de nieuwe UNC-controle weigert
    dat. Op `main` werd het `/plan.ifc`; het expliciete pad `/plan.ifc` werkt nog wel. Zeldzaam, geen dataverlies.
    Voorstel: bij tilde-expansie precies één scheidingsteken toevoegen, en de wortelmap aan de bestaande test
    toevoegen. Gevonden in review r1 van #626 (GPT-6.1-Sol). — B

## Bestanden en herstel

36. **Herstelvenster na een gewone herlaad** in de browser, ook als alles was opgeslagen. — S

97. **De sluitvraag van een tabblad ligt op een vaste z-index 80**, de gewone dialogen op 50/60. Elke vraag die
    vanuit *Opslaan* in die sluitvraag opent, valt eronder en lijkt te hangen. De twee site-dialogen liggen
    daarom op `z-[90]`; een volgende vraag op die route moet hetzelfde doen. Gezien bij #309 met een
    browsertest. — B

98. **Browseropslag hangt niet aan de ingelogde gebruiker van de site.** Crashherstel (`ops-recovery`, met
    `siteFileId`) en de recente bestanden staan per browserprofiel, niet per gebruiker. Logt gebruiker A uit en B in
    op dezelfde browser, dan krijgt B de herstelvraag van A, en schrijft Ctrl+S na herstel naar het bestand van A
    met de rechten van B. Voorstel: de host levert een gebruikers-id en de tool sleutelt zijn opslag daarop.
    Gemeld door de review van #312. — S
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

329. **Een mislukte opslag in de herstelronde houdt de installatie van een update niet tegen.**
    `src/hooks/useAutoSave.ts:72`: de geregistreerde herstelronde vangt opslagfouten zelf af en meldt ze, zonder
    opnieuw te gooien. Zulke fouten bereiken de blokkade van #589 (stoppen als `flushRecoveryNow()` faalt) dus
    niet. Dit stond al op `main`. Voorstel: de foutafhandeling van de periodieke auto-save scheiden van het
    resultaat van een expliciete flush vóór installatie. Gevonden in review r1 van #589 (GPT-6.1-Sol). — B

328. **De verliescategorie `criticalSlackLimitDays` is dode code.** `src/services/importTypes.ts:454` en
    `src/state/msProjectImportNotice.ts:22` houden de categorie, maar de importeurs zetten haar sinds de fix van
    knownbug 46 altijd op nul. Voor het commentaar over "bewaarde oude verslagen" is in de repo geen opslag- of
    leespad. Voorstel: veld, nulinitialisatie en meldingsregel weg, of het compatibiliteitscontract onderbouwen.
    Gevonden in review r1 van #634 (GPT-6.1-Sol). — B

330. **Een herstelmanifest `documents` zonder `isDirty` markeert een schoon document als gewijzigd.**
    `src/services/recovery/recoveryStore.ts:1361`: bij een geaccepteerd `documents`-manifest zonder `isDirty`, en
    `isDirty: false` in het documentrecord, gaf de basis `false` en geeft de nieuwe expressie `true`. Zeldzaam; het
    document vraagt dan onnodig om opslaan. Voorstel: bij ontbrekende manifestmetadata terugvallen op
    `rec.isDirty`, vóór de standaardwaarde `true`. Gevonden in review r1 van #599 (GPT-6.1-Sol). — B

## Rondleiding, Help en extensie-gidsen

68. **Een gidsstap die eenmaal "gedaan" is, blijft gedaan**, ook na wisselen naar een leeg project. Gezien bij
    tutorial 6 stap 8; niet uitgezocht of dat bedoeld is. — S


## Teksten en helpteksten

221. **Mogelijk onjuiste Portugese nulvorm bij aantalmeldingen.** Een nalezer meldde tijdens de
    releasevoorbereiding van 2026-10-24 dat het `pt`-pakket nul onder `one` indeelt, terwijl de stijl
    Europees Portugees gebruikt. De vertaling kan daardoor bijvoorbeeld `0 tarefa` opleveren.
    De pakketindeling `one: [0, 1]` is gezien; een bereikbare nulmelding in de app en de bedoelde
    Portugese taalvariant zijn niet gecontroleerd. Onderzoek die eerst voordat het meervoudscontract
    of de vertaling wordt aangepast. Gemeld bij `ui-common-01`, niet als releaseblokker aangetoond. — S

73. **Namen en beschrijvingen van de voorbeeldprojecten zijn Engels in elke interfacetaal.** Gezien in de
    nl-interface bij *Bestand › Voorbeelden*; de Help-artikelen noemen daarom de Engelse namen. Niet
    nagegaan of dat voor alle voorbeelden geldt. Voorstel: bewust laten, of per taal vertalen. — B

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

327. **`apply-terms` eindigt met exit 0 als een deel van de pakketten geweigerd is.** `scripts/translate/cli.ts:275`
    slaat een pakket met een ongeldig zegel over; is een ander pakket geldig, dan schrijft hij dat en eindigt
    succesvol. Nagespeeld: intact `terms-01.json`, gewijzigd `terms-02.json` → uitvoer `XX … veranderd na
    prepare`, alleen de eerste term toegepast, exit 0. Automatisering ziet half werk dan als geslaagd. Voorstel:
    een weigeringsteller en een afsluitende exit 1, zoals bij `apply ui`. Gevonden in review r1 van #618
    (GPT-6.1-Sol). — B

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

91. **De browsersuite start niet in een container met alleen de voorgeïnstalleerde Chromium-1194**
    (`@playwright/test` 1.62.1 verwacht een nieuwere headless shell; `scripts/run-browser-tests.mjs`
    stopt dan met "Playwright headless shell ontbreekt"). Met `executablePath` naar
    `/opt/pw-browsers/chromium-1194` draaien de tests wel, maar elke test eindigt rood op één
    "Failed to load resource: 404" in de console, ook de bestaande `table-reports.spec.ts` (gedraaid op de
    branch van de DCMA-PR, die dat rapport niet raakt). Welke URL dat is, is niet vastgesteld. — S

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

212. **Real-app-test van de MCP-ontdekking mist echte bestandsroutes.**
    De pids van `runtime` en `open-files` worden inmiddels rechtstreeks vergeleken. Echte openen-,
    Opslaan als- en afsluitroutes ontbreken nog (de storetest zet `filePath` rechtstreeks).
    Gevonden in review ronde 1 en 2 van PR #573 (GPT-6.1-Sol). Resterend: de bestaande echte-app-route
    uitbreiden met echte bestandsacties, inhoud en opruiming. — B

224. **RTL-balksleeptest faalt incidenteel zonder aangetoonde oorzaak.** In PR #635 op
    `3ca78f26234ddfed8e6fd4341a8f9e0ee44ec66a`, run 40157918525 poging 1, bleef bij
    `gantt-drag-undo.spec.ts:313` de taakvolgorde na balkslepen ongewijzigd, terwijl de voorafgaande
    rijsleep wel verplaatste. Dezelfde head slaagde in poging 2 zonder codewijziging; ook de eerdere
    PR-head was groen. Screenshot/trace: artefact 12585687942. Geen Gantt-code in deze PR gewijzigd;
    timing-/geometrieoorzaak en productreproduceerbaarheid nog niet vastgesteld. — S

321. **De browsertest voor een kapot `.mpp`-bestand toetst geen bestaand werk.** `tests/browser/new-open-task-flow.spec.ts:58`
    zegt dat bestaand werk behouden blijft, maar vergelijkt met een leeg beginproject (de fixture doet
    `newProject()` en voegt geen taak toe). Een losse probe met gewijzigd werk slaagt wel. Voorstel: één taak in
    de beginstaat en ook de dirty-vlag controleren. Gevonden in review r1 van #636 (GPT-6.1-Sol). — B

323. **De regressietest van de MCP-proxy mist annuleren na een 404.** `tests/mcp/cases-mcpb.ts:411` toetst
    annuleren tijdens verbinden vanuit offline toestand, maar niet de registratie vóór de tweede
    verbindingspoging na `404`. Een losse proef van de reviewer bevestigt dat die route werkt. Daarnaast zijn de
    annuleringscontroles op `integrations/claude-desktop/src/proxy.ts:402` en `:418` overbodig: op die routes zit
    sinds de vorige controle geen nieuwe asynchrone onderbreking. Voorstel: de 404-route in de test, en de twee
    regels weg. Gevonden in review r1 van #603 (GPT-6.1-Sol). — B

325. **Zes browserroutes toetsen geen smal scherm meer.** Sinds de standaardtakenlijst 400 px breed is, zetten zes
    specs het venster op 1600×900, onder meer `tests/browser/duration-display.spec.ts:5`. De handelingen en
    controles blijven, maar de smallere beginstand wordt niet meer bewaakt. Geen productfout op die breedte
    aangetoond. Voorstel: één gerichte interactieroute op een smaller scherm houden. Gevonden in review r1 van
    #627 (GPT-6.1-Sol). — B

326. **De controle bij het annuleren van een faseovergang vergelijkt toewijzingen alleen op id.**
    `tests/browser/structural-transition.spec.ts:113` vergelijkt toewijzingen als `[id, taskId]`. Een gewijzigde
    resource of inzet glipt daar doorheen. Dit stond al op `main`. Voorstel: daar ook de volledige
    toewijzingswaarden vergelijken, zoals de mijlpaalroute nu doet. Gevonden in review r1 van #622
    (GPT-6.1-Sol). — B

## Wensen en open taken (geen bug)

45. **Extensie-API**: extensies kunnen geen relatie of kalender gericht wijzigen.
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
