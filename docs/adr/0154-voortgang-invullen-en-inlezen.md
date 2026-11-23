# Voortgang invullen en inlezen

Voortgang komt in `taskSlice.ts` binnen via drie setters (`setTaskProgress`, `setActualStart`, `setActualFinish`), via
`enterTaskProgress` (paneel en contextmenu) en via het voortgangsblad (`applyProgressImport`). De eerste vier delen één
commit, `commitProgressEdit`. Wat een bewerking met de taak doet, beslist `planProgressEntry`
(`engine/progressEntry.ts`), die ook het concept in Taak bewerken plant (`state/taskDialogSave.ts`);
`commitProgressEdit` legt de uitkomst alleen vast. Zo staat de regel voor voortgang op één plek. De invoerregels van
`planProgressEntry` (statusdatum op vandaag, de vraag naar een werkelijke start) gelden alleen met `today`:
`enterTaskProgress` geeft het mee, de setters niet. De setters blijven zo het vangnet voor headless aanroepers.

## Gevolgen

- Voortgang op een samenvattingstaak wordt geweigerd vóór elke mutatie (`summaryTask`), want ze wordt afgeleid uit
  de bladtaken (`applyCpmResult`).
- Net als `updateTask` (ADR 0153) beslist de commit op de uitkomst na datumnormalisatie (`planStoredProgressEdit`), niet
  op de invoer. Het contextmenu toetst opvolgers op dezelfde uitkomst. Reden: een selectie kan taken bevatten die al op
  de gekozen waarde staan, en een slider of datumveld meldt dezelfde waarde soms nog eens. Een bewerking zonder
  wijziging maakt dan geen undo-stap en raakt de undo-samenvoeging niet, zodat een lopende slidersleep één stap
  blijft. Wanneer de commit geen wijziging ziet, staat in `planStoredProgressEdit`.
- Gaat de statusdatum op vandaag, dan gebeurt dat in dezelfde undo-stap als de voortgang; de melding
  `statusDateSetToday` volgt na de producer.
- We maken de planning bij een vastgelegde voortgangswijziging verouderd, ook zonder statusdatum, omdat voortgang
  de berekende datums van een taak raakt.
- Bij een commit en bij het voortgangsblad schuift het werk van de toewijzingen mee van rest naar verricht
  (`captureProgressWork` vóór de mutatie, `settleProgressWork` erna).
- `previewProgressImport` bouwt het plan tegen de huidige taken en verandert niets. `applyProgressImport` bouwt het
  plan opnieuw tegen de live taken binnen zijn eigen `set()` en hergebruikt het preview-plan niet, omdat de taken
  sinds de preview veranderd kunnen zijn. Het past het hele blad toe als één undo-stap. Wanneer het niets schrijft,
  staat in de functie; een botsing zonder keuze houdt het hele blad tegen (eigenaarsbesluit 2026-10-30, regel
  `import-export`).
- Met `today` (`ProgressImportEntryOptions`, de route van `ProgressImportDialog`) gelden voor het blad de regels van
  `progressImportDeps`, met dezelfde vraag naar een werkelijke start (`actualStartQuestionFor`) als bij invullen.
- Tests: `check-progress-entry.ts`, `check-progress-import.ts`.
