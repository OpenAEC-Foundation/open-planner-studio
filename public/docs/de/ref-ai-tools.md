# KI-Werkzeuge (planner_*)

Alle Werkzeuge, die ein KI-Assistent über die Brücke aufrufen kann, nach Gruppe, mit dem, was sie tun und was sie ablehnen. Jedes Werkzeug beginnt mit `planner_`. Im Fenster *Verbindungsdaten* steht die aktuelle Nummer. Der Assistent bekommt die vollständige Liste mit Beschreibungen direkt von der Brücke (`tools/list`). Warum die Verbindung so funktioniert, steht in [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling). Wie Sie sie einschalten, steht in [Einen KI-Assistenten verbinden (MCP)](docs://howto-ai-assistent-koppelen).

## So lesen Sie diese Liste

**Lesen** bedeutet: Das Werkzeug ändert nichts. Das funktioniert auch im Modus *Pausieren* und im Modus *Schreibgeschützt*. Ein offener Dialog blockiert es (siehe *Wenn ein Werkzeug abgelehnt wird* unten). Ein Lesewerkzeug liefert immer aktuelle Termine. Ist der Terminplan veraltet, wird er zuerst neu berechnet, auch im Modus *Pausieren* und im Modus *Schreibgeschützt*. Diese Modi halten Änderungen zurück, nicht die Neuberechnung beim Lesen. Wenn Sie gerade bearbeiten (einen Balken ziehen, in ein Feld tippen), wird nicht neu berechnet. Der Assistent bekommt dann die Termine von vor Ihrer Bearbeitung, mit einem Hinweis, dass sie veraltet sind. Ist das Projekt in der Ansicht *Termine wie erfasst*, wird nicht neu berechnet. Der Assistent bekommt dann die erfassten Termine, mit einem Hinweis, dass sie nicht neu berechnet wurden.

**Ändern** bedeutet: Das Werkzeug ändert Ihr Projekt. Es wird im Modus *Pausieren*, im Modus *Schreibgeschützt* und wenn ein Dialog offen ist abgelehnt. Das gilt auch für die Werkzeuge ohne Kennzeichnung unten (`planner_undo`, `planner_redo`, die Dateiwerkzeuge und die Dokumentwerkzeuge, außer `planner_list_documents`). Jede Änderung ist ein Schritt in Ihrem Rückgängig-Verlauf. Ändern sich Projektdaten, wird der Terminplan danach automatisch neu berechnet. Sie müssen nicht auf *Berechnen* drücken. Vor der ersten Änderung pro Dokument schreibt die App ein Backup, wenn *Automatisches Backup* aktiv ist.

**Sammelaufruf** bedeutet: Ein Aufruf kann mehrere Elemente enthalten. Ein ungültiges Element wird dann mit einem Grund abgelehnt, die gültigen Elemente bleiben. Die Antwort nennt die abgelehnten Elemente.

## Lesen: Terminplan

- `planner_get_project_info` (lesen) — Projektdetails und Kennzahlen: die Anzahl der Vorgänge, Beziehungen, Ressourcen und Meilensteine, das Statusdatum, das Projektende und die Dauer, ob der Terminplan veraltet ist, das Berechnungsprofil und eine Übersicht der Kalender. Ein guter erster Aufruf.
- `planner_get_project_overview` (lesen) — der gesamte PSP-Baum in einer Antwort: je Vorgang die ID, die PSP-Nummer, der Name, die Dauer, die frühen Termine, der Fortschritt, kritisch, und die ausgehenden Beziehungen mit ihrer Beziehungs-ID.
- `planner_list_tasks` (lesen) — Vorgänge mit Filtern (kritisch, Status, Datumsbereich, Vorgänge ohne Beziehungen) und Seitenaufteilung.
- `planner_get_task` (lesen) — ein Vorgang im Detail: Termine, Puffer, Fortschritt, Einschränkungen, Stichtag, Kalender, Zuweisungen, Vorgänger und Nachfolger, Unterbrechungen.
- `planner_get_critical_path` (lesen) — die kritischen Vorgänge mit ihrem Gesamtpuffer und die Beziehungen, die den Pfad bestimmen.
- `planner_list_resources` (lesen) — Ressourcen mit Kapazität, Tarif, Kalender, Kolonne, Verfügbarkeit und einer Übersicht ihrer Zuweisungen. Stammt eine Ressource aus der Ressourcenbibliothek, zeigt es, welche Felder festgelegt sind.
- `planner_get_resource_histogram` (lesen) — Auslastung gegenüber Kapazität je Ressource, je Tag, Woche oder Monat (standardmäßig Woche). Ohne Zeitfenster und ohne Ressourcen gibt es eine Zusammenfassung je Ressource. Mit einem Zeitfenster oder mit Ressourcen gibt es die vollständige Reihe und die Vorgänge, durch die Ressourcen überlastet werden.
- `planner_get_calendars` (lesen) — alle Kalender mit ihrer vollständigen Definition und der Anzahl Vorgänge und Ressourcen, die sie verwenden.

## Lesen: Baselines und Abweichung

- `planner_list_baselines` (lesen) — die gespeicherten Baselines und welche aktiv ist.
- `planner_compare_baseline` (lesen) — der aktuelle Plan gegenüber der aktiven Baseline: nur die Vorgänge, die abweichen, und der Unterschied im Projektende, in Arbeitstagen des aktuellen Projektkalenders. Ohne aktive Baseline wird der Aufruf abgelehnt.
- `planner_analyze_delay` (lesen) — Verzögerungsanalyse gegenüber der aktiven Baseline: der Unterschied bei der Lieferung und die kritischen Vorgänge, die sich verschoben haben. Ohne aktive Baseline wird der Aufruf abgelehnt.

## Vorgänge und Struktur

- `planner_add_tasks` (ändern, Sammelaufruf) — legt Vorgänge an, einschließlich einer verschachtelten PSP in einem Aufruf. Jeder Vorgang bekommt einen eigenen temporären Namen (`tmp-…`), damit ein untergeordneter Vorgang auf seinen übergeordneten Vorgang verweisen kann. Ohne Dauer bekommt ein Vorgang 5 Arbeitstage. Ein Meilenstein hat die Dauer 0. Alle Vorgänge eines Aufrufs gelingen gemeinsam oder scheitern gemeinsam.
- `planner_update_tasks` (ändern, Sammelaufruf) — ändert Felder bestehender Vorgänge: Name, Beschreibung, Dauer mit Einheit (Tage oder Stunden), Dauertyp, Arbeitskategorie, Meilenstein, verbindlich, Priorität, Einschränkung, Stichtag, Kalender und Vorgangsart. Außerdem der Fortschrittspfad: Fertigstellungsgrad, Ist-Anfang und Ist-Ende. Jeder andere Schlüssel wird mit einem Grund abgelehnt.
- `planner_delete_tasks` (ändern) — löscht Vorgänge einschließlich ihres gesamten Teilbaums, ihrer Beziehungen und Zuweisungen. Die Antwort nennt genau, was mitgelöscht wurde.
- `planner_move_task` (ändern) — verschiebt einen Vorgang unter einen anderen übergeordneten Vorgang, mit einer Position. Ein Zyklus oder ein Vorgang unter sich selbst wird abgelehnt.
- `planner_set_task_splits` (ändern) — legt die Unterbrechungen eines Vorgangs fest: nach wie vielen Arbeitstagen (oder Arbeitsstunden) Arbeit und wie lange die Unterbrechung dauert (in Arbeitstagen oder Arbeitsstunden). Eine leere Liste hebt alle Unterbrechungen auf. Siehe [Einen Vorgang aufteilen](docs://howto-taak-splitsen).

## Beziehungen

- `planner_add_dependencies` (ändern, Sammelaufruf) — legt Beziehungen an mit einem Typ (`FS`, `SS`, `FF`, `SF` oder die Langform) und einem Zeitabstand, zum Beispiel `+2d`.
- `planner_update_dependencies` (ändern, Sammelaufruf) — ändert den Typ, den Zeitabstand, den Vorgänger oder den Nachfolger einer bestehenden Beziehung, über die Beziehungs-ID. Das ist ein Schritt, statt zu löschen und neu anzulegen.
- `planner_remove_dependencies` (ändern, Sammelaufruf) — löscht Beziehungen über die Beziehungs-ID.

## Projekt und Kalender

- `planner_update_project` (ändern) — Name, Beschreibung, Autor, Firma, Startdatum, Enddatum, Statusdatum, Fortschrittsmodus und den Standard des Projekts für die Vorgangsart. Das Startdatum ist der Anker für neue Vorgänge. Setzt der Assistent es später, verschieben sich nur freie Vorgänge (ohne Vorgänger und ohne Einschränkung, die eine untere Grenze setzt, wie *Anfang nicht früher als (SNET)*). Die Antwort meldet die Anzahl als `anchorsClamped`. Der Rest des Terminplans bleibt stehen, siehe [Neues Projekt und Projektinfo](docs://ref-projectinfo). Das Statusdatum ist kein bloßes Etikett, sondern der Bezugspunkt der Berechnung. Bei einem Terminplan ohne Fortschritt verschiebt sich alles mit. Das Enddatum ist nur Metadaten.
- `planner_move_project` (ändern) — verschiebt den gesamten bestehenden Terminplan auf ein neues Startdatum. Die Kalender verschieben sich nicht mit, daher kann das Ende um eine andere Anzahl Tage springen als der Start. Baselines bleiben unverändert, außer der Assistent lässt sie ausdrücklich mitwandern. Siehe [Ein Projekt verschieben](docs://howto-project-verplaatsen).
- `planner_update_calendar` (ändern, Sammelaufruf) — ändert oder erstellt Kalender: Arbeitstage, Arbeitszeiten, Pause, Bänder, Feiertage (für ein Land und eine Region erzeugen oder einzeln angeben) und Arbeitsausnahmen. Es kann nicht ändern, welcher Kalender der Projektkalender ist.

## Ressourcen und Einheiten

- `planner_manage_resources` (ändern, Sammelaufruf) — erstellt, ändert oder löscht Ressourcen: Name, Typ (Personal, Gerät, Material, Subunternehmer oder Kolonne), Beschreibung, Max. Einheiten, Kosten pro Stunde, Einheit, Kalender, Kolonne und Verfügbarkeit im Zeitverlauf. Das Löschen einer Ressource mit Zuweisungen wird abgelehnt, bis der Assistent ausdrücklich bestätigt. Bei einer Ressource aus der Ressourcenbibliothek sind Name, Typ, Beschreibung, Tarif und Einheit festgelegt.
- `planner_manage_assignments` (ändern, Sammelaufruf) — fügt Zuweisungen hinzu, ändert, verschiebt oder entfernt sie: Einheiten je Arbeitstag, Kurve und Restarbeit. Nur auf einem Vorgang ohne Unterpunkte, und dieselbe Ressource nur einmal je Vorgang. Was eine Änderung der Einheiten mit der Dauer macht, hängt von der Vorgangsart des Vorgangs ab, wie in [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels).
- `planner_level_resources` (ändern) — gleicht überlastete Ressourcen aus (Kapazitätsabgleich). Standardmäßig innerhalb des Puffers, sodass das Enddatum bleibt. Mit `constrainToFloat: false` darf sich das Enddatum verschieben. Mit einem Probelauf erhält der Assistent zuerst eine Vorschau, ohne dass etwas geändert wird. Material wird übersprungen. Siehe [Kapazitätsabgleich von Ressourcen](docs://uitleg-nivelleren).
- `planner_clear_leveling` (ändern) — entfernt alle Abgleichsverzögerungen.

## Baselines verwalten

- `planner_save_baseline` (ändern) — speichert den aktuellen Terminplan als Baseline und macht sie sofort aktiv. Veraltete Termine werden vorher neu berechnet. Kann nicht in einem Skript verwendet werden.
- `planner_activate_baseline` (ändern) — macht eine Baseline aktiv oder gar keine.
- `planner_rename_baseline` (ändern) — benennt eine Baseline um.
- `planner_delete_baseline` (ändern) — löscht eine Baseline. War es die aktive, wird die letzte verbleibende Baseline aktiv, oder keine, wenn nichts übrig bleibt.

## Rückgängig machen

- `planner_undo` und `planner_redo` — macht einen Schritt im aktiven Dokument rückgängig oder stellt ihn wieder her. Der Verlauf ist derselbe wie Ihrer. Die Antwort sagt, ob wirklich etwas zurückgesetzt wurde.

## Dokumente und Dateien

- `planner_list_documents` (lesen) — alle geöffneten Dokumente mit Titel, ob sie aktiv und geändert sind, die Anzahl Vorgänge, der Projektstart und das berechnete Ende.
- `planner_new_document` — ein neues, leeres Dokument in einem eigenen Tab, ohne das Fenster *Neues Projekt*.
- `planner_duplicate_document` — kopiert das aktive Dokument in einen neuen Tab, zum Beispiel für eine Was-wäre-wenn-Variante oder eine Angebotsvariante. Die Kopie ist losgelöst und hat keinen Dateipfad.
- `planner_switch_document` — macht ein anderes Dokument aktiv. Außerdem bestätigen Sie damit nach einem Tabwechsel, an welchem Dokument der Assistent arbeitet.
- `planner_import_schedule` — öffnet eine Terminplan-Datei von der Festplatte als Dokument: `.ifc`, `.xml` (Primavera P6 oder MS Project, am Inhalt erkannt), `.csv`, `.xer` und `.mpp` (MS Project 2010 bis 2021). Nichts wird mit dem aktuellen Terminplan zusammengeführt. Eine CSV hat keinen Kalender, daher können sich Termine verschieben. Nur innerhalb Ihres Benutzerordners. Nach einem Import aus CSV, XML oder `.mpp` hat das Dokument kein Speicherziel. Nur bei einer IFC-Datei übernimmt das Dokument den Dateipfad.
- `planner_export_ifc` — schreibt das aktive Dokument als IFC-Datei im IFC-Schema des Projekts (Standard: IFC 4.3 ADD2). Nur innerhalb Ihres Benutzerordners, und eine vorhandene Datei wird nur auf ausdrückliche Bitte überschrieben. Wurde das Dokument in einem Schema geöffnet, das die App nicht schreiben kann (etwa IFC2X3), dann verweigert das Werkzeug selbst das Überschreiben dieser Datei. Das Projekt bleibt ungespeichert.

## Leitfaden und Herkunft der Quelle

- `planner_get_planning_guide` (lesen) — der englische Leitfaden für Assistenten (die Grundsätze von [Gut planen](docs://gids-goed-plannen), mit den Werkzeugen zu jedem Grundsatz), die beiden Skills *goed-plannen* (einen Terminplan aufsetzen) und *progress-update* (Fortschritt aktualisieren), oder alles. Wählen Sie mit `part`: `guide`, `skill` (beide Skills) oder `both`. Standardmäßig `both`. Zu jedem Skill gibt es die Orte, wo er hingehört, und die Download-Adressen. Der Parameter `language` wird für ältere Assistenten noch angenommen, der Text ist aber immer Englisch. Verändert den Terminplan nicht.
- `planner_inspect_xer_provenance` (lesen) — prüft die bewahrte Quellsemantik einer geöffneten Primavera P6-Datei (`.xer`): was die Datei enthielt, mit Zählungen des Imports und der Diagnosen. Freitextfelder aus der Datei bleiben standardmäßig unsichtbar; der Assistent muss sie ausdrücklich anfordern. Ressourcennamen bleiben standardmäßig ebenfalls verborgen, weil eine P6-Ressource meist eine Person ist; die Ressourcencodes bleiben sichtbar. Der Assistent muss Sie um Erlaubnis bitten, bevor er die Namen anfordert, weil sie dann an den KI-Anbieter gehen. Kann nicht in einem Skript verwendet werden.

## Das Skript

- `planner_batch` — führt ein Skript mit höchstens 100 Schritten als eine Änderung aus: ein Schritt zum Rückgängigmachen, ein Backup, und danach wird der Terminplan einmal neu berechnet. Scheitert ein Schritt strukturell, wird das ganze Skript zurückgesetzt. Die Antwort sagt für jeden Schritt, was ausgeführt wurde, fehlschlug oder nicht erreicht wurde. Temporäre Namen (`tmp-…`) aus `planner_add_tasks` gelten in späteren Schritten. Nicht als Schritt erlaubt sind: `planner_batch` selbst, Rückgängig und Wiederholen, die Dokument- und Dateiwerkzeuge, `planner_save_baseline`, `planner_get_planning_guide` und `planner_inspect_xer_provenance`. Ein Skript ist keine Programmiersprache: Es gibt keine Variablen, Bedingungen oder Schleifen.

## Wenn ein Werkzeug abgelehnt wird

Der Assistent bekommt dann eine Antwort mit einem Fehlercode und einer Erklärung.

- `PAUSED` — *Pausieren* ist aktiv.
- `READ_ONLY` — *Schreibgeschützt* ist aktiv.
- `DIALOG_OPEN` — ein Dialog ist offen. Das gilt auch für das Lesen, außer für `planner_get_planning_guide`. Die Antwort nennt, was offen ist, mit dem internen Namen, zum Beispiel `showTaskDialog`.
- `DOC_DRIFT` — Sie haben den Tab gewechselt, während der Assistent arbeitete. Er muss mit `planner_switch_document` bestätigen, mit welchem Dokument er arbeitet.
- `VALIDATION` — die Argumente passen nicht zum Schema, oder die gewünschte Änderung ist nicht erlaubt. Die Antwort nennt das Feld.
- `NOT_FOUND` — eine ID oder ein Dokument existiert nicht.
- `CYCLE` — die Änderung würde einen Zyklus erzeugen. Alles in diesem Aufruf wird zurückgesetzt.
- `SCOPE` — der Dateipfad liegt außerhalb Ihres Benutzerordners.
- `BACKUP_FAILED` — das Backup vor der Änderung ist fehlgeschlagen. Die Änderung wurde nicht ausgeführt.
- `INTERNAL` — ein unerwarteter Fehler beim Ausführen eines Werkzeugs, zum Beispiel eine fehlgeschlagene Dateioperation. Die Antwort gibt die ursprüngliche Fehlermeldung.
- `STALE_PRECONDITION` — ist Teil des Vertrags der Brücke, aber keines der aktuellen Werkzeuge gibt diesen Code zurück.

Eine Anfrage, die mehr als 110 Sekunden in der Warteschlange wartete, führt die App nicht mehr aus. Der Client hat dann schon eine Zeitüberschreitung erhalten, und bei einem erneuten Versuch würde die Ausführung Änderungen doppelt machen. Ein Aufruf, der länger als 120 Sekunden dauert, bekommt eine Zeitüberschreitung von der Brücke.

## Was der Assistent nicht festlegen kann

Pro Vorgang kann der Assistent nicht festlegen: Hammock, manuell geplant, eine zweite Einschränkung, Notizen, Farbe, Aktivitätscodes, benutzerdefinierte Felder, externe Beziehungen und eine Abgleichsverzögerung von Hand. Die App berechnet den PSP-Code selbst. Auf Projektebene kann er das Berechnungsprofil und die Berechnungsoptionen nicht ändern. Einstellungen, Design, Sprache, Erweiterungen und Updates sind nicht erreichbar, ebenso die Ressourcenbibliothek. Er hat auch keine Berichte, Layouts, Filter oder Ansichten. Warum das so ist, steht in [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling).

## Was die App speichert

- **Das Token** liegt auf diesem Computer, in den gespeicherten Einstellungen der App. Es ist 64 Zeichen lang und zufällig. *Neuer Token* ersetzt es.
- **Der Port** ist standardmäßig 3877 und kann nur geändert werden, während die Brücke gestoppt ist.
- **Der Aktivitätsbereich** behält die letzten 500 Aufrufe, nur solange die App geöffnet ist. Argumente und Antworten werden je Feld nach 20 kB abgeschnitten. *Leeren* leert die Liste.
- **Die Backups** liegen im Ordner `ai-backups` im Datenordner der App. *Backup-Ordner öffnen* bringt Sie dorthin. Die Dateien heißen `<project name>-<timestamp>.ifc`. Eine gespeicherte Projektdatei hat über alle Sitzungen einen Ordner. Ein Dokument, das Sie nie gespeichert haben, bekommt pro Sitzung einen eigenen Ordner. Beim Start der Brücke wird je Dokument ein Backup erstellt, dazu kommen die Backups, die Sie selbst mit *Jetzt sichern* machen.
- **Das Ausdünnen** geschieht von selbst, je Ordner. Von den letzten 7 Tagen bleiben alle erhalten, höchstens 20. Was die laufende Sitzung erstellt hat, bleibt immer erhalten. Danach bleibt je Woche ein Backup bis 30 Tage alt, je Monat eines bis zu einem Jahr alt, und danach je Jahr eines. Die Backups eines nie gespeicherten Dokuments verschwinden nach einem Jahr ganz. Dateien im Ordner, die nicht zur App gehören, bleiben unberührt.

## Siehe auch

- [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling): warum die Brücke so eingerichtet ist und was der Assistent darf und nicht darf.
- [Einen KI-Assistenten verbinden (MCP)](docs://howto-ai-assistent-koppelen): die Brücke starten, verbinden und den Skill installieren.
- [Einstellungen](docs://ref-instellingen): die beiden KI-Schalter.
- [Meldungen und Warnungen](docs://ref-meldingen): der KI-Punkt in der Statusleiste.
