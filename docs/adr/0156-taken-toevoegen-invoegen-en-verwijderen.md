# Taken toevoegen, invoegen en verwijderen

Een nieuwe taak ontstaat op meer plekken dan `addTask` in `taskSlice.ts`: de MCP-draft (`draft.addTask` in
`createMcpTransactions.ts`), het taakraster en de Gantt bouwen haar ook. Ze leiden de velden af met `buildNewTask`
(`utils/taskDefaults.ts`, met de overerving van het taaktype van de ouder) en de maat met `newTaskTimeUnit` en
`settleNewTaskMeasure` (`state/newTaskMeasure.ts`), zodat die afleiding op één plek staat. Wanneer een nieuwe taak
urenmaat wordt, staat in `settleNewTaskMeasure`. `addTask` en `insertWbsTemplate` voegen er de plaatsing, de WBS-code
en de vraag bij een nieuwe samenvattingstaak (ADR 0152) aan toe.

## Gevolgen

- `applyCpmResult` schrijft `scheduleFinish` niet terug, dus `addTask` geeft een nieuwe urentaak haar ingevoerde einde
  (`seedNewHourTaskFinish`). Maakte `settleNewTaskMeasure` de taak urenmaat, dan hoorde een meegegeven einde bij de
  dagenmaat en leidt `addTask` het einde opnieuw af.
- WBS-codes van ingevoegde taken komen uit `assignInsertedWbsCodes`. `addTask` roept die aan met WBS-autonummering of
  als de aanroeper geen `wbsCode` meegaf.
- `insertWbsTemplate` neemt de duur van het sjabloon als dagen over (`durationDays`), niet in de standaardmaat voor
  nieuwe taken, want het sjabloon draagt expliciet een aantal dagen. Een sjabloon komt uit `localStorage`
  (`utils/wbsTemplates.ts`) en kan relaties dragen die de relatieregels weigeren; die gaan door
  `insertRemappedRelations`, net als een tak uit het klembord.
- `deleteTask` en `deleteTasksBulk` kiezen pas na de nieuwe rijen (`recomputeViewRows`) een buur als selectie
  (`selectNeighbourAfterRemoval`), want die buur moet zichtbaar zijn (issue #899, `task-grid-selection-keep.spec.ts`).
