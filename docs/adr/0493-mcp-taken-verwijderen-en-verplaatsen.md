# Taken verwijderen en verplaatsen via MCP

`planner_delete_tasks` verwijdert elke gevraagde taak met haar hele subboom, haar relaties en haar toewijzingen
(`draft.deleteTask`). Eén verzameltaak kan zo veel taken meenemen die de aanroeper niet noemde. Het antwoord geeft
daarom het hele verschil tussen vóór en na de aanroep, en niet alleen de gevraagde id's. `planner_move_task`
weigert vooraf wat de draft of de eindberekening anders pas later en minder precies zou weigeren.

## Gevolgen

- `deleteTasksCore` meet `deletedTaskIds` (de taken die vóór de aanroep bestonden en erna niet meer),
  `cascadedTaskIds` (daarvan de niet gevraagde) en de aantallen verdwenen relaties en toewijzingen. Een gevraagd id dat
  vóór de aanroep bestond maar bij zijn beurt al weg is, door de subboom van een eerder id of omdat het twee keer in
  `ids` staat, telt als `deleted`, één keer; alleen een id dat nooit bestond, is een zachte weigering. Toetsen:
  `cases-stille-noops-taken.ts`, de gevallen M1.
- `moveTaskCore` toetst vooraf, met een eigen foutcode in een `McpStepError`: een onbekende taak of ouder is
  `NOT_FOUND`, een plek onder de taak zelf of onder een eigen afstammeling `VALIDATION`. Die laatste toets loopt met
  `ancestorIds` en blijft daardoor ook bij een kring in de `parentId`'s elders in de boom niet hangen. Toets:
  `cases-mutate-tasks.ts`, "move_task: een corrupte parentId-cyclus elders in de boom laat de guard niet hangen".
- Daarna dezelfde toets als de app (`moveTaskVerdict`): een relatie op een fase geldt voor elke taak erin, dus
  verhangen kan een kring maken. Die geeft `CYCLE` met de kring en zonder verplaatsing. Zonder deze toets zou pas de
  eindberekening falen, met de tekst van de solver, en in een batch zonder de stap te noemen. Toetsen:
  `cases-summary-cycle.ts`, de gevallen met `move_task`.
- `position` moet een geheel getal zijn (`parseMoveTask`, ook in een batch). Een getal buiten het bereik klemt stil
  naar de eerste of de laatste plek tussen de broers, zoals bij de store (`reparentTask`). Toetsen:
  `cases-stille-noops-taken.ts`, de gevallen L3, en `cases-movetask.ts` voor de klem van de store.
- Wordt een bestaande relatie door de verplaatsing een relatie met een eigen voorouder, dan meldt de tool dat zoals de
  store-actie `moveTask`, met `watchAncestorRelations`. Rolt de transactie terug, dan verdwijnt die melding mee
  (ADR 0240). Toets: `cases-structural-transition.ts`, "move_task via draft.moveTask houdt de relatiemelding …".
  Krijgt de nieuwe ouder haar eerste kind, dan staat een verhuisde toewijzing in `phaseTransitions` en niet als
  melding in de app (ADR 0242).
