# Ein Projekt verschieben

Ziel: Der gesamte Terminplan wird auf ein neues Startdatum verschoben. Vorher sehen Sie, was das mit dem Ende macht.

## Wann Sie das brauchen

Der Beginn der Bauarbeiten verschiebt sich: Die Genehmigung kommt später, oder Sie verwenden den Terminplan eines früheren Hauses für das nächste. Jeden Vorgang einzeln zu verschieben ist viel Arbeit. Mit **Projekt verschieben** geben Sie ein neues Startdatum ein. Die App verschiebt dann alles mit.

Das Projektende verschiebt sich nicht immer um denselben Betrag wie der Projektstart. Der **Kalender** verschiebt sich nicht mit: Feiertage, Bauferien und Winterpause liegen auf festen Daten. Ein Beispiel: Mit *Start › Datei › Neu* erstellen Sie ein Projekt mit *Startdatum* 29-09-2026, *Land* auf *Niederlande* und *Bauferien* auf *Keine*. Darin legen Sie einen Terminplan mit 30 Arbeitstagen an, der am 9. November 2026 endet. Wenn Sie ihn auf den 14. Dezember 2026 verschieben, also 76 Kalendertage später, endet er am 26. Januar 2027. Das sind 78 Tage später, weil der 25. Dezember und der 1. Januar jetzt arbeitsfreie Tage in Ihrem Terminplan sind. Die Dauer bleibt 30 Arbeitstage. Die Vorschau im Fenster zeigt das, bevor Sie etwas ändern.

## Schritte

1. Wählen Sie *Planung › Terminplanung › Projekt verschieben…*. Die Schaltfläche ist deaktiviert, solange das Projekt kein Startdatum hat.
2. Unter *Aktueller Projektstart* sehen Sie, wo das Projekt jetzt beginnt, und unter *Neuer Projektstart* wählen Sie das neue Datum.
3. Wenn das Projekt Baselines hat, erscheint das Kontrollkästchen *Basispläne mitverschieben*. Lassen Sie es aus, wenn Sie die Verschiebung weiter als Abweichung sehen wollen (siehe Fallstricke).
4. Klicken Sie auf *Vorschau berechnen*. Die App berechnet den verschobenen Terminplan vollständig, ohne etwas in Ihrem Projekt zu ändern.
5. Sehen Sie sich die Vorschau an (siehe unten). Wenn sie richtig ist, klicken Sie auf *Verschieben*.

In der Vorschau sehen Sie:

- die Verschiebung in Kalendertagen (*Verschiebung: 76 Kalendertage später*);
- *Projektstart* und *Projektende*, jeweils von vorher bis nachher;
- eine rote Warnung, wenn der Kalender stört, oder die Meldung, dass die Dauer des Projekts gleich bleibt;
- die Anzahl verschobener Vorgänge und was sonst mitverschoben wird;
- Warnungen, die Sie lesen sollten (siehe Fallstricke).

Die App berechnet den neuen Terminplan sofort, daher müssen Sie den Befehl **Berechnen** (F5) nicht verwenden, und sie passt die Ansicht an das ganze Projekt an. Die gesamte Verschiebung ist ein einziger Schritt für *Rückgängig* (Strg+Z).

Die Schaltfläche *Verschieben* funktioniert nur nach einer Vorschau ohne Fehler, und wenn das neue Datum vom aktuellen abweicht. Wenn Sie das Datum oder das Kontrollkästchen ändern, verschwindet die Vorschau, und Sie berechnen erneut.

### Was mitverschoben wird und was nicht

Diese Teile verschieben sich mit: Anfang und Ende jedes Vorgangs, die Ist-Werte, die Daten der Einschränkungen (auch eines harten Pflichttermins, siehe [Einschränkungen und Stichtage](docs://uitleg-constraints)), Stichtage, das Statusdatum, die Anker der externen Beziehungen und die Verfügbarkeitsschritte der Ressourcen. Auch der Projektstart und, wenn Sie es ausgefüllt haben, das Projektende verschieben sich mit.

Diese Teile verschieben sich nicht:

- die Kalender, also Feiertage, Bauferien und Winterpause;
- Baselines, außer Sie schalten *Basispläne mitverschieben* ein;
- ein ausgefülltes benutzerdefiniertes Feld vom Typ *Datum*.

## Fallstricke und Verhalten der App

**Das Ende verschiebt sich um eine andere Anzahl Tage.** Wenn die Vorschau erkennt, dass sich das Ende um mehr oder weniger Kalendertage verschiebt als der Start, oder dass sich die Dauer des Projekts in Arbeitstagen ändert, zeigt sie eine rote Warnung mit den Zahlen. Sie können dann trotzdem abbrechen.

**Baselines bleiben an ihrem Platz.** Eine Baseline dient dazu, die Abweichung zu messen. Wenn Sie das Projekt bei ausgeschaltetem Kontrollkästchen verschieben, sehen Sie die Verschiebung als Abweichung von der Baseline. Wenn Sie das Kontrollkästchen einschalten, verschieben sich die Baselines mit dem Terminplan. Nur ihre Daten verschieben sich. Das Datum, an dem die Baseline gespeichert wurde, bleibt gleich.

**Ein laufendes Projekt.** Auch Ist-Werte verschieben sich mit. In einem Projekt, in dem Sie bereits Fortschritt erfasst haben, ist das nicht immer gewünscht. Die App warnt: *Prüfen Sie, ob das für ein laufendes Projekt richtig ist.*

**Externe Beziehungen.** Der Anker in Ihrem eigenen Projekt verschiebt sich mit, das Quellprojekt nicht. Aktualisieren Sie die externen Beziehungen nach dem Verschieben mit *Start › Vorgänge › Verknüpfen ▾ › Alle externen Beziehungen aktualisieren*. Siehe [Externe Beziehungen zu einem anderen Projekt](docs://howto-externe-relaties).

**Feiertage, die nicht weit genug reichen.** Ein Kalender mit generierten Feiertagen deckt eine Anzahl von Jahren ab. Reicht der verschobene Terminplan darüber hinaus, berechnet die App das betreffende Jahr ohne Feiertage. Die Vorschau warnt davor. Zum Beispiel steht dort: *Die generierten Feiertage des Kalenders „Bouwkalender NL“ decken 2025–2029 ab; der verschobene Terminplan läuft bis 2030. Generieren Sie die Feiertage neu.* Verschieben Sie zuerst das Projekt. Öffnen Sie dann *Planung › Kalender › Kalender*: Neben den Feiertagen erscheint jetzt die Schaltfläche *Neu generieren*. Bestätigen Sie mit *Anwenden*, dann wird der Terminplan neu berechnet. Der Zeitraum der neuen Feiertage richtet sich nach den Projektdaten. Deshalb hilft es nicht, die Feiertage schon vor dem Verschieben neu zu generieren.

**Das Datum liegt in der Vergangenheit.** Das ist erlaubt. Die Vorschau erwähnt es aber: *Das neue Startdatum liegt in der Vergangenheit.*

**Den Projektstart in den Projekteinstellungen zu ändern ist etwas anderes.** Wenn Sie das Startdatum in *Einstellungen › Projekt › Projekteinstellungen* ändern und *Anwenden* wählen, verschiebt sich der Terminplan nicht. Nur Vorgänge ohne Vorgänger oder Einschränkung, die dann vor dem neuen Start lägen, verschieben sich auf dieses Datum. Die App teilt Ihnen mit, wie viele es sind. Wenn Sie alles verschieben wollen, verwenden Sie *Projekt verschieben…*.

## Siehe auch

- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): wie der Terminplan berechnet wird und warum sich das Ende verschiebt.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): Beziehungen bleiben beim Verschieben einfach bestehen.
- [Neues Projekt und Projekteinstellungen](docs://ref-projectinfo): was das Startdatum in den Projekteinstellungen bewirkt.
