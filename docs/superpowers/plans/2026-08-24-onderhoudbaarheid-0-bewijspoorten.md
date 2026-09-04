# Onderhoudbaarheidsprogramma 0 — bewijs- en hookpoorten

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak gebruikerskritische UI-bedrading en React-hookafhankelijkheden onderdeel van de echte `npm run verify`-poort voordat de store of Gantt structureel wordt gewijzigd.

**Architecture:** Playwright start per worktree een eigen Vite-server op een afzonderlijke browser-testpoort, voert echte browserhandelingen uit en gebruikt `window.__OPS__` alleen voor deterministische fixtures en state-asserties. Hooklint wordt eerst zichtbaar gemaakt, daarna site voor site opgelost, en eindigt als harde lintpoort.

**Tech Stack:** TypeScript strict, React 19, ESLint 10 + `eslint-plugin-react-hooks`, Playwright 1.62.1, Vite 7, Node 22, bestaande shell-/`node:test`-suites.

**Spec:** [`docs/superpowers/specs/2026-08-24-onderhoudbaarheidsprogramma-design.md`](../specs/2026-08-24-onderhoudbaarheidsprogramma-design.md)

## Global Constraints

- Gebruik alleen Chromium headless shell, één worker en nul retries.
- Browseracties zijn echt; `window.__OPS__` mag fixtures zetten en uitkomst lezen, niet de handeling vervangen.
- Geen pixel-golden tests. Canvasdoelen worden via een dev-only geometriehaak gelokaliseerd.
- `npm run verify` blijft de enige gedeelde gate; voeg geen workflow-specifieke testsamenstelling toe.
- Houd de bestaande devpoort-API als compatibiliteitswrapper werkend voor `dev-server.mjs` en `tauri-dev.mjs`.
- Raak `docs/CHANGELOG.md` niet aan.
- De huidige checkout bevat een niet-gerelateerde hunk in `tests/planning/run.sh` die
  `check-dependency-presentation.ts` registreert, plus dat nieuwe testbestand. Die hunk en dat
  bestand horen niet bij dit programma. Stage een eigen `run.sh`-wijziging uitsluitend hunkgewijs en
  controleer vóór iedere commit de cached diff; een file-level `git add tests/planning/run.sh` is
  zolang de overlap bestaat verboden.
- Draai vóór de eerste edit `git status --short`. Draai vóór iedere commit
  `git diff --cached --name-only` en `git diff --cached --check`; inspecteer daarnaast iedere cached
  diff van een overlappend bestand. Breek de commit af zodra een pad/hunk niet bij de task hoort.

---

## Task 1: Leg de browserafhankelijkheid en configuratie vast

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `playwright.config.ts`

- [ ] **Step 1: Voeg Playwright exact gepind toe**

Voer uit:

```bash
npm install --save-dev --save-exact @playwright/test@1.62.1
```

Controleer dat `package.json` exact bevat:

```json
"@playwright/test": "1.62.1"
```

en dat `package-lock.json` dezelfde versie en integriteit vastlegt.

- [ ] **Step 2: Controleer dat alleen de lockfile-transitie is ontstaan**

```bash
git diff -- package.json package-lock.json
```

Verwacht: één exact gepinde devDependency en de bijbehorende lockfileknooppunten. Voeg
`test:browser` pas in Task 3 toe wanneer runner, server en een echte smoketest beschikbaar zijn; maak
de suite pas in Task 6 onderdeel van `test`, atomair met CI-provisioning. Deze eerste commit mag
`npm test` niet breken.

- [ ] **Step 3: Maak de Playwrightconfig**

Maak `playwright.config.ts` met deze bindende vorm:

```ts
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.OPS_BROWSER_TEST_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('OPS_BROWSER_TEST_PORT ontbreekt of is ongeldig; start via npm run test:browser');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/browser-test-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

- [ ] **Step 4: Negeer uitsluitend gegenereerde browserartefacten**

Voeg aan `.gitignore` toe:

```gitignore
playwright-report/
test-results/
```

- [ ] **Step 5: Bewijs dat de bestaande poorten groen blijven**

```bash
npm run typecheck
npm test
```

Verwacht: beide exit 0. De browserpoort is nog niet bereikbaar via een npm-script en wordt dus ook
niet stil als geslaagde suite gepresenteerd.

- [ ] **Step 6: Commit alleen dependency en configuratie**

```bash
git add package.json package-lock.json .gitignore playwright.config.ts
git commit -m "test(browser): leg Playwright als vijfde suite vast"
```

---

## Task 2: Geef browsertests een eigen worktree-veilige poortbaan

**Files:**
- Modify: `scripts/dev-port.mjs`
- Modify: `scripts/dev-lock.mjs`
- Modify: `tests/dev-server/choose-free-port.test.mjs`
- Modify: `tests/dev-server/read-recorded-port.test.mjs`
- Modify: `tests/dev-server/allocate-port.test.mjs`
- Modify: `tests/dev-server/lock-variants.test.mjs`
- Modify: `tests/dev-server/integration.sh`

- [ ] **Step 1: Schrijf eerst falende named-lane-tests**

Voeg tests toe voor twee lanes:

```js
export const PORT_LANES = {
  dev: { min: 3007, max: 3106, marker: 'opsDevPort' },
  browser: { min: 3107, max: 3206, marker: 'opsBrowserTestPort' },
};
```

De tests moeten vóór implementatie aantonen:

- `chooseFreePortFor('browser', ...)` start op 3107;
- `readRecordedPort(root, 'browser')` leest alleen `opsBrowserTestPort`;
- twee worktrees krijgen binnen de browserlane verschillende poorten;
- dev- en browserlane van hetzelfde worktree mogen naast elkaar bestaan;
- een bestaande `opsDevPort` en `configurations[dev].port` blijven byte-inhoudelijk behouden als de
  browsermarker wordt gestempeld;
- een guard in lane `dev` blokkeert lane `browser` niet, maar twee guards in dezelfde lane wel.

- [ ] **Step 2: Draai de dev-serversuite rood**

```bash
npm run test:dev-server
```

Verwacht: exit ongelijk aan 0 op ontbrekende named exports; de bestaande devtests vóór de nieuwe
asserties blijven groen.

- [ ] **Step 3: Generaliseer poortkeuze zonder bestaande callers te breken**

Exporteer uit `scripts/dev-port.mjs`:

```js
export const PORT_LANES = Object.freeze({
  dev: Object.freeze({ min: 3007, max: 3106, marker: 'opsDevPort' }),
  browser: Object.freeze({ min: 3107, max: 3206, marker: 'opsBrowserTestPort' }),
});

export function chooseFreePortFor(lane, claimed, isBound) { /* lanebereik */ }
export function readRecordedPort(root, lane = 'dev', readFile = readFileSync) { /* marker */ }
export function stampRecordedPort(root, lane, port) { /* atomisch */ }
export async function allocateNamedPort(root, lane, deps = {}) { /* bestaande algoritme */ }

export const MIN_PORT = PORT_LANES.dev.min;
export const MAX_PORT = PORT_LANES.dev.max;
export function chooseFreePort(claimed, isBound) {
  return chooseFreePortFor('dev', claimed, isBound);
}
export function stampLaunchJson(root, port) {
  return stampRecordedPort(root, 'dev', port);
}
export function allocatePort(root, deps = {}) {
  return allocateNamedPort(root, 'dev', deps);
}
```

Alle foutmeldingen noemen lane, bereik en worktree. Alleen lane `dev` past
`configurations[name='dev'].port` aan.

- [ ] **Step 4: Maak guards lanegebonden**

Exporteer uit `scripts/dev-lock.mjs`:

```js
export function acquireNamedGuardLock(root, port, lane) { /* locknaam bevat lane */ }
export function acquireGuardLock(root, port) {
  return acquireNamedGuardLock(root, port, 'dev');
}
```

Valideer `lane` tegen een kleine veilige identifierregex voordat hij in een tijdelijk pad komt.

- [ ] **Step 5: Breid de shell-integratie uit**

Laat `tests/dev-server/integration.sh` ook twee gelijktijdige worktrees in de browserlane toewijzen
en bevestigen dat hun devmarkers ongewijzigd blijven.

- [ ] **Step 6: Draai de gerichte suite groen**

```bash
npm run test:dev-server
```

Verwacht: exit 0. Controleer ook expliciet:

```bash
node scripts/dev-server.mjs --print-plan
```

Verwacht: exit 0 en nog steeds een poort in 3007–3106.

- [ ] **Step 7: Commit de lane-infrastructuur**

```bash
git add scripts/dev-port.mjs scripts/dev-lock.mjs tests/dev-server/choose-free-port.test.mjs tests/dev-server/read-recorded-port.test.mjs tests/dev-server/allocate-port.test.mjs tests/dev-server/lock-variants.test.mjs tests/dev-server/integration.sh
git commit -m "test(dev): isoleer browserpoorten per worktree"
```

---

## Task 3: Bouw runner, browser-preflight en servercleanup

**Files:**
- Create: `scripts/run-browser-tests.mjs`
- Create: `scripts/browser-test-server.mjs`
- Create: `tests/dev-server/browser-runner.test.mjs`
- Create: `tests/browser/smoke.spec.ts`
- Modify: `tests/dev-server/integration.sh`
- Modify: `package.json`

- [ ] **Step 1: Schrijf runnercontracttests**

Test met geïnjecteerde dependencies dat de runner:

- `allocateNamedPort(root, 'browser')` aanroept;
- een geïnjecteerde headless launchpreflight uitvoert en de browser altijd onmiddellijk sluit;
- bij ontbrekende headless shell faalt met exact het herstelcommando
  `npx playwright install --only-shell chromium`;
- niet naar `chromium.executablePath()` of de full-Chromiumcache kijkt: een test laat het full-pad
  ontbreken terwijl de geïnjecteerde headless launch slaagt;
- `OPS_BROWSER_TEST_PORT` en `OPS_DEV_INSTANCE` aan het Playwrightproces doorgeeft;
- alle argumenten na `npm run test:browser --` in dezelfde volgorde aan de lokale Playwright-CLI
  doorgeeft;
- de exitcode van Playwright ongewijzigd retourneert.

- [ ] **Step 2: Implementeer `run-browser-tests.mjs`**

De module krijgt een exporteerbare kern voor de tests en een CLI-entry:

```js
export async function runBrowserTests({ root, allocate, preflightHeadless, spawnTest, args }) {
  // valideer root, allocate browserlane, launch/close headless shell, spawn lokale Playwright-CLI
}
```

Gebruik de lokale binary uit `node_modules/.bin`; val niet stil terug op een globale installatie.
De CLI-entry geeft `process.argv.slice(2)` ongewijzigd door, zodat `--list`, `--grep` en een los
specpad werkelijk werken. De productiepreflight doet `chromium.launch({ headless: true })` en sluit
de browser in `finally`; zo controleert hij dezelfde headless-shellbinary die `--only-shell`
installeert. Gebruik `chromium.executablePath()` niet als aanwezigheidscheck.

- [ ] **Step 3: Implementeer de webserver**

`scripts/browser-test-server.mjs`:

- valideert `OPS_BROWSER_TEST_PORT`;
- bepaalt de echte worktreeroot;
- claimt `acquireNamedGuardLock(root, port, 'browser')`;
- spawnt de lokale Vite-binary met `OPS_DEV_PORT=<browserpoort>` en
  `OPS_DEV_INSTANCE=<worktreeslug>-browser-test`;
- geeft stdout/stderr door;
- ruimt child en guard op bij normale exit, `SIGINT`, `SIGTERM` en spawnfout;
- retourneert de echte child-exitcode.

- [ ] **Step 4: Bewijs cleanup en dubbelstart**

Breid `tests/dev-server/integration.sh` uit met een kortlevende fake child of `--print-plan`-variant,
zodat een tweede browserguard geweigerd wordt en de guard na exit opnieuw claimbaar is.

- [ ] **Step 5: Voeg één echte bootstrap-smoketest toe**

`tests/browser/smoke.spec.ts` opent `/`, wacht op een zichtbare app-root en controleert dat
`window.__OPS__` bestaat. De test gebruikt de UI alleen als readinessbewijs en muteert geen state.
Hiermee heeft `--list` vanaf de eerste browsercommit altijd minstens één concrete test; "geen tests
gevonden" geldt als failure.

- [ ] **Step 6: Installeer lokaal alleen als de preflight daarom vraagt**

```bash
npx playwright install --only-shell chromium
```

Dit verandert geen repo-bestanden buiten eventuele toolcache.

- [ ] **Step 7: Maak de browsersuite bereikbaar, nog niet verplicht**

Voeg alleen toe:

```json
"test:browser": "node scripts/run-browser-tests.mjs"
```

Laat `test` en `verify` in deze commit nog ongewijzigd. De workflowprovisioning en verplichte
gatekoppeling landen samen in Task 6; daardoor blijven alle tussencommits groen op een schone CI-runner.

- [ ] **Step 8: Draai de infrastructuur groen**

```bash
npm run test:dev-server
npm run test:browser
npm run test:browser -- --list
```

Verwacht: alle drie exit 0. De volledige run opent en sluit de echte headless shell, laadt Vite en
voert `smoke.spec.ts` uit; `--list` bewijst daarnaast alleen argument-forwarding.

- [ ] **Step 9: Commit runner, server en opt-in script**

```bash
git add scripts/run-browser-tests.mjs scripts/browser-test-server.mjs tests/dev-server/browser-runner.test.mjs tests/dev-server/integration.sh tests/browser/smoke.spec.ts package.json
git commit -m "test(browser): start een bewaakte Vite-server per worktree"
```

---

## Task 4: Voeg een dev-only canvasdriver, paintobservatie en stabiele UI-ankers toe

**Files:**
- Create: `src/utils/ganttTestDriver.ts`
- Modify: `src/utils/devBridge.ts`
- Modify: `src/engine/renderer/GanttRenderer.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/layout/DocumentChrome/DocumentTabBar.tsx`
- Modify: `src/components/panels/TableEditor.tsx`
- Create: `tests/planning/check-gantt-test-driver.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Schrijf de falende geometriecheck**

Voeg een headless check toe voor:

```ts
renderer.getTaskBarRect(taskId):
  | { left: number; right: number; top: number; bottom: number }
  | null;
```

De check gebruikt een echte `GanttRenderer` met recording context en eist:

- onbekend id en datumloze taak geven `null`;
- bodypunt ligt binnen de rechthoek;
- dezelfde rechthoek laat `getTaskBarBounds(centerX, centerY)` dezelfde taak vinden;
- mijlpaal en summary volgen hun bestaande hit-testbeleid en krijgen geen fictieve sleeprect.

- [ ] **Step 2: Draai de planningcheck rood**

```bash
bash tests/planning/run.sh
```

Verwacht: exit ongelijk aan 0 op de ontbrekende publieke methode.

- [ ] **Step 3: Voeg uitsluitend een reverse locator toe**

Implementeer `getTaskBarRect` in `GanttRenderer` met dezelfde `rows`, `barGeometry`, `headerHeight`,
`rowHeight` en `scrollY` die tekenen/hit-testen al gebruiken. Verplaats geen geometrie uit de
renderer.

- [ ] **Step 4: Maak de dev-only registry**

`src/utils/ganttTestDriver.ts` bewaart refs, geen rendererdata:

```ts
export type GanttTestSurface = 'primary' | 'secondary';
export function registerGanttTestSurface(
  surface: GanttTestSurface,
  refs: {
    canvas: RefObject<HTMLCanvasElement | null>;
    renderer: RefObject<GanttRenderer | null>;
  },
): () => void;

export function taskBarPoint(
  taskId: string,
  edge?: 'left' | 'body' | 'right',
  surface?: GanttTestSurface,
): { x: number; y: number } | null;

export type GanttPaintSurface = GanttTestSurface | 'histogram';
export function recordGanttPaint(surface: GanttPaintSurface, width: number, height: number): void;
export function paintCount(surface: GanttPaintSurface): number;
export function lastSize(surface: GanttPaintSurface): { width: number; height: number } | null;
```

`taskBarPoint` zet canvas-CSS-coördinaten om naar clientcoördinaten met
`canvas.getBoundingClientRect()`. Hij muteert niets. De drie paintfuncties zijn eveneens observer-only:
de bestaande drawcallbacks roepen na een echte draw, uitsluitend in dev, `recordGanttPaint` aan. De
driver kan zelf geen draw starten. Voeg aan de headless check toe dat tellen en maatbewaring geen
renderer- of storemutatie veroorzaken.
Importeer `type RefObject` rechtstreeks uit `react`; gebruik geen globale `React`-namespace.

- [ ] **Step 5: Registreer oppervlakken alleen in dev**

Voeg in `GanttCanvas` effecten toe achter `import.meta.env.DEV` en geef de drie canvassen stabiele
ankers:

```tsx
data-testid="gantt-primary-canvas"
data-testid="gantt-secondary-canvas"
data-testid="gantt-histogram-canvas"
```

- [ ] **Step 6: Breid `window.__OPS__` getypeerd uit**

Voeg aan `OpsDevBridge` toe:

```ts
gantt: {
  taskBarPoint: typeof taskBarPoint;
  paintCount: typeof paintCount;
  lastSize: typeof lastSize;
};
```

Er komt geen setter of directe dragfunctie in de brug.

- [ ] **Step 7: Voeg DOM-ankers toe**

- Documenttab: behoud `data-ops-tab={card.id}` en voeg `data-testid="document-tab"` toe.
- TableEditor-root: `data-testid="task-table-editor"`.
- Elke bewerkbare cel: `data-testid="task-cell"`, `data-task-id` en een stabiele
  `data-field-key`; vertaalde labels zijn niet de locator.

- [ ] **Step 8: Draai statische, headless en browser-smokechecks groen**

```bash
npm run typecheck
bash tests/planning/run.sh
npm run test:browser
```

Verwacht: alle drie exit 0; de smoke laadt de uitgebreide dev-bridge in een echte browser.

- [ ] **Step 9: Commit de testnaad**

```bash
git add src/utils/ganttTestDriver.ts src/utils/devBridge.ts src/engine/renderer/GanttRenderer.ts src/components/canvas/GanttCanvas.tsx src/components/layout/DocumentChrome/DocumentTabBar.tsx src/components/panels/TableEditor.tsx tests/planning/check-gantt-test-driver.ts
git add -p tests/planning/run.sh
git diff --cached -- tests/planning/run.sh
git diff --cached --name-only
git commit -m "test(gantt): maak echte canvasinteractie lokaliseerbaar"
```

Selecteer bij `git add -p` uitsluitend de registratie van `check-gantt-test-driver.ts`. Verwacht in
de cached `run.sh`-diff géén `check-dependency-presentation.ts`; breek de commit af als die hunk toch
is meegestaged. Als beide regels in één patchhunk vallen, gebruik `s` om te splitsen of `e` om de
cached patch tot uitsluitend de eigen regel terug te brengen.

---

## Task 5: Leg de minimale gebruikersflows in de browser vast

**Files:**
- Create: `tests/browser/fixtures/ops.ts`
- Create: `tests/browser/gantt-drag-undo.spec.ts`
- Create: `tests/browser/document-switch.spec.ts`
- Create: `tests/browser/gantt-split-scroll.spec.ts`
- Create: `tests/browser/table-editor.spec.ts`

- [ ] **Step 1: Bouw een getypeerde fixture**

`tests/browser/fixtures/ops.ts`:

- wacht tot `window.__OPS__` bestaat;
- reset via de echte `newProject`-actie;
- seedt taken via `addTask`/`updateTask` en eindigt met `runCPM`;
- verzamelt `pageerror` en console-`error` en faalt in teardown als ze niet expliciet geaccepteerd
  zijn;
- levert kleine helpers `state(page)`, `seedProject(page, ...)` en `barPoint(page, taskId, edge)`.

- [ ] **Step 2: Schrijf drag + undo**

`gantt-drag-undo.spec.ts`:

1. seed één niet-samenvattende taak met vaste ISO-datums;
2. lees beginstate en undo-diepte;
3. vraag alleen het bodypunt op;
4. voer `page.mouse.move/down/move/up` uit met voldoende horizontale delta;
5. assert dat de datum via de store gewijzigd is en de undo-diepte exact één groeide;
6. voer de echte sneltoets `Control+z` uit (`Meta+z` op macOS is niet nodig in de Linux-gate);
7. assert exact de vooraf vastgelegde taakdatum en stacktoestand.

- [ ] **Step 3: Schrijf documentwissel met verschillende viewstates**

Maak document A en B via echte storeacties, geef ze verschillende `zoom`, `scrollX`, `scrollY` en
selecties, klik `[data-ops-tab='<id>']` en assert na elke wissel:

- `activeDocumentId`;
- taakset en selectie;
- `view.zoom/scrollX/scrollY`;
- DOM-`scrollLeft`/`scrollTop` van de drie bestaande scrollbar-testids.

- [ ] **Step 4: Schrijf split-/scrollkarakterisering**

Activeer splitview via de storefixture, scroll de secundaire horizontale scrollbar via DOM en de
verticale via een echt wheel-event. Assert:

- alleen `secondaryScrollX` verandert bij secundair horizontaal scrollen;
- `view.scrollX` blijft gelijk;
- `view.scrollY` verandert gedeeld en beide renderers blijven zonder pageerror actief.

- [ ] **Step 5: Karakteriseer de DOM-tabel**

Klik het echte Tabel-tabblad, open een naamcel via toetsenbord, wijzig de naam, commit met Enter en
assert storewaarde + één undo. Voer Ctrl+Z uit en assert herstel. Dit is de freeze-baseline voor
`TableEditor`.

- [ ] **Step 6: Draai de suite drie keer zonder retries**

```bash
npm run test:browser
npm run test:browser
npm run test:browser
```

Verwacht: drie keer exit 0. Een flake wordt gerepareerd; er worden geen retries toegevoegd.

- [ ] **Step 7: Commit browserflows**

```bash
git add tests/browser/fixtures/ops.ts tests/browser/gantt-drag-undo.spec.ts tests/browser/document-switch.spec.ts tests/browser/gantt-split-scroll.spec.ts tests/browser/table-editor.spec.ts
git commit -m "test(browser): bewaak Gantt documentwissel en tabelbedrading"
```

---

## Task 6: Provision Chromium in alle verify-gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/live.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`

- [ ] **Step 1: Voeg na `npm ci` dezelfde installatiestap toe**

In alleen `ci.test`, `live.gate` en `release.gate`:

```yaml
- name: Install Playwright Chromium
  run: npx playwright install --with-deps --only-shell chromium
```

- [ ] **Step 2: Upload foutartefacten in elk van de drie jobs**

Direct na `npm run verify`:

```yaml
- name: Upload Playwright failure artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-${{ github.job }}-${{ github.run_attempt }}
    path: |
      playwright-report/
      test-results/
    if-no-files-found: ignore
    retention-days: 7
```

Gebruik in workflows waar dezelfde jobnaam kan botsen eventueel een vaste workflowprefix in de
artefactnaam. Voeg geen browsercache toe.

- [ ] **Step 3: Koppel browser en workflowprovisioning in dezelfde commit**

Wijzig nu pas:

```json
"test": "npm run test:planning && npm run test:library && npm run test:mcp && npm run test:dev-server && npm run test:browser"
```

`test:browser` bestaat al sinds Task 3. Verander `verify` niet anders: de browsersuite erft via
`npm test`. Door `package.json` en de drie workflowbestanden samen te committen bestaat geen commit
waarin een schone CI-runner de verplichte suite zonder browser probeert te starten.

- [ ] **Step 4: Werk verouderde suitecomments bij**

Vervang in de drie workflows "vier testsuites" door "vijf testsuites". De commando-inhoud blijft
alleen in `package.json` gedefinieerd.

- [ ] **Step 5: Controleer structuur en draai de werkelijke lokale gate**

```bash
node -e "import('node:fs').then(fs=>{for(const f of ['.github/workflows/ci.yml','.github/workflows/live.yml','.github/workflows/release.yml']){const s=fs.readFileSync(f,'utf8');if(!s.includes('playwright install --with-deps --only-shell chromium'))process.exit(1)}})"
npm run test:browser
npm run verify
```

Verwacht: alle drie exit 0. De browserrun is een echte launch/smoke, niet `--list`; de laatste
exitcode bewijst de volledige nieuwe gedeelde gate vóór commit.

- [ ] **Step 6: Commit provisioning, artifacts en gatekoppeling atomair**

```bash
git add .github/workflows/ci.yml .github/workflows/live.yml .github/workflows/release.yml package.json
git diff --cached --name-only
git commit -m "ci: provision Chromium voor de gedeelde verify-poort"
```

---

## Task 7: Zet `rules-of-hooks` direct hard aan en maak de hookschuld zichtbaar

**Files:**
- Modify: `eslint.config.js`
- Create: `docs/superpowers/specs/2026-08-24-hooksite-ledger.md`

- [ ] **Step 1: Leg de actuele meting vast**

Maak de ledger met exact:

- nul `rules-of-hooks`-diagnoses;
- 21 normale `exhaustive-deps`-diagnoses;
- 21 inline suppressieregels;
- 42 diagnoses op 41 sites als inlineconfig wordt genegeerd;
- per site: bestand/regel, invariant, gekozen reparatie en vereiste regressiecheck.

Gebruik de volledige lijst uit het ontwerpdocument als start en actualiseer regelnummers vóór de
commit.

- [ ] **Step 2: Zet alleen de onomstreden regel hard aan**

```js
'react-hooks/rules-of-hooks': 'error',
'react-hooks/exhaustive-deps': 'warn',
```

Laat `reportUnusedDisableDirectives` tijdelijk `off`, omdat bestaande suppressies anders deze
tussencommit vervuilen.

- [ ] **Step 3: Draai lint**

```bash
npm run lint
```

Verwacht: exit 0, met precies 21 warnings en nul errors. Als de telling afwijkt, werk eerst de
ledger bij; ga niet verder op een oude meting.

- [ ] **Step 4: Commit de eerste hookpoort**

```bash
git add eslint.config.js docs/superpowers/specs/2026-08-24-hooksite-ledger.md
git commit -m "chore(lint): dwing geldige React-hookaanroepen af"
```

---

## Task 8: Repareer eenvoudige dependency- en callbacksites

**Files:**
- Modify: `src/components/backstage/Backstage.tsx`
- Modify: `src/components/backstage/HelpPanel.tsx`
- Modify: `src/components/canvas/hooks/useBarDrag.ts`
- Modify: `src/components/canvas/hooks/useBoxSelect.ts`
- Modify: `src/components/canvas/hooks/useDependencyDraw.ts`
- Modify: `src/components/canvas/hooks/usePan.ts`
- Modify: `src/components/dialogs/CalendarDialog.tsx`
- Modify: `src/components/panels/IFCPanel.tsx`
- Modify: `src/components/panels/RelationsPanel.tsx`
- Modify: `src/hooks/useAutoSave.ts`
- Modify: `src/hooks/useGanttZoom.ts`
- Modify: `src/hooks/useSettingsBootstrap.ts`

- [ ] **Step 1: Voeg alleen stabiele echte dependencies toe**

Volg per site de ledger. Zustand-acties, React-refs en i18next-`t`-callbacks mogen rechtstreeks in de
array. Maak `Backstage.closeBackstage`, de Help-handlers en Relations-`rowData` met `useCallback` of
`useMemo` stabiel voordat ze worden toegevoegd.

- [ ] **Step 2: Draai lint en noteer de nieuwe telling**

```bash
npm run lint
```

Verwacht: exit 0 en alle warnings uit deze bestandsset verdwenen.

- [ ] **Step 3: Draai gerichte gedragsbatterijen**

```bash
bash tests/planning/run.sh
npm run test:browser -- --grep "Gantt|document"
```

Verwacht: beide exit 0.

- [ ] **Step 4: Commit de mechanisch veilige groep**

```bash
git add src/components/backstage/Backstage.tsx src/components/backstage/HelpPanel.tsx src/components/canvas/hooks/useBarDrag.ts src/components/canvas/hooks/useBoxSelect.ts src/components/canvas/hooks/useDependencyDraw.ts src/components/canvas/hooks/usePan.ts src/components/dialogs/CalendarDialog.tsx src/components/panels/IFCPanel.tsx src/components/panels/RelationsPanel.tsx src/hooks/useAutoSave.ts src/hooks/useGanttZoom.ts src/hooks/useSettingsBootstrap.ts
git commit -m "fix(hooks): sluit eenvoudige stale-closurepaden"
```

---

## Task 9: Modelleer langlopende gestures met actuele refs

**Files:**
- Modify: `src/components/canvas/hooks/useRowDrag.ts`
- Modify: `src/components/panels/hooks/useTableRowDrag.ts`
- Modify: `src/hooks/useSplitter.ts`
- Create: `src/hooks/useLatestRef.ts`
- Modify: `tests/browser/gantt-drag-undo.spec.ts`
- Modify: `tests/browser/table-editor.spec.ts`
- Create: `tests/browser/splitter.spec.ts`

- [ ] **Step 1: Schrijf eerst gesturecases die props tijdens een sleep laten wijzigen**

Voeg cases toe waarin tijdens een actieve rowdrag/splitterdrag een relevante storewaarde wijzigt en
de mouseup nog steeds precies één mutatie/commit uitvoert. Escape moet zonder mutatie annuleren.

- [ ] **Step 2: Zie minstens één nieuwe case falen of documenteer karakterisering**

```bash
npm run test:browser -- --grep "drag|splitter"
```

Leg in de testkop vast of de case vóór de refactor rood was of bestaand gedrag karakteriseert.

- [ ] **Step 3: Voeg een kleine actuele-refhelper toe**

```ts
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
```

Importeer `useRef` en `type RefObject` rechtstreeks uit `react`; maak hiervoor geen globale
`React`-namespaceafhankelijkheid.

Gebruik deze alleen voor eventlisteners die bewust voor de duur van een gesture gekoppeld blijven.

- [ ] **Step 4: Stabiliseer hoverberekening en splitteropties**

- Rowdrag-hooks: actuele rows/maps/callbacks via één optionsref of een stabiele `computeHover`.
- `useSplitter`: effect hangt alleen van `isResizing` af en leest `optsRef.current` per event.
- De listenercleanup blijft dezelfde functie-identiteiten verwijderen.

- [ ] **Step 5: Verwijder de vier rowdrag- en splitter-suppressies**

```bash
npm run lint
npm run test:browser -- --grep "drag|splitter"
```

Verwacht: beide exit 0.

- [ ] **Step 6: Commit gesturelifecycle**

```bash
git add src/hooks/useLatestRef.ts src/hooks/useSplitter.ts src/components/canvas/hooks/useRowDrag.ts src/components/panels/hooks/useTableRowDrag.ts tests/browser/gantt-drag-undo.spec.ts tests/browser/table-editor.spec.ts tests/browser/splitter.spec.ts
git commit -m "fix(hooks): houd gesturelisteners actueel zonder herkoppelen"
```

---

## Task 10: Verwijder verborgen invalidatiedependencies uit canvas en bezetting

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/canvas/MiniMap.tsx`
- Modify: `src/components/canvas/hooks/useCanvasLayer.ts`
- Modify: `src/components/panels/ResourceOccupancyView.tsx`
- Modify: `tests/library/check-occupancy.ts`
- Modify: `tests/browser/gantt-split-scroll.spec.ts`
- Create: `tests/browser/theme-render.spec.ts`

- [ ] **Step 1: Schrijf falende/karakteriserende invalidatiechecks**

- Themawissel tekent Gantt en minimap opnieuw zonder pageerror.
- Histogramhoogtewijziging tekent exact opnieuw zonder ResizeObserver-loop.
- Actieve-documentedit wijzigt het bezettingsoverzicht zonder documentwissel.
- Pool- of companywissel gebruikt geen cache uit de vorige combinatie.

- [ ] **Step 2: Vervang `extraDeps` door één primitive revision**

Wijzig het hookcontract:

```ts
export interface UseCanvasLayerOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  enabled?: boolean;
  renderRevision?: string | number;
}
```

Het effect gebruikt `[paint, enabled, renderRevision]`; geen spreaddependency.

- [ ] **Step 3: Maak theme en split expliciet**

- Bouw een primitive theme-revision uit `uiTheme` en geef die aan de canvaslaag.
- Gebruik `const splitEnabled = splitView !== null` in het wheel-effect.
- De wheelhandler leest actuele splitstate uit `useAppStore.getState()` zoals nu, maar de array bevat
  alleen `[splitEnabled]`.

- [ ] **Step 4: Maak occupancy-invoer zichtbaar**

- Vervang `sliceCache` door een refrecord met concrete `companyId`/`pool`-sleutel.
- Bouw `openDocumentPayloads` uit de geabonneerde top-level velden vóór de zware memo, of lever één
  expliciete `openDocumentRevision` vanuit de document-slice.
- De zware memo leest geen verborgen actuele storewaarde via een stabiele getter zonder dat die in
  zijn invoer staat.

- [ ] **Step 5: Draai library-, browser- en lintchecks**

```bash
npm run lint
npm run test:library
npm run test:browser -- --grep "theme|split|histogram|occupancy"
```

Verwacht: alle drie exit 0.

- [ ] **Step 6: Commit expliciete invalidatie**

```bash
git add src/components/canvas/GanttCanvas.tsx src/components/canvas/MiniMap.tsx src/components/canvas/hooks/useCanvasLayer.ts src/components/panels/ResourceOccupancyView.tsx tests/library/check-occupancy.ts tests/browser/gantt-split-scroll.spec.ts tests/browser/theme-render.spec.ts
git commit -m "refactor(hooks): modelleer canvas- en documentinvalidatie expliciet"
```

---

## Task 11: Repareer synchronisatie-effecten zonder gebruikersinvoer te wissen

**Files:**
- Modify: `src/components/common/Select.tsx`
- Modify: `src/components/common/SequenceLagInput.tsx`
- Modify: `src/components/dialogs/PoolImportDialog.tsx`
- Modify: `src/components/dialogs/ScreenshotAnnotator.tsx`
- Modify: `src/components/dialogs/UpdateDialog.tsx`
- Modify: `src/components/panels/DebugTerminal.tsx`
- Modify: `src/hooks/useRecoveryRestore.ts`
- Create: `tests/browser/hook-synchronization.spec.ts`

- [ ] **Step 1: Schrijf de gebruikersinvariant per component**

De browserspec dekt:

- Select: highlight initialiseert bij openen, maar optiesupdate tijdens open menu wist de cursor niet;
- SequenceLagInput: wijziging van een ongerelateerd sequenceveld wist half ingevoerde lag niet;
- PoolImportDialog: bedrijfsupdate tijdens een open dialoog overschrijft handmatige keuze niet;
- DebugTerminal: nieuwe entries bewegen een gepauzeerd snapshot niet;
- ScreenshotAnnotator: shape-update schaalt canvas niet opnieuw en tekent wel opnieuw;
- UpdateDialog: één check per open-sessie;
- taalwissel start recovery niet voor een tweede keer.

- [ ] **Step 2: Gebruik primitive synchronisatiesleutels of refs**

- `SequenceLagInput`: `lagSignature(seq)` met alleen de vier weergegeven lagvelden.
- `Select`: bewaar actuele indices in refs; effect triggert alleen op `open`.
- `DebugTerminal`: `entriesRef.current = entries`; pauze-effect leest de ref.
- `useRecoveryRestore`: leg `t` éénmalig in een opstartref vast.
- Screenshot: behoud apart resize- en redraw-effect.
- Update: `runCheck` als stabiele callback.

- [ ] **Step 3: Draai de gerichte browsercase en lint**

```bash
npm run test:browser -- --grep "hook synchronization"
npm run lint
```

Verwacht: beide exit 0 en de behandelde warnings/suppressies weg.

- [ ] **Step 4: Commit synchronisatie-effecten**

```bash
git add src/components/common/Select.tsx src/components/common/SequenceLagInput.tsx src/components/dialogs/PoolImportDialog.tsx src/components/dialogs/ScreenshotAnnotator.tsx src/components/dialogs/UpdateDialog.tsx src/components/panels/DebugTerminal.tsx src/hooks/useRecoveryRestore.ts tests/browser/hook-synchronization.spec.ts
git commit -m "fix(hooks): scheid propsync van actieve gebruikersinvoer"
```

---

## Task 12: Stabiliseer rapport-, tour- en resourceflows

**Files:**
- Modify: `src/components/panels/ReportPanel.tsx`
- Modify: `src/components/panels/ResourcePanel.tsx`
- Modify: `src/components/tour/TourOverlay.tsx`
- Create: `tests/browser/report-options.spec.ts`
- Create: `tests/browser/resource-panel-effects.spec.ts`
- Create: `tests/browser/tour-layout.spec.ts`

- [ ] **Step 1: Schrijf eerst de drie regressieclusters**

- Rapportpreview en export gebruiken na optie-/headerwijziging dezelfde actuele opties.
- Resourcepaneel reset alleen op mount/koppelingsovergang; pending-new opent één draft en focus;
  viewwissel ruimt uitsluitend de juiste draft op.
- Tour bewaart/restaureert UI-snapshot, slaat een ontbrekend anker correct over en hermeet na
  taal-/inhoudswijziging zonder lus.

- [ ] **Step 2: Maak rapportopties één waardeobject**

Gebruik `useMemo<PrintOptions>` met alle concrete invoervelden. Preview-effect hangt van dit object
en zijn echte documentinvoer af. Exportcallback bevat `repeatHeader` en `timelineColumns` als die
buiten `options` zelfstandig gelezen worden.

- [ ] **Step 3: Snijd benoemde resourcehooks uit**

Maak in hetzelfde bestand of `src/components/panels/hooks/` kleine hooks met één effectdoel:

- `useResourceViewReset`;
- `usePendingResourceDraft`;
- stabiele `openDraft` en `variantForView`.

Dit is een lokale hookreparatie, geen structurele TableEditor-revisie.

- [ ] **Step 4: Vervang tourmeting door `ResizeObserver`**

Eén effect observeert `cardRef`, vergelijkt width/height vóór setState en disconnect bij cleanup.
Voorbereiden/meten hangt van stabiele `step`, `finish` en `goTo` af. Het startsnapshot blijft één
mountactie met de stabiele `setUI`-dependency.

- [ ] **Step 5: Draai de gerichte browserspecs**

```bash
npm run test:browser -- --grep "report options|resource panel|tour layout"
npm run lint
```

Verwacht: beide exit 0.

- [ ] **Step 6: Commit de complexe effectgroep**

```bash
git add src/components/panels/ReportPanel.tsx src/components/panels/ResourcePanel.tsx src/components/tour/TourOverlay.tsx tests/browser/report-options.spec.ts tests/browser/resource-panel-effects.spec.ts tests/browser/tour-layout.spec.ts
git commit -m "fix(hooks): maak rapport tour en resource-effecten deterministisch"
```

---

## Task 13: Sluit hooklint en documenteer de vijfde suite

**Files:**
- Modify: `eslint.config.js`
- Modify: `docs/superpowers/specs/2026-08-24-hooksite-ledger.md`
- Modify: `CLAUDE.md`
- Modify: `docs/self-test-harness.md`

- [ ] **Step 1: Controleer dat geen suppressie overblijft**

```bash
rg -n "eslint-disable.*react-hooks/(exhaustive-deps|rules-of-hooks)" src
```

Verwacht: exit 1 en geen uitvoer. Als een lokale suppressie aantoonbaar noodzakelijk blijkt, leg
dan in de ledger de functionele reden plus regressietest vast en laat deze stap precies die ene site
verwachten; voeg nooit een globale uitzondering toe.

- [ ] **Step 2: Zet beide regels en unused-directives hard**

```js
linterOptions: { reportUnusedDisableDirectives: 'error' },
rules: {
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  'no-control-regex': 'error',
  'react-hooks/exhaustive-deps': 'error',
  'react-hooks/rules-of-hooks': 'error',
},
```

Verwijder de verouderde commentaartekst over achttien suppressies.

- [ ] **Step 3: Werk de ledger af**

Markeer alle 41 sites als opgelost met commit/testbewijs. De ledger beschrijft geen open werk meer.

- [ ] **Step 4: Werk commandodocumentatie bij**

- `CLAUDE.md`: vijf gedragsuites, Playwright-installatie en foutartefacten.
- `docs/self-test-harness.md`: `npm run test:browser`, echte interactie versus dev-bridge-assertie,
  en de dev-only Ganttlocator.

Raak het lokaal gewijzigde `AGENTS.md` niet aan in deze uitvoering.

- [ ] **Step 5: Draai alle lokale poorten**

```bash
npm run lint
npm run typecheck
npm test
```

Verwacht: alle drie exit 0.

- [ ] **Step 6: Commit de harde hookpoort**

```bash
git add eslint.config.js docs/superpowers/specs/2026-08-24-hooksite-ledger.md CLAUDE.md docs/self-test-harness.md
git commit -m "chore(verify): maak browser- en hookchecks verplicht"
```

---

## Task 14: Volledige Plan-0-verificatie en stopbesluit

**Files:** geen productwijzigingen; alleen bewijs verzamelen.

- [ ] **Step 1: Start schoon vanaf de repo-instructies**

```bash
git status --short
node --version
npm --version
```

Bevestig Node 22. Noteer en preserveer alle niet-Plan-0-wijzigingen.

- [ ] **Step 2: Draai de werkelijke gate**

```bash
npm run verify
```

Verwacht: exit 0. De exitcode is leidend; een groene samenvattingsregel uit een deelsuite is niet
genoeg.

- [ ] **Step 3: Draai browserstabiliteit nog tweemaal**

```bash
npm run test:browser
npm run test:browser
```

Verwacht: tweemaal exit 0, zonder retries.

- [ ] **Step 4: Controleer de structurele eindvoorwaarden**

```bash
rg -n "react-hooks/(exhaustive-deps|rules-of-hooks).*off" eslint.config.js
rg -n "eslint-disable.*react-hooks/(exhaustive-deps|rules-of-hooks)" src
rg -n '"test:browser"' package.json
rg -n "playwright install --with-deps --only-shell chromium" .github/workflows/{ci,live,release}.yml
```

Verwacht: de eerste twee commando's exit 1 zonder uitvoer; de laatste twee vinden respectievelijk
één script en drie workflowstappen.

- [ ] **Step 5: Stop als een bewijsvoorwaarde niet klopt**

Plan 1 mag niet beginnen bij een rode gate, een flake, een ontbrekende browserinstallatie of een
onafgehandelde hooksite. Repareer binnen Plan 0; verlaag de poort niet.
