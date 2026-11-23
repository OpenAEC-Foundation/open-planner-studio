# Verhangen gebeurt eerst op een proefkopie

Een taak onder een andere ouder hangen kan een kring in de relaties maken zoals de solver ze uitvouwt, ook als de
boom zelf geen kring krijgt. Die kring zie je pas na de wijziging. Daarom zijn de vijf verhangacties in
`taskSlice.ts` (`moveTask`, `moveTaskTo`, `moveTasksTo`, `indentTasks`, `outdentTasks`) elk een `HierarchyEdit`: de boomwijziging als
functie op een takenlijst. `applyHierarchyEdit` draait die functie eerst op een kopie (`hierarchyChangeVerdict` in
`state/hierarchyChange.ts`) en pas daarna op de draft. Zo toetst de kringregel precies wat de actie gaat doen, en
weigert hij vóór er een undo-stap of mutatie is. Een geweigerde verhanging geeft een melding die de kring noemt
(`notifyHierarchyCycle`) en verandert niets.

## Gevolgen

- Wie vóór de actie moet weten of ze doorgaat, gebruikt dezelfde proef via `moveTaskVerdict`: Taak bewerken weigert
  zo vóór het opslaan, zodat de rest van de bewerking niet half doorgaat, en `planner_move_task` geeft een stapfout
  vóór de mutatie.
- `updateTask` werkt `childIds` niet bij. Taak bewerken verandert de ouder daarom met `moveTask` en niet in de patch
  van `updateTask` (`state/taskDialogSave.ts`).
- Ook de vraag over toewijzingen bij een nieuwe samenvattingstaak leest dezelfde boomwijziging (`hierarchyPhaseGains`,
  ADR 0152), zodat die vraag voor elke verhangroute klopt.
- `moveTask`, inspringen en uitspringen maken de planning verouderd. `moveTaskTo` en `moveTasksTo` doen dat alleen als
  een taak een andere ouder krijgt; een herordening binnen dezelfde ouder niet.
- `moveTaskTo` doet niets als de taak al op de doelplek staat: geen undo-stap en geen gewijzigd document.
- `moveTasksTo` verplaatst een selectie naar één doelplek. Een geselecteerde taak met een geselecteerde voorouder valt
  weg, want ze verhuist al met die voorouder mee. De groep komt neer in de weergavevolgorde, niet in de volgorde van
  aanklikken. Ligt de doelouder in de groep of onder een taak uit de groep, dan gebeurt er niets, ook niet voor de
  rest van de groep. De selectie blijft na het slepen dezelfde.
- Inspringen in een meervoudige selectie slaat geselecteerde voorgaande siblings over als kandidaat-ouder, zodat een
  aaneengesloten blok als geheel inspringt. Uitspringen werkt de diepste taken eerst af.
