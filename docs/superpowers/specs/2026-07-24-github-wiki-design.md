# Ontwerp: Engelse GitHub-wiki, gegenereerd uit de repo

**Datum:** 2026-07-24
**Status:** goedgekeurd ontwerp — klaar voor implementatieplan
**Doel:** een Engelstalige publieke wiki op `github.com/OpenAEC-Foundation/open-planner-studio/wiki`
die dient als documentatiehub voor internationaal bereik, **zonder dubbel onderhoud** ten opzichte
van de bestaande in-app documentatie.

## Kernbeslissingen (vastgelegd tijdens brainstorm)

1. **Brontaal = uitsluitend Engels.** Geen meertalige wiki (GitHub heeft geen native i18n; elke extra
   taal = handmatig dubbel schrijfwerk). Meer internationaal bereik weegt zwaarder dan NL-dekking online.
2. **Eén bron, wiki is een build-artefact.** De wiki wordt **nooit direct bewerkt**. Alle pagina's
   worden gegenereerd uit bestanden die al in de repo staan en bij release naar `.wiki.git` gepusht.
3. **Publiceren gebeurt bij release**, niet via een GitHub Action. Het script draait onder het account
   van de maintainer tijdens de release (geen token-gedoe in Actions); het past in het bestaande
   release-runbook dat al een "docs+wiki"-stap noemt.

## Bronnen (single source of truth)

| Bron in de repo | Levert |
|---|---|
| `public/docs/en/*.md` + `public/docs/manifest.json` | De volledige manual (25 artikelen, bestaat al — voedt óók de in-app F1/Help) |
| `docs/wiki/*.md` (nieuw) | Wiki-only pagina's die nergens anders bestaan: Home, Features, Installation, Contributing, Extensions-Authoring |
| `docs/CHANGELOG.md` | De Changelog-pagina (as-is, Nederlandstalig, met Engels kopje) |
| Repo-screenshots (`screenshot*.png`) | Beeldmateriaal voor de Home-pagina (gekopieerd als wiki-asset) |

De in-app Help (`HelpPanel.tsx`) blijft ongewijzigd `public/docs/`-artikelen serveren. De wiki is een
**tweede consument** van diezelfde bronbestanden — niet andersom.

## Pagina-inventaris & naamgeving

Wiki-pagina's zijn plat; navigatie zit in een gegenereerde `_Sidebar.md`. Pagina-namen worden afgeleid
uit `title.en` in het manifest via een deterministische slug-regel:

- `&` → `and`
- `/` → `-`
- parenthetische toevoeging `(...)` weglaten (bijv. "Codes & fields (structure)" → `Codes-and-Fields`)
- spaties en overige leestekens → `-`, meerdere `-` samenvouwen

Het script berekent deze slug zelf, gebruikt hem als bestandsnaam **en** in alle interne links, zodat
GitHub's eigen sanitizering niet tot mismatches leidt.

### Wiki-only pagina's (bron: `docs/wiki/`)
- `Home` — landingspagina: pitch in één zin, screenshot, download-/live-links, snelkoppelingen naar de secties, licentie.
- `Features` — Engels overzicht van mogelijkheden (Gantt/CPM/WBS, IFC-native & 4D BIM, resources, rapportage, 14 talen, desktop + browser, extensies). Vers geschreven (README-featurelijst is NL).
- `Installation` — Windows/macOS/Linux-installers, Snap, browserversie, auto-update.
- `Contributing` — build-from-source + bijdragen; Engelse bewerking van het dev-deel van de README.
- `Extensions-Authoring` — Engelse versie van `docs/extensions.md` (manifest, API, installeren).

### Manual-pagina's (bron: `public/docs/en/` via manifest)

| Bron-id | Wiki-pagina | Laag |
|---|---|---|
| quick-start | Quick-Start | Getting started |
| gids-plannen-wbs | Planning-and-WBS | Guides |
| gids-relaties-constraints | Relations-and-Constraints | Guides |
| gids-kalenders-uren | Calendars-and-Hour-Planning | Guides |
| gids-resources-histogram | Resources-Histogram-and-Leveling | Guides |
| gids-baselines-voortgang | Baselines-and-Progress | Guides |
| gids-kritiek-pad-analyse | Critical-Path-and-Advanced-Analysis | Guides |
| gids-import-export | Import-Export | Guides |
| gids-rapporten-printen | Reports-and-Printing | Guides |
| gids-sneltoetsen-bediening | Keyboard-Shortcuts-and-Controls | Guides |
| ref-taakdialoog | Task-Dialog | Reference |
| ref-kalenderdialoog | Calendar-Dialog | Reference |
| ref-resourcekalender | Resource-Calendar | Reference |
| ref-nivellering | Leveling-Options | Reference |
| ref-baselinebeheer | Baseline-Management | Reference |
| ref-externe-koppelingen | External-Links | Reference |
| ref-codes-velden | Codes-and-Fields | Reference |
| ref-filters | Filters | Reference |
| ref-kolommen | Choosing-Columns | Reference |
| ref-layouts | Saving-and-Loading-Layouts | Reference |
| ref-projectgegevens | Project-Information | Reference |
| ref-instellingen | Settings | Reference |
| ref-extensies | Managing-and-Installing-Extensions | Reference |
| ref-herstellen | Recovering-After-a-Crash | Reference |
| ref-sneltoetsen | Keyboard-Shortcut-Reference | Reference |

### Changelog-pagina (bron: `docs/CHANGELOG.md`)
Wordt **as-is** (Nederlandstalig) gepubliceerd als `Changelog`, met een kort automatisch toegevoegd
Engels kopje: *"Detailed change notes are currently maintained in Dutch. English release summaries are
on the [Releases](…) page."* De backlog vertalen valt buiten scope; Engelstalig-vooruit is een latere
aparte contentkeuze.

## Navigatie: `_Sidebar.md` en `_Footer.md` (gegenereerd)

`_Sidebar.md` wordt opgebouwd uit de manifest-volgorde + `layer`-veld, met de wiki-only pagina's
bovenaan:

```
**Open Planner Studio**
- Home
- Features
- Installation

**Getting started**
- Quick Start

**Guides**
- Planning & WBS
- … (9 gidsen in manifest-volgorde)

**Reference**
- Task Dialog
- … (15 ref-artikelen)

**Project**
- Changelog
- Contributing
- Extensions Authoring
```

`_Footer.md` bevat een prominente banner: **"⚠️ This wiki is generated from the repository. Edit the
source files under `public/docs/en/` and `docs/wiki/`, not the wiki — direct edits are overwritten on
the next release."** Plus licentie (LGPL-3.0) en een link naar de repo.

## Link-omzetting (kern van het script)

De bron-`.md`-bestanden gebruiken twee eigen link-schema's die naar wiki-equivalenten moeten:

1. `](docs://<id>)` → `](<Wiki-Page-Name>)` — opgezocht via het manifest. Onbekende id → waarschuwing.
2. `](examples://<bestand>.ifc)` → **link verwijderd, linktekst blijft staan** (evt. cursief). Dit is
   een in-app-actie (opent een voorbeeldproject) die op een webpagina niets doet.

Geen ingebouwde afbeeldingen in de manual-artikelen (geverifieerd) — alleen deze twee schema's.

## Het publish-script

`scripts/publish-wiki.mjs` — Node ESM, zelfde stijl als `scripts/tauri-dev.mjs`.

**CLI:**
- `npm run publish:wiki` → bouwt alle pagina's in `.wiki-build/` (gitignored) en toont een diff.
  **Dry-run: pusht niet.** Standaardgedrag.
- `npm run publish:wiki -- --push` → clonet `…/open-planner-studio.wiki.git`, schrijft alle
  gegenereerde pagina's, `git add/commit/push`. Dit is de stap die in het release-runbook komt.

**Verantwoordelijkheden (idempotent — regenereert alle beheerde pagina's elke run):**
1. Manifest lezen → per artikel `public/docs/en/<id>.md` inlezen, links omzetten, wegschrijven als
   `<Wiki-Page-Name>.md`.
2. `docs/wiki/*.md` kopiëren als pagina's (links omzetten waar van toepassing).
3. `docs/CHANGELOG.md` → `Changelog.md` met Engels kopje ervoor.
4. Repo-screenshot(s) kopiëren als wiki-asset t.b.v. Home.
5. `_Sidebar.md` en `_Footer.md` genereren.
6. Diff tonen; bij `--push` committen en pushen.

## Eenmalige bootstrap (handmatig door maintainer, één keer)

Het script kan pas pushen als de wiki bestaat als git-repo:
1. Wiki aanzetten: repo → Settings → Features → **Wikis**.
2. Via de web-UI één **Home**-pagina aanmaken (initialiseert `.wiki.git`).

Daarna vult `npm run publish:wiki -- --push` alles. *(Deze twee stappen kan Claude niet doen — vereist
repo-settings/UI-toegang.)*

## Scope

**In scope (nu):** publish-script + `npm`-script, `docs/wiki/`-bronpagina's (Home, Features,
Installation, Contributing, Extensions-Authoring), sidebar/footer-generatie, link-omzetting,
changelog-passthrough, screenshot-asset, dry-run + push, bootstrap-documentatie, opname in het
release-runbook.

**Uit scope:** vertalen van de changelog-backlog; meertalige wiki; GitHub-Action-automatisering;
wijzigingen aan de in-app Help (`HelpPanel.tsx`) of aan de bron-artikelen zelf.

## Risico's / aandachtspunten

- **Link-omzetting** is het foutgevoeligste deel: de slug-regel moet exact matchen tussen
  bestandsnaam en interne links. Mitigatie: script berekent de slug centraal en gebruikt hem overal;
  onbekende `docs://`-id's geven een waarschuwing, geen stille fout.
- **Wiki pushen = publiceren van publieke content.** De push zit bewust achter `--push` en gebeurt
  alleen binnen een door de maintainer gestarte release.
- **Bootstrap is handmatig** en eenmalig; het script faalt met een duidelijke melding als de wiki nog
  niet geïnitialiseerd is.
