# Abgleich-Optionen

Das Fenster **Ressourcen abgleichen** löst Überlastung durch Verschieben von Aufgaben. Es arbeitet in zwei Schritten: **Berechnen** erstellt einen Vorschlag (es ändert noch nichts), **Anwenden** führt ihn aus.

## Öffnen

**Ressourcen** → Menübandgruppe **Ressourcenabgleich** → **Abgleichen…**. **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters schließt, ohne anzuwenden.

## Optionen

- **Nur innerhalb des Puffers abgleichen (Glättung) — Projektende bleibt unverändert** — wenn aktiviert, verschiebt der Abgleich Aufgaben nur innerhalb ihres Gesamtpuffers: das Enddatum kann sich nicht bewegen, aber dann lässt sich nicht jeder Konflikt lösen. Nicht aktiviert (Standard) darf sich das Projektende ausdehnen, um alle Konflikte zu lösen.
- **Ressourcen** — ein Kontrollkästchen pro Ressource: welche Ressourcen teilnehmen. Material-Ressourcen fehlen hier (Material wird nicht abgeglichen). Standardmäßig sind alle Ressourcen an.

## Berechnen

Setzt eine aktuelle Berechnung voraus; sonst zeigt das Fenster „Berechnen Sie zuerst den Terminplan (F5), bevor Sie den Abgleich durchführen." Die Schaltfläche ist zudem deaktiviert, solange keine Ressource markiert ist. Jede Optionsänderung entwertet einen früheren Vorschlag — berechnen Sie erneut.

## Vorschlag (Vorschau)

- **Projektende-Zeile** — „unverändert (Datum)" oder „altes Datum → neues Datum" (rot), wenn sich das Projekt ausdehnt.
- **Tabelle** — pro verschobener Aufgabe: **Aufgabe**, **Alter Start**, **Neuer Start** und **Verschobene Tage**. Nicht ressourcenbelegte Nachfolger, die über die Logik mitwandern, sind enthalten.
- Wenn es nichts zu tun gibt, meldet das Fenster „Keine Aufgaben müssen verschoben werden — der Terminplan ist bereits konfliktfrei."

## Verbleibende Konflikte

Aufgaben, die nicht in die Regeln passen, mit pro Aufgabe der Anzahl Konflikt-Tage und einem Grund:

- „… erreicht einen Spitzenwert von … Einh./Tag, Kapazität ist … — durch Verschieben nicht lösbar." — eine Zuweisung fordert an ihrer Spitze mehr als die Ressourcenkapazität; senken Sie die Einh./Tag oder erhöhen Sie die Max. Einheiten.
- „Die Ressource arbeitet nicht an allen Tagen, die diese Aufgabe benötigt — Verschieben löst dies nicht." — Kalender-Abweichung zwischen Aufgabe und Ressource.
- „Nicht genug freie Kapazität innerhalb des Puffers, um diesen Konflikt zu lösen." — meist bei Glättung: kein freies Fenster innerhalb des verfügbaren Puffers.

## Anwenden und Rückgängig

**Anwenden** führt den Vorschlag aus und schließt das Fenster; **Abbrechen** schließt, ohne etwas zu ändern. Machen Sie einen angewandten Abgleich rückgängig mit **Aufheben** (dieselbe Menübandgruppe) oder Ctrl+Z.

## Weiterlesen

- [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram) — Überlastung im Histogramm erkennen und der vollständige Abgleich-Workflow.
