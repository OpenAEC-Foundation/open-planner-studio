# Das IFC-Schema wählen

Ziel: Speichern Sie Ihren Terminplan im IFC-Schema des Gebäudemodells, mit dem Sie ihn zusammenführen wollen.

## Wann Sie das brauchen

Standardmäßig speichert die App ein Projekt als IFC 4.3 ADD2. Das ist der Name von IFC 4.3 in den Dateien, die IfcOpenShell und Bonsai erzeugen. Wenn Sie den Terminplan mit einem Gebäudemodell zu einer einzigen 4D-Datei zusammenführen wollen, zum Beispiel mit dem Rezept *MergeProjects* von IfcOpenShell (ifcpatch), müssen beide Dateien dasselbe Schema haben. Ist das Gebäudemodell eine IFC4-Datei, weigert sich IfcOpenShell, es mit einem IFC-4.3-Terminplan zusammenzuführen. Wählen Sie dann hier das Schema des Modells.

## Schritte

1. Öffnen Sie *Projekteinstellungen*: *Einstellungen › Projekt › Projekteinstellungen*, oder *Datei › Projekteinstellungen*.
2. Wählen Sie unter *IFC-Schema beim Speichern* das Schema Ihres Gebäudemodells.
3. Klicken Sie auf *Anwenden*. Das Projekt ist jetzt *Nicht gespeichert*.
4. Speichern Sie mit *Speichern* (Strg+S) oder *Speichern als*.

Die drei Auswahlmöglichkeiten:

- *IFC 4.3 ADD2 (Standard)* schreibt `IFC4X3_ADD2` in den Kopf der Datei.
- *IFC 4.3* schreibt `IFC4X3`. So schrieben ältere Versionen der App IFC 4.3.
- *IFC4* schreibt `IFC4`, für ein Gebäudemodell in IFC4.

## Fallstricke und was die App tut

**Zusammenführen als letzter Schritt.** Öffnen Sie die zusammengeführte 4D-Datei (Gebäudemodell plus Terminplan) nicht in der App, um sie erneut zu speichern. Die App behält nur den Terminplan: Die Wände und die übrigen Teile des Gebäudemodells gehen verloren, auch wenn Sie das Schema behalten. Ändern Sie den Terminplan danach in Ihrer eigenen Datei und führen Sie sie erneut zusammen.

**Die App fragt zuerst, wenn eine geöffnete Datei ein anderes Schema hat.** Öffnen Sie zum Beispiel eine IFC4-Datei oder eine IFC-4.3-Datei aus einer älteren Version der App, dann ändert die App den Dateityp nicht einfach. Beim ersten Mal, wenn Sie *Speichern* oder *Speichern als* verwenden, fragt sie zuerst, ob Sie das Schema der Datei behalten oder zu IFC 4.3 ADD2 wechseln. *IFC4 behalten* (oder *IFC 4.3 behalten*) ist die Schaltfläche, die Enter auswählt. Schließen Sie die Frage mit Esc oder dem Kreuz, dann speichert die App nichts.

**Die App fragt nur einmal pro Datei.** Ihre Wahl wird in der Datei selbst gespeichert. Öffnen Sie sie später erneut, fragt die App nicht noch einmal. Wenn Sie selbst ein Schema in *Projekteinstellungen* wählen und auf *Anwenden* klicken, fragt die App ebenfalls nicht.

**Eine Datei mit einem Schema, das die App nicht schreiben kann**, zum Beispiel IFC2X3, lässt sich in der App öffnen. Beim ersten Speichern sagt die Frage das, und Sie wählen eines der drei oben genannten Schemas.

**Automatisches Speichern und Wiederherstellung nach Absturz fragen nicht.** Sie schreiben das Schema der Datei und lassen die Frage für Ihr erstes eigenes Speichern offen. Bei einem Schema, das die App nicht schreiben kann, schreibt *Automatisch speichern* erst dann in die Datei, wenn Sie die Frage beantwortet haben.

**Ein neues Projekt fragt nicht.** Ein neues Projekt und ein Projekt aus einem anderen Format, zum Beispiel XER, MPP oder CSV, beginnt mit *IFC 4.3 ADD2 (Standard)*.

**Der Inhalt der Datei ändert sich nicht.** Die drei Schemas kennen die Plandaten, die die App auf dieselbe Weise schreibt. Nur die Zeile `FILE_SCHEMA` im Kopf unterscheidet sich. Sie verlieren also nichts, wenn Sie ein anderes Schema wählen.

**Ein IFC-4.3-Modell aus IfcOpenShell oder Bonsai** hat im Kopf meist `IFC4X3_ADD2`, wie der Standard der App. IfcOpenShell führt einen IFC-4.3-Terminplan mit `IFC4X3` nicht mit dem Modell zusammen. Schauen Sie im Zweifel auf die Zeile `FILE_SCHEMA` oben in der Modelldatei.

**Rückgängig ändert das Schema nicht.** Das Schema gehört zur Datei, wie der Ort, an dem sie gespeichert wird. Eine Wahl in *Projekteinstellungen* und die Antwort auf die Frage beim Speichern sind daher kein Schritt im Verlauf von *Rückgängig*. Um zurückzugehen, wählen Sie in *Projekteinstellungen* das andere Schema. So schreibt *Automatisch speichern* nie stillschweigend ein anderes Schema, nachdem Sie eine Änderung rückgängig gemacht haben.

## Siehe auch

- [Neues Projekt und Projekteinstellungen](docs://ref-projectinfo): alle Felder des Formulars.
- [Dateien und Formate](docs://uitleg-bestanden): warum IFC das eigene Format der App ist.
- [Eine Datei öffnen und speichern](docs://howto-bestand-openen-en-opslaan): Speichern und Speichern als.
