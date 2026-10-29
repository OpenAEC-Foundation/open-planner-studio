# Die Belegungsübersicht verwenden

Ziel: Sehen Sie, an welchen Tagen zwei oder mehr offene Projekte zusammen mehr von einer Ressource verlangen, als die Ressourcenbibliothek hat.

## Wann Sie das brauchen

Ihr Maurerteam arbeitet in einem Projekt an den Fassaden und in einem anderen an den Garagen. In jedem Projekt ist das Team sauber geplant, weil das Histogramm und die Überlastung eines Projekts nur dieses eine Projekt betrachten. Erst wenn Sie die Projekte nebeneinanderlegen, zeigt sich: An denselben Tagen verlangen sie zusammen mehr Maurer, als Sie haben. Die Belegungsübersicht legt die Projekte für Sie nebeneinander.

Die Übersicht zählt nur Ressourcen, die aus der Ressourcenbibliothek stammen, und nur in Projekten, die mit derselben Bibliothek verknüpft sind. Wie das berechnet wird, lesen Sie in [Die Ressourcenbibliothek](docs://uitleg-resourcebibliotheek).

## Schritte

### 1. Die Projekte vorbereiten

1. Öffnen Sie die Projekte, die Sie vergleichen möchten, jedes in einer eigenen Registerkarte. Siehe [Mit mehreren Projekten gleichzeitig arbeiten](docs://howto-meerdere-projecten). Die Übersicht sieht nur Projekte, die in dieser App geöffnet sind.
2. Verknüpfen Sie jedes Projekt mit derselben Bibliothek, und verwenden Sie in jedem Projekt die Ressource aus der Bibliothek. Ohne Verknüpfung mit einer Bibliothek zeigt das Ressourcen-Panel die Übersicht nicht. Siehe [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken).
3. Berechnen Sie die Projekte mit *Berechnen* (F5), oder schalten Sie *Automatisch berechnen* ein. Was die Übersicht mit veralteten Projekten macht, steht unten bei den Fallstricken.

### 2. Die Übersicht öffnen

1. Wechseln Sie zu einem der Projekte, und wählen Sie *Ressourcen › Verwalten › Ressourcen*.
2. Wählen Sie oben rechts *Belegung*. Die Übersicht gehört zur Bibliothek des Projekts, in dem Sie gerade sind. Sie können in diesem Panel nichts ändern: Es ist ein schreibgeschütztes Fenster.

### 3. Die Tabelle lesen

Jede Ressource aus der Bibliothek, die in mindestens einem offenen Projekt gebucht ist, bekommt eine Zeile. Ressourcen ohne Buchung stehen nicht in der Liste. Die Zeilen mit den meisten überlasteten Tagen stehen oben, danach alphabetisch.

- *Dokumente* gibt an, in wie vielen Projekten die Ressource gebucht ist, zum Beispiel *2 Dokumente*.
- *Zeitraum* läuft vom ersten bis zum letzten Tag mit Last, geschrieben als yyyy-mm-dd, zum Beispiel *2027-06-07 – 2027-06-14*.
- *Spitze / Kapazität* setzt die höchste tägliche Last aller Projekte zusammen gegen die Kapazität der Ressource in der Bibliothek, zum Beispiel *4.0 / 3.0*. Gibt es mindestens einen überlasteten Tag, wird er rot angezeigt.
- Eine rote Markierung hinter der Zeile, zum Beispiel *3 Tage doppelt belegt*, zählt die Tage, an denen die Summe größer ist als die Kapazität. Halten Sie die Maus darüber, dann sehen Sie die Daten.

### 4. Pro Projekt nachsehen

1. Klicken Sie auf den kleinen Pfeil vor dem Namen einer Ressource. Die Zeile klappt auf.
2. Oben stehen die überlasteten Daten, die ersten fünf, und dann *… und 3 weitere*, wenn es mehr gibt. Darunter steht pro Projekt der Name mit dem Zeitraum und der Spitze dieses einen Projekts, zum Beispiel *Houses North 2027-06-07 – 2027-06-11 Spitze: 2.0*.
3. Klicken Sie auf die Zeile selbst, um unten ein Histogramm zu sehen. Jedes Projekt hat eine eigene Farbe, und die Balken sind gestapelt. Die gestrichelte Linie ist die Kapazität der Ressourcenbibliothek. Ändert sie sich mit der Zeit, sehen Sie Stufen. Überlastete Tage bekommen einen roten Streifen hinter den Balken. Klicken Sie noch einmal auf die Zeile, um das Histogramm wieder zu schließen. Ohne gewählte Zeile steht dort *Wählen Sie eine Ressource aus, um das Histogramm zu sehen.*

### 5. Das Problem lösen

Die Übersicht zeigt das Problem, löst es aber nicht. Sie haben zwei Möglichkeiten:

- Verschieben Sie einen Vorgang in einem der Projekte, oder geben Sie ihm pro Tag weniger Einheiten. Drücken Sie danach F5, damit dieses Projekt neu berechnet wird.
- Kommt tatsächlich jemand dazu, erhöhen Sie *Max. Einheiten* der Ressource in der Bibliothek. Das tun Sie unter *Ressourcen › Verwalten › Ressourcen*, Ansicht *Bibliothek*.

*Abgleichen…* im Menüband hilft hier nicht: Es sieht nur die Ressourcen des einen Projekts an, in dem Sie sich befinden. Siehe [Kapazitätsabgleich](docs://uitleg-nivelleren).

## Fallstricke und was die App dann tut

**Die Übersicht ist leer.** Sie zeigt: *Keine Bibliotheksressourcen in den geöffneten Dokumenten gebucht.* Dann hat kein offenes Projekt eine Ressource aus der Ressourcenbibliothek an einem Vorgang.

**Sie sehen die Schaltfläche *Belegung* nicht.** Das Projekt, in dem Sie sich befinden, ist mit keiner Bibliothek verknüpft.

**Ein Projekt zählt nicht mit.** Es ist nicht in dieser App geöffnet, es ist mit einer anderen Bibliothek verknüpft, oder die Ressource darin ist eine eigene Ressource dieses Projekts. Unten in der Übersicht steht immer: *Diese Übersicht sieht nur die Dokumente, die in dieser App geöffnet sind.* Eine Kopie einer Ressource, die inzwischen aus der Bibliothek entfernt wurde, zählt ebenfalls nicht.

**Eine Kopie oder Variante zählt voll mit.** Jedes offene Projekt, das mit der Bibliothek verknüpft ist, zählt mit, auch wenn es eine Kopie oder Variante eines anderen offenen Projekts ist. Zum Beispiel eine Variante, die ein KI-Assistent mit `planner_duplicate_document` erstellt hat. Original und Variante zusammen können dann eine Überlastung zeigen, die in Wirklichkeit nur einmal vorkommt. Die Übersicht filtert das nicht stillschweigend heraus: Schließen Sie die Variante vorübergehend, oder lassen Sie sie beim Lesen außer Acht.

**Ein Projekt ist veraltet.** Ein Projekt ist veraltet, wenn Sie etwas am Terminplan geändert haben, ohne neu zu berechnen. Die Übersicht geht dann so mit diesem Projekt um:

- Bei einem Projekt, das nicht die aktive Registerkarte ist, berechnet die Übersicht selbst im Voraus, ohne das Projekt zu verändern. Über der Tabelle steht dann: *Geänderte Dokumente wurden für diese Übersicht bereits vorab berechnet; drücken Sie F5 im Dokument, oder aktivieren Sie „Automatisch berechnen“, um dies dauerhaft zu tun.* Nach dem Projekt steht: *Für diese Übersicht bereits vorab berechnet — das Dokument selbst zeigt noch ältere Daten, bis Sie dort F5 drücken oder „Automatisch berechnen“ aktivieren.* Ist *Automatisch berechnen* eingeschaltet (*Einstellungen › Projekt › App-Einstellungen*, Registerkarte *Planung*), berechnet die App solche Projekte wirklich neu, sobald Sie die Übersicht öffnen. Dann verschwindet die Meldung. Ist auch das aktive Projekt veraltet, steht über der Tabelle stattdessen die Meldung aus dem nächsten Punkt.
- Die Übersicht berechnet das Projekt, in dem Sie sich befinden, nicht selbst. Ist dieses Projekt veraltet, steht da: *Ein geändertes Dokument wurde noch nicht neu berechnet; es zählt hier mit seinen zuletzt berechneten Werten mit. Drücken Sie F5 in diesem Dokument, oder aktivieren Sie „Automatisch berechnen“.* Nach dem Projekt steht: *Veraltet: dies sind die zuletzt berechneten Werte — drücken Sie F5 in diesem Dokument.* Achtung: *zuletzt berechnete Werte* ist nicht ganz richtig. Die Übersicht nimmt die alten Startdaten, aber bereits eine geänderte Dauer oder Zuordnung. Die Werte können daher sowohl vom alten als auch vom neuen Terminplan abweichen, und ebenso von den Balken im Gantt-Diagramm. Vertrauen Sie ihnen erst nach F5.
- Kann die Übersicht ein Projekt nicht berechnen, zum Beispiel wegen einer Schleife in seinen Beziehungen, dann zählt dieses Projekt nicht mit. Es steht trotzdem in der Liste, mit *Zählt nicht mit: Terminplan nicht berechnet — aktivieren Sie dieses Dokument und drücken Sie F5.* Über der Tabelle steht: *Mindestens ein Dokument wurde nicht berechnet und zählt in der Belegung nicht mit.*

**Die Übersicht stimmt nicht mit Ihren Erwartungen überein.** Die Kapazität kommt aus der Bibliothek (*Max. Einheiten* des Bibliothekseintrags, oder seine *Zeitlich gestaffelte Kapazität* an diesem Tag). Sie kommt nicht aus den *Max. Einheiten* der Kopie im Projekt. Eine Summe, die der Kapazität entspricht, ist kein Konflikt.

## Siehe auch

- [Die Ressourcenbibliothek](docs://uitleg-resourcebibliotheek): wie die Belegung berechnet wird, mit einem Beispiel.
- [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken): Projekte verknüpfen und Ressourcen zuweisen.
- [Überlastung auflösen](docs://howto-overbezetting-oplossen): Überlastung innerhalb eines Projekts.
