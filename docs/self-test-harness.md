# Self-test harness — Claude test functies zelf

Doel: Claude Code kan functies zelf uittesten voordat een mens erbij hoeft.

**De twee tiers en hun rol t.o.v. elkaar:**
- **Tier 1 — browser-dev-build (Playwright MCP).** De snelle, lichte standaard. Rondklikken in de UI,
  screenshots, en state/logs asserten via `window.__OPS__`. Dekt het leeuwendeel: álle UI-interactie en
  álle TypeScript-logica (scheduler, IFC-serialisatie, import/export) die in de browser draait.
- **Tier 2 — échte Tauri-runtime (ops-test controlekanaal).** Voor wat alléén in de desktop-shell kan:
  écht bestanden opslaan/openen naar schijf en willekeurige store-acties aansturen — via een
  bestandssysteem-kanaal. **Geen WebDriver, geen sudo.**

Begin altijd bij Tier 1; pak Tier 2 wanneer je de échte Tauri-runtime of schijf-I/O nodig hebt.
De round-trip-check (`roundTrip()`: serialiseer→parse, meet dataverlies) werkt in beide tiers.
Daarnaast bestaat de app-eigen MCP-bridge (Tier 1½, hieronder): geen dev-only testhaak maar het
echte AI-assistent-oppervlak van de app (39 `planner_*`-tools) — Tauri-only en een bewuste
gebruikerskeuze (`ui.aiMode`), geen vervanging van Tier 1 of 2.

## Gecommitteerde browserpoort

De vaste regressiesuite staat in `tests/browser/` en draait als vijfde gedragssuite achter zowel
`npm test` als `npm run verify`. Installeer Chromium en zijn Linux-afhankelijkheden eenmalig en start
de suite daarna via de worktree-veilige runner:

```bash
npx playwright install --with-deps --only-shell chromium
npm run test:browser
```

De runner reserveert een afzonderlijke browserpoort per worktree, start en stopt zelf Vite en draait
Chromium headless shell met één worker en nul retries. Een gerichte run geeft argumenten door, bv.
`npm run test:browser -- tests/browser/gantt-drag-undo.spec.ts` of
`npm run test:browser -- --grep "documentwissel"`. Bij falen staan screenshot en trace in
`test-results/` en het HTML-rapport in `playwright-report/`; de gedeelde CI-, live- en release-gates
uploaden deze mappen als foutartefact.

De scheidslijn is bindend: klikken, typen, slepen, scrollen, taal kiezen en documenttabs wisselen
gebeurt met echte muis-, toetsenbord- en DOM-events. `window.__OPS__` mag vooraf deterministische
fixtures maken en achteraf domeinstate, painttellingen of renderergeometrie lezen. Het mag de
gebruikershandeling zelf niet uitvoeren.

### Extensieopslag en quarantaine

`tests/browser/extensions-storage.spec.ts` legt rechtstreeks vier echte records in de
`ops-extensions`-objectstore: een geldig legacyrecord, een vorm-kapot record, een identiteitsmismatch
en een modern geldig record. Daarna gebruikt de test `window.__OPS__.extensions.scanStored()` alleen
als observatienaad om te bewijzen dat scannen niets uitvoert of herschrijft. Na een echte reload
controleert hij via de store dat alleen geldige records ready zijn en opent hij met echte kliks
**Bestand → Extensies**. De quarantainekaarten, afwezige toggles en tweeklik-verwijdering worden via
de DOM bediend; de IndexedDB-sleutels en `onLoad`-effecten worden onafhankelijk nagemeten.

Dezelfde fixture beschadigt vervolgens een ready record ná startup en klikt de echte
aan/uit-schakelaar. Dat bewijst de hervalidatie vlak vóór uitvoering: de kaart verhuist naar
quarantaine en de effectteller verandert niet. Twee extra auto-enabled records leggen vast dat een
`onLoad`-fout een runtimefout blijft en een later geldig record niet blokkeert.

De dev-bridge mag voor geautomatiseerde ZIP-tests uitsluitend de menselijke vertrouwensvraag
overslaan via `window.__OPS__.extensions.installFromZip(...)`. Dat pad gebruikt verder exact de
productievolgorde: ZIP-parse, manifest- en identiteitsvalidatie, veilige paden, opslag en activatie.
Er bestaat geen dev-optie die validatie omzeilt. De consentdialoog zelf test je afzonderlijk met
`window.__OPS__.extensions.consent.set(fn)` en `.reset()`.

## Tier 1 — Licht (standaard): Playwright MCP → browser-dev-build

Werkt tegen de **browser-dev-build** op de aan dit worktree toegewezen poort (zie de `▶`-print van
`npm run dev` of `.claude/launch.json` → `opsDevPort`). Dit is dezelfde React-UI als de desktop-app;
de browser heeft eigen file-I/O en IndexedDB-recovery. Alleen Tauri-gepoorte functies, zoals de
in-app updater en native pluginpaden, ontbreken. Deze handmatige tier start geen eigen server.

### Onderdelen
- **`.mcp.json`** (repo-root) — koppelt de officiële Playwright MCP-server
  (`@playwright/mcp`, engine `chromium --headless` — draait dep-schoon op Linux zonder extra
  systeem-libs. `webkit` zou visueel dichter bij de echte WebKitGTK-desktopruntime zitten, maar
  vereist extra apt-libs via `sudo` (`libwoff1`, `libavif16`, …); daarom optioneel, niet de default.)
  Claude Code vraagt eenmalig om deze server te vertrouwen; herstart/reload de sessie als hij nog
  niet geladen is.
- **`window.__OPS__`** (`src/utils/devBridge.ts`) — dev-only haak met:
  - `store` — de Zustand-store (`getState()` / `setState()` / `subscribe()`)
  - `log` — de log-bus (`snapshot()` geeft gelogde regels + opgevangen fouten)
  - `gantt` — observer-only Canvasgeometrie en paintinformatie:
    `taskBarPoint(taskId, edge, surface)`, `paintCount(surface)` en `lastSize(surface)`
  - `library` — dev-only resourcebibliotheek-haken (B1): `state()` geeft `companies` (aantal),
    `defaultCompanyId` en per pool `{ version, cals, res }` (bibliotheekversie, kalender- en
    resourceaantal); `addCompany(name)` maakt een bibliotheek aan en geeft het nieuwe id terug;
    `addResource(companyId, poolResourceId)` materialiseert een bibliotheekresource in het actieve
    project (spiegelt de echte `addLibraryResourceToProject`-actie) en geeft
    `{ added, resourceId }` terug

  Strikt `import.meta.env.DEV`-gated → niet aanwezig in productie-builds. (`extensions.*` is
  eveneens onderdeel van `window.__OPS__`, maar staat gedocumenteerd bij *Extensieopslag en
  quarantaine* hierboven i.p.v. in deze opsomming.)

### Gebruik
1. Start de browser-dev-build (bewust **niet** `tauri:dev` — Playwright kan het desktopvenster niet
   aansturen):
   ```bash
   npm run dev      # Vite op de toegewezen poort (zie de ▶-print)
   ```
   > Elk worktree krijgt via scripts/dev-port.mjs een eigen vaste poort; een tweede start in
   > hetzelfde worktree wordt bewust geweigerd.
2. Via Playwright MCP-tools:
   - `browser_navigate` → `http://localhost:<toegewezen poort>` (lees 'm uit .claude/launch.json → opsDevPort of de ▶-print)
   - `browser_click` / `browser_type` op de DOM-chrome (ribbon, panelen, knoppen, dialogen)
   - `browser_take_screenshot` voor visuele controle
   - `browser_evaluate` om **state te asserten**, bv.:
     ```js
     () => window.__OPS__.store.getState().tasks
     () => window.__OPS__.log.snapshot().filter(e => e.level === 'error')
     ```

### Headed aan/uit (live meekijken)

Standaard draait de browser **headless** (onzichtbaar) — snel en licht. Wil je live meekijken hoe
Claude klikt? Vraag het gewoon in de chat ("doe het headed"):

1. Claude haalt `--headless` weg uit de `args` in `.mcp.json`.
2. Jij typt **`/mcp`** in de chat (reconnect — Claude Code leest `.mcp.json` dan opnieuw in).
3. De volgende `browser_navigate` opent een **zichtbaar** Chromium-venster (op `DISPLAY`).

Terug naar headless: zeg "headless" → Claude zet `--headless` terug → jij typt `/mcp`.

De commit-default in `.mcp.json` blijft `--headless`. Headed gebruikt de volledige `chromium`-binary
(staat al in `~/.cache/ms-playwright/`); headless gebruikt de kleinere `chromium_headless_shell`.

### Waarom state uitlezen i.p.v. pixels
De Gantt is een `<canvas>`: een screenshot zegt niets hard over domeincorrectheid en vaste
pixelcoördinaten zijn breekbaar. Lokaliseer daarom een echte pointerhandeling met bijvoorbeeld
`window.__OPS__.gantt.taskBarPoint(taskId, 'body', 'primary')`, voer de muishandeling via Playwright
uit en controleer daarna de echte store-state (datums, selectie, undo, kritiek pad, `totalFloat`) via
`window.__OPS__.store`. Voor repaintbewijs zijn `paintCount('primary')` en
`lastSize('histogram')` observer-only; ze starten zelf geen paint. Wacht bij Gantt-paintchecks eerst
op `document.fonts.ready` en controleer daarna twee rustige vensters van elk 500 ms.

### Wat Tier 1 niet dekt
De échte Tauri-runtime: fysiek bestanden naar schijf schrijven/lezen (plugin-fs werkt alleen in Tauri)
en `isTauri()`-gated paden. Daarvoor → Tier 2. (De *native* OS bestand-picker zelf automatiseert geen
enkele tier — die omzeil je altijd met een expliciet pad.)

## Tier 1½ — De app-eigen MCP-bridge (Tauri-only, bewuste gebruikerskeuze)

Naast de twee testkanalen hierboven heeft de app zélf een MCP-bridge: het AI-assistent-oppervlak uit
CLAUDE.md → *AI-assistent (MCP-bridge)*, met 39 `planner_*`-tools. Dit is **geen dev-only testhaak**
maar een productiefunctie — je verbindt er elke MCP-client mee, ook een aparte Claude Code-sessie.
De Rust-kant (`src-tauri/src/mcp_bridge.rs`) bindt een `tiny_http`-server op `127.0.0.1:<poort>`; de
TS-kant (`src/services/mcp/server.ts`) start/stopt 'm via Tauri `invoke`/`listen`. **Tauri-only**: in
de browser-dev-build bestaat de bridge niet, dus voor browserzelftests blijft Tier 1 het kanaal.

### Verbinden
1. Start de échte desktop-app (`npm run tauri:dev`) — niet de browserbuild.
2. Zet `ui.aiMode` aan. Dat is een expliciete gebruikersinstelling (default uit), geen automatisme:
   de checkbox staat in Instellingen (tandwiel-popup, Instellingen-ribbontab of Backstage →
   Instellingen delen allemaal `SettingsPanelContent`) en roept `applyAiModeLive(true)` aan
   (`src/services/mcp/server.ts`). Pas hierna verschijnt het AI-ribbontabblad.
3. Start de bridge zelf — twee routes:
   - handmatig: op het AI-tabblad, groep **Server** (`AiServerGroup.tsx`) — de Play/Stop-knop roept
     `startMcpServer()`/`stopMcpServer()` aan;
   - automatisch: instelling `ops-aiAutostart` (default **UIT** — een luisterende poort openen is
     bewust geen stilzwijgend gedrag) laat, mits `ui.aiMode` ook aan staat, `useAiAutostart()`
     (`src/hooks/useAiAutostart.ts`) de bridge één keer per app-sessie zelf starten, zodat een
     handmatige stop daarna niet stil ongedaan wordt gemaakt.
4. Poort en token staan in `localStorage`: `ops-mcpPort` (default **3877**, `MCP_DEFAULT_PORT` in
   `src/utils/settingsStore.ts`) en `ops-mcpToken` (leeg tot de eerste start; `ensureMcpToken()`
   genereert dan 32 crypto-random bytes, hex-gecodeerd, en onthoudt 'm). Beide staan ook leesbaar —
   mét kant-en-klaar configuratiefragment en koppelprompt — achter de knop **Verbinden** op
   hetzelfde AI-tabblad (`AiConnectionDetailsDialog.tsx`).
5. Endpoint: uitsluitend `127.0.0.1:<poort>` (`bind_addr` in `mcp_bridge.rs`); de UI toont 'm als
   `http://localhost:<poort>/mcp` — een gewone MCP-server over streamable HTTP, geen product-
   specifiek protocol. Auth: `Authorization: Bearer <token>`, een exacte (constant-time) match,
   anders `401`. Elk request met een aanwezige `Origin`-header wordt geweigerd met `403`, ongeacht
   token (DNS-rebinding-bescherming — een legitieme MCP-client stuurt geen `Origin`). Requests lopen
   strikt één-voor-één door de bridge (een `inflight`-mutex in `mcp_bridge.rs`): geen gelijktijdige
   aanroepen.

Voor de toolcatalogus (39 `planner_*`-tools; taken, relaties, resources, kalender, project,
baselines, documenten/bestanden, leestools, `planner_batch`) zie CLAUDE.md → *AI-assistent
(MCP-bridge)* — niet hier gedupliceerd.

**Begrenzing.** Dit kanaal bestaat alleen in de échte Tauri-runtime. Wil je de browser-dev-build
zelftesten, dan blijft Tier 1 (Playwright MCP + `window.__OPS__`) het enige kanaal — daar is geen
bridge om te starten.

## Tier 2 — Échte Tauri-runtime: ops-test controlekanaal

Voor gedrag dat de echte Tauri-shell nodig heeft (plugin-fs/-dialog, `isTauri()`-paden): écht opslaan/
openen naar schijf en elke store-actie aansturen. **Geen WebDriver, geen sudo** — Playwright kan de
WebKitGTK-webview op Linux niet aansturen, dus gebruiken we het bestandssysteem als kanaal (zowel de app
via plugin-fs als de aansturende kant via bash kunnen erbij).

### Hoe het werkt
`src/utils/devBridge.ts` installeert (alleen `DEV && isTauri()`) een poller die elke ~400 ms
`<appDataDir>/ops-test/cmd.json` leest, de opdracht uitvoert en `res.json` schrijft; bij start schrijft
hij `ready.json`. Op Linux is `appDataDir` = `~/.local/share/org.openaec.planner/`.

### Gebruik
1. Maak de map aan vóór de app boot (zodat de poller z'n `ready.json` kwijt kan), en start de échte app:
   ```bash
   mkdir -p ~/.local/share/org.openaec.planner/ops-test
   npm run tauri:dev
   ```
2. Stuur opdrachten via `cmd.json` (atomisch: schrijf naar `cmd.tmp` en `mv` naar `cmd.json`), lees
   `res.json`. Elk commando krijgt een `id`; `res.json` echoot die terug. Ops:
   - `ping` — `{ pong, appDataDir }`
   - `getState` — project + counts + isDirty + cpm
   - `roundTrip` — Niveau 1: `writeIFC`→`readIFC`, meet dataverlies (`lossless`)
   - `save` `{path}` — schrijf de state als IFC naar schijf (picker omzeild met vast pad)
   - `open` `{path}` — lees van schijf + `loadState`
   - `dispatch` `{action, args}` — roep een willekeurige store-actie aan, bv. `addTask`, `runCPM`, `newProject`
3. Paden moeten binnen de fs-scope vallen (appData of home; zie `src-tauri/capabilities/default.json`).

Voorbeeld:
```json
{"id":"c1","op":"dispatch","args":{"action":"addTask","args":[{"name":"Test"}]}}
{"id":"c2","op":"save","args":{"path":"/home/<user>/.local/share/org.openaec.planner/ops-test/x.ifc"}}
```

De helpers `window.__OPS__.roundTrip()` / `.saveToPath(path)` / `.openFromPath(path)` zijn ook direct
beschikbaar (`roundTrip` werkt ook in Tier 1; `saveToPath`/`openFromPath` alleen in de Tauri-runtime).

### Wat het bewust niet doet
De native OS-picker aanklikken — die zit buiten de webview. Standaardpraktijk: omzeilen met een vast pad.

### (Toekomst) echte desktop-UI-automatisering
Moet ooit gerenderd webview-gedrag in de echte shell geautomatiseerd worden (géén native dialoog), dan is
`tauri-driver` + `WebKitWebDriver` (Linux, `webkit2gtk-driver`, sudo) + WebdriverIO de route — broos,
per-platform, geen macOS. Bewust niet gebouwd; zie https://v2.tauri.app/develop/tests/webdriver/.

### Automatische poort-sync (dual-guard)

Installeer eenmalig een user-global SessionStart-hook zodat `preview_start` altijd
de juiste worktree-poort opent (buiten de repo, want `.claude/` is gitignored). In
`~/.claude/settings.json`:

    { "hooks": { "SessionStart": [
        { "hooks": [ { "type": "command", "command": "node scripts/dev-bootstrap.mjs || true" } ] }
    ] } }

De hook her-stempelt `.claude/launch.json` bij sessiestart. Hij is ergonomie, geen
correctheidsvereiste: de harde garantie tegen "verkeerde build" zit in de
vastgelegde `opsDevPort` + de launcher.
