# Eine Baseline speichern und verwalten

Ziel: Den Terminplan als Vereinbarung festhalten (eine Baseline), damit Sie später sehen, wie stark die Ausführung abweicht. Außerdem behalten, benennen, wählen und löschen Sie mehrere Baselines. -> besser: Ziel: Den Terminplan als Vereinbarung (Baseline) festhalten, um später die Abweichung der Ausführung zu sehen, und mehrere Baselines verwalten (behalten, umbenennen, auswählen, löschen).

## Wann Sie das brauchen

Sie speichern eine Baseline, wenn der Terminplan freigegeben ist und die Arbeiten noch beginnen müssen. Wird der Terminplan später formell überarbeitet, zum Beispiel nach einer Änderungsanordnung, speichern Sie eine zweite Baseline und behalten die erste. So messen Sie die Ausführung gegen die erste Vereinbarung und gegen die überarbeitete. Was eine Baseline genau festhält und wie die App die Abweichung berechnet, steht in [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang).

## Schritte

### Eine Baseline speichern

1. Drücken Sie **Berechnen** (F5), zum Beispiel über *Planung › Terminplanung › Berechnen*. Die Baseline speichert die Termine, die in diesem Moment berechnet werden.
2. Wählen Sie *Planung › Baselines & Fortschritt › Baselines verwalten…*. Das Fenster *Baselines* öffnet sich.
3. Unter *Neue Baseline speichern* steht ein Vorschlag für den Namen, zum Beispiel *Baseline 1 — (Datum von heute)*. Geben Sie einen eigenen Namen ein, den Sie später wiedererkennen, zum Beispiel *Baseline*.
4. Klicken Sie auf *Speichern*. Die Baseline steht jetzt in der Liste und ist sofort die aktive Baseline.
5. Klicken Sie auf *Schließen*.

Unter jedem Vorgangsbalken im Gantt-Diagramm liegt jetzt ein dünner Balken mit den Baseline-Terminen. Ein Meilenstein erhält eine kleine Raute. Sie schalten diese Überlagerung ein oder aus mit *Ansicht › Baselines & Fortschritt › Baseline-Overlay*.

### Die aktive Baseline wählen

Öffnen Sie *Baselines verwalten…* und wählen Sie in der Spalte *Aktiv* die Baseline, mit der Sie vergleichen möchten. Solange es Baselines gibt, ist genau eine aktiv. Die Gantt-Überlagerung, der Berichtstyp *Variance* und der *Fortschrittsbericht* verwenden sie.

### Eine Baseline umbenennen

Ändern Sie den Namen in der Liste. Die Änderung gilt sofort. Sie müssen nicht auf *Speichern* klicken.

### Eine Baseline löschen

Klicken Sie auf den kleinen Papierkorb neben der Baseline in der Liste. Wenn Sie die aktive Baseline löschen, fragt die App *Aktive Baseline löschen?*. Danach wird die neueste übrige Baseline die aktive. Gibt es keine andere, ist danach keine Baseline mehr aktiv und die Überlagerung verschwindet. Mit Strg+Z holen Sie eine gelöschte Baseline zurück. Schließen Sie zuerst das Fenster. Innerhalb eines Fensters funktioniert Strg+Z nicht.

### Abweichungen in der Vorgangstabelle

Jede Baseline hat sechs Spalten in der Vorgangstabelle. Klicken Sie rechts in der Kopfzeile der Vorgangstabelle auf das **+** (*Spalte hinzufügen*) und öffnen Sie die Kategorie *Basisplan*. Pro Baseline gibt es *Geplanter Anfang*, *Geplantes Ende*, *Dauer*, *Abweichung Anfang*, *Abweichung Ende* und *Abweichung Dauer*, mit dem Namen der Baseline davor, zum Beispiel *Baseline — Abweichung Ende*. Die Abweichungen sind in Arbeitstagen angegeben: ein Plus ist später, ein Minus ist früher. Ein Vorgang, der nicht in der Baseline ist, zeigt in diesen Spalten einen Strich (—).

## Stolperfallen und was die App macht

**Ein veralteter Terminplan.** Wenn der Terminplan veraltet ist, steht im Fenster *Terminplan ist veraltet — zuerst neu berechnen (F5)*. Das ist eine Warnung. Speichern bleibt möglich. Dann speichern Sie aber die alten Termine. Schließen Sie das Fenster, drücken Sie **Berechnen** und speichern Sie erst danach.

**Eine Baseline mit Fortschritt.** Speichern Sie eine Baseline, nachdem Sie Fortschritt erfasst haben, dann hält sie den Stand mit diesen Ist-Werten fest. Die Abweichung ist dann null und sagt nichts mehr über die Ausführung aus. Speichern Sie die Baseline, bevor die Arbeiten beginnen.

**Eine Baseline lässt sich nicht aktualisieren.** Wenn Sie die Vereinbarung überarbeiten wollen, speichern Sie eine neue Baseline. Löschen Sie die alte bei Bedarf.

**Ein ⚠ bei Dauer oder Abweichung Dauer.** Bei einem Vorgang in Stunden ist ein Tag die Arbeitszeit seines Kalenders. Hat der Kalender eigene Stunden pro Tag (zum Beispiel 8 bei Bändern von 10 Stunden, aus Primavera P6), dann zählte eine ältere Version der App die Tage anders. Eine Baseline aus dieser Version behält die alte Zahl. Ein Vorgang mit 1870 Stunden ist in dieser Baseline 233,75 Tage und jetzt 187 Tage. Die App rechnet eine solche Baseline nicht um. Die Spalten *Dauer* und *Abweichung Dauer* dieser Baseline zeigen dann ein ⚠. Zeigen Sie darauf für die Erklärung. Die Termine der Baseline sind korrekt. Speichern Sie eine neue Baseline und löschen Sie die alte bei Bedarf.

**Nur Vorgänge ohne Teilvorgänge.** Ein Sammelvorgang steht nicht in der Baseline. Er hat keinen Baseline-Balken und keine Abweichung. Der Sammelvorgang ergibt sich aus den Vorgängen darunter.

**Neue und gelöschte Vorgänge.** Ein Vorgang, den Sie nach dem Speichern hinzufügen, hat keinen Baseline-Balken. Im Variance-Bericht erscheint er als *Neu*. Ein Vorgang, den Sie löschen, erscheint als *Entfallen*.

**Projekt verschieben.** Im Fenster *Projekt verschieben…* gibt es, sobald Baselines vorhanden sind, das Kontrollkästchen *Basispläne mitverschieben*. Standardmäßig ist es aus. Die Baselines bleiben an ihrer Stelle, daher zeigt sich die Verschiebung als Abweichung. Siehe [Ein Projekt verschieben](docs://howto-project-verplaatsen).

**In der Projektdatei gespeichert.** Baselines und die Wahl der aktiven Baseline werden mit dem Projekt gespeichert. Beim Öffnen der Datei sind sie wieder da.

## Siehe auch

- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): was eine Baseline festhält und wie die Abweichung berechnet wird.
- [Ein Projekt verschieben](docs://howto-project-verplaatsen): das Kontrollkästchen *Basispläne mitverschieben*.
- [Fortschritt aktualisieren](docs://howto-voortgang-bijwerken): die Ist-Werte erfassen, mit denen Sie die Baseline vergleichen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): eine Baseline (*Baseline at start*) vor dem Start, mit Fortschritt und einem Statusdatum vom 20. Mai 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): zwei Baselines, *Contract* und *Re-baseline (variation order)*, mit Fortschritt und einem Statusdatum vom 5. Juli 2027.
