# Einen Bericht erstellen und drucken

Ziel: Wählen Sie einen Bericht zu Ihrem Terminplan, prüfen Sie ihn in der Vorschau und speichern Sie ihn als PDF. So können Sie ihn verteilen oder selbst drucken.

## Wann Sie das brauchen

Freitag ist die Baustellenbesprechung. Der Auftraggeber will den Terminplan auf Papier. Der Bauleiter will wissen, was in den kommenden Wochen beginnt. Der Polier will ein Blatt, auf dem nur seine eigenen Vorgänge stehen. Solche Übersichten machen Sie auf dem Reiter *Bericht*. Die App berechnet sie aus Ihrem Terminplan und zeigt sie zuerst als Vorschau. Danach exportieren Sie sie als PDF.

Die App sendet einen Bericht nicht selbst an einen Drucker. Das Ergebnis ist immer eine PDF-Datei. Sie drucken sie mit Ihrem PDF-Reader oder senden sie per E-Mail.

## Schritte

### 1. Öffnen Sie den Reiter Bericht

Wählen Sie im Menüband *Bericht* oder drücken Sie Strg+P. Strg+P öffnet diesen Reiter. Wenn Sie gerade in einem Feld schreiben, ein Dialog offen ist oder der Präsentationsmodus aktiv ist, funktioniert Strg+P nicht. Im Browser öffnet sich dann der Druckdialog des Browsers. Dieser druckt den Bildschirm, nicht den Bericht.

Links steht die Spalte *Bericht* mit der Liste *Berichtstyp*, einer Zusammenfassung und den Einstellungen. Rechts steht die Vorschau.

### 2. Wählen Sie den Berichtstyp

Die Liste *Berichtstyp* enthält elf Berichte. Wählen Sie den Bericht, der zu Ihrer Frage passt.

- *Gantt-Diagramm*: der Terminplan als Balkendiagramm, für den üblichen Terminplan zum Mitgeben.
- *Ressourcendiagramm*: dieselben Balken, aber mit einem Band pro Ressource. Für „Was macht Kolonne X?“, wenn Sie wollen, mit einem Blatt pro Kolonne.
- *Meilensteinübersicht*: alle Meilensteine mit Datum und Status.
- *Variance*: der aktuelle Terminplan neben der aktiven Baseline. Für „Wie weit weichen wir vom Plan ab?“.
- *Vorschau (Look-ahead)*: was im kommenden Zeitraum läuft oder beginnt. Die Liste für die wöchentliche Besprechung.
- *Kritisch & fast kritisch*: die Vorgänge ohne oder mit fast keinem Puffer.
- *Fortschrittsbericht*: der Stand des Projekts am Statusdatum, dem Tag, an dem Sie den Fortschritt messen.
- *Terminplan-Qualität*: eine Prüfung des Terminplans selbst auf Fehler und ungewöhnliche Werte.
- *Ressourcenauslastung*: pro Ressource und pro Woche oder Monat, was benötigt wird und was verfügbar ist.
- *Ressourcenzuweisungen*: pro Ressource die Vorgänge, denen sie zugewiesen ist.
- *PSP-Zusammenfassung*: der Terminplan verdichtet pro PSP-Ebene, für die Leitung.

### 3. Prüfen Sie, ob der Terminplan aktuell ist

Die App berechnet nicht von selbst. Wenn Sie seit der letzten Berechnung Vorgänge, Beziehungen oder Kalender geändert haben, drücken Sie **Berechnen** (F5). Die Tabellenberichte warnen Sie selbst, oben im Bericht: *Der Terminplan wurde seit der letzten Berechnung geändert — drücken Sie Berechnen (F5) für aktuelle Werte.* Oder, wenn der Terminplan noch nie berechnet wurde: *Noch nicht berechnet — drücken Sie Berechnen (F5) für Termine und Puffer.*

Das Menüband des Reiters *Bericht* hat keine Schaltfläche Berechnen, aber F5 funktioniert hier einwandfrei. *PDF exportieren* berechnet vorab ebenfalls selbst, wenn der Terminplan veraltet ist. So hinkt das PDF nie Ihrem Terminplan hinterher.

### 4. Passen Sie den Bericht an

Unter *Einstellungen* stehen die Auswahlmöglichkeiten für das Gantt-Diagramm und das Ressourcendiagramm. Vorschau (Look-ahead), Kritisch & fast kritisch, Fortschrittsbericht, Terminplan-Qualität, Ressourcenauslastung, Ressourcenzuweisungen und PSP-Zusammenfassung haben nur *Papier:* und *Ausrichtung:*. Dazu kommt ein Block *Berichtsoptionen* mit den Auswahlmöglichkeiten dieses Berichts. Die Meilensteinübersicht und die Variance haben keine eigenen Auswahlmöglichkeiten. Zum Zeitraum eines Berichts siehe [Den Berichtszeitraum wählen](docs://howto-rapportageperiode-kiezen).

- *Papier:* und *Ausrichtung:* legen das Blatt fest. Standardmäßig ist es A3 quer. Das ist praktisch für einen Bauterminplan, aber nicht jeder Drucker druckt A3. Haben Sie einen A4-Drucker, wählen Sie jetzt A4. Die App legt die Seiten dann für A4 an. Sie müssen sie später nicht verkleinern.
- Beim Ressourcendiagramm gibt das Kontrollkästchen *Jede Ressource auf einer neuen Seite* ein Blatt pro Kolonne.
- *Schriftgröße:* (90% bis 125%) macht Text und Tabelle größer oder kleiner. Eine größere Schrift lässt weniger Platz für die Zeitleiste.
- *Ansicht folgen (Filter, Gruppierung, Sortierung)* erscheint nur beim Gantt-Diagramm. Standardmäßig kommt der ganze Vorgangsbaum aufs Papier. Mit diesem Kontrollkästchen zeichnet der Bericht genau die Zeilen, die Sie auf dem Bildschirm sehen, einschließlich zugeklappter Phasen. Zum Beispiel nur die kritischen Vorgänge aus einem Layout. Wie Sie eine solche Ansicht machen, steht unter [Ein Layout erstellen und verwenden](docs://howto-layouts-gebruiken).
- *Baseline-Overlay anzeigen* zeigt die aktive Baseline neben den aktuellen Balken. Mit *Statuslinie:* wählen Sie eine *Statusdatumslinie* oder eine *Fortschrittslinie*.
- *Automatisch an Papier anpassen* ist standardmäßig aktiv. Die Zeitleiste wird dann auf die Seitenbreite skaliert, und die Anzahl Seiten ergibt sich aus der Höhe. Schalten Sie es aus, verwendet der Bericht einen festen Zoom und setzt die Seiten auch über die Breite nebeneinander. Dann entstehen schnell viele Seiten. Mit *Zeitleiste über:* verteilen Sie bei aktivem automatischem Anpassen die Zeitleiste auf 2 bis 8 Seiten in der Breite. So drucken Sie einen langen Terminplan in lesbarer Größe.

### 5. Prüfen Sie die Vorschau

Beim Gantt-Diagramm und beim Ressourcendiagramm sehen Sie das Papier mit Seitenkopf, Tabelle, Zeitleiste und Legende. Scrollen Sie durch die Seiten. *Vorschauqualität* bestimmt nur, wie scharf die Vorschau auf Ihrem Bildschirm ist. Das PDF ändert sich dadurch nicht. Steht unter den Seiten *… und 1 weitere Seite — für das vollständige Dokument exportieren* (bei mehr Seiten *… und 2 weitere Seiten — für das vollständige Dokument exportieren*), dann sind noch nicht alle Seiten der Vorschau fertig. Das PDF enthält alle Seiten.

Die anderen Berichte zeigen Sie auf dem Bildschirm als Tabelle. Was Sie sehen, steht auch so im PDF.

### 6. Als PDF exportieren

Klicken Sie unten in der linken Spalte auf **PDF exportieren**. Der vorgeschlagene Dateiname ist der Projektname, gefolgt von der Art des Berichts. Für das Gantt-Diagramm zum Beispiel *Extension house-planning.pdf*.

- In der Desktop-App und in einem Browser mit einem Speichern-Dialog für Dateien wählen Sie, wohin das PDF gespeichert wird. Schließen Sie diesen Dialog ohne zu speichern, passiert nichts.
- In einem Browser ohne diesen Dialog legt der Browser das PDF in Ihrem Downloads-Ordner ab.

### 7. Drucken Sie das PDF

Öffnen Sie das PDF in Ihrem PDF-Reader und drucken Sie es dort. Drucken Sie ein A3-PDF auf einem A4-Drucker, muss Ihr Druckdialog die Seiten verkleinern. Stellen Sie deshalb die Papiergröße zuerst in Schritt 4 ein.

## Fallstricke und was die App tut

**Die Schaltfläche Drucken und Strg+P drucken nicht.** Die Schaltfläche *Drucken* in der Gruppe *Bericht* liegt auf dem Reiter *Bericht* selbst und tut nichts extra. Strg+P öffnet diesen Reiter. Die App hat keinen eigenen Druckbefehl. Der Weg aufs Papier führt über das PDF. Funktioniert Strg+P nicht (siehe Schritt 1), öffnet sich im Browser der Druckdialog des Browsers. Dieser druckt den Bildschirm, nicht den Bericht.

**Unternehmen: Überschreiben wird nicht gespeichert.** Das Feld *Unternehmen:* des Gantt-Diagramms beginnt mit dem Unternehmen aus den Projekteinstellungen. Was Sie darüber schreiben, wird nicht gespeichert. Hier können Sie nicht in *Autor:* schreiben. Beides ändern Sie unter *Einstellungen › Projekt › Projekteinstellungen*, in den Feldern *Auftraggeber/Organisation* und *Autor*. Bestätigen Sie mit *Anwenden*.

**Balkenfarben: gilt auch für Ihren Bildschirm.** Die Auswahl *Balkenfarben:* im Bericht ist dieselbe wie *Balkenfarben* auf dem Reiter Ansicht. Ändern Sie sie im Bericht, ändert sich damit auch Ihr Gantt-Diagramm auf dem Bildschirm.

**Die Variance ohne Baseline.** Eine Baseline ist eine gespeicherte Momentaufnahme Ihres Terminplans, die Sie später als Vergleich nutzen. Wie Sie eine speichern, steht unter [Eine Baseline speichern und verwalten](docs://howto-baseline-opslaan-en-beheren). Haben Sie keine aktive Baseline, steht statt eines Vergleichs *Keine aktive Baseline — speichern Sie eine Baseline oder legen Sie eine als aktiv fest.*

**Statuslinie ohne Statusdatum.** Wählen Sie eine *Statuslinie:*, während das Projekt kein Statusdatum hat, warnt der Bericht mit *Legen Sie zuerst ein Statusdatum fest* und zeichnet nichts. Sie legen das Statusdatum fest unter *Planung › Baselines & Fortschritt › Statusdatum*.

**Der Terminplan enthält einen Zirkelbezug.** Enthält der Terminplan einen Zirkelbezug, erstellt *PDF exportieren* keine Datei und zeigt den Fehler an.

**Papier gilt zurzeit für alle Berichte.** Es gibt eine Auswahl für *Papier:* und *Ausrichtung:*, die alle Berichte teilen. Die Meilensteinübersicht und die Variance haben keine eigene Papierauswahl. Sie nutzen die Einstellung aus einem anderen Bericht, standardmäßig A3 quer. Wählen Sie das Papier deshalb zuerst in einem Bericht, der es anbietet, zum Beispiel im Gantt-Diagramm, und gehen Sie dann zurück.

**Die Einstellungen gelten für alle Projekte.** Papier, Schriftgröße, Zeitraum und die anderen Auswahlmöglichkeiten merkt sich die App auf diesem Gerät, für alle Ihre Projekte. Sie gehören nicht zur Projektdatei.

## Siehe auch

- [Den Berichtszeitraum wählen](docs://howto-rapportageperiode-kiezen): eine Vorschau oder ein Fortschrittsbericht über einen bestimmten Zeitraum.
- [Ein Layout erstellen und verwenden](docs://howto-layouts-gebruiken): erst filtern oder gruppieren, dann mit *Ansicht folgen* drucken.
- [Eine Baseline speichern und verwalten](docs://howto-baseline-opslaan-en-beheren): die Momentaufnahme, mit der die Variance vergleicht.
- [Überlastung auflösen](docs://howto-overbezetting-oplossen): was Sie tun, wenn die Ressourcenauslastung überlastete Wochen zeigt.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): warum ein Vorgang kritisch oder fast kritisch ist.
- [Berichtstypen](docs://ref-rapporttypes): alle Berichtstypen und ihre Auswahlmöglichkeiten.
