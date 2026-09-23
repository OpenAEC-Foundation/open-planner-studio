# X12-restant 284 buiten HarbourPointe: wat zit er achter de 160 cellen? (meetonderzoek)

**In gewone taal.** Van de 160 afwijkingen buiten HarbourPointe komen er 92 uit een bestand dat niet door P6
is uitgerekend: de DCP-03-basisplanning is door een Python-script gemaakt dat zich als P6 voordoet. Van de
42 in OZB zijn er 38 geen fout van ons. Daar heeft P6 de planning met resource-nivellering doorgerekend,
en dat doet onze X12-meting niet. De andere 4 komen door een Progress Override-regel die we aan de late kant
nog missen. In Roads en Hotel vonden we twee kleine P6-regels waarmee samen 6 cellen verdwijnen, zonder dat
een andere cel slechter wordt. Wat daarna overblijft (Sample 12, Hotel 6, Roads 2) valt steeds terug te
brengen tot één taak of één relatie, en die regels zijn nergens bij Oracle beschreven.

Model: Claude Opus 5.5 (uitvoerder-opus-midden). Kop: `40b90b7f` (X12 284, schuld 0). Alleen gemeten:
`src/` is ongewijzigd (`git diff --exit-code src` = 0). De motorexperimenten zaten achter omgevingsvlaggen
en zijn teruggedraaid, zie *Experimenten*. Het meetinstrument is de per-taak-dump uit brok 6
(`/tmp/brok6/dump.ts`, overgezet naar `/tmp/r284/`). Die gebruikt `solveProject` + `measureXerProductFidelity`
op de manifest-orakels en reproduceert de gepinde stand exact: **284** (HarbourPointe 124, DCP-03 BL 92,
OZB 42, Sample 12, Hotel 8, Roads 6). "Beter/slechter/groter" hieronder is per cel, met emmer en grootte,
tegen die basisrun over alle 5.983 orakeltaken.

## Uitkomst in één tabel

| groep | cellen | oorzaak | soort | voorstel |
|---|---:|---|---|---|
| DCP-03 Baseline | **92** | orakel is uitvoer van `build_programmes.py`, een Python-dag-CPM, niet van P6 | (b) orakel-artefact | eigenaarsvraag: uit het orakel (populatie) |
| OZB 9033 | **38** | P6 heeft project 9033 **resource-genivelleerd** (PM-1, vooruit én achteruit) | (b) orakel ≠ CPM | eigenaarsvraag: nivellering in de meting of 9033 uit het orakel |
| OZB 10093 OZ1030 | **4** | Progress Override: de relatie naar een al gestarte opvolger telt ook achterwaarts niet | (a) regel, n = 1 project, Oracle-bron | bouwen (projectoptie `progressMode`, geen nieuwe conventie) |
| Roads OCEC6681/9761 + Hotel HCSWB3Z2190/HCSWB2Z6190 | **5** | een FF-grens die in niet-werktijd van de opvolger valt: P6 toont EF ≥ die grens (volgende bandstart), OPS het vorige bandeinde | (a) regel, gemeten **+5 / 0 / 0** | conventie (P6 aan) |
| Roads OCEC18201 ff | **1** | ff naar een voltooide CP_Phys-opvolger telt tot diens C5-punt | (a) spiegel van C5, gemeten **+1 / 0 / 0** | uitbreiding C5/C2 |
| Roads A10660 ef, A10650 ff | 2 | zelfde vorm als de FF-grens, maar A10660 is lopend (andere solvertak) | (a) [VERMOED] zelfde regel | meten bij de landing van de FF-regel |
| Sample REPLBE01–03, RDARCH02 | **12** | SF-relatie met lag 0: P6 legt de opvolgerfinish **één minuut** ná de voorgangerstart | (c) n = 1, niet gedocumenteerd | eigenaarsvraag / open restant |
| Hotel ff 60 min (HCSWB4Z4240, HCSWB2Z2240, HEPSS00020) | 3 | ff = 1 h tussen kalender 3196 (tot 17:00) en 3195 (tot 16:00); formule niet gevonden | (c) | open restant |
| Hotel ATWTPR000 | 3 | ALAP-eindmijlpaal (FinMile, kal. 844): P6 LF 17:00, OPS 16:00 | (c) n = 1, C10-gebied | bij C10 meenemen |
| **totaal** | **160** | | | |

Tegenfeit voor de twee gebouwde regels samen (FF-grens + C5-ff): **284 → 278, 6 beter, 0 slechter, 0 groter,
0 kleiner**, precies 6 OPS-waarden gewijzigd over alle 5.983 taken.

---

## 1. DCP-03 Baseline (92): geen P6-uitvoer

**BEVESTIGD: het bestand is gegenereerd.** Naast het bestand in het corpus staat de generator:
`delay-analysis-toolkit/sample/programmes/harbour_point_dcp03/build_programmes.py`, met de README-regel
"Both files are generated from one network by `build_programmes.py`". De generator:

- schrijft een P6-achtige kop (`ERMHDR 24.12 … oaltun`, r. 757) en een SCHEDOPTIONS-rij (r. 852). Ook zet hij
  `rem_late_start_date` (r. 945) en `driving_path_flag = "Y" if TF == 0` (r. 947). Dat zijn precies de drie
  kenmerken waarmee `scripts/xer-p6-computed.ts` het bestand als "P6-doorgerekend" aanmerkte;
- rekent een eigen dag-CPM (`forward`/`backward`, r. 498–545). Een FS-opvolger begint op "next working day"
  na de voorgangerfinish (`_succ_start`), óók na een startmijlpaal;
- schrijft **elke** `early_end_date` als `fmt(EF, "17:00")` (r. 940). Daardoor krijgt de startmijlpaal E-1000
  EF 17:00, zijn opvolgers beginnen pas de volgende dag, en dat verschuift de keten één dag (B10: 64 cellen);
- schrijft `free_float_hr_cnt = total_float_hr_cnt` (r. 937–938). Gemeten: 60 van de 60 taken hebben ff = tf.
  Dat is B15 (20 ff-cellen);
- laat bij de late datums de LOE-taken buiten het projecteinde (`finish = max(EF) if type != L`). Z-9000/Z-9010
  krijgen daardoor een generator-eigen span (B14: 8 cellen).

Verder: `guid` is leeg bij 60 van de 60 taken, `create_user` is overal `oaltun` en alle EF's staan op 17:00.
OPS en de generator zijn het toch eens over 268 cellen. Dat komt doordat het netwerk eenvoudig is, niet doordat
de generator P6 volgt.

**Conclusie (b): orakel-artefact.** Geen motorregel af te leiden: de "P6-regels" hier zijn keuzes van het
script. **Eigenaarsvraag:** DCP-03 Baseline uit het orakel halen (de As-Built van dezelfde generator is al
`reader-only`, §1d-6). Daarnaast is een extra kenmerk in `xer-p6-computed.ts` aan te raden: ff = tf op alle
taken plus lege guids is een generatorhandtekening. Dat is dezelfde soort populatiebeslissing als op 23-09,
dus niet door ons te nemen.

## 2. OZB-Start (42)

Het bestand bevat 15 projecten, allemaal met een SCHEDOPTIONS-rij en
`sched_use_project_end_date_for_float = Y`. Geen enkele relatie van 9033 of 10093 loopt naar een ander
project (TASKPRED: `pred_proj_id = proj_id` overal). Multi-project-float en externe relaties vallen dus af.
"Calculate float based on finish date" geeft ook geen verklaring: 9033 heeft geen `plan_end_date`, en het
negatieve getal komt uit de CS_MEOB-beperking op OZ1130 (2025-01-27 16:00).

### 2a. Project 9033 (38 cellen): resource-nivellering, niet verouderd

**Is het hele project verouderd?** Nee. Van de 14 taken is in de basisrun alleen OZ1070 helemaal exact. Maar
P6's datums volgen exact uit het bestand zodra je de nivellering meerekent:

- SCHEDOPTIONS van 9033: `level_all_rsrc_flag = N`, `level_keep_sched_date_flag = N`,
  `LevelPriorityList = early_start_date`. RSRCLEVELLIST (schedoptions_id 8 = 9033) nivelleert alleen
  **resource 6900 = PM-1** (Project Manager, 1 eenheid).
- PM-1 zit op OZ1010, OZ1040, OZ1050, OZ1060, OZ1090, OZ1100, OZ1110 en OZ1120. Vooruit in ES-volgorde:
  OZ1060 (MSOA 01-02) moet wachten op OZ1050 (tot 01-03) en begint dus 01-06. OZ1100 wacht op OZ1060 (tot
  01-15) en begint 01-16. OZ1090 wacht op OZ1100 (tot 01-23) en begint 01-24. Dat zijn **precies** P6's
  vroege datums. De "onverklaarbare" dag bij OZ1090…OZ1130 is dus de PM-1-wachttijd.
- Achteruit (omdat `keep_sched_date = N`) nivelleert P6 ook de late datums. OZ1100 moet dan vóór OZ1090 (LS
  01-21) klaar zijn, dus LF 01-20. OZ1060 moet vóór OZ1100 (LS 01-13) klaar zijn, dus LF 01-10. OZ1050 moet
  vóór OZ1060 (LS 12-31) klaar zijn, dus **LF 12-30**. Zo is de observatie uit brok 6 verklaard ("OZ1050 LF
  12-30 terwijl beide opvolgers LS 01-13/01-14 hebben"): de bepalende opvolger is geen logische relatie, maar
  de volgende PM-1-taak.
- Oracle, *Leveling resources* (P6 Professional User Guide 24,
  https://docs.oracle.com/cd/F88968_01/English/User_Guides/p6_pro_user/leveling_resources.htm): *"If forward
  leveling delays the project's early finish date, late dates remain unchanged unless you clear the checkbox
  to preserve scheduled early and late dates in the Level Resources dialog box. In this case, a backward pass
  recalculates late dates."* Het vinkje staat in dit bestand uit (`level_keep_sched_date_flag = N`).

**Tegenfeit (diagnose, bestandsmutatie, geen orakelwaarde als invoer):** drie extra FS0-relaties die de
genivelleerde PM-1-volgorde vastleggen (OZ1050→OZ1060, OZ1060→OZ1100, OZ1100→OZ1090). De volgorde volgt uit
de invoer (RSRCLEVELLIST + ES-prioriteit), niet uit P6's datums. Resultaat in OZB: **42 → 6**: 37 beter en
1 slechter. De slechtere cel is OZ1050 ff: de kunstmatige relatie wordt meegeteld in de vrije speling, terwijl
P6 ff alleen tegen logische opvolgers meet (P6 ff 64 h = tot OZ1100). Van 9033 blijft daarna alleen OZ1100 ff
over (P6 8 h tot OZ1110, idem). De overige 4 zijn 10093 (§2b).

**Conclusie (b): geen verouderde uitvoer. Het orakel bevat nivellering, en de X12-meting rekent alleen
CPM.** De optie "Level resources during scheduling" (P6 Schedule Options) staat voor zover wij kunnen zien
[VERMOED] niet in de XER. Het bestand zegt dus niet betrouwbaar óf er genivelleerd is. Projecten 9045, 9047 en
9049 hebben dezelfde RSRCLEVELLIST en staan wél exact: daar gaf de nivellering geen verschuiving, of er is niet
genivelleerd. **Eigenaarsvraag:** (1) project 9033 als "genivelleerd orakel" uit het CPM-nuldoel (vraagt een
manifest dat op projectniveau kan uitsluiten), of (2) een P6-conforme nivellering vooruit en achteruit, met
dezelfde prioriteitsregels, als onderdeel van de XER-meting. Optie 2 is een eigen etappe: onze `ResourceLeveler`
doet nu geen backward leveling. Bouwen als conventie kan niet: het is geen CPM-regel.

### 2b. Project 10093, OZ1030 (4 cellen): Progress Override aan de late kant

- 10093 is het enige project in de orakelpopulatie met `sched_progress_override = Y` (en
  `sched_retained_logic = N`). OZ1030 is lopend (act_start 12-19, rest 16 h). De FS-opvolger OZ1040 is al
  gestart op 12-20, dus buiten volgorde. De andere FS-opvolger OZ1060 heeft MSOA 01-02.
- P6: OZ1030 LF 12-31 16:00 = de dag vóór OZ1060 LS 01-02 (01-01 is een feestdag). ff 24 h tot OZ1060 ES. De
  relatie naar OZ1040 telt dus nergens mee. OPS: LF 12-20 16:00 (gedreven door OZ1040 LS 12-23), tf −960,
  ff 0.
- Oracle, *Scheduling Settings* (P6 EPPM Help 24, https://docs.oracle.com/cd/F88966_01/p6help/en/99348.htm):
  *"Progress Override: The schedule ignores network logic and allows the activity to progress without
  delay."* OPS past dat nu alleen vooruit toe (`CPMSolver` r. 2300). De backward pass en ff tellen de relatie
  naar de gestarte opvolger nog wel mee.
- **Tegenfeit (bestandsmutatie):** zonder de relatie OZ1030→OZ1040 gaat OZB **42 → 38: 4 beter, 0 slechter,
  0 groter**. Alle 4 cellen van OZ1030 zijn daarmee weg.

**Conclusie (a): regel gevonden.** Het is n = 1 project, maar het principe is gedocumenteerd, dus het valt onder
het n = 1-criterium van §1c. Voorstel: in de backward pass en de ff-berekening telt, bij `progressMode =
PROGRESS_OVERRIDE`, een relatie naar een opvolger met werkelijke start niet mee zolang de voorganger niet
voltooid is. Dit is geen nieuwe conventie: `progressMode` is al een projectoptie, en dit maakt de
bestaande P6-betekenis alleen symmetrisch. Poort bij de landing: X12 (verwacht −4), `check-mpp-fidelity`
(controleren dat geen `.mpp`-pad PROGRESS_OVERRIDE zet), corpusloze fixture met mutant (relatie weer meetellen
⇒ rood).

## 3. Roads (6)

| cel | P6 | OPS | eigenschap |
|---|---|---|---|
| OCEC9761 ef | 2014-01-15 07:00 | 2014-01-14 17:00 | FF0 vanaf **startmijlpaal** OCEC12101 (ES 01-15 07:00); enige FF vanaf een open startmijlpaal in de hele orakelpopulatie |
| OCEC6681 es/ef | 01-15 07:00 | 01-14 17:00 | TT_FinMile, FF0 vanaf OCEC9761: erft diens EF |
| A10660 ef | 2013-05-25 07:00 | 05-22 17:00 | lopend, kal. 1473 (za–wo). FF0 vanaf A10650 op kal. 1474 (7 dagen) met EF **do** 05-23 11:00. Do en vr zijn op 1473 vrij |
| A10650 ff | 960 | 0 | = 16 h op 1474 tussen 05-23 11:00 en A10660-EF 05-25 07:00: volgt uit de regel hierboven |
| OCEC18201 ff | 3000 | 0 | enige opvolger OCEC18381 is voltooid, CP_Phys, C5-punt 06-23 17:00. 50 h = EF 06-16 17:00 → 06-23 17:00 |

**Wat OCEC6681/9761 onderscheidt:** ze zijn geen mijlpaal op een afwijkende kalender. Het verschil zit bij de
voorganger: het is de enige FF-relatie vanaf een open startmijlpaal (`ffmile.py` over alle orakelbestanden:
1 treffer). De FF-grens is dan een **start**-instant (bandstart 07:00). P6 toont de EF op dat instant. OPS
normaliseert naar het vorige bandeinde (0 werkminuten verschil, maar in kloktijd vóór de grens).

### 3a. Regel "EF niet vóór de FF-grens" (Roads 3 + Hotel 2 cellen)

Dezelfde vorm zit in Hotel (§4): de FF-grens valt midden in een vrij blok van de opvolgerkalender. P6 toont
dan de eerste bandstart ná die grens, OPS het laatste bandeinde ervóór.

- Oracle, *About Relationships* (P6 EPPM Help 24, https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm),
  Finish to Finish: *"The successor activity cannot finish until its predecessor finishes."* De getoonde EF
  mag dus niet vóór de grens liggen. Dat OPS' waarde in werktijd gelijk is, maakt niet uit: de klokwaarde
  ligt vóór de grens. [VERMOED] Dat P6 dan de volgende bandstart kiest (en niet de grens zelf), is
  corpusgedrag. Oracle beschrijft het niet expliciet.
- **Experiment** (achter `EXP_FF`, teruggedraaid): in de voorwaartse pas, niet-gestarte tak, wordt per
  FF-voorganger de grens X = voorgangerfinish + lag berekend (lagkalender). Die wordt op de lagkalender
  genormaliseerd naar de finish-kant (`prevWorkInstant`), behalve als de voorganger een startmijlpaal is.
  Ligt X ná de berekende EF met 0 werkminuten ertussen op de eigen kalender, dan wordt
  `EF := snapOnOrAfter(eigen kalender, X)`.
- **Meting over alle orakelbestanden: 284 → 279, 5 beter (Hotel HCSWB3Z2190 ef, HCSWB2Z6190 ef; Roads
  OCEC6681 es/ef, OCEC9761 ef), 0 slechter, 0 groter.** Precies deze 5 OPS-waarden veranderen, verder geen.
- **Twee verworpen varianten, gemeten:** (i) zonder normalisatie van X: **82 slechter**. Een gewone
  FF-voorgangerfinish op een bandeinde wordt intern als volgende bandstart gedragen, en dan springt de EF een
  dag vooruit (Hotel HMMOAZ020, Roads OCEC10451 e.a., ashspace A1020…). (ii) (i) plus "alleen als X op een
  andere kalenderdag valt": gelijk aan (i). Zonder de finish-normalisatie is de regel dus fout.
- SF-relaties vallen hier bewust buiten (§5: P6 doet daar iets anders, +1 minuut).

**Conclusie (a).** Voorstel: conventie `p6FinishBoundNotBeforeRelationBound` (werknaam; P6 aan, MS Project en
OPS uit, zodat die profielen byte-identiek blijven). Het docblok noemt Oracle 6616 als bron en het
corpusgedrag voor de bandstartkeuze. Poort: X12 −5, cel-ratchet 0/0, mpp-fidelity ongewijzigd (conventie uit),
corpusloze fixture met twee vormen (grens in een meerdaags vrij blok; FF vanaf een startmijlpaal) plus mutant
(normalisatie weg ⇒ de dagsprong-fixture rood). Bij de landing ook de lopende-taaktak meten: A10660 ef en
A10650 ff hebben dezelfde vorm (+2 verwacht, [VERMOED], niet gemeten omdat de lopende tak een ander codepad
volgt).

### 3b. OCEC18201 ff: C5-spiegel in de vrije speling (1 cel)

In de orakelpopulatie hebben 3 open taken alleen voltooide CP_Phys-opvolgers: OCEC18201 (P6 3000), B2911
(P6 0; EF = punt 06-23 17:00) en A33 (P6 0; EF = punt 04-23 07:00). Alle drie volgen "ff = werktijd van EF tot
het C5-punt van de opvolger". OPS levert 0, omdat `sequenceFreeFloat` voor een voltooide opvolger leeg is en
de terugval 0 geeft.

- **Experiment** (`EXP_C5FF`, in de C2-lus van `scheduleAnalysis.ts`): bij een FS0-relatie naar een voltooide
  opvolger zonder eigen relatie-ff ⇒ ff = `workMinutesBetween(EF, opvolger-ES)`. **284 → 283, 1 beter, 0
  slechter, 0 groter**, 1 OPS-waarde gewijzigd.
- Samen met §3a: **284 → 278, 6 beter, 0/0/0.** De twee regels hebben geen interactie.

**Conclusie (a)**, n = 3 met 3/3 consistent. Het is de ff-kant van C5 (de C5-late kant landde in brok 6). Voorstel:
als uitbreiding van C5 of C2 (geen nieuwe sleutel), met een fixture en de mutant "terugval 0" ⇒ rood.
Oracle-bron: dezelfde als C5 (CP_Phys-punt). Dit is geen apart gedocumenteerd principe, dus meenemen in de
C5-review.

## 4. Hotel (8)

| cel | P6 | OPS | verklaring |
|---|---|---|---|
| HCSWB3Z2190 ef | 2012-10-30 08:00 | 10-24 16:00 | FF+32 h vanaf HCSWB4Z4240 (kal. 3196, 7 dagen, 08–12/13–17): grens X = 10-26 16:00. Op 3195 zijn 10-25, 10-26 (vr) en 10-27…29 vrij. P6 toont de eerste bandstart ná X |
| HCSWB2Z6190 ef | 2013-01-26 08:00 | 01-23 16:00 | idem (FF+32 h vanaf HCSWB2Z2240; 01-24 feestdag op 3195, vr vrij) |
| HCSWB4Z4240 ff, HCSWB2Z2240 ff, HEPSS00020 ff | 60 | 0 | alle drie op kal. 3196 (tot 17:00) met opvolgers op 3195 (tot 16:00). 1 h = het 16–17-slot |
| ATWTPR000 ls/lf (sameday) + tf | LF 2014-07-23 17:00, tf 60 | 16:00, 0 | TT_FinMile, **CS_ALAP**, kal. 844 (tot 17:00), zonder opvolgers; projecteinde 07-23 16:00 |

**Offerfeest-hypothese (vraag uit de opdracht): weerlegd.** Er ontbreekt geen feestdag. De 6 dagen tussen
10-24 en 10-30 zijn de vrije dagen die al in 3195 staan (10-25, 10-27…10-29 als uitzondering plus vrijdag
10-26). OPS decodeert ze goed. Het verschil zit alleen in de keuze voor de bandgrens (§3a).

- HCSWB3Z2190/HCSWB2Z6190: **(a)**, opgelost door de regel van §3a (gemeten).
- ff 60 min: **(c) onbeslisbaar.** Handmatig nagerekend: ff op 3196 van X (10-26 16:00) tot de P6-EF
  (10-30 08:00) is 25 h, niet 1 h. Op 3195 is het 0 h. Ook "EF − lag terug op 3196, dan tot de voorgangerfinish"
  geeft 25 h. Van P6's 1 h vond ik geen formule. [VERMOED] P6 meet de ff-grens eerst op de opvolgerkalender en
  zet hem daarna terug naar de voorgangerkalender, en dan blijft alleen het 16:00–17:00-verschil tussen de twee
  kalenders over. Niet getoetst.
- ATWTPR000: **(c)**, n = 1. De ALAP-eindmijlpaal ligt in P6 op het einde van de werkdag van zijn eigen
  kalender, niet op het projecteinde. Hoort bij C10 (ALAP, brok 7). Daar meenemen, niet los bouwen.

## 5. Sample_Construction (12): een SF-relatie met één minuut

Alle 12 cellen hangen aan één relatie: REPLBE01 —**SF lag 0**→ REPLBE03 (kal. 841, 08–16).

- P6: REPLBE01 ES 04-17 08:00 ⇒ REPLBE03 EF **04-17 08:01**, ES 04-15 08:01. Achterwaarts is REPLBE01 LS =
  REPLBE03 LF 05-15 16:00 **− 1 min** = 15:59. Via FS+8 h erft RDARCH02 de 08:01. Floats: 199,983333 h = 11.999 min
  (P6 schrijft 11.998,99998 door de afronding op 6 decimalen). REPLBE01 ff = 1 min, REPLBE02 ff = 352,016667 h
  (+1 min).
- De 08:01/15:59 zijn dus **geen afrondingsresten**. P6 zet de finish bewust één minuut ná de voorgangerstart.
  Een finish op 08:00 van een bandstart zou gelijk staan aan het vorige bandeinde (04-16 16:00) en dan in kloktijd
  vóór de start liggen. P6 kiest de kleinste stap die klopt met "cannot finish until its predecessor starts".
  [VERMOED] Dezelfde familie als §3a, maar P6 lost het hier op met +1 minuut en niet met de bandstart.
- **Tegenfeit (bestandsmutatie):** de SF-lag van 0 op 1 minuut (0,0166667 h) gezet. Resultaat **12 → 6: 6 beter,
  0 slechter, 5 kleiner**. Wat overblijft: 5 cellen van 0,00002 min (de orakelafronding van §1d-9, zelfde vorm
  als HarbourPointe EC1600) en REPLBE01 ff (P6 1 min tegen 0). P6 meet die ff tegen de grens zonder de
  extra minuut, en dat bevestigt dat de minuut niet uit de relatie komt maar uit de weergave van de finish.
- In de orakelpopulatie zijn er 3 SF-relaties. Alleen deze ene is lag 0, open en bepalend (Hotel HCSWSSZ1010→HMMOAZ020
  heeft lag 8 en is niet bepalend; HarbourPointe EC1150 is voltooid).

**Conclusie (c):** n = 1, en Oracle beschrijft de minuut niet (zoektocht zonder resultaat). Het valt dus niet
onder het n = 1-criterium. **Eigenaarsvraag:** laten staan als gemarkeerd open restant. Mocht de meettolerantie
van §1d-9 er komen, dan blijven er zonder regel toch 12 over (de verschillen zijn hier 1 minuut, niet 0,00002).

## Experimenten (tijdelijk, allemaal teruggedraaid)

- Instrument: `/tmp/r284/dump.ts` (kopie van brok 6 plus `OVR_LABEL`/`OVR_PATH` om een gemuteerde kopie te laten
  rekenen; de waarheid komt altijd uit het origineel), `cnt.py` (per cel: emmer + grootte), `alldiff.py` (elke
  gewijzigde OPS-waarde), `mut.py` (TASKPRED-rijen toevoegen/verwijderen in een kopie). Niet in de repo.
- Bestandsmutaties: `ozb-lev` (3 nivelleervolgorde-relaties) 42 → 6 (+37/−1). `ozb-po` (relatie OZ1030→OZ1040
  weg) 42 → 38 (+4/0). `sample-sf` (SF-lag 1 min) 12 → 6 (+6/0, 5 kleiner). Dit zijn diagnoses: de
  nivelleervolgorde en de SF-minuut zijn geen invoer voor de motor.
- Motorexperimenten achter omgevingsvlaggen in `CPMSolver.ts` (`EXP_FF`, `EXP_FF_NORM`, `EXP_FF_DAY`) en
  `scheduleAnalysis.ts` (`EXP_C5FF`). Volledige orakeldump per variant: e1 (FF zonder normalisatie) 284 → 361,
  82 slechter. e2 (+dag) idem. **e3 (met normalisatie) 284 → 279, +5/0/0.** e4 (e3+dag) idem. **e5 (C5-ff)
  284 → 283, +1/0/0. e6 (e3+e5) 284 → 278, +6/0/0.** Daarna `git checkout -- src/…`,
  `git diff --exit-code src` = 0.
- Niet gedaan: `measure:profiles` en mpp-fidelity. Beide regels staan achter een P6-conventie die in MS Project
  en OPS uit staat, dus die profielen zijn per constructie byte-identiek. Meten hoort bij de landing (regel A).

## Aanbeveling

1. **DCP-03 Baseline (92) → eigenaarsvraag, populatie.** Bewezen generatoruitvoer (`build_programmes.py`), geen
   P6-doorrekening. Aanbeveling: `reader-only`, zoals zijn As-Built-broer. Daarnaast `xer-p6-computed.ts`
   aanscherpen met de generatorhandtekening (ff = tf op alle taken, lege guids).
2. **OZB 9033 (38) → eigenaarsvraag.** Het orakel is genivelleerd (P6-bron geciteerd, en de volgorde volgt uit
   de invoer). Kies: project 9033 uit het CPM-nuldoel (manifest op projectniveau), of een P6-conforme
   nivellering vooruit en achteruit als eigen etappe. Het is niet verouderd.
3. **Bouwen, elk als eigen brok onder regel A:**
   (a) Progress Override aan de late kant (OZB 10093, −4, Oracle 99348);
   (b) conventie "EF niet vóór de FF-grens" (−5 gemeten, bij de landing ook de lopende tak meten, verwacht
   nog −2: A10660/A10650);
   (c) C5-ff-spiegel (−1).
   Samen **284 → 272** als (b) in de lopende tak de verwachte 2 haalt.
4. **Open restant (c):** Sample SF-minuut (12), Hotel ff 60 min (3), ATWTPR000 (3, bij C10).
5. Na 1 + 2 + 3 blijven er buiten HarbourPointe 18 cellen over, en 124 in HarbourPointe (zie het
   HarbourPointe-onderzoek: 81 verouderd, 34 C10, 7 n = 1, 2 meetrest).
