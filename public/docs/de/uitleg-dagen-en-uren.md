# Tage und Stunden

Ein Vorgang von 2 Tagen und ein Vorgang von 16 Stunden sehen gleich aus, aber die App berechnet sie unterschiedlich. Warum können Sie zwischen Tagen und Stunden wählen? Und was passiert, wenn ein Vorgang in Stunden mit einem Vorgang in Tagen verbunden ist? In diesem Artikel erfahren Sie, wie die App Tage und Stunden zählt und wo sie rundet. Das Rechenbeispiel zeigt die Zahlen.

## Das Konzept

Ein **Tagesvorgang** hat eine Dauer in ganzen Arbeitstagen, zum Beispiel `5d`. Er belegt volle Arbeitstage. Im Standardkalender hat er ein Startdatum und ein Enddatum ohne Uhrzeit.

Ein **Stundenvorgang** hat eine Dauer in Arbeitsstunden, zum Beispiel `12h` oder `1h 30m`. Er hat einen Beginn und ein Ende mit einer Uhrzeit, zum Beispiel Dienstag, 11:00.

Die Einheit gehört zum Vorgang, nicht zum Projekt. Sie können Tagesvorgänge und Stundenvorgänge in einem Terminplan mischen. Das heißt **gemischte Planung**.

Sie verwenden Stunden für Tätigkeiten, die nicht in ganze Tage passen: einen Kran, den Sie für zwölf Stunden mieten, einen Betonguss von sechs Stunden, einen Vorgang, der erst nach der Mittagspause beginnen kann. Für alles andere reichen Tage, und sie sind klarer.

Die **Stundenplanung** ist standardmäßig ausgeschaltet. Solange sie aus ist, arbeitet die App mit Tagen. Wenn eine Datei doch Stundenplanung enthält, zum Beispiel Vorgänge in Stunden, zeigt die App *Diese Datei enthält stundenbasierte Planung.* Diese Vorgänge werden trotzdem berechnet. Sie können ihre Dauer aber erst bearbeiten, wenn Sie die Stundenplanung einschalten.

## So berechnet die App

### Arbeitszeiten und der Standard-Arbeitstag

Jeder Kalender hat für jeden Arbeitstag **Zeitbänder** (in der App *Bänder* genannt). Der Standardkalender hat von 07:00 bis 12:00 und von 13:00 bis 16:00. Die Lücke ist die Pause. Die App leitet diese Bänder aus dem *Beginn (Stunde)*, dem *Ende (Stunde)* und der Pause des Kalenders ab. Sie müssen dafür nichts einstellen. Wenn Sie eigene Bänder pro Wochentag festlegen, haben diese Vorrang.

Der **Standard-Arbeitstag** ist der Arbeitstag, der am häufigsten vorkommt. Seine Länge ist die Summe seiner Bänder. Er ist also kein Durchschnitt: Wenn Montag 16 Stunden hat und Dienstag bis Freitag 10 Stunden, beträgt der *Standard-Arbeitstag* 10 Stunden. Wenn die Arbeitstage unterschiedlich lang sind, gilt die häufigste tägliche Summe. Bei Gleichstand gilt die höchste. Bei vier Tagen zu je 8 Stunden und einem Freitag mit 5 Stunden ist der Standard-Arbeitstag also 8 Stunden. Ein Kalender mit eigenen Stunden pro Tag (zum Beispiel aus Primavera P6) rechnet ebenfalls mit dieser täglichen Summe, und das Kalenderfenster zeigt sie an. Der eigene Wert bleibt für den Export erhalten. Weicht er ab, zeigt das Kalenderfenster unter *Standard-Arbeitstag* einen orangen Block. Ein Vorgang von 1870 Stunden auf Bändern von 10 Stunden dauert daher 187 Tage, auch wenn sein eigener Wert 8 Stunden pro Tag ist.

### Ein Vorgang in Stunden

Die App zählt Arbeitsminuten ab dem Start, durch die Zeitbänder. Pausen, Abende, Wochenenden und Feiertage zählen nicht. Ein Vorgang von 12 Stunden passt daher nicht in einen Arbeitstag von 8 Stunden: Er läuft am nächsten Tag weiter.

### Ein Vorgang in Tagen

Die App zählt ganze Arbeitstage. Die Stunden pro Tag spielen keine Rolle. Ein Vorgang von 5 Tagen endet am selben Tag, ob der Kalender 6 oder 8 Stunden pro Tag hat.

### Tage und Stunden umrechnen

Ein Tag entspricht dem Standard-Arbeitstag des Kalenders des Vorgangs. Die App verwendet das an drei Stellen:

- Für die *Daueranzeige*. Unter *Einstellungen › Projekt › App-Einstellungen*, auf der Registerkarte *Darstellung*, wählen Sie *Automatisch (eigene Einheit je Vorgang)*, *Immer Tage* oder *Immer Stunden*. Ein Vorgang von 18 Stunden wird unter *Immer Tage* als `2.25d(18h)` angezeigt: Die eigene Einheit steht in Klammern.
- Für einen Zeitabstand in Stunden nach einem Tagesvorgang (siehe *Rundung*).
- Wenn Sie die Einheit eines Vorgangs wechseln. Die App zählt dann die Tage ab dem Beginn des Vorgangs, jeden Tag mit seinen eigenen Stunden, und rechnet die Dauer sofort um, wenn das Ergebnis genau ist. Zwei Tage werden `16h`. In einem Kalender, in dem der Freitag 5 Stunden hat, werden 5 Tage ab Montag `37h`. Zwölf Stunden lassen sich in einem Kalender mit Tagen zu 8 Stunden nicht in ganze Tage umrechnen. Die App lässt die Einheit dann unverändert.

### Tagesvorgänge und Stundenvorgänge zusammen

Die folgenden Regeln gelten für eine Ende-Anfang-Beziehung in einem Kalender ohne eigene Zeitbänder, zum Beispiel dem Standardkalender.

- **Stunde → Stunde.** Der Nachfolger beginnt sofort, wenn der Vorgänger abgeschlossen ist, auch wenn das mitten an einem Tag ist.
- **Stunde → Tag.** Ein Tagesvorgang beginnt nie mitten an einem Tag. Er beginnt am ersten Arbeitstag nach dem Tag, an dem der Stundenvorgang endet. Der Rest dieses Tages bleibt ungenutzt und wird als Puffer des Stundenvorgangs wieder sichtbar.
- **Tag → Stunde.** Ein Tagesvorgang belegt seinen ganzen letzten Tag. Der Stundenvorgang beginnt am ersten Arbeitstag danach, am Anfang des ersten Zeitbands.

### Rundung

Die App rundet an vier Stellen oder lehnt Werte ab:

- **Ein Tagesvorgang nach einem Stundenvorgang** beginnt am nächsten Arbeitstag. Der Stundenvorgang wird sozusagen auf ganze Tage aufgerundet.
- **Ein Zeitabstand in Stunden** wird im Kalender des Zeitabstands gezählt, standardmäßig im Kalender des Vorgängers. Ist der Vorgänger ein Tagesvorgang in einem Kalender ohne eigene Zeitbänder, zum Beispiel dem Standardkalender, rechnet die App den Zeitabstand in ganze Arbeitstage um: Der Zeitabstand geteilt durch die Stunden des Standard-Arbeitstags, auf eine ganze Zahl gerundet. Ein halber Tag wird aufgerundet. Bei 8 Stunden pro Tag zählt 1 Stunde als 0 Tage, 4 Stunden als 1 Tag und 12 Stunden als 2 Tage. Das gilt auch, wenn der Nachfolger ein Stundenvorgang ist. Ist der Vorgänger ein Stundenvorgang oder hat sein Kalender eigene Zeitbänder, zählt der Zeitabstand genau in Arbeitsstunden, und die Pause zählt nicht mit.
- **Eine Dauer in Tagen** ist immer eine ganze Zahl. Wenn Sie `1.5d` eingeben, zeigt die App *Geben Sie eine ganze Anzahl Tage oder Stunden ein, zum Beispiel 2d oder 12h*. Eine Dauer in Stunden kann `1.5h` oder `1h 30m` sein.
- **Ein Wechsel der Einheit** erfolgt nur, wenn das Ergebnis genau ist (siehe oben).

## Rechenbeispiel: der Kran

Der Kalender gilt von Montag bis Freitag von 07:00 bis 12:00 und von 13:00 bis 16:00: ein Standard-Arbeitstag von 8 Stunden. Das Projekt beginnt am Montag, 7. Juni 2027.

### Stunde, Stunde und Tag

*Place crane* dauert 12 Stunden. Montag hat Arbeitszeiten von 8 Stunden (5 bis 12:00 und 3 nach der Pause), und Dienstag hat die letzten 4 Stunden. Der Vorgang läuft von Montag, 07:00 bis **Dienstag, 8. Juni, 11:00**.

*Adjust elements* dauert 8 Stunden und folgt mit einer Ende-Anfang-Beziehung. Er beginnt sofort am Dienstag um 11:00: das sind 1 Stunde bis zur Pause und 3 Stunden danach. Die letzten 4 Stunden sind am Mittwoch von 07:00 bis 11:00. Das Ende ist **Mittwoch, 9. Juni, 11:00**.

*Finishing* dauert 2 Tage und folgt auf *Adjust elements*. Ein Tagesvorgang beginnt nie mitten an einem Tag. Deshalb beginnt er am **Donnerstag, 10. Juni**, und endet am Freitag, 11. Juni.

### Rundung beim Übergang

Wenn Sie *Adjust elements* weglassen und *Finishing* direkt mit *Place crane* verbinden, beginnt *Finishing* am Mittwoch, 9. Juni, und endet am Donnerstag, 10. Juni. Der Rest des Dienstags (4 Arbeitsstunden) kann nicht genutzt werden. Diese 4 Stunden sehen Sie wieder als Gesamtpuffer von *Place crane*: einen halben Arbeitstag.

Kehren Sie die Reihenfolge um, dann ist es einfacher. *Pour foundation* dauert 2 Tage, von Montag, 7. bis Dienstag, 8. Juni. *Place crane* dauert jetzt 4 Stunden und folgt darauf. Er beginnt am **Mittwoch, 9. Juni, um 07:00** und endet um 11:00.

### Ein Zeitabstand in Stunden

Zwischen *Place crane* (12 Stunden) und *Adjust elements* (8 Stunden) legen Sie einen Zeitabstand von 2 Stunden fest. *Adjust elements* beginnt dann nicht um 11:00, sondern am Dienstag um **14:00**: 1 Stunde bis zur Pause und 1 Stunde danach. Das Ende verschiebt sich auf **Mittwoch, 9. Juni, 14:00**.

Nach einem Tagesvorgang funktioniert ein Zeitabstand anders. *Pour foundation* endet am Dienstag, 8. Juni. Ohne Zeitabstand beginnt *Finishing* am Mittwoch, 9. Juni. Bei einem Zeitabstand von 4 Stunden sind das ein halber Tag, und die App rundet auf: *Finishing* beginnt am **Donnerstag, 10. Juni**. Bei einem Zeitabstand von 1 Stunde rundet die App ab, und *Finishing* beginnt einfach am Mittwoch.

### Ein freier Freitagnachmittag

Jetzt hat der Freitag nur ein Band, von 07:00 bis 12:00: 5 Stunden. Die anderen Tage bleiben bei 8 Stunden. Der Standard-Arbeitstag bleibt 8 Stunden, weil das die häufigste tägliche Summe ist. Eine Woche hat jetzt 37 Arbeitsstunden.

Ein Vorgang von 40 Stunden ab Montag, 7. Juni, 07:00, belegt Montag bis Donnerstag (32 Stunden) und den Freitag (5 Stunden). Die letzten 3 Stunden fallen auf den folgenden Montag, von 07:00 bis 10:00. Das Ende ist **Montag, 14. Juni, 10:00**. Ein Vorgang von 5 Tagen würde ab Montag 37 Stunden belegen. Genau das schlägt die App vor, wenn Sie die Einheit von 5 Tagen auf Stunden umstellen.

Im Tutorial 4 zur Stundenplanung planen Sie einen Kranauftrag selbst in Stunden.

## Folgen und Missverständnisse

**„8 Stunden sind 1 Tag.“** Nur wenn der Kalender Tage zu 8 Stunden hat. Im Kalender mit dem freien Freitagnachmittag sind 5 Tage 37 Stunden, nicht 40.

**„Wenn ich mehr Stunden pro Tag einstelle, endet mein Tagesvorgang früher.“** Nein. Ein Tagesvorgang zählt ganze Arbeitstage. Die Stunden pro Tag ändern nur, was ein Tag in Stunden wert ist, zum Beispiel in der Anzeige und für einen Zeitabstand in Stunden. Nur bei einem Vorgang mit Ressourcen und der Vorgangsart *Feste Arbeit* oder *Feste Einheiten* ändert sich die Dauer mit, weil die Arbeit gleich bleibt: 40 Stunden Arbeit sind 5 Tage zu 8 Stunden pro Tag und 7 Tage zu 6 Stunden pro Tag.

**„Ein Vorgang von 8 Stunden dauert einen Tag.“** Nur wenn er am Anfang des Tages beginnt. Beginnt er später, wie *Adjust elements* am Dienstag um 11:00, läuft er bis in den nächsten Tag hinein.

**Ein Kalender mit eigenen Zeitbändern** verhält sich anders als der Standardkalender. Einen solchen Kalender erhalten Sie, indem Sie Arbeitszeiten pro Wochentag festlegen oder eine Schichtvorlage wählen (*2 Schichten*, *3 Schichten*, *Nachtschicht* oder *24/7*). In einem solchen Kalender zählt ein Zeitabstand in Stunden genau in Arbeitsstunden, auch nach einem Tagesvorgang.

**Ausschalten der Stundenplanung** entfernt nichts. Vorgänge in Stunden bleiben erhalten und werden weiter berechnet. Sie können sie aber erst wieder bearbeiten, wenn Sie die Stundenplanung wieder einschalten.

## Siehe auch

- [Stundenplanung einschalten](docs://howto-urenplanning-aanzetten): die Schritte, um einen Vorgang in Stunden zu planen.
- [Arbeitszeiten festlegen](docs://howto-werktijden-instellen): die Zeitbänder eines Kalenders anpassen.
- [Kalender und Arbeitstage](docs://uitleg-kalenders): wie die App Arbeitstage zählt und welcher Kalender Vorrang hat.
- [Beziehungen hinzufügen](docs://howto-relaties-leggen): die Schritte, um eine Beziehung oder einen Zeitabstand hinzuzufügen.
