# Tastenkombinationen & Bedienung

Diese Anleitung listet keine Tastenkombinationen auf — diese Liste existiert bereits an einer Stelle, und eine Kopie hier würde sofort veralten. Stattdessen erklärt sie, **wie Sie die aktuelle Liste stets aufrufen**, und welche Bedienkonzepte (Kontextmenüs, Ziehen, Auswahl-Rechteck versus Verschieben, Zoomen) für sich genommen verständenswert sind.

## Was Sie hier lernen

- Wie Sie die stets aktuelle Kombinationsübersicht öffnen.
- Was jedes der vier Kontextmenüs in der Gantt-Ansicht enthält.
- Wie Ziehen funktioniert: einen Balken verschieben versus eine Beziehung ziehen.
- Wann ein Ziehen auf leerer Fläche verschiebt (Pan) und wann es ein Auswahl-Rechteck zieht.
- Zoomen, Dokument-Registerkarten und Präsentationsmodus.
- Wie Sie die Tour neu starten.

## Die stets aktuelle Übersicht

Drücken Sie **Ctrl+/** (oder **Cmd+/** unter macOS), um die Kombinationsübersicht zu öffnen — dasselbe Fenster ist auch über die Schaltfläche **Tastenkombinationen** auf der Menüband-Registerkarte **Ansicht** erreichbar. Dieses Fenster ist schreibgeschützt und wird direkt aus dem Quellcode der App aufgebaut: Eine neue Tastenkombination erscheint hier automatisch, ohne eine separate Liste, die jemand synchron halten müsste. Genau deshalb dupliziert diese Anleitung die Liste nicht — eine zweite, von Hand gepflegte Liste würde früher oder später von dem abweichen, was die App tatsächlich tut. Das Fenster gruppiert die Kombinationen nach Kategorie: Datei, Bearbeiten, Struktur, Ansicht und Navigation.

## Kontextmenüs: vier Arten, je nachdem, wo Sie rechtsklicken

Ein Rechtsklick in der Gantt-Ansicht ergibt je nach Position der Maus ein anderes Menü:

- **Auf einem Aufgabenbalken** — das vollständige Aufgaben-Menü (Bearbeiten, Einfügen, Unteraufgabe/Meilenstein/Beziehung hinzufügen, Kalender zuweisen, Fortschritt, Priorität, Pfad verfolgen, Löschen…), plus einen zusätzlichen balkenspezifischen Eintrag ganz oben: **Beziehung von hier aus starten**.
- **Auf einer Aufgabenzeile ohne Treffer auf dem Balken** (zum Beispiel eine Zeile, deren Balken gerade nicht sichtbar ist) — dasselbe Aufgaben-Menü, aber ohne den balkenspezifischen Eintrag.
- **Auf einer Gruppenkopfzeile** (der Zeile, die eine gruppierte Menge Aufgaben zusammenfasst) — ein kleines Menü zum Ein-/Ausklappen dieser einen Gruppe, plus **Alle ausklappen**/**Alle einklappen** für den gesamten Baum.
- **Auf leerer Fläche** (keine Aufgabe, keine Gruppenkopfzeile) — **Neue Aufgabe**, **Meilenstein hinzufügen**, **Einfügen** (falls etwas in der Zwischenablage liegt), **Zoom zurücksetzen** und **An Projekt anpassen**.

Dieses letzte Menü wurde live verifiziert: Ein Rechtsklick auf eine leere Stelle der Gantt-Leinwand erzeugt exakt diese fünf Einträge, in dieser Reihenfolge.

## Ziehen an einem Aufgabenbalken

Einen Aufgabenbalken greifen und ziehen verschiebt die Aufgabe (oder ändert, wenn Sie die Kante greifen, ihre Dauer). Halten Sie beim Ziehen ab einem Balken **Shift**, beginnen Sie stattdessen, eine **Beziehung** zu der Aufgabe zu ziehen, auf der Sie loslassen — dasselbe wie **Beziehung von hier aus starten** im Kontextmenü des Balkens, aber in einer einzigen Mausbewegung.

## Verschieben versus Auswahl-Rechteck

Ein Ziehen, das auf leerem Raum beginnt, tut eines von zwei Dingen, und das hängt davon ab, wo Sie beginnen, und von Ihrem Scroll-Modus (**Einstellungen → Scrollen & Zoomen**):

- **In der Aufgabentabelle** (der linken Spalte mit WBS/Name/Dauer) ist ein Ziehen auf leerem Raum **immer** ein Auswahl-Rechteck — Verschieben (Pan) passiert dort nie.
- **Auf der Gantt-Leinwand selbst**: Wenn Ihr Scroll-Modus auf **Zoom + Ziehen** (kartenartiges Verschieben) steht, gewinnt Verschieben — genau wie von einer Karten-App erwartet. Bei einem der anderen Scroll-Modi (**Position** oder **Tasten**) ist dasselbe Ziehen auf leerer Leinwand ein Auswahl-Rechteck, mit dem Sie mehrere Aufgaben zugleich auswählen, indem Sie ein Rechteck um sie ziehen.

Kurz: Die Aufgabentabelle wählt stets; die Leinwand verschiebt nur im Scroll-Modus „Ziehen" und wählt sonst aus.

## Zoomen

Neben den Zoom-Schaltflächen auf dem Menüband zoomen **+**/**=** (oder **Ctrl+=**) hinein und **-** (oder **Ctrl+-**) heraus. Ein nacktes **0** setzt den Zoom auf die Voreinstellung zurück; **Ctrl+0** passt den Zoom so an, dass das gesamte Projekt auf den Bildschirm passt („An Projekt anpassen") — dasselbe wie die gleichnamige Schaltfläche im Kontextmenü für leere Fläche oben.

## Dokument-Registerkarten

Wenn Sie mehrere Projekte zugleich geöffnet haben (jedes in seiner eigenen Dokument-Registerkarte), springen **Ctrl+1** bis **Ctrl+9** direkt zur ersten bis neunten Dokument-Registerkarte.

## Präsentationsmodus

**F11** schaltet den Präsentationsmodus um — eine Vollbildansicht ohne Menüband und Seitenbereiche, gedacht, um den Terminplan ohne die Bearbeitungs-Chrome darum zu zeigen. **Esc** beendet den Präsentationsmodus wieder (und führt bei einem weiteren Druck das übliche „Auswahl aufheben" aus).

## Die Tour neu starten

Möchten Sie die Einführungstour noch einmal laufen lassen (zum Beispiel, um jemand anderem die App zu zeigen)? Dafür gibt es zwei Stellen: die Schaltfläche **Tour** auf der Menüband-Registerkarte **Ansicht** oder **Tour starten** in der Backstage-Navigation (die Zeile direkt über Einstellungen). Beide starten die Tour sofort, ohne vorher den Willkommensdialog zu zeigen.

## Weiterlesen

- Öffnen Sie die Kombinationsübersicht selbst mit **Ctrl+/** — das ist die bindende Quelle, nicht diese Anleitung.
- Das Scroll- und Zoomverhalten wird unter **Einstellungen → Scrollen & Zoomen** konfiguriert, verfügbar in allen drei festen Einstellungsorten der App (dem Zahnrad-Symbol, der Menüband-Registerkarte Einstellungen und Backstage → Einstellungen).
