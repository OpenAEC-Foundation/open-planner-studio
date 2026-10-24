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

187. **Drie einddatumafwijkingen van de MPP-fidelitypin, ook met main.** Bij de integratie van
    PR #480 op main `3a2f597f3` geeft `check-mpp-fidelity.ts` voor het publieke
    `mpxj/junit/data/timephased-cost-rollup.mpp` `finishExact: 6` (pin 9) en `finishDiff: 3`
    (pin 0); ook de verzameling afwijkende bestanden wijkt daardoor af. Dezelfde uitslag met
    `CPMSolver.ts` en `ResourceLeveler.ts` uit die main-commit, zonder de PF-optimalisatie.
    De gecombineerde `measure:profiles` eindigt op exit 1; de P6-cellen zijn ongewijzigd.
    Geen baseline of motorcode hiervoor aangepast; oorzaak niet verder onderzocht. — B

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

273. **ALAP laat bij een losse mijlpaal een dagdeel vrije speling liggen.** Een START-mijlpaal M op
     ma 10:00 met ALAP, naast een taak A van 3 d (ma 07:00 tot wo 16:00). ALAP zet M op wo 10:00, met
     0,625 d totale en vrije speling; de late start is wo 16:00. `applyAlap` in `CPMSolver.ts` meet de
     vrije speling in hele werkdagen (`signedWorkDaysBetween`) en schuift ook alleen hele werkdagen
     (`addWorkingDaysSigned`); het dagdeel blijft liggen. Gemeten op een kalender 7–16 met en zonder
     eigen werkblokken. Op de basis `be58ba356` gebeurt het ook, met eigen werkblokken. Voorstel: laat
     de bestaande ALAP-verplaatsing ook het resterende dagdeel meenemen. Gevonden in review F2 ronde 3A. — B

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

265. **Contour en splitsgaten bij een eenheidswissel van een kalendertijdtaak tellen de oude duur in
     werkminuten.** `applyDurationChangeRules` (`src/utils/taskDefaults.ts:822`) krijgt de oude werkminuten
     van de aanroeper: in het raster `taskWorkMinutes(before, hoursPerDay)` met de werktijd per dag
     (`src/engine/taskGrid/taskEditPlan.ts:205`), in de store via `settleDurationAftermath`
     (`workRuleApply.ts:755`, de werktijd per dag van de taakkalender). Gaat een kalendertijdtaak van dagen
     naar uren (2 d naar "1d 4u"), dan telt de oude duur als 960 in plaats van 2880 minuten. De
     herschaling van een contour en het afknippen van splitsgaten (`clipUserGapsToWork`) rekenen dan
     vermoedelijk met een verkeerde verhouding. Gevonden met grep in fixronde 4 van #584; niet gemeten.
     Voorstel: eerst meten met een contour en een splitsgat op een kalendertijdtaak; dan dezelfde regel
     als `durationEditProgress` (24 u per dag bij kalendertijd). — S

266. **Na een eenheidswissel op een lopende taak heeft de rest ruis van de drijvende komma.**
     `durationEditProgress` (`src/engine/work/workRuleApply.ts:953`) rekent de rest als nieuwe duur ×
     (1 − nieuw percentage). Een werktijdtaak van 2 d, 25 % gereed, met een nieuwe duur van 12 u (onder P6
     en MSP ook "1,5d") krijgt zo 720 × (1 − 1/3) = 480,00000000000006 min in plaats van 480. De motor legt
     het einde daardoor net voorbij de bandgrens: wo 3 juni 07:00 in plaats van di 2 juni 16:00. Dat is
     hetzelfde werkmoment, maar de Tabel toont een andere dag. Gemeten in fixronde 4 van #584; vastgelegd
     als `KNOWN_DRIFT` (4 rijen) in `tests/planning/check-f4b-review-r3.ts`. Dit stond al zo op de basis
     (bij "12u"). Voorstel: de rest als nieuwe duur − verricht rekenen, en dan de verwachtingen nameten;
     haal daarna de rijen uit `KNOWN_DRIFT`. — B

## Tabel, invoer en bediening

13. **Tabelkolom *Kleur*** wordt in IFC bewaard, maar geen balk of rapport gebruikt hem. — B
16. **Taken kopiëren** heeft geen zichtbare bediening; alleen Ctrl+C/V met de Gantt in focus. — B
17. **Verwijderen zonder bevestiging**: `confirm.deleteTask` staat in de locales maar wordt nergens gebruikt. — S
60. **Duur-kolom afgeknipt** in de standaard Gantt-weergave (WBS 60 + Taaknaam 240 + Duur 60 + de
    "+"-kolom): je leest "2c" in plaats van "2d", op 1600 én 1366 px breed. — B

241. **Hetzelfde externe anker opnieuw invoeren als datum zonder tijd geeft een extra undo-stap en zet
     de planning op verouderd.** `updateExternalLink` vergelijkt het ruwe anker, niet het genormaliseerde.
     Gevonden in fixronde 1 van F2 (laadfix). — B

250. **Twee ingangen voor een nieuwe taak negeren de *Standaardmaat voor nieuwe taken*.** Rechtsklik in
     de Gantt → *Nieuwe taak* geeft een tijd met een vaste dagenmaat mee (`GanttCanvas.tsx:401`,
     `createDefaultTaskTime(date, 5, 'days', …)`), en de spookregel onderaan de tabel toont een taak van
     5 d (`FullTaskGrid.tsx:353`). Een meegegeven maat blijft staan (`settleNewTaskMeasure`, zie
     `check-new-task-measure.ts` s5). Met de gekozen urenmaat, of onder P6/MSP, krijgt zo'n taak dus toch
     de dagenmaat; alleen vast werk zet hem om. Voorstel: geef in beide de maat van `newTaskTimeUnit`
     mee, of laat de tijd weg en geef alleen de start. Alleen in de code gezien, plus het storegedrag. — S

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
     motorwerk, buiten F4b. Gevonden bij het meten voor knownbugs 252. — B
284. **Een opgeslagen Tabel-indeling houdt Start en Einde op 100 px; een datum met tijd valt dan weg.**
     Sinds B4 toont een moment midden op de werkdag datum en tijd ("04-11-2026 11:00"). Die tekst is 89 px
     breed, plus 14 px opvulling; de oude standaardbreedte was 100 px (gemeten in de browser, Inter 11 px).
     F4b zet de standaard op 130 px (`preferences.ts`, ook genoeg voor "04-11-2026 11:00 AM"), maar een
     indeling die al in `ops-taskGridPreferences` staat, houdt 100 px tot de planner de kolom verbreedt of
     "Herstel standaard" kiest. De cel kapt de tekst af met een beletselteken. Voorstel: bij het laden een
     opgeslagen breedte van precies 100 px voor deze twee kolommen naar 130 px zetten, of de kolom laten
     meegroeien; een besluit over opgeslagen voorkeuren. — B
286. **De kant van een beperkingsdatum wordt op twee plekken opnieuw bepaald.** `constraintDateSide`
     (`src/engine/calendar/workdayRules.ts:42`) zegt al of een beperkingsdatum startachtig of eindachtig
     is. `constraintSide` in `TaskConstraintFields.tsx:16` en `guardSideOf` in `MilestoneReport.tsx:62`
     bouwen dat opnieuw uit `constraintDateField` en `taskDateFieldSide`. De uitkomst is nu gelijk; het
     risico is dat een vierde beperkingstype op één plek wel en op een andere niet meekomt. Voorstel: beide
     helpers vervangen door `constraintDateSide` en de losse imports weghalen. Gevonden in de review van
     PR #584 (r1, VERVOLG), in de code nagelezen. — B
288. **Het duurlabel tijdens het slepen rekent kalendertijd met de werktijd per dag.** `GanttRenderer.dragDurationText`
     (`src/engine/renderer/GanttRenderer.ts:1996-2008`) neemt voor een dagtaak `taskDurationMinutes` (dagen ×
     werktijd per dag, `utils/taskDuration.ts:94`) en zet dat om met `effHoursPerDay`. Bij een
     kalendertijdtaak onder P6/MSP met Duurweergave "Altijd uren" toont het label dan 8 u per dag in plaats
     van 24. Cel, tooltip, afdruk en tabelrapport rekenen sinds fixronde 2 van F4b wel met 24 u
     (`durationHoursPerDay`). Dit stond al zo op de basis van F4b. Voorstel: in het sleeplabel
     `durationHoursPerDay` gebruiken; rendererwerk. Alleen in de code gelezen, niet in de app nagespeeld. — S

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

213. **Een UNC-werkmap op Windows werkt niet in de headless MCP-server.** `normalizeAbsolutePath`
    (`src/services/mcp/tools/fileTools.ts:105`) maakt van `\\server\share\plan.ifc` het pad
    `/server/share/plan.ifc`, en dat gaat zo naar `path.resolve` in `headless/mcp-server/src/nodeFs.ts:136`.
    Gevonden in review ronde 1 van PR #572 (GPT-6.1-Sol). Voorstel: UNC-paden in de lexicale poort als eigen
    vorm herkennen, of ze met een duidelijke melding weigeren. — B
214. **De eigen XML-parser van de headless MCP-server is te soepel.** `headless/mcp-server/src/xmlDom.ts:101`
    en 146: hij accepteert `&#0;`, leest `&constructor;` uit de prototypeketen, normaliseert CRLF niet,
    accepteert ongebonden prefixen en `]]>` buiten CDATA, en detecteert geen UTF-16. Gevonden in review ronde
    2 van PR #572 (GPT-6.1-Sol). Voorstel: `@xmldom/xmldom` bundelen met een kleine adapter (DOCTYPE-beleid,
    strikte fouten), of gerichte fixes met tests. — B
215. **De headless MCP-server doet geen `fsync` van de doelmap na de `rename`.**
    `headless/mcp-server/src/nodeFs.ts:355`: na een stroomuitval kan de nieuwe naam ontbreken. Gevonden in
    review ronde 2 van PR #572 (GPT-6.1-Sol). Voorstel: na de `rename` de map openen (`'.'`, in het gebonden
    blok) en `fsync` doen. — B
216. **De tijdelijke naam bij opslaan is de doelnaam plus 27 bytes.** `headless/mcp-server/src/nodeFs.ts:324`:
    een geldige bestandsnaam van rond 240 bytes geeft bij opslaan `ENAMETOOLONG`. Gevonden in review ronde 2
    van PR #572 (GPT-6.1-Sol). Voorstel: een korte eigen naam (bijv. `.ops-save.<willekeurig>.tmp`). — B
217. **Het eigen tijdelijke bestand wordt na een mapwissel niet altijd opgeruimd.**
    `headless/mcp-server/src/nodeFs.ts:370`: is de map weg of niet meer bereikbaar, dan blijft
    `.<naam>.<willekeurig>.ops-save.tmp` staan (de docs zeggen dat nu ook). Gevonden in review ronde 2 van PR
    #572 (GPT-6.1-Sol). Voorstel: een opruimronde voor oude `ops-save.tmp`-bestanden bij de start, of melden
    waar het bestand staat. — B

218. **Headless MCP-server: de HTTP-time-out begrenst synchrone bestandstoegang niet.**
    `headless/mcp-server/src/nodeFs.ts:285` en `writeFileSync`/`fsyncSync` op 333–335 draaien synchroon; hangt
    lezen of synchroniseren op een trage schijf, dan staan alle sessies stil en kan de 120-secondentimer in
    `headless/mcp-server/src/http.ts:117` niet afgaan. De documentatie belooft die grens te stellig. Gevonden
    in review ronde 3 van PR #572 (GPT-6.1-Sol). Voorstel: de tekst over de tijdslimiet eerlijk maken en grote
    bestanden op trage opslag meten voordat er een andere procesopzet komt. — B

219. **Headless MCP-server: een scopeweigering tijdens de bewerking komt niet als `SCOPE` bij de client.**
    `src/services/mcp/tools/fileTools.ts:337` maakt van elke schrijffout `INTERNAL`, `fileTools.ts:434` van
    elke leesfout `NOT_FOUND`; een `ScopeEscapeError` na een mapwissel krijgt dus de verkeerde code (de
    toegang wordt wel geweigerd). De tests controleren alleen het fouttype van `nodeFs`. Gevonden in review
    ronde 3 van PR #572 (GPT-6.1-Sol). Voorstel: een klein gedeeld foutcontract en één test door de echte
    toolhandler. — B

220. **Headless MCP-server: terugzetten van de procesmap is een poging, geen garantie.**
    `headless/mcp-server/src/nodeFs.ts:253`: verdwijnt de oorspronkelijke procesmap tijdens een bewerking, dan
    blijft het proces in `realRoot`; is ook die weg, dan gooit de `finally` opnieuw, verdringt de
    oorspronkelijke fout en blijft de tijdelijke procesmap actief. CLI-, backup- en importpaden gebruiken
    absolute paden, dus geen bekende route naar verkeerd opgeslagen bestanden. Gevonden in review ronde 3 van
    PR #572 (GPT-6.1-Sol). Voorstel: de terugval documenteren en beide fouten bewaren of melden. — B

206. **`.mcpb`-bundel: een annulering tijdens opnieuw verbinden valt weg.**
    `integrations/claude-desktop/src/proxy.ts:445` haalt het request-id uit `queuedIds` voordat
    `handleRequest()` op `connectUpstream()` wacht (`:394–403`); een `notifications/cancelled` in dat venster
    wordt niet vastgelegd en de tool kan na het verbinden alsnog naar de bridge gaan. Gevonden in review ronde
    2 en 3 van PR #567 (GPT-6.1-Sol). Voorstel: het request annuleerbaar houden tot de echte tool-POST en na
    het verbinden opnieuw controleren, met een test voor dat venster. — B

207. **`.mcpb`-bundel: na sessieverlies weigert de proxy ook een nieuw leeg plan en importeren.**
    `integrations/claude-desktop/src/proxy.ts:389–392` blokkeert `planner_new_document` en
    `planner_import_schedule` zolang de blokkade staat; Claude moet eerst een bestaand plan kiezen met
    `planner_switch_document`. Veilig, maar een onnodige omweg. Gevonden in review ronde 3 van PR #567
    (GPT-6.1-Sol). Voorstel: beide toestaan als losse herstelactie, zonder automatische herhaling en met
    ontgrendeling alleen na succes; `planner_duplicate_document` niet, want die gebruikt het actieve document.
    — B

209. **MCP-ontdekking: een schrijffout kan een tijdelijk bestand met het token laten liggen.**
    `src/services/mcp/discoveryFiles.ts:95–105`: `writeNew` staat buiten de opruim-`try`; slaagt het aanmaken
    maar faalt het schrijven (bijv. schijfquota), dan blijft het tijdelijke bestand achter, mogelijk al met
    het volledige token. `bridgeStopped()` en `shutdown()` verwijderen alleen de definitieve namen; de test
    injecteert alleen rename-fouten. Gevonden in review ronde 1 en 2 van PR #573 (GPT-6.1-Sol). Voorstel:
    exclusief aanmaken en schrijven splitsen zoals `fileAccess/atomicWrite.ts`, zodat een schrijffout het
    eigen bestand opruimt. — B

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

150. **OPS v2026.9.0 maakt van een kalender in een nieuw IFC-bestand een urenkalender zonder werktijd zodra
    een taak op die kalender een tijd ≠ 07:00 of een `PT`-duur heeft.** Oorzaak: v2026.9.0 leest
    `WorkingTimes` van `IfcWorkCalendar` op plek 5; sinds #336 staat daar Identification (aanvaard verlies,
    `docs/ifc-round-trip.md:351-356` en `:436-460`). De geregistreerde werkblokken zijn dan leeg, en de
    promotie met een tijdsignaal kiest die lege werkblokken (`promoteHourCalendar` met
    `preferCanonicalWhenEmpty`, `src/services/subdayIo.ts` op tag v2026.9.0). Nagemeten met de lezer en de
    solver van v2026.9.0 in Node: een bestand van main met een urentaak van 480 min op de standaardkalender
    geeft `workTime` met lege werkblokken op alle zeven dagen; na doorrekenen heeft de urentaak duur 0
    (begin en einde do 07:00). `docs/ifc-round-trip.md` noemt alleen "werkuren terug naar 07–16"; dit gevolg
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

274. **Een werkelijk einde om precies 08:00 wordt na import uit P6 XML of MSPDI 16:00.** 08:00 is het
     anker dat deze formaten schrijven voor een datum zonder tijd (ankerregel I8, spec
     `2026-10-20-alleen-uren-design.md` §3.10, gepland voor F5b). De lezer kan een echte 08:00 daar niet
     van onderscheiden. Een dagkalender blijft daardoor scalair, en het werkelijke einde wordt na laden het
     dageinde 16:00. Gemeten op de eindmijlpaal uit review ronde 3 van PR #559 (`milestone-11.xml`, met een
     werkelijk einde om 08:00), op alle vier stappen tot en met heropenen. Richting: lees 08:00 alleen als
     anker in een bestand dat OPS zelf schreef. Fixronde 3 van de F2-laadfix. — B

275. **Eén werkelijke datum met een tijd maakt van een importkalender een urenkalender.** Bij P6 XML en
     MSPDI telt een werkelijke datum met een eigen tijd mee in de keuze tussen uren en dagen per kalender
     (`p6xmlReader.ts:873`, `mspdiReader.ts:332`). Daarna leest een andere voltooide taak op die kalender,
     met `ActualFinish …T08:00` in de bron, als 08:00 in plaats van 16:00. Dat blijft zo tot en met IFC
     heropenen. Dit is de dubbelzinnigheid van ankerregel I8; een toegestane tussenstand tot F5a/F5b.
     Richting: onderscheid een synthetisch 08:00-anker van een echte tijd. Zie ook 274. Gevonden in
     review F2 ronde 4. — B

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
     als geen record, dus als urenmaat met dezelfde lengte. Gevonden bij F5a-2. — S

291. **P6 XML rondt begin en einde van een dagkalender met één blok af op het hele uur.** Een dagkalender
     07:30–15:30 (8 u, één blok) komt na `writeP6XML → readP6XML` terug als 07:00–15:00. MSPDI houdt
     07:30–15:30. Locatie: `p6xmlReader.ts:273-274` (`parseP6StandardWorkWeek`, `Math.floor` op de uren).
     Een dagkalender met pauze (twee blokken) uit een OPS-bestand leest sinds F5a-2 wel op de minuut
     (`registerP6Bands`). Nagespeeld met een probe bij F5a-2. Richting: begin en einde op de minuut, zoals
     `applyCalendarBody` in de MSPDI-lezer. — B

293. **De P6 XML-lezer deelt duur en rest twee keer door de uren per dag.** `p6xmlReader.ts:1070` en `:1072`
     geven `durationDays`/`remainingDays` mee via `p6HoursToDays` (`:179`), terwijl `readMeasure`
     (`xmlDayMeasure.ts`) dezelfde deling al doet met `minutesPerDay` (dezelfde uren per dag, met dezelfde
     terugval op 8). De uitkomst is gelijk, op een mogelijk verschil in de laatste decimaal na
     (`uren ÷ u` tegen `uren × 60 ÷ (u × 60)`, niet gemeten); het is dubbele code. Richting: de helper en de twee
     argumentregels weghalen (ongeveer 6 regels). Gevonden in review #585 r1 (Sol, VERVOLG). — B

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

## Tests

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

149. **`check-reports.ts` (`monthLabel`) hangt af van de taalinstelling van de machine.** Rood als de machine in
     de systeemtaal nl_NL draait, groen met `LANG=en_US.UTF-8`. Gemeld door de coördinator op 2026-10-20; niet
     door deze agent nagespeeld. — S

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

282. **`check-reports.ts` hangt af van de taal van het systeem.** De regel "monthLabel: onbekende locale
     valt terug op Engels" verwacht "Sep 2026", maar met `LANG=nl_NL.UTF-8` geeft Node "sep 2026" (de
     onbekende locale valt terug op de systeemtaal, niet op Engels). Met `LANG=C.UTF-8` is de batterij groen.
     Gezien op aia09-mp50 bij F4b; de CI draait met een Engelse locale en ziet het niet. Voorstel: in
     `monthLabel` expliciet terugvallen op `en` als `Intl` de locale niet kent, of de toets de locale laten
     vastzetten. — B

285. **`hour-data-notice-document.spec.ts` is wisselvallig: na `page.reload()` komt het welkomstvenster
     over het paneel.** De test herlaadt de pagina per voorkeur (aan, uit), maar wacht daarna niet op het
     welkomstvenster en sluit het niet, zoals de fixture bij de start doet (`waitForWelcomeDialog`,
     `fixtures/ops.ts:88`). Komt het venster net na `fill('6h')`, dan gaat Enter niet naar het duurveld:
     "minutes 240, verwacht 360". Gezien in CI op #584 (`293acf1c9`, shard 1); de error-context toont
     "Welcome to Open Planner Studio" open en het duurveld op "4". Lokaal 5 van 5 groen. Voorstel: na de
     reload `waitForWelcomeDialog` en `setUI({ showWelcomeDialog: false })`, zoals de fixture. — B

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

204. **`headless-api.yml` meldt "token staat in de log" als het image niet bouwt.** De stap *Logs bevatten
    geen token en geen IFC-inhoud* draait ook na een mislukte stap *Image bouwen*. Dan bestaat er geen
    container, en `grep -qF "$OPS_API_TOKEN"` vindt een treffer in de foutmelding van Docker, zodat de job
    een tweede, misleidende fout geeft. Gezien op PR #567, run 39950724242 (job *container + smoke-test*),
    waar de echte oorzaak een ontbrekend bestand in de Dockerfile was. Voorstel: de stap alleen draaien als
    de container bestaat, of eerst controleren dat het token niet leeg is. Niet onderzocht waarom het
    token-grep matcht. — S

208. **`scripts/build-core.mjs` bouwt de licentiegegevens onnodig om.** `scripts/build-core.mjs:138–148` zet
    de pakketnamen om in een `Map` en de sectietekst in een array met één element; `notices.packages.join(',
    ')` en `notices.sections` volstaan. Gevonden in review ronde 1 van PR #567 (GPT-6.1-Sol). — B

212. **Real-app-test van de MCP-ontdekking bewijst minder dan zijn naam zegt.**
    `tests/mcp/realApp/run-real-app.ts:141` heet "hetzelfde pid" maar vergelijkt de pids van beide bestanden
    niet; echte openen-, Opslaan als- en afsluitroutes ontbreken (de storetest zet `filePath` rechtstreeks).
    Gevonden in review ronde 1 en 2 van PR #573 (GPT-6.1-Sol). Voorstel: de pids vergelijken en de bestaande
    echte-app-route uitbreiden met echte bestandsacties, inhoud en opruiming. — B

310. **De formaatvergelijking in de headless-servertest ziet een verschuiving binnen een dag niet.**
     `tests/mcp/cases-headless-server.ts:483` (`leafSchedule`) vergelijkt per bladtaak alleen de startdatum
     op dagniveau (`.slice(0, 10)`). Eindmomenten, de maat en exacte minuten vergelijkt de test niet, dus
     een verschuiving van 08:36 naar 16:00 op dezelfde dag valt niet op. Verder kan de extra `runCPM()` op
     r.498 een fout laadpad repareren voordat de vergelijking begint. Richting: volledige begin- en
     eindmomenten vergelijken, een fixture met de nieuwe maatrecords gebruiken, en `runCPM()` vervangen
     door een assert dat het openen al een verse, berekende stand geeft. Gevonden in review ronde 1 van
     PR #590 (GPT-6.1-Sol, VERVOLG). — B

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
