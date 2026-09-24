---
name: docs-update
description: Use ONLY when the user explicitly invokes /docs-update, or in their own words asks to bring the documentation in line with the part that was just built. NEVER auto-trigger while a feature is still being built, and never as a routine follow-up to a commit, build, or merge.
---

# Docs-update — het onderdeel waar je aan werkte

## Overzicht
Je hebt zojuist een onderdeel gebouwd. Deze skill loopt de documentatie na op plekken die door
dát werk zijn gaan liegen, en werkt ze bij. Geen release-brede sweep — alleen wat jouw werk raakt.

**Kernprincipe:** de **code is de waarheid, de doc is een claim**. Elke doc-regel die je bijwerkt
toets je tegen wat er écht gebouwd is (de diff, de code), nooit tegen wat de doc nu toevallig
beweert of tegen je herinnering.

**Twee poorten, allebei hard:**
1. **Rapport-poort** (eind fase 1): je rapporteert de bevindingen en wacht op akkoord vóór je één
   bestand bewerkt.
2. **Nieuw-materiaal-poort**: staat er over dit onderdeel **nog nergens iets**, dan schrijf je
   niet uit jezelf een nieuw artikel of een nieuwe wiki-pagina — je vraagt het. Deze vraag stel
   je in hetzelfde rapport, niet los.

**Nooit uit jezelf starten.** Alleen op `/docs-update` of een expliciet verzoek. Niet halverwege
het bouwen, niet "even meenemen" na een commit, niet als opruimreflex na een merge.

## Verhouding tot de andere skills
| Skill | Wanneer | Scope |
|-------|---------|-------|
| **`docs-update`** (deze) | tijdens de rit, na één afgerond onderdeel | alleen wat dat onderdeel raakt |
| **`wiki`** | bij release, of een losse wiki-actie | alle docs tegen alle commits sinds de vorige tag; is óók de bron voor de generator-mechanica |
| **`release`** | alleen bij `/release` | roept `wiki` aan als stap 5 |

Generator-details (hoe `publish-wiki.mjs` werkt, slugs, `docs://`-omzetting) staan in de
`wiki`-skill — daar lezen, niet hier dupliceren.

## Vaste feiten
- **In-app help** = `public/docs/<lang>/<id>.md` + `public/docs/manifest.json` (het manifest is de
  index — aantallen tel je daar, niet uit je hoofd). Gelezen door
  `src/components/backstage/HelpPanel.tsx` — Backstage → Help en **F1**.
- **Brontalen zijn `nl` + `en`** — die werk je **allebei** bij, altijd. De overige locales laat je
  met rust: die lopen in een aparte maandelijkse vertaalronde. `verify:docs` eist alleen nl+en en
  accepteert ontbrekende vertalingen (bewezen: `gids-ai-mcp` bestaat alleen in nl+en, poort groen).
  Voeg je in nl+en een kop of `docs://`-link toe aan een gids die al vertalingen heeft, dan meldt
  `verify:docs` per vertaling een `!`-waarschuwing ("loopt achter op EN") — geen fout, dus niet
  bijwerken. Alleen een afwijking tussen `nl` en `en` zelf maakt de poort rood.
- **`public/docs/en` voedt twee consumenten**: de in-app Help **én** de GitHub-wiki. Eén edit daar
  verandert allebei.
- **Wiki-only pagina's** = alles in `docs/wiki/*.md` (Engels; o.a. `Home`, `Features`,
  `Installation`, `Contributing`, `Extensions-Authoring`).
- **Poorten:** `npm run verify:docs` (exitcode is de poort) en — alleen als `public/docs/en` of
  `docs/wiki` geraakt is — `npm run publish:wiki` (dry-run) + de dode-link-check uit de `wiki`-skill.
- **`docs/CHANGELOG.md` is verboden terrein.** Uitsluitend de releaseflow raakt dat bestand aan.
- **Nooit `publish:wiki -- --push`.** Publiceren is een releasestap.

## Fase 1 — inventariseren en rapporteren (nog geen bewerking)

### 1. Schrijf uit wat er gebouwd is
Jij bent de enige met de sessiecontext: benoem het onderdeel in gedrag ("resource-nivellering kan nu
per kalender", niet "resourceSlice.ts gewijzigd").

### 2. Controleer jezelf tegen de diff
```bash
git diff main...HEAD --stat
git log --oneline main..HEAD
```
Wijkt de diff af van je verhaal, dan **wint de diff** — je bent iets vergeten of je herinnert je
iets dat niet gelanded is. Werk al gemergd of over meerdere branches verspreid? Vraag de user om
het gebied te benoemen en gebruik dat als scope.

### 3. Route de gewijzigde gebieden naar doc-oppervlakken
| Aangeraakt | Docs die kunnen liegen |
|---|---|
| UI: dialoog, paneel, ribbon-actie, backstage | `public/docs/{nl,en}/gids-*` + `ref-*` van dat gebied (zoek via `cluster` in het manifest) |
| Sneltoets (`shortcutRegistry.ts`) | `ref-sneltoetsen`, `gids-sneltoetsen-bediening` |
| Scheduling / CPM / kalender | `gids-kritiek-pad-analyse`, `gids-kalenders-uren`, `gids-plannen-wbs` |
| Import/export-adapter (IFC/CSV/MSP/P6) | `gids-import-export`, `ref-externe-koppelingen` |
| Nieuwe instelling | `ref-instellingen` (+ de 3-surfaces-regel uit `CLAUDE.md`) |
| Resources / nivellering / baselines | `gids-resources-histogram`, `ref-nivellering`, `gids-baselines-voortgang`, `ref-baselinebeheer` |
| Rapport / print / PDF | `gids-rapporten-printen` |
| Herstel / auto-save / bestands-I/O | `ref-herstellen`, `gids-import-export` |
| Extensie-API | `docs/extensions.md`, `ref-extensies`, `docs/wiki/Extensions-Authoring.md` |
| Architectuur: slice, service, engine, npm-script, Tauri-plugin, poort | `CLAUDE.md`, `AGENTS.md` |
| Roadmap-item af | `docs/TODO.md` (item eruit — afgerond werk staat in de historie); `PLAN.md` alleen als de roadmap zélf schuift |
| Testsuite / self-test-harness | `tests/planning/README.md`, `docs/self-test-harness.md`, `AGENTS.md` |
| Zichtbaar voor de buitenwereld (feature, installatie, download) | `docs/wiki/Features.md`, `Installation.md`, `README.md` |
| Nieuw voorbeeldproject | `examples/README.md` + `public/examples/manifest.json` |
| **Nooit** | `docs/CHANGELOG.md` |

De tabel is een startpunt, geen uitputtende lijst. Grep altijd óók breed op de termen van het
onderdeel: `grep -rn "<term>" public/docs/{nl,en} docs/ *.md`.

### 4. Toets elke gevonden claim tegen de code
Open het bestand dat de doc beschrijft en lees wat er nu écht gebeurt. Een claim die je niet
gedekt hebt gezien in code die je zelf hebt bekeken, is een rode vlag — fix 'm of meld 'm.

### 5. ⛔ RAPPORT-POORT
Lever één rapport en **stop**:
- per doc-plek: bestand + regel, wat er nu staat, waarom dat niet meer klopt, wat het wordt;
- apart: *"over X staat nog nergens iets — toevoegen?"*, met per kandidaat waar het zou landen
  (nieuw manual-artikel in nl+en + manifest-entry, nieuwe wiki-only sectie, of één regel in een
  bestaande pagina);
- als je niets vond: zeg dát, en waar je gekeken hebt. Geen verzonnen werk.

Wacht op akkoord. Geen bewerkingen vóór dit punt.

## Fase 2 — bewerken en verifiëren

1. Werk de goedgekeurde plekken bij, **nl én en gelijk** voor manual-artikelen. Nieuw artikel =
   `.md` in nl + en **plus** een manifest-entry (`id`, `title.nl`, `title.en`, `layer`, evt.
   `cluster`); de overige talen laat je aan de vertaalronde.
2. Houd je aan de miniMarkdown-subset die `verify:docs` afdwingt: `#`/`##`/`###`, paragrafen,
   één niveau lijsten, `**vet**`/`*cursief*`/`` `code` ``, ```-blokken, en **alleen**
   `docs://`- en `examples://`-links. Geen tabellen, blockquotes, h4+, geen rauwe HTML.
3. Poorten draaien — alles groen, exitcode is de poort:
   ```bash
   npm run verify:docs
   npm run publish:wiki          # alleen bij edits in public/docs/en of docs/wiki; warnings-regel moet leeg zijn
   ```
   Plus de dode-link-check uit de `wiki`-skill wanneer je de dry-run draait.
   **In een worktree ontbreekt `node_modules`** → eerst `ln -sfn ../../../node_modules node_modules`,
   anders faalt de poort met exit 127 en lijkt dat een docs-fout.
4. Committen in de worktree: `docs(<gebied>): <wat er nu klopt>`. **Niet pushen**, geen wiki-push.
5. Sluit af met een korte samenvatting: welke bestanden, wat er inhoudelijk veranderde, poorten groen.

## Delegatie
De grep-sweep (fase 1, stap 3–4) en het schrijfwerk (fase 2, stap 1) zijn uitvoerend werk en gaan
naar een subagent met een dichte brief — mét het "wat is er gebouwd"-verhaal erin, want die context
heeft de subagent niet. **Zelf houden:** het verhaal uit stap 1, de diff-controle, het rapport, de
poorten en de review van wat de subagent schreef. Alleen op verzoek van de user een team; anders
één gerichte subagent per fase.

## Gotchas
| Val | Waarom |
|-----|--------|
| Doc bijwerken op basis van de doc | De doc is precies het ding dat verouderd is. Lees de code. |
| Alleen `nl` of alleen `en` bijwerken | Beide zijn brontalen; `en` voedt óók de wiki. Ze lopen anders uit elkaar. |
| Nieuw artikel schrijven zonder te vragen | Nieuw materiaal is een productbeslissing van de user, geen doc-onderhoud. |
| De 12 vertalingen "even meenemen" | Aparte maandelijkse ronde. `verify:docs` eist ze niet. |
| `docs/CHANGELOG.md` aanraken | Uitsluitend de releaseflow. Ook niet "één regeltje". |
| `-- --push` draaien | Publiceren = release. De dry-run is hier het eindpunt. |
| Tabel of blockquote in een manual-artikel | miniMarkdown rendert het niet; `verify:docs` waarschuwt. |
| Een aantal noemen ("N pagina's", "N artikelen", "N talen") — in docs én in skills | Verandert constant en verrot stil. Verwijs naar de bron (manifest, dry-run, poort-output) of laat het weg. |
| `verify:docs` in een worktree | Faalt met 127 zonder `node_modules`-symlink — dat is geen doc-fout. |

## Rode vlaggen — stop
- De skill uit jezelf starten, of halverwege een feature.
- Een bestand bewerken vóór de rapport-poort.
- Een nieuw artikel/pagina aanmaken zonder expliciet akkoord.
- Een doc-claim overnemen of bijwerken zonder de code te hebben gelezen.
- `verify:docs` of de dry-run rood, en tóch committen.
- `docs/CHANGELOG.md` in je diff.
