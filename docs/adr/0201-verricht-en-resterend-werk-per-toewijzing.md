# Verricht en resterend werk per toewijzing

Een toewijzing kan verricht werk (`actualWorkMinutes`) en restwerk (`remainingWorkMinutes`) dragen (spec taaktypes
§4.3). Ontbreekt het verrichte veld, dan leidt de app het af; welke bron daarbij telt, staat in `captureTriangle`. We
kozen ervoor dat afgeleide verrichte werk vast te leggen vóór een bewerking van de werkdriehoek, zodat zo'n bewerking
het niet met de nieuwe inzet of duur opnieuw afleidt. Dat wijkt af van spec §4.3, waar een planningsbewerking het
verrichte veld niet schrijft. Het vastleggen kwam in commit 31f710fcc ("Bewaar verricht resourcewerk vóór een
werkregelbewerking", in #581).

## Gevolgen

- `captureTriangle` legt de afgeleide waarde vast in `CapturedTriangle.actualWork`, voor toewijzingen die de duur
  sturen en geen `actualWorkMinutes` hebben. `applyTriangleResult` schrijft die waarde in een ontbrekend verricht veld.
  Een toewijzing die de duur stuurt, niet in de momentopname stond en op een taak met `completion` > 0 of een
  `actualStart` staat, krijgt in een ontbrekend verricht veld 0 als `opts.actualWork` geen waarde voor haar heeft.
  Toetsen: `check-work-rule-actual-history.ts` en `check-work-rule-completed.ts`.
- Stuurt een toewijzing de duur en heeft ze `actualWorkMinutes` of een waarde in de momentopname, dan schrijft
  `applyTriangleResult` ook `remainingWorkMinutes` als de kern er geen gaf. Reden: `settleProgressWork` slaat een
  toewijzing zonder restveld over, en zonder dat veld zou de volgende voortgangsboeking het paar niet bijwerken.
- Is bij de momentopname `completion` 1 en de restduur 0, en is na de bewerking elke inzet in de driehoek eindig en
  groter dan 0, dan gaan een inzetwijziging (`settleUnitsEdit`) en een nieuwe resource (`settleAssignmentAdded`) door
  `settleCompletedWork`. Die legt het verrichte werk uit de momentopname vast en
  schrijft de taakduur niet (`skipDuration`). Toets: `check-work-rule-completed.ts`.
- Bij een voortgangsbewerking herschrijft `settleProgressWork` het restveld en het verrichte veld van toewijzingen met
  een `remainingWorkMinutes`. Reden: zonder die stap bleef het restveld staan terwijl de belasting het verrichte deel uit
  de voortgang afleidt, en telde het histogram dubbel (`docs/superpowers/plans/2026-09-24-fable-critreview-pr170.md`,
  het voorbeeld met 10 d, W 4800 en 50 %). Wanneer de functie werkt en hoe ze rekent, staat in de functie; de contour
  raakt ze niet. Wat ze doet als de voortgang wordt teruggezet, staat als knownbug 2000. Voor de voortgangsroutes in
  `taskSlice.ts` zie ADR 0154. Toets: `check-work-rule-actual-history.ts`.
- Zet de planner een eigen urenverdeling (`setAssignmentContour`), dan schrijft `syncAssignmentWorkToContour` de
  aanwezige werkvelden naar de sommen van de contour (regel `contour`). Reden: bleef het oude restveld staan, dan
  rekende de volgende duurwijziging onder Vast werk de inzet uit dat oude werk en zette `reconcileContourWork` de
  contour terug naar het oude getal (`check-work-rule-store.ts`, gevallen v1 en v2). Heeft de nieuwe verdeling geen
  `actual`-periodes terwijl `actualWorkMinutes` groter is dan 0, dan laat de functie het verrichte veld staan en
  schrijft ze alleen een aanwezig restveld (gevallen v8 en v9).
