# Kapazitätsabgleich

Sie haben einen Maurer und zwei Wände, die an denselben Tagen gebaut werden müssen. Auf dem Papier funktioniert der Terminplan, aber in der Praxis kann der Maurer nur an einem Ort sein. Der Kapazitätsabgleich löst solche Konflikte: Er lässt Vorgänge später beginnen, bis die Ressource es bewältigen kann. In diesem Artikel lesen Sie genau, was der Kapazitätsabgleich verschiebt, wann das Projektende nachgibt und was er nicht für Sie löst.

## Das Konzept

Eine Ressource ist an einem Arbeitstag **überlastet**, wenn der Terminplan an diesem Tag mehr von ihr verlangt, als sie liefern kann. Was sie liefern kann, ist ihre Kapazität: *Max. Einheiten* an den Arbeitstagen ihres Kalenders. Arbeitet sie an diesem Tag laut ihrem Kalender nicht, ist ihre Kapazität 0.

**Kapazitätsabgleich** löst das, indem Vorgänge später beginnen. Mehr tut er nicht. Er verkürzt keinen Vorgang, teilt keinen Vorgang auf, ändert keine Einheiten oder Beziehungen und fügt keine zusätzliche Ressource hinzu. Für jeden Vorgang sucht die App den ersten Zeitpunkt, an dem die Ressourcen frei sind, und verschiebt den Vorgang dorthin.

Es gibt zwei Möglichkeiten im Fenster *Kapazitätsabgleich*:

- Standardmäßig darf sich das Projektende mitverschieben. Das ist der Kapazitätsabgleich im eigentlichen Sinn.
- Mit dem Kontrollkästchen *Nur innerhalb des Puffers abgleichen (Glättung) — Projektende bleibt unverändert* verschiebt die App Vorgänge nur innerhalb ihres Puffers. Das Projektende bleibt dann stehen. Funktioniert das nicht, bleibt der Vorgang, wo er ist, und die App meldet einen Konflikt. Was der Puffer ist, lesen Sie in [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad).

## So berechnet die App

### Wie viel ein Vorgang verlangt

Pro Arbeitstag zählt die App, wie viele Einheiten jeder Vorgang von einer Ressource verlangt. Das sind die Einheiten laut der Kurve oder Ihrer eigenen Verteilung der Stunden, genau dieselben Stunden pro Tag, die das Histogramm zeigt. Die Kapazität der Ressource ist *Max. Einheiten* oder der Wert des Schritts in der zeitphasierten Kapazität, der an diesem Tag gilt. Ein Tag ist überlastet, wenn der Bedarf größer ist als die Kapazität.

### In welcher Reihenfolge

Die App setzt die Vorgänge einzeln, in dieser Reihenfolge: zuerst die höchste Priorität, dann der Vorgang mit dem geringsten Gesamtpuffer, dann der früheste Anfang und dann die Reihenfolge in der Vorgangstabelle. Ein Vorgang kommt erst dran, wenn seine Vorgänger ihren Platz haben.

Die Priorität ist eine Zahl von 0 bis 1000, die Sie pro Vorgang festlegen. Der Standard ist 500. Im Kontextmenü eines Vorgangsbalkens heißt sie *Priorität*, mit den Auswahlen *Niedrig* (100), *Normal* (500) und *Hoch* (900). Ein Vorgang, der früher drankommt, bekommt den Platz, den er will. Die Vorgänge danach müssen sich um ihn herum einpassen. So entscheidet die Priorität, welcher Vorgang bleibt und welcher nachgibt. Der Wert 1000 ist besonders: So ein Vorgang verschiebt sich nie wegen der Kapazität. Das entspricht in MS Project der Option „Do Not Level“.

### Wohin ein Vorgang verschoben wird

Für jeden Vorgang beginnt die App beim frühesten Anfang, den die Beziehungen erlauben. Dabei berücksichtigt sie, dass Vorgänger selbst schon verschoben sein können. Passt der Vorgang dort, bleibt er. Passt er nicht, probiert die App den nächsten Arbeitstag des Vorgangs, und so weiter. Ein Vorgang passt, wenn jede Ressource an jedem Tag des Vorgangs genug frei hat. Hat ein Vorgang mehrere Ressourcen, müssen alle an diesen Tagen frei sein. Ein Vorgang wird also immer später verschoben, nie früher.

Die App speichert die Verschiebung als **Abgleichsverzögerung**: eine Anzahl Arbeitstage, im Kalender des Vorgangs, um die der Vorgang später beginnt als die Beziehungen verlangen. Sie sehen sie in der Spalte *Abgleichsverzögerung* unter *Berechnet*. Die Verzögerung wird in der Datei gespeichert. Berechnen (F5) berücksichtigt sie als zusätzliche Wartezeit vor dem Anfang. Nachfolgende Vorgänge verschieben sich über ihre Beziehungen mit.

### Innerhalb des Puffers oder darüber hinaus

Ohne *Glättung* sucht die App weiter, bis der Vorgang passt. Dadurch kann sich das Projektende verschieben.

Mit *Glättung* darf ein Vorgang nicht später beginnen als sein spätester Anfang. Das ist der letzte Tag, an dem er beginnen kann, ohne dass sich das Projektende verschiebt. Passt der Vorgang nicht in dieses Fenster, bleibt er an seinem frühesten Platz. Der Vorgang erscheint dann unter *Verbleibende Konflikte*.

### Was die App nicht verschiebt

- Vorgänge, die schon begonnen haben oder fertig sind. Ihre Last zählt mit, aber sie bekommen nie eine Abgleichsverzögerung.
- Vorgänge mit Priorität 1000. Sie folgen ihren Vorgängern, verschieben sich aber nicht wegen der Kapazität.
- Vorgänge ohne Zuweisung zu den gewählten Ressourcen, Meilensteine und Phasen. Sie wandern nur mit, wenn ein Vorgänger sich verschiebt.
- Material. Das wird nie abgeglichen.

### Vorschlag und Übernehmen

*Berechnen* macht einen Vorschlag: die Vorgänge, die sich verschieben, mit altem und neuem Anfang sowie das Projektende vor und nach der Verschiebung. An Ihrem Terminplan ändert sich nichts, bis Sie *Anwenden* wählen. Dann schreibt die App die Verzögerungen in die Vorgänge, und der Terminplan wird sofort neu berechnet.

## Praxisbeispiel: der Maurer an zwei Wänden

Das Beispiel ist das Übungsprojekt *House extension* aus den Tutorials, so wie es kurz vor dem Kapazitätsabgleich in Tutorial 5 steht. In Tutorial 5 machen Sie das selbst und prüfen die Zahlen. In diesem Beispiel steht das Verputzen auf *Feste Arbeit*, und der Verputzer arbeitet mit Einheiten von 2, wie in [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels).

Nachdem die Hohlkerndecke am Montag, 28. Juni, fertig ist, beginnen die innere Mauerschale (5 Arbeitstage) und die äußere Mauerschale (6 Arbeitstage) beide am Dienstag, 29. Juni. Beide sind beim Maurer eingeplant, mit Einheiten von 1 und *Max. Einheiten* von 1. Nach der inneren Mauerschale folgen die Dachelemente (6 Stunden Kranarbeit) und die Dachdeckung (2 Arbeitstage). Die Fensterrahmen warten auf die Dachdeckung und auf die äußere Mauerschale. Die Übergabe ist am Montag, 30. August.

### Die Überlastung

Die innere Mauerschale läuft vom 29. Juni bis einschließlich 5. Juli, die äußere vom 29. Juni bis einschließlich 6. Juli. Vom 29. Juni bis einschließlich 5. Juli sind das 5 Arbeitstage. An diesen Tagen verlangt der Terminplan 2 Einheiten von einem Maurer mit Kapazität 1. Der Maurer ist an diesen 5 Tagen überlastet.

### Die Reihenfolge

Beide Vorgänge haben Priorität 500. Die Fensterrahmen werden erst am 14. Juli geliefert (im Tutorial 3 legen Sie dafür die Einschränkung *Anfang nicht früher als (SNET)* fest). Deshalb hat die innere Mauerschale 3 Arbeitstage Puffer und die äußere 5. Die innere Mauerschale hat den geringsten Puffer und kommt daher zuerst. Die innere Mauerschale bleibt vom 29. Juni bis einschließlich 5. Juli.

### Die Verschiebung

Die äußere Mauerschale kann nicht am 29. Juni beginnen. Der erste Tag, an dem der Maurer wieder frei ist, ist Dienstag, 6. Juli. Das sind 5 Arbeitstage später als der früheste Anfang, also ist die Abgleichsverzögerung 5. Die äußere Mauerschale läuft nun vom 6. Juli bis einschließlich 13. Juli. Die Fensterrahmen beginnen ohnehin erst am 14. Juli, daher bleibt die Übergabe am Montag, 30. August. Das Fenster meldet *Projektende: unverändert (30-08-2027)* und zeigt eine Zeile: *Build outer cavity leaf*, alter Anfang 29-06-2027, neuer Anfang 06-07-2027, *5 d*.

Die Verschiebung um 5 Arbeitstage ist genau der Puffer der äußeren Mauerschale. Deshalb gibt *Kapazitätsabgleich* hier dasselbe Ergebnis. Die äußere Mauerschale hat jetzt keinen Puffer mehr und ist kritisch.

### Was, wenn die Fensterrahmen nicht am 14. Juli kommen

Ohne diese Einschränkung können die Fensterrahmen am Freitag, 9. Juli, beginnen, und die Übergabe ist am Mittwoch, 25. August. Die äußere Mauerschale hat dann nur 2 Arbeitstage Puffer.

- Ohne *Kapazitätsabgleich* verschiebt sich die äußere Mauerschale trotzdem um 5 Arbeitstage. Jetzt müssen die Fensterrahmen warten: Sie beginnen am 14. Juli, 3 Arbeitstage später. Alles danach verschiebt sich mit, und die Übergabe geht von 25. August auf 30. August, ebenfalls 3 Arbeitstage später.
- Mit *Kapazitätsabgleich* verschiebt sich nichts. Die äußere Mauerschale passt nicht in ihre 2 Arbeitstage Puffer. Das Fenster zeigt den Konflikt *Build outer cavity leaf*, 5 Tag(e), mit dem Grund *Nicht genug freie Kapazität innerhalb des Puffers, um diesen Konflikt zu lösen.*

### Was, wenn die äußere Mauerschale Priorität bekommt

Wenn Sie der äußeren Mauerschale die Priorität *Hoch* (900) geben, kommt sie zuerst. Sie bleibt am 29. Juni, und jetzt muss die innere Mauerschale nachgeben: 6 Arbeitstage später, vom 7. Juli bis einschließlich 13. Juli. Die innere Mauerschale hat nur 3 Arbeitstage Puffer, also sind 6 Arbeitstage 3 zu viel. Die Dachelemente, die Fensterrahmen und alles danach verschieben sich mit. Die Übergabe geht von Montag, 30. August, auf Donnerstag, 2. September. Dieselbe Überlastung ergibt also ein anderes Projektende, je nachdem welcher Vorgang an seinem Platz bleibt.

### Was, wenn ein zweiter Maurer dazukommt

Wenn Sie *Max. Einheiten* des Maurers auf 2 setzen, gibt es keine Überlastung mehr. *Berechnen* meldet *Keine Vorgänge müssen verschoben werden — der Terminplan ist bereits konfliktfrei.*

## Folgen und Missverständnisse

**„Kapazitätsabgleich findet den kürzesten Terminplan.“** Nein. Die App arbeitet Vorgang für Vorgang in fester Reihenfolge und sucht nicht nach der besten Gesamtlösung. Siehe das Beispiel mit der Priorität: eine andere Priorität ergibt ein anderes Projektende.

**„Ein abgeglichener Vorgang ist sicher.“** Der Kapazitätsabgleich nutzt den Puffer. Der verschobene Vorgang hat danach weniger oder keinen Puffer mehr und kann kritisch werden, wie die äußere Mauerschale oben. Verspätet er sich, verschiebt sich die Übergabe.

**„Der Kapazitätsabgleich folgt meinen späteren Änderungen.“** Nein. Die Verzögerung ist eine feste Anzahl Arbeitstage. Wird die innere Mauerschale nach dem Abgleich kürzer, beginnt die äußere Mauerschale trotzdem 5 Arbeitstage später, obwohl das nicht mehr nötig ist. Führen Sie den Kapazitätsabgleich dann erneut aus. Die App fängt dann bei null an.

**Nicht alles lässt sich durch Verschieben lösen.** Arbeitet die Ressource nicht an den Tagen, die der Vorgang braucht, oder verlangt der Vorgang über seine Kurve an einem Tag mehr, als die Ressource liefern kann, bleibt die Überlastung bestehen. Die App sagt dann beim Vorgang, warum.

**Material wird nicht abgeglichen.** Verlangt Material an einem Tag mehr als seine Kapazität, meldet die App das als Überlastung. Der Kapazitätsabgleich lässt es aber unverändert.

**Fixierte Vorgänge.** Sind alle Vorgänge, die kollidieren, auf Priorität 1000, meldet das Fenster *Keine Vorgänge müssen verschoben werden — der Terminplan ist bereits konfliktfrei.*, während die Überlastung bestehen bleibt. Schauen Sie deshalb nach dem Übernehmen im Menüband auf die Meldung *Überlastung*.

## Siehe auch

- [Eine Überlastung auflösen](docs://howto-overbezetting-oplossen): die Schritte, um Überlastung zu finden und abzugleichen.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was der Puffer ist und warum ein Vorgang kritisch wird.
- [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels): wie die Dauer eines Vorgangs mit den Einheiten mitwandert.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): drei Türme, die dieselben Teams und denselben Turmdrehkran brauchen, und was der Kapazitätsabgleich damit macht.
