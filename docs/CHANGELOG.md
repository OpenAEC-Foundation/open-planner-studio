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

### Toegevoegd
- **Extensiesysteem** — extensies (manifest + main.js, als ZIP/JS of uit de catalogus) kunnen
  importers en ribbon-knoppen registreren. Beheer via Bestand → Extensies; importeren via
  Bestand → Importeren. Naar het model van Open Calc Studio.
- **Extensie-SDK** — `require('open-planner-studio')` geeft nu een echte host-SDK (versie,
  categorieën/permissies, `hostEvents`, `utils` en `factory`-helpers) i.p.v. een leeg object.
- **Host-events** — de app zendt `host:project-loaded`, `host:project-new` en
  `host:schedule-calculated` op de extensie-event-bus; extensies kunnen erop abonneren via
  `api.events.on`.
- **Voorbeeld-extensie** — `examples/extensions/voorbeeld-takenlijst-importer/` als werkende
  referentie (importer + ribbon-knop + host-event).
- **Settings unificatie** — instellingen gedeeld over tandwiel ⚙, Settings-ribbon-tab en
  File-backstage via één gedeelde settings-component.
- **Gantt** — instelbaar scrollen en zoomen over de Gantt-weergave.
- **UI** — herbruikbare themed `Select`-dropdown met migratie weg van native selects.
- **Dev** — poort en recovery-bestand per worktree geïsoleerd, zodat meerdere
  desktop-builds tegelijk kunnen draaien.
- **Tauri** — Linux desktop-icoon metadata.
- **Devtools** — Tier 2 `ops-test` controlekanaal (echte Tauri save/open + dispatch).

### Gewijzigd
- **Store-architectuur** — de monolithische Zustand-store is opgesplitst in tien slices
  (`src/state/slices/`); `appStore.ts` is nu een compositie-root. Geen gedragswijziging.
- CODEOWNERS bijgewerkt naar de nieuwe product owner.

### Opgelost
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
