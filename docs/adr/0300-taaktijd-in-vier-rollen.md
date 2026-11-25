# De tijd van een taak heeft vier rollen, en elk veld hoort bij precies één

`TaskTime` (`src/types/task.ts`) draagt velden die de planner en de lezers invoeren, velden die de berekening schrijft
en velden voor de voortgang. Wie het verkeerde veld schrijft, laat de volgende berekening op zijn eigen uitvoer
rekenen of wist een invoer. Vier typen splitsen het object daarom op naar de betekenis van het veld: `TaskTimeInput`
(invoer), `TaskTimeComputed` (de zeven velden die `runCPM` schrijft), `TaskTimeAnalysis` (afgeleiden van de
berekening) en `TaskTimeTracking` (voortgang). De rol zegt wat een veld betekent, niet dat alleen die partij het
schrijft; de uitzonderingen staan bij de gevolgen. `Task.time` blijft één `TaskTime`; de typen veranderen de opslag
niet.
Twee compile-asserts in hetzelfde bestand (`_assertTaskTimeComplete` en `_assertTaskTimeDisjoint`) eisen dat elk veld
van `TaskTime` in precies één rol staat, zodat een nieuw veld niet zonder rol kan blijven.

## Gevolgen

- `RECORDED_SLOT_KEYS` (`ifcTaskSlots.ts`) is aan `TaskTimeComputed` gekoppeld, met `satisfies` en een eigen assert.
  `totalFloatMinutes` en `freeFloatMinutes` staan daarom in `TaskTimeAnalysis` en niet in `TaskTimeComputed`: ze
  zijn optioneel en geen rekenslot van `IfcTaskTime` (spec `2026-10-20-alleen-uren-design.md`, §3.4).
- Invoer die de berekening toch raakt: `applyCpmResult` zet `scheduleStart` van een taak in de urenmaat in de
  datetime-vorm, op hetzelfde moment. `scheduleFinish` schrijft de berekening niet terug (ADR 0210). Bij een hammock en
  een samenvattingstaak schrijft `writeDerivedSpan` de duurbron uit de span (ADR 0023).
- Een rekenveld komt buiten de berekening ook uit een bestand: de IFC-lezer leest de zeven velden uit `IfcTaskTime`
  (`IFC_TASKTIME_SLOTS` in `ifcTaskSlots.ts`).
- `applyCpmResult` schrijft `interferingFloat` bij elke toepassing van een resultaat, en `isNearCritical` en
  `floatPath` alleen als het resultaat ze draagt; anders zet het ze op `undefined`, zodat een markering van een vorige
  berekening niet blijft staan.
- De velden van `TaskTimeTracking` schrijven de planner, de lezers en de bewerkingslaag (onder meer de werkregelbrug,
  regel `taaktypes`). `CPMSolver.ts` schrijft er geen. `applyCpmResult` schrijft er wel twee soorten: het wist
  `progressBeforeRecalculation` van elke taak in het resultaat, en bij een automatische verzameltaak schrijft het via
  `writeSummaryProgress` (`summaryProgress.ts`) de opgerolde `completion`, `actualStart` en `actualFinish` uit de
  bladen. Een handmatige verzameltaak houdt haar opgeslagen voortgang (`isSummaryProgressDerived`).
  `applyRecordedTimesToTasks` (`recordedDates.ts`) zet bij "datums zoals opgeslagen" met dezelfde functie de
  bestandswaarde terug. `progressBeforeRecalculation` is sessiedata en geen veld in het IFC-bestand (ADR 0213).
