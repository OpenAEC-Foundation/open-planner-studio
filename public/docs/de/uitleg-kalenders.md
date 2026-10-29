# Kalender und Arbeitstage

Wie viele Arbeitstage braucht ein Vorgang, und an welchem Datum endet er? Das hängt vom Kalender ab, nach dem die App zählt. In diesem Artikel lesen Sie, was ein Kalender ist, wie die App damit Arbeitstage zählt und welcher Kalender gilt, wenn mehr als einer im Spiel ist. Das Rechenbeispiel hilft Ihnen, den Zahlen zu folgen.

## Das Konzept

Ein Terminplan zählt in **Arbeitstagen**, nicht in Kalendertagen. „Fünf Tage Maurerarbeit“ bedeutet fünf Tage, an denen gearbeitet wird. Ein Wochenende oder ein Feiertag zählt nicht. Deshalb umfasst so ein Vorgang im Kalender mehr als fünf Tage.

Welche Tage Arbeitstage sind, steht in einem **Kalender**. Ein Kalender legt drei Dinge fest:

- Die **Arbeitswoche**: die Wochentage, an denen gearbeitet wird. Standardmäßig ist das Montag bis Freitag.
- Die **Arbeitszeiten**: Beginn, Ende und Pause. Sie ergeben die **Nettostunden pro Tag**. Standardmäßig ist das 07:00 bis 16:00 Uhr mit einer Stunde Pause, also 8 Stunden.
- Die **Feiertage**: einzelne Tage oder ganze Zeitabschnitte, an denen nicht gearbeitet wird, zum Beispiel Königstag, Weihnachten oder die Bauferien.

Ein Projekt hat eine Bibliothek mit Kalendern. Einer davon ist der **Projektkalender**. Er gilt für jeden Vorgang, der keinen eigenen Kalender hat. Sie geben einem einzelnen Vorgang einen anderen Kalender, zum Beispiel eine Sechs-Tage-Arbeitswoche für einen Subunternehmer, der auch samstags arbeitet. Eine Ressource kann ebenfalls einen eigenen Kalender haben, aber dieser wirkt anders (siehe unten).

## So rechnet die App

Dieser Artikel beschreibt die Standardberechnung: das Berechnungsprofil *Open Planner Studio*, mit dem ein neues Projekt rechnet.

### Arbeitstage zählen

Der erste Arbeitstag eines Vorgangs zählt als Tag 1. Ein Vorgang von 5 Tagen endet deshalb am fünften Arbeitstag. Fällt der Start auf einen arbeitsfreien Tag, beginnt der Vorgang am nächsten Arbeitstag. Ein Feiertag oder die Bauferien mitten in einem Vorgang zählen nicht: Der Vorgang läuft einfach darüber hinweg und wird im Kalender länger.

Die Stunden pro Tag spielen bei den Daten eines Tagesvorgangs keine Rolle. Nur die Arbeitswoche und die Feiertage zählen. Die Arbeitszeiten spielen nur bei einem Stundenvorgang eine Rolle; das wird behandelt in [Tage und Stunden](docs://uitleg-dagen-en-uren).

### Welcher Kalender gilt

Die App wählt pro Vorgang einen Kalender:

1. Hat der Vorgang einen eigenen Kalender, rechnet die App diesen Vorgang vollständig in diesem Kalender: Dauer, Enddatum und Puffer.
2. Hat er keinen, gilt der Projektkalender. Verweist ein Vorgang auf einen Kalender, den es nicht mehr gibt, gilt ebenfalls der Projektkalender.

Ein Sammelvorgang (eine Phase) hat keine eigene Arbeit und damit auch keinen eigenen Kalender. Seine Dauer ergibt sich aus den Daten seiner Vorgänge, und die App zählt ihn im Projektkalender.

Der Kalender einer **Ressource** spielt bei den Daten keine Rolle. In einem Terminplan, den Sie selbst in der App aufbauen, bestimmt er nur, wann die Ressource verfügbar ist: im Histogramm, bei Überlastung und beim Kapazitätsabgleich.

### Vorgänge in unterschiedlichen Kalendern

Sind zwei Vorgänge mit unterschiedlichen Kalendern verknüpft, gilt Folgendes:

- Bei einer Ende-Anfang-Beziehung beginnt der Nachfolger am ersten Arbeitstag nach dem Ende des Vorgängers, gezählt im Kalender des **Nachfolgers**. Endet ein Vorgang an einem Freitag, beginnt ein Nachfolger mit einer Sechs-Tage-Arbeitswoche am Samstag.
- Ein **Zeitabstand** zählt standardmäßig im Kalender des **Vorgängers**. Das können Sie unter *Einstellungen › Projekt › Projekteinstellungen* ändern, im Block *Berechnungsprofil und Berechnungsoptionen*, unter *Berechnungsoptionen dieses Projekts*, mit der Auswahl *Abstandskalender*: *Vorgänger* (Standard), *Nachfolger*, *24-Stunden* oder *Projektkalender*.
- Der **Gesamtpuffer** zählt in Arbeitstagen des Kalenders des Vorgangs selbst. In diesem Profil zählt der **freie Puffer** im Kalender des Nachfolgers.

Was ein Zeitabstand genau ist, steht in [Beziehungen hinzufügen](docs://howto-relaties-leggen). Was der Puffer ist, steht in [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad).

### Im Gantt-Diagramm

Der graue Hintergrund im Gantt-Diagramm zeigt immer die arbeitsfreien Tage des **Projektkalenders**. Ein Vorgang mit eigenem Kalender kann deshalb über einen grauen Tag hinweglaufen, zum Beispiel ein Vorgang von sechs Tagen über den Samstag. Ein Feiertagszeitraum von drei Tagen oder mehr wird mit seinem Namen angezeigt, zum Beispiel *Bouwvak (Noord)*. Das geschieht nicht, wenn *Nur Arbeitstage anzeigen* aktiv ist. Wenn Sie die grauen Tage gar nicht sehen wollen, schalten Sie *Nur Arbeitstage anzeigen* ein unter *Einstellungen › Projekt › App-Einstellungen*, Registerkarte *Darstellung*, Abschnitt *Zeitachse*.

## Rechenbeispiel: der Terminplan für den Bau

Das Beispiel nutzt den Standardkalender *Bouwkalender NL*: Montag bis Freitag, mit den niederländischen gesetzlichen Feiertagen. Alle Vorgänge dauern eine ganze Anzahl Tage. Im Tutorial zu Kalendern (Tutorial 3) bauen Sie einen solchen Kalender selbst.

### Wochenende, Feiertag und Bauferien

*Brickwork* dauert 5 Arbeitstage und beginnt am Donnerstag, 13. Mai 2027. Donnerstag, 13. und Freitag, 14. Mai sind Tag 1 und 2. Das Wochenende und Pfingstmontag, 17. Mai, zählen nicht. Dienstag, 18., Mittwoch, 19. und Donnerstag, 20. Mai sind Tag 3, 4 und 5. Der Vorgang endet am **Donnerstag, 20. Mai**: acht Kalendertage für fünf Arbeitstage.

Die Bauferien machen den Unterschied größer. Nehmen Sie *Bouwvak (Noord)*, vom 26. Juli bis einschließlich 13. August 2027, und denselben Vorgang von 5 Arbeitstagen ab Freitag, 23. Juli. Freitag, 23. Juli ist Tag 1. Danach steht der Kalender drei Wochen lang still. Montag, 16. bis Donnerstag, 19. August sind Tag 2 bis 5. Das Ende ist **Donnerstag, 19. August**, 28 Kalendertage nach dem Start. Ohne die Bauferien wäre es Donnerstag, 29. Juli gewesen.

### Ein Vorgang am Samstag

Drei Vorgänge folgen aufeinander, alle mit einer Ende-Anfang-Beziehung ohne Zeitabstand: *Groundwork* (4 Tage), *Pour foundation* (3 Tage) und *Brickwork* (5 Tage). Der Projektstart ist am Montag, 24. Mai 2027.

Liegen alle drei im Projektkalender, läuft *Groundwork* von Montag, 24. bis Donnerstag, 27. Mai. *Pour foundation* läuft von Freitag, 28. Mai bis Dienstag, 1. Juni (Freitag, Montag, Dienstag). *Brickwork* läuft von Mittwoch, 2. Juni bis Dienstag, 8. Juni. Das Projektende ist am **Dienstag, 8. Juni**.

Geben Sie *Pour foundation* den Kalender *Six-day week* (Montag bis Samstag), dann zählt der Samstag. Der Vorgang läuft von Freitag, 28. Mai bis **Montag, 31. Mai** (Freitag, Samstag, Montag). *Brickwork* bleibt im Projektkalender, beginnt am Dienstag, 1. Juni und endet am **Montag, 7. Juni**. Das ganze Projekt ist einen Tag kürzer, weil ein Vorgang am Samstag arbeitet.

### Ein Zeitabstand über zwei Kalender

*Pour floor* (six-day week, 4 Tage) beginnt am Montag, 31. Mai und endet am Donnerstag, 3. Juni. *Pointing* (Projektkalender, 3 Tage) folgt mit einem Zeitabstand von 2 Arbeitstagen. Ohne den Zeitabstand würde *Pointing* am Freitag, 4. Juni beginnen.

- Standardmäßig zählt der Zeitabstand im Kalender des Vorgängers, dem six-day week. Ab Freitag, 4. Juni ist Samstag, 5. Juni der erste Arbeitstag und Montag, 7. Juni der zweite. *Pointing* beginnt am **Montag, 7. Juni** und endet am Mittwoch, 9. Juni.
- Stellen Sie *Abstandskalender* auf *Nachfolger*, dann zählt der Projektkalender. Der Samstag zählt dann nicht: Montag, 7. Juni ist der erste Arbeitstag und Dienstag, 8. Juni der zweite. *Pointing* beginnt am **Dienstag, 8. Juni** und endet am Donnerstag, 10. Juni.

### Puffer im eigenen Kalender

*Brickwork* (5 Tage, Projektkalender) und *Crane hire* (3 Tage, six-day week) beginnen beide am Montag, 24. Mai. Beide sind Vorgänger von *Fit window frames* (2 Tage, Projektkalender).

*Brickwork* endet am Freitag, 28. Mai, daher beginnt *Fit window frames* am Montag, 31. Mai. *Crane hire* ist am Mittwoch, 26. Mai schon abgeschlossen. Der Gesamtpuffer von *Crane hire* zählt in seinem eigenen Kalender: Donnerstag, 27., Freitag, 28. und Samstag, 29. Mai, also **3 Arbeitstage**. Läge *Crane hire* im Projektkalender, wären es 2 Arbeitstage gewesen. Der freie Puffer ist 2 Arbeitstage (Donnerstag und Freitag), weil die App ihn im Kalender des Nachfolgers zählt.

### Der Kalender einer Ressource

In einem anderen Beispielprojekt hat die Ressource *Bricklaying crew* den Kalender *Crew Mon–Thu* (Montag bis Donnerstag). Die Ressource ist *Brickwork* mit 1 Einheit pro Tag zugewiesen (5 Tage, Projektkalender, von Montag, 31. Mai bis Freitag, 4. Juni).

Die Daten von *Brickwork* ändern sich nicht. Aber Freitag, 4. Juni ist im Histogramm rot, mit der Meldung *Arbeitet an diesem Tag laut Kalender „Crew Mon–Thu“ nicht*, und das Menüband meldet eine Ressource unter *Überlastung*. Der Kapazitätsabgleich löst das nicht. Verschieben hilft nicht, weil fünf Arbeitstage hintereinander immer einen Freitag enthalten. Im Fenster *Kapazitätsabgleich* steht der Vorgang deshalb unter *Verbleibende Konflikte*, mit dem Grund *Die Ressource arbeitet nicht an allen Tagen, die dieser Vorgang benötigt — Verschieben löst dies nicht.*

## Folgen und Missverständnisse

**„Der Kalender der Ressource verschiebt meine Vorgänge.“** Nein. Ein Ressourcenkalender ändert kein Datum; er macht nur Überlastung sichtbar. Wenn der Vorgang selbst an anderen Tagen laufen soll, geben Sie dem Vorgang einen eigenen Kalender.

**„Wenn ich den Projektkalender wechsle, verschiebt sich alles.“** Nur die Vorgänge ohne eigenen Kalender wandern mit. Ein Vorgang, dem Sie selbst einen Kalender aus der Liste gegeben haben, behält ihn, auch wenn es zufällig der alte Projektkalender ist. Wenn Sie einen Kalender löschen, werden die Vorgänge und Ressourcen, die ihn nutzten, auf den Projektkalender gesetzt.

**„Die Feiertage sind doch drin, oder?“** Feiertage gibt es nur für die Jahre, für die sie erzeugt wurden. Ein Tag außerhalb dieser Jahre ist einfach ein Arbeitstag. Im Kalenderdialog sagt die App das mit *Feiertage decken 2025–2028 ab; bis 2030 neu generieren?*

**„Mehr Stunden pro Tag machen meinen Vorgang kürzer.“** Bei einem Tagesvorgang nicht: Er zählt ganze Arbeitstage, ob der Tag 6 oder 8 Stunden hat. Nur bei einem Vorgang mit Ressourcen und der Vorgangsart *Feste Arbeit* oder *Feste Einheiten* ändert sich die Dauer damit.

**Ein Kalender ohne Arbeitstage** kann die App nicht berechnen. Die Berechnung meldet *Im Kalender sind keine Arbeitstage festgelegt*.

## Siehe auch

- [Tage und Stunden](docs://uitleg-dagen-en-uren): wie die App Arbeitszeiten zählt und was passiert, wenn Tagesvorgänge und Stundenvorgänge zusammentreffen.
- [Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen): die Schritte, um einen eigenen Kalender zu machen und Vorgängen zuzuweisen.
- [Feiertage und Bauferien erzeugen](docs://howto-feestdagen-genereren): die Feiertage eines Landes und die Bauferien eintragen.
- [Einen Ressourcenkalender einrichten](docs://howto-resourcekalender-instellen): die Verfügbarkeit einer Ressource erfassen.
- [Kalenderfenster](docs://ref-kalenders): alle Felder der Kalenderfenster.
