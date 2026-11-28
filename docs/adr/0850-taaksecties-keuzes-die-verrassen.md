# Taaksecties: keuzes die verrassen

De secties in `src/components/task-sections/` vullen het eigenschappenpaneel en *Taak bewerken*. Een paar keuzes erin
zou een collega zonder uitleg terugdraaien, omdat de eenvoudiger vorm hetzelfde lijkt te doen. Het gemeenschappelijke
besluit: een klik, een bewerking of een melding gaat niet verloren of naar de verkeerde taak, en de sectie blijft
bruikbaar op een groot project.

## Gevolgen

- *Verplaats naar…* in `TaskAssignmentsSection` bouwt zijn opties pas bij focus of `pointerdown` op de knop
  (`MoveToSelect`, want `Select` heeft geen open-event; het menu staat in een portal, maar React laat zijn
  events door de omhulling bubbelen). Per render vraagt de sectie alleen of er een kandidaat is, via de index van
  `moveCandidates.ts`. Op `rehab-2.xer` (6.978 taken, 52.640 toewijzingen) kostte de oude regel per rij 47 s per
  selectie; met de index en de lijst bij elke render daarna nog 189 ms, lui 120 tot 131 ms (metingen 2026-10-07 en
  2026-10-17). `move-assignment-lazy.spec.ts` toetst dat er vóór focus geen optie gebouwd is.
- In `TaskDependenciesSection` wacht de uitlegzin bij een focuswissel met de muis tot de knop is losgelaten. De zin
  schuift de regels eronder; verschijnt hij tussen indrukken en loslaten, dan landt het loslaten naast de knop en gaat
  de klik verloren (#888).
- Dezelfde sectie wist de tooltip bij elke wissel van taak of relaties, en de conceptrij ook bij een documentwissel. De
  tooltip hangt in een portal en bleef anders na Ctrl+Z, een pijltoets of een selectie door de AI-assistent zweven, ook
  boven dialogen. Een concept zou bij bevestigen op de nieuwe taak landen, en een variant draagt dezelfde taak-id's,
  zodat het in het andere document landde.
- Werd bij het vastleggen een deel van de relaties toegevoegd en een deel geweigerd, dan gaat de focus naar de
  bevestigknop: in het zoekveld zou Ctrl+Z alleen
  de getypte tekst terugdraaien, omdat een tekstveld zijn eigen undo houdt.
- `TaskDurationField` telt elke doorgegeven wijziging (`commitTick`) en zet het veld daarop terug naar de echte duur.
  Weigert de store de wijziging, dan verandert de duur niet en bleef zonder die teller het getypte getal staan.
- Het i-icoon bij *Duur* toont bij hover zijn tooltip na het terugkomen van de eenheidsbediening pas na een echte muisbeweging of
  een leave.
- Het i-icoon bij *Werkregel* heeft een vaste hoogte (`h-9`, de hoogte van de trigger).
- `TaskRecordedDatesNotice` en de uitleg in `TaskWorkRuleField` zetten elke zin op een eigen regel in plaats van ze met
  een spatie te verbinden: een spatie tussen zinnen hangt af van de taal (zh en ja kennen hem niet).
