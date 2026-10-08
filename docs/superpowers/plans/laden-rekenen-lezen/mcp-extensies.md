# MCP en extensie-API (Haiku-leesagent, claude-haiku-5-5, main d233d578c; kernpunt thenable-weigering door orkestrator nagelezen)
- Alle MCP-aanroepers lezen cpmResult DIRECT na runCPM: ensureFreshSchedule (staleGuard.ts:57-60), recomputeMidBatch (batchTool.ts:234-239),
  eindherberekening transactie (createMcpTransactions.ts:1089, rollback bij fout :1110), level_resources, save_baseline, move_project,
  import_schedule (fileTools.ts:386 leest payload direct na openAsDocument).
- MCP-transactie run() is strikt synchroon en weigert thenables (createMcpTransactions.ts:1074); lease sluit in finally (:1128).
- Extensie: data.recalculate() (extensionApi.ts:307) en data.loadProject (:302-306) synchroon; data.addTask e.a. via batch.withTransaction
  zonder runCPM (planning blijft stale tot recalculate()).
- Export (fileSlice.ts:746-748, 902-904) rekent synchroon vóór exporteren; PDF-rapport wacht via useEffect op scheduleStale (ReportPanel.tsx:1261-1274).
- Voorbeeld "sync voor MCP, worker voor UI" bestaat al: nivelleren (MCP synchroon levelResources, dialoog via levelingWorker).
- Tests: tests/mcp/cases-staleguard, cases-read-freshness, cases-transaction (:100 rollback op cpm-fout), cases-batch (:418 no-await),
  check-ext-contract (:683-698, :979-1011), check-export-guard, check-recovery-integrity.
