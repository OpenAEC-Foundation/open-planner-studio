# Im-/Export

Open Planner Studio speichert ein Projekt standardmäßig als IFC — keine separate Projektdatei daneben. Manchmal muss ein Terminplan aber auch außerhalb der App leben: in Primavera P6, in Microsoft Project oder als flache Tabelle für eine Tabellenkalkulation. Diese Anleitung erklärt, was das native IFC-Format genau bedeutet, was jedes Exportformat mitnimmt und was nicht, und wo Import/Export in der App zu finden ist.

## Was Sie hier lernen

- Was „IFC ist das native Format" für Öffnen und Speichern genau bedeutet.
- Was beim Export nach MS Project (MSPDI) und Primavera P6 XML mitkommt und was nicht.
- Was der CSV-Export enthält — und was bewusst weggelassen wird.
- Wo importiert und exportiert wird: **Backstage → Exportieren** und **Backstage → Importieren**.
- Wie Erweiterungen zusätzliche Importformate hinzufügen können.

## IFC: das native Format

Ein Open-Planner-Studio-Projekt *ist* eine IFC-4x3-Datei (der buildingSMART-Standard). Es gibt keine separate JSON- oder Projektdatei daneben: **Speichern** und **Öffnen** (Backstage oder **Ctrl+S**/**Ctrl+O**) lesen und schreiben direkt IFC. Das bedeutet, dass alles, was Sie in der App tun — Aufgaben, WBS, Beziehungen mit Einschränkungen, Ressourcen und Zuweisungen, Kalender (sowohl der Projektkalender als auch Ressourcenkalender), Baselines, Fortschritt, Notizen, Aufgabencodes und benutzerdefinierte Felder, externe Verknüpfungen zwischen Projekten — in derselben Datei landet und beim nächsten **Öffnen** vollständig zurückkommt. Wenn Sie in der App auf eine neue Art Projektdaten stoßen, können Sie annehmen, dass sie über IFC rundgeht; wenn etwas *nicht* rundgeht, wird unten ausdrücklich darauf hingewiesen.

IFC ist zudem die Art, wie diese App sich mit dem restlichen OpenAEC-Toolkit verbindet: Dieselbe Datei kann von BIM-Software für die 4D-Verknüpfung (Terminplan neben dem Gebäudemodell) gelesen werden.

## In andere Formate exportieren

Öffnen Sie **Backstage → Exportieren** für vier Formate:

- **CSV (semikolon-getrennt)** — universeller Tabellenexport. Alle Aufgaben mit Terminen und Dauern.
- **MS Project XML** — öffnet in Microsoft Project. Vollständige WBS-Struktur.
- **Primavera P6 XML** — für Oracle Primavera P6.
- **IFC 4x3** — der buildingSMART-Standard, derselbe wie das native Format (praktisch als „Speichern unter" in eine separate Datei oder um eine Kopie zu teilen, ohne die restlichen offenen Dokumente zu berühren).

Jedes Format hat seine eigenen Einschränkungen: Je reicher das Zielformat, desto mehr kommt mit, aber keines der drei externen Formate ist ein vollständiges Abbild von IFC.

### CSV

Der CSV-Export enthält **nur die Aufgabentabelle**: WBS-Code, Name, Dauer (Tage), Anfang, Ende, Vorgänger (als Textcode, z.B. `2.1FS+3d`), Aufgabentyp, Status, Fortschritt (%), Ist-Anfang/-Ende, Kritisch (ja/nein), Gesamtpuffer und Beschreibung. **Ressourcen, Zuweisungen, Kalender und Baselines werden bewusst weggelassen** — CSV ist rein eine Aufgabentabelle für alle, die den Terminplan in einer Tabellenkalkulation ansehen oder bearbeiten möchten, kein voll-treuer Projektaustausch. Wenn Sie eine CSV-Datei wieder **importieren**, bleiben Baselines daher leer (es gab nichts, aus dem sie gelesen werden könnten).

### MS Project XML (MSPDI)

MSPDI ist deutlich reicher als CSV: Ressourcen, Zuweisungen (inklusive ihrer Belastungskurve), Kalender und Baselines kommen mit. Dennoch ist nicht alles in MSPDI ausdrückbar. Beim Export warnt die App in der Entwicklerkonsole (`console.warn`), sobald etwas verloren geht, mit der genauen Anzahl betroffener Elemente:

- **Externe Verknüpfungen** zwischen Projekten werden fallengelassen (die „Geister"-Referenz der anderen Aufgabe bleibt nur in der App).
- **Weiche Muss-Anfang/Muss-Ende-Einschränkungen** (weiche `MSO`/`MFO`) werden zu SNET/FNET herabgestuft — MSPDI codiert 2/3 als *hart* (Muss), sodass die obere Grenze der weichen Variante verloren geht. Harte `MSO`/`MFO` exportieren exakt.
- **Sekundäre Einschränkungen** gehen verloren — MSPDI hat nur ein Einschränkungsfeld pro Aufgabe.
- **Hammock-Aufgaben** (abgeleitete Dauer) werden als einfache Aufgabe mit den berechneten Terminen exportiert — MSPDI hat keinen nativen Hammock-/LOE-Typ.
- **Aufgaben-Notizen** werden bewusst **nicht** exportiert, obwohl MSPDI ein Feld `<Notes>` hat: Unsere Notizen sind ein Kontrollkästchen-Checklisten-Form, das sich nicht sauber in reinen Text übersetzen lässt.
- Die **Kritisch-Pfad-Definition** (Beinahe-kritisch-Modus/Schwelle) und weitere Terminplanungsoptionen sind in MSPDI nicht nativ ausdrückbar und gehen daher verloren — diese werden nur über IFC bewahrt.

### Primavera P6 XML

Dieselbe Art Abwägung wie bei MSPDI, mit ein paar P6-spezifischen Besonderheiten:

- **Externe Verknüpfungen** und **Hammock-Aufgaben** werden genauso fallengelassen/vereinfacht wie bei MSPDI, jeweils mit einer Warnung.
- **Aufgaben-Notizen** werden auch hier weggelassen — P6 XML hat kein geeignetes Feld dafür.
- **Prozentuale Verzögerung** bei einer Beziehung (z.B. 40 % der Vorgängerdauer) wird in eine feste Anzahl Tage „eingebrannt", weil P6 kein Konzept für prozentuale Verzögerung hat.
- **Kalendertag-Verzögerung** (Verzögerung in abgelaufenen Tagen statt Arbeitstagen) wird als einfache stundenbasierte Verzögerung exportiert — P6 hat keine separate Verzögerungseinheit pro Beziehung.
- Die Belastungskurve **LATE_PEAK** hat kein P6-Äquivalent und wird als nächstliegende Annäherung exportiert („Early Peak" / Frühe Spitze).
- Terminplanungsoptionen (wie bei MSPDI) werden nicht exportiert.

Diese Warnungen sind keine Schlamperei — sie sind eine bewusste, ausdrückliche Entscheidung: eine sichtbare Warnung pro fallengelassenem Element schlägt stillen Datenverlust. Öffnen Sie beispielsweise den Showcase [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (er hat Aufgaben-Notizen und eine Beziehung mit prozentualer Verzögerung) und exportieren Sie nach P6 oder MS Project XML: Die Entwicklerkonsole zeigt dann genau, welche Elemente fallengelassen oder vereinfacht wurden, und wie viele.

## Importieren

**Datei → Öffnen** (oder **Backstage → Öffnen**) akzeptiert `.ifc`-, `.csv`- und `.xml`-Dateien. Bei einer `.xml`-Datei erkennt die App selbst, ob es sich um eine Primavera-P6- oder eine MS-Project-Datei handelt, anhand des Inhalts. Wie oben beschrieben: Ein CSV- oder P6-Import erzeugt ein Projekt **ohne Baselines** (im Quelldokument gab es keine), während IFC und MSPDI Baselines mitbringen.

## Erweiterungs-Importer

Über die festen Formate hinaus können installierte Erweiterungen eigene Importer hinzufügen — zum Beispiel für ein Format, das standardmäßig nicht unterstützt wird. Diese erscheinen unter **Backstage → Importieren**, jeweils mit eigenem Namen, Beschreibung und passenden Dateierweiterungen; ohne installierte Import-Erweiterungen ist dieser Abschnitt leer. Prüfen Sie **Backstage → Erweiterungen**, um zu sehen, was verfügbar ist.

## Weiterlesen

- Baselines kommen nur über IFC und MS Project XML mit, nicht über CSV oder P6 — lesen Sie die Anleitung [Baselines & Fortschritt](docs://gids-baselines-voortgang), wie Sie eine Baseline erfassen.
- Ressourcen, Zuweisungen und Belastungskurven — lesen Sie die Anleitung [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram), wie diese aufgebaut werden, bevor Sie exportieren.
