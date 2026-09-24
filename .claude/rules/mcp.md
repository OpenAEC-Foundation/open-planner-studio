---
paths:
  - "src/services/mcp/**"
  - "src-tauri/src/mcp_bridge.rs"
  - "src/hooks/useAiAutostart.ts"
  - "tests/mcp/**"
  - "docs/recepten/mcp-tool.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud ongewijzigd overgenomen; "hierboven"/"hieronder" verwijst naar de oude volgorde van CLAUDE.md. -->

### AI-assistent (MCP-bridge) — Tauri-only, protocol in TypeScript

Een externe AI-client (Claude Code e.d.) kan de app aansturen via MCP. De verdeling spiegelt de
rest van de architectuur: **Rust is een dom doorgeefluik, alle logica is TS.**
`src-tauri/src/mcp_bridge.rs` bindt een `tiny_http`-server op uitsluitend `127.0.0.1:<poort>`,
bewaakt een Bearer-token, weigert elk request met een `Origin`-header (DNS-rebinding-bescherming),
serialiseert requests strikt één-voor-één en forwardt de body als Tauri-event `mcp://request` naar
de webview; het antwoord komt terug via `mcp://response` (id-correlatie), status via `mcp://status`.
Het kent niets van MCP of JSON-RPC.

De hele protocol- en toollaag zit in `src/services/mcp/`: `server.ts` (levenscyclus, token, event-
bedrading — álle `@tauri-apps/*`-imports dynamisch achter `isTauri()`, zodat de web-build blijft
bouwen), `dispatcher.ts`, `schemaValidate.ts` (schema's worden in de dispatcher afgedwongen, óók
binnen `planner_batch` — een draaiboek mag de poort niet omzeilen), `toolRegistry.ts`/`toolIndex.ts`,
`staleGuard.ts` (`ensureFreshSchedule`), `backup.ts` (AI-backups per document in `appDataDir`,
`MAX_PER_DOC = 10`) en `activityLog.ts` (ring-buffer achter het AI-activiteitenpaneel). De 41
`planner_*`-tools staan in `src/services/mcp/tools/` (taken, relaties, resources, kalender, project,
baselines, documenten/bestanden, leestools, en `planner_batch` als transactionele executor met
temp-id-resolutie).

Veiligheid is state, geen conventie: `ui.aiMode` (de hele AI-tab en bridge verschijnen pas hierdoor),
`ui.aiPaused`, `ui.aiReadOnly` en `ui.aiServerStatus` leven in `uiSlice`; de per-request `McpContext`
leest ze live, plus een drift-anker (`expectedDocId`) zodat een tool nooit op het verkeerde document
landt. Instellingen staan onder de bekende `ops-`-prefix (`ops-aiMode`, `ops-aiAutostart` — default
**uit**, want een luisterende poort openen is een bewuste keuze —, `ops-aiAutoBackup`, `ops-mcpPort`,
`ops-mcpToken`); `src/hooks/useAiAutostart.ts` start de bridge desgewenst mee met de app, eenmalig
per app-sessie zodat een handmatige stop niet stil ongedaan wordt gemaakt.

De kern-bouwstenen nemen hun Tauri-randen als injecteerbare functies, zodat alles headless testbaar
is — zie `tests/mcp/`. Nieuwe tool ⇒ contract in `contracts.ts`, schema erbij, registreren in
`toolRegistry.ts`, en een case in `tests/mcp/`; zie `docs/recepten/mcp-tool.md` voor de volledige
route. `tests/mcp/cases-toolregistry.ts` is het mechanische vangnet dat een vergeten registratie
(of een spookregistratie zonder broncode) mechanisch afvangt.
