# Codes und benutzerdefinierte Felder

Ziel: Hängen Sie eigene Klassifizierungen (Aktivitätscodes, zum Beispiel *Standort*) und eigene Felder (zum Beispiel *Auftragnehmer*) an Ihre Vorgänge an.

## Wann Sie das brauchen

Neben den festen Daten eines Vorgangs (Name, Dauer, Beziehungen, …) können Sie eigene Daten hinzufügen. Wenn Sie Vorgänge nach Nordflügel und Südflügel oder nach Disziplin einteilen wollen, oder festhalten möchten, welcher Auftragnehmer einen Vorgang ausführt, erfassen Sie das selbst. Dafür gibt es zwei Wege. Der Unterschied ist wichtig.

Ein **Aktivitätscode** ist eine Klassifizierung mit einer festen Auswahlliste. Sie legen einen Codetyp an (zum Beispiel *Standort*) mit Werten (*N* für den Nordflügel, *Z* für den Südflügel). Ein Vorgang erhält höchstens einen Wert pro Codetyp.

Ein **benutzerdefiniertes Feld** (unter *Benutzerdefinierte Felder* im Fenster) ist ein freies Eingabefeld mit einem Typ: *Text*, *Zahl*, *Ganze Zahl*, *Kosten*, *Datum* oder *Ja/Nein*. Das Feld kann bei jedem Vorgang einen anderen Wert haben.

## Schritte

### Codes und Felder definieren

1. Wählen Sie *Planung › Struktur › Codes & Felder*.
2. **Codetyp anlegen.** Geben Sie unter *Neuer Codetyp (z.B. Standort)* den Namen ein und drücken Sie Enter, oder klicken Sie auf *Codetyp hinzufügen*.
3. **Werte hinzufügen.** Klicken Sie unter dem Codetyp auf *Wert hinzufügen*. Die App setzt dort einen vorläufigen Code, zum Beispiel *V1*. Ändern Sie ihn im Feld *Code* (kurz, so wie Sie ihn eintippen würden: *N*). Füllen Sie bei Bedarf eine *Beschreibung* aus (*Nordflügel*) und wählen Sie eine *Farbe*. Eine Änderung gilt, sobald Sie das Feld verlassen oder Enter drücken.
4. **Benutzerdefiniertes Feld anlegen.** Geben Sie unter *Neues Feld (z.B. Auftragnehmer)* den Namen ein, wählen Sie den Typ und klicken Sie auf *Feld hinzufügen* (oder drücken Sie Enter).

Das Fenster hat keine Schaltfläche OK. Jede Änderung gilt sofort. Den Typ eines Feldes können Sie danach nicht mehr ändern, nur den Namen. Wenn Sie einen anderen Typ wollen, legen Sie ein neues Feld an.

### Einen Code oder ein Feld bei einem Vorgang ausfüllen

Sie haben zwei Stellen dafür.

- **Im Bereich *Eigenschaften*** (oder im Fenster, das Sie mit F2 öffnen). Unten steht der Block *Codes & Felder*: eine Auswahlliste pro Codetyp und ein Eingabefeld pro Feld. Der Block erscheint erst, wenn es mindestens einen Codetyp oder ein Feld gibt.
- **Als Spalte in der Vorgangstabelle.** Klicken Sie rechts in der Kopfzeile der Tabelle auf das **+** (*Spalte hinzufügen*) und wählen Sie unter *Benutzerdefiniert* den Codetyp oder das Feld. In der Zelle eines Codetyps tippen Sie den Code ein, zum Beispiel `N`, oder wählen Sie ihn aus der Liste. Ein Code, den es nicht gibt, zeigt *Wählen Sie einen Wert aus diesem Aktivitätscode.*

### Verwenden

Sie können einen Codetyp oder ein benutzerdefiniertes Feld zum Filtern, Gruppieren und Sortieren verwenden. Sie richten das mit einem Layout ein: *Ansicht › Layout › Neues Layout*. Markieren Sie im Fenster die Teile, die das Layout erfassen soll. Mit *Speichern* erhalten Sie in *Ansicht › Layout* eine Schaltfläche, auf die Sie später erneut klicken können. Mit *Anwenden ohne Speichern* zeigen Sie es nur jetzt auf dem Bildschirm an. Beim Gruppieren landen Vorgänge ohne Wert unter *(keins)*.

Für die Balkenfarbe wählen Sie *Ansicht › Baselines & Fortschritt › Balkenfarben*, dann *Nach Kategorie* und den Codetyp. Jeder Balken erhält danach die *Farbe* seines Wertes.

## Fallstricke und was die App tut

**Löschen entfernt die Werte an den Vorgängen.** Wenn Sie einen Codetyp, einen Wert oder ein Feld über das Papierkorbsymbol löschen, fragt die App nicht nach. Die Zuweisungen an allen Vorgängen verschwinden damit. Eine Gruppierung oder Sortierung nach diesem Codetyp oder Feld entfällt ebenfalls. *Rückgängig* (Strg+Z, schließen Sie zuerst das Fenster) bringt den Codetyp, den Wert oder das Feld und die ausgefüllten Werte zurück, aber nicht die Gruppierung oder Sortierung. Die richten Sie erneut ein.

**Zwei Werte mit demselben Code.** *Wert hinzufügen* zählt ab der Anzahl der vorhandenen Werte weiter. Wenn Sie einen Wert löschen und einen hinzufügen, kann ein Code daher zweimal vorkommen. Wenn Sie diesen Code in eine Zelle der Spalte eintippen, lehnt die App ihn mit *Dieser Aktivitätscode-Wert kommt mehrfach vor. Wählen Sie ihn aus der Liste.* ab. Geben Sie jedem Wert einen eigenen Code.

**Vorlagen übernehmen Codes und Felder nicht.** Siehe [Speichern und Einfügen von PSP-Vorlagen](docs://howto-wbs-sjablonen). Wenn Sie Vorgänge in ein anderes Dokument einfügen, entfernt die App Codes und Felder, die es dort nicht gibt, und meldet das.

**Ein Datumsfeld wandert nicht mit.** Wenn Sie das ganze Projekt verschieben, behalten ausgefüllte benutzerdefinierte Felder vom Typ *Datum* ihr Datum. Die App warnt davor in der Vorschau.

## Siehe auch

- [Die Struktur anpassen](docs://howto-structuur-aanpassen): der PSP-Baum, die andere Art, Vorgänge zu ordnen.
- [Ein Projekt verschieben](docs://howto-project-verplaatsen): was mit den Terminen geschieht, wenn Sie das Projekt verschieben.
- [Ein Layout anlegen und verwenden](docs://howto-layouts-gebruiken): Gruppieren und Filtern nach einem Code oder einem benutzerdefinierten Feld.
- [Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen): einen Code oder ein benutzerdefiniertes Feld als Spalte anzeigen.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): die Aktivitätscodes *House* und *Discipline*, das benutzerdefinierte Feld *Cost estimate* und Notizen (offen und abgeschlossen).
