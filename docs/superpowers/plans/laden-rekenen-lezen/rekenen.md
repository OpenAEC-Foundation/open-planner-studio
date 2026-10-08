# Rekenen en workers (Haiku-leesagent, claude-haiku-5-5, main d233d578c; kernpunten door orkestrator nagelezen)
- runCPM (scheduleSlice.ts:94-175): synchroon in één set(); scheduleStale=false (:125); solveProject(solveInputFor(...)) op de
  Immer-draft (:133); bij fout markScheduleStale (:144); cpmResult + resourceLoadResult (:148-154); geen eigen undo-stap, herschrijft
  de `after` van het laatste event (refreshLatestDocumentDataHistoryAfter, storeRuntime.ts:246-268), behalve in "datums zoals opgeslagen".
- Auto-calc: useAutoCalcCPM (App.tsx:173), 100 ms debounce, STANDAARD UIT (uiSlice.ts:146). Poorten: failedSolveGate (planningInputOf,
  referentievergelijking), editHold (4 aanroepers). Invoerwijziging alleen via boolean scheduleStale (50 plekken); geen generatieteller
  in de rekenroute; mutationSeq (storeRuntime.ts:178) bestaat wel.
- Nivelleerworker: backgroundLeveling.ts:34 (nieuwe Worker per run, terminate bij annuleren, fallback setTimeout zonder echte cancel),
  levelingWorker.ts (puur, geen onmessageerror-handler), stale-check alleen bij oplevering (LevelingDialog unchanged()), niet bij Toepassen.
  vite.config.ts:45-47 worker format 'es'. Geen headless test voor de worker.
- Slapende documenten: refreshAllDocumentsFromPool (librarySlice.ts:969-1084) REKENT NIET: alleen verversen + markScheduleStale +
  werkregel-settle + recomputeResourceLoad (actief doc). recalculateStaleSleepingDocuments (documentSlice.ts:738-800, synchroon) heeft
  één aanroeper: ResourceOccupancyView.tsx:224 (alleen met auto-calc aan en bezettingsoverzicht open). Bij activering geen solve.
- Solver puur: 95 bestanden, geen store/DOM/storage; alleen de writeback (applyCpmResult muteert taken) moet als plain data terug.
- Andere runCPM-aanroepers: F5, lint, WarningsPanel, ReportPanel, RecordedDatesNotice, CalendarDialog, project/profiel-slices,
  fileSlice (4x), MCP staleGuard/batchTool/createMcpTransactions, extensionApi:305-307, useExitRecordedDates.
