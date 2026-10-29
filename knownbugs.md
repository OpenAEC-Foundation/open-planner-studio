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
144. **Het einde van een kalendertijd-taak is in het dagpad half inclusief.** Het dagpad schrijft het einde als
    start + n kalenderdagen, maar leest die datum daarna als de laatste dag. Nagespeeld met de planningsharness
    (dagkalender ma-vr): een kalendertijd-taak van 1 d vanaf ma 1 jun krijgt einde 2 jun, en haar FS-opvolger
    begint wo 3 jun in plaats van di 2 jun; met FNLT ma 1 jun krijgt ze speling −1, terwijl ze om middernacht
    klaar is. In uur-modus klopt het wel (`msp-19`). — B
146. **Bij FF tussen urentaken staat de late finish van de voorganger op een blokbegin**, in het OPS- en het
    MSP-profiel. Alleen de getoonde datum verschilt; de speling klopt. In het P6-profiel lost conventie B2
    (`p6BackwardLagFinishBoundary`, `registry.ts:156`) het op; voor MSP is het een conventievraag. Gemeld door
    de bouwer van #402. — B (volgens de bouwer van #402; niet door deze agent herhaald)
119. **Een WBS-sjabloon verliest een lag in uren.** `wbsTemplates.ts:99-105` neemt per relatie `lagDays`,
    `lagUnit` en `lagPercent` mee, maar niet `lagMinutes`. Een relatie met lag `4u` komt na het invoegen van
    het sjabloon zonder lag terug, zonder melding. Gezien in de code (`Sequence.lagMinutes`,
    `types/sequence.ts:23`); niet in de app nagespeeld. Voorstel: `lagMinutes` meenemen in
    `WbsTemplateSequence`. — S
121. **Nivelleervenster: de piekmelding blijft leeg bij een eigen urenverdeling of capaciteitsstappen.** De
    nivelleerder kiest `INTRINSIC_OVERRUN` op de echte dagwaarden (`assignmentDayUnits`) en op
    `maxCapacityOf` met stappen (`ResourceLeveler.ts`); het venster vult de details in met `distributeUnits` en
    de vlakke `res.maxUnits` (`LevelingDialog.tsx:141-165`, `:293-304`). Dan ontbreken resource, piek en
    capaciteit in de melding. Niet nagespeeld. Zie ook 9. — S
122. **Nivelleervenster: onder *Resterende conflicten* staat altijd "Deze taken passen niet binnen hun
    speling"**, ook zonder smoothing (`LevelingDialog.tsx:282`, `resource.leveling.remainingConflictsHint`).
    De tekst noemt een oorzaak die niet voor elk conflict geldt. Zie ook 9. — B
153. **Een SF-opvolger van een eindmijlpaal op een blokeinde schuift bij een urentaak één werkdag op.**
    Nagespeeld met de planningsharness (kalender ma-vr 07-12 + 13-16, FINISH-mijlpaal M met start
    `2026-06-01T16:00`, urentaak B 16 u, SF+0 van M naar B): B loopt van di 07:00 tot wo 16:00. De eis is
    "B eindigt niet vóór ma 16:00", dus verwacht ma 07:00 tot di 16:00. VERMOED: `sfReqFinishHour` zet het
    anker met `predStartsNextDay` naar het volgende blokbegin (`relationMath.ts:737`). In de minutenmodel-runs
    van F0 maakt dit `mk-14` rood in beide runs (de omzetting zet een eindmijlpaal op het einde van de
    werkdag). Spec `2026-10-20-alleen-uren-design.md` §4.3. — B
154. **Een automatisch geplande mijlpaal met een anker mét tijd op een niet-werkdag blijft daar staan.**
    `ownAnchor` snapt een mijlpaal van duur 0 alleen bij een anker zonder tijd (`CPMSolver.ts:1112-1116`).
    Nagespeeld met de planningsharness (kalender ma-vr 07-12 + 13-16, mijlpaal B met start
    `2026-06-06T07:00`, een zaterdag): B blijft za 07:00. Met start `2026-06-06` gaat hij naar ma 07:00
    (`msp-56`). Vandaag bewust (zie de toelichting bij `ownAnchor`), maar na de omzetting naar momenten
    heeft elk anker een tijd: dan verschuift `msp-56` B niet meer (rood in beide minutenmodel-runs van F0).
    De spec zegt bij D4 dat geplande datums toch naar de volgende werktijd schuiven; voor deze mijlpaal klopt
    dat niet. Hoort bij F1/F2. — B
155. **Een kalendertijd-opvolger na FS met een lag in kalendertijd begint pas op het volgende werkmoment.**
    `forwardHour` geeft voor FS met een kalendertijd-lag `se.availableStart(target)` terug
    (`relationMath.ts:643`). Nagespeeld met de planningsharness (kalender ma-vr 07-12 + 13-16, P 16 u, FS+1
    kalenderdag naar kalendertijd-taak A): P eindigt di 16:00, A begint do 07:00 in plaats van wo 16:00.
    Bij FF en SF mag een kalendertijd-taak wel op een niet-werkmoment beginnen (`msp-23`, `msp-25`). Of
    FS hier hetzelfde moet doen, is niet vastgesteld. In de minutenmodel-runs van F0 maakt dit `msp-51` rood
    op het vroege einde (ma 07:00 tegen ma 00:00). — S

186. **B3-voltooidvenster met een dagkalender kan een TypeError geven.** Gemeld bij de onafhankelijke
    review van PR #480 op `620c9e775`: ook op basiscommit `522589202` zou de volledige CPM-route
    met `p6CompletedDataDateWindow` en een dagkalender falen. Exacte invoer en stack nog niet
    zelfstandig bevestigd; staat los van de PF-optimalisatie en is daar niet aangepast. — S

311. **Een urentaak na een FF-relatie met een kalendertijdlead kan vóór haar finish-ondergrens eindigen.**
    Nagespeeld in de minutenmodelmeting van F1b: kalender ma-vr 07-12 + 13-16, A 48 u eindigt ma
    8 juni 2026 16:00; FF −2 kalenderdagen naar B 32 u geeft B di 2 juni 07:00–vr 5 juni 16:00.
    De eis ligt za 6 juni 16:00; het einde ligt dus ervoor. Het dagenmaatpad haalt na F1b wel de
    dagverwachting van lagadv-ff-lead-ed; run 2 blijft rood op B, niet meer op de werkdagenlag van C.
    De bestaande urencases en N1 laten hier geen algemene grensnormalisatie toe; apart uitwerken. — B

312. **De corpuspin van expectedFinishDates in de SCHEDOPTIONS-check is rood op de integratiebasis.**
    check-xer-schedule-options-corpus.ts eindigt op Node 22.23.4 met de fout
    "expectedFinishDates zelfstandige per-bestand/as/populatie en richting blijven exact gepind".
    Dezelfde fout in een schone kopie van 12abaabf2 en tijdens de volledige F1b-suite, met het aanwezige
    corpus van 93 XER-bestanden. Geen pin of controle aangepast; oorzaak buiten F1b. — B

230. **Een mijlpaal na een FF-relatie (mk-05a, M2) verliest zijn kritieke pad, als de voorganger in de
     urenmaat telt.** A krijgt een late finish op vrijdag 13:00, speling 0,625 d, en is niet meer kritiek.
     Gemeld in review F1 r1 (#563). Een algemene verbreding van de grens maakt drie C7-controles
     rood. F3c repareert het voor een voorganger in de dagenmaat (OPS-profiel; `relationMath.ts`,
     `isInsideBlock`, case `f3-startmijlpaal-ff-midden-in-blok`). Het blijft voor een urentaak en voor
     een dagtaak onder P6/MSP (minutenmodel run 2, `mk-05a` in `minute-model-runs.json`). — B

231. **FF vanaf een voltooide voorganger met een einde buiten werktijd laat de opvolger te vroeg eindigen.**
     Kalender 08:00–16:00, werkelijk einde wo 18:00, FF +0eu naar een opvolger van 2 u.
     De opvolger eindigt wo 16:00, vóór het voorgangereinde. Dat geldt onder OPS, P6 en MSP.
     `relationMath.ts:255` sluit FF uit van de aparte eindondergrens. Voorstel: behoud die
     ondergrens, zoals het SF-pad doet. Bestond al vóór F1 (`12abaabf2`). Review F1 r5. — B

232. **Een lopende taak met een werkelijke start na werktijd krijgt een einde vóór die start.**
     Start wo 18:00, duur 8 u, 50%, statusdatum wo. Onder OPS en P6 wordt het berekende einde
     wo 12:00 (`CPMSolver.ts:2564`; de inversiewacht geldt alleen bij een RESUME-override).
     Voorstel: het restwerk begint niet vóór de vastgelegde start. Bestond al vóór F1.
     Review F1 r3–r5. — B

271. **Een nachttaak die op zaterdag 06:00 eindigt, krijgt −1 speling bij een gelijk vroeg en laat venster.**
     Nachtkalender ma–vr 22:00–06:00. A 2 d vanaf ma 22:00, FS+1 naar B van 2 d. B loopt vroeg en laat
     van do 4 jun 22:00 tot za 6 jun 06:00, maar krijgt totale speling −1 onder OPS, P6 en MSP (vrije
     speling −1 onder OPS en MSP). `CPMSolver.ts:1541` telt de dagspeling met `utcDayStart`; dat legt
     het eindmoment op zaterdag, en `signedWorkDaysBetween(za, za)` is −1. Ook op de integratiebasis
     `be58ba356`. Voorstel: neem bij een eindmoment de bijbehorende werkdag (`workdayDateOfInstant`,
     eindkant). Gevonden in review F2 ronde 2A. — B

243. **Onder het P6- en MSP-profiel tekent de Gantt de pauzes van een dagtaak in de dagenmaat, de motor
     rekent ze in werkminuten.** De renderer kent het rekenprofiel niet (`GanttRenderOptions`) en kiest de
     splitwandeling op de maat van de taak (`GanttRenderer.ts`, `computeSplitSegments`, `'workdays'`). Onder
     P6/MSP staat de conventie `workdayDurationMeasure` uit, dus telt de motor een dagtaak als uren. Op een
     kalender met gelijke dagen is de uitkomst gelijk; bij ongelijke dagen (bv. vr 6 u) kan een tussengrens
     een paar uur verschillen. Het taakeinde klopt altijd (de laatste grens is het taakeinde). Afgeleid uit de
     code, niet nagespeeld. Voorstel: geef de renderer `workdayDurationMeasure` mee. Gevonden in F3c. — S

276. **Een FNET met een tijd buiten werktijd zet een START-mijlpaal op de volgende werkdag.** P 1 d op
     maandag, FS+0 naar START-mijlpaal M, FNET di 18:00 (kalender 7–16). M komt op wo 07:00, ook een
     mijlpaal zonder soort. `forwardBoundOf` laat de tijd 18:00 staan (geen snap voor een mijlpaal met
     tijd); de her-snap in `snapSuccessorEarlyStart` zet een moment buiten werktijd door naar het volgende
     blokbegin. De controle op het FNET-eindmoment daar geldt alleen binnen werktijd of op een blokeinde.
     Met eigen werkblokken gebeurt dit ook op `be58ba356`. Richting: puntsgewijze semantiek voor
     mijlpalen. Gevonden in review F2 ronde 4. — B

277. **Een 24-uurskalender naast een gewone kalender kost een parallelle dagtaak een dag speling.** P werkt
     maandag op een 24-uurskalender, met een START-mijlpaal op di 00:00. De dagtaak R op 07–16 of 08–16
     krijgt speling 0 en is kritiek; op `be58ba356` is dat 1, niet kritiek. Dit geldt onder OPS, P6 en
     MSP. Zonder die eindmijlpaal, of met een FINISH-mijlpaal, geven de basis en de head allebei 0.
     Locatie: `CPMSolver.ts:1351`, samen met de projecteindgrens rond `CPMSolver.ts:3717`. Het ontstond in
     `29a2f6cac` (eerder ook in `d3e7c885f`, hersteld in `b36c37770`). Richting: leg voor gewone
     dagtaken apart vast wat een afsluitend eindmoment is en wat een START is die een projectdag opent,
     met de bestaande kalenderfuncties. Gevonden in review F2 ronde 6. — B

278. **Een wortel-taak met een rauw anker op het laatste blokeinde: solver en belasting kiezen een andere
     dag.** Urentaak van 8 u, geen voorganger, start ma 16:00 op een kalender 08–16. De solver houdt het
     anker rauw en telt de duur vanaf het eerste blok van die dag (spec §4.3 N0, z13-cases in
     `cases-advanced-cpm.json`): begin en einde ma 16:00 (24 u ⇒ wo 16:00). De gedeelde plaatsing
     (`taskWorkPlacement`, `workPlacement.ts`) wandelt de duur vanaf ma 16:00 vooruit en boekt di 1. Histogram
     en nivelleerder boeken dus dinsdag, terwijl de solver de taak op maandag zet. Getoetst in `check-f3b-production-compat.ts` (geval
     "blokgrens zonder capaciteitsdruk"; het F3c-belastingdeel verwachtte di 16:00 van de motor, maar
     dat botst met het z13-orakel). Probe op de basis `1e460cde6`: hetzelfde solvergedrag. Voorstel: de
     eigenaar kiest welke dag geldt; daarna volgt de plaatsing dezelfde regel als de solver (of andersom).
     Gevonden bij de integratie van F3c. — B

255. **Bij een split op een dagenmaat-taak wijkt de gedeelde plaatsing per dag tot 2 minuten af van de
     Gantt-stukken.** Sinds F3c-fix-split heeft de split-as één betekenis: dagslots voor de dagenmaat
     (`workPlacement.ts`). Een steekproef van 6000 gevallen geeft per dag een verschil van hoogstens
     2 minuten tussen de plaatsing (histogram, nivelleerder) en de stukken in de Gantt. Bij een gelijkspel
     gaat hoogstens een halve minuut werk verloren. `measuredSpanDays` in `workPlacement.ts` herhaalt de
     formule van `splitTotalSpanDays` (`duration.ts`); `check-split-solver-placement.ts` vangt een solver
     die afwijkt wel, maar niet een tweede kopie die mee verandert. Voorstel: één gedeelde functie voor de
     spanwijdte, en de afronding per dag gelijk aan die van de Gantt. Gevonden in F3c-fix-split. — B

266. **Na een eenheidswissel op een lopende taak heeft de rest ruis van de drijvende komma.**
     `durationEditProgress` (`src/engine/work/workRuleApply.ts:953`) rekent de rest als nieuwe duur ×
     (1 − nieuw percentage). Een werktijdtaak van 2 d, 25 % gereed, met een nieuwe duur van 12 u (onder P6
     en MSP ook "1,5d") krijgt zo 720 × (1 − 1/3) = 480,00000000000006 min in plaats van 480. De motor legde
     het einde daardoor net voorbij de bandgrens: wo 3 juni 07:00 in plaats van di 2 juni 16:00. Gemeten in
     fixronde 4 van #584. Sinds fixronde 7 van #591 rekenen de kalenderwandelingen in hele ms, en is het einde
     di 16:00; de vier rijen zijn uit `KNOWN_DRIFT` in `tests/planning/check-f4b-review-r3.ts`. De ruis in de
     rest zelf is niet weggenomen (die fix raakt `durationEditProgress` niet; niet opnieuw gemeten). Voorstel:
     de rest als nieuwe duur − verricht rekenen. — B

317. **Bij een FINISH-mijlpaal vraagt de voortgangsinvoer om een werkelijke start.**
     `src/engine/progressEntry.ts:104` gebruikt een vaste `'start'`-kant. Voorbeeld: FINISH-mijlpaal do 06:00,
     het einde van de dienst wo 22:00–do 06:00, status wo, alleen 100 % invoeren: `planProgressEntry` weigert
     met `needsActualStart`, en de MCP-update weigert ook. Hetzelfde bij do 00:00 op een 24-uurskalender. Een
     ingevuld werkelijk einde werkt wel. Op `main` faalt dezelfde invoer ook. Voorstel: gebruik de bestaande
     mijlpaalkant. Gevonden in review #563 r2, nagespeeld in review r1 van #600. — B

341. **Een maatwissel vervangt een expliciete restduur door de afleiding uit het percentage.**
     `src/engine/work/workRuleApply.ts:990`: begintoestand 4 d, 50 % gereed, expliciet 1 d rest (toegelaten
     import- of extensiedata); alleen wisselen naar 32 uur geeft `remainingMinutes = 960` (16 u) in plaats van
     480 (8 u). De eenheidswisseltak rekent `totaal × (1 − percentage)` en laat de expliciete rest vallen. Undo
     herstelt, redo verdubbelt opnieuw. Stond al zo op `fbd4a3f9d` (met Urenplanning aan). Voorstel: ook bij een
     maatwissel de bestaande Δ-restregel in minuten toepassen; het percentage alleen als de expliciete rest
     ontbreekt. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

343. **De WBS-samenvatting maakt van een halve dag één dag.** `src/engine/reports/wbsSummary.ts:111` rekent de
    faseduur opnieuw met `workDaysBetween(parseDate(start), parseDate(finish))`. Een fase met één kind van 0,5 d
    (1 juni 07:00–11:00) krijgt in de store terecht 0,5 d, maar in het WBS-rapport `durationDays: 1` en de kolom
    toont 1 d. Bij een urentaak van 240 min stond het al zo op `fbd4a3f9d`. Voorstel: de al berekende
    fasehoeveelheid in de projectkalender lezen. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

344. **DCMA vergelijkt een afgeronde duur met de grens van 44 dagen.** `src/engine/reports/dcmaAssessment.ts:313`
    via `src/engine/scheduler/summaryProgress.ts:53`: een onvoltooide taak van 44,025 d (21.132 werkminuten; de
    grens is 21.120) geeft "hoge duur 0/1, pass" in plaats van "1/1, flag", omdat 44,025 vooraf naar 44,0 wordt
    afgerond. Bij een urentaak stond het al zo op `fbd4a3f9d`. Voorstel: exacte dagen of minuten vergelijken en
    pas bij de weergave afronden. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

358. **Een gestarte taak op 0 % die naar duur 0 gaat, houdt onder vast werk restwerk.**
     `src/engine/work/workRuleApply.ts:435-437` (`settleDurationEdit`), `durationEditProgress` (`:940`) en
     `src/engine/work/workTriangle.ts:177`. Voorbeeld: 4 d, werkelijke start, 0 %, één arbeidsresource; onder
     vast werk of vaste duur en werk verlengd naar 6 d en dan duur 0. De kern weigert rest 0 en de toewijzing
     houdt 1920 min restwerk; de belasting is 0, want de taak heeft geen duur meer. Stond al zo op
     `fbd4a3f9d`. Voorstel: deze overgang weigeren of expliciet afhandelen, in plaats van na de weigering van
     de kern een half bijgewerkte toestand te laten staan. Gevonden bij de fix van aanval a03 en in review r1
     van #662 (GPT-6.1-Sol). — B

367. **Duur en voortgang samen opslaan boekt de voortgang niet in de werkvelden.**
     `src/engine/work/workRuleApply.ts:1096` (`settleProgressWork` slaat een andere totale duur over) en
     `src/state/taskDialogSave.ts:253`. Voorbeeld: 4 d, 50 %, één arbeidsresource op inzet 1, verlengd naar
     6 d (960 min verricht, 1920 rest); daarna in één opslag 8 d en 75 %. Main en #662 houden 960 verricht +
     960 rest = 1920; verwacht is 2880 verricht + 960 rest = 3840. Op `fbd4a3f9d` was de totale belasting
     wel 3840 (afgeleid, zonder werkpaar), dus de fout bestaat sinds #600. Bij 8 d en 100 % zit dezelfde
     fout (verwacht 3840 verricht); #662 laat dat geval bewust op het gedrag van main (960 + 1920). Fout op
     de dialoog en de interne MCP-draft (`updateTaskFields`/`patchTaskFields`); `planner_update_tasks` en
     `planner_batch` verwerken duur en voortgang na elkaar en geven wel de juiste uitkomst. Voorstel: eerst
     de duur verwerken met behoud van het verrichte werk, dan de expliciete voortgang boeken zoals
     `settleProgressWork`. Gevonden bij de fix van aanval a03 en in review r1 van #662 (GPT-6.1-Sol). — B

345. **Het late SS-venster met een 24-uurslagkalender belooft een start die de opvolger alsnog vertraagt.**
     `src/engine/scheduler/relationMath.ts:875`. Kalender ma–vr 08:00–16:00; A 2 d vanaf ma 1 juni 08:00;
     B 480 min; SS+1,5 d met lagkalender 24-uurs (36 klokuren). Onder OPS, P6 en MSP staat B vroeg en laat
     op wo 3 juni 08:00–16:00. A krijgt late start di 2 juni 08:00, 480 min totale speling en is niet
     kritiek. Zet je A op die late start, dan schuift B naar do 4 juni 08:00. De SS-terugrekening geeft
     ma 20:00 als startgrens; de omzetting via `finishFromStart` en de duurterugrekening schuiven die naar
     di 08:00. Bij urentaken al op `fbd4a3f9d`; voor dagtaken nieuw (daar bleef B op woensdag). Een ALAP-taak
     in deze vorm blijft staan in plaats van B te vertragen (wacht in `placeUnstartedAlap`, gepind in
     `check-alap-maatplaatsing.ts`). Voorstel: bewaar de startbovengrens bij de projectie naar de
     voorgangerkalender, met de bestaande grenshelpers. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

346. **Een procentlag weegt onder P6/MSP de duur van een dagvoorganger met de lagkalender in plaats van de
     voorgangerkalender.** `src/engine/scheduler/CPMSolver.ts:1498`. A 1 d op 08:00–16:00 (480 min), B op
     08:00–18:00 (600 min per dag), SS+50 %, lagkalender opvolger. Verwacht: 50 % van A is 240 min, dus B
     begint ma 12:00. B begint 13:00: de motor rekent 50 % van 600 min. Met A als urentaak
     (`durationMinutes` 480) begint B wel 12:00. `resolveLagMinutes` geeft de lagkalender ook aan
     `durationMinutesOf` voor de duur van de voorganger. Al op `fbd4a3f9d`. Voorstel: reken het percentage
     uit met de kalender van de voorganger en gebruik de lagkalender alleen voor de verschuiving. Gevonden
     in de aanval na #600 (GPT-6.1-Sol). — B

361. **Een gestarte ALAP-taak houdt de oude stap in hele werkdagen.** `src/engine/scheduler/CPMSolver.ts:3390`
     en `:3404` (`applyAlap`, de tak na `placeUnstartedAlap`). Kalender ma–vr 08:00–16:00 met een werkende
     uitzondering vr 5 juni 08:00–14:00. A 2 d met ALAP, gestart ma 1 juni 08:00, 50 %, statusdatum ma
     16:00, naast E 5 d. Onder P6 en MSP blijft 120 min speling liggen; onder MSP eindigt A vr 16:00,
     terwijl de kalender om 14:00 sluit. De basis `9a636ec69` geeft hetzelfde. Een niet-gestarte taak
     wordt sinds #660 wel met haar duur geplaatst; het venster van een gestarte taak is geen opgeslagen
     duur, en de voltooide P6-gevallen zijn op de oude stap geijkt (C14-docblok in `types/project.ts`).
     Voorstel: plaats het restwerk vanaf de statusdatum met de restduur, en meet het P6-corpus voor je
     de voltooide taken meeneemt. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

369. **Onder C14 kan een FF-relatie met een lag op de opvolgerkalender een ALAP-einde buiten werktijd
     geven.** `src/engine/scheduler/CPMSolver.ts:3553` (`positionAlapFromSuccessors`). P6-profiel, eigen
     werkblokken ma–vr 08:00–16:00 met vr 5 juni 08:00–14:00. A 2 d ALAP —FF+1,5 d→ B op 08:00–18:00,
     lagkalender opvolger; X 5 d —FS0→ B. A krijgt wo 3 juni 14:00 – vr 5 juni 15:00, na sluitingstijd,
     met totale speling 0. Zonder ALAP op dezelfde start eindigt A vr 14:00 en blijft B gelijk. Al op
     `9a636ec69`. De gewone ALAP-stap (`placeUnstartedAlap`) zet het einde sinds #660 op een eindmoment
     van de eigen kalender; C14 is op het P6-corpus geijkt en is daarom niet mee veranderd. Voorstel: dezelfde
     `snapOnOrBefore` in C14, na een corpusmeting. Gevonden in review ronde 1 van #660 (GPT-6.1-Sol). — B

384. **C14 houdt bij een ALAP-plaatsing geen rekening met een deadline.** (was 373) P6-profiel met eigen werkblokken,
     A 1 d ALAP met deadline di 2 juni 16:00, naast X 2,5 d; A en X FS0 naar B. A staat di 12:00 – wo 12:00,
     met −240 minuten totale speling (`src/engine/scheduler/CPMSolver.ts:3568–3593`). Al zo op `9a636ec69`.
     De gewone ALAP-stap houdt sinds #660 de late grens aan; C14 niet. Voorstel: dezelfde eigen grens in C14,
     na een corpusmeting. Gevonden in review ronde 2 van #660 (GPT-6.1-Sol). — B

374. **C14 kan bij SS met een lag op de opvolgerkalender een ALAP-start kiezen die de opvolger vertraagt.**
     P6-profiel met eigen werkblokken en een korte vrijdag, A 2 d ALAP, SS+0,5 d op de opvolgerkalender. Na de
     plaatsing begint B ma 10:00; herberekenen vanaf dezelfde A-start geeft 13:00
     (`src/engine/scheduler/CPMSolver.ts:3568–3593`). Al zo op `9a636ec69`. Voorstel: in C14 dezelfde
     voorwaartse uitvoerbaarheidscontrole als in `placeUnstartedAlap`, na een corpusmeting. Gevonden in review
     ronde 2 van #660 (GPT-6.1-Sol). — B

376. **De halvering van de ALAP-plaatsing veronderstelt een monotone uitvoerbaarheid, en die geldt niet altijd.**
     OPS, A 36 klokuren ALAP met FF0 naar twee dagtaken: B op 08–18 met SNET vr 5 juni 12:30, D op
     08–12/13–18 met SNET vr 14:00, lagkalender opvolger. A komt op do 4 juni 06:00 – vr 5 juni 18:00, terwijl
     zo 7 juni 00:00 – ma 8 juni 12:00 ook kan zonder B of D te verplaatsen
     (`src/engine/scheduler/CPMSolver.ts:3477–3493`). Zeldzaam; de basis plaatst A nog vroeger. Voorstel: per
     aaneengesloten kalenderinterval zoeken of eerst de niet-monotone FF-projectie herstellen, en de algemene
     claim in het commentaar schrappen. Gevonden in review ronde 2 van #660 (GPT-6.1-Sol). — B

377. **ALAP rekent terug uit het einde en verliest bij sterk wisselende daglengtes een minuut.** OPS, A 1,5 d
     ALAP, wo alleen 08–10, vr 08–14, SS+1,5 d op een 24-uurslagkalender: A krijgt wo 09:59 – vr 10:58; zonder
     ALAP op dezelfde start eindigt A om 10:57; met een split scheelt het twee minuten
     (`src/engine/scheduler/CPMSolver.ts:3473`, `src/engine/calendar/CalendarEngine.ts:1124`). Voorstel: de
     gekozen plek canoniek maken met de voorwaartse duurwandeling en daarna de grenzen opnieuw toetsen. Gevonden
     in review ronde 2 van #660 (GPT-6.1-Sol). — B

378. **De ALAP-uitvoerbaarheidswacht mist bij SF de eindvloer van de opvolger.** MSP, een ALAP-eindmijlpaal A
     met SF0 op de voorgangerkalender staat di 9 juni 16:00, B di 08–18. Herberekenen zonder ALAP op dezelfde
     mijlpaalstart laat B di 08:00 beginnen maar pas wo 08:00 eindigen; de wacht toetst alleen de start
     (`src/engine/scheduler/CPMSolver.ts:3519–3525`, `src/engine/scheduler/relationMath.ts:248`). Alleen over
     niet-werktijd; de basis geeft in dit geval ook een herberekeningsverschil. Voorstel: bij SF de bestaande
     `forwardFinishFloor` meenemen. Gevonden in review ronde 2 van #660 (GPT-6.1-Sol). — B

392. **Een gewone OPS-dagtaak houdt bij een kloklag in breuken een paar ms negatieve speling.** De dagenmaat-loper
     draagt het deel onder de minuut van zijn startanker niet over een daggrens (`src/engine/scheduler/CalendarEngine.ts:1131`,
     `:1147`, `:1156`). Nagespeeld via de store en Bereken: OPS, 24/7-kalender, A en B gewone taken van 1 d, A start
     ma 1 juni 2026 08:00, FS naar B met lag `+0,166667` kalenderdag. B start di 12:00:00,029; de loper rondt het einde
     naar wo 12:00:00,000; terugtellen geeft di 12:00:00,000, dus B −29 ms speling (op main −28 ms). A heeft op beide
     −29 ms, en een late finish 07:59 tegenover een vroege finish 08:00. Ook bij SS en FF. Eén werkdag optellen en weer
     aftrekken vanaf 12:00:00,028 verliest 28 ms, ook op main. Geen getoonde dag verspringt. Voorstel: de loper houdt
     het deel onder de minuut vast over daggrenzen; een gewone dagtaak in de regressie. Gevonden in review ronde 1 van
     #687 (GPT-6.1-Sol). — B

395. **Een positieve duur die op nul ms rondt, is bij een rauw MS Project-werkeinde nog geen nulduur voor de
     solver.** `src/engine/scheduler/CPMSolver.ts:1281–1284`: de wacht toetst `totalMinutes > 0` en verlegt een rauw
     werkeinde eerst naar het begin van dezelfde dag; pas daarna behandelt de kalender de lengte als 0. Via de store:
     MS Project-profiel, ma–vr 08–16, projectstart 1 juni 2026 08:00, worteltaak met eigen start vr 29 mei 16:00 en
     duur 0,000001 min. Uitkomst: ES vr 16:00, EF vr 08:00 (een omgekeerde spanne), LS vr 16:00, speling 0. Een
     letterlijke nulduur houdt ES en EF op vr 16:00. Op main dezelfde omgekeerde vroege spanne, plus LS do 16:00 en
     −480 min speling; #694 veroorzaakt of verergert dit niet. Voorstel: de wacht toetst de lengte na de
     ms-omzetting (`CalendarEngine.walkMs`). Gevonden in review ronde 1 van #694 (GPT-6.1-Sol). — B

399. **Een contourperiode na een split-gat korter dan een halve ms kan een fantoomoverbezetting geven.**
     `src/engine/scheduler/workPlacement.ts` (`placementResidueAxis`): de rest buiten de afgeronde spanne loopt op de
     as vanaf het afgeronde einde, zo lang als het restwerk. Valt er ook een gat korter dan een halve ms in die
     afronding, dan is de echte rest op de as langer dan het restwerk. Ma–vr 08:00–16:00, 480,000005 min werk, een
     gat van 0,000001 min na 480 min, en een contour met [0; 480) 480 min en [480,000001; 480,000006) 0,000005 min:
     maandag is 1,0000000021 belast, boven de marge van 1e-9, dus overbezet. Zonder contour, en bij een gat van een
     halve ms of meer, gebeurt dit niet; ook de contourdialoog schrijft de rest goed. Geen invoerroute gevonden die
     zo'n gat maakt (splits tellen in minuten of seconden). Voorstel: de plaatsing geeft het exacte einde van de
     spanne mee, en de rest loopt tot daar. Gevonden in fixronde 2 van #694. — B

400. **Ongewijzigd Toepassen van een BELL-verdeling verliest een fractie werk.** `src/engine/contour/contourPhases.ts:33–43`
     (aangeroepen door `ContourDialog.tsx:102` en `contourDays.ts:68`) voegt bijna gelijke daginzetten samen tot één
     fase en bewaart alleen de eerste inzet. Nagespeeld via de store: XER 17,777778 u, toewijzing 0,9, Vast werk of
     Vaste inzet, inzet naar 1, BELL, Bereken, contourdialoog ongewijzigd Toepassen. Het werk gaat van
     960,0000120000003 naar 959,9999943600001 min (ongeveer 1 ms minder). Undo herstelt het; opslaan in IFC bewaart de
     lagere waarde. Onder alle drie profielen en beide werkregels, op main precies zo. Voorstel: bij het samenvoegen
     het totale werk bewaren (een naar dagdeel gewogen inzet), of verschillende inzetten als aparte fasen houden.
     Gevonden in review ronde 3 van #694 (GPT-6.1-Sol). — B
446. **Een losse FINISH-mijlpaal op een 24-uurskalender staat een dag later dan een losse mijlpaal zonder
     soort.** OPS-profiel, kalender ma–vr 00:00–24:00, projectstart ma 1 jun 2026, drie losse mijlpalen zonder
     relaties, Bereken: zonder soort en START staan op di 2 jun 00:00 (het einde van ma, B6), FINISH op wo 3 jun
     00:00 (het einde van di). Op de standaardkalender staan alle drie op ma 16:00. Gemeten met een probe bij de
     PR voor het afmelden van mijlpalen (besluit 2026-10-29); dat dit fout is, leid ik af uit B6 ("aan het einde
     van zijn werkdag"). Niet verder onderzocht: de plaatsing zit in `CPMSolver.ts`. — S

440. **Een `.mpp`-taak met precies één toewijzing wandelt ook op de kalender van materiaal of een kostenresource.**
     `src/services/mpp/mppReader.ts`, `deriveTimephasedWindowsForTasks`, tak "precies 1 toewijzing": heeft de enige
     toewijzing met tijdgefaseerde gegevens een afwijkende resourcekalender, dan wandelt de taak haar volle duur op
     díe kalender, ongeacht het resourcetype. Volgens Microsoft stuurt een materiaal- of kostenresource de planning
     niet ("assigning material resources or cost resources to a task doesn't affect task scheduling"). In de 661
     gemeten bestanden heeft geen enkele taak met één walk zo'n resource (alle 22 zijn werkresources), en geen taak met
     meer walks krijgt haar startanker van een toewijzing die de duur niet stuurt. Voorstel: in beide takken alleen
     toewijzingen die de duur sturen laten meetellen, met een corpusvrije fixture. Gevonden bij de fix van 187
     (2026-10-29). Review van #722 (Sol, ronde 1): nagespeeld met een eigen bytefixture met één COST-toewijzing en
     een afwijkende resourcekalender; op de kop en op main `3c2c1ec12` een walk met de volle taakduur op die
     kalender (`mppReader.ts:1517` filtert die tak niet op duursturing). — B
441. **Een kostenresource uit `.mpp` of MSPDI wordt LABOR en stuurt daarna in de werkregelbrug de duur.**
     `ResourceType` kent geen COST, dus `readResourcesUnsafe` (`src/services/mpp/mppEntities.ts`) en de MSPDI-lezer
     maken er LABOR van. De `.mpp`-wandeling sluit ze sinds de fix van 187 uit (`ReadResourcesResult.costResourceIds`),
     maar die lijst gaat niet het document in. `drivesDuration` in `src/engine/work/workRuleApply.ts` telt daarna elke
     niet-MATERIAL resource als duursturend: een inzet- of werkbewerking op zo'n toewijzing (in OzBuild inzet 0,0006)
     kan onder Vaste eenheden of Vast werk de taakduur veranderen, wat MS Project niet doet. Niet nagespeeld in de app.
     Voorstel: een kostenresource als niet-duursturend in het document bewaren (een eigen type of vlag), na een besluit
     over de vorm. Gevonden bij de fix van 187 (2026-10-29). Review van #722 (Sol, ronde 1): nagespeeld via de echte
     store-actie (`workRuleApply.ts:106`). In OzBuild Workshop 17 het werk van "Specialist Consultant" op 600 min
     zetten en herberekenen geeft een taakduur van ongeveer een miljoen minuten en einde `2033-01-07T10:40`, op de kop
     en op main `3c2c1ec12` gelijk. — B
443. **Een IFC die vóór de fix van 187 uit een `.mpp` is opgeslagen, houdt de oude walkwaarden.** `ifcWriter.ts`
     (rond regel 1951) schrijft `timephasedDurationWalks[].workMinutes` letterlijk en `ifcReader.ts` (rond regel 3737)
     leest ze letterlijk terug. Een IFC die met main `3c2c1ec12` uit `timephased-cost-rollup.mpp` is gemaakt, houdt na
     heropenen en herberekenen met de fix `[299.99996875, 299.99996875]`, en Task 8 eindigt nog op
     `2026-02-16T13:59`. Een nieuwe import geeft `[2400, 2400]` en `2026-02-20T17:00`. Geen nieuw dataverlies: de
     oude, fout afgeleide waarde blijft staan. Een planner moet het `.mpp`-bestand opnieuw importeren. Het veld heeft
     geen versie, dus de waarde bij het openen opnieuw door de inzet delen zou nieuwe bestanden beschadigen; een
     herkenbare migratie is een apart werk. Gevonden in de review van #722 (Sol, ronde 1, 2026-10-29). — B
444. **Het commentaar over de `.mpp`-wandeling staat vier keer.** `mppReader.ts` (rond regel 1294, 1363 en 1527) en
     `CPMSolver.ts` (rond regel 3009) herhalen dezelfde uitleg en dezelfde corpusvoorbeelden. Eén uitleg bij de tak die
     de walks maakt, met verwijzingen op de andere plekken, is genoeg (ongeveer 20–30 regels minder). Alleen opruimen;
     het gedrag verandert niet. Gevonden in de review van #722 (Sol, ronde 1, 2026-10-29). — B

## Tabel, invoer en bediening

13. **Tabelkolom *Kleur*** wordt in IFC bewaard, maar geen balk of rapport gebruikt hem. — B
16. **Taken kopiëren** heeft geen zichtbare bediening; alleen Ctrl+C/V met de Gantt in focus. — B
17. **Verwijderen zonder bevestiging**: `confirm.deleteTask` staat in de locales maar wordt nergens gebruikt. — S

241. **Hetzelfde externe anker opnieuw invoeren als datum zonder tijd geeft een extra undo-stap en zet
     de planning op verouderd.** `updateExternalLink` vergelijkt het ruwe anker, niet het genormaliseerde.
     Gevonden in fixronde 1 van F2 (laadfix). — B

281. **De motor rondt een externe lag in minuten nog af op hele dagen, maar alleen in dagmodus.** De invoer
     houdt sinds fixronde 1 van F4b de breuk ("0,5d" is een halve werkdag, ook bij een externe relatie;
     `check-f4b-review-r1.ts`). In uurmodus, de gewone route, rekent de motor `lagDays` × werktijd per dag
     zonder afronding (`CPMSolver.externalLagMinutes`). Alleen `CPMSolver.externalLagDays`
     (`CPMSolver.ts:3170-3176`) rondt een lag in minuten nog half van nul af naar hele dagen. Die functie
     werkt alleen op een kalender waaruit geen werkblokken af te leiden zijn (`calendarForEngine` geeft dan
     geen `workTime`). Zo'n kalender heb ik niet in een gewone planning kunnen maken; de lege kalender
     weigert de motor al. Voorstel: de afronding weghalen als de dagmodus verdwijnt; motorwerk. Alleen in
     de code gelezen. — S
283. **Vast werk met een inzet die het werk niet in hele minuten deelt, geeft een duur met een deel van een
     minuut en een negatieve speling.** Gemeten op het stucwerk van het tutorialproject (stand na tutorial
     4, Vast werk, 32 uur): inzet 7 geeft `durationMinutes` 274,2857 (einde vr 23 jul 11:34) en een totale
     speling van −0,0006 werkdagen, terwijl de taak bij inzet 1 tot 3 speling 0 heeft. De werkdriehoek rondt
     niet af (B3), maar de urenmaat telt verder in hele minuten (`applyRemainingDuration`). Een taak met
     een kleine negatieve speling kan in een filter op negatieve speling verschijnen. Voorstel: de duur van
     de urenmaat in de werkdriehoek op hele minuten zetten, of de speling op hele minuten vergelijken;
     motorwerk, buiten F4b. Gevonden bij het meten voor knownbugs 252.
     Dezelfde gemengde precisie weigert ook een gewone verkorting (review van #662, GPT-6.1-Sol): vast werk,
     kalender van 465 minuten, 3,75 d op 40%, verlengd naar 6,75 d en terug naar 1,5 d. De afgeronde rest geeft
     een negatieve rest van 0,25 minuut, en store, raster, MCP en dialoog weigeren de invoer
     (`src/engine/taskMutationRules.ts:204`, `src/engine/work/workRuleApply.ts:981`). Al zo op `9a636ec69`.
     Voorstel: één precisie voor totale, verrichte en resterende duur. — B
284. **Een opgeslagen Tabel-indeling houdt Start en Einde op 100 px; een datum met tijd valt dan weg.**
     Sinds B4 toont een moment midden op de werkdag datum en tijd ("04-11-2026 11:00"). Die tekst is 89 px
     breed, plus 14 px opvulling; de oude standaardbreedte was 100 px (gemeten in de browser, Inter 11 px).
     F4b zet de standaard op 130 px (`preferences.ts`, ook genoeg voor "04-11-2026 11:00 AM"), maar een
     indeling die al in `ops-taskGridPreferences` staat, houdt 100 px tot de planner de kolom verbreedt of
     "Herstel standaard" kiest. De cel kapt de tekst af met een beletselteken. Voorstel: bij het laden een
     opgeslagen breedte van precies 100 px voor deze twee kolommen naar 130 px zetten, of de kolom laten
     meegroeien; een besluit over opgeslagen voorkeuren. — B
342. **Werkdagencompressie knipt zes uur van de vrijdagse nachtdienst weg.** `src/engine/renderer/workdayAxis.ts:184`:
    kalender ma–vr 22:00–06:00, taak vr 5 juni 22:00 – za 6 juni 06:00. Bij zoom 240 beslaan acht klokuren 80 px;
    met compressie blijven 20 px over, en za 06:00 komt op de maandagnaad 00:00. De terugweg (`xToDate`) maakt van
    za 02:00 dan ma 8 juni 00:00 (los gevonden door aanvaller a02). Stond al zo op `fbd4a3f9d`.
    Voorstel: ook bij compressie en de inverse as een moment aan zijn werkdag toewijzen, zodat een nachtstuk niet
    verdwijnt omdat de klokdatum zaterdag is. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

353. **Een decimale komma in een lag van een interne relatiecel wordt als scheiding tussen twee relaties
     gelezen.** `tokenSlices` in `src/engine/taskGrid/relationCell.ts:55` knipt een cel zonder externe
     relatie ook op een komma. `1 FS+1,5d` wordt zo `1 FS+1` en `5d`; de tweede token geeft de fout
     `relationToken`. `1 FS-0,5d` gaat net zo mis. Met een punt (`1 FS+1.5d`, `1 FS-0.5d`) gaat het goed, en
     de lagparser zelf leest een komma wel. Al op `fbd4a3f9d`: de tokenizer van toen geeft dezelfde uitslag.
     Sinds #600 is een breuk in een lag gewone invoer, dus een Nederlandse planner typt dit. Voorstel: in
     `tokenSlices` een komma binnen het getal van een lag (na `+` of `-` en cijfers, vóór een cijfer) niet
     als scheiding nemen. Let op: `1,2` (twee voorgangers) moet een scheiding blijven, en `1 FS+1,2` is
     dubbelzinnig; daar is een regel nodig, bijvoorbeeld een decimaal alleen met een eenheid erachter
     (`+1,5d`). Nagespeeld met `parseRelationCellText` (probe
     `/tmp/aanval/a08-probe.ts`, regels `relation-cell-comma`). Gevonden in de aanval na #600
     (GPT-6.1-Sol). — B

360. **Kopiëren tussen mijlpalen draagt het exacte moment niet over.** Een FINISH-mijlpaal op
     `2026-06-01T07:00` kopieert het label `01-06-2026` (B4 laat de tijd op een dagrand weg). Plakken in een
     FINISH-mijlpaal op dezelfde datum om 16:00 schrijft niets: beide momenten hebben hetzelfde label, dus het
     doel blijft 16:00 (`src/engine/taskGrid/editors.ts:147`, `src/engine/taskGrid/clipboard.ts:269`). Al zo
     op `9a636ec69`; de plakplanner geeft op basis en na de fix van #661 `writes: []`. Voorstel: het exacte
     moment in de kopieerwaarde bewaren; D7 hoeft daarvoor niet te veranderen. Gevonden in de review van de
     fix voor aanval a08 (GPT-6.1-Sol). — B

366. **Slepen van de linkergreep bij importsplits met een contour verschuift het einde.** Vier werkdagen met een
     pauze van 480 minuten na het eerste werkstuk, ma 07:00 – vr 16:00: de linkergreep één dag naar rechts, in
     twee muisbewegingen, eindigt op di 09:00; de contourherschaling maakt van de pauze 360 minuten. Terugslepen
     laat ma 09:00 staan, en F5 zet het einde op ma 8 juni 09:00. Eén undo herstelt de beginstand
     (`src/components/canvas/hooks/useBarDrag.ts:353`, `src/engine/renderer/hourBarDragMath.ts:218`,
     `src/utils/taskDefaults.ts:774`). Op `9a636ec69` ook fout (na terugslepen en F5 ma 8 juni 16:00).
     Voorstel: de pauzegegevens bij het grijpen bevriezen en sleepberekening en store dezelfde herschaalregel
     laten volgen. Gevonden in de review van de fix voor aanval a09 (GPT-6.1-Sol). — B

371. **De linkergreep springt bij een taak met alleen nivelleerpauzes.** Vier werkdagen plus één
     nivelleerpauzedag, ma–vr: de linkergreep één dag naar rechts geeft wo 07:00 en duur 3 d. De sleep filtert
     de pauze weg, maar rekent terug vanaf het oorspronkelijke einde mét pauze
     (`src/components/canvas/hooks/useBarDrag.ts:353`, `src/engine/renderer/hourBarDragMath.ts:218`). De
     bodyverplaatsing werkt wel. Al zo op `9a636ec69`. Voorstel: de vaste rand en de resterende spanne bepalen
     vanuit dezelfde toestand zonder vervallen nivelleerpauzes. Gevonden in de review van de fix voor aanval a09
     (GPT-6.1-Sol). — B

420. **Een onbereikbare keuze in de Gantt-route voor een nieuwe taak.** `src/components/canvas/GanttCanvas.tsx:421`
     (`addAtClickedDate`) schrijft `milestone ? 0 : 5`, maar een mijlpaal is drie regels eerder al teruggekeerd.
     Geen gedragsfout, alleen opruimwerk. Voorstel: vervang de keuze door `5`. Gevonden in review ronde 2 van
     PR #702 (GPT-6.1-Sol). — B
431. **Rapporten tellen een lopende importtaak op 100 % als voltooid.** `progressState` in
    `src/engine/scheduler/summaryProgress.ts` geeft bij `completion >= 1` altijd `complete`, ook met
    status STARTED, geen werkelijk einde en 1920 min bronrest. `remainingMeasure` in
    `src/engine/reports/reportCommon.ts` overschrijft daardoor de aanwezige rest met nul. Alleen in de
    code vastgesteld bij knownbug 387; samenvattings- en rapportroutes nog niet doorgemeten.
    Voorstel: de voortgangsclassificatie met de importstatus afstemmen en de rollups gericht toetsen. — B
448. **Nachtploeg: alleen een werkelijk einde op de statusdag geeft een werkelijke start die DCMA "ná de
     statusdatum" noemt.** Kalender ma–vr 22:00–06:00, taak van 8 u op ma 1 jun 22:00, statusdatum wo 3 jun.
     Typ alleen bij *Werkelijk einde* "03-06-2026". Dat wordt do 4 jun 06:00 (D6, het einde van de nacht van
     wo), en `applyProgressInvariants` (`src/engine/taskMutationRules.ts:258`) zet de ontbrekende werkelijke
     start op hetzelfde moment. De invoer wordt geaccepteerd: het einde leest de eindkant, werkdag wo. DCMA
     punt 9 en het gezondheidsrapport (allebei `invalidDateReasons`, `src/engine/reports/dcmaAssessment.ts:387`)
     lezen de start aan de startkant, klokdag do, en melden `actualStartAfterStatusDate`. Gemeten met een probe op de basis van #724
     (`3c2c1ec12`) en op de kop; #724 verandert dit niet. Een nulduur-mijlpaal heeft het niet: daar telt de
     werkdag van zijn moment (`milestoneWorkdayOf`), dezelfde als in de tabel. Voorstel: een afgeleide start die gelijk is aan het einde, krijgt bij de
     statusregel de werkdag van het einde. — B
449. **Nachtploeg: een gewone taak is op een statusdag zonder werkblok niet af te melden.** Kalender ma–vr
     22:00–06:00, taak van 16 u vanaf ma 1 jun 22:00, werkelijke start 01-06-2026, statusdatum za 6 jun. Typ
     bij *Werkelijk einde* "06-06-2026". D2 met D4 maakt daar zo 7 jun 06:00 van, het einde van de typische
     nacht van za. De statusregel (`isActualPastStatusDate`, `src/engine/taskMutationRules.ts`) leest dat
     moment aan de eindkant als klokdag zo en weigert: ná de statusdatum. De tabel toont zo'n einde ook als
     "07-06-2026 06:00" in plaats van "06-06-2026". Zondag en een feestdag op een werkdag geven hetzelfde. Een
     nulduur-mijlpaal heeft het sinds fixronde 2 van #724 niet meer: daar leest de dagbepaling de werkspanne,
     met D4 voor een vrije dag (`milestoneWorkdayOf`, `src/engine/calendar/workdayRules.ts`; fixronde 3 van
     #724 verving daarmee de helper `freeDayEndingAt`). Gemeten met een probe op
     de basis van #724 (`3c2c1ec12`), op de kop vóór en na fixronde 2: overal geweigerd. Voorstel: dezelfde
     D4-herkenning in `workdayBoundaryLabel` en `workdayOfInstant` aan de eindkant, voor elke taak; dat
     verandert de weergave van gewone taken en hoort daarom in een eigen PR. — B
451. **Mijlpaal midden in een nachtdienst: na afmelden toont de tabel de klokdatum erna.** Kalender ma–do
     22:00–06:00, vr 22:00–02:00. Een mijlpaal op di 2 jun 02:00 (midden in de nacht van ma), afgemeld met
     03-06-2026, wordt do 4 jun 02:00: de geplande kloktijd in de nacht van wo (B10). De tabel toont
     "04-06-2026 02:00" (B4: midden op de werkdag de klokdatum met tijd), terwijl de planner 03-06-2026 typte.
     De statusregel klopt: statusdatum wo mag, di niet. Op de kop vóór fixronde 3 van #724 (`57b0b7bba`) werd
     het wo 3 jun 02:00, in de nacht van di, en accepteerde statusdatum di die invoer ten onrechte. Review ronde
     4 van #724 (Sol, in alle profielen en soorten): een gewone, zichtbare verwarring bij nachtwerk, maar het
     opgeslagen moment klopt; do 02:00 ligt in de dienst van wo. Het commentaar bij `momentLabel`
     (`src/utils/taskDateLabel.ts`) belooft sinds fixronde 4 alleen voor een mijlpaal op een dagrand dat de
     tabel de getypte dag toont. Gemeten met `meet-gevallen.ts` (geval D) en `check-mijlpaal-afmelden.ts`
     sectie 8d en 8h. Voorstel: voorleggen of de tabel een moment midden in een dienst na middernacht met de
     werkdag moet tonen. — B
452. **`check-mijlpaal-afmelden.ts` is nog zwaar.** Review ronde 4 van #724 (Sol) mat 55,54 s voor de check;
     de brede matrix van sectie 8h speelde bovendien de productieregel na en bleef groen bij een fout. Fixronde 4
     verving die matrix door vaste, letterlijk uitgeschreven gevallen (sectie 8h) en bouwt in 5b, 5d, 8b en 8f
     één opstelling per profiel en route in plaats van per veld of per geval; de nieuwe secties 8i en 8j kwamen
     erbij. Gemeten op deze pc, oud en nieuw om de beurt in één slot, twee rondes (belasting 2–4): 67,5 en 65,8 s
     ⇒ 50,9 en 49,1 s; 83.063 ⇒ 11.888 controles. Wat overblijft, per sectie gemeten bij belasting 1: sectie 1
     (6,6 s) bouwt per profiel, route en veld twee keer de volledige planning, sectie 8a (6,5–7,2 s) per veld,
     en sectie 8d (4,4–5,1 s) zet 27 mijlpalen in één project. De check draait in CI ook in de tijdzonematrix
     (vijf zones extra). Een poging om 8a met een tweede set mijlpalen per veld in één project te bouwen, gaf
     geen winst (6,5 ⇒ 6,8 s); vermoedelijk groeien de kosten per invoer met het aantal taken. Fixronde 5 mat
     waar de tijd zit: het opbouwen van de opstellingen, ongeveer 2 ms per toegevoegde taak (`addTask`), niet de
     invoer. Ze maakte de opstellingen slanker (één gedeelde voorganger voor de Keuring-mijlpalen in `fixture`
     en `ethanFixture`, en per blok alleen de mijlpalen die het gebruikt) en voegde 8k en de vaste uitkomsten
     van de vergelijking met main toe. Gemeten op deze pc, oud (kop `8e1eca869`) en nieuw om de beurt in één
     slot, drie rondes (belasting 2,5–4): 58,2 / 50,3 / 47,2 s ⇒ 44,7 / 44,2 / 40,9 s; 11.888 ⇒ 13.670
     controles. Per sectie nu: sectie 1 5,9 s, 8a 5,0 s, 8d 5,4 s, 5d 4,5 s, 8h 4,3 s, 8k 3,2 s. Voorstel: in
     sectie 1, 8a en 8d nog minder taken per opstelling (bijvoorbeeld de gewone taak en de losse mijlpalen
     alleen waar een blok ze toetst); daarna opnieuw meten. — B
454. **Afmelden van een mijlpaal: START op een rand die de buurdag deelt, wordt het begin (bestaat ook op
     main).** B10 met de aanvulling "einde blijft einde" zegt hier niets; #724 kiest "de dag komt van wat je
     typt" (`milestoneMomentOn`, regel 5, `src/engine/calendar/workdayRules.ts`). Kalender 24 uur ma–do, vr
     00:00–12:00, weekend vrij. Een START-mijlpaal op vr 5 jun 12:00 (het einde van vr), afgemeld met
     08-06-2026, wordt ma 8 jun 00:00, het begin. Het einde van ma is di 00:00, en dat leest START als di; dus de
     andere rand. Dit kan ook door Berekenen ontstaan (OPS, losse START-mijlpaal, projectstart vr: vr 12:00;
     review ronde 4 van #724). Main geeft met dezelfde invoer ook ma 00:00 (D7, START = begin; review ronde 4 en
     fixronde 4, gemeten op `1c4c8a2b6`). Het is geen besluit van Ethan, maar een gat dat al op main zat: een
     eindmoment wordt als beginmoment gelezen. Voorheen knownbug 450, geval 2; geval 1 van 450 is sinds
     2026-10-29 een aanvulling van Ethan op B10 (spec §4.2 en §8 B10). Getoetst in
     `tests/planning/check-mijlpaal-afmelden.ts` sectie 8f (elk profiel, elke route) en 8h (vaste gevallen).
     Voorstel: in een eigen PR oplossen zonder een eindmoment als beginmoment te lezen. — B
455. **Afmelden van een mijlpaal: de regel "de dichtste rand" bij overlappende diensten heeft geen vaste test.**
     `milestoneMomentOn` (`src/engine/calendar/workdayRules.ts`) zet een gepland moment midden in de dienst op
     dezelfde afstand in de getypte dag. Hoort dat moment bij een andere werkdag, terwijl het binnen de
     werkspanne van de getypte dag ligt, dan kiest de code de rand van de getypte dag die het dichtst bij ligt
     (uitwerking door de orkestrator, fixronde 3 van #724). Dat kan alleen bij diensten die elkaar overlappen.
     Het voorbeeld uit fixronde 3 (ma–do 22:00–06:00, vr 22:00–02:00, za 04:00–12:00; di 05:00 afgemeld op vr)
     valt sinds fixronde 5 onder de tweede aanvulling van Ethan (za 05:00 ligt na het einde van de
     vrijdagdienst). Gemeten in fixronde 5: met "altijd eerst het begin" in plaats van "de dichtste rand" blijft
     `check-mijlpaal-afmelden.ts` groen (13.670 controles, 0 fouten). Voorstel: een vaste uitkomst met twee
     overlappende diensten in sectie 8h, na een besluit of zo'n kalender in de app kan bestaan. — B
456. **Afmelden van een mijlpaal buiten de werkspanne van zijn werkdag: de geplande kloktijd blijft (keuze van de
     bouwer).** Een handmatig anker of een import kan een mijlpaal buiten de werktijd zetten, bijvoorbeeld ma
     18:00 bij ma–do 07:00–16:00 en vr 07:00–12:00. Afgemeld met alleen een datum houdt hij in #724 de
     kloktijd: vr 5 jun wordt vr 18:00, wo 3 jun wordt wo 18:00. Het besluit B10 zegt "de tijd uit de
     planning"; de aanvulling "einde blijft einde" gaat over een dagrand en de tweede aanvulling over een
     moment midden in een dienst. Geen van beide noemt een moment buiten de werkspanne. Een eerdere versie van
     fixronde 5 zette het ook op het einde van de dienst (vr 12:00, wo 16:00); dat is teruggedraaid omdat geen
     besluit het vraagt. Getoetst in `tests/planning/check-mijlpaal-afmelden.ts` sectie 8h (gevallen `dag`, ma
     18:00 en ma 05:00). Voorstel: aan Ethan voorleggen of afmelden ook dan "klaar in die dienst" betekent. — B

## Kalenders

22. **Goede Vrijdag en Bevrijdingsdag** hebben `optional: true`, maar dat wordt nergens gelezen: ze worden
    altijd gegenereerd. — B

## Bibliotheek, bezetting, extensies, AI

28. **Bezettingsoverzicht na een edit in het reeds geopende actieve project** mengt oude startdatums met
    nieuwe duur/inzet, onder de tekst "laatst berekende cijfers". Openen rekent het actieve project nu
    eenmaal door; edits terwijl het overzicht openblijft vereisen nog F5/Automatisch berekenen. — B
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


272. **Een al geplande verlaatberekening van `useExitRecordedDates` wordt niet geannuleerd bij
     historieherstel.** `src/hooks/useExitRecordedDates.ts:47`: een wijziging die de modus niet verlaat,
     keert terug zonder de lopende timer te stoppen. Reproductie: B5 terugdraaien → planningsbewerking →
     undo → undo, in dezelfde JavaScript-beurt. Direct daarna staat B op 16 maart met
     `minuteModelPending: true`; na de timer staat B op 9 maart en is de vlag uit. Alleen met synchrone
     oproepen gereproduceerd. Richting: annuleer de lopende verlaatberekening bij historieherstel.
     Review ronde 2 van PR #559, deel B. — B

257. **Type en commentaar van `applyLeveling` noemen de minuutvertraging niet.** `scheduleSlice.ts:69-72` en
     `createMcpTransactions.ts:958` typen het voorstel als `Pick<LevelingResult, 'delays' | 'gaps'>`. Sinds F3c
     draagt het voorstel ook `delayMinutes`, en `writeLevelingResult` (`utils/taskDefaults.ts`) schrijft die als
     `levelingDelayMinutes`. Alle aanroepers geven het volledige resultaat door, dus de minuten komen aan. Een
     aanroeper die zelf een object bouwt, verliest ze zonder typefout. Het commentaar in `applyLeveling`
     (`scheduleSlice.ts:243`) zegt nog dat de nivelleerder in hele werkdagen rekent. Voorstel: `'delayMinutes'`
     in beide types en het commentaar bijwerken. Gevonden bij F3c deel 3, alleen in de code gezien. — S

259. **Een handmatig geplande taak krijgt een nivelleervertraging die de solver negeert.** De nivelleerder
     behandelt alleen voltooide en lopende taken als onverplaatsbaar (`ResourceLeveler.ts:445`). De solver houdt
     een handmatig geplande taak op haar eigen datums en leest geen nivelleervertraging (`CPMSolver.ts:2006`).
     Na toepassen boekt de nivelleerder de taak dus op een andere plek dan het histogram haar toont.
     `tests/library/check-distribute.ts` case 18 legt dit vast: vertraging 10, einde schuift 0. Voorstel: een
     handmatig geplande taak als vaste last behandelen, zoals een lopende taak (dat verandert case 18).
     Gevonden bij F3c deel 3. — B

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

260. **Resourcebibliotheek in een sandbox-iframe zonder `allow-same-origin`: elke bibliotheekwijziging geeft
    de melding "bibliotheek opslaan mislukt", en de wijziging is na herladen weg.** Gezien bij #582 (de
    SuperCloud-werkplek weigert IndexedDB). `src/services/library/libraryStore.ts` (`saveWeb`) opent IndexedDB
    zonder de weigering te herkennen; `persistLibrary` (`src/state/slices/librarySlice.ts:334–353`) meldt dan
    `notifications.librarySaveFailed` (één melding dankzij `dedupeKey`). Bij de start blijft het stil: `loadLibrary`
    valt terug op een verse bibliotheek. Alleen in de code nagelopen, niet in de app nagespeeld. Voorstel: dezelfde
    stille sessievlag als crashherstel, of één uitleg dat de bibliotheek in deze omgeving niet bewaard wordt. — S

347. **De belasting telt dagdelen van verschillende kalenders op: vier beschikbare uren tellen als een volle dag.**
    `src/engine/scheduler/ResourceLoad.ts:446` telt per resource de dagdelen van elke taakkalender bij elkaar op;
    `:468` geeft de resource op een werkdag van haar eigen kalender de volle capaciteit, anders 0. Taak ma 1 juni
    2026 07:00–15:00, 8 u werk, inzet 1; resource met capaciteit 1 en kalender 07:00–11:00 (240 beschikbare
    minuten): belasting 1, capaciteit 1, geen overbezetting. Hetzelfde met een gewone kalender en een werkende
    uitzondering van vier uur op die maandag. Omgekeerd: twee taken op aparte vierurige kalenders (07:00–11:00 en
    11:00–15:00) op één resource met acht beschikbare uren, zonder overlap: belasting 2, capaciteit 1, onterecht
    overbezet. Al op `fbd4a3f9d`. Voorstel: vraag en capaciteit per resource per dag in dezelfde maat uitdrukken
    (werkminuten uit de werkblokken), met behoud van de dagindeling; regel 446 en 468 samen aanpassen. Gevonden in
    de aanval na #600 (GPT-6.1-Sol). — B

348. **Loslaten van de eerste contour verhuist de tweede contour naar de verkeerde toewijzing.**
    `src/state/assignmentMutations.ts:248` haalt de contour met `splice` uit de lijst; daarna koppelt
    `matchContoursToAssignments` (`src/engine/contour/contourEngine.ts:302`) opnieuw alleen op resource-id en
    volgorde. Eén taak van twee werkdagen met toewijzingen A1 en A2 op dezelfde resource: A1 heeft contour
    [480, 0] min en 480 min opgeslagen restwerk, A2 [0, 960] en 960 min. Na `setAssignmentContour(A1, null)`
    krijgt A1 de contour van A2, en A2 valt terug op haar formule. De belasting wordt [1; 3] (32 u) in plaats van
    [0,5; 2,5] (24 u). Al op `fbd4a3f9d`. Voorstel: de koppeling aan de toewijzing bewaren bij toevoegen,
    loslaten en verwijderen van een contour, en alle lezers via dezelfde koppelfunctie laten lopen. Gevonden in de
    aanval na #600 (GPT-6.1-Sol). — B

349. **Twee projectresources op hetzelfde bibliotheekitem worden apart tegen dezelfde vrije capaciteit getoetst.**
    `src/engine/scheduler/ResourceLeveler.ts:1137` (`fits`) vergelijkt de vraag van elke resource afzonderlijk met
    de restcapaciteit van het poolitem; de som wordt pas daarna geboekt. Bibliotheekitem P heeft capaciteit 1; de
    projectresources R1 en R2 (elk capaciteit 1) verwijzen allebei naar P. Eén taak vraagt op ma 1 juni 2026 één
    eenheid van R1 en één van R2. `computeDistribution` geeft `blocked: null` en geen tekort, terwijl
    `afterLoadByDay` op die dag 2 telt; het restprofiel wordt op 0 geklemd en verbergt de overschrijding.
    `librarySlice.linkRecognizedItems` laat twee projectresources aan hetzelfde item koppelen, dus deze invoer kan
    ontstaan. Al op `fbd4a3f9d`. Voorstel: de kandidaatvraag per bibliotheekitem en werkdag optellen vóór de
    pooltoets, en die som ook bij onderbrekingen gebruiken (`:1058`); de projecttoets blijft daarnaast nodig.
    Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

350. **Een tussenstap zonder resource maakt een afhankelijke taak te vroeg plaatsbaar.**
    `src/engine/scheduler/ResourceLeveler.ts:660` telt een taak zonder vraag meteen als geplaatst; de wachtrij
    (`:718`) wacht daardoor alleen op actieve voorgangers. Kalender ma–vr 08:00–16:00, capaciteit 1. A → M → B
    met FS+0, elk één werkdag; A heeft prioriteit 500 en resource R, M heeft geen resource, B prioriteit 1000 en
    resource R. Pin C bezet R op ma 1 juni 2026; D (prioriteit 400) vraagt R op do 4 juni. A moet naar dinsdag,
    dus M naar woensdag en B naar donderdag. De nivelleerder boekt B al op woensdag, en D krijgt donderdag. Na
    toepassen en herberekenen staat B ook op donderdag: het histogram telt daar 2 bij capaciteit 1, en
    `unresolved` is leeg. Al op `fbd4a3f9d`. Voorstel: een actieve taak pas plaatsbaar maken als ook haar
    transitieve actieve voorgangers via tussenstappen zonder resource geplaatst zijn, binnen de bestaande
    plaatsingsvolgorde. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

370. **Nivelleren van een grote planning is nog 2,8 keer trager dan vóór de urenomzetting.** De a12-planning
    (2.000 taken, 400 kraantaken) kostte 546 ms op `fbd4a3f9d`, 14.353 ms op `9a636ec69` en 1.539 ms na de fix
    in #665 (`src/engine/scheduler/ResourceLeveler.ts:309`, `:969`). De kandidaatopbouw per taak is weer
    lineair; over een rij concurrerende taken blijft de nivelleerder kwadratisch in het aantal kandidaten.
    Voorstel: meten waar de resterende tijd zit en daar de kalenderwandeling per kandidaat delen. Gevonden in de
    review van de fix voor aanval a12 (GPT-6.1-Sol). — B

354. **MCP verbergt een minutenlag en de eenheid van een kalendertijdlag.** `src/services/mcp/tools/sequenceFields.ts:89`
    (`lagLabel`) leest alleen `lagDays` en `lagPercent`. Een relatie met `lagMinutes: 240` toont in
    `planner_get_task` `lag: ""`; een bestaande kalendertijdlag van 1 d toont `"+1d"`, zonder eenheid.
    `planner_update_dependencies` met `lag: 2` schrijft alleen `lagDays` (`dependencyTools.ts:351`) en laat
    `lagUnit: ELAPSEDTIME` staan; de opvolger begint dan ma 8 juni 07:00 in plaats van wo 10 juni. Al op
    `fbd4a3f9d`. Voorstel: de gedeelde `formatLagShort`/`parseLagInput` uit `src/utils/lagFormat.ts` gebruiken,
    en bij een nieuwe lag ook de eenheid schrijven. Gevonden in de aanval na #600 (GPT-6.1-Sol). — B

355. **`planner_update_calendar` met `workTime: null` weigert, ook als de kalender dezelfde werkblokken houdt.**
    `src/services/mcp/tools/calendarResourceTools.ts:940` weigert zodra een urentaak de kalender gebruikt
    ("cannot remove concrete work blocks"). Op een gelijkwaardige scalaire kalender (07–16, pauze 12–13) blijft
    dezelfde urentaak gewoon 07:00–11:00. Al op `fbd4a3f9d`. Voorstel: de uiteindelijke kalender toetsen op
    geldige effectieve werkblokken, niet op de aanwezigheid van `workTime`. Gevonden in de aanval na #600
    (GPT-6.1-Sol). — B

362. **Een B5-omzetting bij een latere MCP-call staat niet in het antwoord.** Alleen `planner_import_schedule`
    geeft `minuteModelConversion` mee. Staat de omzetting nog open, dan rekent een volgende leestool
    (`freshenScheduleForRead`) of muterende tool (de MCP-transactie) om, en `runCPM` meldt dat alleen via het
    meldingenkanaal (`src/state/slices/scheduleSlice.ts:180`). Probe van de aanval: oud bestand importeren,
    `planner_undo` (modus "datums zoals opgeslagen", omzetting weer open), dan `planner_batch` met
    `planner_update_tasks` `duration: 6, durationUnit: "days"`: de taak eindigt di 9 juni 10:12, de omzetting is
    dicht, en het antwoord noemt haar niet. Hetzelfde geldt voor een slapend hersteld document na
    `planner_switch_document`. In de modus zegt de envelop wel dat een wijziging herberekent (`scheduleNote`).
    Voorstel: de omzetting van `runCPM` via de MCP-lease in de envelop zetten, zoals `remainingWorkRecomputed`.
    Gevonden bij de fix van aanval a10 na #600. — B

363. **De kalenderreparatie bij het openen van een oud bestand bereikt MCP en de kern niet.**
    `src/state/slices/fileSlice.ts:928` meldt `notifications.minuteModelCalendarRepaired` alleen via het
    meldingenkanaal: past het einde of de pauze van een kalender niet bij de opgeslagen werktijd, dan herstelt
    het laadpad de kalender. `planner_import_schedule` en `openIfc` zeggen daar niets over. Nagespeeld in de
    review van #664: een oud IFC met een scalaire kalender 07–11 en 8 uur per dag wordt bij openen 07–15; de
    app krijgt de melding, MCP en `openWarnings` melden alleen de taakverschuiving, en de kernexport schrijft
    de herstelde kalender zonder melding (`src/core/index.ts:88`). Voorstel: dezelfde route als de
    B5-omzetting: de herstelde kalenders teruggeven uit `applyLoadedProject`, en ze in het importantwoord en
    in `openWarnings` zetten. Gevonden bij de fix van aanval a10 na #600. — B

368. **De headless HTTP-route met `output=ifc` heeft geen kanaal voor waarschuwingen.**
    `headless/server/server.mjs:295` geeft bij een oud IFC het omgerekende bestand terug (`TimeModel =
    MINUTES-1`), zonder waarschuwing in de body of de headers; `output=summary` meldt de B5-omzetting wel.
    Hetzelfde geldt al voor `XER_ARCHIVE_DROPPED`. Voorstel: een contractkeuze, bijvoorbeeld een
    gedocumenteerde responseheader met de waarschuwingscodes. Gevonden in de review van de fix voor aanval
    a10 (GPT-6.1-Sol). — B
447. **De extensie-API meldt een mijlpaal af met D7, niet met de geplande tijd.** `api.data.updateTask` met
     `time.actualFinish: '2026-06-03'` op een losse mijlpaal zonder soort (OPS, gepland ma 1 jun 16:00) geeft
     2026-06-03T07:00, waar paneel, tabel, Taak bewerken, voortgangsimport en MCP sinds het besluit van
     2026-10-29 16:00 geven. Oorzaak: de route is rauwe veldtoegang (`fromExtTaskUpdates` →
     `taskSlice.updateTask` → `normalizeTaskDates`, D1–D7) en draait geen voortgangsregels; ook status en
     werkelijke start blijven daar ongemoeid (status NOT_STARTED bij completion 1). Gemeten met een probe op de
     store-aanroep die de API doet. Voorstel: een eigen voortgangsactie in de extensie-API, of bewust zo laten en
     in de API-docs noemen. — B

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

150. **OPS v2026.9.0 maakt van een kalender in een nieuw IFC-bestand een urenkalender zonder werktijd zodra
    een taak op die kalender een tijd ≠ 07:00 of een `PT`-duur heeft.** Oorzaak: v2026.9.0 leest
    `WorkingTimes` van `IfcWorkCalendar` op plek 5; sinds #336 staat daar Identification (aanvaard verlies,
    `docs/ifc-round-trip.md:351-356` en `:436-460`). De geregistreerde werkblokken zijn dan leeg, en de
    promotie met een tijdsignaal kiest die lege werkblokken (`promoteHourCalendar` met
    `preferCanonicalWhenEmpty`, `src/services/subdayIo.ts` op tag v2026.9.0). Nagemeten met de lezer en de
    solver van v2026.9.0 in Node: een bestand van main met een urentaak van 480 min op de standaardkalender
    geeft `workTime` met lege werkblokken op alle zeven dagen; na doorrekenen heeft de urentaak duur 0
    (begin en einde do 07:00). Een dagenmaat-taak met een breuk (0,5d) heeft ook een `PT`-duur en
    valt eronder: in review r1 van #600 nagemeten, 240 min op lege werkblokken, begin en einde 07:00.
    `docs/ifc-round-trip.md` noemt alleen "werkuren terug naar 07–16"; dit gevolg
    staat er niet bij. Voorstel: de releasetekst noemt het, naast het aanvaarde verlies van de kalenders.
    Gevonden bij fixronde 2 van de spec `2026-10-20-alleen-uren-design.md` (§5.4). — B

127. **IFC-tab *Toepassen* wist de bibliotheekkoppeling en zet *Niet opgeslagen* uit.** *Toepassen*
    (`IFCPanel.tsx:57-62`) roept `loadState` aan zonder `linkedOpen`; `applyLoadedProject` wist dan `companyId`
    en `companyName` (`fileSlice.ts:797-799`) en `isDirty` wordt `false` (`documentContract.ts:489`). Een
    gewijzigd project lijkt zo opgeslagen, en sluiten vraagt niets. Nagespeeld met het voorbeeld plus
    bibliotheek en een gewijzigde taaknaam: vóór `isDirty` true, erna false, `companyName` null, de wijziging
    blijft aanwezig. Voorstel: `isDirty` laten staan en de koppeling behouden. — B
128. **CSV: een datum in een onleesbare vorm wordt stil "vandaag".** `csvDateOrToday` valt terug op
    `localTodayIso()` (`importDates.ts:71-74`, gebruikt door `csvReader.ts:135`). De Help noemt alleen de drie
    geldige vormen. Of er elders een melding voor komt, is niet nagegaan. Niet nagespeeld. — S

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

261. **Recente bestanden in een sandbox-iframe zonder `allow-same-origin` tonen hoogstens het laatst geopende
    bestand, en na herladen niets.** Gezien bij #582. `src/services/fileAccess/recentFiles.ts` gebruikt de
    stille `idb*`-helpers: `loadRecents` leest daar altijd een lege lijst, dus `addRecent` geeft alleen de nieuwe
    regel terug. Geen melding. Alleen in de code nagelopen, niet in de app nagespeeld. Voorstel: in die omgeving
    de lijst in het geheugen houden, of Recent daar verbergen (de site heeft een eigen bestandslijst). — S

330. **Een herstelmanifest `documents` zonder `isDirty` markeert een schoon document als gewijzigd.**
    `src/services/recovery/recoveryStore.ts:1361`: bij een geaccepteerd `documents`-manifest zonder `isDirty`, en
    `isDirty: false` in het documentrecord, gaf de basis `false` en geeft de nieuwe expressie `true`. Zeldzaam; het
    document vraagt dan onnodig om opslaan. Voorstel: bij ontbrekende manifestmetadata terugvallen op
    `rec.isDirty`, vóór de standaardwaarde `true`. Gevonden in review r1 van #599 (GPT-6.1-Sol). — B

256. **Een kale start op een letterlijke kalender schuift in de ruwe IFC-rondgang naar 07:00.** Kalender
     09:00–17:00 met letterlijke tijden. Een planningsstart zonder tijd wordt in de ruwe route
     `readIFC → writeIFC → readIFC` 07:00, terwijl de laadgrens er 09:00 van maakt. Via de echte laadroute
     van de app gaat het goed. Locatie: `minuteModelWrite.ts:90` (`literalEndOf` laat een kale start
     ongemoeid). Richting: maak de invoervoorwaarde van de ruwe writer expliciet (alleen genormaliseerde
     payloads), of normaliseer ook kale planningsstarts met hun veldregel. Gevonden in review #581 r2
     (VERVOLG). Het MSPDI-deel (de ruwe export schreef 08:00) is opgelost in F5a-2: `mspdiWriter.ts` geeft
     zo'n start het begin van de werkdag (`check-uren-f5a2-adapters.ts` (9)). Het IFC-deel staat nog open. — B

290. **Een OPS-tekstveld in MSPDI kan langer worden dan 255 tekens.** De records van F5a-2
     (`OPS_DayMeasureLags`, `OPS_DayMeasureDurations`, `OPS_ExactMinutes`) staan in de MS Project-velden
     Text26–Text28 (`mspdiWriter.ts`, `OPS_DAY_MEASURE_*_FIELD_ID`). Een opvolger met veel lags in dagen met een
     breuk krijgt één JSON-tekst met een record per relatie (ongeveer 15–25 tekens per record). MS Project
     beperkt een tekstveld tot 255 tekens. Wat MS Project bij eigen opslaan met een langere waarde doet
     (afkappen, weigeren), is niet getoetst: geen MS Project op deze machine. Een afgekapte JSON leest OPS
     als geen record, dus als urenmaat met dezelfde lengte. Gevonden bij F5a-2.
     Concreter (aanval na #600, GPT-6.1-Sol): op een 8-uurskalender met per voorganger een FS-lag van 0,5 d
     heeft Text26 bij 14 voorgangers 244 tekens, bij 15 262 en bij 16 280. De writer schrijft de hele JSON
     zonder lengtegrens (`mspdiWriter.ts:669`, `xmlDayMeasure.ts:160-162`). Afgekapt op 255 tekens is de
     JSON ongeldig en komen alle 15 relaties terug als 240 minuten (gesimuleerd, logregel in
     `/tmp/aanval/a06-controles-voorbeeld.log`; het bestand `/tmp/aanval/a06-afgekapt-255.xml` is het geval met
     16 voorgangers; niet bewezen dat MS Project zelf afkapt). Richting: controleer de
     veldlengte vóór het schrijven en maak het maatverlies expliciet; toets met echt opslaan in MS Project.
     Sinds #658 kan een record een ongeronde dagwaarde dragen (`recordDayValue`, `dayMeasureIo.ts:83`); dat maakt
     Text26 sneller te lang: acht voorgangers met FS +5/6 d op 465 min per dag geven 257 tekens (177 op
     `9a636ec69`), acht keer −1/6 d 273 tekens. Gesimuleerd afkappen maakt alle acht records ongeldig; de lezer
     valt terug op acht lags van 388 minuten. — S

291. **P6 XML rondt begin en einde van een dagkalender met één blok af op het hele uur.** Een dagkalender
     07:30–15:30 (8 u, één blok) komt na `writeP6XML → readP6XML` terug als 07:00–15:00. MSPDI houdt
     07:30–15:30. Locatie: `p6xmlReader.ts:273-274` (`parseP6StandardWorkWeek`, `Math.floor` op de uren).
     Een dagkalender met pauze (twee blokken) uit een OPS-bestand leest sinds F5a-2 wel op de minuut
     (`registerP6Bands`). Nagespeeld met een probe bij F5a-2. Richting: begin en einde op de minuut, zoals
     `applyCalendarBody` in de MSPDI-lezer. — B

295. **De IFC-lezer neemt een dagenrecord over na een kalenderwissel.** `ifcReader.ts:1590` accepteert het
     duurrecord `DayMeasureDurations` alleen als de slotminuten nog overeenkomen; bij de rest gebeurt
     hetzelfde. Wijzigt een ander programma alleen de kalendertoewijzing naar een aanwezige kalender van 10 u,
     dan komen 2,5 d en 1,5 d terug, en wordt 20 u / 12 u bij opnieuw opslaan 25 u / 15 u. Dezelfde fout zat in
     MSPDI en P6 XML en is daar in #585 gerepareerd (review r1, punt 2). Ook op basis `a6f9e2b1b`, dus hij
     hoort bij F3c. Richting: controleer de huidige kalender en het duurtype voordat een dagenrecord terugkomt,
     zoals `dayRecordFits`/`contextLost` in `xmlDayMeasure.ts`; anders de urenmaat voor duur en rest.
     Nagespeeld door de reviewer van #585 r2 (Sol, VERVOLG). — B

296. **De exportmeldingen zeggen dat de lagkalender verloren gaat, terwijl OPS hem bewaart.**
     `mspdiWriter.ts:503` meldt "scheduling-opties lagCalendar niet native uitdrukbaar — weggelaten, alleen via
     IFC OPS_SchedulingOptions" (de lijst komt uit `:479`). `p6xmlWriter.ts:304` meldt "scheduling-opties niet
     geëxporteerd". Sinds #585 schrijven beide writers `OPS_LagCalendar`, en `successor` komt bij heropenen in
     OPS goed terug. MS Project en P6 kennen de optie zelf niet. Richting: een melding die beide zegt: het
     andere programma rekent er niet mee, OPS bewaart hem wel. Gezien door de reviewer van #585 r2 (Sol,
     VERVOLG). — B

300. **Een oude OPS-export die daarna van vorm veranderde, leest als vreemd bestand.** OPS v2026.6.0 tot en met
     v2026.8.1 schreef nog geen OPS-markering. De lezer herkent zo'n MSPDI- of P6 XML-export aan de vorm van die
     writers (`isLegacyOpsMspdi`, `mspdiReader.ts`; `isLegacyOpsP6Xml`, `p6xmlReader.ts`), en leest 08:00 dan als
     anker. Wijkt de vorm op één punt af, dan geldt de regel voor een vreemd bestand: 08:00 is een echte tijd.
     Voorbeeld: een export van v2026.8.1 met een voltooide taak van 1–2 juni, waar een ander programma
     `<SaveVersion>` aan toevoegde of de elementen in een andere volgorde zette: het werkelijke einde blijft
     2 juni 08:00, niet 16:00 (`check-uren-f5b-adapters.ts` (12)). Slaat MS Project zo'n export op, dan toont MS
     Project zelf ook 08:00. De uitvoer van alle vijf oude writers past op de vingerafdruk; geen van de 184
     vreemde XML-bestanden van het corpus past erop (43 MSPDI-bestanden zonder `<SaveVersion>` vallen op de kop
     af). Gevonden in F5b; ingeperkt in fixronde 1 van #591. — S

301. **De `.mpp`-lezer leest geen OPS-markering.** `mppReader.ts` leest geen eigen tekstvelden (Text24–Text30),
     dus geen duureenheid en geen maatrecord (T21). In het corpus draagt geen van de 661 `.mpp`-bestanden een
     OPS-veld (`OPS_MPP_CORPUS`, gezocht in F5b). Een OPS-MSPDI die in MS Project als `.mpp` is opgeslagen, komt
     daardoor volledig in de urenmaat terug: een dagenmaat-taak van 2,5 d wordt 20 u. Niet getoetst met MS
     Project (niet op deze machine). Richting: de eigen tekstvelden van `TBkndTask` lezen, met dezelfde
     definitieregel als MSPDI. Gevonden in F5b. — S

302. **Projectdatums gaan naar MSPDI en P6 XML met het anker 08:00.** `<StartDate>`, `<FinishDate>`,
     `<StatusDate>` (`mspdiWriter.ts`) en `<PlannedStartDate>`, `<MustFinishByDate>`, `<DataDate>`
     (`p6xmlWriter.ts:789`) krijgen voor een datum zonder tijd `T08:00:00` (`toXmlDateTime`). Gezien met een
     probe: projecteinde 31 december ⇒ `MustFinishByDate 2026-12-31T08:00:00`. P6 leest dat vermoedelijk als
     "klaar vóór 08:00", een werkdag te vroeg (VERMOED, niet getoetst in P6). Binnen OPS is het een anker
     (`statusDateFromXml`); projectdatums blijven zoals ingevoerd (spec §3.6). Richting: een einde-achtige
     projectdatum het einde van de werkdag geven, met een eigen OPS-markering zodat de leesregel gelijk blijft.
     Gevonden in F5b. — S

303. **Een kalenderuitzondering in MSPDI en P6 XML krijgt op begin én einde 08:00.** `mspdiWriter.ts:260-273`
     schrijft `<FromDate>…T08:00:00</FromDate>` en `<ToDate>…T08:00:00</ToDate>`; P6 XML schrijft
     `<HolidayOrException><Date>…T08:00:00`. Gezien met een probe (feestdag 25–26 mei). MS Project schrijft zelf
     `00:00:00` en `23:59:00`. Of MS Project de laatste dag van de uitzondering dan als werkdag leest, is niet
     getoetst (VERMOED). Gevonden in F5b. — S

304. **De lijst `OPS_LiteralCalendars` kan in MSPDI langer worden dan 255 tekens.** Zelfde grens als 290: het
     veld staat in Text24 (`OPS_LITERAL_CALENDARS_FIELD_ID`, `mspdiWriter.ts`). Een JSON-lijst van ongeveer 60
     kalendernummers past nog. Een afgekapte lijst is ongeldig; de lezer valt dan terug op het tijdsignaal
     (`check-uren-f5b-adapters.ts` (10)): de tijden blijven goed, maar elke kalender met een einde ≠ 08:00 wordt
     een urenkalender. Gevonden in F5b. — S

305. **Een automatische mijlpaal op het dageinde maakt zijn kalender in een MSPDI- of P6-export nog letterlijk.**
     `literalAutomaticMilestones` (`minuteModelWrite.ts:56`) bestond omdat MSPDI geen AtDayEnd-hint heeft en het
     moment anders verloren ging. Sinds F5b draagt de export het echte moment (16:00), dus de optie is voor
     verliesvrijheid niet meer nodig; hij laat de kalender na heropenen wel een urenkalender worden. Bewust
     gelaten in F5b, zodat de promotie gelijk blijft aan F5a. Richting: de optie weghalen, met `measure:profiles`
     (T11). Gevonden in F5b. — S

306. **De promotieregel van spec §3.10 is niet gebouwd.** De spec zegt: "Een lezer maakt alleen nog een
     urenkalender als de kalender per dag verschilt of eigen werkblokken heeft; anders blijft hij scalair (§3.1)."
     MSPDI (`mspdiReader.ts:420`), P6 XML (`p6xmlReader.ts:989`), XER (`xerReader.ts:678`) en `.mpp`
     (`mppReader.ts:694`) promoveren nog op een tijdsignaal: een tijd die niet het anker is (in XER elke tijd), of
     een duur die geen hele werkdag is. Ook F5a bouwde dit niet. Een wijziging raakt de
     P6-conventies die op `isHourModeCalendar` letten (T11) en vraagt `measure:profiles`. Gelezen in de code
     (F5b). — B

308. **In een OPS-export zonder lijst beslist de kalender of 08:00 een anker is.** Zo schreven de writers van
     v2026.6.0 tot en met F5a: per kalender een moment of een datum zonder tijd (`XmlTimeRule`,
     `xmlInterchange.ts`). Twee gevallen lezen daardoor anders dan de bron bedoelde, net als vóór F5b:
     (a) op een urenkalender leest een datum zonder tijd als 08:00. Voorbeeld: een kale beperking "start niet
     eerder dan 3 juni" op een kalender van 07:00 tot 15:00 komt terug als 3 juni 08:00, niet 07:00. Een
     planningsveld heeft dit niet: daar schreef de writer het moment (MSPDI in F5a), of de berekende datums waren
     momenten (v2026.10.0);
     (b) een letterlijke kalender zonder tijdsignaal leest scalair. Voorbeeld: een export van F5a met alleen
     een urenmijlpaal om 08:00 op een kalender van 07:00 tot 15:00: de mijlpaal wordt een datum en na laden
     07:00. Een export sinds F5b heeft geen van beide (echte tijden en `OPS_LiteralCalendars`). Gelezen in de
     code; (a) en (b) niet nagespeeld met een echte oude writer. Gevonden in fixronde 1 van #591. — S

335. **Een P6 XML- of MSPDI-export uit het minutenmodel komt terug met een urenkalender.** Gemeten met
     `03-kantoorgebouw-zuidas.ifc`, het oude en het opnieuw gegenereerde bestand: openen in de store,
     `writeP6XML`/`writeMSPDI` met de store-stand, terug inlezen. De projectkalender heeft dan `workTime` met twee
     blokken per werkdag (07:00–12:00 en 13:00–16:00). Op `main` bleef dat een dagkalender zonder `workTime`
     (de dagbestand-discriminator in `check-adapters-hours.ts`). Oorzaak: in de store is elke datum een moment
     (07:00, 16:00), en dat is tijdsignaal (c) van de importdiscriminator (`subdayIo.ts:14-22`). De taken blijven
     dagenmaat en het bladschema blijft gelijk; alleen de vorm van de kalender verandert. De check leest sinds
     PR #600 het oude bestand uit `tests/planning/fixtures/minute-model-examples-f0/` en ziet dit dus niet. Of dit
     een fout is, is niet beoordeeld. Gevonden bij het opnieuw genereren van de voorbeelden. Na F5b (#591) is
     de uitkomst gelijk, maar de oorzaak anders: de export noemt de projectkalender zelf in
     `OPS_LiteralCalendars` (MSPDI Text24 `[1]`), en de lezer maakt een kalender uit die lijst een urenkalender.
     Het tijdsignaal telt in zo'n export niet meer; de vroegere 275 is in #591 opgelost. Gemeten met een probe
     bij het bijwerken van #591 met main. — B

336. **Het bronbestand van een externe koppeling wordt zonder laadgrens gelezen.** `parseExternalSource`
     (`fileSlice.ts:1385`) leest het bestand met de kale `readIFC`; het anker is dan een datum zonder tijd, en de
     eigenaar normaliseert die naar de kant van de relatie (`externalAnchorField`, `minuteModel.ts:159`). Twee
     gevolgen, gemeten met een script op `examples/showcase-groot-terrein-onderaannemer.ifc`:
     (1) een mijlpaal heeft in de geopende bron één moment (D7), maar het anker valt aan de andere kant van de
     dag: FS naar de startmijlpaal *Start of subcontractor site works* geeft `2027-03-01T16:00` (bron 07:00), SS
     naar de eindmijlpaal *Site ready for main contractor paving* geeft `2027-04-06T07:00` (bron 16:00); gewone
     taken en FS naar een eindmijlpaal kloppen. (2) `refreshExternalAnchors` vergelijkt het opgeslagen moment
     `2027-04-06T16:00` met de kale `2027-04-06` en meldt `changed` bij een koppeling die al actueel is; dan maakt
     `refreshExternalAnchorsFrom` een undo-stap en rekent opnieuw (vergelijk 241). Niet in de app-dialoog
     nagespeeld (Tauri-route). Richting: lees de bron via de laadgrens, zoals `loadState`. Gevonden bij het
     opnieuw genereren van de voorbeelden (PR #600). — B

337. **De urentaken in De Vaart duren 5 werkdagen in plaats van 4 tot 8 uur.** `scripts/showcase-groot.ts:160-171`
     geeft vlechtwerk en stort per toren `durMinutes` (480, 360, 480, 240) op de uurkalender. `gen-core.ts:193` zet
     alleen `time.durationMinutes`; de taak blijft dagenmaat met de standaardduur 5 (`dur ?? 5`). Gemeten met een
     script in het oude bestand (`tests/planning/fixtures/minute-model-examples-f0/`) en in het nieuwe:
     *Rebar fixing, basement floor — Tower A* loopt van 13 mei 07:00 tot 20 mei 15:00 (5 werkdagen). De belofte
     "sub-dag, zichtbaar aan een balk die niet op een hele dag valt" (`showcase-groot.ts:159-160`) klopt dus niet.
     Richting: `durationUnit: 'hours'` zetten als `durMinutes` er is; dat verschuift wel de hele planning van
     De Vaart en de getallen in de gidsen. Gevonden bij het opnieuw genereren van de voorbeelden (PR #600). — B

382. **MSPDI en MPP zonder `ActualFinish` maar op 100 % met een rest komen binnen als lopend.** Sinds #663 geldt
     "geen werkelijk einde en rest > 0" als teken voor lopend op 100 % (`src/services/msproject/mspdiReader.ts:643`,
     `src/services/mpp/mppReader.ts:857`). Een bron met 100 %, geen `ActualFinish` en één minuut rest wordt
     `STARTED` met 100 % en een leeg werkelijk einde, ook na F5. Bedoelde de exporteur voltooid, dan ziet de
     planner een lopende taak. Microsoft zet bij 100 % zelf een `ActualFinish`; een echte bronfixture met dit
     geval ontbreekt. De tegenproef klopt: 99,6 % wordt bij de eigen MSPDI-export 100 % en blijft met twaalf
     minuten rest terecht lopend. Voorstel: alleen met een echte bronfixture aanpassen, eventueel met een
     importmelding; geen drempel die echte rest wist. Gevonden in review ronde 3 van #663 (GPT-6.1-Sol). — S

372. **Een kalendertijdtaak met een breuk in dagen verliest bij heropenen uit MSPDI een minuut.** ELAPSEDTIME-taak
     5/6 ed vanaf 1 juni 2026 07:00: vóór export eindigt ze 2 juni 03:00, na heropenen en doorrekenen 02:59. Het
     record houdt zes decimalen, omdat 5/6 en 0,833333 allebei afgerond 1200 minuten geven; de solver telt
     daarna de onafgeronde klokminuten op en de formatter snijdt de seconden af
     (`src/services/xmlDayMeasure.ts:82`, `src/engine/scheduler/duration.ts:182`, `:188`,
     `src/utils/dateUtils.ts:119`). Ook gezien met werkkalenders van 465 en 525 minuten; al zo op `9a636ec69`.
     Voorstel: de afgesproken minuutgrens respecteren bij het omzetten naar klokminuten. Gevonden in de review
     van de fix voor aanval a06 (GPT-6.1-Sol). — B

375. **Een XLSX-cel met alleen een tijdopmaak verliest het onderscheid tussen een moment en een datum.**
     `src/services/xlsx/readXlsxSheet.ts:251` en `:400`, `src/services/progressImport/parseProgressXlsx.ts:65`.
     Voorbeeld: in een aangeleverd voortgangsblad staat het werkelijke einde als serieel getal 46175 met de
     opmaak `hh:mm:ss` of ingebouwd 21. De lezer maakt er de kale datum 2 juni van; toepassen op de
     24-uurskalender geeft 3 juni 00:00 in plaats van 2 juni 00:00. Een opmaak met alleen een tijd verbergt de
     datum, dus #659 laat hier bewust de datumlezing staan. Stond al zo op main; de OPS-schrijver maakt zo'n
     opmaak zelf niet (`writeProgressXlsx.ts:277–280`). Alleen `12:00` intypen geeft 0,5 en wordt zichtbaar
     geweigerd; een volledig datum-tijdgetal onder een tijdopmaak wordt stil geaccepteerd. Voorstel: deze grens
     apart behandelen, bijvoorbeeld zichtbaar weigeren of melden. Gevonden in review r2 van #659
     (GPT-6.1-Sol). — B

468. **De MSPDI-export zet `MaterialLabel` en `StandardRate` op de verkeerde plek in `<Resource>`.**
     `src/services/msproject/mspdiWriter.ts` (resourcelus): het schema van Microsoft wil `MaterialLabel` vóór
     `MaxUnits` en `StandardRate` vóór `CalendarUID`; de writer schrijft ze erna. Stond al zo op main. Een
     strenge XML-lezer kan het bestand weigeren. Voorstel: de twee schrijfregels verplaatsen. Gevonden in review
     r1 van #728 (GPT-6.1-Sol), tegen de schemavolgorde vergeleken. — B

469. **Een urentaak in kalendertijd met alleen een rest in dagen exporteert een andere rest dan de motor
     rekent.** `src/services/msproject/mspdiWriter.ts` (`writtenRemaining`): zonder `remainingMinutes` telt de
     writer `remainingTime` in de werktijd per dag van de taakkalender. De motor (`CPMSolver.progressWork`,
     tak `elapsed`) negeert `remainingTime` bij een urentaak en rekent de rest uit de voortgang. Een urentaak
     draagt normaal `remainingMinutes`, dus dit raakt alleen data van buiten de app. Gezien bij #555 in de code;
     niet nagespeeld. — S

470. **In de stappeneditor van een resource kun je geen capaciteit 0 typen.** `ResourcePanel.tsx` (stapveld)
     gebruikt de strikt positieve `UnitsInput` (`UnitsInput.tsx`): `0` geeft geen waarde. Een stap naar 0 uit
     XER of MS Project XML (niet beschikbaar) blijft staan, maar een planner kan een stap niet zelf op 0 zetten.
     MCP accepteert 0 sinds #728. Stond al zo op main. Voorstel: alleen het capaciteitsveld van een stap 0 laten
     accepteren; de vlakke capaciteit en toewijzingseenheden blijven groter dan 0. Gevonden in review r3 van
     #728 (GPT-6.1-Sol), in de broncode; geen browserhandeling. — B

471. **De MSPDI-lezer leest overlappende beschikbaarheidsperiodes en een echte grens op 2049-12-31 niet goed.**
     `src/services/msproject/mspdiAvailability.ts` (`availabilityFromPeriods`). (a) Een korte periode binnen een
     langere (bijv. 1–30 nov capaciteit 1, 2–6 nov capaciteit 2) houdt na 6 november capaciteit 2. MS Project
     weigert overlappende periodes zelf, dus een gewoon bestand bevat ze niet. (b) Eén periode die precies op
     2049-12-31 eindigt, telt als open einde (NA). Op de datum alleen is dat niet van een echte grens te
     onderscheiden; met een latere periode erna telt het wel als grens. Een export van OPS zelf heeft beide
     gevallen niet. Voorstel: overlap weigeren of per dag de laatste periode laten winnen; voor (b) de volledige
     tijd van NA vergelijken (MPXJ `LocalDateTimeHelper`): de lezer knipt de tijd nu af, dus een einde op
     2049-12-31T23:58:00 (voor MPXJ een echte grens) telt ook als open. Gevonden in review r4 en r5 van #728
     (GPT-6.1-Sol), met een proefscript. — B

472. **Een ongeldige beschikbaarheidsperiode in MSPDI kan het open einde van een geldige periode sluiten.**
     `src/services/msproject/mspdiAvailability.ts` (`availabilityFromPeriods`): `lastFrom` telt alle rijen, ook
     die de filter daarna weggooit. Voorbeeld: `1984-01-01 → 2049-12-31` met capaciteit 1 plus een ongeldige rij
     `2050-01-03 → 2048-01-01` geeft capaciteit 0 vanaf 2050-01-01 in plaats van 1. Alleen bij ongeldige invoer
     van buiten. Voorstel: `lastFrom` alleen over de geaccepteerde rijen berekenen. Gevonden in review r5 van
     #728 (GPT-6.1-Sol), met een proefscript. — B

480. **Een paar zeldzamere exportweglatingen staan nog alleen in de console, niet in de verliesenvelope.**
     `src/services/xerExportLoss.ts` (`categoriesFor`) kent sinds #727 notities, datumconstraints die het doelformaat niet schrijft,
     handmatige planning en hammock-taken ook voor een native project. Nog niet: een soft MSO/MFO die MSPDI als
     SNET/FNET schrijft (`mspdiWriter.ts`, `softLossCount`), `levelingDelayMinutes` (MSPDI en P6),
     resume/stop (MSPDI) en een ELAPSEDTIME-taakduur naar P6 (`p6xmlWriter.ts`, `elapsedTaskCount`). Gelezen in
     de writers, niet nagespeeld. Voorstel: per geval een categorie en een capability in dezelfde matrix. — S

482. **De exportverliestest bewaakt een primaire constraint op een P6-verzameltaak niet apart.**
     `tests/planning/check-xer-export-loss.ts` (scenario "Native verzameltaak met constraints") geeft de
     verzameltaak een primaire én een secundaire constraint. Een fout die alleen de primaire mist (in
     `hasConstraintLoss`, tak `activities`, alleen `constraint2` controleren) blijft zo groen. Voorstel: in
     hetzelfde scenario ook een verzameltaak met alleen SNET of ALAP, met waarschuwing én teruggelezen verlies.
     Gevonden in review ronde 3 van #727 (GPT-6.1-Sol), met een mutatie nagespeeld. — B

483. **Na een export kunnen de exportmeldingen de verliesmelding verdringen.** `exportAs` in
     `src/state/slices/fileSlice.ts` zet de verliesmelding (algemeen of XER) eerst en daarna de meldingen voor
     onderbrekingen, ingekorte P6-namen en vervangen XML-tekens; de UI toont er hoogstens drie
     (`uiSlice.ts`). Een P6-export met een notitie, een onderbreking zonder urenverdeling en een te lange naam
     die op een emoji wordt ingekort, geeft vier meldingen: de verliesmelding met *Lees meer* verdwijnt. De
     informatie blijft in `warnings`. Voorstel: bundel de exportmeldingen als detailregels in één melding.
     Gevonden in review ronde 4 van #727 (GPT-6.1-Sol), nagespeeld. Sinds #728 kan ook de melding over een
     kritiek-drempel in uren erbij komen (eigen project met urendrempel, notitie, onderbreking en vervangen
     teken: de algemene verliesmelding valt weg; review r6 van #728, nagespeeld). — B

## Rondleiding, Help en extensie-gidsen

68. **Een gidsstap die eenmaal "gedaan" is, blijft gedaan**, ook na wisselen naar een leeg project. Gezien bij
    tutorial 6 stap 8; niet uitgezocht of dat bedoeld is. — S
404. **Commentaar bij het welkomstvenster mist de ontbrekende instelling.**
     `src/state/slices/types.ts:773` zegt dat `loadWelcomeSeen()` `false` geeft.
     Zonder `ops-welcomeSeen` geeft de functie juist `undefined`
     (`src/utils/settingsStore.ts:73-76,602-604`). Ook dan opent het venster
     (`src/hooks/useSettingsBootstrap.ts:84-85`). Richting: noem beide waarden,
     of schrijf dat de vlag niet waar is. Alleen commentaar; het gedrag klopt.
     Vastgesteld bij de onafhankelijke broncontrole van PR #698. — B

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


240. **De tutorialteksten in de extensie en de schermbeelden van de gidsen hebben nog oude getallen.**
     F4b werkte de gidsen in deze repo bij met gemeten getallen (`uitleg-nivelleren`, `uitleg-werkregels`,
     `howto-werkregel-kiezen`, `uitleg-kalenders`, `uitleg-voortgang`, `howto-voortgang-bijwerken`,
     `ref-ai-tools`; gepind in `check-docs-resources-voorbeelden.ts`, de reeks "F4b-gidsgetallen") en het
     getallenblok bovenin `scripts/tutorial-project.ts`. Niet bijgewerkt en niet nagelezen: de verhalende
     tutorialteksten in `open-planner-studio-extensions` (buiten deze repo) en de schermbeelden
     (`gen:docs-screenshots`). Het oude getallenblok, waaruit die teksten komen, noemde nog "5 wd
     overbezet (29 jun – 5 jul)"; de app meldt nu 6 dagen, 28 juni t/m 5 juli. De tutorialstappen in
     `tests/browser/tutorials/` zijn groen. Voorstel: de extensieteksten nalezen tegen het nieuwe
     getallenblok. — S
205. **Termbase kent nog het begrip *AI-assistent*.** `i18n/termbase/concepts.json` (`ai-assistant`, ook in
   `read-only`) en de doeltalen. De UI zegt nu *MCP-client*. Voorstel: het begrip omzetten via de
   vertaalstraat (`concepts-merge`, `apply-terms`) vóór de volgende release. — B

398. **De rapportcontrole bij gedeeltelijke termenweigering kan een oud bestand accepteren.**
     `tests/planning/check-translate-tbx.ts:248` controleert alleen of
     terms-check-report.md bestaat. De eerdere stap op regels 224-226 maakt dat
     rapport al. De volgende terms-lookup ruimt alleen JSON-bestanden op
     (`scripts/translate/cli.ts:122`). Vervalt het nieuwe rapport bij gedeeltelijke
     weigering, dan kan deze controle toch slagen. Verwijder het oude rapport vóór
     de aanroep, of controleer de nieuwe rapportinhoud. Een testgat; geen gewone
     productfout aangetoond. Twee onafhankelijke broncontroles; niet uitgevoerd.
     — B

474. **De Gantt-regel en een commentaar zeggen dat scherm en afdruk de naam van een fase op dezelfde plek zetten.**
     `.claude/rules/gantt-splits.md:18` ("net als op de afdruk") en `GanttRenderer.ts:1736`. De afdruk zet de
     naam links van de balk als rechts geen ruimte is en links wel (`printPreview.ts:867`, `drawBarLabel`); het
     scherm zet hem altijd rechts. Voorstel: de vergelijking schrappen of die terugval noemen. Alleen tekst.
     Gevonden in review van #731 (GPT-6.1-Sol), 2026-10-29. — B

## Tests

409. **Het pre-paintscript negeert `?theme=` van de dev-link.** Met bewaard `light` en `?theme=dark`
     zet `index.html:31` eerst `data-theme=light`; de store-default (`peekTheme`) is dan `dark`. Na de
     mount klopt het thema; de flits is alleen in de browser op de dev-server en niet gemeten.
     Richting: het dev-thema ook vóór de eerste paint toepassen, zonder dat het in de productiebouw
     komt. VERVOLG uit review #703 r1. — B

410. **`?open=` van de dev-link heeft geen browsertest.** `check-dev-open-link.ts` dekt de padregel,
     de Tauri-guard en het wegvallen in productie; de echte appstart (StrictMode, herstelkeuze,
     site-host) is alleen met de hand nagelopen. VERVOLG uit review #703 r1. — S

413. **De dev-link vindt een bestand met `#` in het pad niet.** `?open=probe%20data/plan%20%231.ifc`
     wordt goed gecodeerd (`devFilePath`), maar Vite geeft voor dat pad de HTML-terugval, dus de link
     meldt "niet gevonden". Spaties werken wel. De voorbeelden in `examples/` hebben geen `#`. Richting:
     de beperking in `docs/dev-link.md` noemen, of oplossen met een echte HTTP-check. VERVOLG uit
     review #703 r3. — B

313. **De bulkprestatiepoort kan in een volledige run falen terwijl beide gerichte controles slagen.**
    Tijdens een volledige corpusloze F1b-suite die deels met andere controles overlapte, meet `check-bulk-scale.ts`
    17.188 ms voor voortgang op 2000 van 8000 taken, bij de vaste grens van 15.000 ms.
    De gerichte controle op de schone basis 12abaabf2 slaagt met 6402 ms, en op dezelfde
    F1b-bron met 5793 ms (beide 23/23, exit 0). Een eerdere volledige F1b-run haalde 13.126 ms.
    De laatste volledige run zonder die overlap haalt 8833 ms en eindigt groen (exit 0).
    De wisselende tijdmeting is bevestigd; oorzaak niet vastgesteld en geen grens verruimd. — B

314. **De plakprestatiepoort kan op deze server ook zonder F1b de vaste grens overschrijden.**
    `check-task-grid-paste-performance.ts` meet op Node 22.23.4 in een schone kopie van
    12abaabf2 een mediaan van 3942,1 ms bij de onveranderde grens van 3000 ms (exit 1).
    Dezelfde gerichte meting op F1b geeft 4388,7 ms (exit 1); de eerdere volledige run
    gaf 3894,5 ms. In een volledige run haalt F1b 2804,2 ms (groen). De wisselende
    metingen zijn bevestigd; een oorzaak of regressiegrootte volgt niet uit deze timing. Geen prestatiegrens verruimd en geen productfix buiten F1. — B


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


151. **De feedbacktests in de browsersuite falen in CI wisselvallig met "Maximum update depth exceeded".** Gezien
     in de job `verify (browser 2-4)`: op PR #402 vier tests in `tests/browser/feedback-venster.spec.ts`; op `main`
     `e98b83e48` (#395, run 39410998771) acht tests in `tests/browser/feedback-studio.spec.ts`; ook op de branch
     `claude/uren-zonder-spatie`. Per run falen andere feedbacktests, en een herhaling van de job wordt groen.
     Gemeld door de bouwer van #402 via de coördinator (2026-10-20); niet lokaal gedraaid en niet door deze agent
     nagespeeld. PR #404 (gemerged in `main` op 2026-10-20) haalt volgens zijn beschrijving de oorzaak weg in
     `FeedbackDialog.tsx`. Een branch zonder #404 kan de fout nog geven. Weghalen als de CI op branches met #404
     groen blijft. — S

237. **De browsertest voor curves met het toetsenbord is wisselvallig.**
     `tests/browser/assignments-block.spec.ts:235` ("Expected UNIFORM, Received BELL", time-out
     5000 ms). Hij faalde eenmaal in CI op #564 (`cb65c59cd`) en slaagde bij een herhaling
     zonder wijziging. — S

238. **`npm run i18n:resolve` stopt met exit 1 bij een merge met twee merge-bases.**
     Dat gebeurde in F2-bouwronde 2. Een controle van beide bases gaf voor 127.519 sleutels
     dezelfde samenvoeging, en `verify:i18n` gaf exit 0. Het script meldt dus een fout waar
     geen fout is. Voorstel: gelijke resultaten vanaf beide bases als eenduidig accepteren. — S


264. **De browsertest "Gantt-balk vertical slepen landt in RTL op dezelfde plek als een rijsleep" is
     wisselvallig.** `tests/browser/gantt-drag-undo.spec.ts:273`. De rijsleep en de undo slagen, maar na de
     balksleep blijft de volgorde die van vóór de sleep: de eerste taak staat nog bovenaan ("Timeout 5000ms
     exceeded", regel 314). Eenmaal gezien in CI op #584 (`2acc895fc`, job "verify (browser 3-4)",
     2026-10-24). Een herhaling van de job zonder wijziging was groen, en lokaal 3 van 3 groen. De oorzaak
     is niet onderzocht. F4b wijzigt `useBarDrag.ts` (maat en afronding van de datumsleep), niet de
     keuze voor de rijsleep: `handleMouseMove` (`useBarDrag.ts:528-545`) is gelijk aan de basis (review r4
     van #584, nagelezen). Een verband is niet aangetoond. Voorstel: gericht herhalen met een trace. — S

294. **De browsertest voor speling in de Gantt-tooltip is wisselvallig.**
     `tests/browser/float-remaining-display.spec.ts:89` ("Expected pattern /^0[.,]67d$/, Received "1d"",
     time-out 5000 ms). Hij faalde eenmaal in CI op #585 (`c354d1e41`, run 40051700758, browser 3-4), en
     slaagde bij een herhaling zonder wijziging en lokaal drie keer (`--repeat-each=3`). De commit veranderde
     alleen MSPDI- en P6 XML-code, die de test niet raakt. Vermoeden, niet onderzocht: de tooltip toont nog de
     waarde 1 uit de lus ervoor (1,004 ⇒ "1"), van vóór de herberekening met F5. — S

212. **Real-app-test van de MCP-ontdekking mist echte bestandsroutes.**
    De pids van `runtime` en `open-files` worden inmiddels rechtstreeks vergeleken. Echte openen-,
    Opslaan als- en afsluitroutes ontbreken nog (de storetest zet `filePath` rechtstreeks).
    Gevonden in review ronde 1 en 2 van PR #573 (GPT-6.1-Sol). Resterend: de bestaande echte-app-route
    uitbreiden met echte bestandsacties, inhoud en opruiming. — B

263. **Crashherstel en welkomstvenster zijn niet bewezen in de echte werkplek.** Sinds #706 draait
    `tests/browser/welcome-dialog.spec.ts` de app in een echte opaque origin (CSP-sandbox op het document; de
    test controleert `self.origin === 'null'` en de `SecurityError`s). Dat is het hoofddocument op de
    Vite-dev-server, met kunstmatige CORS-headers en een geïnjecteerde host. Niet getest: een ingebedde
    productieplatformbouw onder `/werkplek/app/planner/`, de echte hostbrug en de echte serverheaders.
    Bevestigd in review ronde 2 van PR #644 en ronde 1 van PR #708 (GPT-6.1-Sol). Voorstel: een handmatige
    check in de SuperCloud-werkplek. — B

406. **Het welkomstvenster hangt af van de `localStorage`-getter, niet van werkende opslag.** Sinds #706
    slaat `src/hooks/useSettingsBootstrap.ts` (`skipWelcome`) het venster over in elke omgeving waar het
    lezen van `localStorage` gooit, ook buiten de werkplek: dan vervallen ook de eerste taalkeuze, de
    automatische rondleiding en de tutorialvraag (handmatig blijven ze bereikbaar). Omgekeerd kijkt
    `localStorageAvailable()` (`src/utils/settingsStore.ts:41`) alleen naar de getter: bestaat het object
    maar weigert `getItem`/`setItem`, dan komt het venster nog bij elke start terug. Bevestigd in review
    ronde 1 van PR #708 (GPT-6.1-Sol). Voorstel: de bredere keuze vastleggen, of de voorwaarde op een
    mislukte schrijfproef zetten. — B


405. **Nivelleren in de achtergrond start vermoedelijk niet in een opaque origin.** Gezien bij #706.
    `src/services/leveling/backgroundLeveling.ts:34` maakt `new Worker(new URL(…, import.meta.url))` zonder
    try. Een document zonder `allow-same-origin` (de SuperCloud-werkplek) haalt een workerscript op met modus
    `same-origin`, en een opaque origin is met geen enkel adres same-origin. De constructor gooit dan, of de
    worker meldt een fout; in beide gevallen mislukt nivelleren. Alleen in de code nagelopen, niet gedraaid.
    Voorstel: bij een fout van de worker terugvallen op de bestaande route zonder `Worker` (regel 23). — S

224. **RTL-balksleeptest faalt incidenteel zonder aangetoonde oorzaak.** In PR #635 op
    `3ca78f26234ddfed8e6fd4341a8f9e0ee44ec66a`, run 40157918525 poging 1, bleef bij
    `gantt-drag-undo.spec.ts:313` de taakvolgorde na balkslepen ongewijzigd, terwijl de voorafgaande
    rijsleep wel verplaatste. Dezelfde head slaagde in poging 2 zonder codewijziging; ook de eerdere
    PR-head was groen. Screenshot/trace: artefact 12585687942. Geen Gantt-code in deze PR gewijzigd;
    timing-/geometrieoorzaak en productreproduceerbaarheid nog niet vastgesteld. — S

401. **De slotcontrole voor geldig openen kan slagen op de bestaande taak.**
     `tests/browser/new-open-task-flow.spec.ts:97` eist na open(planning) alleen
     tasks.length groter dan nul. De nieuwe beginstaat heeft dan al één taak; de
     MPP-controles bewijzen juist dat die bleef staan. Ook wanneer de geldige
     openroute niets laadt zonder foutmelding, slaagt deze controle dus. Controleer
     een nieuw actief document en herkenbare inhoud uit het geopende IFC-bestand.
     Een verlies aan testdekking; geen aangetoonde productfout. Twee onafhankelijke
     broncontroles bij PR #674; niet lokaal uitgevoerd.
     — B

325. **Zes browserroutes toetsen geen smal scherm meer.** Sinds de standaardtakenlijst 400 px breed is, zetten zes
    specs het venster op 1600×900, onder meer `tests/browser/duration-display.spec.ts:5`. De handelingen en
    controles blijven, maar de smallere beginstand wordt niet meer bewaakt. Geen productfout op die breedte
    aangetoond. Voorstel: één gerichte interactieroute op een smaller scherm houden. Gevonden in review r1 van
    #627 (GPT-6.1-Sol). — B

334. **`tests/browser/assignments-block.spec.ts:235` faalt soms in CI.** De test verwachtte `UNIFORM` en kreeg `BELL`,
    na een time-out van 5 s, in run 40286556225 (job `verify (browser 2-4)`) op PR #595, die alleen de herstelspec
    wijzigt. Dezelfde test slaagt lokaal op die head, en de herhaalde poging liep apart. De oorzaak is niet
    bewezen. Gevonden in fixronde 1 en review r2 van #595 (GPT-6.1-Sol). — S

403. **De oudere tooltipmelding 294 blijft naast de opgeloste melding 379 open staan.**
     `knownbugs.md` punt 294 beschrijft dezelfde test en dezelfde afwijking als
     het in PR #679 verwijderde punt 379: float-remaining-display.spec.ts:89 toont
     1d in plaats van 0,67d, rond F5 en een mogelijk oud taakobject. Handel beide
     meldingen samen af met hetzelfde bewijs, zodat dit symptoom niet dubbel als
     open werk blijft staan. De historische oorzaak van iedere eerdere fout is
     niet afzonderlijk bewezen; punt 294 is daarom niet stil verwijderd.
     Twee onafhankelijke broncontroles van het register; geen productfixronde.
     — B

394. **De nieuwe scrollmatrix raakt interne randen van gesplitste balken niet gericht.**
     `tests/planning/check-render-caches.ts:162`: `hitSnapshot` belooft meetpunten bij elk
     zichtbaar balkstuk en elke pauze. De zeven x-posities komen uit de rechthoek van de
     volledige balk. Interne segmentranden en pauzes worden daardoor niet afzonderlijk
     bemonsterd. Voeg die punten toe aan de scrollmatrix voor de renderafhankelijke
     splitscache. Bestaande splittests controleren zulke punten los van deze matrix.
     Twee onafhankelijke broncontroles bij PR #643; geen productfout aangetoond. — B

310. **De formaatvergelijking in de headless-servertest ziet een verschuiving binnen een dag niet.**
     `tests/mcp/cases-headless-server.ts:483` (`leafSchedule`) vergelijkt per bladtaak alleen de startdatum
     op dagniveau (`.slice(0, 10)`). Eindmomenten, de maat en exacte minuten vergelijkt de test niet, dus
     een verschuiving van 08:36 naar 16:00 op dezelfde dag valt niet op. Verder kan de extra `runCPM()` op
     r.498 een fout laadpad repareren voordat de vergelijking begint. Richting: volledige begin- en
     eindmomenten vergelijken, een fixture met de nieuwe maatrecords gebruiken, en `runCPM()` vervangen
     door een assert dat het openen al een verse, berekende stand geeft. Gevonden in review ronde 1 van
     PR #590 (GPT-6.1-Sol, VERVOLG). — B

393. **Een beschadigd numeriek kalender-id `NaN` krijgt bij opslaan onbedoeld koppelingen.**
     `src/services/ifc/ifcWriter.ts:1465` en `:1473`: de kalenderindex gebruikt `Map.get`,
     dat `NaN` aan zichzelf koppelt. De eerdere vergelijking met `===` deed dat niet.
     Bij een kalender met `id: NaN` en taken/resources met `calendarId: NaN` schrijft de
     nieuwe schrijver extra `IFCRELASSIGNSTOCONTROL`-relaties. Bij heropenen krijgen zij
     daardoor een echte kalenderkoppeling. Een gewone gebruikersroute naar deze beschadigde
     invoer is niet aangetoond. Richting: sla voor `Number.isNaN(cal.id)` alleen de
     control-relaties over, na kalender en metadata; voeg een gerichte regressiecheck toe.
     Vastgesteld door twee onafhankelijke broncontroles bij PR #641; niet uitgevoerd. — B

427. **De MS Project-meting eindigt groen als de crawlmap niet gescand wordt, ook in `measure:profiles`.**
     `tests/planning/check-mpp-fidelity.ts` neemt `OPS_MPP_CORPUS` en `OPS_MPP_CRAWL`, of zonder die variabelen
     een vast pad onder `/home/nozzit/…` (`:492–493`). Een lus wordt overgeslagen als die effectieve map
     ontbreekt of geen `.mpp`-bestand bevat (`:715–725`, `:731–741`). Dat staat in tussenregels (`:720`, `:735`),
     maar de slotregel (`:888`) zegt toch "alle checks groen". Gemeten op aia09-mp50, waar de `/home/nozzit/…`-
     paden niet bestaan:
     - Geen van beide variabelen gezet (ook als alleen `OPS_XER_CORPUS` gezet is): 0 bestanden, "alle checks
       groen (678)", exit 0. `measure:profiles` noemt dit wel rood ("niet gemeten").
     - Alleen `OPS_MPP_CORPUS` gezet: 3 bestanden, "alle checks groen (703)", exit 0. Ook `classifyMsp` in
       `scripts/measure-profiles-status.mjs:116–122` geeft dan GROEN (`scanned: 3`). De 658 crawlbestanden,
       met `timephased-cost-rollup.mpp` (knownbug 187), zijn dan niet gemeten.
     Op een machine waar de crawl op het vaste pad staat, wordt hij ook zonder `OPS_MPP_CRAWL` gescand. Wie
     alleen op de slotregel of de exitcode oordeelt, ziet zo een vals groen. De CI draait bewust zonder
     corpus, dus een faal in de check zelf is niet de oplossing. Voorstel: de slotregel noemt het aantal
     gescande bestanden en welke lus is overgeslagen; `measure:profiles` meldt een gedeeltelijke meting
     (een lus overgeslagen) apart en niet als GROEN. Gevonden bij het onderzoek naar 187 en in review ronde 1
     van #712 (GPT-6.1-Sol), 2026-10-27. — B

429. **De keuze van de eerste bekende hosttaal wordt niet bij een echte start getest.** A13 in
     `tests/planning/check-site-storage.ts:325` toetst alleen de lijst met ruwe taalbronnen van
     `embeddedLocale()` (`src/i18n/config.ts:119`). De browsertests geven alleen een bekende hosttaal mee
     (`fr`, `de`). Niet getest: hosttaal `xx`, oudertaal `de-AT`, hash `taal=es` en bewaarde keuze `nl` moeten
     samen `de` geven; ook de terugval op alleen de hash of alleen de bewaarde keuze. Voorstel: de bestaande
     browserroutes met deze gevallen uitbreiden en `<html lang>` en `ops-locale` controleren. Gevonden in
     review van #717 (GPT-6.1-Sol), 2026-10-28. — B
430. **De platformtest zet `ops-welcomeSeen` vooraf en ziet daardoor een kapotte platformtak niet.**
     `tests/browser/platform-build.spec.ts:84` zet `ops-welcomeSeen=true`. Gaat de platformtak van
     `runsEmbedded()` stuk, dan blijft het welkomstvenster in die test toch weg, en de hosttests dekken die tak
     niet. Voorstel: de platformroute eerst zonder host en zonder `ops-welcomeSeen` laten starten en controleren
     dat welkom, rondleiding en tutorialvraag dicht blijven. Gevonden in review van #717 (GPT-6.1-Sol),
     2026-10-28. — B
432. **De regressietest van `monthLabel` dwingt de oorspronkelijke foutconditie niet af.** De nieuwe controles
     in `tests/planning/check-reports.ts:467–479` erven de taal van het proces, en de CI zet geen niet-Engelse
     taal (de matrix wisselt alleen tijdzones). Onder een Engelse standaardtaal geven oude en nieuwe code voor
     `xx-YY` allebei Engels, dus het weghalen van de `supportedLocalesOf`-controle valt niet op. Voorstel: alleen
     deze batterij één keer extra draaien onder `LANG=nl_NL.UTF-8`, en vooraf controleren dat `Intl` dan echt
     Nederlands kiest. Gevonden in review van #696 (GPT-6.1-Sol), 2026-10-28. — B
442. **`tests/browser/gantt-histogram-rtl.spec.ts:153` faalt soms in CI (ar).** De test voegt 30 resources toe
     en klikt meteen op `strip.top + 150` in de kiezer. In run 40854256352 (job `verify (browser 3-4)`) op PR
     #722 bleef `histogramResourceId` daarna `null` in plaats van Resource 05 (time-out van 5 s). De schermafdruk
     toont de lijst wel met de nieuwe resources, met "alle resources" gekozen. PR #722 wijzigt alleen de
     `.mpp`-lezer en commentaar; de spec laadt geen `.mpp`. Lokaal op dezelfde kop slaagt de spec 24 van de 24
     keer (`--repeat-each 3`, alle vier talen). Vermoeden, niet bewezen: de klik valt vóór de lijst opnieuw is
     getekend, of de klikhoogte ligt op de rand van een rij. Gevonden bij #722 (2026-10-29). — S
460. **Twee runs van *Download stats* tegelijk: de tweede publicatie mislukt.** `publish-stats-branch.sh`
     haalt de top van `stats` op en pusht een opvolger zonder `--force`. Starten een geplande en een handmatige
     run tegelijk, dan maken ze elk een opvolger van dezelfde top; de tweede push wordt geweigerd en die run
     wordt rood. Er gaat niets verloren. Voorstel: één vaste `concurrency`-groep in
     `.github/workflows/download-stats.yml` met `cancel-in-progress: false`. Gevonden in review van #725
     (GPT-6.1-Sol), 2026-10-29. — B
461. **Elke run van *Download stats* maakt een commit op `stats`, ook zonder nieuwe cijfers.** `generatedAt`
     (`scripts/download-stats.mjs:248`) verandert elke run, en `publish-stats-branch.sh` vergelijkt de hele
     boom. Met de cron van elke 2 uur zijn dat 12 commits per dag. Voorstel: `generatedAt` buiten de
     vergelijking houden; let op dat de app `generatedAt` toont als bronmoment (`DownloadStatsSection.tsx:148`).
     Gevonden in review van #725 (GPT-6.1-Sol), 2026-10-29. — B
484. **Het meetartifact van de relatiezoekmeting bewaart de browserbundel niet.**
     `scripts/performance/relation-search/measure.mjs:137` haalt de geleverde JS-bron op om het bereik van
     `relationTaskOptions` te vinden. Het artifact bewaart alleen de hash en de offsets;
     `.github/workflows/relation-search-performance.yml:105` laat de bouwmappen weg. De 48 coverage-tellers zijn
     na te rekenen, maar hun koppeling aan precies die functie alleen door opnieuw te bouwen. Voorstel: bewaar
     per revisie de ene bundel met de helper (twee bestanden). Gevonden in review van #656 (GPT-6.1-Sol), 2026-10-29. — B
491. **De datumcontroles in de miniaturentest en -meting bewaken het tijdsdeel niet.**
     `tests/browser/document-switch.spec.ts:150` en `scripts/measure-document-thumbnails.mjs:176` vergelijken
     met `slice(0, 10)`. Daardoor slagen `2026-09-25`, `2026-09-25T07:00` en `2026-09-25T16:00` alle drie, en
     blijft een terugval naar datums zonder tijd onopgemerkt. De volledige meetsnapshots bewaren de tijden wel.
     Voorstel: vergelijk in deze vaste fixtures de volledige verwachte tijdstippen. Gevonden in review van #654
     (GPT-6.1-Sol), 2026-10-29. — B

473. **`check-gantt-label-ellipsis` bewaakt de naam achter een gewone taak niet meer.** Sinds #731 staat er een
     samenvatting met dezelfde lange naam en dezelfde balkpositie in de scène, en de zoekactie voor de gewone
     taak (`tests/planning/check-gantt-label-ellipsis.ts:128`) kijkt niet naar de rij. Valt de buitennaam van
     een gewone taak weg, dan vindt de check de naam van de samenvatting en blijft hij groen (in de review
     nagespeeld: 23/23 groen, exit 0). Voorstel: ook de controles voor gewone taken op hun eigen rij filteren,
     met de rijfilter die de samenvattingscontroles al gebruiken. Gevonden in review van #731 (GPT-6.1-Sol),
     2026-10-29. — B

402. **De nieuwe MCP-waarschuwing zegt te ruim dat vastgepinde taken niet verschuiven.**
     `src/services/mcp/tools/calendarResourceTools.ts:1618` zegt dat pins niet
     verplaatsen. ResourceLeveler.ts:786 laat een pin juist zijn verschoven
     voorgangers volgen. Een voorganger die één werkdag uitwijkt, kan zo een pin
     verplaatsen en daar een pinconflict geven. De respons kan die verschuiving
     samen met de ontkennende waarschuwing bevatten. Zeg dat pins niet zelfstandig
     voor capaciteit uitwijken, maar hun voorgangers wel volgen. Maak dezelfde
     nuance in distribute.ts:101. Alleen tekst; geen nieuwe gedragsfout.
     Twee onafhankelijke broncontroles bij PR #678; niet lokaal uitgevoerd.
     — B

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

