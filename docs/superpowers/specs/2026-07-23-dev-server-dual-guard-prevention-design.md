# Dev-server dual-guard-preventie

**Datum:** 2026-07-23
**Status:** ontwerp (goedgekeurd door user, richting A + flock-melding, SessionStart-hook-sync)
**Bouwt voort op:** [2026-06-05-multi-worktree-dev-isolation-design.md](2026-06-05-multi-worktree-dev-isolation-design.md)

## Probleem

Het overkomt de user herhaaldelijk dat een dev server per ongeluk door twee
agents/sessies tegelijk "bewaakt" wordt. De concrete faalmodus (door de user
bevestigd) is **poort-drift / verkeerde build**: de preview of het
desktop-venster laadt de Vite van een *ander* worktree, of er draaien onbedoeld
twee servers voor één worktree.

### Grondoorzaak

Twee onafhankelijke poort-bronnen die niet synchroon lopen:

1. **`.claude/launch.json` hardcodet `port: 3007`** in elk worktree. `preview_start`
   leest die poort *voordat* het commando draait en opent dus altijd
   `localhost:3007` — wat het worktree is dat toevallig als eerste 3007 pakte
   (nu het root-worktree z'n Tauri-Vite), niet noodzakelijk het worktree waarin
   je werkt. → **verkeerde build.**
2. **De poortkeuze is niet-deterministisch.** `scripts/tauri-dev.mjs` pakt de
   "eerste vrije poort ≥ 3007" (start-volgorde-afhankelijk, TOCTOU-gevoelig) en
   `vite.config.ts` valt terug op `Number(OPS_DEV_PORT) || 3007` — waarbij
   `OPS_DEV_PORT` voor de kale `npm run dev` (browser) door niets in de repo
   gezet wordt. Bij herstart kan een worktree een andere poort krijgen. → **drift.**

Bevestigd bij onderzoek: er draaiden vier Vites op 3007/3017/3027/3037 (de +10
komt uit een handmatige/externe `OPS_DEV_PORT`, niet uit repo-code), en
`.claude/launch.json` is **gitignored** (per-worktree, vrij te herschrijven).

## Kernidee: kernel-exclusiviteit + determinisme

Een gebonden TCP-poort is een kernel-exclusieve resource — precies één proces
kan hem vasthouden. Combineer dat met een *pure* poortfunctie:

1. **Elk worktree ⇒ precies één vaste poort** `P(slug)`, deterministisch.
2. **Alles wat start óf verbindt** (Vite-bind, Tauri-devUrl, `preview_start` via
   launch.json) gebruikt diezelfde `P(slug)`.

Gevolg — geen afspraak, geen raceable check, maar door de OS afgedwongen:

| Faalmodus | Waarom onmogelijk |
|---|---|
| Twee servers voor één worktree | `strictPort` op een *vaste* poort — de kernel weigert de 2e bind |
| Preview toont verkeerde worktree | launch.json + Vite + Tauri delen dezelfde `P(slug)` |
| Poort-drift bij herstart | `P(slug)` is puur — herstart = zelfde poort |
| Verweesde registry-troep | pidfile wordt bij exit opgeruimd + dode PID's automatisch overgenomen; geen gedeelde mutabele staat |

## Componenten

### 1. `scripts/dev-port.mjs` — bron van waarheid (nieuw)

Zuivere, dependency-vrije helper. Geen `Math.random`, geen runtime-staat.

```js
export function deriveSlug(cwd)      // basename(cwd) — zoals tauri-dev.mjs nu doet
export function resolveDevPort(slug) // 3007 + FNV1a(slug) % 90  → 3007–3096
```

Bereik 3007–3096 blijft onder 4173 (`npm run preview`). Zelfde worktree ⇒
altijd dezelfde poort; ander worktree ⇒ (vrijwel) altijd andere poort.

### 2. De drie consumenten — allemaal `P(slug)`, nooit meer los `3007`

- **`vite.config.ts`** → `port: Number(process.env.OPS_DEV_PORT) || resolveDevPort(deriveSlug(process.cwd()))`,
  `strictPort: true` blijft. De kale `|| 3007` verdwijnt. (Import van
  `scripts/dev-port.mjs` — vite laadt de config via esbuild, ESM-import werkt.)
- **`scripts/tauri-dev.mjs`** → gebruikt `resolveDevPort(slug)` i.p.v. de
  `findFreePort()`-lus; zet `OPS_DEV_PORT` + `--config devUrl` op `P(slug)`.
  `OPS_DEV_INSTANCE` (recovery-isolatie) blijft ongewijzigd.
- **`.claude/launch.json`** → `port` wordt op `P(slug)` gehouden door de
  SessionStart-hook (zie 5), zodat `preview_start` gegarandeerd *déze* worktree
  opent.

### 3. `scripts/dev-lock.mjs` — de bewaker (nieuw)

Atomair pidfile-slot, dependency-vrij (geen `flock(2)` in Node-core):

- Padvorm `<os.tmpdir()>/ops-dev-<slug>.lock`, inhoud `{ pid, port, startedAt }`.
- Claim via `fs.openSync(path, 'wx')` (atomaire exclusieve create). Bestaat het
  al → lees pid, `process.kill(pid, 0)`:
  - **leeft** → weiger: `dev server voor "<slug>" draait al (PID <pid>, sinds
    <HH:MM>) op poort <port> — tweede bewaker geweigerd`, exit ≠ 0.
  - **dood/verweesd** → neem over (herschrijf slot).
- Vasthouden tot proces-exit; opruimen in een `exit`/`SIGINT`/`SIGTERM`-handler.

De **echte** onmogelijkheid zit in `strictPort` op de vaste `P(slug)`: twee
processen kunnen die poort nooit tegelijk binden. Het pidfile-slot levert enkel
de vriendelijke melding en dekt het minieme venster vóór de bind.

### 4. `scripts/dev-server.mjs` — browser-launcher (nieuw)

Symmetrisch met `tauri-dev.mjs`. `package.json`: `"dev": "node scripts/dev-server.mjs"`.

1. `slug = deriveSlug(cwd)`, `port = resolveDevPort(slug)`.
2. `acquireDevLock(slug, port)` — weiger + exit als bezet.
3. stempel `port` in `.claude/launch.json` (idempotent; dekt "poort net
   veranderd" bovenop de hook).
4. `spawn('vite', { env: { ...env, OPS_DEV_PORT: String(port) }, stdio: 'inherit' })`.
5. print `▶ open-planner-studio dev — worktree "<slug>" → http://localhost:<port>/`.
6. release slot + propageer exit-code bij afsluiten.

### 5. `scripts/dev-bootstrap.mjs` + SessionStart-hook — launch.json-sync (nieuw)

`preview_start` leest `launch.json.port` *voordat* het commando draait, dus
launch.json moet al kloppen vóór de allereerste preview. Oplossing: een
SessionStart-hook stempelt bij elke sessiestart `P(slug)` in launch.json
(zelfhelend, ook in een vers worktree).

- `scripts/dev-bootstrap.mjs`: bereken `P(slug)`, schrijf `port` in de `dev`-entry
  van `.claude/launch.json` (maak het bestand aan als het ontbreekt, uit een
  sjabloon). Bindt niets, stempelt alleen. Idempotent.
- `.claude/settings.json` (committed, zodat de garantie met de repo meereist):
  ```json
  { "hooks": { "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node scripts/dev-bootstrap.mjs" } ] }
  ] } }
  ```
  Faalt de hook, dan is de launcher-stamp (stap 3 in §4) de vangnet — de bind
  zelf hangt sowieso nooit van launch.json af, alleen `preview_start`'s eerste
  keuze.

## Randgeval: hash-botsing

Twee slugs → zelfde `P(slug)` is zeldzaam (±10 worktrees over 90 poorten).

- **Basisgedrag:** schoon falen via `strictPort` — worktree B krijgt een
  duidelijke "poort bezet"-melding, **nooit** een verkeerde build.
- **Optionele verharding (nu weggelaten, YAGNI):** deterministische lineaire
  probe (`P, P+1, …`) die de opgeloste poort in het slotbestand onthoudt zodat
  hij stabiel blijft over herstarts. Pas toevoegen als het zich ooit voordoet.

## Testen

Geen raakvlak met de CPM/kalender-suite. Nieuw, klein:

1. **Unit (node, headless):** `resolveDevPort` — determinisme (zelfde slug ⇒
   zelfde poort), bereik 3007–3096, redelijke spreiding over een set
   voorbeeld-slugs, geen botsing binnen de bekende worktree-namen.
2. **Integratie (shell):** start twee `dev-server.mjs` met dezelfde slug; verifieer
   dat de tweede exit ≠ 0 geeft en de weiger-melding print, en dat er één Vite op
   `P(slug)` luistert. Start twee met verschillende slugs; verifieer twee
   verschillende poorten.

## Buiten scope (YAGNI)

- `npm run preview` (4173) meenemen — apart, minder vaak dubbel; later indien nodig.
- Hash-botsing-probe (zie boven).
- Een gedeelde poort-registry (richting B) — bewust vermeden om
  shared-state-onderhoud te ontlopen.

## Raakbestanden

| Bestand | Wijziging |
|---|---|
| `scripts/dev-port.mjs` | nieuw — `deriveSlug`, `resolveDevPort` |
| `scripts/dev-lock.mjs` | nieuw — atomair pidfile-slot |
| `scripts/dev-server.mjs` | nieuw — browser-launcher |
| `scripts/dev-bootstrap.mjs` | nieuw — stempelt launch.json |
| `scripts/tauri-dev.mjs` | `findFreePort()` → `resolveDevPort()` + `dev-lock` |
| `vite.config.ts` | `|| 3007` → `resolveDevPort(deriveSlug(cwd))` |
| `package.json` | `"dev": "vite"` → `"node scripts/dev-server.mjs"` |
| `.claude/settings.json` | SessionStart-hook toevoegen |
| `tests/dev-server/…` | nieuwe unit + integratietest |
