# MPP lezen: splits uit de tijdgefaseerde periodes, in werkminuten en als doorsnede over de toewijzingen

Een `.mpp` bewaart geen lijst met splits; ze volgen uit de tijdgefaseerde periodes van de toewijzingen. Volgens het
weggehaalde commentaar is het gat gemeten op `mpxj/junit/data/mpp14splittask.mpp`: de opgeslagen `FINISH` van MS
Project volgt precies uit `addWorkMinutes(start, duur + gat)` als het gat in werkminuten telt. "Split Task 1" (start
2006-09-21T08:00, duur 4800 minuten, gat `{afterMinutes: 1920, gapMinutes: 1440}`, drie werkdagen) geeft zo de
opgeslagen finish 2006-10-09T17:00, en "Split Task 2" (duur 7200 minuten, gaten `{1440, 960}` en `{4800, 1440}`)
2006-10-18T17:00; het gat als 24-uurs kloktijd optellen gaf vier en twee dagen te vroeg. Daarom staat een gat op de
werkminutenas van de taak (`TaskSplitGap`, ADR 0002 en 0015). Met `OPS_MPP_CRAWL` pinnen het corpusdeel van
`check-mpp-import.ts` (`[Z4 corpus]`) die gaten en `mpp-fidelity-baseline.json` beide finishes als exact. Beide taken
staan op 0 %: of een voltooid segment blijft staan terwijl het restwerk schuift, is daar niet gemeten.

## Gevolgen

- Per toewijzing (`deriveSplitGapsFromPeriods`, volgens het weggehaalde commentaar een poort van MPXJ
  `ResourceAssignment.getWorkSplits()`): periodes met `workMinutes` 0 vallen weg, en `gapsBetweenWorkedSpans`
  (`contourIo.ts`) zoekt gaten tussen de werkperiodes die overblijven. Zo worden opeenvolgende records zonder werk
  vanzelf één gat, en geeft de naad tussen twee aansluitende werkperiodes geen gat van 0 minuten.
  `check-mpp-import.ts` (`[Z4 1a]` tot en met `[Z4 1c]`) toetst één gat, twee gaten en een naad zonder gat.
- De positie van een gat ligt op de cumulatieve as van `elapsedWorkMinutes*`: een eerder gat telt mee in de positie
  van een later gat. Een lezer van `splitGaps` moet die as aflopen (`splitTotalSpanMinutes`, ADR 0015) en mag niet
  klemmen op `[0, duur)`; volgens het weggehaalde commentaar zou anders het gat `{afterMinutes: 1440, gapMinutes: 5760}`
  van "Task 5 - 24 Hour" in `mpp14timephased.mpp` worden afgekapt.
- Alleen het verrichte en het resterende reguliere werk (`actualRegularWork`, `remainingRegularWork`) voeden de splits
  (`computeShiftedAssignmentPeriods` in `mppReader.ts`). Verricht overwerk niet: dat loopt naast de reguliere uren en
  volgens het weggehaalde commentaar is er geen corpusdata om die samenloop na te gaan. Irregulier werk niet: dat heeft
  absolute momenten en geen positie in werkminuten (ADR 0413). Zie knownbug 2480.
- Per taak (`deriveTaskSplitGaps`, gelijk aan `intersectAssignmentGaps` in `contourIo.ts`): de doorsnede van de
  gaten van de toewijzingen: een gat telt voor de taak alleen waar elke toewijzing in haar eigen periodes een gat
  heeft. Volgens het weggehaalde commentaar neemt MPXJ (`Task.calculateWorkSplits`, `reduceWorkSplits`) de
  vereniging van de werkperiodes. De doorsnede geeft alleen dezelfde uitkomst als de gaten van alle toewijzingen
  over hetzelfde venster bepaald zijn: `gapsBetweenWorkedSpans` ziet alleen gaten tussen de werkperiodes van één
  toewijzing. Werken twee toewijzingen op werkminuut 0 tot 60 en 120 tot 180, dan heeft geen van beide een gat en
  geeft de doorsnede geen gat, terwijl tussen de verenigde werkperiodes een gat van 60 minuten ligt. Of een `.mpp`
  dit verschil laat zien, is niet vastgesteld. Daarnaast rekent MPXJ op kalendermomenten en deze code op
  werkminuten; dat vraagt dat alle toewijzingen op dezelfde as van de taak staan, en daarvoor zorgt de verschuiving
  in ADR 0287. Een lege lijst betekent "wel periodes, geen gaten" en maakt de doorsnede leeg; een toewijzing zonder
  periodes telt niet mee (ADR 0287). `[Z4 1d]` en `[Z4 1]` vergelijken de doorsnede van twee verschillende gaten,
  een toewijzing zonder gaten die de doorsnede leeg maakt, één toewijzing en geen toewijzing.
- Samenvattingstaken, onbemande toewijzingen, de verschuiving naar de taakas en het ontbreken van `referenceFinish`
  staan in ADR 0287. Volgens het weggehaalde commentaar geeft MPXJ `Task.calculateWorkSplits` voor een
  samenvattingstaak een lege lijst ("In MS Project, summary tasks do not show splits").
