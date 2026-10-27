# X12 driving-path-as: de 145 afwijkingen naar oorzaak (#690, fase 1 punt 3)

Gemeten op 2026-10-27, `main` @ `433cca3b2`, met `OPS_XER_CORPUS` op aia09-mp50.
Per taak: `2026-10-27-x12-drivingpath-oorzaken.json` (145 regels).

## In het kort

Geen van de 145 taken wijkt af op de zes assen (ES/EF/LS/LF/TF/FF). OPS rekent voor deze taken
dezelfde datums en dezelfde speling als P6. Het verschil zit alleen in wat de as vergelijkt:

- de P6-kant is `TASK.driving_path_flag`, het langste pad dat P6 opslaat;
- de OPS-kant is `task.time.isCritical` (`check-xer-product-fidelity-x12.ts`, `solveImported`).
  Onder het P6-profiel is dat "totale speling ≤ 0 uur" (`criticalDefinition` `totalFloat`,
  `thresholdHours: 0`); een LOE en een voltooide taak zijn nooit kritiek
  (`src/engine/scheduler/scheduleAnalysis.ts`, `isCritical`).

Alle negen projecten hebben in P6 zelf `PROJECT.critical_path_type = CT_TotFloat` met
`critical_drtn_hr_cnt = 0`. P6 noemt daar dus ook "kritiek = speling ≤ 0". De as legt de kritiek-vlag
van OPS naast een ander P6-veld (langste pad). De as telt niet in het zesassige nuldoel, maar is wel
een regressiepoort: `drivingPath` is de zevende as van de cel-ratchet (`tests/planning/fidelityCells.ts`,
`CELL_AXES`). Een nu exacte cel die inexact wordt, maakt de meting rood; de 145 bestaande staan gepind.

## Verdeling

| oorzaak | taken | projecten | P6 / OPS | met "langste pad" in OPS |
|---|---:|---|---|---:|
| A. Op het langste pad, maar met positieve speling | 49 | 3211 (35, TF 8 u), 9031 (6), 9040 (6), 2666 (2, TF 1 u) | ja / nee | 12 blijven |
| B1. Speling 0, niet op het langste pad | 67 | 2666 | nee / ja | 0 blijven |
| B2. Speling 0 bij een start-op-of-na-beperking (`CS_MSOA`, in OPS SNET) | 2 | 9032, 10096 | nee / ja | 0 blijven |
| B3. Negatieve speling, niet op het langste pad | 4 | 9049 (TF −16 en −64 u) | nee / ja | 0 blijven |
| C. Voltooide taak op het langste pad | 13 | 4408 (7), 9032 (3), 10096 (3) | ja / nee | 13 blijven |
| D. LOE op het langste pad | 10 | 4508 | ja / nee | 10 blijven |
| **totaal** | **145** | | | **35** |

A, B1, B2 en B3 (122 taken) zijn het definitieverschil zelf: speling ≤ 0 is niet hetzelfde als
het langste pad. Bij B2 draagt de taak een SNET-beperking (`CS_MSOA`, `xerReader.ts`); of die de
speling van 0 veroorzaakt, is niet apart nagegaan. Bij 3211 heeft het hele langste pad 8 u speling. Dat past bij één werkdag tussen
het berekende einde (`scd_end_date` 2013-02-27 17:00) en het geplande projecteinde
(`plan_end_date` 2013-03-01); niet apart nagegaan.

C en D zijn twee vaste regels van OPS: een voltooide taak en een LOE zijn nooit kritiek. P6 zet
`driving_path_flag` wel op zulke taken.

## Proef: dezelfde meting met de kritiek-definitie "langste pad"

Tijdelijk, alleen in de meet-harness (niet in de motor, niet gecommit): in `solveImported` van
`check-xer-product-fidelity-x12.ts` `criticalDefinition: { mode: 'longestPath' }` over de opties van
het profiel gezet. Bestand vooraf naar `/tmp` gekopieerd en daarna teruggezet.

- driving-path-as: 145 → **35** afwijkende taken, en geen enkele nieuwe "OPS ja, P6 nee";
- zes assen: 76 → 76 (de kritiek-definitie raakt geen datum of speling).

De 35 die blijven: C (13) en D (10) door de vaste regels hierboven, en 12 taken uit A in OZB-09
(9031) en OZB-13 (9040). Die 12 vormen het begin van een keten (OZ1000 → OZ1050) met 32 of 48 u
speling. P6 zet ze op het langste pad; het langste pad van OPS niet. Waarom, is uit de bestanden
niet af te lezen. [VERMOED · zekerheid: laag] P6 volgt het langste pad over een andere relatie dan
de keten waar OPS de "driving"-relaties kiest.

## Wat dit betekent voor een besluit

De as is al een regressiepoort (cel-ratchet), maar zit niet in het zesassige nuldoel. Open voor
de eigenaar (#690, fase 1 punt 3) is dus niet óf de as bewaakt wordt, maar met welke definitie hij
vergelijkt en of hij een nuldoel krijgt. Twee feiten daarvoor:

1. Onder de eigen P6-instelling van deze projecten (`CT_TotFloat`, 0 u) zijn 122 van de 145 geen
   rekenfout maar een andere definitie. Een nuldoel op de huidige vergelijking zou die als fout tellen.
2. Vergelijkt de as met de OPS-modus "langste pad", dan blijven 35 taken over: 23 door de regels voor
   voltooide taken en LOE's, 12 onverklaard.
