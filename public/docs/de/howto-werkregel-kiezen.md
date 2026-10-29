# Eine Vorgangsart wählen

Ziel: Legen Sie pro Vorgang fest, was die App anpasst, wenn Sie die Dauer, die Einheiten oder die Arbeit ändern: die Dauer, die Einheiten oder die Arbeit selbst.

## Wann Sie das brauchen

Sie haben einem Vorgang Ressourcen zugewiesen, und Sie wollen, dass die App so rechnet, wie Sie es tun. Ein Beispiel: Der Kran ist für einen Tag gemietet, und dieser Tag steht fest. Ein anderes Beispiel: Sie wissen, dass darin 160 Stunden Mauerwerk stecken. Sie wollen sehen, wie lange es mit drei statt zwei Personen dauert. Diese beiden Situationen brauchen eine andere Vorgangsart.

Die Vorgangsart legt fest, welche der drei Größen Dauer, Einheiten und Arbeit mitgeht, wenn Sie eine der anderen ändern. Hintergrund und Rechenbeispiele finden Sie unter [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels).

## Schritte

### Vorgangsart anzeigen

Die Vorgangsart wird standardmäßig nicht angezeigt. Schalten Sie sie einmal ein:

1. Wählen Sie *Einstellungen › Projekt › App-Einstellungen*, Registerkarte *Planung*.
2. Setzen Sie unter der Überschrift *Berechnung* ein Häkchen bei *Vorgangsarten verwenden*.
3. Schließen Sie das Fenster mit *Schließen*.

Dies ist eine Einstellung der App, nicht der Projektdatei. Enthält eine Datei schon Vorgangsarten oder gespeicherte Arbeit, etwa eine Datei aus MS Project oder Primavera P6, zeigt die App die Vorgangsart für diese Datei auch ohne diese Einstellung. Dasselbe gilt, sobald Sie selbst in einer Datei eine Vorgangsart wählen. Die Anzeige bleibt dann für diese Datei eingeschaltet, auch wenn Sie die Einstellung wieder ausschalten. Sie bleibt eingeschaltet, solange die Datei offen ist. Nach dem erneuten Öffnen bleibt sie eingeschaltet, solange die Datei eine Vorgangsart oder gespeicherte Arbeit enthält.

### Eine Vorgangsart für einen Vorgang wählen

1. Wählen Sie den Vorgang aus. Der Bereich *Eigenschaften* steht rechts. Sehen Sie ihn nicht, schalten Sie ihn mit *Ansicht › Bereiche › Eigenschaften* ein.
2. Wählen Sie bei *Vorgangsart* eine der fünf Optionen: *Projektstandard (Feste Dauer und Einheiten)*, *Feste Dauer und Einheiten*, *Feste Dauer und Arbeit*, *Feste Arbeit* oder *Feste Einheiten*. Bei *Projektstandard* folgt der Vorgang dem Standard des Projekts.
3. Möchten Sie wissen, was eine Option tut? In der geöffneten Auswahlliste hat jede Option ein i-Symbol. Zeigen Sie darauf, klicken oder tippen Sie es an, um die Erklärung zu sehen. Das Klicken auf das i-Symbol wählt diese Vorgangsart noch nicht aus.
4. Neben dem geschlossenen Feld gibt es ebenfalls ein i-Symbol. Es erklärt die Vorgangsart, die jetzt gilt, zum Beispiel *Die Dauer ergibt sich aus Arbeit und Einheiten.* Bei *Projektstandard* ist das die Vorgangsart in den Klammern.

*Projektstandard* ist die erste Wahl und die Vorgangsart, die jeder Vorgang zuerst hat. Die Vorgangsart in den Klammern ist die Vorgangsart, die das Projekt im Moment als Standard hat. Die App hat keine Schaltfläche, um diesen Projektstandard zu ändern. Er kommt aus einem Import (zum Beispiel aus MS Project oder Primavera P6) oder aus der MCP-Verbindung. Wenn Sie für einen Vorgang eine andere Vorgangsart wollen, wählen Sie sie hier.

Sie können die Vorgangsart auch in der Tabelle wählen. Klicken Sie rechts in der Kopfzeile der Vorgangstabelle auf **+** (*Spalte hinzufügen*). Wählen Sie dann unter *Planung* die Spalte *Vorgangsart*.

Ein Vorgang ohne Zuweisung hat nichts, was die Vorgangsart verbinden kann. Daher tut die Vorgangsart dort nichts. Weisen Sie zuerst eine Ressource zu (siehe [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen)).

### Arbeit sehen und ändern

Bei einem Vorgang mit Zuweisungen erscheint im Abschnitt *Zuweisungen* des Bereichs *Eigenschaften* die Spalte *Arbeit (h)*, neben *Einheiten*. Das ist die Restarbeit dieser Ressource in Stunden. Ein kleines Schloss über einer Spalte zeigt, was die Vorgangsart hält: *Einheiten* bei *Feste Dauer und Einheiten* und bei *Feste Einheiten*, *Arbeit (h)* bei *Feste Dauer und Arbeit* und bei *Feste Arbeit*.

Wenn Sie die Arbeit selbst ändern wollen, tippen Sie die Stunden in das Feld und drücken Sie die Eingabetaste. Die App akzeptiert keinen Wert von 0 oder weniger. Das Feld springt dann auf den vorherigen Wert zurück.

### Die Wirkung sehen

Wenn Sie eine Vorgangsart wählen, ändert sich noch keine Zahl. Bei einer Vorgangsart, die Arbeit schützt, legt die App nur die aktuelle Arbeit fest. Daher hat *Arbeit (h)* einen gespeicherten Wert. Erst bei der nächsten Änderung entscheidet die Vorgangsart, was mitgeht. Ändern Sie zum Beispiel *Einheiten* und sehen Sie, was mit der Dauer und der Arbeit passiert.

Ändert das die Dauer des Vorgangs, zeigt die Statusleiste *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*, um die neuen Termine zu sehen. Ist *Automatisch berechnen* aktiv (gleiche Registerkarte *Planung*, Überschrift *Berechnung*), macht die App das selbst.

## Welche Vorgangsart passt

- **Feste Dauer und Einheiten** passt, wenn die Dauer vereinbart ist und Sie die Einheiten vorgeben. Die Arbeit folgt aus diesen beiden. Das ist der Standard. Der Kran, der für einen Tag gemietet ist, gehört hierher: Der Tag steht fest, und Sie bestimmen, wie viele Krane daran arbeiten.
- **Feste Dauer und Arbeit** passt, wenn der Vorgang innerhalb einer festen Zeitspanne fertig sein muss und Sie wissen, wie viel Arbeit darin steckt. Ändert sich die Dauer, passt die App die Einheiten an.
- **Feste Arbeit** passt, wenn Sie wissen, wie viele Stunden Arbeit darin stecken, und sehen wollen, wie sich die Dauer mit der Anzahl der Personen ändert. Die 160 Stunden Mauerwerk mit drei statt zwei Personen gehören hierher. Der Putz im Übungsprojekt bekommt diese Vorgangsart.
- **Feste Einheiten** passt, wenn die Einheiten feststehen, zum Beispiel ein Kran, und die Arbeit die Dauer bestimmt.

## Fallstricke und was die App dann tut

**Das Feld *Vorgangsart* fehlt.** Dann ist die Einstellung *Vorgangsarten verwenden* aus, und die Datei hat noch keine Vorgangsarten. Oder Sie haben einen Meilenstein, eine Phase, einen Hammock oder einen Vorgang mit dem Dauertyp *Verstrichene Zeit* gewählt. Dort gibt es keine Vorgangsart. Wählen Sie einen normalen Vorgang.

**Die Dauer ändert sich, ohne dass Sie sie ändern.** Bei *Feste Arbeit* und *Feste Einheiten* folgt die Dauer aus Einheiten und Arbeit. Ändern Sie eine davon oder die Anzahl der Ressourcen, passt die App die Dauer an und rundet auf ganze Arbeitstage auf. Bei einem Vorgang in Stunden rundet die App auf ganze Minuten auf.

**Die Arbeit passt nicht genau zu Einheiten × Dauer.** Rundung kann das verursachen. Im Feld *Arbeit (h)* erscheint dann ein Warnzeichen, *Weicht von Einheiten × Dauer ab*. Das Histogramm folgt der gespeicherten Arbeit.

**Material zählt nicht.** Bei einer Materialressource zeigt *Arbeit (h)* einen Strich. Material bestimmt nie die Dauer.

**Ein Vorgang mit Fortschritt.** Die Vorgangsart wirkt nur auf die Restarbeit. Daher zeigt *Arbeit (h)* nur, was noch geschehen muss.

**Rückgängig machen.** Das Wählen einer Vorgangsart und jede Änderung, die die Vorgangsart berechnet, bilden zusammen einen Schritt für *Rückgängig* (Strg+Z). Danach ist die gewählte Vorgangsart wieder weg. Das Feld *Vorgangsart* bleibt aber sichtbar.

## Siehe auch

- [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels): wie die App Dauer, Einheiten und Arbeit miteinander verbindet, mit Rechenbeispielen.
- [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen): eine Ressource einem Vorgang zuweisen.
