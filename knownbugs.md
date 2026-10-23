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
120. **Lag `-1,5` rondt naar −1 dag, de motor naar −2.** `parseLagInput` rondt met `Math.round(num)`
    (`lagFormat.ts:73`, JavaScript rondt −1,5 naar −1), terwijl de solver half van nul af rondt
    (`CPMSolver.ts:272-279`, `Math.sign(raw) * Math.round(Math.abs(raw))`). Een lead die je als `-1,5`
    typt, wordt dus anders opgeslagen dan dezelfde lead in uren wordt gerekend. Alleen in de code gezien. — S
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

204. **Een urentaak na een FF-relatie met een kalendertijdlead kan vóór haar finish-ondergrens eindigen.**
    Nagespeeld in de minutenmodelmeting van F1b: kalender ma-vr 07-12 + 13-16, A 48 u eindigt ma
    8 juni 2026 16:00; FF −2 kalenderdagen naar B 32 u geeft B di 2 juni 07:00–vr 5 juni 16:00.
    De eis ligt za 6 juni 16:00; het einde ligt dus ervoor. Het dagenmaatpad haalt na F1b wel de
    dagverwachting van lagadv-ff-lead-ed; run 2 blijft rood op B, niet meer op de werkdagenlag van C.
    De bestaande urencases en N1 laten hier geen algemene grensnormalisatie toe; apart uitwerken. — B

205. **De corpuspin van expectedFinishDates in de SCHEDOPTIONS-check is rood op de integratiebasis.**
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

251. **De projectstandaard *Vast werk* zet bestaande dagenmaat-taken niet om naar de urenmaat.**
     B1a (spec "alleen uren" §3.2): een taak met vast werk is altijd urenmaat. Een taak zonder eigen
     regel volgt de projectstandaard (`defaultWorkRule`). Zet je die standaard op vast werk, dan blijft
     een bestaande taak van 3 d in de dagenmaat; een naamwijziging laat dat zo. Pas een duurwijziging
     maakt er urenmaat van (`routeFixedWorkDurationToHours`). Nagespeeld met `setProject({ defaultWorkRule:
     'FIXED_WORK' })` en `updateTask(naam)`. Hetzelfde geldt waarschijnlijk voor een bestand met die
     standaard en dagtaken (VERMOED, niet nagespeeld). Voorstel: maak de wissel van de projectstandaard een
     planningsbewerking die elke taak zonder eigen regel door `settleRuleChange` haalt, met één undo-stap
     en een melding. Gevonden in F3c-winkel. — B

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

## Tabel, invoer en bediening

13. **Tabelkolom *Kleur*** wordt in IFC bewaard, maar geen balk of rapport gebruikt hem. — B
16. **Taken kopiëren** heeft geen zichtbare bediening; alleen Ctrl+C/V met de Gantt in focus. — B
17. **Verwijderen zonder bevestiging**: `confirm.deleteTask` staat in de locales maar wordt nergens gebruikt. — S
60. **Duur-kolom afgeknipt** in de standaard Gantt-weergave (WBS 60 + Taaknaam 240 + Duur 60 + de
    "+"-kolom): je leest "2c" in plaats van "2d", op 1600 én 1366 px breed. — B

241. **Hetzelfde externe anker opnieuw invoeren als datum zonder tijd geeft een extra undo-stap en zet
     de planning op verouderd.** `updateExternalLink` vergelijkt het ruwe anker, niet het genormaliseerde.
     Gevonden in fixronde 1 van F2 (laadfix). — B

244. **Het paneel Onderbrekingen toont bij een dagtaak met een pauze korter dan een dag een verkeerd
     van–tot.** `TaskSplitsSection.tsx:79-93` (`segmentRanges`) wandelt een dagtaak nog op hele werkdagen
     (`computeSplitSegments(..., false, ...)`), terwijl de Gantt sinds F3c in de dagenmaat wandelt. Probe:
     dagtaak ma 08:00–16:00 op een kalender 08–16, pauzes van 1 u na 2 u en na 5 u (as): het paneel geeft
     "01-06 – 29-05" voor het eerste stuk na de pauze (einde vóór het begin), de Gantt tekent 11:00–13:00.
     Zo'n pauze ontstaat bij splitsen op uurzoom (snap 60 of 15 min). Voorstel: geef `'workdays'` mee als
     de taak tijden heeft en label zoals bij een urentaak (`workdayBoundaryLabel`). Gebied F4b. — B

245. **Afdrukken tekent pauzes van een taak altijd in hele werkdagen.** `printPreview.ts:1424` roept
     `computeSplitSegments(..., false, ...)` aan op datums zonder tijd, ook voor een urentaak. Een pauze
     korter dan een dag valt weg; bij een taak van één dag tekent de afdruk geen onderbreking (probe:
     start = einde ⇒ één stuk). Voorstel: dezelfde maatkeuze als de Gantt, als de afdruk tijden toont.
     Gevonden in F3c. — B

250. **Twee ingangen voor een nieuwe taak negeren de *Standaardmaat voor nieuwe taken*.** Rechtsklik in
     de Gantt → *Nieuwe taak* geeft een tijd met een vaste dagenmaat mee (`GanttCanvas.tsx:401`,
     `createDefaultTaskTime(date, 5, 'days', …)`), en de spookregel onderaan de tabel toont een taak van
     5 d (`FullTaskGrid.tsx:353`). Een meegegeven maat blijft staan (`settleNewTaskMeasure`, zie
     `check-new-task-measure.ts` s5). Met de gekozen urenmaat, of onder P6/MSP, krijgt zo'n taak dus toch
     de dagenmaat; alleen vast werk zet hem om. Voorstel: geef in beide de maat van `newTaskTimeUnit`
     mee, of laat de tijd weg en geef alleen de start. Alleen in de code gezien, plus het storegedrag. — S

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

258. **Histogram, rapport en bezetting lezen de maat van het OPS-profiel, ook onder P6 of MSP.** De
     belastingfuncties (`computeResourceLoad`, `computeReliableResourceLoad`, `computeHistogramReport` in
     `ResourceLoad.ts`) krijgen de maatconventie als optie; zonder optie gelden de OPS-conventies. Nog zonder
     optie: `scheduleSlice.ts:93,109`, `documentActivation.ts:237`, `gridTransaction.ts:1101`,
     `sessionHistory.ts:200`, `services/mcp/tools/readTools.ts:815,877`, `GanttCanvas.tsx:237` en
     `services/library/occupancy.ts:293`. De nivelleerder krijgt het profiel wel (`solveOptionsFor`). Gevolg
     onder P6: een dagtaak van 1 d vanaf vr 07:00 op een korte vrijdag (6 u) staat in het histogram als vr 1,
     terwijl de nivelleerder vr 0,75 + ma 0,25 boekt (`check-f3b-production-compat.ts`, "dagtaak onder de
     urenmaat (P6)"). Nagespeeld met een storeprobe: P6-profiel, `runCPM`, `resourceLoadResult` vr 1.
     Voorstel: geef overal `effectiveSchedulingOptions(project)` mee; voor de bezetting een veld in
     `OccupancyDocInput`. Gevonden bij F3c deel 3. — B

259. **Een handmatig geplande taak krijgt een nivelleervertraging die de solver negeert.** De nivelleerder
     behandelt alleen voltooide en lopende taken als onverplaatsbaar (`ResourceLeveler.ts:445`). De solver houdt
     een handmatig geplande taak op haar eigen datums en leest geen nivelleervertraging (`CPMSolver.ts:2006`).
     Na toepassen boekt de nivelleerder de taak dus op een andere plek dan het histogram haar toont.
     `tests/library/check-distribute.ts` case 18 legt dit vast: vertraging 10, einde schuift 0. Voorstel: een
     handmatig geplande taak als vaste last behandelen, zoals een lopende taak (dat verandert case 18).
     Gevonden bij F3c deel 3. — B

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

280. **`check-ifc-projectdatum-corpus.ts` is met het corpus rood op de integratiebranch.**
     `p6_torture_test_v1.xer`, "projectstart en -einde per document": verwacht `2026-03-02T00:00`, kreeg
     `2026-03-02` (1 van 463563 checks). Rood op `1e460cde6` (uren-integratie met F2) en op elk F3c-deel;
     groen op `main` `d991788db` (463407 checks). Komt dus uit F2, niet uit F3c. Alleen met `OPS_XER_CORPUS`;
     CI draait hem zonder corpus. Niet verder onderzocht. Gevonden bij de integratie van F3c. — B

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


240. **Tutorial- en gidsteksten bevatten nog oude getallen uit het dagmodel.**
     In F2-bouwronde 4 gecontroleerd naast de gewone F2-pins en de vaste F3-doelen;
     `public/docs/nl/uitleg-nivelleren.md:55` noemt bijvoorbeeld het binnenspouwblad vanaf
     29 juni, terwijl de F2-controle 25 juni en het F3-doel 28 juni toetst. Sinds F3c (motor en
     belasting samen) is de metselaar 6 werkdagen overbezet, 28 juni t/m 5 juli, ook in het geval
     zonder SNET met *smoothing* (conflict van 6 dag(en)); `uitleg-nivelleren.md` r.59 en r.76 (nl en en)
     noemen nog 5 (`check-docs-resources-voorbeelden.ts`).
     Zie `artifacts/uren-f2/bouwronde-4.md` (R4-030–039, R4-586–588) en
     `tests/planning/fixtures/minute-model-tutorial-f3.json`. Voorstel: de verhalende tutorial-
     en gidsteksten en eventuele schermbeelden bijwerken zodra de definitieve F3-uitkomsten
     zijn gehaald, met behoud van de afzonderlijk getoetste einddoelen. — B
252. **De gidsen over taaktypes zeggen nog dat de app een duur op hele werkdagen afrondt.**
     Sinds de werkdriehoek exact rekent (T14, B3) en vast werk de urenmaat is (B1a), klopt dat niet meer.
     `public/docs/{nl,en}/uitleg-werkregels.md` r.42 ("rondt naar boven af … hele werkdagen"), r.94
     (1,33 → 2 werkdagen, met het waarschuwingsteken *Wijkt af van inzet × duur*), r.102 (5,33 → 6
     werkdagen) en r.106 (restduur 1,5 → 2); `howto-werkregel-kiezen.md` r.59; `uitleg-kalenders.md`
     r.97 (nl; "een taak in dagen telt hele werkdagen" klopt nog, maar vast werk is nu altijd een taak in
     uren). Uit de code afgeleid (niet in de app nagespeeld): r.94 wordt nu 32 ÷ 3 = 10 u 40 min, zonder
     waarschuwingsteken, en het histogram toont dan 3 op de eerste en 1 op de tweede werkdag (§3.11; getoetst
     in `check-docs-resources-voorbeelden.ts`), niet 2 per dag. Hangt samen met 240.
     Voorstel: de voorbeelden herschrijven in dezelfde ronde als 240, met de uitkomsten uit
     `check-work-rule-*.ts`. Gevonden in F3c-winkel. — B

## Tests

207. **De bulkprestatiepoort kan in een volledige run falen terwijl beide gerichte controles slagen.**
    Tijdens een volledige corpusloze F1b-suite die deels met andere controles overlapte, meet `check-bulk-scale.ts`
    17.188 ms voor voortgang op 2000 van 8000 taken, bij de vaste grens van 15.000 ms.
    De gerichte controle op de schone basis 12abaabf2 slaagt met 6402 ms, en op dezelfde
    F1b-bron met 5793 ms (beide 23/23, exit 0). Een eerdere volledige F1b-run haalde 13.126 ms.
    De laatste volledige run zonder die overlap haalt 8833 ms en eindigt groen (exit 0).
    De wisselende tijdmeting is bevestigd; oorzaak niet vastgesteld en geen grens verruimd. — B

206. **De plakprestatiepoort kan op deze server ook zonder F1b de vaste grens overschrijden.**
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
