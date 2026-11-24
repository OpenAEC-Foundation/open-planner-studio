# Taken in bulk aanmaken via de draft: eerst alles toetsen, dan van boven naar beneden

`planner_add_tasks` maakt een geneste takenboom in één aanroep (`draft.addTasks` in `createMcpTransactions.ts`). Een
item verwijst naar zijn ouder met een bestaand taak-id of met de `tempId` van een ander item in dezelfde aanroep, en
het antwoord geeft voor elk item de `tempId` met het echte id. Alles wat de hele aanroep zou laten mislukken, toetst
`draft.addTasks` vóór de eerste `draft.addTask`: een dubbele `tempId`, een ouder die geen bestaand id en geen `tempId`
is, een mijlpaal met een meegegeven `time.scheduleDuration` boven 0, en een kring in de `tempId`-ouders. De
transactie zou een latere fout ook terugdraaien (ADR 0240), maar zo noemt de fout het item dat hem veroorzaakt.
Daarna worden de items in een topologische volgorde aangemaakt, ouders vóór kinderen, zodat de volgorde van de invoer
vrij is.

## Gevolgen

- `position` is de plek tussen de broers en zussen. Een waarde buiten bereik wordt stil geklemd: negatief wordt 0,
  te groot wordt achteraan. De beschrijving in het schema van `planner_add_tasks` (`taskTools.ts`, "clamped") leunt
  daarop. De posities worden na het aanmaken toegepast, in de volgorde van de invoer. Onder een ouder werken ze zowel
  `childIds` als de volgorde van de rauwe takenlijst bij, op het hoogste niveau de rauwe lijst (ADR 0150).
- Een bestaande taak die vóór de aanroep geen kinderen had en ze nu krijgt, loopt door de gedeelde regel
  `planPhaseTransitions` (`state/structuralTransition.ts`, ADR 0152). Dat gebeurt pas na het aanmaken en de posities, want de
  regel kiest de eerste nieuwe subtaak in de eindvolgorde. De MCP-draft stelt de vraag van ADR 0152 niet: hij roept
  `planPhaseTransitions` aan met de standaardkeuze `'move'`. Een weigering gooit en draait de aanroep terug. Wat er
  verplaatst is, gaat niet als melding naar de app maar via `phaseReport` naar het antwoord (`phaseTransitions`).
  `draft.moveTask` (`planner_move_task`) toetst met dezelfde regel vóór het verhangen, voert de overgang daarna
  uit en geeft het verslag als terugkeerwaarde.
