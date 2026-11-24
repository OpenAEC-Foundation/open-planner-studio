# Taken in bulk aanmaken via de draft: vier controles vooraf, dan van boven naar beneden

`planner_add_tasks` maakt via `draft.addTasks` een geneste takenboom in één aanroep. Een item wijst zijn ouder aan met
een bestaand taak-id of met de `tempId` van een ander item, en het antwoord geeft per `tempId` het echte id (`created`).
Vóór de eerste `draft.addTask` weigert `draft.addTasks` vier gevallen: een dubbele `tempId`, een ouder die geen bestaand
id en geen `tempId` is, een mijlpaal met een meegegeven `time.scheduleDuration` boven 0, en een kring in de
`tempId`-ouders. Zo noemt de fout het item dat haar veroorzaakt. Andere weigeringen komen pas na het aanmaken; ook dan
draait `run` alles terug (ADR 0240). De items worden aangemaakt met ouders vóór kinderen, zodat de volgorde van de
invoer vrij is.

## Gevolgen

- `position` klemt stil en is geen fout; de schemabeschrijving van `planner_add_tasks` (`taskTools.ts`, "clamped") leunt
  daarop. De posities gelden na het aanmaken, in de volgorde van de invoer, op de plekken van ADR 0150.
- Een bestaande taak die in de aanroep haar eerste kinderen krijgt, gaat pas na het aanmaken en de posities door
  `planPhaseTransitions` (`state/structuralTransition.ts`), want die kiest de eerste geschikte bladtaak in de
  eindvolgorde. De draft stelt de vraag van ADR 0152 niet en neemt de standaardkeuze `'move'`. Een weigering daar gooit;
  het verslag van een geslaagde overgang gaat via `phaseReport` naar het antwoord (`phaseTransitions`), niet als melding
  in de app. `draft.moveTask` gebruikt dezelfde regel voor de nieuwe ouder. Toetsen in `cases-structural-transition.ts`:
  "add_tasks met parentId …" (een mijlpaal en een gewone taak onder een taak met een toewijzing; de toewijzing gaat naar
  de gewone taak en het antwoord noemt dat) en "add_tasks met alleen een mijlpaal …" (de aanroep faalt met `VALIDATION`
  en er is niets gewijzigd).
