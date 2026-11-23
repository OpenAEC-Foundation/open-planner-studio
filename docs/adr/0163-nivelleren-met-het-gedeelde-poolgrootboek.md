# Nivelleren met het gedeelde poolgrootboek

Een resource die uit de resourcebibliotheek komt, deelt haar capaciteit met andere documenten. De nivelleerder
toetst daarom met twee grootboeken: zijn eigen grootboek per resource tegen de projectinzet, en het grootboek van
het poolitem waaraan de resource hangt (`LevelingPoolLedger`). Een kandidaat past alleen als beide toetsen slagen
(`fits`, `dayFits`). Het poolgrootboek komt van de aanroeper, de verdeler (`computeDistribution` in
`src/services/library/distribute.ts`), en niet uit de motor: het is gedeeld over documenten, en de motor draait per
document. Het is ingespoten op dezelfde manier als `OccupancyEphemeralSolve` in `occupancy.ts`. Zonder grootboek
geldt alleen de toets per resource. Ontwerp: `docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md`.

## Gevolgen

- De pooltoets telt de vraag van alle projectresources die aan hetzelfde poolitem hangen eerst op (`demandByPool`),
  in de gewone scan, bij onderbrekingen en in de conflictlijst (`check-leveler-pool-ledger.ts`, geval 3).
- Een taak die schuift en geen passend venster kreeg, boekt niet in het poolgrootboek: haar tekort blijft een tekort
  van dit document en duwt de andere documenten niet weg (`check-leveler-pool-ledger.ts`, geval 4). In haar eigen
  grootboek boekt ze wel, zodat het conflict zichtbaar blijft. Vaste last en vastgepinde taken boeken altijd in het
  poolgrootboek: ze staan er hoe dan ook.
- Bij vaste last binnen de scope en bij een vastgepinde taak toetst `levelResources` de poolrest vóór de boeking:
  na de boeking kan de rest op nul geklemd zijn. De controle na de lus neemt die dagen op in het tekort.
- Faalde elke afgewezen kandidaat van één scan alleen op het poolgrootboek, dan is de reden `RESIDUAL_FULL`: de
  eigen projectinzet had ruimte, en "onvoldoende capaciteit" wees de planner naar de verkeerde plek. `fits` houdt dat
  bij in `poolBlockedOnly`; de plaats van die reden in de volgorde staat in ADR 0164.
- `horizonIso` van het grootboek mag de zoekgrens van de scan verlengen: met vaste last van buiten dit document kan
  het eerste vrije venster verder liggen dan de eigen zoekgrens (ADR 0164).
