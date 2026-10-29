# Vorgangsarten: Dauer, Einheiten und Arbeit

Sie setzen einen Gipser auf das Verputzen, und der Vorgang dauert vier Arbeitstage. Wenn Sie einen zweiten Gipser hinzufügen, kann die Arbeit in zwei Tagen erledigt sein. Die Arbeit kann aber auch vier Tage dauern, mit doppelt so viel Arbeit darin. Beides ist sinnvoll. Welche der beiden Möglichkeiten die App wählt, hängt von der **Vorgangsart** des Vorgangs ab. In diesem Artikel lesen Sie, wie die App Dauer, Einheiten und Arbeit miteinander verbindet und was jede Vorgangsart konstant hält.

## Das Konzept

Drei Größen hängen zusammen:

- **Dauer**: wie lange der Vorgang läuft, in Arbeitstagen oder in Stunden.
- **Einheiten**: wie viel von einer Ressource pro Arbeitstag an dem Vorgang arbeitet. Im Bereich *Eigenschaften* heißt das *Einheiten*, in anderen Fenstern *Einh./Tag*. Einheiten von 1 bedeuten einen Gipser für den ganzen Tag, 2 bedeutet zwei davon und 0,5 bedeutet einen halben Tag.
- **Arbeit**: die Gesamtzahl der Stunden, die die Ressource an dem Vorgang arbeitet.

Die Formel lautet: Arbeit = Dauer × Einheiten × Stunden pro Arbeitstag. Die Stunden pro Arbeitstag kommen aus dem Kalender des Vorgangs. Das Verputzen von vier Arbeitstagen mit einem Gipser ergibt bei einem Arbeitstag von 8 Stunden 4 × 1 × 8 = 32 Stunden Arbeit.

Wenn Sie eine der drei Größen ändern, muss sich mindestens eine der beiden anderen mitbewegen. Sonst stimmt die Formel nicht mehr. Die Vorgangsart entscheidet, welche es ist. Sie legen sie pro Vorgang im Bereich *Eigenschaften* fest. Die App zeigt die Vorgangsart und die Arbeit erst, wenn Sie diese einschalten. Wie das funktioniert, steht in [Eine Vorgangsart wählen](docs://howto-werkregel-kiezen).

Eine Vorgangsart gilt nur für normale Vorgänge. Meilensteine, Phasen (Sammelvorgänge), Hammocks und Vorgänge, deren *Dauertyp* *Verstrichene Zeit* ist, haben keine. Das Feld *Vorgangsart* fehlt dort. Material, zum Beispiel Beton oder Putzmörtel, zählt auch nicht. Die Materialmenge bestimmt nie die Dauer, und die App passt sie wegen einer Vorgangsart nie an.

## Wie die App berechnet

### Die Vorgangsart wirkt auf das, was Sie ändern

Die App berechnet Dauer, Einheiten und Arbeit nur in dem Moment neu, in dem Sie eine davon ändern: die Dauer des Vorgangs, die Einheiten einer Zuweisung, die Arbeit, eine Ressource, die hinzukommt oder wegfällt, oder die Stunden pro Tag in einem Kalender. **Berechnen** (F5) ändert keine davon: F5 berechnet nur die Termine. Eine Vorgangsart zu wählen ändert ebenfalls keine einzige Zahl. Die Vorgangsart wirkt bei Ihrer nächsten Änderung.

Wenn eine Vorgangsart die Dauer des Vorgangs ändert, ist der Terminplan nicht mehr aktuell. Die Statusleiste zeigt dann *Veraltet — neu berechnen (F5)*, es sei denn, *Automatisch berechnen* ist eingeschaltet.

### Vier Vorgangsarten

Im Bereich *Eigenschaften* steht neben der Auswahlliste *Vorgangsart* ein i-Symbol. Bewegen Sie den Mauszeiger darauf, oder klicken bzw. tippen Sie darauf. Dann erklärt die App die Vorgangsart, die jetzt gilt. In der geöffneten Auswahlliste hat jede Option auch ein i-Symbol. Die Erklärung beginnt mit einem fett gedruckten Satz. Die vier Vorgangsarten mit diesem Satz aus der App:

- **Feste Dauer und Einheiten** (*Die Arbeit ergibt sich aus Dauer und Einheiten*.). Das ist der Standard. Die App ändert die Dauer nie selbst, und die Arbeit ergibt sich aus Dauer und Einheiten. Wenn Sie die Arbeit selbst eintragen, passt die App die Einheiten an, weil die Dauer fest ist.
- **Feste Dauer und Arbeit** (*Die Einheiten ergeben sich aus Dauer und Arbeit*.). Die App ändert die Dauer nie selbst. Wenn Sie die Dauer ändern, bleibt die Arbeit, und die Einheiten passen sich an.
- **Feste Arbeit** (*Die Dauer ergibt sich aus Arbeit und Einheiten*.). Die Arbeit ist fest, und die Dauer folgt aus Arbeit und Einheiten.
- **Feste Einheiten** (*Die Dauer ergibt sich aus Arbeit und Einheiten*.). Die Einheiten sind fest, und die Dauer folgt aus der Arbeit.

Zwei Vorgangsarten lassen die Dauer also in Ruhe. Bei den beiden anderen bewegt sich die Dauer mit, wenn Sie die Einheiten, die Arbeit oder die Anzahl der Ressourcen ändern. Bei einer Ressource tun *Feste Arbeit* und *Feste Einheiten* dasselbe. Sie unterscheiden sich, wenn Sie die Dauer selbst ändern: Bei *Feste Arbeit* bleibt die Arbeit, und die Einheiten passen sich an. Bei *Feste Einheiten* bleiben die Einheiten, und die Arbeit wächst mit. Sie unterscheiden sich auch, wenn mehr Ressourcen am Vorgang arbeiten (siehe unten).

Die Rechenbeispiele unten zeigen, was jede Vorgangsart tut.

### Runden

Die Dauer, die aus der Formel folgt, rundet die App auf. Bei einem Vorgang in Tagen rundet sie auf ganze Arbeitstage, bei einem Vorgang in Stunden auf ganze Minuten. Arbeit und Einheiten bleiben, was Sie eingegeben haben oder was die App aus der Summe übernommen hat. Dadurch stimmt die Formel manchmal nicht genau. Das Beispiel unten zeigt, was dann passiert.

### Mehrere Ressourcen

Hat ein Vorgang mehrere Ressourcen, gelten zwei Regeln. Bei *Feste Dauer und Arbeit*, *Feste Arbeit* und *Feste Einheiten* bleibt die Gesamtarbeit gleich, wenn Sie eine Ressource hinzufügen oder entfernen. Die App teilt sie dann im Verhältnis der Einheiten auf. Bei *Feste Dauer und Einheiten* bringt eine neue Ressource dagegen ihre eigene Arbeit mit. Bei *Feste Arbeit* und *Feste Einheiten* bestimmt die langsamste Ressource die Dauer: pro Ressource ist das die Arbeit geteilt durch die Einheiten, und das größte Ergebnis zählt.

Ein Beispiel: Zwei Ressourcen haben je 32 Stunden Arbeit und Einheiten von 1, zusammen 4 Arbeitstage. Sie setzen die Einheiten der ersten auf 0,5. Die Dauer wird dann 8 Arbeitstage. Bei *Feste Arbeit* behält die zweite Ressource ihre 32 Stunden Arbeit, und ihre Einheiten sinken auf 0,5. Bei *Feste Einheiten* behält die zweite Ressource ihre Einheiten von 1, und ihre Arbeit wächst auf 64 Stunden.

### Fortschritt

Hat der Vorgang schon Fortschritt, wirkt die Vorgangsart nur auf den Restteil: die Restdauer und die Restarbeit. Im Bereich *Eigenschaften* steht diese Arbeit in der Spalte *Arbeit (h)*. Was schon erledigt ist, bleibt.

### Vorgänge in Stunden

Ein Stundenvorgang rechnet genauso, aber in Minuten. Wenn nur der Kran an einem 5-Stunden-Vorgang arbeitet, sind das 5 Stunden Arbeit. Bei *Feste Arbeit* wird die Dauer bei Einheiten von 2 dann 2,5 Stunden. Auf der Hohlkammerdecke im Übungsprojekt arbeitet außerdem die Zimmerer-Kolonne. Sie braucht weiterhin 5 Stunden Arbeit und ist die langsamste. Daher bleibt die Dauer 5 Stunden. Wie Stunden und Tage zusammenhängen, steht in [Tage und Stunden](docs://uitleg-dagen-en-uren).

## Durchgerechnetes Beispiel: das Verputzen

Das Beispiel ist das Übungsprojekt *House extension* aus den Tutorials. Im Tutorial 5 rechnen Sie das selbst nach und prüfen die Zahlen. Hier lesen Sie, was jede Vorgangsart tut.

Das Verputzen dauert 4 Arbeitstage. Ein Gipser ist ihm zugewiesen, mit Einheiten von 1, und der Arbeitstag hat 8 Stunden. Die Arbeit ist also 32 Stunden.

### Feste Dauer und Einheiten

- Sie setzen die Dauer auf 6 Arbeitstage: die Arbeit wächst auf 48 Stunden, die Einheiten bleiben 1.
- Sie setzen die Einheiten auf 2: die Dauer bleibt 4 Arbeitstage, die Arbeit wird 64 Stunden.
- Sie tragen 48 Stunden in *Arbeit (h)* ein: die Dauer bleibt 4 Arbeitstage, die Einheiten werden 1,5.
- Sie weisen eine zweite Ressource zu, zum Beispiel *Plasterer 2*, mit Einheiten von 1: die Dauer bleibt 4 Arbeitstage, und diese zweite Ressource bringt 32 Stunden Arbeit mit, zusammen 64 Stunden.

### Feste Dauer und Arbeit

- Sie setzen die Dauer auf 6 Arbeitstage: die Arbeit bleibt 32 Stunden, die Einheiten sinken auf 0,67.
- Sie setzen die Einheiten auf 2: die Dauer bleibt 4 Arbeitstage. Weil die Dauer fest ist, wächst die Arbeit mit auf 64 Stunden.
- Sie tragen 16 Stunden in *Arbeit (h)* ein: die Dauer bleibt 4 Arbeitstage, die Einheiten werden 0,5.
- Sie weisen eine zweite Ressource zu, zum Beispiel *Plasterer 2*, mit Einheiten von 1: die 32 Stunden werden geteilt, 16 Stunden jeweils, und die Einheiten werden für beide 0,5. Die Dauer bleibt 4 Arbeitstage.

### Feste Arbeit

- Sie setzen die Dauer auf 6 Arbeitstage: die Arbeit bleibt 32 Stunden, die Einheiten sinken auf 0,67.
- Sie setzen die Einheiten auf 2: die Arbeit bleibt 32 Stunden, und die Dauer wird 2 Arbeitstage. Das ist der Schritt, den Sie im Tutorial 5 machen.
- Sie tragen 48 Stunden in *Arbeit (h)* ein: die Einheiten bleiben 1, und die Dauer wird 6 Arbeitstage.
- Sie weisen eine zweite Ressource zu, zum Beispiel *Plasterer 2*, mit Einheiten von 1: die 32 Stunden werden geteilt, 16 Stunden jeweils, und die Dauer wird 2 Arbeitstage. Entfernen Sie diese zweite Ressource wieder, dann ist die Dauer wieder 4 Arbeitstage.

### Feste Einheiten

- Sie setzen die Dauer auf 6 Arbeitstage: die Einheiten bleiben 1, die Arbeit wächst auf 48 Stunden.
- Sie setzen die Einheiten auf 2: die Arbeit bleibt 32 Stunden, und die Dauer wird 2 Arbeitstage.
- Sie tragen 48 Stunden in *Arbeit (h)* ein: die Einheiten bleiben 1, und die Dauer wird 6 Arbeitstage.
- Sie weisen eine zweite Ressource zu, zum Beispiel *Plasterer 2*, mit Einheiten von 1: die 32 Stunden werden geteilt, 16 Stunden jeweils, und die Dauer wird 2 Arbeitstage.

### Wenn die Summe nicht aufgeht

Bei *Feste Arbeit* setzen Sie die Einheiten auf 3. Die Arbeit ist 32 Stunden, also wird die Dauer 32 ÷ (3 × 8) = 1,33 Arbeitstage. Die App rundet das auf 2 Arbeitstage auf. Arbeit (32 Stunden) und Einheiten (3) bleiben, aber 2 × 3 × 8 ergibt 48 Stunden. Das Histogramm verteilt die 32 Stunden daher über die 2 Arbeitstage: 2 Einheiten pro Tag, nicht 3. In dem Feld *Arbeit (h)* erscheint ein Warnzeichen, *Weicht von Einheiten × Dauer ab*, um das zu zeigen.

Zwei Ressourcen mit unterschiedlichen Einheiten funktionieren genauso. Wenn Sie bei *Feste Arbeit* eine zweite Ressource, zum Beispiel *Plasterer 2*, mit Einheiten von 2 zu dem Gipser mit Einheiten von 1 hinzufügen, teilt die App die 32 Stunden im Verhältnis 1 : 2, also 10,7 und 21,3 Stunden. Beide brauchen dann 1,33 Arbeitstage. Die Dauer wird 2 Arbeitstage.

Eine Datei aus P6 oder MS Project kann auch eine *Arbeit (Rest)* enthalten, die nicht gleich Einheiten × Restdauer ist. Dann erscheint dasselbe Warnzeichen. Die App ändert diese Arbeit nicht selbst. Wenn Sie die Dauer eines solchen Vorgangs ändern, folgt die App der Vorgangsart, auch wenn die Restarbeit aus der Datei stammt. Bei *Feste Dauer und Einheiten* und *Feste Einheiten* wird die Restarbeit zu Einheiten × neue Restdauer. Bei *Feste Dauer und Arbeit* und *Feste Arbeit* bleibt die Arbeit, und die Einheiten passen sich an. Verschwindet dabei eine Restarbeit aus der Datei, erhalten Sie eine Meldung mit der alten und der neuen Anzahl Stunden. Mit Strg+Z stellen Sie den alten Wert wieder her. Die Erklärung beim Warnzeichen sagt Ihnen pro Vorgang, welcher der beiden Fälle eintritt.

### Ein anderer Kalender

Bei *Feste Arbeit* sinkt der Arbeitstag des Kalenders von 8 auf 6 Stunden. Die Arbeit bleibt 32 Stunden, also wird die Dauer 32 ÷ 6 = 5,33, aufgerundet auf 6 Arbeitstage. Wie die App Arbeitstage und Arbeitszeiten zählt, steht in [Kalender und Arbeitstage](docs://uitleg-kalenders). Die App meldet: *Nach der Kalenderänderung hat die Vorgangsart die Dauer von 1 Vorgang angepasst (Arbeit bleibt, Stunden pro Tag geändert).*

### Ein Vorgang mit Fortschritt

Die innere Schale der Hohlwand dauert 5 Arbeitstage und ist zu 40% fertig: 2 Arbeitstage sind erledigt, und 3 Arbeitstage (24 Stunden) bleiben. Bei *Feste Arbeit* setzen Sie die Einheiten von 1 auf 2. Die Restarbeit bleibt 24 Stunden, und die Restdauer wird 1,5, aufgerundet auf 2 Arbeitstage. Der Vorgang dauert jetzt 2 + 2 = 4 Arbeitstage, und der Fortschritt ist 50%. Der Prozentwert wandert mit, weil der erledigte Teil gleich bleibt und der Rest kürzer wird.

## Folgen und Missverständnisse

**„Feste Arbeit bedeutet, dass die Dauer fest ist.“** Nein, ganz im Gegenteil. Bei *Feste Dauer und Einheiten* und *Feste Dauer und Arbeit* ist die Dauer fest. Bei *Feste Arbeit* und *Feste Einheiten* folgt die Dauer aus den beiden anderen Größen.

**„Wenn ich eine Vorgangsart wähle, ändert sich mein Terminplan.“** Nein. Die Wahl ändert keine Zahl. Erst bei Ihrer nächsten Änderung entscheidet die Vorgangsart, was sich mitbewegt. Bei einer Vorgangsart, die Arbeit schützt, fixiert die App die Arbeit im Moment der Wahl, damit es eine Zahl gibt, die geschützt werden kann. Ein solcher Vorgang hat dann eine gespeicherte *Arbeit (h)*.

**„Die Dauer hat sich geändert, ohne dass ich etwas angefasst habe.“** Das kann passieren nach einer Änderung der Einheiten, der Arbeit, der Anzahl der Ressourcen oder der Stunden pro Tag, bei *Feste Arbeit* oder *Feste Einheiten*. Die Statusleiste zeigt dann, dass der Terminplan nicht mehr aktuell ist. Drücken Sie **Berechnen** (F5), um die neuen Termine zu sehen.

**Ohne Zuweisung tut eine Vorgangsart nichts.** Es gibt dann keine Einheiten und keine Arbeit, an die die Dauer gebunden werden kann.

**Dateien aus MS Project oder Primavera P6 zeigen immer die Vorgangsart.** Bei einem Vorgang aus MS Project behält die App manchmal die Einstellung aufwandsgesteuert. Diese gespeicherte Einstellung wirkt sich in zwei Fällen aus. Bei *Feste Dauer und Arbeit* bewegt sich die Arbeit mit, wenn Sie die Dauer ändern, statt der Einheiten, sofern der Vorgang aufwandsgesteuert ist. Bei *Feste Einheiten* bewegt sich die Arbeit mit, wenn Sie eine Ressource hinzufügen oder entfernen, und die Dauer bleibt, sofern der Vorgang nicht aufwandsgesteuert ist. Vorgänge, die Sie in der App anlegen, haben diese Einstellung nicht. Die Erklärung hinter dem i-Symbol berücksichtigt diese Einstellung.

## Siehe auch

- [Eine Vorgangsart wählen](docs://howto-werkregel-kiezen): die Schritte, um die Vorgangsart eines Vorgangs festzulegen.
- [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen): eine Ressource einem Vorgang zuweisen, mit Einheiten und Verteilung.
- [Tage und Stunden](docs://uitleg-dagen-en-uren): wie die App Tage und Stunden umrechnet.
- [Kalender und Arbeitstage](docs://uitleg-kalenders): wie die App Arbeitstage und Arbeitszeiten zählt.
