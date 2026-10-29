# Beziehungen und Zeitabstand

Warum beginnt das Mauerwerk erst, wenn das Fundament fertig ist? Und warum verschiebt sich die Dachmontage um eine Woche, wenn die Dachelemente zu spät geliefert werden? Das liegt an den Beziehungen zwischen Ihren Vorgängen. In diesem Artikel lesen Sie, welche vier Arten von Beziehungen die App kennt, was Zeitabstand und Vorlauf bewirken, in welchem Kalender ein Zeitabstand zählt, was mit einer Beziehung auf einem Sammelvorgang geschieht und wie die App entscheidet, welche Beziehung den Starttermin eines Vorgangs bestimmt.

Die Regeln und Beispiele gelten für ein neues Projekt mit dem Berechnungsprofil *Open Planner Studio* und einer Arbeitswoche von Montag bis Freitag.

## Das Konzept

Eine **Beziehung** legt fest, dass zwei Vorgänge voneinander abhängen. Der erste Vorgang ist der **Vorgänger**, der zweite der **Nachfolger**. Eine Beziehung ist eine untere Grenze. Der Nachfolger darf nie früher beginnen oder enden, als die Beziehung erlaubt. Er darf aber später beginnen oder enden. Hat ein Vorgang mehrere Vorgänger, wartet er auf den spätesten Termin, der sich aus allen diesen Beziehungen ergibt.

Es gibt vier Arten. Sie unterscheiden sich darin, welcher Zeitpunkt des Vorgängers (Anfang oder Ende) mit welchem Zeitpunkt des Nachfolgers verbunden ist:

- **FS (Ende-Anfang).** Der Nachfolger beginnt erst, wenn der Vorgänger beendet ist. Die Dachelemente werden erst eingebaut, wenn die Wände stehen. Diese Art wird mit Abstand am häufigsten verwendet.
- **SS (Anfang-Anfang).** Der Nachfolger beginnt erst, wenn der Vorgänger begonnen hat. Die Vorgänge dürfen sich überlappen: Die Rohrleitungen können beginnen, sobald das Mauerwerk im Gange ist.
- **FF (Ende-Ende).** Der Nachfolger endet erst, wenn der Vorgänger beendet ist. Die Fugenarbeiten können nicht vor Abschluss des Mauerwerks fertig werden, dürfen aber früher beginnen.
- **SF (Anfang-Ende).** Der Nachfolger endet erst, wenn der Vorgänger begonnen hat. Diese Art ist selten. Ein Beispiel: Die temporäre Wasserhaltung darf erst enden, wenn das Mauerwerk am Fundament begonnen hat.

Eine Beziehung kann außerdem einen **Zeitabstand** haben: Wartezeit zwischen den beiden Vorgängen, zum Beispiel wenn Beton aushärten muss. Ein negativer Zeitabstand heißt **Vorlauf**. Der Nachfolger beginnt dann, bevor der Vorgänger beendet ist, sodass die Vorgänge sich überlappen.

## Wie die App rechnet

### Die vier Arten

Für jede Beziehung berechnet die App den frühesten Termin, an dem der Nachfolger beginnen kann. Sie nimmt den spätesten Termin aller Beziehungen eines Vorgangs. Ohne Zeitabstand funktioniert das so:

- Bei FS beginnt der Nachfolger am ersten Arbeitstag nach dem Ende des Vorgängers.
- Bei SS beginnt der Nachfolger am selben Tag wie der Vorgänger.
- Bei FF endet der Nachfolger am selben Tag wie der Vorgänger. Für den Anfang rechnet die App rückwärts über die Dauer des Nachfolgers. Ein Nachfolger von 3 Arbeitstagen beginnt deshalb 2 Arbeitstage vor dem Ende des Vorgängers.
- Bei SF endet der Nachfolger an dem Tag, an dem der Vorgänger beginnt. Auch hier rechnet die App rückwärts über die Dauer des Nachfolgers.

Diese Werte sind untere Grenzen. Ein Nachfolger beginnt später, wenn eine andere Beziehung oder eine Einschränkung das verlangt. Alle Termine erscheinen erst nach **Berechnen** (F5). Solange in der Statusleiste *Veraltet — neu berechnen (F5)* steht, gehören die Balken zur vorherigen Berechnung.

### Zeitabstand und Vorlauf

Ein Zeitabstand lässt sich auf vier Arten angeben:

- In **Arbeitstagen** (`3` oder `3d`): Die App überspringt freie Tage und Wochenenden. Das ist der Standard.
- In **Kalendertagen** (`3ed`, das e steht für verstrichene Zeit): Jeder Tag zählt, auch Samstag und Sonntag. Diese Einheit nehmen Sie für etwas, das weiterläuft, auch wenn niemand daran arbeitet, etwa das Aushärten.
- Als **Prozentsatz** der Dauer des Vorgängers (`40%`): Die App rechnet das bei jeder Berechnung neu aus und rundet auf ganze Tage (2,5 Tage wird 3).
- In **Arbeitszeiten** (`4h`): Die App zählt den Zeitabstand im Abstandskalender, standardmäßig dem des Vorgängers. Ist der Vorgänger ein Tagesvorgang in einem Kalender ohne eigene Bänder, wie dem Standardkalender, dann rechnet die App die Stunden in ganze Arbeitstage um. Die App rundet auf den nächsten ganzen Tag. Ein halber Tag wird nach oben gerundet. Bei einem Arbeitstag von 8 Stunden ergeben `2h` und `3h` daher 0 Tage, `4h` bis einschließlich `11h` 1 Tag und `12h` 2 Tage. Hat dieser Kalender eigene Bänder oder ist der Vorgänger ein Stundenvorgang, zählt der Zeitabstand genau in Arbeitszeiten.

Die Regel für einen Zeitabstand von N Arbeitstagen bei FS: Die N Arbeitstage nach dem Ende des Vorgängers sind Wartezeit. Der Nachfolger beginnt am Arbeitstag danach. Bei SS und FF wird der Zeitabstand zum Anfang bzw. zum Ende des Vorgängers addiert. Ein negativer Zeitabstand rechnet rückwärts: Ein Vorlauf von 1 Arbeitstag bei FS lässt den Nachfolger an dem Tag beginnen, an dem der Vorgänger endet.

Ein Vorlauf kann einen Vorgang nicht vor den Projektstart legen. Würde das passieren, hält die App den Nachfolger am Projektstart. Sie meldet das im Bereich *Warnungen*: *Vorlauf durch den Projektstart gekappt — die Beziehung wird nicht vollständig eingehalten*.

### In welchem Kalender der Zeitabstand zählt

Jeder Vorgang kann seinen eigenen Kalender haben. Bei einem Zeitabstand in Arbeitstagen ist wichtig, welcher Kalender die Arbeitstage zählt. Die Einstellung *Abstandskalender* legt das fest, mit vier Auswahlmöglichkeiten: *Vorgänger*, *Nachfolger*, *24-Stunden* und *Projektkalender*. Der Standard ist, dass der Zeitabstand im Kalender des **Vorgängers** zählt. Sie finden die Einstellung unter *Einstellungen › Projekt › Projekteinstellungen*, im Block *Berechnungsprofil und Berechnungsoptionen*, bei *Berechnungsoptionen dieses Projekts*. Die Auswahl gehört zur Projektdatei. Sie gilt erst, wenn Sie auf *Anwenden* klicken. Danach wird der Terminplan neu berechnet.

Ein Zeitabstand in Kalendertagen (`3ed`) zählt immer alle Tage, egal welchen *Abstandskalender* Sie wählen.

### Beziehungen auf Sammelvorgängen

Sie können eine Beziehung auf einen Sammelvorgang legen, statt auf einen Vorgang darin. Intern legt die App diese Beziehung auf jeden Vorgang im Sammelvorgang:

- Ein Sammelvorgang als **Vorgänger** mit FS oder FF: Der Nachfolger wartet, bis der letzte Vorgang im Sammelvorgang beendet ist.
- Ein Sammelvorgang als **Nachfolger** mit FS oder SS: Jeder Vorgang im Sammelvorgang wartet auf den Vorgänger, unabhängig von den anderen Vorgängen im Sammelvorgang.
- Ein Sammelvorgang als **Vorgänger** mit SS oder SF: Der Nachfolger wartet auf den Anfang des Vorgangs im Sammelvorgang, der **zuletzt** beginnt, nicht auf den Anfang des Sammelvorgangs selbst. Das ist vorsichtiger, als Sie vielleicht erwarten. Der Nachfolger beginnt nie zu früh, aber eventuell später als gewollt. Wenn der Nachfolger dem Anfang des Sammelvorgangs folgen soll, legen Sie die Beziehung auf den ersten Vorgang im Sammelvorgang.
- Ein Sammelvorgang als **Nachfolger** mit FF oder SF: Jeder Vorgang im Sammelvorgang muss die Bedingung selbst erfüllen. Bei FF muss er am oder nach dem Ende des Vorgängers enden, bei SF am oder nach dem Anfang des Vorgängers. Das gilt auch für einen Vorgang, der viel früher fertig sein könnte. Legen Sie eine solche Beziehung besser auf den letzten Vorgang im Sammelvorgang.

Eine Beziehung zwischen einem Vorgang und dem Sammelvorgang, in dem er liegt, ist nicht erlaubt.

### Maßgebende Beziehungen

Hat ein Nachfolger mehrere Vorgänger, bestimmt meist eine Beziehung seinen Starttermin. Es ist die Beziehung, die verhindert, dass der Nachfolger auch nur einen Tag früher beginnt, als er jetzt beginnt. Eine solche Beziehung heißt **maßgebend**. Bei einem Gleichstand gibt es mehrere maßgebende Beziehungen. Sie erkennen eine maßgebende Beziehung am Blitzsymbol in den Spalten *Vorgänger* und *Nachfolger* der Tabelle. Sie erkennen sie auch an der Spalte *Maßgebend* (das **+** rechts im Tabellenkopf, unter *Beziehungen*) und an der stärkeren Färbung, wenn Sie einen Pfad verfolgen. Wie Sie diesen Pfad öffnen, steht unter [Einen Pfad nachverfolgen](docs://howto-pad-traceren).

*Maßgebend* sagt etwas über Termine aus, nicht über die Dauer. Ein kurzer Vorgänger kann auch maßgebend sein, zum Beispiel wegen eines langen Zeitabstands. Das sehen Sie im Beispiel unten.

## Durchgerechnetes Beispiel

Die Beispiele verwenden getrennte Mini-Projekte. Alle beginnen am Montag, 7. Juni 2027, sofern nicht anders angegeben. Begriffe wie kritischer Pfad und Puffer werden in [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad) erklärt. Ein Netz aus Beziehungen selbst aufzubauen und zu prüfen, machen Sie in Tutorial 2, „Beziehungen und kritischer Pfad“.

### Vier Arten nebeneinander

*Pour foundation* braucht 5 Arbeitstage: Montag, 7. bis Freitag, 11. Juni. *Build walls* (5 Arbeitstage) folgt mit FS und läuft von Montag, 14. bis Freitag, 18. Juni. Vier Vorgänge mit je 3 Arbeitstagen hängen an *Build walls*, jeder mit einer anderen Art:

- *Place roof elements* (FS) beginnt am Montag, 21. Juni, dem ersten Arbeitstag nach dem Mauerwerk, und ist am Mittwoch, 23. Juni fertig.
- *Pipework* (SS) beginnt am Montag, 14. Juni, zusammen mit dem Mauerwerk, und ist am Mittwoch, 16. Juni fertig.
- *Pointing* (FF) muss am Freitag, 18. Juni zusammen mit dem Mauerwerk fertig sein. Bei 3 Arbeitstagen beginnt es deshalb am Mittwoch, 16. Juni.
- *Dewatering* (SF) muss am Montag, 14. Juni enden, dem Tag, an dem das Mauerwerk beginnt. Rückwärts gezählt über 3 Arbeitstage (Donnerstag, 10., Freitag, 11., Montag, 14. Juni) ergibt sich ein Start am Donnerstag, 10. Juni.

Nur *Place roof elements* liegt auf dem kritischen Pfad. Das Projekt ist am Mittwoch, 23. Juni fertig. *Pipework*, *Pointing* und *Dewatering* haben 5, 3 bzw. 7 Arbeitstage Puffer.

### Zeitabstand und Vorlauf in Zahlen

*Pour foundation* ist am Freitag, 18. Juni fertig. *Build walls* (2 Arbeitstage) folgt mit FS. So wirkt der Zeitabstand auf den Starttermin:

- Ohne Zeitabstand beginnt das Mauerwerk am Montag, 21. Juni.
- Mit Zeitabstand `3` (drei Arbeitstage) sind Montag, 21., Dienstag, 22. und Mittwoch, 23. Juni Wartezeit. Das Mauerwerk beginnt am Donnerstag, 24. Juni.
- Mit Zeitabstand `3ed` (drei Kalendertage) zählen Samstag, Sonntag und Montag. Das Mauerwerk beginnt am Dienstag, 22. Juni.
- Mit Zeitabstand `-1` (ein Vorlauf von einem Arbeitstag) beginnt das Mauerwerk am Freitag, 18. Juni, dem Tag, an dem der Guss fertig ist.
- Mit Zeitabstand `40%` beträgt der Zeitabstand 40 % von 5 Arbeitstagen, also 2 Arbeitstage. Das Mauerwerk beginnt am Mittwoch, 23. Juni.
- Mit Zeitabstand `50%` beträgt der Zeitabstand 2,5 Arbeitstage, gerundet 3 Arbeitstage. Das Mauerwerk beginnt am Donnerstag, 24. Juni.

### Welcher Kalender den Zeitabstand zählt

*Build walls* (4 Arbeitstage) liegt im Projektkalender (Montag bis Freitag) und ist am Donnerstag, 10. Juni fertig. *Pointing* (2 Arbeitstage) folgt mit FS und Zeitabstand `3`. Es liegt in einem Kalender, in dem Samstag und Sonntag ebenfalls Arbeitstage sind. Dann hängt der Starttermin vom *Abstandskalender* ab:

- *Vorgänger* (Standard): Der Zeitabstand zählt im Kalender des Mauerwerks. Freitag, 11., Montag, 14. und Dienstag, 15. Juni sind Wartezeit. *Pointing* beginnt am Mittwoch, 16. Juni.
- *Nachfolger*: Der Zeitabstand zählt im Kalender von *Pointing*. Freitag, 11., Samstag, 12. und Sonntag, 13. Juni sind Wartezeit. *Pointing* beginnt am Montag, 14. Juni.
- *24-Stunden*: Jeder Kalendertag zählt. Auch hier sind Freitag, Samstag und Sonntag Wartezeit. *Pointing* beginnt am Montag, 14. Juni.
- *Projektkalender*: Der Zeitabstand zählt im Projektkalender, genau wie bei *Vorgänger*. *Pointing* beginnt am Mittwoch, 16. Juni.

### Beziehungen auf einem Sammelvorgang

*Foundation* ist ein Sammelvorgang mit zwei Vorgängen: *Excavate* (2 Arbeitstage, Montag, 7. und Dienstag, 8. Juni) und danach *Pour* (3 Arbeitstage, Mittwoch, 9. bis Freitag, 11. Juni). *Build walls* folgt dem Sammelvorgang *Foundation* mit FS und beginnt am Montag, 14. Juni. Die App lässt es auf *Pour* warten, den Vorgang, der zuletzt endet.

Mit einem Sammelvorgang als Nachfolger: *Permit* (3 Arbeitstage, am Mittwoch, 9. Juni fertig) geht mit FS an den Sammelvorgang *Struktur*. Der Sammelvorgang enthält *Build walls* (4 Arbeitstage) und danach *Lay floor* (2 Arbeitstage). Jeder Vorgang im Sammelvorgang wartet auf *Permit*: *Build walls* beginnt am Donnerstag, 10. Juni und ist am Dienstag, 15. Juni fertig. *Lay floor* wartet außerdem auf das Mauerwerk und läuft von Mittwoch, 16. bis Donnerstag, 17. Juni.

Mit SS von einem Sammelvorgang: Der Sammelvorgang *Finishing* enthält *Plastering* (2 Arbeitstage, 7. und 8. Juni), danach *Painting* (3 Arbeitstage, 9. bis 11. Juni) und danach *Snagging* (2 Arbeitstage, 14. und 15. Juni). *Cleaning* folgt dem Sammelvorgang mit SS. Sie würden einen Start am Montag, 7. Juni erwarten. Die App lässt *Cleaning* aber auf den Anfang von *Snagging* warten, den Vorgang, der zuletzt beginnt. Das ist Montag, 14. Juni.

### Was maßgebend ist

*Pour foundation* (2 Arbeitstage) läuft von Montag, 7. bis Dienstag, 8. Juni. Zwei Zweige folgen:

- *Build walls* (5 Arbeitstage): Mittwoch, 9. bis Dienstag, 15. Juni.
- *Order roof elements* (2 Arbeitstage): Mittwoch, 9. und Donnerstag, 10. Juni.

*Place roof elements* (3 Arbeitstage) folgt beiden: mit FS nach dem Mauerwerk, und mit FS und Zeitabstand `5` nach der Bestellung (der Lieferzeit). Vom Mauerwerk aus könnte der Einbau am Mittwoch, 16. Juni beginnen. Von der Bestellung aus sind Freitag, 11., Montag, 14., Dienstag, 15., Mittwoch, 16. und Donnerstag, 17. Juni Wartezeit. Der Einbau beginnt am Freitag, 18. Juni. Die Beziehung zur Bestellung ist deshalb eine maßgebende Beziehung, obwohl die Bestellung viel kürzer ist als das Mauerwerk. Das Mauerwerk hat 2 Arbeitstage Puffer.

## Konsequenzen und Missverständnisse

**„Eine Beziehung legt die Vorgänge fest.“** Nein, eine Beziehung ist eine untere Grenze. Ein Nachfolger beginnt frühestens an dem Termin, den die Beziehung angibt. Er beginnt später, wenn eine andere Beziehung oder eine Einschränkung das verlangt. Wie Einschränkungen hineinpassen, erklärt [Einschränkungen und Stichtage](docs://uitleg-constraints).

**„SS bedeutet, dass die Vorgänge gleichzeitig beginnen.“** SS sagt nur, dass der Nachfolger nicht vor dem Vorgänger beginnen darf. Hat der Nachfolger einen anderen Vorgänger, der später endet, beginnt er später.

**„Bei FF beginnt der Nachfolger am selben Tag.“** Nein, bei FF fallen die Endtermine zusammen. Ein kurzer Nachfolger beginnt deshalb später als der Vorgänger, wie *Pointing* im Beispiel.

**„Ein Zeitabstand in Tagen zählt Kalendertage.“** Standardmäßig zählt ein Zeitabstand Arbeitstage, im Kalender des Vorgängers. Für Aushärten oder Trocknen, wenn auch das Wochenende zählt, verwenden Sie Kalendertage (`ed`).

**„Ein Vorgang ohne Beziehungen ist kein Problem.“** Ein Vorgang ohne Vorgänger beginnt an seinem geplanten Starttermin. Ein Vorgang ohne Nachfolger erhält Puffer bis zum Projektende. Vergessen Sie eine Beziehung, scheint ein Vorgang deshalb viel Raum zu haben. Siehe die Missverständnisse in [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad).

**„Eine Beziehung auf einem Sammelvorgang ist eine Beziehung.“** Für die Berechnung ist es eine Beziehung pro Vorgang im Sammelvorgang. Verschieben Sie Vorgänge in einen Sammelvorgang oder aus ihm heraus, ändern sich auch die Beziehungen, die für diese Vorgänge gelten.

## Siehe auch

- [Beziehungen hinzufügen](docs://howto-relaties-leggen): die Schritte, um Vorgänge miteinander zu verknüpfen und einen Zeitabstand festzulegen.
- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): was die App aus Ihren Beziehungen berechnet und warum ein Vorgang kritisch wird.
- [Einschränkungen und Stichtage](docs://uitleg-constraints): Terminvereinbarungen neben den Beziehungen.
- [Einen Pfad verfolgen](docs://howto-pad-traceren): die Kette vor oder nach einem Vorgang sichtbar machen.
- [Einen Hammock anlegen](docs://howto-hammock): ein Vorgang mit abgeleiteter Dauer, der an Beziehungen vom Typ SS und FF hängt.
- [Externe Beziehungen zu einem anderen Projekt](docs://howto-externe-relaties): Beziehungen zu einem Vorgang in einer anderen Projektdatei.
