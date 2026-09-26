---
paths:
  - "docs/**"
  - "PLAN.md"
  - "artifacts/**"
  - "scripts/README.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

## Docs

- [PLAN.md](PLAN.md) — large project plan, source of truth for the **roadmap**. ⚠️ Alleen voor de roadmap: §4 "Mappenstructuur" is vervallen (de ontwerpfase-boom is verwijderd, er staat alleen een verwijzing). Voor de werkelijke structuur: dit bestand en `AGENTS.md`.
- [docs/TODO.md](docs/TODO.md) — lopende to-do-lijst met dingen die nog gedaan moeten worden.
- [docs/ifc-round-trip.md](docs/ifc-round-trip.md) — **hoe je een veld toevoegt dat een opslaan/laden overleeft.** IFC is het native formaat, dus domeindata die niet round-trippt is bij het volgende openen weg; dit is de route langs writer, reader, fixture en canon-tabel, plus waar de compiler je tegenhoudt.
- [docs/recepten/](docs/recepten/) — dezelfde receptvorm als `docs/ifc-round-trip.md` voor andere terugkerende klussen: een nieuwe `planner_*`-MCP-tool, een nieuwe instelling, een nieuwe vertaalsleutel, een nieuw ribbontabblad, een tekstgrootte kiezen/toevoegen, een nieuwe in-app gids en een nieuwe rekenconventie.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — per **uitgebrachte** versie de uitgebreide beschrijving (Engels). Wordt alleen tijdens een release bijgewerkt (zie de `release`-skill) — geen `Ongepubliceerd`-kop, geen commit-dump.
- [docs/self-test-harness.md](docs/self-test-harness.md) — how Claude drives the app to self-test changes. Tier 1 (default): Playwright MCP (`.mcp.json`) + the dev-only `window.__OPS__` hook (installed by `src/utils/devBridge.ts`: store, log-bus, `extensions.*`) against the **browser** dev build (`npm run dev` — de poort wordt per worktree toegewezen en gestempeld in `.claude/launch.json`, dus lees hem uit de dev-server-uitvoer in plaats van 3007 aan te nemen) — assert via store state, not canvas pixels. Tier 2 (opt-in): `tauri-driver` for the real desktop window.
- [docs/superpowers/](docs/superpowers/) — ontwerp- en implementatiedocs (specs, plannen en een handvol losse stukken). **Begin bij [docs/superpowers/README.md](docs/superpowers/README.md)**; die zegt per document wat de status is en waarom er niet blind gearchiveerd wordt (er wijzen ~50 commentaarregels in `src/`/`tests/` naar deze bestanden). Hier stond een handmatige opsomming van "actieve" onderwerpen die niet meer klopte — op enkele nog-niet-uitgevoerde of niet-gemergede stukken na gaan alle specs/plannen over opgeleverde functionaliteit (ook het onderhoudbaarheidsprogramma is uitgevoerd), en de afvinkvakjes in de plannen zijn nooit bijgehouden. Lees ze als *waarom het zo is*, niet als *wat er is*.
- [docs/onderhoudbaarheid/](docs/onderhoudbaarheid/) — het onderhoudbaarheidsonderzoek: deelrapporten, critreviews en een visueel overzicht. Bron van de "K-items" die in commitberichten opduiken (K2 STEP-strings, K4/K5 recovery, K6a Rust-oppervlak, K7 export-guard, K8 meldingen/`isDirty`, K9–K11 CI-poorten).
- [docs/planning-test-bevindingen.md](docs/planning-test-bevindingen.md) — bevindingen van het CPM-correctheidsonderzoek dat de `tests/planning/`-suite opleverde.
- [docs/archive/superpowers/](docs/archive/superpowers/) — historical design docs and implementation plans for shipped features (zoom, debug terminal, stylebook). Archived; useful for context on *why* something was built, not *what* exists now — verify against current code.
- [docs/archive/handoffs/](docs/archive/handoffs/) — verbruikte sessie-draaiboeken. Puur historisch; een draaiboek dat zelf zegt dat het afgewerkt is, hoort niet meer tussen de levende docs.
- [docs/extensions.md](docs/extensions.md) — handleiding voor extensie-auteurs (manifest, API, installeren).
- [docs/library.md](docs/library.md) — resourcebibliotheken (B1/B1.1): bibliotheek als bron met projectinzet, herkomststempels, pool-IFC-export/-import, bekende beperkingen (geen sync tussen machines).
- [docs/release-secrets.md](docs/release-secrets.md) — de sleutels achter de uitleverketen: wat elk secret doet, wat er stukgaat bij verlies, en het migratiepad voor de minisign-sleutel (de enige onherstelbare SPOF: zijn pubkey zit in elke uitgeleverde binary).
- `artifacts/<onderwerp>/` — **gecommit schermbewijs** bij een PR (bijv. `artifacts/resourcediagram/`), waar een PR-tekst of issue-reactie naar linkt via `raw.githubusercontent.com`. Klein houden: PNG, ≤ ~150 KB per bestand, een handvol per PR, en na de merge niet bijwerken (het is bewijs van dat moment, geen documentatie). Die regel geldt vanaf 2026-09 voor nieuwe mappen; `artifacts/tabel-overhaul/` (25 JPG's, 2,3 MB) dateert van daarvóór en blijft bewust zoals hij is. Lokale QA-screenshots horen in `qa/` (in `.gitignore`).
- [scripts/README.md](scripts/README.md) — wat elk script in `scripts/` doet en wie het aanroept (dev-serverpoorten, de verify-poorten, de generatoren, release-hulpjes). Regel: wat daar staat wordt aangeroepen — eenmalige klussen horen weg, niet "voor het geval dat".
- [tests/planning/README.md](tests/planning/README.md) — hoe de CPM/kalender-regressiesuite werkt en hoe je cases toevoegt.
- `public/docs/<taal>/*.md` — de **in-app gidsen** achter Backstage → Help (viewer met taalkiezer, stale-waarschuwing en 14-taal-fallback). Brontalen zijn `nl` + `en`; die twee eist `npm run verify:docs` hard, de overige twaalf worden alleen gevalideerd wanneer ze bestaan (vertalingen volgen maandelijks, niet per release).
- `docs/wiki/` + `scripts/publish-wiki.mjs` — de GitHub-wiki is een **build-artefact** uit `public/docs/en`, `docs/wiki/*` en de changelog. Nooit de wiki direct bewerken; genereer met `npm run publish:wiki` (zie de `wiki`-skill).
