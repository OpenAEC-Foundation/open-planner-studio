# MSPDI lezen: de soort mijlpaal uit de OPS-markering, anders alleen op een uurkalender

MSPDI kent alleen `<Milestone>`, geen start- of eindanker. Draagt de projectkop de definitie `OPS_MilestoneKind`,
dan beslist die markering voor elke mijlpaal, ook op een dagkalender, en `AUTO` betekent geen soort
(`explicitOpsMilestoneKind`). Zonder markering kwam een eindmijlpaal na OPS → MSPDI → OPS op een dagkalender als
automatisch terug en schoof hij een werkdag op (`check-xml-adapter-fidelity.ts` #7). Zonder definitie, of met een
waarde buiten START, FINISH en AUTO, leidt de lezer de soort alleen af voor een mijlpaal met `durationMinutes` 0 op
een uurkalender: `milestoneKindAt` op de gepromoveerde kalender, met het einde van de taak als anker, zoals de
`.mpp`-lezer. #7 toetst ook dat afleiden voor een bestand zonder de definitie.

## Gevolgen

- De voorwaarde duur 0 staat er omdat `<Milestone>1` ook op een taak met duur kan staan. Voor de planning is zo'n
  taak geen mijlpaal (`isZeroDurationMilestone`), maar `CPMSolver` toetst `milestoneKind` op een aantal plekken met
  alleen `isMilestone` ervoor (zoals `task.isMilestone && task.milestoneKind === 'FINISH'`), dus een afgeleide soort
  komt daar in de berekening. De `.mpp`-lezer heeft dezelfde voorwaarde.
