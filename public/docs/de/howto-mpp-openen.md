# Eine MS-Project-Datei (.mpp) öffnen

Ziel: Einen Terminplan aus Microsoft Project direkt in der App öffnen, ohne ihn vorher zu exportieren.

## Wann Sie das brauchen

Ein Auftragnehmer, Berater oder Kunde schickt Ihnen seinen Terminplan als `.mpp`-Datei. Sie möchten ihn ansehen, berechnen oder weiterentwickeln. Die App liest `.mpp`-Dateien von MS Project 2010 bis einschließlich 2021. Die App liest nur. Sie schreibt keine `.mpp`-Dateien und ändert Ihre Datei nie. Aus der Datei übernimmt sie den Terminplan selbst: Vorgänge mit Struktur, Dauer und Einschränkungen, Beziehungen mit Zeitabstand, Kalender, Ressourcen, Zuweisungen und Fortschritt. Sie liest auch die Termine und den Puffer, die MS Project selbst berechnet hat. Die App verwendet diese aber nur für die Ansicht *Termine wie aufgezeichnet*, nie als Eingabe.

## Schritte

1. Wählen Sie *Start › Datei › Öffnen* oder drücken Sie Strg+O. Wählen Sie die `.mpp`-Datei.
2. Das Projekt öffnet sich in einer neuen Registerkarte oder in der aktuellen Registerkarte, wenn diese noch leer und unverändert war. Das Projekt hat keine Datei. *Speichern* schreibt später eine neue IFC-Datei. Ein Fenster erklärt dann kurz, was die App aus der Datei übernommen hat und wie das Speichern funktioniert; siehe [Öffnen und Speichern einer Datei](docs://howto-bestand-openen-en-opslaan).
3. Lesen Sie die Meldung unten: *Dieses Projekt rechnet als Microsoft Project. Ändern über Datei → Projektinfo → Berechnungsprofil und Berechnungsoptionen*. Die App berechnet dieses Projekt mit den Berechnungsregeln von MS Project: dem Berechnungsprofil *Microsoft Project*. Mit *Berechnungsprofil öffnen* gehen Sie zur Einstellung. *Mehr erfahren* öffnet die Hilfe über Berechnungsprofile.
4. Prüfen Sie, ob unter dem Menüband eine Meldungsleiste steht: *Sie sehen die Termine so, wie sie in der Datei aufgezeichnet sind; eine Neuberechnung würde 4 Vorgänge verschieben*. Dann weicht das Ergebnis der App bei diesen Vorgängen von den Terminen ab, die MS Project gespeichert hat. Unter der Meldung aus Schritt 3 steht dann auch eine Zeile: *4 Vorgänge zeigen die in der Datei gespeicherten Termine (nicht neu berechnet)*. Was das bedeutet und wie Sie zur eigenen Berechnung der App wechseln, steht unter [Termine wie aufgezeichnet](docs://uitleg-datums-zoals-opgeslagen).
5. Wenn dort *Diese Datei enthält stundenbasierte Planung* mit der Schaltfläche *Stundenplanung aktivieren* steht, enthält die Datei Daten in Stunden. Siehe [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten).

Wenn die Datei Vorgänge mit unterbrochener Terminierung, mit Kapazitätsabgleich oder mit ressourcengesteuerter Terminierung enthält, kommt eine weitere Meldung hinzu, zum Beispiel *Diese MS-Project-Datei enthält 3 Vorgänge mit unterbrochener, geglätteter oder ressourcengesteuerter Terminierung. Sie werden so eingelesen und angezeigt*. Bei einem einzigen Vorgang steht die Meldung im Singular.

## Fallstricke und was die App dann tut

**Nicht alles wird übernommen.** Nach dem Öffnen nennt die App in einer Meldung, was sie nicht übernommen hat: *Nicht alles aus dieser MS Project-Datei wurde übernommen*. Darunter steht je Punkt eine Zeile mit der Anzahl, zum Beispiel *2 Baselines wurden nicht übernommen*. Bei einer `.mpp`-Datei ist der Satz über das Berechnungsprofil aus Schritt 3 dann die erste Zeile dieser Meldung. Die Meldung bleibt stehen, bis Sie auf das Kreuz klicken. Wenn nichts verloren geht, erhalten Sie diese Meldung nicht. Eine Zeile kann Folgendes betreffen:

- eingefügte Projekte (Teilprojekte): die App liest sie als normalen Vorgang ein, ohne die Verknüpfung mit der anderen Datei;
- externe Vorgänge aus einem anderen Projekt: die App liest sie als normalen Vorgang ein;
- Baselines: aus einer `.mpp`-Datei übernimmt die App keine Baseline, aus MS-Project-XML nur die Baseline 0 der Vorgänge, und davon nur die Termine und die Dauer (bei einem Vorgang in Stunden auch die Uhrzeit; nicht die Arbeit und die Kosten, und keine Baselines von Ressourcen und Zuweisungen);
- bei MS-Project-XML: eine Zuweisung, deren Baseline andere Termine hat als ihr Vorgang. Die App behält nur die Baseline des Vorgangs; sind sie gleich, geht nichts verloren und die App meldet nichts. Eine andere Uhrzeit am selben Tag zählt ebenfalls als Unterschied;
- benutzerdefinierte Felder mit Werten, also benutzerdefinierte Felder, Werte aus einer Nachschlagetabelle und Gliederungscodes (die App zählt Ja/Nein-Felder in einer `.mpp`-Datei nicht mit);
- Notizen (auch eine Notiz nur mit einem Bild) zu Ressourcen und Zuweisungen sowie aus einer `.mpp`-Datei auch zu Vorgängen (aus MS-Project-XML wird die Notiz eines Vorgangs als dessen Beschreibung übernommen);
- Hyperlinks;
- die Fixkosten der Vorgänge;
- die Tarife der Ressourcen: aus einer `.mpp`-Datei gar kein Tarif, aus MS-Project-XML nur der Standardtarif;
- nur bei MS-Project-XML: manuell geplante Vorgänge (die App plant sie automatisch), inaktive Vorgänge (sie sind in der Berechnung enthalten) und die Abgleichsverzögerung;
- nur bei einer `.mpp`-Datei: die kritische Schwelle aus MS Project; die App verwendet die Schwelle 0.

Ein PSP-Code, den Sie selbst in MS Project eingetragen haben, wird übernommen. Sonst nummeriert die App die Vorgänge nach der Struktur.

**Eine Datei aus MS Project 2007 oder älter.** Die App lehnt sie ab und meldet: *Diese .mpp-Datei verwendet ein altes Format (Project 2007 oder älter). Exportieren Sie sie in MS Project als XML (Datei → Speichern unter → XML) und öffnen Sie diese Datei*. Unter der Meldung fügt die App einen technischen Grund auf Englisch hinzu.

**Eine Datei mit Passwort.** Die App meldet: *Diese .mpp-Datei ist passwortgeschützt. Exportieren Sie sie in MS Project als XML (Datei → Speichern unter → XML) und öffnen Sie diese Datei*. Auch hier kommt die Meldung mit einem technischen Grund auf Englisch.

**Eine Datei, die keine `.mpp`-Datei ist.** Sie erhalten *Datei konnte nicht geöffnet werden* mit einem technischen Grund.

**Der XML-Weg rechnet anders.** Wenn Sie den XML-Export von MS Project statt der `.mpp`-Datei öffnen, rechnet die App mit dem Berechnungsprofil *Open Planner Studio*. Die Meldung zu *Microsoft Project* sehen Sie dann nicht. Die Termine können dann anders ausfallen als bei der `.mpp`-Datei. Auch beim XML-Export gilt: Die App meldet, was sie nicht übernimmt; siehe *Nicht alles wird übernommen*.

**Eine Bearbeitung hebt die Steuerung durch MS Project auf.** Wenn Sie einen Vorgang bearbeiten, dessen Terminplan durch das Datumsfenster von MS Project gesteuert wurde, meldet die App einmal pro Projekt: *Die Stundenverteilung aus MS Project steuert 2 Vorgänge nach dieser Bearbeitung nicht mehr; die ursprüngliche Verteilung bleibt in der Datei erhalten*. Bei einem einzigen Vorgang lautet die Meldung im Singular.

**Beim Speichern wird Ihre `.mpp`-Datei nie überschrieben.** Das Projekt hat keine Datei. *Speichern* fragt, wo die neue IFC-Datei abgelegt werden soll.

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): warum eine `.mpp` nur gelesen wird und was beim Speichern geschrieben wird.
- [Termine wie aufgezeichnet](docs://uitleg-datums-zoals-opgeslagen): die Ansicht der eigenen Termine von MS Project.
- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): wenn die Datei Daten in Stunden enthält.
- [Eine Primavera P6-Datei (.xer) öffnen](docs://howto-xer-openen): dasselbe für Primavera P6.
- [Import- und Exportformate](docs://ref-import-exportformaten): je Format, was übernommen wird und was nicht.
- [Berechnungsprofile und Konventionen](docs://uitleg-rekenprofielen): warum eine MS-Project-Datei mit einem eigenen Berechnungsprofil geöffnet wird.
