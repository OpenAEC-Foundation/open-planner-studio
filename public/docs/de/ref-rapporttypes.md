# Berichtstypen

Jeder Bericht auf dem Tab *Bericht* mit den dazugehörigen Optionen: was sie tun, der Standardwert, was sich im Bericht ändert und wo Sie sie finden. Wie Sie einen Bericht erstellen und als PDF speichern, steht in [Einen Bericht erstellen und drucken](docs://howto-rapport-maken-en-afdrukken).

## So funktioniert das Berichtsfenster

Öffnen Sie den Tab *Bericht* (oder drücken Sie Strg+P). Links steht die Spalte *Bericht* mit der Auswahlliste *Berichtstyp*, dem Block *Übersicht* mit Zählungen, dem Block *Einstellungen* oder *Berichtsoptionen* und unten die Schaltfläche *PDF exportieren*. Rechts steht die Vorschau. Was Sie in der Vorschau sehen, kommt in die PDF-Datei.

**Berichtstyp** — welchen Bericht Sie sehen. Wählen Sie aus elf Berichten. Standard: *Gantt-Diagramm*. Wo: *Bericht*, oben in der Spalte *Bericht*.

**PDF exportieren** — erstellt die PDF-Datei. Wirkung: Das Ergebnis ist nur eine PDF-Datei; die App sendet nichts an einen Drucker. Wenn der Terminplan nicht mehr aktuell ist, berechnet die App zuerst. Gibt die Berechnung einen Fehler aus, zum Beispiel wegen einer Schleife in den Beziehungen, dann entsteht keine Datei, und die Schaltfläche zeigt den Fehler. Wo: *Bericht*, unten in der Spalte *Bericht*.

**Gespeichert.** Die App behält alle Berichtsoptionen auf diesem Gerät, für alle Ihre Projekte. Sie gehören nicht zur Projektdatei. Nur das Feld *Unternehmen:* des Gantt-Diagramms wird nicht gespeichert.

**Aktueller Terminplan.** Die Berichte verwenden die letzte Berechnung. Wurde der Terminplan seitdem geändert, zeigen die Tabellenberichte oben den Text *Der Terminplan wurde seit der letzten Berechnung geändert — drücken Sie Berechnen (F5) für aktuelle Werte.* Wurde noch nie berechnet, steht dort *Noch nicht berechnet — drücken Sie Berechnen (F5) für Termine und Puffer.* Ist das Projekt in der Ansicht *Termine wie erfasst*, zeigen die Berichte die Termine aus der Quelldatei, und eine Leiste sagt das.

**Abkürzungen.** *AT* ist Arbeitstage. *TF* ist Gesamtpuffer, *FF* ist freier Puffer.

## Papier und Ausrichtung

**Papier:** — das Papierformat der PDF-Datei. Wählen Sie aus A4, A3, A2 und A1. Standard: A3. Wirkung: Die Seiten werden für dieses Format angelegt. Es gibt eine Auswahl für alle Berichte: Was Sie für einen Bericht wählen, gilt auch für die anderen. Bei Hochformat A4 wird eine breite Tabelle klein, weil die Tabelle auf die Seitenbreite skaliert wird. Wo: *Einstellungen* (Gantt-Diagramm und Ressourcendiagramm) oder *Berichtsoptionen* (die sieben Tabellenberichte). Die Meilensteinübersicht und die Abweichung zeigen keine Auswahl.

**Ausrichtung:** — Querformat oder Hochformat. Wählen Sie zwischen *Querformat* und *Hochformat*. Standard: *Querformat*. Wirkung: wie bei *Papier:*. Wo: an derselben Stelle wie *Papier:*.

## Gantt-Diagramm

Der Terminplan als Balkendiagramm, mit einer Tabelle links und einer Zeitachse rechts, bei Bedarf über mehrere Seiten. Die Vorschau zeigt das Papier mit Seitenkopf, Tabelle, Zeitachse und Legende. Der Block *Übersicht* zählt *Vorgänge:*, *Blattvorgänge:*, *Kritisch:* und *Beziehungen:*. Alle Optionen stehen unter *Einstellungen*.

**Unternehmen:** — das Unternehmen im Seitenkopf. Standard: das Unternehmen aus den Projekteinstellungen. Wirkung: nur der Kopf dieses Berichts; was Sie hier eintragen, wird nicht gespeichert. Ändern Sie das Unternehmen unter *Einstellungen › Projekt › Projekteinstellungen* im Feld *Auftraggeber/Organisation* und bestätigen Sie mit *Anwenden*.

**Autor:** — der Autor im Seitenkopf. Nur lesbar: Die App übernimmt ihn aus den Projekteinstellungen.

**Schriftgröße:** — Größe von Text und Tabelle im Bericht. Wählen Sie aus 90%, 100%, 110% und 125%. Standard: 100%. Wirkung: Bei größerer Schrift werden Text, Zeilen und Tabelle größer, und die Zeitachse verliert an Breite. Unabhängig von *Textgröße* in den Einstellungen.

**Balkenfarben:** — wovon die Farbe eines Balkens abhängt. Wählen Sie aus *Kritischer Pfad*, *Pro Vorgang — automatisch* und *Nach Kategorie*, mit einer Auswahlliste *Kategoriefeld* für *Nach Kategorie*. Standard: *Kritischer Pfad*. Wirkung: Das ist dieselbe Auswahl wie *Balkenfarben* auf dem Tab *Ansicht*. Ändern Sie sie hier, dann ändert sich das Gantt-Diagramm auf dem Bildschirm mit. Existiert das gewählte Feld in diesem Projekt nicht, steht dort *Dieses Feld ist in diesem Projekt nicht vorhanden. Vorübergehend wird die Arbeitskategorie verwendet.*

**Statuslinie:** — eine Linie am Statusdatum. Wählen Sie aus *Keine*, *Statusdatumslinie* und *Fortschrittslinie*. Standard: *Keine*. Wirkung: *Statusdatumslinie* zeichnet eine Linie am Statusdatum; *Fortschrittslinie* zeichnet die Zickzacklinie, die zum Fortschritt jedes Vorgangs ausschlägt. Hat das Projekt kein Statusdatum, steht dort *Legen Sie zuerst ein Statusdatum fest*, und der Bericht zeichnet nichts.

**Ansicht folgen (Filter, Gruppierung, Sortierung)** — nur für das Gantt-Diagramm. Standard: aus. Wirkung: Aus druckt den gesamten Vorgangsbaum. Ein druckt genau die Zeilen des Bildschirms: mit Ihrem Filter, Ihrer Gruppierung, Ihrer Sortierung und eingeklappten Phasen.

**Automatisch an Papier anpassen** — skaliert die Zeitachse auf die Seitenbreite. Standard: ein. Wirkung: Ein skaliert die Zeitachse auf die Breite der Seite; die Anzahl der Seiten ergibt sich aus der Höhe. Aus verwendet einen festen Maßstab (*Zoom:*) und teilt die Zeitachse zusätzlich über die Breite auf, was schnell viele Seiten ergibt.

**Zoom:** — der feste Maßstab der Zeitachse. Nur sichtbar, wenn *Automatisch an Papier anpassen* aus ist. Schieberegler von 1 bis 40. Standard: 22. Wirkung: Ein größerer Wert macht die Zeitachse breiter, dadurch entstehen mehr Seiten nebeneinander.

**Zeitachse über:** — verteilt die Zeitachse über mehr Seitenbreiten. Auswahl von 1 bis 8 Seiten. Standard: 1 Seite. Wirkung: nur bei *Automatisch an Papier anpassen*; sonst ist die Auswahl deaktiviert, und es steht *Nur bei automatischer Anpassung*. Praktisch für einen langen Terminplan, den Sie in lesbarer Größe drucken wollen.

**Kopfzeile auf jeder Seite wiederholen** — Standard: ein. Wirkung: Ein setzt den Seitenkopf auf jede Seite; Aus nur auf die erste Seite.

**Fußzeile auf jeder Seite wiederholen** — Standard: ein. Wirkung: Ein setzt die Fußzeile (Projektname, Druckdatum und Legende) auf jede Seite; Aus nur auf die letzte Seite. Ein Ausdruck ohne Legende ist unlesbar, daher ist sie eingeschaltet.

**Vorgangsnamen auf Balken** — Standard: ein. Wirkung: der Name des Vorgangs auf dem Balken, wo Platz ist.

**Fertigstellung anzeigen** — Standard: ein. Wirkung: Der abgeschlossene Teil des Balkens wird grau, wie im Gantt-Diagramm, und die Spalte *Fertigst* erscheint in der Tabelle. Ein abgeschlossener Vorgang zeigt keinen Puffer.

**Vorgangsnamen kürzen** — Standard: ein. Wirkung: Ein kürzt die Namen in der Tabelle auf die Breite von *Namensspalte:*. Aus lässt die Spalte mit dem längsten Namen wachsen; dann steht dort *Die Namensspalte passt sich dem längsten Vorgangsnamen an*.

**Namensspalte:** — die Breite der Namensspalte. Nur sichtbar, wenn *Vorgangsnamen kürzen* eingeschaltet ist. Schieberegler von 60 bis 400. Standard: 130.

**Baseline-Überlagerung anzeigen** — die aktive Baseline neben den Balken. Standard: aus. Wirkung: ein dünner Balken in der Baseline-Farbe unter dem Vorgangsbalken, nur für Vorgänge, die in der Baseline stehen.

**Kritischer Pfad** — Standard: ein. Wirkung: steuert nur die roten Beziehungslinien zwischen zwei kritischen Vorgängen und die Zeile in der Legende. Die Balken selbst folgen *Balkenfarben:*, unabhängig von diesem Kontrollkästchen.

**Puffer anzeigen** — Standard: ein. Wirkung: der Puffer als Streifen hinter nicht kritischen Balken.

**Abhängigkeiten** — die Beziehungslinien. Standard: ein. Wirkung: zeichnet Pfeile zwischen den Balken.

**Nur Arbeitstage anzeigen** — komprimiert die Zeitachse in diesem Bericht. Standard: aus. Wirkung: Wochenenden und Feiertage werden übersprungen, und Wochenstreifen ersetzen dann die Wochenendschattierung. Unabhängig von derselben Einstellung für das Gantt-Diagramm auf dem Bildschirm.

**Wochenenden** — Standard: ein. Wirkung: schattiert Wochenenden und Feiertage in der Zeitachse, solange der Maßstab Tage unterscheidbar macht. Auf der komprimierten Zeitachse (*Nur Arbeitstage anzeigen*) hat dieses Kontrollkästchen keine Wirkung.

**Legende** — Standard: ein. Wirkung: die Legende in der Fußzeile.

**Vorschauqualität** — wie scharf die Vorschau ist. Wählen Sie aus *Standard*, *Hoch* und *Maximal*. Standard: *Hoch*. Wirkung: nur die Schärfe der Vorschau auf dem Bildschirm; die PDF-Datei ändert sich nicht. Wo: *Bericht*, über der Vorschau.

## Ressourcendiagramm

Dieselben Balken wie im Gantt-Diagramm, gruppiert nach Ressource: wer was wann macht. Der Block *Übersicht* zählt *Ressourcen:*, *Zuweisungen:* und *Ohne Ressource:* (mit einem Zeitraum auch *Außerhalb des Zeitraums:*). Das Diagramm teilt alle Optionen des Gantt-Diagramms, außer *Ansicht folgen (Filter, Gruppierung, Sortierung)*, *Kritischer Pfad* und *Abhängigkeiten*: Die Zeilen stammen nicht vom Bildschirm, ein Vorgang kann unter mehreren Ressourcen stehen, und die Beziehungen werden dort nicht gezeichnet. Das Kontrollkästchen *Kritischer Pfad* ist ausgeblendet und steht auf ein. Dazu kommen die Optionen des Gantt-Diagramms unter *Einstellungen*, mit diesen vier Kontrollkästchen und dem Zeitraum:

**Jede Ressource auf einer neuen Seite** — Standard: aus. Wirkung: Jede Ressource beginnt auf einer neuen Seite, damit Sie pro Trupp oder Mitarbeiter ein Blatt ausgeben können. Aus ergibt ein zusammenhängendes Dokument.

**Vorgänge ohne Ressource einschließen** — Standard: aus. Wirkung: die Vorgänge ohne Ressource stehen als letzter Streifen im Diagramm, damit Sie sehen, was noch niemand hat.

**Nach Ressourcentyp gruppieren** — Standard: aus. Wirkung: eine Ebene darüber: zuerst ein Streifen pro Ressourcentyp (Arbeitskräfte, Trupp, Subunternehmer, Gerät, Material), darin pro Ressource.

**Einheiten/Tag und Kurve anzeigen** — Standard: ein. Wirkung: zwei Spalten nach dem Vorgangsnamen mit den Einheiten pro Tag und der Verteilungskurve der Ressource dieses Streifens. Ist für die Zeitachse zu wenig Platz, lässt der Bericht die Spalten weg und sagt *Die Spalten Einheiten/Tag und Kurve wurden weggelassen: …*; mehr Platz bringen ein größeres Papierformat oder Querformat, eine kleinere Schriftgröße oder eine schmalere Tabelle.

**Berichtszeitraum:** — nur die Vorgänge, die den Zeitraum berühren. Standard: *Gesamtes Projekt*. Wirkung: Die Zeitachse läuft genau über den Zeitraum. Liegt im Zeitraum nichts, steht dort *Keine Vorgänge im Berichtszeitraum — wählen Sie einen anderen Zeitraum oder Gesamtes Projekt.* Siehe *Berichtszeitraum* unten.

## Meilensteinübersicht

Alle Meilensteine des Projekts in einer Tabelle. Keine eigenen Optionen. Der Block *Übersicht* zählt *Meilensteine*, *Verbindlich* und *Verspätet*. Die Spalten sind *PSP*, *Name*, *Art* (*Automatisch*, *Anfang* oder *Ende*), *Datum*, *Einschränkung/Stichtag*, *Puffer*, *Verbindlich* und *Status*. Der Status ist *Verspätet*, wenn die Einschränkung verletzt ist, der Stichtag verpasst wird oder der Gesamtpuffer negativ ist; sonst *Kritisch*, wenn der Meilenstein nach der Definition des Projekts kritisch ist; sonst *Im Plan*. Ohne Meilensteine steht dort *Keine Meilensteine in diesem Projekt.* Die PDF-Datei verwendet das Papier und die Ausrichtung, die Sie zuletzt für einen anderen Bericht gewählt haben.

## Abweichung

Der aktuelle Terminplan neben der aktiven Baseline, für Blattvorgänge. Keine eigenen Optionen. Der Block *Übersicht* zählt *Vorgänge*, *Später* und *Früher* und zeigt *Projektende: +3 Arbeitstage* (der Unterschied in Arbeitstagen zwischen dem Baseline-Ende und dem aktuellen Ende). Die Spalten sind *PSP*, *Name*, *Baseline-Anfang*, *Baseline-Ende*, *Aktueller Anfang*, *Aktuelles Ende*, *Δ Anfang (AT)*, *Δ Ende (AT)* und *Status*. Der Status folgt dem Ende: *Später*, wenn das Ende später ist als in der Baseline, *Früher*, wenn es früher ist, sonst *Im Plan*. *Neu* ist ein Vorgang, der nicht in der Baseline steht; *Entfallen* ist ein Vorgang, der in der Baseline steht, aber nicht mehr im Terminplan. Ohne aktive Baseline steht dort *Keine aktive Baseline — speichern Sie eine Baseline oder legen Sie eine als aktiv fest.* Die PDF-Datei verwendet das Papier und die Ausrichtung, die Sie zuletzt für einen anderen Bericht gewählt haben.

## Vorschau

Was in dem Zeitraum läuft oder beginnt: die Liste für die wöchentliche Besprechung. Optionen unter *Berichtsoptionen*.

**Berichtszeitraum:** — das Fenster des Berichts. Standard: *Nächster Monat*. Wirkung: Der Bericht enthält die nicht abgeschlossenen Vorgänge, die den Zeitraum berühren, auch wenn sie den ganzen Zeitraum umfassen, dazu überfällige Vorgänge von vor dem Bezugstag, solange das Ende des Zeitraums nicht vor dem Bezugstag liegt.

**Fast kritisch ≤ (AT):** — die Schwelle für *Fast kritisch*. Zahl von 0 bis 60. Standard: 5. Wirkung: Ein Vorgang mit mehr als 0 und höchstens so vielen Arbeitstagen Gesamtpuffer zählt als fast kritisch. Bei 0 zählt nur, was die Berechnungsoption des Projekts *Beinahe-kritisch markieren* markiert.

Der Block *Übersicht* zählt *Vorgänge*, *Überfällig*, *In Bearbeitung*, *Hätte starten müssen*, *Beginnt*, *Kritisch* und *Fast kritisch*. Der Status je Zeile, immer bezogen auf den Bezugstag: *Überfällig* (nicht abgeschlossen, und das Ende liegt vor dem Bezugstag), *Hätte starten müssen* (nicht begonnen, obwohl der Anfang vor dem Bezugstag lag), *In Bearbeitung*, *Beginnt* (noch nicht begonnen, beginnt im Zeitfenster). Die Spalten sind *PSP*, *Name*, *Anfang*, *Ende*, *Rest (AT)*, *Fertigst*, *GP (AT)* (TF), *Kritisch*, *Ressourcen* und *Status*.

## Kritisch & fast kritisch

Die Vorgänge, die das Projektende bestimmen, und die, die knapp daran sind. Option unter *Berichtsoptionen*.

**Fast kritisch ≤ (AT):** — Standard: 5. Zahl von 0 bis 60. Wirkung und Bedeutung wie bei der Vorschau. Der Untertitel nennt die gewählte Schwelle.

Der Bericht enthält die nicht abgeschlossenen Vorgänge, die kritisch (nach dem Solver und der Definition des Projekts für kritisch) oder fast kritisch sind, sortiert nach Pufferpfad, dann nach Gesamtpuffer, dann nach Anfang. Der Block *Übersicht* zählt *Kritisch*, *Fast kritisch*, *Kritische Ketten* und *Blattvorgänge*. Die Spalten sind *PSP*, *Name*, *Anfang*, *Ende*, *Rest (AT)*, *GP (AT)* (TF), *FP (AT)* (FF), *Pfad* und *Status*. Die Spalte *Pfad* zeigt den Pufferpfad, wenn die Berechnungsoption *Mehrere Pufferpfade* auf ein steht, sonst einen Strich.

## Fortschrittsbericht

Wo das Projekt am Statusdatum steht. Optionen unter *Berichtsoptionen*.

**Berichtszeitraum:** — Standard: *Letzter Monat*. Wirkung: *Im vergangenen Zeitraum abgeschlossen* zählt innerhalb des Zeitraums. *Beginn im kommenden Zeitraum* schaut vom Statusdatum aus voraus, bis *Vorschau bis*; bei einem Zeitraum *Letzter Monat* so weit voraus, wie der Zeitraum zurückschaut.

**Fast kritisch ≤ (AT):** — Standard: 5. Wie bei der Vorschau.

Der Block *Übersicht* zeigt *Statusdatum*, *Zeitraum*, *Vorschau bis*, *Baseline-Ende*, *Prognose-Ende*, *Δ Ende (AT)*, *Geplant* (mit *(Basisplan)* oder *(aktueller Plan)*), *Ist* und die Zählungen *Abgeschlossen*, *In Bearbeitung*, *Nicht begonnen*, *Überfällig* und *Kritisch*. Geplant und Ist werden nach der Dauer der Vorgänge gewichtet. Geplant wird gegen die Baseline gemessen, wenn eine aktive Baseline besteht, sonst gegen den aktuellen Terminplan. Die Abschnitte sind *Im vergangenen Zeitraum abgeschlossen*, *In Bearbeitung*, *Beginn im kommenden Zeitraum*, *Überfällig* und *Offene kritische Vorgänge*; ein Vorgang kann in mehr als einem Abschnitt stehen. Jeder Abschnitt hat dieselben Spalten: *PSP*, *Name*, *Baseline-Ende*, *Prognose-Ende*, *Fertigst*, *Rest (AT)*, *GP (AT)* (TF), *Kritisch* und *Status*. Der Status pro Zeile ist *Abgeschlossen*, *In Bearbeitung*, *Nicht begonnen*, *Hätte starten müssen* oder *Hätte enden müssen*.

## Zustand des Terminplans

Eine Prüfung des Terminplans selbst auf Fehler und ungewöhnliche Werte, mit der DCMA-14-Punkte-Bewertung oben. Optionen unter *Berichtsoptionen*.

**Hoher Puffer > (AT):** — Zahl von 1 bis 365. Standard: 44. Wirkung: Ein nicht abgeschlossener Vorgang mit mehr Gesamtpuffer als dieser Wert fällt unter *Hoher Puffer*.

**Lange Dauer > (AT):** — Zahl von 1 bis 365. Standard: 44. Wirkung: Ein nicht abgeschlossener Vorgang, kein Meilenstein, mit längerer Dauer fällt unter *Lange Dauer*.

**Zeitabstand > (AT):** — Zahl von 0 bis 365. Standard: 10. Wirkung: Eine Beziehung mit mehr Zeitabstand fällt unter *Lange Verzögerung*. Ein negativer Zeitabstand (Vorlauf) wird immer gemeldet.

**Fast kritisch ≤ (AT):** — Zahl von 0 bis 60. Standard: 5. Wirkung: bestimmt die Prüfung *Fast kritisch*.

Der Abschnitt *DCMA-14-Punkte-Bewertung* steht zuerst. Er folgt den vierzehn Prüfungen der US Defense Contract Management Agency, mit den Formeln und Schwellen aus deren *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, Oktober 2012). Pro Punkt sehen Sie *Anzahl*, *Von* (die Gesamtmenge, über die gezählt wurde), *Wert*, *Schwelle*, *Ergebnis* und *Detail*. Das Ergebnis ist *Erfüllt*, *Markiert* oder *entfällt*; bei *entfällt* steht der Grund im Detail. Eine Markierung ist kein Fehler: Das Pamphlet sieht darin einen Grund, genauer hinzuschauen. Die Schwellen unter *Berichtsoptionen* gelten nicht für diesen Abschnitt; er verwendet immer die Schwellen aus dem Pamphlet.

Er zählt nicht abgeschlossene Blattvorgänge, ohne Meilensteine und Hammocks, und die Beziehungen zu solchen Vorgängen. Der Hinweis über dem Bericht nennt beide Zahlen. Die vierzehn Punkte:

- *Logik*: Vorgänge ohne Vorgänger oder Nachfolger. Schwelle: höchstens 5%.
- *Vorläufe*: Beziehungen mit negativem Zeitabstand. Schwelle: keine.
- *Zeitabstände*: Beziehungen mit positivem Zeitabstand, egal wie kurz. Schwelle: höchstens 5%.
- *Beziehungstypen*: der Anteil der FS-Beziehungen. Schwelle: mindestens 90%.
- *Harte Einschränkungen*: Vorgänge mit einer verbindlichen Einschränkung oder einer MSO, MFO, SNLT oder FNLT. Schwelle: höchstens 5%.
- *Hoher Puffer*: Vorgänge mit mehr als 44 Arbeitstagen Gesamtpuffer. Schwelle: höchstens 5%. Setzt eine Berechnung voraus.
- *Negativer Puffer*: Vorgänge mit einem Gesamtpuffer unter 0. Schwelle: keine. Setzt eine Berechnung voraus.
- *Hohe Dauer*: Vorgänge länger als 44 Arbeitstage. Zählt die Baseline-Dauer, wenn der Vorgang in der aktiven Baseline steht, sonst die aktuelle Dauer. Schwelle: höchstens 5%.
- *Ungültige Daten*: ein Ist-Anfang oder Ist-Ende nach dem Statusdatum, oder ein Prognose-Anfang oder Prognose-Ende vor dem Statusdatum. Schwelle: keine. Setzt ein Statusdatum voraus.
- *Ressourcen*: Vorgänge ohne Ressource. Schwelle: keine. Nur wenn das Projekt Ressourcen verwendet; sonst *entfällt*.
- *Verpasste Vorgänge*: von den Vorgängen, die laut Baseline bis zum Statusdatum oder früher fertig sein sollten, der Anteil, der später endet oder später prognostiziert wird. Schwelle: höchstens 5%. Setzt ein Statusdatum und eine aktive Baseline voraus.
- *Test des kritischen Pfads*: Die App verlängert einen kritischen Vorgang um 100 Arbeitstage. Auf einer Kopie wird der Terminplan neu berechnet, ohne das Projekt zu ändern. Der Test ist erfüllt, wenn der letzte Vorgang des Projekts dann nicht vor diesem Vorgang endet. Geprüft wird der kritische, nicht abgeschlossene Vorgang mit dem frühesten Anfang; das Detail nennt den Vorgang und um wie viele Arbeitstage sich das Ende verschoben hat. In der Ansicht *Daten wie erfasst* hat dieser Test das Ergebnis *entfällt* (*nicht berechnet*): Der Test rechnet, und der Bericht zeigt dann die Daten aus der Quelldatei. Drücken Sie den Befehl berechnen (F5), dann läuft der Test erneut.
- *CPLI*: (Länge des kritischen Pfads + Puffer) / Länge des kritischen Pfads. Die Länge zählt die Arbeitstage vom Statusdatum bis zum Ende des letzten Vorgangs; der Puffer ist die Differenz zum Baseline-Ende dieses Vorgangs, oder der berechnete Puffer, wenn der Vorgang nicht in der Baseline steht. Schwelle: mindestens 0,95. Setzt ein Statusdatum voraus.
- *Basisplan-Ausführungsindex (BEI)*: die Anzahl der Vorgänge, die am Statusdatum fertig sind, geteilt durch die Anzahl, die die Baseline bis dahin als fertig vorsieht, plus die Vorgänge ohne Baseline. Schwelle: mindestens 0,95. Setzt ein Statusdatum und eine aktive Baseline voraus.

Zwei Punkte weichen vom Pamphlet ab, weil die App das Konzept nicht kennt: *Hohe Dauer* zählt jeden nicht abgeschlossenen Vorgang, während das Pamphlet ihn auf den detaillierten Planungszeitraum (Rolling Wave) beschränkt, und *Ressourcen* schaut nur auf zugewiesene Ressourcen, nicht auf Kosten. Das Pamphlet nennt keine Zahl für den Test des kritischen Pfads; die 100 Arbeitstage sind die Wahl der App.

Die Prüfungen stehen in dieser Reihenfolge, mit ihrem Schweregrad. Fehler: *Negativer Puffer*, *Verpasster Stichtag*, *Verletzte Einschränkung* und *Inkonsistenter Fortschritt* (Ist-Anfang oder Ist-Ende nach dem Statusdatum, Prognose-Anfang oder Prognose-Ende vor dem Statusdatum, 100% ohne Ist-Ende, Ist-Ende aber nicht 100%, Fortschritt ohne Ist-Anfang). Warnung: *Ohne Vorgänger (offener Anfang)* und *Ohne Nachfolger (offenes Ende)* (keine Meilensteine), *Lange Dauer*, *Vorlauf (negative Verzögerung)*, *Harte Einschränkung* (eine verbindliche Einschränkung oder eine MSO, MFO, SNLT oder FNLT), *Fortschritt außer Reihenfolge* und *Verpasster Vorgang (gegenüber Basisplan)*. Hinweise: *Fast kritisch*, *Hoher Puffer*, *Lange Verzögerung*, *Beziehung außer FS* und *Ohne Ressource* (nur wenn das Projekt Ressourcen verwendet). Der Bericht prüft nur Blattvorgänge, die keine Hammocks sind. Der Block *Zusammenfassung* zählt *DCMA-Markierungen*, *Fehler*, *Warnungen*, *Hinweise*, *Blattvorgänge* und *Beziehungen*. Unter dem DCMA-Abschnitt stehen ein Abschnitt *Übersicht* (pro Prüfung der Schweregrad und die Anzahl) und ein Abschnitt *Befunde* (jeder Vorgang und jede Beziehung). Ohne Berechnung fehlen die Prüfungen, die einen Puffer brauchen.

## Ressourcenauslastung

Pro Ressource, pro Woche oder Monat, der Bedarf im Vergleich zur Verfügbarkeit. Optionen unter *Berichtsoptionen*.

**Berichtszeitraum:** — Standard: *Gesamtes Projekt*. Wirkung: Jede Woche oder jeder Monat, der den Zeitraum berührt, ist vollständig enthalten. So zeigt eine Zeile dieselbe Zahl wie das Histogramm.

**Gruppierung:** — Wählen Sie *Wöchentlich* oder *Monatlich*. Standard: *Wöchentlich*. Wirkung: eine Zeile pro Kalenderwoche (Spalte *Woche ab*, mit dem Montag) oder pro Kalendermonat (Spalte *Monat*).

**Nur überlastete Zeiträume** — Standard: aus. Wirkung: an zeigt nur die Wochen oder Monate mit mindestens einem überlasteten Tag.

Die Spalten sind *Ressource*, *Typ*, *Woche ab* oder *Monat*, *Bedarf*, *Verfügbar*, *Variance* (verfügbar minus Bedarf; negativ ist ein Mangel), *Spitze/Tag* und *Überlastet*. *Bedarf* ist die Summe der Einheiten-Tage. Nur Wochen oder Monate mit Bedarf sind enthalten. Der Block *Zusammenfassung* zählt *Ressourcen*, *Wochen* oder *Monate*, *Überlastete Wochen* oder *Überlastete Monate* und *Überlastete Ressourcen*.

## Ressourcenzuweisungen

Pro Ressource die Vorgänge, denen sie zugewiesen ist: Was macht dieses Team oder dieser Kran? Optionen unter *Berichtsoptionen*.

**Berichtszeitraum:** — Standard: *Gesamtes Projekt*. Wirkung: Mit einem Zeitraum sind nur Zuweisungen von Vorgängen enthalten, die den Zeitraum berühren, plus überfällige Arbeit von vor dem Referenztag. *Gesamtes Projekt* filtert nicht nach Datum.

**Abgeschlossene Vorgänge einbeziehen** — Standard: aus. Wirkung: an schließt auch die Zuweisungen abgeschlossener Vorgänge ein.

Die Zeilen sind pro Ressource gegliedert, und innerhalb einer Ressource nach Anfang. Der Block *Zusammenfassung* zählt *Ressourcen*, *Zuweisungen* und *Vorgänge ohne Ressource*. Die Spalten sind *Ressource*, *Typ*, *PSP*, *Name*, *Anfang*, *Ende*, *Rest (AT)*, *Einh./Tag*, *Fertigst*, *Kritisch* und *Status*. *Ressource* und *Typ* erscheinen nur in der ersten Zeile einer Ressource. Der Status je Zeile ist derselbe wie im Fortschrittsbericht: *Abgeschlossen*, *In Bearbeitung*, *Nicht begonnen*, *Hätte starten müssen* oder *Hätte enden müssen*.

## PSP-Übersicht

Der Terminplan, zusammengefasst pro PSP-Element: die Managementübersicht. Optionen unter *Berichtsoptionen*.

**Ebene:** — bis zu welcher Ebene der PSP angezeigt wird. Wählen Sie aus *Vollständiger PSP* und den Ebenen 1 bis 8. Standard: Ebene 2. Wirkung: Der Untertitel lautet *Bis Ebene 2*.

**Vorgänge anzeigen** — Standard: aus. Wirkung: an zeigt zusätzlich die Blattvorgänge selbst unter jedem Element.

Die Spalten umfassen *PSP*, *Name*, *Anfang*, *Ende*, *Baseline-Anfang*, *Baseline-Ende*, *Dauer (AT)*, *Fertigst*, *Δ Ende (AT)*, *Min. GP (TF)*, *Vorg* (Anzahl der Vorgänge), *Krit*, *Aktiv* und *Erledigt*. Anfang und Ende eines Sammelvorgangs stammen aus der letzten Berechnung. Der Fortschritt ist über die Blattvorgänge nach Dauer gewichtet. *Min. GP* und die Zählungen betreffen die Blattvorgänge darunter. Der Block *Zusammenfassung* zählt *PSP-Elemente* und *Vorgänge*.

## Berichtszeitraum

Vier Tabellenberichte und das Ressourcendiagramm arbeiten mit einem *Berichtszeitraum:*: *Vorschau (Look-ahead)*, *Fortschrittsbericht*, *Ressourcenauslastung*, *Ressourcenzuweisungen* und das *Ressourcendiagramm*. Jeder Bericht merkt sich seinen eigenen Zeitraum. Unter der Auswahlliste stehen *Ab* und *Bis*, mit den Daten, die die Auswahl ergibt.

**Referenztag.** Ein Zeitraum mit *Nächste* oder *Letzte* zählt ab dem Statusdatum des Projekts, oder ab heute, wenn es kein Statusdatum gibt. Dann zeigen die Tabellenberichte den Hinweis *Kein Statusdatum gesetzt — der Bericht rechnet mit heute (…).* Wenn Sie das Statusdatum verschieben, wandert das Fenster mit. Beide Tage zählen mit.

**Nächste Woche, Nächste 2 Wochen, Nächste 4 Wochen, Nächste 6 Wochen, Nächste 8 Wochen, Nächste 12 Wochen** — ab dem Referenztag, jede Woche 7 Tage lang. Bei einem Statusdatum am Donnerstag, 20. Mai, läuft *Nächste Woche* vom 20. bis zum 26. Mai und *Nächste 4 Wochen* vom 20. Mai bis zum 16. Juni.

**Letzte Woche, Letzte 2 Wochen, Letzte 4 Wochen, Letzte 6 Wochen, Letzte 8 Wochen, Letzte 12 Wochen** — dieselben sechs, aber rückwärts gezählt: jede Woche 7 Tage lang, bis einschließlich zum Referenztag. Bei einem Referenztag am 20. Mai läuft *Letzte 2 Wochen* vom 7. bis zum 20. Mai.

**Nächster Monat, Letzter Monat** — ein Kalendermonat vorwärts oder rückwärts, bis einen Tag vor demselben Datum im anderen Monat. Bei einem Referenztag am 20. Mai läuft *Nächster Monat* bis zum 19. Juni; *Letzter Monat* läuft vom 21. April bis zum 20. Mai.

**Gesamtes Projekt** — vom ersten Anfang bis zum letzten Ende des Terminplans.

**Benutzerdefiniert** — Ihr eigener Zeitraum. Wirkung: *Ab* und *Bis* werden zwei Datumsfelder. Sie beginnen mit den Daten der Auswahl, die Sie zuvor hatten. Das Enddatum darf nicht vor dem Anfangsdatum liegen (*Das Enddatum liegt vor dem Anfangsdatum.*) und beide Felder müssen ausgefüllt sein (*Beide Daten ausfüllen.*). Ist die Eingabe nicht richtig, bleibt der Bericht beim letzten gültigen Zeitraum.

## Siehe auch

- [Einen Bericht erstellen und drucken](docs://howto-rapport-maken-en-afdrukken): der ganze Weg vom Berichtstyp bis zur PDF-Datei.
- [Den Berichtszeitraum wählen](docs://howto-rapportageperiode-kiezen): Schritte und Beispiele.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was *Kritisch* und *Fast kritisch* bedeuten.
- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): das Statusdatum und die Baseline, mit denen die Berichte arbeiten.
- [Überlastung auflösen](docs://howto-overbezetting-oplossen): was Sie mit den überlasteten Wochen aus der Ressourcenauslastung tun.
- [Import- und Exportformate](docs://ref-import-exportformaten): PDF neben den anderen Formaten.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): zwei Baselines mit Fortschritt und einem Statusdatum, um den Variance-Bericht anzusehen.
