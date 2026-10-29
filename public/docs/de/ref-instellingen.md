# Einstellungen

Jede Einstellung der App: was sie tut, ihr Startwert, was sich ändert und wo Sie sie finden. Für die Berechnungsoptionen eines Projekts (Berechnungsprofil, Definition der kritischen Vorgänge) siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): diese gehören zur Projektdatei, nicht zur App.

## Wo Sie sie finden und wie sie funktionieren

Das Einstellungsfenster finden Sie an drei Stellen, und überall ist es dasselbe Fenster: das Zahnrad oben im Fenster, *Einstellungen › Projekt › App-Einstellungen* und *Datei › App-Einstellungen*. Das Fenster hat drei Registerkarten: *Darstellung*, *Planung* und *Erweitert*. Jede Einstellung unten nennt nur die Registerkarte.

Eine Änderung wirkt sofort. Es gibt keine Schaltfläche *Anwenden* und keine Schaltfläche *Abbrechen*.

**App-weit, nicht pro Projekt.** Alle Einstellungen in diesem Artikel gelten für alle Ihre Projekte und gehören zu diesem Gerät. Die App speichert sie im Speicher der App oder Ihres Browsers, nicht in der Projektdatei. Wenn eine andere Person Ihre Datei öffnet, sieht sie daher ihre eigenen Einstellungen. Ein Browser, dessen Speicher Sie leeren, beginnt wieder mit den Startwerten.

## Registerkarte Darstellung

**Design** — das Farbschema der Oberfläche. Wählen Sie zwischen *Dunkel*, *Hell* und *Hoher Kontrast*. Standard: *Dunkel*. Wirkung: die Farben der gesamten Oberfläche, einschließlich des Gantt-Diagramms und des Histogramms. Wo: *Darstellung*.

**Systemdesign folgen** — lässt das Farbschema Ihres Betriebssystems entscheiden. Standard: aus. Wirkung: Die App ist *Hell* oder *Dunkel*, je nach Ihrem System; die drei Design-Karten sind dann deaktiviert. *Hoher Kontrast* folgt nicht Ihrem System: Sie wählen es selbst. Wenn Sie dies ausschalten, bleibt das Design, das in diesem Moment auf dem Bildschirm war. Wo: *Darstellung*, unter *Design*.

**Sprache** — die Sprache der Oberfläche. Standard: die Sprache Ihres Browsers oder Systems, wenn die App sie kennt, sonst Englisch. Wirkung: alle Texte in der App; die Sprachen sind nach ihrem Kurzcode sortiert. Bei Arabisch und Persisch läuft die Oberfläche von rechts nach links. Die Sprache der Hilfe-Artikel stellen Sie separat ein, unter *Dokumentationssprache* in *Datei › Hilfe*. Wo: *Darstellung*.

**Schriftart** — die Schriftart der gesamten Oberfläche. Wählen Sie zwischen *Standard*, *System*, *Serifen* und *Monospace*. Standard: *Standard*. Wirkung: Überschriften und Text im Fenster sowie der Text im Gantt-Diagramm und im Histogramm. Eine Web-App übernimmt die Systemschriftart nicht von selbst; deshalb wählen Sie sie hier. Wo: *Darstellung*.

**Textgröße** — Größe der Oberfläche. Wählen Sie zwischen 90 %, 100 %, 110 % und 125 %. Standard: 100 %. Wirkung: Text und Layout des Menübands, der Bereiche und der Dialoge werden größer oder kleiner, und die Zeilenhöhe der Tabelle und des Gantt-Diagramms passt sich entsprechend an. Eine höhere Auswahl als 125 % gibt es nicht, weil die Schaltflächenbeschriftungen im Menüband dann über mehrere Zeilen umbrechen. Wo: *Darstellung*.

**Datumsformat** — wie Datumsangaben in der App erscheinen. Wählen Sie zwischen *TT-MM-JJJJ*, *MM-TT-JJJJ* und *JJJJ-MM-TT*. Standard: *TT-MM-JJJJ*. Wirkung: Datumsangaben in der Tabelle, in den Dialogen, in den Berichten und im Druck. Dateien und Berechnungen ändern sich nicht: nur die Anzeige. Wo: *Darstellung*.

**Uhrzeitformat** — wie Uhrzeiten in der App erscheinen. Wählen Sie zwischen *24 Stunden (13:00)* und *12 Stunden (1:00 PM)*. Standard: *24 Stunden (13:00)*. Wirkung: die Uhrzeiten im Kalenderfenster, das Datum und die Uhrzeit von Vorgängen in Stunden (Tabelle, geteilte Vorgänge, Meldungen) und die Zeitskala *Stunde* im Gantt-Diagramm. In einem Zeitfeld dürfen Sie eine der beiden Formen eingeben: *13:00*, *1300*, *13*, *1:00 PM* oder *1 pm*. Mitternacht als Tagesende ist *24:00* oder *12:00 AM*. Dateien und Berechnungen ändern sich nicht: Sie bleiben im 24-Stunden-Format. Wo: *Darstellung*.

**Anzeige der Dauer** — in welcher Einheit die Dauer eines Vorgangs angezeigt wird. Wählen Sie zwischen *Automatisch (eigene Einheit je Vorgang)*, *Immer Tage* und *Immer Stunden*. Standard: *Automatisch (eigene Einheit je Vorgang)*. Wirkung: in der Vorgangstabelle, den Balkenbeschriftungen des Gantt-Diagramms, dem Tooltip, dem Druck und den Berichten. Bei *Automatisch* zeigt ein Tagesvorgang Tage und ein Stundenvorgang Stunden. Bei *Immer Tage* oder *Immer Stunden* rechnet die App mit den Stunden pro Tag des Kalenders des Vorgangs um. Hat der Vorgang eine andere Einheit, setzt die App deren eigene Einheit in Klammern dahinter, zum Beispiel `2.25d(18h)`. Nur die Anzeige ändert sich; der Vorgang behält seine eigene Einheit. Wo: *Darstellung*.

**Art des Dokumentwechsels** — wie Sie zwischen geöffneten Projekten wechseln. Wählen Sie zwischen *Horizontale Registerkarten*, *Vertikale Registerkarten* und *Pille*. Standard: *Horizontale Registerkarten*. Wirkung: *Horizontale Registerkarten* zeigt eine Leiste mit Registerkarten unter dem Menüband; *Vertikale Registerkarten* zeigt eine Projektleiste links; *Pille* zeigt eine kleine Projektschaltfläche in der Titelleiste. Wo: *Darstellung*.

### Abschnitt Gantt

**Nur Arbeitstage anzeigen** — verkürzt die Zeitachse. Standard: aus. Wirkung: Wochenenden und Feiertage aus dem Projektkalender werden übersprungen, sodass ein Vorgang mit 5 Arbeitstagen genau 5 Spalten breit ist. Die Befehle *Zu heute springen* und *An Projekt anpassen* zählen dann ebenfalls in Arbeitstagen. Der Bericht hat ein eigenes Kontrollkästchen mit demselben Namen, das unabhängig von dieser Einstellung ist. Wo: *Darstellung*, unter *Gantt › Zeitachse*.

**Viertelstunden anzeigen bei starker Vergrößerung** — eine zusätzliche, feinere Zeitskala. Standard: aus. Wirkung: Sie können weiter hineinzoomen, und die Stundenskala erhält eine zusätzliche Zeile mit Viertelstunden. Beim Ziehen des Balkens eines Stundenvorgangs kann dann auf Viertelstunden statt auf volle Stunden eingerastet werden. Sie sehen dies nur, wenn *Stundenplanung aktivieren* eingeschaltet ist. Wo: *Darstellung*, unter *Gantt › Viertelstunden-Zoom*.

**Vorgangsbalken bei Unterbrechungen** — ob ein Stundenvorgang in Blöcken gezeichnet wird. Wählen Sie zwischen *Nie aufteilen*, *Bei Auswahl aufteilen* und *Immer aufteilen*. Standard: *Bei Auswahl aufteilen*. Wirkung: Der Balken eines Stundenvorgangs wird dann je Band gezeichnet statt als ein durchgehender Block. *Bei Auswahl aufteilen* gilt nur für den ausgewählten Vorgang. Es betrifft nur Stundenvorgänge; ein Vorgang, der wirklich geteilt ist (mit *Vorgang teilen*), zeigt seine Unterbrechung unabhängig von dieser Einstellung. Wo: *Darstellung*, unter *Gantt*.

**Scrollen & Zoomen › Modus** — was das Mausrad über dem Gantt-Diagramm tut. Wählen Sie zwischen *Position*, *Tasten* und *Zoom + Ziehen*. Standard: *Zoom + Ziehen*. Wirkung: Bei *Zoom + Ziehen* zoomt das Rad um den Zeiger, Umschalt+Rad scrollt durch die Zeilen, Sie verschieben die Zeitachse durch Ziehen des Hintergrunds, und Strg+Ziehen (Cmd auf dem Mac) zieht ein Auswahlrechteck. Bei *Position* hängt die Funktion des Rads davon ab, wo sich Ihr Zeiger befindet; Strg+Rad zoomt immer, und Umschalt+Rad scrollt immer horizontal. Bei *Tasten* legen Sie selbst fest, welche Taste was tut. Die Wahl gilt auch für die zweite Zeitachse der geteilten Ansicht. Wo: *Darstellung*, unter *Gantt › Scrollen & Zoomen*.

**Scrollen & Zoomen › Bildschirmaufteilung** — wo der Zeiger steht, für welche Funktion. Nur sichtbar im Modus *Position*. Wählen Sie zwischen *Links/rechts*, *Oben/unten* und *Oben-rechts-Ecke*. Standard: *Links/rechts*. Wirkung: Bei *Links/rechts* scrollt das Rad vertikal über die linke Hälfte und horizontal über die rechte Hälfte. Bei *Oben/unten* scrollt das Rad horizontal über die oberen 30 % (nahe der Zeitskala) und darunter vertikal. Bei *Oben-rechts-Ecke* scrollt das Rad horizontal im oberen rechten Viertel und vertikal im Rest. Wo: *Darstellung*, unter *Gantt › Scrollen & Zoomen*.

**Scrollen & Zoomen › Vertikal, Horizontal, Zoom** — welche Taste zu welcher Radfunktion gehört. Nur sichtbar im Modus *Tasten*. Für jede Funktion wählen Sie zwischen *Scrollen*, *Strg + Scrollen* oder *Umschalt + Scrollen*. Standard: *Vertikal* ist *Scrollen*, *Zoom* ist *Strg + Scrollen* und *Horizontal* ist *Umschalt + Scrollen*. Wirkung: Wenn Sie eine Taste wählen, die schon in Gebrauch ist, tauscht sie mit der Funktion, die sie hatte. Wo: *Darstellung*, unter *Gantt › Scrollen & Zoomen*.

## Registerkarte Planung

**Baumodus aktivieren** — bauspezifische Startwerte für neue Projekte. Standard: ein. Wirkung: Eingeschaltet gibt einem neuen Projekt den Kalender *Bouwkalender NL* mit den niederländischen Feiertagen, lässt Sie beim Erzeugen der Feiertage einen Bauurlaub wählen, bietet die Phasenvorlagen *Wohnungsbau* und *Gewerbebau / Sanierung* an und gibt neuen Vorgängen die Arbeitskategorie *Bau*. Ausgeschaltet gibt den Kalender *Standaardkalender* ohne Feiertage, nur die Vorlage *Leer* und die Arbeitskategorie *Sonstiges*. Ein neuer Vorgang unter einem übergeordneten Vorgang mit einer Arbeitskategorie übernimmt zuerst diese Arbeitskategorie; danach gilt *Bau* oder *Sonstiges*. Bestehende Vorgänge und Kalender ändern sich nicht. Wo: *Planung*.

**Stundenplanung aktivieren** — Planung in Stunden neben Arbeitstagen. Standard: aus. Wirkung: Die Zeitskala *Stunde* erscheint unter *Ansicht › Zeitskala*. Im Fenster *Kalender* kann ein gewöhnlicher Kalender Bänder erhalten (der Block *Arbeitszeiten*; ein Kalender, der schon Bänder hat, zeigt ihn immer). Das Fenster *Neues Projekt* erhält die Auswahlen *Schicht* und *Standardeinheit für neue Vorgänge*. *Projekteinstellungen* erhält ebenfalls die Auswahl *Standardeinheit für neue Vorgänge*. Ausgeschaltet arbeitet die App tagesgenau. Stundenvorgänge bleiben so und gehen in die Berechnung ein; Sie können ihre Dauer erst bearbeiten, wenn Sie die Stundenplanung einschalten. Wo: *Planung*, unter *Stundenplanung*. Siehe [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten).

**Gemischte Tag-/Stundenplanung zulassen** — ob Sie die Einheit je Vorgang wählen. Nur sichtbar, wenn *Stundenplanung aktivieren* eingeschaltet ist. Standard: ein. Wirkung: Eingeschaltet zeigt bei der Dauer jedes Vorgangs die Auswahlliste *Dauereinheit*. Ausgeschaltet blendet diese Auswahlliste aus. Wo: *Planung*, unter *Stundenplanung*. Siehe [Tage und Stunden](docs://uitleg-dagen-en-uren).

**Erster Wochentag** — der erste Tag der Woche. Wählen Sie zwischen *Montag* und *Sonntag*. Standard: *Montag*. Wirkung: die Wochenaufteilung und die Wochennummern der Zeitskala im Gantt-Diagramm und in den Berichten (der Druck des Gantt-Diagramms), sowie die Reihenfolge der Wochentage im Fenster *Kalender*. Wo: *Planung*.

**Automatisch berechnen** — berechnet den Terminplan neu, sobald er nicht mehr aktuell ist. Standard: aus. Wirkung: Ausgeschaltet heißt, dass Sie selbst *Berechnen* (F5) drücken. Eingeschaltet lässt die App den Terminplan innerhalb von Bruchteilen einer Sekunde nach einer Änderung an Vorgängen, Beziehungen oder dem Kalender neu berechnen. Während einer Ziehbewegung oder während Sie in ein Feld tippen, wartet die App und berechnet einmal, wenn Sie fertig sind. Nach einer fehlgeschlagenen Berechnung rechnet sie erst wieder, wenn Sie etwas geändert haben. Wo: *Planung*, unter *Berechnung*.

**Vorgangsarten verwenden** — die Felder für Vorgangsart und Arbeit in der App. Standard: aus. Wirkung: Eingeschaltet zeigt das Feld *Vorgangsart* an einem Vorgang und die Spalte Arbeit bei den Zuweisungen und macht die Tabellenspalte *Vorgangsart* verfügbar. Ausgeschaltet blendet sie aus; Dauer und Einheiten bleiben, und die Arbeit folgt. Ein Projekt, das schon Daten zu Vorgangsart oder Arbeit enthält, zum Beispiel aus einer `.mpp`- oder `.xer`-Datei, zeigt sie immer, auch wenn die Einstellung aus ist. Wo: *Planung*, unter *Berechnung*. Siehe [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels).

## Registerkarte Erweitert

**Erklärung anzeigen nach dem Öffnen von** — ein Kontrollkästchen je Format: *Primavera-Datei (.xer)*, *MS Project-Datei (.mpp)*, *MS Project XML*, *Primavera P6 XML* und *CSV-Datei*. Standard: alle an. Wirkung: Eingeschaltet zeigt nach dem Öffnen einer solchen Datei ein Fenster mit einer kurzen Erklärung des Formats: was die App übernommen hat, was nicht, und wie Speichern und Zurückschreiben funktionieren. *Nicht mehr anzeigen für …* in diesem Fenster deaktiviert hier das Kontrollkästchen; hier schalten Sie es wieder ein. Eine IFC-Datei, ein Beispiel und ein Projekt, das ein KI-Assistent oder eine Erweiterung öffnet, bekommen diese Erklärung nie. Wo: *Erweitert*, unter *Erklärung anzeigen nach dem Öffnen von*. Siehe [Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan).

**KI-Modus aktivieren** — lässt einen KI-Assistenten mit Ihrem Terminplan arbeiten. Standard: aus. Wirkung: Eingeschaltet zeigt die Registerkarte *KI* mit der MCP-Brücke, sodass ein KI-Assistent über das Model Context Protocol mit Ihrem Terminplan arbeiten kann. Ausgeschaltet blendet die Registerkarte aus und stoppt die Brücke. Wo: *Erweitert*, unter *KI-Modus*. Siehe [Einen KI-Assistenten anbinden (MCP)](docs://howto-ai-assistent-koppelen).

**Brücke automatisch starten** — startet die MCP-Brücke, wenn die App startet. Kann nur eingeschaltet werden, wenn *KI-Modus aktivieren* eingeschaltet ist. Standard: aus. Wirkung: Die Brücke ist sofort aktiv, sodass ein KI-Client sich verbinden kann, ohne dass Sie zuerst die Registerkarte *KI* öffnen. Dies funktioniert nur in der Desktop-App und einmal pro Start: Wenn Sie die Brücke danach selbst ausschalten, startet sie nicht erneut. Wo: *Erweitert*, unter *KI-Modus*.

**Debug-Terminal aktivieren** — ein Protokollbereich zur Fehlersuche. Standard: aus. Wirkung: Eingeschaltet legt eine Terminal-Schaltfläche in die Statusleiste, die den Protokollbereich ein- oder ausblendet. Ausgeschaltet schließt den Bereich. Wo: *Erweitert*, unter *Debug-Terminal*.

**Benchmark…** — misst die Leistung des Berechnungsmoduls. Wirkung: öffnet ein Fenster, in dem Sie einen Testterminplan einer gewählten Größe erzeugen lassen und die Kernphasen messen. Ihr geöffnetes Projekt bleibt unverändert. Es ist eine Schaltfläche, keine Einstellung: Es gibt nichts zu merken. Wo: *Erweitert*, unter *Benchmark*.

**Statistiken…** — wie oft die App heruntergeladen wurde. Wirkung: öffnet das Fenster *Download-Statistiken* mit öffentlichen Zahlen aus GitHub Releases; von Ihnen wird nichts erfasst. Es ist eine Schaltfläche, keine Einstellung. Wo: *Erweitert*, unter *Statistiken*. Im Fenster:

- *Downloads je Betriebssystem* — je System die Spalten *Downloads*, *Installer* (was eine Person herunterlädt) und *Updates* (was der Updater in der App abruft), mit einer Zeile *Gesamt*. Unter Linux lassen sich die beiden nicht trennen: Der Updater holt dieselbe `.deb`-, `.rpm`- oder `.AppImage`-Datei, die Menschen auch von Hand herunterladen; deshalb zählt dort nur die Snap-Datei als *Installer*. Darunter *Update-Prüfungen aus der App*: wie oft der Updater in einer installierten App die Versionsdatei von GitHub abgerufen hat, um nach einer neuen Version zu suchen. Das sind Prüfungen, keine Installationen.
- *Je Release* — dieselben Downloads je Version, mit dem Datum; zuerst die sechs neuesten, mit *Alle … Releases anzeigen* für den Rest.
- *Quelle* — das Datum der Zahlen (GitHub Releases, wöchentlich aktualisiert) und *Jetzt aktualisieren*. Die App behält abgerufene Zahlen eine halbe Stunde. Schlägt das Abrufen fehl, meldet das Fenster das. Installationen über den Snap Store laufen nicht über GitHub und fehlen daher.

**Tour starten** — die Einführungstour noch einmal. Wirkung: schließt das Fenster *App-Einstellungen* und startet die Tour beim ersten Schritt. Wo: *Erweitert*, unter *Tour*.

**Version** — die Versionsnummer der App, mit zwei Schaltflächen. *Nach Updates suchen* öffnet das Update-Fenster. *Neuerungen* zeigt die Neuigkeiten der aktuellen Version. Wo: *Erweitert*, unter *Version*.

**Klassische Ansichtsschaltflächen anzeigen** — eine ersetzte Funktion, unter *Legacy-Funktionen*. Standard: aus. Wirkung: Eingeschaltet legt eine Gruppe *Anzeige* wieder auf die Registerkarte *Ansicht* mit den einzelnen Schaltflächen *Spalten…*, *Filter…*, *Gruppieren…* und *Sortieren…*. Sie wurden ersetzt durch das Pluszeichen in der Tabellenkopfzeile, die Layout-Schaltflächen und das Layout-Fenster. Wo: *Erweitert*, unter *Legacy-Funktionen*.

## Gespeicherte Anzeigeeinstellungen außerhalb des Einstellungsbereichs

Die App speichert diese Anzeigeeinstellungen auch auf diesem Gerät. Sie stellen sie aber direkt am Element ein, nicht im Einstellungsbereich.

**Baseline-Overlay** — die aktive Baseline als dünner Balken unter dem Vorgangsbalken. Standard: ein. Wo: *Ansicht › Baselines & Fortschritt › Baseline-Overlay*.

**Fortschrittslinie** — die Zickzacklinie des Fortschritts am Statusdatum. Standard: ein. Wirkung: Die Linie erscheint nur, wenn das Projekt ein Statusdatum hat. Dann ersetzt sie die separate Statusdatumslinie. Wo: *Ansicht › Baselines & Fortschritt › Fortschrittslinie*.

**Statusdatumslinie** — eine gepunktete Linie am Statusdatum. Standard: ein. Wirkung: Ist die Fortschrittslinie eingeschaltet, zeichnet diese Linie die Markierung selbst. Wo: *Ansicht › Baselines & Fortschritt › Statusdatumslinie*.

**Ressourcen-Akzent** — ein dünner Streifen in der Ressourcenfarbe unter dem Vorgangsbalken. Standard: aus. Wo: *Ansicht › Baselines & Fortschritt › Ressourcen-Akzent*.

**Pufferband** — der Puffer als Band hinter nicht kritischen Balken, nicht bei abgeschlossenen Vorgängen. Standard: ein. Wo: *Ansicht › Baselines & Fortschritt › Pufferband*.

**Balkenfarben** — wovon die Farbe eines Balkens abhängt. Wählen Sie aus *Kritischer Pfad*, *Pro Vorgang — automatisch* und *Nach Kategorie*. Standard: *Kritischer Pfad*. Wirkung: Gilt gleichzeitig für das Gantt-Diagramm und den Bericht. Wo: *Ansicht › Baselines & Fortschritt › Balkenfarben*.

**Histogramm** — der Histogrammstreifen unter dem Gantt-Diagramm. Standard: aus. Wo: *Ressourcen › Histogramm › Histogramm*, *Ansicht › Bereiche › Histogramm* oder Strg+Umschalt+H. Sie stellen die Höhe des Streifens (Standard: 160 Pixel, zwischen 80 und 480) ein, indem Sie seine Kante ziehen.

**Minimap** — eine Übersichtskarte der Zeitachse. Standard: aus. Wo: *Ansicht › Präsentation › Minimap*.

**Menüband einklappen** — ein kompaktes Menüband. Standard: aus. Wo: die Pfeilschaltfläche unten rechts am Menüband.

**Breite der Vorgangstabelle** — Standard: 350 Pixel, zwischen 150 und 800. Sie stellen die Breite ein, indem Sie die Trennlinie neben der Tabelle ziehen. Oder Sie nutzen die Pfeiltaste nach links und die Pfeiltaste nach rechts, wenn die Trennlinie den Fokus hat.

**Breite des rechten Bereichs** — Standard: 280 Pixel, zwischen 200 und 900. Sie stellen sie ein, indem Sie die Kante des Bereichs ziehen.

**Höhe von *Eigenschaften* und *Warnungen* im rechten Bereich** — Standard: 240 und 220 Pixel, zwischen 120 und 2000. *Eigenschaften* hat diese Höhe auch, wenn die Ressourcenliste geöffnet ist. Sie stellen die Höhe mit dem Griff zwischen den Abschnitten ein. Die App merkt sich nicht, ob die Abschnitte geöffnet oder geschlossen sind.

**Auch gespeichert, an anderer Stelle beschrieben** — die Spalten der Tabelle ([Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen)), Ihre Layouts ([Ein Layout erstellen und verwenden](docs://howto-layouts-gebruiken)), die Berichtsoptionen ([Berichtstypen](docs://ref-rapporttypes)), Ihre eigenen Vorlagen für Berechnungsprofile ([Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies)) und die *Dokumentationssprache* der Hilfe (*Datei › Hilfe*) speichert die App ebenfalls auf diesem Gerät, nicht in der Projektdatei.

## Siehe auch

- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): die Optionen, die zu einem Projekt gehören.
- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): die Schritte für den Schalter *Stundenplanung aktivieren*.
- [Tage und Stunden](docs://uitleg-dagen-en-uren): wie die App Tage und Stunden zählt.
- [Vorgangsarten: Dauer, Einheiten und Arbeit](docs://uitleg-werkregels): was *Vorgangsarten verwenden* sichtbar macht.
- [Tastenkürzel](docs://ref-sneltoetsen): alle Tasten der App, einschließlich der Tasten zum Zoomen und Scrollen.
