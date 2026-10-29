# Gut planen

Was macht einen Terminplan gut? Nicht, wie ordentlich er aussieht, sondern ob er die Frage beantwortet, die zählt, sobald die Bauarbeiten laufen: Wenn sich dies verschiebt, was passiert dann mit der Übergabe? Dieser Artikel erklärt die Grundsätze hinter einem verlässlichen Terminplan und warum sie in Open Planner Studio so viel Gewicht haben: Die App berechnet nur aus dem, was Sie eingeben, und aus nichts anderem.

Die Beispiele stammen aus dem Bauwesen: Rohbauarbeiten, Ausbaugewerke, Lieferzeiten, witterungsbedingte Verzögerung, Subunternehmer und ein vertraglich festgelegter Übergabetermin. Die Grundsätze selbst sind jedoch nicht an das Bauwesen gebunden.

## Das Konzept

Ein guter Terminplan ist kein Bild dessen, was Sie sich wünschen, sondern ein **Berechnungsmodell**: Vorgänge mit einer Dauer, verbunden durch Beziehungen, in einem Kalender. Die App berechnet die Termine aus diesem Modell. Wenn sich etwas ändert, wird das Modell neu berechnet, und Sie sehen sofort, was das für den Rest bedeutet.

Ein Planer arbeitet in einer festen Reihenfolge:

1. Das Ziel: Meilensteine und Übergabetermin.
2. Die Gliederung: Phasen, Arbeitspakete, Vorgänge.
3. Die Dauer jedes Vorgangs.
4. Die Beziehungen.
5. Einschränkungen und feste Termine.
6. Kalender.
7. Ressourcen.
8. Kritischer Pfad und Puffer.
9. Baseline und Fortschritt.
10. Überprüfung.

Diese Reihenfolge ist keine Höflichkeitsregel. Wenn Sie einen Schritt auslassen, kommt er später als Überraschung zurück: Vorgänge ohne Beziehungen bewegen sich nicht mit, Dauern ohne Kalender sind falsch, und eine Baseline, die Sie erst danach erfassen, friert die Verzögerung statt der Vereinbarung ein.

## Wie die App damit rechnet

Jeder der folgenden Grundsätze ist mit etwas verbunden, das die App tut. Deshalb folgt dieser Teil derselben Reihenfolge.

### Vom Ziel ausgehen, nicht von den Vorgängen

Legen Sie zuerst die Zeitpunkte fest, die feststehen, und erst danach die Arbeiten, die dazwischen passen müssen: Beginn der Baustellenvorbereitung, endgültige Genehmigung, wetterdicht, Beginn des Ausbaus, Übergabe. Das sind **Meilensteine**: Zeitpunkte ohne Dauer. Erfassen Sie sie als Meilenstein (*Start › Vorgänge › Meilenstein ▾*) und nicht als Vorgang von null Tagen mit einem Namen, der nach einem Meilenstein klingt.

Warum diese Reihenfolge: Ein Terminplan, der bei einer Liste von Vorgängen beginnt, wird zu einer Summe, und eine Summe trifft selten das Datum im Vertrag. Beginnen Sie bei den Meilensteinen, dann stellt sich sofort die richtige Frage: nicht „wie lange dauert alles zusammen“, sondern „passt die Arbeit zwischen diese beiden Zeitpunkte, und wenn nicht, was muss sich ändern“. Rechnen Sie vom geforderten Übergabedatum rückwärts bis zu dem Zeitpunkt, an dem das Gebäude spätestens wetterdicht sein muss, und von dort bis zum Anfang.

Ein vertraglich festgelegter Übergabetermin erhält das Kontrollkästchen *Verbindlich (vertraglich)*, damit jeder, der die Datei öffnet, sieht, dass dieser Zeitpunkt weder verhandelbar noch verschiebbar ist. Das Kontrollkästchen ist eine Markierung für die Gantt-Ansicht und die Berichte; es schützt kein Datum. Dafür setzen Sie einen Stichtag oder eine Einschränkung (siehe unten).

### Die Gliederung: Phasen, Arbeitspakete, Vorgänge

Unter den Meilensteinen bauen Sie die Struktur auf: Phasen, darunter Arbeitspakete, darunter Vorgänge. Sie tun das, indem Sie die Vorgänge tiefer stufen. Ein Vorgang mit Teilvorgängen wird automatisch ein **Sammelvorgang**: Die App leitet dessen Balken und Dauer aus den Vorgängen darunter ab. Geben Sie deshalb nie selbst eine Dauer für einen Sammelvorgang ein.

Die Faustregel für die Detailtiefe: **ein Vorgang dauert ungefähr einen Tag bis zwei Wochen**. Kürzer als ein Tag bedeutet, dass Sie die Baustelle planen statt das Projekt. Das gehört in den Wochenplan des Bauleiters und nicht in ein Berechnungsmodell, das monatelang halten muss. Länger als zwei Wochen bedeutet einen Vorgang, den Sie nicht zuverlässig schätzen und während der Ausführung nicht verfolgen können: „finishing ground floor, 40 days, 45% complete“ sagt niemandem, ob es gut läuft. Bei Terminprüfungen zählt man deshalb oft, wie viele Vorgänge länger als etwa zwei Monate dauern; liegt dieser Anteil über einigen Prozent, gilt das als Mangel an Detail.

Zu fein ist genauso schädlich wie zu grob. Jeder Vorgang kostet Pflege: Beziehungen zu ziehen, Fortschritt zu erfassen, nach jeder Änderung neu zu beurteilen. Ein Terminplan mit zweitausend Vorgängen für ein Projekt von sechs Monaten wird nicht genauer, er wird nicht mehr gepflegt – und ein Terminplan, den niemand aktualisiert, ist innerhalb von drei Wochen Fiktion. Wählen Sie die Ebene, auf der Sie jede Woche ehrlich über den Fortschritt berichten können.

In der Praxis: „3. Finishing“ ist eine Phase, „Finishing house 4“ ein Arbeitspaket, „Plastering house 4 ground floor“ ein Vorgang von fünf Tagen. Sie dürfen die Obergrenze bewusst überschreiten bei Lieferzeiten und Überwachung: Eine Lieferung von Fensterrahmen mit zehn Wochen Lieferzeit ist tatsächlich ein unteilbarer Block Wartezeit, und ständige Überwachung gehört in einen Hammock statt in eine Reihe künstlicher Abschnitte.

### Die Dauer schätzen

Eine Dauer ist eine Schätzung, wie lange die Arbeit dauert, nicht wie schnell sie gehen könnte. Schätzen Sie für einen normalen Tag mit dem Arbeitstrupp, den Sie tatsächlich bekommen, nicht für den besten Tag mit dem besten Trupp. Optimismus summiert sich entlang der Kette: Ein Terminplan, in dem jeder Vorgang vom besten Tag ausgeht, erreicht fast nie sein Übergabedatum.

Tage oder Stunden ist eine echte Wahl, keine Formatierung. Wählen Sie **Tage** für Arbeit, die das Tempo auf der Baustelle bestimmt – Mauern, Verputzen, Fliesenlegen: Es dauert fünf Tage, ob ein Tag zufällig acht oder neun Stunden hat. Wählen Sie **Stunden**, wenn die Stunden selbst die Einheit sind und der Rest des Tages eine Rolle spielt: eine dreistündige Inspektion, ein vierzehnstündiger Betonguss, verteilt über zwei Tage, Schichtarbeit. Die App speichert diese Wahl pro Vorgang. Die Wahl ist erst verfügbar, wenn Sie zuerst *Stundenplanung aktivieren* einschalten; siehe [Tage und Stunden](docs://uitleg-dagen-en-uren).

Verstecken Sie Risiko nicht in einzelnen Dauern. Einen Tag überall hinzuzufügen, begräbt die Reserve, sodass niemand sie mehr sehen oder steuern kann – und wo die Reserve wirklich gebraucht wurde, erweist sie sich als zu klein. Machen Sie die Reserve sichtbar: als ausdrücklichen Puffervorgang vor dem Übergabedatum oder als separate Witterungsreserve. Achten Sie auf Doppelzählung: Die rund 180 nutzbaren Arbeitstage pro Jahr, mit denen die niederländische Bauwirtschaft rechnet, sind eine vertragliche Jahreszahl (UAV), von der Feiertage, die Bauferien *und* verlorene Tage bereits abgezogen sind. Wenn die Feiertage und die Bauferien schon in Ihrem Projektkalender stehen, bleibt nur witterungsbedingte Verspätung als separater Posten. Frost- und Sturmausfälle folgen eigenen Regeln im Tarifvertrag Onwerkbaar weer Bouw & Infra. Tragen Sie diese erwarteten verlorenen Tage in den Kalender oder in einen separaten Posten ein, und verstecken Sie sie nicht in der Dauer der Mauerarbeiten.

### Beziehungen: ohne Netzwerk ist es kein Terminplan

Die App berechnet die Termine entlang der **Beziehungen**: Ein Vorgang beginnt erst, wenn seine Vorgänger das zulassen. Ein Vorgang ohne Beziehungen ist an nichts gebunden. Wenn die Rohbauarbeiten zwei Wochen verrutschen, folgt ein losgelöster Ausbauvorgang nicht, und der Terminplan zeigt Falsches an, ohne dass etwas rot wird.

Deshalb bekommt jeder Vorgang mindestens einen Vorgänger und mindestens einen Nachfolger. Nur der erste Vorgang des Projekts und der letzte Meilenstein sind ausgenommen. Bei einer Prüfung des Terminplans ist das die erste Kontrolle: Höchstens wenige Prozent der Vorgänge dürfen fehlende Logik haben.

Der Standard ist **Ende-Anfang**, und dabei sollte es bleiben: Fundament fertig, dann Rohbau. In einem gesunden Bauterminplan sind ungefähr neun von zehn Beziehungen Ende-Anfang. Das ist eine Frage der Lesbarkeit: Ende-Anfang ist der einzige Typ, den jeder auf der Baustelle ohne Erklärung versteht, und er verhält sich während der Ausführung vorhersehbar.

**Anfang-Anfang mit einem Zeitabstand** ist für Arbeiten, die parallel laufen statt zu warten. Der klassische Fall ist ein Reihenhausblock oder ein Turm mit mehreren Geschossen: Der Installateur folgt drei Tage hinter den Mauerarbeiten. Das ist ein Anfang-Anfang mit einem Zeitabstand von drei Tagen, kein Ende-Anfang auf einem künstlich zerstückelten Vorgang. Setzen Sie daneben eine Ende-Ende-Beziehung, sonst könnte der Nachfolger theoretisch früher fertig sein als der Vorgänger. Im Bau verwenden Sie Anfang-Ende fast nie.

Ziehen Sie diese Anfang-Anfang-Beziehung bevorzugt zwischen Vorgängen, nicht zwischen Phasen. Ist der Vorgänger einer Anfang-Anfang- oder Anfang-Ende-Beziehung eine Phase, wartet der Nachfolger auf den Vorgang in dieser Phase, der **zuletzt** beginnt, nicht auf den ersten. So plant die App nie zu früh, manchmal aber später als Sie beabsichtigt haben. Ende-Anfang und Ende-Ende mit einer Phase als Vorgänger warten auf das Ende des letzten Vorgangs darin, und das ist meist genau das, was Sie meinen.

Setzen Sie Zeitabstände sparsam ein, und negative besonders. Ein Zeitabstand ist Wartezeit ohne sichtbaren Grund: Niemand kann später erklären, warum da sieben Tage dazwischen liegen. Geht es um das Aushärten von Beton, machen Sie es zu einem Zeitabstand in Kalendertagen (Beton härtet auch am Wochenende aus), oder besser noch zu einem echten Vorgang „Aushärten“, den jeder sehen und verfolgen kann. Ein negativer Zeitabstand – ein Vorlauf, eine Überlappung – sollte eigentlich gar nicht vorkommen; bei einer Prüfung des Terminplans ist die Norm null. Wenn Sie eine Überlappung wollen, teilen Sie den Vorgänger auf oder verwenden Sie Anfang-Anfang.

### Einschränkungen und feste Termine: so wenige wie möglich

Jeder Vorgang beginnt „so früh wie möglich“, und in den meisten Fällen sollte das so bleiben. Eine **Einschränkung** ist eine Datumsgrenze neben den Beziehungen. Je mehr Sie hinzufügen, desto weniger berechnet Ihr Terminplan, und desto mehr wird er zu einer Zeichnung. Ein Plan voller fester Termine wirkt stabil und verbirgt gerade deshalb das Risiko: Er bewegt sich nicht mehr, also warnt er auch nicht mehr.

Verwenden Sie eine Einschränkung nur für einen harten externen Termin, auf den der Terminplan selbst keinen Einfluss hat: die Genehmigung, die vor dem 1. März nicht endgültig wird (*Anfang nicht früher als (SNET)*), das Sperrfenster, das die Gemeinde gewährt hat, der Anschlusstermin des Versorgers. „Dieser Vorgang soll im Mai liegen“ ist kein externer Fakt; das lösen Sie mit der Logik oder mit einer anderen Dauer. Als Faustregel gilt: Höchstens einige Prozent der verbleibenden Vorgänge tragen eine harte Datumsgrenze.

Geben Sie nie einen Anfangstermin ein, um einen Vorgang an seine Stelle zu bringen. Bei einem Vorgang mit Vorgänger macht die App aus einem eingegebenen (oder verschobenen) Anfang eine Einschränkung *Anfang nicht früher als (SNET)*. Der Vorgang steht dann dort, wo Sie ihn wollen, und bleibt dort, auch wenn sich die ganze Kette davor verzögert.

Wenn Sie einen Termin nur beobachten wollen, ohne die Berechnung zu steuern, verwenden Sie einen **Stichtag**. Er verschiebt nichts, gibt aber negativen Puffer und eine Warnung, sobald der Vorgang ihn nicht mehr einhält – genau das Signal, das Sie sehen wollen. Verwenden Sie für den Extremfall eine harte Fixierung (*Verbindlich (Pin-Logik)*), und wissen Sie dann, dass sie in der Kette davor negativen Puffer ergibt: Das ist der Terminplan, der sagt, dass es nicht passt, und nicht, dass etwas kaputt ist.

### Kalender: zuerst das Projekt, dann die Ausnahmen

Alle Dauern zählen in Arbeitstagen oder Arbeitszeiten eines Kalenders. Richten Sie deshalb den Projektkalender richtig ein, bevor Sie Dauern eingeben: Arbeitstage, Arbeitszeiten, Feiertage und die Bauferien. Ein Kalender, den Sie auf halber Strecke korrigieren, verschiebt Ihren ganzen Terminplan. Tragen Sie die absehbaren Sperrungen gleich ein: die Frostperiode, in der Sie keinen Beton gießen, die Betriebsferien zwischen Weihnachten und Neujahr.

Geben Sie einer Ressource nur einen eigenen Kalender, wenn er wirklich abweicht: der Fassadenbauer, der nur vier Tage pro Woche kommt, der Trupp, der einen anderen Sommerurlaub nimmt. Ein Ressourcenkalender ändert kein einziges Datum eines Vorgangs; dieser läuft weiter im Kalender des Vorgangs oder des Projekts. Er zeigt nur, dass die Ressource an einem Arbeitstag des Vorgangs nicht arbeitet, als Überlastung im Histogramm. Dieser Unterschied ist schwer zu durchschauen, wenn Sie nicht wissen, dass Sie ihn selbst angelegt haben.

### Ressourcen: wer macht es, und ist das möglich

Ein Terminplan ohne Ressourcen beantwortet nur die halbe Frage. Sobald Sie die Trupps und die Geräte zuweisen, zeigt das Histogramm, was eine Zeitleiste allein nicht zeigt: dass Sie am 14. Juni drei Verputztrupps brauchen, während Sie zwei haben.

Beginnen Sie mit den Ressourcen, die knapp sind. Nicht jede Schraube muss hinein; der Turmdrehkran, Ihre eigenen Trupps, die Subunternehmer mit einer Kapazitätsgrenze und die langen Lieferzeiten dagegen schon. Geben Sie jeder Ressource eine ehrliche Kapazität: zwei Verputzer bedeutet zwei, nicht „zwei, im Notfall drei“.

Lesen Sie das Histogramm als Frage, nicht als Fehler. Rot über der Linie bedeutet, dass der Terminplan an diesem Tag mehr verlangt, als Sie haben. Manchmal lautet die Antwort: verschieben. Oft lautet die Antwort: Das geht so nicht, und genau das wollten Sie wissen. **Kapazitätsabgleich** verschiebt Vorgänge, bis der Bedarf in die Kapazität passt. Hat das Projektende noch Spielraum, dann erlauben Sie das; ist das Übergabedatum fest, gleichen Sie nur innerhalb des Puffers ab (das Kontrollkästchen *Nur innerhalb des Puffers abgleichen (Glättung) — Projektende bleibt unverändert*). Das Projektende bleibt dann stehen, und Sie bleiben mit einem gemeldeten Restkonflikt, was ein ehrlicheres Ergebnis ist als ein Terminplan, der nur gelöst aussieht.

Gleichen Sie *nicht* ab, wenn der Bedarf strukturell größer ist als die Kapazität. Der Kapazitätsabgleich ordnet bestehende Arbeit zeitlich neu; er stellt keine zusätzlichen Verputzer ein und baut keinen zweiten Kran. Drei Türme, die gleichzeitig denselben Trupp brauchen, sind nach dem Abgleich immer noch drei Türme, die denselben Trupp brauchen; nur das Übergabedatum rückt weiter weg. Dann hilft Etappierung, zusätzliche Kapazität oder andere Arbeit. Gleichen Sie auch nicht ab, bevor Logik und Dauern stehen: Sie würden einen Terminplan abgleichen, der morgen schon anders aussieht.

### Kritischer Pfad und Puffer: wo der Terminplan verwundbar ist

Die App rechnet nicht bei jeder Änderung neu. Berechnen Sie mit **Berechnen** (F5), und lesen Sie erst danach. Wenn die Statusleiste *Veraltet — neu berechnen (F5)* anzeigt, sehen Sie die vorige Berechnung, nicht diese. Mit der Einstellung *Automatisch berechnen* erledigt die App das selbst.

Der **kritische Pfad** ist die Kette ohne Puffer: Jeder dort verlorene Tag ist ein Tag später bei der Übergabe. Dort gehören Ihre Überwachung und Ihre besten Leute hin. Schauen Sie nicht nur auf Rot. **Gesamtpuffer** sagt, wie weit ein Vorgang spät sein darf, ohne die Übergabe zu beeinflussen; **freier Puffer** sagt, wie weit er spät sein darf, ohne seinen Nachfolger zu verschieben. Der Unterschied betrifft niemandes Endtermin, steht aber jemandem im Weg – nützlich, wenn Sie mit Subunternehmern arbeiten, die Sie nicht zweimal umplanen können.

Achten Sie auf drei Signale. Ein Vorgang mit wenigen Tagen Puffer ist kein sicherer Vorgang, sondern ein fast kritischer Vorgang; mit *Beinahe-kritisch markieren* bekommen solche Vorgänge eine eigene Farbe. Einem Vorgang mit extrem viel Puffer – bei Terminprüfungen mehr als 44 Arbeitstage, etwa zwei Monate – fehlt fast immer ein Nachfolger; das zeigt Ihnen direkt die Lücken in Ihrem Netzwerk. Negativer Puffer ist nie ein Berechnungsfehler: Er zeigt, dass ein Stichtag oder ein fester Termin nicht passt.

### Vor dem Start eine Baseline, danach aktuell halten

Legen Sie eine **Baseline** an, sobald der Terminplan genehmigt ist und bevor der erste Spatenstich erfolgt (*Planung › Baselines & Fortschritt › Baselines verwalten…*). Berechnen Sie zuerst: Die Baseline speichert die Termine der letzten Berechnung. Ohne diese Referenz können Sie später nur sagen, *dass* sich Dinge anders entwickeln, nicht wie stark oder seit wann – und genau das brauchen Sie bei einer Baubesprechung, bei Mehrarbeit und wenn über Verspätung gesprochen wird.

Eine Baseline speichert die Termine, aber nicht die Annahmen dahinter, und genau danach wird gefragt, sobald Verspätung besprochen wird. Schreiben Sie deshalb beim Anlegen kurz auf, worauf dieser Terminplan beruht (in der Terminplanung: die *Grundlage des Terminplans*): welche Produktivitätswerte Sie verwendet haben, welcher Kalender und warum er so eingestellt ist, was Sie bewusst aus dem Terminplan gelassen haben, wer die Lieferzeiten angegeben hat, mit denen Sie gerechnet haben, und wer den Terminplan genehmigt hat. Eine halbe Seite genügt.

Danach ist das Aktuellhalten eine Routine, kein Projekt. Aktualisieren Sie wöchentlich in dieser Reihenfolge: Setzen Sie das **Statusdatum** auf das Berichtsdatum, tragen Sie den Ist-Anfang und das Ist-Ende für alles ein, was begonnen und abgeschlossen ist, korrigieren Sie die Restdauer dessen, was läuft, und berechnen Sie. Ein Prozentwert allein reicht nicht: Die Ist-Werte sind die sachliche Dokumentation, die man später ansehen wird.

Machen Sie sich klar, was das Statusdatum bewirkt: Arbeit, die noch nicht begonnen hat, verschiebt die App auf das Statusdatum, und die Vorgänge danach wandern mit (außer im Berechnungsprofil Microsoft Project). Wenn Sie also vergessen, einen fertigen Vorgang oder Meilenstein als erledigt zu melden, wandert er von selbst nach rechts. Das ist kein Fehler, sondern das Modell, das sich weigert, so zu tun, als könne in der Vergangenheit noch etwas geschehen. Erhalten Sie eine Warnung *Außerhalb der Reihenfolge*, dann wurde Arbeit in einer anderen Reihenfolge ausgeführt, als die Logik vorschreibt; das ist meist ein Grund, die Abfolge zu überarbeiten, und kein Grund, die Warnung wegzuklicken. Legen Sie nur für eine echte Umfangsänderung eine neue Baseline an, und dann neben der ersten, nicht darüber.

Schließlich: Ein Terminplan ist nur verlässlich, wenn die Leute, die die Arbeit machen, an ihn glauben. Lassen Sie den Bauleiter und die Subunternehmer den Wochenplan an diesem Modell prüfen. Wenn Sie Woche für Woche nur die Hälfte von dem schaffen, was vereinbart wurde, liegt das Problem häufiger im Terminplan als in der Ausführung.

## Praktisches Beispiel: drei Entscheidungen, die den Terminplan unbemerkt verfälschen

Die Zahlen stammen aus zwei Beispielen, die an anderer Stelle in der Hilfe durchgerechnet sind: dem Übungsprojekt *House extension* aus den Tutorials und einem kleinen Netz für einen Anbau. Hier geht es darum, was jede Entscheidung mit Ihrem Terminplan macht. Sie probieren es selbst aus in Tutorial 2 (Beziehungen und kritischer Pfad) und Tutorial 3 (eine Einschränkung und ein Stichtag).

### Eine vergessene Beziehung

Beim Anbau beginnen die Arbeiten am Montag, 7. Juni 2027, und die Übergabe ist am Freitag, 6. August. *Build outer cavity leaf* (6 Arbeitstage) hat *Install window frames* als Nachfolger, weil die Fensterrahmen in der Fassade sitzen. Mit dieser Beziehung hat die äußere Schale 2 Arbeitstage Puffer.

Wenn Sie diese Beziehung vergessen, hat die äußere Schale plötzlich 23 Arbeitstage Puffer bis zur Übergabe. Auf dem Papier kann sie sich wochenlang verzögern, ohne dass jemand wartet. Nichts wird rot und keine Warnung erscheint. Nur mit der Berechnungsoption *Offene Vorgänge kritisch* wird ein solcher Vorgang ohne Nachfolger kritisch, damit die Lücke auffällt.

### Ein eingetragenes Datum statt einer Beziehung

Das kleine Netz: *Groundwork* (3 Arbeitstage), *Pour foundation* (2), *Brickwork* (5) und *Roofing* (3), nacheinander, ab Montag, 7. Juni 2027. Das Projekt ist am Mittwoch, 23. Juni fertig.

Wenn Sie für *Brickwork* einen Anfang am Montag, 21. Juni eintragen, weil die Steine erst dann kommen, wird daraus eine Einschränkung vom Typ *Anfang nicht früher als (SNET)*. Brickwork verschiebt sich um eine Woche, und das Projekt ist am Mittwoch, 30. Juni fertig. *Groundwork* und *Pour foundation* bekommen 5 Arbeitstage Puffer und sind nicht mehr kritisch. Kommen die Steine doch früher, bleibt Brickwork am 21. Juni: Jetzt steuert das Datum, nicht die Logik.

Wenn Sie stattdessen Mittwoch, 9. Juni eintragen, bevor das Fundament fertig ist, passiert nichts: Die Beziehungen lassen Brickwork ohnehin erst am Montag, 14. Juni beginnen.

### Ein Stichtag statt einer Einschränkung

Wenn *Roofing* am Freitag, 18. Juni fertig sein soll, tragen Sie dort einen Stichtag ein. Nichts verschiebt sich: Roofing bleibt von Montag, 21. bis Mittwoch, 23. Juni. Aber die Kette bekommt −3 Arbeitstage Puffer, und die App meldet *Stichtag 18-06-2027 überschritten — frühestes Ende 23-06-2027*. Sie sehen also sofort, dass die Vereinbarung nicht passt, statt eines Balkens am richtigen Platz mit einer Kette dahinter, die das nicht schafft.

## Folgen und Missverständnisse

- **Vorgänge ohne Vorgänger oder Nachfolger.** Das ist der häufigste und zugleich schädlichste Fehler: Diese Vorgänge wandern nicht mit und bekommen falschen Puffer.
- **Termine eintippen oder Balken verschieben, statt die Logik über Beziehungen zu setzen.** Das setzt still eine Einschränkung.
- **Zu viele Einschränkungen und eine harte Fixierung, die als Lesezeichen missbraucht wird.** Dann berechnet der Terminplan nicht mehr, er zeichnet nur noch.
- **Dreimonatige Vorgänge oder halbtägige Vorgänge.** Zwischen ungefähr einem Tag und zwei Wochen liegt der brauchbare Bereich.
- **Optimistische Dauern und Reserve, die in jedem einzelnen Vorgang versteckt ist,** statt als sichtbarer Puffer.
- **Witterungsverzögerung und die Bauferien nicht im Kalender.** Im Januar tauchen sie ohnehin dort auf.
- **Zeitabstände statt Vorgänge.** Sieben Tage unbenannte Wartezeit sind drei Monate später unerklärlich.
- **Kapazitätsabgleich, bevor die Logik festgelegt ist,** oder Kapazitätsabgleich fortsetzen, obwohl ein struktureller Kapazitätsmangel besteht.
- **Vergessen zu berechnen.** *Nicht mehr aktuell* in der Statusleiste bedeutet, dass Sie die vorherige Berechnung sehen.
- **Keine Baseline oder eine Baseline, die erst nach dem Start erfasst wird.**
- **Fortschritt nur als Prozentwert erfasst,** ohne Ist-Werte und ohne Statusdatum.
- **Den Bereich *Warnungen* wegklicken, ohne ihn zu lesen.** Dort kommen die überschrittenen Stichtage, verletzten Einschränkungen, Beziehungen außer Reihenfolge und überlasteten Ressourcen zusammen (*Planung › Terminplan › Warnungen*).

## Siehe auch

- [Kritischer Pfad und Puffer](docs://uitleg-kritiek-pad): wie die App frühe und späte Termine sowie den Puffer berechnet.
- [Beziehungen und Zeitabstände](docs://uitleg-relaties): die vier Arten von Beziehungen, Zeitabstände und Beziehungen auf einer Phase.
- [Einschränkungen und Stichtage](docs://uitleg-constraints): was jede Einschränkung und ein Stichtag bei der Berechnung bewirken.
- [Kalender und Arbeitstage](docs://uitleg-kalenders): wie die App Arbeitstage zählt und welcher Kalender gilt.
- [Tage und Stunden](docs://uitleg-dagen-en-uren): Planung in Tagen, in Stunden oder gemischt.
- [Kapazitätsabgleich von Ressourcen](docs://uitleg-nivelleren): was der Kapazitätsabgleich verschiebt und was nicht.
- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): was das Statusdatum bewirkt und wie Sie die Abweichung lesen.
- [Vorgänge und Meilensteine hinzufügen](docs://howto-taken-en-mijlpalen-toevoegen): die Meilensteine und Vorgänge eingeben.
- [Beziehungen anlegen](docs://howto-relaties-leggen): Vorgänge miteinander verknüpfen.
- [Einen KI-Assistenten (MCP) anbinden](docs://howto-ai-assistent-koppelen): ein Assistent, der nach diesen Grundsätzen plant.
- [Meldungen und Warnungen](docs://ref-meldingen): alle Warnungen an einer Stelle.
