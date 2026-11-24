# Acties in één aanroep worden getoetst tegen een meegroeiende simulatie

`planner_manage_resources` en `planner_manage_assignments` voeren een lijst acties in volgorde uit, in één
transactie. De weigeringen worden vooraf bepaald (zie ADR 0100), maar de store ziet het effect van een actie pas als
de transactie loopt. Toetsen tegen de store zou elke actie beoordelen op de stand van vóór de aanroep. De classificatie
werkt daarom op een eigen kopie van de resources of toewijzingen die na elke goedgekeurde actie wordt bijgewerkt. Zo
toetst elke actie tegen de stand na de acties ervoor in dezelfde aanroep.

## Gevolgen

- Een resource die met `tempId` wordt aangemaakt, kan een volgende actie in dezelfde aanroep als `parentId` gebruiken;
  in een latere stap van `planner_batch` dient dezelfde `tempId` als `resourceId` (via `created`). Een resource die in
  dezelfde aanroep wordt aangemaakt, kan daarin niet worden verwijderd. Na een verwijdering wordt een latere
  verwijzing ernaar geweigerd.
- Een tweede identieke `add` in dezelfde aanroep botst op de controle op dubbele toewijzing
  (`validate.assignmentAllowed`) en wordt zacht geweigerd; zonder simulatie zou die controle de eerste nog niet zien.
  `move` en `remove` werken de simulatie ook bij, zodat "verplaats weg en wijs opnieuw toe" in één aanroep kan.
- Een `move` naar de taak waar de toewijzing (in de simulatie) al staat, wordt zacht geweigerd. Zonder die weigering
  zou `draft.moveAssignment` gooien en de hele aanroep terugrollen.
- `add` kan direct `remainingWorkMinutes` meegeven. In `planner_batch` heeft een nieuwe toewijzing nog geen
  `assignmentId` waar een latere stap naar kan verwijzen. Bij een `update` met zowel `unitsPerDay` als
  `remainingWorkMinutes` komt eerst de inzet en dan het werk: "deze inzet, dit werk", en de werkregel bepaalt wat er
  volgt.
- Toewijzingen groeien bij `planner_manage_resources` niet mee: die tool maakt zelf geen toewijzingen.
