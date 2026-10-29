# PSP-Vorlagen speichern und einfügen

Ziel: Speichern Sie eine Phase mit ihren Teilvorgängen und deren Beziehungen als Vorlage. Fügen Sie sie später im selben oder in einem anderen Projekt wieder ein.

## Wann Sie das brauchen

Sie planen immer wieder dieselbe Art von Bauarbeit: Jedes Haus hat ein Fundament mit Erdarbeiten, Bewehrung, Betonieren und Aushärten. Statt diese Vorgänge immer wieder anzulegen und miteinander zu verknüpfen, speichern Sie die Phase einmal als **Vorlage**. Eine Vorlage ist ein Zweig Ihres PSP: ein Vorgang mit allem, was darunter hängt.

## Schritte

### Einen Zweig als Vorlage speichern

1. Bauen Sie den Zweig so auf, wie Sie ihn wiederverwenden möchten: einen Sammelvorgang mit Teilvorgängen und den Beziehungen zwischen ihnen.
2. Klicken Sie mit der rechten Maustaste auf diesen Sammelvorgang und wählen Sie *Zweig als Vorlage speichern*. Dieser Menüpunkt erscheint nur bei Vorgängen mit Teilvorgängen.

Die App meldet *Zweig als Vorlage 'Foundation' gespeichert*. Die App fragt nicht nach einem Namen: Die Vorlage erhält den Namen des obersten Vorgangs im Zweig.

### Eine Vorlage einfügen

1. Wählen Sie den Vorgang, unter dem die Vorlage stehen soll, oder wählen Sie nichts aus.
2. Wählen Sie *Planung › Struktur › Vorlagen*. Die Liste zeigt den Namen jeder Vorlage und zum Beispiel *4 Vorgänge, 2 Beziehungen*.
3. Klicken Sie auf die Vorlage.

Ist ein Vorgang ausgewählt, fügt die App die Vorlage als letzten Teilvorgang unter diesem Vorgang ein. Dieser Vorgang wird dadurch ein Sammelvorgang. Sind mehrere Vorgänge ausgewählt, zählt der Vorgang, den Sie zuerst angeklickt haben. Ist nichts ausgewählt, kommt der Zweig ans Ende der Liste, auf die oberste Ebene. Danach ist der eingefügte Zweig ausgewählt.

Alle eingefügten Vorgänge liegen am Projektstart. Der Terminplan ist damit nicht mehr aktuell. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Dann folgen die Termine aus den Beziehungen. Das Einfügen lässt sich mit einem Schritt über *Rückgängig* zurücknehmen. Das Speichern oder Löschen einer Vorlage gehört nicht dazu.

### Eine Vorlage löschen

Öffnen Sie *Planung › Struktur › Vorlagen* und klicken Sie auf den kleinen Mülleimer rechts neben der Vorlage (*Vorlage löschen*). Die App bittet nicht um eine Bestätigung.

### Was in einer Vorlage enthalten ist

Für jeden Vorgang behält eine Vorlage den Namen, die Beschreibung, die Arbeitskategorie, die Angabe, ob er ein Meilenstein ist, und die Dauer in Tagen. Von den Beziehungen behält sie jene zwischen zwei Vorgängen im Zweig, mit Typ und Zeitabstand. Ein Zeitabstand in Stunden (`4h`) wird nicht übernommen, sondern auf 0 gesetzt. Ein Zeitabstand in Arbeitstagen, Kalendertagen oder Prozent bleibt erhalten.

Alles andere bleibt zurück: Termine, Fortschritt und Ist-Werte, Zuweisungen von Ressourcen, Codes und benutzerdefinierte Felder (siehe [Codes und benutzerdefinierte Felder](docs://howto-codes-en-velden)), der Kalender, Einschränkungen und Stichtage, die Priorität, eine benutzerdefinierte Arbeitskategorie, bei einem Meilenstein die Art und das Häkchen *Verbindlich (vertraglich)* sowie Beziehungen zu Vorgängen außerhalb des Zweigs. Nach dem Einfügen geben Sie diese Angaben erneut ein: Zuweisungen, Codes, Kalender und Einschränkungen sind leer, und alle Vorgänge beginnen mit dem Projektstart.

Ein Vorgang in Stunden kommt als Tagesvorgang zurück. Seine Dauer wird in einen Bruchteil eines Arbeitstags umgerechnet. Ein Vorgang mit 5 Stunden und einem Arbeitstag von 8 Stunden wird 0,625 Tage.

## Fallstricke und was die App tut

**Vorlagen gehören nicht zum Projekt.** Die App speichert sie im Speicher der App auf diesem Gerät, nicht in der Projektdatei. Ein Kollege, der Ihre Datei öffnet, sieht Ihre Vorlagen nicht. In der Browser-Version gehört eine Vorlage zu diesem Browser. Wenn Ihre Vorlagen wichtig sind, bewahren Sie sie zusätzlich an einem anderen Ort auf: Legen Sie sie in einem Projekt ab, das Sie als Datei speichern.

**Derselbe Name kann mehrmals vorkommen.** Speichern Sie den Zweig zweimal, enthält die Liste zwei Vorlagen mit demselben Namen. Die App überschreibt nichts.

**Die Dauer des obersten Vorgangs zählt nicht.** Ein Sammelvorgang erhält seine Dauer aus seinen Teilvorgängen, sobald Sie berechnen.

**Ein Vorgang mit Zuweisungen von Ressourcen als Ziel.** Wenn Sie einen Vorgang mit Zuweisungen auswählen, der noch keine Teilvorgänge hat, und darunter eine Vorlage einfügen, lehnt die App das ab. Der Vorgang würde zu einem Sammelvorgang, und der trägt keine Zuweisungen. Der oberste Vorgang einer Vorlage hat selbst Teilvorgänge. Für die Zuweisungen gibt es dort keinen Platz. Die App meldet das und ändert nichts. Wählen Sie dann einen anderen Vorgang oder keinen als Ziel. Ein Meilenstein, der eine Vorlage erhält, verliert seine Meilensteinmarkierung. Die App zeigt dazu eine Meldung.

**Eine ungültige Beziehung in der Vorlage.** Ist eine Beziehung in der Vorlage nicht erlaubt, zum Beispiel von einem Vorgang zu seiner eigenen Phase, oder existiert sie schon, überspringt die App sie. Die App meldet, wie viele Beziehungen übersprungen wurden.

## Siehe auch

- [Struktur anpassen](docs://howto-structuur-aanpassen): verschieben Sie den eingefügten Zweig oder stufen Sie ihn tiefer.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): legen Sie Beziehungen innerhalb eines Zweigs selbst an, bevor Sie ihn speichern.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was nach dem Berechnen mit dem eingefügten Zweig geschieht.
