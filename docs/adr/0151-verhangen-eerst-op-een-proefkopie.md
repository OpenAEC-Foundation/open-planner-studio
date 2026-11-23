# Verhangen gebeurt eerst op een proefkopie

Een taak onder een andere ouder hangen kan een kring in de relaties maken zoals de solver ze uitvouwt, ook als de
boom zelf geen kring krijgt. Die kring zie je pas na de wijziging. Daarom zijn de vijf verhangacties in
`taskSlice.ts` (`moveTask`, `moveTaskTo`, `moveTasksTo`, `indentTasks`, `outdentTasks`) elk een `HierarchyEdit`: de
boomwijziging als functie op een takenlijst. `applyHierarchyEdit` draait die functie eerst op een kopie
(`hierarchyChangeVerdict` in `state/hierarchyChange.ts`) en pas daarna op de draft. Zo toetst de kringregel dezelfde
functie die de actie uitvoert, en weigert hij vóór er een undo-stap of mutatie is, met een melding die de kring noemt
(`notifyHierarchyCycle`).

## Gevolgen

- Wie vóór de actie moet weten of ze doorgaat, gebruikt dezelfde proef via `moveTaskVerdict`: Taak bewerken weigert
  zo vóór het opslaan, zodat de rest van de bewerking niet half doorgaat, en `planner_move_task` geeft een stapfout
  vóór de mutatie.
- `updateTask` werkt `childIds` niet bij. Taak bewerken verandert de ouder daarom met `moveTask` en niet in de patch
  van `updateTask` (`state/taskDialogSave.ts`).
- De vraag over toewijzingen bij een nieuwe samenvattingstaak leest dezelfde `HierarchyEdit` (`hierarchyPhaseGains`,
  ADR 0152), zodat vraag en actie over dezelfde boomwijziging gaan.
- `moveTask`, inspringen en uitspringen maken de planning verouderd. `moveTaskTo` en `moveTasksTo` doen dat alleen als
  een taak een andere ouder krijgt, omdat een herordening binnen dezelfde ouder geen samenvattingstaak verandert.
- Slepen naar de eigen plek is geen handeling: `moveTaskTo` vraagt `planTaskPlacement` om een plek die verschilt van de
  huidige (`rejectNoOp`).
- `moveTasksTo` laat een geselecteerde taak met een geselecteerde voorouder weg, want die verhuist al met haar
  voorouder mee. De groep wordt op `flattenOrder` gesorteerd en niet op de volgorde van aanklikken; die volgorde kan
  afwijken van de zichtbare (knownbug 1981). Ligt de doelouder in de groep of onder een taak uit de groep, dan gebeurt
  er niets, ook niet voor de rest van de groep. De selectie blijft na het slepen dezelfde.
- In `moveTasksTo` landt elke taak achter de vorige taak van de groep. Een taak die al op haar plek staat, wordt niet
  verplaatst maar telt wel als die vorige taak. Daarom vraagt `moveTasksTo` het plan zonder `rejectNoOp` en toetst hij
  zelf of een taak al goed staat: met `rejectNoOp` kwam er voor zo'n taak geen plan en landde de volgende op de
  verkeerde plek.
- Inspringen in een meervoudige selectie slaat geselecteerde voorgaande siblings over als kandidaat-ouder, zodat een
  aaneengesloten blok als geheel inspringt. Uitspringen doorloopt de selectie in omgekeerde `flattenOrder`: een geselecteerd
  kind komt zo vóór zijn geselecteerde ouder aan de beurt, zodat de ouder het niet al meeneemt vóór zijn eigen beurt.
  Waar het kind daarna eindigt, hangt af van wat er verder geselecteerd is (`outdentEdit`).
