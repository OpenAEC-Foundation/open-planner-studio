# Nivelleren met het gedeelde poolgrootboek

Een resource die uit de resourcebibliotheek komt, deelt haar capaciteit met andere documenten. De nivelleerder
toetst daarom met twee grootboeken: zijn eigen grootboek per resource tegen de projectinzet, en het grootboek van
het poolitem waaraan de resource hangt (`LevelingPoolLedger`). Een kandidaat past alleen als beide toetsen slagen
(`fits`, `dayFits`; `check-leveler-pool-ledger.ts`, geval 1 en 2). Het poolgrootboek komt van de aanroeper, de
verdeler (`computeDistribution` in `src/services/library/distribute.ts`), en niet uit de motor: het is gedeeld over
documenten, en de motor draait per document. Het is ingespoten op dezelfde manier als `OccupancyEphemeralSolve` in
`occupancy.ts`. Zonder grootboek geldt alleen de toets per resource. Ontwerp:
`docs/superpowers/specs/2026-08-17-b1c-nivelleren-restcapaciteit-design.md`.

## Gevolgen

- De pooltoets telt de vraag van alle projectresources die aan hetzelfde poolitem hangen eerst op (`demandByPool`;
  `check-leveler-pool-ledger.ts`, geval 3).
- Een taak die schuift en geen passend venster kreeg, boekt niet in het poolgrootboek, zodat haar tekort geen
  poolcapaciteit inneemt die de verdeler aan andere documenten toerekent (`check-leveler-pool-ledger.ts`, geval 4). In
  haar eigen grootboek boekt ze wel, zodat het conflict in dit document zichtbaar blijft. Vaste last en pins boeken
  in het poolgrootboek, omdat ze niet schuiven.
- Bij vaste last binnen de scope en bij een pin toetst `levelResources` de poolrest vóór de boeking, omdat de rest na
  de boeking op nul geklemd kan zijn.
- `poolBlockedOnly` onthoudt of elke afgewezen kandidaat van één scan alleen op het poolgrootboek faalde. `reasonFor`
  gebruikt dat voor `RESIDUAL_FULL`, omdat "onvoldoende capaciteit" de planner dan naar zijn eigen projectinzet wijst.
  Wanneer die reden het wint van een andere, staat in `reasonFor` (ADR 0164, knownbug 1984).
- `horizonIso` van het grootboek mag de zoekgrens van de scan verlengen, omdat vaste last van buiten dit document het
  eerste vrije venster verder kan leggen dan de eigen zoekgrens (ADR 0164).
