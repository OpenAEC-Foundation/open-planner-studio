# Ressourcen-Panel

Das Ressourcen-Panel ist der Ort, an dem Sie Ressourcen verwalten: wer und was verfügbar ist, mit welcher Kapazität und an welchem Kalender. Das Histogramm unter dem Gantt und die Überlastung gehören dazu. Dieser Artikel beschreibt für jedes Feld und jede Schaltfläche, was es tut, was der Standard ist und was Sie davon bemerken. Wie Sie Ressourcen anlegen und zuweisen, steht in [Ressourcen verwalten](docs://howto-resources-beheren) und [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen). Das Auflösen einer Überlastung steht in [Überlastung auflösen](docs://howto-overbezetting-oplossen).

## Wo Sie es finden

- **Vollständiges Panel** — *Ressourcen › Verwalten › Ressourcen* oder *Ansicht › Bereiche › Ressourcen*. Es nimmt den ganzen Arbeitsbereich ein; das Kreuz oben rechts schließt es.
- **Ressourcen-Dock** — *Ressourcen › Verwalten › Ressourcen-Dock* oder *Ansicht › Bereiche › Ressourcen-Dock*: eine kompakte Liste in der rechten Spalte neben dem Gantt. Siehe unten.
- **Histogramm** — *Ressourcen › Histogramm › Histogramm* oder *Ansicht › Bereiche › Histogramm*: ein Streifen unter dem Gantt. Siehe unten.
- **Ansichten** — Wenn Ihr Projekt zu einer Ressourcenbibliothek gehört, bietet das Panel oben rechts die Wahl zwischen *Bibliothek*, *Projekt* und *Belegung*. Ohne Ressourcenbibliothek gibt es nur die Projekttabelle. Jedes Mal, wenn Sie das Panel öffnen, startet es auf *Projekt*. So landen Sie nicht unbemerkt in der gemeinsamen Ressourcenbibliothek.

## Neue Ressource

- **Neue Ressource im Projekt** (in der Ansicht *Bibliothek*: *Neue Ressource in der Bibliothek*) — Schaltfläche oben rechts. Sie öffnet eine Entwurfszeile am Ende der Tabelle. Es wird nichts angelegt, bis Sie einen Namen eingeben und die Zeile verlassen oder Enter drücken. Klicken Sie außerhalb ohne Namen oder drücken Sie Esc, dann bleibt nichts zurück: keine Ressource und kein Schritt unter *Rückgängig*. Sie dürfen die Felder in beliebiger Reihenfolge ausfüllen. Alles wird auf einmal übernommen. Enter oder der Pfeil nach unten übernimmt die Zeile und öffnet eine neue Entwurfszeile. Shift+Enter oder der Pfeil nach oben übernimmt die Zeile und geht zurück in die Tabelle. Der Entwurfszeile fehlen das Ausklappfeld für die Kapazität, der Kalender-Stift und der Papierkorb. Diese Felder arbeiten mit einer Ressource, die es noch nicht gibt. Die Schaltfläche *Neue Ressource* unter *Ressourcen › Verwalten* tut dasselbe.
- **Rasternavigation** — In der Tabelle bewegen Enter und Shift+Enter sowie die Pfeile nach oben und unten den Cursor zwischen den Zeilen. Enter in der letzten Zeile öffnet eine neue Entwurfszeile.

## Die Ansicht Projekt

Die Tabelle mit dem, was dieses Projekt verwendet. Jede Zeile ist eine Ressource. Änderungen an Text und Tarif wirken, sobald Sie das Feld verlassen. Sie zählen als ein Schritt unter *Rückgängig*.

- **Farbe** — eine Farbauswahl. Standard: die erste freie Farbe aus der Palette. Wirkung: die Farbe des Ressourcen-Akzents unter den Balken im Gantt (*Ansicht › Baselines & Fortschritt › Ressourcen-Akzent*) und des Farbfelds im Dock.
- **Name** — der Name der Ressource. Ein leerer Name wird nicht übernommen; das Feld nimmt wieder den alten Namen.
- **Typ** — *Personal*, *Gerät*, *Material*, *Subunternehmer* oder *Kolonne*. Standard für eine neue Ressource: *Personal*. Wirkung: *Material* hat eine *Einheit* und zählt nicht in der Summe *Alle Ressourcen* des Histogramms. Der Kapazitätsabgleich überspringt Material. Eine *Kolonne* kann als *Kolonne* anderer Ressourcen gewählt werden. Die anderen Typen rechnen gleich.
- **Max. Einheiten** — wie viel der Ressource pro Tag zur Verfügung steht, eine Zahl über 0. Brüche sind erlaubt. Standard: 1. Wirkung: die Kapazität pro Tag. Ist die Last höher, ist die Ressource überlastet. Der Pfeil daneben klappt die *Zeitlich gestaffelte Kapazität* auf. Die Zahl neben dem Pfeil ist die Anzahl der Schritte.
- **Zeitlich gestaffelte Kapazität** — Schritte mit *Ab* (ein Datum) und *Max. Einheiten*. *Schritt hinzufügen* fügt einen Schritt mit heute und 1 hinzu. Ohne Schritte steht dort *Keine Schritte — die feste Max.-Einheitenzahl gilt immer.* Wirkung: Ab dem Datum eines Schritts gilt dessen *Max. Einheiten* statt des festen Wertes. Der letzte Schritt mit einem Datum an oder vor einem Tag gilt.
- **Kalender** — eine Liste mit *Projektkalender* (Standard), den Kalendern des Projekts und *+ Ressourcenkalender* für einen neuen. Der Stift (*Bearbeiten…*) öffnet den gewählten Kalender. Er ist für *Projektkalender* deaktiviert. Wirkung: die Tage, an denen die Ressource arbeitet. An einem freien Tag ist die Kapazität 0. Ist dann Arbeit geplant, ist die Ressource überlastet, mit dem Grund *Arbeitet an diesem Tag laut Kalender „…“ nicht*. Der Ressourcenkalender ändert die Daten eines Vorgangs nicht. Siehe [Kalenderfenster](docs://ref-kalenders).
- **Tarif/Stunde** — die Kosten pro Stunde. Ist das Feld leer, gibt es keinen Tarif. Eine ungültige Zahl setzt den vorherigen Wert wieder ein. Wirkung: kein Einfluss auf den Terminplan oder die Last. Der Tarif bestimmt die Spalte *Gesamt*. Er wird in der IFC-Datei gespeichert und beim Export nach MS Project (Standardtarif) und Primavera P6 XML (Preis pro Einheit) mitgeschrieben.
- **Gesamt** — nur lesbar: die geladenen Stunden × der Tarif, mit zwei Dezimalstellen. Ohne Tarif oder Last steht dort *—*. In der letzten Zeile addiert *Gesamt* alle Ressourcen. Die Stunden stammen von der letzten Berechnung und zählen Einheiten × Stunden pro Tag des Kalenders des Vorgangs. Sind sie veraltet? Drücken Sie *Berechnen*.
- **Einheit** — die Maßeinheit des Materials, zum Beispiel `m³`. Nur auszufüllen für den Typ *Material* (Hinweis: *Nur bei Ressourcen vom Typ Material auszufüllen.*). Wirkung: eine Beschriftung. Es rechnet nicht.
- **Kolonne** — die Kolonne, zu der die Ressource gehört, aus den Ressourcen vom Typ *Kolonne*. Standard: *Keine*. Wirkung: nur Gruppierung. Kapazität und Last einer Kolonne sind nicht die Summe ihrer Mitglieder.
- **Löschen** (der Papierkorb) — löscht die Ressource. Hat sie Zuweisungen, fragt die App zuerst: *„…“ hat … Zuweisung(en) — löschen?* Dazu gibt es ein Häkchen zum Bestätigen und ein Kreuz zum Abbrechen.
- **In die Ressourcenbibliothek** — nur wenn das Projekt zu einer Ressourcenbibliothek gehört, und nur für eine Ressource mit einem Namen, der noch nicht aus der Bibliothek stammt. Die Ressource wird in die Ressourcenbibliothek gelegt oder mit einem vorhandenen Element mit demselben Namen verknüpft. Die App meldet, was geschah (*Hinzugefügt.*, *War bereits in der Bibliothek vorhanden — jetzt verknüpft.* oder *Mit dem vorhandenen Bibliothekselement verknüpft — die Werte weichen ab, siehe die Markierung.*).
- **Von der Ressourcenbibliothek lösen** — das Lösen-Symbol auf einer Ressource, die aus der Ressourcenbibliothek stammt. Es entfernt die Herkunft. Danach sind alle Felder wieder frei.

Ohne Ressourcen steht dort *Noch keine Ressourcen. Fügen Sie eine hinzu, um zu beginnen.* Gehört das Projekt zu einer Ressourcenbibliothek, steht dort *Dieses Projekt verwendet noch keine Bibliotheksressourcen.* mit einem Hinweis.

### Ressourcen aus der Ressourcenbibliothek

Eine Ressource aus der Ressourcenbibliothek hat ein kleines Bibliothekssymbol (*Aus der Bibliothek*). Die Felder *Name*, *Typ*, *Tarif/Stunde* und *Einheit* sind dann nur Text (*Bibliothekswert — bearbeiten Sie ihn in der Bibliotheksansicht, oder lösen Sie diese Ressource von der Bibliothek.*). Der Grund: Die Ressourcenbibliothek bestimmt, was die Ressource ist. *Farbe*, *Max. Einheiten*, die Kapazitätsschritte, *Kalender* und *Kolonne* bleiben bearbeitbar, weil das Projekt entscheidet, wie viel und wann. Zwei Markierungen können erscheinen: *weicht ab — entscheiden* (ein Klick öffnet das Fenster *Ressourcenbibliothek verknüpfen*) und *nicht mehr in der Bibliothek*, mit der Schaltfläche *Aus Projekt entfernen*.

## Die Ansicht Bibliothek

Nur wenn das Projekt zu einer Ressourcenbibliothek gehört. Siehe [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken) und [Ressourcenbibliotheken verwalten und teilen](docs://howto-bibliotheken-beheren). Oben steht ein farbiger Hinweis: *Dies bearbeitet die Bibliothek und gilt für alle Projekte — außerhalb von Rückgängig.* Die Tabelle hat dieselben Felder wie die Ansicht *Projekt*, mit diesen Unterschieden:

- Es gibt keine Spalte *Gesamt*: Das ist eine Berechnung für ein einzelnes Projekt.
- Die Spalte *Kolonne* ist da, sobald die Ressourcenbibliothek Ressourcen hat.
- Die Spalte *Kalender* bietet die Kalender der Ressourcenbibliothek an, mit *Kein Kalender* als Standard.
- **Dem Projekt zuweisen** — legt die Ressource ins Projekt, mit einer Kopie ihres Kalenders. Meldet *Hinzugefügt.* oder *Bereits im Projekt vorhanden.*
- **Löschen** — fragt: *'…' aus der Bibliothek entfernen? Dies gilt für alle Projekte und kann nicht rückgängig gemacht werden.*
- Ohne Ressourcen steht dort *Noch keine Ressourcen im Pool.*

## Die Ansicht Belegung

Eine Ansicht nur zum Lesen über alle geöffneten Dokumente: Sie zeigt, welche Ressourcen aus der Ressourcenbibliothek wo gebucht sind. Es gibt keine Schaltfläche für eine neue Ressource. Siehe [Die Belegungsübersicht verwenden](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabelle** — pro Ressource der Ressourcenbibliothek: *Name*, *Dokumente* (die Anzahl der Dokumente, in denen sie vorkommt), *Zeitraum* und *Spitzenwert / Kapazität* (die höchste gemeinsame Last gegenüber der Kapazität an diesem Tag). Ein rot markierter Hinweis *N Tage doppelt belegt* bedeutet, dass die Ressource über mehrere Dokumente hinweg mehr als ihre Kapazität hat. Der Pfeil neben einem Namen klappt die Dokumente auf, jedes mit Zeitraum und Spitzenwert. Ein Klick auf eine Zeile zeigt das Histogramm dieser Ressource (*Wählen Sie eine Ressource aus, um das Histogramm zu sehen.*).
- **Was zählt** — nur Dokumente, die in dieser App geöffnet sind (*Diese Übersicht sieht nur die Dokumente, die in dieser App geöffnet sind.*). Ein Dokument, das nicht berechnet ist, bekommt in seiner Zeile eine Meldung. Das aktive Dokument zählt mit seinen letzten berechneten Werten (*Veraltet: dies sind die zuletzt berechneten Werte — drücken Sie F5 in diesem Dokument.*). Die Übersicht berechnet ein anderes Dokument vorab (*Für diese Übersicht bereits vorab berechnet — das Dokument selbst zeigt noch ältere Daten, bis Sie dort F5 drücken oder „Automatisch berechnen“ aktivieren.*). Ist *Automatisch berechnen* an, berechnet die Übersicht diese Dokumente wirklich. Schlägt die Berechnung fehl, zählt das Dokument nicht mit (*Zählt nicht mit: Terminplan nicht berechnet — aktivieren Sie dieses Dokument und drücken Sie F5.*). Ohne gebuchte Ressourcen steht dort *Keine Bibliotheksressourcen in den geöffneten Dokumenten gebucht.*
- **Reihenfolge** — Ressourcen mit Doppelbelegungen stehen oben, zuerst die mit den meisten Konflikttagen, dann alphabetisch.

## Das Ressourcen-Dock

Eine kompakte Liste in der rechten Spalte, neben dem Bereich *Eigenschaften*. Pro Ressource stehen dort ein Farbfeld, der Name (nur lesbar), ein rotes Dreieck *Überlastet*, sobald die Ressource mindestens einen überlasteten Tag hat, und *Max. Einheiten* zum Bearbeiten. Gibt es eine Vorgangsauswahl, stehen nur die Ressourcen dieser Vorgänge in der Liste. In der Kopfzeile stehen *Vollständiges Panel* (öffnet das vollständige Panel) und *Andocken schließen*. Ohne Ressourcen steht dort *Noch keine Ressourcen. Fügen Sie eine hinzu, um zu beginnen.*

## Das Histogramm

Ein Streifen unter dem Gantt, der die Last einer Ressource pro Tag zeigt. Schalten Sie ihn mit *Ressourcen › Histogramm › Histogramm* oder *Ansicht › Bereiche › Histogramm* ein oder aus. Standard: aus. Ihre Wahl wird gemerkt. Die Höhe beträgt standardmäßig 160 Pixel. Sie kann am Rand zwischen dem Gantt und dem Histogramm gezogen werden.

- **Auswahl** — links unter der Vorgangstabelle steht eine Liste: *Alle Ressourcen* oben angeheftet, darunter eine Zeile pro Ressource. Ein Klick auf eine Zeile wählt sie. Mit den Pfeiltasten geht man durch die Liste. *Ressourcen › Histogramm › Vorherige* und *Nächste* tun dasselbe. Ein roter Punkt neben einer Zeile bedeutet, dass diese Ressource mindestens einen überlasteten Tag hat. Bei *Alle Ressourcen* schaut der Punkt nur auf Ressourcen, die kein Material sind. Gibt es eine Vorgangsauswahl, enthält die Liste nur die Ressourcen dieser Vorgänge. Liegt Ihre gewählte Ressource außerhalb, zeigt der Streifen vorübergehend *Alle Ressourcen* der Auswahl.
- **Balken** — ein Balken pro Tag: die Last in Einheiten. Eine Linie zeigt die Kapazität. Der Teil des Balkens über der Kapazität ist rot. Oben links steht der höchste Wert mit *Einheiten*. *Alle Ressourcen* addiert die Last und die Kapazität aller Ressourcen, außer Material.
- **Tooltip** — halten Sie die Maus einen Moment still über einem Tag: *N Vorgänge tragen bei am {date}* mit den Namen von höchstens acht Vorgängen. Für eine gewählte Ressource und einen Tag, an dem ihr Kalender nicht arbeitet, steht dort außerdem *Arbeitet an diesem Tag laut Kalender „…“ nicht*.
- **Meldungen im Streifen** — *Neu berechnen (F5), um die Auslastung anzuzeigen*, solange es keine Last gibt. Die Meldung *Noch keine Ressourcen* steht dort, wenn es keine Ressourcen gibt. Oben rechts steht *⚠ Terminplan nicht mehr aktuell — neu berechnen (F5)*, wenn der Terminplan veraltet ist.
- **Was zählt** — die Einheiten pro Tag jeder Zuweisung, verteilt über die Arbeitstage des Vorgangs gemäß der *Kurve* (oder der *Stundenverteilung*). Nur Blattvorgänge zählen, keine Meilensteine. Die Last wird nach *Berechnen* und nach Änderungen an Ressourcen und Zuweisungen aktualisiert. Ändern Sie die Daten von Vorgängen, zählt das erst nach *Berechnen*.

## Überlastung

Eine Ressource ist an einem Tag überlastet, wenn ihre Last höher ist als ihre Kapazität. Die Kapazität ist *Max. Einheiten* (mit den Kapazitätsschritten) an einem Arbeitstag ihres Kalenders. An einem freien Tag ist sie 0. Material zählt hier mit. Der Grund ist entweder zu wenig Kapazität oder ein Tag, an dem die Ressource laut ihrem Kalender nicht arbeitet.

Wo Sie es sehen:

- **Ressourcen › Überlastung** — die Anzahl der überlasteten Ressourcen, oder *Keine*.
- **Statusleiste** — *N Ressource(n) überlastet*. Ein Klick öffnet das Panel *Warnungen*.
- **Warnungen** — eine Zeile pro Ressource: *Überlastet an N Tag(en) (erster – letzter)*. Ist jeder dieser Tage ein freier Tag, kommt der Hinweis *die Ressource arbeitet an diesen Tagen laut ihrem Kalender nicht* hinzu. Bei einer Mischung kommt der Hinweis *davon N Tag(e), an denen die Ressource laut ihrem Kalender nicht arbeitet* hinzu. Siehe [Hinweise und Warnungen](docs://ref-meldingen).
- **Histogramm** — die roten Teile der Balken und der rote Punkt in der Auswahl.
- **Dock** — das Dreieck *Überlastet*.

Der Kapazitätsabgleich kann Überlastung lösen, indem er Vorgänge später beginnen lässt. Standardmäßig darf sich das Projektende verschieben; mit *Glättung* bleibt es innerhalb des Puffers. Er löst keine Ressource, die an einem freien Tag arbeiten müsste. Siehe [Kapazitätsabgleich](docs://uitleg-nivelleren).
