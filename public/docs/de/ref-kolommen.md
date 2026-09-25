# Spalten wählen

Das Fenster **Spalten** steuert, welche Spalten die Registerkarte Tabelle zeigt, in welcher Reihenfolge und wie breit. (Die Aufgabentabelle links des Gantt hat feste Spalten: WBS, Aufgabenname und Dauer.)

## Öffnen

**Ansicht** → Menübandgruppe **Anzeige** → **Spalten…**. Jede Änderung wird sofort angewendet — es gibt keinen separaten OK-Schritt; **Schließen**, **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters schließt es.

## Gewählte Spalten

Eine Zeile pro Spalte, mit:

- **Ziehgriff** — ziehen Sie die Zeile, um die Spaltenreihenfolge zu ändern.
- **Sichtbar** — Abwählen blendet die Spalte aus, ohne sie aus der Liste zu entfernen.
- **Name** — die Feldbezeichnung, wie die Tabelle sie zeigt.
- **Breite** — in Pixel (Minimum 40).

## Verfügbare Felder

Unter den gewählten Spalten sitzt die Liste **Verfügbare Felder**: jedes Feld, das noch keine Spalte ist. Ein Klick darauf fügt es als Spalte hinzu. Neben den Standardfeldern finden Sie die Analyse-Felder **Meilenstein**, **Freier Puffer**, **Interferierender Puffer**, **Beinahe kritisch** und **Pufferpfad**, plus **Ressourcen** und die Aufgabencodes und benutzerdefinierten Felder des Projekts. Die drei Pufferfelder und der Pufferpfad erhalten erst nach einer Berechnung mit den passenden Terminplanungsoptionen Werte — siehe [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse).

## Auf Standard zurücksetzen

**Auf Standard zurücksetzen** steht unten in der Spaltenauswahl (das Plus rechts im Tabellenkopf oder die Registerkarte **Tabelle** → **Spalten…**). Ein Klick setzt die Spalten dieser Tabelle auf die Standardanordnung zurück: welche Spalten angezeigt werden, ihre Reihenfolge und Breite sowie angeheftete Spalten. Zusätzlich hinzugefügte Felder verschwinden aus der Tabelle und bleiben in der Liste wählbar. So erhalten Sie nach einem Update auch den neuen Standard, zum Beispiel **Anfang** und **Ende** statt **Geplanter Anfang** und **Geplantes Ende**: eine früher gespeicherte eigene Anordnung ändert sich nicht von selbst. Es ist ein einziger Schritt, daher stellt **Ctrl+Z** Ihre eigene Anordnung wieder her. Verwendet die Tabelle bereits den Standard, ist die Schaltfläche deaktiviert.

Der Spaltensatz ist Teil eines gespeicherten Layouts — siehe [Layouts speichern und laden](docs://ref-layouts).

## Weiterlesen

- [Filter](docs://ref-filters) — welche Aufgaben die Tabelle und das Gantt zeigen.
