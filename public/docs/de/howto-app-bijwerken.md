# Die App aktualisieren

Ziel: Sie prüfen, ob Sie die neueste Version haben. Sie aktualisieren die App und lesen, was in einer Version neu ist.

## Wann Sie das brauchen

Eine neue Version von Open Planner Studio erscheint regelmäßig. Sie möchten wissen, ob Sie sie schon haben, zum Beispiel bevor Sie einen Fehler melden oder weil eine Erweiterung eine neuere Version verlangt. Oder Sie haben gerade aktualisiert und möchten sehen, was sich geändert hat.

Die Aktualisierung funktioniert nur in der Desktop-App. Die Browser-Version hat keine Update-Funktion.

## Schritte

### Aktualisieren, wenn die App selbst eine neue Version meldet

1. Starten Sie die Desktop-App. Beim Start prüft die App im Hintergrund, ob es eine neue Version gibt. Gibt es keine neue Version oder schlägt die Prüfung fehl, zum Beispiel ohne Internet, merken Sie nichts.
2. Gibt es eine neue Version, öffnet sich das Fenster *Software-Update*. Es zeigt die *Aktuelle Version*, die *Neue Version*, die Meldung *Eine neue Version ist verfügbar* und unter *Neuerungen* den Text zu diesem Update.
3. Speichern Sie Ihre geöffneten Projekte.
4. Klicken Sie auf *Herunterladen & installieren*. Ein Fortschrittsbalken zeigt *Wird heruntergeladen…*, danach folgt die Installation. Sie können das Fenster während des Herunterladens nicht schließen.
5. Warten Sie, bis die App sich selbst neu startet. Das ist die neue Version.

Kurz bevor das Update installiert wird, legt die App außerdem eine Sicherungskopie Ihrer geöffneten Projekte an. Sie dient der Wiederherstellung nach einem Absturz, siehe [Wiederherstellung nach einem Absturz](docs://howto-herstellen-na-een-crash).

### Selbst nach einer neuen Version suchen

1. Wählen Sie *Einstellungen › Projekt › App-Einstellungen*. Sie können auch *Datei › App-Einstellungen* wählen oder das Zahnrad oben.
2. Wählen Sie die Registerkarte *Erweitert*. Unter *Version* steht die Nummer Ihrer aktuellen Version.
3. Klicken Sie auf *Nach Updates suchen*. Das Fenster *Software-Update* öffnet sich und zeigt *Wird geprüft…*. Danach steht dort *Sie verwenden die neueste Version* oder die Meldung, dass eine neue Version vorhanden ist, mit derselben Schaltfläche *Herunterladen & installieren*.

Im Browser tut diese Schaltfläche nichts Besonderes. Das Fenster zeigt sofort *Sie verwenden die neueste Version*, ohne dass die App etwas prüft.

### Lesen, was neu ist

1. Starten Sie die Desktop-App zum ersten Mal in einer anderen Version als beim letzten Mal, dann öffnet sich ein Fenster von selbst. Das Fenster heißt *Du bist auf dem neuesten Stand!* Nach einer Neuinstallation öffnet es sich nicht: Der erste Start ist kein Update. Wenn Sie es trotzdem sehen möchten, nutzen Sie die Schaltfläche *Neuerungen* (siehe unten).
2. Oben steht der Sprung von der vorherigen zur neuen Version. Mit der Schaltfläche *Neuerungen* wird nur die neue Version angezeigt.
3. Hat die App für diese Version eine Zusammenfassung eingebaut, sehen Sie einen Hauptpunkt und vier kleinere Punkte. Der Hauptpunkt kann die Schaltfläche *Anleitung lesen* haben. Sonst sehen Sie nur den Versionssprung und das, was darunter steht.
4. Mit *Vollständige Versionshinweise* öffnen Sie das Änderungsprotokoll auf GitHub. Wenn das nicht funktioniert, steht dort *Die Versionshinweise konnten nicht geöffnet werden.*
5. Unter *Dieses Update in Zahlen* stehen die Anzahl Tage seit der vorherigen Version, die Anzahl Commits und die Anzahl hinzugefügter Codezeilen. Kann die App die Größenänderung des Installationspakets ermitteln, wird auch diese angezeigt. Jede Zahl wird nur angezeigt, wenn sie verfügbar ist.
6. Klicken Sie auf *Verstanden*, um das Fenster zu schließen.

Wenn Sie dieses Fenster später noch einmal sehen möchten, wählen Sie *Einstellungen › Projekt › App-Einstellungen*, die Registerkarte *Erweitert* und unter *Version* die Schaltfläche *Neuerungen*. Dann zeigt das Fenster Ihre aktuelle Version, ohne vorherige Version.

## Stolperfallen und was die App dann tut

**Das Update schlägt fehl.** Das Fenster zeigt *Beim Aktualisieren ist etwas schiefgelaufen* mit dem technischen Grund darunter und die Schaltfläche *Erneut versuchen*.

**Sie haben die App als .deb-Paket installiert, und die Installation schlägt fehl.** Das Fenster erklärt: *Aktualisieren Sie manuell, indem Sie diesen Befehl im Terminal ausführen, oder laden Sie das neueste Paket herunter.* Unter *Installationsbefehl* steht der Befehl, mit der Schaltfläche *Befehl kopieren* (danach steht dort *Kopiert*). Mit *Download-Seite öffnen* gehen Sie zur Download-Seite der neuesten Version.

**Sie haben die App über den Snap Store.** Die App aktualisiert sich dann nicht selbst und prüft beim Start auch nicht. Das übernimmt der Snap Store. Im Fenster steht: *Diese Version wird automatisch über den Snap Store aktualisiert — Sie müssen nichts tun*

**Beim Start erscheint nichts.** Das ist normal, wenn Sie schon die neueste Version haben. Die Prüfung beim Start meldet keine Fehler. Wenn Sie sicher sein möchten, dass Sie auf dem neuesten Stand sind, prüfen Sie es selbst, wie oben beschrieben.

## Siehe auch

- [Feedback geben](docs://howto-feedback-geven): einen Fehler in der neuesten Version melden.
