# MPP lezen: de tijdgefaseerde gegevens van een toewijzing op de as van de taak

`readMPP` leidt uit de tijdgefaseerde gegevens van de toewijzingen (`readAssignmentTimephasedRaw`, decoders in
`mppTimephased.ts`) de splits (`deriveSplitGapsForTasks`) en de ruwe contouren (`deriveTimephasedContoursForTasks`)
van een taak af. Beide lopen door dezelfde generator, `shiftedAssignmentPeriods`, zodat ze dezelfde toewijzingen en
dezelfde verschuiving gebruiken. De decoders zelf kennen geen kalender; de enige kalenderwandeling (de verschuiving
van de toewijzing naar de taak, met `CalendarEngine.workMinutesBetween`) staat in `computeShiftedAssignmentPeriods`.

## Gevolgen

- De koppeling van een `TBkndAssn`-record aan een taak maakt `buildAssignmentUidLinks` met een eigen lus over
  `TBkndAssn/FixedMeta` (itemgrootte 34) en `FixedData` (110), en niet via `readAssignments`: die laat een record
  zonder echte resource weg (resource-id -65535, MPXJ `ASSIGNMENT_NULL_RESOURCE_ID`), en zo'n onbemande toewijzing kan
  juist splits dragen (volgens het weggehaalde commentaar heeft `mpp14splittask.mpp` alleen zulke records). Een record
  met een byte 0 die niet 0 is, is verwijderd en valt weg, zoals in `readAssignmentsUnsafe`. Een offset uit de
  veldkaart telt per veld alleen als hij 0 of groter is en binnen het record valt, zodat een corrupte veldkaart alleen
  dat veld kost; elke andere fout geeft een lege koppeling. De lus toetst `varMeta.containsKey` niet: de aanroepers
  vragen alleen uid's op die uit `readAssignmentTimephasedRaw` komen, en die komen al uit VarMeta.
- Alleen bladtaken met een start krijgen splits en contouren; een samenvattingstaak niet (volgens het weggehaalde
  commentaar ook in MPXJ `Task.calculateWorkSplits`).
- De periodes van een toewijzing beginnen bij haar eigen `START`. Op een uurkalender van de taak schuift
  `computeShiftedAssignmentPeriods` ze op met de werkminuten van taakstart tot `START` (niet negatief; zonder `START`
  0); op een kalender zonder werkblokken is die verschuiving 0 (knownbug 2311). Het restwerk schuift, als er al
  verricht werk is, vanaf `RESUME` op een uurkalender, en anders (zonder `RESUME` of zonder werkblokken) tot het einde
  van de verschoven werkelijke periodes (knownbug 2312). Volgens het weggehaalde commentaar ankeren de decoders van MPXJ (`getCompleteWork`, `getPlannedWork`) ook op
  `START` en bij verricht werk op `RESUME`.
- Splits en contouren decoderen zonder `referenceFinish`: een vlak samenvattend record (`blockCount` 0) kan geen gat
  tonen, en met een lengte in klokminuten op de as van werkminuten zou het een echt gat kunnen overbruggen.
- Splits: per toewijzing met periodes een lijst gaten (`deriveSplitGapsFromPeriods`), samengevoegd per taak
  (`deriveTaskSplitGaps`). Een toewijzing zonder periodes telt niet mee; een lege uitkomst zet geen `splitGaps`.
- Contouren: per toewijzing met periodes een contour met haar `resourceUid` en, als de resource gevonden is, haar
  `resourceId`, ook als er geen gat uit volgt. De bezetting (`ResourceLoad.ts`) en de contourlaag (onder andere
  `curveState.ts`) lezen de verdeling van het werk daaruit; een split alleen zou die verdeling niet dragen.
- `deriveSplitGapsForTasks` heeft geen eigen try/catch: `readAssignmentTimephasedRaw` en `buildAssignmentUidLinks`
  vangen hun fouten zelf, en `CalendarEngine.ts` gooit niet. Een fout hoort bij de bron voorkomen te worden, zoals met
  de voorwaarde `isHourMode` hierboven, niet weggevangen.
- `task.resourceIds` is een afleiding van de toewijzingen (`reconstructResourceIds`, dezelfde als in de IFC-lezer); de
  hervattingsregel van de solver (`resumeOverride` in `CPMSolver.ts`) gebruikt `resume` alleen bij hoogstens één
  resource in die lijst.
