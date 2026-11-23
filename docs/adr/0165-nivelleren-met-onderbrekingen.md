# Nivelleren met onderbrekingen

Met *Onderbrekingen toestaan* (`allowSplits`, in MS Project *Leveling can create splits in remaining work*) mag de
nivelleerder pauzedagen in een taak zetten. Dat is een terugval: `findSlot` probeert eerst een aaneengesloten
venster en zoekt pas daarna een onderbroken plaatsing (`scatterSlot`). Een taak komt ervoor in aanmerking als
`splitEligible` waar is (`allowSplits`, `durationType === 'WORKTIME'`, `completion === 0` en geen gat met
`source: 'user'`) en haar kalender werkblokken heeft (`isHourMode`). Een taak met de urenmaat hoort erbij
(eigenaarsbesluit 2026-08-31, `check-leveler-splitmode.ts`, geval 3b); een lopende taak en een kalendertijdtaak niet
(geval 3), want het gaat om resterend werk en kalendertijd kent geen werkdag. Een taak die de planner zelf heeft
onderbroken, schuift alleen als geheel (issue #146, geval 5): de onderbroken plaatsing kent de bestaande gaten niet
en zou haar gaten bovenop die indeling leggen. Een importsplit (gat zonder `source`) is brondata van een ander
programma en houdt dat niet tegen; hij blijft naast het nieuwe gat staan (geval 4).

## Gevolgen

- `scatterSlot` werkt van links naar rechts vanaf de eerste kandidaat, zonder zoektocht over andere startstanden.
  Bij de eerste dag die niet past, krijgt de taak één pauze van een hele werkdag op haar split-as
  (`PlacementDay.dayAxisMinutes`), en de hele kandidaat wordt opnieuw berekend met de gedeelde plaatsing. Valt die
  dag vóór het eerste werk, dan is dat uitstel naar de volgende kandidaat en geen gat aan het begin. Een pauze direct
  na een eerdere nivelleerpauze verlengt die; een importsplit blijft een eigen gat.
- Het venster bindt hier het einde, niet de start (`finishWindowLimit`: de late finish uit de eigen basis, met
  smoothing of plafond zoals in ADR 0164). Met pauzes schuift de start nauwelijks, maar het einde wel, en het plafond
  gaat over de einddatum. Ook deze scan stopt na `scanLimit` stappen, verlengd door `horizonIso` en hoogstens
  `HARD_SCAN_CAP`; loopt hij daar leeg, dan meldt hij de uitputting (ADR 0164).
- De nieuwe gaten staan op de werkkopie vóór de boeking en vóór de proefsolve, met `markChanged` en een gewiste
  vraagcache voor die taak; anders boekt de nivelleerder de oude vraag en belooft het voorstel een einddatum die
  toepassen niet haalt. `LevelingResult.gaps` draagt de hele te schrijven `splitGaps`, met de bestaande
  importsplits erbij; zonder `allowSplits` is het leeg.
- `dayFits` toetst per dag de projectinzet en het poolgrootboek, zonder `poolBlockedOnly` te raken: die vlag
  beschrijft de aaneengesloten scan.
