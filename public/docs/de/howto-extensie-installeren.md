# Erweiterungen installieren und verwalten

Ziel: Eine Erweiterung installieren, die Berechtigungsfrage lesen und die Erweiterung später deaktivieren oder entfernen.

## Wann Sie das brauchen

Eine Erweiterung fügt der App etwas hinzu, ohne dass Sie auf eine neue Version warten müssen. Eine Erweiterung kann zum Beispiel ein Importformat hinzufügen, das in *Datei › Importieren* erscheint, eine Schaltfläche im Menüband anbringen oder eine Schrift für den PDF-Export liefern. Der offizielle Katalog ordnet sie in Kategorien ein: *Import/Export*, *Planung*, *Berichte*, *Hilfsprogramm*, *Schriftarten* und *Sonstiges*.

Denken Sie gut nach, bevor Sie eine Erweiterung installieren. Eine Erweiterung ist Programmcode, der mit denselben Rechten läuft wie die App selbst, und die App kann das nicht einschränken. Darum fragt die App bei jeder Installation nach einer Berechtigung. Was Sie in dieser Frage sehen, wird unten erklärt.

## Schritte

### Eine Erweiterung aus dem Katalog installieren

1. Wählen Sie *Datei › Erweiterungen*.
2. Wählen Sie die Registerkarte *Durchsuchen*. Die App lädt den Katalog und zeigt dabei *Katalog wird geladen...* an. Was im Katalog steht, entscheidet die OpenAEC Foundation, die ihn pflegt. Das kann sich ändern.
3. Suchen Sie mit dem Feld *Erweiterungen suchen...* nach einer Erweiterung. Die Suche läuft über Name, Beschreibung, Autor und Tags.
4. Jede Karte zeigt Name, Version, Kategorie, Beschreibung und Autor. Klicken Sie auf *Installieren*.
5. Das Fenster *Erweiterung installieren?* öffnet sich. Lesen Sie es, und gehen Sie dann zum nächsten Schritt.
6. Klicken Sie auf *Installieren*, um fortzufahren. Mit *Nicht installieren* geschieht nichts. Esc oder ein Klick neben das Fenster gilt ebenfalls als Ablehnung. Die App zeigt dann keine Fehlermeldung.

Nach der Installation ist die Erweiterung sofort aktiv. Auf der Karte in *Durchsuchen* steht jetzt *Installiert*. Was die Erweiterung hinzufügt, sehen Sie in der App selbst: eine neue Schaltfläche im Menüband oder ein Importformat in *Datei › Importieren*. Manche Erweiterungen zeigen auch eine Meldung. Sie erkennen sie am Präfix *Erweiterung*, gefolgt vom Namen der Erweiterung.

**Tutorials.** Die Tutorials sind eine Erweiterung. Wenn Sie unter *Tutorials* in *Hilfe* die Schaltfläche *Tutorials installieren* sehen, öffnet sie *Datei › Erweiterungen* auf *Durchsuchen*. Die Frage nach dem ersten Rundgang installiert ebenfalls diese Erweiterung. Beide Wege zeigen dieselbe Berechtigungsfrage. Sie können sie ablehnen.

### Eine Erweiterung aus einer Datei installieren

Wenn Sie eine Erweiterung als Datei erhalten haben, installieren Sie sie so.

1. Wählen Sie *Datei › Erweiterungen*.
2. Klicken Sie oben rechts auf *ZIP* für eine ZIP-Datei oder auf *JS* für eine separate JavaScript-Datei.
3. Wählen Sie die Datei. Das Fenster *Erweiterung installieren?* öffnet sich, wie oben.

Eine ZIP-Datei muss eine `manifest.json` und die Hauptdatei der Erweiterung enthalten. Wenn Sie eine Erweiterung installieren, die schon installiert ist, ersetzt die neue Version die alte. Kann die App die Datei nicht installieren, zum Beispiel weil eine ZIP-Datei beschädigt ist, geschieht nichts. Die App zeigt bei ZIP und JS keine Fehlermeldung, und die Erweiterung erscheint nicht in der Liste. Der Grund steht aber im Debug-Terminal. Schalten Sie es ein mit *Einstellungen › Projekt › App-Einstellungen*, Registerkarte *Erweitert*, *Debug-Terminal aktivieren*. Öffnen Sie es dann mit der Schaltfläche *Debug-Terminal anzeigen* in der Statusleiste. Dort steht zum Beispiel *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (die App formuliert diesen technischen Text auf Niederländisch).

### Die Berechtigungsfrage lesen

Die Frage zeigt, was Sie entscheiden müssen.

- *Autor* und *Repository* sagen, wer die Erweiterung gemacht hat und wo der Quellcode steht.
- *Herkunft* sagt, woher die Datei kommt und ob sie geprüft wurde. Steht dort in Rot, dass der Download nicht verifiziert ist, dann installieren Sie nur, wenn Sie die Quelle kennen.
- *Wozu Sie Ja sagen* wiederholt, dass eine Erweiterung Programmcode ist, der mit denselben Rechten läuft wie Open Planner Studio selbst, und was das auf Ihrer Plattform bedeutet. Installieren Sie nur Erweiterungen von Autoren, denen Sie vertrauen.
- *Was diese Erweiterung zu nutzen angibt* zeigt die Berechtigungen, die der Autor angegeben hat, als kleine Etiketten. Das ist eine Angabe und keine Beschränkung. Steht dort *Nichts angegeben.*, kann die Erweiterung trotzdem die Daten Ihres Terminplans lesen und ändern.

Was die Etiketten bedeuten und wie die Texte des Fensters genau lauten, steht in [Erweiterungsberechtigungen](docs://ref-extensiepermissies).

### Deaktivieren, wieder aktivieren oder entfernen

1. Wählen Sie *Datei › Erweiterungen* und die Registerkarte *Installiert*. Jede Erweiterung hat eine Karte mit Name, Version, Kategorie, Beschreibung und Autor.
2. Mit dem Schalter auf der Karte deaktivieren Sie die Erweiterung (*Deaktivieren*) oder aktivieren sie wieder (*Aktivieren*). Bei einer deaktivierten Erweiterung verschwinden die Schaltflächen und Importformate, die sie hinzugefügt hat. Die Erweiterung bleibt aber installiert. Sie bleibt auch nach einem Neustart der App aus. Eine aktivierte Erweiterung startet beim Start der App von selbst.
3. Klicken Sie auf *Entfernen*. Die Schaltfläche wechselt zu *Bestätigen*, mit dem Hinweis *Erneut klicken, um endgültig zu entfernen*. Klicken Sie noch einmal, um die Erweiterung zu entfernen. Die App räumt auch die Einstellungen auf, die die Erweiterung gespeichert hat.

## Probleme und was die App dann tut

**Der Katalog wird nicht geladen.** Die App zeigt *Katalog konnte nicht geladen werden:* mit dem technischen Grund dahinter und die Schaltfläche *Erneut versuchen*. Das kann daran liegen, dass Sie keine Internetverbindung haben.

**Unter einer Karte im Katalog steht *Installation fehlgeschlagen*.** Der Download oder die Installation ist fehlgeschlagen, zum Beispiel weil die Prüfsumme nicht stimmte. Dann ist nichts installiert. Das ist anders als eine abgelehnte Frage: Dort gibt es keine Fehlermeldung.

**Über der Liste steht *Übersprungene Katalogeinträge: 1*.** Der Katalog enthielt einen Eintrag, den die App nicht verwenden kann. Sie können die anderen Erweiterungen wie gewohnt installieren.

**Eine Erweiterung startet nicht.** Die Karte zeigt dann eine Fehlermeldung. Zum Beispiel steht dort, dass die Erweiterung eine neuere Version von Open Planner Studio braucht (Ihre aktuelle Version wird angezeigt), oder dass der Fehler erscheint, den die Erweiterung selbst meldet. Die Erweiterung ist dann nicht aktiv. Aktualisieren Sie die App oder entfernen Sie die Erweiterung.

**Eine Karte mit *Quarantäne*.** Die App konnte die gespeicherte Erweiterung nicht verwenden. Unter dem Namen steht *Grund:* mit der Ursache. Mit *Aus dem Speicher entfernen* räumen Sie sie auf.

**Eine Erweiterung selbst schreiben.** Den Leitfaden für Erweiterungsautoren (Manifest, API, Berechtigungen) finden Sie im Repository `OpenAEC-Foundation/open-planner-studio` auf GitHub, in der Datei `docs/extensions.md`.

**Eine Erweiterung gehört nicht zu einem Projekt.** Erweiterungen werden in der App gespeichert: in der Desktop-App auf diesem Rechner, im Browser im Speicher dieses Browsers. Sie gelten für alle Ihre Projekte und sind nicht Teil Ihrer Projektdatei. Löschen Sie die Website-Daten im Browser, dann sind die Erweiterungen weg.

## Siehe auch

- [App aktualisieren](docs://howto-app-bijwerken): Eine Erweiterung kann eine neuere Version der App verlangen.
- [Erweiterungsberechtigungen](docs://ref-extensiepermissies): Was jede Berechtigung in der Installationsfrage bedeutet.
