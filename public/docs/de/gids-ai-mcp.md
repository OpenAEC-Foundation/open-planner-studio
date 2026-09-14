# Einen KI-Assistenten verbinden (MCP)

Open Planner Studio kann sich für einen KI-Assistenten öffnen. Schalten Sie den KI-Modus ein, wird die App selbst zu einem **MCP-Server**: Ein Assistent wie Claude verbindet sich mit dem Fenster, das Sie gerade geöffnet haben, liest Ihren Terminplan und kann ihn bearbeiten. Sie sehen live zu — jede Aufgabe, die hinzukommt, erscheint sofort im Gantt-Diagramm — und alles, was der Assistent tut, machen Sie mit einem einzigen Strg+Z rückgängig.

Das ist ein grundlegend anderes Modell als eine Datei zu exportieren, sie irgendwo zu bearbeiten und wieder zu importieren. Es gibt keine Kopie, kein Zwischenformat und keinen Moment, in dem Sie und der Assistent auf unterschiedliche Dinge schauen. Diese Anleitung zeigt, wie Sie es einschalten, wie Sie einen Assistenten verbinden, was er darf und was nicht, und was Sie tun, wenn die Verbindung nicht zustande kommt.

## Was Sie hier lernen

- Den KI-Modus einschalten und das KI-Tab finden.
- Die Bridge starten, und sie automatisch mit der App mitstarten lassen.
- Einen Assistenten verbinden — mit einem fertigen Prompt oder einem Konfigurationsausschnitt.
- Was ein Assistent mit Ihrem Terminplan tun kann.
- Die Sicherheitsfunktionen: Pausieren, Schreibgeschützt, automatisches Backup und das Aktivitätsprotokoll.
- Was Sie tun, wenn die Verbindung nicht klappt.

Die Bridge funktioniert **nur in der Desktop-App**. Das KI-Tab ist auch im Browser-Build sichtbar, aber der Server selbst läuft in der Desktop-Schicht und kann dort nicht starten.

## Einschalten

Der KI-Modus ist standardmäßig aus. Sie schalten ihn ein unter **Einstellungen → Anwendung → KI-Modus aktivieren** — über das Zahnradsymbol, die Menüband-Registerkarte Einstellungen oder Datei → Einstellungen; alle drei zeigen denselben Schalter.

Sobald er an ist, erscheint eine zusätzliche Registerkarte **KI** im Menüband. Schalten Sie den KI-Modus wieder aus, verschwindet die Registerkarte und eine laufende Bridge wird sofort gestoppt — es bleibt also nie ein Server aktiv, ohne dass die Registerkarte dazu da ist.

Darunter steht **Bridge automatisch starten**. Mit diesem Schalter an geht der Server sofort live, sobald Sie die App öffnen, sodass ein Assistent sich verbinden kann, ohne dass Sie zuerst das KI-Tab besuchen. Er steht standardmäßig aus: einen lauschenden Port auf Ihrem eigenen Rechner zu öffnen sollte eine bewusste Entscheidung sein.

## Das KI-Tab

Die Registerkarte besteht aus vier Gruppen.

**Server** — die Schaltfläche **Bridge starten** (oder **Bridge stoppen**) mit dem Status daneben: *Aus*, *Aktiv auf Port 3877*, *Port … belegt* oder *Fehler*. Derselbe Status erscheint als farbiger Punkt unten rechts in der Statusleiste, sodass Sie auch von jeder anderen Registerkarte aus sehen, ob die Bridge lebt.

**Verbindung** — die Portnummer (nur änderbar, solange der Server gestoppt ist; ein laufender Server behält seinen Port), das Token und die Schaltfläche **Verbinden**. Das Token ist standardmäßig verborgen; die Augen-Schaltfläche zeigt es an, die Kopieren-Schaltfläche übernimmt es, und **Neuer Token** erzeugt ein frisches. Beachten Sie: Das Letztere trennt *jede* bestehende Verbindung, da diese alle das alte Token tragen — deshalb fragt die App vorher um Bestätigung.

**Sicherheit** — **Pausieren**, **Schreibgeschützt**, der Schalter **Auto-Backup**, sowie die Schaltflächen **Jetzt sichern** und **Backup-Ordner öffnen**. Was sie genau tun, steht weiter unten bei *Die Sicherheitsfunktionen*.

**Aktivität** — die Schaltfläche **Aktivitätsbereich** öffnet eine Liste mit jedem Aufruf, den der Assistent macht: Zeitstempel, Name des Werkzeugs, wie lange er dauerte, und ob er erfolgreich war. Jede Zeile klappen Sie auf für die Argumente und die Antwort. Das ist Ihr Protokoll: Sie müssen dem Assistenten nicht auf sein Wort glauben, was er getan hat.

## Einen Assistenten verbinden

Klicken Sie auf **Verbinden**. Das sich öffnende Fenster enthält vier Blöcke, die Sie einzeln kopieren können:

1. **Endpunkt** — die Adresse, auf der die Bridge lauscht, standardmäßig `http://localhost:3877/mcp`. Der Transport ist Streamable HTTP.
2. **Authentifizierung** — der HTTP-Header, der bei jeder Anfrage mitgeschickt werden muss, in der Form `Authorization: Bearer …`.
3. **Konfigurationsausschnitt** — ein fertiger JSON-Block, den Sie in die MCP-Konfiguration Ihres Clients einfügen.
4. **Verbindungs-Prompt** — ein Textstück, das Sie direkt in Ihren Assistenten einfügen; er verbindet sich selbst und prüft anschließend seine eigene Werkzeugliste.

Der Letztere ist der kürzeste Weg und funktioniert bei jedem Assistenten, der MCP-Server hinzufügen kann. Der Prompt ist bewusst anbieterneutral gehalten: Er nennt nur die Adresse, das Token und was der Assistent danach prüfen soll, sodass er bei dem einen Anbieter genauso funktioniert wie bei einem anderen.

Die Verbindung ist abgeschlossen, sobald der Assistent seine Werkzeugliste abrufen kann. Er sollte dort knapp vierzig Werkzeuge sehen, die alle mit `planner_` beginnen. Sieht er keine, dann läuft die Bridge nicht oder das Token stimmt nicht.

Das Token gewährt Zugriff auf den Plan, den Sie gerade geöffnet haben. Behandeln Sie es wie ein Passwort: nicht in einem geteilten Dokument, nicht in einem Chat mit anderen.

## Was ein Assistent darf

Die Werkzeuge decken ungefähr alles ab, was Sie selbst in der App tun:

- **Lesen** — Projektübersicht, Aufgabenliste, eine einzelne Aufgabe im Detail, den kritischen Pfad, Ressourcen und ihr Histogramm, Kalender, Baselines und den Vergleich mit einer Baseline.
- **Planen** — Aufgaben anlegen (eine ganze WBS mit Phasen und Unteraufgaben in einem Rutsch), bearbeiten, verschieben und löschen; Beziehungen anlegen, ändern und entfernen; Fortschritt erfassen.
- **Einrichten** — Ressourcen anlegen und zuweisen, Kalender und arbeitsfreie Tage verwalten, Baselines speichern und aktivieren, abgleichen.
- **Verwalten** — Dokumente anlegen, duplizieren und wechseln, Terminplandateien importieren, und nach IFC exportieren.

Zwei Dinge sind dabei wichtiger als die Liste selbst.

**Ein Assistent kann in einem einzigen Skript arbeiten.** Statt Werkzeug für Werkzeug aufzurufen, kann er eine Abfolge von Schritten als ein Ganzes einreichen. Das ist nicht nur schneller: Das gesamte Skript wird zu einem einzigen Schritt in Ihrer Historie. Baut er in einem Rutsch einen Terminplan mit vierzig Aufgaben samt allen Beziehungen auf, entfernen Sie das mit einem einzigen Strg+Z wieder. Geht auf halbem Weg etwas Strukturelles schief, wird das gesamte Skript zurückgerollt, statt dass Sie mit einem halb fertigen Terminplan dastehen.

**Nach jeder Änderung wird der Terminplan neu berechnet.** Der Assistent muss das nicht separat anfordern und kann daher nicht versehentlich auf veralteten Daten weiterarbeiten.

## Was ein Assistent nicht darf

Die Bridge ist bewusst enger gefasst als die App. Ein paar Dinge kann ein Assistent nicht, auch wenn Sie danach fragen — er erhält dann eine Ablehnung, die den richtigen Weg erklärt. Das ist keine Kindersicherung: Es geht jeweils um etwas, das über das Projekt hinausreicht, das Sie gerade vor sich haben.

**Die Ressourcenbibliothek selbst.** Ein Assistent kann keine Bibliotheksressource oder -kalender anlegen, ändern oder löschen. Eine Bibliothek ist app-weite Daten, die von all Ihren Projekten geteilt werden, und Bearbeitungen daran fallen außerhalb der gewöhnlichen Rückgängig-Historie. Eine einzelne Tarifänderung würde sich also auf Projekte auswirken, die nicht einmal geöffnet sind, ohne dass Sie es zurücknehmen könnten. Das erledigen Sie selbst, unter Datei → Bibliothek.

**Die festgelegten Felder einer geerbten Ressource.** Stammt eine Ressource aus einer Bibliothek, bestimmt diese Bibliothek, *was* diese Ressource ist: Name, Typ, Beschreibung, Tarif/Stunde und Einheit. Diese Felder stehen im Tab Ressourcen nicht ohne Grund als reiner Text da — Sie können sie dort selbst auch nicht bearbeiten — und der Assistent kommt genauso wenig heran wie Sie. Was das *Projekt* bestimmt, bleibt ihm hingegen zugänglich: Max. Einheiten, die zeitlich gestaffelte Verfügbarkeit, der Kalender und die Kolonnenzugehörigkeit. Bitten Sie trotzdem um einen anderen Stundentarif, nennt die Ablehnung die beiden echten Wege: Ändern Sie ihn in der Bibliothek (das gilt dann für jedes Projekt), oder lösen Sie die Ressource zunächst von der Bibliothek — danach ist sie projekteigen und vollständig bearbeitbar, und das Lösen selbst machen Sie mit Strg+Z rückgängig.

**Welcher Kalender der Projektkalender ist.** Den Inhalt dieses Kalenders darf er bearbeiten, aber welcher Kalender das Projekt verwendet, wechseln Sie selbst in der Kalenderbibliothek. Dasselbe gilt für Terminplanungsoptionen wie die Einstellung für mehrere kritische Pfade.

**Die App selbst.** Es gibt kein Werkzeug für Einstellungen, Design, Sprache, Erweiterungen oder den Updater. Ein Assistent ändert nichts daran, wie Ihr Programm eingerichtet ist.

**Dateien — schon, aber mit Grenzen.** Importieren bedeutet, dass er eine Terminplandatei von Ihrer Festplatte lesen darf, und Exportieren, dass er eine IFC-Datei schreiben darf. Das Schreiben ist auf Ihren persönlichen Ordner beschränkt, und eine bestehende Datei wird nie überschrieben, sofern das nicht ausdrücklich verlangt wurde. Ein Export ist zudem kein „Speichern": Ihr Dokument bleibt in der App als nicht gespeichert markiert, sodass er Ihre Projektdatei nicht heimlich ersetzen kann.

Fragt er die Ressourcenliste ab, sieht ein Assistent sofort, welche Ressourcen aus einer Bibliothek stammen, zu welcher Ressourcenbibliothek sie gehören und welche Felder festgelegt sind. Er muss also nicht erst dagegenlaufen, um es herauszufinden.

## Die Sicherheitsfunktionen

**Pausieren** hält die Bridge am Leben, lehnt aber jede Änderung ab; Lesen bleibt erlaubt. Nützlich, wenn Sie selbst kurz etwas tun möchten, ohne die Verbindung zu trennen.

**Schreibgeschützt** tut dasselbe, aber als dauerhafte Haltung statt als Pause: Lassen Sie einen Assistenten Ihren Terminplan analysieren, darüber berichten oder vergleichen, ohne dass er etwas daran ändern kann.

**Auto-Backup** erstellt automatisch eine IFC-Kopie vor der ersten Änderung an einem Dokument. Das geschieht einmal pro Dokument und Sitzung, sodass Sie nicht bei jedem Aufruf einen Stapel Dateien ansammeln. **Jetzt sichern** macht es sofort — praktisch kurz bevor Sie einen Assistenten etwas Einschneidendes tun lassen. **Backup-Ordner öffnen** bringt Sie dorthin, wo sie liegen; die App bewahrt die letzten zehn pro Dokument auf.

Obendrauf kommt die gewöhnliche Rückgängig-Historie, die ein Assistent mit Ihnen teilt. Alles, was er tut, können Sie rückgängig machen — und der Assistent ebenfalls, denn Rückgängig und Wiederholen gehören zu seinem Werkzeugkasten.

## Wenn es nicht klappt

**„Port … belegt."** Auf diesem Port lauscht bereits etwas. Meist ist das ein zweites Fenster dieser App: Die Bridge kann nur eines gleichzeitig bedienen. Schließen Sie das andere Fenster, oder wählen Sie eine andere Portnummer, während der Server gestoppt ist.

**Der Assistent bekommt keine Antwort oder hängt.** Das passiert, wenn das Fenster hinter dem Server weggefallen oder neu geladen wurde. Stoppen Sie die Bridge und starten Sie sie erneut; hilft das nicht, starten Sie die App neu. Sind Sie unsicher, ob sie noch lebt, schauen Sie auf den Statuspunkt in der Statusleiste.

**Der Assistent sieht keine Werkzeuge oder meldet einen Zugriffsfehler.** Dann stimmt das Token nicht. Das passiert vor allem, nachdem Sie auf **Neuer Token** geklickt haben, obwohl bereits eine Verbindung bestand: Der Assistent trägt dann noch das alte. Kopieren Sie das neue aus dem Fenster **Verbinden** und aktualisieren Sie die Konfiguration Ihres Clients.

**Es passiert nichts, obwohl der Assistent sagt, es sei gelungen.** Prüfen Sie im Aktivitätsbereich, was er tatsächlich aufgerufen hat und was zurückkam. Steht dort eine Ablehnung, nennt sie fast immer sowohl das Feld, das falsch war, als auch die Alternative.

## So plant Ihr KI-Assistent gut

Ein Assistent, der die Tools kennt, kann trotzdem einen Terminplan bauen, mit dem kein Planer etwas anfangen kann: Vorgänge ohne Verknüpfungen, ein festes Datum auf jedem Vorgang oder eine Gliederung, die viel zu fein ist, um sie zu pflegen. Die Grundsätze, die das verhindern, stehen in der Anleitung [Gut planen](docs://gids-goed-plannen) — lassen Sie sie Ihren Assistenten lesen, bevor er anfängt, oder verweisen Sie in Ihrem Auftrag darauf. Im Quellcode von Open Planner Studio liegt außerdem ein kurzer Agenten-Skill unter `.claude/skills/goed-plannen/`, der für den Inhalt auf dieselbe Anleitung verweist und nur das Agenten-spezifische ergänzt: in welcher Reihenfolge die `planner_`-Tools einzusetzen sind und was dem Nutzer zurückgemeldet wird.

## Weiterlesen

- [Baselines & Fortschritt](docs://gids-baselines-voortgang) — was das Statusdatum mit Ihrem Terminplan macht. Gut zu wissen, bevor Sie es einen Assistenten setzen lassen: Es ist nicht nur ein Stichtag für Berichte, sondern schiebt auch noch nicht begonnene Arbeit nach vorne.
- [Im-/Export](docs://gids-import-export) — wie sich IFC, CSV, MS Project und P6 zueinander verhalten.
- [Einstellungen](docs://ref-instellingen) — alle Einstellungen auf einen Blick, einschließlich der beiden KI-Schalter.
