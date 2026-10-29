# Stundenplanung einschalten

Ziel: Vorgänge in Arbeitszeiten planen, zusammen mit Vorgängen in Tagen.

## Wann Sie dies brauchen

Sie mieten einen Kran pro Stunde, nicht pro Tag. Eine Betonierung von sechs Stunden passt nicht in einen ganzen Arbeitstag. Ein Nachtteam arbeitet zu anderen Zeiten als das Tagesteam. Für solche Arbeit wollen Sie eine Dauer in Stunden und einen Anfang und ein Ende mit einer Uhrzeit. Sie schalten dies auch ein, wenn Sie eine Datei öffnen und die App *Diese Datei enthält stundenbasierte Planung.* meldet. Warum die App Tage und Stunden unterschiedlich zählt, lesen Sie in [Tage und Stunden](docs://uitleg-dagen-en-uren).

## Schritte

### Stundenplanung aktivieren

1. Wählen Sie *Einstellungen › Projekt › App-Einstellungen* und öffnen Sie den Tab *Planung*.
2. Setzen Sie unter *Stundenplanung* ein Häkchen bei *Stundenplanung aktivieren*. Es wirkt sofort. In der Meldung *Diese Datei enthält stundenbasierte Planung.* tut die Schaltfläche *Stundenplanung aktivieren* dasselbe.
3. Darunter steht *Gemischte Tages-/Stundenplanung zulassen*. Diese Einstellung ist standardmäßig an. Mit dieser Einstellung wählen Sie pro Vorgang, ob er in Tagen oder in Stunden zählt. Schalten Sie sie aus, dann verschwindet die Liste *Dauereinheit*. Sie können dann trotzdem eine Dauer mit einer Einheit eingeben, zum Beispiel `12h`.

Die Einstellung ändert mehr als die Dauer eines Vorgangs. Unter *Ansicht › Zeitskala* können Sie die Skala *Stunde* wählen. Im Fenster *Kalender* kann ein normaler Kalender Bänder für die Arbeitszeit erhalten (der Block *Arbeitszeiten*; ein Kalender, der schon Bänder hat, zeigt ihn immer). Im Fenster *Neues Projekt* erscheinen die Optionen *Schicht* und *Standardeinheit für neue Vorgänge*.

### Einen Vorgang in Stunden planen

1. Wählen Sie den Vorgang. Schauen Sie im Bereich *Eigenschaften*, unter *Zeit*, in das Feld *Dauer*.
2. Geben Sie die Dauer mit einer Einheit ein und drücken Sie Enter: `12h` (`12u`, die niederländische Abkürzung, funktioniert auch) für zwölf Stunden, `1h 30m` für eineinhalb Stunden. `1.5h` ist auch richtig. Eine Zahl ohne Einheit zählt in der Einheit, die der Vorgang schon hat.
3. Wenn Sie einen bestehenden Vorgang umrechnen wollen, wählen Sie die Einheit *Stunden* unter *Dauereinheit*. Die App rechnet die Dauer sofort um, zum Beispiel von `2` Tagen in `16` Stunden. Wenn Sie zurück wollen, verwenden Sie *Rückgängig*.
4. Zurück zu Tagen ist möglich mit `2d` oder mit der Einheit *Tage*.
5. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Der Vorgang hat dann einen Anfang und ein Ende, jeweils mit einer Uhrzeit.
6. Wenn Sie die Stunden im Gantt-Diagramm sehen wollen, wählen Sie die Skala *Stunde* in der Liste unter *Ansicht › Zeitskala*.

### Neue Vorgänge standardmäßig in Stunden

1. Wählen Sie *Einstellungen › Projekt › Projekteinstellungen*.
2. Wählen Sie unter *Standardeinheit für neue Vorgänge* die Einheit *Stunden* und klicken Sie auf *Anwenden*.

Ein neuer Vorgang startet dann mit 5 Stunden statt mit 5 Tagen. Bestehende Vorgänge ändern sich nicht. Bei einem neuen Projekt finden Sie dieselbe Auswahl im Fenster *Neues Projekt*. Wenn Sie dort unter *Schicht* die Option *Tagschicht* wählen, ist *Stunden* deaktiviert. Wählen Sie dann eine andere Schicht, oder stellen Sie die Standardeinheit nach dem Erstellen in *Projekteinstellungen* ein.

## Stolperfallen und was die App dann tut

**Keine gültigen Arbeitszeiten.** Wenn der Kalender des Vorgangs keine brauchbaren Arbeitszeiten hat, meldet die App *Dieser Kalender hat keine gültigen Arbeitszeiten. Prüfen Sie Arbeitstage und Arbeitszeiten.* Beim Berechnen kann die Meldung *Stundenvorgang 'name' hat in seinem Kalender keine gültigen Arbeitszeiten* erscheinen.

**Keine Dezimalzahlen bei Tagen.** Eine Dauer in Tagen ist eine ganze Zahl. `1.5d` gibt die Meldung *Geben Sie eine ganze Anzahl Tage oder Stunden ein, zum Beispiel 2d oder 12h.* Wenn Sie eineinhalb Tage wollen, rechnen Sie in Stunden.

**Eine Umrechnung, die nicht exakt möglich ist.** Zwölf Stunden passen nicht in ganze Tage zu 8 Stunden. Im Bereich *Eigenschaften* und im Fenster *Vorgang bearbeiten* zeigt die App dann einen gelben Block mit *12h ergibt in diesem Kalender keine ganzen Tage. Die Einheit wurde nicht geändert.* und lässt die Einheit unverändert. Die Vorgangstabelle gibt eine kürzere Meldung: *Diese Dauer lässt sich nicht exakt in die andere Einheit umrechnen.*

**Das Feld ist deaktiviert.** Bei einer Phase, einem Hammock oder einem Meilenstein mit Dauer null folgt die Dauer aus etwas anderem. Sie können sie dann nicht eintippen.

**Stundenplanung wieder ausschalten.** Vorgänge in Stunden bleiben erhalten und werden weiterhin berechnet. Ihre Dauer können Sie dann nicht bearbeiten. Das Feld zeigt *Aktivieren Sie die Stundenplanung, um diesen Stundenvorgang zu bearbeiten.*, mit einer Schaltfläche, um sie wieder einzuschalten.

## Siehe auch

- [Tage und Stunden](docs://uitleg-dagen-en-uren): wie die App Stunden zählt, was passiert, wenn Tage und Stunden zusammenkommen, und wo sie rundet.
- [Arbeitszeiten festlegen](docs://howto-werktijden-instellen): die Zeiten eines Kalenders pro Wochentag.
- [Beziehungen anlegen](docs://howto-relaties-leggen): ein Zeitabstand in Stunden zwischen zwei Vorgängen.
- [App-Einstellungen](docs://ref-instellingen): die Einstellung Stundenplanung aktivieren und was sie sonst ändert.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): enthält Vorgänge in Stunden (Bewehrung und Betonage) mit einem eigenen Stundenkalender, *Hourly calendar, rebar fixing & pouring*.
