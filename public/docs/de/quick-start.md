# Ihr erster Terminplan in 10 Minuten

Diese Anleitung führt Sie in etwa 10 Minuten von einem leeren Projekt zu einem vollständig berechneten Bauzeitplan: Aufgaben hinzufügen, eine Aufgabenstruktur aufbauen, Beziehungen herstellen, berechnen und speichern. Keine Theorie vorab — Sie machen es einfach, Schritt für Schritt, mit genau den Schaltflächen und Menüs, die Sie in Open Planner Studio finden.

## Was Sie tun werden

1. Ein neues Projekt erstellen.
2. Aufgaben hinzufügen — über das Menüband, die Aufgabentabelle und das Gantt-Diagramm.
3. Die Aufgaben durch Einrücken in eine Struktur (WBS) bringen.
4. Beziehungen zwischen Aufgaben hinzufügen.
5. Den Terminplan berechnen.
6. Das Ergebnis lesen: kritischer Pfad und Puffer.
7. Speichern.

Möchten Sie zuerst sehen, worauf Sie zusteuern? Öffnen Sie das Beispielprojekt [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) über **Datei → Beispiele**. (Die Beispielnamen werden, wie im Projekt mitgeliefert, auf Niederländisch angezeigt.) Es ist ein kleiner, gut lesbarer Terminplan, der bereits fast jeden der folgenden Schritte zeigt — praktisch, um ihn neben diesem Artikel zum Vergleich offen zu halten.

Alles im Folgenden funktioniert in der Desktop-App und in der Browserversion identisch: dieselben Schaltflächen, dieselben Menüs, dieselben Tastenkombinationen.

## Schritt 1 — Ein neues Projekt erstellen

1. Klicken Sie auf die Menüband-Registerkarte **Datei**. Damit öffnet sich die Dateiansicht.
2. Klicken Sie auf **Neu** (oder verwenden Sie die Tastenkombination **Ctrl+N**, wenn Sie bereits in einem anderen Projekt arbeiten). Der Dialog **Neues Projekt** erscheint.
3. Geben Sie einen **Projektname**n ein, zum Beispiel „Mein erster Terminplan", und prüfen Sie das **Startdatum** — es ist standardmäßig der heutige Tag.
4. Wählen Sie bei **Phasen-Vorlage** die Option **Leer**. Die Vorlagen **Wohnungsbau** und **Gewerbebau / Sanierung** richten bereits einige Phasenaufgaben für Sie ein, aber in dieser Übung bauen Sie alles selbst, damit Sie jeden Schritt nachvollziehen.
5. Belassen Sie die Kalenderoptionen bei ihren Standardwerten und klicken Sie auf **Erstellen**.

Sie haben nun ein leeres Projekt: eine leere Aufgabentabelle links, ein leeres Gantt-Diagramm rechts und einen Arbeitskalender, der bereits aus den Standardeinstellungen eingerichtet ist.

## Schritt 2 — Aufgaben hinzufügen

Stellen Sie sicher, dass Sie sich auf der Menüband-Registerkarte **Start** befinden. Diese Registerkarte zeigt die Aufgabentabelle (links) und das Gantt-Diagramm (rechts) nebeneinander — zwei Ansichten desselben Terminplans, sodass eine Aufgabe, die Sie hinzufügen, sofort an beiden Stellen erscheint.

### Über das Menüband

1. Klicken Sie in der Menübandgruppe **Aufgaben** auf die Schaltfläche **Aufgabe**. Eine neue Aufgabe namens „Neue Aufgabe" erscheint mit einer Dauer von 5 Arbeitstagen unten sowohl in der Aufgabentabelle als auch im Gantt-Diagramm.
2. Wiederholen Sie dies einige Male, bis Sie für jede Hauptphase Ihres Projekts eine Aufgabe haben. Wenn Sie dem Beispielprojekt folgen, verwenden Sie dieselben Hauptphasen wie dieses: „1. Voorbereiding" (Vorbereitung), „2. Fundering & ruwbouw" (Gründung & Rohbau), „3. Afbouw" (Ausbau) und „4. Oplevering" (Übergabe).
3. Doppelklicken Sie auf eine Aufgabe — in der Tabelle oder auf ihrem Balken im Gantt-Diagramm —, um das Fenster **Aufgabe bearbeiten** zu öffnen. Passen Sie **Name**, **Typ** und **Dauer (Arbeitstage)** an Ihre Phase an.

### Über die Aufgabentabelle und das Gantt-Diagramm

Sie müssen nicht ständig zum Menüband zurückkehren. Klicken Sie mit der rechten Maustaste auf eine **leere Zeile** in der Aufgabentabelle oder auf eine leere Stelle im Gantt-Diagramm (wo noch keine Aufgabe ist) und wählen Sie im Kontextmenü **Neue Aufgabe**.

Klicken Sie stattdessen mit der rechten Maustaste auf eine **vorhandene** Aufgabe, erhalten Sie ein anderes Kontextmenü mit unter anderem:

- **Oberhalb einfügen** / **Unterhalb einfügen** — fügt eine Aufgabe vor oder nach der per Rechtsklick ausgewählten Aufgabe hinzu.
- **Unteraufgabe hinzufügen** — erstellt in einem Schritt eine neue Aufgabe als untergeordnete Aufgabe dieser Aufgabe (siehe Schritt 3 für die Bedeutung).

Etwas falsch eingegeben oder eine Aufgabe an der falschen Stelle hinzugefügt? **Ctrl+Z** macht die letzte Aktion rückgängig, **Ctrl+Y** (oder **Ctrl+Shift+Z**) stellt sie wieder her — beides funktioniert im gesamten Terminplan, nicht nur in Textfeldern.

### Einen Meilenstein hinzufügen

Jeder Terminplan braucht mindestens einen Meilenstein, zum Beispiel für die Übergabe. Klicken Sie in der Menübandgruppe **Aufgaben** auf den Pfeil neben **Meilenstein** und wählen Sie **Endmeilenstein**, **Anfangsmeilenstein** oder **Prüfpunkt (verbindlich)** — oder verwenden Sie die Tastenkombination **Ctrl+M** für einen schnellen, allgemeinen Meilenstein („Neuer Meilenstein"), den Sie danach umbenennen.

## Schritt 3 — Eine Aufgabenstruktur aufbauen (WBS)

Eine flache Aufgabenliste wird schnell unübersichtlich. Durch das Einrücken von Aufgaben bauen Sie eine Aufgabenstruktur (WBS) auf: Die Aufgabe darüber wird dann automatisch zu einer **Sammelaufgabe**, die den gesamten Zeitraum ihrer Unteraufgaben umfasst.

1. Wählen Sie eine Aufgabe, die unter einer anderen Aufgabe liegen soll — zum Beispiel „Fundering aanbouw" (Erweiterungs-Gründung) unter der Phasenaufgabe „2. Fundering & ruwbouw" (Gründung & Rohbau).
2. Drücken Sie **Alt+→** zum Einrücken, oder klicken Sie mit der rechten Maustaste und wählen Sie im Kontextmenü **Einrücken**. Die Aufgabe darüber wird sofort als Sammelaufgabe sichtbar.
3. Zu weit gegangen oder eine Aufgabe wieder auf die oberste Ebene verschieben? Verwenden Sie **Alt+←**, oder klicken Sie mit der rechten Maustaste und wählen Sie **Ausrücken**.
4. Schneller bei einer ganz neuen Unteraufgabe: Klicken Sie mit der rechten Maustaste auf die übergeordnete Aufgabe und wählen Sie **Unteraufgabe hinzufügen** — das überspringt die separaten Schritte des Hinzufügens und anschließenden Einrückens.

Wiederholen Sie dies, bis Sie einige Ebenen tief sind. Im Beispielprojekt gliedert sich die Phase „2. Fundering & ruwbouw" beispielsweise in die Unteraufgaben „Grondwerk aanbouw" (Erweiterungs-Erdarbeiten), „Fundering aanbouw" (Erweiterungs-Gründung), „Begane grondvloer storten" (Erdgeschossdecke gießen), „Wanden opmetselen" (Wände mauern) und „Dakconstructie plaatsen" (Dachkonstruktion montieren).

Dieser Artikel behandelt den Aufbau der WBS nur auf praktischer Ebene, damit Sie ins Rollen kommen. Um im Detail zu erfahren, wie Meilensteinarten, Sammelaufgaben und Aufgabencodes zusammenwirken, lesen Sie die Anleitung [Planung & WBS](docs://gids-plannen-wbs).

## Schritt 4 — Beziehungen hinzufügen

Aufgaben ohne Beziehungen sind unabhängig voneinander und verschieben sich nicht, wenn Sie eine frühere Aufgabe ändern. Eine Beziehung (Abhängigkeit) verknüpft zwei Aufgaben miteinander.

1. Stellen Sie sicher, dass die Balken der beiden Aufgaben, die Sie verknüpfen möchten, im Gantt-Diagramm sichtbar sind.
2. Halten Sie **Shift** und ziehen Sie vom Balken des Vorgängers zum Balken des Nachfolgers. Sobald Sie loslassen, wird sofort eine **Ende-Anfang (FS)**-Beziehung mit einem Abstand von 0 Arbeitstagen erstellt — die häufigste Beziehung: Der Nachfolger startet erst, wenn der Vorgänger beendet ist.
3. Direkt nach dem Loslassen erscheint das Fenster **Beziehungstyp**. Hier können Sie den Beziehungstyp (**FS**, **SS**, **FF** oder **SF**) ändern und eine **Verzögerung** eingeben, zum Beispiel `2d` für zwei Arbeitstage Wartezeit zwischen den Aufgaben. Kurz: Bei **FS** (Ende-Anfang) startet der Nachfolger, nachdem der Vorgänger beendet ist, bei **SS** (Anfang-Anfang) beginnen beide Aufgaben (ungefähr) gleichzeitig, bei **FF** (Ende-Ende) enden sie (ungefähr) gleichzeitig, und bei **SF** (Anfang-Ende) muss der Vorgänger begonnen haben, bevor der Nachfolger enden darf — die Letztere ist in der Baupraxis am seltensten.
4. Möchten Sie zwei Aufgaben lieber ohne Ziehen verknüpfen? Gehen Sie zur Menüband-Registerkarte **Beziehungen** (oder klicken Sie auf **Verwalten** in der Menübandgruppe **Beziehungen** auf der Registerkarte Planung), wählen Sie zuerst den Vorgänger und dann (bei gedrückter Ctrl/Cmd-Taste) den Nachfolger und verwenden Sie die Schaltfläche **Neue Beziehung aus Auswahl** — diese Schaltfläche funktioniert nur, wenn genau zwei Aufgaben in dieser Reihenfolge ausgewählt sind.

Fügen Sie für die Übung mindestens zwei Beziehungen hinzu: zum Beispiel „1. Voorbereiding" → „2. Fundering & ruwbouw" und „2. Fundering & ruwbouw" → „3. Afbouw".

## Schritt 5 — Berechnen

Da Sie nun Aufgaben und Beziehungen haben, können Sie den Terminplan berechnen lassen (CPM — Critical-Path-Methode / Methode des kritischen Pfades).

1. Drücken Sie **F5**, oder klicken Sie auf die Schaltfläche **Berechnen** in der Menübandgruppe **Terminplanung**.
2. Open Planner Studio berechnet nun für jede Aufgabe die frühesten und spätesten Anfangs- und Endtermine, den Puffer und welche Aufgaben auf dem kritischen Pfad liegen.
3. Möchten Sie sich nicht mehr um F5 kümmern? Aktivieren Sie **Automatisch berechnen** in den **Einstellungen**. Der Terminplan wird dann neu berechnet, sobald er veraltet ist, anstatt auf ein manuelles Drücken von F5 zu warten.

## Schritt 6 — Das Ergebnis lesen

- Unten auf dem Bildschirm zeigt die Statusleiste nach der Berechnung des Terminplans beispielsweise „Kritischer Pfad: 4 Aufgaben, 62 Arbeitstage" an. Wenn Sie seit der letzten Berechnung etwas geändert haben, zeigt sie stattdessen „Veraltet — neu berechnen (F5)".
- Im Gantt-Diagramm erhalten kritische Aufgaben — Aufgaben ohne Puffer, die daher das Projektendedatum unmittelbar bestimmen — eine andere Balkenfarbe als Aufgaben, die noch Spielraum (Puffer) haben. Wenn eine kritische Aufgabe später liegt, verschiebt sich das gesamte Projektendedatum mit; eine Aufgabe mit Puffer kann später liegen, ohne Folgen, solange der Puffer nicht aufgebraucht ist.
- Doppelklicken Sie auf eine Aufgabe, um das Fenster **Aufgabe bearbeiten** erneut zu öffnen. Im Abschnitt **CPM-Ergebnis** finden Sie pro Aufgabe: **Frühester Anfang**, **Frühestes Ende**, **Spätester Anfang**, **Spätestes Ende**, **Gesamtpuffer**, **Freier Puffer** und ob die Aufgabe auf dem **Kritischen Pfad** liegt.
- Möchten Sie diese Daten auch als Spalten in der Aufgabentabelle haben, statt jede Aufgabe öffnen zu müssen? Gehen Sie zur Menüband-Registerkarte **Ansicht**, klicken Sie in der Gruppe **Anzeige** auf **Spalten…** und aktivieren Sie **Kritisch** und **Gesamtpuffer**.

## Schritt 7 — Speichern

1. Drücken Sie **Ctrl+S**, oder klicken Sie auf der Registerkarte **Datei** auf **Speichern**. Beim ersten Mal fragt Open Planner Studio nach einem Dateinamen und Speicherort; das Projekt wird als native IFC-Datei gespeichert.
2. Möchten Sie stattdessen eine Kopie unter einem anderen Namen behalten, zum Beispiel um zwei Varianten parallel zu behalten? Verwenden Sie **Datei → Speichern unter** (Tastenkombination **Ctrl+Shift+S**).

## Weiter üben

- Spielen Sie die obigen Schritte mit einem vollständigen Beispiel nach: Öffnen Sie [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) über **Datei → Beispiele** und erkennen Sie die FS-Kette zwischen den Phasen, die SS-Überlappung zwischen der Wand- und Dacharbeit, die FF-Verknüpfung zwischen der Fliesen- und Malerarbeit sowie die Baugenehmigungs-Einschränkung (SNET) vor dem Beginn.
- Möchten Sie mehr über Aufgabenstruktur, Sammelaufgaben, Meilensteinarten und Aufgabencodes erfahren? Lesen Sie die Anleitung [Planung & WBS](docs://gids-plannen-wbs).
- Möchten Sie lieber eine visuelle Tour durch die Hauptbereiche des Bildschirms? Starten Sie die Tour neu über die Registerkarte **Ansicht** → Schaltfläche **Tour** oder über **Datei** → **Tour starten**.
