# Fortschritt aktualisieren

Ziel: Tragen Sie den aktuellen Stand der Arbeit in den Terminplan ein und lassen Sie ihn neu berechnen: welche Vorgänge abgeschlossen sind, welche laufen und wie viel noch zu tun ist.

## Wann Sie das brauchen

Sie aktualisieren den Fortschritt zu festen Zeitpunkten, zum Beispiel jeden Freitag, wenn der Bauleiter den Stand meldet. So sieht der Terminplan, was tatsächlich passiert ist, und berechnet die Restarbeit ab dem Statusdatum. Warum die App das so macht, erklärt [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang).

## Schritte

### 1. Statusdatum setzen

Das Statusdatum ist der Tag, an dem Sie den Stand feststellen. Setzen Sie es, bevor Sie den Fortschritt eingeben.

1. Gehen Sie zu *Planung › Baselines & Fortschritt › Statusdatum*.
2. Geben Sie das Datum in die drei Felder für Tag, Monat und Jahr ein (in der Reihenfolge Ihrer Datumsschreibweise), zum Beispiel 28, 06 und 2027, und drücken Sie die Eingabetaste. Die App springt selbst zum nächsten Feld.
3. Hat der Projektkalender Bänder für die Arbeitszeit (der Eintrag *Arbeitszeiten* im Fenster *Kalender*)? Dann rechnet die App in Stunden, und rechts erscheint ein Uhrzeitfeld, zum Beispiel 17:00. Geben Sie eine andere Uhrzeit ein, zum Beispiel 12:00, und drücken Sie die Eingabetaste. Leeren Sie das Uhrzeitfeld, bleibt nur das Datum übrig. Ändern Sie nur das Datum, bleibt die Uhrzeit erhalten. Die Uhrzeit folgt Ihrer Zeitschreibweise (24 oder 12 Stunden). Ohne Bänder rechnet die App in ganzen Tagen. Dann gibt es kein Uhrzeitfeld, und die Statuslinie steht am Tagesanfang.
4. Mit dem kleinen Kreuz neben dem Feld leeren Sie das Statusdatum wieder.

Wenn Sie am Freitag nach Feierabend den Stand feststellen, setzen Sie das Statusdatum auf den nächsten Arbeitstag, Montag. Die App plant die Restarbeit ab dem Anfang des Statusdatums.

Wenn Sie Fortschritt eingeben, obwohl noch kein Statusdatum gesetzt ist, setzt die App es auf heute und meldet: *Statusdatum auf heute gesetzt (…).* Setzen Sie es daher besser zuerst selbst.

### 2. Fortschritt eingeben

Wählen Sie die Methode, die zu Ihrer Situation passt. Alle Methoden ergeben dasselbe Ergebnis.

**Ein Vorgang im Eigenschaftenbereich.** Nützlich, wenn Sie einen einzelnen Vorgang aktualisieren.

1. Klicken Sie auf den Vorgang. Wenn Sie den Bereich *Eigenschaften* nicht sehen, blenden Sie ihn mit *Ansicht › Bereiche › Eigenschaften* ein.
2. Ziehen Sie den Schieberegler *Fortschritt (%)* auf den Prozentwert, der erledigt ist.
3. Füllen Sie bei Bedarf *Ist-Anfang* und *Ist-Ende* aus, auf dieselbe Weise wie beim Statusdatum. Die App berechnet das Feld *Restdauer* selbst; hier können Sie es nicht ändern.

Ein Meilenstein hat ein einziges Feld, *Ist-Datum*.

**Einen Prozentwert im Menü wählen.** Nützlich für einen schnellen Stand.

1. Klicken Sie mit der rechten Maustaste auf den Balken im Gantt.
2. Wählen Sie *Fortschritt* und dann 0%, 25%, 50%, 75% oder 100%.

**Mehrere Vorgänge in der Tabelle.** Nützlich, wenn Sie eine ganze Liste aktualisieren.

1. Klicken Sie auf das **+** rechts in der Kopfzeile der Vorgangstabelle (*Spalte hinzufügen*) und öffnen Sie die Kategorie *Fortschritt*. Fügen Sie die Spalten *Ist-Anfang*, *Ist-Ende*, *Verbleibend* und *Status* hinzu. Die Spalte *Fortschritt* steht schon auf der Registerkarte *Tabelle*.
2. Doppelklicken Sie auf eine Zelle, geben Sie den Wert ein und drücken Sie die Eingabetaste. Einen Prozentwert geben Sie als `50` oder `50%` ein, ein Datum als `25-06-2027` und eine Restdauer als `1`.
3. Drücken Sie bei *Status* nach einem Doppelklick die Eingabetaste und wählen Sie *Nicht begonnen*, *In Bearbeitung* oder *Abgeschlossen*.

Wenn Sie eine Restdauer eingeben, rechnet die App den Prozentwert zurück: Bei einem Vorgang von 2 Arbeitstagen ergibt ein Rest von 1 einen Prozentwert von 50. Ein Rest von 0 schließt den Vorgang ab. Die Spalte *Ist-Dauer* (ebenfalls in der Kategorie *Fortschritt*) funktioniert umgekehrt: Geben Sie ein, wie viel Arbeit schon erledigt ist, dann berechnet die App den Prozentwert. Bei einem Vorgang von 4 Arbeitstagen ergibt eine Ist-Dauer von 1 einen Prozentwert von 25. Wählen Sie bei *Status* *Nicht begonnen*, dann geht der Prozentwert auf 0 und die Ist-Werte verschwinden.

**Alles zu einem Vorgang im Fenster Vorgang bearbeiten.** Klicken Sie mit der rechten Maustaste auf den Vorgang und wählen Sie *Bearbeiten...*. Die Felder für den Fortschritt stehen dort auch. Sie gelten erst, wenn Sie auf *Speichern* klicken.

**Viele Vorgänge auf einmal aus einer Tabellenkalkulation.** Siehe [Fortschritt aus einer Tabellenkalkulation importieren](docs://howto-voortgang-importeren).

### 3. Den Terminplan neu berechnen

Jede Änderung am Fortschritt oder am Statusdatum macht den Terminplan veraltet: Die Statusleiste meldet *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Planung › Terminplanung › Berechnen*. Ist *Automatisch berechnen* eingeschaltet (unter *Einstellungen › Projekt › App-Einstellungen*, Registerkarte *Planung*), dann macht die App das selbst.

## Das Ergebnis prüfen

- Am Statusdatum zeigt das Gantt eine gestrichelte Linie mit dem Datum in der Kopfzeile. Bei laufenden Vorgängen wölbt sich die Linie bis zum Prozentwert im Balken. Sie schalten diese Linien über *Ansicht › Baselines & Fortschritt › Fortschrittslinie* und *Statusdatumslinie* ein oder aus.
- Der abgeschlossene Teil eines Balkens wird grau. Der restliche Teil behält seine Farbe. Ein vollständig fertiger Vorgang ist ganz grau, mit einem Häkchen vor dem Namen und ohne Pufferanzeige. Der Balken eines Sammelvorgangs wird ebenfalls bis zu seinem abgeleiteten Prozentwert grau, damit Sie je Sammelvorgang sehen, wie weit die Ausführung ist. Wenn Sie die Vorgänger oder Nachfolger eines Vorgangs anzeigen, behalten diese Balken ihre Hervorhebungsfarbe, auch wenn sie fertig sind.
- Abgeschlossene Vorgänge sind nie rot: Mit einem Statusdatum ist ein abgeschlossener Vorgang nicht kritisch.
- Sammelvorgänge zeigen einen abgeleiteten Prozentwert, und das Ende des Terminplans kann sich verschoben haben.
- Wenn Sie eine Baseline gespeichert haben, liegt der ursprüngliche Terminplan unter jedem Balken, und der Berichtstyp *Variance* zeigt die Abweichung.

## Fallstricke und was die App tut

**Ein Datum nach dem Statusdatum.** Die App lehnt einen Ist-Anfang oder ein Ist-Ende nach dem Statusdatum ab. Im Eigenschaftenbereich steht unter den Feldern *Ist-Werte dürfen nicht nach dem Statusdatum liegen*; in der Tabelle meldet die Zelle *Das Ist-Datum liegt nach dem Statusdatum.* Setzen Sie zuerst das Statusdatum auf einen späteren Tag oder korrigieren Sie das Datum.

**Ein Vorgang, der laut Terminplan erst nach dem Statusdatum beginnen würde.** Wenn Sie Fortschritt für einen Vorgang eingeben, der laut Terminplan noch nicht begonnen hätte, öffnet sich das Fenster *Ist-Anfang angeben*. Es fragt, wann der Vorgang tatsächlich begonnen hat. Der Vorschlag ist das Statusdatum. Mit *Fortschritt übernehmen* speichern Sie den Wert, mit *Abbrechen* ändert sich nichts.

**100% ohne Datum.** Wenn Sie einen Vorgang auf 100% setzen, ohne ein Ist-Ende anzugeben, wird das Ist-Ende auf das Statusdatum gesetzt, auch wenn der Vorgang früher fertig war. Tragen Sie dann das Ist-Ende selbst ein.

**Ein Prozentwert unter 100%.** Wenn Sie einen abgeschlossenen Vorgang wieder unter 100% setzen, wird das Ist-Ende geleert. Leeren Sie nur das Ist-Ende, geht der Prozentwert auf 0, und der Vorgang bleibt *In Bearbeitung*. Soll der Vorgang wieder als nicht begonnen gelten, leeren Sie auch den Ist-Anfang oder wählen Sie in der Tabelle bei *Status* *Nicht begonnen*.

**Dauer eines laufenden Vorgangs ändern.** Die erledigte Arbeit bleibt erledigt, und der Prozentwert passt sich an. Ein Vorgang von 5 Arbeitstagen mit 60%, den Sie auf 10 Arbeitstage setzen, landet bei 30%. Die App lehnt eine Dauer ab, die kürzer ist als die bereits geleistete Arbeit: *„Build inner cavity leaf“ ist bereits zu 60 % erledigt: Eine Dauer, die kürzer ist als die bereits geleistete Arbeit, ist nicht möglich. Die Dauer wurde nicht geändert.* In der Tabelle meldet die Zelle *Diese Dauer ist kürzer als die bereits geleistete Arbeit.*

**Die Restdauer wird gerundet.** Die App rundet die Restdauer auf ganze Arbeitstage. Bei einem Vorgang von 2 Arbeitstagen ergeben 50% und 75% beide einen Rest von 1 Arbeitstag.

**Ein Sammelvorgang.** Ein Sammelvorgang hat keinen eigenen Fortschritt. Im Eigenschaftenbereich steht: *Aus den Teilvorgängen abgeleitet: Ändern Sie den Fortschritt dort. Der Sammelvorgang folgt nach dem Berechnen (F5).* In der Tabelle meldet die Zelle *Der Fortschritt eines Sammelvorgangs wird aus seinen Teilvorgängen abgeleitet und kann hier nicht geändert werden.*

**Das Statusdatum später verschieben.** Die Restarbeit laufender Vorgänge beginnt am neuen Statusdatum, und Arbeit, die noch nicht begonnen hat, kann nicht vor diesem Datum liegen. Verschieben Sie das Statusdatum daher nur zusammen mit einer Aktualisierung des Fortschritts. Wenn Sie ein Statusdatum setzen, ohne Fortschritt einzugeben, wird alle Arbeit, die noch nicht begonnen hat, auf dieses Datum verschoben (außer im Profil Microsoft Project).

**Ein Fehler.** Sie können jede Änderung am Fortschritt mit Strg+Z in einem Schritt rückgängig machen.

## Siehe auch

- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): wie die App die Restarbeit und das Statusdatum berechnet, mit einem Rechenbeispiel.
- [Fortschritt aus einer Tabellenkalkulation importieren](docs://howto-voortgang-importeren): den Fortschritt für viele Vorgänge auf einmal einlesen.
- [Den Fortschrittsmodus wählen](docs://howto-voortgangsmodus-kiezen): was die App mit einem Vorgang macht, der begonnen hat, während sein Vorgänger noch läuft.
- [Eine Baseline speichern und verwalten](docs://howto-baseline-opslaan-en-beheren): den ursprünglichen Terminplan festhalten, um den Fortschritt damit zu vergleichen.
