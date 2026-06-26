# Snap-packaging — ontwerp

**Datum:** 2026-06-26
**Status:** ontwerp goedgekeurd, klaar voor implementatieplan
**Worktree/branch:** `worktree-snapzooi`

## Probleem

Open Planner Studio (Tauri 2 + WebKitGTK) distribueert Linux via AppImage, deb en
rpm (release-assets, met auto-update). **Snap werkt niet:**

- `.github/workflows/snap.yml` bestaat, maar is `workflow_dispatch`-only en is
  nergens aan de release-flow gekoppeld — een release triggert 'm dus nooit.
- De workflow `sed`-t `snap/snapcraft.yaml`, maar **dat bestand bestaat niet** en
  er is geen `snap/`-map → zelfs handmatig gestart faalt 'ie.
- Run-historie: alleen op `v2026.2.0`, 5× failure / 1× cancelled. **Nooit groen.**
- De laatste release `v2026.6.0` heeft géén `.snap`-asset.

Gevolg: de nieuwste versie staat **niet** op snap en kán dat structureel ook niet.

## Doel (deze worktree)

Een werkende, herhaalbare snap-build die op tag-push een `.snap` op de GitHub-release
zet, met de Snap-Store-publish-stap klaar-maar-gated. **Niet** in scope: daadwerkelijk
live in de Store (vereist account-stappen van de eigenaar — zie Follow-ups).

## Beslissingen (goedgekeurd)

- **Confinement:** `strict` met de `gnome`-extensie. Standaard voor desktop-GUI-snaps;
  auto-publiceerbaar naar `stable` zonder handmatige review. De gnome-extensie wired
  GTK/WebKitGTK uit het GNOME-platform-snap (de betrouwbare manier om WebKit in een
  strict snap te laten draaien). *Niet* classic: dat vereist handmatige review en is
  voor een GUI-app moeilijk goedgekeurd te krijgen.
- **Binary-bron:** de snap **downloadt de zojuist gepubliceerde release-deb** en
  herverpakt die (geen tweede Tauri-build, en de snap wrapt exact dezelfde artifact
  als de overige Linux-downloads).
- **Scope:** groene build + `.snap` als release-asset; Store-publish gated op secret.

## Architectuur

### 1. `snap/snapcraft.yaml` (nieuw)

- `name: open-planner-studio` (== app-naam → commando is `open-planner-studio`)
- `base: core22` (matcht ubuntu-22.04 / `libwebkit2gtk-4.1`)
- `confinement: strict`, `grade: stable`
- `version`: placeholder, in CI overschreven met het release-versienummer
- `summary` / `description`: korte productomschrijving
- één `apps.open-planner-studio`:
  - `command`: pad naar de uitgepakte binary (`usr/bin/open-planner-studio`)
  - `extensions: [gnome]`
  - `plugs: [home, removable-media, network, opengl, audio-playback,
    browser-support, gsettings, desktop, desktop-legacy, wayland, x11, unity7]`
    — `home`/`removable-media` zijn nodig voor IFC open/opslaan/export.
- één `parts.open-planner-studio`:
  - `plugin: nil`, `source: .` (de deb is in CI naar de repo-root gekopieerd)
  - `override-build`: `dpkg-deb -x open-planner-studio.deb "$CRAFT_PART_INSTALL"`
    (expliciet uitpakken; betrouwbaarder dan de `dump`-plugin op `.deb`)
  - desktop-entry + icon uit de deb hergebruiken; Exec/Icon-regels zo nodig
    herschrijven naar de snap-conventie.
  - `stage-packages`: alleen libs toevoegen die de gnome-runtime niet levert
    (iteratief vaststellen uit build-output; bewust minimaal beginnen).

### 2. `.github/workflows/snap.yml` (herschrijven)

- **Triggers:** `push: tags: ['v*']` **én** `workflow_dispatch` (versie-input behouden).
- **Versie bepalen:** uit de tag (push) of de input (dispatch); `version_number`
  zonder `v`-prefix.
- **Deb ophalen i.p.v. bouwen:**
  - wacht (poll-loop, met timeout) tot de GitHub-release voor de tag bestaat én de
    `*_amd64.deb`-asset aanwezig is;
  - `gh release download <tag> -p '*_amd64.deb'` → kopieer naar repo-root als
    `open-planner-studio.deb`.
- **Versie injecteren:** `sed` `version_number` in `snap/snapcraft.yaml`.
- **Bouwen:** `snapcore/action-build@v1`.
- **Output:**
  - **tag-push:** `gh release upload <tag> *.snap --clobber` (snap als release-asset);
  - **workflow_dispatch:** `actions/upload-artifact` (de release **niet** aanraken —
    veilige testroute).
- **Store-publish (gated):** `snapcraft upload "$SNAP" --release=stable`, met
  `if: env.SNAPCRAFT_STORE_CREDENTIALS != ''` zodat 'ie pas live publiceert zodra het
  secret bestaat.

### 3. Verificatie zonder nieuwe release

`workflow_dispatch` met `version: v2026.6.0` → downloadt de bestaande release-deb,
bouwt de snap, levert 'm als CI-artifact. **Groene build + downloadbare `.snap` = klaar**,
zonder een nieuwe tag/release te maken (conform de afspraak: nieuwe tag = altijd eerst
akkoord vragen).

## Data flow

```
git tag vX  ──push──▶ release.yml ──▶ GitHub-release + *_amd64.deb
                                            │
            (zelfde tag-push) snap.yml ─────┘ wacht op deb-asset
                                            ▼
                       gh release download deb ─▶ dpkg-deb -x ─▶ snapcraft (gnome, strict)
                                            ▼
                       *.snap ─▶ release-asset (--clobber)
                                            ▼
                       (gated) snapcraft upload --release=stable
```

## Verificatie / Definition of Done

- `snap/snapcraft.yaml` bestaat en is intern consistent met `snap.yml`.
- `snap.yml` is YAML-geldig; getriggerd op tag-push + dispatch.
- Een `workflow_dispatch`-run tegen `v2026.6.0` produceert een **groene build** en een
  **downloadbaar `.snap`-artifact**.
- `npm run build` (`tsc --noEmit`) blijft groen (geen frontend-regressie).
- `docs/CHANGELOG.md` en `docs/TODO.md` bijgewerkt.

## Buiten scope — gedocumenteerde follow-ups

1. **In-app updater uitzetten binnen de snap.** In een read-only strict snap kan de
   Tauri-updater de binary niet vervangen; de Store doet de refresh. Detecteren via de
   door snapd gezette env `SNAP` (Rust-zijde, dun gehouden) en de updater-check
   overslaan. Reëel correctheidspunt, maar blokkeert "staat-ie op snap" niet.
2. **Live gaan in de Snap Store (eigenaar-stappen):** `snapcraft register
   open-planner-studio` + het `SNAPCRAFT_STORE_CREDENTIALS`-secret toevoegen. Daarna
   publiceert de gated stap automatisch.

## Risico's / iteratiepunten

- Strict + WebKitGTK kan runtime-tweaks vragen (fontconfig, dconf/gsettings, WebKit-
  sandbox). Bekende mitigaties: `browser-support`-plug, evt. `WEBKIT_DISABLE_*`-env.
  Dit is de te temmen "snapzooi"; de `workflow_dispatch`-route laat ons itereren zonder
  releases te raken.
- Timing tussen `release.yml` en `snap.yml`: ondervangen met de poll-loop op de
  deb-asset (met timeout) i.p.v. alleen op het bestaan van de release.
