# Überlastung auflösen

Ziel: Sehen Sie, wo eine Ressource an einem Tag zu viel zu tun hat, und lösen Sie das meist durch einen Kapazitätsabgleich der Vorgänge.

## Wann Sie das brauchen

Auf dem Papier funktioniert Ihr Terminplan, aber der Maurer ist an zwei Wänden eingeplant, die an denselben Tagen laufen. Die App nennt das **Überlastung**. Eine Ressource ist an einem Arbeitstag überlastet, wenn der Terminplan an diesem Tag mehr von ihr verlangt als ihre Kapazität (*Max. Einheiten*), oder wenn sie laut ihrem Kalender an diesem Tag nicht arbeitet.

Zuerst prüfen Sie die Überlastung. Dann wählen Sie eine Lösung. **Kapazitätsabgleich** ist die Lösung, die die App für Sie berechnet: Sie lässt Vorgänge später starten, bis die Ressource es schafft. Wie die App das berechnet, lesen Sie in [Kapazitätsabgleich](docs://uitleg-nivelleren).

## Schritte

### 1. Überlastung finden

1. Schauen Sie im Menüband bei *Ressourcen › Überlastung*. Dort steht *Keine* oder, in Rot, die Anzahl überlasteter Ressourcen, zum Beispiel *1 Ressource*. Nach einer Berechnung steht in der Statusleiste auch *⚠ 1 Ressource(n) überlastet*.
2. Klicken Sie auf diese Meldung in der Statusleiste. Der Bereich *Warnungen* öffnet sich rechts, mit einer Zeile für jede Ressource, zum Beispiel *Bricklayer* mit *Überlastet an 5 Tag(en) (29-06-2027 – 05-07-2027)*.
3. Klicken Sie auf diese Zeile. Die App schaltet das Histogramm ein, wählt die Ressource aus und markiert alle Vorgänge, auf denen die Ressource arbeitet.
4. Schauen Sie auf das Histogramm unter dem Gantt-Diagramm. Rote Balken sind überlastete Tage. Wenn Sie mit der Maus über einen Tag fahren, sehen Sie, welche Vorgänge dazu beitragen, zum Beispiel *2 Vorgänge tragen bei am 2027-06-30* mit den Namen darunter.

Sie können das Histogramm auch selbst einschalten, über *Ressourcen › Histogramm › Histogramm*. Wählen Sie eine Ressource in der Liste links, oder blättern Sie mit *Zurück* und *Weiter* durch die Ressourcen. Ein roter Punkt in der Liste bedeutet, dass die Ressource überlastet ist. Die Zeile *Alle Ressourcen* addiert die Ressourcen zusammen, ohne Material.

Wenn ein Vorgang ausgewählt ist, zeigt das Histogramm nur die Belastung dieses Vorgangs und nur die Ressourcen daran. Drücken Sie Esc, um die Auswahl aufzuheben und das ganze Projekt wieder zu sehen.

### 2. Eine Lösung wählen

- **Mehr Kapazität.** Kommt wirklich ein zweiter Maurer, setzen Sie *Max. Einheiten* auf 2 (siehe [Ressourcen verwalten](docs://howto-resources-beheren)). Die Überlastung ist dann weg.
- **Weniger Einheiten pro Tag.** Senken Sie *Einheiten* oder wählen Sie eine andere Kurve für die Zuweisung (siehe [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen)).
- **Vorgänge nacheinander legen.** Fügen Sie eine Beziehung zwischen den beiden Vorgängen hinzu, sodass der zweite erst startet, wenn der erste beendet ist (siehe [Beziehungen hinzufügen](docs://howto-relaties-leggen)).
- **Kapazitätsabgleich.** Die App lässt einen Vorgang später starten.

### 3. Kapazitätsabgleich

1. Prüfen Sie, dass der Terminplan mit **Berechnen** (F5) berechnet wurde, zum Beispiel über *Start › Terminplanung › Berechnen*.
2. Wählen Sie *Ressourcen › Abgleich › Abgleichen…*. Das Fenster *Kapazitätsabgleich* öffnet sich.
3. Entscheiden Sie, ob das Projektende sich verschieben darf. Wenn Sie das Kästchen *Nur innerhalb des Puffers abgleichen (Glättung) — Projektende bleibt unverändert* nicht aktivieren, darf sich das Projektende verschieben. Wenn Sie es aktivieren, verschiebt die App Vorgänge nur innerhalb ihres Puffers.
4. Unter *Ressourcen* stehen die Ressourcen, die abgeglichen werden. Standardmäßig sind alle Ressourcen angehakt, außer Material. Entfernen Sie den Haken bei einer Ressource, die Sie unverändert lassen wollen.
5. Klicken Sie auf *Berechnen*. Während die App rechnet, steht dort *Wird berechnet…*, und Sie können mit *Abbrechen* stoppen. Der Terminplan ändert sich noch nicht: Das ist ein Vorschlag.
6. Lesen Sie den Vorschlag. Oben steht das Projektende, zum Beispiel *Projektende: unverändert (30-08-2027)* oder *Projektende: 25-08-2027 → 30-08-2027*. Darunter steht eine Tabelle, mit je Vorgang eine Zeile und den Spalten *Alter Start*, *Neuer Start* und *Verschobene Tage*, zum Beispiel *Build outer cavity leaf*, 29-06-2027, 06-07-2027 und *5 d*.
7. Wählen Sie *Anwenden*. Die App schreibt die Verzögerungen in die Vorgänge. Danach wird der Terminplan sofort neu berechnet. Sie müssen F5 nicht drücken. *Abbrechen* schließt das Fenster ohne Änderung.
8. Prüfen Sie *Ressourcen › Überlastung*. Dort steht jetzt *Keine*.

Wenn Sie nach dem Klick auf *Berechnen* eine Option im Fenster ändern, verschwindet der Vorschlag. Klicken Sie dann erneut auf *Berechnen*. Wenn sich der Terminplan ändert, während die App rechnet, steht dort *Der Terminplan wurde während der Berechnung geändert. Klicken Sie erneut auf Berechnen*.

### Entscheiden, welcher Vorgang an seinem Platz bleibt

Die App platziert die Vorgänge einzeln. Die Vorgänge, die zuerst drankommen, bleiben an ihrem Platz. Vorgänge mit der höchsten Priorität kommen zuerst dran. Bei gleicher Priorität kommt der Vorgang mit dem kleinsten Puffer zuerst dran.

Wenn Sie selbst bestimmen wollen, welcher Vorgang bleibt, geben Sie ihm eine höhere Priorität. Klicken Sie mit der rechten Maustaste auf den Balken des Vorgangs im Gantt-Diagramm und wählen Sie *Priorität*, danach *Niedrig* (100), *Normal* (500) oder *Hoch* (900). *Normal* ist der Standard. Sie können auch selbst eine Zahl von 0 bis 1000 eingeben, in der Spalte *Abgleichspriorität*. Klicken Sie dazu rechts in der Kopfzeile der Vorgangstabelle auf das **+** (*Spalte hinzufügen*) und wählen Sie diese Spalte unter *Planung*. Eine höhere Zahl bedeutet, dass der Vorgang eher an seinem Platz bleibt. Die App akzeptiert keine Zahl über 1000. Ein Vorgang mit Priorität 1000 wird wegen der Kapazität nie verschoben.

### Rückgängig machen und wiederholen

- *Rückgängig* (Strg+Z) macht *Anwenden* in einem Schritt rückgängig.
- *Ressourcen › Abgleich › Aufheben* entfernt den gesamten Abgleich aus den Vorgängen. Die Schaltfläche ist grau, solange kein Abgleich besteht. Die Überlastung, die so zurückkommt, ist dann einfach wieder da.
- Haben Sie den Terminplan danach geändert, wählen Sie einfach erneut *Abgleichen…*. Die App fängt dann von vorne an. Die alten Verzögerungen zählen nicht.

## Fallstricke und was die App dann tut

**Noch nicht berechnet.** Wenn der Terminplan noch nicht berechnet wurde, zeigt das Fenster *Berechnen Sie zuerst den Terminplan (F5), bevor Sie den Abgleich durchführen*. Dann ist *Berechnen* nicht verfügbar.

**Verbleibende Konflikte.** Nicht jede Überlastung lässt sich durch Verschieben lösen. Die übrigen Vorgänge stehen unter *Verbleibende Konflikte*, mit der Anzahl Tage und dem Grund:

- *Nicht genug freie Kapazität innerhalb des Puffers, um diesen Konflikt zu lösen*. Das sehen Sie bei *Glättung*: Innerhalb des Puffers des Vorgangs gibt es keinen freien Moment. Entfernen Sie den Haken im Kästchen, dann darf sich das Projektende verschieben.
- *Die Ressource arbeitet nicht an allen Tagen, die dieser Vorgang benötigt — Verschieben löst dies nicht*. Die Ressource hat in ihrem eigenen Kalender freie Tage mitten im Vorgang. Ändern Sie den Kalender oder den Vorgang.
- *Bricklayer erreicht einen Spitzenwert von 2 Einh./Tag, Kapazität ist 1 — durch Verschieben nicht lösbar*. Durch ihre Kurve verlangt der Vorgang allein an einem Tag mehr, als die Ressource liefern kann. Wählen Sie eine andere Kurve oder verringern Sie die Einheiten.

**Die Meldung lautet** *Keine Vorgänge müssen verschoben werden — der Terminplan ist bereits konfliktfrei*. Wenn diese Zeile zusammen mit der Liste *Verbleibende Konflikte* im Vorschlag erscheint, vertrauen Sie der Liste. Die Zeile sagt nur, dass nichts zu verschieben ist. Erscheint die Zeile ohne Liste, obwohl *Ressourcen › Überlastung* noch eine Ressource meldet, dann sind alle kollidierenden Vorgänge auf Priorität 1000 festgesetzt oder bereits gestartet. Sie werden nicht verschoben, und das Fenster meldet sie nicht als Konflikt. Schauen Sie deshalb nach dem Anwenden immer auf *Überlastung*.

**Vorgänge, die nicht verschoben werden.** Ein Vorgang, der bereits begonnen hat oder abgeschlossen ist, wird nie verschoben. Seine Belastung zählt trotzdem. Meilensteine und Phasen werden ebenfalls nicht verschoben.

**Material wird nicht abgeglichen.** Fordert eine Materialressource an einem Tag mehr als ihre *Max. Einheiten*, dann zählt sie in *Überlastung* als überlastet. Sie steht aber nicht im Fenster Kapazitätsabgleich.

**Der Kapazitätsabgleich passt sich nicht an.** Die Verzögerungen bleiben so, wie sie berechnet wurden. Wenn Sie später die Dauer eines Vorgangs ändern, bleibt ein abgeglichener Vorgang dort, wo er ist, auch wenn dieser Platz nicht mehr nötig ist. Führen Sie dann den Abgleich erneut aus.

**Überlastung wegen des Kalenders.** Arbeitet die Ressource an einem Tag laut ihrem Kalender nicht, sagt der Bereich *Warnungen* zum Beispiel: *Überlastet an 5 Tag(en) (29-06-2027 – 05-07-2027), davon 1 Tag(e), an denen die Ressource laut Kalender nicht arbeitet*. Läuft ein Vorgang immer über einen solchen Tag (der zweite Grund oben), löst der Kapazitätsabgleich das nicht.

## Siehe auch

- [Kapazitätsabgleich](docs://uitleg-nivelleren): was der Abgleich verschiebt, innerhalb des Puffers und darüber hinaus, und was er nicht tut.
- [Ressourcen verwalten](docs://howto-resources-beheren): das Anpassen der Kapazität und des Kalenders einer Ressource.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): Vorgänge nacheinander legen.
- [Meldungen und Warnungen](docs://ref-meldingen): die Warnung zur Überlastung im Bereich *Warnungen*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): die Putzer sind an 5 Tagen überlastet. Mit eingeschaltetem Kästchen *Nur innerhalb des Puffers abgleichen (Glättung) — Projektende bleibt unverändert* bleibt das Ende am 17. August 2027, und ein verbleibender Konflikt bleibt bestehen. Ist das Kästchen aus (Standard), ist alles gelöst und das Ende verschiebt sich auf den 24. August 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): der tower crane ist an 65 Tagen überlastet und die plasterers an 15 Tagen. Der Kapazitätsabgleich ohne Haken im Kästchen *Nur innerhalb des Puffers abgleichen (Glättung) — Projektende bleibt unverändert* verschiebt das Ende vom 9. Mai auf den 12. Oktober 2028.
