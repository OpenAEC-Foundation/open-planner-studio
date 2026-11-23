# Verricht en resterend werk per toewijzing

Een toewijzing kan verricht werk (`actualWorkMinutes`) en restwerk (`remainingWorkMinutes`) dragen (spec taaktypes
§4.3). Ontbreekt het verrichte veld, dan leidt de app het af uit de verrichte duur maal de inzet. Die afleiding
verandert mee zodra de inzet of de duur verandert, en dan zou een bewerking het verleden herschrijven. We kozen ervoor
het verrichte werk vast te leggen op het moment dat een bewerking van de werkdriehoek het zou raken, en voortgang werk
te laten verplaatsen tussen rest en verricht. Dit wijkt af van spec §4.3, waar het verrichte veld niet door een
planningsbewerking geschreven wordt.

## Gevolgen

- `captureTriangle` legt vóór de mutatie het afgeleide verrichte werk vast van werkresources zonder verricht veld
  (`CapturedTriangle.actualWork`; welke bron telt, staat in de functie). `applyTriangleResult` schrijft die waarde in
  een ontbrekend verricht veld. Een werkresource die niet in de momentopname stond, op een taak met `completion` > 0 of
  een `actualStart`, krijgt in een ontbrekend verricht veld 0. Toetsen: `check-work-rule-actual-history.ts` en
  `check-work-rule-completed.ts`.
- Heeft een werkresource een verricht veld of vastgelegd verricht werk, dan schrijft `applyTriangleResult` ook het
  restwerk als de kern er geen gaf. `settleProgressWork` slaat een toewijzing zonder restveld over; zonder dat veld zou
  de volgende voortgangsboeking het paar niet bijwerken.
- Een taak met `completion` 1 en restduur 0 gaat bij een inzetwijziging (`settleUnitsEdit`) en een nieuwe resource
  (`settleAssignmentAdded`) door `settleCompletedWork`: dat legt het verrichte werk vast en schrijft de taakduur niet
  (`check-work-rule-completed.ts`).
- `settleProgressWork` verplaatst bij een voortgangsbewerking werk van rest naar verricht of terug, op toewijzingen met
  een restveld. Zonder die stap bleef het restveld staan terwijl de belasting het verrichte deel ook uit de voortgang
  afleidt, en telde het histogram dubbel (`docs/superpowers/plans/2026-09-24-fable-critreview-pr170.md`, bevinding over
  10 d, W 4800, 50 %). De poort, de verdeling bij heropenen na 100 % en de rekenregel staan in de functie; de contour
  blijft daarbij ongemoeid. Voor de voortgangsroutes in `taskSlice.ts` zie ADR 0154. Toets:
  `check-work-rule-actual-history.ts`.
- Zet de planner een eigen urenverdeling (`setAssignmentContour`), dan volgen de aanwezige werkvelden de contoursom
  (`syncAssignmentWorkToContour`, regel `contour`). Bleef het oude veld staan, dan rekende de volgende duurwijziging de
  inzet uit dat oude werk en zette `reconcileContourWork` de contour terug naar het oude getal. Heeft de nieuwe
  verdeling geen `actual`-periodes terwijl `actualWorkMinutes` groter is dan 0 (een eerste verdeling op een taak met
  geboekte voortgang), dan blijft het verrichte veld staan en volgt alleen de rest. Volgens het weggehaalde commentaar
  werd het verrichte werk anders 0 en verdubbelde Vast werk de restduur. Toets: `check-work-rule-store.ts`, gevallen v1
  tot en met v9.
