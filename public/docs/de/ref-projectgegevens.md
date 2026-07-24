# Projektinformationen

Das Fenster **Projektinformationen** enthält die Metadaten des Projekts sowie den Abschnitt **Berechnung** mit den Terminplanungsoptionen. Dasselbe Formular dient zudem als Projekt-Assistent für **Neu**.

## Öffnen

- **Einstellungen** (Menüband-Registerkarte) → Menübandgruppe **Projekt** → **Projektinfo**.
- Fenster Einstellungen (Zahnrad ⚙) → Registerkarte **Allgemein** → **Projektinformationen...**
- **Datei** → **Projektinfo** — eine vereinfachte Variante in der Backstage, nur mit den Metadaten-Feldern (ohne Abschnitt Berechnung).

**Anwenden** schreibt alle Änderungen zugleich; **Abbrechen**, **Esc** oder ein Klick außerhalb des Fensters verwirft sie. **Enter** macht dasselbe wie Anwenden.

## Metadaten

- **Projektname** — der Name in der Titelleiste und der Dokument-Registerkarte.
- **Beschreibung** — freier Text.
- **Ingenieur** und **Unternehmen** — freier Text; in der IFC-Datei gespeichert.
- **Startdatum** — der Projektanfang, ab dem die Berechnung zählt.
- **Enddatum** — informatives Ende des Projekts.

## Berechnung

Terminplanungsoptionen für dieses Projekt — sie werden mit der Datei gespeichert, nicht mit der App, reisen also auf andere Rechner. Ändern Sie hier etwas, wird der Terminplan nach **Anwenden** automatisch neu berechnet.

- **Kritisch-Definition** — **Gesamtpuffer ≤ Schwelle** (mit **Schwelle (Arbeitstage)**, Standard 0) oder **Längster Pfad**.
- **Pufferberechnung** — **Kleinster (Start/Ende)** (Standard), **Startpuffer** oder **Endpuffer**.
- **Offene Vorgänge kritisch** — markiert Aufgaben ohne Nachfolger als kritisch.
- **Beinahe-kritisch markieren** — Aktivieren offenbart eine zusätzliche **Schwelle** (Standard 2 Arbeitstage; die Einheit folgt der Daueranzeige, also möglicherweise Stunden): Aufgaben mit wenig Puffer erhalten die Markierung „beinahe kritisch".
- **Mehrere Pufferpfade** — Aktivieren offenbart die **Methode** (**Freier Puffer (Peeling)** oder **Gesamtpuffer (Rangfolge)**) und **Max. Pfade** (Standard 10): Die Berechnung nummeriert dann die wichtigsten Pufferpfade.
- **Abstandskalender** — welcher Kalender die Verzögerung einer Beziehung zählt: **Vorgänger** (Standard), **Nachfolger**, **24-Stunden** oder **Projektkalender**.

Wie Sie diese Ergebnisse lesen, ist in [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse) behandelt.

## Der Projekt-Assistent (Neu)

**Neu** öffnet dasselbe Fenster als Assistent (Titel **Neues Projekt**, Schaltfläche **Erstellen**). Neben den Metadaten-Feldern enthält der Assistent:

- **Phasen-Vorlage** — **Leer**, **Wohnungsbau** oder **Gewerbebau / Sanierung**: füllt das neue Projekt mit einer Phasenstruktur.
- **Schicht** — nur mit aktivierter Stundenplanung sichtbar: **Tagschicht** (Standard), **2 Schichten**, **3 Schichten** oder **24/7**.
- **Feiertagsset** — generiert den Projektkalender: Wählen Sie ein Land (mit Region und Bauferien, wo zutreffend), **Keine Feiertage** oder **Benutzerdefiniert…** — Letzteres öffnet den Kalender-Dialog direkt nach der Erstellung, damit Sie den Kalender von Hand aufbauen. Siehe [Kalender-Dialog](docs://ref-kalenderdialoog).

Der Abschnitt Berechnung fehlt im Assistenten; stellen Sie ihn nachträglich über einen der obigen Eingänge ein.
