# Das Menüband, Registerkarte für Registerkarte

Das Menüband oben am Bildschirm hat Registerkarten. Jede Registerkarte hat Gruppen mit Schaltflächen. Dieser Artikel sagt für jede Schaltfläche, was sie tut und wo Sie das Ergebnis sehen. Wie Sie eine Aufgabe Schritt für Schritt erledigen, steht in den Anleitungen. Hier schlagen Sie nach, was eine Schaltfläche ist. Eine Schaltfläche, die nur unter einer Bedingung existiert oder funktioniert, hat diese Bedingung direkt daneben.

## Verhalten des Menübands

- **Registerkarten** — *Datei* steht links, danach *Start*, *Planung*, *Ressourcen*, *Ansicht*, *Einstellungen*, *Tabelle*, *IFC*, *Bericht* und nur bei eingeschaltetem KI-Modus *KI*.
- **Schmales Fenster** — passt das Menüband nicht, schrumpfen die Schaltflächen von rechts nach links zu einem Symbol. Der Name steht dann als Tooltip auf der Schaltfläche. Jede Schaltfläche ohne eigenen Tooltip zeigt ihren Namen.
- **Menüband einklappen** — der kleine Pfeil rechts unten am Menüband macht daraus einen flachen Streifen mit nur Symbolen. Die Gruppe *Baselines & Fortschritt* und die Gruppe *Verbindung* auf der Registerkarte *KI* verschwinden dann hinter einer einzigen Schaltfläche mit einem Pop-up. Standard: ausgeklappt. Ihre Wahl bleibt gespeichert.
- **Erweiterungsschaltflächen** — eine Erweiterung kann am Ende einer Registerkarte eine eigene Gruppe hinzufügen. Eine solche Schaltfläche tut, was die Erweiterung ihr gegeben hat.

## Datei

Wenn Sie *Datei* klicken, übernimmt ein eigener Bildschirm (das Backstage) den Arbeitsbereich. Er hat kein Menüband. *Zurück* schließt ihn. Haben Sie etwas unter *Projekteinstellungen* geändert, das Sie nicht mit *Anwenden* übernommen haben, fragt die App zuerst, was damit geschehen soll.

- **Neu** — öffnet das Fenster *Neues Projekt* und schließt das Backstage. Die Felder stehen in [Neues Projekt und Projekteinstellungen](docs://ref-projectinfo).
- **Öffnen** — wählt eine Datei und öffnet sie als Dokument. Schließt das Backstage.
- **Zuletzt verwendet** — eine Liste der zuletzt geöffneten Projekte. Ein Klick öffnet eines. Nur sichtbar, wenn die Umgebung Dateien erneut öffnen kann: in der Desktop-App und in Browsern mit Dateizugriff, wie Chrome und Edge. In anderen Browsern ist die Schaltfläche da, aber die Seite bleibt leer.
- **Beispiele** — mitgelieferte Beispiel-Terminpläne, aufgeteilt in *Vollständige Showcase-Zeitpläne* (Abzeichen *Alle Funktionen*) und *Einfache Beispiele*. Ein Klick öffnet einen Terminplan in einem neuen Tab.
- **Speichern** — schreibt das Projekt in die Datei dieses Dokuments. Hat das Dokument noch keine Datei, wählen Sie zuerst einen Namen und einen Ort. Eine Datei, die Sie in einem anderen Format als IFC geöffnet haben, wird nie überschrieben. In diesem Fall fragt *Speichern* nach einem Namen und einem Ort für eine IFC-Datei.
- **Speichern unter** — wählt einen neuen Namen oder Ort und speichert dort als IFC.
- **Exportieren** — Karten je Exportformat, mit einer Beschreibung. Ein Klick wandelt das Projekt um, speichert es und bringt Sie zurück zu *Start*. Hat der Terminplan einen Zyklus, erscheint der Fehler im Backstage und Sie bleiben dort. Ist das Projekt mit einer Ressourcenbibliothek verknüpft, erscheint darunter das Kontrollkästchen *Bibliotheksdatei zusätzlich speichern*. Es wirkt nur bei der Karte IFC.
- **Importieren** — oben die Karte *Fortschritt aus einer Tabelle aktualisieren* (ohne Vorgänge deaktiviert), darunter die Importfunktionen, die Erweiterungen hinzufügen.
- **Drucken** — die Schaltfläche *Druckvorschau öffnen* bringt Sie zur Registerkarte *Bericht*.
- **Projekteinstellungen** — die Metadaten und das Berechnungsprofil dieses Projekts. Änderungen wirken erst nach *Anwenden*. Siehe [Neues Projekt und Projekteinstellungen](docs://ref-projectinfo) und [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen).
- **App-Einstellungen** — dieselben Einstellungen wie im Fenster *App-Einstellungen*.
- **Erweiterungen** — Verwaltung und Installation von Erweiterungen; siehe [Installieren und Verwalten einer Erweiterung](docs://howto-extensie-installeren).
- **Bibliothek** — Verwaltung der Ressourcenbibliotheken; siehe [Ressourcenbibliotheken verwalten und teilen](docs://howto-bibliotheken-beheren).
- **Hilfe** — die eingebaute Dokumentation, auch mit F1. Das Suchfeld durchsucht Titel, Überschriften und den Text selbst. Die Artikel stehen in vier Abschnitten: *Tutorials*, *Anleitungen*, *Erklärungen* und *Referenz*. Unter *Dokumentationssprache* wählen Sie *App-Sprache folgen* oder eine Sprache aus der Liste. Niederländisch und Englisch sind die Ausgangssprachen; die anderen Sprachen haben die Artikel, die schon übersetzt sind. Fehlt ein Artikel in Ihrer Sprache, lesen Sie die englische Version mit einem Hinweis. Ihre Wahl bleibt auf diesem Gerät gespeichert, getrennt von der Sprache der App. Sie erreichen die Hilfe auch aus einem Fenster oder Panel. Viele Fenster und die Panels *Eigenschaften*, *Ressourcen* und *Warnungen* haben oben rechts ein Fragezeichen (*Hilfe zu diesem Thema*). Es öffnet die Hilfe zu dem Artikel über dieses Fenster oder Panel. Haben Sie im Fenster etwas eingegeben, das noch nicht gespeichert ist, fragt die App zuerst *Speichern*, *Abbrechen* (Eingabe verwerfen) oder *Zurück* (im Fenster bleiben). Danach schließt das Fenster und die Hilfe öffnet sich. Einige Fenster, zum Beispiel *Vorgang bearbeiten* und *Kapazitätsabgleich*, fragen immer. Ohne Eingabe öffnet die Hilfe sofort.
- **Tour starten** — schließt das Backstage und startet die Tour bei Schritt 1.
- **Projekt schließen** — schließt das aktive Dokument. Hat es nicht gespeicherte Änderungen, fragt die App nach einer Bestätigung.

## Start

### Start › Datei

- **Neu**, **Speichern**, **Öffnen** und **Speichern unter** — dieselben Aktionen wie unter *Datei*.
- **Zuletzt verwendet** — Dropdown mit den zuletzt verwendeten Projekten; ein Klick öffnet eines. Nur sichtbar unter derselben Bedingung wie *Datei › Zuletzt verwendet*. Ohne zuletzt verwendete Dateien steht dort *Keine zuletzt verwendeten Dateien*.
- **Exportieren** — Dropdown mit den Exportformaten (kurze Namen). Ein Klick wandelt das Projekt um und speichert es.

### Start › Bearbeiten

- **Rückgängig** — macht die letzte Änderung rückgängig. Deaktiviert, wenn nichts rückgängig zu machen ist.
- **Wiederholen** — stellt die letzte rückgängig gemachte Änderung wieder her. Deaktiviert, wenn nichts zu wiederholen ist.
- **Löschen** — löscht die ausgewählten Vorgänge zusammen mit ihren Teilvorgängen in einem Schritt. Deaktiviert ohne Auswahl.

### Start › Vorgänge

- **Vorgang** — fügt einen Vorgang mit dem Namen *Neuer Vorgang* hinzu, mit einer Dauer von 5 Arbeitstagen, der am Projektstart beginnt. (Ist *Stundenplanung aktivieren* eingeschaltet und steht die *Standardeinheit für neue Vorgänge* in *Projekteinstellungen* auf Stunden, ist die Dauer 5 Stunden.) Ist ein Vorgang ausgewählt und ist die Ansicht die einfache Baumansicht, landet er direkt unter dem untersten ausgewählten Vorgang (Tooltip *Neuer Vorgang direkt unter der Auswahl*). Ohne Auswahl kommt er ans Ende (Tooltip *Neuer Vorgang am Ende der Liste*). Mit Auswahl, aber während des Filterns, Gruppierens oder Sortierens, kommt er auch ans Ende. Eine rote Meldung sagt dann, dass die App ihn nicht unter Ihrer Auswahl platzieren kann, mit der Schaltfläche *Leeren*. Der neue Vorgang wird die einzige Auswahl. Das Gantt-Diagramm springt zu ihm, und sein Name lässt sich im Panel *Eigenschaften* direkt überschreiben.
- **Meilenstein ▾** — Dropdown, das einen Meilenstein (Dauer 0) an dieselbe Stelle setzt wie *Vorgang*. *Anfangsmeilenstein* und *Endmeilenstein* legen die Art des Meilensteins fest. Der neue Meilenstein heißt *Neuer Meilenstein* und bekommt die Arbeitskategorie *Sonstiges*. *Prüfpunkt (verbindlich)* macht einen Endmeilenstein mit der Arbeitskategorie *Prüfung* und der Markierung *Verbindlich (vertraglich)*. Er heißt *Neuer Prüfpunkt*.
- **Verknüpfen ▾** — Dropdown mit vier festen Aktionen; die Hauptschaltfläche ändert ihre Bedeutung nie. Die vier Aktionen stehen unter *Planung › Beziehungen*.
- **Vorgang teilen** — schaltet den Teilungsmodus ein oder aus. Ist er an, erklärt ein Streifen unter dem Menüband: Klicken Sie auf einen Balken, wo die Unterbrechung beginnt, und ziehen Sie nach rechts für ihre Länge. Deaktiviert, wenn das Gantt-Diagramm nicht sichtbar ist (auf den Registerkarten *Tabelle*, *IFC* und *Bericht* und unter dem vollständigen Ressourcen-Panel). Der Tooltip sagt dann *Nur verfügbar, wenn das Gantt-Diagramm sichtbar ist*. Siehe [Einen Vorgang teilen](docs://howto-taak-splitsen).

### Start › Terminplan

- **Berechnen** — berechnet den Terminplan: Termine, Puffer, kritischer Pfad und Ressourcenlast. Das geschieht nie von selbst, außer Sie schalten *Automatisch berechnen* ein (*App-Einstellungen*, Registerkarte *Planung*, Abschnitt *Berechnung*). Solange der Terminplan veraltet ist, zeigt die Statusleiste *Veraltet — neu berechnen (F5)*.

### Start › Zoom

- **Zoom +** — vergrößert die Zeitachse um 10 Pixel pro Tag.
- **Zoom -** — verkleinert die Zeitachse um 10 Pixel pro Tag.

## Planung

### Planung › Terminplan

Die Schaltfläche *Berechnen* ist dieselbe wie unter *Start*.

- **Projekt verschieben…** — öffnet das Fenster *Projekt verschieben*. Deaktiviert ohne Projektstart. Siehe [Ein Projekt verschieben](docs://howto-project-verplaatsen).
- **Warnungen** — zeigt oder verbirgt das Panel *Warnungen* in der rechten Spalte. Die Schaltfläche leuchtet, solange Sie das Panel sehen. Einschalten klappt eine eingeklappte Spalte aus. Was darin steht, beschreibt [Meldungen und Warnungen](docs://ref-meldingen).

### Planung › Beziehungen

Die Gruppe hat die Schaltfläche *Verknüpfen* ▾ mit vier Aktionen und die Schaltfläche *Vorgang teilen* (wie unter *Start*). Die vier Aktionen:

- **Beziehung zeichnen** — schaltet den Verknüpfungsmodus ein oder aus. Ein Häkchen erscheint, wenn er an ist, und die Hauptschaltfläche leuchtet. Ist er an, ziehen Sie im Gantt-Diagramm von einem Balken zum anderen, um eine Beziehung zu erstellen. Ein Streifen unter dem Menüband sagt, wie Sie beenden (*Beenden* oder Esc). Deaktiviert, wenn das Gantt-Diagramm nicht sichtbar ist.
- **Ausgewählte Vorgänge verknüpfen** — erstellt eine Ende-Anfang-Beziehung ohne Zeitabstand zwischen zwei Vorgängen. Der zuerst ausgewählte Vorgang wird der Vorgänger. Nur verfügbar mit genau zwei ausgewählten Vorgängen, sonst *Genau zwei Vorgänge auswählen*. Eine doppelte Beziehung oder ein Zyklus wird mit einer Meldung abgelehnt.
- **Externe Beziehung hinzufügen…** — öffnet ein Fenster, um dem ausgewählten Vorgang einen externen Vorgänger oder Nachfolger hinzuzufügen. Nur verfügbar mit genau einem ausgewählten Vorgang, sonst *Genau einen Vorgang auswählen*.
- **Alle externen Beziehungen aktualisieren** — aktualisiert die Anker aller externen Beziehungen und meldet im Menü, wie viele aktualisiert wurden oder fehlen. Nur verfügbar, wenn das Projekt externe Beziehungen hat, sonst *Dieses Projekt enthält keine externen Beziehungen*.

Hintergründe zu Beziehungen finden Sie unter [Beziehungen erstellen](docs://howto-relaties-leggen) und [Beziehungen und Zeitabstand](docs://uitleg-relaties).

### Planung › Pfadverfolgung

- **Vorgänger** — hebt im Gantt-Diagramm die Vorgänger der ausgewählten Vorgänge hervor, Kette für Kette.
- **Nachfolger** — hebt die Nachfolger der ausgewählten Vorgänge hervor.

Sie können beide gleichzeitig einschalten. Ein zweiter Klick auf eine Schaltfläche schaltet diese Seite wieder aus. Maßgebende Beziehungen erhalten eine stärkere Färbung. Siehe [Einen Pfad verfolgen](docs://howto-pad-traceren).

### Planung › Kalender

- **Kalender** — öffnet das Fenster *Kalender* mit der Kalenderbibliothek des Projekts. Siehe [Kalenderfenster](docs://ref-kalenders).

### Planung › Struktur

- **Codes & Felder** — öffnet das Fenster *Codes & Felder* für Aktivitätscodes und benutzerdefinierte Felder. Siehe [Codes und benutzerdefinierte Felder](docs://howto-codes-en-velden).
- **PSP auto** — schaltet die automatische Nummerierung der PSP-Codes ein oder aus. Standard: ein bei einem neuen Projekt. Bei einer geöffneten Datei ohne diese Einstellung: ein, wenn die Datei leer ist oder alle Codes schon zur Nummerierung des Baums passen, sonst aus. Ist sie an, wird der ganze Baum auf einmal neu nummeriert. Die Codes folgen danach jeder Änderung der Struktur, und das Feld *PSP-Code* im Panel und im Fenster ist deaktiviert.
- **PSP neu nummerieren** — nummeriert die PSP-Codes einmal neu, nach der Position im Baum (1.2.3). Deaktiviert, solange *PSP auto* eingeschaltet ist.
- **Vorlagen** — Dropdown mit gespeicherten PSP-Vorlagen, jede mit ihrer Anzahl Vorgänge und Beziehungen. Ein Klick fügt die Vorlage unter dem ausgewählten Vorgang ein; ohne Auswahl wird sie auf oberster Ebene eingefügt. Das Papierkorb-Symbol löscht eine Vorlage. Ohne Vorlagen steht dort, wie Sie eine speichern: Klicken Sie mit der rechten Maustaste auf einen Sammelvorgang und wählen Sie *Zweig als Vorlage speichern*. Siehe [PSP-Vorlagen speichern und einfügen](docs://howto-wbs-sjablonen).
- **Tiefer stufen** — macht die ausgewählten Vorgänge zu Teilvorgängen des Vorgangs davor. Deaktiviert ohne Auswahl und sobald Sie filtern, gruppieren oder sortieren. Der Tooltip sagt dann *Nicht verfügbar während des Filterns/Gruppierens/Sortierens*.
- **Ausrücken** — verschiebt die ausgewählten Vorgänge eine Ebene nach oben, direkt nach ihrem bisherigen übergeordneten Vorgang. Dieselben Bedingungen wie bei *Tiefer stufen*.

### Planung › Baselines & Fortschritt

- **Baselines verwalten…** — öffnet das Fenster für Baselines. Siehe [Eine Baseline speichern und verwalten](docs://howto-baseline-opslaan-en-beheren).
- **Statusdatum** — das Datum, bis zu dem Sie den Fortschritt messen. Geben Sie ein Datum ein. Das Kreuz (*Statusdatum leeren*) entfernt es. Hat der Kalender des Projekts Arbeitszeit-Bänder, rechnet die App in Stunden, und neben dem Datum erscheint ein Zeitfeld (MS Project speichert oft 17:00). Die Uhrzeit zählt dann: 12:00 statt 17:00 ergibt eine Restarbeit, die um einen halben Tag anders ist. Ohne Arbeitszeit-Bänder rechnet die App in ganzen Tagen, und es gibt kein Zeitfeld. Wirkung: Der Fortschritt wird bis zu diesem Datum gemessen. Die Statuslinie und die Fortschrittslinie im Gantt-Diagramm liegen auf diesem Datum. Siehe [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang).
- **Fortschrittsmodus** — Auswahl zwischen *Retained Logic* und *Progress Override*. Standard: *Retained Logic*. Wirkung: Bei *Retained Logic* folgt die Restarbeit eines begonnenen Nachfolgers der Beziehung. Bei *Progress Override* beginnt die Restarbeit am Statusdatum, ohne auf den Vorgänger zu warten. Siehe [Den Fortschrittsmodus wählen](docs://howto-voortgangsmodus-kiezen).

Im eingeklappten Menüband stehen diese drei hinter einer Flaggen-Schaltfläche mit dem Titel *Baselines & Fortschritt*.

### Planung › Fortschritt

- **Fortschrittsblatt exportieren** — erstellt ein `.xlsx`-Tabellenblatt mit den Vorgängen, um den Fortschritt außerhalb der App einzutragen. Deaktiviert ohne Vorgänge.
- **Fortschritt aus einer Tabelle aktualisieren** — öffnet das Importfenster für ein zurückgegebenes Blatt. Deaktiviert ohne Vorgänge. Siehe [Fortschritt aus einer Tabelle importieren](docs://howto-voortgang-importeren).

Diese Gruppe gibt es auch auf den Registerkarten *Tabelle* und *Bericht*.

## Ressourcen

### Ressourcen › Verwalten

- **Ressourcen** — öffnet das vollständige Ressourcen-Panel. Es übernimmt den Arbeitsbereich. Die Schaltfläche leuchtet, solange Sie dieses Panel sehen. Siehe [Ressourcen-Panel](docs://ref-resourcepaneel).
- **Ressourcen-Dock** — dockt das kompakte Ressourcen-Panel in der rechten Spalte an, neben dem Gantt-Diagramm. Die Schaltfläche leuchtet, solange das Dock sichtbar ist. Ein zweiter Klick schließt es. Das Dock zeigt nur Name, Farbe, eine Warnung bei Überlastung und *Max. Einheiten*. Bei einer Vorgangsauswahl zeigt es nur die Ressourcen dieser Vorgänge.
- **Neue Ressource** — öffnet das vollständige Ressourcen-Panel mit einer leeren Entwurfszeile für eine neue Ressource. Es wird nichts erstellt, bis Sie einen Namen eingeben. Klicken Sie außerhalb der Zeile, bleibt nichts zurück. Die Ressource kommt je nach Ansicht in die Bibliothek oder in das Projekt.

### Ressourcen › Zuweisung

- **Zuweisen ▾** — weist dem ausgewählten Vorgang eine Ressource zu. Nur verfügbar mit genau einem ausgewählten Vorgang, der ein Blattvorgang und kein Meilenstein ist. Sonst ist die Schaltfläche ausgegraut. Im Menü setzen Sie zuerst *Einh./Tag* (Standard 1) und *Kurve* (Standard *Gleichmäßig*). Ein Klick auf eine Ressource weist sie mit diesen Werten zu. Das Menü listet nur Ressourcen, die noch nicht am Vorgang hängen. Siehe [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen).

### Ressourcen › Histogramm

- **Histogramm** — zeigt oder verbirgt die Histogramm-Leiste unter dem Gantt-Diagramm. Standard: aus. Ihre Wahl bleibt gespeichert.
- **Vorherige** und **Nächste** — blättern durch die Ressourcen in der Auswahlliste der Histogramm-Leiste. *Alle Ressourcen* ist ein zusätzlicher Schritt im Durchlauf. Deaktiviert, wenn das Histogramm aus ist oder das Projekt keine Ressourcen hat.

### Ressourcen › Kapazitätsabgleich

- **Abgleichen…** — öffnet das Fenster *Kapazitätsabgleich*. Siehe [Kapazitätsabgleich](docs://uitleg-nivelleren).
- **Kapazitätsabgleich entfernen** — entfernt die Verzögerungen und Unterbrechungen, die der Kapazitätsabgleich gesetzt hat. Deaktiviert, wenn kein Vorgang ein Ergebnis des Kapazitätsabgleichs hat.

### Ressourcen › Überlastung

- **Überlastung** — keine Schaltfläche, sondern ein Zähler: die Anzahl der Ressourcen mit mindestens einem überlasteten Tag, oder *Keine*. Der Zähler ist rot mit einem Warnsymbol, sobald es einen Treffer gibt. Die Zahl aktualisiert sich nach *Berechnen* und nach Änderungen an Ressourcen und Zuweisungen. Ändern Sie die Termine von Vorgängen, zählt das erst nach *Berechnen*.

## Ansicht

### Ansicht › Zeitskala

- **Zoom +** und **Zoom -** — vergrößern oder verkleinern die Zeitskala um 10 Pixel pro Tag.
- **Zurücksetzen** — setzt den Zoom auf den Standard von 30 Pixel pro Tag zurück.
- **An Projekt anpassen** — zoomt und scrollt, sodass das ganze Projekt sichtbar ist.
- **Skalenauswahl** — eine Liste mit *Jahr*, *Quartal*, *Monat*, *Woche*, *Tag* und, nur wenn *Stundenplanung aktivieren* eingeschaltet ist, *Stunde*. Eine Auswahl legt einen festen Zoom fest. Der angezeigte Wert folgt dem aktuellen Zoom. Darunter wird dieser Zoom in Pixel pro Tag angezeigt.

### Ansicht › Anzeige

- **Spalten…**, **Filter…**, **Gruppieren…** und **Sortieren…** — nur sichtbar, wenn *Klassische Ansichtsschaltflächen anzeigen* eingeschaltet ist (*App-Einstellungen*, Registerkarte *Erweitert*, Abschnitt *Legacy-Funktionen*). Standard: aus. *Spalten…* führt Sie zu *Tabelle* und öffnet dort die Spaltenauswahl. *Filter…* öffnet sofort das Fenster *Filter*, solange kein gespeicherter Filter vorhanden ist. Mit gespeicherten Filtern öffnet sich ein Menü mit *Filter…*, *Leeren* (nur wenn ein Filter aktiv ist) und den gespeicherten Filtern. *Gruppieren…* erlaubt zwei Ebenen. *Sortieren…* erlaubt mehr Ebenen. Eine Schaltfläche leuchtet auf, wenn diese Ansichtseinstellung aktiv ist. Im aktuellen Menüband erledigen Sie das mit den Layout-Schaltflächen; siehe [Ein Layout erstellen und verwenden](docs://howto-layouts-gebruiken).

### Ansicht › Gliederung

- **Einklappen** — klappt die ausgewählten Sammelvorgänge ein. Ohne Auswahl klappt es alle ein. In einer gruppierten Ansicht klappt es alle Gruppen ein, und eine Auswahl hat dann keine Wirkung.
- **Ausklappen** — das Gegenteil.

### Ansicht › Layout

- **Layout-Schaltflächen** — jedes Layout ist ein Schalter mit einem Symbol und einem Namen. *Ressourcendiagramm* ist enthalten. Ein Klick schaltet das Layout ein. Ein weiterer Klick schaltet es aus und stellt die Ansicht von vor dem Klick wieder her. Layouts mit verschiedenen Teilen können gleichzeitig eingeschaltet sein. Klicken Sie mit der rechten Maustaste auf ein Layout: *Bearbeiten…*, *Duplizieren* und *Löschen* (nach Bestätigung). Ein mitgeliefertes Layout kann nur dupliziert werden.
- **Neues Layout** — öffnet das Fenster Layout für ein neues Layout.

### Ansicht › Präsentation

- **Präsentation** — schaltet den Präsentationsmodus ein oder aus (Esc beendet ihn; in der Desktop-App auch F11). Nur das Gantt-Diagramm füllt dann den Bildschirm. Siehe [Präsentieren auf einem großen Bildschirm](docs://howto-presentatie).
- **Geteilte Ansicht** — teilt das Gantt-Diagramm in zwei Zeitfenster. Beide beginnen mit Ihrem aktuellen Zoom und Ihrer Position (Teilung 50 Prozent). Oder die Ansicht wird wieder ein einziges Fenster. Standard: aus. Siehe [Geteilte Ansicht und Minimap verwenden](docs://howto-split-view-en-mini-map).
- **Minimap** — zeigt oder verbirgt die Minimap. Standard: aus. Ihre Auswahl wird gespeichert.

### Ansicht › Bereiche

- **Eigenschaften** — zeigt oder verbirgt den Bereich *Eigenschaften* in der rechten Spalte. Standard: ein. Siehe [Vorgangsdialog und Eigenschaftenbereich](docs://ref-taak-eigenschappen).

Die Schaltflächen *Ressourcen*, *Ressourcen-Dock* und *Histogramm* sind dieselben wie bei *Ressourcen*. *Warnungen* ist dasselbe wie bei *Planung*.

**Die rechte Spalte.** Die Spalte rechts neben dem Gantt-Diagramm ist vorhanden, sobald mindestens einer der Bereiche *Eigenschaften*, *Ressourcen-Dock* oder *Warnungen* eingeschaltet ist. Ist keiner eingeschaltet, gibt es keine Spalte. Nimmt ein vollständiges Panel den Arbeitsbereich ein, zum Beispiel das vollständige Ressourcen-Panel, dann verschwindet die Spalte. Nur auf der Registerkarte *Tabelle* bleibt sie bestehen.

- **Breite** — ziehen Sie den Trenner zwischen dem Arbeitsbereich und der Spalte. Eine Breite gilt für alle Bereiche in der Spalte.
- **Teilung** — wenn zwei Bereiche eingeschaltet sind, ziehen Sie die Grenze zwischen ihnen. Ist einer eingeschaltet, füllt dieser Bereich die ganze Spalte.
- **Einklappen** — die Schaltfläche *Seitenspalte einklappen* im Kopf blendet die Spalte aus. Ein schmaler Streifen mit der Schaltfläche *Seitenspalte ausklappen* holt sie zurück, mit denselben Bereichen wie zuvor.
- **Schließen** — jeder Bereich hat ein Kreuz in seinem Kopf. Es ist derselbe Schalter wie die Schaltfläche im Menüband.
- **Vollständiges Panel** — im Ressourcen-Dock öffnet die Schaltfläche *Vollständiges Panel* das vollständige Ressourcen-Panel.

### Ansicht › Baselines & Fortschritt

Diese Gruppe hat denselben Namen wie die Gruppe bei *Planung*. Sie enthält aber die Zeichenoptionen des Gantt-Diagramms.

- **Baseline-Überlagerung** — zeigt die aktive Baseline als dünnen Balken unter jedem Vorgangsbalken. Standard: ein. Ohne aktive Baseline ist nichts zu sehen.
- **Fortschrittslinie** — zeichnet eine Linie auf dem Statusdatum. Sie wölbt sich pro Vorgang entsprechend seinem Fortschritt aus. Standard: ein. Ohne Statusdatum ist nichts zu sehen. Ist die Fortschrittslinie eingeschaltet, markiert diese Linie auch das Statusdatum.
- **Statusdatum-Linie** — zeichnet eine gestrichelte Linie auf dem Statusdatum. Standard: ein. Sie sehen sie nur, wenn die Fortschrittslinie aus ist, weil diese Linie sonst ihren Platz einnimmt. Die Beschriftung mit dem Datum in der Kopfzeile bleibt, solange mindestens eine der beiden Linien eingeschaltet ist. Die Beschriftung folgt Ihrer Datumsschreibweise, zum Beispiel 20-09-2006. Rechnet die App in Stunden, dann liegen Linie und Beschriftung auf der Tageszeit, und die Beschriftung zeigt auch die Uhrzeit, zum Beispiel 20-09-2006 17:00.
- **Balkenfarben** — wählt, wie die Balken gefärbt werden: *Kritischer Pfad* (Standard), *Pro Vorgang — automatisch* oder *Nach Kategorie* mit einer Auswahl des Feldes. Ist dieses Feld in diesem Projekt nicht vorhanden, meldet das Menü, dass vorübergehend *Arbeitskategorie* verwendet wird. Außerhalb der Option *Kritischer Pfad* markiert ein roter Rand den kritischen Pfad. Die Auswahl gilt auch für den Bericht.
- **Ressourcenakzent** — zeichnet einen dünnen Streifen in der Ressourcenfarbe unter jedem Balken eines Einzelvorgangs. Der Streifen wird im Verhältnis zu den Einheiten pro Tag aufgeteilt. Standard: aus.
- **Pufferbereich** — zeichnet den grünen Bereich nach einem nicht kritischen Balken, bis zum spätesten Ende des Vorgangs. Standard: ein.
- **Beziehungslinien** — zeigt oder verbirgt die Beziehungslinien zwischen Vorgängen. Standard: ein. Die Auswahl gehört zum Dokument und zum Layout.

## Einstellungen

### Einstellungen › Projekt

- **Projekteinstellungen** — öffnet das Fenster *Projekteinstellungen* mit den Metadaten des Projekts. Im Block *Berechnungsprofil und Berechnungsoptionen* sehen Sie, wie das Projekt berechnet wird. Siehe [Neues Projekt und Projekteinstellungen](docs://ref-projectinfo).
- **App-Einstellungen** — öffnet das Fenster *App-Einstellungen* mit den Registerkarten *Darstellung*, *Planung* und *Erweitert*. Dieselben Einstellungen finden Sie unter *Datei › App-Einstellungen*.

### Einstellungen › Kalender

Die Schaltfläche *Kalender* ist dieselbe wie bei *Planung*.

### Einstellungen › Tastenkombinationen

- **Tastenkombinationen** — öffnet das Fenster *Tastenkombinationen*.

## Tabelle

Die Registerkarte *Tabelle* zeigt die Vorgänge als vollständige Tabelle statt als Gantt-Diagramm. Die Gruppen *Datei*, *Bearbeiten*, *Vorgänge*, *Terminplanung* und *Pfadverfolgung* sind dieselben wie bei *Start* und *Planung*. Sie wirken auf dieselbe Auswahl. Es gibt keine Gruppe *Zoom*, weil Zoomen nur die Zeitachse des Gantt-Diagramms skaliert. Die Schaltflächen *Vorgang teilen* und *Beziehung zeichnen* sind hier deaktiviert: Es gibt kein Gantt-Diagramm.

### Tabelle › Spalten

- **Spalten…** — öffnet die Spaltenauswahl dieser Tabelle. Dieselbe Auswahl öffnet sich mit dem Plus in der Tabellenkopfzeile. Der Tooltip sagt *Spalten der Tabellenansicht wählen*. Siehe [Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen) und [Tabellenspalten](docs://ref-tabelkolommen).

## IFC

Die Registerkarte zeigt den IFC-Bereich im Arbeitsbereich. Das Menüband hat hier keine Schaltflächen, nur die Textzeile *IFC - Industry Foundation Classes, im Schema des Projekts (Standard: IFC 4.3 ADD2)*.

## Bericht

### Bericht › Bericht

- **Drucken** — nur auf dieser Registerkarte. Dort bewirkt es nichts, weil *Bericht* schon geöffnet ist. Die Berichtsoptionen finden Sie im Berichtsbildschirm.

## KI

Die Registerkarte *KI* gibt es nur, wenn *KI-Modus aktivieren* eingeschaltet ist (*App-Einstellungen*, Registerkarte *Erweitert*, Abschnitt *KI-Modus*). Standard: aus. Schalten Sie den Modus aus, dann verschwindet die Registerkarte und die Bridge wird gestoppt. Ein KI-Assistent arbeitet mit Ihrem Terminplan über eine MCP-Bridge, die Sie hier starten. Siehe [Einen KI-Assistenten (MCP) verbinden](docs://howto-ai-assistent-koppelen).

### KI › Server

- **Bridge starten** und **Bridge stoppen** — starten oder stoppen die MCP-Bridge. Daneben steht der Status: *Aus*, *Live auf Port …*, *Port … belegt* (mit dem Grund) oder *Fehler*. In der Webversion ist sie deaktiviert. Der Tooltip sagt *Die Bridge funktioniert nur in der Desktop-App.* Derselbe Status erscheint als Punkt mit *KI* in der Statusleiste.

### KI › Verbindung

- **Port** — der Port der Bridge. Standard: 3877. Nur änderbar, wenn der Status *Aus* ist (Tooltip *Nur änderbar, solange der Server gestoppt ist.*).
- **Token** — das Passwort der Bridge, standardmäßig verborgen. Kleine Schaltflächen *Token anzeigen*/*Token verbergen*, *Kopieren* und *Neuer Token*. *Neuer Token* fragt zuerst um Bestätigung, weil ein neuer Token alle bestehenden Verbindungen unterbricht. Läuft die Bridge, startet sie mit dem neuen Token neu.
- **Verbinden** — zeigt die Verbindungsdetails: Endpunkt, Token, einen Konfigurationsausschnitt und einen Verbindungsprompt. Den Prompt fügen Sie in Ihren KI-Agenten ein.

### KI › Sicherheit

- **Pausieren** / **Fortsetzen** — lehnt alle Änderungen durch die KI vorübergehend ab. Lesen bleibt erlaubt und die Bridge bleibt aktiv. Die Schaltfläche leuchtet rot, solange die Änderungen durch die KI pausiert sind.
- **Schreibgeschützt** — lehnt alle ändernden Werkzeuge ab, solange diese Option eingeschaltet ist.
- **Automatische Sicherung: ein** / **Automatische Sicherung: aus** — schreibt vor der ersten KI-Änderung pro Dokument automatisch eine IFC-Sicherung. Standard: ein.
- **Jetzt sichern** — schreibt sofort eine Sicherung und meldet den Dateinamen. Nur in der Desktop-App.
- **Sicherungsordner öffnen** — öffnet den Ordner mit den Sicherungen. Nur in der Desktop-App.

### KI › Aktivität

- **Aktivitätspanel** — zeigt oder verbirgt das Panel *KI-Aktivität* mit den Aufrufen der Bridge, mit ihren Argumenten und Antworten.
