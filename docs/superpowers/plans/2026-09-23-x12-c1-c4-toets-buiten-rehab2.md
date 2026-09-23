# X12 — toets C1–C4 buiten rehab-2

**In gewone taal.** De vier nieuwe P6-rekenregels (C1–C4) zijn getoetst op de vraag of er naast rehab-2 een ander bestand is dat ze steunt. Alleen C2 (vrije speling op de eigen kalender) wordt door echte P6-uitvoer gesteund: 256 cellen in Hotel, Roads en DCP-03. C1, C3 en C4 veranderen buiten rehab-2 geen enkele cel. De regels zijn gebouwd op een vorm van voltooide taken die in het hele corpus alleen rehab-2 heeft, en die vorm lijkt P3-gedrag. Voor C4 laat Roads wel zien dat P6 het principe kent, maar in een andere vorm dan de regel nu uitrekent.

Meetdatum 2026-09-23. Opus 5.5 (uitvoerder-opus-midden). Basis: branch `claude/x12-c-toets-buiten-rehab2`, kop 848eb3e1. `src/` is aan het eind byte-identiek aan de kop.

## 1. Meetmethode

- Per variant is in `src/engine/scheduler/conventions/registry.ts` de `builtIn`-waarde van de conventie tijdelijk van `P6_ONLY` naar `NONE` gezet. Het P6-profiel rekent dan zonder die regel; overrides op deze sleutels zet de XER-lezer niet.
- Daarna draaide `OPS_XER_FIDELITY_REPORT=detail bash tests/planning/run.sh check-xer-product-fidelity-x12.ts`, met `OPS_XER_CORPUS` gezet en achter `flock /tmp/ops-heavy-suite.lock`. Na elke run volgde `git checkout` van het register. De detailuitvoer geeft per entry één regel per inexacte cel (`<proj_id>/<task_code> <as>: <emmer>`). Dat is dezelfde bron als de cel-baseline; de baseline in de repo is niet aangeraakt.
- Per cel is vergeleken met emmerrang (exact < sameday < diff < missing), dezelfde ordening als regel A. **beter** betekent dat de cel met de conventie aan een lagere rang heeft dan met de conventie uit. **slechter** is het omgekeerde, en **netto** = beter − slechter.
- De referentiemeting "alles aan" gaf 11.771 zesassige afwijkingen. Dat is gelijk aan de gepinde v2-stand na C4. "Alle vier uit" gaf 15.056, gelijk aan de stand vóór brok 2. De meetlat reproduceert dus beide eindpunten.
- De exitcodes zijn alle bekeken:
  - `on`, `c2off` en `c3off` gaven exit 0.
  - `c1off`, `c4off` en `alloff` gaven exit 1. Oorzaak: de corpusloze X12-pins van C1 en C4 ("opvolger van voltooide voorganger … begint op de statusdatum" en "A→FS→B(completed) met C4 …"). Die horen rood te worden als de regel uit staat. De corpusmeting zelf is in alle zes runs volledig: 34 entries, 47 projecten, 0 identiteits- of scannerfouten.
- De tabellen tonen alleen (bestand, project, as)-combinaties met verschil. **Alle andere entries en assen hebben in elke variant 0 verschil.** `drivingPath` is een zevende as en verandert in geen enkele variant (417 → 417).

## 2. Tabellen per conventie

"aan" en "uit" zijn aantallen inexacte cellen.

### C1 `p6CompletedPredecessorAtDataDate`

| bestand | project | as | aan | uit | beter | slechter | netto |
|---|---|---|---|---|---|---|---|
| rehab-2 | 761 | es | 11 | 509 | 498 | 0 | +498 |
| rehab-2 | 761 | ef | 11 | 509 | 498 | 0 | +498 |
| rehab-2 | 761 | tf | 2.804 | 3.071 | 267 | 0 | +267 |
| rehab-2 | 761 | ff | 19 | 71 | 52 | 0 | +52 |
| **rehab-2 totaal** | | zesassig | 8.441 | 9.756 | 1.315 | 0 | +1.315 |
| **alle bestanden behalve rehab-2** | | zesassig | 3.330 | 3.330 | 0 | 0 | 0 |
| **totaal** | | zesassig | 11.771 | 13.086 | 1.315 | 0 | +1.315 |

### C2 `p6FreeFloatOnOwnCalendar`

| bestand | project | as | aan | uit | beter | slechter | netto |
|---|---|---|---|---|---|---|---|
| **rehab-2** | 761 | ff | 19 | 201 | 182 | 0 | +182 |
| Hotel_Construction_TEC | 2666 | ff | 3 | 247 | 244 | 0 | +244 |
| Roads_Project_TEC | 1346 | ff | 22 | 33 | 11 | 0 | +11 |
| Harbour Point DCP-03 Baseline Rev 0 | 1801 | ff | 20 | 21 | 1 | 0 | +1 |
| **alle bestanden behalve rehab-2** | | zesassig | 3.330 | 3.586 | 256 | 0 | +256 |
| **totaal** | | zesassig | 11.771 | 12.209 | 438 | 0 | +438 |

### C3 `p6CompletedRemainingLag`

| bestand | project | as | aan | uit | beter | slechter | netto |
|---|---|---|---|---|---|---|---|
| rehab-2 | 761 | es | 11 | 77 | 66 | 0 | +66 |
| rehab-2 | 761 | ef | 11 | 77 | 66 | 0 | +66 |
| rehab-2 | 761 | ls | 2.798 | 2.920 | 122 | 0 | +122 |
| rehab-2 | 761 | lf | 2.798 | 2.920 | 122 | 0 | +122 |
| rehab-2 | 761 | tf | 2.804 | 2.970 | 166 | 0 | +166 |
| rehab-2 | 761 | ff | 19 | 35 | 16 | 0 | +16 |
| **rehab-2 totaal** | | zesassig | 8.441 | 8.999 | 558 | 0 | +558 |
| **alle bestanden behalve rehab-2** | | zesassig | 3.330 | 3.330 | 0 | 0 | 0 |
| **totaal** | | zesassig | 11.771 | 12.329 | 558 | 0 | +558 |

Waarom C3 hier 558 cellen scheelt en in zijn eigen commit 351: C4 gebruikt de C3-lagregel ook voorwaarts ("en alleen als C3 aan staat", `completedOutOfSequenceRelationSeq`). Met C4 aan draagt C3 dus 207 extra cellen, allemaal es/ef/tf/ff in rehab-2.

### C4 `p6CompletedOutOfSequenceWindow`

| bestand | project | as | aan | uit | beter | slechter | netto |
|---|---|---|---|---|---|---|---|
| rehab-2 | 761 | es | 11 | 443 | 432 | 0 | +432 |
| rehab-2 | 761 | ef | 11 | 443 | 432 | 0 | +432 |
| rehab-2 | 761 | tf | 2.804 | 3.102 | 298 | 0 | +298 |
| rehab-2 | 761 | ff | 19 | 59 | 40 | 0 | +40 |
| **rehab-2 totaal** | | zesassig | 8.441 | 9.643 | 1.202 | 0 | +1.202 |
| **alle bestanden behalve rehab-2** | | zesassig | 3.330 | 3.330 | 0 | 0 | 0 |
| **totaal** | | zesassig | 11.771 | 12.973 | 1.202 | 0 | +1.202 |

### Referentie: C1–C4 alle vier uit

| bestand | project | as | aan | uit | beter | slechter | netto |
|---|---|---|---|---|---|---|---|
| rehab-2 | 761 | es | 11 | 940 | 929 | 0 | +929 |
| rehab-2 | 761 | ef | 11 | 940 | 929 | 0 | +929 |
| rehab-2 | 761 | ls | 2.798 | 2.920 | 122 | 0 | +122 |
| rehab-2 | 761 | lf | 2.798 | 2.920 | 122 | 0 | +122 |
| rehab-2 | 761 | tf | 2.804 | 3.476 | 672 | 0 | +672 |
| rehab-2 | 761 | ff | 19 | 274 | 255 | 0 | +255 |
| Hotel_Construction_TEC | 2666 | ff | 3 | 247 | 244 | 0 | +244 |
| Roads_Project_TEC | 1346 | ff | 22 | 33 | 11 | 0 | +11 |
| Harbour Point DCP-03 Baseline Rev 0 | 1801 | ff | 20 | 21 | 1 | 0 | +1 |
| **rehab-2 totaal** | | zesassig | 8.441 | 11.470 | 3.029 | 0 | +3.029 |
| **alle bestanden behalve rehab-2** | | zesassig | 3.330 | 3.586 | 256 | 0 | +256 |
| **totaal** | | zesassig | 11.771 | 15.056 | 3.285 | 0 | +3.285 |

Buiten rehab-2 is de hele winst van groep C dus precies de 256 ff-cellen van C2.

## 3. Welke orakels zijn door P6 doorgerekend?

Per project in elk `included`-bestand van het manifest zijn de drie kenmerken uit het B01-document §3 geteld. De tellingen zijn gemaakt met een eigen parser (`/tmp/ctoets/p6marks.py`, niet gecommit) op de ruwe TASK-, PROJECT- en SCHEDOPTIONS-rijen:

- (S) er is een SCHEDOPTIONS-rij voor het project;
- (R) `rem_late_start_date` is gevuld op de open taken;
- (D) `driving_path_flag` is ergens Y.

"Zesassig nu" is het aantal inexacte cellen in de huidige stand (11.771 in totaal).

| bestand (project) | S | R (gevuld/open) | D (Y) | P6-doorgerekend | zesassig nu |
|---|---|---|---|---|---|
| Hotel_Construction_TEC (2666 HBTF-2) | ja | 4.217/4.217 | 133 | **ja** | 64 |
| Hotel_Construction_TEC (2665 CR) | nee | 0/19 | 0 | nee (bijproject in hetzelfde bestand) | 0 |
| Roads_Project_TEC (1346) | ja | 1.036/1.036 | 129 | **ja** | 995 |
| HarbourPointe_AssistedLiving (4408) | ja | 113/113 | 30 | **ja** | 192 |
| Sample_Construction_TEC (771) | ja | 51/51 | 18 | **ja** | 13 |
| TERMINAL BUILDING-AIRPORT (3211) | ja | 66/66 | 36 | **ja** | 0 |
| OZB-Start-09Dec24 (12 projecten) | ja | 100 % per project | 1–13 per project | **ja** | 156 |
| Harbour Point DCP-03 Baseline Rev 0 (1801) | ja | 60/60 | 32 | **ja** | 92 |
| xernative/sample (368 TAKT) | ja | 25/25 | 9 | **ja** | 0 |
| ashspace-primeveraxereditor/sample (4508) | ja | 52/52 | 52 (alle taken) | **ja** (D verdacht: 52/52) | 4 |
| Harbour Point DCP-03 As-Built Rev 12 (1802) | ja | n.v.t. (0 open) | 0 | onbepaald (alles voltooid) | 0 |
| hb-intel_Project_Schedule (1001) | ja | **0**/281 | 35 | nee (R ontbreekt) | 0 |
| **rehab-2 (761)** | **nee** | **0**/4.940 | **0** | **nee** (P3-import, B01 §6) | **8.441** |
| p6diff-baseline / -revised / sample-target | nee | 8/8 | 0 | nee | 4 / 35 / 32 |
| meridianiq demo-sample / sample_update2 | nee | 0 | 21 | nee | 64 / 38 |
| schedulevisualiser, Hospital_GW (2×), stack_data_center (2 proj.) | nee | 0 | 3–18 | nee | 8 / 0 / 8 |
| MER-1-2026 (2×), groupdocs, gimmer-crag, ProjectLens (5×), P6-Viewer sample, planning-risk, DCP revA/B/C | nee | 0 | 0 | nee | 1.814 samen (incl. de regels hierboven zonder P6-kenmerk) |

`P6-Viewer/XER Files/Hotel Project.xer` heeft dezelfde kenmerken als Hotel_Construction_TEC. Het wijkt vanaf byte 90 af (kop), maar is geen eigen X12-entry: X12 meet 34 entries.

**Uitkomst (BEVESTIGD als telling):**

- Van de 11.771 inexacte cellen zitten er **1.516** in P6-doorgerekende orakels. **8.441** zitten in rehab-2, dat P3-uitvoer is. De overige **1.814** zitten in bestanden zonder P6-kenmerk: gegenereerd, handgemaakt of door een tool geschreven.
- Het nuldoel meet dus voor ruim 70 % tegen een orakel dat geen P6-uitvoer is.

## 4. Een bevinding die verder reikt dan C1–C4: de B3-vorm komt alleen in rehab-2 voor

C1, C3 en C4 hangen alle drie aan de B3-statusdatumroute voor voltooide taken:

- C4 en de late kant van C3 zijn expliciet gepoort op `explainP6CompletedDataDateWindowResolved`;
- C1 grijpt in op een voltooide voorganger met een werkelijk einde ná de statusdatum.

Die poort laat alleen `CP_Drtn` + `DT_FixedDUR2` + `TT_Task` toe.

Telling van de voltooide taken per orakel (BEVESTIGD):

| bestand | voltooide taken | vorm (`complete_pct_type`, `duration_type`) | orakel-ES/EF van voltooide taken |
|---|---|---|---|
| **rehab-2** | 2.037 | CP_Drtn, DT_FixedDUR2 | **ES > EF (gesnapt venster): 2.036** |
| Roads_Project_TEC | 157 | CP_Phys, DT_FixedDrtn | ES = EF = statusdatum (rauw): 134; ES = EF > statusdatum (buiten volgorde): 23 |
| HarbourPointe | 18 | CP_Phys, DT_FixedDrtn | ES = EF = statusdatum (rauw): 18 |
| OZB-Start | 17 | CP_Phys, DT_FixedDrtn/DUR2 | ES = EF = statusdatum (rauw): 14, leeg: 3 |
| DCP-03 As-Built | 61 | CP_Drtn, DT_FixedDrtn | ES = werkelijke start: 56 (alles voltooid) |

Alleen rehab-2 heeft de vorm die de B3-poort toelaat. Alleen rehab-2 heeft het "gesnapte" venster, met ES op het eerste werkmoment ná de statusdatum en EF op het laatste werkmoment ervóór.

Elk P6-doorgerekend bestand met voltooide taken toont iets anders: ES = EF = de rauwe statusdatum (Roads 2013-04-23 00:00, HarbourPointe 2011-05-01 00:00), en bij buiten-volgorde-taken één instant ná de statusdatum.

- **BEVESTIGD** als corpusfeit.
- **VERMOED**: de B3-weergavevorm zelf, en niet alleen C1–C4, is P3-gedrag. Dit is hier niet verder onderzocht; het hoort bij het vervolgbesluit over B3 en de hele groep C.

Het gevolg is concreet. De voltooide taken van Roads (628 cellen: es/ef/ls/lf × 157), HarbourPointe (79) en OZB (62) staan nu inexact, en geen enkele groep-C-regel kan ze raken. De `CP_Phys`-poort sluit ze uit.

## 5. Oordeel per conventie

Onder "bron" staat wat de commit als bron aanvoert en wat daarvan in echte P6-uitvoer terug te vinden is.

### C1 `p6CompletedPredecessorAtDataDate`: **(b) alleen rehab-2 ⇒ mogelijk P3-gedrag, niet als P6-regel te rechtvaardigen**

- **Meting.** 1.315 cellen beter, allemaal in rehab-2. Buiten rehab-2 verandert er niets.
- **Triggers buiten rehab-2.** Er is precies één voltooide taak met een werkelijk einde ná de statusdatum en opvolgers, in DCP-03 As-Built. Dat project is helemaal voltooid, dus zonder open opvolger. Geen enkel P6-doorgerekend bestand heeft een open opvolger in deze situatie.
- **Bron.**
  - De Oracle-tekst "Using the data date" zegt dat actuals vóór de statusdatum liggen. Een regel voor een werkelijk einde *ná* de statusdatum (inconsistente voortgang) staat er niet in. Wat P6 dan doet, is dus een interpretatie.
  - De enige metingen zijn de vijf rehab-2-taken met act_end 2008-05-27 17:00 bij statusdatum 05-27 00:00.

### C2 `p6FreeFloatOnOwnCalendar`: **(a) gesteund door P6-uitvoer buiten rehab-2**

- **Meting.** Hotel_Construction_TEC (2666) +244, Roads_Project_TEC +11 en Harbour Point DCP-03 Baseline Rev 0 +1: samen **256 ff-cellen**, 0 slechter. Alle drie zijn P6-doorgerekend (S, R en D). Daarnaast +182 in rehab-2.
- **Triggers.** Open taken met een FS-opvolger op een andere kalender: Hotel 664, Roads 96, OZB 33, DCP-03 BL 15. De regel wordt dus breed geraakt en nergens verslechterd.
- **Bron.** De Oracle-help "View activity float values" plus meer dan de helft van de winst uit echte P6-uitvoer. Deze regel staat op eigen benen.

### C3 `p6CompletedRemainingLag`: **(b) alleen rehab-2 ⇒ mogelijk P3-gedrag, niet als P6-regel te rechtvaardigen**

- **Meting.** 558 cellen beter, allemaal in rehab-2: 351 eigen en 207 via C4.
- **Triggers buiten rehab-2.** Een voltooide voorganger met positieve lag naar een open opvolger:
  - Roads A15087 → A15089 (SS+30 h, volledig verstreken);
  - HarbourPointe EC1000/EC1130 → EC1600 (SS+320 h, FS+40 h, FS+560 h).

  Die cellen zijn met C3 aan en uit gelijk. De voorgangers zijn `CP_Phys` en vallen buiten de B3-poort, dus C3 grijpt er niet in. Buiten rehab-2 is er dus geen enkele meting die de regel steunt of weerlegt.
- **Bron.** Dezelfde algemene Oracle-tekst als C1. De rekenregel "alleen het nog niet verstreken deel van de lag telt" is alleen aan rehab-2-relaties afgelezen (V3122120 → V3122070 en andere).

### C4 `p6CompletedOutOfSequenceWindow`: **(c) gemengd: het principe is P6, de vorm alleen rehab-2**

- **Meting.** 1.202 cellen beter, allemaal in rehab-2. Buiten rehab-2 verandert er niets.
- **Steun voor het principe (BEVESTIGD in echte P6-uitvoer).**
  - Roads_Project_TEC is P6-doorgerekend, met `sched_retained_logic` = Y en `sched_progress_override` = N. Het heeft 23 voltooide taken met een orakel ES = EF ná de statusdatum.
  - Bij de zeven taken met een directe, niet-voltooide FS/SS-voorganger valt die instant precies op de relatiegrens uit die voorganger:
    - A65 ← A33 (FS): ES = EF = 2013-04-23 07:00 = EF van A33;
    - A10 ← A7 (FS): 06-03 17:00;
    - OCEC10791, OCEC11361, OCEC18381 en OCEC11781 ← onder andere B2911 (FS): 06-23 17:00. Dat is de laatste van meerdere voorgangers, dus "de laatste van de relatiegrenzen";
    - A15081 ← A15069 (SS+60 h): 05-13 17:00.

  Dit is Retained Logic voor voltooide taken buiten volgorde: precies wat C4 wil uitdrukken.
- **Tegen de huidige vorm.**
  1. **Poort.** C4 bereikt Roads niet, omdat de B3-poort `CP_Phys` weigert. De 92 cellen (es/ef/ls/lf × 23) staan met C4 aan en uit even inexact.
  2. **Vensterweergave.** In P6 (Roads) is ES = EF = de rauwe instant op de kalender van de voorganger. C4 geeft het rehab-2-venster: ES gesnapt op de eigen kalender, dus ES > EF.
  3. **Late kant.** In Roads verschuift ook de late kant: LS = LF, één late instant (A65: 2013-05-11 10:00). C4 laat de late kant bewust ongewijzigd, en dat komt uit rehab-2.

Samengevat:

- Het principe "voltooid buiten volgorde ⇒ venster op de relatiegrens van de onvoltooide voorganger" wordt door P6-uitvoer gesteund. Ook de Oracle-tekst over Retained Logic past erbij.
- De concrete rekenregel (gesnapt venster, late kant ongemoeid, alleen `CP_Drtn`/`DT_FixedDUR2`) is alleen op rehab-2 gemeten, en wijkt op twee punten af van wat P6 in Roads laat zien.

## 6. Advies

1. **C2 kan als P6-conventie blijven**, onafhankelijk van rehab-2.
2. **C1 en C3 niet als P6-regel landen op het huidige bewijs.**
   - Of ze laten staan als bekende rehab-2- (P3-)verklaring buiten het P6-profiel. Dat kan in een P3-rol als rehab-2 die krijgt (B01 §6 advies 2).
   - Of de P6-waarde op uit zetten tot er een P6-orakel is met een voltooide voorganger die ná de statusdatum eindigt (C1), of met een deels verstreken lag (C3), dat de regel bewijst.
3. **C4 niet in de huidige vorm als P6-regel landen.** Roads is een echt P6-orakel voor out-of-sequence onder Retained Logic, met 23 taken. Een herziene C4 hoort op Roads gemeten te worden:
   - instant-venster (ES = EF);
   - verschoven late kant;
   - zonder de `CP_Drtn`-poort.

   Dat raakt de B3-poort, en daarmee het besluit over B3 zelf (§4).
4. **Manifest.** De tabel in §3 maakt zichtbaar dat maar 1.516 van de 11.771 afwijkingen tegen een aantoonbaar door P6 doorgerekend orakel gemeten worden. Een aparte telling "nuldoel over P6-doorgerekende orakels" (Hotel, Roads, HarbourPointe, Sample, TERMINAL, OZB, DCP-03 BL, xernative, ashspace) zou het X12-doel eerlijker maken. Dat is een eigenaarsbesluit, zie plan §1d.

## 7. Wat er níet is gedaan

- Geen wijziging in `src/`, de baselines of het manifest. De tijdelijke registerwijzigingen zijn na elke run teruggezet; `git diff --exit-code src` is schoon.
- Het oordeel over B3 zelf (§4) is een waarneming, geen onderzoek. De vraag of `ES > EF` P3-weergave is, is niet in documentatie nagezocht.
- De hulpscripts en logs staan in `/tmp/ctoets/` en zijn niet gecommit.
