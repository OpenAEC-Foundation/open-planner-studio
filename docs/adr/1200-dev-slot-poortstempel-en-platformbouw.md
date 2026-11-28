# Dev-slot, poortstempel en platformbouw: keuzes die verrassen

Het slotprotocol van `scripts/dev-lock.mjs` (verse claim met `open('wx')`, stelen via `rename`, controleren en
terugzetten met `link`) staat in `docs/superpowers/specs/2026-07-23-dev-server-dual-guard-prevention-design.md` §3.
Drie keuzes eromheen staan daar niet en zouden een lezer verrassen.

## Gevolgen

- `acquireLock` behandelt een leeg of half geschreven slot als levend, behalve als zijn mtime ouder is dan
  `emptyAgeMs`. Dat geldt voor elk slot, ook voor het toewijzingsslot met `allowAgeSteal: false`: die regel beschermt
  een trage toewijzer met een pid in het slot, en een leeg slot noemt geen pid. Een levende maker laat geen leeg slot
  staan, want `fillOwnLock` ruimt het eigen slot op als schrijven of sluiten mislukt. Zonder deze uitzondering
  blokkeert één achtergebleven leeg toewijzingsslot elke worktree, want `allocLockPath` ligt in de gedeelde
  git-common-dir. `emptyAgeMs` (10 s) blijft onder de 15 s die `withAllocLock` wacht, zodat wie achter zo'n slot
  wacht er in dezelfde poging langs komt. Een slot dat niet te lezen is (rechten), geldt niet als leeg.
- `allocateNamedPort` (`scripts/dev-port.mjs`) keurt een bestaande stempel alleen af als een andere worktree dezelfde
  poort gestempeld heeft, nooit omdat de poort bezet is. `dev-server.mjs` en `tauri-dev.mjs` roepen `allocatePort`
  aan vóór `acquireGuardLock`, en de eigen draaiende dev-server bindt juist de eigen poort; afkeuren op "bezet" zou
  de poort van een gewoon draaiende worktree laten verspringen. Bezetting telt alleen bij het kiezen van een nieuwe
  poort. De controle van de eigen stempel valt binnen `withAllocLock`: erbuiten kunnen twee worktrees dezelfde botsing
  tegelijk oplossen en weer op één poort landen.
- `scripts/build-platform.mjs` haalt `OPS_DEV_INSTANCE` en elke `VITE_*` uit de omgeving van tsc en Vite. Vite laat
  een `VITE_*` uit de omgeving voorgaan op `.env.platform` (`loadEnv` in Vite), dus anders zet een
  `VITE_OPS_BENCH_BRIDGE=1` uit de shell de testbrug (`window.__OPS__`, `src/main.tsx`) in de platformbundel en kan een
  `VITE_OPS_PLATFORM` uit de shell de bouwvlag overschrijven. `OPS_DEV_INSTANCE` zou `vite.config.ts` als
  `__OPS_DEV_INSTANCE__` in de bundel zetten, het voorvoegsel van de herstelbestanden (`recoveryPaths.ts`); een
  platformbundel hoort er geen te hebben, ook niet als het script uit een dev- of testomgeving start.
