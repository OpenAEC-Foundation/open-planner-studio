# Die Stundenverteilung anpassen

Ziel: Bei einer Zuweisung bestimmen Sie selbst, wie viel die Ressource an jedem Arbeitstag des Vorgangs arbeitet. Sie verwenden dafür keine Standardkurve.

## Wann Sie das brauchen

Eine Kurve wie *Glockenform* ist eine feste Form. Manchmal wissen Sie es besser. Der Maurer beginnt die äußere Schale des Hohlmauerwerks mit halber Leistung, weil das Gerüst noch aufgebaut wird. Danach arbeitet er Vollzeit. Oder Sie wollen eine Spitze knapp unter der Kapazität halten. Dann passen Sie die **Stundenverteilung** an.

Sie arbeiten mit **Phasen**: aufeinanderfolgende Arbeitstage, an denen die Ressource mit denselben Einheiten arbeitet. Die Verteilung ändert nur die Stunden pro Tag dieser einen Zuweisung. Die Daten des Vorgangs ändern sich nicht.

## Schritte

Das Beispiel ist die äußere Schale des Hohlmauerwerks: 6 Arbeitstage, ein Maurer, 48 Stunden.

1. Wählen Sie den Vorgang. Der Bereich *Eigenschaften* liegt rechts. Sehen Sie ihn nicht, dann schalten Sie ihn ein mit *Ansicht › Bereiche › Eigenschaften*.
2. Klicken Sie im Block *Zuweisungen* auf den Namen des Maurers. Darunter erscheinen *Kurve* und die Schaltfläche *Stundenverteilung…*. Klicken Sie auf *Stundenverteilung…*. Das Fenster *Stundenverteilung in Phasen* öffnet sich. Sie beginnen mit dem, was die App jetzt bucht: für diese äußere Schale ist das eine Phase mit 6 Tagen und 1 Einheit.
3. Wählen Sie bei Bedarf bei *Form anwenden:* einen Ausgangspunkt. Mit *Glockenform* erstellt die App fünf Phasen: 0,18 Einheiten am ersten und am letzten Tag, 0,84 am zweiten und am fünften Tag und 1,98 an den zwei mittleren Tagen. Die Summe bleibt 48 Stunden.

### Phasen anpassen

Sie können in der Tabelle oder im Streifen darüber arbeiten.

- Geben Sie in einer Phase einen anderen *Einsatz (Einh./Tag)* ein. Die Spalten *Std./Tag* und *Stunden* werden mit berechnet.
- Ändern Sie die Anzahl der *Tage* einer Phase. Die letzte Phase läuft immer bis zum Ende des Vorgangs und bekommt die übrigen Tage.
- Wählen Sie *Teilen*, um eine Phase in zwei zu teilen, zum Beispiel 6 Tage in 3 und 3. Wählen Sie *Zusammenführen*, um eine Phase mit der nächsten zusammenzuführen.
- Im Streifen ziehen Sie eine Grenze, um eine Phase zu verlängern oder zu verkürzen, ziehen die obere Kante, um den Einsatz festzulegen, und doppelklicken auf einen Tag, um eine Phase zu teilen.

### Anwenden

Wählen Sie *Anwenden*. Mit *Abbrechen* schließt sich das Fenster ohne Änderung.

Ein Beispiel. Sie wählen *Teilen*, setzen die *Tage* der ersten Phase auf 2 und den Einsatz dieser Phase auf 0,5. Die zweite Phase läuft dann 4 Tage mit Einsatz 1. Die Summe ist 2 × 0,5 × 8 + 4 × 1 × 8 = 40 Stunden.

Nach *Anwenden* wird die Kurve der Zuweisung auf *Kontur* gesetzt und deaktiviert. Die *Einheiten* bleiben unverändert. Neben dem Namen erscheint danach ein Balkendiagramm-Symbol, auch wenn die Zuweisung eingeklappt ist. Das Histogramm und die Überlastung folgen der neuen Verteilung sofort. Neu berechnen ist nicht nötig, weil sich kein Datum verschiebt.

### Die Verteilung aufheben

Hat die Zuweisung eine eigene Verteilung, hat das Fenster außerdem *Verteilung aufheben*. Damit entfernen Sie Ihre eigene Verteilung. Die App kehrt dann zu den *Einheiten* und zur Kurve zurück. Wählen Sie diese Option auch, wenn Sie die Kurve ändern wollen. Die Liste *Kurve* ist deaktiviert, solange eine eigene Verteilung besteht.

## Fallstricke und was die App dann tut

**Die Summe ändert sich dadurch.** Sie teilen die Stunden nicht zu, Sie legen sie fest. Setzen Sie eine Phase auf 0,5 statt 0,18, wird die Summe größer. Die Summe in Stunden steht unten im Fenster. Prüfen Sie sie deshalb, bevor Sie auf *Anwenden* klicken.

**Was die Einheiten danach bewirken, hängt von der Vorgangsart ab.** Bei *Feste Dauer und Einheiten* ändern andere *Einheiten* nichts an der Verteilung. Bei *Feste Dauer und Arbeit* skaliert die App die Stunden pro Tag mit den neuen Einheiten: Bei Einheiten von 2 statt 1 verdoppelt sich jeder Tag und damit auch die Summe (von 32 auf 64 Stunden). Die Dauer bleibt gleich. Bei *Feste Arbeit* ändern die Einheiten die Dauer des Vorgangs: Die Verteilung wird dann auf die neue Dauer gestaucht oder gestreckt, mit derselben Summe. Bei *Feste Einheiten* ändern die Einheiten auch die Dauer. Prüfen Sie danach die Summe unten im Fenster.

**Ändern Sie die Dauer des Vorgangs, dehnt sich die Verteilung mit.** Die Form bleibt gleich. Bei *Feste Dauer und Einheiten* und bei *Feste Einheiten* wächst die Summe im Verhältnis zur Dauer. Verdoppelt sich die Dauer eines Vorgangs mit eigener Verteilung von 4 auf 8 Arbeitstage, verdoppelt sich auch die Summe, von 32 auf 64 Stunden. Bei *Feste Dauer und Arbeit* und bei *Feste Arbeit* bleibt die Summe gleich (32 Stunden bleiben 32 Stunden), und die Einheiten sinken.

**Die Arbeit folgt der Verteilung.** *Arbeit (h)* wird zur Summe Ihrer Phasen, auch bei *Feste Arbeit*. Die Dauer des Vorgangs ändert sich dadurch nicht.

**Ungültiger Einsatz.** Ein leerer oder negativer Einsatz bekommt einen roten Rand, und *Anwenden* ist dann deaktiviert. Eine Phase mit Einsatz 0 ist erlaubt. Eine solche Phase bleibt innerhalb der Dauer des Vorgangs.

**Alles gilt für diese eine Zuweisung.** Die App sagt das selbst: *Die Verteilung ändert nur die Stunden pro Tag dieser Zuweisung; Vorgangsdaten und Teilungen bleiben, wie sie sind.* Andere Ressourcen auf demselben Vorgang behalten ihre eigene Verteilung.

**Der Kapazitätsabgleich folgt der Verteilung.** Der Kapazitätsabgleich zählt dieselben Stunden pro Tag wie das Histogramm.

**Rückgängig machen.** *Anwenden* und *Verteilung aufheben* sind je ein Schritt für *Rückgängig* (Strg+Z).

## Siehe auch

- [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen): eine Ressource einem Vorgang zuweisen und eine Kurve wählen.
- [Überlastung auflösen](docs://howto-overbezetting-oplossen): was Sie tun, wenn eine Ressource an einem Tag zu viel zu tun hat.
