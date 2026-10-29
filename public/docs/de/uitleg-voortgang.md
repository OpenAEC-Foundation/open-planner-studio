# Fortschritt, Statusdatum und Baseline

Ein Terminplan ist eine Prognose. Sobald die Arbeit läuft, möchten Sie wissen, was fertig ist, was noch zu tun ist und was das für die Übergabe bedeutet. Dieser Artikel erklärt, wie die App den Fortschritt verarbeitet: was das Statusdatum bewirkt, wie die App die Restarbeit berechnet, warum ein Vorgang, der schon begonnen hat, manchmal noch auf seinen Vorgänger wartet, und wie Sie den aktuellen Stand mit der ursprünglichen Vereinbarung vergleichen. Ein durchgerechnetes Beispiel zeigt die Zahlen.

## Das Konzept

**Fortschritt** ist das, was tatsächlich geschehen ist. Für jeden Vorgang erfasst die App drei Angaben: einen Prozentsatz, einen **Ist-Anfang** und ein **Ist-Ende**. Was der Terminplan vorhergesagt hat, bleibt daneben erhalten. Der Ist-Wert ist das, was wirklich geschehen ist.

Das **Statusdatum** ist der Tag, an dem Sie den Stand aufnehmen. Alles, was vor diesem Tag geschehen ist, ist eine Tatsache. Alles, was noch geschehen muss, plant die App ab dem Beginn dieses Tages. Ein Ist-Wert darf auf das Statusdatum fallen, aber nie danach.

Die **Restarbeit** ist, was bei einem Vorgang noch zu tun ist. Ein Vorgang mit 4 Arbeitstagen, der zu 25% fertig ist, hat 3 Arbeitstage Restarbeit.

Eine **Baseline** ist eine Momentaufnahme des Terminplans zu einem bestimmten Zeitpunkt, meist zu dem Zeitpunkt, zu dem die Vereinbarung genehmigt wurde. Später legen Sie den aktuellen Terminplan daneben und sehen, wie weit die Ausführung abweicht.

## So berechnet die App

Das folgende Beispiel verwendet das Berechnungsprofil *Open Planner Studio*. Ein neues Projekt rechnet damit. Weiter unten lesen Sie, was sich in den Profilen Primavera P6 und Microsoft Project unterscheidet.

Die App berechnet nicht von selbst neu. Nach jeder Änderung am Fortschritt oder am Statusdatum zeigt die Statusleiste *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Planung › Terminplanung › Berechnen*. Wenn *Automatisch berechnen* eingeschaltet ist (unter *Einstellungen › Projekt › App-Einstellungen*, Reiter *Planung*, Überschrift *Berechnung*), macht die App dies selbst.

### Das Statusdatum

Das Statusdatum bewirkt drei Dinge.

Erstens lehnt die App einen Ist-Wert nach dem Statusdatum ab. Ein Datum am Statusdatum selbst ist zulässig.

Zweitens kann Arbeit, die noch nicht begonnen hat, nicht in der Vergangenheit liegen. Ist ein solcher Vorgang vor dem Statusdatum geplant, verschiebt die App ihn auf das Statusdatum. Dasselbe gilt für die Nachfolger, die über ihre Beziehungen mitwandern. Den Effekt sehen Sie im Beispiel unten. Im Profil Microsoft Project tut die App das nicht.

Drittens beginnt die Restarbeit eines Vorgangs, der schon läuft, am Statusdatum selbst. Die App behandelt das Statusdatum als Beginn dieses Tages. Wenn Sie am Freitag außerhalb der Arbeitszeiten den Stand aufnehmen, stellen Sie das Statusdatum deshalb auf Montag. Stellen Sie es auf Freitag, dann plant die App die Restarbeit trotzdem an diesem Freitag.

Wenn Sie noch kein Statusdatum haben und Fortschritt erfassen, setzt die App das Statusdatum auf heute und meldet dies. Ein anderes Datum legen Sie unter *Planung › Baselines & Fortschritt › Statusdatum* fest. Ohne Statusdatum rechnet die App einen laufenden Vorgang vorwärts mit seiner Restdauer, aber rückwärts mit seiner vollen Dauer. Der Puffer wird dann negativ, und der Vorgang wirkt ohne Grund kritisch.

### Prozentsatz, Ist-Werte und Restdauer

Die Felder hängen voneinander ab. Wenn Sie eines ausfüllen, füllt die App die anderen aus.

- Ein Prozentsatz über 0 bedeutet, dass der Vorgang begonnen hat. Geben Sie keinen Ist-Anfang an, nimmt die App den geplanten Anfang. Ist der Vorgang nach dem Statusdatum geplant, fragt die App zuerst, wann er wirklich begonnen hat.
- Bei einem Prozentsatz von 100 ist der Vorgang abgeschlossen. Geben Sie kein Ist-Ende an, wird es das Statusdatum, auch wenn die Arbeit in Wirklichkeit früher fertig war.
- Ein Ist-Ende setzt den Vorgang auf 100%. Setzen Sie einen abgeschlossenen Vorgang wieder unter 100%, entfällt das Ist-Ende. Löschen Sie das Ist-Ende, geht der Prozentsatz auf 0 zurück, und der Vorgang bleibt *In Bearbeitung*, bis Sie auch den Ist-Anfang löschen.
- Die **Restdauer** ist die Dauer mal der Anteil, der noch zu tun ist, auf ganze Arbeitstage gerundet. Bei einem Vorgang von 2 Arbeitstagen ergeben 0% und 25% beide 2 Arbeitstage Restarbeit, und 50% und 75% ergeben beide 1. Bei 90% rundet die App auf 0: Die Restarbeit ist dann am Statusdatum erledigt. Ein Vorgang in Stunden zählt in ganzen Minuten: Ein Vorgang von 5 Stunden bei 40% hat 3 Stunden Restarbeit.
- Ein Meilenstein hat nur einen Ist-Wert.
- Eine Phase (Sammelvorgang) hat keinen eigenen Fortschritt. Nach dem Berechnen ergibt sich ihr Prozentsatz aus den Vorgängen darunter: dem gewichteten Mittel ihrer Prozentsätze, mit der Dauer in Arbeitstagen als Gewicht. Ein Meilenstein hat das Gewicht 0.

Wenn Sie die Dauer eines Vorgangs ändern, der schon läuft, bleibt die geleistete Arbeit erhalten. Der Prozentsatz passt sich an: Ein Vorgang von 5 Arbeitstagen bei 60%, den Sie auf 10 Arbeitstage setzen, landet bei 30%. Die App lehnt eine Dauer ab, die kürzer ist als die schon geleistete Arbeit.

### Abgeschlossene und laufende Vorgänge

Ein abgeschlossener Vorgang ist an seine Ist-Werte gebunden. Er verschiebt sich nicht mehr. Mit einem Statusdatum ist er nie kritisch. Ohne Statusdatum kann ein abgeschlossener Vorgang noch kritisch sein.

Ein laufender Vorgang behält seinen Ist-Anfang. Nur die Restarbeit verschiebt sich. Wo die Restarbeit beginnt, hängt vom Fortschrittsmodus ab.

### Retained Logic und Progress Override

Was tut die App, wenn ein Vorgang schon begonnen hat, während sein Vorgänger noch läuft? Eine solche Beziehung heißt **Fortschritt außer Reihenfolge**: Der Fortschritt widerspricht der Reihenfolge. Denken Sie an den Maler, der schon einen Raum streicht, der verputzt wurde, während der Putzer noch anderswo arbeitet.

Zwei Fortschrittsmodi bestimmen, wie die App das berechnet:

- **Retained Logic** (der Standard): Die Beziehung bleibt in Kraft. Die Restarbeit des Nachfolgers folgt der Beziehung: Bei Ende-Anfang beginnt sie erst, wenn der Vorgänger fertig ist, und nie vor dem Statusdatum.
- **Progress Override**: Die Wirklichkeit gewinnt. Die Restarbeit des Nachfolgers beginnt am Statusdatum, ohne auf den Vorgänger zu warten.

In diesem Profil liegt der Unterschied nur in der Restarbeit von Vorgängen, die schon begonnen haben, während ihr Vorgänger noch nicht fertig ist. Andere Vorgänge werden in beiden Modi gleich berechnet. Die App meldet eine solche Beziehung in beiden Modi: in der Statusleiste als *1 Beziehung(en) außerhalb der Reihenfolge* und im Bereich *Warnungen*.

### Baselines und Abweichung

Beim Speichern erfasst die App für jeden Vorgang ohne Teilvorgänge den frühesten Anfang, das früheste Ende, die Dauer und die Meilensteinart. Sammelvorgänge sind nicht darin enthalten. Was Sie danach ändern, berührt die Baseline nicht. Sie können mehrere Baselines behalten; genau eine ist **aktiv**. Das Gantt-Diagramm, der Variance-Bericht und der Fortschrittsbericht verwenden die aktive Baseline.

Die **Abweichung** ist der Unterschied in Arbeitstagen zwischen der Baseline und dem aktuellen Terminplan. Ein Plus bedeutet später, ein Minus früher. Die App rechnet mit dem Kalender des Projekts. Der Variance-Bericht zeigt die Abweichung von Anfang und Ende pro Vorgang. Der Status ergibt sich nur aus dem Ende: *Später* bei einem Plus, *Früher* bei einem Minus, sonst *Im Plan*. Ein Vorgang, der nach der Baseline hinzugefügt wurde, heißt *Neu*; ein Vorgang, den es nicht mehr gibt, heißt *Entfallen*.

Zwei Hinweise. Die Abweichung Dauer steht in der Vorgangstabelle (Spalte *Abweichung Dauer*), nicht im Variance-Bericht. Sie vergleicht die geplante Dauer des Vorgangs jetzt mit der in der Baseline. Fortschritt ändert diese geplante Dauer nicht: Ein Vorgang, der mit zwei Tagen geplant war und drei Tage dauerte, hat daher eine Abweichung Ende von +1, aber eine Abweichung Dauer von 0. Und wenn Sie eine Baseline speichern, nachdem Fortschritt erfasst wurde, hält sie den Stand mit diesen Ist-Werten fest; die Abweichung ist dann null.

Der Fortschrittsbericht stellt den geplanten Fortschritt neben den Ist-Fortschritt. Beide sind nach Arbeitstagen gewichtet. Geplant ist der Anteil jedes Vorgangs, der laut Baseline am Statusdatum fertig sein sollte; Ist ist der Prozentsatz, der erfasst wurde.

### Wo Sie es sehen

Im Gantt-Diagramm markiert eine gestrichelte Linie das Statusdatum, mit dem Datum in der Kopfzeile. Bei jedem laufenden Vorgang biegt die Linie bis zu dem Punkt im Balken aus, den der Prozentsatz angibt. Das ist die **Fortschrittslinie**. Schalten Sie die Fortschrittslinie aus und lassen die Statusdatumslinie an, bleibt eine gerade Linie. Sind beide aus, verschwinden die Linie und die Beschriftung. Die Schaltflächen *Baseline-Overlay*, *Fortschrittslinie* und *Statusdatumslinie* stehen unter *Ansicht › Baselines & Fortschritt* und ändern nichts an der Berechnung. Die Baseline erscheint als dünner Balken unter jedem Vorgangsbalken. Die Vorgangstabelle hat Spalten für den Fortschritt und, pro Baseline, für die Abweichung. Auf dem Reiter *Bericht* finden Sie die Berichtstypen *Variance* und *Fortschrittsbericht*.

## Durchgerechnetes Beispiel: der Anbau nach drei Wochen

Das Beispiel ist das Übungsprojekt *House extension* aus den Tutorials, in dem Zustand nach dem Hinzufügen aller Beziehungen: ohne Bauferien, Ressourcen oder Stunden. In Tutorial 6 machen Sie das selbst im Übungsprojekt. Bis dahin enthält dieses Projekt mehr, daher unterscheiden sich dort die Zahlen. Hier lesen Sie, warum die Zahlen so sind, wie sie sind.

Der Anbau beginnt am Montag, 7. Juni 2027. Im berechneten Terminplan speichert die App eine Baseline mit dem Namen *Baseline*: Übergabe am Freitag, 6. August 2027, 45 Arbeitstage.

### Der Stand am Montag, 28. Juni

Das Statusdatum ist Montag, 28. Juni 2027. Dies ist geschehen:

- *Start of construction*, *Set up site*, *Clear garden and paving* und *Set out the extension* sind laut Plan fertig, vom 7. bis 10. Juni.
- *Excavate foundation trench* war mit 2 Arbeitstagen geplant (Freitag, 11., und Montag, 14. Juni) und dauerte 3: vom 11. bis 15. Juni.
- *Foundation formwork and reinforcement* läuft vom 16. bis 18. Juni. *Reinforcement inspection* ist am 18. Juni, *Pour foundation* am Montag, 21. Juni.
- *Foundation brickwork* (2 Arbeitstage) hat am Freitag, 25. Juni begonnen und ist zu 50%.

Nach **Berechnen** ermittelt die App Folgendes:

- Die Restarbeit von Foundation brickwork ist 2 × (1 − 0,5) = 1 Arbeitstag. Sie beginnt am Statusdatum und endet daher am Montag, 28. Juni.
- *Lay hollow-core floor* folgt am Dienstag, 29. Juni. Daher beginnt *Build inner cavity leaf* am Mittwoch, 30. Juni statt am Dienstag, 29. Juni. Die Übergabe ist am Montag, 9. August: einen Arbeitstag später als die Baseline. Der eine zusätzliche Tag bei der Ausschachtung ist daher die Verzögerung des ganzen Projekts, weil dieser Vorgang auf dem kritischen Pfad lag.
- Die Statusleiste zeigt *Kritischer Pfad: 13 Vorgänge, 46 Arbeitstage*, gegenüber 21 Vorgängen und 45 Arbeitstagen vor dem Fortschritt. Die acht abgeschlossenen Vorgänge, die auf dem kritischen Pfad lagen, zählen nicht mehr.
- Die Phase *Foundations* ist zu 77,8% fertig. Die Vorgänge darin haben das Gewicht 2 + 3 + 1 + 2 + 1 = 9 Arbeitstage. Fertig sind davon 2 + 3 + 1 Arbeitstage, plus die Hälfte von 2: insgesamt 7. Und 7 von 9 ist 77,8%. Der Meilenstein *Reinforcement inspection* hat das Gewicht 0.

Der Variance-Bericht stellt dies neben die Baseline:

- *Excavate foundation trench*: Anfang 0, Ende +1 (Ende in der Baseline 14. Juni, jetzt 15. Juni).
- *Foundation brickwork*: Anfang +1 (aus 24. Juni wird 25. Juni), Ende +1.
- *Build outer cavity leaf*: +1, +1. Dieser Vorgang ist noch nicht kritisch: Er hatte 2 Arbeitstage Puffer und behält sie.
- *Handover*: +1. Das Projektende weicht um 1 Arbeitstag ab.
- Insgesamt stehen 19 Vorgänge auf *Später* und 4 auf *Im Plan*; kein Vorgang steht auf *Früher*.

Der Fortschrittsbericht zeigt *Geplant* 28,3% und *Ist* 23,9%. Die Vorgänge haben zusammen ein Gewicht von 46 Arbeitstagen. Laut Baseline hätten 13 fertig sein sollen: 4 Arbeitstage bei der Vorbereitung, 2 für die Ausschachtung, 3 für die Bewehrung, 1 für den Betonguss, 2 für Foundation brickwork und 1 für hollow-core floor. Tatsächlich sind 11 fertig: 4 + 2 + 3 + 1, plus die Hälfte von 2 Arbeitstagen bei Foundation brickwork.

### Was passiert, wenn Sie das Statusdatum verschieben?

Derselbe Fortschritt, ein anderes Statusdatum. Die Restarbeit von Foundation brickwork beginnt immer am Statusdatum, daher wandert die Übergabe mit:

- Statusdatum Freitag, 25. Juni: Die Restarbeit fällt auf Freitag, 25. Juni, die Übergabe bleibt Freitag, 6. August.
- Montag, 28. Juni: Übergabe Montag, 9. August.
- Dienstag, 29. Juni: Übergabe Dienstag, 10. August, 2 Arbeitstage später als die Baseline.

### Was passiert, wenn Sie den Prozentsatz ändern?

Der Vorgang Foundation brickwork hat 2 Arbeitstage. Bei 0% oder 25% beträgt die Restarbeit 2 Arbeitstage: Sie endet am Dienstag, 29. Juni, und die Übergabe wird Dienstag, 10. August. Bei 50% oder 75% ist sie 1 Arbeitstag: Montag, 28. Juni, Übergabe Montag, 9. August. Bei 90% ergibt sich 0 als Restarbeit, und der Vorgang endet am Statusdatum.

### Was passiert, wenn Sie ein Statusdatum setzen, ohne Fortschritt zu erfassen?

Wenn Sie nur das Statusdatum auf Montag, 28. Juni setzen und nichts erfassen, ist laut Terminplan noch nichts geschehen. Arbeit, die noch nicht begonnen hat, kann nicht in der Vergangenheit liegen. Die App verschiebt daher alles auf den 28. Juni: *Start of construction* liegt dann an diesem Tag, und die Übergabe ist am Freitag, 27. August, 15 Arbeitstage nach der Baseline. Erfassen Sie deshalb zuerst den Fortschritt, der vorhanden ist.

## Rechenbeispiel: Verputzer und Maler

Jetzt ein Beispiel für den Fortschrittsmodus. Derselbe Anbau, ein anderer Stand: Es ist Mittwoch, 21. Juli 2027. Alles bis einschließlich *Install building services* ist laut Plan abgeschlossen. *Plastering* (4 Arbeitstage) hat am Dienstag, 20. Juli begonnen und ist zu 25 % fertig. *Painting* (3 Arbeitstage) folgt auf *Plastering*, aber der Maler hat heute schon begonnen und ist zu 33 % fertig.

Ohne Fortschritt war der Vorgang *Plastering* für Dienstag, 20. bis Freitag, 23. Juli geplant, der Vorgang *Painting* für Montag, 26. bis Mittwoch, 28. Juli. Die Statusleiste zeigt jetzt *1 Beziehung(en) außerhalb der Reihenfolge*: *Painting* hat begonnen, während *Plastering* noch nicht abgeschlossen ist. Im Bereich *Warnungen* steht: *Fortschritt außer Reihenfolge: der Fortschritt des Nachfolgers widerspricht der Beziehung*.

Der Vorgang *Plastering* hat 4 × (1 − 0,25) = 3 Arbeitstage Restarbeit: am 21., 22. und 23. Juli. Der Vorgang *Painting* hat 3 × (1 − 0,33) = 2 Arbeitstage Restarbeit.

- Mit **Retained Logic** kann diese Restarbeit erst beginnen, wenn *Plastering* abgeschlossen ist. Das ist Freitag, 23. Juli. *Painting* beginnt deshalb Montag, 26. Juli und endet Dienstag, 27. Juli. Der Balken läuft vom Ist-Anfang am 21. Juli bis zum 27. Juli. Der Gesamtpuffer beträgt 7 Arbeitstage.
- Mit **Progress Override** beginnt die Restarbeit am Statusdatum. *Painting* endet Donnerstag, 22. Juli, vor dem Abschluss von *Plastering*. Der Gesamtpuffer beträgt 10 Arbeitstage.

Die Übergabe bleibt in beiden Fällen Freitag, 6. August: *Painting* hatte ohnehin Puffer.

### Andere Berechnungsprofile

In den Profilen Primavera P6 und Microsoft Project endet *Painting* in diesem Beispiel an denselben Daten (27. und 22. Juli). Sie unterscheiden sich in den folgenden Punkten. Das sind Konventionen des Profils. Sie finden sie unter *Einstellungen › Projekt › Projekteinstellungen*, im Block *Berechnungsprofil und Berechnungsoptionen*.

- Im Profil Microsoft Project verschiebt sich ein Vorgang, der noch nicht begonnen hat, nicht zum Statusdatum (Konvention *Nicht begonnene Vorgänge nicht zum Statusdatum verschieben*). Wenn Sie im obigen Beispiel nur ein Statusdatum setzen und nichts erfassen, bleibt die Übergabe in diesem Profil Freitag, 6. August.
- Im Profil Microsoft Project beginnt die Restarbeit außerdem nicht früher als der Ist-Anfang plus die bereits verstrichene Zeit (Konvention *Restarbeit wird nach der verstrichenen Dauer fortgesetzt*). Das ist eine zusätzliche untere Grenze neben dem Statusdatum: Es gilt das spätere der beiden Daten. Nehmen Sie *Build inner cavity leaf* (5 Arbeitstage). Der Vorgang ist am Dienstag, 29. Juni gestartet und steht am Statusdatum Mittwoch, 30. Juni bei 40 %. Zwei Kolonnen mauern gleichzeitig, deshalb ist nach einem Tag schon 40 % erledigt. Alles davor ist laut Plan abgeschlossen. Open Planner Studio und Primavera P6 lassen den Vorgang am Freitag, 2. Juli enden. Microsoft Project lässt ihn am Montag, 5. Juli enden, weil Dienstag, 29. Juni plus 2 bereits verstrichene Arbeitstage Donnerstag, 1. Juli ergibt, und das liegt nach dem Statusdatum.
- In Primavera P6 zeigt der früheste Anfang eines laufenden Vorgangs den Beginn der Restarbeit, nicht den Ist-Anfang (im Beispiel *Build inner cavity leaf*: Mittwoch, 30. Juni). Die Spalte *Anfang* und der Balken zeigen in jedem Profil den Ist-Anfang.
- Im Profil Primavera P6 zählt bei Progress Override auch die Beziehung zu einem bereits begonnenen Nachfolger nicht für den Vorgänger: Sie begrenzt dessen späte Termine und seinen freien Puffer nicht mehr (Konvention *Progress Override ignoriert einen begonnenen Nachfolger auch rückwärts*). Im Rechenbeispiel Verputzer und Maler sehen Sie das nicht. *Plastering* ist ohnehin über den Estrich kritisch. Seine späten Termine und sein freier Puffer sind bei Retained Logic und bei Progress Override gleich.
- Wenn Sie eine .xer-Datei öffnen, übernimmt die App den Fortschrittsmodus aus der Datei. Actual Dates, der dritte P6-Modus, ist der App nicht bekannt. Eine solche Datei wird als Retained Logic berechnet.

## Folgen und Missverständnisse

**„Ich verschiebe das Statusdatum einfach weiter.“** Wenn Sie es verschieben, beginnt die Restarbeit laufender Vorgänge am neuen Datum. Vorgänge, die noch nicht begonnen haben, können nie vor diesem Datum liegen. Verschieben Sie das Statusdatum deshalb nur zusammen mit einer Aktualisierung des Fortschritts.

**„Eine Eingabe von 100 % erfasst das Ist-Ende.“** Das gilt nur, wenn Sie auch das Ist-Ende eingeben. Setzen Sie einen Vorgang auf 100 %, ohne Ist-Ende, dann wird sein Ende das Statusdatum. War er in Wirklichkeit früher fertig, tragen Sie das Ist-Ende ein.

**„0 % heißt nicht begonnen.“** Wenn ein Vorgang einen Ist-Anfang hat, gilt er als begonnen, auch bei 0 %. Die Restarbeit ist dann die volle Dauer und beginnt am Statusdatum. Löschen Sie den Ist-Anfang, dann gilt der Vorgang wieder als nicht begonnen.

**„Progress Override löst die Warnung.“** Die Meldung zu Fortschritt außer Reihenfolge bleibt bestehen. Der Modus bestimmt nur, wie die App rechnet. Ist die Beziehung nicht mehr richtig, ändern Sie die Beziehung.

**„Die Pause in einem geteilten Vorgang fällt weg.“** Nein. Eine Pause im Teil, der noch zu tun ist, bleibt in der Restarbeit. Nehmen Sie einen Vorgang von 5 Arbeitstagen mit einer Pause von 1 Tag nach 2 Arbeitstagen Arbeit. Er ist am Dienstag, 29. Juni gestartet und steht am Statusdatum Mittwoch, 30. Juni bei 40 %. Die Restarbeit von 3 Arbeitstagen beginnt am Statusdatum und läuft über die Pause. Das Ende ist Montag, 5. Juli. Ohne Pause wäre es Freitag, 2. Juli gewesen.

**Stunden und das Statusdatum.** Im Menüband können Sie keine Uhrzeit eingeben. Sie tragen das Statusdatum als Datum ein. Wenn Sie außerhalb der Arbeitszeiten den Stand erfassen, setzen Sie das Statusdatum auf den nächsten Arbeitstag. Ein Vorgang in Stunden berechnet die Restarbeit ab Beginn des Statusdatums. Nehmen Sie *Lay hollow-core floor* im Übungsprojekt nach Tutorial 4, zu dem Zeitpunkt, an dem alles davor abgeschlossen ist: 5 Stunden, am Montag, 28. Juni, Arbeitstag ab 07:00. Mit dem Statusdatum Montag, 28. Juni und dem Vorgang bei 40 % hat er 3 Stunden Restarbeit, von 07:00 bis 10:00, auch wenn an diesem Morgen schon gearbeitet wurde. Wie die App Stunden zählt, steht unter [Tage und Stunden](docs://uitleg-dagen-en-uren).

**Baseline aktualisieren.** Das ist nicht möglich. Sie speichern eine neue Baseline und löschen die alte. Wenn Sie ein Projekt verschieben, wandern die Ist-Werte und das Statusdatum mit, die Baselines standardmäßig nicht. So bleibt die Verschiebung als Abweichung sichtbar. Siehe [Projekt verschieben](docs://howto-project-verplaatsen).

## Siehe auch

- [Fortschritt aktualisieren](docs://howto-voortgang-bijwerken): das Statusdatum einstellen und Fortschritt erfassen.
- [Fortschritt aus einer Tabelle importieren](docs://howto-voortgang-importeren): Fortschritt von der Bauleitung in einem Schritt einlesen.
- [Fortschrittsmodus wählen](docs://howto-voortgangsmodus-kiezen): Retained Logic oder Progress Override einstellen.
- [Baseline speichern und verwalten](docs://howto-baseline-opslaan-en-beheren): eine Baseline erfassen und verwenden.
- [Projekt verschieben](docs://howto-project-verplaatsen): was mit Ist-Werten, Statusdatum und Baselines geschieht.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): warum ein Vorgang kritisch ist und was der Puffer bedeutet.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): Fortschritt und ein Statusdatum mitten im Projekt (20. Mai 2027).
