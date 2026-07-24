# Kalender-Dialog

Das Fenster **Kalender** verwaltet die Kalenderbibliothek des Projekts: links die Liste aller Kalender, rechts das Bearbeitungsformular des ausgewählten Kalenders.

## Öffnen

- **Planung** → Menübandgruppe **Kalender** → die Schaltfläche **Kalender** oder **Feiertage**.
- **Einstellungen** (Menüband-Registerkarte) → Menübandgruppe **Kalender** → **Kalender**.
- Aus dem Projekt-Assistenten: Die Wahl von **Benutzerdefiniert…** als Kalender öffnet dieses Fenster nach der Erstellung.

## Anwenden und Abbrechen

Alle Bearbeitungen — einschließlich Neu/Duplizieren/Löschen — erfolgen in einer Arbeitskopie. **Anwenden** (oder **Enter**) schreibt alles zugleich und berechnet den Terminplan neu; **Abbrechen**, **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters verwirft alle Änderungen.

## Bibliothek (linke Spalte)

- **Liste** — alle Kalender; der Stern markiert den **Projektkalender** (der Standard für Aufgaben ohne eigenen Kalender).
- **+** — **Neuer Kalender**.
- **Duplizieren** — Kopie des ausgewählten Kalenders.
- **Löschen** — beim letzten Kalender nicht möglich; das Löschen des Projektstandards macht einen anderen Kalender zum Standard.
- **Als Projektstandard festlegen** — macht den ausgewählten Kalender zum Projektkalender (Schaltfläche über dem Formular).

## Formular (rechte Spalte)

- **Name** — freier Name.
- **Arbeitstage** — Schaltflächen **Mo** bis **So**; an = Arbeitstag. Voreinstellungen: **Mo–Fr** (Standardwoche, 07–16 Uhr, 8 h/Tag) und **Durchgehend (24/7)**.
- **Beginn (Stunde)** / **Ende (Stunde)** / **Stunden pro Tag** — die tagesweite Arbeitszeit. Verborgen, sobald der Kalender Arbeitszeitbänder hat und die Stundenplanung an ist; dann steuern die Bänder die Zeiten.

## Arbeitszeiten (nur mit aktivierter Stundenplanung)

- **Abgeleitete Stunden/Tag** — Kontrollzahl, abgeleitet aus den Bändern.
- Voreinstellungen: **Tagschicht**, **2 Schichten**, **3 Schichten**, **Nachtschicht**, **24/7** — jede legt die Arbeitszeitbänder auf einen Schlag fest.
- **Als Voreinstellung speichern…** — speichert die aktuellen Arbeitszeiten als eigene Voreinstellung (auf diesem Gerät); eigene Voreinstellungen erscheinen als Schaltflächen mit einem Lösch-Kreuz.
- **Pro Wochentag festlegen…** / **Arbeitszeiten anzeigen/ausblenden** — öffnet oder klappt den Band-Editor zu.
- **Band-Editor** — pro Wochentag eine Liste von Zeitbändern (Beginn–Ende), jeweils mit einem Kontrollkästchen **nächster Tag** (Nachtschicht über Mitternacht), **Band hinzufügen** (eine Lücke zwischen zwei Bändern ist eine Pause), **Auf alle Arbeitstage kopieren**, der Stunden-Gesamtsumme pro Tag und der abgeleiteten Stunden/Tag ganz unten. Siehe [Kalender & Stundenplanung](docs://gids-kalenders-uren).

## Feiertage generieren…

Generiert die Feiertags-Liste regelbasiert über den Projektzeitraum:

- **Land** — Niederlande, Deutschland, Belgien, Frankreich, Vereinigtes Königreich, Österreich, Schweiz oder **Keine Feiertage**.
- **Region** — nur für Länder mit regionalen Sets; Standard **Landesweit**.
- **Bauferien** — nur Niederlande: **Keine**, **Nord**, **Mitte** oder **Süd**; mit einem Hinweis, dass es Richtwerte sind.
- **Vorschau** — Zusammenfassungszeile („n Feiertage, Jahr–Jahr"), auf die vollständige Liste aufklappbar.
- **Generieren** ersetzt die Feiertags-Liste; **Abbrechen** schließt den Block.
- Läuft das Projekt nun über die generierten Jahre hinaus, erscheint oben ein Hinweis mit einer Schaltfläche **Neu generieren**.

## Feiertage

Die Liste selbst: pro Zeile **Beschreibung**, **Von**, **Bis** und eine Entfernen-Schaltfläche; **Feiertag hinzufügen** erstellt eine neue Zeile. Mehrzeiträume (Bauferien, Frostverzögerung) sind einfach eine Zeile mit einer längeren Von–Bis-Spanne.
