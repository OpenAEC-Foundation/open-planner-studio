# Exportieren

Ziel: Geben Sie Ihren Terminplan als Datei in einem anderen Format weiter, für jemanden, der IFC nicht liest, oder für ein anderes Programm.

## Wann Sie das brauchen

Der Berater arbeitet mit MS Project, der Auftraggeber mit Primavera, der Subunternehmer möchte die Vorgänge in Excel, oder Sie senden einen Terminplan an ein Programm, das IFC nicht verarbeiten kann. Ein Export ist eine Kopie in einem anderen Format. Wenn Sie Ihr Projekt selbst behalten möchten, speichern Sie es: Dabei wird IFC geschrieben, und alles wird mitgenommen. Was jedes Format mitnimmt und was nicht, steht in [Dateien und Formate](docs://uitleg-bestanden).

## Schritte

1. Wählen Sie *Start › Datei › Exportieren* und ein Format aus der Liste, oder wählen Sie *Datei › Exportieren*. Dort ist jedes Format eine Karte mit einer kurzen Beschreibung.
2. Im Fenster wählen Sie einen Namen und einen Ort. Die App schlägt den Projektnamen mit der Endung des Formats vor. Die Fortschrittsblätter heißen *projectname-voortgang* und öffnen sich, wenn möglich, in Ihrem Download-Ordner.
3. Bestätigen Sie. Es erscheint keine Meldung, wenn der Export gelingt, außer den Meldungen unten. Danach kehren Sie von *Datei › Exportieren* zur Registerkarte *Start* zurück, auch wenn Sie das Fenster abbrechen. Wenn Sie das Fenster bei einem Export aus der Liste auf der Registerkarte *Start* abbrechen, geschieht nichts.

Wenn Ihr Browser nur über einen Download speichert (zum Beispiel Firefox), liegt die Datei direkt nach Schritt 1 in Ihrem Download-Ordner. Sie sehen die Meldung *Als Download gespeichert: 'name.xml' liegt jetzt in Ihrem Download-Ordner. Diese Umgebung erlaubt der App nicht, direkt an den gewählten Ort zu schreiben.*

### Welches Format wählen Sie?

Die Liste auf der Registerkarte *Start* und die Karten unter *Datei › Exportieren* bieten dieselben Formate an:

- *Fortschritt (Excel)* und *Fortschritt (CSV)*, auf den Karten *Fortschrittsblatt (Excel)* und *Fortschrittsblatt (CSV)*: ein schlankes Blatt mit ID, PSP, Name, Terminen und Fertigstellung, zum Verteilen an alle, die den Fortschritt eintragen.
- *CSV (;)*, auf der Karte *CSV (semikolon-getrennt)*: eine Vorgangstabelle, die Sie in einer Tabellenkalkulation öffnen.
- *MS Project XML*: lässt sich in Microsoft Project öffnen.
- *Primavera P6 XML*: für Oracle Primavera P6.
- *IFC*: das eigene Format der App, mit allen Daten darin, im IFC-Schema des Projekts (standardmäßig IFC 4.3 ADD2).

### Ein IFC-Export mit einer Bibliotheksdatei

Wenn Ihr Projekt mit einer Ressourcenbibliothek verknüpft ist, finden Sie das Kontrollkästchen *Bibliotheksdatei zusätzlich speichern* unterhalb der Karten in *Datei › Exportieren*. Wenn Sie es ankreuzen und *IFC* wählen, fragt die App zweimal nach einem Ort: zuerst für das Projekt, dann für *projectname-bibliotheek.ifc*. Dieses Kontrollkästchen steht nur in *Datei › Exportieren*, nicht in der Liste auf der Registerkarte *Start*.

### Ein Fortschrittsblatt wieder einlesen

Ein ausgefülltes Fortschrittsblatt lesen Sie über *Datei › Importieren* wieder ein. Siehe [Fortschritt aus einer Tabelle importieren](docs://howto-voortgang-importeren).

## Fallstricke und was die App dann tut

**Ihr Projekt ändert sich nicht.** Die Datei Ihres Projekts bleibt gleich, und die Markierung *Nicht gespeichert* bleibt, wenn sie vorher da war.

**Ein veralteter Terminplan wird zuerst neu berechnet.** So erhalten Sie die aktuellen Termine, auch wenn Sie vergessen haben, *Berechnen* zu drücken.

**Ein Export steht auch unter Zuletzt verwendet.** Das gilt nicht für die Fortschrittsblätter. Wenn Sie dort einen Export öffnen, wird er als Import dieses Formats geöffnet.

**Ein Export enthält nicht alles.** Eine CSV-Datei hat keine Ressourcen oder Einschränkungen, P6 XML hat keine Baselines und Stichtage. Auch das Berechnungsprofil wird nicht mitgenommen: Ein wieder geöffneter Export wird als *Open Planner Studio* berechnet. Nur IFC enthält alles. Ein Beispiel mit Zahlen finden Sie in [Dateien und Formate](docs://uitleg-bestanden).

**Zwei Formate mit derselben Endung.** MS Project XML und Primavera P6 XML erhalten beide den Namen *projectname.xml*. Geben Sie ihnen selbst verschiedene Namen, sonst wissen Sie später nicht, welche Datei welches Format ist.

**Ein Terminplan mit einem Zirkelbezug wird nicht exportiert.** Die App berechnet zuerst und stoppt, wenn es eine Schleife gibt. Auf der Registerkarte *Start* erhalten Sie die Meldung *Terminplan konnte nicht berechnet werden*, darunter zum Beispiel *Zirkelbezug zwischen Vorgängen: Set up site → Demolish existing extension → Set up site*. Unter *Datei › Exportieren* steht nur dieser zweite Text auf der Seite. Lösen Sie die Schleife und exportieren Sie erneut.

**Ein Projekt aus Primavera verliert Quellinformationen.** Wenn Sie so ein Projekt nach CSV, MS Project XML oder P6 XML exportieren, meldet die App: *Beim Export nach CSV gehen XER-Quellinformationen verloren.* Bei MS Project XML steht dort *MSPDI*, bei P6 XML *P6*. Siehe [Öffnen einer Datei von Primavera P6 (.xer)](docs://howto-xer-openen).

**Geteilte Vorgänge verlieren ihre Unterbrechungen.** MS Project und Primavera kennen eine Teilung nur als Stundenverteilung. Wenn Ihr Projekt geteilte Vorgänge ohne Stundenverteilung enthält, meldet die App nach einem Export nach MS Project XML oder P6 XML: *2 Vorgänge mit Unterbrechungen wurden ohne ihre Unterbrechungen exportiert: MS Project/P6 kennen diese nur als Arbeitsverteilung.* Bei einem Vorgang meldet sie: *1 Vorgang mit Unterbrechungen wurde ohne seine Unterbrechungen exportiert: MS Project/P6 kennen diese nur als Arbeitsverteilung.* Siehe [Einen Vorgang teilen](docs://howto-taak-splitsen).

**Ein Terminplan in der Ansicht *Termine wie gespeichert*.** Wenn Sie nach CSV exportieren, während Sie die Termine aus der Quelldatei sehen, lässt die App `Critical` und `Total Float` bei Vorgängen leer, für die die Quelldatei das nicht aufgezeichnet hat. Siehe [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen).

## Siehe auch

- [Dateien und Formate](docs://uitleg-bestanden): was jedes Format mitnimmt und was nicht.
- [Eine Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan): Ihr Projekt selbst als IFC behalten.
- [Fortschritt aus einer Tabelle importieren](docs://howto-voortgang-importeren): ein ausgefülltes Fortschrittsblatt einlesen.
- [Import- und Exportformate](docs://ref-import-exportformaten): pro Format, was übernommen wird und was nicht.
