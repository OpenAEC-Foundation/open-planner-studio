# Taken toevoegen, invoegen en verwijderen

Een nieuwe taak ontstaat op meer plekken dan `addTask` in `taskSlice.ts`: de MCP-draft (`draft.addTask` in
`createMcpTransactions.ts`), het taakraster en de Gantt bouwen haar ook. Ze delen de afleiding van de velden
(`buildNewTask` in `utils/taskDefaults.ts`, ook de overerving van het taaktype van de ouder) en van de maat
(`newTaskTimeUnit` en `settleNewTaskMeasure` in `state/newTaskMeasure.ts`), zodat een nieuwe taak overal dezelfde is.
`addTask` en `insertWbsTemplate` voegen er de plaatsing, de WBS-code en de vraag bij een nieuwe samenvattingstaak
(ADR 0152) aan toe.

## Gevolgen

- `addTask` maakt de tijd in de standaardmaat voor nieuwe taken; `settleNewTaskMeasure` maakt haar urenmaat onder
  vast werk of een vaste urenmaat. De berekening schrijft `scheduleFinish` niet terug, dus een nieuwe urentaak krijgt
  haar ingevoerde einde bij het toevoegen (`seedNewHourTaskFinish`). Werd de taak pas daar urenmaat, dan hoorde een
  meegegeven einde bij de dagenmaat en wordt het einde opnieuw afgeleid.
- Een gezette werkregel bij `addTask` ontsluit de werkregels in de interface (`taskTypesVisible`).
- WBS-codes van ingevoegde taken komen uit `assignInsertedWbsCodes`. `addTask` roept die alleen aan met
  WBS-autonummering of als de aanroeper geen `wbsCode` meegaf.
- `insertWbsTemplate` neemt de duur van het sjabloon letterlijk over in dagen (`durationDays`), niet in de
  standaardmaat voor nieuwe taken: het sjabloon draagt expliciet een aantal dagen. Een sjabloon komt uit
  `localStorage` (`utils/wbsTemplates.ts`) en kan, net als een tak uit het klembord, relaties dragen die de
  relatieregels weigeren; die gaan door `insertRemappedRelations` en worden gemeld. Na het invoegen is de nieuwe
  wortel geselecteerd.
- `deleteTask` en `deleteTasksBulk` halen de taken met hun subbomen weg in één undo-stap. Pas na de nieuwe rijen
  (`recomputeViewRows`) kiezen ze een buur als selectie (`selectNeighbourAfterRemoval`), want die buur moet zichtbaar
  zijn (issue #899, `task-grid-selection-keep.spec.ts`).
- Verwijderen met alleen onbekende ids geeft geen undo-stap.
