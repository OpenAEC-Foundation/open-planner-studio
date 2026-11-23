# Voortgang invullen en inlezen

Voortgang komt in `taskSlice.ts` binnen via drie setters (`setTaskProgress`, `setActualStart`, `setActualFinish`), via
`enterTaskProgress` (paneel en contextmenu) en via het voortgangsblad (`applyProgressImport`). De vier eerste delen
één commit, `commitProgressEdit`. Wat een bewerking met de taak doet, beslist `planProgressEntry`
(`engine/progressEntry.ts`), dezelfde functie die ook het concept in Taak bewerken gebruikt; `commitProgressEdit` legt
de uitkomst alleen vast. Zo heeft voortgang één regel, welke route de planner ook neemt. De invoerregels van
`planProgressEntry` (statusdatum op vandaag, de vraag naar een werkelijke start) gelden alleen met `today`, dus alleen
op UI-routes; de setters blijven het vangnet voor headless aanroepers.

## Gevolgen

- Voortgang op een samenvattingstaak wordt geweigerd vóór elke mutatie (`summaryTask`), want ze wordt afgeleid uit
  de bladtaken (`applyCpmResult`). Een onbekende taak is een stille no-op.
- Net als `updateTask` (ADR 0153) beslist de commit op de uitkomst na datumnormalisatie (`planStoredProgressEdit`): een
  bewerking die de taak niet verandert en de statusdatum niet op vandaag zet, maakt geen undo-stap, maakt het
  document niet gewijzigd, wist geen nivelleergaten en maakt de planning niet verouderd. Het contextmenu toetst
  opvolgers op dezelfde uitkomst (`planStoredProgressEdit`) en zet voortgang op de hele selectie, ook op taken die al
  op die waarde staan, en een slider of datumveld meldt dezelfde waarde soms nog eens. Een 50%-taak zonder
  werkelijke start opnieuw op 50% zetten vult die start in, en dat is wel een wijziging. Een no-op raakt de
  undo-samenvoeging niet, dus een lopende slidersleep blijft één stap.
- Gaat de statusdatum op vandaag, dan gebeurt dat in dezelfde undo-stap als de voortgang, en de melding
  `statusDateSetToday` volgt na de producer.
- Een echte voortgangswijziging maakt de planning altijd verouderd, met of zonder statusdatum.
- Het restwerk van de toewijzingen schuift mee van rest naar verricht (`captureProgressWork` op de ongewijzigde taak,
  `settleProgressWork` na de mutatie), ook bij het voortgangsblad.
- Het voortgangsblad: `previewProgressImport` bouwt het plan tegen de huidige taken en verandert niets.
  `applyProgressImport` bouwt hetzelfde plan opnieuw tegen de live taken binnen zijn eigen `set()` en hergebruikt het
  preview-plan niet. Het past het hele blad toe als één undo-stap, en schrijft niets als er niets toe te passen is of
  als een botsing geen keuze heeft (eigenaarsbesluit 2026-10-30, regel `import-export`).
- Met `today` (`ProgressImportEntryOptions`, de route van `ProgressImportDialog`) plant het blad zonder statusdatum met
  vandaag, gaat de statusdatum op vandaag als een toegepaste rij voortgang overhoudt, en weigert een rij met
  `actualStartRequired` als ze de werkelijke start zou afleiden uit een geplande start na de statusdatum
  (`actualStartQuestionFor`).
- Tests: `check-progress-entry.ts`, `check-progress-import.ts`.
