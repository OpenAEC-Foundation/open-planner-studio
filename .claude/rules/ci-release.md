---
paths:
  - ".github/**"
  - "docs/release-notes/**"
  - "docs/CHANGELOG.md"
  - "docs/release-secrets.md"
  - "scripts/release-notes.mjs"
  - "scripts/bump*"
  - "scripts/*release-highlights*"
  - "snap/**"
  - "src/services/updater/**"
  - "public/release-highlights.json"
  - "package.json"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud ongewijzigd overgenomen; "hierboven"/"hieronder" verwijst naar de oude volgorde van CLAUDE.md. -->

# CI, auto-update en releases

CI (`.github/workflows/`): `ci.yml` draait `npm run verify` plus `tauri build --no-bundle` op Ubuntu/Windows/macOS; `live.yml` deployt de browserbuild (`dist/`) naar `open-planner-studio.open-aec.com` bij elke push naar `main` — de webbuild is een echte productie-deploy, geen dev-target — achter dezelfde `verify`-gate; `release.yml` bouwt installers op `v*`-tags achter diezelfde gate plus een controle dat de tag overeenkomt met de gebumpte versie, en `snap.yml` volgt daarna via `workflow_run` (zie *Auto-update & releases* hieronder). Een rode suite blokkeert dus zowel de deploy als de release; draai `npm run verify` lokaal vóór je pusht. `verify:audit` zit sinds 2026-09-03 bewust **niet** meer in die keten: een nieuw gepubliceerd advisory zette anders élke push en deploy rood, ook een die de dependency niet raakt (gemeten: de releasecommit van v2026.9.0 op `browserslist`). Dependabot security alerts staan aan op de repository en zijn het meldkanaal; een advisory wordt in een eigen commit opgelost, `npm run verify:audit` blijft daarvoor als los commando bestaan.

## Auto-update & releases

Versies zijn CalVer (`YYYY.M.patch`), gelijkgehouden tussen `package.json` en `src-tauri/tauri.conf.json` via `npm run bump` (`Cargo.toml` blijft bewust `0.1.0`). De volledige runbook staat in de **`release`-skill** (`.claude/skills/release/`) — draai die bij een release in plaats van de stappen los te herhalen; een `v*`-tag is onomkeerbaar en auto-update naar alle gebruikers. Release-flow in het kort: `npm run bump <versie>` → **releasetekst schrijven in `docs/release-notes/v<versie>.md`** → commit → tag `v*` → push; `release.yml` bouwt en signeert installers (Windows via Azure Trusted Signing; macOS universal, met `app`-target voor de updater) en publiceert `latest.json`; `snap.yml` verpakt daarna de release-`.deb` tot Snap (`snap/snapcraft.yaml`) en publiceert 'm — sinds 2026-07-30, met het secret `SNAPCRAFT_STORE_CREDENTIALS` (zie `docs/release-secrets.md`) — ook automatisch naar het `stable`-kanaal van de Snap Store; dat gebeurt bij elke `v*`-tag en is, net als de rest van een release, onomkeerbaar. De in-app updater checkt stil bij het opstarten (`App.tsx` → `updaterService`, `UpdateDialog`): endpoint is de GitHub-release-`latest.json`, geverifieerd met de minisign-pubkey in `tauri.conf.json`; Snap/AppImage-installs slaan de updater over (detectie via het `install_kind`-command). Ná een geslaagde update toont `JustUpdatedDialog` één keer wat er nieuw is: `ui.justUpdated` wordt gezet door de versievergelijking tegen de bewaarde `ops-lastVersion`, en `src/services/updater/releaseInfo.ts` haalt de release-omschrijving, het grootteverschil en de tijd tussen releases op bij de GitHub Releases-API (pure functies, headless getest in `tests/planning/check-just-updated.ts`).

De webbuild levert daarnaast `public/release-highlights.json` mee — gegenereerd uit de catalogus met `npm run gen:release-highlights-json`, bewaakt door `npm run verify:release-highlights-json` en geserveerd op `https://open-planner-studio.open-aec.com/release-highlights.json` als bron voor de releasetijdlijn op open-aec.com.

**Releaseteksten hebben één bron.** `docs/release-notes/v<versie>.md` bevat alleen de "What's New"-inhoud; `scripts/release-notes.mjs` maakt daar de twee vormen van die de release nodig heeft: `--format=body` (markdown + het vaste Downloads-blok) voor de GitHub-releasepagina, en `--format=notes` (platte tekst — de updater-dialoog rendert geen markdown) voor het `notes`-veld in `latest.json`. `release.yml` roept dat op twee plekken aan: `create-release` voor de body, en `publish-release` voor `latest.json` vlak vóór publicatie. Ontbreekt het bestand, dan valt alles terug op het oude gedrag (generieke body, leeg `notes`-veld) en logt de gate een warning — een vergeten notesbestand breekt de release niet.
