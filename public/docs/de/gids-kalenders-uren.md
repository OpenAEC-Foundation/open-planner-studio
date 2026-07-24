# Kalender & Stundenplanung

Eine Aufgabe mit einer Dauer von „5 Tagen" bedeutet erst in Kombination mit einem Kalender etwas: Welche Tage sind Arbeitstage, in welchen Stunden wird gearbeitet und welche Tage fallen wegen eines Feiertags oder einer vorübergehenden Schließung aus? Diese Anleitung behandelt den Projektkalender, Ressourcenkalender und die optionale Stundenplanung für alle, die bis auf die Stunde genau terminieren möchten.

## Was Sie hier lernen

- Einrichten des Projektkalenders: Arbeitstage, Arbeitszeiten, Feiertage.
- Automatisches Generieren von Feiertagen pro Jahr, einschließlich der Bauferien.
- Hinzufügen einer einmaligen, ad-hoc-Schließung (zum Beispiel einer Frostpause).
- Vergeben eines eigenen Kalenders an eine Ressource, zum Beispiel für eine 4-Tage-Woche.
- Aktivieren des Hauptschalters **Stundenplanung** und Einrichten von Arbeitszeitbändern/Schichten.
- Wie tages- und stundenbasierte Aufgaben im selben Terminplan nebeneinander existieren.

Folgen Sie mit [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (Frostpause, 4-Tage-Ressourcenkalender) und mit [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (Stundenplanung für Bewehrungs- und Betonierarbeiten), beide ebenfalls über **Datei → Beispiele** verfügbar.

## Der Projektkalender

Kalender werden im Fenster **Kalender** verwaltet, geöffnet über die Menübandgruppe **Kalender** auf der Registerkarte **Planung** (die Schaltflächen **Kalender** und **Feiertage** öffnen dasselbe Fenster). Dieses Fenster zeigt links eine Bibliothek aller Kalender im Projekt — nicht nur den Projektkalender, sondern auch eventuelle Ressourcenkalender (siehe unten) —, wobei ein Stern den Kalender markiert, der aktuell der **Projektkalender** ist. Wählen Sie links einen Kalender aus und bearbeiten Sie ihn rechts; verwenden Sie **Als Projektstandard festlegen**, um einen anderen Kalender aus der Liste zum neuen Projektkalender zu machen. Für den ausgewählten Kalender stellen Sie ein:

- **Arbeitstage** — welche der sieben Wochentage (Mo bis So) als Arbeitstag zählen. Standardmäßig Montag bis Freitag.
- **Arbeitszeiten** — **Beginn (Stunde)**, **Ende (Stunde)** und die daraus resultierenden **Stunden pro Tag**.
- **Feiertage** — eine Liste von freien Tagen, jeweils mit einer **Beschreibung** und einem **Von**-/**Bis**-Datum.

Änderungen am Projektkalender wirken sich sofort in der Berechnung aus: Aufgaben, die sonst auf einen nunmehr freien Tag fallen würden, verschieben sich auf den nächsten Arbeitstag.

### Feiertage automatisch generieren

Statt Feiertage einzeln einzutippen, können Sie sie automatisch über **Feiertage generieren…** im Kalenderfenster generieren. Wählen Sie ein **Land** (Niederlande, Deutschland, Belgien, Frankreich, Vereinigtes Königreich, Österreich, Schweiz) und optional eine **Region**. Für die Niederlande gibt es zudem eine bauspezifische Option: **Bauferien**, mit der Wahl **Nord**, **Mitte** oder **Süd** (oder **Keine**). Die generierten Bauferien-Daten sind Richtwerte — die App warnt selbst darüber: Prüfen Sie die genauen Daten für das laufende Jahr bei Bouwend Nederland. Nach der Auswahl von Land/Region zeigt das Fenster eine Vorschau — zum Beispiel „12 Feiertage, 1-1-2026–31-12-2026" —, bevor Sie auf **Generieren** klicken.

Wenn Sie Feiertage für ein Projekt generieren, das über einen Jahreswechsel reicht oder später erweitert wird, erkennt Open Planner Studio, dass die bereits generierten Feiertage den gesamten Projektzeitraum nicht mehr abdecken, und das Fenster bietet **Neu generieren**, um die fehlenden Jahre hinzuzufügen — ohne zuvor manuell hinzugefügte Feiertage zu verlieren.

### Ad-hoc-Schließungen (zum Beispiel eine Frostpause)

Nicht jede Arbeitsunterbrechung ist ein jährlich wiederkehrender Feiertag. Für einmalige, projektspezifische Schließungen — eine Woche Frostpause, eine Schließung wegen eines lokalen Ereignisses — fügen Sie einfach über **Feiertag hinzufügen** eine weitere Zeile manuell in derselben Liste hinzu: Geben Sie ihr eine **Beschreibung** (zum Beispiel „Frostpause") und einen **Von**-/**Bis**-Zeitraum. Eine solche Ad-hoc-Schließung funktioniert technisch identisch wie ein generierter Feiertag — die CPM-Berechnung berücksichtigt sie genauso —, ist aber getrennt von der automatischen Jahreserzeugung, sodass ein späteres **Neu generieren** sie nicht überschreibt.

Sehen Sie eine Frostpause-Zeitraum in der Praxis im Beispiel [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): Die gemeinsame Gründung der sechs Häuser umfasst eine Frostpause, die als separater feiertagsartiger Eintrag im Kalender hinzugefügt wurde, abseits der automatisch generierten niederländischen Feiertage.

## Ressourcenkalender

Neben dem einen Projektkalender kann jede Ressource einen eigenen Kalender erhalten — zum Beispiel für einen Subunternehmer, der nur vier Tage pro Woche verfügbar ist, während der Rest des Projekts an fünf Tagen läuft. Ressourcenkalender werden über das Feld **Kalender** bei der Ressource verwaltet (mit der Schaltfläche **Bearbeiten…** daneben) oder den Fenstertitel **Ressourcenkalender**; standardmäßig steht eine Ressource auf **Projektkalender**.

Ein Ressourcenkalender verwendet dasselbe Formular wie der Projektkalender (**Arbeitstage**, **Arbeitszeiten**, **Feiertage**), ist aber für die Ressource rein informativ: Er ändert nichts an den eigenen CPM-Terminen der Aufgabe. Beeinflusst wird die **Auslastung** (Histogramm) und der **Abgleich**: Wenn eine Ressource auf eine 4-Tage-Woche eingestellt ist, die Aufgabe, der sie zugewiesen ist, aber an 5 Arbeitstagen läuft, zeigt die Ressourcenauslastung am fünften Tag ein Defizit, und das Abgleichsfenster (**Ressourcen abgleichen**) warnt, dass die Ressource nicht an allen Tagen arbeitet, die die Aufgabe benötigt — ein Verschieben innerhalb des Puffers löst diese Kalender-Abweichung nicht automatisch.

Sehen Sie einen 4-Tage-Ressourcenkalender in der Praxis: Die Installateure in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) laufen auf ihrem eigenen Kalender mit verkürzter Arbeitswoche, während der Rest des Projekts auf dem normalen Projektkalender weiterläuft.

## Stundenplanung: der Hauptschalter

Standardmäßig arbeitet Open Planner Studio vollständig in **Tagesgenauigkeit** — jede Aufgabe hat eine Dauer in ganzen (Arbeits-)Tagen. Für Aufgaben, die Sie lieber nach Stunden planen (denken Sie an einen Betonier, der um 7:00 Uhr beginnt und um 14:00 Uhr, lange bevor das Wetter umschlägt, fertig sein muss), gibt es die optionale **Stundenplanung**.

Aktivieren Sie den Hauptschalter über **Einstellungen → Zeitachse / Zoom → Stundenplanung aktivieren**. Das fügt eine Stunden-Zeitskala, Schichten mit Arbeitszeitbändern und stundengenaue Vorgangsbalken hinzu; bei ausgeschaltetem Schalter arbeitet die App vollständig wie bisher, in Tagesgenauigkeit. Es gibt außerdem die Option **Gemischte Tages-/Stundenplanung zulassen**, die Sie aktivieren, wenn Sie sowohl tages- als auch stundenbasierte Aufgaben im selben Projekt kombinieren möchten (siehe unten).

## Arbeitszeitbänder und Schichten

Mit aktivierter Stundenplanung erhält der Kalender eine zusätzliche Ebene: Statt nur „Arbeitstag ja/nein" stellen Sie **Arbeitszeitbänder** pro Tag ein (der Abschnitt **Arbeitszeiten** im Kalenderfenster) — die genauen Zeitfenster, in denen gearbeitet wird. Eine Lücke zwischen zwei Bändern wird automatisch zur Pause; um eine Pause zu terminieren, passen Sie einfach die Zeiten der angrenzenden Bänder so an, dass eine Lücke entsteht.

Damit Sie Bänder nicht jedes Mal von Hand zeichnen müssen, gibt es vorgefertigte **Schicht-Voreinstellungen**:

- **Tagschicht** — reguläre Bürozeiten, ein Band pro Tag.
- **2 Schichten** — zwei aufeinanderfolgende Schichten.
- **3 Schichten** — drei aufeinanderfolgende Schichten, die fast den ganzen Tag abdecken.
- **Nachtschicht** — eine Schicht, die über Mitternacht hinausgeht.
- **24/7** — durchgehender Betrieb, keine Unterbrechung.

Neben diesen Voreinstellungen können Sie die Bänder auch **Pro Wochentag festlegen…** komplett von Hand einstellen, zum Beispiel wenn der Freitag kürzer ist als die restliche Woche. Haben Sie eine eigene Kombination zusammengestellt, die Sie öfter wiederverwenden möchten? Speichern Sie sie mit **Als Voreinstellung speichern…** — die Voreinstellung wird lokal auf diesem Gerät gespeichert und kann dann in jedem Projekt wieder ausgewählt werden. Der Abschnitt zeigt außerdem die **Abgeleitete Stunden/Tag**: die Anzahl effektiver Arbeitsstunden, die sich aus den konfigurierten Bändern ergibt.

## Stundenbasierte Aufgaben

Mit aktivierter Stundenplanung und einer Aufgabe auf einem **Stundenkalender** (einem Kalender mit Arbeitszeitbändern statt nur ganzen Tagen) zeigt das Aufgaben-Bearbeitungsfenster zusätzliche Felder: **Dauer (Stunden)** neben **Dauer (Tage)** sowie eine Gesamt in **Stunden gesamt**. Ein Stundenkalender ist für die Stundeneingabe erforderlich — versuchen Sie, Stunden bei einem regulären Tageskalender einzugeben, weist der Hinweis darauf hin.

Genau so werden Betonieraufgaben in der Praxis terminiert: eine Aufgabe „Vloer storten toren A" (Boden gießen Turm A) mit einer Dauer von beispielsweise 6 Stunden, verknüpft mit einem Schichtkalender, der an diesem Tag eine Morgenschicht hat. Sehen Sie dieses Muster im großen Beispiel [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), das die Stundenplanung für die Bewehrungs- und Betonierarbeiten verwendet.

## Mischung aus tages- und stundenbasierten Aufgaben

Ein Projekt muss nicht vollständig auf Stunden laufen, um von der Stundenplanung zu profitieren: Mit aktiviertem **Gemischte Tages-/Stundenplanung zulassen** können tagesbasierte Aufgaben (auf dem regulären Projektkalender) und stundenbasierte Aufgaben (auf einem Stundenkalender) im selben Terminplan nebeneinander existieren und miteinander in Beziehung stehen. In diesem Fall zeigt die Aufgabentabelle die Dauer jeder Aufgabe in ihrer eigenen Einheit — eine Tagesaufgabe in Tagen, eine Stundenaufgabe in Stunden — und warnt unten in der Tabelle, wenn Aufgaben mit unterschiedlichen Stunden-pro-Tag nebeneinander laufen, damit klar bleibt, welche Vergleiche gleichartig sind und welche nicht.

## Weiterlesen

- Sehen Sie eine Frostpause und einen 4-Tage-Ressourcenkalender in der Praxis: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Sehen Sie die Stundenplanung für Bewehrungs- und Betonierarbeiten in der Praxis: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Beziehungen und Verzögerung/Vorlauf arbeiten auf denselben Kalendereinheiten — lesen Sie [Beziehungen & Einschränkungen](docs://gids-relaties-constraints) zum Unterschied zwischen Arbeitstag- und Abgelaufenen-Tage-Verzögerung.
