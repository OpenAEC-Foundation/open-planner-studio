# Wiederherstellen nach einem Absturz

Die Desktop-App behält automatisch Wiederherstellungs-Momentaufnahmen Ihrer Arbeit. Schließt die App unerwartet (Absturz, Stromausfall), bietet sie an, diese Arbeit beim nächsten Start zurückzuholen.

## Wie das automatische Speichern funktioniert

- Kurz nach jeder Änderung (unter einer Sekunde) schreibt die App eine Momentaufnahme pro offenem Dokument in ihren eigenen Datenordner — für alle offenen Registerkarten, einschließlich nie gespeicherter Dokumente.
- Das ist kein Ersatz für Speichern: Ihre Projektdatei selbst ändert sich nicht. Speichern Sie Ihre Arbeit also weiterhin mit Ctrl+S.
- Die Momentaufnahmen werden aufgeräumt, sobald Sie im Wiederherstellungsfenster eine Wahl treffen (**Wiederherstellen** oder **Nicht wiederherstellen**).
- **Nur Desktop-App.** Die Browserversion hat kein automatisches Speichern und keine Wiederherstellung — speichern Sie dort regelmäßig selbst.

## Das Fenster „Nicht gespeicherte Arbeit wiederherstellen"

Erscheint beim Start, wenn Momentaufnahmen gefunden werden: „Open Planner Studio wurde nicht normal beendet. Die folgenden Dokumente enthielten nicht gespeicherte Änderungen, die wiederhergestellt werden können:" Pro Dokument zeigt es:

- den **Namen** (Dateiname oder Projektname; unbenannt: „Unbenanntes Projekt");
- den **Dateipfad**, falls das Dokument jemals gespeichert wurde;
- die **Aufgabenanzahl** in der Momentaufnahme;
- **Gespeichert** — den Zeitpunkt der letzten Momentaufnahme.

## Die Wahlmöglichkeiten

- **Wiederherstellen** (oder **Enter**) — alle gelisteten Dokumente kehren als offene Registerkarten zurück. Sie gelten dann als nicht gespeichert: Speichern Sie sie selbst.
- **Nicht wiederherstellen** — die Momentaufnahmen werden verworfen; Sie starten mit einem leeren Projekt.
- **Schließen-Kreuz**, **Esc** oder ein Klick außerhalb des Fensters — sicher aufschieben: nichts wird verworfen und nichts wiederhergestellt; die Frage erscheint beim nächsten Start erneut.

## Weiterlesen

- [Schnellstart](docs://quick-start) — Projekte speichern und öffnen.
