# Kritischer Pfad & weitergehende Analyse

Jeder Terminplan hat eine längste Kette von Aufgaben, die gemeinsam bestimmen, wann das Projekt endet: der kritische Pfad. Alles außerhalb davon hat Puffer — Spielraum zum Abweichen, ohne das Enddatum zu berühren. Diese Anleitung geht über „welche Balken sind rot" hinaus: Gesamt-/Freier-/Interferierender Puffer, beinahe-kritische Aufgaben, mehrere gleich kritische Pfade, Hammocks, harte Pins und ihre stromaufwärts wirkende Folge sowie externe Verknüpfungen zwischen Projekten.

## Was Sie hier lernen

- Den kritischen Pfad lesen und den Unterschied zwischen Gesamt-, Freiem und Interferierendem Puffer.
- Beinahe-kritische Aufgaben: die Schwelle einstellen und die Bernstein-Markierung erkennen.
- Mehrere kritische Pfade zugleich — wann das passiert und wie Sie es sehen.
- Harte Pins und ihre Wirkung auf den Puffer, einschließlich negativem Puffer, der stromaufwärts entsteht.
- Hammocks (Level of Effort): was sie tun und was nicht.
- Externe Verknüpfungen zwischen Projekten: der eingefrorene Anker, das Aktualisieren und der Status „veraltet".
- Einen Pfad über das Kontextmenü oder das Menüband verfolgen.
- Der Abschnitt **Berechnung** in den Projekteinstellungen.

Folgen Sie mit [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) — der große „Kitchen-Sink"-Showcase mit drei parallelen Türmen, der fast jedes Thema dieser Anleitung zeigt: mehrere kritische Pfade, beinahe-kritische Aufgaben, einen Hammock, einen harten Pin und eine externe Verknüpfung zu einer separaten Quelldatei.

## Den kritischen Pfad lesen

Drücken Sie **F5** (oder die Schaltfläche **Berechnen**), um den Terminplan zu berechnen. Die Statusleiste unten zeigt dann beispielsweise „Kritischer Pfad: N Aufgaben, M Arbeitstage" — die Anzahl der Aufgaben auf dem kritischen Pfad und die Gesamtdauer. Im Gantt-Diagramm erhalten kritische Aufgaben ihre eigene (rote) Balkenfarbe: Aufgaben ohne Puffer, bei denen jeder Tag Verzug das Projektende unmittelbar hinausschiebt.

Doppelklicken Sie auf eine Aufgabe und schauen Sie im Abschnitt **CPM-Ergebnis** nach den genauen Zahlen: **Frühester Anfang**, **Frühestes Ende**, **Spätester Anfang**, **Spätestes Ende**, **Gesamtpuffer**, **Freier Puffer** und (wo zutreffend) **Interferierender Puffer** sowie ob die Aufgabe auf dem **Kritischen Pfad** liegt. Möchten Sie diese Felder als Spalten in der Aufgabentabelle? **Ansicht → Spalten…** und aktivieren Sie sie.

### Gesamt-, Freier und Interferierender Puffer

- **Gesamtpuffer** — wie weit eine Aufgabe insgesamt abweichen kann, ohne das Projektende zu berühren. Null bedeutet kritisch.
- **Freier Puffer** — wie weit eine Aufgabe abweichen kann, ohne ihren unmittelbaren Nachfolger zu berühren. Kann kleiner sein als der Gesamtpuffer: Eine Aufgabe kann etwas Gesamtpuffer haben, doch wenn sie einen einzigen Tag abweicht, bewegt sich ihr direkter Nachfolger bereits mit (dieser Nachfolger hat dann genug eigenen Puffer, um das Enddatum nicht zu berühren).
- **Interferierender Puffer** — die Differenz zwischen den beiden (Gesamtpuffer − Freier Puffer): der Teil Ihres Puffers, der das Enddatum nicht berührt, aber einem Nachfolger „im Weg steht". Null bedeutet, dass Freier und Gesamtpuffer gleich sind — ein Abweichen innerhalb Ihres Puffers betrifft dann niemanden.

## Beinahe-kritische Aufgaben

Eine Aufgabe mit einem kleinen, von null verschiedenen Gesamtpuffer ist verwundbar: ein kleiner Rückschlag macht sie doch noch kritisch. Aktivieren Sie das über **Projektinfo → Berechnung → Beinahe-kritisch markieren**, mit einer **Schwelle** in Arbeitstagen (oder Stunden, je nach Ihrer Daueranzeige). Jede Aufgabe mit einem Gesamtpuffer größer als null und kleiner oder gleich dieser Schwelle erhält im Gantt eine Bernstein-Balkenfarbe — zwischen dem Rot der kritischen und dem Grün des reichlichen Puffers.

Der große Showcase setzt die Schwelle auf 3 Arbeitstage. Die Schlussabnahme von **Turm C** hat daher genau 3 Arbeitstage Gesamtpuffer — gerade innerhalb der Schwelle —, während die identischen Schlussabnahmen von **Turm A** und **Turm B** bei null Puffer liegen und tatsächlich kritisch sind. Turm C ist bis auf eine etwas kürzere Abschlussaufgabe identisch mit den beiden anderen in Aufgaben und Dauern; dieser kleine Unterschied reicht genau aus, um ihn von kritisch auf beinahe-kritisch zu verschieben.

## Mehrere kritische Pfade

Normalerweise gibt es genau eine längste Kette, aber es kann vorkommen, dass zwei oder mehr Ketten exakt gleich lang sind — dann sind beide (oder alle) gleichermaßen kritisch. Aktivieren Sie **Mehrere Pufferpfade** (**Projektinfo → Berechnung**), um das berechnen zu lassen: Wählen Sie die **Methode** (**Freier Puffer (Peeling)** oder **Gesamtpuffer (Rangfolge)**) und eine **Max. Pfade**. Jede Aufgabe erhält dann eine **Pufferpfad**-Nummer (1 = am kritischsten); eine Aufgabe ohne Pufferpfad liegt auf keinem der berechneten Pfade.

Im großen Showcase sind Turm A und Turm B in Aufgaben und Dauern vollkommen symmetrisch — sie enden exakt zur selben Zeit. Sobald Sie **Mehrere Pufferpfade** aktivieren, sehen Sie in den Ergebnissen mehr als einen Pfad (`criticalPaths.length` größer als 1 in der Berechnung): keine einzelne längste Kette, sondern mehrere gleich kritische Ketten, die durch das Projekt laufen. Das ist ein anderes Signal als „ein kritischer Pfad mit etwas beinahe-kritischer Arbeit daneben" — es bedeutet, dass eine Verzögerung in *jedem* dieser Pfade das Enddatum gleichermaßen trifft, Sie Ihre Aufmerksamkeit also nicht auf eine einzige Kette konzentrieren können.

## Harte Pins und ihre Wirkung auf den Puffer

Ein **harter Pin** (das Kontrollkästchen **Verbindlich (Pin-Logik)** bei einer MSO- oder MFO-Einschränkung) fixiert eine Aufgabe auf ein Datum, selbst wenn ihre Vorgänger dem logisch widersprechen. Der große Showcase nutzt das bei „Wegafzetting gemeente (vergunde stremmingsperiode)" (straßenseitige Sperrung durch die Gemeinde, genehmigtes Sperrzeitfenster): Die Gemeinde lässt die Sperrung nur exakt an diesem genehmigten Datum zu, Punkt — die Netzlogik biegt sich darum.

Die stromaufwärts wirkende Folge ist der tricky Teil: Brauchen die Vorgänger einer fixierten Aufgabe mehr Zeit, als bis zum Pin-Datum verfügbar ist, entsteht bei diesen Vorgängern **negativer Puffer**. Negativer Puffer ist also kein Berechnungsfehler: Er ist die Art der Engine, Ihnen zu sagen: „Diese vorausgehende Kette passt nicht mehr in die Zeit, die der Pin zulässt". Sehen Sie stromaufwärts vor einem harten Pin negativen Puffer, lautet die Frage nicht „was ist hier kaputt", sondern „welches von diesen beiden Dingen muss nachgeben: das Pin-Datum oder die Dauer der Kette davor".

Hinweis: Im großen Showcase ist die gesamte Kette um „Wegafzetting gemeente" — einschließlich der fixierten Aufgabe selbst — längst vollständig abgeschlossen (Ist-Anfang und Ist-Ende, deutlich vor dem Statusdatum). Daher sehen Sie dort über die gesamte Phasen-1-Kette einen kleinen Rest-Negativpuffer, einschließlich auf der Pin-Aufgabe selbst: Das ist eine Eigenschaft bereits abgeschlossener Aufgaben in Kombination mit einem Statusdatum, nicht das oben beschriebene Szenario „Vorgänger passen nicht". Um dieses Szenario in reiner Form zu sehen: Deaktivieren Sie das Statusdatum vorübergehend (Menübandgruppe **Baselines & Fortschritt**, Schaltfläche **Statusdatum leeren**) und berechnen Sie neu — die Pin-Aufgabe selbst steht dann wieder bei null Gesamtpuffer, und negativer Puffer erscheint erst, wenn Sie die vorausgehende Kette absichtlich länger machen als den vor dem Pin-Datum verfügbaren Raum.

## Hammocks (Level of Effort)

Ein **Hammock** (das Kontrollkästchen **Hammock (abgeleitete Dauer)** im Eigenschaftenbereich) ist eine Aufgabe ohne eigene Dauereingabe: Ihr Anfang und Ende ergeben sich automatisch aus ihren eigenen Beziehungen. Eingehende **FS**/**SS**-Beziehungen liefern den **Start-Treiber** (den frühesten Anfang), eingehende **FF**/**SF**-Beziehungen liefern den **Ende-Treiber** (das späteste Ende) — der Bereich zeigt beide schreibgeschützt an, sobald Sie das Hammock-Kästchen aktivieren, damit Sie genau sehen, welche Aufgaben die Spanne bestimmen. Ohne Ende-Treiber fällt die Spanne auf die Länge null zurück, mit einer Warnung im Bereich.

Was ein Hammock tut: Er zeigt als eine Art übergreifenden Balken die volle Spanne eines Arbeitspakets an, ohne dass Sie selbst eine Dauer pflegen müssen — praktisch für etwa „Bauleitung" oder „allgemeine Baustellen-Overhead", die buchstäblich so lange läuft wie die zugrunde liegende Arbeit. Was ein Hammock nicht tut: Er trägt keine eigenen Ressourcen oder Logik, die die CPM-Berechnung beeinflussen — er ist eine abgeleitete Ansicht, keine treibende Aufgabe. Der große Showcase nutzt das für „Ruwbouw toren A (LOE)" (Rohbau Turm A): ein Hammock, der beginnt, sobald die erste echte Rohbau-Aufgabe von Turm A beginnt, und endet, sobald die letzte erledigt ist, ohne selbst dazwischen irgendwo zu stehen.

## Externe Verknüpfungen zwischen Projekten

Große Projekte bestehen manchmal aus mehreren separat verwalteten Teil-Terminplänen — zum Beispiel Ihrem eigenen Master-Terminplan und einem Erdarbeiten-Paket, das ein anderer Auftragnehmer verwaltet. Eine **externe Verknüpfung** (das Fenster **Externe (projektübergreifende) Verknüpfung**, geöffnet über die Schaltfläche auf der Registerkarte **Beziehungen**) erfasst eine Beziehung zu einer Aufgabe in einer solchen anderen Datei, ohne diese Datei als Dokument öffnen zu müssen.

Sie wählen eine **Quelldatei** aus Ihren zuletzt verwendeten Dateien (die schreibgeschützt eingelesen, nie als Dokument geöffnet wird) oder füllen **Manuell** mit Projekt-ID, Aufgaben-ID und Ankertermin aus, wenn Sie die Quelldatei nicht zur Hand haben. Dann wählen Sie die **Richtung** (Vorgänger oder Nachfolger), den **Beziehungstyp** (FS/SS/FF/SF) und einen **Abstand**. Der **Ankertermin** — das Datum der Quellaufgabe im Moment der Verknüpfung — wird in Ihrer eigenen Datei eingefroren; dieses Datum folgt nicht automatisch, wenn sich das Quellprojekt ändert.

Möchten Sie wissen, ob die Quelldatei inzwischen aktualisiert wurde? Gehen Sie zur Registerkarte **Beziehungen**, Abschnitt **Externe Verknüpfungen**, und klicken Sie auf **Diese Verknüpfung aktualisieren** (pro Verknüpfung) oder **Externe Anker aktualisieren** (alle zugleich), um die Quelldatei neu einzulesen und den Anker zu aktualisieren. Ist die Quelldatei nicht verfügbar — verschoben, umbenannt oder nie mitgeliefert —, zeigt die Verknüpfung das Label **veraltet** mit dem Tooltip „Quelle nicht geladen — zum Aktualisieren erneut importieren": Die App kann dann selbst nicht mehr verifizieren, ob der eingefrorene Anker noch gilt.

Der große Showcase demonstriert absichtlich genau diesen letzten Pfad: Die Aufgabe „Bestrating parkeerterrein" (Pflasterarbeiten Parkplatz) ist mit einer Quelldatei eines Erdarbeiten-Subunternehmers verknüpft, die bewusst *nicht* mit dem Beispiel mitgeliefert wird. Öffnen Sie die Aufgabe, sehen Sie die Verknüpfung mit dem Status „veraltet" gelistet — eine ehrliche Demonstration dessen, was passiert, wenn eine externe Quelldatei nicht mehr verfügbar ist, statt einer Verknüpfung, die stets einwandfrei aktualisiert.

## Einen Pfad verfolgen

Möchten Sie genau sehen, welche Aufgaben eine bestimmte Aufgabe stromaufwärts und stromabwärts beeinflussen? Klicken Sie mit der rechten Maustaste auf die Aufgabe und wählen Sie **Pfad verfolgen** (oder **Pfadverfolgung beenden**, um es wieder auszuschalten) — das hebt die gesamte Kette von Vorgängern und Nachfolgern auf einen Schlag hervor. Für gezielteres Arbeiten hat das Menüband (Registerkarte **Planung** oder **Beziehungen**, Menübandgruppe **Pfadverfolgung**) ein eigenes Schaltflächenpaar **Vorgänger**/**Nachfolger**: beide aus zeigt nichts, eines an zeigt diese eine Richtung, beide an entspricht dem Kontextmenü-Befehl. Die Verfolgung unterscheidet zudem zwischen allen logisch verbundenen Aufgaben und den Aufgaben, die das Datum tatsächlich **maßgeblich** bestimmen (dieselbe „Maßgebend"-Beziehung wie in der Beziehungstabelle) — Sie sehen also nicht nur, was verbunden ist, sondern was tatsächlich steuert.

## Berechnungseinstellungen

Der Abschnitt **Berechnung** in **Projektinfo** (Backstage → Projektinfo, oder das Fenster **Projektinformationen**) sammelt die Berechnungsoptionen, die zu diesem speziellen Projekt gehören — sie gehören zur Datei, nicht zur App, sodass ein Kollege, der dieselbe Datei öffnet, dasselbe Ergebnis erhält:

- **Kritisch-Definition** — **Gesamtpuffer ≤ Schwelle** (Standardschwelle 0) oder **Längster Pfad**, das Aufgaben anhand der längsten Kette durch das Netz als kritisch markiert, unabhängig von ihrer Pufferzahl.
- **Pufferberechnung** — wie der Gesamtpuffer für eine Aufgabe mit sowohl einer Anfangs- als auch einer Endeseite bestimmt wird: **Kleinster (Start/Ende)** (Standard), **Startpuffer** oder **Endpuffer**.
- **Offene Vorgänge kritisch** — Aufgaben ohne Nachfolger automatisch als kritisch behandeln.
- **Beinahe-kritisch markieren** mit **Schwelle** (siehe oben).
- **Mehrere Pufferpfade** mit **Methode** und **Max. Pfade** (siehe oben).
- **Abstandskalender** — welchen Kalender eine Verzögerung in Arbeitstagen verwendet: den des **Vorgängers**, den des **Nachfolgers**, immer **24-Stunden** oder den **Projektkalender**.

## Weiterlesen

- Sehen Sie mehrere kritische Pfade, beinahe-kritische Aufgaben, einen Hammock, einen harten Pin und eine externe Verknüpfung in einem einzigen Terminplan: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Beziehungen, Verzögerung/Vorlauf und Einschränkungen (einschließlich des harten Pins) sind ausführlicher in der Anleitung [Beziehungen & Einschränkungen](docs://gids-relaties-constraints) erklärt.
- Der Abgleich kann die Struktur des kritischen Pfads ändern — lesen Sie die Anleitung [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram).
- Fortschritt und ein Statusdatum können bei einer bereits fixierten Aufgabe negativen Puffer erzeugen — lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang).
