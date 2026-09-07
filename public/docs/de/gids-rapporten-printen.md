# Berichte & Drucken

Ein Terminplan ist erst fertig, wenn Sie ihn teilen können — auf Papier für eine Baustellenbesprechung, als Bild in einer Präsentation oder als Überblick über das, was ansteht und was sich bereits verschoben hat. Dafür ist die Registerkarte **Bericht** da, mit drei Berichtstypen und einer Druckvorschau.

## Was Sie hier lernen

- Die drei Berichtstypen auf der Registerkarte **Bericht**: Gantt-Druck, Meilensteinübersicht, Variance.
- Wie die Druckvorschau funktioniert: Papierformat, Ausrichtung und welche Elemente Sie ein-/ausschalten.
- Wie Sie einen Bericht tatsächlich drucken oder als Datei speichern.
- Was **Ctrl+P** in dieser App bewirkt.

## Zur Berichtsansicht gelangen

Es gibt drei Wege zu demselben Bildschirm: Klicken Sie auf die Menüband-Registerkarte **Bericht**, gehen Sie zu **Backstage → Drucken** (was die Berichtsansicht direkt öffnet), oder drücken Sie **Ctrl+P**. Alle drei landen am selben Ort — es gibt keinen separaten „Drucken"-Dialog; die Berichtsansicht *ist* die Druckvorschau.

Der Bildschirm ist in zwei Spalten geteilt: ein Einstellungs-Panel links mit der Auswahl **Berichtstyp** ganz oben und eine Live-Vorschau rechts, die sich sofort aktualisiert, wenn Sie die Einstellungen links ändern.

## Die drei Berichtstypen

### Gantt-Druck

Ein vollständiger, formatierter Ausdruck der Gantt-Balken — dies ist der einzige Berichtstyp mit einem Einstellungsblock:

- **Papier**: A4, A3 oder A1.
- **Ausrichtung**: Querformat oder Hochformat.
- **Automatisch an Papier anpassen** (an = der Terminplan skaliert automatisch auf die gewählte Größe) oder ein manueller **Zoom**-Schieberegler, wenn Sie Auto-Anpassen ausschalten.
- **Schriftgröße** — 90, 100, 110 oder 125 %; skaliert den Berichtstext, die Zeilenhöhe und Kopf-/Fußzeile, unabhängig von der Zoomstufe oben.
- **Kopfzeile auf jeder Seite wiederholen** — standardmäßig an; hält die Berichtskopfzeile auf jeder gedruckten Seite sichtbar statt nur auf der ersten.
- **Zeitachse über** — verteilt die Gantt-Zeitachse auf 1 bis 8 Seiten nebeneinander; nur verfügbar bei aktiviertem Auto-Anpassen.
- Schalter für **Aufgabennamen auf Balken**, **Fertigstellung anzeigen**, **Kritischer Pfad**, **Puffer anzeigen**, **Abhängigkeiten**, **Wochenenden** und **Legende**.
- Ein Feld **Unternehmen** (wird aus der Projekteinstellung auto-gefüllt, ist hier aber separat editierbar) und der **Autor** (schreibgeschützt, aus den Projektinformationen).

Beziehungslinien im Bericht verwenden dieselbe visuelle Sprache wie die Gantt-Ansicht: eine **durchgezogene** Linie ist eine treibende Beziehung, eine **gestrichelte** Linie eine nicht-treibende, und eine treibende Beziehung zwischen zwei kritischen Aufgaben ist **rot**. Schalten Sie *Kritischer Pfad* aus, werden auch diese Linien neutral. Die Legende unten fasst den Unterschied zusammen. Vor der ersten Berechnung wird jede Linie neutral und durchgezogen gezeichnet — drücken Sie zuerst *Berechnen* (F5).

Der Zusammenfassungsblock darüber zeigt die Live-Anzahl der Aufgaben, Blattaufgaben, kritischen Aufgaben und Beziehungen im Projekt. Das Einstellungs-Panel merkt sich Ihre Wahl über Sitzungen hinweg — öffnen Sie die Registerkarte Bericht später erneut, kommen Papierformat, Schalter, Schriftgröße und der Rest genau so zurück, wie Sie sie verlassen haben. Nur das Feld Unternehmen setzt sich zurück: Es startet immer von der eigenen Einstellung des Projekts, sodass ein Bericht nie den Unternehmensnamen eines anderen Projekts übernimmt.

### Meilensteinübersicht

Eine Tabelle aller Meilensteine im Projekt: PSP, Name, Art (automatisch/Anfang/Ende), Datum, die zugrunde liegende Einschränkung oder der Stichtag, Puffer, ob der Meilenstein verbindlich ist, und Status (im Plan / kritisch / verspätet). Der Zusammenfassungsblock zeigt die Gesamtzahl der Meilensteine, wie viele verbindlich und wie viele verspätet sind. Dieser Bericht hat keine Einstellungen für Papierformat/Ausrichtung — er druckt die Tabelle exakt wie angezeigt.

### Variance

Vergleicht den aktuellen Terminplan mit der aktiven Baseline: Baseline-Anfang/-Ende gegenüber aktuellem Anfang/-Ende, die Differenz in Arbeitstagen für Anfang und Ende und ein Status pro Aufgabe (im Plan / später / früher / neu / entfallen). Wenn es keine aktive Baseline gibt, stellt der Bildschirm das ausdrücklich fest, statt einen leeren Bericht zu zeigen. Der Zusammenfassungsblock zeigt außerdem die Verschiebung des Projektenddatums in Arbeitstagen, falls es eine gibt. Lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang), wie Sie eine Baseline erfassen, bevor dieser Bericht Ihnen etwas Nützliches sagen kann.

## Die sieben Tabellenberichte

Die übrigen Berichtstypen sind Tabellenberichte direkt aus der letzten Berechnung. Sie teilen ein
paar Regeln: Nur **Blattvorgänge** zählen als Vorgänge (Sammelvorgänge nur in der PSP-Zusammenfassung,
Hammock-Vorgänge gar nicht); der **Stichtag** ist das Statusdatum des Projekts, ohne Statusdatum
rechnet der Bericht mit heute und sagt das; Termine und Puffer stammen aus der letzten **Berechnung**
(F5), bei einer geänderten Planung erscheint ein Hinweis, der PDF-Export rechnet immer erst durch;
jeder Bericht hat einen kleinen Block **Berichtsoptionen**, der zwischen Sitzungen gemerkt wird.
Arbeitstage werden mit *AT* abgekürzt.

### Vorschau (Look-ahead)

Die Liste für die wöchentliche Baubesprechung: alle Vorgänge der nächsten *N* Wochen (Standard vier)
— was beginnt, was weiterläuft, was endet — plus das, was bereits hätte passieren müssen. Je Zeile:
PSP, Name, Start und Ende, Restdauer, Fertigstellung, Gesamtpuffer, kritisch/fast kritisch, die
zugewiesenen Ressourcen und ein Status: **Beginnt**, **In Arbeit**, **Hätte starten müssen** oder
**Überfällig**. Ein Vorgang, der das ganze Fenster überspannt, ist ebenfalls enthalten.

### Kritisch & fast kritisch

Welche Vorgänge das Projektende bestimmen und welche kurz davor stehen. Kritisch kommt aus der
Berechnung; *fast kritisch* ist ein Gesamtpuffer von 0 bis zur Schwelle in den Berichtsoptionen
(Standard 5 Arbeitstage) oder die Markierung aus den Planungsoptionen. Abgeschlossene Vorgänge
fehlen. Sortiert nach Pufferpfad, dann Puffer, dann Start; mit freiem Puffer und Pfadnummer.

### Fortschrittsbericht

Der periodische Überblick „Wo stehen wir“ zum Statusdatum. Die Zusammenfassung zeigt Basisplan- und
Prognose-Ende mit der Differenz in Arbeitstagen, **geplanten** gegenüber **tatsächlichem**
Fortschritt (beide dauergewichtet über die Blattvorgänge; geplant auf den Terminen des aktiven
Basisplans, sonst auf der aktuellen Planung) und die Zählungen je Zustand. Darunter fünf
Abschnitte: im vergangenen Zeitraum abgeschlossen, in Arbeit, Beginn im kommenden Zeitraum,
überfällig und offene kritische Vorgänge. Der Zeitraum (Standard zwei Wochen) blickt gleich weit
zurück wie voraus.

### Terminplan-Qualität

Eine automatische Terminplanprüfung im Sinne der DCMA-14-Punkte-Bewertung. Jede Prüfung erhält
eine Schwere und eine Anzahl, darunter die Befunde je Vorgang oder Beziehung: **Fehler** (negativer
Puffer, verpasster Stichtag, verletzte Einschränkung, inkonsistenter Fortschritt), **Warnungen**
(offener Anfang oder offenes Ende, lange Dauer, Vorläufe, harte Einschränkungen, Fortschritt außer
Reihenfolge) und **Hinweise** (fast kritisch, hoher Puffer, lange Verzögerungen). Die Schwellen
stehen in den Berichtsoptionen; Standard nach DCMA: 44 Arbeitstage für hohen Puffer und lange
Dauer, 10 Arbeitstage für Verzögerungen. Eine saubere Planung hat null Fehler.

### Ressourcenauslastung pro Woche

Je Ressource und Woche der Bedarf gegenüber der verfügbaren Kapazität (in Einheiten-Tagen), die
Differenz, die Tagesspitze und ob die Woche überlastet ist — dieselbe Berechnung wie das Histogramm
auf der Registerkarte **Ressourcen**, aber als Tabelle. Nur Wochen mit Bedarf sind enthalten; mit
*Nur überlastete Wochen* bleiben nur die Engpässe.

### Ressourcenzuweisungen

Je Ressource die zugewiesenen Vorgänge: PSP, Name, Start und Ende, Restdauer, Einheiten pro Tag,
Fertigstellung, kritisch und Status. Abgeschlossene Vorgänge fehlen standardmäßig. Mit einem Fenster
in Wochen wird daraus die *Ressourcen-Vorschau*. Die Zusammenfassung zählt auch die Vorgänge ohne
Ressource.

### PSP-Zusammenfassung

Die Planung je PSP-Element bis zu einer wählbaren Ebene aufgerollt — der Managementüberblick. Je
Element: Start und Ende, Basisplan-Start und -Ende, Dauer, dauergewichteter Fortschritt, die
Enddifferenz zum Basisplan, der kleinste Gesamtpuffer und die Anzahl der Vorgänge, davon kritisch,
in Arbeit und abgeschlossen. Wählen Sie eine Ebene (Standard 2) oder den vollständigen PSP, auf
Wunsch mit den Vorgängen selbst.

## Drucken und Exportieren

Das Einstellungs-Panel hat unten stets eine Schaltfläche **Drucken...** — sie öffnet ein separates Druckfenster, das den Bericht enthält, und löst sofort den Browser-/OS-Druckdialog aus. Für den Gantt-Bericht verwendet dieses Fenster die gewählte Papiergröße und -ausrichtung; die Meilenstein- und Variance-Berichte drucken die Tabelle wie angezeigt.

Nur der Gantt-Bericht hat zusätzlich eine Schaltfläche **PDF exportieren**. Diese speichert die aktuelle Vorschau als echte PDF-Datei (Dateiname endet auf `-planning.pdf`) — eine Seite in den physischen Abmessungen der gewählten Papiergröße und -ausrichtung. Die PDF-Datei ist **vektorbasiert**: Balken, Linien und Text werden als PDF-Zeichenanweisungen gespeichert statt als ein einzelnes eingebettetes Bild, sodass sie auf jeder Zoomstufe scharf bleiben und der Text in jedem PDF-Betrachter auswählbar und durchsuchbar ist. Das gilt für lateinischen, kyrillischen, griechischen, arabischen und persischen Text — Arabisch und Persisch werden ebenfalls als Vektortext geformt und eingebettet. Chinesischer, japanischer und koreanischer Text ist optional: Installieren Sie eine Schriftart-Erweiterung, die diese Glyphen liefert, wird auch dieser Text als Vektor eingebettet (auswählbar und durchsuchbar); ohne eine solche Erweiterung wird dieser Text als Rasterbild exportiert — weiterhin korrekt dargestellt, aber nicht auswählbar oder durchsuchbar. Praktisch für E-Mail oder Archivierung ohne den Systemdruckdialog. Möchten Sie direkt drucken (oder über den Systemdialog als PDF speichern, etwa um eine andere Papiergröße zu wählen als die oben eingestellte), verwenden Sie **Drucken...**.

## Berichte in der Praxis

Jeder Berichtstyp bedient ein anderes Gespräch:

- Der **Gantt-Bericht** ist das klassische Handout für die Baustellenbesprechung: der kritische Pfad hervorgehoben, Puffer auf den nicht-kritischen Balken sichtbar und die Legende, die erklärt, was jede Farbe bedeutet. Aktivieren Sie **Aufgabennamen auf Balken** und **Fertigstellung anzeigen**, wenn das Publikum den Terminplan noch nicht kennt; schalten Sie sie aus für einen sauberen Überblick auf A1, wenn daneben eine separate Aufgabenliste ausgehändigt wird.
- Die **Meilensteinübersicht** ist für alle, die nur die wichtigen Termine wollen, ohne sich durch Dutzende Aufgabenzeilen zu blättern — zum Beispiel einen Auftraggeber, der vor allem wissen will, ob die verbindlichen Übergabetermine eingehalten werden. Das Symbol ◆ vor einem Meilensteinnamen in der Tabelle markiert einen **verbindlichen** Meilenstein.
- Der **Variance-Bericht** ist das Gespräch über Kurskorrektur: welche Aufgaben gegenüber der Baseline abrutschen und um wie viele Arbeitstage. Sehen Sie diesen Bericht in der Praxis im Showcase [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), der zwei Baselines hat (eine Vertrags-Baseline und ein Rebaseline nach einer Änderungsverfügung) mit eigenem Fortschritt und Statusdatum — ein gutes Beispiel dafür, wie sich die Δ-Spalten füllen, sobald es eine tatsächliche Differenz zwischen Baseline und aktuellem Terminplan gibt.

Die Live-Vorschau rechts aktualisiert sich bei jeder Änderung der Einstellungen links — es gibt keine separate „Aktualisieren"-Schaltfläche, und nichts wird erst zur Druckzeit berechnet.

## Weiterlesen

- Ein Variance-Bericht hat nichts zu vergleichen, bis eine Baseline erfasst wurde — lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang).
- Der kritische Pfad und der Puffer, die im Gantt-Bericht gezeigt werden, stammen aus derselben Berechnung wie die Gantt-Ansicht selbst — lesen Sie die Anleitung [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse), wie Sie das lesen.
