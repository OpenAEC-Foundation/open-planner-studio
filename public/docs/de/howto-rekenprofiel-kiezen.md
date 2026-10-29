# Ein Berechnungsprofil wählen oder erstellen

Ziel: Legen Sie fest, welche Berechnungsregeln ein Projekt verwendet. Sie wählen ein eingebautes Profil oder erstellen ein eigenes Profil mit eigenen Konventionen.

## Wann Sie dies brauchen

Sie öffnen ein Projekt, das wie Primavera P6 oder Microsoft Project berechnen muss. Oder Sie wollen eine Konvention anders einstellen, als das Profil es tut. Was ein Profil ist und warum sich die Termine verschieben können, steht in [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen).

## Schritte

### Profil für ein neues Projekt wählen

1. Wählen Sie *Start › Datei › Neu*. Das Fenster *Neues Projekt* öffnet sich.
2. Wählen Sie in der Auswahlliste *Berechnungsprofil* das Profil: *Open Planner Studio*, *Primavera P6* oder *Microsoft Project*.
3. Erstellen Sie das Projekt. Die App ersetzt die Berechnungsoptionen, die Sie schon ausgefüllt hatten, durch die Standardwerte des Profils.

### Profil eines bestehenden Projekts wechseln

1. Wählen Sie *Einstellungen › Projekt › Projekteinstellungen*. Sie können auch *Datei › Projekteinstellungen* wählen.
2. Öffnen Sie im Block *Berechnungsprofil und Berechnungsoptionen* die Auswahlliste *Berechnungsprofil* und wählen Sie ein anderes Profil.
3. Klicken Sie auf **Anwenden**. Die App berechnet den Terminplan sofort neu, auch wenn *Automatisch berechnen* ausgeschaltet ist. Wenn Vorgänge verschoben wurden, sagt die App, wie viele.

Bis Sie auf *Anwenden* klicken, existiert die Änderung nur im Formular. Mit *Rückgängig* machen Sie den ganzen Wechsel in einem Schritt rückgängig. Der Wechsel ändert nur die Konventionen. Ihre Berechnungsoptionen bleiben, wie sie sind.

### Ein eigenes Profil erstellen

1. Klicken Sie im Block *Berechnungsprofil und Berechnungsoptionen* neben der Auswahlliste auf *Neues Profil*.
2. Geben Sie einen Namen ein. Die App schlägt den Namen *Kopie von* gefolgt vom Namen des gewählten Profils vor, zum Beispiel *Kopie von Open Planner Studio*.
3. Klicken Sie auf *Erstellen*. Der Teil *Konventionen dieses Profils* klappt auf.
4. Schalten Sie die Konventionen mit den Kontrollkästchen ein oder aus. Das Symbol i hinter einer Zeile zeigt die Erklärung dieser Konvention. Eine Konvention, die vom Basisprofil abweicht, bekommt die Markierung *zurück zur Basis*.
5. Klicken Sie auf **Anwenden**. Erst dann berechnet das Projekt mit dem neuen Profil.

Die drei eingebauten Profile können nicht geändert werden. Ihre Konventionen werden nur zur Information angezeigt.

### Ein eigenes Profil als Vorlage behalten

1. Geben Sie dem eigenen Profil gegebenenfalls im Feld *Name dieses eigenen Profils* einen anderen Namen.
2. Klicken Sie auf *Als Vorlage speichern*. Die App meldet, dass die Vorlage gespeichert wurde, oder warum das nicht gelungen ist.
3. In einem anderen Projekt derselben App steht die Vorlage in der Auswahlliste *Berechnungsprofil*.

Weicht das Profil später von der Vorlage ab, zeigt ein gelber Block das an. Wählen Sie dann *Vorlage aus diesem Projekt aktualisieren* oder *Aus Vorlage aktualisieren*.

Eine Vorlage löschen Sie mit *Vorlage löschen*. Die App fragt vorher nach einer Bestätigung.

## Ergebnis prüfen

- Der Block *Berechnungsprofil und Berechnungsoptionen* zeigt das gewählte Profil.
- Nach *Anwenden* meldet die App verschobene Vorgänge, zum Beispiel *Nach dem Anwenden wurden 4 Vorgänge verschoben.*
- Ein orangefarbener Block über den Berechnungsoptionen sagt, dass Ihre Berechnungsoptionen vom Standard des Profils abweichen. Das ist oft absichtlich. Wenn Sie trotzdem den Standard wollen, klicken Sie auf *Standardeinstellungen von … verwenden*.

## Fallstricke und was die App tut

**Die Termine verschieben sich.** Ein anderes Profil kann echte Termine ändern. Prüfen Sie das Ergebnis. Gefällt es Ihnen nicht, wählen Sie *Rückgängig*. Profil und Termine gehen dann zusammen zurück.

**Ein gelber Block nach Rückgängig.** Wenn Sie *Rückgängig* oder *Wiederholen* drücken, während die Projekteinstellungen offen sind, folgt der Block dem Zustand des Projekts. Hatten Sie selbst schon etwas im Block geändert, bleibt Ihre Wahl bestehen. Ein gelber Block sagt dann, dass *Anwenden* diese Wahl wieder einsetzt.

**Es können höchstens 100 Vorlagen bestehen.** Sind schon 100 vorhanden, speichert die App die Vorlage nicht und meldet das. Löschen Sie zuerst eine Vorlage. Ist der Speicher der App voll oder fehlt er, erscheint ebenfalls eine Meldung.

**Vorlagen gehören zur App, das Profil zum Projekt.** Das Projekt hat immer seine eigene Kopie des Profils. Ändern Sie die Vorlage später, ändert sich das Projekt dadurch nicht.

**Einstellungen aus einer Quelldatei.** Wenn Sie *Primavera P6* oder *Microsoft Project* für ein Projekt wählen, das aus einer anderen Datei stammt, bleiben die Einstellungen aus der Quelldatei erhalten. Hier können Sie diese nicht ändern.

## Siehe auch

- [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen): was ein Profil ist und was es mit den Terminen macht.
- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): alle Konventionen und Berechnungsoptionen auf einen Blick.
- [Den Fortschrittsmodus wählen](docs://howto-voortgangsmodus-kiezen): Retained Logic oder Progress Override, getrennt vom Profil.
