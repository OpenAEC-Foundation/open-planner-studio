# Externe Verknüpfungen

Das Fenster **Externe (projektübergreifende) Verknüpfung** erfasst eine Abhängigkeit zwischen einer Aufgabe in diesem Projekt und einer Aufgabe in einer anderen Projektdatei — zum Beispiel einem Erdarbeiten-Projekt, das vor Ihrem Beginn fertig sein muss.

## Öffnen

Registerkarte **Beziehungen** → Schaltfläche **Externe Verknüpfung…**. Es muss genau eine Aufgabe ausgewählt sein; sonst erscheint „Wählen Sie einen einzelnen Vorgang aus, um eine externe Verknüpfung hinzuzufügen."

## Der eingefrorene Anker

Eine externe Verknüpfung berechnet nicht live gegen das Quellprojekt. Beim Hinzufügen wird das relevante Datum der Quellaufgabe (Anfang oder Ende, je nach Richtung und Beziehungstyp) als festes **Ankerdatum** gespeichert; die Berechnung verwendet dieses Datum als Grenze. Ändert sich das Quellprojekt danach, verschiebt sich nichts mit, bis Sie die Verknüpfung **aktualisieren**.

## Zwei Wege

- **Quelldatei** — wählen Sie eine Datei unter **Eine zuletzt verwendete Datei wählen**; sie wird schreibgeschützt eingelesen („Die Quelldatei wird schreibgeschützt eingelesen — sie wird nicht als Dokument geöffnet."). Wählen Sie dann den **Quellvorgang** aus der Liste; das Ankerdatum wird aus dieser Aufgabe automatisch gelesen und unten angezeigt. Dieser Weg erfordert die Desktop-App und mindestens eine zuletzt verwendete Datei.
- **Manuell (Fallback)** — keine Datei zur Hand (oder die Browserversion): Fügen Sie **Projekt-ID** und **Vorgangs-ID** der externen Aufgabe ein, optional einen **Vorgangsname**, und geben Sie das **Ankertermin** selbst ein. Eine manuelle Verknüpfung wird als „veraltet" markiert, bis eine Aktualisierung die Quelle tatsächlich findet.

## Gemeinsame Felder

- **Richtung** — **Vorgänger (extern → ich)**: die externe Aufgabe treibt meine Aufgabe; oder **Nachfolger (ich → extern)**: meine Aufgabe treibt die externe.
- **Beziehungstyp** — FS, SS, FF oder SF.
- **Abstand (Arbeitstage)** — Wartezeit (oder negativ: Überlappung) zusätzlich zum Anker.

**Verknüpfung hinzufügen** speichert die Verknüpfung (deaktiviert, bis die Pflichtfelder gefüllt sind); **Abbrechen** schließt, ohne hinzuzufügen.

## Verwaltung, Aktualisieren und fehlende Quellen

Bestehende Verknüpfungen sind im Bereich Beziehungen unter **Externe Verknüpfungen** gelistet:

- Pro Verknüpfung: die Quellaufgabe, der Typ, der Anker und ein **veraltet**-Badge, sobald die Quelle (nicht mehr) geladen werden konnte — mit der Erklärung „Quelle nicht geladen — zum Aktualisieren erneut importieren".
- **Diese Verknüpfung aktualisieren** — liest die Quelldatei dieser einen Verknüpfung neu ein und aktualisiert den Anker.
- **Externe Anker aktualisieren** — liest jede referenzierte Quelldatei neu ein und aktualisiert alle Anker plus den Veraltet-Status. Danach meldet eine Statuszeile, wie viele Anker aktualisiert wurden und wie viele veraltet blieben.
- **Entfernen** — löscht die Verknüpfung.
- Aktualisieren liest Dateien und funktioniert daher nur in der Desktop-App; die Browserversion meldet „Quelldateien lesen ist nur in der Desktop-App möglich; verwenden Sie den manuellen Fallback."

## Weiterlesen

- [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse) — wie externe Verknüpfungen in den kritischen Pfad einfließen.
