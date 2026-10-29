# Arbeitszeiten festlegen

Ziel: Legen Sie pro Wochentag fest, zu welchen Uhrzeiten ein Kalender arbeitet, damit Vorgänge in Stunden zur richtigen Zeit ablaufen.

## Wann Sie das brauchen

Der Freitagnachmittag ist arbeitsfrei. Die Kolonne arbeitet von 06:00 bis 22:00 in zwei Schichten. Es gibt eine Nachtkolonne. Die Pause dauert weniger als eine Stunde. Solange Sie nur in Tagen planen, reichen *Beginn (Stunde)*, *Ende (Stunde)* und die Pause aus ([Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen)). Wenn Sie Vorgänge in Stunden planen, zählt die App die Arbeitsminuten innerhalb der **Bänder** des Kalenders. In der App heißen sie *Bänder*: Ein Band ist ein durchgehender Abschnitt Arbeitszeit an einem Wochentag, und eine Lücke zwischen zwei Bändern ist eine Pause. Was das für Ihren Terminplan bedeutet, steht in [Tage und Stunden](docs://uitleg-dagen-en-uren).

Damit ein normaler Kalender Bänder bekommt, brauchen Sie *Stundenplanung aktivieren* ([Stundenplanung einschalten](docs://howto-urenplanning-aanzetten)). Hat der Kalender schon Bänder, zum Beispiel aus einer Datei von MS Project, dann ist der Block *Arbeitszeiten* immer da. Auch bei ausgeschalteter Stundenplanung ändern Sie die Bänder dann dort.

## Schritte

### Eine Schichtvoreinstellung wählen

1. Wählen Sie *Planung › Kalender › Kalender* und wählen Sie den Kalender links aus.
2. Klicken Sie im Block *Arbeitszeiten* auf eine Voreinstellung. Sie ersetzt die Arbeitstage und Arbeitszeiten des Kalenders.
3. Klicken Sie auf *Anwenden*.

Jede Voreinstellung macht Folgendes:

- *Tagschicht*: Montag bis Freitag von 08:00 bis 16:00 ohne Pause. Damit wird der Kalender wieder zu einem normalen Kalender, ohne Bänder.
- *2 Schichten*: Montag bis Freitag von 06:00 bis 14:00 und von 14:00 bis 22:00, insgesamt 16 Stunden.
- *3 Schichten*: Montag bis Freitag drei Schichten, von 06:00 bis 14:00, von 14:00 bis 22:00 und von 22:00 bis 06:00 am nächsten Tag, insgesamt 24 Stunden.
- *Nachtschicht*: Montag bis Freitag von 22:00 bis 06:00 am nächsten Tag, 8 Stunden.
- *24/7*: alle sieben Tage von 00:00 bis 24:00.

### Arbeitszeiten pro Wochentag festlegen

1. Klicken Sie im Block *Arbeitszeiten* auf *Pro Wochentag festlegen…*. Unter den Schaltflächen erscheint pro Wochentag eine Zeile mit der Arbeitszeit dieses Tages. Der Kalender hat dann pro Wochentag Bänder. Hat der Kalender sie schon, ist diese Übersicht sofort geöffnet. Die Schaltfläche heißt dann *Arbeitszeiten ausblenden* und klappt sie wieder zu.
2. Passen Sie in den beiden Zeitfeldern Beginn und Ende jedes Bandes an. Geben Sie die Uhrzeit ein und drücken Sie Enter, oder nutzen Sie die Pfeile (je Schritt 15 Minuten). Die Felder richten sich nach dem *Uhrzeitformat* in den Einstellungen. *13:00* und *1:00 PM* funktionieren beide.
3. Wenn Sie eine Pause einbauen möchten, klicken Sie für diesen Tag auf **+** (*Band hinzufügen*) und passen Sie die Zeiten der Bänder so an, dass zwischen ihnen eine Lücke liegt. Ein neues Band beginnt um 08:00 und endet um 16:00.
4. Bei einem Band, das über Mitternacht läuft, kreuzen Sie das Kästchen *nächster Tag* an. Das Band zählt für den Tag, an dem es beginnt.
5. Klicken Sie auf den Papierkorb hinter einem Band, um es zu entfernen. Ein Tag ohne Bänder zeigt *Arbeitsfrei* an.
6. Klicken Sie bei einem Tag von Montag bis Freitag auf das Kopiersymbol (*Auf alle Arbeitstage kopieren*), um die Bänder dieses Tages auf Montag bis Freitag zu übertragen.
7. Oberhalb des Blocks *Arbeitszeiten* steht *Standard-Arbeitstag*. Das ist die Arbeitszeit pro Tag, die die App aus den Bändern ableitet und damit rechnet. Die Zahl folgt sofort, wenn Sie die Bänder ändern. Hat der Kalender eigene Stunden pro Tag, zum Beispiel aus Primavera P6, dann bleibt dieser eigene Wert erhalten. Er wird beim Export mitgegeben, bis eine Voreinstellung ihn ersetzt. Weicht dieser eigene Wert vom *Standard-Arbeitstag* ab, dann erscheint direkt unter der Zahl ein orangefarbenes Hinweisfeld, zum Beispiel: *Die Datei hat einen eigenen Arbeitstag von 8h. Er wird beim Export nach MS Project und P6 übernommen. Dort zählt ein Tag 8h, hier 10h.* Das Hinweisfeld verschwindet, sobald die Bänder dieselbe Tagessumme ergeben oder eine Voreinstellung den eigenen Wert ersetzt. Das Hinweisfeld ändert die Berechnung nicht. Klicken Sie auf *Anwenden*.

**Beispiel: ein freier Freitagnachmittag.** Klicken Sie auf *Pro Wochentag festlegen…*. Entfernen Sie das zweite Band (13:00 bis 16:00) für *Fr*. Freitag hat jetzt 5 Stunden, die anderen Tage 8. Der *Standard-Arbeitstag* bleibt 8 Stunden.

### Eine eigene Voreinstellung speichern

1. Klicken Sie auf *Als Voreinstellung speichern…* und geben Sie im Feld *Name der Voreinstellung* einen Namen ein.
2. Klicken Sie auf *Speichern*. Die Voreinstellung erscheint jetzt unter den anderen Voreinstellungen, und Sie können sie in jedem Projekt verwenden. Mit dem Kreuz daneben entfernen Sie sie wieder.

Eine eigene Voreinstellung wird auf diesem Gerät gespeichert, nicht in der Projektdatei.

## Fallstricke und was die App dann tut

**Eine Voreinstellung ersetzt alles.** Wenn Sie eine Voreinstellung wählen, verschwinden die Arbeitstage und Arbeitszeiten, die Sie vorher festgelegt haben. Die Feiertage bleiben erhalten.

**Tagesschaltflächen ändern die Bänder.** Wenn Sie unter *Arbeitstage* einen Tag ausschalten, verschwinden die Bänder dieses Tages. Schalten Sie ihn wieder ein, bekommt er die Bänder zurück, die er beim Öffnen des Dialogs hatte (oder nach der letzten Voreinstellung). Sonst bekommt er die des ersten Arbeitstags. *Mo–Fr* macht das für Montag bis Freitag und entfernt die Bänder von Samstag und Sonntag. *Durchgehend (24/7)* ersetzt alle Bänder: Jeder Tag bekommt 00:00 bis 24:00.

**Arbeitszeiten anpassen bei ausgeschalteter Stundenplanung.** Ein Kalender mit Bändern behält den Block *Arbeitszeiten*, auch wenn Sie die Stundenplanung ausschalten. Dort ändern Sie einfach die Bänder. Wenn Sie *Tagschicht* wählen, wird er wieder ein normaler Kalender mit den Feldern *Beginn (Stunde)*, *Ende (Stunde)* und der Pause. Bänder wieder einzutragen geht dann nur mit eingeschalteter Stundenplanung.

**Keine brauchbaren Arbeitszeiten.** Ein Kalender ohne Bänder oder ohne Arbeitstage kann einen Vorgang nicht in Stunden planen. Die App meldet dann *Dieser Kalender hat keine gültigen Arbeitszeiten. Prüfen Sie Arbeitstage und Arbeitszeiten.*

## Siehe auch

- [Tage und Stunden](docs://uitleg-dagen-en-uren): wie die App Arbeitszeiten zählt und wie sie den Standard-Arbeitstag ableitet.
- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): einen Vorgang in Stunden planen.
- [Kalender und Arbeitstage](docs://uitleg-kalenders): welcher Kalender für welchen Vorgang gilt.
- [Kalenderfenster](docs://ref-kalenders): alle Felder der Kalenderfenster.
