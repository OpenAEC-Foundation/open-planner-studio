# Wiederherstellung nach einem Absturz

Ziel: Sie holen Ihre Arbeit zurück, wenn die App oder Ihr Browser unerwartet beendet wurde und Sie nicht gespeichert hatten.

## Wann Sie das brauchen

Der Laptop ist ausgefallen, die App hat nicht mehr reagiert oder der Browser-Tab ist abgestürzt, und Sie hatten die letzten Änderungen noch nicht gespeichert. Sobald irgendwo eine Änderung erfolgt, legt die App im Hintergrund Wiederherstellungskopien aller offenen Projekte an, höchstens einmal alle zehn Sekunden. Diese Kopie ist von Ihrer Projektdatei getrennt. Den Unterschied zwischen Speichern und Automatisch speichern finden Sie in [Dateien und Formate](docs://uitleg-bestanden).

## Schritte

1. Starten Sie die App erneut. Im Browser laden Sie denselben Tab neu: Die Wiederherstellungskopie gehört zu genau diesem Tab.
2. Wenn die App Kopien gefunden hat, erscheint das Fenster *Nicht gespeicherte Arbeit wiederherstellen*: *Open Planner Studio wurde nicht normal beendet. Die folgenden Dokumente enthielten nicht gespeicherte Änderungen, die wiederhergestellt werden können:* Für jedes Projekt zeigt es den Namen, den Pfad der Datei, wenn das Projekt eine Datei hat (im Browser nur den Dateinamen), die Anzahl der Vorgänge und die Zeit der Kopie, zum Beispiel *21 Vorgänge* und *Gespeichert: 29. Sep. 2026, 9:41*. Die Uhrzeit richtet sich nach Ihrer Einstellung *Uhrzeitformat*. Das Fenster kann auch Projekte zeigen, die Sie nicht geändert haben.
3. Wählen Sie *Wiederherstellen*. Die App öffnet alle Projekte in der Liste, jedes in einem Tab, mit dem Stand der letzten Kopie. Mit Enter geschieht dasselbe.
4. Prüfen Sie Ihre Projekte und speichern Sie sie sofort mit Strg+S.

Wenn Sie nicht wiederherstellen möchten, haben Sie zwei Möglichkeiten. *Nicht wiederherstellen* löscht die Kopien, und das können Sie nicht rückgängig machen. Wenn Sie das Fenster mit Escape, mit dem Kreuz oder durch Klicken daneben schließen, bleiben die Kopien erhalten, und die App fragt beim nächsten Start erneut.

Das Fragezeichen oben rechts im Fenster öffnet diesen Artikel, ohne eine Auswahl zu treffen. Während Sie in der Hilfe lesen, wartet das Fenster. Wenn Sie zurückkehren, ist es wieder da, und Sie können weiterhin wiederherstellen.

## Stolperfallen und was die App dann tut

**Sie erhalten den Stand der letzten Kopie.** Was Sie in den letzten Sekunden vor dem Absturz getan haben, kann fehlen. Ein Projekt mit Änderungen wird wieder als *Nicht gespeichert* markiert. Der Verlauf von *Rückgängig* ist leer: Sie können Schritte von vor dem Absturz nicht rückgängig machen. Zoomstufe, Scrollposition und Auswahl werden neu aufgebaut.

**Auf dem Desktop behält ein wiederhergestelltes Projekt seine Datei, im Browser nicht.** Auf dem Desktop schreibt *Speichern* in die ursprüngliche Datei, mit dem wiederhergestellten Stand. Im Browser ist ein wiederhergestelltes Projekt nicht mehr mit seiner Datei verbunden: *Speichern* fragt, wohin die Datei soll. Der Schalter *Automatisch speichern* ist dann auch grau, bis Sie das Projekt einmal gespeichert haben.

**Ein Projekt in der Ansicht *Datumswerte wie erfasst* bleibt in dieser Ansicht.** Siehe [Datumswerte wie erfasst](docs://uitleg-datums-zoals-opgeslagen).

**Auf dem Desktop erscheint das Fenster nicht bei jedem Start.** Die Wiederherstellungskopien liegen im Datenordner der App, als IFC-Dateien mit einem Namen, der mit *recovery* beginnt. Wenn Sie die App auf normalem Weg beenden, löscht sie ihre eigenen Kopien. Das Fenster erscheint also nach einem unerwarteten Ende, nach einem Neustart für ein App-Update oder wenn Sie die Wiederherstellung beim letzten Start verschoben haben.

**Im Browser wird die Kopie pro Tab gespeichert.** Die Kopie liegt im Speicher des Browsers. Ein neuer Tab oder ein neues Fenster bietet die Kopien eines anderen Tabs nicht an. Kopien von Tabs, die es nicht mehr gibt, werden nach sieben Tagen gelöscht, sobald die App wieder Kopien schreibt.

**Im Browser erscheint das Fenster auch bei einem normalen Neuladen.** Das passiert auch dann, wenn Sie alles gespeichert hatten. Wenn Sie kurz vor dem Neuladen gespeichert und danach nichts geändert haben, können Sie gefahrlos *Nicht wiederherstellen* wählen: Ihre Datei ist auf dem neuesten Stand.

**Das Fenster erscheint nicht.** Dann hat die App keine Kopie gefunden. Das passiert, wenn Sie noch nichts geändert haben, wenn Sie im Browser einen neuen Tab verwenden, wenn Sie die Wiederherstellung früher mit *Nicht wiederherstellen* verworfen haben oder wenn der Absturz vor der ersten Kopie passierte. Das kann bis zu etwa zehn Sekunden nach Ihrer ersten Änderung dauern.

**Eine Kopie ist beschädigt.** Die App meldet *Wiederhergestellte Datei konnte nicht gelesen werden* mit dem Grund und bietet die anderen Projekte an. Wenn Sie *Wiederherstellen* wählen, löscht die App danach alle Kopien, auch die unlesbare. Wenn keine Kopie lesbar ist, erscheint das Fenster nicht, und die Kopien bleiben erhalten.

**Das Wiederherstellen schlägt fehl.** Die App meldet *Wiederherstellung fehlgeschlagen* mit dem Grund. Die Kopien bleiben erhalten, und die Frage kommt beim nächsten Start zurück.

**Einige Projekte können nicht geladen werden.** Die App meldet: *2 Wiederherstellungsdateien konnten nicht geladen werden und wurden übersprungen.* Bei einer Datei steht dort *1 Wiederherstellungsdatei konnte nicht geladen werden und wurde übersprungen.* Die anderen Projekte werden wiederhergestellt. Weil etwas übersprungen wurde, bleiben alle Kopien erhalten, und das Fenster kommt beim nächsten Start mit derselben Liste zurück. Wählen Sie dann *Nicht wiederherstellen*, wenn Sie bereits alles zurückbekommen haben, was möglich war.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): Speichern, Automatisch speichern und Wiederherstellung nach einem Absturz im Vergleich.
- [Automatisch speichern einschalten](docs://howto-automatisch-opslaan): Die App aktualisiert Ihre Datei selbst.
- [Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan): Nach der Wiederherstellung speichern.
- [Datumswerte wie erfasst](docs://uitleg-datums-zoals-opgeslagen): Was mit einem Projekt in dieser Ansicht passiert.
