# Termine wie aufgezeichnet

Sie öffnen einen Terminplan aus Primavera oder MS Project, und die Termine weichen von dem ab, was Sie im anderen Programm gesehen haben. Ist der Import schiefgelaufen? Meistens nicht. In diesem Artikel lesen Sie, warum die App selbst neu berechnet, wann sie die Termine aus der Datei zeigt, was dann leer bleibt und wie Sie zur eigenen Berechnung zurückkehren. Das Beispiel am Ende verfolgt zwei Vorgänge durch den ganzen Ablauf.

## Das Konzept

Eine Datei mit einem Terminplan enthält zwei Arten von Daten. Erstens die Logik: Vorgänge, Dauern, Beziehungen, Kalender und Einschränkungen. Zweitens die Termine, die das andere Programm selbst daraus berechnet hat. Beim Öffnen verwendet Open Planner Studio die Logik und berechnet selbst. Die Termine in der Datei sind also keine Eingabe.

Wenn die eigene Berechnung zu anderen Terminen führt als in der Datei steht, wissen Sie nicht, welche Seite richtig ist. Die Datei kann Logik auslassen, die das andere Programm verwendet hat. Das andere Programm kann an einem Punkt auch anders rechnen als die App. Deshalb kann die App die Termine **wie aufgezeichnet** zeigen: die Termine, die das andere Programm in die Datei geschrieben hat. So vergleichen Sie mit dem, was Sie im anderen Programm gesehen haben.

## Wie die App damit umgeht

### Welches Berechnungsprofil die App verwendet

Die App berechnet mit einem **Berechnungsprofil**: einer Gruppe von Berechnungsregeln (Konventionen), die zum Beispiel bestimmt, wie sie den geplanten Anfang eines Vorgangs und Einschränkungen behandelt. Siehe [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen). Es gibt drei eingebaute Profile: *Primavera P6*, *Microsoft Project* und *Open Planner Studio*. Eine `.xer`-Datei öffnet sich mit *Primavera P6* und eine `.mpp`-Datei mit *Microsoft Project*. CSV, MS Project XML und Primavera P6 XML öffnen sich mit *Open Planner Studio*. Das Profil eines Projekts finden Sie unter *Datei › Projekteinstellungen*, bei *Berechnungsprofil und Berechnungsoptionen*. Eine IFC-Datei aus der App behält ihr Profil.

### Wann die App vergleicht

Beim Öffnen hält die App fest, was die Datei sagt, und vergleicht das mit ihrem eigenen Ergebnis. Das gilt für:

- eine Primavera-Datei (`.xer`) und Primavera P6 XML;
- MS Project XML und MS-Project-Dateien (`.mpp`);
- eine IFC-Datei aus einem anderen Programm, für die Vorgänge, deren frühe Termine in der Datei stehen;
- eine IFC-Datei aus der App selbst, die ihre Herkunft gespeichert hat. Unten lesen Sie, wann das der Fall ist.

Die App vergleicht nie eine CSV-Datei: Der Anfangstermin in einer CSV ist Eingabe und kein Ergebnis einer Berechnung. Auch eine IFC-Datei aus der App selbst ohne gespeicherte Herkunft wird nicht verglichen.

Wenn kein Vorgang abweicht, merken Sie nichts. Wenn mindestens ein Vorgang in einer Datei abweicht, die Sie gerade importieren, schaltet die App die Ansicht sofort ein.

Bei einer Primavera-Datei berechnet die App mit dem Berechnungsprofil *Primavera P6*. Dadurch bleibt der geplante Anfang aus der Datei als frühester Anfang erhalten. Ein Vorgang, der in der Datei später liegt, als die Beziehungen verlangen, aber dort ebenfalls geplant ist, bleibt deshalb, wo er ist: Dann gibt es keinen Unterschied.

### Was Sie sehen

Unter dem Menüband steht eine Leiste: *Sie sehen die Termine so, wie sie in der Datei aufgezeichnet sind; eine Neuberechnung würde 4 Vorgänge verschieben.* Bei einer Primavera-Quelle (einer `.xer`-Datei oder Primavera P6 XML) steht dort *Sie sehen den Terminplan so, wie Primavera ihn gespeichert hat; eine Neuberechnung würde 1 Vorgang verschieben.* Rechts in der Leiste steht die Schaltfläche *Neu berechnen*. Die Leiste hat kein Kreuz.

Außerdem erscheint eine Meldung: *12 Vorgänge zeigen die in der Datei gespeicherten Termine (nicht neu berechnet).* Nur bei einer `.xer`-Datei steht dort *12 Vorgänge zeigen die von Primavera gespeicherten Termine (nicht neu berechnet).* Diese Zahl zählt jeden Vorgang, für den die Datei Termine aufgezeichnet hat, auch die Vorgänge, die sich nicht unterscheiden. Die Zahl der Vorgänge, die sich nach dem Neuberechnen unterscheiden, steht in der Leiste. Jeder Vorgang, für den die Datei Termine aufgezeichnet hat, zeigt im Bereich *Eigenschaften* direkt über *Anfang* eine orangefarbene Markierung: *Sie sehen die Termine, die Primavera gespeichert hat, nicht die Berechnung der App.* Bei einer anderen Quelle steht dort *Sie sehen die Termine, die in der Datei standen, nicht die Berechnung der App.* Eine zweite Zeile sagt, was beim Neuberechnen mit diesem Vorgang passiert: *Wenn Sie neu berechnen, ändert sich dieser Vorgang.* oder *Wenn Sie neu berechnen, bleibt dieser Vorgang gleich.* Das Gantt-Diagramm, die Vorgangstabelle und die Statusleiste zeigen die Termine aus der Datei.

### Vorgänge, die begonnen haben oder abgeschlossen sind

Ein abgeschlossener Vorgang liegt auf den Tagen, an denen er wirklich stattgefunden hat: vom *Ist-Anfang* bis zum *Ist-Ende*. Ein laufender Vorgang beginnt an dem Tag, an dem er wirklich begonnen hat. Er endet am berechneten Ende. Das gilt in dieser Ansicht, nach dem Neuberechnen und bei jedem Berechnungsprofil, wie bei Primavera und MS Project.

Für einen solchen Vorgang zeichnet die Datei oft andere frühe Termine auf. Primavera setzt den frühesten Anfang eines laufenden oder abgeschlossenen Vorgangs auf das Statusdatum. Diese Termine sehen Sie in den Spalten *Frühester Anfang* und *Frühestes Ende*, nicht in *Anfang* und *Ende*. Ein abgeschlossener Vorgang zählt daher nie als Abweichung. Ein laufender Vorgang zählt nur, wenn sein Ende abweicht.

Bei einem Vorgang, der begonnen hat, können Sie den Anfang nicht mehr eintippen. In der Vorgangstabelle, im Bereich *Eigenschaften* und im Dialog *Vorgang bearbeiten* ist der Anfang dann schreibgeschützt. Bei einem abgeschlossenen Vorgang gilt das in der Vorgangstabelle auch für das Ende. Ändern Sie stattdessen den *Ist-Anfang* oder das *Ist-Ende* mit dem Fortschritt. Im Gantt-Diagramm bewegt sich der Balken eines solchen Vorgangs nicht; dann erhalten Sie eine Meldung.

### Was in dieser Ansicht leer bleibt

In dieser Ansicht berechnet die App nichts. Sie zeigt nur, was die Datei aufgezeichnet hat. Puffer und kritischen Pfad sehen Sie daher nur, wenn die Datei sie enthält. Wenn die Datei keine kritischen Vorgänge aufzeichnet, meldet die Statusleiste 0 kritische Vorgänge. Das sagt nichts über den kritischen Pfad im Quellpaket selbst aus. Was nur aus einer Berechnung kommt, gibt es in dieser Ansicht nicht: welche Beziehungen den Terminplan steuern, verletzte Einschränkungen, Vorgänge, die außer Reihenfolge laufen, und fast kritische Vorgänge.

Wenn die Datei nicht alles für einen Vorgang aufzeichnet, bekommt die orangefarbene Markierung im Bereich *Eigenschaften* eine dritte Zeile, zum Beispiel *Primavera hat für diesen Vorgang nicht alles gespeichert. Fehlt: freier Puffer.* Bei einer anderen Quelle steht dort *Die Datei enthält nicht alles für diesen Vorgang.* Die ersten beiden Zeilen bleiben stehen. So sehen Sie auch bei einem solchen Vorgang, dass die Termine aus der Datei stammen und ob sich der Vorgang beim Neuberechnen ändert. Die fehlenden Werte haben dieselben Namen wie die Spalten in der Vorgangstabelle. Bei einem CSV-Export bleiben bei einem solchen Vorgang die Spalten *Kritisch* und *Gesamtpuffer* leer, statt einer erfundenen Null.

### Die Ansicht verlassen

Sie verlassen die Ansicht auf zwei Arten:

- Klicken Sie in der Leiste auf *Neu berechnen* oder wählen Sie *Berechnen* (F5). Die App berechnet nach ihren eigenen Regeln.
- Ändern Sie etwas, das die Termine ändern kann, zum Beispiel die Dauer eines Vorgangs oder einen neuen Vorgang. Die App verlässt die Ansicht und berechnet sofort neu, auch wenn *Automatisch berechnen* ausgeschaltet ist. Einen Namen, eine Beschreibung, eine Arbeitskategorie oder eine Vorgangsart zu ändern, bewirkt das nicht: Die Ansicht bleibt eingeschaltet.

Eine Kalenderänderung aus der Ressourcenbibliothek lässt die Ansicht eingeschaltet und die Termine aus der Datei stehen, aktualisiert aber die Zahl in der Leiste.

Nach dem Verlassen gibt es keine Schaltfläche, um zur Ansicht zurückzukehren. *Strg+Z* bringt sie aber zurück, direkt nach dem Neuberechnen oder direkt nach einer solchen Änderung. Sonst können Sie die Quelldatei erneut öffnen. Bei einer `.xer`-Datei schaltet auch das erneute Öffnen einer IFC-Datei die Ansicht wieder ein, die Sie nach dem Neuberechnen gespeichert, aber nicht geändert haben.

### Wiederherstellung nach einem Absturz

Wenn Sie ein Projekt nach einem Absturz wiederherstellen, das in der Ansicht war, bleibt die Ansicht eingeschaltet. War die Ansicht ausgeschaltet, vergisst die App die Termine aus der Datei. Das aktive Projekt zeigt dieselbe Leiste wie zuvor. Ein Projekt auf einer anderen Registerkarte zeigt die Leiste ohne Zahl: *Sie sehen die Termine so, wie sie in der Datei aufgezeichnet sind. Es wurde nicht neu berechnet.* Siehe [Wiederherstellung nach einem Absturz](docs://howto-herstellen-na-een-crash).

### Speichern und erneut öffnen

Wenn Sie speichern, während Sie die Ansicht verwenden, schreibt die App die angezeigten Termine zusammen mit dem Quellformat in die IFC-Datei. Wenn Sie diese IFC-Datei später erneut öffnen, ist die Ansicht wieder eingeschaltet, ohne neue Meldung. Das gilt auch, wenn Sie in der Ansicht etwas geändert haben, das die Termine nicht beeinflusst, zum Beispiel einen Namen. Die App öffnet die Datei so, wie Sie sie verlassen haben.

Wenn Sie die Ansicht durch Neuberechnen oder durch eine Änderung verlassen, die die Termine ändern kann, und danach speichern, enthält die Datei die eigene Berechnung der App. Beim erneuten Öffnen sehen Sie diese Berechnung, ohne Leiste und ohne Markierung im Bereich *Eigenschaften*. Es gibt eine Ausnahme: eine `.xer`-Datei, die Sie nur neu berechnet und nicht bearbeitet haben (siehe oben). Ihr bearbeiteter Terminplan ist jetzt der Terminplan; die alten Termine aus dem Quellpaket gehören nicht mehr dazu. Wenn Sie sie trotzdem sehen wollen, öffnen Sie die Quelldatei erneut.

## Beispiel: der Anbau

Angenommen, Sie öffnen eine Primavera-Datei *Uitbouw* (Anbau) mit zwei Vorgängen, in einem Kalender ohne Feiertage. Im Jahr 2027 sind der 6. Mai Christi Himmelfahrt und der 17. Mai Pfingstmontag: Mit Feiertagen im Kalender kämen die Termine anders heraus. *Fundering storten* (Fundament gießen) dauert 5 Arbeitstage, *Metselwerk* (Mauerwerk) 10 Arbeitstage, und Metselwerk folgt auf Fundering mit einer Ende-Anfang-Beziehung. Die Datei zeichnet auf, dass Fundering von Montag, 3. Mai, bis Freitag, 7. Mai 2027 läuft und Metselwerk von Montag, 17. Mai, bis Freitag, 28. Mai 2027: eine Woche nach dem frühesten Anfang, den die Beziehung erlaubt. Der geplante Anfang von Metselwerk in der Datei ist Montag, 10. Mai 2027.

Direkt nach dem Öffnen sehen Sie die Termine aus der Datei. Die Statusleiste zeigt *Ende: 28.05.2027* und *Kritischer Pfad: 2 Vorgänge, 20 Arbeitstage*. Die Leiste meldet, dass 1 Vorgang beim Neuberechnen abweicht. Beide Vorgänge zeigen die orangefarbene Markierung *Sie sehen die Termine, die Primavera gespeichert hat, nicht die Berechnung der App.* Darunter steht bei Metselwerk *Wenn Sie neu berechnen, ändert sich dieser Vorgang.* und bei Fundering *Wenn Sie neu berechnen, bleibt dieser Vorgang gleich.*

Nach einem Klick auf *Neu berechnen* bleibt Fundering am 3. bis 7. Mai. Metselwerk beginnt nun am Montag, 10. Mai, dem nächsten Arbeitstag nach dem Ende von Fundering, und endet am Freitag, 21. Mai. Der Terminplan endet am 21. Mai 2027 und umfasst 15 Arbeitstage statt 20. Der kritische Pfad besteht aus denselben 2 Vorgängen.

Und wenn es anders ist?

- Ist Metselwerk in der Datei auch auf Montag, 17. Mai, geplant, dann behält das Berechnungsprofil *Primavera P6* diesen Anfang. Die Berechnung ergibt den Zeitraum 17. bis 28. Mai, es gibt keinen Unterschied und die Ansicht schaltet sich nicht ein.
- Sie fügen in der Ansicht einen Vorgang hinzu: dieselbe Neuberechnung. Metselwerk verschiebt sich auf den 10. bis 21. Mai.
- Sie speichern in der Ansicht und öffnen die IFC-Datei erneut, ohne etwas zu bearbeiten: Metselwerk steht wieder auf dem 17. bis 28. Mai.
- Sie berechnen neu, speichern ohne weitere Bearbeitung und öffnen die IFC-Datei erneut: Die Ansicht ist wieder eingeschaltet, und Metselwerk steht auf dem 17. bis 28. Mai.
- Sie ändern in der Ansicht nur den Namen von Metselwerk, speichern und öffnen erneut: Die Ansicht ist wieder eingeschaltet, und Metselwerk steht auf dem 17. bis 28. Mai.
- Sie fügen in der Ansicht einen Vorgang hinzu, speichern und öffnen erneut: Die App vergisst die Termine aus der Datei. Metselwerk steht auf dem 10. bis 21. Mai, ohne Leiste und ohne Markierung.
- Fundering ist in der Datei schon abgeschlossen: Es hat tatsächlich am 3. Mai begonnen und am 7. Mai geendet. Die Datei zeichnet das Statusdatum als frühesten Anfang auf. Der Balken von Fundering bleibt auf dem 3. bis 7. Mai, in der Ansicht und nach dem Neuberechnen. Fundering zählt nicht als Abweichung.

## Folgen und Missverständnisse

**Ein Unterschied ist kein Importfehler.** Die App berechnet nach ihren eigenen Regeln: bei einer `.xer`-Datei mit dem Berechnungsprofil *Primavera P6*, bei einer `.mpp`-Datei mit *Microsoft Project*, bei CSV, MS Project XML und Primavera P6 XML mit *Open Planner Studio*. Warum die Termine im Quellpaket anders herauskamen, kann an der Datei oder am Paket liegen. Die Ansicht zeigt Ihnen, *dass* sie abweichen.

**Die Ansicht ist kein Berechnungsergebnis.** Die App hat die Termine nicht berechnet. Übernehmen Sie sie nicht einfach als Ergebnis Ihres eigenen Terminplans.

**Speichern in der Ansicht behält die Termine des Quellpakets.** Die IFC-Datei enthält dann, was das Quellpaket sagte, und nicht, was die App berechnen würde.

**Nach einer Bearbeitung, die die Termine ändern kann, kommen die Termine aus der Datei nicht zurück.** Wenn Sie die Ansicht durch so eine Bearbeitung verlassen haben, sehen Sie nach dem Speichern und erneuten Öffnen nur die eigene Berechnung der App. Eine Namensänderung zählt nicht: Dann bleibt die Ansicht eingeschaltet (siehe *Speichern und erneut öffnen*). Öffnen Sie die Quelldatei erneut, wenn Sie die Termine aus dem Quellpaket sehen wollen.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): was die App in einer Datei behält und was ein Import oder Export mitbringt.
- [Eine Primavera P6-Datei (.xer) öffnen](docs://howto-xer-openen): die Schritte und Meldungen für eine `.xer`-Datei.
- [Eine MS-Project-Datei (.mpp) öffnen](docs://howto-mpp-openen): die Schritte und Meldungen für eine `.mpp`-Datei.
- [Wiederherstellung nach einem Absturz](docs://howto-herstellen-na-een-crash): was nach einem Absturz mit diesem Projekt geschieht.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): wie die App Puffer und Kritikalität berechnet, wenn sie berechnet.
