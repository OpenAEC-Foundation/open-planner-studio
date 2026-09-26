# X12 Sample_Construction: de SF-relatie met lag 0 en de ene minuut (meetonderzoek)

**In gewone taal.** In Sample_Construction legt P6 het einde van een taak één minuut ná de start van haar
SF-voorganger (08:01 in plaats van 08:00). Aan de late kant gebeurt het omgekeerde: de voorganger mag uiterlijk
om 15:59 beginnen in plaats van 16:00. Dat kost ons 12 cellen. Oracle zegt alleen dat de opvolger "niet
klaar mag zijn voordat de voorganger begint". Over die minuut staat nergens iets. In het hele corpus is dit
bovendien de enige SF-relatie die echt iets bepaalt. Een motorproef met de minuutregel haalt 6 van de 12 cellen
weg, zonder dat er ergens iets slechter wordt. Toch is het één geval zonder bron, en een verwante FF-situatie in
Roads gedraagt zich anders. Advies: als open restant laten staan (conclusie b), met de regel klaar voor als de
eigenaar hem toch wil.

Model: Claude Opus 5.5 (uitvoerder-opus-midden). Basis: `24acf986` (X12 192). Alleen gemeten: `src/` is
ongewijzigd (`git diff --exit-code src` = 0 na elk experiment). Instrument: kopie van de per-taakdump uit brok
6/`/tmp/r284` (`/tmp/sf0/dump.ts`, paden omgezet naar deze worktree; `cnt.py` per cel met emmer en grootte).
De basisrun reproduceert de gepinde stand: **192**, waarvan Sample 12.

## 1. Wat Oracle zegt (letterlijk)

- Oracle P6 EPPM Help, *About Relationships* (https://docs.oracle.com/cd/F88966_01/p6help/en/6616.htm):
  - *"Start to Finish: The successor activity cannot finish until its predecessor starts."*
  - Ter vergelijking: *"Finish to Finish: The successor activity cannot finish until its predecessor finishes."*
  - Over lag: *"A permitted modification to these logical relationships is called lag. [...] Lag entered in a
    unit other than hours is converted to hours based on the predecessor activity's calendar."*
- *Choose a calendar for relationship lag* (https://docs.oracle.com/cd/F51303_01/client_help/en_US/choose_a_calendar_for_relationship_lag.htm):
  alleen de menuroute en dezelfde noot over lagconversie. Niets over SF of minuten.
- De verwante pagina's (Creating/Configuring Activity Relationships, 8004/39370/7944/43922/8005/43984) gaan over
  de bediening. De formulering "cannot finish until" is dezelfde als bij FF. Nergens staat een strikte
  ongelijkheid of een minimale stap.

Buiten Oracle (geen primaire bron, wel bruikbaar):

- Ron Winter, *The Inner Workings of Oracle/Primavera P6* (https://www.ronwinterconsulting.com/The_Inner_Workings_Of_P6.pdf):
  *"Clearly, P6 computes schedules to a granularity of a minute. P6 handles this unit of measurement as 1 minute
  is equal to 0.0166667 hours."* En: *"P6 does not subtract the '1' but later 'rounds-up' finish times to the
  first non-working period when displaying the date."* Dat bevestigt dat een minuut P6's kleinste eenheid is.
  Waarom P6 bij SF juist die eenheid optelt, staat er niet in.
- Ten Six, *Start-to-Finish (SF) Relationships in P6* (https://tensix.com/start-to-finish-sf-relationships-in-p6/):
  *"EF(B) = ES(A) + Lag – 1"*, want *"the successor must finish the workday before the predecessor can start"*.
  Dat is de handrekening in hele dagen. Op minuten vertaald is dat het vorige bandeinde (04-16 16:00), dus
  precies OPS' huidige antwoord en één minuut vóór P6. Ten Six beschrijft het P6-gedrag dus niet.
- `cpp-cpm-engine/validation/p6-comparison/cases/04-sf-edge-case` (corpus, P6 23.12, handmatige capture):
  A —SF+0→ B, maar de relatie bepaalt daar niets (B begint op de datadatum, A heeft 0 speling via het
  projecteinde). Er zijn alleen hele uren gecapteerd (`08:00:00`, `17:00:00`). Voor de minuut zegt deze case
  niets.

## 2. Tellingen: SF-relaties in het corpus

Een scan over alle 93 manifestbestanden (TASKPRED `pred_type = PR_SF`) vindt 10 SF-relaties:

| rol | bestand | relatie | lag | bepalend? | P6-uitvoer |
|---|---|---|---:|---|---|
| **oracle** | Sample_Construction_TEC | REPLBE01 → REPLBE03 | 0 | **ja** | voorganger ES 04-17 08:00 ⇒ opvolger EF **04-17 08:01**; voorganger LS **05-15 15:59** = opvolger LF 05-15 16:00 − 1 min |
| oracle | HarbourPointe_AssistedLiving | EC1150 → EC2020 | 0 | nee (voorganger voltooid, AS 2010-09-29; EF opvolger 2012-02-28) | — |
| oracle | Hotel_Construction_TEC | HCSWSSZ1010 → HMMOAZ020 | 8 h | nee (grens 06-10 16:00, EF 08-22) | — |
| oracle | P6-Viewer/Hotel Project | idem (zelfde project, andere kopie) | 8 h | nee | — |
| engine-input | cpp-cpm-engine cases-import | A → B | 0 | geen uitvoer in het bestand | (case 04 hierboven: niet bepalend) |
| synthetic-fixture | polittdj commercial_construction | A1010 → A1030 | 0 | generator (EF 17:00 zaterdag) | geen P6 |
| synthetic-fixture | p6_torture_test_v1 (3×) | A8700→A3800, A11100→A10450, A11200→A10460 | 0 / 16 / −8 | geen datums | — |
| pseudo-xer | all-relation-types | R1040 → R1050 | 24 | geen datums | — |

- **Orakel, lag 0:** 2 relaties, waarvan 1 bepalend (Sample). **Orakel, lag > 0:** 2 (Hotel, twee kopieën),
  geen van beide bepalend. **Niet-orakel:** 6, geen enkele met P6-uitvoer waarin de relatie iets bepaalt.
- Tegenproef op de minuut: in alle 9 orakelbestanden staan onvoltooide ES/EF/LS/LF-waarden met een minuut
  anders dan :00/:30 alleen in HarbourPointe (actuals midden op de dag, 108–113 per veld) en in Sample, en dan
  **uitsluitend** op de SF-keten: REPLBE03 es/ef, RDARCH02 es/ef (erft via FS+8 h), REPLBE01 ls/lf. De
  minuut komt nergens anders in het corpus voor.

**Dus: n = 1.** Met lag > 0 is er geen bepalend geval. Of de minuut ook bij lag > 0 optreedt, of bij een
voorgangerstart midden in een band, is met dit corpus niet te beslissen.

## 3. De hypothese "eerstvolgende finish-instant ná de start"

Hypothese uit de opdracht: P6-finishinstanten liggen op bandeinden. 08:00 als finish zou gelijk staan aan het
vorige bandeinde (04-16 16:00) en ligt dan in kloktijd vóór de voorgangerstart. De eerstvolgende geldige finish
ná 08:00 op minuutresolutie is 08:01. Achterwaarts is het het spiegelbeeld: de LF van de opvolger (05-15 16:00,
een bandeinde) is als **start** hetzelfde werkmoment als de volgende bandstart (05-17 08:00, want zondag 05-16 is
vrij op kal. 841). Die ligt in kloktijd ná de grens. De laatste geldige start vóór 16:00 op minuutresolutie is
**15:59**, het "vorige start-instant vóór de grens". Dat is ook precies wat de motorproef in §4 nodig had.
De eerste poging (1 min terug vanaf de door `shiftLagPred` al naar 05-17 08:00 genormaliseerde grens) gaf
07:59 in niet-werktijd, en dat snapte terug naar 16:00. Pas `prevWorkInstant(grens) − 1 min` gaf 15:59.

**De hypothese verklaart het enige SF-geval, maar klopt als algemene P6-regel niet.** Roads OCEC9761 (§3 van
het restantonderzoek) heeft dezelfde geometrie via FF: de grens is een **start**-instant (startmijlpaal
OCEC12101, ES 2014-01-15 07:00 = bandstart van kal. 1473, 07–17). P6 zet de EF van OCEC9761 (8 h, ES 01-14
09:00) dan op **precies 07:00**, een finish op een bandstart en in kloktijd gelijk aan de grens. Er komt geen
07:01 en ook geen vorig bandeinde. Achterwaarts heeft startmijlpaal OCEC12101 LS = LF = 16:00, een start op een
bandeinde, zonder −1 min. P6 kan een finish dus prima op een bandstart tonen. Dat 08:00 bij SF niet mag, komt
niet uit de kalendergeometrie. Het is iets van de SF-relatie zelf.

Twee lezingen die bij het ene geval passen en niet van elkaar te onderscheiden zijn:
- (i) P6 behandelt SF als strikte ongelijkheid: finish **ná** de start, met één minuut als kleinste stap.
- (ii) P6 zet de voorgangerstart eerst om naar een finish-representatie en stapt dan één eenheid door. Dat gebeurt
  dan alleen als de start op een bandgrens valt.

Een SF met een voorgangerstart midden in een band zou (i) en (ii) scheiden. Zo'n geval zit niet in het corpus.

Ook opvallend: P6's vrije speling van REPLBE01 is **1 min**. Die meet dus EF(opvolger) − ES(voorganger) zonder de
minuut in de relatie zelf. De minuut zit in de plaatsing van de EF, niet in de grens. Dat klopt met §5 van het
restantonderzoek.

## 4. Tegenfeit met corpus (motorproef, teruggedraaid)

Tijdelijk in `relationMath.ts`, achter `EXP_SF1`:
- vooruit (`sfReqFinishHour`, uurmodus, niet-elapsed): geëiste finish := `nextWorkInstant(grens) + 1 min`;
- achteruit (`backwardHour`, `START_FINISH`, uurmodus, niet-elapsed): voorgangerstart :=
  `prevWorkInstant(grens) − 1 min`.

Volledige orakeldump (alle 5.923 orakeltaken, 20 projecten), tegen de basisrun op `24acf986`:

| bestand | voor | na | beter | slechter | groter | kleiner |
|---|---:|---:|---:|---:|---:|---:|
| Sample_Construction_TEC | 12 | 6 | 6 | 0 | 0 | 5 |
| alle andere orakelbestanden | 180 | 180 | 0 | 0 | 0 | 0 |
| **totaal** | **192** | **186** | **6** | **0** | **0** | **5** |

Er veranderen precies **11 OPS-waarden**, allemaal in Sample (REPLBE01 ls/lf/tf, REPLBE02 ff, REPLBE03 es/ef/tf,
RDARCH02 es/ef/tf/ff). Dat komt overeen met de eerdere bestandsmutatie (SF-lag 1 min): 12 → 6. De 6 die
overblijven:
- 5 × de orakelafronding van 0,00002 min (P6 schrijft 11.998,99998 voor 11.999; §1d-9, dezelfde vorm als
  HarbourPointe EC1600): REPLBE01 tf, REPLBE02 ff, REPLBE03 tf, RDARCH02 tf/ff;
- REPLBE01 ff: P6 1 min, OPS 0. [VERMOED] De ff-berekening meet tegen de grens mét minuut, P6 zonder (zie §3).
  Dat vraagt een tweede aanpassing in de ff-afleiding. Niet gebouwd.

Niet gemeten: `measure:profiles` en mpp-fidelity. De proef stond niet achter een conventie en raakt dus ook
MS Project (`mpp14relations.mpp` "Task 5" is een SF-lag-0-fixture, Z10). Bij een landing moet het achter een
P6-conventie, en dan zijn de MSP- en OPS-profielen per constructie byte-identiek.

## 5. Conclusie: (b) open restant

- **Bron:** Oracle definieert SF alleen als "cannot finish until its predecessor starts", met dezelfde woorden als
  FF. Over de minuut staat er niets. Ron Winter bevestigt alleen dat de minuut P6's rekeneenheid is. Ten Six
  geeft een dagformule die juist op OPS' huidige antwoord uitkomt.
- **Meting:** n = 1 bepalende SF-relatie in het hele corpus (93 bestanden). Er is geen geval met lag > 0 en geen
  geval met een start midden in een band. De algemene vorm van de hypothese ("een finish nooit op een bandstart")
  wordt door Roads OCEC9761 (FF, zelfde geometrie, P6 07:00 zonder minuut) **weerlegd**. Een SF-specifieke regel
  heeft dus maar één waarneming.
- **Dus geen conventie voorstellen.** Het n = 1-criterium eist een bron, en die is er niet. Ook de proef (+6/0/0)
  maakt er geen bewijs van, want de regel is precies op dit ene geval afgesteld. **Eigenaarsvraag:** Sample 12
  laten staan als gemarkeerd open restant. Als de eigenaar toch wil bouwen, ligt de vorm klaar: P6-conventie
  (werknaam `p6StartFinishStrictMinute`, P6 aan en MSP/OPS uit), vooruit `nextWorkInstant(grens) + 1 min`,
  achteruit `prevWorkInstant(grens) − 1 min`, plus de ff-aanpassing voor REPLBE01. Verwacht X12 192 → 186
  (185 met de ff-aanpassing, niet gemeten). Met de meettolerantie van §1d-9 zou dat 181 (180) worden, want de 5 afrondingscellen
  vallen dan ook weg.
- **Wat de vraag wél zou beslissen:** één echte P6-run met SF lag 0, waarbij de voorganger (a) op een bandstart
  en (b) midden in een band begint, en (c) met lag > 0 die op een bandstart eindigt. Die drie cases scheiden
  lezing (i) van (ii) en leggen vast of lag een rol speelt.
