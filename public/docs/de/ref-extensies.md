# Erweiterungen verwalten und installieren

Erweiterungen fügen der App Funktionen hinzu, etwa zusätzliche Importformate oder eigene Menüband-Schaltflächen. Sie sind App-Ebene: Sie gehören zu dieser Installation auf diesem Gerät, nicht zu einer Projektdatei.

## Öffnen

**Datei** → **Erweiterungen** (Backstage). Oben sitzen zwei Registerkarten — **Installiert** und **Durchsuchen** — neben den Schaltflächen **Aus ZIP-Datei installieren** und **Aus JS-Datei installieren**, mit einem Suchfeld darunter (**Erweiterungen suchen...**).

## Installiert

Eine Karte pro Erweiterung mit Name, Version, Kategorie, Beschreibung und Autor, plus:

- **Ein-/Aus-Schalter** — aktiviert oder deaktiviert die Erweiterung, ohne sie zu entfernen.
- **Entfernen** — klicken Sie **Bestätigen** erneut, um endgültig zu entfernen.

Eine Erweiterung, die nicht geladen werden konnte, zeigt eine Fehlermeldung auf ihrer Karte. Ohne Erweiterungen meldet die Registerkarte: „Noch keine Erweiterungen installiert."

## Durchsuchen (Katalog)

Die Registerkarte **Durchsuchen** ruft den Online-Erweiterungskatalog ab (Internetverbindung erforderlich). Jeder Katalog-Eintrag ist eine Karte mit **Installieren**; bereits installierte Erweiterungen zeigen das Badge **Installiert**. Schlägt das Laden fehl, erscheint eine Fehlermeldung mit **Erneut versuchen**.

## Aus einer Datei installieren

- **Aus ZIP-Datei installieren** — installiert ein Erweiterungs-ZIP (mit `manifest.json` + `main.js`).
- **Aus JS-Datei installieren** — installiert eine einzelne `.js`-Datei mit eingebettetem Manifest.

Nach der Installation ist die Erweiterung sofort aktiviert und eventuelle Menüband-Schaltflächen erscheinen sofort.

## Importieren über Erweiterungen

**Datei** → **Importieren** listet die Importformate installierter Erweiterungen auf; klicken Sie ein Format und wählen Sie eine Datei. Ohne Import-Erweiterungen meldet die Seite: „Keine Import-Erweiterungen installiert. Fügen Sie eine über Erweiterungen hinzu." Die eingebauten Importformate (CSV, MS Project, P6) sind hiervon getrennt — siehe [Im-/Export](docs://gids-import-export).

## Eigene Erweiterungen schreiben

Die Anleitung für Erweiterungs-Autoren (Manifest, API, Berechtigungen) liegt im Repository: `github.com/OpenAEC-Foundation/open-planner-studio`, Datei `docs/extensions.md`.
