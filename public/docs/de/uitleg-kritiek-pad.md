# Kritischer Pfad und Puffer

Warum ist das Projektende so, wie es ist? Und welcher Vorgang darf sich um einen Tag verzögern, ohne dass sich die Übergabe verschiebt? Um diese Fragen geht es beim kritischen Pfad. Dieser Artikel erklärt genau, was die App berechnet, an einem durchgerechneten Beispiel.

## Das Konzept

Ein Terminplan ist ein Netz aus Vorgängen, die durch **Beziehungen** verbunden sind: Vereinbarungen wie „Die Fensterrahmen werden erst eingebaut, wenn das Dach geschlossen ist“. Diese Beziehungen verbinden die Vorgänge miteinander. Manche Ketten von Vorgängen sind länger als andere. Die längste Kette bestimmt, wie lange das ganze Projekt dauert.

Diese längste Kette ist der **kritische Pfad**. Verzögert sich ein Vorgang darauf um einen Tag, verschiebt sich die Übergabe um einen Tag. Auf ihm gibt es keinen Spielraum.

Vorgänge außerhalb des kritischen Pfads haben Spielraum. Dieser Spielraum heißt **Puffer**. Der Maurer, der die äußere Schale baut, könnte zwei Tage später anfangen, ohne dass es jemand bemerkt. Diese zwei Tage sind der Puffer dieses Vorgangs.

Kritisch sagt also nichts darüber aus, wie wichtig ein Vorgang ist. Es sagt nur, dass keine Zeitreserve besteht.

Die Berechnungsmethode heißt **CPM** (Critical Path Method). Daher trägt der Teil mit den Ergebnissen im Bereich *Eigenschaften* den Namen *CPM-Ergebnis*.

## Wie die App berechnet

Die App berechnet den Terminplan nicht von selbst neu. Die Berechnung startet mit **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Hat sich seit der letzten Berechnung etwas geändert, zeigt die Statusleiste *Veraltet — neu berechnen (F5)*. Ist *Automatisch berechnen* eingeschaltet (unter *Einstellungen › Projekt › App-Einstellungen*, Registerkarte *Planung*, Überschrift *Berechnung*), dann führt die App die Berechnung selbst aus.

Eine Berechnung durchläuft das Netz zweimal.

### Vorwärtsdurchlauf

Die App beginnt beim Projektstart und folgt den Beziehungen vom Vorgänger zum Nachfolger. Für jeden Vorgang findet die App den frühesten Tag, an dem dieser Vorgang beginnen kann. Hat ein Vorgang mehrere Vorgänger, wartet er, bis der letzte davon fertig ist. So erhält jeder Vorgang seinen **frühesten Anfang** und sein **frühestes Ende**. Das späteste der frühesten Enden aller Vorgänge ist das Projektende.

### Rückwärtsdurchlauf

Danach geht die App vom Projektende zurück zum Anfang. Jetzt findet die App für jeden Vorgang den letzten Tag, an dem der Vorgang fertig sein muss, ohne dass sich das Projektende verschiebt. Hat ein Vorgang mehrere Nachfolger, zählt der, der zuerst beginnen muss. So erhält man den **spätesten Anfang** und das **späteste Ende**.

### Gesamtpuffer und freier Puffer

Der Unterschied zwischen seinem spätesten und seinem frühesten Termin ist der **Gesamtpuffer** eines Vorgangs. Das ist die Anzahl Arbeitstage, um die der Vorgang später enden oder später beginnen darf, bevor sich das Projektende verschiebt. Die App zählt in Arbeitstagen des Kalenders des Vorgangs. Ein Wochenende oder ein Feiertag zählt nicht.

Der **freie Puffer** ist strenger. Er ist der Spielraum, den ein Vorgang hat, bevor einer seiner Nachfolger später beginnen muss. Diesen Spielraum können Sie nutzen, ohne dass ein anderer Vorgang es bemerkt.

Gesamtpuffer kann geteilt werden. Folgen zwei nicht kritische Vorgänge aufeinander, teilen sie sich denselben Puffer. Verbraucht der erste ihn ganz, hat der zweite keinen mehr. Der erste hat dann Gesamtpuffer, aber keinen freien Puffer. Der Teil des Gesamtpuffers, der nicht frei ist, heißt **störender Puffer**: Wenn Sie ihn nutzen, verschieben sich auch die Vorgänge danach. Das Beispiel unten zeigt das mit Zahlen.

### Negativer Puffer

Auch ein Puffer kann negativ werden. Das passiert, wenn ein Vorgang einen Stichtag hat oder eine Einschränkung, die einen spätesten Termin vorgibt, der vor dem Termin liegt, den die App für diesen Vorgang berechnet. Rechnerisch liegt der Vorgang dann schon hinter seinem Termin. Der Vorgang und die Kette davor werden kritisch.

### Wann ist ein Vorgang kritisch?

Standardmäßig ist ein Vorgang kritisch, wenn sein Gesamtpuffer 0 oder weniger beträgt. Das können Sie unter *Einstellungen › Projekt › Projekteinstellungen* ändern, im Block *Berechnungsprofil und Berechnungsoptionen*, bei *Berechnungsoptionen dieses Projekts*. Wenn Sie auf *Anwenden* klicken, berechnet die App den Terminplan sofort neu. Die Optionen gehören zur Projektdatei, nicht zur App.

- **Definition von kritisch** mit *Gesamtpuffer ≤ Schwelle* und dem Feld *Schwelle (Arbeitstage)*. Die Schwelle ist standardmäßig 0. Um einen Puffer abzusichern, setzen Sie sie zum Beispiel auf 2: Jeder Vorgang mit 2 Arbeitstagen Puffer oder weniger gilt dann als kritisch und wird rot. Wenn Sie *Längster Pfad* wählen, gilt ein Vorgang als kritisch, wenn er auf der längsten Kette bis zum letzten Ende liegt. Sein Puffer spielt dann keine Rolle.
- **Mehrere Pufferpfade** nummeriert die Ketten nach ihrem Puffer in der Spalte *Pufferpfad*. Pfad 1 ist der kritische Pfad. Siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies).
- **Fast kritische Vorgänge markieren** mit einer eigenen *Schwelle*, standardmäßig 2 Arbeitstage. Ein Vorgang mit mehr als 0 und höchstens so viel Puffer bekommt einen bernsteinfarbenen Balken. So sehen Sie, welche Vorgänge kaum noch Spielraum haben, ohne sie kritisch zu nennen.
- **Offene Vorgänge kritisch**: Ein Vorgang ohne Nachfolger, der noch nicht fertig ist, gilt als kritisch. Das ist ein nützliches Sicherheitsnetz gegen vergessene Beziehungen (siehe unten zu den Missverständnissen).
- **Berechnung des Puffers** legt fest, ob der Gesamtpuffer am Anfang des Vorgangs, am Ende oder als der kleinere der beiden Werte gemessen wird. Neue Projekte sind auf *Automatisch (Standard)* eingestellt. Verwendet das Projekt das Berechnungsprofil Primavera P6 und ist diese Auswahl nicht *Endpuffer*, zeigt ein orangefarbener Block in *Projekteinstellungen* das an. Dessen Schaltfläche stellt die Auswahl auf *Endpuffer*. Bei MS Project stellt dieselbe Schaltfläche die Auswahl wieder auf *Automatisch (Standard)* zurück: Mit einem Statusdatum rechnet MS Project selbst so.

### Wo Sie es sehen

Kritische Vorgänge haben einen roten Balken im Gantt-Diagramm. Hinter einem unkritischen Balken liegt ein grüner Streifen bis zum spätesten Ende des Vorgangs: Das ist der Puffer. Den Streifen schalten Sie mit *Ansicht › Baselines & Fortschritt › Pufferband* ein oder aus.

Bei einem ausgewählten Vorgang listet der Bereich *Eigenschaften* alles unter *CPM-Ergebnis* auf: den frühesten und spätesten Anfang, das früheste und späteste Ende, Gesamtpuffer, freien Puffer und störenden Puffer sowie ob der Vorgang auf dem kritischen Pfad liegt. Den Puffer aller Vorgänge nebeneinander finden Sie in den Spalten unter *Berechnet* (das **+** rechts in der Tabellenkopfzeile), zum Beispiel *Gesamtpuffer*, *Freier Puffer*, *Kritisch* und *Fast kritisch*.

Die Statusleiste unten zählt die kritischen Vorgänge, zum Beispiel *Kritischer Pfad: 21 Vorgänge, 45 Arbeitstage*.

## Durchgerechnetes Beispiel: House extension

Das Beispiel ist das Übungsprojekt aus den Tutorials, *House extension*, so wie es aussieht, wenn alle Beziehungen angelegt sind. Im Tutorial 2, „Beziehungen und der kritische Pfad“, bauen Sie es selbst nach und prüfen die Zahlen. Hier lesen Sie, warum die Zahlen so sind, wie sie sind.

Der Anbau beginnt am Montag, 7. Juni 2027. Nach der Berechnung ist die Übergabe am Freitag, 6. August 2027, und die Statusleiste zeigt *Kritischer Pfad: 21 Vorgänge, 45 Arbeitstage*. Zwei Vorgänge sind nicht kritisch: *Build outer cavity leaf* und *Painting*.

### Zwei Ketten, die sich treffen

Nach dem tragenden Boden (*Lay hollow-core floor*, fertig am Montag, 28. Juni) teilt sich die Arbeit in zwei Ketten. Beide enden bei *Install window frames*:

- Die Innenseite: *Build inner cavity leaf* (5 Arbeitstage), dann *Place roof elements* (1), dann *Apply roofing* (2). Die Fensterrahmen können erst eingebaut werden, wenn das Dach geschlossen ist.
- Die Außenseite: *Build outer cavity leaf* (6 Arbeitstage). Die Rahmen sitzen in der Fassade, deshalb muss auch sie fertig sein.

**Vorwärts.** Beide Schalen können am Dienstag, 29. Juni, beginnen. Die innere Schale ist am Montag, 5. Juli, fertig. Die Dachelemente werden am Dienstag, 6. Juli, verlegt, und die Dacheindeckung folgt am Mittwoch, 7. und Donnerstag, 8. Juli. Die äußere Schale ist am Dienstag, 6. Juli, fertig. *Install window frames* wartet auf die spätere der beiden Ketten, also auf die Dacheindeckung, und beginnt deshalb am Freitag, 9. Juli.

**Rückwärts.** Die Rahmen müssen spätestens am Freitag, 9. Juli, beginnen, sonst verschiebt sich die Übergabe. Also muss die äußere Schale spätestens am Donnerstag, 8. Juli, fertig sein. Sechs Arbeitstage zurück ergeben den spätesten Anfang am Donnerstag, 1. Juli.

**Puffer.** Die äußere Schale kann frühestens am 29. Juni beginnen und muss spätestens am 1. Juli beginnen. Dazwischen liegen 2 Arbeitstage: Mittwoch, 30. Juni, und Donnerstag, 1. Juli. Das ist ihr Gesamtpuffer. Der Bereich zeigt *Gesamtpuffer: 2 Tage* und *Kritischer Pfad: Nein*. Der freie Puffer beträgt ebenfalls 2 Tage, weil ihr einziger Nachfolger, *Install window frames*, auf dem kritischen Pfad liegt.

Die innere Kette hat keinen Puffer. Jeder Tag Verzug dort verschiebt die Rahmen und alles danach.

### Painting

*Painting* (3 Arbeitstage) beginnt nach dem Verputzen am Montag, 26. Juli, und ist am Mittwoch, 28. Juli, fertig. Der nächste Vorgang, *Snagging and cleaning*, wartet ebenfalls auf die Fliesenarbeiten. Die Fliesenarbeiten sind erst am Donnerstag, 5. August, fertig, weil der Estrich zuerst fünf Arbeitstage trocknen muss. *Painting* darf also bis Donnerstag, 5. August, laufen. Das ergibt 6 Arbeitstage Puffer: 29. und 30. Juli sowie 2. bis 5. August. Auch hier ist der freie Puffer gleich dem Gesamtpuffer, weil der Nachfolger kritisch ist.

### Wenn die äußere Schale sich verzögert

Wenn die äußere Schale 8 Arbeitstage statt 6 braucht, ist sie am Donnerstag, 8. Juli, fertig: genau an ihrem spätesten Ende. Der Puffer ist aufgebraucht, und der Vorgang wird rot. Beide Ketten sind dann kritisch, und die Statusleiste zählt 22 kritische Vorgänge. Die Übergabe bleibt am Freitag, 6. August.

Braucht sie 9 Arbeitstage, ist die äußere Schale erst am Freitag, 9. Juli, fertig. Die Rahmen verschieben sich auf Montag, 12. Juli, und die Übergabe auf Montag, 9. August: einen Arbeitstag später. Die äußere Kette ist jetzt der kritische Pfad; die Statusleiste zeigt *Kritischer Pfad: 19 Vorgänge, 46 Arbeitstage*.

Die innere Kette hat dann 1 Arbeitstag Gesamtpuffer, aber diesen Tag teilen sich die Vorgänge:

- *Build inner cavity leaf*: Gesamtpuffer 1, freier Puffer 0, störender Puffer 1. Verzögert sich die innere Schale um einen Tag, verschieben sich die Dachelemente mit.
- *Place roof elements*: Gesamtpuffer 1, freier Puffer 0, störender Puffer 1.
- *Apply roofing*: Gesamtpuffer 1, freier Puffer 1. Nur hier kostet ein Tag Verzug niemandem etwas.

Es ist derselbe eine Tag, den die ganze Kette teilt. Nutzt die innere Schale ihn, ist er für die Dachelemente und die Dacheindeckung weg.

### Fast kritisch und negativer Puffer

Ist *Beinahe-kritisch markieren* eingeschaltet, mit der Schwelle, die standardmäßig 2 Arbeitstage beträgt, bekommt die äußere Schale mit genau 2 Tagen Puffer einen bernsteinfarbenen Balken. *Painting* mit 6 Tagen bleibt blau.

Bekommt die Übergabe einen Stichtag am Mittwoch, 4. August, zwei Arbeitstage vor der berechneten Übergabe, wird der Puffer negativ. Alle 21 Vorgänge auf dem kritischen Pfad bekommen einen Gesamtpuffer von −2 Arbeitstagen. Die äußere Schale hat keinen Puffer mehr und wird ebenfalls kritisch. *Painting* behält 4 Arbeitstage.

## Folgen und Missverständnisse

**„Kritisch heißt wichtig.“** Nein. Eine Prüfung kann wichtig sein und trotzdem Puffer haben. Umgekehrt kann eine einfache Arbeit kritisch sein: Im Beispiel liegt *Snagging and cleaning* auf dem kritischen Pfad. Kritisch bezieht sich nur auf die Zeit: Es bleibt kein Spielraum.

**„Dieser Vorgang hat Puffer, also kann er warten.“** Sehen Sie zuerst auf den freien Puffer. Hat ein Vorgang Gesamtpuffer, aber keinen freien Puffer, nimmt jeder Tag Verzug den folgenden Vorgängen den Spielraum weg. So war es bei der inneren Schale im Fall mit 9 Arbeitstagen.

**Eine vergessene Beziehung gibt falschen Puffer.** Ein Vorgang ohne Nachfolger bekommt Puffer bis zum Projektende. Fehlte im Beispiel die Beziehung von der äußeren Schale zu den Rahmen, hätte die äußere Schale plötzlich 23 Arbeitstage Puffer, bis zur Übergabe am 6. August. Rechnerisch könnte sie sich dann wochenlang verzögern, ohne dass die Rahmen warten. Ist *Offene Vorgänge kritisch* eingeschaltet, wird die äußere Schale in diesem Fall kritisch, und die Lücke wird sichtbar.

**Der kritische Pfad ist nicht fest.** Verzögert sich ein nicht kritischer Vorgang über seinen Puffer hinaus, wird eine andere Kette die längste. Das haben Sie oben gesehen, bei 9 Tagen Mauerwerk. Deshalb muss der Terminplan nach jeder Änderung neu berechnet werden. Solange die Statusleiste *Veraltet* zeigt, gehören die roten Balken noch zur vorherigen Berechnung.

**Puffer wird in Arbeitstagen gezählt.** Die 6 Arbeitstage Puffer von *Painting* laufen von Donnerstag, 29. Juli, bis Donnerstag, 5. August: im Kalender acht Tage, weil das Wochenende nicht zählt. Auch ein Feiertag oder die Bauferien im Kalender zählen nicht.

## Siehe auch

- [Beziehungen hinzufügen](docs://howto-relaties-leggen): die Schritte, um Vorgänge zu verknüpfen und einen Zeitabstand festzulegen.
- [Beziehungen und Zeitabstand](docs://uitleg-relaties): wie Beziehungen und Zeitabstand die frühesten Termine bestimmen.
- [Einschränkungen und Stichtage](docs://uitleg-constraints): wie eine Einschränkung oder ein Stichtag einen negativen Puffer erzeugt.
- [Einen Pfad nachverfolgen](docs://howto-pad-traceren): der Kette hinter einem Vorgang folgen.
- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): die Definition von kritisch, fast kritisch und die Berechnung des Puffers, Option für Option.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): ein großes Projekt mit mehreren Pufferpfaden, fast kritischen Vorgängen (Schwelle 3 Arbeitstage), einem Hammock, einem harten Pin und einer externen Beziehung.
