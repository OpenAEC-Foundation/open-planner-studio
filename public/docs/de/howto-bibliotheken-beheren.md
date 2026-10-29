# Ressourcenbibliotheken verwalten und teilen

Ziel: Erstellen und löschen Sie Ressourcenbibliotheken, nehmen Sie Kalender darin auf und exportieren oder importieren Sie eine Bibliothek, als Sicherung oder, um sie auf einem anderen Computer zu verwenden.

## Wann Sie dies brauchen

Die Bibliothek ist nicht in Ihren Projektdateien gespeichert, sondern in der App: in der Desktop-App in einer Datei auf diesem Computer, im Browser im Speicher dieses Browsers. Sie wird nicht synchronisiert. Wenn Sie die Website-Daten im Browser löschen, ist die Bibliothek weg. Exportieren Sie sie deshalb als Sicherung. Wenn ein Kollege mit denselben Kolonnen und Tarifen arbeiten möchte, geben Sie ihm die Bibliothek ebenfalls als Datei weiter. Wenn Ihre Organisation mehrere Betriebsgesellschaften mit eigenen Kolonnen hat, erstellen Sie für jede eine eigene Bibliothek. Für ein neues Projekt wählen Sie, welche Bibliothek es verwendet.

Was eine Bibliothek ist, lesen Sie in [Die Ressourcenbibliothek](docs://uitleg-resourcebibliotheek). Die Ressourcen selbst bearbeiten Sie hier nicht, sondern im Ressourcen-Panel. Siehe [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken).

## Schritte

### Öffnen Sie die Verwaltungsansicht

Wählen Sie *Datei › Bibliothek*. Links steht die Liste *Ressourcenbibliotheken*. Rechts stehen die Details der Bibliothek, die Sie anklicken: Name, die Schaltflächen und die Liste *Kalender*. Oben steht, dass Sie Ressourcen im Reiter *Ressourcen* verwalten.

### Anlegen, umbenennen und Standardbibliothek wählen

1. Klicken Sie auf das Plus-Symbol über der Liste (*Ressourcenbibliothek hinzufügen*). Eine Ressourcenbibliothek mit dem Namen *Neue Ressourcenbibliothek* wird hinzugefügt. Sie ist sofort ausgewählt.
2. Geben Sie den neuen Namen in das Namensfeld oben im rechten Bereich ein und drücken Sie die Eingabetaste, oder klicken Sie außerhalb des Feldes. Die App akzeptiert keinen leeren Namen.
3. Klicken Sie auf *Als Standard festlegen*, damit diese Bibliothek ab jetzt für neue Projekte vorausgewählt ist. Die Standardbibliothek hat in der Liste einen Stern.

### Einen Kalender in die Bibliothek aufnehmen

1. Klicken Sie unter *Kalender* auf *Aus Projekt*. Es öffnet sich eine Liste mit den Kalendern Ihres aktiven Projekts.
2. Klicken Sie auf den kleinen Pfeil hinter dem Kalender, den Sie übernehmen möchten. Über der Liste steht *Hinzugefügt.* Ein Kalender, der bereits mit dieser Bibliothek verknüpft ist, hat nach seinem Namen *bereits verknüpft*.
3. Der Kalender steht jetzt in der Liste *Kalender* der Bibliothek. Mit dem Stift (*Bearbeiten*) ändern Sie den Namen. Speichern Sie mit dem Häkchen. Der Papierkorb löscht den Kalender sofort, ohne Rückfrage. Die Kopien in den Projekten bleiben erhalten.

Nach *Kalender* steht eine Versionsnummer, zum Beispiel *v2*. Die Nummer steigt bei jeder Änderung an der Bibliothek. Ein Bibliothekskalender wird ins Projekt übernommen, wenn Sie eine Ressource zuweisen, die ihn nutzt. Sie ordnen ihn einer Ressource in *Ressourcen*, Ansicht *Bibliothek*, in der Spalte *Kalender* zu.

### Eine Bibliothek exportieren

1. Wählen Sie die Bibliothek in der Liste.
2. Klicken Sie auf *Exportieren*.
3. In der Desktop-App sowie in Chrome und Edge wählen Sie, wohin die Datei gespeichert wird. In anderen Browsern landet sie direkt im Downloads-Ordner, und die App meldet das. Die Datei heißt `bibliotheek-`, gefolgt vom Namen der Bibliothek, mit der Endung `.ifc`.

Unter den Schaltflächen steht *Der Export dient zugleich als Sicherung: Bewahren Sie die Datei an einem sicheren Ort auf.*

### Eine Bibliothek importieren

1. Klicken Sie auf *Importieren*. Das Fenster *Bibliothek importieren* öffnet sich für die Bibliothek, die Sie vorher in der Liste ausgewählt hatten.
2. Klicken Sie auf *Datei auswählen…* und wählen Sie die `.ifc`-Datei eines Exports. Enthält die Datei keine Bibliothek, steht dort *Diese IFC-Datei enthält keine Ressourcenbibliothek.*
3. Die App zeigt, was darin enthalten ist, zum Beispiel *2 Kalender, 5 Ressourcen (Version 3).*
4. Wählen Sie, was Sie damit tun möchten, siehe unten.
5. Klicken Sie auf *Hinzufügen* oder *Ersetzen*. Mit *Abbrechen* beenden Sie den Import.

Sie haben zwei Möglichkeiten:

- *Als neue Ressourcenbibliothek hinzufügen*: Die Datei wird eine eigene Bibliothek neben Ihren bestehenden. Darunter steht, unter welchem Namen, zum Beispiel *Wird hinzugefügt als „Mijn resourcebibliotheek (2)“.* Nichts geht verloren. Ihr aktives Projekt bleibt mit seiner eigenen Bibliothek verknüpft.
- *Eine bestehende Ressourcenbibliothek ersetzen*: Der gesamte Inhalt der gewählten Bibliothek wird durch den Inhalt der Datei ersetzt. Die App sagt das auch: *Der Import ersetzt den GESAMTEN Pool der gewählten Ressourcenbibliothek.* Wenn Sie zwei oder mehr Bibliotheken haben, wählen Sie unter *In Ressourcenbibliothek importieren*, welche. Ist Ihre Bibliothek neuer als die Datei, warnt die App: *Ihre lokale Bibliothek ist neuer — der Import kann Ihre Änderungen überschreiben.*

Die App schlägt selbst eine Option vor. Bei einer Datei, die die Standardbibliothek enthielt, ist *Als neue Ressourcenbibliothek hinzufügen* vorausgewählt. Existiert die Bibliothek aus der Datei bereits auf Ihrem Computer und ist sie nicht die Standardbibliothek, ist *Eine bestehende Ressourcenbibliothek ersetzen* vorausgewählt, mit genau dieser Bibliothek. Wenn Sie unsicher sind, wählen Sie *Hinzufügen*. Dabei wird nichts überschrieben.

### Eine Bibliothek löschen

1. Wählen Sie die Bibliothek in der Liste und klicken Sie auf *Ressourcenbibliothek entfernen*. Die Schaltfläche ist bei der letzten Bibliothek grau, weil immer eine bleibt.
2. Bestätigen Sie mit *Löschen*. Die Frage lautet *Diese Ressourcenbibliothek entfernen?* Sind offene Projekte damit verknüpft, steht dort *Diese Ressourcenbibliothek ist mit 1 geöffnetem Projekt verknüpft. Beim Entfernen wird dieses Projekt entkoppelt. Fortfahren?* Bei mehr Projekten steht dort dasselbe mit der Anzahl, zum Beispiel *mit 2 geöffneten Projekten verknüpft*.

Die Bibliothek ist dann gelöscht, mit allen Ressourcen und Kalendern darin. Die offenen Projekte, die sie verwendet haben, sind entkoppelt: Ihre Ressourcen bleiben als normale Projektressourcen erhalten. Exportieren Sie zuerst, wenn Sie den Inhalt behalten möchten.

### Ein Projekt zusammen mit seiner Bibliothek weitergeben

Eine Projektdatei enthält eigene Kopien der Ressourcen. Wenn Sie auch die ganze Bibliothek mitgeben möchten, gehen Sie so vor. Auch den Export selbst beschreibt [Exportieren](docs://howto-exporteren).

1. Öffnen Sie ein Projekt, das mit einer Bibliothek verknüpft ist, und wählen Sie *Datei › Exportieren*.
2. Setzen Sie ein Häkchen bei *Bibliotheksdatei zusätzlich speichern*. Das Kästchen gibt es nur bei einem verknüpften Projekt.
3. Wählen Sie die Karte *IFC* und speichern Sie die Datei. Die App fragt dann auch nach einer zweiten Datei. Sie trägt den Namen des Projekts, gefolgt von `-bibliotheek`, und enthält die Bibliothek.

Das Kästchen funktioniert nur beim IFC-Export, nicht bei den anderen Exportformaten. Ihr Kollege importiert die zweite Datei, wie oben beschrieben.

## Fallstricke und was die App dann tut

**Zwei Planer, zwei Bibliotheken.** Die App synchronisiert Bibliotheken nicht zwischen Computern. Das Importfenster zeigt dazu immer eine Warnung: *Hinweis: Bibliotheken werden nicht zwischen Rechnern synchronisiert. Arbeiten zwei Planer mit derselben Ressourcenbibliothek, können die Bibliotheken auseinanderlaufen. Teilt Ihre Organisation Kolonnen über Betriebsgesellschaften hinweg, wählen Sie bewusst eine gemeinsame Ressourcenbibliothek.*

**Ersetzen überschreibt alles.** Alles, was Sie in der gewählten Bibliothek hatten, ist verloren. Eine Änderung an der Bibliothek fällt nicht unter *Rückgängig*. Exportieren Sie zuerst, wenn Sie unsicher sind. Ihre Projekte behalten ihre Kopien. Die App aktualisiert Kopien, die es in der neuen Datei noch gibt. Kopien, die darin nicht mehr vorkommen, erhalten die Markierung *nicht mehr in der Bibliothek* und funktionieren weiter. Unterscheidet sich eine Kopie, öffnet sich das Fenster *Ressourcenbibliothek verknüpfen* (siehe [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken)).

**Einen Kalender aus der Liste löschen geschieht sofort.** Die App fragt nicht nach, bei einer Ressource dagegen schon. Das wirkt wie ein Mangel. Änderungen an Bibliotheken fallen nicht unter *Rückgängig*.

## Siehe auch

- [Die Ressourcenbibliothek](docs://uitleg-resourcebibliotheek): wie Bibliothek und Projekt zusammenhängen.
- [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken): Ressourcen verknüpfen, zuweisen und Abweichungen klären.
- [Exportieren](docs://howto-exporteren): die Exportformate, einschließlich IFC mit einer Datei für die Bibliothek.
