# Baseline-Verwaltung

Das Fenster **Baselines** verwaltet die gespeicherten Momentaufnahmen des Terminplans: speichern, umbenennen, die aktive Baseline wählen und löschen.

## Öffnen

**Planung** → Menübandgruppe **Baselines & Fortschritt** → **Baseline speichern…** oder **Baselines verwalten…** (beide öffnen dasselbe Fenster). **Esc**, **Schließen**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters schließt; alle Änderungen in diesem Fenster wirken sofort.

## Die Baseline-Tabelle

Eine Zeile pro gespeicherter Baseline:

- **Aktiv** — Optionsfeld; es kann genau eine Baseline aktiv sein. Die aktive Baseline ist die Vergleichsgrundlage für das Baseline-Overlay im Gantt und den Variance-Bericht.
- **Name** — direkt in der Zeile editierbar.
- **Erstellt** — das Datum, an dem die Baseline gespeichert wurde.
- **Löschen** (Papierkorb) — entfernt die Baseline. Ist es die aktive, fragt das Fenster zuerst nach Bestätigung („Aktive Baseline löschen?"); danach wird die zuletzt gespeicherte verbleibende Baseline aktiv, oder keine, wenn nichts übrig ist.

Ohne Baselines zeigt das Fenster „Noch keine Baselines".

## Neue Baseline speichern

- **Namensfeld** — vorausgefüllt mit „Baseline {n} — {date}"; passen Sie den Namen nach Wunsch an.
- **Speichern** — erfasst den Anfang, das Ende und (bei Meilensteinen) das Datum jeder Aufgabe und macht die neue Baseline aktiv.
- **Warnung** — ist der Terminplan seit der letzten Berechnung veraltet, erscheint „Terminplan ist veraltet — zuerst neu berechnen (F5)": ein Hinweis, keine Sperre. Eine Baseline auf einem veralteten Terminplan würde die falschen Termine einfrieren.

## Weiterlesen

- [Baselines & Fortschritt](docs://gids-baselines-voortgang) — Baseline-Overlay, Variance-Bericht, Fortschritt und Statusdatum.
