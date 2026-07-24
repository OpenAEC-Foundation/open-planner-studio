# Filter

Das Fenster **Filter** steuert, welche Aufgaben sichtbar sind — im Gantt und auf der Registerkarte Tabelle. Ein Filter besteht aus Regeln (Feld + Operator + Wert), optional zu Gruppen gebündelt.

## Öffnen

**Ansicht** → Menübandgruppe **Anzeige** → **Filter…**. Die Schaltfläche bleibt hervorgehoben, solange ein Filter aktiv ist. **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters schließt, ohne anzuwenden.

## Gruppen: alle oder eine

Oben in jeder Gruppe wählen Sie, wie sich ihre Regeln verbinden:

- **Alle folgenden (AND)** — eine Aufgabe muss jeder Regel entsprechen.
- **Eine der folgenden (OR)** — eine Regel zu genügen reicht.

**+ Regel** fügt eine Regel hinzu; **+ Gruppe** (nur oberste Ebene) fügt eine verschachtelte Gruppe hinzu, sodass Sie AND und OR kombinieren können — zum Beispiel „Kritisch ist ja UND (Typ ist Bau ODER Typ ist Installation)". Ohne Regeln zeigt das Fenster: „Noch keine Regeln — dieser Filter zeigt alles."

## Eine Regel: Feld, Operator, Wert

- **Feld** — alle Aufgabenfelder: WBS, Aufgabenname, Dauer, Anfang, Ende, Typ, Kritisch, Gesamtpuffer, Fortschritt, Meilenstein, Freier Puffer, Interferierender Puffer, Beinahe kritisch, Pufferpfad und Ressourcen, plus die Aufgabencodes und benutzerdefinierten Felder des Projekts.
- **Operator** — passt sich dem Feldtyp an:
- Text: **gleich**, **ungleich**, **enthält**, **beginnt mit**, **ist leer**;
- Zahl und Datum: zusätzlich **kleiner als**, **kleiner oder gleich**, **größer als**, **größer oder gleich** und **zwischen** (mit **Von**/**Bis**);
- Ja/Nein-Felder (wie Kritisch und Meilenstein): eine Wahl **Ja**/**Nein**;
- Auswahlfelder (wie Typ oder ein Aufgabencode): **ist eines von**, mit ankreuzbaren Werten.
- **Wert** — die Eingabe folgt dem Feldtyp (Textfeld, Zahl, Datum oder Auswahl); **ist leer** hat keine Wert-Eingabe.

Das Papierkorb-Symbol hinter einer Regel entfernt diese Regel; das Kreuz oben rechts an einer verschachtelten Gruppe entfernt die ganze Gruppe.

## Anwenden, Abbrechen und Löschen

- **Anwenden** aktiviert den Filter und schließt das Fenster. Ein Filter ohne Regeln gilt als „kein Filter".
- **Abbrechen** schließt, ohne die Änderungen anzuwenden.
- **Löschen** schaltet den aktiven Filter sofort aus und leert den Editor.

Ein aktiver Filter ist Teil eines gespeicherten Layouts — siehe [Layouts speichern und laden](docs://ref-layouts).

## Weiterlesen

- [Spalten wählen](docs://ref-kolommen) — welche Spalten die Tabelle zeigt.
