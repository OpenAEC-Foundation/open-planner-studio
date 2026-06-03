# Self-test harness — Claude test functies zelf

Doel: Claude Code kan UI-functies zelf uittesten (rondklikken, screenshots, gedrag verifiëren)
voordat een mens erbij hoeft. Twee tiers — begin altijd bij Tier 1.

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
Tauri-only gedrag: bestand open/opslaan-dialogen en de recovery-autosave. Daarvoor → Tier 2.

## Tier 2 — Zwaar (opt-in): tauri-driver → echt desktopvenster

Alleen opzetten wanneer een Tauri-specifieke functie écht end-to-end getest moet worden. Dit is een
**ander mechanisme dan Playwright** en is broos/per-platform — daarom niet de standaard.

- `tauri-driver` (Rust-crate: `cargo install tauri-driver --locked`), als proxy boven de native
  WebDriver-server.
- Linux: `WebKitWebDriver` (Debian-pakket `webkit2gtk-driver`). Windows: Edge WebDriver (versie matchen
  met geïnstalleerde Edge). **macOS: niet ondersteund.**
- Aansturen via WebdriverIO of Selenium.
- Referentie: https://v2.tauri.app/develop/tests/webdriver/

Implementatie volgt pas bij de eerste concrete behoefte; tot die tijd bestaat Tier 2 alleen als deze
notitie.
