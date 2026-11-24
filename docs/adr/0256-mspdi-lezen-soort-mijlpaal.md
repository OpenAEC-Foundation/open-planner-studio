# MSPDI lezen: de soort mijlpaal uit de OPS-markering, anders alleen op een uurkalender

MSPDI kent alleen `<Milestone>`, geen start- of eindanker. Een geldige waarde in het taakveld `OPS_MilestoneKind`
(START, FINISH of AUTO, met de definitie in de projectkop, ADR 0250) wint, ook op een dagkalender, en AUTO betekent
geen soort (`explicitOpsMilestoneKind`). Reden: zonder die markering kwam een eindmijlpaal na OPS → MSPDI → OPS op een
dagkalender als automatisch terug en schoof hij een werkdag op (`check-xml-adapter-fidelity.ts` #7). Zonder geldige
taakwaarde, ook als het project de definitie heeft, leidt de lezer de soort alleen af voor een mijlpaal met
`durationMinutes` 0 op een uurkalender (`milestoneKindAt`), net als de `.mpp`-lezer.

## Gevolgen

- De voorwaarde duur 0 staat er omdat `<Milestone>1` ook op een taak met duur kan staan. Voor de planning is zo'n taak
  geen mijlpaal (`isZeroDurationMilestone`), maar `isFinishMilestone` in `CPMSolver` toetst `milestoneKind` met alleen
  `isMilestone`, dus een afgeleide soort komt daar in de berekening.
