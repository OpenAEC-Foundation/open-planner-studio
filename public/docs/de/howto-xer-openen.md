# Eine Primavera-P6-Datei (.xer) öffnen

Ziel: einen Terminplan aus Primavera P6 direkt in der App öffnen, ohne ihn vorher nach XML zu exportieren.

## Wann Sie dies brauchen

Ein Auftraggeber oder Hauptunternehmer arbeitet in Primavera und liefert seinen Terminplan als `.xer`-Datei. Sie möchten ihn ansehen, berechnen oder ergänzen. Die App liest nur `.xer`-Dateien: Sie schreibt keine `.xer`-Datei und ändert Ihre Datei nie. Aus der Datei übernimmt sie die PSP-Struktur und die Vorgänge mit Dauer, Terminen, Einschränkungen und Fortschritt, die Beziehungen mit Zeitabstand, die Kalender und die Ressourcen mit ihren Zuweisungen, außerdem Aktivitätscodes, benutzerdefinierte Felder (UDFs), Notizen und die Terminplaneinstellungen von P6. Ein Vorgang vom Typ *Level of Effort* wird ein Hammock.

## Schritte

1. Wählen Sie *Start › Datei › Öffnen* oder drücken Sie Strg+O. Wählen Sie die Datei `.xer`.
2. Die App öffnet für jedes Projekt mit Vorgängen eine eigene Registerkarte. Das Projekt mit den meisten Vorgängen ist die aktive Registerkarte. Eine Registerkarte heißt *Projektname (Projekt-ID)*, wenn sich die P6-Projekt-ID vom Namen unterscheidet. *Projekteinstellungen* zeigt nur den Namen. Wenn Sie das Projekt umbenennen, bleibt die Projekt-ID dahinter stehen. Danach erklärt ein Fenster kurz, was die App aus der Datei übernommen hat und wie das Speichern funktioniert. Siehe [Öffnen und Speichern einer Datei](docs://howto-bestand-openen-en-opslaan).
3. Lesen Sie die Meldung unten. Bei einer Datei mit drei Projekten kann sie so aussehen: *XER-Datei geöffnet: 3 Projektdokumente.* Darunter stehen Zeilen, die erklären, was die App getan hat. Siehe die Überschrift unten.
4. Prüfen Sie, ob unter dem Menüband eine Leiste steht: *Sie sehen den Terminplan so, wie Primavera ihn gespeichert hat; eine Neuberechnung würde 1 Vorgang verschieben.* Primavera speichert eigene berechnete Termine in der Datei. Weicht die Berechnung der App davon ab, zeigt die App die Termine von Primavera, solange Sie nichts ändern. Ein Vorgang, der begonnen hat oder abgeschlossen ist, liegt immer auf seinen Ist-Werten, wie in Primavera. Was das bedeutet und wie Sie zur eigenen Berechnung der App wechseln, steht unter [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen). Die Meldung *Diese Datei enthält stundenbasierte Planung.* kann auch erscheinen, mit der Schaltfläche *Stundenplanung aktivieren*. Siehe [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten).
5. Speichern Sie Ihr Projekt mit Strg+S. Weil eine `.xer`-Datei nie überschrieben wird, fragt die App, wo die neue IFC-Datei gespeichert werden soll. Die App schlägt *Projektname (Projekt-ID)* als Dateinamen vor.

### Die Zeilen unter der Meldung

Die erste Zeile der Meldung nennt die Anzahl der geöffneten Registerkarten. Darunter stehen nur die Zeilen, die zutreffen. Diese Zeilen verdienen Ihre Aufmerksamkeit:

- *Dieses Projekt rechnet als Primavera P6. Ändern über Datei → Projektinfo → Berechnungsprofil und Berechnungsoptionen.* Die App rechnet dieses Projekt mit den Berechnungsregeln von Primavera. Mit *Berechnungsprofil öffnen* gelangen Sie zur Einstellung.
- *1 Baseline-Projekt ausgeschlossen.* und *1 Baseline materialisiert.* Wenn ein Projekt in P6 ein anderes Projekt als seine Baseline festlegt, wird dieses andere Projekt nicht als eigene Registerkarte geöffnet. Es wird die aktive Baseline des Projekts, das darauf verweist.
- *Ein schützender Baseline-Rückfall wurde verwendet.* Wenn das Festlegen von Baselines bedeuten würde, dass kein Projekt geöffnet wird, wenn ein Projekt auf sich selbst verweist oder wenn Projekte in einer Schleife aufeinander verweisen, öffnet die App einfach alle Projekte und legt keine Baselines an.
- *1 externe Beziehung beibehalten.* Eine Beziehung zwischen zwei Projekten. Die App behält sie als Quelldaten, macht sie aber nicht zu einer Beziehung in Ihrem Terminplan.
- *12 Vorgänge zeigen die von Primavera gespeicherten Termine (nicht neu berechnet).* Die Anzahl der Vorgänge, für die die Ansicht *Termine wie gespeichert* Termine von Primavera zeigt: jeder Vorgang, für den die Datei Termine gespeichert hat, nicht nur die, die abweichen.

Die übrigen Zeilen sind Diagnosen des Einlesens selbst. Diese Zeilen verlangen nichts von Ihnen:

- die Anzahl gefundener Projekte;
- ein übersprungenes leeres Projekt;
- eine ignorierte verwaiste Baseline-Verweisung;
- eine andere Textcodierung als reines UTF-8 (die Meldung nennt welche: bei arabischem, kyrillischem oder griechischem Text wählt die App die passende Windows-Codepage, sonst Windows-1252);
- Vorgänge ohne geplanten Start (sie beginnen am Statusdatum oder am Projektstart aus der Datei);
- Zähler für Befunde in den Tabellen, den Kalendern und den Zahlen, für unbekannte Feldwerte und für P6-Planungseinstellungen, die die App durch eine sichere Wahl ersetzt hat.

*Mehr erfahren* öffnet die Hilfe zum Öffnen von Primavera-Dateien.

## Fallstricke und was die App dann tut

**Nicht alles wird zu einer Registerkarte oder Beziehung.** Ein Projekt ohne Vorgänge wird nicht geöffnet, ein Baseline-Projekt wird nicht als eigene Registerkarte geöffnet und eine Beziehung zwischen zwei Projekten wird nicht zu einer Beziehung in Ihrem Terminplan. Die App meldet das in den Zeilen unter der Meldung.

**Jede Registerkarte ist ein eigenes Projekt.** Wenn Sie eine speichern, behält die IFC-Datei die vollständige ursprüngliche `.xer`-Datei bei. Öffnen Sie diese IFC-Datei später erneut, kennt die App weiterhin die Termine von Primavera. Ist das Quellarchiv beschädigt oder hat ein anderes IFC-Programm die Datei umgeschrieben, meldet die App: *Das XER-Quellarchiv in dieser Datei ist unbrauchbar und wurde weggelassen; das Projekt selbst wurde vollständig geöffnet.* Der Terminplan, das Berechnungsprofil und alle Projektdaten sind vollständig. Es fehlen: die Termine, wie Primavera sie gespeichert hat, und die Herkunftsangaben der Quelle für KI und Erweiterungen. Öffnen Sie die ursprüngliche `.xer`-Datei erneut, um das Archiv wiederherzustellen.

**Die IFC-Datei wird größer.** Weil die IFC-Datei die ganze ursprüngliche `.xer`-Datei enthält, ist sie größer als eine IFC-Datei ohne Archiv. Bei einer großen `.xer`-Datei merken Sie das an der Dateigröße und an der Zeit, die das Speichern dauert. Wenn eine `.xer`-Datei mehrere Projekte öffnet, enthält jede Registerkarte, die Sie speichern, die ganze `.xer`-Datei, nicht nur das eigene Projekt.

**Ein Export nach CSV, MS Project XML oder P6 XML verliert Daten.** Die App warnt: *Beim Export nach CSV gehen XER-Quellinformationen verloren.* IFC verliert nichts.

**Ein freier Samstag oder Sonntag, der nicht in der Datei steht.** Die App kann einen solchen Wochenendtag selbst als frei festlegen. Der Tag heißt dann *Kalenderausnahme (Wochenend-Rekonstruktion)* im Kalender. Das Muster steht unter [Import- und Exportformate](docs://ref-import-exportformaten).

**Puffer bis zum Projektende, ohne Enddatum.** Hat die Datei kein Enddatum, schaltet die App die Option *Puffer bis zum Projektendtermin berechnen* aus. Das zählt in der Zeile *N P6-Planungseinstellungen mit sicherem Rückfall.* Details stehen unter [Import- und Exportformate](docs://ref-import-exportformaten).

**Abgeschlossene Vorgänge am Statusdatum.** Ein abgeschlossener Vorgang kann in der Ansicht *Termine wie gespeichert* als schmaler Balken am Statusdatum erscheinen. Das ist kein Fehler in Ihrer Datei. Die Erklärung und die zugehörige Konvention stehen unter [Import- und Exportformate](docs://ref-import-exportformaten).

**Zahlen mit Komma als Dezimaltrennzeichen.** Wenn die App das Dezimaltrennzeichen nicht zuverlässig bestimmen kann, öffnet sie die Datei nicht. So öffnet sich nie ein Terminplan mit falsch gelesenen Zahlen. Bitten Sie den Absender um einen neuen Export.

**Eine Datei, die die App nicht lesen kann.** Sie erhalten eine Fehlermeldung mit dem Grund. Einige Beispiele:

- *Dies ist keine gültige oder unterstützte XER-Datei.*
- *In einer XER-Tabelle fehlen erforderliche Spalten.*
- *Das P6-Projekt in dieser XER-Datei enthält keine Aktivitäten.*
- *Die Dezimalschreibweise dieser XER-Datei kann nicht zuverlässig bestimmt werden.*

Dann wird nichts geöffnet. Prüfen Sie die Datei in P6 oder bitten Sie den Absender um einen neuen Export.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): warum eine `.xer`-Datei nur gelesen wird und was ein Export verliert.
- [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen): die Ansicht mit den eigenen Terminen von Primavera.
- [Eine MS-Project-Datei (.mpp) öffnen](docs://howto-mpp-openen): dasselbe für MS Project.
- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): wenn die Datei Daten in Stunden enthält.
- [Import- und Exportformate](docs://ref-import-exportformaten): je Format, was übernommen wird und was nicht.
- [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen): warum eine P6-Datei mit einem eigenen Berechnungsprofil geöffnet wird.
