# Dev-server dual-guard-preventie (v3)

**Datum:** 2026-07-23
**Status:** ontwerp — v3 na twee hyperkritische reviewrondes (v1 + v2 waren NO-GO)
**Bouwt voort op:** [2026-06-05-multi-worktree-dev-isolation-design.md](2026-06-05-multi-worktree-dev-isolation-design.md)

## Probleem

Het overkomt de user herhaaldelijk dat een dev server per ongeluk door twee
agents/sessies tegelijk "bewaakt" wordt. Bevestigde faalmodus: **poort-drift /
verkeerde build** — de preview of het desktop-venster laadt de Vite van een
*ander* worktree, of er draaien onbedoeld twee servers voor één worktree.

### Grondoorzaak

1. **`.claude/launch.json` hardcodet `port: 3007`** in elk worktree. `preview_start`
   leest die poort *voordat* het commando draait en opent dus `localhost:3007` —
   het worktree dat toevallig als eerste 3007 pakte, niet noodzakelijk het jouwe.
2. **De poortkeuze is niet-deterministisch en niet-gecoördineerd**
   (`tauri-dev.mjs` "eerste vrije poort", `vite.config.ts` `OPS_DEV_PORT || 3007`).

### Reviewgeschiedenis (waarom v1 en v2 sneuvelden)

- **v1 (pure hash `P(slug)`):** botsing ~54% bij 12 worktrees → verkeerde build;
  tauri-zelfdeadlock; committed hook onmogelijk (`.claude/` gitignored).
- **v2 (toewijzen-en-vastleggen):** richting goed, maar (a) de bestaande
  launch.json's dragen al `port: 3007` → de idempotentie-short-circuit
  reproduceerde de wrong-build-bug in 5 worktrees; (b) `git rev-parse
  --git-common-dir` gaf vanuit de main-checkout een **relatief** `.git` → de
  gedeelde flock splitste; (c) het tauri-pad claimde geen guard-slot expliciet.

v3 houdt de v2-architectuur en dicht die precisiegaten.

## Kernidee: toewijzen-en-vastleggen, met git als registry

Geen hash. Elk worktree krijgt **één keer** een poort toegewezen die door geen
enkel ánder worktree geclaimd is, en die poort wordt vastgelegd. De verzameling
"welke worktrees bestaan" komt van `git worktree list`; een verwijderd worktree
verdwijnt daaruit → z'n poort komt vanzelf vrij. Alle consumenten *lezen*; niemand
herrekent.

**Bron van waarheid = een eigen allocatie-markering, niet het `port`-veld.**
De allocator schrijft in `<root>/.claude/launch.json` twee dingen:
- `port: N` — wat `preview_start` leest (ongewijzigd contract), en
- `opsDevPort: N` — de **allocatie-markering** die het template *niet* heeft.

`readRecordedPort` keyt uitsluitend op `opsDevPort`. Daardoor telt de stale
`port: 3007` uit het bestaande template **niet** als "toegewezen" (v2-blocker #1
weg): een worktree zonder `opsDevPort` wordt vers gealloceerd en her-stempelt
z'n eigen launch.json. Dat is meteen de migratie — geen handmatig bestand-editen.

**Garanties, OS-afgedwongen:**

| Faalmodus | Waarom onmogelijk |
|---|---|
| Twee servers voor één worktree | runtime-slot (pidfile, proces-leven) + `strictPort` op de vaste poort — kernel weigert de 2e bind |
| Twee worktrees dezelfde poort | toewijzing onder een **absoluut-verankerde, gedeelde flock** scant alle `git worktree list`-`opsDevPort`-waarden + bind-probe → kiest gegarandeerd een vrije |
| Preview toont verkeerde worktree | ná toewijzing draagt launch.json de eigen, uniek-toegewezen poort; de SessionStart-hook her-stempelt vóór de eerste preview, óók in bestaande worktrees |
| Poort-drift bij herstart | `opsDevPort` is vastgelegd; herstart leest dezelfde |

## Componenten

### 1. `scripts/dev-port.mjs` — enige implementatie (nieuw)

Door álle andere modules geïmporteerd; niemand herimplementeert (review-punt:
meerdere plekken die poorten berekenen = stille mismatch). **Alle git-aanroepen
draaien met `cwd = root` en resultaten worden absoluut gemaakt.**

```
worktreeRoot()        // git rev-parse --show-toplevel (cwd=process.cwd); throws→ null (defensief)
worktreeSlug()        // basename(worktreeRoot())  — alleen weergave
readRecordedPort(root)// lees opsDevPort uit <root>/.claude/launch.json → number | null
                      //   ONTBREKEND bestand / kapotte JSON / geen opsDevPort → null (nooit gooien)
allocatePort(root)    // idempotent; zie onder → number
```

**`allocatePort(root)`:**
1. `readRecordedPort(root)` ≠ null → dat is onze poort, klaar (idempotent).
2. Anders, onder de **toewijzings-flock** (§3a):
   - `git worktree list --porcelain` (met `cwd=root`) → alle worktree-paden.
   - Voor elk pad: `readRecordedPort(pad)` → de reeds-geclaimde `opsDevPort`-set.
   - Kies de laagste poort ≥ 3007 die (a) niet in die set zit **én** (b) niet
     actueel gebonden is (`net.createServer` op `127.0.0.1`), t/m 3106.
   - Schrijf `port` + `opsDevPort` = de gekozen poort in `<root>/.claude/launch.json`
     (atomair: temp + `rename`), release flock, geef terug.
   - Faalt een git-call of is er geen vrije poort → **hard falen met duidelijke
     melding**, flock in `finally` vrijgeven. Nooit zonder slot doorgaan (dat
     heropent de race).

Sleutel = **absoluut worktree-pad**, niet basename (twee worktrees met dezelfde
mapnaam botsen niet). Zelf-opruimend (verdwenen worktree = verdwenen claim).

### 2. Consumenten — toewijzers vs. lezer

**Toewijzers** (flock + `git worktree list` + vastleggen):
- `scripts/dev-bootstrap.mjs` (hook, §5) — her-stempelt launch.json vóór de sessie.
- `scripts/dev-server.mjs` (browser-launcher, §4).
- `scripts/tauri-dev.mjs` — `findFreePort()` vervalt; `allocatePort()` + zet
  `OPS_DEV_PORT` + `--config devUrl` + `OPS_DEV_GUARDED=1` + **claimt zelf het
  runtime-slot** (§3b), zodat ook op het desktop-pad dubbel-starten netjes wordt
  geweigerd i.p.v. een kale EADDRINUSE (review-punt v2 #3).

**Lezer** (geen flock):
- `vite.config.ts` → `Number(process.env.OPS_DEV_PORT) || readRecordedPort(process.cwd()) || 3007`,
  `strictPort` blijft. `readRecordedPort` **moet defensief zijn** (ontbrekend
  bestand → `null`), want `server.port` wordt óók bij `vite build` geëvalueerd en
  CI draait `tauri build` → `vite build` in een verse checkout zónder `.claude/`
  (review-punt v2 #4). Alloceert nooit zelf; bij een launcher is `OPS_DEV_PORT` al
  gezet, de `readRecordedPort`-fallback dekt kale `vite`.

### 3. Twee sloten, verschillende levensduur (`scripts/dev-lock.mjs`, nieuw)

Dependency-vrij (Node-core heeft geen `flock(2)`): atomair pidfile-slot via
`fs.openSync(path,'wx')`, inhoud **atomair** geschreven (temp + `rename`) met
`{ pid, port, root, startedAt }`.

**3a. Toewijzings-flock** — gedeeld, kort (alleen tijdens `allocatePort`).
Pad: `path.resolve(root, execSync('git rev-parse --git-common-dir',{cwd:root}).trim()) + '/ops-dev-alloc.lock'`.
De `path.resolve(root, …)` is essentieel: `--git-common-dir` gaf vanuit de
main-checkout een **relatief** `.git` (geverifieerd) — zonder verankering aan het
absolute `root` splitst de flock tussen main en linked worktrees en serialiseert
hij niets (review-punt v2 #2). Gebruik **niet** `--absolute-git-dir` (dat gaf een
per-worktree pad → zou de flock juist splitsen). Korte retry-lus (bv. 50 ms × 100);
stale-steal als `pid` dood is óf leeftijd > 30 s. `try/finally`-release; bij
timeout **hard falen**, niet zonder slot doorgaan.

**3b. Runtime-bewakingsslot** — per worktree, proces-leven.
Pad `<os.tmpdir()>/ops-dev-guard-<sha1(root)>.lock`. Bij start:
- `OPS_DEV_GUARDED=1` in env → **overslaan** (een ouder-launcher — tauri-dev —
  houdt het al; lost de `tauri:dev`-deadlock op).
- slot vrij/dood → claim, houd vast tot exit (opruimen in exit/SIGINT/SIGTERM).
- slot leeft (pid via `kill(pid,0)` **én** `startedAt` plausibel, tegen
  PID-recycling) → **weiger**: `dev server voor "<slug>" draait al (PID X, sinds
  HH:MM) op poort P — tweede bewaker geweigerd`, exit ≠ 0.

De echte onmogelijkheid van twee servers-per-worktree is `strictPort` op de vaste
poort (kernel weigert de 2e bind; Vite bindt `127.0.0.1`, geen `SO_REUSEPORT`).
Het slot levert de nette melding en dekt het venster vóór de bind.

### 4. `scripts/dev-server.mjs` — browser-launcher (nieuw)

`package.json`: `"dev": "node scripts/dev-server.mjs"`.
1. `root = worktreeRoot()`; `OPS_DEV_GUARDED` gezet → gebruik `OPS_DEV_PORT`, sla
   toewijzing + slot over (geneste start onder `tauri-dev`).
2. anders: `port = allocatePort(root)`; `acquireGuardLock(root, port)` (weiger+exit
   als bezet); launch.json is door `allocatePort` al gestempeld.
3. `spawn(viteBin, { env:{...env, OPS_DEV_PORT:String(port)}, stdio:'inherit' })`.
   `viteBin` via `node_modules/.bin` (+ `.cmd` op win32), net als `tauri-dev.mjs` —
   kale `spawn('vite')` faalt bij directe `node`-start/Windows (review-punt).
4. print `▶ … worktree "<slug>" → http://localhost:<port>/`.
5. release slot + propageer exit-code.

### 5. `scripts/dev-bootstrap.mjs` + **user-global** hook — launch.json-sync

`preview_start` leest `launch.json.port` vóór het commando draait; de bootstrap
zorgt dat het bestand al klopt. Committed projecthook is onmogelijk (`.claude/`
gitignored), dus **`~/.claude/settings.json`** (reist met de machine):

```json
{ "hooks": { "SessionStart": [
    { "hooks": [ { "type": "command", "command": "node scripts/dev-bootstrap.mjs || true" } ] }
] } }
```

`dev-bootstrap.mjs` **zelf-scopet** (leest `package.json`, exit 0 als de naam niet
onze app is), roept `allocatePort(worktreeRoot())` en her-stempelt launch.json.
Idempotent. `|| true` + relatief pad → in een ander project stille no-op.

**Reikwijdte eerlijk:** door de vastgelegde `opsDevPort`-toewijzing wijst een
her-gestempelde launch.json naar de eigen, unieke poort. De hook her-stempelt óók
**bestaande** worktrees (die nog `port:3007`/geen `opsDevPort` hebben) bij de
volgende sessiestart — dat ís de migratie. Restrisico, eerlijk benoemd: een
**bestaand** worktree waarin je in een reeds-lopende sessie (die z'n SessionStart
al gehad heeft vóór de hook bestond) meteen `preview_start` doet vóór je eerste
`npm run dev`, kan nog de stale `3007` pakken. Mitigatie: eenmalig `npm run dev`
(of een nieuwe sessie) her-stempelt. De launcher stempelt óók (defense in depth).

## Randgevallen

- **Verweesde/kapotte worktree** (git-dir wijst naar verplaatste repo → `git
  rev-parse` gooit): `worktreeRoot()`/`readRecordedPort` vangen dit af → `null`
  → `vite.config.ts` valt terug op 3007, geen crash (review-punt v2 #5).
- **Poort-uitputting** (>100 worktrees): `allocatePort` faalt luid i.p.v. driften.
- **PID-recycling / lege-file-race:** atomair schrijven + `startedAt`-plausibiliteit.
- **`prunable` worktree** in `git worktree list`: `readRecordedPort` op het
  niet-bestaande launch.json → `null` → geen valse claim.

## Raakt ook (mee in scope)

- **`docs/self-test-harness.md`** hardcodeert `localhost:3007` (regels ~18/39/45).
  De harness-flow moet de poort uit launch.json / de launcher-print lezen. Ook de
  MEMORY-notitie "harness = poort 3007" is dan achterhaald.
- **`OPS_DEV_INSTANCE`/recovery-isolatie** blijft op basename (ongewijzigd) — twee
  worktrees met identieke basename delen recovery-bestanden; pre-existing,
  **buiten scope** (noteren, niet oplossen).

## Testen (geen raakvlak met de CPM-suite — geverifieerd: `run.sh` importeert `vite.config.ts` niet)

1. **Unit (node):** `allocatePort` met gemockte worktree-lijst → distinct per pad;
   idempotent (2e call = vastgelegde `opsDevPort`); verwijderd pad geeft poort
   vrij; identieke basenames → toch verschillende poorten; bestaande `port:3007`
   zónder `opsDevPort` → behandeld als niet-toegewezen.
2. **Integratie (shell):** twee `dev-server.mjs` in één worktree → 2e exit ≠ 0 +
   weiger-melding; twee worktrees → twee poorten; geneste `OPS_DEV_GUARDED=1`-start
   alloceert/lockt niet.
3. **Tauri-verificatie (handmatig, vóór "af"):** echte `npm run tauri:dev`; print
   `OPS_DEV_GUARDED` + `OPS_DEV_PORT` vanuit de geneste `dev-server.mjs`; bevestig
   dat de env erft en er geen deadlock is (review-punt v2 #3, blijft [VERMOED] tot
   gedraaid).

## Buiten scope (YAGNI)

- `npm run preview` (4173) meenemen.
- Recovery-isolatie op pad i.p.v. basename.
- Aparte gedeelde JSON-registry (git `worktree list` vervangt 'm).

## Raakbestanden

| Bestand | Wijziging |
|---|---|
| `scripts/dev-port.mjs` | nieuw — `worktreeRoot/Slug` (defensief), `readRecordedPort` (opsDevPort, defensief), `allocatePort` (absolute-pad git + flock) |
| `scripts/dev-lock.mjs` | nieuw — toewijzings-flock (absoluut verankerd, try/finally) + runtime-bewakingsslot |
| `scripts/dev-server.mjs` | nieuw — browser-launcher (OPS_DEV_GUARDED-bewust) |
| `scripts/dev-bootstrap.mjs` | nieuw — zelf-scopende launch.json-stamper (migreert bestaande) |
| `scripts/tauri-dev.mjs` | `findFreePort()` → `allocatePort()`; claimt guard-slot; zet `OPS_DEV_GUARDED=1` |
| `vite.config.ts` | defensieve `readRecordedPort(cwd)`-fallback i.p.v. kale `|| 3007` |
| launch.json-template | allocator schrijft `opsDevPort` naast `port`; template zelf draagt géén `opsDevPort` |
| `package.json` | `"dev": "vite"` → `"node scripts/dev-server.mjs"` |
| `~/.claude/settings.json` | user-global SessionStart-hook (buiten de repo) |
| `docs/self-test-harness.md` | 3007-aannames vervangen door launch.json-poort |
| `tests/dev-server/…` | nieuwe unit + integratietest |
