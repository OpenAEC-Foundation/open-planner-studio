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
  met een byte 0 die niet 0 is, is verwijderd en valt weg, zoals in `readAssignmentsUnsafe`. Zonder offset voor de
  unique-id of de taak-uid in de veldkaart is de koppeling leeg; een record dat te kort is voor die twee, of waarvan de
  taak niet gelezen is, valt weg. Voor `START`, `RESUME`, `FINISH`, de resource-uid en de inzet telt een offset per
  veld alleen als hij 0 of groter is en het veld binnen het record valt, zodat een corrupte veldkaart alleen dat veld
  kost; elke andere fout geeft een lege koppeling. De lus toetst `varMeta.containsKey` niet: de aanroepers
  vragen alleen uid's op die uit `readAssignmentTimephasedRaw` komen, en die komen al uit VarMeta.
- Alleen bladtaken met een start krijgen splits en contouren; een samenvattingstaak niet (volgens het weggehaalde
  commentaar ook in MPXJ `Task.calculateWorkSplits`).
- De periodes van een toewijzing beginnen bij haar eigen `START`. `computeShiftedAssignmentPeriods` schuift ze op met
  de werkminuten van taakstart tot `START` (niet negatief; zonder `START` 0), gerekend door een `CalendarEngine` op de
  effectieve taakkalender. Die engine leidt voor een kalender zonder opgeslagen `workTime` de werkblokken af uit de
  enkelvoudige werkdag (`calendarForEngine`); blijft ook dan geen werktijd over (`isHourMode` onwaar), dan rekent de
  lezer geen verschuiving en is ze 0. In een proef gaf een taak om 08:00 op een kalender zonder opgeslagen blokken met een toewijzing om
  09:00 een verschuiving van 60 minuten, net als met opgeslagen blokken.
- Het restwerk schuift mee met de verschuiving van de toewijzing zolang de decoder geen werkelijke periode oplevert.
  Levert hij er minstens één, dan schuift het naar haar `RESUME`, en zonder `RESUME` (of zonder werktijd op de
  kalender, als hierboven) naar het einde van haar laatste verschoven werkelijke periode (knownbug 2312). Volgens het weggehaalde commentaar ankeren de decoders
  van MPXJ (`getCompleteWork`, `getPlannedWork`) ook op `START` en bij verricht werk op `RESUME`.
- Splits en contouren decoderen zonder `referenceFinish`: een vlak samenvattend record (`blockCount` 0) kan geen gat
  tonen, en met een lengte in klokminuten op de as van werkminuten zou het een echt gat kunnen overbruggen.
- Splits: per toewijzing met periodes een lijst gaten (`deriveSplitGapsFromPeriods`), samengevoegd per taak
  (`deriveTaskSplitGaps`). Een toewijzing zonder periodes telt niet mee; een lege uitkomst zet geen `splitGaps`.
- Contouren: per toewijzing met periodes een contour met haar `resourceUid` en, als de resource gevonden is, haar
  `resourceId`, ook als er geen gat uit volgt. De bezetting (`ResourceLoad.ts`) en de contourlaag (onder andere
  `curveState.ts`) lezen de verdeling van het werk daaruit; een split alleen zou die verdeling niet dragen.
- `resourceUid` (`TaskTimephasedContour`, `number | null`): kan de `.mpp`-lezer de uid in het toewijzingsrecord niet
  lezen, dan wordt het `null`. Een gelezen uid zonder gevonden resource blijft een getal, zonder `resourceId`. De
  MSPDI-lezer zet de gelezen `ResourceUID` ook als getal. Contouren uit P6 XML krijgen `null`, en een nieuwe contour
  die de planner maakt ook (`contoursAfterEdit` in `assignmentMutations.ts`); bewerkt de planner een bestaande
  contour, dan houdt die haar uid. De XER-lezer maakt geen taakcontouren: een resourcecurve uit XER komt als `curve`
  en `curveValues` op de toewijzing (`xerResourceAssignments.ts`). De melding in het taakpaneel
  (`TaskTimephasedNotice.tsx`) leest een contour met een getal als `resourceUid` als aanwijzing voor herkomst uit MS
  Project.
- `deriveSplitGapsForTasks` heeft geen eigen try/catch: `readAssignmentTimephasedRaw` en `buildAssignmentUidLinks`
  vangen hun fouten zelf, en `CalendarEngine.ts` gooit niet. Een fout hoort bij de bron voorkomen te worden, niet
  weggevangen.
- `task.resourceIds` is een afleiding van de toewijzingen (`reconstructResourceIds`, dezelfde als in de IFC-lezer); de
  hervattingsregel van de solver (`resumeOverride` in `CPMSolver.ts`) gebruikt `resume` alleen bij hoogstens één
  resource in die lijst.
