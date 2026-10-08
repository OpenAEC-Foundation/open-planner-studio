# Documenten en openen (Haiku-leesagent, claude-haiku-5-5, main d233d578c; kernpunten door orkestrator nagelezen)
- Openen: openFile (fileSlice.ts:685, async tot parse) → openAsDocument (:664, sync) → applyOpenedImport (:565, sync) →
  per resultaat `if (!isActivePristine(get())) newDocument()` (:590) + applyLoadedProject (:445; prepareLoadedPayload = solve,
  materializeLibraryBoundary, set). Tab bestaat pas na parse+solve. Ook: openRecentFile (:1083), openExampleFromString (:1117),
  MCP fileTools ~370-386 (parseOpenedFile + postAwaitGuards + openAsDocument). Geen drop-handler.
- DocumentEntry (documentSlice.ts:63-72): {id, payload|null (null=actief), pendingWorkRuleSettle?}; geen laadstatus.
- RISICO's voor een laadtabblad: isActivePristine (fileSlice.ts:56-64) ziet een leeg tabblad als herbruikbaar ⇒ tweede open kaapt
  het; applyLoadedProject vult altijd het ACTIEVE document (get()) ⇒ na wisselen/sluiten vult het het verkeerde; auto-save
  (useAutoSave.ts:44-62) neemt alle documenten mee zonder filter; closeDocument (documentSlice.ts:498) annuleert niets;
  geen AbortController/onProgress in de open-route.
- XER meerdere projecten: assembleXerMultiProjectImport (xerMultiProject.ts:241-345): N documenten, actief = meeste bladtaken;
  één melding xerImportNotice; documenten delen xerSourceArchive (documentSlice.ts:426-428).
- Tests: check-document-activation/contract/switch-identity/tab-navigation, check-xer-open-wiring, check-mpp-open-guard,
  check-scratch-document, tests/mcp/cases-doc-file.ts, tests/browser/document-switch.spec.ts, new-open-task-flow.spec.ts.
- Let op: CLAUDE.md op main is nu alleen "@AGENTS.md".
