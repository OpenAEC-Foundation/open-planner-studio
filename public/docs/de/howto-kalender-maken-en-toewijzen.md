# Kalender erstellen und zuweisen

Ziel: Erstellen Sie einen eigenen Kalender, zum Beispiel eine Sechstagewoche, und weisen Sie ihn den Vorgängen zu, die darin berechnet werden müssen.

## Wann Sie das brauchen

Ein Subunternehmer arbeitet auch samstags. Ein Team arbeitet nur montags bis donnerstags. Ein Vorgang fällt in eine Zeitspanne, in der nur dieser Vorgang stillsteht. Der Projektkalender hat dann die falschen Arbeitstage. Mit einem eigenen Kalender berechnet die App diese Vorgänge an den richtigen Tagen, und der Rest bleibt im Projektkalender. Was die App mit einem Kalender genau macht, lesen Sie unter [Kalender und Arbeitstage](docs://uitleg-kalenders).

## Schritte

### Einen Kalender erstellen

1. Wählen Sie *Planung › Kalender › Kalender*. Dieselbe Schaltfläche finden Sie unter *Einstellungen › Kalender › Kalender*. Das Fenster *Kalender* öffnet sich. Links stehen die Kalender des Projekts; der Projektkalender hat einen Stern.
2. Klicken Sie unter der Liste auf die Schaltfläche mit dem Pluszeichen (*Neuer Kalender*). Der neue Kalender ist eine Kopie des Standards: Montag bis Freitag, 07:00 bis 16:00 Uhr, mit einer Stunde Pause und, wenn *Baumodus* aktiv ist, den niederländischen Feiertagen. Wenn Sie einen vorhandenen Kalender als Grundlage verwenden möchten, wählen Sie ihn in der Liste aus und klicken Sie unter der Liste auf die Schaltfläche mit den zwei Blättern (*Duplizieren*).
3. Geben Sie dem Kalender unter *Name* einen Namen, der zeigt, wer ihn verwendet, zum Beispiel *Six-day week*.
4. Klicken Sie unter *Arbeitstage* die Wochentage an oder ab. *Mo–Fr* stellt die Standardwoche mit 07:00 bis 16:00 Uhr wieder her. Hat der Kalender Bänder, schaltet *Mo–Fr* nur Montag bis Freitag ein, und jeder Tag behält seine Bänder. *Durchgehend (24/7)* schaltet alle sieben Tage ein, von 00:00 bis 24:00 Uhr.
5. Passen Sie bei Bedarf die Arbeitszeiten an: *Beginn (Stunde)*, *Ende (Stunde)*, *Pausenbeginn* und *Pausendauer (Minuten)*. Sie geben Zeiten als HH:MM ein; mit den Pfeilen erhöhen oder verringern Sie sie um eine Viertelstunde. Wenn Sie die Pausendauer auf 0 setzen, arbeitet der Kalender ohne Pause. Die App berechnet den *Standard-Arbeitstag* selbst. Hat der Kalender Bänder pro Wochentag, zum Beispiel aus MS Project, sehen Sie diese Felder nicht, sondern den Abschnitt *Arbeitszeiten*, auch bei ausgeschalteter Stundenplanung; siehe [Arbeitszeiten einstellen](docs://howto-werktijden-instellen).
6. Passen Sie bei Bedarf die Feiertage an. Wie das funktioniert, steht unter [Feiertage und Bauferien erzeugen](docs://howto-feestdagen-genereren).
7. Klicken Sie auf *Anwenden*. Die App berechnet den Terminplan sofort neu und schließt das Fenster. Mit *Abbrechen* verwerfen Sie die Änderungen. Die Eingabetaste in einem Eingabefeld speichert zwischendurch und berechnet ebenfalls neu, ohne das Fenster zu schließen; *Abbrechen* macht dann nur rückgängig, was Sie danach geändert haben.

### Einem Vorgang einen Kalender geben

Ein neuer Kalender wirkt erst, wenn ein Vorgang ihn verwendet. Es gibt zwei Wege.

**Über den Eigenschaftenbereich**

1. Wählen Sie den Vorgang aus. Wenn Sie den Bereich *Eigenschaften* nicht sehen, schalten Sie ihn ein mit *Ansicht › Bereiche › Eigenschaften*.
2. Wählen Sie unter *Vorgang* in der Liste *Kalender* den Kalender. Die oberste Auswahl, *Projektkalender* mit dem Namen dahinter, bedeutet, dass der Vorgang keinen eigenen Kalender hat.

**Über das Kontextmenü**

1. Klicken Sie mit der rechten Maustaste auf den Vorgang, in der Vorgangstabelle oder auf den Balken im Gantt.
2. Wählen Sie *Kalender zuweisen* und dann den Kalender, oder *Projektkalender*, um den eigenen Kalender des Vorgangs wieder zu entfernen. Der jetzt geltende Kalender hat ein Häkchen.
3. Wenn Sie mehreren Vorgängen gleichzeitig einen Kalender geben möchten, wählen Sie sie zuerst mit Strg (⌘ auf dem Mac) aus und klicken Sie mit der rechten Maustaste auf einen der ausgewählten Vorgänge. Die Auswahl gilt für alle ausgewählten Vorgänge. Wenn Sie mit der rechten Maustaste auf einen Vorgang klicken, der nicht ausgewählt ist, gilt die Auswahl nur für diesen einen Vorgang.

Eine neue Kalenderauswahl macht den Terminplan noch nicht aktuell: Die Statusleiste meldet *Veraltet — neu berechnen (F5)*. Drücken Sie **Berechnen** (F5), zum Beispiel über *Start › Terminplanung › Berechnen*. Ist *Automatisch berechnen* aktiv (*Einstellungen › Projekt › App-Einstellungen*, Reiter *Planung*, Abschnitt *Berechnung*), führt die App das selbst aus.

### Projektkalender wechseln

1. Öffnen Sie *Planung › Kalender › Kalender* und wählen Sie den Kalender in der Liste aus.
2. Klicken Sie über dem Formular auf *Als Projektstandard festlegen*. Der Stern wandert zu diesem Kalender.
3. Klicken Sie auf *Anwenden*.

Nur die Vorgänge ohne eigenen Kalender wandern mit.

### Einen Kalender löschen

1. Öffnen Sie das Fenster *Kalender* und wählen Sie den Kalender in der Liste aus.
2. Klicken Sie unter der Liste auf die Schaltfläche mit dem Papierkorb (*Löschen*). Diese Schaltfläche ist deaktiviert, solange nur ein Kalender vorhanden ist.
3. Klicken Sie auf *Anwenden*. Vorgänge und Ressourcen, die diesen Kalender nutzen, greifen auf den Projektkalender zurück. Wenn Sie den Projektkalender selbst löschen, wird der erste Kalender in der Liste zum Projektkalender.

## Fallstricke und was die App dann tut

**Keine Arbeitstage.** Wenn Sie alle Wochentage ausschalten, kann die App nicht berechnen. Beim Berechnen meldet sie *Im Kalender sind keine Arbeitstage festgelegt*.

**Ungültige Eingaben.** Eine Pause außerhalb des Arbeitstags, eine Startzeit nach der Endzeit oder ein Feiertag mit falschem Datum bekommt am Feld eine rote Meldung, und *Anwenden* ist deaktiviert, bis Sie den Fehler beheben. Bei einer ungültigen Pause oder einem ungültigen Feiertag steht außerdem ein Warnzeichen neben dem Kalender in der Liste (*Dieser Kalender enthält ungültige Eingaben*).

**Ein Kalender für eine Phase.** Eine Phase wird immer mit dem Projektkalender berechnet, weil ihre Dauer aus ihren Vorgängen folgt. Geben Sie den Kalender den Vorgängen selbst.

**Derselbe Kalender, zwei Auswahlen.** In der Liste erscheint der Projektkalender zweimal: als *Projektkalender: Name* und als gewöhnlicher Kalender mit diesem Namen. Wenn Sie den zweiten wählen, ist das eine eigene Auswahl für diesen Vorgang. Der Vorgang wandert dann nicht mit, wenn Sie später einen anderen Projektkalender wählen.

**Unterschiedliche Stunden pro Tag.** Wenn Sie die Arbeitszeiten oder die Pause so ändern, dass sich der *Standard-Arbeitstag* eines Kalenders ändert, zählt ein Vorgang in Tagen weiterhin dieselbe Anzahl Tage. Bei einem Vorgang mit Ressourcen und der Vorgangsart *Feste Arbeit* oder *Feste Einheiten* ändert sich die Dauer dagegen mit, weil die Arbeit gleich bleibt. Vierzig Stunden Arbeit sind 5 Tage zu 8 Stunden pro Tag und 7 Tage zu 6 Stunden pro Tag. Die App meldet, bei wie vielen Vorgängen sich die Dauer geändert hat.

## Siehe auch

- [Kalender und Arbeitstage](docs://uitleg-kalenders): wie die App Arbeitstage zählt und welcher Kalender gewinnt.
- [Tage und Stunden](docs://uitleg-dagen-en-uren): was der Standard-Arbeitstag bewirkt.
- [Einen Ressourcenkalender einrichten](docs://howto-resourcekalender-instellen): ein Kalender für eine Ressource statt für einen Vorgang.
- [Kalenderfenster](docs://ref-kalenders): alle Felder der Kalenderfenster.
