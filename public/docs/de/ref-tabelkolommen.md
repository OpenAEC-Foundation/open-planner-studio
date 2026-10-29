# Tabellenspalten

Die Vorgangstabelle hat 86 feste Spalten, dazu je eine Spalte pro Aktivitätscode und benutzerdefiniertem Feld des Projekts und acht Spalten je Baseline. Dieser Artikel sagt für jede Spalte, was sie zeigt, ob Sie sie bearbeiten können und in welcher Form der Wert geschrieben wird. Wie Sie Spalten auswählen und anordnen, steht unter [Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen).

## Wo Sie Spalten auswählen

Die Vorgangstabelle neben dem Gantt und die Tabelle auf der Registerkarte *Tabelle* haben jeweils eine eigene Spaltenauswahl. Das Pluszeichen rechts in der Kopfzeile öffnet die Spaltenauswahl (Fenstertitel *Spalte auswählen*). Auf der Registerkarte *Tabelle* können Sie auch *Tabelle › Spalten › Spalten…* verwenden. Die Auswahl zeigt die Spalten je Kategorie: *Vorgang*, *Planung*, *Einschränkungen*, *Beziehungen*, *Ressourcen*, *Fortschritt*, *Berechnet*, *Baseline*, *Benutzerdefiniert* und *Technisch*. Sie suchen nach Name, und *Zuletzt verwendet* steht oben. *Auf Standard zurücksetzen* stellt die Standardspalten wieder her.

Standardmäßig zeigt die Vorgangstabelle neben dem Gantt *PSP*, *Vorgangsname* und *Dauer*. Die Tabelle auf der Registerkarte *Tabelle* zeigt *PSP*, *Vorgangsname*, *Dauer*, *Anfang*, *Ende*, *Arbeitskategorie*, *Kritisch*, *Gesamtpuffer* und *Fortschritt*, dazu je eine Spalte pro Aktivitätscode und benutzerdefiniertem Feld des Projekts.

## Wie Werte gelesen und bearbeitet werden

- **Berechnete Spalten** — die Spalten in der Kategorie *Berechnet* und einige andere sind schreibgeschützt: Sie kommen aus der Berechnung. Wenn Sie versuchen, eine schreibgeschützte Zelle zu bearbeiten, zeigt die App *Diese berechnete Spalte kann nicht bearbeitet werden.* Dieser Text ist die allgemeine Meldung für jede schreibgeschützte Zelle, auch wenn die Spalte nicht berechnet wird. Wenn Werte veraltet sind, weil Sie etwas geändert haben, erscheint *veraltet* neben ihnen, bis Sie *Berechnen* drücken.
- **Datumsangaben** — erscheinen in der Schreibweise, die Sie unter *App-Einstellungen*, Registerkarte *Darstellung*, Abschnitt *Datumsformat* gewählt haben.
- **Dauern und Puffer** — eine Dauer erscheint in der Einheit des Vorgangs (`5d`, `12h`), oder nach *Daueranzeige* auf derselben Registerkarte (*Automatisch (eigene Einheit je Vorgang)*, *Immer Tage* oder *Immer Stunden*). Der Puffer erscheint in Arbeitstagen mit zwei Dezimalstellen und dem Dezimaltrennzeichen Ihrer Sprache.
- **Ja/Nein** — ein Ja/Nein-Wert erscheint als *Ja* oder *Nein*; ein leerer Wert als Strich (—).
- **Bearbeiten** — geben Sie einen Wert ein oder wählen Sie einen aus. Ein ungültiger Wert wird mit einem Grund unter der Zelle abgelehnt, zum Beispiel *Geben Sie eine gültige Dauer ein, z. B. 5d oder 8h.* oder *Geben Sie einen Prozentsatz zwischen 0 und 100 ein.* Das Einfügen eines Zellblocks funktioniert Zelle für Zelle; schreibgeschützte Zellen werden übersprungen, und die App meldet, wie viele es sind.

## Vorgang

- **Vorgangsname** — der Name des Vorgangs. Bearbeitbar; Pflichtfeld. Ein Sammelvorgang erscheint fett, mit einem leicht getönten Hintergrund in der Namenszelle. Ein Meilenstein erscheint fett in der Meilensteinfarbe (dieselbe Farbfamilie wie der Meilenstein im Gantt). Ein gewöhnlicher Vorgang bleibt unverändert. Das ist nur Formatierung: Auswählen, Ziehen und Bearbeiten funktionieren gleich.
- **Beschreibung** — die Beschreibung. Bearbeitbar; Freitext.
- **PSP** — der PSP-Code. Bearbeitbar und Pflichtfeld, aber schreibgeschützt, solange *PSP auto* aktiviert ist.
- **Arbeitskategorie** — die Arbeitskategorie (*Bau*, *Installation*, *Abbruch*, *Logistik*, *Prüfung*, *Umzug*, *Renovierung*, *Wartung* oder *Sonstiges*). Bearbeitbar mit einer Liste.
- **Benutzerdefinierte Arbeitskategorie** — die benutzerdefinierte Arbeitskategorie aus dem Projekt oder ein Strich. Bearbeitbar mit einer Liste der benutzerdefinierten Arbeitskategorien des Projekts.
- **Farbe** — die gespeicherte Farbe des Vorgangs als Farbcode, zum Beispiel `#1a73e8`. Bearbeitbar mit einer Farbauswahl. Sie wird in der IFC-Datei gespeichert, aber kein Balken und kein Bericht verwendet sie; Balkenfarben stellen Sie unter *Ansicht › Baselines & Fortschritt › Balkenfarben* ein.
- **Notizen** — die Notizen als `✓ text; ○ text`. Bearbeitbar, solange es höchstens eine Notiz gibt (dann bearbeiten Sie deren Text); bei mehr Notizen schreibgeschützt.

## Planung

- **Meilenstein** — ob der Vorgang ein Meilenstein ist. Bearbeitbar. Wenn Sie ihn einschalten, wird die Dauer 0; die App lehnt das für einen Sammelvorgang und für einen Vorgang mit Zuweisungen ab.
- **Meilensteinart** — *Anfangsmeilenstein* oder *Endmeilenstein* oder ein Strich für automatisch. Nur bei einem Meilenstein bearbeitbar.
- **Verbindlicher Meilenstein** — die Markierung *Verbindlich (vertraglich)*. Nur bei einem Meilenstein bearbeitbar.
- **Abgleichspriorität** — eine ganze Zahl von 0 bis 1000, Standard 500. Bearbeitbar. 1000 fixiert den Vorgang für den Kapazitätsabgleich.
- **Unterbrechungen** — die Anzahl der Unterbrechungen, als `Split gaps: 2`, oder ein Strich. Schreibgeschützt; Sie bearbeiten sie im Bereich *Eigenschaften*.
- **Vorgangsart** — die Vorgangsart des Vorgangs; leer bedeutet die Standardeinstellung des Projekts. Bearbeitbar mit einer Liste, bei einem Meilenstein, Sammelvorgang oder Hammock aber leer und schreibgeschützt. Nur in der Auswahl sichtbar, wenn die Vorgangsarten sichtbar sind (*Vorgangsarten verwenden*, oder die Datei enthält Vorgangsarten).
- **Hammock (abgeleitete Dauer)** — ob der Vorgang ein Hammock ist. Bearbeitbar, außer bei einem Meilenstein oder Sammelvorgang.
- **Kalender** — die ID des eigenen Kalenders des Vorgangs; leer (—) bedeutet der Projektkalender. Sie geben eine ID ein oder wählen eine aus den Vorschlägen; eine unbekannte ID wird abgelehnt. Hinweis: Die Zelle zeigt zurzeit die interne ID statt des Namens. Wählen Sie besser einen Kalender im Bereich *Eigenschaften*.
- **Dauerart** — *Arbeitszeit* (die Dauer zählt in Arbeitstagen oder Arbeitsstunden des Kalenders) oder *Verstrichene Zeit* (die Dauer zählt in durchgehender Uhrzeit, ohne Kalender). Bearbeitbar.
- **Dauereinheit** — *Tage* oder *Stunden*. Bearbeitbar, außer bei einem Sammelvorgang, Hammock oder Meilenstein; das Umschalten funktioniert nur, wenn die Umrechnung exakt ist und *Stundenplanung aktivieren* eingeschaltet ist.
- **Dauer** — die Dauer des Vorgangs, in der Einheit des Vorgangs oder nach *Daueranzeige*. Bearbeitbar: geben Sie `5d`, `12h` oder `1h 30m` ein; auch eine Zahl in der Einheit des Vorgangs. Schreibgeschützt bei einem Sammelvorgang, einem Hammock und einem Meilenstein mit Dauer 0.
- **Anfang** — der angezeigte Anfang, dasselbe Datum wie der Balken im Gantt. Bei einem begonnenen Vorgang ist das der Ist-Anfang. Bearbeitbar. Ein Vorgang mit einem Vorgänger, dem Sie einen neuen Anfang geben, erhält an diesem Datum die Einschränkung *Anfang nicht früher als (SNET)*. Schreibgeschützt bei einem Sammelvorgang oder Hammock, außer wenn der Vorgang manuell geplant ist, und bei einem begonnenen Vorgang (*Dieser Vorgang hat begonnen; sein Anfang ist der Ist-Anfang. Ändern Sie ihn über den Fortschritt.*).
- **Ende** — das angezeigte Ende. Bei einem abgeschlossenen Vorgang ist das das Ist-Ende. Bearbeitbar: ein neues Ende ergibt eine neue Dauer. Die App lehnt es ab für einen Meilenstein, einen Vorgang in verstrichener Zeit und einen Vorgang mit Unterbrechungen sowie für ein Ende vor dem Anfang (*Das Ende liegt vor dem Anfang.*). Schreibgeschützt bei einem Sammelvorgang oder Hammock, außer wenn der Vorgang manuell geplant ist, und bei einem abgeschlossenen Vorgang (*Dieser Vorgang ist abgeschlossen; sein Ende ist das Ist-Ende. Ändern Sie es über den Fortschritt.*).
- **Geplanter Anfang** — der Terminanker, mit dem die Berechnung beginnt (nicht unbedingt der angezeigte Anfang). Bearbeitbar; die Wirkung ist dieselbe wie bei der Eingabe in *Anfang*.
- **Geplantes Ende** — das eingegebene Ende. Nur bei einem manuell geplanten Vorgang bearbeitbar; sonst zeigt die App *Das geplante Ende gilt nur für einen manuell geplanten Vorgang. Ändern Sie das Ende über die Spalte Ende oder über die Dauer.*

## Einschränkungen

- **Einschränkungstyp** — der Typ der Einschränkung, von *So früh wie möglich (ASAP)* bis *Muss enden am (MFO)*. Bearbeitbar; ein Vorgang ohne Einschränkung zeigt *ASAP*.
- **Einschränkungsdatum** — das Datum der Einschränkung. Bearbeitbar.
- **Harte Einschränkung** — die Markierung *Verbindlich (Pin-Logik)*. Nur bei *MSO* und *MFO* bearbeitbar.
- **Sekundärer Einschränkungstyp** — der Typ der zweiten Grenze oder ein Strich. Bearbeitbar; die Tabelle bietet alle Typen an, aber eine Kombination, die nicht erlaubt ist, wird abgelehnt: Die sekundäre Einschränkung muss *SNET*, *FNET*, *SNLT* oder *FNLT* sein, die primäre Einschränkung muss eine Grenze sein (nicht *ASAP*, *ALAP*, *MSO*, *MFO* oder eine harte Einschränkung), und die beiden müssen gegenüberliegende Seiten begrenzen (eine untere Grenze *SNET*/*FNET* mit einer oberen Grenze *SNLT*/*FNLT* oder umgekehrt).
- **Sekundäres Einschränkungsdatum** — das Datum der zweiten Grenze. Bearbeitbar.
- **Stichtag** — das Zieldatum für das Ende. Bearbeitbar.

## Beziehungen

- **Vorgänger** — die Vorgänger, als `WBS type±lag`, getrennt durch `; `, zum Beispiel `1.2 FS+2d`. Bearbeitbar, indem Sie dieselbe Form eingeben. Sie fügen hier keine externe Beziehung hinzu, sondern mit *Planung › Beziehungen › Verknüpfen › Externe Beziehung hinzufügen…*.
- **Nachfolger** — die Nachfolger, in derselben Form. Bearbeitbar.
- **Maßgebende Beziehung** — die Beziehungen, die das Datum dieses Vorgangs bestimmen, als `← 1.2` (Vorgänger) oder `→ 1.4` (Nachfolger). Schreibgeschützt; veraltet, bis *Berechnen*.
- **Freier Puffer** (in der Kategorie *Beziehungen*) — der freie Puffer je Beziehung, als `← 1.2: 3d`. Nicht dieselbe Spalte wie *Freier Puffer* unter *Berechnet*; diese zeigt den Puffer des Vorgangs selbst. Schreibgeschützt.
- **Warnungen** — Warnungen je Beziehung, zum Beispiel *Außerhalb der Reihenfolge* oder *Nicht in die Berechnung einbezogen*. Schreibgeschützt. Siehe [Meldungen und Warnungen](docs://ref-meldingen).

## Ressourcen

- **Zugewiesene Ressourcen** — die Namen der zugewiesenen Ressourcen, durch Kommas getrennt. Bearbeitbar: Wenn Sie einen Namen hinzufügen, wird die Ressource mit 1 Zuordnungseinheit pro Tag zugewiesen; wenn Sie einen Namen entfernen, wird die Zuweisung gelöscht. Schreibgeschützt bei einem Meilenstein oder Sammelvorgang.
- **Zuordnungseinheiten pro Tag** — die Einheiten je Ressource, als `Name: 1; Name: 0.5`, mit höchstens zwei Dezimalstellen. Der gespeicherte Wert bleibt genau. Bearbeitbar bei einem Vorgang mit Zuweisungen.
- **Geplante Einheiten pro Tag** — die geplanten Einheiten je Ressource, als `Name: 1.11`, mit höchstens zwei Dezimalstellen, wie bei der Spalte *Zuordnungseinheiten pro Tag*. Nur bei einer Zuweisung aus Primavera P6 mit anderen verbleibenden Einheiten; *Zuordnungseinheiten pro Tag* zeigt dann die verbleibenden Einheiten. Schreibgeschützt.
- **Zuordnungskurve** — die Kurve je Ressource, als `Name: Uniform`. Bearbeitbar bei einem Vorgang mit Zuweisungen.
- **Arbeitsfenster Anfang** und **Arbeitsfenster Ende** — das Arbeitsfenster je Ressource aus einer importierten Datei, als `Name: date`. Schreibgeschützt.
- **Geplante Arbeit (Stunden)** und **Ist-Arbeit (Stunden)** — die geplante Arbeit und die Ist-Arbeit je Ressource in Stunden, als `Name: 617.14`, mit höchstens zwei Dezimalstellen, aus einer importierten Datei. Schreibgeschützt.
- **Restarbeit (Stunden)** — die Restarbeit je Ressource in Stunden, als `Name: 6` oder `Name: 26.67`: die gespeicherte Arbeit, sonst Restdauer × Einheiten. Bearbeitbar bei einem Vorgang mit Zuweisungen, für den eine Vorgangsart gilt, mit Komma oder Punkt als Dezimaltrennzeichen. Nur in der Auswahl sichtbar, wenn die Vorgangsarten sichtbar sind. Ein gelbes ⚠ in der Zelle bedeutet, dass die gespeicherte Arbeit von Einheiten × Restdauer abweicht, wie das ⚠ beim Feld *Arbeit (Rest)* im Bereich des Vorgangs.

## Fortschritt

- **Status** — *Nicht begonnen*, *In Bearbeitung* oder *Abgeschlossen*. Bearbeitbar, außer bei einem Sammelvorgang.
- **Fortschritt** — der Prozentsatz, als `40%`. Bearbeitbar mit einer Zahl von 0 bis 100, außer bei einem Sammelvorgang.
- **Ist-Anfang** — das Datum, an dem der Vorgang begonnen hat. Bearbeitbar, außer bei einem Sammelvorgang.
- **Ist-Ende** — das Datum, an dem der Vorgang abgeschlossen wurde. Bearbeitbar, außer bei einem Sammelvorgang.
- **Ist-Dauer** — die Ist-Dauer als Zahl. Bearbeitbar, außer bei einem Sammelvorgang.
- **Rest** — die Restdauer in der Einheit des Vorgangs. Bearbeitbar, außer bei einem Sammelvorgang.
- **Wiederaufnahmedatum** und **Stopdatum** — die Wiederaufnahme und der Stopp eines laufenden Vorgangs aus einer MS-Project- oder Primavera-Datei. Schreibgeschützt.

Die Spalten zum Fortschritt folgen den Fortschrittsregeln der App: Ein Ist-Datum nach dem Statusdatum wird abgelehnt. Bei einem Sammelvorgang zeigt die App *Der Fortschritt eines Sammelvorgangs wird aus seinen Teilvorgängen abgeleitet und kann hier nicht geändert werden.*

## Berechnet

Alle Spalten in dieser Kategorie sind schreibgeschützt.

- **Abgleichsverzögerung** — um wie viele Arbeitstage der Kapazitätsabgleich den Vorgang verzögert hat; ein Strich, wenn kein Abgleich angewendet wurde.
- **Frühester Anfang** und **Frühestes Ende** — die frühesten Termine aus der Berechnung. Bei einem begonnenen Vorgang können sie von *Anfang* und *Ende* abweichen: das Berechnungsprofil *Primavera P6* setzt den frühesten Anfang eines laufenden oder abgeschlossenen Vorgangs auf das Statusdatum.
- **Spätester Anfang** und **Spätestes Ende** — die späten Termine, zu denen der Vorgang noch beginnen oder enden darf, ohne das Projekt zu verzögern.
- **Freier Puffer** — die Arbeitstage, um die der Vorgang rutschen darf, ohne einen Nachfolger zu verzögern.
- **Gesamtpuffer** — die Arbeitstage, um die der Vorgang rutschen darf, ohne das Projektende zu verzögern. Negativ, wenn eine Einschränkung oder ein Stichtag nicht eingehalten werden kann.
- **Kritisch** — *Ja*, wenn der Vorgang auf dem kritischen Pfad liegt.
- **Störender Puffer** — Gesamtpuffer minus freier Puffer.
- **Fast kritisch** — *Ja* bei einem fast kritischen Vorgang. Nur gefüllt, wenn *Beinahe-kritisch markieren* eingeschaltet ist (*Projekteinstellungen*, Block *Berechnungsprofil und Berechnungsoptionen*); sonst ein Strich.
- **Pufferpfad** — die Nummer des Pufferpfads, 1 für den kritischsten. Nur gefüllt, wenn *Mehrere Pufferpfade* eingeschaltet ist; sonst ein Strich.
- **Quelle der erfassten Termine** — solange die App die Termine aus der Datei zeigt: *Teilweise nicht erfasst* bei einem Vorgang, für den die Datei nicht alles enthält. Nur in der Auswahl in dieser Ansicht sichtbar. Auf einer nicht erfassten Zeitachse erscheint *Nicht erfasst* in den Spalten für späte Termine und Puffer.

Siehe [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad).

## Baseline

Für jede Baseline des Projekts werden Spalten hinzugefügt, mit dem Namen der Baseline vor dem Spaltennamen (`<baseline> — Geplanter Anfang`). Sie sind schreibgeschützt. Ein Vorgang, der nicht in der Baseline steht, zeigt einen Strich mit dem Tooltip *In diesem Basisplan nicht vorhanden*.

- **Geplanter Anfang**, **Geplantes Ende** und **Dauer** — Anfang, Ende und Dauer, wie die Baseline sie erfasst hat.
- **Abweichung Anfang** und **Abweichung Ende** — die Anzahl Arbeitstage zwischen der Baseline und dem angezeigten Anfang oder Ende, im Kalender des Projekts; positiv, wenn der Vorgang später liegt.
- **Abweichung Dauer** — die aktuelle Dauer minus die Dauer in der Baseline, in Arbeitstagen.

## Benutzerdefiniert

- **Aktivitätscode** — eine Spalte pro Aktivitätscode, mit dem Namen des Codes. Zeigt den Code des gewählten Werts. Bearbeitbar: Sie geben den Code ein oder wählen ihn aus den Vorschlägen; ein unbekannter Code wird abgelehnt. Kommt ein Code mehrmals vor, bittet die App Sie, ihn aus der Liste zu wählen.
- **Benutzerdefiniertes Feld** — eine Spalte pro benutzerdefiniertem Feld, mit seinem Namen. Die Eingabe passt zum Typ: Text, Zahl, Ganzzahl, Kosten, Datum oder Ja/Nein. Bearbeitbar.

Diese Spalten gehören zu dem Projekt, in dem der Code oder das Feld liegt. Siehe [Codes und benutzerdefinierte Felder](docs://howto-codes-en-velden).

## Technisch

Alle Spalten in dieser Kategorie sind schreibgeschützt. Sie zeigen Daten, die die App speichert, aber nicht in einer normalen Spalte zeigt, zum Beispiel zum Prüfen eines Imports.

- **Vorgangs-ID** — die interne ID des Vorgangs.
- **Übergeordnete Vorgangs-ID** und **Untergeordnete Vorgangs-IDs** — die IDs des übergeordneten und der untergeordneten Vorgänge.
- **Ressourcen-IDs** — die IDs der Ressourcen am Vorgang.
- **Zuweisungs-ID**, **Zuweisungs-Vorgangs-ID** und **Zuweisungs-Ressourcen-ID** — die IDs der Zuweisungen, Vorgänge und Ressourcen dieses Vorgangs.
- **Dauer (Minuten)** und **Rest (Minuten)** — die Dauer und die Restdauer in Minuten; nur gefüllt bei einem Vorgang in Stunden.
- **Abgleichsverzögerung (Minuten)** und **Verstrichene Abgleichsverzögerung** — die Abgleichsverzögerung aus MS Project in Minuten, und ob sie in verstrichener Zeit zählt.
- **Manuell geplant** — ob der Vorgang manuell geplant ist.
- **Vorgangsart MS Project (Import)** und **Aufwandsgesteuert** — die Vorgangsart und die Markierung für aufwandsgesteuert, wie MS Project sie hatte.
- **Herkunft Primavera P6** — die Quellfelder aus einer Primavera-Datei, als `key: value`.
- **Expliziter Sammelvorgang** — ob der Vorgang ein expliziter Sammelvorgang ohne Teilvorgänge ist (aus einer Primavera-Datei).
- **Zeitphasierte Untergrenze Ende**, **Zeitphasierter Anfangsanker**, **Zeitphasierte Dauersegmente** und **Zeitphasierte Konturen** — die Verteilung der Stunden aus einer MS-Project-Datei, als Datums- und Anzahlwerte.
- **Aktivitätscodedaten**, **Daten benutzerdefinierter Felder** und **Notizdaten** — die Anzahl der Codezuweisungen, benutzerdefinierten Felder und Notizen.
- **Daten interner Beziehungen** und **Daten externer Beziehungen** — die Anzahl der internen und externen Beziehungen.
- Je Baseline stehen hier auch **Meilenstein** und **Meilensteinart**, wie die Baseline sie erfasst hat.
