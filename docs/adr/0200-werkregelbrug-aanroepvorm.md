# De werkregelbrug: momentopname, bewerking, terugschrijven

`src/engine/work/workRuleApply.ts` zit tussen de domeinobjecten (taak, toewijzingen, resources) en de pure rekenkern
`workTriangle.ts`. De store, het taakraster, de MCP-draft, de splitsroute en de migratie op de laadgrens gebruiken
dezelfde brug. We kozen daarom een brug zonder store: het bestand importeert niets uit `src/state/`, muteert de taak en
de toewijzingen die het krijgt, en laat undo-stap, `isDirty`, `scheduleStale` en meldingen aan de aanroeper. Zo kan
dezelfde functie op een Immer-draft, een geïsoleerde rasterdraft of een gewone payload werken; `WorkRuleDeps` is
daarvoor een smalle `Pick` en niet de hele `AppState`. De aanroepvorm (`captureTriangle` vóór de mutatie, een
`settle…`-functie erna) staat in de regel `taaktypes`.

## Gevolgen

- `CapturedTriangle.assignments` bewaart de toewijzingen van die ene taak, dezelfde objecten als in de lijst die
  `captureTriangle` kreeg. `settleDurationEdit` schrijft daarin terug en zoekt niet opnieuw in alle toewijzingen van het
  project, want een geplakte rij zou dan bij een bestand als rehab-2 (52.640 toewijzingen, spec taaktypes §4.3) de hele
  lijst doorlopen. Het contract: tussen de momentopname en `settleDurationEdit` voegt de aanroeper geen toewijzing toe,
  haalt er geen weg en vervangt er geen. In de vijf aanroepen van `settleDurationEdit` (`taskSlice.updateTask`, twee in
  `createMcpTransactions.ts`, `applyTaskSplits`, `gridTransaction.ts`) staat tussen beide stappen alleen code die de
  taak bewerkt.
- Een werkinvoer wordt eerst gepland en dan pas geschreven (`planWorkEdit`, daarna `commitTrianglePlan`). Zo kan
  `resourceSlice.setAssignmentWork` de bewerking weigeren vóór `beginUndoable`, en laat een weigering geen lege
  undo-stap achter. `settleWorkEdit` doet beide in één stap voor aanroepers waar de undo-stap al loopt.
- `isHourTask` is één toets voor lezen (`remainingMinutesOf`) en schrijven (`applyTriangleResult`,
  `syncCompletionToRemaining`, `settleCalendarChange`). Een taak met `durationUnit: 'hours'` zonder eindig
  `durationMinutes` geldt daardoor bij lezen en bij schrijven als dagtaak.
- `workRuleContextOf` neemt de werktijd per dag uit `effHoursPerDay` van de opgeloste taakkalender, dezelfde functie die
  het taakraster gebruikt voor `effectiveHoursPerDay` (`FullTaskGrid.tsx`, `gridTransaction.ts`).
- Een toewijzing waarvan de resource niet gevonden wordt, doet mee in de driehoek en stuurt de duur
  (`resourceDrivesDuration(undefined)` en `inTriangle`). Kostentoewijzingen staan erbuiten (plan
  `docs/superpowers/plans/2026-11-07-kostenresource.md`, toets `check-cost-resource.ts`); `settleAssignmentPlan` slaat
  daarom een verwijder- of inzetstap over op een id dat niet in de momentopname staat.
- `settleDurationAftermath` geeft door of er tijdgefaseerde sturing verloren ging, met de uitkomst van
  `applyDurationChangeRules`. Het wissen van nivelleergaten telt daar niet in mee: die gaten zijn uitvoer van de app
  zelf en geen sturing uit een import, dus de aanroeper meldt er geen verlies voor. De volgorde van
  `clearLevelingGaps` en `reconcileHourInputFinish` staat in ADR 0153.
