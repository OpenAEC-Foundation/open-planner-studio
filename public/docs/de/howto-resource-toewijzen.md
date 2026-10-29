# Ressourcen mit einer Kurve zuweisen

Ziel: Setzen Sie eine Ressource auf einen Vorgang, mit Einheiten pro Tag und einer Kurve. Die Kurve legt fest, wie diese Einheiten über die Tage des Vorgangs verteilt werden.

## Wann Sie das brauchen

Sobald Sie sehen wollen, wer wo und wann arbeitet: der Maurer an der äußeren Schale der Hohlwand, der Kran an den Hohldielen. Ohne Zuweisung gibt es keine Belastung und daher auch kein Histogramm und keine Überlastung.

Zwei Begriffe. Die **Einheiten** (in der Spalte *Einheiten* im Eigenschaftenbereich, im Fenster *Zuweisen* das Feld *Einh./Tag*) geben an, wie viel von der Ressource pro Arbeitstag am Vorgang arbeitet: 1 ist ein Maurer, 2 sind zwei davon, 0,5 ist ein halber Tag. Die **Kurve** legt fest, wie die Summe aus Einheiten mal Dauer auf die Arbeitstage des Vorgangs verteilt wird. Arbeit verteilt sich selten gleichmäßig: An einer Wand ist der Anfang ruhig, die Mitte arbeitsreich und das Ende wieder ruhig.

Die äußere Schale der Hohlwand braucht 6 Arbeitstage. Mit einem Maurer und der Kurve *Gleichmäßig* ist das 1 Einheit an jedem der 6 Tage, zusammen 6. Mit der Kurve *Glockenform* sind es zusammen weiterhin 6 Einheiten, aber die Verteilung wird 0, 1, 2, 2, 1 und 0.

## Schritte

Sie können eine Ressource auf zwei Arten zuweisen. Die Ressource muss schon vorhanden sein (siehe [Ressourcen verwalten](docs://howto-resources-beheren)).

### Über das Menüband

1. Wählen Sie einen Vorgang in der Vorgangstabelle aus. Es muss ein normaler Vorgang sein, kein Meilenstein und kein Sammelvorgang.
2. Wählen Sie *Ressourcen › Zuweisung › Zuweisen ▾*.
3. Im Fenster *Zuweisen* füllen Sie *Einh./Tag* aus (Standard 1) und wählen die *Kurve* (Standard *Gleichmäßig*). Sie gelten für die Ressource, die Sie jetzt auswählen.
4. Klicken Sie auf die Ressource. Das Fenster schließt sich und die Zuweisung ist da.

Für eine zweite Ressource öffnen Sie das Fenster erneut. Ressourcen, die schon am Vorgang sind, fehlen in der Liste.

### Über den Eigenschaftenbereich

1. Wählen Sie den Vorgang aus. Der Bereich *Eigenschaften* steht rechts. Wenn Sie ihn nicht sehen, schalten Sie ihn mit *Ansicht › Bereiche › Eigenschaften* ein.
2. Wählen Sie im Block *Zuweisungen*, ganz unten, bei *Ressource zuweisen* die Ressource aus. Die Zuweisung beginnt mit 1 Einheit und der Kurve *Gleichmäßig*.
3. Ändern Sie bei jeder Zuweisung die *Einheiten* und wählen Sie dort eine andere Kurve, indem Sie auf den Namen der Ressource klicken.

So ändern Sie auch eine vorhandene Zuweisung. Mit dem Papierkorb (*Entfernen*) am Ende der Zeile nehmen Sie die Zuweisung vom Vorgang. Die Ressource selbst bleibt. Mit *Verschieben nach…* (erscheint nach einem Klick auf den Namen) verschieben Sie die Zuweisung auf einen anderen Vorgang.

### Die Kurven

- *Gleichmäßig*: jeden Tag gleich viel. Das ist der Standard und passt zu Arbeit, die jeden Tag gleich schwer ist.
- *Vorne belastet*: der Anfang ist schwerer als das Ende. Passt zu Arbeit, die mit viel Einsatz beginnt, zum Beispiel das Abstecken.
- *Hinten belastet*: das Ende ist schwerer als der Anfang. Passt zu Arbeit, die zum Abschluss hin arbeitsreicher wird.
- *Glockenform*: eine Spitze in der Mitte, mit einem ruhigen Anfang und Ende. Passt zu einer Wand, die ruhig beginnt, in der Mitte voll im Gange ist und dann ausläuft.
- *Frühe Spitze*: eine Spitze vor der Mitte. Passt zu Arbeit, die schnell auf Touren kommt.
- *Späte Spitze*: eine Spitze nach der Mitte. Passt zu Arbeit, deren arbeitsreiche Phase erst spät kommt.
- *Doppelte Spitze*: zwei Spitzen. Passt zu Arbeit mit zwei arbeitsreichen Momenten.
- *Schildkröte*: ein ruhiger Anfang und Ende mit einer breiten Spitze in der Mitte. Passt zu langer Arbeit, die sich allmählich aufbaut und wieder abklingt.

Die Kurve ändert nur die Verteilung. Die Dauer, die Termine und die Summe bleiben gleich. Sie müssen danach nicht neu berechnen. Das Histogramm passt sich sofort an. Wählen Sie *Ressourcen › Histogramm › Histogramm*, um es zu sehen. Wenn Sie einen Vorgang auswählen, zeigt das Histogramm nur die Belastung dieses Vorgangs.

## Fallstricke und was die App dann macht

**Eine Kurve kann die Spitze über Ihre Einheiten hinaus treiben.** Bei ganzen Zahlen als Einheiten rundet die App den Wert pro Tag auf ganze Einheiten. Die Summe bleibt gleich. Ein Maurer mit 1 Einheit an der äußeren Schale mit der Kurve *Glockenform* ergibt 0, 1, 2, 2, 1, 0. An den zwei mittleren Tagen sind das 2 Einheiten gegenüber *Max. Einheiten* von 1. Das Histogramm färbt diese Tage rot, und die Ressource gilt als überlastet. Wählen Sie eine andere Kurve oder verteilen Sie die Stunden selbst (siehe [Stundenverteilung anpassen](docs://howto-urenverdeling-aanpassen)). Bei Einheiten wie 0,5 rundet die App auf Hundertstel. Bei einem kurzen Vorgang mit ganzen Einheiten wird die Form daher grob: Über 10 Tage ergibt *Schildkröte* mit 1 Einheit die Verteilung 0, 1, 1, 2, 2, 1, 1, 1, 1, 0. Das ist genau wie *Frühe Spitze*.

**Kein Meilenstein und kein Sammelvorgang.** Die Schaltfläche *Zuweisen* ist dann deaktiviert. *Eigenschaften* zeigt *Zuweisungen sind bei Meilensteinen nicht möglich.* oder *Zuweisungen sind bei Sammelvorgängen nicht möglich.*

**Eine Ressource nur einmal pro Vorgang.** Ist die Ressource schon am Vorgang, fehlt sie in der Liste. Sind alle Ressourcen schon am Vorgang, meldet die App *Alle Ressourcen sind bereits zugewiesen.* Gibt es noch keine Ressource, steht dort *Legen Sie zuerst Ressourcen an (Registerkarte Ressourcen).*

**Die Einheiten müssen größer als 0 sein.** Die App nimmt einen Wert von 0 oder weniger nicht an.

**Material.** Bei einer Materialressource sind die Einheiten die Menge pro Tag, in der Einheit der Ressource, zum Beispiel m³. Material zählt nicht zur Dauer des Vorgangs.

**Eine Vorgangsart kann die Dauer anpassen.** Ist der Vorgang auf *Feste Arbeit* oder *Feste Einheiten* gesetzt, ändert eine zweite Ressource die Dauer des Vorgangs. Der Terminplan ist dann nicht mehr aktuell. Drücken Sie **Berechnen** (F5). Siehe [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels).

**Eine eigene Verteilung.** Hat die Zuweisung schon eine eigene Stundenverteilung, ist die Kurve deaktiviert und zeigt *Kontur*. Heben Sie diese Verteilung zuerst über *Stundenverteilung…* auf.

**Rückgängig machen.** Sie können das Erstellen, Ändern oder Entfernen einer Zuweisung mit *Rückgängig* (Strg+Z) zurücknehmen.

## Siehe auch

- [Stundenverteilung anpassen](docs://howto-urenverdeling-aanpassen): die Stunden pro Tag selbst einstellen.
- [Überlastung auflösen](docs://howto-overbezetting-oplossen): was Sie tun, wenn eine Ressource an einem Tag zu viel zu tun hat.
- [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels): was mit der Dauer geschieht, wenn Sie die Einheiten ändern.
- [Ressourcen-Panel](docs://ref-resourcepaneel): alle Felder und Schaltflächen des Ressourcen-Panels.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): alle fünf Ressourcentypen, sechs der acht Kurven und ein Turmdrehkran mit einer Kapazitätsstufe ab dem 30. August 2027.
