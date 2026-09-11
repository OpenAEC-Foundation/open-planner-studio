# Ressourcen, Histogramm & Abgleich

Eine Aufgabe sagt Ihnen, wann etwas geschehen muss; eine Ressource sagt Ihnen, wer oder was es tun wird — und wie viel davon an einem bestimmten Tag verfügbar ist. Sobald Sie Ressourcen zu Aufgaben zuweisen, kann ein Tag mehr verlangen, als Kapazität vorhanden ist: eine Überlastung. Diese Anleitung zeigt, wie Sie Ressourcen verwalten und zuweisen, wie Sie die Auslastung im Histogramm lesen und wie (und wann *nicht*) der Abgleich eine Überlastung löst.

## Was Sie hier lernen

- Die fünf Ressourcentypen und wann Sie welchen verwenden.
- Ressourcen zu Aufgaben zuweisen — über den Eigenschaftenbereich, den Aufgabendialog oder das Menüband.
- Einheiten pro Tag und die sechs Verteilungskurven: wann Sie welche wählen.
- Eine Zuweisung auf eine andere Aufgabe verschieben.
- Ressourcenkalender und zeitlich gestaffelte Kapazität (zum Beispiel ein später hinzugefügter zweiter Kran).
- Das Histogramm lesen: die Ressourcenauswahl, das Eingraben pro Ressource, Überlastungen erkennen.
- Das angedockte Ressourcen-Panel neben dem Gantt, als zweites Panel unter Eigenschaften.
- Abgleich: die Optionen im Fenster **Ressourcen abgleichen**, der Unterschied zwischen dem Bleiben innerhalb des Puffers und dem Verschieben des Endtermins sowie Prioritäten (einschließlich Priorität 1000 = „nicht abgleichen").
- Die ehrliche Lektion: wann der Abgleich eine Überlastung *nicht* löst.

Folgen Sie mit [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (mittelgroß, eine bewusste und durch Abgleich lösbare Überlastung bei den Stuckateuren) und mit [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (groß, nahezu jede Ressource überlastet, weil drei Türme gleichzeitig dieselben Kolonnen und den Turmkran brauchen — der Showcase, in dem der Abgleich an seine Grenzen stößt).

## Die fünf Ressourcentypen

Jede Ressource hat einen **Typ** (eine Spalte im Ressourcen-Panel):

- **Personal (LABOR)** — Gewerke: Maurer, Stuckateure, Installateure.
- **Gerät (EQUIPMENT)** — Maschinen und Ausrüstung: ein Turmkran, ein Bauaufzug.
- **Material (MATERIAL)** — Verbrauchsmaterial mit einer **Einheit** (zum Beispiel m³ Beton). Material wird nie abgeglichen und nie im Histogramm gezählt — es ist ein Bestand, keine tageweise Kapazität, die überlaufen kann.
- **Subunternehmer (SUBCONTRACTOR)** — ein externes Unternehmen mit eigener Kapazitätsgrenze, zum Beispiel ein Fassadenunternehmer, der nur zwei Kolonnen gleichzeitig einsetzen kann.
- **Kolonne (CREW)** — eine Dachgruppe. Andere Ressourcen können über die Spalte **Kolonne** im Panel zu Gruppierung/Übersicht einer Kolonne beitreten; das ist rein informativ — es gibt keinen automatischen Kapazitäts-Roll-up zur Kolonne.

## Ressourcen verwalten

Öffnen Sie das Ressourcen-Panel über die Menübandgruppe **Verwalten** auf der Registerkarte **Ressourcen**: Die Schaltfläche **Ressourcen** öffnet das vollständige Panel (eine separate Voll-Panel-Ansicht wie Tabelle oder Beziehungen), **Neue Ressource** öffnet das Panel mit einer Entwurfszeile, in der Sie den Namen sofort eintippen (genau wie die Schaltfläche **+ Neue Ressource** im Panel selbst). Im Panel bearbeiten Sie pro Ressource: **Name**, **Typ**, **Max. Einheiten** (Kapazität pro Arbeitstag — 1 = eine Person/ein Gegenstand vollzeit, 2 = zwei Einheiten zugleich), **Kalender**, **Tarif/Stunde**, **Einheit** (nur Material) und **Kolonne** (zu welcher Kolonne diese Ressource gehört). Unten summiert die Spalte **Gesamt** die Kosten jeder Ressource (belastete Einheiten × Stunden/Tag × Tarif), bei jedem F5 neu berechnet.

Die Entwurfszeile sitzt unten in der Tabelle, genau dort, wo die neue Ressource landen wird, und ist sofort *vollständig* editierbar: Typ, Max. Einheiten, Kalender, Tarif, Einheit und Kolonne sind alle gewöhnliche Steuerelemente. Füllen Sie sie in beliebiger Reihenfolge aus — wählen Sie ruhig zuerst den Typ und tippen Sie den Namen erst danach ein. **Tab** führt Sie durch die Zeile, ohne bereits etwas zu speichern.

Die Zeile existiert aus einem Grund: Eine Ressource wird erst angelegt, sobald ein **Name** vorhanden ist, damit ein Klick auf die Schaltfläche ohne weitere Eingabe keine leere Zeile hinterlässt. Wegklicken oder **Escape** drücken ohne Namen hinterlässt nichts — keine Ressource, kein Schritt in der Rückgängig-Chronik, und Ihr Projekt wird nicht als geändert markiert; selbst wenn Sie unterwegs ein Dropdown geändert haben. Ist ein Name vorhanden, wird die Zeile in dem Moment übernommen, in dem Sie sie verlassen (anderswo klicken oder mit Tab über die letzte Spalte hinausgehen) oder **Enter** drücken — in einem Schritt, mit allem, was Sie ausgefüllt haben, und als einzelner Schritt, den ein Rückgängig zurücknimmt. **Enter** öffnet außerdem direkt darunter eine neue Entwurfszeile, sodass Sie eine ganze Liste am Stück eintippen können.

Auch die bestehenden Zeilen sind per Tastatur navigierbar, in beiden Ansichten (Bibliothek und Projekt): **↑** und **↓** bewegen den Cursor zur selben Spalte in der Zeile darüber oder darunter, und **Enter** (abwärts) oder **Shift+Enter** (aufwärts) tun dasselbe. Auf der allerletzten Zeile öffnet **Enter** dort eine neue Entwurfszeile — dieselbe durchgehende Erfassung wie in der Aufgabentabelle. In den Dropdowns (**Typ**, **Kalender**, **Kolonne**) und im Drehfeld **Max. Einheiten** behalten die Pfeiltasten bewusst ihre eigene Bedeutung (eine Option wählen, einen Wert schrittweise ändern); verwenden Sie dort **Enter**, um zur nächsten Zeile zu wechseln.

### Zeitlich gestaffelte Kapazität

Neben **Max. Einheiten** befindet sich ein Pfeil, der eine Unterzeile **Zeitlich gestaffelte Kapazität** aufklappt: Hier fügen Sie Schritte (ein **Ab**-Datum + **Max. Einheiten**) für Kapazität hinzu, die im Laufe des Projekts variieren. Der große Showcase nutzt dies für den Turmkran: Er steht auf **Max. Einheiten 1**, mit einem Schritt, der die Kapazität **ab Tag 130** auf **2** hebt — den Zeitpunkt, ab dem ein zweiter Kran hinzukommt. Vor diesem Datum müssen sich alle drei Türme einen einzigen Kran teilen; danach können zwei Türme zugleich heben.

## Ressourcen zuweisen

Es gibt drei Stellen, an denen Sie eine Zuweisung verwalten — sie arbeiten auf denselben zugrunde liegenden Daten, sodass alles, was Sie an der einen tun, sofort in den anderen erscheint:

1. **Eigenschaftenbereich** — der Abschnitt **Zuweisungen** unter einer ausgewählten Aufgabe: ein Dropdown zum **Ressource zuweisen** mit den noch nicht zugewiesenen Ressourcen und pro bestehender Zuweisung die **Einh./Tag**, die **Kurve** und eine Schaltfläche zum Entfernen.
2. **Aufgabendialog** — derselbe Abschnitt **Zuweisungen**, im Fenster **Aufgabe bearbeiten**.
3. **Menüband** — Registerkarte **Ressourcen**, Menübandgruppe **Zuweisung**, die Schaltfläche **Zuweisen ▾**. Diese Schaltfläche ist nur aktiv, wenn genau eine Nicht-Meilenstein-, Nicht-Sammelaufgabe ausgewählt ist; das Dropdown lässt Sie zuerst **Einh./Tag** und **Kurve** festlegen und listet dann darunter die noch nicht zugewiesenen Ressourcen — klicken Sie auf einen Namen, um eine Zuweisung in einem Schritt abzuschließen.

Meilensteine und Sammelaufgaben können keine Ressourcen tragen (sie haben keine eigene Dauer, die belastet werden könnte) — beide Stellen zeigen anstelle des Zuweisungsformulars eine Erklärung.

### Eine Zuweisung verschieben

Versehentlich eine Ressource der falschen Aufgabe zugewiesen, oder Arbeit von einer Aufgabe in eine andere verschoben? Im Abschnitt **Zuweisungen** des Eigenschaftenbereichs (oder des Aufgabendialogs) hat jede Zuweisung ein Dropdown **Verschieben nach…**, das die Kandidatenaufgaben auflistet (Blattaufgaben ohne diese Ressource, die aktuelle Aufgabe ausgenommen). Wählen Sie eine aus, wird die Zuweisung in einem einzigen Schritt verschoben, inklusive ihrer Einheiten und Kurve — kein Entfernen und erneutes Erstellen nötig.

## Einheiten und Verteilungskurven

Jede Zuweisung hat **Einh./Tag** (1 = eine Person/ein Gegenstand vollzeit, 0,5 = ein halber Tag) und eine **Kurve**, die bestimmt, wie diese Last über die Aufgabendauer verteilt wird:

- **Gleichmäßig** — flach, jeden Tag dieselbe Menge. Die Voreinstellung und der richtige Ausgangspunkt für die meisten Aufgaben.
- **Vorne belastet (FRONT_LOADED)** — der Großteil der Arbeit früh in der Aufgabe, zum Ende hin abflachend.
- **Hinten belastet (BACK_LOADED)** — das Spiegelbild: zum Ende hin ansteigend, zum Beispiel eine Aufgabe, die erst Schwung aufbauen muss.
- **Glockenform (BELL)** — niedrig am Anfang und Ende, in der Mitte am höchsten — eine Aufgabe, die hochfährt, auf Volllast läuft und wieder abflacht.
- **Frühe Spitze (EARLY_PEAK)** — die Spitze liegt früh in der Aufgabe, dann nimmt die Last ab.
- **Späte Spitze (LATE_PEAK)** — die Spitze liegt spät in der Aufgabe.

Kurvenvariation zeigt sich am deutlichsten im Histogramm: Dieselbe Aufgabe mit denselben Einh./Tag erzeugt mit einer Glockenkurve eine ganz andere Balkenform als mit „Gleichmäßig". Der mittelgroße Showcase mischt absichtlich Gleichmäßig/Vorne belastet/Hinten belastet bei den abschlussbezogenen Aufgaben je Haus, damit Sie den Unterschied vergleichen können.

### Die Stundenverteilung selbst bearbeiten

Passt keine Kurve, gestalten Sie die Verteilung selbst, in **Phasen**: zusammenhängende Abschnitte des Vorgangs mit je festem Einsatz („erste Woche halbe Kolonne, danach volle Kolonne“). Die Schaltfläche **Stundenverteilung…** neben der Kurvenauswahl öffnet ein Fenster mit oben einer Leiste, in der jede Phase ein Block über ihre Arbeitstage ist (Höhe = Einsatz), und darunter denselben Phasen als Tabelle: von, bis, Tage, Einsatz in Einheiten je Tag, Stunden je Tag und Summe. Ausgangspunkt ist, was die Zuweisung heute bucht. Ist-Arbeit erscheint grau und schreibgeschützt.

- **Ziehen in der Leiste**: die Grenze zwischen zwei Blöcken verlängert oder verkürzt eine Phase (in ganzen Arbeitstagen), die Oberkante setzt den Einsatz, Doppelklick auf einen Tag teilt die Phase.
- **Tippen in der Tabelle**: Tage und Einsatz je Phase; **Teilen** und **Zusammenführen**. Die letzte Phase läuft immer bis zum Vorgangsende.
- **Form anwenden** füllt die Phasen mit einer der acht Standardformen und behält die Summe bei.
- **Anwenden** speichert die Verteilung als *Kontur* der Zuweisung; die Kurvenauswahl zeigt **Kontur** und ist deaktiviert. Histogramm, Überlastung, Kapazitätsabgleich und Auslastung rechnen sofort damit, und die Verteilung reist in IFC sowie MS Project XML / P6 XML mit.
- **Verteilung aufheben** entfernt die Kontur.

Eine Kontur ändert nur die Stunden je Tag dieser Zuweisung; Termine, Dauer und Unterbrechungen bleiben, auch bei einer Phase mit Einsatz 0. Ändern Sie später die Dauer, wird die Kontur proportional gedehnt (siehe [MS-Project-Import](docs://gids-msproject-import)). Das Eigenschaftenpanel markiert einen Vorgang mit eigenen Verteilungen mit einer grauen Plakette. Anwenden und Aufheben sind gewöhnliche Rückgängig-Schritte.

## Ressourcenkalender

Eine Ressource kann auf dem **Projektkalender** (Standard) oder auf ihrem eigenen Kalender stehen — zum Beispiel für einen Subunternehmer, der nur vier Tage pro Woche verfügbar ist. Stellen Sie dies über die Spalte **Kalender** im Ressourcen-Panel oder das Feld **Kalender** bei der Ressource selbst ein. Ein Ressourcenkalender berührt nie die CPM-Termine einer Aufgabe (diese laufen weiter auf dem Aufgaben-/Projektkalender) — er beeinflusst nur **Auslastung** und **Abgleich**: Arbeitet eine Ressource an einem Tag nicht, den die Aufgabe braucht, zählt das im Histogramm als Defizit, und der Abgleicher warnt, dass Verschieben diese Kalender-Abweichung nicht behebt. Lesen Sie die Anleitung [Kalender & Stundenplanung](docs://gids-kalenders-uren) für die vollständige Erklärung der Kalender.

## Das Histogramm lesen

Schalten Sie das Histogramm über die Menübandgruppe **Histogramm** auf der Registerkarte **Ressourcen** ein (die Schaltfläche **Histogramm**). Unter dem Gantt erscheint ein Streifen auf derselben Zeitachse: Balken pro Tag, wobei der Teil über der Kapazitätslinie rot gezeigt wird.

Links der Balken, über der Aufgabentabellenspalte, sitzt die **Ressourcenauswahl**: eine Liste mit „Alle Ressourcen" ganz oben und jeder Ressource darunter, jeweils mit einem roten Punkt, wenn diese Ressource irgendwo überlastet ist. Klicken Sie auf einen Namen, um sich auf diese eine Ressource zu konzentrieren — das Histogramm skaliert auf ihre Last und Kapazität allein um. Klicken Sie zurück auf „Alle Ressourcen", um wieder die Summe aller Ressourcen zu sehen. Neben dem Klicken können Sie sich auch mit den Schaltflächen **Vorherige**/**Nächste** in der Menübandgruppe **Histogramm** durch die Ressourcen bewegen, ohne die Auswahl selbst anzufassen.

Klicken Sie auf einen überlasteten Balken, zeigt ein Tooltip, wie viele Aufgaben an jenem Tag zur Last beitragen, mit den ersten Aufgaben-Namen — praktisch, um schnell zu sehen, welche Aufgabenkombination die Überlastung verursacht, ohne jede Zuweisung von Hand zu prüfen.

Wenn Sie statt Balken „Neu berechnen (F5), um die Auslastung anzuzeigen" sehen, wurde der Terminplan seit der letzten Änderung nicht (neu) berechnet — das Histogramm ist wie der kritische Pfad eine Momentaufnahme, die Sie selbst auffrischen.

## Das angedockte Ressourcen-Panel

Neben dem vollständigen Ressourcen-Panel (Menüband-Schaltfläche **Ressourcen**) gibt es eine kompakte Variante, die Sie rechts andocken können: die Schaltfläche **Ressourcen-Dock** in der Menübandgruppe **Verwalten**. Dieses angedockte Panel zeigt nur den Namen, die **Max. Einheiten** (direkt editierbar) und einen roten/grünen Punkt für Überlastung — eine schnelle Übersicht neben Ihrem Gantt, ohne das vollständige Panel zu öffnen.

Die Seitenspalte enthält **zwei gleichwertige Panels** übereinander: **Eigenschaften** und die angedockte Ressourcenliste. Sie ersetzen einander nicht und klappen nicht weg — ist ein Panel eingeschaltet, sehen Sie einfach seinen Inhalt. Jedes Panel hat dafür einen eigenen Schalter: die Menüband-Schaltflächen **Eigenschaften** und **Ressourcen-Dock**, beide in der Gruppe **Bereiche** auf der Registerkarte **Ansicht**. Derselbe Schalter sitzt als **✕** auch in der eigenen Kopfleiste des Panels.

Die Höhe teilen Sie auf, indem Sie die **Grenze zwischen den beiden Panels** ziehen; diese Aufteilung wird gemerkt. Ist nur ein Panel eingeschaltet, erhält es stets die volle Höhe. Sind beide aus, gibt es überhaupt keine Seitenspalte, und das Gantt erhält die volle Breite.

Um die Spalte *ohne* Verlust Ihrer Panel-Auswahl aus dem Weg zu bekommen, verwenden Sie die Schaltfläche oben rechts in der oberen Kopfleiste. Übrig bleibt ein schmaler Streifen; ein Klick darauf bringt die Spalte genau so zurück, wie Sie sie verlassen haben.

Dieselben drei Schaltflächen — **Ressourcen**, **Ressourcen-Dock** und **Histogramm** — sitzen ebenfalls auf der Registerkarte **Ansicht** in der Menübandgruppe **Bereiche**, neben **Eigenschaften**. Gleicher Name, gleiches Symbol, gleiches Verhalten: Wo auch immer Sie darauf klicken, sie tun genau dasselbe. Der Unterschied liegt zwischen den beiden Ressourcen-Schaltflächen selbst: **Ressourcen** öffnet das vollständige Panel über dem Arbeitsbereich, **Ressourcen-Dock** heftet die kompakte Liste als zweites Panel in der Seitenspalte an.

## Überlastungen erkennen

Eine Ressource ist an einem Tag überlastet, sobald die summierten Einheiten all ihrer Zuweisungen an jenem Tag ihre **Max. Einheiten** überschreiten. Das sehen Sie an drei Stellen: dem roten Anteil des Balkens im Histogramm, dem roten Punkt in der Ressourcenauswahl und dem angedockten Panel sowie dem **Überlastung**-Zähler in der Menübandgruppe auf der Registerkarte Ressourcen („N Ressourcen" mit einem Warnsymbol oder „Keine").

Der mittelgroße Showcase macht das absichtlich sichtbar: Anfang Juni erhalten die **Stukadoors** (Stuckateure, Max. Einheiten 2) eine 2-Einheiten-Zuweisung auf drei Häuser zugleich (das Verputzen von Haus 1, 2 und 3 überschneidet sich dort einige Tage) — an der Spitze zusammen 6 Einheiten, deutlich über der Kapazität von 2.

## Abgleich

Öffnen Sie das Fenster **Ressourcen abgleichen** über die Schaltfläche **Abgleichen…** in der Menübandgruppe **Ressourcenabgleich** auf der Registerkarte Ressourcen. Das Fenster setzt eine gültige, aktuelle Berechnung voraus (berechnen Sie bei veraltetem Terminplan zuerst mit F5 neu) und arbeitet in zwei Schritten: zuerst **Berechnen** für einen Vorschlag, dann **Anwenden** — an Ihrem Terminplan ändert sich nichts, bis Sie den Vorschlag gesehen haben.

Im Fenster wählen Sie:

- **Ressourcen** — welche Ressourcen am Abgleichslauf teilnehmen (standardmäßig alle; Material ist stets ausgeschlossen — es wird nie abgeglichen).
- **Nur innerhalb des Puffers abgleichen (Glättung)** — ein Kontrollkästchen mit klarer Unterzeile: „Projektende bleibt unverändert". Aus (**Abgleich**) darf der Abgleicher Aufgaben so weit wie nötig verschieben, auch über ihren eigenen Puffer hinaus, was das Projektende hinausschieben kann. An (**Glättung**) ist das Enddatum unantastbar — der Abgleicher verschiebt nur innerhalb des vorhandenen Puffers jeder Aufgabe, und ein Konflikt, der dort nicht hineinpasst, bleibt als verbleibender Konflikt markiert.

Nach **Berechnen** zeigt das Fenster eine Tabelle mit jeder Aufgabe, deren Anfang sich ändert (alter Anfang → neuer Anfang → verschobene Tage), eine Zeile, die meldet, ob sich das Projektende ändert, und — falls Konflikte bleiben — einen Abschnitt **Verbleibende Konflikte** mit pro Aufgabe dem Grund: eine Kalender-Abweichung (die Ressource arbeitet nicht an den Tagen, die die Aufgabe braucht), nicht genug freie Kapazität innerhalb des Puffers oder eine inhärente Überlastung (eine einzelne Zuweisung fordert an ihrer Spitze bereits mehr, als die Ressource jemals liefern könnte — kein Verschieben behebt das). Erst wenn Sie mit dem Vorschlag zufrieden sind, klicken Sie auf **Anwenden**.

Probieren Sie das selbst an der Stuckateur-Überlastung im mittelgroßen Showcase aus: Öffnen Sie **Nieuwbouw 6 Rijwoningen De Akkers**, gehen Sie zur Registerkarte **Ressourcen** und öffnen Sie **Ressourcen abgleichen**. Lassen Sie alle Ressourcen markiert, Glättung aus und klicken Sie auf **Berechnen**: Die Konflikte verschwinden vollständig (0 verbleibende Konflikte), aber das Projektende rückt etwa eine Woche später. Aktivieren Sie dann **Nur innerhalb des Puffers abgleichen** und berechnen Sie erneut: Das Enddatum bleibt nun unverändert, aber eine Aufgabe (Verputzen in einem der Häuser) bleibt als markierter Konflikt bestehen — es gibt einfach nicht genug Puffer, um sie vollständig in den bestehenden Terminplan einzupassen. Genau diesen Kompromiss macht das Kontrollkästchen sichtbar: Lösen Sie das Problem, indem Sie das Enddatum ziehen lassen, oder fixieren Sie das Enddatum und akzeptieren einen markierten verbleibenden Konflikt?

### Prioritäten

Jede Aufgabe hat eine **Abgleich-Priorität** von 0 bis 1000 (Standard 500). Klicken Sie mit der rechten Maustaste auf eine Aufgabe und wählen Sie **Priorität** für drei Voreinstellungen: **Niedrig** (100), **Normal** (500) und **Hoch** (900) — bei einem Kapazitätskonflikt zwischen zwei Aufgaben bekommt die mit der höheren Priorität den ersten Zugriff auf die knappe Kapazität. Der Wert **1000** ist ein Sonderfall: „nicht abgleichen" (MS Project nennt das „Do Not Level"). Eine solche Aufgabe durchläuft zwar die Abgleichsschleife und folgt ihren eigenen, möglicherweise verschobenen Vorgängern, wird aber selbst nie verschoben, um Kapazität freizugeben. Der große Showcase nutzt das bei „Nutsaansluitingen aanleggen" (Hausanschlüsse verlegen): ein festes, vom Versorger gesetztes Anschlussdatum, das sich nicht bewegen darf, was auch immer der Abgleichslauf sonst vorschlägt.

**Aufheben** (in der Menübandgruppe **Ressourcenabgleich**) entfernt jede zuvor angewandte Verschiebung in einem Schritt — praktisch, um zum ursprünglichen, nicht abgeglichenen Terminplan zurückzukehren, ohne jede Aufgabe von Hand zurückzusetzen.

## Die ehrliche Lektion: wann der Abgleich nicht hilft

Der Abgleich löst eine Überlastung, indem er Arbeit in der Zeit umordnet — innerhalb des Puffers oder, falls nötig, mit einem späteren Enddatum. Das funktioniert gut, solange irgendwo im Terminplan genug Raum (Puffer oder Zeit) ist, um die überschüssige Nachfrage umzuverteilen. Es funktioniert grundsätzlich *nicht*, wenn die Nachfrage strukturell größer ist als das, was jemals verfügbar sein wird, egal wie Sie Dinge verschieben.

Der große Showcase zeigt das über mehrere Ressourcen zugleich: Weil die drei Türme weitgehend parallel laufen und sich dieselben Kolonnen teilen (Maurer, Installateure, Stuckateure, Fliesenleger, der Turmkran), ist nahezu jede Personal-Ressource irgendwann überlastet. Gleichen Sie mit allen Ressourcen ausgewählt und freiem Enddatum ab, verschwinden die meisten Konflikte — aber das Projektende rutscht um Monate, und eine Handvoll Abschlussaufgaben pro Turm (Fliesen, Küchen, Sanitär, Malen) bleiben als inhärente Überlastung: Eine einzelne Zuweisung übersteigt dort an ihrer Spitze bereits die Kapazität, sodass kein Verschieben hilft. Aktivieren Sie Glättung, um das Enddatum zu schützen, bleibt ein viel größerer Anteil der Konflikte schlicht ungelöst.

Die Lektion ist nicht, dass der Abgleich „nicht funktioniert" — der Algorithmus tut genau das, was man ihm abverlangt. Die Lektion ist, dass der Abgleich ein **Terminplanungs**-Werkzeug ist, kein **Kapazitäts**-Werkzeug: Er ordnet vorhandene Arbeit innerhalb vorhandener Zeit um, erschafft aber keine zusätzlichen Gewerke, Geräte oder Kalendertage. Ein struktureller Mangel — zu wenige Stuckateure für drei Türme zugleich, ein Turmkran für drei Baustellen — verlangt eine andere Lösung: mehr Kapazität einstellen, die Phasierung anpassen (Türme nacheinander statt parallel, was der Zweite-Kran-Schritt ab Tag 130 bereits teilweise tut) oder die Arbeit anders aufteilen. Der Abgleich ist das Werkzeug, das Ihnen zeigt, wo es schmerzt; er löst Ihnen nicht die zugrundeliegende Kapazitätsfrage.

## Weiterlesen

- Spielen Sie den Abgleich der Stuckateur-Überlastung selbst in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) nach.
- Sehen Sie die Grenzen des Abgleichs in der Praxis — plus alle fünf Ressourcentypen, alle sechs Kurven und die zeitlich gestaffelte Turmkran-Kapazität — in [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Ressourcen laufen auf Kalendern — lesen Sie die Anleitung [Kalender & Stundenplanung](docs://gids-kalenders-uren) zu Ressourcenkalendern und Stundenplanung.
- Möchten Sie vor dem Abgleich eine Baseline setzen, um den Unterschied zu sehen? Lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang).
- Der Abgleich kann ändern, welche Aufgaben kritisch sind — lesen Sie die Anleitung [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse), wie Sie das erkennen.
