# Resources over meerdere projecten (Haiku-leesagent, claude-haiku-5-5, main d233d578c; kernpunten door orkestrator nagelezen)
- "Verdelen over projecten" heeft op main GEEN UI (docs/TODO.md:40, B1c); computeDistribution (distribute.ts:293) en applyDistribution
  (librarySlice.ts:1315) hebben alleen tests als aanroeper.
- Nivelleren (LevelingDialog) = alleen het actieve document, al in een worker (backgroundLeveling.ts:34).
- Bezettingsoverzicht (ResourceOccupancyView) is de enige werkende functie over meerdere projecten: rekent SYNCHROON in een useMemo in
  de render (ResourceOccupancyView.tsx:230-309), per verouderd slapend document een solveClone na elkaar (occupancy.ts:248, :265-271);
  geen cache op de belasting; herberekent bij elke wijziging van `documents`. Gemeten (commentaar :241): 700 ms–2,6 s per 3000 taken.
  Met auto-calc aan: recalculateStaleSleepingDocuments in een useEffect (:220-228), serieel.
- Per project onafhankelijk ⇒ parallel mogelijk: bezetting (samenvoegen = optellen, occupancy.ts:311-312).
- NIET onafhankelijk: verdelen. Projecten boeken in rangorde in een gedeeld grootboek (placedByItem, distribute.ts:366, :446-493;
  closures in makeLedgerForDoc :385-398). Alleen de CPM-solve per project (distribute.ts:160) kan parallel; plaatsen blijft na elkaar.
- Tests: tests/library/check-occupancy, check-distribute, check-showcase-occupancy, check-apply-distribution; browser: leveling-background.spec.
