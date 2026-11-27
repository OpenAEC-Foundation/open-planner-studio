# Relaties in de rastertransactie

Een write in de kolom voorgangers of opvolgers komt als `relation-set` binnen en gaat door `applyRelationSet` in
`src/state/gridTransaction.ts`, met `planRelationSetInBatch` uit `engine/taskGrid/relationPlan.ts`. Een plakactie kan
voor meerdere taken relaties zetten, en die kunnen elkaar raken. We kozen ervoor de graaf na alle writes nog eens te
toetsen, en daarbij alleen fouten te tellen die deze transactie toevoegt.

## Gevolgen

- `validateFinalRelationGraph` krijgt de graaf van vóór de transactie mee (`before`). Een structuurfout, een relatie
  die niet op een samenvattingstaak past of een cyclus die al in die graaf zat, telt in deze eindtoets niet mee.
- Een fout uit die eindtoets draagt geen `taskId` (`relationCellErrors` zonder taak), want de toets gaat over meerdere
  taken. Een fout van één write draagt de taak van die write.
- Met meer dan één toegepaste relatiewrite plant de transactie elke write opnieuw tegen de uiteindelijke graaf. Zou
  dat nog iets veranderen, dan spraken de writes elkaar tegen en weigert ze met `relationSetConflict`.
- De relatie-index uit de kolomcontext gebruikt de transactie alleen als er precies één relatiewrite is; anders bouwt
  de planner zijn eigen index.
- Na een toegepaste relatiewrite rekent de startregel opnieuw op de kopie (ADR 0444).
