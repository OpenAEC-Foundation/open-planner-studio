# Einstellungen

Das Fenster **Einstellungen** enthält die App-Einstellungen: Voreinstellungen, die für dieses Gerät gelten, unabhängig von der Projektdatei. Jede Änderung wird sofort angewendet und gespeichert — es gibt keine OK-Schaltfläche. Terminplanungsoptionen, die den berechneten Terminplan ändern, leben stattdessen mit dem Projekt — siehe [Projektinformationen](docs://ref-projectgegevens).

## Öffnen — drei Eingänge, derselbe Inhalt

- Das **Zahnrad** (⚙) in der Titelleiste.
- **Einstellungen** (Menüband-Registerkarte) → Menübandgruppe **Projekt** → **Einstellungen**.
- **Datei** → **Einstellungen** (Backstage).

Alle drei zeigen exakt dieselben Einstellungen. Je nach Version sind sie über drei oder vier Registerkarten verteilt — eine vierte, **Anwendung**, hat sich kürzlich vom Ende der ersten Registerkarte abgespalten —, aber die Einstellungen selbst und was sie bewirken, sind in beiden Fällen identisch; dieser Artikel gruppiert sie als **Allgemein**, **Sprache** und **Zeitachse / Zoom**.

## Registerkarte Allgemein

**Darstellung:**

- **Design** — **Dunkel**, **Hell** oder **Hoher Kontrast**; auf eine Karte klicken zum Wechseln.
- **Schriftart** — **Standard**, **System**, **Serifen** oder **Monospace**; überschreibt die Schriftart der Oberfläche. Web-Apps übernehmen nicht automatisch die Schriftarteinstellung Ihres Systems, daher sind diese und die nächste Option der Weg, sie selbst zu wählen.
- **Textgröße** — 90 %, 100 %, 110 % oder 125 %; skaliert den Oberflächentext und das Layout.
- **Dokumentwechsel-Stil** — wie Sie zwischen offenen Dokumenten wechseln: **Horizontale Registerkarten**, **Vertikale Registerkarten** oder **Pille**.
- **Datumsformat** — **tt-mm-jjjj**, **mm-tt-jjjj** oder **jjjj-mm-tt**. Nur Anzeige; Dateien und Berechnungen bleiben unberührt.
- **Baumodus** — **Baumodus aktivieren** schaltet die Voreinstellungen für *neue* Projekte zwischen bauorientiert (ein Baukalender mit niederländischen Feiertagen, Bauferien, Phasenvorlagen) und einer neutralen, baustellenneutralen Einrichtung um. Bestehende Projekte bleiben in beiden Fällen unverändert.

**Anwendung:**

- **Version** — die Versionsnummer der App (schreibgeschützt), mit einem Link **Nach Updates suchen**, der das Update-Fenster öffnet. Updates installieren funktioniert nur in der Desktop-App; Snap- und AppImage-Installationen aktualisieren über ihren eigenen Kanal. Separat davon erscheint beim ersten Öffnen der App nach einem automatischen Update von selbst ein einmaliger „Du bist auf dem neuesten Stand"-Dialog: der Versionssprung, der Größenunterschied des Installationspakets, die Tage seit dem vorigen Release und die GitHub-Release-Notizen — je nachdem, was sich davon abrufen ließ. Das ist ein anderer, automatischer Moment als der manuelle Link **Nach Updates suchen** hier.
- **Projektinformationen...** — Verknüpfung zum Fenster [Projektinformationen](docs://ref-projectgegevens).
- **Tour** — **Tour starten** spielt die Einführungstour erneut ab. Derselbe Neustart sitzt auch auf der Menüband-Registerkarte **Ansicht** → **Tour** und in der Backstage (**Datei** → **Tour starten**).
- **Benchmark** — öffnet das eingebaute Benchmark-Werkzeug, um die Terminplanungs-/Rendering-Leistung dieses Rechners zu messen.
- **KI-Modus** — **KI-Modus aktivieren** zeigt die Menüband-Registerkarte **KI** mit der MCP-Bridge, sodass ein KI-Assistent über das Model Context Protocol mit Ihrem Terminplan arbeiten kann; das Ausschalten stoppt eine laufende Bridge sofort. **Bridge automatisch starten** (nur verfügbar, wenn KI-Modus an ist) aktiviert die Bridge direkt beim Start der App, ohne vorher die KI-Registerkarte zu öffnen — nur in der Desktop-App. Siehe die In-App-Anleitung zum KI-Assistenten für das vollständige Bild.
- **Debug-Terminal** — **Debug-Terminal aktivieren** zeigt das Protokoll-Panel zur Fehlersuche.

## Registerkarte Sprache

- **Sprache** — die Anzeigesprache der App, sofort angewendet.

## Registerkarte Zeitachse / Zoom

- **Stundenplanung** — **Stundenplanung aktivieren** schaltet Stunden-/Minuten-Terminplanung ein: eine Stunden-Zeitskala, Schichten mit Arbeitszeitbändern und stundengenaue Vorgangsbalken. Aus beginnen neue Vorgänge in Tagen; vorhandene Stundenvorgänge bleiben exakt erhalten. Bei eingeschaltetem Schalter können Tages- und Stundenvorgänge gemeinsam bestehen. Siehe [Kalender & Stundenplanung](docs://gids-kalenders-uren).
- **Daueranzeige** — **Automatisch (eigene Einheit je Vorgang)**, **Immer Tage** oder **Immer Stunden**.
- **Vorgangsbalken bei Unterbrechungen** — **Nie aufteilen**, **Bei Auswahl aufteilen** oder **Immer aufteilen**: ob ein Balken visuell um freie Tage herum aufteilt.
- **Zeitachse** — **Nur Arbeitstage anzeigen** komprimiert die Zeitachse: Wochenenden und Feiertage aus dem Projektkalender werden übersprungen, sodass eine 5-Arbeitstage-Aufgabe exakt 5 Spalten breit ist, egal wie der Kalender dazwischen aussieht.
- **Woche beginnt am** — **Montag** oder **Sonntag** (Wochenlayout der Zeitskala).
- **Viertelstunden bei starker Vergrößerung anzeigen** — zusätzliche Viertelstunden-Graduierung auf der Stunden-Zeitskala.
- **Berechnung** — **Automatisch berechnen** berechnet den Terminplan neu, sobald er veraltet ist, statt auf F5 zu warten.
- **Scrollen & Zoomen** — **Modus**:
- **Zoom + Ziehen** (die Voreinstellung) — das Scrollrad zoomt (zentriert auf den Cursor); den Diagrammhintergrund ziehen verschiebt die Ansicht; Umschalt+Scrollrad scrollt durch die Zeilen; Strg/⌘+Ziehen zieht ein Auswahl-Rechteck.
- **Position** — die Cursor-Position bestimmt die Scrollrichtung; mit **Bildschirmaufteilung** (**Links/rechts**, **Oben/unten** oder **Oben-rechts-Ecke**). Strg+Scrollen = Zoom, Umschalt+Scrollen = horizontal.
- **Tasten** — weisen Sie per Ziehen der Chips zu, welche Steuerung (**Scrollen**, **Strg + Scrollen**, **Umschalt + Scrollen**) welche Funktion (**Vertikal**, **Horizontal**, **Zoom**) erhält; das Ablegen auf einem belegten Slot tauscht die Steuerungen.
