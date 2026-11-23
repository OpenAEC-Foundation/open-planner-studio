# De vraag bij een nieuwe samenvattingstaak

Een samenvattingstaak draagt zelf geen toewijzingen. Krijgt een taak met toewijzingen door een structuurhandeling haar
eerste kinderen, dan vraagt de app eerst wat ermee moet, in het venster *Taak wordt een samenvattingstaak*
(eigenaarsbesluit 2026-10-17, "altijd vragen"). Wat de planner ziet en kiest, staat in de gids
`howto-structuur-aanpassen`; de regels zelf in `state/structuralTransition.ts`. In `taskSlice.ts` is de standaard
daarom `'ask'` (`PhaseAssignmentOptions.phaseAssignments`). Zolang de vraag openstaat, doet de handeling nog niets:
`addTask` geeft `''` terug en `insertWbsTemplate` `null`. Het antwoord (`answerPhaseAssignmentQuestion`) voert dezelfde
handeling opnieuw uit met de keuze, als één undo-stap. We kozen voor opnieuw uitvoeren in plaats van een half
uitgevoerde handeling bewaren, omdat de handeling dan maar één weg heeft, met of zonder vraag.

## Gevolgen

- De verhangacties stellen de vraag na de kringtoets (ADR 0151); zij, `addTask` en `insertWbsTemplate` stellen haar
  vóór de undo-stap. Draagt geen nieuwe samenvattingstaak een toewijzing, dan wordt er niets gevraagd.
- Een aanroeper zonder venster geeft `'move'` mee: de extensie-API doet dat bij toevoegen en verhangen
  (`extensions/extensionApi.ts`). Kan verplaatsen niet schoon, bijvoorbeeld omdat de nieuwe taak een mijlpaal is, dan
  weigert de hele handeling met een melding.
- Taak bewerken stelt dezelfde vraag vóór het opslaan, met de vorm van het concept
  (`phaseAssignmentQuestionForTaskDialog`), zodat Annuleren de hele bewerking open laat. Het venster stelt die vraag
  via `askPhaseAssignmentQuestion`, de ingang voor een handeling buiten de store. Een nieuwe vraag vervangt een
  openstaande, en Annuleren (`null`) voert niets uit.
- Bij het antwoord stelt de store de vraag opnieuw op de state van dat moment (`recheck`). Wijkt die af van de
  gestelde vraag, dan gebeurt er niets en volgt de weigering `phaseQuestionOutdated`: de planner koos, maar de app
  voerde de keuze niet uit (eigenaarsbesluit 2026-10-17, "weigering = rood", `state/refusalNotice.ts`). De
  sneltoetsen staan dicht zolang de vraag openstaat, maar een extensie of een documentwissel kan de state toch
  veranderen. Een wijziging die de vraag niet raakt, houdt de keuze geldig.
- De wachtende handeling is een functie en geen state: ze staat buiten de snapshot, per storecontext in
  `createTaskSlice`, zonder app-singleton.
- Na een keuze in het venster komt er geen melding die het verplaatsen herhaalt (`answered`).
- Test: `check-structural-transition.ts`.
