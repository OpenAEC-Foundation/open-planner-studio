# Dev-server dual-guard-preventie (v2)

**Datum:** 2026-07-23
**Status:** ontwerp — v2 na hyperkritische review (v1 was NO-GO)
**Bouwt voort op:** [2026-06-05-multi-worktree-dev-isolation-design.md](2026-06-05-multi-worktree-dev-isolation-design.md)

## Probleem

Het overkomt de user herhaaldelijk dat een dev server per ongeluk door twee
agents/sessies tegelijk "bewaakt" wordt. Bevestigde faalmodus: **poort-drift /
verkeerde build** — de preview of het desktop-venster laadt de Vite van een
*ander* worktree, of er draaien onbedoeld twee servers voor één worktree.

### Grondoorzaak

1. **`.claude/launch.json` hardcodet `port: 3007`** in elk worktree. `preview_start`
   leest die poort *voordat* het commando draait en opent dus altijd
   `localhost:3007` — het worktree dat toevallig als eerste 3007 pakte, niet
   noodzakelijk het worktree waarin je werkt.
2. **De poortkeuze is niet-deterministisch en niet-gecoördineerd.**
   `scripts/tauri-dev.mjs` pakt "eerste vrije poort ≥ 3007" (start-volgorde-
   afhankelijk), `vite.config.ts` valt terug op `OPS_DEV_PORT || 3007` (en
   `OPS_DEV_PORT` wordt door niets in de repo gezet voor de kale `npm run dev`).

### Waarom v1 (pure hash `P(slug)`) sneuvelde — bevindingen review

- **Botsing is waarschijnlijk, niet zeldzaam.** `3007 + FNV1a(slug)%90` over de
  13 worktree-namen die nú bestaan gaf **9 unieke poorten / 13 slugs** (3
  botsgroepen). Verjaardagsparadox over 90 slots: n=12 → ~54%.
- **Botsing → verkeerde build.** Per-slug sloten dekken cross-slug niets;
  `preview_start` opent `localhost:P`, vindt de al-luisterende Vite van het
  andere worktree en toont **die** build. Exact de oorspronkelijke bug.
- **`tauri:dev` deadlockte zichzelf.** `tauri.conf.json` heeft
  `beforeDevCommand: "npm run dev"`; twee sloten op één slug in één procesboom.
- **Een "committed" hook kan niet bestaan.** `.gitignore:6` = `.claude/`; een
  verse worktree krijgt geen `settings.json`, dus de SessionStart-hook wordt
  nooit geregistreerd.

Kernconclusie: determinisme-per-rekensom is onhoudbaar. De poort moet
**collision-vrij toegewezen en vastgelegd** worden.

## Kernidee (v2): toewijzen-en-vastleggen, met git als registry

Geen hash. In plaats daarvan: elk worktree krijgt **één keer** een poort
toegewezen die aantoonbaar door geen enkel ánder worktree geclaimd is, en die
poort wordt **vastgelegd in dít worktree z'n eigen `.claude/launch.json`**
(per-worktree, gitignored — natuurlijke opslag, geen aparte registry die kan
verrotten). Alle consumenten *lezen* die poort; niemand herrekent.

De verzameling "welke worktrees bestaan" komt van git zelf: `git worktree list`.
Een verwijderd worktree staat er niet meer in → z'n poort komt automatisch vrij,
zonder handmatige opruimlogica. Dat lost de "verweesde registry"-zwakte op.

**Twee garanties, beide OS-afgedwongen:**

| Faalmodus | Waarom onmogelijk |
|---|---|
| Twee servers voor één worktree | runtime-slot (pidfile, proces-leven) + `strictPort` op de vaste poort — kernel weigert de 2e bind |
| Twee worktrees dezelfde poort | toewijzing onder een **globaal `flock`** scant alle `git worktree list`-poorten → kiest gegarandeerd een vrije |
| Preview toont verkeerde worktree | launch.json draagt de eigen, uniek-toegewezen poort; stale kan hooguit "onze eigen (oude) poort" zijn, nooit die van een ander |
| Poort-drift bij herstart | poort is vastgelegd; herstart leest dezelfde |

## Componenten

### 1. `scripts/dev-port.mjs` — toewijzing + uitlezen (nieuw, enige implementatie)

Wordt door álle andere modules geïmporteerd; niemand herimplementeert de logica
(review-punt: vier plekken die poorten berekenen = stille mismatch-risico).

```
worktreeRoot()                 // git rev-parse --show-toplevel  (unieke sleutel; géén basename)
worktreeSlug()                 // basename(worktreeRoot())        (alleen voor weergave/logs)
readRecordedPort(root)         // lees dev-poort uit <root>/.claude/launch.json → number | null
allocatePort(root)             // idempotent; zie hieronder → number
```

**`allocatePort(root)`** (de kern):
1. `readRecordedPort(root)` ≠ null → dat is onze poort, klaar (idempotent, stabiel).
2. Anders, onder de **toewijzings-flock** (kort, gedeeld — zie §3a):
   - `git worktree list --porcelain` → alle worktree-paden.
   - Voor elk pad: `readRecordedPort(pad)` → de verzameling reeds-geclaimde poorten.
   - Kies de laagste poort ≥ 3007 die (a) niet in die verzameling zit én (b) niet
     actueel gebonden is (`net.createServer`-probe, `127.0.0.1`), tot een
     maximum (bv. 3007–3106).
   - Schrijf de poort in `<root>/.claude/launch.json` (maak aan uit sjabloon als
     nodig), geef 'm terug.

Determinisme-na-toewijzing (stabiel over herstarts), globale uniciteit
(registry-afgedwongen), race-vrij (flock), zelf-opruimend (verdwenen worktree =
verdwenen claim). **Sleutel = absoluut pad**, niet basename → twee worktrees met
toevallig dezelfde mapnaam botsen niet (review-punt).

### 2. De consumenten — lezers vs. toewijzers

**Toewijzers** (doen flock + `git worktree list` + vastleggen):
- **`scripts/dev-bootstrap.mjs`** (hook, §5) — stempelt launch.json vóór elke sessie.
- **`scripts/dev-server.mjs`** (browser-launcher, §4).
- **`scripts/tauri-dev.mjs`** (desktop-launcher) — `findFreePort()` vervalt; roept
  `allocatePort()` aan, zet `OPS_DEV_PORT` + `--config devUrl` + `OPS_DEV_GUARDED=1`.

**Lezer** (geen flock, snel):
- **`vite.config.ts`** → `Number(process.env.OPS_DEV_PORT) || readRecordedPort(cwd) || 3007`,
  `strictPort: true` blijft. Alloceert nooit zelf; tegen de tijd dat Vite draait
  heeft de launcher `OPS_DEV_PORT` al gezet. De `readRecordedPort`-fallback dekt
  kale `vite` zonder launcher.

### 3. Twee sloten met verschillende levensduur (`scripts/dev-lock.mjs`, nieuw)

Dependency-vrij (Node-core heeft geen `flock(2)`): atomair pidfile-slot via
`fs.openSync(path,'wx')`, inhoud **atomair** geschreven (temp + `rename`, tegen de
lege-file-leesrace) met `{ pid, port, root, startedAt }`.

**3a. Toewijzings-flock** — gedeeld, kort (alleen tijdens `allocatePort`).
Pad `<git-common-dir>/ops-dev-alloc.lock` (`git rev-parse --git-common-dir`,
gedeeld door alle worktrees). Korte retry-lus (bv. 50 ms × 100); stale-steal als
`pid` dood is óf leeftijd > 30 s (de sectie duurt milliseconden). Puur om twee
gelijktijdige toewijzingen te serialiseren.

**3b. Runtime-bewakingsslot** — per worktree, proces-leven.
Pad `<os.tmpdir()>/ops-dev-guard-<sha1(root)>.lock`. Bij start:
- `OPS_DEV_GUARDED=1` in env → **overslaan** (een ouder-launcher houdt het al;
  lost de `tauri:dev`-deadlock op).
- slot vrij/dood → claim, houd vast tot exit (opruimen in
  `exit`/`SIGINT`/`SIGTERM`-handler).
- slot leeft (pid via `kill(pid,0)` én `startedAt` plausibel, tegen PID-recycling)
  → **weiger**: `dev server voor "<slug>" draait al (PID X, sinds HH:MM) op poort
  P — tweede bewaker geweigerd`, exit ≠ 0.

De echte onmogelijkheid van twee servers-per-worktree is `strictPort` op de vaste
poort (kernel weigert de 2e bind; Vite bindt `127.0.0.1`, geen `SO_REUSEPORT`).
Het slot levert de nette melding en dekt het venster vóór de bind.

### 4. `scripts/dev-server.mjs` — browser-launcher (nieuw)

`package.json`: `"dev": "node scripts/dev-server.mjs"`.
1. `root = worktreeRoot()`; als `OPS_DEV_GUARDED` gezet → gebruik `OPS_DEV_PORT`,
   sla toewijzing+slot over (geneste start onder `tauri-dev`).
2. anders: `port = allocatePort(root)`; `acquireGuardLock(root, port)` (weiger+exit
   als bezet); launch.json is door `allocatePort` al gestempeld.
3. `spawn(viteBin, { env: { ...env, OPS_DEV_PORT: String(port) }, stdio: 'inherit' })`.
   `viteBin` via `node_modules/.bin` oplossen (+ `.cmd` op win32), net als
   `tauri-dev.mjs` — kale `spawn('vite')` faalt bij directe `node`-start/Windows
   (review-punt).
4. print `▶ … worktree "<slug>" → http://localhost:<port>/`.
5. release slot + propageer exit-code.

### 5. `scripts/dev-bootstrap.mjs` + **user-global** hook — launch.json-sync

`preview_start` leest `launch.json.port` vóór het commando draait. De bootstrap
zorgt dat het bestand al klopt vóór de eerste preview. Omdat een committed
projecthook onmogelijk is (`.claude/` gitignored), gaat de hook naar
**`~/.claude/settings.json`** (reist mee met de machine, niet met de repo):

```json
{ "hooks": { "SessionStart": [
    { "hooks": [ { "type": "command", "command": "node scripts/dev-bootstrap.mjs || true" } ] }
] } }
```

`dev-bootstrap.mjs` **zelf-scopet**: leest `package.json`, exit 0 als de naam niet
onze app is (dus in andere projecten no-op). Verder: `allocatePort(worktreeRoot())`
→ stempelt launch.json. Idempotent. `|| true` zodat een ontbrekend script in een
ander project de sessie niet stoort.

**Belangrijk (verlaagt de inzet van deze hook):** door de collision-vrije,
vastgelegde toewijzing kan een stale/ontbrekende launch.json hooguit naar *onze
eigen* poort wijzen of leeg zijn — **nooit** naar die van een ander worktree. De
hook is dus **ergonomie** (eerste preview meteen goed in een vers worktree), geen
correctheidsvereiste meer. De launcher stempelt launch.json óók (defense in
depth). Alternatief indien user-global ongewenst: een `.gitignore`-uitzondering
`!.claude/settings.json` + committen (met behoud van de lokale
`settings.local.json`-worktree-guard) — niet de voorkeur.

## Randgevallen

- **Poort-uitputting** (>100 worktrees): `allocatePort` faalt luid met een
  duidelijke melding i.p.v. te driften.
- **PID-recycling / lege-file-race:** ondervangen door atomaire schrijf + `startedAt`-plausibiliteit naast `kill(pid,0)`.
- **`git worktree prune` niet gedraaid:** `git worktree list` toont soms een
  verdwenen pad; `readRecordedPort` op een niet-bestaand pad → `null` → geen valse claim.

## Raakt ook (review-punten, mee in scope)

- **`docs/self-test-harness.md`** hardcodeert `localhost:3007` (regels ~18/39/45).
  De harness-flow moet de poort uit launch.json / de launcher-print lezen i.p.v.
  3007 aannemen. Ook de MEMORY-notitie "harness = poort 3007" is dan achterhaald.
- **`OPS_DEV_INSTANCE`/recovery-isolatie** blijft op basename (ongewijzigd);
  twee worktrees met identieke basename delen recovery-bestanden — pre-existing,
  **buiten scope** hier (noteren, niet oplossen).

## Testen (geen raakvlak met de CPM-suite)

1. **Unit (node):** `allocatePort` met een gemockte worktree-lijst → distinct per
   pad; idempotent (2e call = vastgelegde poort); een verwijderd pad geeft z'n
   poort vrij; identieke basenames → toch verschillende poorten.
2. **Integratie (shell):** twee `dev-server.mjs` in hetzelfde worktree → 2e exit ≠ 0
   + weiger-melding; twee verschillende worktrees → twee poorten; geneste
   `OPS_DEV_GUARDED=1`-start alloceert/lockt niet (tauri-pad, geen deadlock).

## Buiten scope (YAGNI)

- `npm run preview` (4173) meenemen.
- Recovery-isolatie op pad i.p.v. basename.
- Een aparte gedeelde JSON-registry (git `worktree list` vervangt 'm).

## Raakbestanden

| Bestand | Wijziging |
|---|---|
| `scripts/dev-port.mjs` | nieuw — `worktreeRoot/Slug`, `readRecordedPort`, `allocatePort` |
| `scripts/dev-lock.mjs` | nieuw — toewijzings-flock + runtime-bewakingsslot |
| `scripts/dev-server.mjs` | nieuw — browser-launcher (OPS_DEV_GUARDED-bewust) |
| `scripts/dev-bootstrap.mjs` | nieuw — zelf-scopende launch.json-stamper |
| `scripts/tauri-dev.mjs` | `findFreePort()` → `allocatePort()`; zet `OPS_DEV_GUARDED=1` |
| `vite.config.ts` | fallback `readRecordedPort(cwd)` i.p.v. kale `|| 3007` |
| `package.json` | `"dev": "vite"` → `"node scripts/dev-server.mjs"` |
| `~/.claude/settings.json` | user-global SessionStart-hook (buiten de repo) |
| `docs/self-test-harness.md` | 3007-aannames vervangen door launch.json-poort |
| `tests/dev-server/…` | nieuwe unit + integratietest |
