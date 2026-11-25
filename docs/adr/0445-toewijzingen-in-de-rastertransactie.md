# Toewijzingen in de rastertransactie

Een write in een toewijzingskolom van het raster (`assignment.resources`, `assignment.unitsPerDay`,
`assignment.curve`, `assignment.remainingWork`) komt als `assignment-set` binnen en gaat door `applyAssignmentSet` in
`src/state/gridTransaction.ts`. Die plant de nieuwe set met `planTaskAssignmentSet`, past hem toe met
`applyTaskAssignmentPlan` en laat daarna de werkregelbrug inzet, werk en duur laten kloppen (`settleAssignmentPlan`,
regel `taaktypes`). We kozen ervoor dat een kolom voor één eigenschap alleen die eigenschap verandert: de andere
eigenschappen van elke toewijzing komen uit de huidige toewijzing en niet uit de geplakte tekst.

## Gevolgen

- Een andere kolom geeft `plannerNotAvailable`. In de kolommen voor inzet, curve en resterend werk moet de set
  resources gelijk zijn aan die van de taak, anders `readOnly`. Het bedrag van een kostentoewijzing (#815) hoort bij
  geen van die kolommen en blijft staan.
- `applyTaskAssignmentPlan` muteert de toewijzingsobjecten van de kopie. Daarom legt `applyAssignmentSet` vóór die
  stap vast wat de brug nodig heeft: de momentopname van de driehoek (`captureTriangle`, met `finishBasis`), het werk
  van de taak en de oude inzet per toewijzing. Een inzetstap geeft het alleen door als de inzet echt veranderde.
- In de kolom *Resterend werk* volgt per toewijzing een werkbewerking door de driehoek (`settleWorkEdit`). De
  transactie vergelijkt met wat de cel toonde: het opgeslagen restwerk, anders de restduur maal de inzet
  (`remainingMinutesOf`). Een verschil van minder dan een minuut, of een waarde die niet eindig of niet groter dan nul
  is, slaat ze over. Reden: een toewijzing die de planner niet aanraakte, krijgt anders haar afgeleide getal als
  vastgelegd werk. `check-work-rule-store.ts` (o2 en o3) toetst dat een toewijzing op haar getoonde waarde geen eigen
  restwerk krijgt. Een uitgevoerde werkbewerking zet `taskTypesVisible`.
- Verandert de duur door de toewijzingen, dan volgt dezelfde nazorg als bij een duurbewerking
  (`settleDurationAftermath`, met het werk en de `finishBasis` van vóór het plan) en `markDateMutation`.
- Na alle writes valideert de transactie de uiteindelijke toewijzingen nog eens met `planTaskAssignmentSet`, voor elke
  taak die toewijzingen heeft en een toewijzingswrite of een write in `task.isMilestone` kreeg. Een mijlpaalcel kan
  bestaande toewijzingen ongeldig maken; een fout weigert de hele transactie.
