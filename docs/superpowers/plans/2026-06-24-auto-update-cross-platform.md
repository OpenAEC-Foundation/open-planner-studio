# Plan: Auto-update + cross-platform builds (Win/macOS/Linux)

_Datum: 2026-06-24 · Status: goedgekeurd; wacht op Fase 0 (keypair/secrets) voordat Fase 1–4 starten_

Doel: een in-app auto-update voor Open Planner Studio op **Windows, macOS en Linux**,
gevoed door GitHub Releases (`latest.json`), met behoud van de bestaande Windows
Authenticode-signing. Blauwdruk afgeleid uit de zusterprojecten `open-2d-studio`
(stack-match: React + Vite + Tauri 2 + Zustand) en `open-pdf-studio` (Windows re-sign +
macOS universal). `open-calc-studio` zelf heeft géén updater — niet als referentie gebruikt.

## Uitgangspunt (huidige stand)

- **Geen updater** aanwezig: niet in JS, Rust, `tauri.conf.json`, capabilities of UI.
- `release.yml` **bouwt al installers** voor alle drie de OS'en (draft → matrix-build →
  publish) en **signt Windows al via Azure Trusted Signing** (secrets aanwezig); macOS is
  universal maar unsigned. Dit blijft onze basis — de updater komt erbóvenop.
- Versie is `2026.6.0` (CalVer). `Cargo.toml` blijft bewust `0.1.0` (Rust-crate, niet de
  app-versie). De updater vergelijkt versies uit `tauri.conf.json`, niet uit `Cargo.toml`.

## Fase 0 — Keypair & secrets (eenmalig; vereist jou)

1. `npm run tauri signer generate -- -w ~/.tauri/ops.key` → minisign **private key** + wachtwoord + **public key**.
2. GitHub repo-secrets zetten (`gh secret set ...`):
   - `TAURI_SIGNING_PRIVATE_KEY` = inhoud private key
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = wachtwoord (níét hardcoden in YAML, zoals de siblings wél doen)
3. **Public key** noteren → gaat in `tauri.conf.json` (Fase 1).

> Dit raakt geheimen en je GitHub-account, dus dit doe jij (of jij geeft akkoord dat ik de
> `gh secret set`-commando's aanreik). De rest (Fase 1–4) is code/CI die subagents doen.

## Fase 1 — App-integratie: updater-plugin + config (code)

1. **`src-tauri/tauri.conf.json`**
   - `bundle.createUpdaterArtifacts: true` (schone start; siblings gebruiken `v1Compatible` om v1-migratie, dat hebben wij niet nodig)
   - `plugins.updater`:
     ```json
     "updater": {
       "endpoints": ["https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest/download/latest.json"],
       "pubkey": "<public key uit Fase 0>"
     }
     ```
     ⚠️ Endpoint exact gelijk aan `owner/repo` (de PDF-repo had per ongeluk een oude naam in de URL).
2. **`src-tauri/Cargo.toml`**: `tauri-plugin-updater = "2"` + `tauri-plugin-process = "2"`.
3. **`src-tauri/src/lib.rs`** (of `main.rs`): registreren bij de bestaande plugins —
   `.plugin(tauri_plugin_process::init())` + `.plugin(tauri_plugin_updater::Builder::new().build())`.
   (Blijft "thin Rust" — alleen plugin-registratie.)
4. **`src-tauri/capabilities/default.json`**: `updater:default`, `process:allow-restart`, `process:allow-exit`.
5. **`package.json`**: `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process`.

## Fase 2 — Frontend-service + UI (code)

1. **`src/services/updater/updaterService.ts`** — wrapper met getypeerde `UpdateStatus`-union
   (`upToDate | available | downloading | readyToInstall | error`):
   - `checkForUpdates(silent, onStatus?)` → `check()`; in silent-modus errors slikken.
   - `downloadAndInstall(onStatus?)` → `update.downloadAndInstall` met progress-events
     (`Started`/`Progress`/`Finished` → %), daarna `relaunch()`.
   - Tauri-modules **dynamisch importeren binnen een `isTauri()`-branch** (zoals het auto-save-pattern in `App.tsx`) — anders breekt de web-build.
2. **Silent startup-check** in `App.tsx` (Tauri-only branch): `checkForUpdates(true).catch(()=>{})`.
3. **UI**: een "Controleren op updates"-knop + update-dialog (versienr + changelog + progress-bar +
   "Downloaden & installeren" → relaunch; retry bij fout). Plek: **Instellingen** (past in ons
   3-surfaces-settingsmodel) of **Backstage → Over**. Alle tekst via `t(...)`, canoniek NL, 14 locales.
4. Optioneel: "Sla deze versie over" via `settingsStore`/localStorage (zoals pdf-studio).

## Fase 3 — CI: `latest.json` genereren + Windows re-sign (ci)

1. `TAURI_SIGNING_PRIVATE_KEY` + `..._PASSWORD` als **env** aan elke build-job toevoegen
   (zonder key crasht de build zodra `createUpdaterArtifacts` aanstaat).
2. **Linux + macOS** (`build-linux-mac`): `includeUpdaterJson: true` op de `tauri-action`-stap →
   genereert + uploadt `latest.json` met de linux/macos-signatures naar de draft-release.
3. **Windows** — wij signen al met Azure ná de Tauri-build, dus de updater-`.sig` klopt niet meer
   met de gewijzigde `.exe`. Overnemen van `open-pdf-studio` (release.yml re-sign-blok):
   1. herpak `.nsis.zip` rond de gesignde `.exe` met **Deflate/Optimal** (níét `Compress-Archive` →
      dat kan Deflate64 gebruiken, wat Tauri's updater niet ondersteunt);
   2. `npx tauri signer sign` opnieuw op `.exe` én `.zip` → nieuwe `.sig`-bestanden;
   3. `latest.json` downloaden, de signatures voor `windows-x86_64` (zip) en `windows-x86_64-nsis`
      (exe) vervangen, en alles `gh release upload --clobber` her-uploaden.
   > Dit is dé niet-vanzelfsprekende les; zonder deze stap faalt Windows auto-update met "signature mismatch".
4. **draft → publish** behouden (voorkomt half-lege releases / kapotte `latest.json` voor live gebruikers).

## Fase 4 — Versie-sync & release-proces (tooling)

- **`scripts/bump-version.js <X.Y.Z>`** dat `package.json`, `src-tauri/tauri.conf.json` en de
  `default:`-versie in `release.yml` tegelijk update (`Cargo.toml` laten we op `0.1.0`).
- Release-workflow voor mensen: `npm run bump 2026.7.0` → commit → `git tag v2026.7.0` → push tag → CI doet de rest.

## Bewust genomen defaults (corrigeer indien gewenst)

- **macOS**: universal (Intel+ARM) maar **unsigned/zonder notarization** — net als beide siblings.
  Gebruikers krijgen een Gatekeeper-waarschuwing. Apple notarization = later (vereist betaald
  Apple Developer-account, ±$99/jr + `APPLE_*`-secrets).
- **Windows**: bestaande Azure Trusted Signing **behouden** → re-sign-dans is voor ons verplicht.
- **`createUpdaterArtifacts: true`** (geen v1-compat nodig).
- **Geen nightly-kanaal** nu (optioneel later: rolling prerelease met `includeUpdaterJson: false`).

## Genomen beslissingen (2026-06-24)

1. **macOS: nu unsigned** (universal Intel+ARM, zonder notarization) — zoals beide siblings.
   Apple notarization wordt later overwogen (vereist betaald Apple Developer-account).
2. **Implementatie wacht op Fase 0**: zodra het keypair gegenereerd is en de twee GitHub-secrets
   staan, starten Fase 1–4 (subagents). Tot die tijd: alleen dit plan.

## Verificatie (Definition of Done)

- `npm run build` groen (web + tsc); web-build niet kapot door updater-imports.
- Een test-tag `vX.Y.Z` produceert een release met installers **én** `latest.json` + `.sig` voor alle 3 OS'en.
- Een geïnstalleerde oudere versie detecteert de nieuwe via de in-app check en update + herstart succesvol
  (minimaal Windows + Linux; macOS unsigned handmatig te testen).

## Aanvulling (2026-07-03) — .deb-auto-update + stabiele latest.json-URL's

Twee lessen uit het onderzoek "updater werkt niet op .deb (Ubuntu)":

1. **.deb is een volwaardig auto-update-platform.** `tauri-plugin-updater` ≥2.6 (wij: 2.10.1)
   detecteert het install-type via een bundle-type-stempel die de bundler in het binary patcht
   (`__TAURI_BUNDLE_TYPE_VAR_DEB` — geverifieerd aanwezig in de gepubliceerde v2026.7.1-deb).
   Daardoor zoekt de plugin éérst `linux-x86_64-deb` in `latest.json` (fallback `linux-x86_64`)
   en installeert hij via pkexec → zenity/kdialog+sudo → sudo met `dpkg -i`. De oude gating
   in `UpdateDialog` (deb → alleen handmatige instructies) was gebaseerd op een achterhaalde
   aanname en is vervangen: deb krijgt de normale installeerknop; het copy-paste-commando en
   de downloadpagina-knop blijven enkel als fallback bij een fout. Alleen **snap** slaat de
   in-app updater nog over (snapd werkt zelf bij).
2. **Schrijf in `latest.json` nooit asset-URL's over uit de API zolang de release draft is.**
   `gh release view --json assets` geeft tijdens de draft-fase `releases/download/untagged-…`-
   URL's terug die na publicatie 404'en (zo brak Windows-auto-update in v2026.7.1). De
   re-sign-stap in `release.yml` gebruikt nu alleen de asset-*naam* uit de API (vanwege
   GitHub's spatie→punt-herschrijving) en bouwt zelf de stabiele
   `releases/latest/download/<naam>`-URL — consistent met wat tauri-action voor linux/macos
   schrijft. De `latest.json` van v2026.7.1 is achteraf op de release gerepareerd
   (alleen URL's; signatures ongewijzigd geldig).

Kanttekening voor de eerstvolgende release: bestaande .deb-installaties draaien nog de oude
dialog en moeten dus **éénmalig handmatig** naar de eerste versie mét deze fix; daarna updaten
ze in-app.
