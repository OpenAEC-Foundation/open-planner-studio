# Ressourcenkalender

Das Fenster **Ressourcenkalender** bearbeitet den eigenen Kalender einer einzelnen Ressource — zum Beispiel einer Kolonne, die vier Tage pro Woche arbeitet. Das Formular ist identisch zum [Kalender-Dialog](docs://ref-kalenderdialoog); dieser Artikel beschreibt nur die Unterschiede.

## Öffnen

- Öffnen Sie das Ressourcen-Panel: **Ressourcen** → Menübandgruppe **Verwalten** → **Ressourcen** (vollständiges Panel) oder **Ressourcen-Dock** (angedockt neben dem Gantt).
- In der Spalte **Kalender** einer Ressource wählen Sie einen Kalender und klicken auf das Bleistift-Symbol (**Bearbeiten…**) daneben, um ihn zu bearbeiten; einen neuen Kalender erstellen Sie über dasselbe Dropdown.

## Unterschiede zum Kalender-Dialog

- **Ein Kalender zugleich** — keine Bibliotheksliste links, kein Projektstandard-Stern; nur das Formular.
- **Anwenden** speichert den Kalender; **Abbrechen**, **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters verwirft die Änderungen. Ein neuer Kalender über **+ Ressourcenkalender** in der Auswahlliste entsteht erst mit **Anwenden** und wird dann sofort mit der Ressource verknüpft (zusammen ein Schritt für Rückgängig); nach **Abbrechen** bleibt nichts zurück. Er beginnt mit demselben Standard wie **+** im Kalenderdialog.
- **Keine automatische Neuberechnung** — **Anwenden** berechnet den Terminplan nicht neu. In seiner Rolle als Ressourcenkalender ändert ein Kalender die CPM-Termine nicht; er zählt zur Auslastung (Histogramm) und zum Abgleich, die Sie selbst mit F5 beziehungsweise **Abgleichen…** erneut laufen lassen. Die Auswahlliste bietet jedoch alle Kalender des Projekts an: Bearbeiten Sie hier einen Kalender, der auch der Projektkalender oder ein Vorgangskalender ist, ändert sich der Terminplan sehr wohl. Er wird dann als veraltet markiert, und F5 berechnet ihn neu.

## Felder

Siehe den [Kalender-Dialog](docs://ref-kalenderdialoog) für die vollständige Feld-Referenz: **Name**, **Arbeitstage** (mit den Voreinstellungen Mo–Fr und Durchgehend (24/7)), **Beginn (Stunde)** / **Ende (Stunde)** / **Stunden pro Tag**, der Abschnitt **Arbeitszeiten** (mit eingeschalteter Stundenplanung), **Feiertage generieren…** und die Liste **Feiertage**.

## Weiterlesen

- [Kalender & Stundenplanung](docs://gids-kalenders-uren) — wann ein Ressourcenkalender die richtige Wahl ist.
- [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram) — wie der Kalender in Auslastung und Abgleich einfließt.
