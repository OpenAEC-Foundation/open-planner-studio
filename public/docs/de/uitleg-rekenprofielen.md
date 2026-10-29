# Berechnungsprofile und Konventionen

Derselbe Terminplan kann andere Termine ergeben, je nachdem, welche Berechnungsregeln Sie anwenden. Dieser Artikel erklärt, warum Primavera P6 und Microsoft Project an einigen Punkten unterschiedlich berechnen. Er erklärt auch, wie die App diesen Unterschied in einem **Berechnungsprofil** festhält und wie sich ein Profil von den Berechnungsoptionen unterscheidet, die Sie selbst pro Projekt festlegen. Ein durchgerechnetes Beispiel mit einem kleinen Netzplan zeigt, was das für die Termine bedeutet.

## Das Konzept

Vorgänge, Beziehungen und ein Kalender bestimmen den größten Teil eines Terminplans, aber nicht alles. Was geschieht mit Vorgängen, die noch nicht begonnen haben, wenn Sie ein Statusdatum festlegen? Wo beginnt die Restarbeit eines Vorgangs, der schon läuft? Wie hoch ist der freie Puffer eines Vorgangs, wenn ein Stichtag verpasst wird? Der Netzplan sagt dazu nichts. Ein Terminplanungsprogramm muss dafür eine Regel wählen. Die App kennt eine Reihe von Punkten, an denen sich die Regel von Primavera P6 und die von Microsoft Project unterscheiden.

Die App nennt eine solche Wahl eine **Konvention**. Ein **Berechnungsprofil** ist die Menge der Konventionen, die zu einem Softwarepaket gehört. Die App hat drei:

- *Open Planner Studio*: das Profil, mit dem ein neues Projekt berechnet wird. Keine Konvention ist eingeschaltet.
- *Primavera P6*: die Konventionen, die die App von P6 kennt.
- *Microsoft Project*: die Konventionen, die die App von Microsoft Project kennt.

Das Profil sagt also, wie ein Softwarepaket berechnet. Was Sie für Ihr Projekt wollen, gehört nicht dazu. Das sind die **Berechnungsoptionen**: Entscheidungen wie etwa, wie wenig Puffer einen Vorgang kritisch macht, oder in welchem Kalender ein Zeitabstand zählt. Diese legen Sie pro Projekt fest.

## So berechnet die App

### Konventionen und Berechnungsoptionen

Eine Konvention ist ein Schalter: ein oder aus. Das Profil legt fest, welche Schalter eingeschaltet sind. Eine Berechnungsoption ist eine Wahl, die Sie treffen. Den Unterschied sehen Sie in der App selbst, im Block *Berechnungsprofil und Berechnungsoptionen*:

- **Konventionen** stehen unter *Konventionen dieses Profils*, nach Thema gruppiert, zum Beispiel *Fortschritt und abgeschlossene Arbeit*, *Beziehungen und Zeitabstand* und *Puffer und späte Termine*. Diese Gruppe ist am Anfang eingeklappt. Ihre Überschrift zeigt, wie viele Konventionen es gibt. Weicht das Profil davon ab, steht dort auch *geändert: 1*. Klicken Sie auf die Überschrift, um die Gruppe aufzuklappen. Bei einem eingebauten Profil trägt jede Zeile die Angabe *Ein* oder *Aus*. Diese Werte dienen nur zur Information und lassen sich nicht ändern. Bei einem eigenen Profil hat jede Zeile ein Kontrollkästchen mit dem Basiswert dahinter (*Basis: ein* oder *Basis: aus*). Weicht Ihre Wahl davon ab, fällt die Zeile auf, und *zurück zur Basis* erscheint. Das i-Symbol hinter einer Zeile zeigt die Erklärung dieser Konvention. Zeigen Sie mit der Maus darauf, gehen Sie mit der Tab-Taste dorthin, oder tippen Sie darauf. Lesen Sie die Erklärung zuerst, wenn Sie eine Konvention ändern wollen. Funktioniert eine Konvention nur bei Stundenplanung oder nur bei Vorgängen aus einer .xer-Datei, dann zeigt ein blaues Etikett neben der Zeile das an: *nur bei Stundenplanung* oder *nur Vorgänge aus .xer*. Stundenplanung bedeutet: ein Kalender mit Bändern für die Arbeitszeit, ein Vorgang, dessen Dauer in Stunden angegeben ist, oder der auf *24-Stunden* eingestellte *Abstandskalender*. Ein Projekt mit nur einem Tageskalender und Vorgängen in Tagen merkt von einer Konvention mit dem Etikett *nur bei Stundenplanung* nichts, außer wenn der Abstandskalender auf *24-Stunden* steht. Dann zählt ein Zeitabstand in Stunden, und eine Konvention über den Zeitabstand kann etwas ändern.
- **Berechnungsoptionen** stehen unter *Berechnungsoptionen dieses Projekts*: unter anderem *Kritisch-Definition*, *Pufferberechnung*, *Offene Vorgänge kritisch*, *Beinahe-kritisch markieren* und *Abstandskalender*. Die Optionen sagen, was Sie für dieses Projekt wollen, nicht, wie ein Programm rechnet. Was sie bewirken, steht in [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad) und [Beziehungen und Zeitabstand](docs://uitleg-relaties).

Je ein Beispiel. „Ein Vorgang ist kritisch, wenn sein Gesamtpuffer 0 oder weniger beträgt“ ist eine Berechnungsoption: Sie können die Schwelle auf 4 setzen. Dann ist alles mit 4 Arbeitstagen Puffer oder weniger kritisch. „Vorgänge, die nicht begonnen haben, rücken auf das Statusdatum“ ist eine Konvention: Open Planner Studio und Primavera P6 machen das, Microsoft Project nicht.

Das Profil und die Berechnungsoptionen gehören zur Projektdatei, nicht zur App. Wenn Sie das Projekt speichern, wandern sie mit. Zwei Projekte in derselben App können daher mit unterschiedlichen Profilen rechnen. Ein Projekt ohne Profil rechnet als Open Planner Studio.

Wenn Ihr Projekt aus einer .xer-Datei stammt, zeigt der Block unten auch *Einstellungen aus der Quelldatei*: Berechnungsoptionen, die nur Primavera P6 kennt und die die Datei mitgebracht hat. Sie können sie hier nicht ändern. Die Schaltfläche für die Standardeinstellungen und für ein anderes Profil lässt sie ebenfalls unverändert. Ein neues Projekt hat sie nicht, auch nicht mit *Primavera P6*.

### Wo Sie das Profil wählen

Bei einem neuen Projekt steht das Profil im Fenster *Neues Projekt*, das Sie über *Start › Datei › Neu* öffnen. Dort ist *Berechnungsprofil* eine Dropdown-Liste. Wählen Sie dort ein Profil, dann ersetzt die App die Berechnungsoptionen, die Sie schon eingetragen hatten, durch die Standardwerte dieses Profils. Nur Einstellungen aus einer Quelldatei bleiben. Mit *Primavera P6* wird *Pufferberechnung* dann *Endpuffer*. Mit *Microsoft Project* und *Open Planner Studio* hat jede Berechnungsoption ihren Standardwert, daher ist *Pufferberechnung* *Automatisch (Standard)*. Mit einem Statusdatum rechnet auch MS Project selbst so: ein begonnener Vorgang bekommt den Endpuffer, jeder andere Vorgang den kleineren Wert aus Anfangspuffer und Endpuffer.

Bei einem bestehenden Projekt wählen Sie das Profil unter *Einstellungen › Projekt › Projekteinstellungen*, im Block *Berechnungsprofil und Berechnungsoptionen*, in der Dropdown-Liste *Berechnungsprofil*. Sie erreichen dieselbe Stelle auch über *Datei › Projekteinstellungen*. Ein Profilwechsel hier ändert nur die Konventionen. Ihre Berechnungsoptionen bleiben, wie sie sind. Weichen Ihre Berechnungsoptionen vom Standard des Profils ab, zeigt ein oranger Block über den Optionen das an. Das ist oft absichtlich, zum Beispiel weil die Optionen aus der geöffneten Datei stammen. Wenn Sie trotzdem den Standard wollen, wählen Sie *Standardeinstellungen von … verwenden* in diesem Block. Das Kreuz blendet den Block für diese geöffnete Datei aus.

Solange Sie nicht auf *Anwenden* drücken, gilt eine Änderung nur im Formular. Mit *Anwenden* berechnet die App den Terminplan sofort neu, auch wenn *Automatisch berechnen* ausgeschaltet ist. Wenn Vorgänge verschoben wurden, nennt die App die Anzahl, zum Beispiel *Nach dem Anwenden wurden 4 Vorgänge verschoben.* Mit *Rückgängig* nehmen Sie den ganzen Wechsel in einem einzigen Schritt zurück. Drücken Sie *Rückgängig* oder *Wiederholen*, während das Fenster *Projekteinstellungen* geöffnet ist, dann folgt der Block dem Stand des Projekts. Haben Sie im Block schon selbst etwas geändert, bleibt Ihre Wahl bestehen. Ein gelber Block sagt dann, dass *Anwenden* diese Wahl wieder einsetzt.

Die drei eingebauten Profile lassen sich nicht ändern. Für andere Konventionen erstellen Sie ein eigenes Profil. Sie können es auch als Vorlage für andere Projekte in dieser App behalten. Das Projekt trägt immer seine eigene Kopie: Ändern Sie die Vorlage später, ändert sich das Projekt nicht mit. Die Schritte stehen in [Ein Berechnungsprofil auswählen oder erstellen](docs://howto-rekenprofiel-kiezen).

### Wann die App selbst ein Profil wählt

Wenn Sie eine Datei öffnen, schlägt die App anhand des Formats ein Profil vor:

- Eine .mpp-Datei (Microsoft Project) wird mit dem Profil *Microsoft Project* geöffnet.
- Eine .xer-Datei (Primavera P6) öffnet mit dem Profil *Primavera P6*.
- Eine Datei im Format *MS Project XML*, *Primavera P6 XML* oder *CSV (semikolon-getrennt)* öffnet mit *Open Planner Studio*, ohne Meldung zum Profil.
- Ihr eigenes Projekt (.ifc) öffnet mit dem Profil, das darin gespeichert ist.

Bei einer .mpp- oder .xer-Datei meldet die App das Profil: *Dieses Projekt rechnet als Microsoft Project. Ändern über Datei → Projektinfo → Berechnungsprofil und Berechnungsoptionen.* Mit der Schaltfläche *Berechnungsprofil öffnen* in der Meldung gelangen Sie direkt zu den Projekteinstellungen. Bei einer .xer-Datei ist diese Zeile die erste Detailzeile der Meldung beim Öffnen. Mehr zur Meldung finden Sie in [Öffnen einer Datei von Primavera P6 (.xer)](docs://howto-xer-openen) und [Öffnen einer Datei von MS Project (.mpp)](docs://howto-mpp-openen).

Bei einer .mpp-Datei setzt die App nur das Profil. Die Berechnungsoptionen bleiben leer, wie bei einem neuen Projekt mit dem Profil *Microsoft Project*: *Pufferberechnung* ist *Automatisch (Standard)*. Eine geöffnete .mpp-Datei und ein neues Projekt mit *Microsoft Project* rechnen den Puffer daher gleich.

## Durchgerechnetes Beispiel: ein Netzplan, drei Profile

Das Beispiel ist ein kleiner Netzplan. Der Kalender hat eine Arbeitswoche von Montag bis Freitag und in diesen Wochen keine freien Tage. Der Fortschrittsmodus ist Retained Logic (Standard). Der Projektstart ist Montag, 7. Juni 2027. Alle Vorgänge sind in Arbeitstagen angegeben.

- *Pour foundation*: 5 Arbeitstage, geplant ab Montag, 7. Juni.
- *Lay walls*: 5 Arbeitstage, nach *Pour foundation* (Ende-Anfang).
- *Order window frames*: 3 Arbeitstage, ohne Vorgänger, geplant ab Montag, 7. Juni.
- *Fit roof*: 2 Arbeitstage, nach *Lay walls* und nach *Order window frames*. Das Ende dieses Vorgangs ist die Übergabe.

Die Zahlen hat das Berechnungsmodul der App ermittelt. Sie lesen sie im Bereich *Eigenschaften* unter *CPM-Ergebnis* ab.

**Ohne Statusdatum und ohne Fortschritt rechnen die drei Profile diesen Netzplan gleich.** *Pour foundation* läuft von Montag, 7. bis Freitag, 11. Juni, *Lay walls* von Montag, 14. bis Freitag, 18. Juni und *Fit roof* am Montag, 21. und Dienstag, 22. Juni. Die Übergabe ist Dienstag, 22. Juni. *Order window frames* (Montag, 7. bis Mittwoch, 9. Juni) hat 7 Arbeitstage Gesamtpuffer.

Jetzt erfassen Sie den Status. Das Statusdatum ist Mittwoch, 9. Juni. Das Fundament hat am Montag, 7. Juni begonnen und steht bei 60 %. Die Restarbeit beträgt daher 2 Arbeitstage (5 × 40 %). *Order window frames* hat noch nicht begonnen. Wie Fortschritt und Statusdatum funktionieren, steht in [Fortschritt und Statusdatum](docs://uitleg-voortgang). Hier geht es um die Frage, was das Profil damit macht.

### Open Planner Studio

Die Restarbeit des Fundaments beginnt am Statusdatum: Mittwoch, 9. und Donnerstag, 10. Juni. Der früheste Anfang bleibt der Ist-Anfang, Montag, 7. Juni. Das früheste Ende ist Donnerstag, 10. Juni. *Lay walls* läuft von Freitag, 11. bis Donnerstag, 17. Juni und *Fit roof* am Freitag, 18. und Montag, 21. Juni.

*Order window frames* war für Montag, 7. Juni geplant, hat aber nicht begonnen. Vorgänge, die noch nicht begonnen haben, können nicht in der Vergangenheit liegen. Daher verschiebt die App den Vorgang auf das Statusdatum: von Mittwoch, 9. bis Freitag, 11. Juni, mit 4 Arbeitstagen Gesamtpuffer. Die Übergabe ist Montag, 21. Juni.

### Primavera P6

Alles ist wie bei Open Planner Studio, außer einem Punkt: Der früheste Anfang von *Pour foundation* ist Mittwoch, 9. Juni. Das ist der Beginn der Restarbeit, nicht der Ist-Anfang. Das geschieht durch die Konvention *Laufender Vorgang: frühester Anfang = Beginn der Restarbeit* in der Gruppe *Fortschritt und abgeschlossene Arbeit*. Das Ende und der Puffer ändern sich dadurch nicht. Die Übergabe ist Montag, 21. Juni.

### Microsoft Project

Hier unterscheiden sich die Termine. Zwei Konventionen in der Gruppe *Fortschritt wie in Microsoft Project* verursachen das.

*Nicht begonnene Vorgänge nicht zum Statusdatum verschieben*: *Order window frames* bleibt von Montag, 7. bis Mittwoch, 9. Juni, auch wenn das teilweise vor dem Statusdatum liegt. Der Gesamtpuffer ist 7 Arbeitstage.

*Restarbeit wird nach der verstrichenen Dauer fortgesetzt*: Die Restarbeit beginnt frühestens am Statusdatum und frühestens am Ist-Anfang plus der bereits verstrichenen Dauer. Bei 60 % von 5 Arbeitstagen sind 3 Arbeitstage erledigt. Montag, 7. Juni plus 3 Arbeitstage ist Donnerstag, 10. Juni. Das liegt nach dem Statusdatum, daher läuft die Restarbeit am Donnerstag, 10. und Freitag, 11. Juni. *Lay walls* läuft von Montag, 14. bis Freitag, 18. Juni und *Fit roof* am Montag, 21. und Dienstag, 22. Juni. Die Übergabe ist Dienstag, 22. Juni: einen Arbeitstag später als bei den beiden anderen Profilen.

### Was wäre, wenn

**Das Fundament steht bei 20 % statt bei 60 %.** Die Restarbeit beträgt dann 4 Arbeitstage. Bei allen drei Profilen endet das Fundament am Montag, 14. Juni, und die Übergabe ist Mittwoch, 23. Juni. Die Konvention von Microsoft Project für die Restarbeit macht hier keinen Unterschied: Montag, 7. Juni plus 1 verstrichener Arbeitstag ist Dienstag, 8. Juni, und das liegt vor dem Statusdatum. Eine solche Konvention ist eine untere Grenze, die die Restarbeit nur später beginnen lassen kann. *Order window frames* und der früheste Anfang bei Primavera P6 unterscheiden sich weiterhin, wie oben. Bei Microsoft Project hat *Order window frames* dann 8 Arbeitstage Gesamtpuffer.

**Sie legen nur ein Statusdatum fest und tragen keinen Fortschritt ein.** Bei Open Planner Studio und Primavera P6 rückt der ganze Netzplan auf Mittwoch, 9. Juni. Das Fundament läuft dann von Mittwoch, 9. bis Dienstag, 15. Juni, und die Übergabe wird Donnerstag, 24. Juni: zwei Arbeitstage später als ohne Statusdatum. Bei Microsoft Project bleibt alles, wo es war, und die Übergabe ist Dienstag, 22. Juni.

**Sie stellen ein Profil selbst zusammen.** Erstellen Sie unter Open Planner Studio ein eigenes Profil über *Neues Profil*. Es heißt *Kopie von Open Planner Studio*. Darin schalten Sie nur *Nicht begonnene Vorgänge nicht zum Statusdatum verschieben* ein. Bei 60 % Fortschritt behält das Fundament die Termine von Open Planner Studio (Ende Donnerstag, 10. Juni, Übergabe Montag, 21. Juni). *Order window frames* bleibt tatsächlich von Montag, 7. bis Mittwoch, 9. Juni, mit 6 Arbeitstagen Gesamtpuffer. Ein Profil ist also ein Bündel einzelner Schalter, und Sie können sie einzeln ändern.

**Eine Berechnungsoption statt einer Konvention.** Wenn Sie unter Open Planner Studio die *Kritisch-Definition* (*Gesamtpuffer ≤ Schwelle*) mit einer *Schwelle (Arbeitstage)* von 4 setzen, wird *Order window frames* kritisch, weil sein Gesamtpuffer genau 4 beträgt. Keine Termine ändern sich. Eine Berechnungsoption ist Ihre Wahl für das Projekt und unabhängig vom Profil.

**Ein verpasster Stichtag.** Geben Sie *Fit roof* einen Stichtag am Freitag, 18. Juni. Unter Open Planner Studio beträgt dann der Gesamtpuffer von *Fit roof* −1 Arbeitstag, und der freie Puffer ist ebenfalls −1. Unter Primavera P6 bleibt der Gesamtpuffer −1, aber der freie Puffer wird 0. Das bewirkt die Konvention *Freier Puffer nie negativ* in der Gruppe *Puffer und späte Termine*. Unter Microsoft Project sind beide −2, weil die Übergabe dort einen Tag später fällt. Wie ein Stichtag funktioniert, steht in [Einschränkungen und Stichtage](docs://uitleg-constraints).

## Folgen und Missverständnisse

**„Das Profil ist eine Einstellung der App.“** Nein. Das Profil und die Berechnungsoptionen gehören zum Projekt und stecken in der Datei. Nur die Vorlagen, die Sie behalten, gehören zur App. Ein Projekt behält immer seine eigene Kopie.

**„Wenn ich exportiere, geht mein Profil mit.“** Nur bei Ihrem eigenen Projektformat (.ifc). Wenn Sie in *MS Project XML*, *Primavera P6 XML* oder *CSV (semikolon-getrennt)* exportieren, steht das Profil nicht in der Datei. Von den Berechnungsoptionen schreibt der Export nach *MS Project XML* höchstens die kritische Schwelle. Die App warnt dafür nur bei einem Projekt, das aus einer .xer-Datei stammt. Bei einem Projekt, das Sie selbst erstellt haben, erhalten Sie keine Meldung. Die Datei wird dann als Open Planner Studio geöffnet, ohne Profilmeldung. Nehmen Sie das Beispiel mit dem Profil Microsoft Project und 60 % Fortschritt. Wenn Sie es nach *MS Project XML* exportieren und wieder öffnen, zeigt die App zuerst die Termine aus der Datei, mit der Übergabe am Dienstag, 22. Juni. Wenn Sie die App die Termine selbst neu berechnen lassen, wird daraus Montag, 21. Juni. Was ein Export sonst noch verliert, steht unter [Dateien und Formate](docs://uitleg-bestanden).

**„Das Profil Primavera P6 liefert dasselbe Ergebnis wie P6.“** Das kann die App nicht zusagen. Das Profil schaltet die Konventionen ein, die die App von P6 kennt. Diese Konventionen sind aber nicht alle Einstellungen von P6. Neben Retained Logic und Progress Override hat P6 einen dritten Fortschrittsmodus, Actual Dates. Die App kennt ihn nicht. Eine solche .xer-Datei rechnet deshalb mit Retained Logic. Die Meldung beim Öffnen sagt das, zum Beispiel als *1 P6-Planungseinstellung mit sicherem Rückfall*. Einige Konventionen des Profils Primavera P6 wirken außerdem nur bei Vorgängen aus einer .xer-Datei, etwa *Nicht begonnene LOE übernimmt das Zielfenster* und *Istdaten exakt übernehmen*. Bei einigen steht in der Erklärung dazu: „nur Vorgänge mit P6-Herkunft“. Bei Vorgängen, die Sie selbst erstellen, bewirken diese Konventionen nichts.

**„Der Fortschrittsmodus gehört zum Profil.“** Nein. Retained Logic oder Progress Override wählen Sie pro Projekt separat. Sie stellen ihn unabhängig vom Profil ein, siehe [Fortschrittsmodus wählen](docs://howto-voortgangsmodus-kiezen). Eine Konvention des Profils Primavera P6, *Progress Override ignoriert einen begonnenen Nachfolger auch rückwärts*, wirkt nur bei Progress Override.

**„Ich wechsle einfach das Profil, dann sehe ich, was passiert.“** Das können Sie, denn *Anwenden* lässt sich mit *Rückgängig* in einem Schritt zurücknehmen: Profil und Termine gehen gemeinsam zurück. Aber die Termine können sich wirklich verschieben. Im Beispiel verschiebt der Wechsel von Open Planner Studio zu Microsoft Project alle 4 Vorgänge. Die Meldung zählt sie für Sie. Prüfen Sie danach den Terminplan, bevor Sie weitermachen. Zeigt die App nach dem Öffnen einer .xer- oder .mpp-Datei noch die Termine aus der Datei, dann verlässt ein Profilwechsel diese Ansicht, und die App berechnet selbst. Wie das funktioniert, steht unter [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen).

**Das Beispiel zeigt vier Konventionen, die Liste in der App ist länger.** Jede Zeile im Block hat eine eigene Erklärung. Lesen Sie sie zuerst. Schauen Sie sich außerdem die Gruppe *Nur für eigene Profile* an. Diese Konventionen sind in jedem eingebauten Profil ausgeschaltet, auch im Profil Primavera P6. Nur ein eigenes Profil kann sie einschalten: Erstellen Sie eins mit *Neues Profil*.

## Siehe auch

- [Berechnungsprofil wählen oder aufbauen](docs://howto-rekenprofiel-kiezen): ein Profil wählen, wechseln oder aufbauen.
- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): was das Statusdatum und die Restarbeit bewirken, mit den Unterschieden je Profil.
- [Fortschrittsmodus wählen](docs://howto-voortgangsmodus-kiezen): Wahl zwischen Retained Logic und Progress Override.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): die Berechnungsoptionen für kritische Vorgänge und Puffer.
- [Beziehungen und Zeitabstände](docs://uitleg-relaties): die Berechnungsoption *Abstandskalender*.
- [Dateien und Formate](docs://uitleg-bestanden): was ein Export mitnimmt und was nicht.
- [Exportieren](docs://howto-exporteren): ein Projekt exportieren.
- [Fortschritt aktualisieren](docs://howto-voortgang-bijwerken): Prozentsatz, Ist-Anfang und Statusdatum eingeben.
- [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen): warum importierte Termine von dem abweichen können, was die App selbst berechnet.
- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): alle Konventionen und Berechnungsoptionen in einer Liste.
