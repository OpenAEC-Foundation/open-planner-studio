# Mit mehreren Projekten gleichzeitig arbeiten

Ziel: Mehr als einen Terminplan gleichzeitig geöffnet haben, zwischen ihnen wechseln und sie getrennt schließen.

## Wann Sie das brauchen

Sie arbeiten am Wohnungsbau im Quartier. Aber die Baustellenbesprechung betrifft auch die Renovierung des Clubhauses. Oder Sie wollen eine Variante neben dem Original behalten. Jedes Projekt hat eine eigene Registerkarte mit eigenen Vorgängen, eigener Berechnung und eigenem Zeitfenster. Zum Wechseln genügt ein Klick, und Sie verlieren nichts.

## Schritte

### Ein zweites Projekt öffnen

1. Klicken Sie auf das Pluszeichen rechts neben den Registerkarten (*Projekt starten*). Das Fenster *Projekt starten* öffnet sich.
2. Wählen Sie *Neues Projekt* für einen leeren Terminplan oder *Bestehendes Projekt öffnen*, um eine Datei auszuwählen. *Abbrechen* schließt das Fenster.
3. Mit *Neues Projekt* füllen Sie das Fenster *Neues Projekt* aus und klicken auf *Erstellen*.

Das Projekt erscheint in einer eigenen Registerkarte und ist sofort aktiv. *Neu* und *Öffnen* im Menüband, Strg+O und die Beispiele unter *Datei › Beispiele* öffnen ein Projekt ebenfalls in einer neuen Registerkarte. Nur ein neuer, leerer Terminplan, den Sie noch nicht bearbeitet haben, wird wiederverwendet, statt eine Registerkarte hinzuzufügen.

### Zwischen Projekten wechseln

- Klicken Sie auf die Registerkarte des Projekts.
- Drücken Sie Strg+1 bis Strg+9 (⌘ statt Strg unter macOS) für das Projekt an dieser Stelle in der Reihe, von links nach rechts gezählt.
- Klicken Sie auf das Menüsymbol links neben den Registerkarten (*Alle Projekte*). Die Übersicht *Offene Projekte* zeigt pro Projekt eine Karte mit dem Namen, dem Dateinamen (wenn das Projekt eine Datei hat), einer Miniaturansicht des Terminplans, der Anzahl der Vorgänge, der Anzahl der kritischen Vorgänge und dem Enddatum. Klicken Sie auf eine Karte, um dorthin zu wechseln. Esc schließt die Übersicht.

Jede Registerkarte hat einen farbigen Punkt, der zu dem Projekt gehört. Eine Registerkarte mit einem kleinen Punkt dahinter hat nicht gespeicherte Änderungen.

Passen die Registerkarten nicht alle in die Breite, erscheinen zwischen den Registerkarten und dem Pluszeichen zwei Pfeile (*Registerkarten zum Anfang schieben* und *Registerkarten zum Ende schieben*). Jeder Klick verschiebt die Registerkarten um zwei. Ein Pfeil ist grau, wenn Sie schon am Anfang oder am Ende sind. Sie können auch mit dem Mausrad über den Registerkarten blättern. Die Registerkarte, die Sie wählen, rückt immer von selbst in die Sicht.

### Ein Projekt schließen

Klicken Sie auf das Kreuz neben dem Namen auf der Registerkarte (*Schließen*) oder auf das Kreuz auf einer Karte in der Übersicht. Ein Projekt ohne Änderungen wird sofort geschlossen. Hat es nicht gespeicherte Änderungen, zeigt die App die Meldung *Nicht gespeicherte Änderungen* mit drei Auswahlmöglichkeiten:

- *Speichern* speichert das Projekt und schließt es danach.
- *Nicht speichern* schließt das Projekt und verwirft die Änderungen.
- *Abbrechen* lässt das Projekt geöffnet.

Wenn Sie das Speichern abbrechen, zum Beispiel indem Sie den Dialog zum Speichern schließen, bleibt das Projekt geöffnet.

Wenn Sie das letzte Projekt schließen, bleibt ein leerer Terminplan mit dem Namen *Neue Planung* übrig.

### Den Wechselstil wählen

Sie können die Art der Registerkarten selbst wählen. Öffnen Sie das Fenster *App-Einstellungen* über das Zahnrad in der Titelleiste, wechseln Sie zur Registerkarte *Darstellung* und wählen Sie bei der Einstellung *Dokumentwechsel-Stil*:

- *Horizontale Registerkarten*: der Standard. Eine Reihe von Registerkarten unter dem Menüband.
- *Vertikale Registerkarten*: eine schmale Leiste links mit einer Schaltfläche pro Projekt (die ersten Buchstaben des Namens) und einem Pluszeichen. Wenn Sie mit der Maus über eine Schaltfläche fahren, sehen Sie Name, Dateiname, Anzahl der Vorgänge, Anzahl der kritischen Vorgänge und Enddatum. Die Schaltfläche oben öffnet die Übersicht.
- *Pille*: eine Pille in der Titelleiste mit dem Namen des aktiven Projekts und einem Zähler wie *2 geöffnet*. Klicken Sie darauf, um die Übersicht zu öffnen und dort zu wechseln.

Alle drei Stile öffnen dieselbe Übersicht, und Strg+1 bis Strg+9 funktioniert in jedem Stil.

## Stolperfallen und was die App macht

**Was zum Projekt gehört und was gemeinsam ist.** Jedes Projekt hat seine eigene Ansicht: Zoom und Position, ein aktives Layout mit Filter, Gruppierung oder Sortierung, geteilte Ansicht, die Beziehungslinien und die eingeklappten Phasen. Wenn Sie zu einem anderen Projekt wechseln, sehen Sie dort dessen eigene Ansicht. Allen Projekten gemeinsam sind die gewählte Registerkarte im Menüband, die Minimap, die Overlays (Baseline-Overlay, Fortschrittslinie und die übrigen), Ihre Spaltenauswahl, Ihre Layouts und Ihre Auswahl für Berichte.

**Sie können nicht mit einem offenen Dialog wechseln.** Solange ein Dialog offen ist, zum Beispiel das Fenster *App-Einstellungen* oder ein Vorgangsfenster, tun Strg+1 bis Strg+9 in der App nichts. Im Browser wechseln die Tasten dann die Browser-Registerkarten. Schließen Sie zuerst den Dialog. Eine nicht übernommene Änderung in *Projekteinstellungen* im Backstage blockiert das Wechseln ebenfalls.

**Strg+1 bis Strg+9 zählen nach Reihenfolge.** Die Tastenkombination führt zu dem Projekt an dieser Stelle in der Reihe. Wenn Sie ein Projekt schließen, rücken die anderen Plätze auf. Wenn mehr als neun Projekte offen sind, erreichen Sie die übrigen nur über die Registerkarten oder die Übersicht.

**Berechnen und Berichte wirken auf das aktive Projekt.** Berechnen (F5), *PDF exportieren* und die Berichte betreffen das Projekt, das jetzt aktiv ist.

## Siehe auch

- [Erstellen und Verwenden eines Layouts](docs://howto-layouts-gebruiken): Einrichten einer Ansicht pro Projekt.
- [Erstellen und Drucken eines Berichts](docs://howto-rapport-maken-en-afdrukken): der Bericht des aktiven Projekts.
