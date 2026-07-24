---
name: wiki
description: Use when updating, regenerating, or publishing the Open Planner Studio GitHub wiki — including when dispatched as the docs/wiki subagent during a release. Explains how the wiki is built (single-source generator) and how to adapt it. NEVER edit the wiki directly. Treat `--push` as publishing: inside a release it is covered by the release approval gate; for a standalone wiki update, ask first.
---

# Wiki — Open Planner Studio

## Overzicht
De wiki (`github.com/OpenAEC-Foundation/open-planner-studio/wiki`) is een **build-artefact**: hij wordt
volledig **gegenereerd uit repo-bronnen** door `scripts/publish-wiki.mjs` en bij release gepusht. Deze
skill legt uit **hoe de wiki in elkaar zit** en **hoe je hem aanpast**.

**Kernprincipe:** één bron, nooit de wiki zelf bewerken (die wordt overschreven), en **`--push` =
publiceren van publieke content**. Alles daarvóór (bron bijwerken, dry-run, verifiëren) is omkeerbaar —
bereid het compleet voor. De drempel voor de push hangt van de context af: **binnen een release** is de
push gewoon een release-stap, al gedekt door de release-akkoord-poort; **bij een lósse wiki-update**
vraag je eerst expliciet akkoord (zie §Verifiëren & publiceren).

Deze skill is de **brief voor de docs/wiki-subagent** die de release-runbook (`release`-skill, stap 5)
dispatcht, én voor elke losse wiki-update. Het **hoofdmandaat**: **alle documentatie dubbelchecken
tegen de commits van de nieuwe release en aanpassen waar de werkelijkheid afwijkt** (zie §Release-mandaat).

## Vaste feiten
- **Generator:** `scripts/publish-wiki.mjs`.
  - `npm run publish:wiki` → **dry-run**, bouwt alles in `.wiki-build/` en toont een samenvatting. Pusht niet.
  - `npm run publish:wiki -- --push` → clonet `.wiki.git`, schrijft de pagina's, commit + push.
  - `.wiki-build/` en `.wiki-repo/` zijn **gitignored** (build-scratch).
- **Wiki-repo** = apart: `https://github.com/OpenAEC-Foundation/open-planner-studio.wiki.git`. Staat
  **los van de code-repo** — geen PR, geen CI, geen gedeelde git-historie.
- **Engels als enige brontaal** (internationaal bereik). GitHub-wiki heeft geen native i18n.
- **Bronnen (single source of truth):**
  - `public/docs/en/*.md` + `public/docs/manifest.json` → de **25 manual-pagina's**. Let op: deze
    bestanden voeden **óók de in-app F1/Help** — een edit hier verandert de app én de wiki.
  - `docs/wiki/*.md` → **wiki-only pagina's**: `Home`, `Features`, `Installation`, `Contributing`,
    `Extensions-Authoring`.
  - `docs/CHANGELOG.md` → de **Changelog**-pagina, as-is (**Engelstalig** sinds 2026-07-24).
  - repo-screenshots (`screenshot*.png`) → beeld voor de Home-pagina.
- **Pagina-naam (slug)** uit `title.en`: `&`→`and`, `/`→spatie, parenthese `(...)` weg, rest niet-alfanum→`-`.
  Het script berekent de slug centraal en gebruikt hem als bestandsnaam **én** in alle links (geen mismatch).
- **Link-omzetting:** `docs://<id>` → de wiki-slug (via het manifest); `examples://…` → **platte tekst**
  (link eruit, tekst blijft). Onbekende `docs://`-id → **waarschuwing** in de dry-run (geen stille fout).
- **Gegenereerde meta:** `_Sidebar.md` (wiki-only bovenaan → manifest-lagen *Getting started / Guides /
  Reference* → *Project*) en `_Footer.md` (banner "generated — don't edit here" + LGPL-3.0).
- **Bootstrap** (eenmalig, al gedaan 2026-07-24): wiki aan (Settings → Features) + één pagina via de
  web-UI zodat `.wiki.git` bestaat. Faalt de clone in `--push`, dan is de wiki niet geïnitialiseerd.

## Hoe de wiki in elkaar zit
```
public/docs/en/*  + manifest.json ─┐
docs/wiki/*.md                     ├─►  publish-wiki.mjs  ─►  31 pagina's + _Sidebar + _Footer + screenshots
docs/CHANGELOG.md                  │        (dry-run)              │
screenshot*.png                    ─┘                              ▼  .wiki-build/  ──(--push)──►  .wiki.git (live)
```
De in-app Help leest dezelfde `public/docs/` — de wiki is een **tweede consument**, dus geen dubbel
onderhoud. 31 pagina's = 25 manual (via manifest) + 5 wiki-only + Changelog.

## Hoe je de wiki aanpast
- **Inhoud van een manual-pagina** → bewerk `public/docs/{nl,en}/<id>.md`. Houd **nl + en gelijk**
  (andere talen zijn een apart traject, geen wiki/release-stap).
- **Nieuwe manual-pagina** → voeg de `.md` in nl **én** en toe **plus** een manifest-entry
  (`id`, `title.nl`/`title.en`, `layer`, evt. `cluster`). De sidebar-groep volgt uit `layer`.
- **Wiki-only pagina** → bewerk/voeg `docs/wiki/<Naam>.md` (Engels). Bestandsnaam = wiki-paginanaam;
  link naar manual-pagina's via hun slug.
- **Changelog** → `docs/CHANGELOG.md`.
- **NOOIT** `.wiki-build/`, `.wiki-repo/` of de wiki-web-UI bewerken — die worden bij het genereren
  overschreven.
- Na élke bronwijziging: **regenereren + verifiëren** (zie §Verifiëren & publiceren).

## Release-mandaat: dubbelcheck ALLE docs tegen de nieuwe commits
Dit is de kern. Bij een release (of elke doc-update die aan uitgebrachte wijzigingen hangt): verifieer
**elke inhoudelijke doc-claim tegen wat er écht shipte — tegen de code/commits**, niet tegen aannames
en niet tegen wat de doc nu toevallig zegt.

1. Haal de commit-historie sinds de vorige release (zelfde bron als de changelog):
   ```bash
   PREV=$(git tag --sort=-creatordate | grep '^v' | head -1)
   git log --oneline "$PREV"..HEAD
   ```
2. Voor elke feature/wijziging/fix: zoek de docs die dat gebied beschrijven (`grep -rn` over
   `public/docs` + `docs/wiki`) en toets de claim tegen de daadwerkelijke commit/code. Loopt de doc
   achter op de werkelijkheid → aanpassen (manual-pagina's nl+en).
3. **Verifieer tegen de code, niet tegen de doc.** Praktijkvoorbeeld (2026-07-24): de rapport-gids
   beweerde dat de vector-PDF "terugvalt op raster voor CJK, Arabisch en Perzisch". De commits vertelden
   de waarheid: **RTL (Arabisch/Perzisch) werd vector** in RTL-2 (`8eb6487`); **CJK is opt-in vector**
   via een `pdf-fonts`-extensie en rastert alleen zónder (CJK-1 `14b2be6`). De doc was dubbel fout. Een
   tweede: de wiki noemde een "Snap Store"-download die niet bestaat. → **neem geen dictaat van de
   bestaande doc of van een gok — lees de commits.**
4. Toets ook de wiki-only pagina's (`Features`, `Installation`, `Contributing`, `Extensions-Authoring`)
   tegen de werkelijkheid: featurelijst, download-opties, extensie-API.

**Regel:** een doc-claim die niet gedekt wordt door een commit/code die je zelf hebt bekeken, is een
rode vlag — fix 'm of meld 'm expliciet.

## Verifiëren & publiceren
1. `npm run verify:docs` → manifest ↔ bestanden ↔ geen wezen; moet **groen** (25 × 2 talen).
2. `npm run publish:wiki` → dry-run in `.wiki-build/`; check dat de **warnings-regel leeg** is (alle
   `docs://` opgelost) en bekijk de gewijzigde pagina's.
3. **Dode-link-check** (alle interne wiki-links resolven naar een bestaande pagina):
   ```bash
   cd .wiki-build && node -e 'const fs=require("fs");const p=new Set(fs.readdirSync(".").filter(f=>f.endsWith(".md")).map(f=>f.replace(/\.md$/,"")));let d=0;for(const f of fs.readdirSync(".").filter(f=>f.endsWith(".md"))){for(const m of fs.readFileSync(f,"utf8").matchAll(/\]\(([^)]+)\)/g)){let t=m[1].trim();if(/^(https?:|mailto:|#|<)/.test(t)||/\.(png|jpe?g|gif|svg)$/i.test(t))continue;t=t.split("#")[0];if(t&&!p.has(t)){d++;console.log("DEAD",f,"->",t)}}}console.log("dead:",d)'
   ```
4. **Publiceren:** `npm run publish:wiki -- --push` = publiceren van publieke content.
   - **Binnen een release:** gewoon een release-stap — de release-akkoord-poort dekt het publiceren al,
     **géén aparte vraag**. Draai de push als onderdeel van uitgeven (Fase B).
   - **Losse wiki-update** (buiten een release): vraag eerst expliciet akkoord vóór de push.
5. **Live-verificatie:** fetch een paar wiki-URL's (Home + een gewijzigde pagina) en bevestig dat de
   wijziging live staat.

## Gotchas
| Val | Waarom |
|-----|--------|
| Direct in de wiki bewerken | Wordt bij de volgende publish overschreven — bewerk de repo-bron. |
| Manual-bestandsnamen zijn NL-slugs | `gids-plannen-wbs.md` → wiki-pagina `Planning-and-WBS` via `title.en`; niet verwarren. |
| `public/docs` = óók in-app Help | Een edit daar verandert de app-Help én de wiki — nl+en gelijk houden. |
| `examples://`-links | Worden platte tekst op de wiki (de in-app actie werkt niet op een webpagina). |
| Changelog is Engels | Sinds 2026-07-24; de wiki neemt `docs/CHANGELOG.md` as-is over (geen NL-kopje-truc meer). |
| Onbekende `docs://`-id | Geeft een warning in de dry-run — los op vóór de push. |
| Push = auth op de wiki | Draait onder het maintainer-account; publieke content. |

## Rode vlaggen — stop
- De wiki direct bewerken (web-UI of `.wiki-repo/`) i.p.v. de bron.
- Een **losse** `-- --push` (buiten een release) draaien zonder expliciet user-akkoord. Binnen een release dekt de release-akkoord-poort het al.
- Een doc-claim overnemen zonder 'm tegen de commit/code van de release te checken.
- `verify:docs` of de dode-link-check rood en tóch pushen.
- De dry-run-warnings negeren.
