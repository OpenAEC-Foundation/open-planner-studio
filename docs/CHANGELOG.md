# Changelog

Alle noemenswaardige wijzigingen aan Open Planner Studio worden hier vastgelegd.
Nieuwe wijzigingen komen bovenaan onder **Ongepubliceerd**; houd ze gegroepeerd
per type (`Toegevoegd`, `Gewijzigd`, `Opgelost`, `Documentatie`).

## Ongepubliceerd

### Documentatie
- To-do-lijst (`docs/TODO.md`) toegevoegd en vanuit `CLAUDE.md` verwezen.
- Dit changelog-document toegevoegd en vanuit `CLAUDE.md` verwezen.
- README-screenshots aangevuld en documentatie gelijkgetrokken met de actuele code.
- `CLAUDE.md`: State-sectie gecorrigeerd, multi-worktree dev-setup, i18n/settings/Rust-feiten
  bijgewerkt en verwijzing naar de self-test harness toegevoegd.
- README-architectuur gecorrigeerd: app-shell volgt Open 2D Studio / OpenFEM2D Studio, terwijl
  het extensiesysteem en de styling naar Open Calc Studio gemodelleerd zijn.
- Spec voor de moderne UI-overhaul (Polished Forge + Soft Depth) toegevoegd.
- `read_file`/`write_file` in de Rust-backend gedocumenteerd als bewuste escape-hatch.

### Toegevoegd
- **Multi-document (back-end)** — `documentSlice` houdt meerdere geopende projecten bij; het
  actieve document leeft op top-level (alle bestaande slices/renderer ongewijzigd), inactieve als
  payload-snapshot. Acties `newDocument`/`switchDocument`/`closeDocument` + `getOpenDocuments`.
  View (zoom/scroll), undo-historie, selectie en dirty-status zijn per document; het klembord is
  gedeeld zodat takken tussen documenten te kopiëren zijn.
- **Multi-document (UI)** — drie wisselstijlen, kiesbaar in Instellingen (verschijnt in alle drie
  de settings-oppervlakken) met default *Horizontale tabbladen*: **horizontale tabbladen** onder
  het lint (A), **verticale tabbladen** (projectbalk) links met hover-flyout (B) en een **pil** in
  de titelbalk (C). Alle drie delen één **projectoverzicht-overlay** (kaarten met mini-Gantt +
  taken/kritiek/einde per document). Per project een stabiele identiteitskleur (afgeleid uit de
  project-id) en 2-letter-code. Bestand openen opent voortaan een nieuw tabblad (hergebruikt het
  lege beginscherm); 'Nieuw' opent een nieuw tabblad i.p.v. het actieve te wissen; `⌘/Ctrl 1–9`
  springt naar het n-de open document. Front-end-only, UI-state in de `ui`-slice.
- **Multi-document recovery** — auto-save bewaart nu *alle* open documenten: één manifest
  (`recovery[.<slug>].documents.json`) + per document een IFC-snapshot, met opruimen van
  snapshots van gesloten documenten. Bij het opstarten worden alle documenten hersteld (id's,
  actief document en dirty-status blijven behouden); de oude losse `recovery.ifc` wordt nog
  herkend als terugval. Tauri-only.
- **Sluit-bevestiging (3-weg)** — een document met niet-opgeslagen wijzigingen sluiten toont nu
  een dialoog met *Opslaan* / *Niet opslaan* / *Annuleren* i.p.v. een simpele bevestiging.
  *Opslaan* bewaart het document (maakt het zo nodig eerst actief, evt. via 'Opslaan als…') en
  sluit het daarna; bij een geannuleerd opslaan blijft het document open.
- **Nieuw-project wizard** — `ProjectInfoDialog` is nu dubbel-modus: naast 'projectinfo bewerken'
  ook een wizard die bij *Nieuw* een project opzet met naam/opdrachtgever/startdatum, een
  **kalender-preset** (bouwkalender NL incl. bouwvak / NL-feestdagen zonder bouwvak / 5-daags) en
  een **fasering-template** (Leeg / Woningbouw / Utiliteitsbouw) die de WBS met hoofdfasen vult.
  Alle 'Nieuw'-acties (titelbalk, lint, menubalk, Backstage) en `Ctrl/⌘ N` openen de wizard;
  `createNewProject` maakt het project atomair (geen undo-ruis) in een eigen tabblad (hergebruikt
  een leeg, ongewijzigd tabblad). Hiermee is Fase 1 compleet.
- **Taken kopiëren/plakken** — Ctrl+C / Ctrl+V dupliceren de geselecteerde takken inclusief
  subtaken, interne relaties en resource-toewijzingen. Geplakt als sibling van de selectie (of op
  rootniveau) met verse ids; één undo maakt het ongedaan.
- **Extensiesysteem** — extensies (manifest + main.js, als ZIP/JS of uit de catalogus) kunnen
  importers en ribbon-knoppen registreren. Beheer via Bestand → Extensies; importeren via
  Bestand → Importeren. Naar het model van Open Calc Studio.
- **Extensie-SDK** — `require('open-planner-studio')` geeft nu een echte host-SDK (versie,
  categorieën/permissies, `hostEvents`, `utils` en `factory`-helpers) i.p.v. een leeg object.
- **Host-events** — de app zendt `host:project-loaded`, `host:project-new` en
  `host:schedule-calculated` op de extensie-event-bus; extensies kunnen erop abonneren via
  `api.events.on`.
- **Voorbeeld-extensie** — `examples/extensions/voorbeeld-takenlijst-importer/` als werkende
  referentie (importer + ribbon-knop + host-event); ook gepubliceerd in de catalogus.
- **Extensie-catalogus** — publieke repo `OpenAEC-Foundation/open-planner-studio-extensions`
  met `catalog.json`; Bladeren toont en installeert er extensies uit. ZIP's via `raw` gehost
  (release-assets falen op browser-CORS); `fetchCatalog` met `cache:'no-store'` tegen stale data.
- **Settings unificatie** — instellingen gedeeld over tandwiel ⚙, Settings-ribbon-tab en
  File-backstage via één gedeelde settings-component.
- **Gantt** — instelbaar scrollen en zoomen over de Gantt-weergave.
- **UI** — herbruikbare themed `Select`-dropdown met migratie weg van native selects.
- **Dev** — poort en recovery-bestand per worktree geïsoleerd, zodat meerdere
  desktop-builds tegelijk kunnen draaien.
- **Tauri** — Linux desktop-icoon metadata.
- **Devtools** — Tier 2 `ops-test` controlekanaal (echte Tauri save/open + dispatch).

### Gewijzigd
- **UI moderne overhaul** — koele "Soft-Depth"-look over alle oppervlakken (Fase 1 koele tokens,
  schaduw/radius, AA-control-rand en fonts; Fase 2 doorgevoerd over de hele app).
- **Store-architectuur** — de monolithische Zustand-store is opgesplitst in tien slices
  (`src/state/slices/`); `appStore.ts` is nu een compositie-root. Geen gedragswijziging.
- **Performance** — O(n³)/O(n²) lookups in IFC-nesting en het tekenen van Gantt-pijlen weggewerkt.
- `isTauri()` gecentraliseerd in `src/utils/platform.ts`.
- CI naar Node 24-compatibele GitHub Actions-versies gebracht.
- CODEOWNERS bijgewerkt naar de nieuwe product owner.

### Opgelost
- **Scheduler** — kritiek pad klopt nu; geen spook-float meer op predecessors.
- **Scheduler** — `runCPM` kan niet meer bevriezen of crashen op rare/ongeldige data.
- **UI** — light-mode contrast verbeterd (diepere tint, zichtbare randen/lijnen, helder amber,
  extra contrast op canvas-lijnen).
- **Extensies** — `minAppVersion` wordt nu afgedwongen; een te oude app weigert te activeren.
- **Extensies** — catalogus-foutmelding via i18n-interpolatie (`{{error}}`) i.p.v. string-plakken
  (alle 14 locales); catalogus-installfouten worden in de kaart getoond.
- **Extensies** — ZIP-parser leest maten uit de central directory (lost data-descriptor-overshoot op).
- **Resources** — `removeResource`/`unassignResource` ruimen verweesde ids in `task.resourceIds` op.
- **Bestanden** — XML-import-detectie robuuster (P6 vóór MS Project; onbekend formaat gooit nu).
- **i18n** — thema-namen worden nu vertaald in de theme-picker.
- **Taken** — standaard einddatum volgt nu de duur.
- **Bestanden** — bestandsextensie wordt geborgd bij opslaan (Linux/GTK plakt 'm niet).
- **IFC** — STEP-entiteiten correct getermineerd met `;` (ongeldige IFC-output verholpen),
  inclusief de voorbeeldgenerator.
- **Devtools** — self-test harness draait op chromium-headless i.p.v. webkit.
