# Beziehungen & Einschränkungen

Aufgaben, die für sich allein stehen, verschieben sich nicht, wenn sich der Terminplan ändert. Beziehungen erfassen diese Abhängigkeit; Einschränkungen erfassen eine harte oder weiche Anforderung an ein Datum. Diese Anleitung geht tiefer in beides ein als [Schnellstart](docs://quick-start): Wann wählen Sie welchen Beziehungstyp, was genau bewirken Verzögerung/Vorlauf, was bedeutet ein harter Pin und wann sollten Sie ihn gezielt *nicht* verwenden, und wie verhält sich ein Stichtag zu einer Einschränkung?

## Was Sie hier lernen

- Die vier Beziehungstypen (FS/SS/FF/SF) und wann Sie welchen verwenden.
- Verzögerung und Vorlauf, einschließlich prozentualer Verzögerung und abgelaufener Zeit (Elapsed Time) (zum Beispiel für das Betonerhärtung).
- Beziehungen auf drei Arten hinzufügen: Ziehen, Auswahl und die Beziehungstabelle.
- Alle acht Einschränkungstypen, plus der harte Pin (P6 Mandatory) und die sekundäre Einschränkung.
- Der Unterschied zwischen einem Stichtag und einer Einschränkung.

Folgen Sie mit dem Einstiegsbeispiel [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (SNET-Baugenehmigung, SS-Überlappung, FF-Verknüpfung) und, für den Stichtag-Konflikt, mit [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Die vier Beziehungstypen

Jede Beziehung hat einen **Vorgänger** und einen **Nachfolger** sowie einen von vier Typen:

- **FS — Ende-Anfang**: Der Nachfolger startet erst, wenn der Vorgänger beendet ist. Die mit Abstand häufigste Beziehung im Bau: zuerst die Gründung, dann der Rohbau. Verwenden Sie FS, wenn eine Aufgabe physisch erst beginnen kann, wenn die andere erledigt ist.
- **SS — Anfang-Anfang**: Beide Aufgaben beginnen (ungefähr) gleichzeitig. Verwenden Sie dies, wenn zwei Aufgaben gemeinsam laufen können, sobald die erste in Gang kommt — zum Beispiel beginnen Wandarbeiten und Dachkonstruktion zu überlappen, sobald der Rohbau im Gange ist, ohne dass die eine auf das Ende der anderen wartet.
- **FF — Ende-Ende**: Beide Aufgaben enden (ungefähr) gleichzeitig. Nützlich, wenn zwei Aufgaben unabhängig laufen können, aber gemeinsam abgeschlossen werden müssen — zum Beispiel Malerarbeiten, die kurz nach den Fliesenarbeiten enden müssen, damit ein Raum in einem Stück übergeben werden kann.
- **SF — Anfang-Ende**: Der Vorgänger muss begonnen haben, bevor der Nachfolger enden darf. Der mit Abstand seltenste Typ in der Baupraxis — heben Sie ihn für Sonderfälle auf, in denen eine Abschlussaufgabe erst anhalten darf, wenn eine andere Aufgabe begonnen hat (zum Beispiel eine Schichtübergabe).

Möchten Sie diese ersten drei Typen in einem realen Beispiel erkennen? Das Beispiel „Verbouwing & Aanbouw Eengezinswoning" enthält eine FS-Kette zwischen den Hauptphasen, eine SS-Überlappung zwischen der Wand- und Dacharbeit und eine FF-Verknüpfung zwischen der Fliesen- und Malerarbeit.

## Verzögerung und Vorlauf

Eine Beziehung muss nicht null sein: Eine **Verzögerung** (positiv) fügt Wartezeit zwischen Vorgänger und Nachfolger hinzu, ein **Vorlauf** (negativ, als negative Zahl eingegeben) lässt den Nachfolger früher starten — eine bewusste Überlappung. Das Verzögerungsfeld (**Verzögerung**, im Eigenschaftenbereich und in der Beziehungstabelle) akzeptiert eine Kurzschreibweise:

- `2d` — 2 Arbeitstage Verzögerung (die Standard-Einheit: Tage auf dem Projektkalender).
- `3ed` — 3 **abgelaufene** (Elapsed) Tage: Kalendertage, die auch durch Wochenenden oder Feiertage laufen. Das ist die Einheit, die Sie zum Beispiel für die **Betonerhärtung** benötigen: Beton härtet auch am Samstag und Sonntag weiter, sodass eine Verzögerung von „3 Arbeitstagen" die Erhärtungszeit unterschätzen würde, wenn ein Wochenende dazwischenfällt. Stellen Sie die Verzögerung in diesem Fall auf die abgelaufene Einheit ein.
- `50%` — eine prozentuale Verzögerung: 50 % der Dauer des Vorgängers, bei jedem CPM-Lauf neu berechnet, wenn sich die Dauer des Vorgängers ändert (dieselbe Logik wie MS Project). Nützlich, wenn die Wartezeit sich natürlich mit der Größe der vorhergehenden Aufgabe skaliert.
- `-25e%` — eine negative, prozentuale abgelaufene Verzögerung: ein Vorlauf von 25 % der Dauer des Vorgängers, in abgelaufenen Tagen.

Eine negative Zahl (Vorlauf) bedeutet, dass der Nachfolger startet, während der Vorgänger noch läuft — zum Beispiel Fliesenarbeiten, die bereits während der letzten Tage des Verputzens im selben Raum beginnen.

## Beziehungen hinzufügen

Es gibt drei Möglichkeiten, eine Beziehung zu erstellen, je nachdem, wo Sie bereits arbeiten:

1. **Ziehen im Gantt-Diagramm**: Halten Sie **Shift** und ziehen Sie vom Balken des Vorgängers zum Balken des Nachfolgers. Sobald Sie loslassen, wird sofort eine FS-Beziehung mit Verzögerung 0 erstellt, und das Fenster **Beziehungstyp** erscheint sofort — dort können Sie den Typ (FS/SS/FF/SF) und die Verzögerung anpassen, ohne den Eigenschaftenbereich öffnen zu müssen.
2. **Auswahl + Schaltfläche**: Wählen Sie zuerst den Vorgänger, halten Sie Ctrl/Cmd und wählen Sie als Nächstes den Nachfolger (in dieser Reihenfolge), und klicken Sie auf **Neue Beziehung aus Auswahl** (die Menübandgruppe **Beziehungen** auf der Registerkarte **Planung** oder die Registerkarte **Beziehungen** selbst). Diese Schaltfläche funktioniert nur, wenn genau zwei Aufgaben ausgewählt sind.
3. **Direkt in der Beziehungstabelle**: Öffnen Sie die Registerkarte **Beziehungen** (über **Verwalten** in der Menübandgruppe Beziehungen). Die Tabelle zeigt pro Beziehung die Spalten **Vorgänger**, **Typ**, **Verzögerung**, **Nachfolger**, **Maßgebend** und **Freier Puffer** — Typ und Verzögerung können hier direkt bearbeitet werden, auch für Beziehungen, die Sie früher per Ziehen oder Auswahl erstellt haben.

Die Spalte **Maßgebend** zeigt nach einer Berechnung, welche Beziehung den Anfangs- oder Endtermin des Nachfolgers tatsächlich bestimmt — bei einer Aufgabe mit mehreren Vorgängern ist das nicht zwingend die Beziehung, die Sie zuletzt erstellt haben, sondern die mit dem spätesten (maßgebenden) Datum.

## Einschränkungstypen

Eine Einschränkung legt eine Datumsgrenze für eine Aufgabe fest, unabhängig von ihren Beziehungen. Open Planner Studio hat acht Typen, eingestellt über das Feld **Einschränkung** im Eigenschaftenbereich:

- **So früh wie möglich (ASAP)** — keine Datumsgrenze, die Voreinstellung.
- **So spät wie möglich (ALAP)** — die Aufgabe verschiebt sich so weit wie möglich innerhalb ihres Puffers.
- **Anfang nicht früher als (SNET)** — eine untere Grenze für das Anfangsdatum (zum Beispiel: nicht vor Erteilung der Baugenehmigung beginnen).
- **Anfang nicht später als (SNLT)** — eine obere Grenze für das Anfangsdatum.
- **Ende nicht früher als (FNET)** — eine untere Grenze für das Enddatum.
- **Ende nicht später als (FNLT)** — eine obere Grenze für das Enddatum.
- **Muss anfangen am (MSO)** — ein festes Anfangsdatum.
- **Muss enden am (MFO)** — ein festes Enddatum.

SNET/SNLT/FNET/FNLT sind alles **weiche Grenzen**: Die CPM-Berechnung berücksichtigt sie, aber eine Verletzung führt „nur" zu negativem Puffer, nicht zu einem Absturz oder einer Blockade. Das Beispiel „Verbouwing & Aanbouw Eengezinswoning" verwendet beispielsweise eine SNET-Einschränkung, um zu verhindern, dass eine Aufgabe vor Erteilung der Baugenehmigung beginnt.

### Der harte Pin (P6 Mandatory)

MSO und MFO können zusätzlich über das Kontrollkästchen **Verbindlich (Pin-Logik)**, das nur bei diesen beiden Typen erscheint, **hart** gemacht werden. Dies ist die „P6 Mandatory"-Einschränkung aus Primavera P6: Der Balken ist auf das Datum fixiert, selbst wenn seine Vorgänger dem logisch widersprechen. Wenn Sie einen harten Pin aktivieren, zeigt Open Planner Studio eine einmalige Warnung: **Ein harter Pin überschreibt die Beziehungen — der Balken wird fest auf das Datum gesetzt, sogar vor seinen Vorgängern. Eine Verletzung wird stromaufwärts zu negativem Puffer.**

Verwenden Sie einen harten Pin also nur, wenn ein Datum tatsächlich nicht verhandelbar ist und abseits der Logik des Terminplans steht — zum Beispiel ein gesetzlich festes Übergabedatum, das unabhängig vom Fortschritt gilt. Verwenden Sie ihn **nicht** als Faustregel für „Ich möchte, dass diese Aufgabe auf diesem Datum liegt": In diesem Fall ist eine weiche Einschränkung (SNET/FNLT/usw.) oder einfach eine gut geplante Kette von Beziehungen fast immer die bessere Wahl. Ein harter Pin kann das gesamte Netzwerk stromaufwärts zusammendrücken: Wenn die vorausgehenden Aufgaben über den Pin laufen wollen, entsteht negativer Puffer und breitet sich durch die gesamte Kette vor der fixierten Aufgabe aus — ein Zeichen dafür, dass der Terminplan im Konflikt steht, nicht dass der Pin das Problem gelöst hat.

### Sekundäre Einschränkung

Bei einer nicht-harten Einschränkung (also nicht ASAP/ALAP und kein hartes MSO/MFO) können Sie eine **sekundäre Einschränkung** hinzufügen: eine zweite Grenze aus denselben vier weichen Typen (SNET/FNET/SNLT/FNLT), die nicht dieselbe Seite begrenzen darf wie die primäre. So können Sie beispielsweise gleichzeitig eine untere und eine obere Grenze für das Anfangsdatum festlegen. Open Planner Studio validiert die Kombination live und zeigt einen Fehler an, sobald die Kombination ungültig ist — zum Beispiel eine sekundäre Einschränkung neben einem harten Pin, was nicht erlaubt ist.

## Stichtage versus Einschränkungen

Ein **Stichtag** (ein separates Feld, Eigenschaftenbereich) sieht wie eine Einschränkung aus, ist aber bewusst anders: Er ist eine weiche, informative obere Grenze für das Enddatum, im Gantt-Diagramm als Markierung mit einem nach unten zeigenden Pfeil dargestellt — grün, solange die Aufgabe noch im Zeitplan liegt, rot, sobald ihr frühestes Ende darüber hinausgeht. Ein Stichtag erzwingt den Terminplan nicht (anders als eine MFO/FNLT-Einschränkung, die aktiv an der Berechnung teilnimmt), wird aber als obere Grenze bei der Pufferberechnung berücksichtigt: Wenn der Terminplan den Stichtag von Natur aus nicht einhält, entsteht **negativer Puffer**, ohne dass eine Einschränkung involviert ist.

Genau das geschieht im Beispiel [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): Es enthält einen bewusst knappen vertraglichen Stichtag, den die natürliche Dauer des Terminplans nicht einhält, was zu sichtbarem negativem Puffer führt — ein gutes Beispiel, wenn Sie sehen möchten, wie ein Stichtag-Konflikt in der Praxis aussieht, ohne dass etwas „kaputt" ist: Der Terminplan rechnet einfach durch und zeigt, wo er unter Spannung steht.

Faustregel: Verwenden Sie einen **Stichtag** für ein Zieldatum, das Sie überwachen möchten, ohne die Logik des Terminplans zu erzwingen, und verwenden Sie eine **Einschränkung** (weich oder, ausnahmsweise, hart), wenn ein Datum tatsächlich eine Grenze ist, die die Berechnung berücksichtigen muss.

## Weiterlesen

- Sehen Sie SNET, die SS-Überlappung und die FF-Verknüpfung in der Praxis: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Sehen Sie den Stichtag-Konflikt in der Praxis: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Struktur noch nicht vorhanden? Lesen Sie zuerst [Planung & WBS](docs://gids-plannen-wbs).
- Für Kalender und Arbeitszeiten, die die Aufgabendauer beeinflussen: die Anleitung [Kalender & Stundenplanung](docs://gids-kalenders-uren).
