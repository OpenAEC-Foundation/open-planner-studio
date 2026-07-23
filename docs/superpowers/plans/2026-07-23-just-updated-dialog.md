# "Je bent net geüpdatet"-dialoog — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na een geslaagde in-app update bij de eerstvolgende start een korte "Je bent bijgewerkt!"-dialoog tonen met versiesprong, grootteverschil van de installer, tijd sinds de vorige release, en de GitHub-release-beschrijving.

**Architecture:** Desktop-only (Tauri). Bij opstart vergelijkt een pure detectiefunctie de opgeslagen `ops-lastVersion` met `getVersion()`; bij een sprong zet de bootstrap-hook `ui.justUpdated = { from, to }`. Een nieuwe `JustUpdatedDialog` haalt via één ongeauthenticeerde GitHub Releases-API-call de release-body, `published_at` van huidige+vorige release (→ dagen ertussen) en de installer-asset-groottes (→ grootteverschil) op. Zware logica zit in pure, headless-testbare functies (`releaseInfo.ts`); de React-laag is dun. Alle `@tauri-apps/*`-imports zijn dynamisch achter `isTauri()`.

**Tech Stack:** React 19 + Zustand/Immer, TypeScript (strict), react-i18next (14 locales), lucide-react iconen, Tauri 2 (`@tauri-apps/api/app`, `@tauri-apps/plugin-os`), esbuild+node headless tests (patroon `tests/planning/check-*.ts`).

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid | Nieuw/Wijzig |
|---------|----------------------|--------------|
| `src/services/updater/releaseInfo.ts` | Pure vergelijk-/asset-/detectielogica + `fetchReleaseComparison` (fetch-wrapper) | **Nieuw** |
| `tests/planning/check-just-updated.ts` | Headless tests voor de pure functies | **Nieuw** |
| `src/utils/settingsStore.ts` | `loadLastVersion` / `saveLastVersion` | Wijzig |
| `src/state/slices/types.ts` | `justUpdated`-veld in `UIState` | Wijzig |
| `src/state/slices/uiSlice.ts` | Default `justUpdated: null` | Wijzig |
| `src/hooks/useUpdateCheck.ts` | "Net geüpdatet"-detectie bij opstart | Wijzig |
| `src/components/dialogs/JustUpdatedDialog.tsx` | De dialoog | **Nieuw** |
| `src/App.tsx` | Dialoog lazy mounten achter `ui.justUpdated` | Wijzig |
| `src/i18n/locales/*/common.json` (14×) | `updates.justUpdated.*`-sleutels | Wijzig |
| `tests/planning/run.sh` | `check-just-updated` in de suite opnemen | Wijzig |

**Ontwerpbeslissingen die het plan vastlegt (uit de spec):**
- Iconen: lucide (`PartyPopper` titel, `ArrowDown`/`ArrowUp` grootte, `Clock` tijd). Geen emoji.
- Tijd: alleen dagen, **geen** i18next-plural — we gebruiken het "label: getal"-patroon (`Sinds de vorige release: {{count}} dagen`) zodat er geen meervoudscongruentie én geen Engels-lek-valkuil ontstaat (zie de docstring van `tests/planning/check-i18n-plurals.ts`). De "1 dagen"-imperfectie is bewust geaccepteerd; releases liggen zelden één dag uit elkaar.
- Body: platte `<pre>`-tekst (identiek aan `UpdateDialog`), geen markdown-rendering.
- "Wat is er nieuw"-kop: hergebruik de bestaande sleutel `updates.releaseNotes`.
- Netwerk: globale `fetch` naar `api.github.com` (CSP is `null` in `tauri.conf.json` → toegestaan, geen `http`-plugin/Rust-wijziging nodig).

---

## Task 1: UI-state `justUpdated` + `lastVersion`-persistentie

**Files:**
- Modify: `src/state/slices/types.ts` (in de `UIState`-interface, bij regel 122 `showUpdateDialog`)
- Modify: `src/state/slices/uiSlice.ts:36` (na `showUpdateDialog: false,`)
- Modify: `src/utils/settingsStore.ts` (na `saveWelcomeSeen`, rond regel 283)

- [ ] **Step 1: Voeg het `justUpdated`-veld toe aan `UIState`**

In `src/state/slices/types.ts`, direct na de regel `showUpdateDialog: boolean;`:

```ts
  /** Fase "kleine dingen": als de app zojuist naar een nieuwe versie is geüpdatet, bevat dit de
   *  versiesprong (van → naar) en toont `JustUpdatedDialog` zich. `null` = geen sprong (normale
   *  start of verse installatie). Desktop-only; in de web-build altijd `null`. */
  justUpdated: { from: string; to: string } | null;
```

- [ ] **Step 2: Zet de default in `uiSlice.ts`**

In `src/state/slices/uiSlice.ts`, in `createDefaultUI()` direct na `showUpdateDialog: false,`:

```ts
    justUpdated: null,
```

- [ ] **Step 3: Voeg de persistente helpers toe aan `settingsStore.ts`**

Na `saveWelcomeSeen` (rond regel 283):

```ts
// "Je bent net geüpdatet"-detectie (fase "kleine dingen"): de laatst gestarte appversie. Bij de
// volgende start vergelijken we deze met `getVersion()`; verschillen ze, dan is er net geüpdatet.
// Ontbreekt de sleutel (verse installatie), dan tonen we NIETS en schrijven we 'm alleen weg.
// Zelfde ops-* localStorage-pad als alle andere instellingen.
export async function loadLastVersion(): Promise<string | undefined> {
  const v = await getSetting<string>('lastVersion');
  return typeof v === 'string' && v ? v : undefined;
}

export async function saveLastVersion(value: string): Promise<void> {
  await setSetting('lastVersion', value);
}
```

- [ ] **Step 4: Verifieer dat het typecheckt**

Run: `npm run build`
Expected: `tsc` compileert zonder fouten (build slaagt of faalt pas later op nog-niet-bestaande imports — voer deze stap uit vóór Task 6/7 die de nieuwe bestanden toevoegen; als je tasks op volgorde doet is dit groen).

- [ ] **Step 5: Commit**

```bash
git add src/state/slices/types.ts src/state/slices/uiSlice.ts src/utils/settingsStore.ts
git commit -m "feat(update): ui.justUpdated-state + ops-lastVersion-persistentie"
```

---

## Task 2: Pure detectiefunctie + asset-/vergelijklogica (`releaseInfo.ts`)

Dit is de kern-logica als **pure functies** (geen React, geen netwerk), zodat ze headless testbaar zijn. De fetch-wrapper komt in Task 4.

**Files:**
- Create: `src/services/updater/releaseInfo.ts`

- [ ] **Step 1: Schrijf `releaseInfo.ts` met de types en pure functies**

```ts
/**
 * Release-vergelijking voor de "Je bent net geüpdatet"-dialoog.
 *
 * Bevat pure, headless-testbare functies (detectie, asset-keuze, dagen-tussen, vergelijking) plus
 * één fetch-wrapper (`fetchReleaseComparison`, zie onder) die de GitHub Releases-API bevraagt.
 * Desktop-only qua gebruik, maar de pure functies hebben geen Tauri-afhankelijkheid.
 */
import type { InstallKind } from './updaterService';

const REPO = 'OpenAEC-Foundation/open-planner-studio';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=30`;

/** Minimale vorm van een GitHub-release-asset die we gebruiken. */
export interface GhAsset {
  name: string;
  size: number;
}

/** Minimale vorm van een GitHub-release die we gebruiken. */
export interface GhRelease {
  tag_name: string;
  published_at: string;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GhAsset[];
}

/** Resultaat dat de dialoog toont. Elk veld kan `null` zijn als de brondata ontbrak. */
export interface ReleaseComparison {
  currentBody: string;
  daysBetween: number | null;
  sizeDeltaBytes: number | null;
  currentSizeBytes: number | null;
}

/** OS-namen zoals `@tauri-apps/plugin-os` `platform()` ze teruggeeft (subset die we nodig hebben). */
export type OsName = 'linux' | 'windows' | 'macos' | string;

/**
 * Pure detectie: is de app zojuist geüpdatet? Geeft de versiesprong terug, of `null`.
 * - `stored` ontbreekt (verse installatie) → `null` (niets tonen).
 * - `stored === current` (normale start) → `null`.
 * - anders → `{ from: stored, to: current }` (ook bij downgrade).
 */
export function detectJustUpdated(
  stored: string | undefined,
  current: string,
): { from: string; to: string } | null {
  if (!stored) return null;
  if (stored === current) return null;
  return { from: stored, to: current };
}

/** Normaliseer een versie/tag door een eventuele `v`-prefix te strippen. */
function normalizeVersion(v: string): string {
  return v.replace(/^v/i, '');
}

/**
 * Kies de installer-asset die bij dit install-type + OS hoort, voor de grootteweergave.
 * Retourneert `null` als er geen passende asset is (bv. snap, of asset ontbreekt in de release).
 * `.sig`-bestanden worden altijd genegeerd.
 */
export function pickInstallerAsset(
  assets: GhAsset[],
  installKind: InstallKind,
  os: OsName,
): GhAsset | null {
  const candidates = assets.filter((a) => !a.name.toLowerCase().endsWith('.sig'));
  const endsWith = (suffix: string) =>
    candidates.find((a) => a.name.toLowerCase().endsWith(suffix.toLowerCase())) ?? null;

  switch (installKind) {
    case 'appimage':
      return endsWith('.appimage');
    case 'deb':
      return endsWith('amd64.deb');
    case 'snap':
      return null; // snap-installs krijgen geen GitHub-installer-asset
    case 'native':
      if (os === 'windows') return endsWith('-setup.exe');
      if (os === 'macos') return endsWith('.dmg');
      return null;
    default:
      return null;
  }
}

/** Hele dagen tussen twee ISO-datums (previous → current). `null` bij een ongeldige datum. */
export function daysBetween(previousIso: string, currentIso: string): number | null {
  const prev = Date.parse(previousIso);
  const cur = Date.parse(currentIso);
  if (Number.isNaN(prev) || Number.isNaN(cur)) return null;
  const ms = cur - prev;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Vind in een (nieuw→oud gesorteerde) releaselijst de huidige release (op tag) en de release
 * die daarvóór is uitgebracht (eerste niet-draft/niet-prerelease met een oudere `published_at`).
 */
export function findCurrentAndPrevious(
  releases: GhRelease[],
  currentVersion: string,
): { current: GhRelease | null; previous: GhRelease | null } {
  const target = normalizeVersion(currentVersion);
  const current =
    releases.find((r) => normalizeVersion(r.tag_name) === target) ?? null;
  if (!current) return { current: null, previous: null };

  const curTime = Date.parse(current.published_at);
  const previous =
    releases
      .filter(
        (r) =>
          !r.draft &&
          !r.prerelease &&
          normalizeVersion(r.tag_name) !== target &&
          Date.parse(r.published_at) < curTime,
      )
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0] ?? null;

  return { current, previous };
}

/**
 * Pure vergelijking: bouw het `ReleaseComparison`-resultaat uit de gevonden releases.
 * Ontbrekende data → het betreffende veld wordt `null` (nette degradatie in de UI).
 */
export function computeComparison(
  current: GhRelease,
  previous: GhRelease | null,
  installKind: InstallKind,
  os: OsName,
): ReleaseComparison {
  const currentAsset = pickInstallerAsset(current.assets, installKind, os);
  const previousAsset = previous
    ? pickInstallerAsset(previous.assets, installKind, os)
    : null;

  const currentSizeBytes = currentAsset ? currentAsset.size : null;
  const sizeDeltaBytes =
    currentAsset && previousAsset ? currentAsset.size - previousAsset.size : null;
  const dayCount = previous ? daysBetween(previous.published_at, current.published_at) : null;

  return {
    currentBody: current.body ?? '',
    daysBetween: dayCount,
    sizeDeltaBytes,
    currentSizeBytes,
  };
}

export { RELEASES_API };
```

- [ ] **Step 2: Verifieer dat het typecheckt (los)**

Run: `node_modules/.bin/esbuild src/services/updater/releaseInfo.ts --bundle --platform=node --format=esm --alias:@=src --outfile=/tmp/_ri.mjs`
Expected: bundelt zonder fouten (geen ontbrekende imports; `InstallKind` komt uit `updaterService.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/services/updater/releaseInfo.ts
git commit -m "feat(update): pure release-vergelijklogica (detectie, asset-keuze, dagen, compare)"
```

---

## Task 3: Headless tests voor de pure functies

Volgt het `tests/planning/check-*.ts`-patroon: één bestand dat asserts doet en bij een afwijking `process.exitCode = 1` zet. In een worktree heeft `node_modules/.bin/esbuild` mogelijk geen echte binary — symlink dan de parent-esbuild (zie de projectconventie voor worktrees).

**Files:**
- Create: `tests/planning/check-just-updated.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Schrijf het testbestand**

```ts
/**
 * Contract-check voor de "Je bent net geüpdatet"-vergelijklogica (releaseInfo.ts).
 * Pure functies → headless, geen store/DOM nodig. Exit 1 bij een afwijking.
 */
import {
  detectJustUpdated,
  pickInstallerAsset,
  daysBetween,
  findCurrentAndPrevious,
  computeComparison,
  type GhRelease,
} from '@/services/updater/releaseInfo';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.error(`XX ${name}`);
  } else {
    console.log(`ok ${name}`);
  }
}

// ── detectJustUpdated ──────────────────────────────────────────────
check('detect: verse install → null', detectJustUpdated(undefined, '2026.7.11') === null);
check('detect: gelijk → null', detectJustUpdated('2026.7.11', '2026.7.11') === null);
check('detect: sprong → van/naar', JSON.stringify(detectJustUpdated('2026.7.10', '2026.7.11')) === JSON.stringify({ from: '2026.7.10', to: '2026.7.11' }));
check('detect: downgrade telt ook', detectJustUpdated('2026.7.11', '2026.7.10') !== null);

// ── daysBetween ────────────────────────────────────────────────────
check('days: 12 dagen', daysBetween('2026-07-01T00:00:00Z', '2026-07-13T00:00:00Z') === 12);
check('days: zelfde dag = 0', daysBetween('2026-07-13T09:00:00Z', '2026-07-13T20:00:00Z') === 0);
check('days: ongeldige datum → null', daysBetween('niet-een-datum', '2026-07-13T00:00:00Z') === null);

// ── pickInstallerAsset ─────────────────────────────────────────────
const assets = [
  { name: 'ops_2026.7.11_amd64.AppImage', size: 90_000_000 },
  { name: 'ops_2026.7.11_amd64.AppImage.sig', size: 200 },
  { name: 'ops_2026.7.11_amd64.deb', size: 45_000_000 },
  { name: 'ops_2026.7.11_x64-setup.exe', size: 12_000_000 },
  { name: 'ops_2026.7.11_universal.dmg', size: 30_000_000 },
];
check('asset: appimage', pickInstallerAsset(assets, 'appimage', 'linux')?.size === 90_000_000);
check('asset: deb', pickInstallerAsset(assets, 'deb', 'linux')?.size === 45_000_000);
check('asset: native windows → -setup.exe', pickInstallerAsset(assets, 'native', 'windows')?.size === 12_000_000);
check('asset: native macos → dmg', pickInstallerAsset(assets, 'native', 'macos')?.size === 30_000_000);
check('asset: snap → null', pickInstallerAsset(assets, 'snap', 'linux') === null);
check('asset: negeert .sig', pickInstallerAsset(assets, 'appimage', 'linux')?.name.endsWith('.sig') === false);
check('asset: ontbrekend → null', pickInstallerAsset([], 'appimage', 'linux') === null);

// ── findCurrentAndPrevious + computeComparison ─────────────────────
const releases: GhRelease[] = [
  { tag_name: 'v2026.7.11', published_at: '2026-07-13T00:00:00Z', body: 'Nieuw in .11', prerelease: false, draft: false, assets: [{ name: 'ops_x64-setup.exe', size: 12_000_000 }] },
  { tag_name: 'v2026.7.10-beta', published_at: '2026-07-05T00:00:00Z', body: 'beta', prerelease: true, draft: false, assets: [] },
  { tag_name: 'v2026.7.10', published_at: '2026-07-01T00:00:00Z', body: 'oud', prerelease: false, draft: false, assets: [{ name: 'ops_x64-setup.exe', size: 15_000_000 }] },
];
const found = findCurrentAndPrevious(releases, '2026.7.11');
check('find: huidige op tag (met v-prefix tolerantie)', found.current?.tag_name === 'v2026.7.11');
check('find: vorige slaat prerelease over', found.previous?.tag_name === 'v2026.7.10');

const cmp = computeComparison(found.current!, found.previous, 'native', 'windows');
check('compare: body van huidige', cmp.currentBody === 'Nieuw in .11');
check('compare: 12 dagen', cmp.daysBetween === 12);
check('compare: 3 MB kleiner (negatief)', cmp.sizeDeltaBytes === -3_000_000);
check('compare: huidige grootte', cmp.currentSizeBytes === 12_000_000);

// Geen vorige release → size/tijd null, body blijft.
const soloCmp = computeComparison(found.current!, null, 'native', 'windows');
check('compare: zonder vorige → daysBetween null', soloCmp.daysBetween === null);
check('compare: zonder vorige → sizeDelta null', soloCmp.sizeDeltaBytes === null);
check('compare: zonder vorige → body wel', soloCmp.currentBody === 'Nieuw in .11');

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
```

- [ ] **Step 2: Draai de test los en zie 'm groen worden**

Run (vanuit de repo-root; symlink zo nodig eerst `node_modules/.bin/esbuild` in de worktree):

```bash
node_modules/.bin/esbuild tests/planning/check-just-updated.ts \
  --bundle --platform=node --format=esm --alias:@=src \
  --define:import.meta.env.DEV=false --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' --define:__OPS_DEV_INSTANCE__='"test"' \
  --outfile=tests/planning/.just-updated-check.mjs && node tests/planning/.just-updated-check.mjs
```

Expected: alle regels `ok …`, afsluitend `TOTAAL: alles groen`, exit 0. (Geen `XX`-regels.)

- [ ] **Step 3: Neem de check op in `run.sh`**

In `tests/planning/run.sh`, in het `RUN_HOLIDAYS`-blok (bij de andere losse checks, ná bv. het datetime-check-blok), voeg toe — exact hetzelfde patroon als de bestaande checks:

```bash
  # "Je bent net geüpdatet"-vergelijklogica (releaseInfo.ts — pure functies, los van de CPM-cases).
  JUCHECK="$DIR/.just-updated-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-just-updated.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$JUCHECK" >/dev/null 2>&1
  node "$JUCHECK" || STATUS=1
```

- [ ] **Step 4: Draai de volledige suite en bevestig groen via exitcode + geen XX**

Run: `bash tests/planning/run.sh; echo "exit=$?"`
Expected: `exit=0` en `grep -c '^XX' ` op de output is 0. (Conform de projectregel: exitcode is de poort, niet de tail-regel.)

- [ ] **Step 5: Commit**

```bash
git add tests/planning/check-just-updated.ts tests/planning/run.sh
git commit -m "test(update): headless contract-check voor release-vergelijklogica"
```

---

## Task 4: `fetchReleaseComparison` (netwerk-wrapper) + OS-detectie

**Files:**
- Modify: `src/services/updater/releaseInfo.ts` (append)

- [ ] **Step 1: Voeg de OS-detectie en fetch-wrapper toe onderaan `releaseInfo.ts`**

```ts
import { isTauri } from '@/utils/platform';

/**
 * Detecteer het OS via `@tauri-apps/plugin-os` (dynamisch, achter `isTauri()`). Buiten Tauri of
 * bij een fout → `'linux'` (onschuldige default; de asset-keuze degradeert dan gewoon naar null
 * voor `native`).
 */
export async function detectOs(): Promise<OsName> {
  if (!isTauri()) return 'linux';
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    return platform() as OsName;
  } catch {
    return 'linux';
  }
}

/**
 * Haal de release-vergelijking op via de GitHub Releases-API. Vuurt alleen na een gedetecteerde
 * update (één call, ongeauthenticeerd — ruim binnen de 60/uur-ratelimit). Bij ELKE fout (offline,
 * ratelimit, JSON, huidige release niet gevonden) → `null`; de dialoog toont dan enkel de
 * versiesprong. Ontbrekende deelvelden (geen vorige release / geen asset) worden binnen
 * `computeComparison` `null` — nette degradatie.
 */
export async function fetchReleaseComparison(
  currentVersion: string,
  installKind: InstallKind,
): Promise<ReleaseComparison | null> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const releases = (await res.json()) as GhRelease[];
    if (!Array.isArray(releases)) return null;

    const { current, previous } = findCurrentAndPrevious(releases, currentVersion);
    if (!current) return null;

    const os = await detectOs();
    return computeComparison(current, previous, installKind, os);
  } catch {
    return null;
  }
}
```

> Let op: `import { isTauri } from '@/utils/platform';` bovenaan het bestand samenvoegen met de bestaande imports (niet dubbel importeren). Zet de import bij de andere imports bovenaan `releaseInfo.ts`.

- [ ] **Step 2: Verifieer typecheck + dat de bestaande test nog groen is**

Run:
```bash
npm run build
bash tests/planning/run.sh; echo "exit=$?"
```
Expected: `tsc` groen; suite `exit=0`, geen `XX`-regels. (De fetch-wrapper wordt niet door de headless test geraakt — dat is bewust; hij is een dunne wrapper rond de wél-geteste pure functies.)

- [ ] **Step 3: Commit**

```bash
git add src/services/updater/releaseInfo.ts
git commit -m "feat(update): fetchReleaseComparison + OS-detectie (GitHub Releases-API)"
```

---

## Task 5: i18n-sleutels (`updates.justUpdated.*`) in 14 locales

**Files:**
- Modify: `src/i18n/locales/{nl,en,fr,de,es,zh,it,pt,pl,tr,ar,ja,ko,fa}/common.json`

We voegen in elk `common.json` binnen het bestaande `updates`-object een `justUpdated`-subobject toe met vijf sleutels. De "Wat is er nieuw"-kop hergebruikt de bestaande `updates.releaseNotes` (geen nieuwe sleutel).

- [ ] **Step 1: Voeg de sleutels toe aan `nl` (canoniek) en `en` (fallback)**

In `src/i18n/locales/nl/common.json`, binnen `"updates": { … }`:

```json
    "justUpdated": {
      "title": "Je bent bijgewerkt!",
      "smaller": "{{size}} kleiner dan de vorige versie",
      "larger": "{{size}} groter dan de vorige versie",
      "sameSize": "Even groot als de vorige versie",
      "daysSincePrevious": "Sinds de vorige release: {{count}} dagen"
    }
```

In `src/i18n/locales/en/common.json`, binnen `"updates": { … }`:

```json
    "justUpdated": {
      "title": "You're up to date!",
      "smaller": "{{size}} smaller than the previous version",
      "larger": "{{size}} larger than the previous version",
      "sameSize": "Same size as the previous version",
      "daysSincePrevious": "Since the previous release: {{count}} days"
    }
```

- [ ] **Step 2: Voeg dezelfde `justUpdated`-blokken toe aan de overige 12 locales**

Gebruik onderstaande vertalingen (best-effort; `{{size}}`/`{{count}}`-placeholders exact behouden). Plaats elk blok binnen het `updates`-object van het betreffende `common.json`.

**fr**
```json
    "justUpdated": {
      "title": "Vous êtes à jour !",
      "smaller": "{{size}} de moins que la version précédente",
      "larger": "{{size}} de plus que la version précédente",
      "sameSize": "Même taille que la version précédente",
      "daysSincePrevious": "Depuis la version précédente : {{count}} jours"
    }
```
**de**
```json
    "justUpdated": {
      "title": "Du bist auf dem neuesten Stand!",
      "smaller": "{{size}} kleiner als die vorige Version",
      "larger": "{{size}} größer als die vorige Version",
      "sameSize": "Gleich groß wie die vorige Version",
      "daysSincePrevious": "Seit dem vorigen Release: {{count}} Tage"
    }
```
**es**
```json
    "justUpdated": {
      "title": "¡Ya estás actualizado!",
      "smaller": "{{size}} menos que la versión anterior",
      "larger": "{{size}} más que la versión anterior",
      "sameSize": "Del mismo tamaño que la versión anterior",
      "daysSincePrevious": "Desde la versión anterior: {{count}} días"
    }
```
**zh**
```json
    "justUpdated": {
      "title": "已更新到最新版本！",
      "smaller": "比上一个版本小 {{size}}",
      "larger": "比上一个版本大 {{size}}",
      "sameSize": "与上一个版本大小相同",
      "daysSincePrevious": "距上次发布：{{count}} 天"
    }
```
**it**
```json
    "justUpdated": {
      "title": "Sei aggiornato!",
      "smaller": "{{size}} in meno rispetto alla versione precedente",
      "larger": "{{size}} in più rispetto alla versione precedente",
      "sameSize": "Stessa dimensione della versione precedente",
      "daysSincePrevious": "Dalla versione precedente: {{count}} giorni"
    }
```
**pt**
```json
    "justUpdated": {
      "title": "Você está atualizado!",
      "smaller": "{{size}} menor que a versão anterior",
      "larger": "{{size}} maior que a versão anterior",
      "sameSize": "Do mesmo tamanho que a versão anterior",
      "daysSincePrevious": "Desde a versão anterior: {{count}} dias"
    }
```
**pl**
```json
    "justUpdated": {
      "title": "Masz najnowszą wersję!",
      "smaller": "{{size}} mniej niż poprzednia wersja",
      "larger": "{{size}} więcej niż poprzednia wersja",
      "sameSize": "Taki sam rozmiar jak poprzednia wersja",
      "daysSincePrevious": "Od poprzedniego wydania: {{count}} dni"
    }
```
**tr**
```json
    "justUpdated": {
      "title": "Güncelsiniz!",
      "smaller": "Önceki sürümden {{size}} daha küçük",
      "larger": "Önceki sürümden {{size}} daha büyük",
      "sameSize": "Önceki sürümle aynı boyutta",
      "daysSincePrevious": "Önceki sürümden bu yana: {{count}} gün"
    }
```
**ar** (RTL)
```json
    "justUpdated": {
      "title": "أنت على أحدث إصدار!",
      "smaller": "أصغر بمقدار {{size}} من الإصدار السابق",
      "larger": "أكبر بمقدار {{size}} من الإصدار السابق",
      "sameSize": "بنفس حجم الإصدار السابق",
      "daysSincePrevious": "منذ الإصدار السابق: {{count}} يوم"
    }
```
**ja**
```json
    "justUpdated": {
      "title": "最新の状態です！",
      "smaller": "前のバージョンより {{size}} 小さい",
      "larger": "前のバージョンより {{size}} 大きい",
      "sameSize": "前のバージョンと同じサイズ",
      "daysSincePrevious": "前回のリリースから：{{count}} 日"
    }
```
**ko**
```json
    "justUpdated": {
      "title": "최신 버전입니다!",
      "smaller": "이전 버전보다 {{size}} 작음",
      "larger": "이전 버전보다 {{size}} 큼",
      "sameSize": "이전 버전과 동일한 크기",
      "daysSincePrevious": "이전 릴리스 이후: {{count}}일"
    }
```
**fa** (RTL)
```json
    "justUpdated": {
      "title": "شما به‌روز هستید!",
      "smaller": "{{size}} کوچک‌تر از نسخهٔ قبلی",
      "larger": "{{size}} بزرگ‌تر از نسخهٔ قبلی",
      "sameSize": "هم‌اندازهٔ نسخهٔ قبلی",
      "daysSincePrevious": "از انتشار قبلی: {{count}} روز"
    }
```

- [ ] **Step 3: Valideer dat alle 14 JSON-bestanden geldig zijn en de sleutel bestaat**

Run:
```bash
for l in nl en fr de es zh it pt pl tr ar ja ko fa; do node -e "const j=require('./src/i18n/locales/$l/common.json'); if(!j.updates.justUpdated||!j.updates.justUpdated.title){console.error('MIST: $l');process.exit(1)}" || echo "FOUT $l"; done; echo done
```
Expected: alleen `done`, geen `MIST`/`FOUT`-regels (alle JSON geldig, sleutel aanwezig in elke taal).

- [ ] **Step 4: Draai de i18n-plural-suite (mag niet breken)**

Run: `bash tests/planning/run.sh; echo "exit=$?"`
Expected: `exit=0`, geen `XX`. (We voegen géén `_one/_other`-sleutels toe, dus de plural-check verandert niet — `daysSincePrevious` gebruikt bewust géén i18next-pluralisatie.)

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/*/common.json
git commit -m "i18n(update): updates.justUpdated.* in 14 locales"
```

---

## Task 6: `JustUpdatedDialog`-component

**Files:**
- Create: `src/components/dialogs/JustUpdatedDialog.tsx`

- [ ] **Step 1: Schrijf de component**

```tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, PartyPopper, ArrowDown, ArrowUp, Clock } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import { getInstallKind } from '@/services/updater/updaterService';
import { fetchReleaseComparison, type ReleaseComparison } from '@/services/updater/releaseInfo';
import { formatBytes } from '@/services/benchmark/runner';

/**
 * "Je bent net geüpdatet"-dialoog. Toont de versiesprong plus drie weetjes over de update:
 * grootteverschil van de installer, dagen sinds de vorige release en de GitHub-release-beschrijving.
 * Verschijnt zodra `ui.justUpdated` gevuld is (gezet door de opstart-detectie in useUpdateCheck).
 * Elke weetjes-regel toont zich alléén als de bijbehorende data beschikbaar is — bij offline/fout
 * blijft enkel de versiesprong over. Desktop-only qua trigger; de fetch werkt overal.
 */
export function JustUpdatedDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore((s) => s.setUI);
  const justUpdated = useAppStore((s) => s.ui.justUpdated);

  const [comparison, setComparison] = useState<ReleaseComparison | null>(null);
  const [loading, setLoading] = useState(true);

  const close = () => setUI({ justUpdated: null });

  useEffect(() => {
    if (!justUpdated) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const installKind = await getInstallKind();
      const cmp = await fetchReleaseComparison(justUpdated.to, installKind);
      if (!cancelled) {
        setComparison(cmp);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [justUpdated]);

  if (!justUpdated) return null;

  const sizeDelta = comparison?.sizeDeltaBytes ?? null;
  const showSmaller = sizeDelta !== null && sizeDelta < 0;
  const showLarger = sizeDelta !== null && sizeDelta > 0;
  const showSame = sizeDelta !== null && sizeDelta === 0;
  const days = comparison?.daysBetween ?? null;
  const body = (comparison?.currentBody ?? '').trim();

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[90vh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
          <PartyPopper size={16} className="text-accent" />
          {t('updates.justUpdated.title')}
        </span>
        <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]" title={t('close')}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Versiesprong */}
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-text-secondary">{justUpdated.from}</span>
          <span className="text-text-secondary">→</span>
          <span className="text-accent">{justUpdated.to}</span>
        </div>

        {/* Weetjes — alleen tonen wat we hebben */}
        {(showSmaller || showLarger || showSame || days !== null) && (
          <div className="flex flex-col gap-1.5">
            {showSmaller && sizeDelta !== null && (
              <div className="flex items-center gap-2 text-text-primary">
                <ArrowDown size={14} className="text-accent shrink-0" />
                <span>{t('updates.justUpdated.smaller', { size: formatBytes(Math.abs(sizeDelta)) })}</span>
              </div>
            )}
            {showLarger && sizeDelta !== null && (
              <div className="flex items-center gap-2 text-text-primary">
                <ArrowUp size={14} className="text-text-secondary shrink-0" />
                <span>{t('updates.justUpdated.larger', { size: formatBytes(Math.abs(sizeDelta)) })}</span>
              </div>
            )}
            {showSame && (
              <div className="flex items-center gap-2 text-text-secondary">
                <span>{t('updates.justUpdated.sameSize')}</span>
              </div>
            )}
            {days !== null && (
              <div className="flex items-center gap-2 text-text-primary">
                <Clock size={14} className="text-text-secondary shrink-0" />
                <span>{t('updates.justUpdated.daysSincePrevious', { count: days })}</span>
              </div>
            )}
          </div>
        )}

        {/* GitHub-release-beschrijving */}
        {body.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-text-secondary font-medium">{t('updates.releaseNotes')}</span>
            <pre className="whitespace-pre-wrap break-words bg-surface-hover border border-border rounded-[8px] p-3 text-text-primary max-h-[220px] overflow-y-auto font-sans">
              {body}
            </pre>
          </div>
        )}

        {/* Laad-hint (subtiel, niet-blokkerend) */}
        {loading && (
          <span className="text-text-secondary">…</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--primary">
          {t('close')}
        </button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verifieer typecheck**

Run: `npm run build`
Expected: `tsc` groen (controleert o.a. dat `formatBytes` en `Dialog` correct geïmporteerd zijn en de i18n-`t`-calls kloppen).

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/JustUpdatedDialog.tsx
git commit -m "feat(update): JustUpdatedDialog-component"
```

---

## Task 7: Opstart-detectie bekabelen + dialoog mounten

**Files:**
- Modify: `src/hooks/useUpdateCheck.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Voeg de "net geüpdatet"-detectie toe aan `useUpdateCheck.ts`**

Vervang de inhoud van `src/hooks/useUpdateCheck.ts` door onderstaande (de bestaande stille update-check blijft ongewijzigd; we voegen een tweede effect toe voor de detectie):

```ts
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { isTauri } from '@/utils/platform';
import { checkForUpdates, getInstallKind } from '@/services/updater/updaterService';
import { loadLastVersion, saveLastVersion } from '@/utils/settingsStore';
import { detectJustUpdated } from '@/services/updater/releaseInfo';

// Stille opstart-update-check (Tauri-only) — spiegelt het auto-save-patroon:
// dynamische import binnen de service, niet-blokkerend. Is er een update, dan
// openen we de update-dialog zodat de gebruiker het ziet. Fouten worden in
// stille modus genegeerd.
export function useUpdateCheck(): void {
  const updateChecked = useRef(false);
  useEffect(() => {
    if (updateChecked.current) return;
    updateChecked.current = true;
    if (!isTauri()) return;
    // Snap-builds worden door de Snap Store/snapd zelf bijgewerkt — de in-app
    // auto-check overslaan zodat we de gebruiker niet lastigvallen.
    getInstallKind()
      .then(kind => {
        if (kind === 'snap') return;
        return checkForUpdates(true).then(info => {
          if (info) useAppStore.getState().setUI({ showUpdateDialog: true });
        });
      })
      .catch(() => { /* stille check — fouten negeren */ });
  }, []);

  // "Je bent net geüpdatet"-detectie (Tauri-only): vergelijk de opgeslagen laatst-gestarte versie
  // met de huidige. Verschillen ze én was er een opgeslagen versie (dus geen verse installatie),
  // dan tonen we JustUpdatedDialog via `ui.justUpdated`. Daarna schrijven we de huidige versie weg.
  const justUpdatedChecked = useRef(false);
  useEffect(() => {
    if (justUpdatedChecked.current) return;
    justUpdatedChecked.current = true;
    if (!isTauri()) return;
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const current = await getVersion();
        const stored = await loadLastVersion();
        const jump = detectJustUpdated(stored, current);
        if (jump) useAppStore.getState().setUI({ justUpdated: jump });
        await saveLastVersion(current);
      } catch {
        /* geen Tauri-app-API of localStorage-fout — stil negeren */
      }
    })();
  }, []);
}
```

- [ ] **Step 2: Mount `JustUpdatedDialog` in `App.tsx`**

In `src/App.tsx`, bij de andere lazy-dialoog-imports (rond regel 48-59), voeg toe:

```ts
const JustUpdatedDialog = lazy(() => import('@/components/dialogs/JustUpdatedDialog').then(m => ({ default: m.JustUpdatedDialog })));
```

Bij de andere `ui.show*`-selectors (rond regel 75-86), voeg toe:

```ts
  const justUpdated = useAppStore(s => s.ui.justUpdated);
```

Bij de dialoog-mounts (rond regel 348-350, naast `UpdateDialog`), voeg toe:

```tsx
        {justUpdated && <JustUpdatedDialog />}
```

- [ ] **Step 3: Verifieer typecheck + volledige suite**

Run:
```bash
npm run build
bash tests/planning/run.sh; echo "exit=$?"
```
Expected: `tsc` groen; suite `exit=0`, geen `XX`.

- [ ] **Step 4: Visuele self-test in de browser dev-build**

De Tauri-tak draait niet in de browser, dus forceer de state via de dev-bridge om de layout en degradatie-varianten te zien:

1. Start de dev-server via `preview_start` (`npm run dev`, poort 3007; zie CLAUDE.md).
2. Forceer de dialoog via de dev-hook, bijv. in de console/`javascript_tool`:
   `window.__OPS__.store.getState().setUI({ justUpdated: { from: '2026.7.10', to: '2026.7.11' } })`
   (In de browser is er geen Tauri, dus `fetchReleaseComparison` doet een echte GitHub-call — dat werkt vanuit de browser; anders toont de dialoog alleen de versiesprong. Beide varianten zijn geldig om te bekijken.)
3. Controleer met `read_page`/screenshot: header met PartyPopper-icoon + titel, versiesprong `2026.7.10 → 2026.7.11`, en (indien data) de grootte-/dagen-regels + release-body. Sluiten via de knop zet `justUpdated` terug op `null` (dialoog weg).
4. Degradatie checken: zet `justUpdated` terwijl je offline bent of mock `comparison` leeg → alleen de versiesprong blijft, geen kapotte/lege regels.

Deel een screenshot met de gebruiker; eindoordeel over de look is aan de gebruiker.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useUpdateCheck.ts src/App.tsx
git commit -m "feat(update): net-geüpdatet-detectie bij opstart + JustUpdatedDialog mounten"
```

---

## Self-review (uitgevoerd bij het schrijven)

- **Spec-dekking:** detectie (Task 1+7), GitHub-data/grootte/tijd/body (Task 2+4), dialoog met lucide-iconen (Task 6), degradatie (Task 6 conditionele regels + Task 4 null-returns), i18n 14 talen (Task 5), dagen-only zonder plural (Task 5). Alle spec-secties gedekt.
- **Placeholders:** geen TBD/TODO; alle code volledig uitgeschreven.
- **Type-consistentie:** `ReleaseComparison`/`GhRelease`/`InstallKind`/`OsName` en functienamen (`detectJustUpdated`, `pickInstallerAsset`, `daysBetween`, `findCurrentAndPrevious`, `computeComparison`, `fetchReleaseComparison`, `detectOs`) identiek gebruikt over Task 2/3/4/6/7. `ui.justUpdated`-shape (`{from,to}`) consistent in types, uiSlice, hook, dialog, App.
- **Bekende aandachtspunten (bij bouw verifiëren):** exacte asset-suffixen tegen een echte release (`-setup.exe`/`.dmg`/`.AppImage`/`amd64.deb`); niet-nl/en vertalingen zijn best-effort en mogen door een native/vertaalcheck bevestigd worden.
