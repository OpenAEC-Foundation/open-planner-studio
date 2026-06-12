# Changelog

Alle noemenswaardige wijzigingen aan Open Planner Studio worden hier vastgelegd.
Nieuwe wijzigingen komen bovenaan onder **Ongepubliceerd**; houd ze gegroepeerd
per type (`Toegevoegd`, `Gewijzigd`, `Opgelost`, `Documentatie`).

## 2026-06-12

- **Store-architectuur**: de monolithische Zustand-store is opgesplitst in tien slices (`src/state/slices/`); `appStore.ts` is nu een compositie-root. Geen gedragswijziging.
- **Extensiesysteem**: extensies (manifest + main.js, als ZIP/JS of uit de catalogus) kunnen importers en ribbon-knoppen registreren. Beheer via Bestand → Extensies; importeren via Bestand → Importeren. Naar het model van Open Calc Studio.

## Ongepubliceerd

### Documentatie
- To-do-lijst (`docs/TODO.md`) toegevoegd en vanuit `CLAUDE.md` verwezen.
- Dit changelog-document toegevoegd en vanuit `CLAUDE.md` verwezen.
- README-screenshots aangevuld en documentatie gelijkgetrokken met de actuele code.
- `CLAUDE.md`: State-sectie gecorrigeerd, multi-worktree dev-setup, i18n/settings/Rust-feiten
  bijgewerkt en verwijzing naar de self-test harness toegevoegd.

### Toegevoegd
- **Settings unificatie** — instellingen gedeeld over tandwiel ⚙, Settings-ribbon-tab en
  File-backstage via één gedeelde settings-component.
- **Gantt** — instelbaar scrollen en zoomen over de Gantt-weergave.
- **UI** — herbruikbare themed `Select`-dropdown met migratie weg van native selects.
- **Dev** — poort en recovery-bestand per worktree geïsoleerd, zodat meerdere
  desktop-builds tegelijk kunnen draaien.
- **Tauri** — Linux desktop-icoon metadata.
- **Devtools** — Tier 2 `ops-test` controlekanaal (echte Tauri save/open + dispatch).

### Gewijzigd
- CODEOWNERS bijgewerkt naar de nieuwe product owner.

### Opgelost
- **i18n** — thema-namen worden nu vertaald in de theme-picker.
- **Taken** — standaard einddatum volgt nu de duur.
- **Bestanden** — bestandsextensie wordt geborgd bij opslaan (Linux/GTK plakt 'm niet).
- **IFC** — STEP-entiteiten correct getermineerd met `;` (ongeldige IFC-output verholpen),
  inclusief de voorbeeldgenerator.
- **Devtools** — self-test harness draait op chromium-headless i.p.v. webkit.
