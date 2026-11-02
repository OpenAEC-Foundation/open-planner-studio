# macOS-controle, 31 oktober 2026

Bron: branch `fix/macos-native-window-menus`, gebaseerd op Open Planner Studio 2026.44.0.
macOS 27.0.1, Apple Silicon, AeroSpace 0.21.3-Beta. Getest tegen deze werkmap, niet tegen de
geïnstalleerde release. De QA-bundel heeft een eigen identifier (`org.openaec.planner.devqa`).

## Native app

- `npm run tauri -- build --debug --bundles app --config '{"identifier":"org.openaec.planner.devqa","productName":"Open Planner Studio QA","bundle":{"createUpdaterArtifacts":false}}'`: exit 0; productiebundel van de frontend met debug-Rust, zonder updater-ondertekening.
- AeroSpace: zonder gewijzigde regels meteen `h_tiles`. Accessibility bevat de native sluit-, minimaliseer-
  en volledig-schermknoppen, type `window`, `isDialogHeuristic: false`, `TilingContainer`.
  Gefilterde uitvoer staat in `aerospace-window.txt`.
- Native Bestand-menu bevat Nieuw project, Openen, Opslaan, Opslaan als, Afdrukken en Venster sluiten.
- Cmd+N opent één projectdialoog. De bestaande welkomstdialoog blokkeerde de eerste Nieuw-actie terecht.
- In de projectnaam van de dialoog herstelt Cmd+Z de oorspronkelijke tekst.
- In een wegwerpproject: taak toevoegen, focus buiten tekst, Cmd+Z verwijdert de taak,
  Shift+Cmd+Z herstelt hem. De takenstand gaat van 1 naar 0 naar 1.
- Duur 5 naar 7 typen, zonder het veld te verlaten Cmd+S: native opslaandialoog verschijnt.
  Na Annuleren toont zowel het grid als het duurveld 7; de hangende invoer is verwerkt.
- Cmd+Q opent de bestaande opslagvraag. Annuleren behoudt het project. Bij de laatste controle
  sluit Niet opslaan alleen het wegwerpproject en de QA-app. De geïnstalleerde app is ongemoeid gelaten.

## Gerichte poorten

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `/opt/homebrew/bin/bash tests/planning/run.sh check-native-menu.ts`: exit 0.
- `npm run test:browser -- tests/browser/title-bar-quick-access.spec.ts`: 1 geslaagd.
- `npm run verify:docs`: exit 0, 81 artikelen in nl/en.
- `npm run verify:i18n`: exit 0; nl/en compleet voor de nieuwe teksten, andere talen vallen terug op Engels.
- `npm run publish:wiki`: dry-run, exit 0, niets gepubliceerd.

De volledige verify-poort en Windows/Linux-builds lopen via de PR-CI. Browser-testen bewijzen geen
native macOS-menu; de bovenstaande controles zijn in de echte Tauri/WebKit-app uitgevoerd via
Accessibility en echte menu-/toetsbediening. Er is geen release gemaakt of geïnstalleerd.
