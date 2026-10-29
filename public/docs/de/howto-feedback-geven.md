# Feedback geben

Ziel: einen Fehler melden oder eine Idee weitergeben, optional mit einem Screenshot, direkt aus der App.

## Wann Sie dies brauchen

Der Terminplan berechnet etwas, das Sie nicht verstehen, eine Schaltfläche tut nicht, was sie tun soll, oder Ihnen fehlt etwas in der App. Eine gute Meldung hilft den Entwicklern, das Problem zu finden. Darum fügt die App selbst die Version, das Betriebssystem und die Sprache in Ihre Meldung ein. Was Sie selbst beschreiben, entscheidet, ob die Entwickler damit etwas anfangen können: was Sie getan haben, was Sie erwartet haben und was passiert ist.

## Schritte

1. Klicken Sie auf die Schaltfläche *Feedback geben* oben im Fenster. Diese Schaltfläche steht immer in der Titelleiste. Ihr Text wechselt alle zehn Minuten: *Feedback geben*, *Einen Fehler melden* oder *Neue Funktion vorschlagen*. Es ist immer dieselbe Schaltfläche. Das Fenster *Feedback geben* öffnet sich.
2. Wählen Sie die Art der Meldung. *Etwas funktioniert nicht* ist für einen Fehler: Etwas tut nicht, was es tun soll. *Idee* ist für etwas, das Ihnen fehlt oder anders sein soll. *Frage oder Bemerkung* ist für alles Übrige. *Etwas funktioniert nicht* ist standardmäßig ausgewählt.
3. Füllen Sie das Feld *Titel* aus und danach die *Beschreibung*. Die leeren Felder zeigen ein Beispiel: einen Titel wie *Z. B. kritischer Pfad verschiebt sich nach dem Speichern* und für die Beschreibung die Frage *Was haben Sie getan, was haben Sie erwartet und was ist passiert?* Solange die Schaltfläche *Senden* grau ist, zeigt eine graue Zeile daneben den Grund, zum Beispiel *Geben Sie einen Titel ein.* oder dass Sie im Titel und in der Beschreibung zusammen mindestens 10 Zeichen schreiben müssen.
4. Wenn Sie eine Antwort wünschen, füllen Sie Ihre *E-Mail-Adresse* aus. Dieses Feld ist optional. Die App merkt sich die Adresse nach einer erfolgreichen Meldung, daher steht sie beim nächsten Mal schon da.
5. Wenn Sie etwas zeigen möchten, schalten Sie *Screenshot anhängen* ein. Die App macht dann ein Bild der App ohne dieses Fenster. Einen Moment später sehen Sie eine kleine Vorschau mit drei Schaltflächen daneben: *Anmerken*, *Neu erstellen* und *Entfernen*.
6. *Anmerken* öffnet einen Editor. Darin setzen Sie Pfeile, Rechtecke, Freihandlinien und Text auf das Bild. Mit *Abdecken* zeichnen Sie einen schwarzen Bereich über etwas, das nicht mitgehen darf, zum Beispiel einen Namen oder einen Betrag. Dieser Teil ist dann wirklich aus dem Bild verschwunden, das die App sendet. Sie wählen die Farbe, nehmen Ihre letzte Aktion mit *Rückgängig* zurück oder fangen mit *Alles löschen* neu an. Klicken Sie auf *Fertig*, um Ihre Änderungen zu behalten, oder auf *Abbrechen* (oder Esc), um sie zu verwerfen.
7. *Neu erstellen* macht einen neuen Screenshot und löscht Ihre Anmerkungen. *Entfernen* entfernt den Screenshot und schaltet das Kontrollkästchen aus.
8. Sehen Sie sich die graue Zeile *Mitgesendet* unter dem Formular an. Sie zeigt, was die App selbst mitsendet: die Version, das Betriebssystem und die Sprache, zum Beispiel *Mitgesendet: v2026.10.1 · Windows · English*.
9. Klicken Sie auf *Senden*. Während des Sendens zeigt die Schaltfläche *Wird gesendet…*.
10. Sie sehen *Danke, Ihre Meldung wurde gesendet.* Wurde für Ihre Meldung ein Issue auf GitHub angelegt, gibt es zusätzlich die Schaltfläche *Auf GitHub ansehen*. Klicken Sie auf *Schließen*.

## Wohin Ihre Meldung geht

Die App sendet Ihre Meldung an Open Feedback Studio von OpenAEC. Dafür brauchen Sie kein Konto, auch nicht bei GitHub. Die Entwickler sehen Ihre Meldung in ihrer Übersicht. Ist die App dort mit GitHub verbunden, macht Open Feedback Studio daraus außerdem ein öffentliches Issue auf GitHub. Bei *Etwas funktioniert nicht* bekommt das Issue das Label *bug*, bei *Idee* das Label *enhancement*. Unter Ihrer Beschreibung steht dann eine Zeile mit der Version von Open Planner Studio, Ihrem Betriebssystem und der Sprache der App.

## Fallstricke und was die App dann tut

**Ihre Meldung kann öffentlich werden.** Schreiben Sie nichts hinein, das Sie nicht teilen möchten. Das gilt auch für den Screenshot: Das Bild zeigt alles, was in diesem Moment in der App sichtbar ist, zum Beispiel Vorgangsnamen und Ressourcen Ihres Projekts. Die App macht den Screenshot in dem Moment, in dem Sie *Screenshot anhängen* einschalten. Ist der Bildschirm noch nicht richtig, schließen Sie das Fenster, stellen Sie den Bildschirm richtig, öffnen Sie das Fenster erneut und klicken Sie auf *Neu erstellen*. Verwenden Sie *Abdecken*, um alles zu verbergen, was Sie nicht zeigen möchten.

**Der Screenshot ist zu groß.** Die App verkleinert den Screenshot vor dem Senden. Ist er danach immer noch zu groß, geht Ihre Meldung ohne Bild weiter. Der Bestätigungsbildschirm zeigt dann *Der Screenshot war zu groß und wurde nicht mitgesendet.*

**Senden funktioniert nicht.** Im Fenster erscheint eine Meldung, und Ihr Text bleibt stehen. Es gibt vier Fälle:

- *Die Meldung wurde nicht angenommen.* Prüfen Sie den Text und die E-Mail-Adresse. Eine Meldung, die vor allem aus Links besteht, wird abgelehnt.
- *Sie haben in kurzer Zeit viele Meldungen gesendet.* Versuchen Sie es in einer Stunde erneut.
- *Senden fehlgeschlagen.* Es gibt keine Verbindung oder der Server antwortet nicht. Versuchen Sie es erneut oder klicken Sie auf *Auf GitHub öffnen*. Diese Schaltfläche fehlt, wenn ein früherer Versuch unsicher war (siehe unten).
- *Wir wissen nicht sicher, ob Ihre Meldung angekommen ist. Warten Sie eine Minute und senden Sie sie dann erneut; falls sie schon da ist, sehen wir das automatisch.* Die Verbindung brach ab, nachdem die App Ihre Meldung gesendet hatte. Ihr Text bleibt stehen. Es gibt keine Schaltfläche *Auf GitHub öffnen*, weil Ihre Meldung noch ankommen kann. Das bleibt so, bis Ihre Meldung gesendet oder bereits empfangen ist, auch wenn Sie das Fenster zwischendurch schließen und wieder öffnen.

**Ihre Meldung ist bereits eingegangen.** Wenn Sie eine Meldung senden, die schon da ist, bleibt das Formular stehen und zeigt darüber: *Diese Meldung ist bei uns bereits eingegangen. Möchten Sie etwas hinzufügen? Dann ändern Sie den Text und senden Sie ihn erneut.* Ihr Text bleibt stehen und Ihre E-Mail-Adresse bleibt gespeichert. Klicken Sie auf *Schließen*, wenn Sie nichts hinzufügen möchten; das Formular ist dann beim nächsten Mal leer. Schreiben Sie etwas mehr, verschwindet die Meldung und Sie können erneut senden. Die Schaltfläche heißt dann wieder *Speichern und schließen* und Ihr Text bleibt erhalten.

**Auf GitHub öffnen.** Das ist der Weg ohne Open Feedback Studio. Dafür brauchen Sie ein Konto bei GitHub. Ohne Screenshot öffnet sich die GitHub-Seite, auf der Sie ein neues Issue anlegen, sofort in Ihrem Browser, mit Ihrem Titel und Ihrer Beschreibung schon ausgefüllt. Mit Screenshot sehen Sie zuerst *Fast fertig — Ihr Screenshot ist in der Zwischenablage.* mit vier Schritten. Klicken Sie auf *OK, zu GitHub*, klicken Sie in das große Textfeld der Issue-Seite und drücken Sie Strg+V (Cmd+V auf einem Mac). Klicken Sie danach unten auf *Neues Issue absenden*. Erst dann ist Ihre Meldung gesendet.

**Einfügen funktioniert nicht.** Auf dem Weg über GitHub wird der Screenshot auch als Datei auf Ihrem Computer gespeichert. In der Desktop-App nennt das Fenster den Pfad: *Kann nicht einfügen? Wir haben den Screenshot auch unter* diesem Pfad *gespeichert — ziehen Sie diese Datei in das Textfeld.* Im Browser lädt die App das Bild als `feedback-` mit einer Nummer und der Endung `.png` herunter. Sie finden es in Ihrem Downloads-Ordner und ziehen es in das Textfeld.

**Der Screenshot schlägt fehl.** Es erscheint *Screenshot-Erstellung fehlgeschlagen. Sie können Feedback trotzdem ohne Screenshot senden.* Das Kontrollkästchen geht aus, und Sie können Ihre Meldung ohne Bild senden.

**Sie schließen das Fenster, bevor Sie senden.** Steht etwas im Formular, heißt die Schaltfläche unten *Speichern und schließen*. Ist das Formular leer, heißt sie *Schließen*. *Speichern und schließen*, das Kreuz und Esc schließen das Fenster, und Ihre Meldung bleibt als Entwurf erhalten, bis Sie sie senden oder auf *Leeren* klicken. Öffnen Sie das Fenster wieder, sind die Art der Meldung, Ihr Text, die E-Mail-Adresse und der Screenshot mit Anmerkungen noch da. Der Entwurf bleibt erhalten, solange die App geöffnet ist; nach dem Beenden der App ist er weg. Nach einer erfolgreichen Meldung ist das Formular wieder leer. Wenn Sie selbst neu anfangen möchten, klicken Sie unten links auf *Leeren*. Ein Klick neben dem Fenster schließt es nicht. Während des Sendens schließt Esc das Fenster nicht.

## Siehe auch

- [App aktualisieren](docs://howto-app-bijwerken): Prüfen Sie vor einer Meldung, ob Sie die neueste Version haben.
