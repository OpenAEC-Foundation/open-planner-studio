# Waarop de P6- en MS Project-conventies steunen, en waar het bewijs ophoudt

Een conventie in het register (`src/engine/scheduler/conventions/registry.ts`) is een regel waarin P6, MS Project
en OPS verschillen. Wat elke conventie doet en welke waarde ze in elk ingebouwd profiel heeft, staat in de gids
`ref-rekenopties-en-conventies.md`; de besluiten in de solver staan in de ADR's 0013, 0014, 0020, 0025 en 0027 tot en
met 0030. Hier staat het bewijs per conventie, omdat dat bepaalt hoe ver een poort mag. "Empirisch" betekent:
afgelezen aan de opgeslagen datums van door P6 doorgerekende XER-bestanden, zonder tekst van Oracle. Welke bestanden
als P6-orakel tellen, staat in `tests/planning/xer-corpus-manifest.json` (`role: oracle`); `rehab-2.xer` is
P3-uitvoer en de DCP-03-bestanden zijn generatoruitvoer of niet aantoonbaar door P6 doorgerekend, dus geen van
beide telt als bewijs voor P6. De bewijsclaims hieronder komen uit de meetverslagen in `docs/superpowers/plans/`,
vooral `2026-09-22-rekenprofielen-overdracht.md`, `2026-09-23-x12-c1-c4-toets-buiten-rehab2.md`,
`2026-09-23-x12-restant-classificatie.md` en `2026-09-24-x12-hotel-ff-60min.md`; ze zijn hier niet opnieuw
gemeten (het corpus staat niet in de repository). Verruim een poort alleen met een meting erbij
(`npm run measure:profiles`, regel A in de regel `rekenprofielen`).

## Gevolgen

- A19 (`p6UseRemainingStartForProgress`): de bron voor het plannen op de restduur is Oracle P6 Help, *Durations
  Columns* (https://docs.oracle.com/cd/F37125_01/p6help/en/47223.htm). De late kant over een SS-relatie
  (ADR 0028) is empirisch bevestigd op één relatie.
- A23 (`unstartedIgnoresStatusDate`) is een eigen vlag naast A22 (`resumeFromActualElapsed`), omdat ze over
  verschillende taken gaan: in de voorwaartse pass van `CPMSolver` leest A23 de tak van een taak met voortgang 0 en
  A22 die van een lopende taak.
- B2 (`p6BackwardLagFinishBoundary`): bij lag 0 is alleen FF gemeten. Andere relatietypen met lag 0 zijn niet
  gemeten en blijven op het gewone pad.
- B3 (`p6CompletedDataDateWindow`) zet in `CPMSolver` ook de diagnose `backwardFloatTrace` aan. In `src/` vullen
  alleen `CPMSolver` en `scheduleAnalysis.ts` die; tests zoals `check-xer-backward-float-trace.ts` lezen haar en
  zetten B3 daarvoor zelf aan.
- B5 (`p6OpenLoeTargetSpan`): het bewijs is zwak. Het enige bestand waarin de regel iets verandert,
  `ashspace-primeveraxereditor/sample.xer`, komt uit de repository van een XER-editor die de vlaggen zelf kan zetten;
  het manifest houdt het als orakel met de aantekening dat het twijfelachtig is.
- C1 (`p6CompletedPredecessorAtDataDate`): geen bron van Oracle, en geen door P6 doorgerekend bestand bevat zo'n
  geval. Of de grens `prevWorkInstant` krijgt, is niet gemeten; ze volgt het B3-venster (ADR 0027).
- C2 (`p6FreeFloatOnOwnCalendar`): empirisch (Hotel, Roads). Oracle zegt niets over de kalender; "op de
  eigen kalender" is onze uitleg, naar analogie van de totale speling. SS met lag en FF met lag zijn elk op één
  geval gemeten, op één kalenderpaar. FS met lag en een negatieve lag zijn doorgetrokken via T. Boyle, *Relationship
  Free Float and Float Paths in Multi-Calendar Projects* (2018), een bron van derden; de negatieve lag is vastgelegd
  in `check-conventions-p6-flags.ts`. Voor een gestarte taak geldt C2 alleen bij FS zonder lag; de andere relaties
  uit een gestarte taak zijn niet gemeten of werden door A13 gemaskeerd.
- C3 (`p6CompletedRemainingLag`): geen documentatiebron; afgelezen aan P3-uitvoer. C3 blijft in P6 aan omdat C5 de
  lag tussen zijn punt en een opvolger met deze regel rekent; met C3 uit werden 640 cellen inexact (Roads 503,
  HarbourPointe 137).
- C4 (`p6CompletedOutOfSequenceWindow`): Oracle P6 Professional Help, *General tab - Schedule Options dialog box*,
  geeft context maar geen bewijs (onder Retained Logic wordt de restduur pas gepland als alle voorgangers klaar zijn).
- C5 (`p6CompletedPhysicalAtDataDate`): empirisch (Roads, HarbourPointe, OZB). De poort
  (`explainP6CompletedPhysicalPoint`) is bewust smal: alleen voortgangstype `CP_Phys` is gemeten. Een brede poort
  (elke voltooide taak) gaf op de door P6 doorgerekende bestanden hetzelfde, want alle voltooide taken daar zijn
  `CP_Phys`; in DCP-03 As-Built, dat niet aantoonbaar door P6 is doorgerekend, verplaatste ze voltooide
  `CP_Drtn`-taken van hun werkelijke datums. `CP_Drtn`, de standaard van P6, en `CP_Units` zijn dus op geen P6-orakel
  gemeten; verbreed de poort niet zonder zo'n bestand. `check-conventions-p6-flags.ts` legt vast dat `CP_Drtn`
  niet meedoet. De poort heeft geen eis op Progress Override.
- C6 (`p6InProgressStartLagElapsed`): Oracle P6 Help, *Calculate Start-to-Start lag from*
  (https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm); C6 is de variant Early Start, met de ondergrens 0 voor
  de resterende lag. Empirisch bevestigd in Roads. Een deels verstreken lag (tussen 0 en de volle lag) is niet
  gemeten, en de late kant alleen bij een restduur gelijk aan de geplande duur.
- C7 (`p6FinishFinishStartMilestoneLateFinish`): empirisch in Roads (FF zonder lag naar een `TT_Mile`). De dagmodus
  is niet gemeten en valt er bewust buiten.
- C8 (`p6StartedTaskIgnoresPlannedStartFloor`): empirisch (OZB, Roads). De regel leest geen `restart_date`: dat is
  verboden bronuitvoer (`check-xer-field-whitelist.ts`) en alleen de meetlat.
- C9 (`p6LateFinishOnOwnCalendar`): empirisch (Hotel). Er is geen instelling in P6 voor gevonden, daarom is het een
  vaste rekenregel en geen projectoptie. Welke late finish de regel verschuift, staat in `lateFinishOnOwnCalendar`
  en de aanroep daarvan in `CPMSolver`. Een bredere variant, elke late finish naar het vorige werkmoment, is
  gemeten en verworpen: 54 cellen beter en 54 slechter, de slechtere bij startmijlpalen in Hotel (project 2666) en
  TERMINAL (`2026-09-23-x12-restant-classificatie.md`).
- C11 (`p6ProgressOverrideIgnoresStartedSuccessor`): Oracle P6 EPPM Help, *Scheduling Settings*
  (https://docs.oracle.com/cd/F88966_01/p6help/en/99348.htm): "Progress Override: The schedule ignores network
  logic and allows the activity to progress without delay." Gemeten op één project, OZB, het enige project met
  Progress Override in het corpus. De eis dat de voorganger niet voltooid is (`progressOverrideIgnoresRelation`), is
  een voorzorg en niet gemeten.
- C12 (`p6FinishNotBeforeFinishFinishBound`): Oracle P6 EPPM Help, *About Relationships*
  (https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm): "The successor activity cannot finish until its
  predecessor finishes." Dat P6 dan het volgende blokbegin toont, is empirisch (Roads, Hotel). De grens zelf en de
  normalisatie naar de finishkant staan in ADR 0029 en `finishNotBeforeFinishFinishBound`. De uitzonderingen voor een
  harde finishpin, een lag in kalendertijd, de dagmodus en een hammock zijn voorzorg en niet gemeten.
- C14 (`p6AlapPositionedFromSuccessors`): Oracle P6 Help beschrijft *As Late As Possible* als zo laat als kan zonder
  de opvolgers te vertragen; empirisch in HarbourPointe (een ALAP-keten). De beperkingen zijn geijkt op het corpus,
  niet op een bron: alleen een kalender met eigen werkblokken, en alleen niet-gestarte taken. Zonder die grenzen kwam
  EC1030 in HarbourPointe verder van P6 te liggen (`2026-09-22-rekenprofielen-overdracht.md`, brok 5). Dat bij een botsing van een tweede constraint de ondergrens wint (ADR 0030), is
  een eigen keuze en niet tegen P6 geijkt. Voor MS Project is niet gemeten hoe het ALAP plant.
