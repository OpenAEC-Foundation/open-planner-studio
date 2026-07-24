# Codes & Felder (Struktur-Dialog)

Das Fenster **Codes & Felder** verwaltet die Strukturdefinitionen des Projekts: **Aufgabencodes** (frei definierbare Dimensionen wie Standort oder Disziplin) und **benutzerdefinierte Felder** (typisierte Benutzerfelder). Die Werte pro Aufgabe werden dann über den Eigenschaftenbereich oder den [Aufgabendialog](docs://ref-taakdialoog) ausgefüllt.

## Öffnen

**Planung** → Menübandgruppe **Struktur** → **Codes & Felder**. **Esc**, das Schließen-Kreuz oder ein Klick außerhalb des Fensters schließt es. Alle Änderungen wirken sofort (und sind mit Ctrl+Z rückgängig zu machen) — es gibt keine separate Speichern-Schaltfläche.

## Aufgabencodes

„Frei definierbare Dimensionen (z.B. Standort, Disziplin) zum Gruppieren und Filtern — höchstens ein Wert pro Typ und Aufgabe."

Ein Block pro Codetyp:

- **Codetyp-Name** — direkt editierbar.
- **Codetyp entfernen** (Papierkorb) — entfernt den Typ inklusive aller Werte und der Zuweisungen auf Aufgaben.
- Eine Zeile pro Wert: **Code** (kurzes Label), **Beschreibung** und eine **Farb**-Auswahl (Farben gruppieren unter anderem), plus eine Entfernen-Schaltfläche.
- **Wert hinzufügen** — neuer Wert unter diesem Typ.

Ganz unten: Eingabefeld **Neuer Codetyp (z.B. Standort)** + Schaltfläche **Codetyp hinzufügen** (Enter funktioniert ebenfalls).

## Benutzerdefinierte Felder

„Typisierte Benutzerfelder, die als Spalten in der Tabelle erscheinen und pro Aufgabe editierbar sind."

Eine Zeile pro Feld: der **Name** (direkt editierbar), der **Typ** (nach Erstellung schreibgeschützt) und eine Entfernen-Schaltfläche.

Ganz unten: Eingabefeld **Neues Feld (z.B. Auftragnehmer)**, eine Typ-Auswahl — **Text**, **Zahl**, **Ganze Zahl**, **Kosten**, **Datum** oder **Ja/Nein** — und die Schaltfläche **Feld hinzufügen** (Enter funktioniert ebenfalls). Der Typ lässt sich nach Erstellung nicht mehr ändern; legen Sie bei Bedarf ein neues Feld an.

## Wo die Definitionen auftauchen

- Als Abschnitt **Codes & Felder** pro Aufgabe im Eigenschaftenbereich und im Aufgabendialog.
- Als Spalten in der Tabellenansicht (benutzerdefinierte Felder) und als Gruppierungs-/Filter-Dimension (Aufgabencodes).

## Weiterlesen

- [Planung & WBS](docs://gids-plannen-wbs) — einen Terminplan strukturieren, einschließlich Codes und Feldern in der Praxis.
