# MCP-bridge fase 1 — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Doel:** Open Planner Studio wordt zelf een MCP-server (streamable HTTP op 127.0.0.1, Tauri-only) met 33 tools + batch, opt-in + token, AI-ribbontab met activiteitenpaneel/pauze/alleen-lezen/backup — volledig conform spec v2.3.

**Spec (bron van waarheid):** `docs/superpowers/specs/2026-07-24-mcp-bridge-design.md` (**v2.4**). Elke taak verwijst naar spec-secties; bij twijfel wint de spec. *(Plan herzien na critreview: testinfra naar fase 0, contract-fixes, pauze/RO-UI toegewezen, taskSlice-ontdubbeling — zie taakteksten.)*

**Architectuur:** Rust = dom doorgeefluik (HTTP → Tauri-event → webview); TS-dispatcher + tool-laag op een nieuw transactieprimitief (`runInMcpTransaction`) met draft-primitieven; alles behalve de Rust-schil headless testbaar op Node (esbuild, patroon `tests/planning/`).

**Tech stack:** bestaand — React 19/Zustand+Immer/TS strict; Rust: `tiny_http` (of std-only) in de Tauri-shell; géén MCP-SDK-dependency.

---

## Parallelliseringsoverzicht (banen en synchronisatiepunten)

```
Fase 0 (serieel, kort):   T0 contracten → T0b testinfra + taskSlice-prep ─┐
                                                  ▼
Fase 1 (4 banen parallel):
  BAAN A (store-kern):    T1 → T2 → T3 → T4 → T12  (transactieprimitief → draft-primitieven → bulk → validaties → moveTask-positie)
  BAAN B (engine):        T5 ∥ T6 ∥ T7             (capped-signaal ∥ histogram-attributie ∥ leveler-guard)
  BAAN C (transport):     T8 → T9 → T10            (Rust-bridge → dispatcher/protocol → server-levenscyclus+token)
  BAAN D (store-los):     T11 ∥ T13                (duplicateDocument ∥ generator-pad)
                                                  ▼  SYNC-1: A t/m D af, tsc groen, planning-suite groen
Fase 2 (3 banen parallel):
  BAAN E (UI):            T14 → T15 → T16          (AI-modus+tab → activiteitenpaneel → backup+pauze/RO-UI)
  BAAN F1 (leestools):    T17 → T18                (envelop+guards+registry → 10 leestools)
  BAAN F2 (mutatietools): T19 → T20 → T21          (taak/relatie-tools → kalender/resource/project-tools → document- en bestandstools)
                                                  ▼  SYNC-2: alle tools af, headless batterij groen
Fase 3 (serieel):         T22 → T23 → T24          (batch-executor → i18n-sweep 14 talen → integratie+E2E+demo)
```

Regels voor parallel draaien: elke baan in een **eigen worktree** vanaf dezelfde basis; banen raken disjuncte bestanden (zie taakkoppen) behálve de contracten uit T0 — die zijn na fase 0 bevroren. Merge-volgorde bij SYNC-1: A → B → D → C (A raakt de meeste gedeelde bestanden). BAAN F mag pas starten na SYNC-1 omdat de tools op A/B/D leunen; BAAN E hangt alleen aan T0-interfaces + T10-status en kan direct na C.

## Bestandsstructuur (nieuw/gewijzigd)

**Nieuw:**
- `src/services/mcp/contracts.ts` — alle gedeelde types (T0)
- `src/services/mcp/dispatcher.ts`, `server.ts`, `activityLog.ts`, `backup.ts`, `toolRegistry.ts`
- `src/services/mcp/tools/` — `readTools.ts`, `taskTools.ts`, `calendarResourceTools.ts`, `documentTools.ts`, `fileTools.ts`, `batchTool.ts`
- `src/state/mcpTransaction.ts` — `runInMcpTransaction` + draft-primitieven-façade
- `src-tauri/src/mcp_bridge.rs`
- `src/components/panels/AIActivityPanel.tsx`; ribbon-tabconfig-uitbreiding
- `tests/mcp/` — `run.sh`, `harness.ts`, `cases-*.ts` (patroon van `tests/planning/`)

**Gewijzigd (kern):** `src/state/transaction.ts` (suppressie-vlag + `resetUndoCoalescing`-export), `src/state/slices/taskSlice.ts` (export `applyProgressInvariants`, `moveTask`-positie), `documentSlice.ts` (`duplicateDocument`), `src/engine/scheduler/CalendarEngine.ts` (`addWorkDays` capped), `src/engine/scheduler/ResourceLoad.ts` (attributie + vensterkapaciteit), `src/hooks/keyboard/shortcutRegistry.ts` (export `hasBlockingDialogOpen`), `src/components/canvas/hooks/useBarDrag.ts` (addWorkDays-ripple), `src/components/settings/SettingsPanelContent.tsx`, `src/components/layout/Ribbon/…` (AI-tab), `src/state/slices/types.ts` + `uiSlice` (AI-state), `src-tauri/src/main.rs` + `Cargo.toml` + capabilities, `src/i18n/locales/*/…` (14 talen).

**Testgate bij elke taak:** `npx tsc --noEmit` groen + `bash tests/mcp/run.sh` (vanaf T17) + `bash tests/planning/run.sh` **ongemoeid groen** wanneer de diff engine/store raakt (exitcode is de poort, nooit de tail). Elke taak eindigt met een commit.

---

## Fase 0

### Taak T0 — Contractenbestand (bevriest de parallellisatie-interfaces)
**Afhankelijk van:** niets. **Blokkeert:** alles.
**Files:** Create `src/services/mcp/contracts.ts`; Test: type-only, gate = `tsc`.

- [ ] Definieer en committeer de gedeelde contracten, letterlijk conform spec v2.3 (secties Tool-set/Sessie-semantiek/UI):

```ts
// Envelop op elke tool-respons (spec §Sessie-semantiek)
export interface McpEnvelope {
  activeDocumentId: string;
  documentTitle: string;
  scheduleStale: boolean;
  paused: boolean;
  readOnly: boolean;
  backupCreated?: string; // pad, alleen op de call die de AI-backup schreef
}
export interface McpToolOk { ok: true; envelope: McpEnvelope; data: unknown;
  itemRejections?: { id: string; reason: string }[] } // per-item-zacht (spec §batch)
export interface McpToolErr { ok: false; envelope?: McpEnvelope; error: string; code:
  'DOC_DRIFT'|'DIALOG_OPEN'|'PAUSED'|'READ_ONLY'|'VALIDATION'|'NOT_FOUND'|'CYCLE'|
  'STALE_PRECONDITION'|'SCOPE'|'BACKUP_FAILED'|'INTERNAL' }
export type McpToolResult = McpToolOk | McpToolErr;
export interface McpToolDef {
  name: string;                          // altijd met prefix: 'planner_add_tasks' (spec §Naamgeving)
  kind: 'read'|'mutate'|'document'|'other'|'batch'; // stuurt guards+backup-trigger
  batchable: boolean;                    // spec §Compositie: uitsluitingslijst
  inputSchema: object;                   // JSON-schema, eenheden expliciet (completion 0-100)
  annotations: { readOnlyHint: boolean; destructiveHint: boolean;
    idempotentHint: boolean; openWorldHint: boolean };  // MCP-annotaties, mee in tools/list
  // Async toegestaan: bestandstools (export/import) doen echte I/O. De dispatcher awaits.
  // Batch-STAPPEN blijven synchroon (WP0-invariant b geldt binnen runInMcpTransaction).
  handler: (args: unknown, ctx: McpContext) => McpToolResult | Promise<McpToolResult>;
}
export interface McpContext {
  expectedDocId: string | null;          // drift-anker
  tempIdMap: Map<string, string>;        // batch-executor bezit deze
  paused: boolean; readOnly: boolean;    // vlaggen uit uiSlice, door de runtime ingevuld
  ensureBackup: EnsureBackupFn;          // hook, implementatie komt in T16 — hier alleen het type
}
// Backup-hook (T0-gepind zodat F-banen tegen een stub kunnen bouwen; E levert de implementatie):
// draait op de dispatch-grens, vóór runInMcpTransaction; resolve = pad of null (geen backup nodig).
export type EnsureBackupFn = (docId: string, kind: McpToolDef['kind']) => Promise<string | null>;
export interface ActivityEntry { ts: number; tool: string; summary: string;
  durationMs: number; ok: boolean; error?: string; substeps?: ActivityEntry[];
  argsJson: string; resultJson: string }
export interface McpServerStatus { state: 'off'|'live'|'port-busy'|'error';
  port: number; message?: string }
```

- [ ] Gate: `npx tsc --noEmit` groen. Commit: `feat(mcp): contractenbestand T0 (envelop, tooldef, activity, status)`.

### Taak T0b — Testinfrastructuur + taskSlice-prep (fase 0, vóór het splitsen van de banen)
**Afhankelijk van:** T0. **Blokkeert:** alle banen (elke baan draait hierop zijn gates).
**Files:** Create `tests/mcp/run.sh`, `tests/mcp/harness.ts`; Modify `src/state/slices/taskSlice.ts` (alleen de export-regel).

- [ ] Bouw `tests/mcp/run.sh` naar het esbuild-patroon van `tests/planning/run.sh`, maar met één cruciaal verschil: het script **globt `cases-*.ts` en bouwt/draait ze in een loop** — taken voegen later alléén een eigen case-bestand toe en raken `run.sh` nooit meer aan (vier parallelle worktrees op één handgeschreven bash-bestand is anders een conflictfabriek). Zelfde flags als de planning-suite (platform=node, alias `@=$ROOT/src`, DEV=false-defines) + de document-shim uit de benchmark-headless-run in `harness.ts`. Exitcode is de poort.
- [ ] Voeg een triviale `cases-smoke.ts` toe (importeert de store, assert dat `createSnapshot` bestaat) zodat de loop aantoonbaar werkt.
- [ ] Exporteer `applyProgressInvariants` uit `taskSlice.ts` (mechanische één-regel-wijziging; T2 en T4 gebruiken hem — zo blijft `taskSlice.ts` verder exclusief baan-A-terrein).
- [ ] Gate: `bash tests/mcp/run.sh` exit 0; `bash tests/planning/run.sh` exit 0; tsc groen. Commit.

## Fase 1 — vier banen parallel

### BAAN A — store-kern (serieel binnen de baan)

### Taak T1 — `runInMcpTransaction` + suppressie in `transaction.ts`
**Afhankelijk van:** T0b. **Parallel met:** B, C, D.
**Files:** Modify `src/state/transaction.ts`; Create `src/state/mcpTransaction.ts`; Test `tests/mcp/cases-transaction.ts` (testinfra bestaat al uit T0b — alleen een case-bestand toevoegen).

- [ ] Schrijf failing tests: (1) twee draft-mutaties binnen één `runInMcpTransaction` ⇒ `undoStack.length` +1 precies; (2) exception in de callback ⇒ store byte-gelijk aan voor (via `createSnapshot`-vergelijking) én `undoStack` ongewijzigd; (3) na geslaagde transactie is de coalesce-marker gereset (een volgende keyed `updateTask` pusht een éigen snapshot); (4) `runCPM` binnen het venster pusht geen snapshot (invariant a).
- [ ] Implementeer: module-vlag `mcpTransactionActive` in `transaction.ts` die `beginUndoable` vroeg laat returnen; exporteer `resetUndoCoalescing`. `runInMcpTransaction(fn)`: `createSnapshot` vooraf → push op `undoStack` → vlag aan → `fn()` → vlag uit → één `runCPM()` + `recomputeViewRows()` + `recomputeResourceLoad()` → bij throw of `cpmResult.error`: `restoreSnapshot` + pop + `resetUndoCoalescing()`; ook bij succes `resetUndoCoalescing()`. (Spec WP0, letterlijk.)
- [ ] Gate: mcp-cases groen, planning-suite groen, tsc groen. Commit.

### Taak T2 — Draft-primitieven (taken/relaties/kalenders/assignments/leveling/project)
**Afhankelijk van:** T1.
**Files:** Create-uitbreiding `src/state/mcpTransaction.ts` (façade `draft.*`; de `applyProgressInvariants`-export bestaat al uit T0b); Test `tests/mcp/cases-draft.ts`.

- [ ] Failing tests per primitief: `draft.addTask` (geen snapshot, geen recompute; `parent.childIds` correct bij bestaande ouder), `draft.addSequence` (dedup zoals store), `draft.updateCalendar`/`draft.addCalendar` (mét `syncProjectCalendar`-aanroep — spec WP5-noot), `draft.assign/updateAssignment/unassign/moveAssignment`, `draft.applyLeveling`, `draft.setProject`. Elk getest bínnen `runInMcpTransaction` op snapshot-telling én effect.
- [ ] Implementeer als dunne functies die de bestáánde slice-logica hergebruiken waar mogelijk (zelfde veld-afleiding als `addTask` incl. mijlpaal-duur-0 en `s.project.startDate`-anker) maar zonder `beginUndoable`/`finishMutation`/recompute — de suppressie-vlag dekt slices die je wél direct aanroept.
- [ ] Gate + commit.

### Taak T3 — Bulk-store-semantiek: temp-id's, top-down WBS, positie
**Afhankelijk van:** T2.
**Files:** `src/state/mcpTransaction.ts`; Test `tests/mcp/cases-bulk.ts`.

- [ ] Failing tests: (1) geneste WBS van 3 niveaus in één `draft.addTasks`-call met `tempId`-parents ⇒ `childIds`-boom klopt, retour bevat **volledige** tempId→realId-map; (2) onbekende `parentId` ⇒ `VALIDATION`-fout vóór enige mutatie; (3) positie-arg plaatst kind op index; (4) mijlpaal met duur>0 ⇒ fout.
- [ ] Implementeer `draft.addTasks(items)` (top-down sorteren op parent-keten, map teruggeven) conform spec WP2.
- [ ] Gate + commit.

### Taak T4 — Validatielaag WP7 (voortgangspad, relaties+rollback, guards)
**Afhankelijk van:** T3.
**Files:** `src/state/mcpTransaction.ts` (`validate.*` helpers); Test `tests/mcp/cases-guards.ts`.

- [ ] Failing tests, exact de spec-testlijst: kringverwijzing in `draft.addSequences` ⇒ pre-check-fout, store onaangeroerd; completion 150 ⇒ `VALIDATION` (géén klem); voortgangspad: 40%-taak ⇒ STARTED + afgeleide actualStart (0-100→0-1-conversie); actual ná statusdatum ⇒ item-weigering; actualFinish-wis op 100% ⇒ completion-reset; actuals zonder statusdatum ⇒ fout; voortgang op summary ⇒ fout; `actualFinish < actualStart` ⇒ fout; dubbele toewijzing ⇒ item-weigering (geen duplicaat!).
- [ ] Implementeer: cyclus-pre-check (DFS over sequences+batch-toevoegingen), voortgangspad exact spec WP7-volgorde via geëxporteerde `applyProgressInvariants` + setter-logica-replicatie, assignment-pre-validatie.
- [ ] Gate + commit.

### BAAN B — engine (onderling parallel)

### Taak T5 — `addWorkDays` capped-signaal
**Afhankelijk van:** T0b. **Files:** Modify `src/engine/scheduler/CalendarEngine.ts` (+ álle aanroepers: `CPMSolver.ts` :275/:644 én `src/components/canvas/hooks/useBarDrag.ts` :175 — de ripple reikt tot in een canvas-hook; kies het retour-mechanisme met de kleinste aanroeper-diff); Test `tests/mcp/cases-engine-capped.ts`.
- [ ] Failing test: kalender met werkdagen maar 366+ dagen aaneengesloten holiday-venster ⇒ resultaat draagt `capped: true`; normaal pad `capped: false` en **byte-identieke datums** t.o.v. huidig gedrag (regressiebewijs: planning-suite).
- [ ] Implementeer: retour `{ date: Date; capped: boolean }` (of tweede out-kanaal — kies wat de mínste aanroeper-diff geeft; documenteer keuze in commit), CPMSolver verzamelt gecapte taak-ids in `cpmResult` als niet-blokkerende waarschuwingslijst (spec WP7-beleid: zachte waarschuwing, geen error).
- [ ] Gate: planning-suite 100% ongemoeid groen (exitcode!). Commit.

### Taak T6 — Histogram-attributie + venster-capaciteit
**Afhankelijk van:** T0b. **Files:** Modify `src/engine/scheduler/ResourceLoad.ts` (nieuwe functie, bestaande onaangeroerd); Test `tests/mcp/cases-histogram.ts`.
- [ ] Failing tests: (1) twee assignments veroorzaken samen een overbelaste dag ⇒ attributie noemt precies die twee met hun bijdrage; (2) niet-overbelaste buckets krijgen géén attributie; (3) week-bucket levert som én piekdag; (4) week-capaciteit telt álle werkdagen van het venster (ook onbelaste — de onderschattingsbug uit review S5).
- [ ] Implementeer `computeHistogramReport({resourceIds, from, to, bucket})` conform spec-leestabel: hergebruik `computeResourceLoad`-mechaniek + aparte capaciteits-enumeratie + attributie-walk alleen voor overbelaste buckets.
- [ ] Gate + commit.

### Taak T7 — Leveler/`save_baseline`-staleness-guards (storehulpen)
**Afhankelijk van:** T0b. **Files:** Create `src/services/mcp/staleGuard.ts`; Test in `tests/mcp/cases-guards.ts` (apart blok).
- [ ] Failing tests: helper `ensureFreshSchedule(store)` ⇒ draait `runCPM` alléén bij `scheduleStale`, retourneert of dat gebeurde; geen undo-snapshot-bijwerking (invariant a).
- [ ] Implementeer + gate + commit. (Wordt door T18/T20 gebruikt voor `save_baseline`, losse `level_resources` en het histogram-vers-gedrag.)

### BAAN C — transport (serieel binnen de baan)

### Taak T8 — Rust `mcp_bridge.rs`
**Afhankelijk van:** T0 (alleen eventnamen). **Files:** Create `src-tauri/src/mcp_bridge.rs`; Modify `main.rs`, `Cargo.toml` (+`tiny_http`), capability indien nodig. Test: `cargo test` unit (token-check, bind-adres) + handmatige `curl`-check in T24.
- [ ] Schrijf Rust-unit-tests voor: verkeerd/ontbrekend token ⇒ 401 zonder detail; bind uitsluitend `127.0.0.1`; **request mét `Origin`-header ⇒ 403 (DNS-rebinding-bescherming, spec §Beveiliging) en geen antwoord op CORS-preflight (OPTIONS)**; requests strikt geserialiseerd (mutex om de in-flight-slot); timeout ⇒ 504 met nette JSON-RPC-fout.
- [ ] Implementeer: commands `mcp_bridge_start(port, token)` / `mcp_bridge_stop()` / status-event; per request: body → event `mcp://request {id, body}` naar de webview → wacht (ruime timeout, default 120 s — batch+backup, spec openstaand punt) op `mcp://response {id, body}` → HTTP-antwoord. Géén parsing van de payload.
- [ ] Gate: `cargo build` groen (CI-pariteit), tsc onaangeroerd. Commit.

### Taak T9 — Dispatcher + MCP-protocol (headless)
**Afhankelijk van:** T0b. **Files:** Create `src/services/mcp/dispatcher.ts`, `toolRegistry.ts`; Test `tests/mcp/cases-protocol.ts`.
- [ ] Failing tests met rauwe JSON-RPC-strings: `initialize` (protocolversie-echo), `notifications/initialized`, `tools/list` (schema's **én annotaties** uit registry; alle namen dragen het `planner_`-prefix), `tools/call` routeert naar een stub-tool en verpakt `McpToolResult` als MCP-content (+`structuredContent`), `ping`, onbekende methode ⇒ JSON-RPC-fout; parse-fout ⇒ -32700.
- [ ] Implementeer minimale streamable-HTTP-afhandeling (tools-only; geen SDK), registry-gedreven. **Registry-structuur vastgepind:** elke `tools/*.ts` exporteert zijn eigen `McpToolDef[]`; `toolRegistry.ts` importeert die arrays en slaat ze plat — F1 en F2 raken in fase 2 dus elk alleen hun eigen module, en de registry-importlijst is een eenmalige, triviale merge.
- [ ] Gate + commit.

### Taak T10 — Server-levenscyclus, token, instellingen-state
**Afhankelijk van:** T9. **Files:** Create `src/services/mcp/server.ts`; Modify `src/utils/settingsStore.ts` (`ops-aiMode`, `ops-mcpPort`, `ops-mcpToken`, `ops-aiAutoBackup`), `src/state/slices/types.ts`+`uiSlice` (AI-status/pauze/alleen-lezen/`McpServerStatus`); Test `tests/mcp/cases-server.ts`.
- [ ] Failing tests: token-generatie (crypto-random, persistent), status-overgangen off→live→off, poort-bezet ⇒ `port-busy` met melding (geen stil doorschuiven), pauze/alleen-lezen-vlaggen bereiken de dispatcher-context.
- [ ] Implementeer: luistert op het Tauri-event (dynamische import achter `isTauri()`), roept dispatcher, beheert status in de store. Gate + commit.

### BAAN D — losse store-uitbreidingen (onderling parallel)

### Taak T11 — `duplicateDocument`
**Afhankelijk van:** T0b. **Files:** Modify `src/state/slices/documentSlice.ts`; Test `tests/mcp/cases-documents.ts`.
- [ ] Failing tests (spec WP4, letterlijk): kopie is actief; `filePath`/`fileHandle` null; `isDirty` true; álle muteerbare payload-velden diep gekloond (mutatie in kopie raakt bron niet — test met directe array-push buiten Immer om het aliasing-risico te dekken); lege selectie; verse lege undo/redo; naam `"X (variant 2)"`-nummering + optionele eigen naam; baselines+`activeBaselineId` mee.
- [ ] Implementeer + gate (planning-suite groen) + commit.

### Taak T12 — `moveTask`-positie + dialoog-guard-export *(verhuisd naar BAAN A — raakt `taskSlice.ts`, net als T2/T4)*
**Afhankelijk van:** T4 (baan A, laatste taak van de baan). **Files:** Modify `taskSlice.ts` (`moveTask(id, newParentId, position?)`), `src/hooks/keyboard/shortcutRegistry.ts` (export `hasBlockingDialogOpen` — let op: dit bestand staat in `src/hooks/keyboard/`, NIET in `src/utils/`); Test `tests/mcp/cases-movetask.ts`.
- [ ] Failing tests: positie-index binnen nieuwe ouder; default = append (bestaand gedrag byte-gelijk); bestaande UI-aanroepen ongewijzigd (geen extra arg = append).
- [ ] Implementeer + gate + commit.

### Taak T13 — Generator-pad kalenders
**Afhankelijk van:** T0b. **Files:** Create `src/services/mcp/calendarGenerate.ts` (wrapper om `materializeHolidays`/`computeGenerateSpan`); Test `tests/mcp/cases-calgen.ts`.
- [ ] Failing tests: `{generate:{country,region,bouwvak}}` ⇒ holidays gelijk aan `materializeHolidays`-uitvoer over de projectspan; meng (generate + rauwe dagen) ⇒ samengevoegd, `generation` gewist, respons-vlag "kalender is voortaan letterlijk"; contract weigert een niet-bestaand `feestdagen`-veld (schema).
- [ ] Implementeer + gate + commit.

**SYNC-1:** merge A→B→D→C in de hoofd-feature-branch; `tsc` + `tests/mcp/run.sh` + `tests/planning/run.sh` groen.

## Fase 2 — drie banen parallel

### BAAN E — UI

### Taak T14 — AI-modus-toggle + AI-ribbontab (Server+Verbinding)
**Afhankelijk van:** T10 + SYNC-1. **Files:** Modify `SettingsPanelContent.tsx` (één gedeeld blok → 3 plekken), ribbon-config (conditionele tab), nieuwe tab-componenten; Test: harness-case op store-flags + Playwright-selftest (Tier 1, browser-dev-build met gemockte `isTauri`-status).
- [ ] Toggle `ops-aiMode` (uit ⇒ tab weg + bridge geforceerd stop), tab-groep Server (start/stop, statusindicator incl. statusbalk-dot), groep Verbinding (poortveld, token verborgen+kopieer+regenereer-met-waarschuwing, `claude mcp add …`-kopieerregel). Alle strings via `t(...)` (NL+EN nu, rest T23).
- [ ] Gate: tsc + zelftest via `window.__OPS__` (store-flags togglen, tab verschijnt). Commit.

### Taak T15 — Activiteitenpaneel
**Afhankelijk van:** T14. **Files:** Create `src/services/mcp/activityLog.ts` (ring-buffer 500, `ActivityEntry`), `src/components/panels/AIActivityPanel.tsx` (mount-mechaniek als DebugTerminal); Test `tests/mcp/cases-activity.ts` (log-gedrag) + Playwright-check.
- [ ] Failing tests: entry per tool-call met duur/ok/samenvatting; batch ⇒ één entry met `substeps`; buffer capt op 500.
- [ ] Implementeer + paneel (klik ⇒ args/result uitklappen). Gate + commit.

### Taak T16 — Backup-service + Veiligheid-groep (backup-, pauze- én alleen-lezen-bediening)
**Afhankelijk van:** T14. **Files:** Create `src/services/mcp/backup.ts` (implementeert `EnsureBackupFn` uit T0); UI in de tab-groep Veiligheid: backup-toggle (standaard aan) + "Nu backup maken" + "Backup-map openen" (shell-open), én de **pauzeknop** en **alleen-lezen-schakelaar** (togglen de uiSlice-vlaggen uit T10; status zichtbaar op de knop én in de envelop — dit zijn de veiligheidskleppen uit spec §UI groep 3); Test `tests/mcp/cases-backup.ts` (fs gemockt op Node) + store-flag-cases.
- [ ] Failing tests, exact spec-triggerregels: eerste Muteren/batch-call per doc ⇒ backup; tweede niet; handmatige backup reset teller; duplicate-born doc ⇒ géén auto-backup; import-doc ⇒ wél (op eerste echte mutatie); pad `ai-backups/<docId>/<projectnaam>-<ts>.ifc`; opruimen laatste 10 per docId; mislukte write ⇒ `BACKUP_FAILED` vóór mutatie.
- [ ] Implementeer (`ifcWriter` + `plugin-fs`, async, aangeroepen vanaf de dispatch-grens — de aanroepvolgorde zelf wordt in T22 afgedwongen en getest). Gate + commit.

### BAAN F — tool-laag (F1 en F2 parallel na SYNC-1)

### Taak T17 — Tool-runtime: envelop, guards, drift-anker
**Afhankelijk van:** SYNC-1. **Files:** Create `src/services/mcp/tools/runtime.ts` (bouwt `McpToolResult`, drift-check, dialoog-guard via geëxporteerde `hasBlockingDialogOpen`, pauze/alleen-lezen uit `ctx`, backup-hook-aanroeppunt **tegen het `EnsureBackupFn`-type uit T0 met een stub** — de echte implementatie komt uit T16 en wordt pas bij T22/T24 aangesloten); Test `tests/mcp/cases-runtime.ts`.
- [ ] Failing tests: envelop op elke respons; drift (user-switch gesimuleerd) ⇒ `DOC_DRIFT` alleen voor mutate-tools; anker verzet bij switch/new/duplicate/import; dialoog open ⇒ `DIALOG_OPEN` mét dialoognaam; paused ⇒ `PAUSED` alleen mutaties; readOnly ⇒ `READ_ONLY`.
- [ ] Implementeer + gate + commit.

### Taak T18 — De 10 leestools
**Afhankelijk van:** T17 (+T6/T7). **Files:** Create `tools/readTools.ts`; Test `tests/mcp/cases-read.ts`.
- [ ] Failing tests per tool tegen een gevuld testproject (hergebruik de benchmark-generator `generateBenchmarkProject` voor realistische data): `get_project_info`, `get_project_overview` (volledige relatiegraaf-garantie!), `list_tasks` (filters incl. `zonder_relaties`; paginering `limit`/`offset`/`has_more` conform spec §Naamgeving), `get_task` (assignments+units), `get_critical_path` (gefilterde driving-paren; `criticalPaths`-conditie FREE_FLOAT gemeld), `list_resources` (óók met paginering, spec §Naamgeving), `get_resource_histogram` (T6; vers + stale-waarschuwing), `get_calendars` (unie + volledige definitie), `compare_baseline` (alleen afwijkers + meetlat-disclosure), `analyze_delay` (projectEndDelta; ontbrekend ⇒ expliciete melding; geen baseline ⇒ nette fout). Plus één payload-groottemeting op het 2500-taken-project (rapporteren, niet gaten).
- [ ] Implementeer + gate + commit.

### Taak T19 — Mutatietools taken/relaties
**Afhankelijk van:** T17 + BAAN A. **Files:** Create `tools/taskTools.ts`; Test `tests/mcp/cases-mutate-tasks.ts`.
- [ ] Failing tests: `add_tasks` (map-retour, temp-ids), `update_tasks` (voortgangspad + per-item-zacht: 19 goed + 1 fout ⇒ 19 toegepast, weigering prominent), `delete_tasks`, `move_task`, `add_dependencies` (cyclus ⇒ rollback), `remove_dependencies`, `undo`/`redo` (per-doc, envelop-echo). Elke mutatie eindigt herrekend (auto-recalc in de transactie).
- [ ] Implementeer op `runInMcpTransaction`+draft/validate. Gate + commit.

### Taak T20 — Mutatietools kalender/resources/project/baseline
**Afhankelijk van:** T17 + A + B + T13. **Files:** Create `tools/calendarResourceTools.ts`; Test `tests/mcp/cases-mutate-cal-res.ts`.
- [ ] Failing tests: `update_calendar` (bulk=één undo-stap; promote-dan-dispatch; aanmaken; generator; onwerkbaar-venster ⇒ zachte waarschuwing op gecommitte wijziging, capped-ids uit T5), `manage_assignments` (vier acties, pre-validatie), `level_resources` (dryRun; contract-velden; staleness-guard T7; einddatum-delta prominent), `clear_leveling`, `update_project` (statusdatum; startdatum=anker), `move_project`, `save_baseline` (staleness-guard; stale ⇒ eerst herrekenen), `run_cpm`.
- [ ] Implementeer + gate + commit.

### Taak T21 — Document- en bestandstools
**Afhankelijk van:** T17 + T11 + T16. **Files:** Create `tools/documentTools.ts`, `tools/fileTools.ts`; Test `tests/mcp/cases-doc-file.ts`.
- [ ] Failing tests: `list_documents` (verrijkt; "niet doorgerekend" uit `cpmResult==null`; simulated-restore-case), `new_document` (store-actie, géén wizard — dialoog-guard blijft dicht), `duplicate_document` (T11 + anker + naamnummering), `switch_document`; `export_ifc` (scope-fout buiten `$HOME`, `overwrite`-weigering), `import_schedule` (pristine-hergebruik of nieuw doc; anker mee; per-formaat-verlies in beschrijving; CSV-kalendercase).
- [ ] Implementeer + gate + commit.

**SYNC-2:** alle tools geregistreerd in `toolRegistry`; volledige `tests/mcp/run.sh` groen; tsc groen; planning-suite groen.

## Fase 3 — serieel

### Taak T22 — Batch-executor
**Afhankelijk van:** SYNC-2. **Files:** Create `tools/batchTool.ts`; Modify `runtime.ts` (backup-await → drift-check → transactie-volgorde); Test `tests/mcp/cases-batch.ts`.
- [ ] Failing tests, de complete spec-batchlijst: één undo-stap over heterogene stappen; temp-id-resolutie over stappen (add_tasks-map → add_dependencies-args herschreven); stap-fout (structureel) ⇒ volledige rollback + uitgevoerd/gefaald/niet-bereikt-rapport; per-item-zacht binnen stap ⇒ batch loopt door, weigering prominent; herberekening vóór lees- én level_resources-stappen; uitsluitingen geweigerd (`save_baseline`/documenten/bestanden/undo/batch); max 100; synchroon (geen await in de stappenloop — statische assert in test op de executor-code: `/await/` komt niet voor in de stap-lus); backup-await vóór drift-check vóór transactie (volgorde-spy).
- [ ] Implementeer + gate + commit.

### Taak T23 — i18n-sweep (14 talen) + instellingen-3-plekken-check
**Afhankelijk van:** T14-T16 + T22. **Files:** `src/i18n/locales/*/common.json` (of nieuw namespace `ai`), alle UI-strings; Test: bestaande i18n-conventie + handmatige NL/EN-check, `tsc`.
- [ ] Alle AI-UI-strings in 14 talen (NL als canonieke bron), RTL-talen meegecheckt; bevestig dat het instellingenblok op alle drie de plekken verschijnt (⚙/ribbon/Backstage — één gedeeld component). Gate + commit.

### Taak T24 — Integratie, E2E-desktop, demo
**Afhankelijk van:** alles. **Files:** geen nieuwe (fixes die hieruit volgen wel); `docs/CHANGELOG.md`, `docs/TODO.md`-afvinklijst.
- [ ] Volledige poorten: `npx tsc --noEmit`, `bash tests/mcp/run.sh`, `bash tests/planning/run.sh` — alle exitcode 0.
- [ ] `npm run tauri:dev` (eigen `OPS_DEV_PORT`); verifieer met een echte MCP-client (`claude mcp add --transport http …` in een testsessie) + **MCP Inspector** (`npx @modelcontextprotocol/inspector`, tegen het live endpoint) + `curl`: initialize/tools-list/tools-call, 401-pad, Origin-weigering, poort-bezet-pad, pauze/alleen-lezen, backup-bestand verschijnt in appDataDir. De spec-[VERMOED]-punten (fs-scope-mapping, Rust-timeout-onder-batch) hier expliciet aftekenen in de spec.
- [ ] Maak een evaluatieset (mcp-builder-patroon): 10 onafhankelijke, read-only, verifieerbare vragen over een vast demoproject (bijv. "wat is het projecteinde als …", "hoeveel taken zonder relaties…"), opgeslagen als `tests/mcp/evaluation.xml` — herbruikbaar om toekomstige tool-wijzigingen op AI-bruikbaarheid te toetsen.
- [ ] Slotdemo mét de user: Claude bouwt live een planning in het open venster (use-case 1), activiteitenpaneel zichtbaar. Changelog-regel + commit.

---

## Zelfreview-notities (uitgevoerd bij het schrijven)
- Spec-dekking: alle 33 tools → T18/T19/T20/T21/T22; WP0→T1; WP1-8→T2-T4/T5/T11/T12/T13; UI-hoofdstuk→T14-T16; testlijst-items zijn 1-op-1 in taakgates verwerkt; beveiliging→T8/T10; prestatie-meting→T18.
- Bewuste afwijking van de skill-letter: volledige implementatiecode is niet per stap ingelijnd — de spec v2.3 bevat de normatieve contracten en elke taak verwijst ernaar; testgevallen zijn wél concreet benoemd per taak. Dit houdt het plan uitvoerbaar zonder 2000 regels pseudo-code die bij de eerste echte regel veroudert.
- Parallelbanen raken disjuncte bestanden; de enige gedeelde bron (contracts.ts) is bevroren na T0. Merge-volgorde bij SYNC-1 vastgelegd.
