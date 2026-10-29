# Ziehen, verschieben und zoomen im Gantt

Ziel: Bedienen Sie die Zeitleiste mit der Maus. Verschieben Sie einen Balken oder ändern Sie seine Dauer. Verschieben Sie die Zeitleiste, wählen Sie Vorgänge mit einem Rahmen aus und zoomen Sie hinein und heraus.

## Wann Sie dies brauchen

Sie sehen im Gantt, dass das Mauerwerk zwei Tage später beginnen muss. Oder das Betonieren dauert einen Tag länger. Dann möchten Sie das direkt am Balken tun. Oder Sie haben ein Projekt über Monate und möchten schnell zu den Bau-Feiertagen blättern. Die Maus hat dafür einige Gesten. Welche Geste was tut, hängt davon ab, wo Sie mit dem Ziehen beginnen, und von Ihrer Einstellung für das Scrollen.

## Schritte

### Einen Balken verschieben

1. Drücken Sie auf die Mitte eines Balkens und ziehen Sie waagerecht. Anfang und Ende bewegen sich zusammen, in ganzen Tagen. Die Dauer bleibt gleich.
2. Lassen Sie los. Der Balken bleibt an seiner neuen Stelle. Der Terminplan ist dann nicht mehr aktuell. Drücken Sie *Berechnen* (F5), oder lassen Sie die App das selbst tun, wenn *Automatisch berechnen* eingeschaltet ist.

Hat der Vorgang einen Vorgänger, speichert die App den neuen Anfang als Einschränkung *Anfang nicht früher als (SNET)*. Die App meldet das, nachdem Sie losgelassen haben. Warum das so ist und was bei einer anderen Einschränkung geschieht, steht unter [Einschränkungen und Stichtage](docs://uitleg-constraints). Ziehen Sie zurück zum ursprünglichen Anfang, dann kommt auch die ursprüngliche Einschränkung zurück.

Ziehen Sie hauptsächlich nach oben oder unten statt zur Seite, dann verschieben Sie den Vorgang in eine andere Zeile. Die Daten bleiben gleich. Die Richtung, die Sie in den ersten Pixeln wählen, gilt für das ganze Ziehen. Eine Geste ändert daher nie Daten und Struktur zugleich. Siehe [Struktur anpassen](docs://howto-structuur-aanpassen).

### Die Dauer anpassen

1. Bewegen Sie die Maus zur rechten Kante des Balkens. Der Mauszeiger wird zu einem Pfeil, der nach links und rechts zeigt.
2. Ziehen Sie an der Kante. Während des Ziehens zeigt ein kleines Etikett in der Akzentfarbe des Designs (standardmäßig Orange) die Dauer, die der Vorgang jetzt bekäme, zum Beispiel *4d*. Das Etikett folgt Ihrer Bewegung. So sehen Sie die neue Dauer, bevor Sie loslassen. An der rechten Kante liegt das Etikett innerhalb des Balkens, an der linken Kante direkt links davon. Das Etikett zeigt die Dauer so, wie die Spalte Dauer sie zeigt.
3. Lassen Sie los. Die Dauer ist die, die das Etikett angezeigt hat.

Die linke Kante verschiebt den Anfang und lässt das Ende stehen. Der Vorgang wird vorn kürzer oder länger. Für die Einschränkung gilt dieselbe Regel für SNET wie beim Verschieben. Ziehen Sie die Mitte des Balkens, dann erscheint das Etikett nicht. Die Dauer ändert sich nicht.

Die Dauer zählt Arbeitstage im Kalender des Vorgangs. Wochenenden und arbeitsfreie Tage zählen nicht. Ein Vorgang in Tagen kann nicht kürzer werden als ein Arbeitstag. Bei einem Vorgang in Stunden rundet die App auf den Schritt der Zeitleiste unter Ihrer Maus: mindestens eine Stunde, oder eine Viertelstunde, wenn Sie weit genug hineinzoomen und *Viertelstunden bei starker Vergrößerung anzeigen* eingeschaltet ist.

Ein Ziehen ist ein Schritt in *Rückgängig*, egal wie lang Sie ziehen. Bei einem geteilten Balken funktionieren die Kanten anders. Siehe [Vorgang teilen](docs://howto-taak-splitsen).

### Die Zeitleiste verschieben

Was ein Ziehen auf dem leeren Hintergrund bewirkt, hängt von Ihrem Scrollmodus ab. Sie wählen ihn unter *App-Einstellungen*, auf dem Tab *Darstellung*, unter *Gantt › Scrollen & Zoomen* bei *Modus*:

- **Zoom + Ziehen** (Standard): Ziehen Sie mit der linken Maustaste auf den leeren Hintergrund. Dann verschiebt sich die Zeitleiste mit der Maus, wie eine Karte. Der Mauszeiger wird zu einer Hand. Auf einem Balken startet ein Ziehen einfach eine Geste am Balken.
- **Position** und **Tasten**: Dieselbe Ziehbewegung macht einen Auswahlrahmen. Sie verschieben die Zeitleiste mit dem Mausrad (siehe [Einstellungen](docs://ref-instellingen)) oder mit der mittleren Maustaste.

**Die mittlere Maustaste** (das gedrückte Mausrad) verschiebt die Zeitleiste in jedem Modus, auch wenn Sie auf einem Balken beginnen. Sie funktioniert nicht, während eine andere Geste läuft, etwa das Ziehen eines Balkens.

### Vorgänge mit einem Rahmen auswählen

Ein Rahmen wählt alle Vorgänge in den Zeilen aus, die er berührt. Nur die Höhe des Rahmens zählt, nicht die Zeitskala.

1. Beginnen Sie auf dem leeren Hintergrund. Bei *Zoom + Ziehen* halten Sie dabei Strg gedrückt (⌘ auf einem Mac). Bei *Position* und *Tasten* ist das nicht nötig.
2. Ziehen Sie über die Zeilen, die Sie auswählen möchten. Die Auswahl erhält einen Rahmen.
3. Lassen Sie los. Mit Esc während des Ziehens brechen Sie den Rahmen ab. Die Auswahl bleibt dann wie sie war.

Mehr über Auswählen steht unter [Vorgänge auswählen, löschen und rückgängig machen](docs://howto-taken-selecteren-verwijderen). Auf dem leeren Raum in der Vorgangstabelle selbst bewirkt Ziehen nichts.

### Hinein- und herauszoomen

1. Verwenden Sie *Zoom +* und *Zoom -* (*Start › Zoom*), oder die Tasten + und -. Das Mausrad zoomt auch. Wann es zoomt, hängt von Ihrem Scrollmodus ab (siehe [Einstellungen](docs://ref-instellingen)).
2. Wenn Sie das ganze Projekt sehen möchten, wählen Sie *Ansicht › Zeitskala › An Projekt anpassen* oder drücken Sie Strg+0. *Zurücksetzen* (auf dem Tab *Ansicht*) oder die Taste 0 setzt den Zoom auf den Standard zurück.
3. Rechts unten in der Statusleiste steht der Zoom in Pixeln pro Tag, zum Beispiel *Zoom: 15px/Tag*.

Je weiter Sie herauszoomen, desto weniger Rasterlinien gibt es. Ab 8 Pixeln pro Tag gibt es für jeden Tag eine Linie, mit einer dickeren Linie an der Wochengrenze. Zwischen 2 und 8 Pixeln pro Tag bleibt nur die Wochengrenze. Unter 2 Pixeln pro Tag, auf Jahresebene, bleiben nur die Monatsgrenzen übrig. Sonst würde die Zeichenfläche zu einem gleichmäßigen Streifenmuster, in dem die Balken verschwinden. Die grauen Wochenenden und arbeitsfreien Tage sowie die abwechselnd getönten Wochenbänder bleiben auf jeder Stufe sichtbar. Sie tragen die Wochenstruktur, wenn die Linien wegfallen. In der Kopfzeile der Zeitskala erscheinen die Wochennummern und Tageszahlen nur, wenn dafür Platz ist. Ab 40 Pixeln pro Tag wird außerdem der Wochentag vor der Tageszahl angezeigt.

Der Vorgangsname steht im Balken, wenn er ganz hineinpasst. Passt er nicht, etwa beim Herauszoomen, steht der vollständige Name rechts neben dem Balken.

### Die Details eines Vorgangs ansehen

Halten Sie die Maus ruhig auf einem Balken. Es erscheint eine kleine Karte mit dem Namen des Vorgangs, *PSP*, *Dauer*, *Anfang*, *Ende*, *Status*, *Kritisch* und *Gesamtpuffer*. Während des Ziehens, beim Verschieben der Zeitleiste, bei einem Auswahlrahmen oder bei einem Rechtsklickmenü verschwindet die Karte.

## Probleme und was die App dann tut

**Der Anfang bewegt sich nicht.** Hat der Vorgang einen Vorgänger und eine andere Einschränkung als SNET, zum Beispiel *So spät wie möglich (ALAP)*, dann übernimmt die App den gezogenen Anfang nicht. Nachdem Sie losgelassen haben, meldet die App, welche Einschränkung den Anfang festhält. Ändern Sie diese Einschränkung, damit sich der Anfang bewegt. Die rechte Kante funktioniert dagegen, weil sie nur die Dauer ändert.

**Die Geste macht etwas anderes.** Im Beziehungsmodus und im Modus Vorgang teilen tun Gesten am Balken etwas anderes. Esc beendet diese Modi. Halten Sie Umschalt gedrückt, während Sie an einem Balken ziehen, dann legen Sie eine Beziehung an, statt einen Balken zu verschieben. Siehe [Beziehungen anlegen](docs://howto-relaties-leggen).

**Im Modus Position oder Tasten verschiebt die linke Maustaste die Zeitleiste nicht.** Dann sehen Sie einen normalen Mauszeiger statt einer Hand. Verwenden Sie das Mausrad oder die mittlere Maustaste, oder stellen Sie den Modus auf *Zoom + Ziehen* ein.

**Ein Klick in einer Pause eines geteilten Balkens** wählt den Vorgang aus. Er startet kein Ziehen und keinen Auswahlrahmen.

## Siehe auch

- [Rechtsklickmenüs](docs://ref-contextmenus): die Menüs an einem Balken, einer Zeile und einer Gruppenkopfzeile.
- [Tastenkombinationen](docs://ref-sneltoetsen): die Tasten zum Zoomen und zum Abbrechen einer Geste.
- [Einstellungen](docs://ref-instellingen): der Scrollmodus und die Zeitskala.
- [Einschränkungen und Stichtage](docs://uitleg-constraints): warum ein verschobener Anfang eine Einschränkung wird.
