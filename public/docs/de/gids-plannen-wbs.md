# Planung & WBS

Ein Terminplan beginnt mit einer Aufgabenstruktur: Welche Aufgaben gibt es, wie werden sie in Phasen gegliedert und welche Zeitpunkte sind wichtig genug, um einen Meilenstein zu verdienen? Diese Anleitung geht tiefer in dieses Fundament ein als die [Schnellstart](docs://quick-start)-Anleitung — hier lernen Sie nicht nur, *wie* man einrückt, sondern auch, was eine Sammelaufgabe tatsächlich bewirkt, wie sich die drei Meilensteinarten unterscheiden, wie Sie Aufgaben eigene Codes und Felder geben und wie Sie Notizen pro Aufgabe erfassen.

## Was Sie hier lernen

- Aufbau einer Aufgabenstruktur (WBS) mittels Einrücken und Sammelaufgaben.
- Verschieben von Aufgaben innerhalb derselben Ebene, ohne neu einzurücken — mit der Tastatur, per Ziehen oder in der tabellenartigen Registerkarte **Tabelle**.
- Die drei Meilensteinarten und der separate Verbindlich-Schalter für vertragliche Zeitpunkte.
- Verwalten von Aufgabencodes und benutzerdefinierten Feldern über das Fenster **Codes & Felder** und das Gruppieren danach.
- Verwenden von Notizen (einer Checkliste pro Aufgabe), um offene Punkte nachzuverfolgen.

Möchten Sie lieber anhand eines vollständigen Beispiels mitmachen? Öffnen Sie [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) über **Datei → Beispiele** — die Phasierung „1. Voorbereiding" (Vorbereitung) / „2. Fundering & ruwbouw" (Gründung & Rohbau) / „3. Afbouw" (Ausbau) / „4. Oplevering" (Übergabe) mit ihren Unteraufgaben ist genau die unten erklärte Struktur.

## Aufbau einer Aufgabenstruktur

Eine flache Aufgabenliste sagt nichts darüber aus, wie die Aufgaben zusammenhängen. Durch das Einrücken einer Aufgabe unter eine andere Aufgabe bauen Sie eine Baumstruktur (WBS — Work Breakdown Structure) auf: Die übergeordnete Aufgabe wird dann automatisch zu einer **Sammelaufgabe**.

1. Wählen Sie die Aufgabe, die Sie tiefer in der Struktur platzieren möchten.
2. Drücken Sie **Alt+→** zum Einrücken. Es gibt eine zweite Tastenkombination für dieselbe Aktion: **Alt+Shift+→** — praktisch, wenn Ihr Tastaturlayout Alt+→ bereits für etwas anderes verwendet. Beide tun exakt dasselbe.
3. Arbeiten Sie lieber mit der Maus? Klicken Sie mit der rechten Maustaste auf die Aufgabe und wählen Sie im Kontextmenü **Einrücken**.
4. Eine Ebene zu tief? **Alt+←** (oder Rechtsklick → **Ausrücken**) verschiebt die Aufgabe um eine Ebene zurück.
5. Für eine ganz neue Unteraufgabe gibt es einen schnelleren Weg: Klicken Sie mit der rechten Maustaste auf die übergeordnete Aufgabe und wählen Sie **Unteraufgabe hinzufügen**. Das erstellt in einem Schritt eine neue, bereits eingerückte Aufgabe, statt erst eine Aufgabe hinzuzufügen und sie danach separat einzurücken.

Sobald eine Aufgabe mindestens eine Unteraufgabe hat, wird sie automatisch zu einer Sammelaufgabe: Ihr Balken im Gantt-Diagramm umfasst dann den gesamten Zeitraum vom frühesten Anfang bis zum spätesten Ende aller darunterliegenden Unteraufgaben, und ihre eigene Dauer und ihre Termine können nicht mehr unabhängig festgelegt werden. Eine Sammelaufgabe ist daher immer ein abgeleiteter Wert, nie ein Terminplan, den Sie direkt eingeben — löschen oder verschieben Sie die Unteraufgaben, und der Balken der Sammelaufgabe passt sich automatisch an.

**Einklappen und Ausklappen.** Bei einer großen WBS möchten Sie den Baum manchmal vorübergehend kompakter machen. Die Menüband-Registerkarte **Ansicht**, Gruppe **Gliederung**, bietet dafür zwei getrennte Schaltflächen — **Einklappen** und **Ausklappen** — bewusst kein einzelner Umschalter, denn bei einer gemischten Auswahl (manche Zweige offen, andere geschlossen) könnte ein Umschalter nie alles einheitlich setzen.

- **Mit Auswahl** wirken die Schaltflächen auf die ausgewählten Aufgaben; nur Aufgaben mit Unteraufgaben sind betroffen, eigenständige Aufgaben werden ignoriert.
- **Ohne Auswahl** wirken sie auf den gesamten Terminplan. Heben Sie die Auswahl mit **Esc** auf, oder klicken Sie auf eine leere Stelle der Gantt-Ansicht.
- In einer gruppierten Ansicht (siehe *Gruppieren nach Codes und Feldern* weiter unten) klappen die Schaltflächen stattdessen die Gruppenbänder ein/aus — einschließlich verschachtelter Bänder — statt der Aufgaben.

Der Pfeil vor einer Sammelaufgabe funktioniert weiterhin wie gewohnt, um nur diesen einen Zweig zu öffnen oder zu schließen.

### Eine neue Aufgabe an der richtigen Stelle einfügen

Neue Aufgaben landen nicht mehr zwangsläufig unten. Alle Schaltflächen und Tasten, die eine Aufgabe anlegen, folgen derselben Regel:

- **Ist eine Aufgabe ausgewählt**, wird die neue Aufgabe direkt **darunter** eingefügt — nicht am Ende der gesamten Liste. Sie übernimmt Ebene und übergeordnete Aufgabe Ihrer Auswahl: Eine neue Aufgabe innerhalb einer Phase bleibt also in dieser Phase.
- **Ist nichts ausgewählt**, kommt sie wie bisher ans Ende.
- **Sind mehrere Aufgaben ausgewählt**, landet sie unter der **untersten** Aufgabe Ihrer Auswahl, so wie sie am Bildschirm steht — nie mitten in der Auswahl, und die Reihenfolge Ihrer Klicks spielt keine Rolle.

Das gilt für die Schaltfläche **Aufgabe** und das Menü **Meilenstein** in der Menübandgruppe **Aufgaben** sowie für **Neue Aufgabe** im Kontextmenü. Diese Gruppe steht sowohl auf der Registerkarte **Start** als auch auf **Tabelle**, mit denselben drei Schaltflächen (**Aufgabe**, **Meilenstein**, **Verknüpfung**) — Sie müssen zum Erfassen von Aufgaben also nicht mehr die Registerkarte wechseln.

Mit der Tastatur geht es noch schneller:

- **Einfg** fügt eine Aufgabe **über** der Auswahl ein.
- **Strg+I** (**Cmd+I** unter macOS) fügt eine Aufgabe **unter** der Auswahl ein — meist genau dort, wo Sie beim Durcharbeiten einer Liste hinwollen.

Beide stehen auch in der Tastenkürzel-Übersicht (**Strg+/**) unter der Kategorie **Struktur**.

**Nur in der normalen Baumansicht.** Das Einfügen darüber oder darunter ist ein Struktureingriff und nur sinnvoll, solange die angezeigte Reihenfolge auch die tatsächliche ist. Bei aktivem Filter, aktiver Sortierung oder Gruppierung würde die neue Aufgabe an anderer Stelle auftauchen als dort, wo Sie sie abgelegt haben. Die App verweigert dann das Einfügen darüber/darunter und zeigt einen Hinweisstreifen mit der Begründung sowie einer Schaltfläche, die Filter, Sortierung und Gruppierung mit einem Klick zurücksetzt. Die Schaltflächen **Aufgabe** und **Meilenstein** funktionieren weiterhin, setzen die Aufgabe dann aber ans Ende — mit derselben Erklärung.

### Aufgaben verschieben, ohne neu einzurücken

Neben der Änderung der Aufgabenebene (Einrücken/Ausrücken) können Sie auch die Position einer Aufgabe innerhalb derselben Ebene tauschen, ohne die Struktur selbst zu ändern:

- **Alt+↑** verschiebt die ausgewählte Aufgabe nach oben, über die Aufgabe, die aktuell darüber liegt.
- **Alt+↓** verschiebt die Aufgabe nach unten.

Das funktioniert auf jeder Ebene des Baums: Verschieben Sie eine Phasenaufgabe, wandern alle ihre Unteraufgaben automatisch mit.

Arbeiten Sie lieber mit der Maus? Fassen Sie eine Aufgabe an ihrer Zeile in der Aufgabentabelle (der linken Spalte der Gantt-Ansicht, mit demselben Zieh-Verhalten auf der Menüband-Registerkarte **Tabelle**) und ziehen Sie sie nach oben oder unten. Lassen Sie sie zwischen zwei Zeilen fallen, um sie unter ihren Geschwisteraufgaben neu zu ordnen, genau wie Alt+↑/↓. Lassen Sie sie stattdessen auf dem unteren Teil der Zeile einer Sammelaufgabe fallen, wird sie verschachtelt: Die Aufgabe wird die neue letzte Unteraufgabe dieser Sammelaufgabe und dabei in einer Bewegung neu eingerückt — das ist das Maus-Äquivalent zu Alt+→. Wählen Sie zuerst mehrere Aufgaben aus (Ctrl/Cmd-Klick oder ein Auswahl-Rechteck), und die gesamte Auswahl wird gemeinsam gezogen und abgelegt.

Die Menüband-Registerkarte **Tabelle** zeigt dieselbe Struktur als einfaches, editierbares Raster — nützlich, wenn Sie viele Aufgaben auf einmal erfassen oder korrigieren: Ein einzelner Klick auf eine editierbare Zelle startet die Bearbeitung sofort mit dem vorhandenen Wert ausgewählt, die Pfeiltasten bewegen einen Zellcursor, ohne ihn zu öffnen, **F2**/**Enter** öffnet die aktuelle Zelle zur Bearbeitung, und **Tab**/**Shift+Tab** wechselt zur nächsten/vorherigen Zelle und läuft in die nächste/vorherige Aufgabenzeile weiter. Ein-/Ausrücken bleibt **Alt+→**/**Alt+←**. Erreichen Sie mit **Enter** oder **↓** die allerletzte Zeile, entsteht dort eine neue Geschwisteraufgabe mit dem Cursor bereits in ihrer Namenszelle, sodass Sie eine ganze Liste durcharbeiten können, ohne die Maus anzufassen — das funktioniert nur in der normalen Baumansicht, da bei aktivem Filter, aktiver Sortierung oder Gruppierung die neue Aufgabe direkt aus dem Sichtfeld fallen könnte; die App fragt daher vorher nach, statt stillschweigend eine Aufgabe zu platzieren, die Sie nicht sehen können.

## Meilensteinarten

Ein Meilenstein ist eine Aufgabe ohne Dauer, die einen Zeitpunkt markiert — einen Anfang, eine Übergabe, eine Prüfung. Open Planner Studio bietet drei Möglichkeiten, einen Meilenstein hinzuzufügen, alle über die Menübandgruppe **Aufgaben** über den Pfeil neben der Schaltfläche **Meilenstein**:

- **Anfangsmeilenstein** — markiert den Beginn einer Phase oder des Projekts.
- **Endmeilenstein** — markiert einen Abschluss, zum Beispiel eine Übergabe.
- **Prüfpunkt (verbindlich)** — in der Praxis ein Endmeilenstein mit bereits aktiviertem Schalter **Verbindlich (vertraglich)** und direkt auf **Prüfung** gesetztem Typ, sodass ein Prüfzeitpunkt von Anfang an sowohl als vertraglich verbindlich als auch als Prüfung erkennbar ist.

Bevorzugen Sie die Tastenkombination **Ctrl+M**? Diese gibt Ihnen einen allgemeinen Meilenstein („Neuer Meilenstein"), den Sie danach selbst umbenennen und typisieren.

Sie sehen diese Aufschlüsselung auch im Eigenschaftenbereich, sobald Sie einen Meilenstein mit aktiviertem Kontrollkästchen **Meilenstein** auswählen: Das Feld **Meilensteinart** bietet **Automatisch**, **Anfangsmeilenstein** oder **Endmeilenstein**. „Automatisch" lässt die Terminplanungs-Engine anhand der Beziehungen entscheiden, wie sich der Meilenstein verhält — wählen Sie dies, wenn der Meilenstein keinen ausgeprägten Anfangs- oder Ende-Charakter hat. Darüber hinaus gibt es das Kontrollkästchen **Verbindlich (vertraglich)**: Es markiert einen Meilenstein als vertraglich bindend, unabhängig davon, ob es sich um einen Anfangs- oder Endmeilenstein handelt. So können Sie beispielsweise auch einen Anfangsmeilenstein verbindlich machen oder — wie beim **Prüfpunkt** — mit einem Klick einen verbindlichen Endmeilenstein einrichten.

## Codes & Felder: Aufgabencodes und benutzerdefinierte Felder

Größere Terminpläne brauchen schnell zusätzliche Dimensionen, die nicht in die WBS passen: welche Einheit, welche Disziplin, welcher Auftragnehmer. Dafür gibt es **Aufgabencodes** und **benutzerdefinierte Felder**, die beide über das Fenster **Codes & Felder** verwaltet werden (die Menübandgruppe **Struktur** auf der Registerkarte **Planung**, Schaltfläche beschriftet mit **Codes & Felder**).

- **Aufgabencodes** sind frei definierbare Dimensionen (zum Beispiel „Standort" oder „Disziplin") mit einer Werteliste — jeder Wert hat einen **Code**, eine **Beschreibung** und eine **Farbe**. Eine Aufgabe kann höchstens einen Wert pro Codetyp haben. Verwenden Sie **Codetyp hinzufügen**, um eine neue Dimension zu beginnen, und **Wert hinzufügen**, um die möglichen Werte aufzubauen.
- **Benutzerdefinierte Felder** sind eigene, typisierte Felder — **Text**, **Zahl**, **Ganze Zahl**, **Kosten**, **Datum** oder **Ja/Nein** —, die als Spalte in der Aufgabentabelle erscheinen und pro Aufgabe ausgefüllt werden können. Denken Sie an ein Feld „Auftragnehmer" (Text) oder „Genehmigung eingegangen" (Ja/Nein).

Sobald sie erstellt sind, weisen Sie einen Aufgabencode zu oder füllen ein benutzerdefiniertes Feld über die Spalten in der Aufgabentabelle aus (machen Sie sie bei Bedarf vorher über **Ansicht → Spalten…** sichtbar) oder über den Eigenschaftenbereich der Aufgabe.

### Gruppieren nach Codes und Feldern

Aufgabencodes und benutzerdefinierte Felder zahlen sich richtig aus, sobald Sie danach gruppieren: Gehen Sie zur Menüband-Registerkarte **Ansicht**, öffnen Sie **Gruppieren…** und wählen Sie den Aufgabencode oder das benutzerdefinierte Feld, nach dem gruppiert werden soll, unter **Feld**. Die Aufgabentabelle zeigt dann Gruppenkopfzeilen statt des WBS-Baums — praktisch, um beispielsweise alle Aufgaben pro Einheit oder pro Disziplin zusammen zu sehen, phasenübergreifend. Sie können bis zu zwei Gruppierungsebenen zugleich einrichten (zum Beispiel zuerst nach Einheit, dann nach Disziplin).

## Notizen: eine Checkliste pro Aufgabe

Jede Aufgabe hat einen Abschnitt **Notizen** im Eigenschaftenbereich — im Wesentlichen eine kleine Checkliste, die an der Aufgabe hängt. Er ist für die Art lockerer Aktionspunkte gedacht, die nicht in ein Terminsdatum passen: „noch beim Auftragnehmer nachfragen", „noch Material bestellen", „warten auf Zeichnung v2".

1. Klicken Sie auf **+ Notiz hinzufügen**. Eine neue, leere Zeile erscheint mit dem Fokus im Textfeld.
2. Tippen Sie den Text der Notiz.
3. Aktivieren Sie das Kontrollkästchen, sobald der Punkt erledigt ist — der Text wird dann durchgestrichen, aber die Notiz bleibt sichtbar (als erledigt markiert statt gelöscht), sodass die History einer Aufgabe lesbar bleibt.
4. Verwenden Sie das Papierkorb-Symbol, um eine Notiz endgültig zu entfernen.

Notizen sind rein informativ: Sie haben keinen Einfluss auf den Terminplan oder die Berechnung und sind daher das richtige Werkzeug für Anmerkungen, die sich nicht als Datum oder Dauer ausdrücken lassen. Sehen Sie eine Mischung aus offenen und abgeschlossenen Notizen in der Praxis im mittelgroßen Beispiel „Nieuwbouw 6 Rijwoningen De Akkers" (Tag *aantekeningen*/Notizen unter **Datei → Beispiele**).

## Weiterlesen

- Sehen Sie diese Struktur — Phasierung, Sammelaufgaben, Meilensteine — in der Praxis in [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Da die Struktur nun steht, besteht der nächste Schritt darin, Aufgaben miteinander zu verknüpfen: Lesen Sie die Anleitung [Beziehungen & Einschränkungen](docs://gids-relaties-constraints).
- Noch neu bei Open Planner Studio? Beginnen Sie mit der [Schnellstart](docs://quick-start)-Anleitung für eine durchgehende Übung vom leeren Projekt bis zum berechneten Terminplan.
