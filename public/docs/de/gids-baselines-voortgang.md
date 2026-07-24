# Baselines & Fortschritt

Ein Terminplan, den Sie nie aktualisieren, ist eine Prognose. Sobald die Arbeit beginnt, möchten Sie zwei Dinge zugleich sehen: was ursprünglich vereinbart war und was gerade tatsächlich passiert. Eine **Baseline** friert das Erste ein; **Fortschritt** und das **Statusdatum** verfolgen das Zweite. Diese Anleitung zeigt, wie Sie eine Baseline speichern und verwalten, wie Sie Abweichungen sichtbar machen, wie Sie Fortschritt erfassen und was genau das Statusdatum mit Ihrem Terminplan macht.

## Was Sie hier lernen

- Speichern und Verwalten einer Baseline und welche Baseline aktiv ist.
- Abweichungen sehen: das Baseline-Overlay im Gantt und der Variance-Bericht.
- Fortschritt erfassen — Prozent, Ist-Termine — über den Bereich, den Aufgabendialog und das Kontextmenü.
- Das Statusdatum: was es mit noch-nicht-begonnenen Aufgaben und nicht markierten Meilensteinen macht.
- Out-of-Sequence-Warnungen: was sie bedeuten und wie Sie sie beheben.
- Die Fortschrittslinie lesen.

Folgen Sie mit [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (eine Baseline vor dem Start, plus Fortschritt und ein Statusdatum zur Mitte des Projekts) und mit [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (zwei Baselines — eine Vertrags-Baseline und ein Rebaseline nach einer Änderungsverfügung — mit eigenem Fortschritt und Statusdatum).

## Eine Baseline speichern und verwalten

Öffnen Sie das Fenster **Baselines** über die Menübandgruppe **Baselines & Fortschritt** auf der Registerkarte **Planung**: **Baseline speichern…** speichert sofort eine neue Baseline mit einem vorgeschlagenen Namen („Baseline 1 — [Datum]"), **Baselines verwalten…** öffnet dasselbe Fenster zum Prüfen, Umbenennen oder Löschen.

Das Fenster zeigt eine Tabelle mit jeder gespeicherten Baseline: ein Optionsfeld **Aktiv**, der **Name** (direkt editierbar), das **Erstellt**-Datum und eine Löschen-Schaltfläche. Es kann stets genau eine Baseline aktiv sein — das ist die Baseline, gegen die das Gantt-Overlay und der Variance-Bericht vergleichen. Das Löschen der aktiven Baseline fordert eine Bestätigung (danach bleibt keine Baseline aktiv, bis Sie eine andere auswählen oder eine neue speichern). Ist der Terminplan seit der letzten Berechnung veraltet, zeigt das Fenster einen Hinweis neben „Neue Baseline speichern", zuerst neu zu berechnen — eine Baseline, die gegen einen veralteten Terminplan gespeichert wird, würde die falschen Termine einfrieren.

Eine Baseline ist eine Momentaufnahme: Anfang, Ende und (bei Meilensteinen) Datum jeder Aufgabe zum Zeitpunkt des Speicherns. Ändern Sie den Terminplan danach weiter, bleibt die Baseline unverändert, bis Sie selbst eine neue speichern.

## Abweichungen sehen

### Im Gantt: das Baseline-Overlay

Schalten Sie das Overlay über **Ansicht → Menübandgruppe Baselines & Fortschritt → Baseline-Overlay** ein. Unter jedem Aufgabenbalken erscheint ein dünner Unterbalken (oder eine Raute bei einem Meilenstein), in der Baseline-Farbe, an den ursprünglichen Baseline-Terminen. Läuft der Hauptbalken über seinen Unterbalken hinaus, sehen Sie auf einen Blick, wie weit eine Aufgabe gegenüber der Baseline abgerutscht ist — ohne einen separaten Bericht zu öffnen.

### Als Bericht: der Variance-Bericht

Gehen Sie zur Registerkarte **Bericht** und wählen Sie als **Berichtstyp** **Variance**. Der Bericht zeigt pro Aufgabe: **Baseline-Anfang**, **Baseline-Ende**, **Aktueller Anfang**, **Aktuelles Ende**, **Δ Anfang (AT)**, **Δ Ende (AT)** und einen **Status** (**Im Plan**, **Später**, **Früher**, **Neu** für seit der Baseline hinzugefügte Aufgaben oder **Entfallen** für seitdem entfernte). Oben summiert der Bericht die Anzahl der Aufgaben, wie viele später und wie viele früher liegen, und — falls sich das Projektendedatum verschoben hat — eine Zeile mit der Anzahl Arbeitstage Unterschied gegenüber der Baseline. Wenn es keine aktive Baseline gibt, sagt der Bericht das ausdrücklich, statt eine leere Tabelle zu zeigen.

## Fortschritt erfassen

Sie setzen Fortschritt an drei Stellen, alle mit derselben Wirkung:

1. **Eigenschaftenbereich** — der Abschnitt **Fortschritt** unter einer ausgewählten Aufgabe: ein Schieberegler für **Fortschritt (%)** und (für eine reguläre Aufgabe) die Felder **Ist-Anfang**/**Ist-Ende** oder (bei einem Meilenstein) ein einzelnes Feld **Ist-Datum**. Schieben Sie den Prozentsatz über 0 % ohne Ist-Anfangsdatum, wird er automatisch mit dem geplanten frühesten Anfang gefüllt; ziehen Sie ihn zurück unter 100 %, wird ein eventuell eingegebenes Ist-Ende wieder gelöscht.
2. **Aufgabendialog** — derselbe Abschnitt **Fortschritt**, im Fenster **Aufgabe bearbeiten**.
3. **Kontextmenü** — Rechtsklick auf eine Aufgabe, Untermenü **Fortschritt**, mit den festen Stufen **0 %**, **25 %**, **50 %**, **75 %** und **100 %**. Praktisch für eine schnelle Aktualisierung ohne Öffnen eines Bereichs; für einen Zwischenprozentsatz oder ein spezifisches Ist-Datum verwenden Sie den Bereich oder den Aufgabendialog.

Ist-Termine können nie nach dem Statusdatum liegen — versuchen Sie, einen späteren einzugeben, weist die App ihn mit einem Fehler zurück. Das ist eine bewusste Grenze: Eine „Tatsache" (etwas, das tatsächlich passiert ist) kann per Definition nicht in der Zukunft liegen relativ zum Zeitpunkt, an dem Sie Fortschritt erfassen.

## Das Statusdatum

Das **Statusdatum** (Menübandgruppe **Baselines & Fortschritt** auf der Registerkarte Planung, Feld **Statusdatum**) markiert das „Heute" innerhalb des Terminplans — den Zeitpunkt, für den Sie Fortschritt erfasst haben. Sobald es gesetzt ist, macht es zwei Dinge zugleich:

- Jede Aufgabe oder jeder Meilenstein, der noch nicht begonnen hat (0 % Fortschritt, kein Ist-Anfang), kann nicht früher als das Statusdatum beginnen, selbst wenn die Logik (Vorgänger, Beziehungen) ansonsten einen früheren Anfang zuließe. Sein berechneter frühester Anfang wird auf das Statusdatum „nach unten korrigiert".
- Aufgaben, die bereits begonnen haben oder beendet sind, behalten ihre Ist-Termine — diese werden nie vom Statusdatum überschrieben.

Genau das sehen Sie im mittelgroßen Showcase: Mit dem Statusdatum auf den 20. Mai 2027 haben mehrere noch-nicht-begonnene Aufgaben (zum Beispiel Mauer- und Installationsarbeiten an verschiedenen Häusern) ihren frühesten Anfang genau auf dieses Datum fixiert, obwohl sie in verschiedenen Häusern laufen und ohne die Statusdatum-Grenze an unterschiedlichen, früheren Daten begonnen hätten.

### Warum ein nicht markierter Meilenstein „nach rechts wandert"

In der Berechnung ist ein Meilenstein nichts weiter als eine Aufgabe mit der Dauer null, sodass dieselbe Regel gilt: Ist er noch nicht als erledigt markiert (keine 100 %, kein Ist-Datum), kann sein berechnetes Datum nicht vor das Statusdatum fallen. Schieben Sie das Statusdatum weiter, ohne den Meilenstein als erledigt zu markieren, wandert sein angezeigtes Datum im Gantt mit nach rechts, auch wenn sich an den zugrunde liegenden Aufgaben nichts geändert hat — der Terminplan sagt faktisch: „Dieser Zeitpunkt kann nicht in der Vergangenheit liegen, wenn Sie ihn noch nicht abgehakt haben." Sobald Sie den Meilenstein mit einem Ist-Datum als erledigt markieren, springt er auf dieses feste Datum zurück und hört auf zu wandern.

## Out-of-Sequence-Warnungen

Sobald es ein Statusdatum gibt, prüft die Berechnung auch, ob die erfassten Tatsachen (Ist-Anfangs-/Ist-Endtermine) der Logik der Beziehungen nicht widersprechen — zum Beispiel ein Nachfolger, der bereits begonnen hat, während sein Vorgänger laut Terminplan noch nicht hätte beendet sein dürfen. Solche Fälle heißen **Out-of-Sequence** und erscheinen als Warnung in der Statusleiste unten auf dem Bildschirm („N Beziehung(en) außerhalb der Reihenfolge"), mit einem Tooltip für die Anzahl. Es ist eine Warnung, kein blockierender Fehler — die Berechnung läuft ungeachtet dessen weiter.

Beheben Sie eine Out-of-Sequence-Warnung, indem Sie die tatsächliche Situation korrekt erfassen: Tragen Sie den fehlenden oder falschen Ist-Anfangs-/Ist-Endtermin bei den betroffenen Aufgaben nach (über den Bereich, den Aufgabendialog oder das Kontextmenü, wie oben), sodass die erfassten Tatsachen wieder mit dem zusammenpassen, was logisch vorhergegangen sein muss. Oft bedeutet das einfach: Eine Aufgabe, die in Wirklichkeit bereits beendet ist, war im Terminplan noch nicht als solche markiert.

## Die Fortschrittslinie

Schalten Sie die Fortschrittslinie über **Ansicht → Menübandgruppe Baselines & Fortschritt → Fortschrittslinie** ein. Sie zeichnet eine orange gestrichelte Linie (4/4-Strichmuster, derselbe Stil wie die Statusdatumlinie), die für jede Aufgabe einen Punkt an der Position einträgt, die ihrem Fortschritt entspricht, und diesen mit dem Statusdatum verbindet — das klassische Zickzack-Muster. Ein Knick nach links vom Statusdatum bedeutet, dass eine Aufgabe hinter dem zurückliegt, was Sie aufgrund der verstrichenen Zeit erwarten würden; ein Knick nach rechts bedeutet, sie ist voraus. Die Fortschrittslinie zeichnet die Statusdatum-Senkrechte selbst bereits als Rückgrat des Zickzacks, sodass der separate Schalter **Statusdatumlinie** (dieselbe Menübandgruppe) in den Hintergrund tritt, solange die Fortschrittslinie an ist — sie wird erst wieder sichtbar, wenn Sie die Fortschrittslinie ausschalten und das Statusdatum dennoch als einfache Senkrechte anzeigen möchten.

## Weiterlesen

- Sehen Sie eine Baseline vor dem Start und Fortschritt zur Mitte des Projekts in der Praxis: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Sehen Sie zwei Baselines (Vertrag → Rebaseline nach einer Änderungsverfügung) in der Praxis: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Ressourcen und ihre Auslastung werden bei jedem F5 ebenfalls neu berechnet — lesen Sie die Anleitung [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram) zu Überlastung und Abgleich.
- Fortschritt und ein Statusdatum können bei einer bereits fixierten Aufgabe negativen Puffer erzeugen — lesen Sie die Anleitung [Kritischer Pfad & weitergehende Analyse](docs://gids-kritiek-pad-analyse), wie Sie das lesen.
