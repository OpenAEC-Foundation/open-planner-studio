---
paths:
  - "src/services/mcp/**"
  - "src-tauri/src/mcp_bridge.rs"
  - "src/hooks/useAiAutostart.ts"
  - "tests/mcp/**"
  - "docs/recepten/mcp-tool.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

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
`staleGuard.ts` (`ensureFreshSchedule`; leestools met berekende waarden rekenen via
`freshenScheduleForRead` in `tools/runtime.ts` zelf bij, behalve in "datums zoals opgeslagen", tijdens een
lopende bewerking (`editHold.ts`) en na een mislukte berekening met ongewijzigde invoer (`failedSolveGate.ts`)), `backup.ts` (AI-backups per document onder `<appDataDir>/ai-backups/<docId>/`, uitgedund volgens
`BACKUP_RETENTION`: alles van de laatste 7 dagen (max. 20), daarna één per week tot 30 dagen, één per maand tot een jaar, daarna één per jaar) en `activityLog.ts` (ring-buffer achter het AI-activiteitenpaneel). De 41
`planner_*`-tools staan in `src/services/mcp/tools/` (taken, relaties, resources, kalender, project,
baselines, documenten/bestanden, leestools, XER/P6-bronprovenance, en `planner_batch` als transactionele executor met
temp-id-resolutie).

Alles wat de agent via MCP leest (tool- en schema-beschrijvingen, foutmeldingen, waarschuwingen, `MCP_INSTRUCTIONS`)
is Engels; codecommentaar blijft Nederlands. Dat geldt ook voor wat `planner_get_planning_guide` levert: de
agentgids `public/agent/planning-guide.md` (per principe de tools, niet het Help-artikel voor mensen) en de skills
`public/skills/{goed-plannen,progress-update}/SKILL.md` (byte-identiek in `.claude/skills/`). Verandert een tool iets
wat daar beschreven staat, werk dan ook die teksten bij; `verify:docs` (poort 9 en 11) bewaakt de kopieën en de
koppeling met het Help-artikel; `tests/mcp/cases-agent-texts.ts` houdt elke `planner_*`-naam en elke genoemde parameter
(en enumwaarde) in die teksten tegen de registry en de `inputSchema`'s. De inhoud van elke toolbewering bewaakt geen poort.

Veiligheid is state, geen conventie: `ui.aiMode` (de hele AI-tab en bridge verschijnen pas hierdoor),
`ui.aiPaused`, `ui.aiReadOnly` en `ui.aiServerStatus` leven in `uiSlice`; de per-request `McpContext`
leest ze live, plus een drift-anker (`expectedDocId`) zodat een tool nooit op het verkeerde document
landt. Het anker leeft per MCP-sessie (`Mcp-Session-Id`): een geslaagde `initialize` maakt een nieuwe sessie
met een leeg anker, Rust zet de id als header en geeft hem bij latere requests door, en `createRequestHandler`
houdt per sessie het anker bij in een tabel per app-sessie (`appMcpSessions`; een bridge-herstart behoudt
hem, een nieuw token wist hem), met maximaal `MCP_MAX_SESSIONS`: alleen sessies zonder anker worden
verdrongen, vol met gebonden sessies ⇒ `initialize` geweigerd; onbekende id ⇒ `404`. Elk request behalve
`initialize` zonder header krijgt `400` en bereikt de dispatcher niet; er is geen gedeeld anker.
`createRequestHandler` (`server.ts`) verwerkt requests strikt na elkaar en voert een request dat langer
dan `MCP_QUEUE_DEADLINE_MS` (110 s, net onder Rusts 120 s-time-out) in de wachtrij stond niet meer uit
(`-32001`): de client had er al een 504 voor, dus uitvoeren zou bij een retry dubbel muteren. Instellingen staan onder de bekende `ops-`-prefix (`ops-aiMode`, `ops-aiAutostart` — default
**uit**, want een luisterende poort openen is een bewuste keuze —, `ops-aiAutoBackup`, `ops-mcpPort`,
`ops-mcpToken`); `src/hooks/useAiAutostart.ts` start de bridge desgewenst mee met de app, eenmalig
per app-sessie zodat een handmatige stop niet stil ongedaan wordt gemaakt.

De kern-bouwstenen nemen hun Tauri-randen als injecteerbare functies, zodat alles headless testbaar
is — zie `tests/mcp/`. **Headless MCP-server** (`headless/mcp-server/`, #570, `docs/headless-mcp.md`): dezelfde
tools op Node zonder app. Hij schrijft geen bestand dat open staat in de desktop-app: `appLock.ts` leest bij elke
schrijfactie `open-files*.json` uit de mappen van de app (`mcpDiscoveryDirs`) of `--discovery-dir`, vergelijkt op
identiteit en weigert bij twijfel. Hij bundelt de MCP-laag zonder app-singleton; daarom staan de requestlaag
(`requestHandler.ts`), `createMcpContext` (`context.ts`), de backupkern (`backupService.ts`), de versheid
(`freshness.ts`) en de dialoogpoort (`src/state/blockingDialogs.ts`) in modules zonder waarde-import uit `appStore.ts`
(`verify:store-boundaries`). Tools importeren daaruit, niet uit `server.ts`, `backup.ts` of `staleGuard.ts`. Een
nieuwe hostfunctie in een tool krijgt een naad zoals `fileToolDeps`/`guideToolDeps`; een tool die tijdens het draaien
een bestand uit `public/` leest, zet dat bestand in `embeddedAssets()` van `scripts/build-mcp-server.mjs`. Nieuwe tool ⇒ contract in `contracts.ts`, schema erbij, registreren in
`toolRegistry.ts`, en een case in `tests/mcp/`; zie `docs/recepten/mcp-tool.md` voor de volledige
route. `tests/mcp/cases-toolregistry.ts` is het mechanische vangnet dat een vergeten registratie
(of een spookregistratie zonder broncode) mechanisch afvangt.

**Externe client.** `tests/mcp/cases-externe-client.ts` toetst de bridge met de officiële SDK-client over echt HTTP.
De HTTP-schil daar is `tests/mcp/bridgeMirror.ts`, die de HTTP-transport van de headless MCP-server gebruikt
(`headless/mcp-server/src/http.ts`): een met de hand bijgehouden kopie van `mcp_bridge.rs`; hij
bewijst niets over Rust zelf. Verander je de HTTP-laag in Rust (statuscodes, volgorde van de poorten, limieten,
sessieheader), pas dan `headless/mcp-server/src/http.ts` mee aan. Dezelfde controles (`tests/mcp/externalClient.ts`) draaien in
`.github/workflows/mcp-real-app.yml` tegen de echte Rust-bridge in een Tauri-dev-build; die job draait ook de
Rust-unit-tests van de bridge (`cargo test … mcp_bridge`), die geen andere workflow draait. Wat geleverd is en wat
niet: `docs/mcp-verificatie.md`.

**Claude Desktop-bundel** (#730). `integrations/claude-desktop/` is een MCP Bundle (`.mcpb`) met twee programma's:
het schakelstuk (`server/index.mjs`, logica in `src/proxy.ts`) en de ongewijzigde headless server
(`server/headless.mjs`, uit `build:mcp-server`). Per aanvraag leest het schakelstuk `runtime.json`
(`src/discovery.ts`): draait de bridge, dan gaat de aanvraag daarheen; anders naar de headless server als kindproces op
de werkmap uit het installatievenster (`src/headlessChild.ts`, `src/config.ts`). Na een wissel tijdens een sessie
weigert hij wijzigingen tot een documentkeuze, en hij verlaat de headless planner niet zolang die werk heeft dat
niet met `planner_export_ifc` is weggeschreven. `proxy.ts` blijft vrij van manifest-, transport-, bestands- en
procescode. In het schakelstuk zit geen app-code behalve `discoveryContract.ts`; `scripts/build-mcpb.mjs` faalt anders.
Wijzig je het HTTP-contract van de bridge (statuscodes, sessieheader, `404` bij een onbekende sessie), loop dan ook
`proxy.ts` na; `tests/mcp/cases-mcpb.ts` start beide servers uit de ZIP, tegen `bridgeMirror.ts` en zonder app. Een
wijzigende tool wordt na sessieverlies bewust niet herhaald (het drift-anker is dan weg), en daarna blijven wijzigingen
geweigerd tot een geslaagde `planner_switch_document`, `planner_new_document` of `planner_import_schedule`
het anker opnieuw bindt. Nieuw/import mogen als losse herstelactie door, maar worden nooit automatisch herhaald; hernoem of verander je die tools
of `planner_export_ifc` (of het veld `envelope.activeDocumentId`), loop dan `DOCUMENT_CHOICE_TOOL`, `DOCUMENT_RECOVERY_TOOLS`
en `EXPORT_TOOL` in `proxy.ts` na; welke tools lezen, haalt de bundel uit `readOnlyHint` in `tools/list`.

**Ontdekkingsbestanden voor de MCP-plugin** (issue #570). `runtime.json` (zolang de bridge draait) en
`open-files.json` (zolang de desktop-app draait, ook met de MCP-koppeling uit) in `<appDataDir>/mcp/`. Contract
in `discoveryContract.ts` (importeert niets; de plugin bundelt hem), schrijver in `discoveryFiles.ts` (één
wachtrij, atomair, `0600`), meldingen via `onBridgeStarted`/`onBridgeStopped` in `createBridgeController`,
register via `src/hooks/useMcpDiscovery.ts`, opruimen bij afsluiten in `useAppCloseGuard`. Het proces-id komt
uit het initialisatiescript `ops-process-info` in `main.rs` (geen command). Detail: `docs/mcp-ontdekking.md`;
test `tests/mcp/cases-discovery.ts` en de echte-app-run.
