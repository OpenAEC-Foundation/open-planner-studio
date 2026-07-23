# Dev-server dual-guard-preventie (v4)

**Datum:** 2026-07-23
**Status:** ontwerp — v4 na drie hyperkritische reviewrondes (v1/v2 NO-GO, v3 voorwaardelijke GO)
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

### Reviewgeschiedenis

- **v1 (pure hash):** botsing ~54% bij 12 worktrees → verkeerde build; tauri-zelfdeadlock; committed hook onmogelijk (`.claude/` gitignored). **NO-GO.**
- **v2 (toewijzen-en-vastleggen):** (a) bestaande launch.json's dragen `port:3007` → idempotentie-short-circuit resolvede 5 worktrees naar 3007; (b) `--git-common-dir` gaf vanuit main relatief `.git` → flock splitste; (c) tauri-pad claimde geen guard-slot. **NO-GO.**
- **v3:** (a)/(b)/(c) gedicht (geverifieerd door de reviewer). Resterend poortwachter-gat: de **stale-steal van de toewijzings-flock** was onprecies (temp+rename overschrijft → twee stelers winnen → twee allocators → wrong-build). **Voorwaardelijke GO.**

v4 dicht die stale-steal expliciet + zes clarificaties.

## Kernidee: toewijzen-en-vastleggen, met git als registry

Geen hash. Elk worktree krijgt **één keer** een poort toegewezen die door geen
enkel ánder worktree geclaimd is, en die poort wordt vastgelegd. "Welke worktrees
bestaan" komt van `git worktree list`; een verwijderd worktree verdwijnt daaruit →
z'n poort komt vrij. Alle consumenten *lezen*; niemand herrekent.

**Bron van waarheid = een eigen allocatie-markering, niet het `port`-veld.**
De allocator schrijft in `<root>/.claude/launch.json`: `port: N` (wat `preview_start`
leest, ongewijzigd contract) én `opsDevPort: N` (de markering die vers-aangemaakte
launch.json's *niet* hebben). `readRecordedPort` keyt uitsluitend op `opsDevPort`,
dus de stale `port: 3007` telt niet als "toegewezen" en een bestaand worktree wordt
vers gealloceerd + her-stempelt zichzelf (dat is meteen de migratie).

**Garanties, OS-afgedwongen:**

| Faalmodus | Waarom onmogelijk / hoe afgedekt |
|---|---|
| Twee servers voor één worktree | runtime-slot (pidfile, proces-leven) + `strictPort` — kernel weigert de 2e bind |
| Twee **worktrees** dezelfde poort | toewijzing onder de absoluut-verankerde, gedeelde flock; `opsDevPort`-set + bind-probe → **volledig gesloten worktree-vs-worktree** |
| Een **vreemd proces** (geen worktree) pakt de poort | *best-effort*: bind-probe onder de flock + `strictPort`-vangnet → **schoon falen (EADDRINUSE), nooit wrong-build** — geen harde garantie, wel veilig |
| Preview toont verkeerde worktree | ná toewijzing draagt launch.json de eigen, unieke poort; de hook her-stempelt vóór de eerste preview |
| Poort-drift bij herstart | `opsDevPort` is vastgelegd; herstart leest dezelfde |

## Componenten

### 1. `scripts/dev-port.mjs` — enige implementatie (nieuw)

Door álle andere modules geïmporteerd; niemand herimplementeert. **Geen
import-tijd-side-effects** (geen top-level `execSync('git …')`): `vite.config.ts`
importeert dit en `vite build` draait in CI in een `.claude`-loze, mogelijk
niet-git tarball-checkout — een git-call bij module-load zou de productie-build
breken. Alle git-aanroepen zitten *in* de functies, met `cwd = root`, defensief.

```
worktreeRoot()         // fs.realpathSync(git rev-parse --show-toplevel, cwd=process.cwd); throws→ null
worktreeSlug()         // basename(worktreeRoot())  — alleen weergave
readRecordedPort(root) // opsDevPort uit <root>/.claude/launch.json → number | null
                       //   ontbrekend bestand / kapotte JSON / geen opsDevPort → null (nooit gooien)
allocatePort(root)     // idempotent; zie onder → number
```

`worktreeRoot()` **canonicaliseert** via `fs.realpathSync` zodat een symlinked
repo-pad niet tot een ander lock-/slot-pad leidt dan de absolute gitdir-opslag.

**`allocatePort(root)`:**
1. `readRecordedPort(root)` ≠ null → onze poort, klaar (idempotent).
2. Anders, **onder de toewijzings-flock** (§3a — de flock omvat scan → kies →
   schrijf → release, één ononderbroken sectie):
   - `git worktree list --porcelain` (cwd=root) → alle worktree-paden.
   - Voor elk pad: `readRecordedPort(pad)` → de reeds-geclaimde `opsDevPort`-set.
   - Kies de laagste poort ≥ 3007 die (a) niet in die set zit **én** (b) niet
     actueel gebonden is (`net.createServer` op `127.0.0.1`), t/m 3106.
   - Schrijf `port` + `opsDevPort` atomair (temp + `rename`) in
     `<root>/.claude/launch.json`, dán flock release, geef terug.
   - Git-call faalt / geen vrije poort → **hard falen met duidelijke melding**,
     flock in `finally` vrij. Nooit zonder slot doorgaan (heropent de race).

Sleutel = **absoluut, gecanonicaliseerd worktree-pad**. Zelf-opruimend (verdwenen
worktree = verdwenen claim). Omdat scan én schrijf binnen dezelfde flock zitten,
ziet een tweede allocator de `opsDevPort` van de eerste altijd — er is geen
mid-allocatie-lek.

### 2. Consumenten — toewijzers vs. lezer

**Toewijzers** (flock + `git worktree list` + vastleggen):
- `scripts/dev-bootstrap.mjs` (hook, §5).
- `scripts/dev-server.mjs` (browser-launcher, §4).
- `scripts/tauri-dev.mjs` — `findFreePort()` vervalt; `allocatePort()` + zet
  `OPS_DEV_PORT` + `OPS_DEV_INSTANCE` (**behouden** — voedt de recovery-isolatie
  `__OPS_DEV_INSTANCE__` in `App.tsx`; droppen = worktrees klobberen elkaars
  recovery weer) + `--config devUrl` + `OPS_DEV_GUARDED=1`, en **claimt zelf het
  runtime-slot** (§3b) zodat ook desktop-dubbelstart netjes geweigerd wordt.

**Lezer** (geen flock):
- `vite.config.ts` → `Number(process.env.OPS_DEV_PORT) || readRecordedPort(process.cwd()) || 3007`,
  `strictPort` blijft. `readRecordedPort` is defensief (ontbrekend bestand → `null`)
  want `server.port` wordt óók bij `vite build` geëvalueerd (CI: `tauri build` →
  `vite build` zonder `.claude/`). Alloceert nooit zelf.

### 3. Twee sloten (`scripts/dev-lock.mjs`, nieuw) — atomaire pidfile-sloten

Dependency-vrij (Node-core heeft geen `flock(2)`). **Gedeeld acquire-protocol,
race-veilig — dit is de v3-blocker-fix:**

```
acquire(lockPath, {allowAgeSteal}):
  loop (met bounded timeout):
    try: fd = openSync(lockPath,'wx'); write {pid, startedAt}; close → VERKREGEN   // O_EXCL = de mutex
    catch EEXIST:
      h = readHolder(lockPath)                     // leeg/half-geschreven → behandel als LEVEND (wacht, steel niet)
      dead = h.pid && kill(h.pid,0) throws ESRCH
      recycled = allowAgeSteal && ouder dan drempel && h.startedAt onaannemelijk
      if dead || recycled:
         unlinkSync(lockPath)  (fouten negeren);  continue   // steal: unlink → volgende open('wx') kiest ÉÉN winnaar
      else: sleep 50ms; continue                    // levende houder → wachten
  // timeout met levende houder → HARD FALEN (nooit een levend slot stelen, nooit doorgaan zonder slot)
```

Waarom dit sluit (v3-blocker): stelen gebeurt via **`unlink` + `open('wx')`**, nooit
via rename-overschrijven — twee gelijktijdige stelers doen allebei `unlink`
(idempotent) maar precies één `open('wx')` wint; de verliezer krijgt EEXIST, her-lest
en ziet de verse slot. Een leeg/half-geschreven slot geldt als levend (niet stelen).

**3a. Toewijzings-flock** — gedeeld, kort. `allowAgeSteal = false`: **alleen
dode-pid-steal**. Een trage-maar-levende allocator (100 worktrees × bind-probes) mag
níét bestolen worden — dat gaf twee levende allocators → zelfde poort. Bij een
aanhoudend levende houder voorbij de timeout: hard falen, geen steal.
Pad: `path.resolve(root, execSync('git rev-parse --git-common-dir',{cwd:root}).trim()) + '/ops-dev-alloc.lock'`.
De `path.resolve(root, …)` is essentieel (geverifieerd: `--git-common-dir` gaf
vanuit de main-checkout relatief `.git`; verankerd aan absolute `root` convergeren
main en alle linked worktrees op hetzelfde lockpad). **Niet** `--absolute-git-dir`
(dat gaf een per-worktree pad → zou de flock splitsen).

**3b. Runtime-bewakingsslot** — per worktree, proces-leven.
Pad `<os.tmpdir()>/ops-dev-guard-<sha1(root)>.lock`. `allowAgeSteal = true` (een
crash zonder cleanup + gerecyclede pid mag na een ruime drempel + `startedAt`-
mismatch gestolen worden). Bij start:
- `OPS_DEV_GUARDED=1` → **overslaan** (ouder-launcher houdt het al → lost de
  `tauri:dev`-deadlock op).
- vrij/dood → claim, houd vast tot exit (opruimen in exit/SIGINT/SIGTERM).
- levend → **weiger**: `dev server voor "<slug>" draait al (PID X, sinds HH:MM) op
  poort P — tweede bewaker geweigerd`, exit ≠ 0.

De echte onmogelijkheid van twee servers-per-worktree is `strictPort` op de vaste
poort (kernel weigert de 2e bind; Vite bindt `127.0.0.1`, geen `SO_REUSEPORT`).

### 4. `scripts/dev-server.mjs` — browser-launcher (nieuw)

`package.json`: `"dev": "node scripts/dev-server.mjs"`.
1. `root = worktreeRoot()`; `OPS_DEV_GUARDED` gezet → gebruik `OPS_DEV_PORT`, sla
   toewijzing + slot over (geneste start onder `tauri-dev`).
2. anders: `port = allocatePort(root)`; `acquireGuardLock(root, port)` (weiger+exit).
3. `spawn(viteBin, { env:{...env, OPS_DEV_PORT:String(port)}, stdio:'inherit' })`.
   `viteBin` via `node_modules/.bin` (+ `.cmd` op win32), net als `tauri-dev.mjs` —
   kale `spawn('vite')` faalt bij directe `node`-start/Windows.
4. print `▶ … worktree "<slug>" → http://localhost:<port>/`.
5. release slot + propageer exit-code.

### 5. `scripts/dev-bootstrap.mjs` + **user-global** hook — launch.json-sync

`preview_start` leest `launch.json.port` vóór het commando draait; de bootstrap
zorgt dat het al klopt. Committed projecthook onmogelijk (`.claude/` gitignored),
dus **`~/.claude/settings.json`**:

```json
{ "hooks": { "SessionStart": [
    { "hooks": [ { "type": "command", "command": "node scripts/dev-bootstrap.mjs || true" } ] }
] } }
```

`dev-bootstrap.mjs` zelf-scopet (leest `package.json`, exit 0 als niet onze app),
`allocatePort(worktreeRoot())`, her-stempelt launch.json. Idempotent.

**Cwd-robuustheid (review-punt v3 #2):** SessionStart draait het commando met een
niet-gegarandeerde cwd; een kaal relatief `node scripts/dev-bootstrap.mjs` faalt
stil als de cwd niet de root is (`|| true` slikt het). Daarom bepaalt het script
zijn eigen locatie niet nodig — maar de **reikwijdte is eerlijk beperkt**: de hook
is **ergonomie, geen correctheidsvereiste**. De harde garantie tegen wrong-build zit
in de vastgelegde `opsDevPort` + de launcher (die stempelt óók). Restrisico, eerlijk:
in een **bestaand** worktree dat nog `port:3007`/geen `opsDevPort` heeft, kan een
`preview_start` vóór de eerste `npm run dev` én vóór een geslaagde hook-run nog de
stale 3007 pakken. Mitigatie: eenmalig `npm run dev` (of nieuwe sessie mét werkende
hook) her-stempelt. **Implementatie-eis:** verifieer de SessionStart-cwd-semantiek;
als die niet de root is, maak de bootstrap cwd-robuust (bv. via een absoluut
scriptpad in het hook-commando).

## Randgevallen

- **Verweesde/kapotte worktree** (git-dir wijst naar verplaatste repo → `git
  rev-parse` gooit): `worktreeRoot()`/`readRecordedPort` vangen af → `null` →
  `vite.config.ts` valt terug op 3007, geen crash.
- **Poort-uitputting** (>100 worktrees): `allocatePort` faalt luid.
- **PID-recycling / lege-slot-race:** atomair schrijven + leeg-slot-als-levend +
  `startedAt`-plausibiliteit; alloc-flock steelt nooit op leeftijd.
- **Vreemd proces pakt de vastgelegde poort tussen probe en Vite-bind:** buiten de
  flock, dus best-effort → `strictPort` → schone EADDRINUSE (geen wrong-build);
  herstart her-probet niet, dus faalt schoon tot dat proces weg is (UX-ruis).

## Raakt ook (mee in scope)

- **`docs/self-test-harness.md`** hardcodeert `localhost:3007` (regels ~40/42/43) —
  moet de poort uit launch.json / launcher-print lezen. Ook de MEMORY-notitie
  "harness = poort 3007" is achterhaald.
- **`OPS_DEV_INSTANCE`/recovery-isolatie** blijft op basename (ongewijzigd) — twee
  worktrees met identieke basename delen recovery; pre-existing, **buiten scope**.

## Testen (geen raakvlak met de CPM-suite — geverifieerd: `run.sh` importeert `vite.config.ts` niet)

1. **Unit (node):** `allocatePort` gemockt → distinct per pad; idempotent; verwijderd
   pad geeft poort vrij; identieke basenames → verschillende poorten; bestaande
   `port:3007` zónder `opsDevPort` → niet-toegewezen. **Steal-race:** twee "stelers"
   van één verweesd slot → precies één wint (O_EXCL), geen dubbele eigenaar.
2. **Integratie (shell):** twee `dev-server.mjs` in één worktree → 2e exit ≠ 0 +
   weiger-melding; twee worktrees → twee poorten; geneste `OPS_DEV_GUARDED=1` →
   geen alloc/lock.
3. **Tauri-verificatie (handmatig, vóór "af" — blijft [VERMOED] tot gedraaid):**
   echte `npm run tauri:dev`; print `OPS_DEV_GUARDED`+`OPS_DEV_PORT` vanuit de
   geneste `dev-server.mjs`; bevestig env-overerving + geen deadlock.

## Buiten scope (YAGNI)

- `npm run preview` (4173); recovery-isolatie op pad i.p.v. basename; aparte gedeelde JSON-registry (git `worktree list` vervangt 'm).

## Raakbestanden

| Bestand | Wijziging |
|---|---|
| `scripts/dev-port.mjs` | nieuw — geen import-tijd-side-effects; `worktreeRoot` (realpath, defensief), `readRecordedPort` (opsDevPort), `allocatePort` (absolute-pad git + flock) |
| `scripts/dev-lock.mjs` | nieuw — race-veilig `unlink`+`open('wx')`-steal; alloc-flock (dode-pid-steal only, absoluut verankerd) + runtime-slot (age-steal ok) |
| `scripts/dev-server.mjs` | nieuw — browser-launcher (OPS_DEV_GUARDED-bewust) |
| `scripts/dev-bootstrap.mjs` | nieuw — zelf-scopende, cwd-robuuste launch.json-stamper |
| `scripts/tauri-dev.mjs` | `findFreePort()` → `allocatePort()`; claimt guard-slot; zet `OPS_DEV_GUARDED=1`; **behoudt `OPS_DEV_INSTANCE`** |
| `vite.config.ts` | defensieve `readRecordedPort(cwd)`-fallback i.p.v. kale `|| 3007` |
| per-worktree `.claude/launch.json` | ad-hoc aangemaakt (géén getrackt template); allocator voegt `opsDevPort` toe naast `port`; verse bestanden dragen géén `opsDevPort` |
| `package.json` | `"dev": "vite"` → `"node scripts/dev-server.mjs"` |
| `~/.claude/settings.json` | user-global SessionStart-hook (buiten de repo) |
| `docs/self-test-harness.md` | 3007-aannames vervangen door launch.json-poort |
| `tests/dev-server/…` | nieuwe unit + integratietest (incl. steal-race) |
