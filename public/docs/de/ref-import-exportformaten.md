# Import- und Exportformate

Pro Dateiformat: ob Sie es öffnen, speichern und exportieren können, was mitkommt und was nicht, und mit welchem Berechnungsprofil es sich öffnet. Den Hintergrund dazu und ein Beispiel mit Zahlen finden Sie unter [Dateien und Formate](docs://uitleg-bestanden).

## Auf einen Blick

**Öffnen** funktioniert mit IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` und `.xer`. Eine Datei mit einer anderen Endung behandelt die App als IFC.

**Speichern** schreibt immer IFC. Nur eine geöffnete IFC-Datei wird das Speicherziel. Ein Projekt aus einem anderen Format hat nach dem Öffnen keine Datei. *Speichern* fragt dann, wo die IFC-Datei hin soll.

**Exportieren** ist möglich nach IFC, MS Project XML, Primavera P6 XML, CSV und zwei Fortschrittsblätter (Excel und CSV). Ein Export ändert Ihr Projekt nicht.

**Schreibgeschützt** sind `.mpp` und `.xer`. Die App kann sie öffnen, aber nicht schreiben.

**PDF** kommt nur aus einem Bericht (siehe [Berichtstypen](docs://ref-rapporttypes)). Die App liest kein PDF.

**Wo.** Öffnen: *Start › Datei › Öffnen*, *Datei › Öffnen* oder Strg+O. Exportieren: *Start › Datei › Exportieren* oder *Datei › Exportieren*. Ein ausgefülltes Fortschrittsblatt lesen Sie über *Datei › Importieren* ein. Oder Sie nutzen die Schaltfläche *Fortschritt aus einer Tabelle aktualisieren* in der Gruppe *Fortschritt* im Menüband auf den Registerkarten *Planung*, *Tabelle* und *Bericht*.

**Berechnungsprofil beim Öffnen.** Jedes Format öffnet sich mit einem Berechnungsprofil. Was das ist, steht unter [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies). `.xer` öffnet sich mit *Primavera P6*, `.mpp` mit *Microsoft Project*, und CSV, MS Project XML und P6 XML mit *Open Planner Studio*. IFC behält das Profil, das in der Datei gespeichert ist. Für `.xer` und `.mpp` meldet die App, dass das Projekt so berechnet wird. Nur IFC enthält das Berechnungsprofil und die Berechnungsoptionen. Von den Berechnungsoptionen schreibt MS Project XML höchstens die kritische Schwelle. Ein erneut geöffneter Export eines anderen Formats berechnet als *Open Planner Studio*.

## IFC

**Öffnen** — ja, `.ifc`. Die App liest IFC4 und IFC 4.3 (auch ADD2). Eine Datei in einem anderen Schema, zum Beispiel IFC2X3, öffnet sich ebenfalls. Beim ersten Speichern wählen Sie dann ein Schema, das die App schreiben kann (siehe [Auswahl des IFC-Schemas](docs://howto-ifc-schema-kiezen)). Berechnungsprofil: das Profil in der Datei.

**Speichern** — ja, und es ist das einzige Format, das speichern kann. *Speichern* schreibt Ihr ganzes Projekt als IFC-Datei, im IFC-Schema des Projekts (standardmäßig IFC 4.3 ADD2). Die Datei wird das Speicherziel.

**Exportieren** — ja, als *IFC*, im IFC-Schema des Projekts (standardmäßig IFC 4.3 ADD2). Standardname: der Projektname mit der Endung `.ifc`. Ist Ihr Projekt mit einer Ressourcenbibliothek verknüpft, steht das Kontrollkästchen *Bibliotheksdatei zusätzlich speichern* unter den Karten in *Datei › Exportieren*. Ist es angekreuzt, fragt die App nach einem Ort für *projectname-bibliotheek.ifc*, nachdem das Projekt gespeichert ist. Das Kontrollkästchen steht nicht in der Liste auf der Registerkarte *Start*.

**Was mitkommt** — alles, was zum Projekt gehört: Vorgänge mit PSP-Struktur, Dauer, Terminen und Fortschritt; Beziehungen mit Zeitabstand; Einschränkungen und Stichtage; Kalender; Ressourcen und Zuweisungen, einschließlich der Verteilung nach Stunden; Baselines; Aktivitätscodes und benutzerdefinierte Felder; Notizen; externe Beziehungen zu anderen Projekten; Unterbrechungen; Vorgangsarten und benutzerdefinierte Arbeitskategorien; die Projekteinstellungen wie das Statusdatum, den Fortschrittsmodus, das Berechnungsprofil und die Berechnungsoptionen; die Verknüpfung mit einer Ressourcenbibliothek. Bei einem Projekt aus einer `.xer`-Datei kommt auch die ursprüngliche Quelldatei mit. Eine benutzerdefinierte Arbeitskategorie speichert die App als IFC-Typ `USERDEFINED` mit ihrem Namen im Feld ObjectType. So liest ein anderes IFC-Programm den Vorgang normal. Die App behält außerdem die feste ID der Arbeitskategorie, sodass ein Umbenennen die Verknüpfung nicht bricht. Öffnet jemand die Datei auf einem anderen Computer, erscheint die Arbeitskategorie dort unter *Aus diesem Projekt*, nicht unter den eigenen *Meine Arbeitskategorien*.

**Was nicht mitkommt** — wie Sie den Bildschirm eingerichtet haben (Zoom, Scrollposition, ausgewählter Vorgang, eingeklappte Phasen, gewählter Filter und gewählte Gruppierung) und die [Einstellungen](docs://ref-instellingen) der App. Die Registerkarte *IFC* ist ein Editor mit dem IFC-Text Ihres Projekts. *IFC generieren* aktualisiert ihn, *Kopieren* legt ihn in die Zwischenablage, und *Anwenden* lädt den Text als Ihr Projekt und ersetzt dabei das Projekt auf dieser Registerkarte.

## MS Project XML (MSPDI)

**Öffnen** — ja. Die App erkennt eine `.xml`-Datei als MS Project XML am Stammelement `Project` im MS-Project-Namensraum (oder ohne Namensraum). Berechnungsprofil: *Open Planner Studio*. Danach meldet die App Ihnen in einer Meldung, was sie nicht übernommen hat; siehe [Öffnen einer MS-Project-Datei (.mpp)](docs://howto-mpp-openen).

**Speichern** — nein. Ein solches Projekt bekommt kein Speicherziel.

**Exportieren** — ja, als *MS Project XML* (*Öffnen in Microsoft Project. Vollständige PSP-Struktur.*). Standardname: der Projektname mit `.xml`.

**Was mitkommt** — Vorgänge mit Struktur (Ebene und PSP), Dauer, Terminen und Fortschritt; Beziehungen mit Zeitabstand, auch in Stunden oder Prozent; Einschränkungen, einschließlich des Stichtags; Kalender, einschließlich Vorgangs- und Ressourcenkalender; Ressourcen und Zuweisungen, einschließlich der Kurve oder der Verteilung nach Stunden; das Statusdatum; die kritische Schwelle als ganze Zahl von Arbeitstagen, 0 oder mehr, mit *Gesamtpuffer ≤ Schwelle*; die Beschreibung eines Vorgangs (als Notiz); die Vorgangsart eines Vorgangs (als Vorgangsart von MS Project); eine benutzerdefinierte Arbeitskategorie in einem freien Feld (`ExtendedAttribute`), das die App zurückliest und das MS Project eventuell ignoriert. Von Ihren Baselines kommt nur die aktive mit, als Baseline 0. Ein Vorgang in Stunden behält seine Einheit, und ein Meilenstein behält seine Art (Anfang, Ende oder automatisch).

**Was nicht mitkommt** — Notizen (die Checkliste eines Vorgangs), externe Beziehungen zu anderen Projekten, Aktivitätscodes und benutzerdefinierte Felder, eine zweite Einschränkung, die Markierung *Manuell geplant*, die Abgleichsverzögerung, der Wiederaufnahme- und Haltepunkt eines Vorgangs mit Fortschritt außer Reihenfolge, die Konventionen *Restarbeit wird nach der verstrichenen Dauer fortgesetzt* und *Nicht begonnene Vorgänge nicht zum Statusdatum verschieben* eines MS-Project-Profils sowie die übrigen Berechnungsoptionen. Unterbrochene Vorgänge ohne Verteilung nach Stunden kommen ohne ihre Unterbrechungen mit.

**Feiertage beim Öffnen.** Ein abgeleiteter Kalender übernimmt die Ausnahmen seines Basiskalenders. Ein Kalender mit einer eigenen Arbeitswoche und ohne Ausnahmen bekommt keine Feiertage. Nur ein schlichter Kalender ohne Basiskalender, Arbeitswoche oder Ausnahmen behält die niederländischen Standardfeiertage. Fehlen Feiertage, dann kann das Projektende abweichen; siehe [Feiertage erzeugen und die Bauferien](docs://howto-feestdagen-genereren).

**Was sich unterwegs ändert** — Eine Einschränkung *Muss anfangen am (MSO)* oder *Muss enden am (MFO)* ohne die Auswahl *Verbindlich (Pin-Logik)* wird zu *Anfang nicht früher als (SNET)* oder *Ende nicht früher als (FNET)*. Ein Hammock wird zu einem gewöhnlichen Vorgang mit berechneten Terminen. MS Project XML speichert die Stunden pro Tag nur für den Projektkalender. Ein anderer Kalender mit eigenen Stunden pro Tag bekommt beim Öffnen der Datei seine Arbeitszeit als Stunden pro Tag: 8 Stunden pro Tag, mit Arbeitszeiten von 10 Stunden, wird 10. Ein Vorgang in Tagen auf einem solchen Kalender wird dann kürzer, zum Beispiel 4 Tage statt 5.

## MS-Project-Datei (`.mpp`)

**Öffnen** — ja, von MS Project 2010 bis 2021. Berechnungsprofil: *Microsoft Project*. Die App liest die Datei nur. Sie ändert Ihre `.mpp`-Datei nie. Eine Datei aus MS Project 2007 oder älter und eine Datei mit Kennwort lehnt die App mit einer Meldung ab, die auf den XML-Export von MS Project verweist. Nach dem Öffnen meldet die App Ihnen in einer Meldung, was sie nicht übernommen hat.

**Speichern** — nein, und es gibt kein Speicherziel: *Speichern* schreibt eine neue IFC-Datei.

**Exportieren** — nein.

**Was mitkommt** — Vorgänge mit Struktur, Dauer und Einschränkungen; Beziehungen mit Zeitabstand; Kalender; Ressourcen und Zuweisungen; Fortschritt; ein PSP-Code, den Sie selbst in MS Project eingetragen haben. Die Termine und den Puffer, die MS Project selbst berechnet hat, liest die App ebenfalls ein, für die Ansicht *Termine wie gespeichert*.

**Was nicht mitkommt** — Baselines, Kosten und Tarife, Notizen, Hyperlinks, die benutzerdefinierten Felder von MS Project, die Verknüpfungen von Teilprojekten und externen Vorgängen sowie die kritische Schwelle. Siehe [Öffnen einer MS-Project-Datei (.mpp)](docs://howto-mpp-openen).

**Herkunft und Lizenz** — Der `.mpp`-Leser wurde für Open Planner Studio geschrieben und ist abgeleitet von dem Quellcode und dem strukturellen Wissen von MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), einer Java-Bibliothek unter LGPL-2.1. Die Struktur und die Feldkonstanten wurden nach TypeScript übertragen. Open Planner Studio selbst ist quelloffen unter LGPL-3.0. Der `.xer`-Leser ist kein Derivat. MPXJ wurde dort nur als Verständnisquelle zu Rate gezogen.

## Primavera P6 XML

**Öffnen** — ja. Die App erkennt eine `.xml`-Datei als P6 XML am Stammelement `APIBusinessObjects`. Berechnungsprofil: *Open Planner Studio*.

**Mehrere Projekte in einer Datei.** Jedes Projekt mit Vorgängen öffnet sich auf einer eigenen Registerkarte, benannt *Projektname (Projekt-ID)*. Die App überspringt ein Projekt ohne Vorgänge. Die aktive Registerkarte ist das Projekt mit den meisten Vorgängen. Die App übernimmt keine Beziehung zu einem anderen Projekt und keinen Vorgang, der zu keinem Projekt gehört. Nach dem Öffnen meldet die App, wie viele Projekte sie geöffnet hat.

**Feiertage beim Öffnen.** Dieselben Regeln gelten wie bei MS Project XML: Ein Kalender mit einer eigenen Arbeitswoche und ohne Ausnahmen bekommt keine Feiertage.

**Baselines.** Ein `<BaselineProject>` in der Datei wird eine Baseline seines Projekts. Die Baseline, die P6 als aktiv markiert, ist in der App ebenfalls aktiv.

**Einsatzrate einer Zuweisung.** Ist noch Arbeit übrig, wird die Rest-Einsatzrate (`RemainingUnitsPerTime`) zu *Einh./Tag*. Sonst ist es die geplante Einsatzrate (`PlannedUnitsPerTime`). Bei Material bleibt die geplante Einsatzrate. Die App berechnet beim Öffnen der Datei nichts neu. Beim Export nach P6 XML schreibt sie die geplante Einsatzrate als `PlannedUnitsPerTime`. Die Rest-Einsatzrate schreibt sie als `RemainingUnitsPerTime` nur, wenn die Zuweisung eine eigene geplante Einsatzrate hat.

**Keine lesbaren Vorgänge.** Findet die App keinen Vorgang, den sie lesen kann, öffnet sie keine Registerkarte. Sie meldet das, mit dem Grund, wenn er bekannt ist. Beispiele: Vorgänge ohne `ObjectId` oder XER-Spaltennamen in einer XML-Datei. Exportieren Sie das Projekt dann erneut aus P6 als P6 XML oder öffnen Sie es als `.xer`.

**Speichern** — nein.

**Exportieren** — ja, als *Primavera P6 XML* (*Für Oracle Primavera P6.*). Standardname: der Projektname mit `.xml`, mit der Projekt-ID in Klammern, wenn das Projekt eine hat. Ein Export als MS Project XML bekommt denselben Namen. Geben Sie beiden Exporten selbst verschiedene Namen.

**Projektname und Projekt-ID.** Die App hält die Projekt-ID aus P6 getrennt vom Projektnamen, wie bei einer `.xer`-Datei. *Projekteinstellungen* zeigt nur den Namen, zum Beispiel *Bid for Facility Extension*. Die Registerkarte zeigt *Bid for Facility Extension (OZB-05)*. Benennen Sie das Projekt in *Hall extension* um, dann heißt die Registerkarte *Hall extension (OZB-05)*. Ein Export nach P6 XML schreibt *OZB-05* als Projekt-ID zurück und *Hall extension* als Namen. So erkennt P6 das Projekt. Ein Projekt aus einer `.xer`-Datei nimmt seine Projekt-ID ebenfalls mit. Die Projekt-ID bleibt erhalten, wenn Sie das Projekt als IFC speichern. Klammern im Namen selbst, wie in *New build (phase 2)*, bleiben im Namen. Ein Projekt ohne Projekt-ID bekommt beim Export von der App eine eigene, eindeutige ID, die mit *OPS:* beginnt.

**Was mitkommt** — PSP-Struktur und Vorgänge mit Dauer, Terminen und Fortschritt; Beziehungen mit Zeitabstand; Einschränkungen (auch eine zweite, als weiche Einschränkung); Kalender; Ressourcen und Zuweisungen; das Statusdatum (als `DataDate`); eine benutzerdefinierte Arbeitskategorie in einem eigenen Feld, `OPS Custom Task Type`, das die App zurückliest und das P6 eventuell ignoriert.

**Was nicht mitkommt** — Baselines und Stichtage; Aktivitätscodes, benutzerdefinierte Felder, Notizen und externe Beziehungen; die Berechnungsoptionen; die Namen der Feiertage. P6 kennt keinen Namen pro freien Tag. Nach dem erneuten Öffnen heißt ein Feiertag *Holiday* und eine Arbeitsausnahme *Working exception*. Aufeinanderfolgende freie Tage kommen als ein Bereich zurück. Die App kürzt einen Namen oder Code, der länger ist, als P6 erlaubt: einen Vorgangsnamen auf 120 Zeichen, eine Vorgangs-ID oder einen PSP-Code auf 40, einen PSP- oder Projektnamen auf 100. Sie meldet, wie viele Namen und Codes sie gekürzt hat. P6 kennt keinen Zeitabstand in Prozent: Die App rechnet ihn in eine feste Anzahl Tage um. Ein Zeitabstand in Kalendertagen wird ein Zeitabstand in Arbeitszeit: 3 Kalendertage werden 3 Arbeitstage. Ein Hammock wird zu einem normalen Vorgang, ein manuell geplanter Vorgang zu einem normalen Vorgang mit berechneten Terminen, und eine Abgleichsverzögerung von weniger als einem Tag entfällt.

## Primavera-Datei (`.xer`)

**Öffnen** — ja. Berechnungsprofil: *Primavera P6*. Die App liest die Datei nur. Sie schreibt keine `.xer`-Datei und ändert Ihre Datei nie. Sie öffnet je Projekt einen Reiter mit Vorgängen. Eine Datei ohne Vorgänge oder mit beschädigten Tabellen lehnt sie mit einer Meldung ab.

**Speichern** — nein, und es gibt kein Speicherziel: *Speichern* schreibt eine neue IFC-Datei, mit der ursprünglichen `.xer`-Datei darin.

**Exportieren** — nein. Wenn Sie ein Projekt aus einer `.xer`-Datei nach CSV, MS Project XML oder P6 XML exportieren, meldet die App, dass XER-Quellinformationen verloren gehen. Das gilt auch, wenn Sie das Projekt zwischendurch als IFC gespeichert haben. Nach IFC geht nichts verloren.

**Was mitkommt** — die PSP-Struktur und Vorgänge mit Dauer, Terminen, Einschränkungen und Fortschritt; Beziehungen mit Zeitabstand; Kalender; Ressourcen mit Zuweisungen; Aktivitätscodes; benutzerdefinierte Felder (UDFs); Notizen; die Einstellungen zur Terminplanung von P6. Ein Vorgang vom Typ *Level of Effort* wird ein Hammock. Ein Baseline-Projekt wird die aktive Baseline des Projekts, das darauf verweist. Eine Beziehung zwischen zwei Projekten behält die App als Quelldaten.

**Leistung einer Zuweisung.** Bleibt Restarbeit, wird die verbleibende Leistung (`remain_qty_per_hr`) zu *Einh./Tag*. Sonst ist es die geplante Leistung (`target_qty_per_hr`). Die geplante Arbeit, die Ist-Arbeit und die Restarbeit bleiben wie in der Datei. Bei Material bleibt die geplante Leistung.

**Ein freier Samstag oder Sonntag, der nicht in der Datei steht.** Manche P6-Exporte verschieben einen freien Wochenendtag aus einem Block von mehreren freien Tagen auf den Freitag davor oder den Montag danach. Arbeitet der Kalender am Samstag oder Sonntag, würde dieser Tag fälschlich ein Arbeitstag. Erkennt die App dieses Muster in einem Block von mindestens drei freien Tagen, macht sie diesen Wochenendtag doch frei. Im Kalender heißt der Tag *Kalenderausnahme (Wochenendrekonstruktion)*. Er zählt in der Zeile *N Kalender-Hinweise.* der Meldung. An einem Kalender, der am Wochenende nicht arbeitet, ändert sich nichts.

**Puffer bis zum Projektende, ohne Endtermin.** Ist die P6-Option eingeschaltet, den Puffer bis zum Projektende zu berechnen, und hat die Datei weder ein Projektende noch einen geplanten Endtermin für einen Vorgang? Dann schaltet die App die Option *Puffer bis zum Projektendtermin berechnen* aus. Sie berechnet die späten Termine dann vom spätesten frühesten Ende aus rückwärts. Das zählt in der Zeile *N P6-Planungseinstellungen mit sicherem Rückfall.* mit.

**Abgeschlossene Vorgänge am Statusdatum.** Manche Dateien speichern für einen abgeschlossenen Vorgang nicht die Ist-Werte, sondern ein Fenster am Statusdatum. In der Ansicht *Termine wie gespeichert* ist ein solcher Vorgang dann ein schmaler Balken am Statusdatum. Wird neu berechnet und liegt er danach an einer anderen Stelle, zählt er zur Anzahl der Vorgänge, die der Streifen angibt. Die Konvention *Abgeschlossener Vorgang im Statusdatumsfenster* berechnet so ein Fenster. Nur mit dieser Konvention bekommt ein abgeschlossener Vorgang über die Berechnungsoption *Abgeschlossener Vorgang: späte Termine ab dem Statusdatum* einen echten Puffer. Diese Konvention ist eine Näherung: Die App hat dieses Verhalten nur in P3-Ausgaben gesehen, und Primavera bestätigt es nirgends. Darum ist sie in jedem eingebauten Profil ausgeschaltet, auch unter *Primavera P6*. Sie schalten sie im Abschnitt *Berechnungsprofil und Berechnungsoptionen* ein; das Projekt bekommt dann ein eigenes Profil. Siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies).

**Zahlen mit Komma als Dezimaltrennzeichen.** P6 speichert das Dezimal- und das Tausendertrennzeichen in der Tabelle `CURRTYPE`. Die App liest diese Zeichen, bevor sie Dauern, Arbeit und Puffer umrechnet. Fehlt diese Angabe, verwendet die App einen Punkt als Dezimaltrennzeichen. Enthält die Datei noch Zahlen mit Dezimalkomma, öffnet die App nichts. So öffnet sich nie ein Terminplan mit falsch gelesenen Zahlen.

**Was nicht mitkommt** — ein Projekt ohne Vorgänge und eine Beziehung zwischen zwei Projekten als echte Beziehung in Ihrem Terminplan. Siehe [Eine Primavera-P6-Datei (.xer) öffnen](docs://howto-xer-openen).

## CSV

**Öffnen** — ja. Die App liest `;` und `,` als Trennzeichen. Sie erkennt Spaltenüberschriften auf Englisch und Niederländisch (zum Beispiel `Name` oder `Naam`, `Duration` oder `Duur`, `Predecessors` oder `Voorgangers`). Datumsangaben können *JJJJ-MM-TT*, *TT-MM-JJJJ* oder *TT/MM/JJJJ* sein. Einen Vorgänger schreiben Sie als PSP-Code, Beziehungstyp und Zeitabstand, zum Beispiel `1.2FS+2d`. Berechnungsprofil: *Open Planner Studio*. Das Projekt heißt *CSV Import*. Die Spalte `Task Type` enthält die Arbeitskategorie, nicht die Vorgangsart; die App liest außerdem die Kopfzeilen `Werksoort` und `Work category`. Eine `Task Type`, die keiner der festen Codes ist (wie `CONSTRUCTION` oder `INSTALLATION`, die die App selbst schreibt), wird eine benutzerdefinierte Arbeitskategorie unter *Aus diesem Projekt*, nicht unter *Meine Arbeitskategorien*. Mit `OPS Custom Task Type ID` bleibt die ID einer benutzerdefinierten Arbeitskategorie erhalten.

**Speichern** — nein.

**Exportieren** — ja, als *CSV (;)* (*Universeller Tabellenexport. Alle Vorgänge mit Terminen und Dauer.*), auf der Karte *CSV (semikolon-getrennt)*. Die Datei nutzt ein Semikolon als Trennzeichen, ist in UTF-8 mit BOM und hat englische Spaltenüberschriften.

**Was mitkommt** — je Vorgang diese Spalten: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` und `Description`. Die Spalte `Task Type` enthält die Arbeitskategorie. Die Fertigstellung ist in ganzen Prozent angegeben. Ein Zeitabstand in Stunden erhält das Stundenzeichen der App-Sprache: `1.2FS+2h` auf Englisch, `1.2FS+2u` auf Niederländisch. Beim Öffnen liest die App beide.

**Was nicht mitkommt** — Ressourcen, Zuweisungen, Kalender, Einschränkungen, Stichtage, Baselines und das Statusdatum. Stehen die Termine in der Ansicht *Termine wie gespeichert*, lässt der Export die Spalten `Critical` und `Total Float` für Vorgänge leer, deren Quelldatei das nicht gespeichert hat.

## Fortschrittsblatt (Excel und CSV)

**Öffnen** — ja, über *Datei › Importieren* (*Fortschritt aus einer Tabelle aktualisieren*) oder über die Schaltfläche dieses Namens in der Gruppe *Fortschritt* im Menüband auf *Planung*, *Tabelle* und *Bericht*. Die App liest `.xlsx` und `.csv`, bis zu 16 MB und 50.000 Zeilen. Das öffnet kein Projekt. Es aktualisiert den Fortschritt Ihres geöffneten Projekts. Siehe [Fortschritt aus einer Tabelle importieren](docs://howto-voortgang-importeren).

**Speichern** — nein.

**Exportieren** — ja, als *Fortschrittsblatt (Excel)* (*Fortschritt (Excel)* in der Liste) und *Fortschrittsblatt (CSV)* (*Fortschritt (CSV)*). Standardname: *projectname-voortgang*. Die Schaltfläche *Fortschrittsblatt exportieren* in derselben Gruppe erstellt das Excel-Blatt mit einem Klick. Das Excel-Blatt hat feste Spaltenbreiten, gesperrte Felder und eine Datumsprüfung. Das CSV-Blatt hat denselben Inhalt als reinen Text.

**Was mitkommt** — die Spalten `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` und `Actual Finish`. Beim Einlesen nutzt die App `Completion (%)`, `Actual Start` und `Actual Finish`. `Start` und `Finish` dienen nur dazu, die Datumsschreibweise zu erkennen. Diese ändern Ihren Terminplan nicht. Die App verknüpft Zeilen mit Vorgängen über die `OPS Task ID`, sonst über einen eindeutigen PSP-Code.

**Was nicht mitkommt** — alles außerhalb dieser Spalten: Dauer, Beziehungen, Ressourcen und der Rest Ihres Terminplans. Ein Sammelvorgang erhält aus dem Blatt keinen Fortschritt.

## PDF

**Öffnen** — nein.

**Speichern** — nein.

**Exportieren** — ja, aus einem Bericht: auf der Registerkarte *Bericht* die Schaltfläche *PDF exportieren*. Die App sendet einen Bericht nicht selbst an einen Drucker. Der Weg zu Papier führt über das PDF. Der Inhalt hängt vom Berichtstyp ab. Siehe [Berichtstypen](docs://ref-rapporttypes) und [Bericht erstellen und drucken](docs://howto-rapport-maken-en-afdrukken).

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): warum IFC das eigene Format ist und was ein Export verliert, mit einem Beispiel.
- [Eine Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan): die Schritte.
- [Exportieren](docs://howto-exporteren): ein Format wählen und die Meldungen nach einem Export.
- [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen): warum eine geöffnete Datei andere Termine zeigen kann.
- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): die Berechnungsprofile.
