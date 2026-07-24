# Aufgabendialog

Das Fenster **Aufgabe bearbeiten** zeigt alle Eigenschaften einer Aufgabe — dieselben Felder und Abschnitte wie der Eigenschaftenbereich rechts, aber in einem Fenster mit einem expliziten Speicherschritt.

## Öffnen

- **Doppelklick** auf eine Aufgabe im Gantt.
- **F2** bei ausgewählter Aufgabe.
- **Rechtsklick** auf eine Aufgabe → **Bearbeiten...**

## Speichern und Abbrechen

- **Speichern** wendet alle Feldänderungen zugleich an; die Schaltfläche ist deaktiviert, solange der Name leer ist. **Enter** macht dasselbe wie Speichern (außer innerhalb eines mehrzeiligen Textfelds).
- **Abbrechen**, **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters schließt, ohne die Feldänderungen anzuwenden.
- Ausnahme: Die Abschnitte **Abhängigkeiten**, **Zuweisungen** und **Codes & Felder** arbeiten direkt auf dem Terminplan (identisch zum Bereich) — Änderungen dort wirken sofort, auch wenn Sie danach abbrechen.

## Felder

- **Name *** — erforderlich; erhält automatisch den Fokus, wenn der Dialog öffnet.
- **WBS-Code** — freie Eingabe. Mit eingeschalteter automatischer WBS-Nummerierung (Planung → Struktur) ist das Feld gesperrt: Die App verwaltet die Codes.
- **Beschreibung** — freier Text.
- **Typ** — der Aufgabentyp (zum Beispiel Bau); steuert die Farbcodegebung der Balken.
- **Kalender** — **Projektkalender** oder ein bestimmter Kalender aus der Bibliothek; bestimmt die Arbeitstage dieser Aufgabe.
- **Übergeordnete Aufgabe** — verschiebt die Aufgabe unter eine andere übergeordnete Aufgabe oder **- Keine (Wurzel) -**. Dieses Feld existiert nur im Dialog; im Bereich erfolgt die Umstrukturierung durch Ziehen oder Einrücken/Ausrücken.

## Notizen

Eine Checkliste pro Aufgabe: Jede Zeile hat ein **Erledigt**-Kontrollkästchen, ein Textfeld und eine Entfernen-Schaltfläche; **Notiz hinzufügen** erstellt eine neue Zeile. Abgeschlossene Zeilen werden durchgestrichen. Siehe [Planung & WBS](docs://gids-plannen-wbs).

## Meilenstein

- **Meilenstein** — Aktivieren setzt die Dauer auf 0 und zeigt die Raute statt eines Balkens.
- **Meilensteinart** — **Automatisch**, **Anfangsmeilenstein** oder **Endmeilenstein**.
- **Verbindlich (vertraglich)** — markiert den Meilenstein als vertraglich.

## Zeit

- **Startdatum** — zeigt den berechneten frühesten Anfang; eine manuelle Änderung verankert das neue Datum als geplanten Anfang.
- **Dauer (Arbeitstage)** — ganze Arbeitstage; bei einem Meilenstein deaktiviert.
- Mit **aktivierter Stundenplanung** und einem Stundenkalender bei der Aufgabe erscheinen drei synchronisierte Felder: **Tage**, **Stunden** und **Stunden gesamt** (nur ganze Zahlen). Ohne Stundenkalender zeigt ein Hinweis: „Die Stundeneingabe erfordert einen Stundenkalender (Arbeitszeiten)." Siehe [Kalender & Stundenplanung](docs://gids-kalenders-uren).

## Hammock (abgeleitete Dauer)

Nur bei einer Aufgabe ohne Unteraufgaben, die kein Meilenstein ist. Aktivieren macht die Dauer abgeleitet: die Spanne zwischen dem **Start-Treiber** (eingehende FS/SS-Beziehung) und dem **Ende-Treiber** (eingehende FF/SF-Beziehung), beide schreibgeschützt. Fehlt ein Ende-Treiber, meldet der Dialog, dass die Spanne auf die Länge null zurückfällt. Siehe [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse).

## Einschränkung und Stichtag

- **Einschränkung** — So früh wie möglich (ASAP), So spät wie möglich (ALAP), Anfang nicht früher als (SNET), Anfang nicht später als (SNLT), Ende nicht früher als (FNET), Ende nicht später als (FNLT), Muss anfangen am (MSO) oder Muss enden am (MFO); mit einem **Einschränkungstermin**, wo zutreffend.
- **Verbindlich (Pin-Logik)** — nur MSO/MFO: pinnt das Datum hart und überschreibt die Beziehungslogik; eine Verletzung wird stromaufwärts zu negativem Puffer.
- **Sekundäre Einschränkung** — eine zweite Grenze (SNET/FNET/SNLT/FNLT) mit einem **Sekundärtermin**; nicht bei einem harten Pin möglich. Verbotene Kombinationen werden rot mit einem Grund.
- **Stichtag** — ein Zieldatum außerhalb der Berechnung; ein Verfehlen gibt eine Warnung, keine Verschiebung. Siehe [Beziehungen & Einschränkungen](docs://gids-relaties-constraints).

## Fortschritt

- **Fortschritt (%)** — Schieberegler 0–100 %.
- **Ist-Anfang** / **Ist-Ende** — erfasste Tatsachen; bei einem Meilenstein ein einzelnes Feld **Ist-Datum**. Termine nach dem Statusdatum werden zurückgewiesen.
- **Restdauer (Arbeitstage)** — schreibgeschützt, abgeleitet aus Dauer × (1 − Fortschritt). Siehe [Baselines & Fortschritt](docs://gids-baselines-voortgang).

## CPM-Ergebnis (schreibgeschützt)

**Frühester Anfang/Ende**, **Spätester Anfang/Ende**, **Gesamtpuffer**, **Freier Puffer**, **Interferierender Puffer** (wenn berechnet) und **Kritischer Pfad** (ja/nein). Nach einer Berechnung (F5) gefüllt.

## Abhängigkeiten

Alle Beziehungen dieser Aufgabe: Richtung (→ Nachfolger, ← Vorgänger), die andere Aufgabe, ein Blitz-Symbol auf der **maßgebenden Beziehung**, der Beziehungstyp (FS/SS/FF/SF), die **Verzögerung** (z.B. 2d, 3ed, 50 %) und eine Entfernen-Schaltfläche. Änderungen wirken sofort.

## Zuweisungen

Pro zugewiesener Ressource: Name, **Einh./Tag**, **Kurve**, **Verschieben nach…** (die Zuweisung auf eine andere Aufgabe verschieben) und Entfernen; ganz unten **Ressource zuweisen**. Bei Meilensteinen oder Sammelaufgaben nicht möglich. Wirkt sofort. Siehe [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram).

## Codes & Felder

Nur sichtbar, wenn das Projekt Aufgabencode-Typen oder benutzerdefinierte Felder hat: eine Werte-Auswahl pro Codetyp, eine typisierte Eingabe pro benutzerdefiniertem Feld. Wirkt sofort. Definitionen werden im Struktur-Dialog verwaltet — siehe [Codes & Felder](docs://ref-codes-velden).
