# De vraag bij een nieuwe samenvattingstaak

Een samenvattingstaak draagt zelf geen toewijzingen. Krijgt een taak met toewijzingen door een structuurhandeling haar
eerste kinderen, dan is de standaard dat de app eerst vraagt wat ermee moet, in het venster *Taak wordt een
samenvattingstaak* (eigenaarsbesluit 2026-10-17, "altijd vragen"). Wat de planner ziet en kiest, staat in de gids
`howto-structuur-aanpassen`; of er iets te vragen is en wat een keuze doet, beslissen `phaseAssignmentQuestion` en
`planPhaseTransitions` in `state/structuralTransition.ts`. In `taskSlice.ts` is de standaard daarom `'ask'`
(`PhaseAssignmentOptions.phaseAssignments`). Zolang de vraag openstaat, doet de handeling nog niets: `addTask` geeft
`''` terug en `insertWbsTemplate` `null`. Het antwoord (`answerPhaseAssignmentQuestion`) roept dezelfde handeling
opnieuw aan met de keuze. We kozen voor opnieuw aanroepen in plaats van een half uitgevoerde handeling bewaren, omdat
de handeling dan maar één weg heeft, met of zonder vraag.

## Gevolgen

- De verhangacties stellen de vraag na de kringtoets (ADR 0151); zij, `addTask` en `insertWbsTemplate` stellen haar
  vóór de undo-stap.
- Een aanroeper zonder venster geeft `'move'` mee: de extensie-API doet dat bij toevoegen en verhangen
  (`extensions/extensionApi.ts`). Kan `planPhaseTransitions` niet schoon verplaatsen, dan weigert de hele handeling
  met een melding.
- Taak bewerken stelt de vraag vóór het opslaan, met de vorm van het concept (`phaseAssignmentQuestionForTaskDialog`),
  zodat Annuleren de bewerking open laat. Het venster stelt haar via `askPhaseAssignmentQuestion`, de ingang voor een
  handeling buiten de store. Een nieuwe vraag vervangt een openstaande, en Annuleren (`null`) voert niets uit.
- Bij het antwoord stelt de store de vraag opnieuw op de state van dat moment (`recheck`). Wijkt die af van de
  gestelde vraag, dan gebeurt er niets en volgt de weigering `phaseQuestionOutdated`: de planner koos, maar de app
  voerde de keuze niet uit (eigenaarsbesluit 2026-10-17, "weigering = rood", `state/refusalNotice.ts`). De
  sneltoetsen staan dicht zolang de vraag openstaat (`isGlobalShortcutFrozen`), maar een extensie of een
  documentwissel kan de state toch veranderen.
- De wachtende handeling is een functie en geen state: ze staat buiten de snapshot, per storecontext in
  `createTaskSlice`, zonder app-singleton.
- Na een keuze in het venster herhaalt geen melding het verplaatsen (`answered`).
- Test: `check-structural-transition.ts`.
