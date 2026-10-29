# Feiertage generieren und Bauferien

Ziel: Sie tragen die Feiertage eines Landes in einen Kalender ein, gegebenenfalls auch die Bauferien. Bei Bedarf fügen Sie einen eigenen freien Tag oder Zeitabschnitt hinzu.

## Wann Sie das brauchen

Ohne Feiertage plant die App einfach Arbeit an Weihnachten oder Koningsdag ein. Ein neues Projekt erhält bereits die niederländischen Feiertage, solange *Baumodus* eingeschaltet ist. Sie generieren die Feiertage erneut, wenn Sie ein anderes Land oder eine andere Region brauchen, wenn Sie die Bauferien einbeziehen möchten oder wenn Ihr Projekt außerhalb der Jahre liegt, für die Feiertage erstellt wurden. Diese Jahre sind wichtig: Für die App ist ein Tag außerhalb davon einfach ein Arbeitstag. Wie die App einen Feiertag beim Zählen berücksichtigt, lesen Sie in [Kalender und Arbeitstage](docs://uitleg-kalenders).

Die **Bauferien** (*bouwvak*) sind der gemeinsame Urlaub in der niederländischen Bauwirtschaft, drei Wochen im Sommer. In der App sind sie standardmäßig ausgeschaltet.

## Schritte

### Feiertage generieren

1. Wählen Sie *Planung › Kalender › Kalender* und wählen Sie links den Kalender, in den die Feiertage kommen müssen.
2. Klicken Sie auf *Feiertage generieren…*. Unter der Schaltfläche öffnet sich ein Bereich mit den Auswahlmöglichkeiten.
3. Wählen Sie das *Land*: Niederlande, Deutschland, Belgien, Frankreich, Vereinigtes Königreich, Österreich, Schweiz oder *Keine Feiertage*. Bei einigen Ländern erscheint außerdem eine Liste *Region*, zum Beispiel ein Bundesland in Deutschland. Mit *Landesweit* bleiben nur die Feiertage übrig, die überall gelten.
4. Wählen Sie für die Niederlande bei *Bauferien*: *Keine* (Standard), *Nord*, *Mitte* oder *Süd*. Die Bauferien erscheinen als ein Zeitabschnitt in der Liste, zum Beispiel *Bauferien (Nord)*, drei Wochen von Montag bis Freitag. Sie sehen diese Auswahl nur, wenn *Baumodus* eingeschaltet ist.
5. Unter den Auswahlmöglichkeiten steht eine Zusammenfassung, zum Beispiel *21 Feiertage, 2026–2028*. Klicken Sie darauf, um die Daten zu sehen.
6. Klicken Sie auf *Generieren*. Die Liste *Feiertage* ist nun gefüllt.
7. Klicken Sie auf *Anwenden*. Der Terminplan wird sofort neu berechnet.

Für die Niederlande trägt die App jedes Jahr Nieuwjaar, Goede Vrijdag, Pasen (zwei Tage), Koningsdag, Hemelvaart, Pinksteren (zwei Tage) und Kerst (25. und 26. Dezember) in die Liste ein (Neujahr, Karfreitag, Ostern, Königstag, Christi Himmelfahrt, Pfingsten und Weihnachten). Fällt Koningsdag auf einen Sonntag, ist er am 26. April. Bevrijdingsdag (Tag der Befreiung) steht nur in Lustrumjahren in der Liste, zum Beispiel 2025 und 2030.

Die Jahre richten sich nach der Projektlaufzeit: vom Jahr vor dem Anfangsdatum bis zum Jahr nach dem Enddatum. Hat das Projekt kein Enddatum, gelten bis zu drei Jahre nach dem Jahr des Anfangs. Anfang und Ende passen Sie unter *Einstellungen › Projekt › Projekteinstellungen* an.

### Nach einer neuen Projektlaufzeit neu generieren

Verschiebt sich Ihr Projekt oder bekommt es ein späteres Enddatum, decken die Feiertage die neuen Jahre nicht mehr ab. Die App meldet das im Fenster *Kalender*, zum Beispiel *Feiertage decken 2025–2028 ab; bis 2030 neu generieren?* Klicken Sie dann auf *Neu generieren*. Die App verwendet dieselben Auswahlmöglichkeiten wie beim letzten Mal (Land, Region, Bauferien) für die Jahre des Projekts. Klicken Sie danach auf *Anwenden*. Diese Meldung sehen Sie nur bei einem Kalender, dessen Feiertage früher generiert wurden.

### Einen eigenen freien Tag oder Zeitabschnitt hinzufügen

1. Klicken Sie im Fenster *Kalender* auf *Feiertag hinzufügen*. Unten in der Liste erscheint eine neue Zeile mit dem heutigen Datum unter *Ab*.
2. Füllen Sie die *Beschreibung* aus, zum Beispiel *Firmenausflug*.
3. Passen Sie *Ab* an. Lassen Sie *Bis* leer für einen Tag, oder tragen Sie den letzten freien Tag eines Zeitabschnitts ein, zum Beispiel für die Winterferien.
4. Klicken Sie auf *Anwenden*.

Mit dem Papierkorb hinter einer Zeile entfernen Sie einen Feiertag.

### Alle Feiertage entfernen

Wählen Sie unter *Land* die Option *Keine Feiertage* und klicken Sie auf *Generieren*. Die Liste ist danach leer.

## Fallstricke und was die App dann tut

**Beim Generieren wird die ganze Liste ersetzt.** Auch die Tage, die Sie selbst hinzugefügt haben, verschwinden. Fügen Sie sie danach wieder hinzu.

**Goede Vrijdag ist enthalten.** Wenn Ihr Unternehmen am Karfreitag oder am Bevrijdingsdag in einem Lustrumjahr arbeitet, entfernen Sie diese Zeile mit dem Papierkorb.

**Die Daten der Bauferien sind Richtwerte.** Die App kennt sie für 2025 bis einschließlich 2028; für andere Jahre schätzt sie grob. Haben Sie die Bauferien gewählt, zeigt die App deshalb *Richtwerte — bitte bei Bouwend Nederland prüfen*. Passen Sie den Zeitabschnitt bei Bedarf in der Liste an.

**Eine ungültige Zeile.** Eine Zeile ohne gültiges *Ab*, ein *Bis*, das vor *Ab* liegt, oder ein unlesbares Datum zeigt eine rote Meldung, zum Beispiel *Das Enddatum liegt vor dem Anfangsdatum.* *Anwenden* ist deaktiviert, bis Sie den Fehler beheben.

**Bei einem neuen Projekt.** Das Fenster *Neues Projekt* hat dieselben Auswahlmöglichkeiten unter *Feiertagsset*. Mit *Benutzerdefiniert…* starten Sie ohne Feiertage. Nach dem Erstellen öffnet sich das Fenster *Kalender*, damit Sie die Feiertage selbst eintragen können.

## Siehe auch

- [Kalender und Arbeitstage](docs://uitleg-kalenders): wie die App Feiertage und die Bauferien beim Zählen der Arbeitstage berücksichtigt.
- [Einen Kalender erstellen und zuweisen](docs://howto-kalender-maken-en-toewijzen): einen eigenen Kalender erstellen, in den Sie Feiertage eintragen.
- [Kalenderfenster](docs://ref-kalenders): alle Felder der Kalenderfenster.
- [Neues Projekt und Projekteinstellungen](docs://ref-projectinfo): das Feiertagsset für ein neues Projekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): Neben den Feiertagen hat der Projektkalender einen freien Zeitabschnitt *Frost delay, foundations*.
