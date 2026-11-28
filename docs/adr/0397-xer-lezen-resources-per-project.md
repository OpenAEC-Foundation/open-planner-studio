# XER lezen: resources en toewijzingen per project

`buildXerResourceCatalog` leest de resources één keer voor het hele bestand. `materializeXerResources`
(`xerResources.ts`) maakt per project een eigen, wijzigbare kopie van de resources (`structuredClone`), en de
catalogus en de TASKRSRC-rijen blijven één keer gelezen, bevroren brondata. Reden: zo
ontstaat er per project geen kopie van elke toewijzingsrij; `rehab-2.xer` heeft 52.640 toewijzingen
(`docs/superpowers/plans/2026-10-07-perf-grote-planningen.md`). Hoe de lezer een toewijzing leest, staat in
`xerResourceAssignments.ts`; het verschil met de P6 XML-lezer in ADR 0269.

## Gevolgen

- `readXerProject` geeft de afleiding van de werkvelden per activiteit de geplande werkminuten (`taskWorkMinutes` in
  `contourEngine.ts`): een taak in de urenmaat haar `durationMinutes`; een taak in de dagenmaat, alleen uit een eigen
  export, het dagengetal maal de werktijd per dag van haar kalender (`effHoursPerDay`), zoals de werkregelbrug
  (T14 in de spec alleen-uren).
- Voor materiaal op een taak in de urenmaat rekent `xerResourceAssignments.ts` het tempo per uur om naar een tempo
  per dag met de werktijd per dag van de kalender van de taak (`hourTaskHoursPerDay`: `effHoursPerDay` van de
  kalender van `clndr_id`, anders van de projectkalender), dezelfde kalender als voor het dagengetal (ADR 0394), zodat
  het tempo per dag maal het dagengetal dezelfde hoeveelheid materiaal geeft als het brontempo per uur maal de
  werkuren. Een taak zonder die waarde rekent met de uren per dag van de kalender van de
  resource, anders van de projectkalender.
