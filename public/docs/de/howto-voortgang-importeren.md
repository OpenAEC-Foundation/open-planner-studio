# Fortschritt aus einer Tabelle importieren

Ziel: Übertragen Sie den Fortschritt, den das Baupersonal in einer Tabelle einträgt, in einem Schritt in den Terminplan, ohne jeden Vorgang selbst anzuklicken.

## Wann Sie das brauchen

Ein Subunternehmer oder Bauleiter hat die App nicht, meldet aber jede Woche seinen Stand: wie viel Prozent fertig ist, wann begonnen und wann beendet wurde. Sie schicken ihm ein Blatt mit Ihren Vorgängen; er trägt drei Spalten ein und schickt es zurück. Daraus liest die App pro Vorgang nur drei Werte: Fertigstellung, Ist-Anfang und Ist-Ende. Der Rest Ihres Terminplans bleibt unberührt. Was die App mit diesem Fortschritt macht, steht in [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang).

## Schritte

### 1. Statusdatum setzen und berechnen

Stellen Sie das Statusdatum ein, wie in [Aktualisieren des Fortschritts](docs://howto-voortgang-bijwerken) beschrieben. Der Bauleiter trägt Ist-Werte bis einschließlich diesem Tag ein. Ist der Terminplan veraltet, berechnet die App ihn zuerst neu, bevor das Blatt erstellt wird.

### 2. Das Blatt erstellen

Wählen Sie *Planung › Fortschritt › Fortschrittsblatt exportieren*. Dieselbe Schaltfläche steht auf den Registerkarten *Tabelle* und *Bericht*. Die App erstellt eine Excel-Datei und schlägt den Namen *(Projektname)-Fortschritt.xlsx* vor; im Browser landet die Datei in Ihren Downloads. Bevorzugen Sie eine CSV-Datei? Wählen Sie *Datei › Exportieren › Fortschrittsblatt (CSV)*. Das Excel-Blatt gibt es ebenfalls, als *Fortschrittsblatt (Excel)*.

Das Blatt hat acht Spalten. Die Spaltennamen bleiben auf Englisch, danach folgt eine kurze Anweisung in der Sprache der App:

- `OPS Task ID`, `WBS` und `Name` dienen nur dazu, den Vorgang zu erkennen. Lassen Sie sie unverändert.
- `Start` und `Finish` sind die geplanten Termine, nur zur Information. Die App schreibt sie nie zurück.
- `Completion (%)`, `Actual Start` und `Actual Finish` sind die Felder, die Sie ausfüllen.

Das Excel-Blatt ist geschützt, ohne Passwort: nur die drei Ausfüllspalten lassen sich bearbeiten. Excel prüft, ob ein Prozentwert zwischen 0 und 100 liegt und ob ein Ist-Wert ein Datum ist. Eine Phase (Sammelvorgang) ist grau markiert mit *— Sammelvorgang: nicht ausfüllen*.

### 3. Das Ausfüllen lassen

Für jeden Vorgang trägt der Bauleiter Folgendes ein:

- `Completion (%)`: 0 bis einschließlich 100. Die App liest auch Dezimalzahlen mit Komma oder Punkt ein (zum Beispiel 33,3 oder 33.3). Die Anweisung in der CSV-Datei verlangt aber weiterhin ganze Zahlen: Eine Tabellenkalkulation mit einer anderen Ländereinstellung kann 8,38 als 838 lesen.
- `Actual Start` und `Actual Finish`: in Excel als Datum in Ihrer eigenen Ländereinstellung; in der CSV-Datei als dd-mm-yyyy oder als yyyy-mm-dd.

Was leer bleibt, ändert nichts. Eine leere Zelle löscht also auch keinen vorhandenen Fortschritt; das geht nur in der App. Bei einem Vorgang, der noch nicht begonnen hat, lässt er die Zellen ganz leer.

### 4. Das Blatt einlesen

1. Wählen Sie *Planung › Fortschritt › Fortschritt aus einer Tabelle aktualisieren* (auch auf den Registerkarten *Tabelle* und *Bericht*) oder *Datei › Importieren › Fortschritt aus einer Tabelle aktualisieren*. Das Fenster *Fortschritt aus einer Tabelle aktualisieren* öffnet sich.
2. Klicken Sie auf *Datei auswählen…* und wählen Sie die ausgefüllte `.xlsx`- oder `.csv`-Datei.
3. Wenn die Datumsangaben in einer CSV-Datei mehrdeutig sind, fragt die App *Tag zuerst oder Monat zuerst?*, mit dem Datum aus Ihrer Datei in zwei Lesarten. Klicken Sie auf das richtige Datum.
4. Sie sehen nun eine Vorschau. Oben stehen vier Zähler: *Angewendet*, *Unverändert*, *Wartet auf Verknüpfung* und *Abgelehnt*. Darunter steht pro Vorgang, was sich ändert, zum Beispiel *Fertigstellung: 0% → 100%*.
5. Prüfen Sie die Vorschau und klicken Sie auf *Anwenden*. Das Fenster zeigt *Ergebnis* mit den Zählern und den Zeilen, die abgelehnt wurden, und warum. Schließen Sie das Fenster mit *Schließen*.

Sie können die Vorschau nicht überspringen. Die Schaltfläche *Anwenden* ist deaktiviert, solange es nichts anzuwenden gibt.

### 5. Den Terminplan neu berechnen

Das Einlesen berechnet den Terminplan nicht von selbst neu. Drücken Sie **Berechnen** (F5), zum Beispiel über *Planung › Terminplanung › Berechnen*, es sei denn, *Automatisch berechnen* ist aktiviert.

## Zeilen, die nicht einfach passen

Die App verknüpft jede Zeile mit einem Vorgang, zuerst über `OPS Task ID`, sonst über die PSP-Nummer.

**Verknüpfung unsicher.** Hat die App den Vorgang nur über die PSP-Nummer gefunden, steht die Zeile unter *Verknüpfung unsicher*, mit *Bestätigen* und *Ändern*. Die Zeile wird auch angewendet, wenn Sie nichts tun; prüfen Sie deshalb, ob der Vorgang stimmt. *Bestätigen* nimmt die Zeile aus dieser Liste; es ändert nichts an dem, was angewendet wird. *Ändern* lässt Sie einen anderen Vorgang wählen. Mit *Verknüpfung löschen* entfernen Sie eine Verknüpfung, die Sie selbst gemacht haben. Hinweis: Ein Blatt aus einem anderen Projekt mit denselben PSP-Nummern wird trotzdem verknüpft, unter *Verknüpfung unsicher*, und beim Klick auf *Anwenden* angewendet.

**Wartet auf Verknüpfung.** Hat die App keinen Vorgang gefunden, oder mehrere mit derselben PSP-Nummer, steht die Zeile unter *Wartet auf Verknüpfung*. Wählen Sie bei *Vorgang wählen…* den richtigen Vorgang; Sie suchen nach PSP-Nummer oder Name. Verknüpfen Sie die Zeile nicht, wird sie abgelehnt.

## Fallstricke und was die App tut

Eine Zeile, die nicht passt, wird mit einem Grund abgelehnt. Der Rest des Blatts wird normal weiter verarbeitet. Dies sind die wichtigsten Meldungen:

- *Das tatsächliche Datum liegt nach dem Stichtag.* Setzen Sie das Statusdatum später an oder korrigieren Sie das Blatt.
- *Dieser Vorgang beginnt laut Planung erst nach dem Stichtag: Tragen Sie zuerst den tatsächlichen Beginn im Blatt ein.* Die App erfindet keinen Beginn; liefern Sie ihn im Blatt.
- *Prozentwert außerhalb von 0–100. Prüfen Sie das Dezimaltrennzeichen: „8,38“ kann in einer Tabellenkalkulation mit anderer Spracheinstellung als 838 gelesen werden.*
- *Sammelvorgänge können keinen Fortschritt aus einem Blatt erhalten.* Der Fortschritt einer Phase ergibt sich aus den Vorgängen darunter.
- *Ist-Ende liegt vor tatsächlichem Start.*
- *Unlesbares Datum.* und *Unlesbarer Prozentwert.*
- *Die eingegebenen Werte widersprechen sich.* Zum Beispiel ein Ist-Ende mit einem Prozentwert unter 100.
- *Kein Vorgang für diese Zeile gefunden.* Das Blatt nennt eine Vorgangs-ID und eine PSP-Nummer, die in diesem Projekt nicht vorkommen.
- *Dieser PSP-Code kommt bei mehreren Vorgängen vor — Zeile manuell verknüpfen.*
- *Eine andere Zeile hat diesen Vorgang bereits beansprucht.* Zwei Zeilen zeigen auf denselben Vorgang.
- *Vom Planer abgelehnt.* Eine andere Ablehnung durch die Planung selbst, ohne eigene Meldung.

Wird die ganze Datei abgelehnt, erscheint eine dieser Meldungen im Fenster: *Diese Datei hat keine Spalte „OPS Task ID“ oder „PSP“, um Zeilen mit Vorgängen zu verknüpfen.*, *Diese Datei hat keine der Spalten Fertigstellung, Tatsächlicher Start oder Ist-Ende.*, *Diese Datei ist zu groß, um als Fortschrittsblatt gelesen zu werden.* (mehr als 16 MB), *Diese Datei hat zu viele Zeilen, um als Fortschrittsblatt gelesen zu werden.* (mehr als 50.000 Zeilen) oder *Diese Datei ist passwortgeschützt und kann nicht gelesen werden.* oder *Diese Datei konnte nicht als Fortschrittsblatt gelesen werden.*

**Kein Statusdatum.** Gibt es noch kein Statusdatum und wendet der Import Fortschritt an, setzt die App es auf heute und meldet das. Setzen Sie es deshalb selbst zuerst.

**Alles in einem Schritt zurücknehmen.** Das gesamte Blatt ist ein Schritt für Strg+Z.

**Nur was Sie ausfüllen.** Eine Zeile ohne Unterschied zum Terminplan zählt als *Unverändert*. Ein Vorgang ohne Zeile im Blatt bleibt, wie er war.

## Siehe auch

- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): was die App mit Ist-Werten und Prozentwerten berechnet.
- [Aktualisieren des Fortschritts](docs://howto-voortgang-bijwerken): Fortschritt direkt in der App eintragen.
