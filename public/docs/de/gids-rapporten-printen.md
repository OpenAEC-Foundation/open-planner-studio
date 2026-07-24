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
- Schalter für **Aufgabennamen auf Balken**, **Fertigstellung anzeigen**, **Kritischer Pfad**, **Puffer anzeigen**, **Abhängigkeiten**, **Wochenenden** und **Legende**.
- Ein Feld **Unternehmen** (wird aus der Projekteinstellung auto-gefüllt, ist hier aber separat editierbar) und der **Autor** (schreibgeschützt, aus den Projektinformationen).

Der Zusammenfassungsblock darüber zeigt die Live-Anzahl der Aufgaben, Blattaufgaben, kritischen Aufgaben und Beziehungen im Projekt.

### Meilensteinübersicht

Eine Tabelle aller Meilensteine im Projekt: PSP, Name, Art (automatisch/Anfang/Ende), Datum, die zugrunde liegende Einschränkung oder der Stichtag, Puffer, ob der Meilenstein verbindlich ist, und Status (im Plan / kritisch / verspätet). Der Zusammenfassungsblock zeigt die Gesamtzahl der Meilensteine, wie viele verbindlich und wie viele verspätet sind. Dieser Bericht hat keine Einstellungen für Papierformat/Ausrichtung — er druckt die Tabelle exakt wie angezeigt.

### Variance

Vergleicht den aktuellen Terminplan mit der aktiven Baseline: Baseline-Anfang/-Ende gegenüber aktuellem Anfang/-Ende, die Differenz in Arbeitstagen für Anfang und Ende und ein Status pro Aufgabe (im Plan / später / früher / neu / entfallen). Wenn es keine aktive Baseline gibt, stellt der Bildschirm das ausdrücklich fest, statt einen leeren Bericht zu zeigen. Der Zusammenfassungsblock zeigt außerdem die Verschiebung des Projektendetools in Arbeitstagen, falls es eine gibt. Lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang), wie Sie eine Baseline erfassen, bevor dieser Bericht Ihnen etwas Nützliches sagen kann.

## Drucken und Exportieren

Das Einstellungs-Panel hat unten stets eine Schaltfläche **Drucken...** — sie öffnet ein separates Druckfenster, das den Bericht enthält, und löst sofort den Browser-/OS-Druckdialog aus. Für den Gantt-Bericht verwendet dieses Fenster die gewählte Papiergröße und -ausrichtung; die Meilenstein- und Variance-Berichte drucken die Tabelle wie angezeigt.

Nur der Gantt-Bericht hat zusätzlich eine Schaltfläche **PDF exportieren**. Diese speichert die aktuelle Vorschau als echte PDF-Datei (Dateiname endet auf `-planning.pdf`) — eine Seite in den physischen Abmessungen der gewählten Papiergröße und -ausrichtung. Die PDF-Datei ist **vektorbasiert**: Balken, Linien und Text werden als PDF-Zeichenanweisungen gespeichert statt als ein einzelnes eingebettetes Bild, sodass sie auf jeder Zoomstufe scharf bleiben und der Text in jedem PDF-Betrachter auswählbar und durchsuchbar ist. Das gilt für lateinischen, kyrillischen und griechischen Text; enthält das Projekt chinesischen, japanischen, koreanischen, arabischen oder persischen Text, fällt der Export für diesen Text automatisch auf ein Rasterbild zurück — weiterhin korrekt dargestellt, aber nicht auswählbar oder durchsuchbar. Praktisch für E-Mail oder Archivierung ohne den Systemdruckdialog. Möchten Sie direkt drucken (oder über den Systemdialog als PDF speichern, etwa um eine andere Papiergröße zu wählen als die oben eingestellte), verwenden Sie **Drucken...**.

## Berichte in der Praxis

Jeder Berichtstyp bedient ein anderes Gespräch:

- Der **Gantt-Bericht** ist das klassische Handout für die Baustellenbesprechung: der kritische Pfad hervorgehoben, Puffer auf den nicht-kritischen Balken sichtbar und die Legende, die erklärt, was jede Farbe bedeutet. Aktivieren Sie **Aufgabennamen auf Balken** und **Fertigstellung anzeigen**, wenn das Publikum den Terminplan noch nicht kennt; schalten Sie sie aus für einen sauberen Überblick auf A1, wenn daneben eine separate Aufgabenliste ausgehändigt wird.
- Die **Meilensteinübersicht** ist für alle, die nur die wichtigen Termine wollen, ohne sich durch Dutzende Aufgabenzeilen zu blättern — zum Beispiel einen Auftraggeber, der vor allem wissen will, ob die verbindlichen Übergabetermine eingehalten werden. Das Symbol ◆ vor einem Meilensteinnamen in der Tabelle markiert einen **verbindlichen** Meilenstein.
- Der **Variance-Bericht** ist das Gespräch über Kurskorrektur: welche Aufgaben gegenüber der Baseline abrutschen und um wie viele Arbeitstage. Sehen Sie diesen Bericht in der Praxis im Showcase [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), der zwei Baselines hat (eine Vertrags-Baseline und ein Rebaseline nach einer Änderungsverfügung) mit eigenem Fortschritt und Statusdatum — ein gutes Beispiel dafür, wie sich die Δ-Spalten füllen, sobald es eine tatsächliche Differenz zwischen Baseline und aktuellem Terminplan gibt.

Die Live-Vorschau rechts aktualisiert sich bei jeder Änderung der Einstellungen links — es gibt keine separate „Aktualisieren"-Schaltfläche, und nichts wird erst zur Druckzeit berechnet.

## Weiterlesen

- Ein Variance-Bericht hat nichts zu vergleichen, bis eine Baseline erfasst wurde — lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang).
- Der kritische Pfad und der Puffer, die im Gantt-Bericht gezeigt werden, stammen aus derselben Berechnung wie die Gantt-Ansicht selbst — lesen Sie die Anleitung [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse), wie Sie das lesen.
