# Neues Projekt und Projekteinstellungen

Die Felder des Fensters *Neues Projekt* und des Fensters *Projekteinstellungen*: was jedes Feld tut, was der Standard ist und wo es wirkt. Es sind zwei Seiten desselben Formulars. *Neues Projekt* legt ein neues Projekt an und hat ein paar zusätzliche Felder. *Projekteinstellungen* ändert das Projekt, das Sie geöffnet haben.

## Öffnen

**Neues Projekt** — *Datei › Neu*, Strg+N, oder das Plus rechts neben den Registerkarten der Dokumente (*Projekt starten*, danach *Neues Projekt*). Das Fenster öffnet sich mit dem Cursor im Feld *Projektname*.

**Projekteinstellungen** — *Einstellungen › Projekt › Projekteinstellungen* öffnet das Formular als Fenster mit dem Titel *Projekteinstellungen*. *Datei › Projekteinstellungen* zeigt dasselbe Formular im Bereich *Datei*. Der Block *Berechnungsprofil und Berechnungsoptionen* steht unten an beiden Stellen; was darin steht, steht unter [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies).

## Erstellen, Anwenden und Abbrechen

**Erstellen** (im Fenster *Neues Projekt*) legt das Projekt an. Ist Ihre aktuelle Registerkarte leer und unverändert, verwendet die App diese Registerkarte. Sonst öffnet sich das Projekt auf einer neuen Registerkarte. **Anwenden** (im Fenster *Projekteinstellungen*) schreibt Ihre Änderungen in das Projekt.

- **Nur bei Anwenden.** Sie tippen in einen Entwurf. Das Projekt ändert sich erst, wenn Sie auf *Anwenden* klicken. *Anwenden* schreibt nur das, was Sie tatsächlich geändert haben, in einem Schritt im Verlauf von *Rückgängig*. Wenn Sie ohne Änderung auf *Anwenden* klicken, geschieht nichts, und es wird kein Schritt hinzugefügt.
- **Abbrechen, das Kreuz und Esc** schließen das Fenster, ohne etwas zu speichern. Ein Klick neben das Fenster schließt es nicht: Was Sie eingetippt haben, bleibt erhalten.
- **Eingabetaste** macht dasselbe wie *Erstellen* oder *Anwenden*, außer im Feld *Beschreibung* und in einer geöffneten Auswahlliste.
- **Im Dateibereich** zeigt *Projekteinstellungen* unten *Änderungen nicht angewendet — klicken Sie auf Anwenden, um sie zu behalten.*, solange Ihr Entwurf abweicht. Verlassen Sie danach den Bereich. Dann fragt die App, ob Sie anwenden, verwerfen oder abbrechen möchten. Siehe [Das Menüband, Registerkarte für Registerkarte](docs://ref-lint).
- **Ein benutzerdefiniertes Berechnungsprofil ohne Namen** blockiert *Anwenden* und *Erstellen*. Geben Sie ihm einen Namen oder verwerfen Sie die Änderung.

## Felder in beiden Fenstern

**Projektname** — der Name des Projekts in der Titelleiste, auf der Registerkarte und im Dateinamen beim Speichern. Standard: leer. Ein leeres Feld ist erlaubt: Das Projekt heißt dann *Neue Planung* und wird als grauer Text im Feld angezeigt. Wo: der ganze Bildschirm.

**Beschreibung** — freier Text. Standard: leer. Wirkung: wird mit dem Projekt gespeichert, in der IFC-Datei und im Export nach Primavera P6 XML, und hat keinen Einfluss auf den Terminplan.

**Autor** — freier Text. Standard: leer. Wirkung: wird in die IFC-Datei übernommen und erscheint als *Autor:* in der Kopfzeile eines Berichts. Dort können Sie ihn nicht ändern.

**Ressourcenbibliothek** — mit welcher Ressourcenbibliothek das Projekt verknüpft ist. Wählen Sie aus *keine (eigenständiges Projekt)*, Ihren vorhandenen Bibliotheken und *+ Neue Ressourcenbibliothek…*. Standard: im Fenster *Neues Projekt* die Standardbibliothek, im Fenster *Projekteinstellungen* die aktuelle Verknüpfung. Wirkung: siehe [Die Ressourcenbibliothek verwenden](docs://howto-resourcebibliotheek-gebruiken). Mit *+ Neue Ressourcenbibliothek…* geben Sie unten in einem Feld einen Namen ein. Die Bibliothek wird erst bei *Erstellen* oder *Anwenden* angelegt. Abbrechen lässt also nichts zurück. Eine Verknüpfung im Fenster *Projekteinstellungen* ändert sich nur, wenn Sie dieses Feld selbst bearbeiten.

**Auftraggeber/Organisation** — freier Text. Standard: leer. Wirkung: wird in die IFC-Datei übernommen und erscheint als *Unternehmen:* in der Kopfzeile eines Berichts.

**Startdatum** — der Projektstart. Standard: im Fenster *Neues Projekt* heute. Was das Feld bewirkt, steht unten unter *Was das Startdatum bewirkt*.

**Enddatum** — das geplante Projektende. Standard: leer. Wirkung: eine Angabe, keine Vorgabe. Die App plant nicht auf dieses Datum hin. Das Datum erscheint in der Kopfzeile eines Berichts und in Exporten, und es bestimmt, bis zu welchem Jahr die Feiertage erzeugt werden. Nur bei einer Primavera-Datei mit der Einstellung *Puffer bis zum Projektendtermin berechnen* (siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies)) läuft die Pufferberechnung bis zu diesem Datum.

**Standardeinheit für neue Vorgänge** — nur sichtbar, wenn *Stundenplanung aktivieren* eingeschaltet ist. Wählen Sie aus *Tage* und *Stunden*. Standard: *Tage*. Wirkung und Voraussetzungen: siehe [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten).

**Berechnungsprofil und Berechnungsoptionen** — im Fenster *Projekteinstellungen* der ganze Block. Im Fenster *Neues Projekt* nur die Auswahlliste *Berechnungsprofil* mit *Primavera P6*, *Microsoft Project* und *Open Planner Studio*. Standard: *Open Planner Studio*. Ein gewähltes Profil setzt auch die Standardoptionen dieses Profils. Siehe [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies).

## Nur im Fenster Projekteinstellungen

**IFC-Schema beim Speichern** — welches IFC-Schema in der Kopfzeile der gespeicherten Datei steht. Auswahl aus *IFC 4.3 ADD2 (Standard)*, *IFC 4.3* und *IFC4*. Standard: *IFC 4.3 ADD2 (Standard)*; bei einer geöffneten IFC-Datei das Schema dieser Datei. Wirkung: nur die Kopfzeile der Datei ändert sich, nicht der Inhalt. Verwenden Sie es, um den Terminplan mit einem Gebäudemodell im selben Schema zusammenzuführen. Hat eine geöffnete Datei ein anderes Schema als den Standard, fragt die App beim ersten Speichern, ob Sie dieses Schema behalten möchten. Eine Wahl hier zählt als Antwort. Eine Änderung hier ist kein Schritt in *Rückgängig*: Das Schema gehört zur Datei. Siehe [Das IFC-Schema wählen](docs://howto-ifc-schema-kiezen).

## Nur im Fenster Neues Projekt

**Phasenvorlage** — mit welchen Phasen das Projekt beginnt. Auswahl aus *Leer*, *Wohnungsbau* und *Gewerbebau / Sanierung*. Standard: *Leer*. Wirkung: *Leer* ergibt ein Projekt ohne Vorgänge. Die beiden anderen legen acht Vorgänge als Phasen an, jeweils mit einer Dauer von 5 in der Standardeinheit des Projekts (5 Arbeitstage, oder 5 Stunden, wenn Sie unter *Standardeinheit für neue Vorgänge* *Stunden* wählen), und ohne Beziehungen. Sie benennen, verschieben und verlängern sie selbst. Bei *Wohnungsbau* sind das: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking und Oplevering. Bei *Gewerbebau / Sanierung*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen und Oplevering. Die Namen sind Daten Ihres Projekts und bleiben Niederländisch, auch in einer anderen Oberflächensprache. Ist *Baumodus aktivieren* ausgeschaltet, gibt es nur *Leer*. Siehe [Einstellungen der App](docs://ref-instellingen).

**Schicht** — nur sichtbar, wenn *Stundenplanung aktivieren* eingeschaltet ist. Auswahl aus *Tagschicht*, *2 Schichten*, *3 Schichten* und *24/7*. Standard: *Tagschicht*. Wirkung: *Tagschicht* lässt den Standardkalender unverändert, einen gewöhnlichen Tageskalender von Montag bis Freitag. Die anderen drei setzen Arbeitszeitbänder in den Kalender des Projekts, wie die Schaltflächen mit demselben Namen im Fenster *Kalender*. Welche Zeiten das sind, steht unter [Arbeitszeiten festlegen](docs://howto-werktijden-instellen). Bei *Tagschicht* kann *Stunden* unter *Standardeinheit für neue Vorgänge* nicht gewählt werden, weil ein Tageskalender keine Arbeitszeitbänder hat.

**Feiertagsset** — welche freien Tage der Projektkalender erhält. Bei *Land* wählen Sie *Niederlande* (Standard), *Deutschland*, *Belgien*, *Frankreich*, *Vereinigtes Königreich*, *Österreich*, *Schweiz*, *Keine Feiertage* oder *Benutzerdefiniert…*. Hat das Land Regionen, kommt eine Auswahlliste *Region* hinzu. Für die Niederlande wählen Sie außerdem, wenn *Baumodus aktivieren* eingeschaltet ist, die *Bauferien*: *Keine* (Standard), *Nord*, *Mitte* oder *Süd*. Darunter steht eine Zeile wie *36 Feiertage, 2025–2029*. Diese Zeile klappen Sie für die Liste auf. Die Jahre laufen vom Jahr vor dem Startdatum bis zum Jahr nach dem Enddatum. Gibt es kein Enddatum, laufen sie bis drei Jahre nach dem Startjahr. *Benutzerdefiniert…* erstellt einen Kalender ohne Feiertage. Danach öffnet sich direkt das Fenster *Kalender*, damit Sie die Feiertage selbst eintragen können. Der Projektkalender heißt *Bouwkalender NL*, oder *Standaardkalender*, wenn *Baumodus aktivieren* ausgeschaltet ist. Dann ist außerdem *Keine Feiertage* verfügbar. Wie der Generator arbeitet, steht unter [Feiertage und Bauferien erzeugen](docs://howto-feestdagen-genereren).

## Was das Startdatum bewirkt

Das Startdatum ist der feste Bezugspunkt des Projekts. Drei Regeln gelten:

- **Neue Vorgänge beginnen am Startdatum.** Ein Vorgang, den Sie hinzufügen, erhält den Projektstart als geplanten Anfang.
- **Ein Vorgang mit einem Vorgänger beginnt nie vor dem Startdatum.** Endet der Vorgänger früher, wartet der Vorgang bis zum Startdatum. Ein Vorgang *ohne* Vorgänger behält sein eigenes Datum, auch wenn es vor dem Startdatum liegt. Das ist nötig, um einen Terminplan aus MS Project oder Primavera so anzuzeigen, wie das Quellprogramm ihn zeigt. Eine Einschränkung *Muss anfangen am (MSO)* oder *Muss enden am (MFO)* bricht beide Regeln: Ein solcher Vorgang wird genau auf diesem Datum eingeplant, auch wenn es vor dem Startdatum liegt.
- **Ein späteres Startdatum schiebt freie Vorgänge mit.** Setzen Sie das Startdatum später im Fenster *Projekteinstellungen* und klicken Sie auf *Anwenden*. Dann werden Vorgänge ohne Vorgänger und ohne eine Einschränkung, die eine untere Grenze setzt (*Anfang nicht früher als*, *Muss anfangen am*, *Ende nicht früher als* oder *Muss enden am*), auf das neue Datum verschoben, wenn sie vor ihm liegen würden. Das geschieht im selben Schritt im Verlauf von *Rückgängig*. Die App sagt, wie viele Vorgänge verschoben wurden. Das geschieht nur, wenn Sie das Startdatum selbst ändern, nie beim Öffnen einer Datei. Ein späteres Startdatum verschiebt den übrigen Terminplan nicht. *Projekt verschieben* macht das, siehe [Ein Projekt verschieben](docs://howto-project-verplaatsen).

## Siehe auch

- [Berechnungsoptionen und Konventionen](docs://ref-rekenopties-en-conventies): der Block *Berechnungsprofil und Berechnungsoptionen*.
- [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen): warum ein Profil das Ergebnis ändert.
- [Ein Projekt verschieben](docs://howto-project-verplaatsen): den ganzen Terminplan auf einen anderen Anfang setzen.
- [Vorgänge und Meilensteine hinzufügen](docs://howto-taken-en-mijlpalen-toevoegen): der Einstieg mit den ersten Vorgängen.
- [Feiertage und Bauferien erzeugen](docs://howto-feestdagen-genereren): das Feiertagsset im Detail.
- [Das IFC-Schema wählen](docs://howto-ifc-schema-kiezen): Speichern für ein Gebäudemodell in IFC4.
