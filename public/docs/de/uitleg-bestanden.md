# Dateien und Formate

Was steckt wirklich in der Datei, die Sie speichern? Und was passiert mit Ihrem Terminplan, wenn Sie ihn in ein anderes Programm exportieren? In diesem Artikel lesen Sie, wie die App mit Dateien umgeht: IFC als eigenes Format, die anderen Formate als Übersetzer, was ein Export weglässt und wie sich Speichern, AutoSave und Wiederherstellung nach einem Absturz unterscheiden. Das Beispiel am Ende zeigt mit Zahlen, was ein Export bewirkt.

## Das Konzept

Open Planner Studio hat ein eigenes Dateiformat: **IFC**, ein offenes Austauschformat für Bauinformationen von buildingSMART. Die App schreibt das IFC-Schema des Projekts, standardmäßig IFC 4.3 ADD2 (siehe [Auswahl des IFC-Schemas](docs://howto-ifc-schema-kiezen)). In der Exportliste heißt es *IFC*. Es gibt keine zweite, proprietäre Projektdatei. *Speichern* schreibt Ihr ganzes Projekt als IFC-Datei (`.ifc`). *Öffnen* liest eine solche Datei wieder ein. Möchten Sie sehen, was in die Datei kommt? Die Registerkarte *IFC* ist ein Editor, der den IFC-Text Ihres Projekts zeigt. *IFC generieren* aktualisiert diesen Text. *Kopieren* legt ihn in die Zwischenablage. Ändern Sie den Text, dann lädt *Anwenden* ihn als Ihr Projekt. Das ersetzt das Projekt in dieser Registerkarte vollständig.

Alle anderen Formate sind **Adapter**: Übersetzer zwischen dem Modell eines anderen Programms und dem der App. Die App liest CSV, MS Project XML, Primavera P6 XML, MS-Project-Dateien (`.mpp`) und Primavera-Dateien (`.xer`). Sie schreibt CSV, MS Project XML, Primavera P6 XML und zwei Fortschrittsblätter. Nach `.mpp` oder `.xer` können Sie nicht exportieren.

Warum ist dieser Unterschied wichtig? Ein Übersetzer kann nur übernehmen, was beide Seiten kennen. Die IFC-Datei der App behält alles, was zu Ihrem Projekt gehört. Jedem anderen Format fehlt ein Teil davon. Dieser Teil bleibt zurück.

## Wie die App mit Dateien umgeht

### Was das Öffnen bewirkt

Die App wählt den Leser anhand der Dateierweiterung: `.ifc`, `.csv`, `.xml`, `.mpp` oder `.xer`. Bei einer `.xml`-Datei schaut sie in die Datei, um zu sehen, ob es MS Project XML oder Primavera P6 XML ist. Eine unbekannte Dateierweiterung behandelt die App als IFC. Ist die Datei keine IFC-Datei, meldet die App *Datei konnte nicht geöffnet werden*, mit dem Grund.

Jede Datei öffnet sich in einer eigenen Registerkarte. Ausnahme ist eine Registerkarte, die noch leer und unverändert ist: Diese Registerkarte übernimmt die Datei. Eine einzige Primavera-Datei kann mehrere Registerkarten erzeugen, eine für jedes Projekt mit Vorgängen.

Nach dem Öffnen berechnet die App immer neu. Stammt die Datei aus einem anderen Programm, können die Termine von dem abweichen, was in der Datei stand. Das wird unter [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen) beschrieben.

Nur eine IFC-Datei wird das **Speicherziel**: die Datei, in die *Speichern* zurückschreibt. Eine CSV-, XML-, `.mpp`- oder `.xer`-Datei wird das nicht. Ein solches Projekt hat nach dem Öffnen keine Datei. *Speichern* fragt dann, wohin die neue IFC-Datei soll. So überschreibt Strg+S Ihre Originaldatei nie mit IFC-Text.

### Was Speichern schreibt

*Speichern* schreibt immer das ganze Projekt. Das gehört dazu:

- Vorgänge mit Struktur, Dauer, Terminen und Fortschritt;
- Beziehungen mit Zeitabstand, Einschränkungen und Stichtagen;
- Kalender, Ressourcen und Zuweisungen, einschließlich der Kurven;
- Baselines, Aktivitätscodes, benutzerdefinierte Felder und Notizen;
- externe Beziehungen zu anderen Projekten;
- die Projekteinstellungen, zum Beispiel das Statusdatum, das Berechnungsprofil und die Berechnungsoptionen;
- die Verknüpfung mit einer Ressourcenbibliothek.

Was Sie auf dem Bildschirm einstellen, gehört nicht zum Projekt und geht nicht mit: Zoom, Scrollposition, der ausgewählte Vorgang und eingeklappte Phasen. Ihre App-Einstellungen, zum Beispiel Sprache und Design, stehen ebenfalls nicht in der Datei. Die App bewahrt diese selbst auf, in der App oder in Ihrem Browser.

Ein Export in ein anderes Format ändert Ihr Projekt nicht. Nach einem Export hat das Projekt weiterhin dasselbe Speicherziel. War es vorher als *Nicht gespeichert* markiert, bleibt es so markiert.

### Was ein Export verliert

Jeder Adapter übernimmt, was sein Format kennt.

**MS Project XML** übernimmt Vorgänge, Beziehungen, Kalender, Ressourcen, Zuweisungen, Einschränkungen, Stichtage und das Statusdatum. Von Ihren Baselines geht nur die aktive mit. Aktivitätscodes, benutzerdefinierte Felder, Notizen und externe Beziehungen gehen nicht mit. Eine zweite Einschränkung an einem Vorgang geht nicht mit. Eine Einschränkung *Muss anfangen am (MSO)* oder *Muss enden am (MFO)* ohne die Option *Verbindlich (Pin-Logik)* kommt als *Anfang nicht früher als (SNET)* oder *Ende nicht früher als (FNET)* zurück. *Manuell geplant* und die *Abgleichsverzögerung* eines Vorgangs kommen nicht zurück. Eine Hammock wird zu einem normalen Vorgang mit berechneten Terminen.

**Primavera P6 XML** übernimmt Vorgänge, Beziehungen, Kalender, Ressourcen, Zuweisungen, Einschränkungen und das Statusdatum. Baselines und Stichtage gehen nicht mit, ebenso wenig Aktivitätscodes, benutzerdefinierte Felder, Notizen und externe Beziehungen. Auch hier wird eine Hammock zu einem normalen Vorgang. P6 kennt keinen Zeitabstand in Prozent: Die App rechnet einen solchen Zeitabstand in eine feste Anzahl Tage um. Ein Zeitabstand in Kalendertagen wird zu einem Zeitabstand in Arbeitstagen.

**CSV** ist eine Vorgangsliste. Die Datei hat für jeden Vorgang diese Spalten: task id, WBS, level, name, duration, start, finish, predecessors, work category, die ID einer benutzerdefinierten Arbeitskategorie (`OPS Custom Task Type ID`), status, completion, actual start und actual finish, critical, total float und description. Ressourcen, Zuweisungen, Kalender, Einschränkungen, Stichtage, Baselines und das Statusdatum stehen nicht darin. Die Spaltenüberschriften sind immer auf Englisch.

**Nur IFC enthält das Berechnungsprofil und die Berechnungsoptionen.** Wenn Sie nach CSV, MS Project XML oder Primavera P6 XML exportieren, steht das Profil nicht in der Datei. Von den Berechnungsoptionen schreibt MS Project XML höchstens die kritische Schwelle. Eine solche Datei öffnet sich wieder als *Open Planner Studio*. Hat Ihr Projekt mit *Primavera P6* oder *Microsoft Project* gerechnet, zum Beispiel weil es aus einer `.xer`- oder `.mpp`-Datei stammt, können sich die Termine dadurch verschieben. Was ein Berechnungsprofil ist, erklärt [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen).

Stammt Ihr Projekt aus einer Primavera-Datei (`.xer`), meldet die App nach einem Export nach CSV, MS Project XML oder P6 XML auch dann, wenn Sie zwischendurch als IFC gespeichert haben: *Beim Export nach CSV gehen XER-Quellinformationen verloren.* Bei MS Project XML steht dort *MSPDI* statt *CSV*, bei P6 XML steht dort *P6*. Bei IFC bekommen Sie diese Meldung nicht. Die IFC-Datei nimmt die Quelldatei von Primavera mit. Siehe [Eine Primavera P6 Datei (.xer) öffnen](docs://howto-xer-openen).

Die App macht bei einem Export noch zwei Dinge. Ist der Terminplan veraltet, wird er zuerst neu berechnet und danach exportiert. Und sie exportiert keinen Terminplan mit einem Zirkelbezug. Sie erhalten dann eine Meldung mit der Schleife, zum Beispiel *Zirkelbezug zwischen Vorgängen: Set up site → Demolish existing extension → Set up site*.

### Speichern, AutoSave und Wiederherstellung nach einem Absturz

Das sind drei verschiedene Dinge. Sie sehen ähnlich aus, schreiben aber an verschiedene Orte.

**Speichern** tun Sie selbst. Die App schreibt Ihr Projekt in Ihre Datei und entfernt die Markierung *Nicht gespeichert*.

**AutoSave** ist standardmäßig ausgeschaltet. Sie schalten es für jedes Projekt selbst ein. Die App schreibt dann ohne Fenster in dieselbe Datei, sobald es Änderungen gibt, höchstens einmal alle zehn Sekunden. Das funktioniert nur, wenn das Projekt schon eine Datei hat. Siehe [AutoSave einschalten](docs://howto-automatisch-opslaan).

**Wiederherstellung nach einem Absturz** ist immer aktiv. Sobald irgendwo etwas geändert wird, legt die App ebenfalls höchstens einmal alle zehn Sekunden eine Sicherungskopie aller offenen Projekte an, auch von Projekten, die Sie selbst nicht geändert haben. Diese Kopie steht nicht in Ihrer Projektdatei. In der Desktop-App liegt sie im Datenordner der App, im Browser im Speicher des Browsers. Beim nächsten Start bietet die App diese Kopie an. Mehr darüber lesen Sie unter [Nach einem Absturz wiederherstellen](docs://howto-herstellen-na-een-crash). Die Wiederherstellung nach einem Absturz schreibt nie in Ihre Projektdatei.

Weil eine Kopie höchstens einmal alle zehn Sekunden entsteht, können bei einem Absturz die Änderungen der letzten Sekunden verloren gehen.

### Desktop und Browser

Die Desktop-App und die Browserversion machen mit Ihrem Projekt dasselbe. Sie schreiben Dateien aber auf unterschiedliche Weise.

Auf dem Desktop arbeitet die App mit echten Pfaden. *Speichern* schreibt direkt in Ihre Datei. Meist schreibt die App zuerst in eine temporäre Datei daneben (`.ops-save.tmp`) und ersetzt erst danach Ihre Datei. So schneidet ein Absturz mitten im Schreiben Ihre alte Datei nicht ab. Schließen Sie die App mit ungespeicherten Änderungen, fragt sie bei jedem Projekt, ob Sie speichern möchten. Bei einem ordnungsgemäßen Beenden löscht sie ihre Sicherungskopien.

In einem Browser, der Dateien überall ablegen kann (zum Beispiel Chrome und Edge), erhalten Sie ein normales Fenster zum Öffnen und Speichern. Danach schreibt *Speichern* direkt in die Datei. Bei einer Datei, die Sie geöffnet haben, fragt der Browser einmal um Erlaubnis. Die Liste *Zuletzt verwendet* funktioniert und zeigt nur die Dateinamen.

In einem Browser ohne diese Möglichkeit (zum Beispiel Firefox) öffnet die App eine Datei über den Dateiauswähler und speichert über einen Download. Bei *Speichern* erklärt die Meldung *Als Download gespeichert: 'name.ifc' liegt in Ihrem Download-Ordner. …* das einmal pro Sitzung. Bei *Speichern unter* und bei Exporten sehen Sie *Als Download gespeichert: 'name.ifc' liegt jetzt in Ihrem Download-Ordner. Diese Umgebung erlaubt der App nicht, direkt an den gewählten Ort zu schreiben.* Kann der Browser ein Speicherfenster zeigen, aber nicht zurück in die Datei des Projekts schreiben, fragt *Speichern* jedes Mal erneut nach einem Ort. Eine Meldung erklärt auch das einmal pro Sitzung. *Datei › Zuletzt verwendet* ist vorhanden, öffnet aber eine leere Seite, und AutoSave ist nicht verfügbar. Dieselbe Meldung sehen Sie in jeder Umgebung, die der App nicht erlaubt, an den gewählten Ort zu schreiben.

## Beispiel: Export des Beispielprojekts

Öffnen Sie das Beispiel *Refurbishment & Extension of a Family Home* (*Datei › Beispiele*). Es hat 20 Vorgänge, davon 4 Phasen und 2 Meilensteine, und 16 Beziehungen. Es gibt 6 Ressourcen mit 8 Zuweisungen, 1 Baseline und eine Verknüpfung mit der *Demo resource library*. Der Vorgang *Demolish existing extension* hat die Einschränkung *Anfang nicht früher als (SNET)* am 14. Mai 2027, und *Handover inspection* hat einen Stichtag am 29. Juli 2027. Der Terminplan endet am 7. Juli 2027.

So kommt das Projekt aus jedem Format zurück, gemessen, nachdem die Exportdatei wieder geöffnet wurde:

- Die IFC-Datei gibt alles zurück: 20 Vorgänge, 16 Beziehungen, 6 Ressourcen, 8 Zuweisungen, die Baseline, die Einschränkung, den Stichtag und die Bibliotheksverknüpfung. Der Terminplan endet wieder am 7. Juli 2027.
- Die MS Project XML-Datei gibt ebenfalls alles zurück, außer der Bibliotheksverknüpfung. Der Terminplan endet am 7. Juli 2027.
- Die P6-XML-Datei gibt die Vorgänge, Beziehungen, Ressourcen, Zuweisungen und die Einschränkung zurück. Die Baseline und der Stichtag fehlen. Der Terminplan endet noch immer am 7. Juli 2027, weil die Einschränkung noch darin steht.
- Die CSV-Datei gibt 20 Vorgänge und 16 Beziehungen zurück. Ressourcen, Zuweisungen, Baseline, Einschränkung und Stichtag fehlen. Das Projekt heißt *CSV Import*. Ohne die Einschränkung rücken die Vorgänge nach vorne: Der Terminplan endet am 2. Juli 2027, fünf Kalendertage früher.

Ohne diese Einschränkung endet das Beispiel selbst ebenfalls am 2. Juli 2027. Der Unterschied kommt also von der Einschränkung, die die CSV-Datei nicht mitnimmt.

## Folgen und Missverständnisse

**Ein Export ist kein Backup.** Nur IFC behält alles. Wenn Sie Ihr Projekt behalten wollen, speichern Sie es als IFC. Exportieren Sie nur für jemanden, der das andere Format braucht.

**Das erneute Öffnen eines Exports ergibt nicht immer denselben Terminplan.** Beim Öffnen wird immer neu berechnet, mit dem Berechnungsprofil, das zum Format gehört. Fehlt Logik, wie die Einschränkung im CSV-Beispiel, oder rechnet das Profil anders, dann ändert sich das Ergebnis.

**Ein Export steht auch in Zuletzt verwendet.** Auf dem Desktop und in Browsern mit Dateizugriff landet ein Export in *Zuletzt verwendet*, genau wie ein gespeichertes Projekt (die Fortschrittsblätter nicht). Öffnen Sie ihn dort, dann öffnet er sich als Import dieses Formats.

**Speichern ist nicht dasselbe wie Wiederherstellung nach einem Absturz.** Die Wiederherstellung hilft nach einem Absturz, ersetzt aber das Speichern nicht. Speichern Sie deshalb, bevor Sie eine Registerkarte oder die App schließen.

## Siehe auch

- [Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan): die Schritte für Öffnen, Speichern und Speichern unter.
- [Exportieren](docs://howto-exporteren): ein Format wählen und das Ergebnis.
- [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen): warum ein importierter Terminplan andere Termine zeigen kann.
- [Einschränkungen und Stichtage](docs://uitleg-constraints): was eine Einschränkung bewirkt und was also verschwindet, wenn sie fehlt.
- [Beziehungen und Zeitabstand](docs://uitleg-relaties): was ein Zeitabstand ist und wie die App ihn berechnet.
- [Eine Hammock erstellen](docs://howto-hammock): was eine Hammock ist, die ein Export als normalen Vorgang schreibt.
- [Codes und benutzerdefinierte Felder](docs://howto-codes-en-velden): Aktivitätscodes und benutzerdefinierte Felder, die nur IFC behält.
- [Externe Beziehungen zu einem anderen Projekt](docs://howto-externe-relaties): Verknüpfungen, die MS Project XML und P6 XML nicht mitnehmen.
- [Eine Baseline speichern und verwalten](docs://howto-baseline-opslaan-en-beheren): Baselines, von denen MS Project XML nur die aktive mitnimmt.
- [Import- und Exportformate](docs://ref-import-exportformaten): pro Format, was übernommen wird und was nicht.
