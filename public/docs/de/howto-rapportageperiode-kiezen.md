# Den Berichtszeitraum wählen

Ziel: Bestimmen Sie, welchen Zeitraum ein Bericht abdeckt, zum Beispiel die kommenden vier Wochen oder den Monat Juni.

## Wann Sie das brauchen

Die wöchentliche Besprechung möchte wissen, was in den kommenden vier Wochen passiert. Der monatliche Bericht umfasst Juni. Ohne Zeitraum erhalten Sie den ganzen Terminplan auf Papier. Fünf Berichte arbeiten daher mit einem *Berichtszeitraum*: *Vorschau (Look-ahead)*, *Fortschrittsbericht*, *Ressourcenauslastung*, *Ressourcenzuweisungen* und das *Ressourcendiagramm*. Die anderen Berichte haben keinen Zeitraum.

Der Zeitraum ist nicht an einen Kalendermonat gebunden, sondern an einen **Bezugstag**: das Statusdatum Ihres Projekts (der Tag, an dem Sie den Fortschritt messen, siehe [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang)) oder heute, wenn das Projekt kein Statusdatum hat. *Nächste 4 Wochen* zählt ab diesem Tag. Wenn Sie das Statusdatum verschieben, wandert der Zeitraum mit.

## Schritte

### 1. Legen Sie das Statusdatum fest

Wenn Sie mit einer relativen Auswahl arbeiten, etwa *Nächste 4 Wochen* oder *Letzter Monat*, legen Sie zuerst das Statusdatum fest. Wählen Sie *Planung › Baselines & Fortschritt* und füllen Sie das Feld *Statusdatum* aus. Mit dem Kreuz daneben (*Statusdatum leeren*) entfernen Sie das Datum wieder. Wenn Sie mit einem festen Zeitraum arbeiten (Schritt 4), brauchen Sie dies nicht.

### 2. Wählen Sie einen Bericht mit Zeitraum

Öffnen Sie den Tab *Bericht* und wählen Sie einen der fünf Berichte bei *Berichtstyp*. Die Liste *Berichtszeitraum:* steht unter *Berichtsoptionen*. Beim *Ressourcendiagramm* steht sie unter *Einstellungen*, direkt unter den vier Kontrollkästchen dieses Berichts.

Jeder Bericht merkt sich seinen eigenen Zeitraum. Dies sind die Startwerte:

- *Vorschau (Look-ahead)*: *Nächster Monat*.
- *Fortschrittsbericht*: *Letzter Monat*.
- *Ressourcenauslastung*, *Ressourcenzuweisungen* und *Ressourcendiagramm*: *Gesamtes Projekt*.

### 3. Wählen Sie einen Zeitraum aus der Liste

Die Liste hat *Nächste Woche*, *Nächste 2 Wochen*, *Nächste 4 Wochen*, *Nächste 6 Wochen*, *Nächste 8 Wochen*, *Nächste 12 Wochen*, *Nächster Monat*, dieselben sieben für die Vergangenheit (zum Beispiel *Letzte 2 Wochen* und *Letzter Monat*), *Gesamtes Projekt* und *Benutzerdefiniert*. Unter der Liste stehen *Von* und *Bis* mit den Daten, die die Auswahl ergibt. Hier können Sie diese nur lesen.

Beide Tage zählen mit. Ist das Statusdatum Donnerstag, der 20. Mai, dann läuft *Nächste Woche* vom 20. bis einschließlich 26. Mai und *Nächste 4 Wochen* vom 20. Mai bis einschließlich 16. Juni (28 Tage). *Nächster Monat* läuft bis einen Tag vor demselben Datum im nächsten Monat, hier bis einschließlich 19. Juni. *Letzte 2 Wochen* läuft vom 7. bis einschließlich 20. Mai.

*Gesamtes Projekt* umfasst den Terminplan vom frühesten Beginn bis zum spätesten Ende.

### 4. Oder wählen Sie *Benutzerdefiniert*

Bei *Benutzerdefiniert* werden *Von* und *Bis* zu zwei Datumsfeldern. Sie beginnen mit den Daten der Auswahl, die Sie zuvor hatten. Füllen Sie beide aus, zum Beispiel 1. und 14. Juni. Ist die Eingabe nicht richtig, bleibt der Bericht beim letzten gültigen Zeitraum, und es erscheint in Rot:

- *Das Enddatum liegt vor dem Anfangsdatum*, wenn *Bis* früher liegt als *Von*.
- *Beide Daten ausfüllen*, wenn eines der beiden leer ist.

### 5. Lesen Sie den Zeitraum im Bericht

Bei der *Vorschau (Look-ahead)*, der *Ressourcenauslastung* und den *Ressourcenzuweisungen* steht der Zeitraum unter dem Titel, zum Beispiel *Zeitraum: 20-05-2027 – 19-06-2027*. Wenn Sie *Gesamtes Projekt* wählen, steht *Gesamtes Projekt* hinter den Daten. Der *Fortschrittsbericht* zeigt den Zeitraum in der Zusammenfassung bei *Zeitraum*. Die Zeitachse des *Ressourcendiagramms* deckt genau den Zeitraum ab.

### Was der Zeitraum pro Bericht bewirkt

Der Zeitraum wirkt nicht in jedem Bericht gleich.

- **Vorschau (Look-ahead)** nimmt die unfertigen Vorgänge auf, die den Zeitraum berühren, auch wenn sie den ganzen Zeitraum umfassen. Überfällige Vorgänge von vor dem Bezugstag gehören ebenfalls dazu, solange das Ende des Zeitraums nicht vor dem Bezugstag liegt. Ein benutzerdefinierter Zeitraum, der ganz in der Vergangenheit liegt, ist ein Blick zurück: Er zeigt nur, was damals lief und noch nicht fertig ist, ohne den heutigen Rückstand.
- **Fortschrittsbericht** nutzt den Zeitraum für *Im vergangenen Zeitraum abgeschlossen*. Der Abschnitt *Beginn im kommenden Zeitraum* schaut ab dem Statusdatum voraus, bis zu dem Datum bei *Vorschau bis* in der Zusammenfassung. Wenn Sie einen Zeitraum für die Vergangenheit wählen, schaut der Bericht so weit voraus, wie er zurückschaut: Bei *Letzte 2 Wochen* und dem Statusdatum 20. Mai steht bei *Vorschau bis* der 3. Juni. Ein benutzerdefinierter Zeitraum oder *Gesamtes Projekt*, der ganz in der Vergangenheit liegt, wird nicht gespiegelt.
- **Ressourcenauslastung** zeigt jede Woche oder jeden Monat, der den Zeitraum berührt, vollständig. Wenn Ihr Zeitraum von Mittwoch bis Mittwoch läuft, sehen Sie deshalb ganze Wochen. So zeigt eine Zeile immer dieselbe Zahl wie das *Histogramm*.
- **Ressourcenzuweisungen** zeigt die Zuweisungen von Vorgängen, die den Zeitraum berühren. Bei *Gesamtes Projekt* gibt es keine Filterung nach Datum.
- **Ressourcendiagramm** zeigt nur die Vorgänge, die den Zeitraum berühren. In der Zusammenfassung zeigt *Außerhalb des Zeitraums:* an, wie viele Vorgänge ausgelassen wurden.

## Fallstricke und was die App tut

**Es gibt kein Statusdatum.** Die App rechnet dann mit heute. Bei den vier Tabellenberichten mit Zeitraum (*Vorschau (Look-ahead)*, *Fortschrittsbericht*, *Ressourcenauslastung* und *Ressourcenzuweisungen*) steht bei einem relativen Zeitraum oben *Kein Statusdatum gesetzt — der Bericht rechnet mit heute (29-09-2026).* Dort steht Ihr eigenes Datum von heute. Das Ressourcendiagramm meldet dies nicht. Schauen Sie daher auf *Von* und *Bis*: Diese liegen dann um heute herum, nicht um Ihren Terminplan.

**Der Zeitraum liegt außerhalb Ihres Terminplans.** Dann ist der Bericht leer. Das Ressourcendiagramm sagt dies mit *Keine Vorgänge im Berichtszeitraum — wählen Sie einen anderen Zeitraum oder Gesamtes Projekt.* (in der Liste heißt diese Auswahl *Gesamtes Projekt*). In den anderen Berichten sehen Sie null Vorgänge oder keine Zeilen.

**Die Datumsangaben folgen Ihrer eigenen Schreibweise.** *Von* und *Bis* folgen der Datumsschreibweise aus Ihren Einstellungen, außer in den Datumsfeldern von *Benutzerdefiniert*. Diese zeigen die Schreibweise Ihres Browsers.

**Der Zeitraum wandert mit.** Eine relative Auswahl wie *Nächster Monat* wird jedes Mal neu bestimmt. Ändert sich das Statusdatum, oder ist kein Statusdatum gesetzt und ist ein Tag vergangen, dann wandert der Zeitraum sofort mit. Wenn Sie einen festen Zeitraum wollen, wählen Sie *Benutzerdefiniert*.

**Die Auswahl gilt für alle Ihre Projekte.** Ein benutzerdefinierter Zeitraum gilt auch für alle Ihre Projekte auf diesem Gerät, nicht nur für das geöffnete Projekt.

## Siehe auch

- [Einen Bericht erstellen und drucken](docs://howto-rapport-maken-en-afdrukken): der ganze Weg vom Berichtstyp bis zur PDF-Datei.
- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): was das Statusdatum ist und warum die App damit rechnet.
- [Überlastung auflösen](docs://howto-overbezetting-oplossen): was Sie mit den überlasteten Wochen aus der Ressourcenauslastung tun.
- [Berichtstypen](docs://ref-rapporttypes): alle Berichtstypen und ihre Optionen.
