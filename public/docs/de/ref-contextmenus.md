# Kontextmenüs per Rechtsklick

Welche Menüs die rechte Maustaste im Gantt-Diagramm und in der Vorgangstabelle öffnet, was jeder Eintrag tut und auf welche Vorgänge er wirkt. Die Einträge, die es auch als Schaltfläche oder Tastenkombination gibt, stehen in [Das Menüband, Reiter für Reiter](docs://ref-lint) und [Tastenkombinationen](docs://ref-sneltoetsen).

## Welches Menü wo

Es gibt vier Menüs. Welches Menü Sie sehen, hängt davon ab, wo Sie klicken:

- **Auf einem Balken im Gantt-Diagramm** — das Vorgangsmenü, mit *Beziehung von hier aus starten* oben.
- **Auf einem Vorgang in der Vorgangstabelle** — dasselbe Vorgangsmenü, ohne diesen einen Eintrag oben. Das gilt für die Vorgangstabelle links neben dem Gantt-Diagramm und für den Reiter *Tabelle*.
- **Auf einer Gruppenkopfzeile in der Vorgangstabelle** — ein kleines Menü zum Ausklappen und Einklappen von Gruppen. Gruppenkopfzeilen erscheinen nur, wenn Sie gruppieren, zum Beispiel mit dem Layout *Ressourcendiagramm*.
- **Auf leerer Fläche** — im Gantt-Diagramm neben oder unter den Balken, und in der Vorgangstabelle unter dem letzten Vorgang oder in der grauen Zeile *Neuer Vorgang*. Das Menü enthält *Neuer Vorgang*, *Meilenstein hinzufügen* und *Einfügen*; im Gantt-Diagramm außerdem *Zoom zurücksetzen* und *An Projekt anpassen*. Ein neuer Vorgang oder Meilenstein kommt unten in die Liste. Im Gantt-Diagramm beginnt er an dem Datum, auf das Sie geklickt haben. In der Vorgangstabelle öffnet sich sofort die Namenszelle, damit Sie direkt schreiben können.

Auf der Fläche einer Gruppenkopfzeile im Gantt-Diagramm öffnet die rechte Maustaste das Menü für leere Fläche. Die Gruppenkopfzeile selbst hat nur in der Vorgangstabelle ein Menü. Ein Rechtsklick auf die Zeitleiste im Kopfbereich bewirkt nichts. Die Spaltenköpfe der Vorgangstabelle haben ein eigenes Menü, das unter [Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen) beschrieben wird.

**Auf welche Vorgänge wirkt ein Eintrag?** Sie klicken auf einen Vorgang, aber die Auswahl legt den Bereich fest. Ist der Vorgang, auf den Sie klicken, Teil der Auswahl, wirkt der Eintrag auf die ganze Auswahl. Ist er das nicht, wirkt er nur auf diesen einen Vorgang. Bei einem Rechtsklick auf einen Balken im Gantt-Diagramm oder auf eine Zeile in der Vorgangstabelle ersetzt dieser Vorgang die Auswahl, wenn er nicht Teil davon war. Jeder Eintrag, der etwas ändert, ist ein Schritt in *Rückgängig*, auch bei einer ganzen Auswahl.

## Das Vorgangsmenü

Die Einträge stehen in dieser Reihenfolge. Eine Linie zwischen Gruppen ist ein Trennstrich im Menü.

**Beziehung von hier aus starten** — nur im Gantt-Diagramm, auf einem Balken. Schaltet den Beziehungsmodus mit diesem Vorgang als Auswahl ein. Danach ziehen Sie zum Nachfolger. Siehe [Beziehungen hinzufügen](docs://howto-relaties-leggen).

**Unterbrechung aufheben** und **Alle Unterbrechungen aufheben** — nur im Gantt-Diagramm, auf einem Balken mit Unterbrechungen. *Unterbrechung aufheben* erscheint nur, wenn Sie auf eine Unterbrechung oder auf das Stück danach klicken und die Unterbrechung bearbeitbar ist; es entfernt diese eine Unterbrechung. *Alle Unterbrechungen aufheben* entfernt alle, auch Unterbrechungen aus einer Quelldatei, die Sie nicht bearbeiten können. Siehe [Einen Vorgang teilen](docs://howto-taak-splitsen).

**Bearbeiten...** — öffnet das Fenster *Vorgang bearbeiten* für diesen Vorgang. Siehe [Vorgangsdialog und Eigenschaftenbereich](docs://ref-taak-eigenschappen).

**Oben einfügen** und **Unten einfügen** — fügt einen neuen Vorgang oberhalb des obersten Vorgangs oder unterhalb des untersten Vorgangs des Bereichs ein, auf derselben Ebene. Das funktioniert nur in der reinen Baumansicht, ohne Filter, Gruppierung oder Sortierung. Sonst weist die App den Befehl mit einer Meldung ab. Siehe [Vorgänge und Meilensteine hinzufügen](docs://howto-taken-en-mijlpalen-toevoegen).

**Teilvorgang hinzufügen** — fügt einen neuen Vorgang als Teilvorgang des angeklickten Vorgangs hinzu, unten bei dessen Teilvorgängen. Nur für diesen einen Vorgang, nicht für die ganze Auswahl.

**Meilenstein hinzufügen** — fügt einen Meilenstein als Teilvorgang des angeklickten Vorgangs hinzu. Nur für diesen einen Vorgang.

**Beziehung hinzufügen** — tut dasselbe wie *Beziehung von hier aus starten*: Schaltet den Beziehungsmodus mit diesem Vorgang als Auswahl ein. In der Vorgangstabelle ist der Eintrag deaktiviert, wenn das Gantt-Diagramm nicht sichtbar ist. Der Tooltip zeigt dann *Nur verfügbar, wenn das Gantt-Diagramm sichtbar ist*.

**Tiefer stufen** und **Ausrücken** — verschiebt die Vorgänge des Bereichs eine Ebene tiefer oder eine Ebene höher im PSP. Diese beiden gibt es nur in der reinen Baumansicht. Siehe [Struktur anpassen](docs://howto-structuur-aanpassen).

**Meilenstein umschalten** — macht den Vorgang zu einem Meilenstein oder wieder zu einem Vorgang. Der neue Zustand folgt aus dem angeklickten Vorgang und gilt für den ganzen Bereich: Ist dieser ein Vorgang, werden alle Vorgänge des Bereichs zu Meilensteinen. Ein Sammelvorgang und ein Vorgang mit Zuweisungen werden nicht zum Meilenstein; der Rest des Bereichs schon. Für jeden Grund erhalten Sie eine Meldung.

**Kalender zuweisen ▸** — ein Untermenü mit *Projektkalender* (der Vorgang hat dann keinen eigenen Kalender) und darunter die verfügbaren Kalender. Die aktuelle Wahl hat ein Häkchen. Ein Vorgang, der schon auf diesem Kalender liegt, zählt nicht und erzeugt keinen extra Schritt in *Rückgängig*. Siehe [Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen).

**Fortschritt ▸** — ein Untermenü mit 0%, 25%, 50%, 75% und 100%. Der aktuelle Wert hat ein Häkchen. Ein Sammelvorgang hat keinen eigenen Fortschritt: Ist er im Bereich, bekommen seine Endvorgänge den Prozentsatz. Ohne Statusdatum setzt die App es auf heute, mit einer Meldung. Ein Vorgang, dessen geplanter Anfang erst nach dem Statusdatum liegt und der noch keinen Ist-Anfang hat, führt zuerst zu einer Frage nach dem Ist-Anfang. Brechen Sie sie ab, ändert sich nichts. Siehe [Fortschritt aktualisieren](docs://howto-voortgang-bijwerken).

**Priorität ▸** — ein Untermenü mit *Niedrig* (100), *Normal* (500) und *Hoch* (900), die Priorität des Vorgangs beim Kapazitätsabgleich. Der aktuelle Wert hat ein Häkchen. Siehe [Kapazitätsabgleich](docs://uitleg-nivelleren).

**Pfad verfolgen** — zeigt die Vorgänger und Nachfolger dieses Vorgangs. Ist die Pfadverfolgung schon aktiv, heißt der Eintrag *Pfadverfolgung beenden*. Siehe [Einen Pfad verfolgen](docs://howto-pad-traceren).

**Einklappen**, **Ausklappen** und **Zweig als Vorlage speichern** — nur für einen Sammelvorgang. *Einklappen* und *Ausklappen* stehen immer beide da, auch wenn der Vorgang schon eingeklappt oder ausgeklappt ist, und gelten für den ganzen Bereich. *Zweig als Vorlage speichern* speichert den Vorgang mit seinen Teilvorgängen und den Beziehungen zwischen ihnen als PSP-Vorlage. Siehe [PSP-Vorlagen speichern und einfügen](docs://howto-wbs-sjablonen).

**Löschen** — löscht die Vorgänge des Bereichs mit ihren Teilvorgängen. Es gibt keine Bestätigung. Mit Strg+Z holen Sie sie zurück, ein Schritt für den ganzen Bereich. Siehe [Vorgänge auswählen, löschen und rückgängig machen](docs://howto-taken-selecteren-verwijderen).

## Das Menü einer Gruppenkopfzeile

Dieses Menü gibt es nur in der Vorgangstabelle, auf einer Gruppenkopfzeile:

**Gruppe einklappen** oder **Gruppe ausklappen** — klappt nur diese Gruppe ein oder aus. Der Eintrag zeigt, was Sie tun können.

**Alle ausklappen** und **Alle einklappen** — klappt alle Gruppen auf einmal aus oder ein.

Gruppierung richten Sie mit einem Layout ein. Siehe [Ein Layout erstellen und verwenden](docs://howto-layouts-gebruiken).

## Siehe auch

- [Ziehen, verschieben und zoomen im Gantt-Diagramm](docs://howto-gantt-bedienen): was Ziehen mit der linken und mittleren Maustaste bewirkt.
- [Das Menüband, Reiter für Reiter](docs://ref-lint): die Schaltflächen mit denselben Aktionen.
- [Tastenkombinationen](docs://ref-sneltoetsen): die Tasten, die dazugehören.
