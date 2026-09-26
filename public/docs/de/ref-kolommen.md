# Spalten wählen

Die **Tabelle** (Registerkarte **Tabelle**) und die Aufgabenliste neben dem Gantt haben jeweils eigene Spalten. Sie ändern sie in der Tabelle selbst: Das Plus im Tabellenkopf öffnet die Spaltenauswahl, und im Spaltenkopf verschieben Sie eine Spalte, ändern ihre Breite, heften sie an oder entfernen sie. Jede Änderung wirkt sofort; es gibt keinen OK-Schritt.

Standardmäßig zeigt die Aufgabenliste neben dem Gantt **Projektstrukturplan (PSP)**, **Aufgabenname** und **Dauer**. Die Tabelle zeigt zusätzlich **Anfang**, **Ende**, **Aufgabentyp**, **Kritisch**, **Gesamtpuffer** und **Fortschritt** sowie die Aufgabencodes und benutzerdefinierten Felder des Projekts.

## Die Spaltenauswahl öffnen

- Das Plus rechts im Tabellenkopf. Die Tabelle und die Aufgabenliste neben dem Gantt haben jeweils ein eigenes Plus, das nur die eigene Tabelle ändert.
- Registerkarte **Tabelle** → **Spalten…** öffnet die Spaltenauswahl der Tabelle.
- Sind die klassischen Ansichtsschaltflächen eingeschaltet (**Einstellungen** → Registerkarte **Erweitert** → **Legacy-Funktionen** → **Klassische Ansichtsschaltflächen anzeigen**), macht **Ansicht** → Menübandgruppe **Anzeige** → **Spalten…** dasselbe: Die Schaltfläche wechselt zur Registerkarte Tabelle und öffnet dort die Spaltenauswahl.

**Esc**, ein Klick außerhalb der Auswahl oder ein weiterer Klick auf das Plus schließt die Auswahl.

## Eine Spalte hinzufügen

Die Spaltenauswahl **Spalte auswählen** enthält von oben nach unten:

- **Zuletzt verwendet** — Felder, die Sie kürzlich mit der Auswahl hinzugefügt haben. Dieser Block erscheint, sobald Sie eine Spalte hinzugefügt haben.
- Das Suchfeld **Suchen** — tippen Sie einen Teil eines Feldnamens; die **Suchergebnisse** kommen aus allen Gruppen.
- Die Felder nach Gruppe: **Aufgabe**, **Planung**, **Einschränkungen**, **Beziehungen**, **Ressourcen**, **Fortschritt**, **Berechnet**, **Basisplan**, **Benutzerdefiniert** und **Technisch**. Ein Klick auf eine Gruppe klappt sie auf; die Zahl daneben ist die Anzahl der Felder in dieser Gruppe.
- Ganz unten die Schaltfläche **Auf Standard zurücksetzen** (siehe unten).

Klicken Sie auf ein Feld, um es als letzte Spalte hinzuzufügen; die Auswahl schließt sich dann. Ein Feld, das bereits eine Spalte ist, ist abgehakt und lässt sich nicht noch einmal wählen. Die Aufgabencodes und benutzerdefinierten Felder des Projekts stehen unter **Benutzerdefiniert**, die Felder Ihrer Basispläne unter **Basisplan**.

Unter **Berechnet** stehen unter anderem die Analysefelder **Freier Puffer**, **Störender Puffer**, **Nahezu kritisch** und **Pufferpfad**. Sie erhalten erst nach einer Berechnung (**F5**) Werte, und **Nahezu kritisch** und **Pufferpfad** nur, wenn die passende Terminplanungsoption eingeschaltet ist — siehe [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse).

## Spalten im Spaltenkopf anpassen

- **Verschieben** — ziehen Sie einen Spaltenkopf an eine andere Stelle. Angeheftete Spalten bleiben vorne zusammen; eine lose Spalte verschieben Sie nur zwischen den losen Spalten.
- **Breite** — ziehen Sie den rechten Rand eines Spaltenkopfs (40 bis 480 Pixel). Ein Doppelklick auf diesen Rand passt die Spalte an Kopf und längsten Wert an. Mit der Tastatur: Setzen Sie den Fokus auf den Rand und verwenden Sie Pfeil links und Pfeil rechts, mit **Umschalt** für größere Schritte.
- **Entfernen** — das Minuszeichen, das im Spaltenkopf erscheint, wenn Sie den Zeiger darüber bewegen. Das Feld bleibt in der Spaltenauswahl wählbar.
- **Rechtsklick** auf einen Spaltenkopf bietet **Anheften** (oder **Lösen**), **Automatisch anpassen** und **Entfernen**. Eine angeheftete Spalte rückt nach vorne zu den anderen angehefteten Spalten und bleibt sichtbar, wenn Sie die Tabelle seitlich scrollen (solange die angehefteten Spalten zusammen in die Tabelle passen).

## Anfang, Ende und die geplanten Daten

**Anfang** und **Ende** (in der Standardanordnung der Tabelle) zeigen dieselben Daten wie der Balken im Gantt: die berechnete Planung und vor der ersten Berechnung die eingegebenen Daten. Tippen Sie bei Anfang ein anderes Datum ein, wird es zum geplanten Anfang. Ein anderes Ende ändert bei einer automatisch geplanten Aufgabe die Dauer; bei einer manuell geplanten Aufgabe wird es zum geplanten Ende. Drücken Sie danach **F5**, um neu zu berechnen. Tippen Sie dasselbe Datum wieder ein, ändert sich nichts.

Die Felder **Geplanter Anfang** und **Geplantes Ende** zeigen die eingegebenen Daten selbst, auch wenn die Berechnung die Aufgabe verschiebt. Geplantes Ende lässt sich nur bei einer manuell geplanten Aufgabe bearbeiten: Bei anderen Aufgaben bestimmen Anfang und Dauer das Ende. Anfang und Ende einer automatisch geplanten Sammelaufgabe ergeben sich aus den untergeordneten Aufgaben und lassen sich nicht bearbeiten.

## Auf Standard zurücksetzen

**Auf Standard zurücksetzen** steht unten in der Spaltenauswahl. Ein Klick setzt die Spalten dieser Tabelle auf die Standardanordnung zurück: welche Spalten angezeigt werden, ihre Reihenfolge und Breite sowie angeheftete Spalten. Zusätzlich hinzugefügte Felder verschwinden aus der Tabelle und bleiben in der Auswahl wählbar. So erhalten Sie nach einem Update auch den neuen Standard, zum Beispiel **Anfang** und **Ende** statt **Geplanter Anfang** und **Geplantes Ende**: Eine früher gespeicherte eigene Anordnung ändert sich nicht von selbst. Verwendet die Tabelle bereits den Standard, ist die Schaltfläche deaktiviert.

## Speichern, Rückgängig und Layouts

Die Spaltenanordnung ist eine persönliche Einstellung auf diesem Gerät: Sie gilt für alle Ihre Projekte und wird nicht in der Projektdatei gespeichert. Jede Spaltenaktion — Hinzufügen, Entfernen, Verschieben, Breite ändern, Anheften oder **Auf Standard zurücksetzen** — ist ein Schritt, den **Ctrl+Z** rückgängig macht.

Ein Layout kann auch die Spalten festhalten. Es übernimmt die Anordnung der Tabelle, die Sie beim Anlegen des Layouts sehen, und ein Klick auf die Layoutschaltfläche setzt sie in die Tabelle, die dann angezeigt wird: auf der Registerkarte Tabelle die Tabelle, auf den anderen Registerkarten die Aufgabenliste neben dem Gantt. Siehe [Layouts speichern und laden](docs://ref-layouts).

## Weiterlesen

- [Filter](docs://ref-filters) — welche Aufgaben die Tabelle und das Gantt zeigen.
