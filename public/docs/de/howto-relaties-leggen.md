# Beziehungen hinzufügen

Ziel: Verknüpfen Sie Vorgänge miteinander, damit ein Vorgang erst beginnt, wenn die vorherige Arbeit abgeschlossen ist. Wo nötig, fügen Sie einen Zeitabstand (eine Wartezeit) zwischen den Vorgängen hinzu.

## Wann Sie das brauchen

Ohne Beziehungen weiß die App nicht, dass der Maurer erst beginnen kann, wenn das Fundament gegossen ist. Dann beginnt jeder Vorgang am Projektstart, und das Enddatum sagt nichts aus. Eine **Beziehung** legt diese Reihenfolge fest. Der erste Vorgang ist der **Vorgänger**, der zweite der **Nachfolger**.

Sie fügen Beziehungen hinzu, wenn Sie einen Terminplan aufbauen, wenn ein Vorgang hinzukommt oder wenn sich später doch herausstellt, dass zwei Arbeiten voneinander abhängen. Ein **Zeitabstand** ist eine Wartezeit zwischen zwei Vorgängen, zum Beispiel wenn Beton aushärten muss oder ein Estrich trocknen muss.

Die Standardbeziehung ist **FS** (Ende-Anfang): Der Nachfolger kann erst beginnen, wenn der Vorgänger abgeschlossen ist. Die App kennt außerdem SS, FF und SF. Diese verbinden einen Anfang oder ein Ende mit einem Anfang oder einem Ende. Bei SS (Anfang-Anfang) kann zum Beispiel der Putz erst beginnen, wenn die Haustechnik begonnen hat.

Wissen Sie nicht, welchen Typ Sie brauchen? Unter der Typauswahl erklärt ein Satz mit den echten Vorgangsnamen den Typ, zum Beispiel *Metselwerk beginnt erst, wenn Fundering abgeschlossen ist.* Wählen Sie einen anderen Typ, dann ändert sich der Satz. Sie sehen ihn im Fenster *Beziehungstyp*, im Block *Abhängigkeiten* und in der Spalte *Vorgänger* oder *Nachfolger*.

## Schritte

Es gibt vier Wege, eine Beziehung hinzuzufügen. Sie erzeugen dieselbe Beziehung. Wählen Sie den Weg, der am besten zu Ihrer Situation passt.

### Zwei ausgewählte Vorgänge verknüpfen

Nützlich, wenn Sie in der Vorgangstabelle arbeiten.

1. Klicken Sie in der Vorgangstabelle auf den Vorgang, der zuerst kommt: den Vorgänger.
2. Halten Sie Strg (⌘ auf einem Mac) gedrückt und klicken Sie auf den Vorgang, der danach kommt: den Nachfolger.
3. Wählen Sie *Start › Vorgänge › Verknüpfen ▾ › Ausgewählte Vorgänge verknüpfen*. Dieselbe Schaltfläche finden Sie auch unter *Planung › Beziehungen*.

Die App erstellt eine Ende-Anfang-Beziehung ohne Zeitabstand. Sie sehen sie als Pfeil im Gantt und in der Spalte *Vorgänger*; eine Benachrichtigung erscheint nur, wenn die App die Beziehung ablehnt. Die Schaltfläche funktioniert nur, wenn genau zwei Vorgänge ausgewählt sind.

### Eine Beziehung im Gantt zeichnen

Nützlich, wenn Sie viele Beziehungen nacheinander hinzufügen.

1. Wählen Sie *Start › Vorgänge › Verknüpfen ▾ › Beziehung zeichnen*. Über dem Terminplan erscheint der Hinweis *Verknüpfungsmodus: Im Gantt von einem Balken zum anderen ziehen, um eine Beziehung zu erstellen. Esc beendet.*
2. Drücken Sie die Maustaste auf dem Balken des Vorgängers und ziehen Sie zum Balken des Nachfolgers. Eine gestrichelte Linie mit Pfeil folgt dem Mauszeiger.
3. Lassen Sie los. Ein kleines Fenster *Beziehungstyp* erscheint. Es zeigt den Typ (standardmäßig FS) und ein Feld für den Zeitabstand.
4. Ändern Sie bei Bedarf den Typ oder den Zeitabstand und drücken Sie Enter oder klicken Sie außerhalb des Fensters. Die Beziehung wird erstellt.
5. Fügen Sie sofort die nächste Beziehung hinzu: Der Modus bleibt aktiv. Sie beenden ihn mit Esc, mit der Schaltfläche *Beenden* im Hinweis oder indem Sie erneut *Beziehung zeichnen* wählen.

Wenn Sie im Fenster *Beziehungstyp* Esc drücken, wird nichts gespeichert. Für eine einzelne Beziehung müssen Sie den Modus nicht einschalten: Halten Sie beim Ziehen von Balken zu Balken die Umschalttaste gedrückt. *Beziehung von hier aus starten* im Rechtsklick-Menü eines Balkens schaltet den Verknüpfungsmodus ein. Das Ziehen machen Sie dann selbst. Auf dem Tab *Tabelle* ohne Gantt ist *Beziehung zeichnen* deaktiviert.

### Eine Beziehung im Eigenschaftenbereich hinzufügen

Nützlich, wenn Sie einen Vorgang betrachten und seine Vorgänger oder Nachfolger hinzufügen möchten.

1. Wählen Sie den Vorgang aus. Der Bereich *Eigenschaften* liegt rechts. Wenn Sie ihn nicht sehen, schalten Sie ihn mit *Ansicht › Bereiche › Eigenschaften* ein.
2. Klicken Sie im Block *Abhängigkeiten* auf *Beziehung hinzufügen*.
3. Lassen Sie die Richtung auf *Vorgänger*, wenn der andere Vorgang zuerst kommt. Sonst wählen Sie *Nachfolger*.
4. Geben Sie einen Teil des Namens des anderen Vorgangs ein. Wählen Sie den richtigen mit den Pfeiltasten und Enter oder klicken Sie darauf.
5. Wählen Sie den Typ (standardmäßig FS) und tragen Sie bei Bedarf einen Zeitabstand ein.
6. Drücken Sie Enter oder klicken Sie auf das Häkchen (*Verknüpfung anlegen*).

Die Beziehungen des Vorgangs stehen danach im Block *Abhängigkeiten*. Jede Beziehung zeigt die PSP-Nummer des anderen Vorgangs, den Typ und den Zeitabstand.

### Beziehungen in der Spalte Vorgänger eingeben

Nützlich, wenn Sie schnell mit der Tastatur arbeiten und die PSP-Nummern kennen.

1. Klicken Sie rechts in der Kopfzeile der Vorgangstabelle auf das **+** (*Spalte hinzufügen*). Wählen Sie unter *Beziehungen* die Spalte *Vorgänger*. Die Spalte *Nachfolger* funktioniert genauso.
2. Klicken Sie in der Spalte *Vorgänger* auf die Zelle des Nachfolgers.
3. Geben Sie die PSP-Nummer des Vorgängers ein, ein Leerzeichen und den Typ, zum Beispiel `2.6 FS`. Setzen Sie den Zeitabstand direkt dahinter: `2.6 FS+1d`. Trennen Sie mehrere Vorgänger mit einem Semikolon oder Komma: `3.1 FS; 3.2 SS+2d`.
4. Drücken Sie Enter.

Was Sie eingeben, ersetzt die ganze Zelle. Stehen darin schon Vorgänger, geben Sie sie ebenfalls ein (siehe Fallstricke). Wenn Sie in der Zelle statt zu tippen Enter oder F2 drücken, öffnet sich ein Eingabefeld, das die vorhandenen Beziehungen behält. Dort suchen Sie einen Vorgang nach PSP-Nummer oder Namen und wählen Typ und Zeitabstand für jede Beziehung.

### Einen Zeitabstand festlegen oder ändern

Sie geben einen Zeitabstand in das Feld neben dem Typ ein, bei jedem der oben genannten Wege. Einen vorhandenen Zeitabstand ändern Sie im Block *Abhängigkeiten*: Klicken Sie in das Feld für den Zeitabstand, geben Sie den neuen Wert ein und drücken Sie Enter.

- `3` oder `3d`: 3 Arbeitstage. Ein Wochenende zählt nicht mit. Die App zeigt `+3d`.
- `3ed`: 3 Kalendertage. Das Wochenende zählt mit, wie bei Beton, der auch am Samstag und Sonntag aushärtet.
- `-1`: ein negativer Zeitabstand (Vorlauf). Der Nachfolger darf einen Tag früher beginnen, sodass sich die Vorgänge überlappen.
- `4h`: 4 Arbeitsstunden. Die App zeigt es als `+4h`. Ist der Vorgänger ein Tagesvorgang in einem Kalender ohne eigene Bänder für die Arbeitszeit, wie dem Standardkalender, dann rechnet die App dies in ganze Arbeitstage um, auf den nächsten ganzen Tag gerundet: `4h` wirkt dann als 1 Tag, `2h` als 0. In einem Kalender mit eigenen Bändern oder nach einem Stundenvorgang zählt der Zeitabstand genau in Stunden.
- `50%`: die Hälfte der Dauer des Vorgängers.

Beispiel: Der Fundamentbeton muss aushärten, bevor der Maurer darauf arbeiten kann. Darum erhält *Pour foundation → Foundation brickwork* eine FS-Beziehung mit Zeitabstand `3`. Wenn das Gießen am Freitag, 18. Juni 2027, stattfindet, beginnt das Mauerwerk nach **Berechnen** am Donnerstag, 24. Juni. Montag bis Mittwoch ist Wartezeit. Mit `3ed` zählt das Wochenende mit, und das Mauerwerk beginnt am Dienstag, 22. Juni.

### Zum Schluss: neu berechnen

Eine neue Beziehung verschiebt noch keine Balken. In der Statusleiste steht *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Erst dann erhalten die Nachfolger ihre neuen Datumswerte. Wenn die App das für Sie tun soll, schalten Sie *Automatisch berechnen* ein. Das finden Sie unter *Einstellungen › Projekt › App-Einstellungen*, Tab *Planung*.

## Fallstricke und was die App tut

**Umgekehrte Reihenfolge.** Bei *Ausgewählte Vorgänge verknüpfen* zählt die Reihenfolge, in der Sie klicken, nicht die Reihenfolge in der Liste. Wenn Sie zuerst den späteren Vorgang anklicken, ist die Beziehung falsch herum. Löschen Sie sie im Block *Abhängigkeiten* mit dem Papierkorb-Symbol und fügen Sie sie erneut hinzu.

**Eingeben in der Spalte überschreibt den bisherigen Inhalt.** Wenn die Zelle `3.4 FS; 3.2 FS` enthält und Sie nur `3.2 FS` eingeben, dann ist die Beziehung mit 3.4 ohne Meldung verschwunden. Geben Sie alle Vorgänger ein, verwenden Sie Enter oder F2, um Vorgänger hinzuzufügen, oder machen Sie mit Strg+Z rückgängig.

**Ein Zyklus.** Fügen Sie eine Beziehung hinzu, die zurück zu einem früheren Vorgang in der Kette führt, dann ließe sich der Terminplan nie berechnen. Die App lehnt solch eine Beziehung ab: *Diese Beziehung würde einen Zyklus im Terminplan erzeugen (…) und wurde nicht erstellt*, mit den Vorgängen des Zyklus in Klammern. Löschen Sie zuerst die Beziehung, die den Zyklus schließt.

**Vorgang mit dem eigenen Sammelvorgang.** Eine Beziehung zwischen einem Vorgang und dem Sammelvorgang, dem er untergeordnet ist, ist nicht möglich. Die App meldet: *Eine Beziehung zwischen einem Vorgang und seinem eigenen übergeordneten Sammelvorgang ist nicht zulässig.*

**Doppelt.** Existiert die Beziehung schon, meldet die App *Diese Beziehung besteht bereits* und nichts ändert sich.

**Kürzere Meldungen in der Spalte.** Die Spalte *Vorgänger* zeigt dieselben Ablehnungen mit einem kürzeren Text unter der Zelle: *Diese Änderung würde einen Zyklus im Terminplan erzeugen.*, *Diese Beziehung existiert bereits.* oder *Ein Vorgang kann keine Beziehung zu seinem eigenen Sammelvorgang haben.* Geben Sie nur eine PSP-Nummer ein, zum Beispiel `3.1`, dann fehlt der Typ, und die Zelle zeigt *Verwenden Sie zum Beispiel 1.2 FS+2d.* Die Zelle bleibt geöffnet. Korrigieren Sie die Eingabe oder drücken Sie Esc, um abzubrechen.

**Keine halben Tage beim Zeitabstand.** Ein Zeitabstand in Tagen ist immer eine ganze Zahl: `1.5` wird `+2d`. Ein Stunden-Zeitabstand nach einem Tagesvorgang in einem Kalender ohne eigene Bänder für die Arbeitszeit wird auf ganze Arbeitstage gerundet. Ungültige Eingaben, zum Beispiel ein Wort, werden nicht gespeichert. Das Feld springt zum vorigen Wert zurück.

## Siehe auch

- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was die App aus Ihren Beziehungen berechnet und warum ein Vorgang kritisch wird.
- [Beziehungen und Zeitabstand](docs://uitleg-relaties): was die vier Arten von Beziehungen und ein Zeitabstand mit den Datumswerten machen.
- [Einen Pfad nachverfolgen](docs://howto-pad-traceren): die Kette aus Vorgängern und Nachfolgern sichtbar machen.
- [Vorgangsdialog und Eigenschaftenbereich](docs://ref-taak-eigenschappen): die Felder für Beziehungen und Zeitabstand im Bereich und im Dialog.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): eine Kette aus Ende-Anfang-Beziehungen mit einer Anfang-Anfang-Beziehung (Wände und Dach, Zeitabstand von 2 Tagen) und einer Ende-Ende-Beziehung (Fliesen und Malerarbeiten, Zeitabstand von 1 Tag).
