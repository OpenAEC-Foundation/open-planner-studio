# Vorgänge und Meilensteine hinzufügen

Ziel: einen neuen Vorgang oder Meilenstein an der richtigen Stelle in Ihren Terminplan aufnehmen.

## Wann Sie das brauchen

Sie bauen einen Terminplan auf, es kommen Arbeiten hinzu, oder Sie möchten einen Zeitpunkt festhalten, etwa die Übergabe oder eine Prüfung.

Ein **Vorgang** ist Arbeit, die Zeit braucht. Ein neuer Vorgang dauert standardmäßig 5 Arbeitstage. Bei Stundenplanung kann der Projektstandard Stunden sein. Ein **Meilenstein** ist ein Zeitpunkt ohne Dauer: 0 Tage. Ein Vorgang mit Teilvorgängen heißt **Sammelvorgang**. Im Bauwesen ist das oft eine Phase. Dauer und Termine ergeben sich aus seinen Teilvorgängen, sobald Sie **Berechnen** (F5) nutzen.

## Schritte

### Vorgang hinzufügen

1. Wählen Sie *Start › Vorgänge › Vorgang*. Dieselbe Schaltfläche finden Sie auch auf der Registerkarte *Tabelle*.
2. Der Bereich *Eigenschaften* öffnet sich, und das Feld *Name* ist ausgewählt. Geben Sie den Namen ein und drücken Sie Enter.

Der neue Vorgang heißt zunächst *Neuer Vorgang* und beginnt am Projektstart.

Ist ein Vorgang ausgewählt, kommt der neue Vorgang direkt darunter, auf derselben Ebene. Ist der ausgewählte Vorgang ein Sammelvorgang, kommt der neue Vorgang unter die ganze Phase, also nach seinen Teilvorgängen. Ist nichts ausgewählt, kommt er ans Ende der Liste. Die QuickInfo der Schaltfläche zeigt, welcher der beiden Fälle eintritt: *Neuer Vorgang direkt unter der Auswahl* oder *Neuer Vorgang am Ende der Liste*. Wählen Sie mehrere Vorgänge aus, wird ein neuer Vorgang angelegt, unter dem untersten der Auswahl, so wie Sie sie auf dem Bildschirm sehen.

### Schnell einen Vorgang nach dem anderen in der Vorgangstabelle anlegen

Unter dem letzten Vorgang in der Vorgangstabelle steht immer eine graue Zeile *Neuer Vorgang*. Sie ist noch kein Vorgang: Sie steht nicht im Gantt-Diagramm und nicht in der Datei.

1. Klicken Sie auf eine Zelle dieser Zeile, oder gehen Sie mit der Pfeiltaste nach unten dorthin.
2. Geben Sie den Namen ein und drücken Sie Enter. Jetzt ist es ein echter Vorgang, auf derselben Ebene wie der Vorgang darüber. Der Cursor steht sofort auf der neuen grauen Zeile darunter.
3. Geben Sie den nächsten Namen ein, und so weiter.

Tragen Sie in der grauen Zeile nur eine Dauer oder ein Datum ein, dann heißt der Vorgang *Neuer Vorgang*. Verlassen Sie die Zeile, ohne etwas einzutragen, dann geschieht nichts: kein Vorgang und kein Schritt in *Rückgängig*. Das Anlegen des Vorgangs und sein erster Wert bilden zusammen einen einzigen Schritt in *Rückgängig*. Die graue Zeile ist nur sichtbar, wenn die Vorgangstabelle nicht gefiltert, gruppiert oder sortiert ist.

### Mit der rechten Maustaste auf freie Fläche

Klicken Sie mit der rechten Maustaste auf eine freie Fläche: in der Vorgangstabelle unter dem letzten Vorgang oder im Gantt-Diagramm neben oder unter den Balken. Wählen Sie *Neuer Vorgang* oder *Meilenstein hinzufügen*. Der Vorgang kommt ans Ende der Liste. Im Gantt-Diagramm beginnt er an dem Datum, auf das Sie geklickt haben. In der Vorgangstabelle öffnet sich sofort die Zelle *Name*, sodass Sie schreiben können.

### Oberhalb oder unterhalb eines bestimmten Vorgangs

Klicken Sie mit der rechten Maustaste auf den Vorgang und wählen Sie *Oberhalb einfügen* oder *Unterhalb einfügen*. Auch die Tastatur funktioniert: Mit Einfg fügen Sie oberhalb des ausgewählten Vorgangs ein, mit Strg+I (⌘+I auf dem Mac) darunter. In der Vorgangstabelle öffnet sich nach Einfg sofort die Zelle *Name*, bereit zum Schreiben.

Bei mehreren ausgewählten Vorgängen wird ein neuer Vorgang angelegt: *Oberhalb einfügen* setzt ihn über den obersten ausgewählten Vorgang, *Unterhalb einfügen* unter den untersten.

### Teilvorgang hinzufügen

Klicken Sie mit der rechten Maustaste auf den Vorgang und wählen Sie *Teilvorgang hinzufügen*. Der neue Vorgang kommt ans Ende der Teilvorgänge dieses Vorgangs. In der Vorgangstabelle neben dem Gantt-Diagramm hat ein Sammelvorgang nach seinem Namen außerdem ein kleines **+**, das dasselbe tut.

### Meilenstein hinzufügen

1. Wählen Sie *Start › Vorgänge › Meilenstein ▾* und danach *Anfangsmeilenstein*, *Endmeilenstein* oder *Prüfpunkt (verbindlich)*.
2. Geben Sie den Namen ein und drücken Sie Enter. Die Platzierung folgt derselben Regel wie bei *Vorgang*.

Die drei Arten unterscheiden sich so:

- Ein *Anfangsmeilenstein* gehört an den Anfang des Tages, ein *Endmeilenstein* an das Ende des Tages. Im Gantt-Diagramm steht die Raute links bzw. rechts von der Tagesspalte. Das ist auch für den Nachfolger wichtig. Angenommen, ein Meilenstein liegt am Dienstag, 29. September 2026, und ein Vorgang folgt darauf mit einer Beziehung Ende-Anfang. Nach einem Anfangsmeilenstein beginnt dieser Vorgang am selben Dienstag. Nach einem Endmeilenstein beginnt er am Mittwoch, 30. September.
- Ein *Prüfpunkt (verbindlich)* ist ein Endmeilenstein mit der Arbeitskategorie *Prüfung* und dem Häkchen *Verbindlich (vertraglich)*.

### Einen bestehenden Vorgang in einen Meilenstein umwandeln

Klicken Sie mit der rechten Maustaste auf den Vorgang und wählen Sie *Meilenstein umschalten*, oder setzen Sie im Bereich *Eigenschaften* das Häkchen bei *Meilenstein*. Der Menüeintrag gilt für die ganze Auswahl. Die Dauer wird auf 0 gesetzt.

Schalten Sie es wieder aus, dann bleibt er ein normaler Vorgang mit Dauer 0. Geben Sie selbst eine Dauer ein.

### Andere Möglichkeiten

- Strg+M (⌘+M auf dem Mac) setzt einen neuen Meilenstein ans Ende der Liste, auch wenn ein Vorgang ausgewählt ist. Der Bereich *Eigenschaften* öffnet sich nicht.
- Ein Meilenstein, den Sie mit Strg+M oder über das Kontextmenü anlegen, bekommt die Arbeitskategorie *Prüfung*. Ein *Anfangsmeilenstein* oder *Endmeilenstein* aus *Meilenstein ▾* bekommt *Sonstiges*. Ändern Sie die Arbeitskategorie im Bereich *Eigenschaften*, wenn Sie das brauchen.
- *Meilenstein hinzufügen* im Kontextmenü eines Vorgangs macht den Meilenstein zu einem Teilvorgang dieses Vorgangs, nicht zu einem Vorgang auf derselben Ebene.

### Einen Vorgang oder einen ganzen Zweig kopieren

1. Klicken Sie im Gantt-Diagramm auf den Balken des Vorgangs. Wählen Sie weitere Vorgänge mit Strg+Klick aus.
2. Drücken Sie Strg+C (⌘+C auf dem Mac). Die App kopiert den Vorgang mit allen seinen Teilvorgängen, den Beziehungen zwischen den kopierten Vorgängen und ihren Ressourcenzuweisungen.
3. Klicken Sie gegebenenfalls auf den Balken des Vorgangs, neben dem die Kopie stehen soll, und drücken Sie Strg+V (⌘+V).

Die Kopie hat denselben Namen, dieselben Termine und denselben Fortschritt. Sie kommt als Vorgang auf derselben Ebene neben dem ausgewählten Vorgang (bei mehreren neben dem, auf den Sie zuerst geklickt haben), unten unter diesen Vorgängen. Ist nichts ausgewählt, kommt sie ans Ende der Liste. Danach sind die kopierten Vorgänge ausgewählt. Die PSP-Nummern (die Nummer jedes Vorgangs im Baum, etwa 1.2; siehe [Struktur anpassen](docs://howto-structuur-aanpassen)) werden neu bestimmt, und der Terminplan ist nicht mehr aktuell.

Die Zwischenablage gilt für die ganze App. Sie können also auch in ein anderes Dokument einfügen. Was dort nicht existiert, etwa ein Kalender des Vorgangs, eine benutzerdefinierte Arbeitskategorie, ein Aktivitätscode oder ein benutzerdefiniertes Feld, entfernt die App und meldet es Ihnen.

### Danach

Ein neuer Vorgang ändert die anderen Termine noch nicht. Die Statusleiste zeigt *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*.

## Stolperfallen und was die App tut

**Jeder neue Vorgang beginnt am Projektstart.** Ohne Beziehungen wartet ein Vorgang auf nichts. Fügen Sie Beziehungen hinzu, siehe [Beziehungen hinzufügen](docs://howto-relaties-leggen).

**Filtern, Gruppieren oder Sortieren ist aktiv.** Die Reihenfolge, die Sie sehen, ist dann nicht die Reihenfolge des Terminplans. Bei ausgewähltem Vorgang fügen *Vorgang* und *Meilenstein ▾* den neuen Vorgang unten ein. Dann erscheint eine rote Meldung: *Der neue Vorgang wurde am Ende hinzugefügt. Während Filtern, Gruppieren oder Sortieren kann die App ihn nicht unter Ihre Auswahl setzen.* *Oberhalb einfügen* und *Unterhalb einfügen* werden abgelehnt, mit dem Streifen *Nicht verfügbar während des Filterns/Gruppierens/Sortierens*. Die Schaltfläche *Leeren* in der Meldung oder im Streifen entfernt Filter, Gruppierung und Sortierung auf einmal. Das gehört nicht zu *Rückgängig*: Strg+Z bringt sie nicht zurück.

**Ein Teilvorgang unter einem Vorgang mit Ressourcenzuweisungen.** Der Vorgang wird ein Sammelvorgang, und ein Sammelvorgang trägt selbst keine Zuweisungen. Die App verschiebt die Zuweisungen auf den neuen Teilvorgang und meldet das. Ist das nicht möglich, zum Beispiel weil Sie *Meilenstein hinzufügen* gewählt haben und ein Meilenstein keine Zuweisungen tragen kann, fügt die App nichts hinzu und sagt, warum.

**Ein Teilvorgang unter einem Meilenstein.** Der Meilenstein wird ein Sammelvorgang. Die App entfernt die Meilenstein-Markierung und zeigt eine Meldung.

**Meilenstein einschalten bei einem Sammelvorgang oder einem Vorgang mit Zuweisungen.** Die App lehnt ab und sagt, warum. Bei Zuweisungen entfernen Sie diese zuerst.

**Kopieren in der Vorgangstabelle.** In der Vorgangstabelle (und auf der Registerkarte *Tabelle*) kopiert Strg+C nur die Werte der ausgewählten Zellen, wie in einer Tabellenkalkulation, und Strg+V fügt in Zellen ein. Vorgänge lassen sich daher nur im Gantt-Diagramm kopieren: Klicken Sie zuerst auf einen Balken.

## Siehe auch

- [Struktur anpassen](docs://howto-structuur-aanpassen): Vorgänge tiefer stufen und verschieben und die PSP-Nummern aktuell halten.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): Vorgänge miteinander verknüpfen.
- [Vorgänge auswählen, löschen und rückgängig machen](docs://howto-taken-selecteren-verwijderen): einen Vorgang wieder entfernen.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was die App berechnet, sobald es Beziehungen gibt.
- [Vorgangsdialog und Eigenschaftenbereich](docs://ref-taak-eigenschappen): alle Felder eines Vorgangs.
- [Neues Projekt und Projektinfo](docs://ref-projectinfo): mit einer Vorlage für Bauphasen beginnen.
- [Kontextmenüs](docs://ref-contextmenus): alle Einträge des Menüs für einen Vorgang.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): ein kleines Beispielprojekt (*Datei › Beispiele*) mit vier Phasen, einem Anfangsmeilenstein und einem verbindlichen Meilenstein für die Übergabe.
