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

## Tier 1 — Licht (standaard): Playwright MCP → browser-dev-build

Werkt tegen de **browser-dev-build** op `http://localhost:3007` (dezelfde React-UI als de
desktop-app; "fully functional except file I/O and auto-save"). Geen eigen server, geen extra deps
in het project.

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

  Strikt `import.meta.env.DEV`-gated → niet aanwezig in productie-builds.

### Gebruik
1. Start de browser-dev-build (bewust **niet** `tauri:dev` — Playwright kan het desktopvenster niet
   aansturen):
   ```bash
   npm run dev      # Vite op http://localhost:3007
   ```
2. Via Playwright MCP-tools:
   - `browser_navigate` → `http://localhost:3007`
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
De Gantt is een `<canvas>`: een taakbalk "aanklikken" gaat op pixelcoördinaten en een screenshot
zegt niets hard over correctheid. De betrouwbare check is de echte store-state (datums, kritiek pad,
`totalFloat`, `isCritical`) via `window.__OPS__`.

### Wat Tier 1 niet dekt
De échte Tauri-runtime: fysiek bestanden naar schijf schrijven/lezen (plugin-fs werkt alleen in Tauri)
en `isTauri()`-gated paden. Daarvoor → Tier 2. (De *native* OS bestand-picker zelf automatiseert geen
enkele tier — die omzeil je altijd met een expliciet pad.)

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
