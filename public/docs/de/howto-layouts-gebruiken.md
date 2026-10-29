# Ein Layout erstellen und verwenden

Ziel: Mit einem Klick zwischen Ansichten Ihres Terminplans wechseln, zum Beispiel nur die kritischen Vorgänge, die Vorgänge pro Arbeitskolonne oder eine andere Sortierreihenfolge.

## Wann Sie das brauchen

Bei der Baustellenbesprechung will der Auftraggeber nur die kritischen Vorgänge sehen. Danach will der Bauleiter pro Arbeitskolonne sehen, wer wann gebraucht wird. Danach wollen Sie wieder den ganzen Terminplan sehen. Filter, Gruppierungen und Sortierungen immer wieder neu einzustellen ist umständlich. Ein **Layout** speichert so eine Ansicht als Schaltfläche im Menüband.

Ein Layout kann sechs Dinge speichern: den Filter, die Gruppierung, die Sortierung, die Spalten der Vorgangstabelle neben dem Gantt-Diagramm, die Zeitskala sowie die Beziehungslinien und Überlagerungen (Baseline, Fortschrittslinie, Statusdatumslinie, Ressourcenakzent, Pufferbereich und Balkenfarben). Beim Klick auf die Schaltfläche ändert sich nur, was Sie angekreuzt haben. Der Rest Ihrer Ansicht bleibt, wie er ist.

Sie filtern, gruppieren und sortieren mit einem Layout. Die einzelnen Schaltflächen *Filter…*, *Gruppieren…* und *Sortieren…* gibt es nur noch hinter einer versteckten Einstellung (siehe Fallstricke).

## Schritte

### Ein vorhandenes Layout verwenden

1. Wählen Sie die Registerkarte *Ansicht*. In der Gruppe *Layout* gibt es eine Schaltfläche pro Layout. Standardmäßig ist das *Ressourcendiagramm*.
2. Klicken Sie darauf. *Ressourcendiagramm* gruppiert die Vorgänge pro Ressource, sortiert innerhalb jeder Gruppe nach Anfang und schaltet die Beziehungslinien aus. Ein Vorgang mit zwei Ressourcen erscheint unter beiden.
3. Klicken Sie noch einmal, um das Layout auszuschalten. Die Ansicht kehrt zurück zu dem Zustand vor Ihrem Klick.

Jeder Klick ist ein Schritt für *Rückgängig* (Strg+Z), sowohl beim Einschalten als auch beim Ausschalten.

### Ein eigenes Layout erstellen

1. Klicken Sie in der Gruppe *Layout* auf *Neues Layout*. Das Fenster *Neues Layout* öffnet sich.
2. Füllen Sie das Feld *Name* aus und wählen Sie unter *Symbol* ein Symbol.
3. Unter *Was speichert dieses Layout?* stehen die sechs Teile mit einem Kontrollkästchen. Ein neues Fenster beginnt mit allen Teilen angekreuzt und gefüllt mit dem, was jetzt auf Ihrem Bildschirm steht. Entfernen Sie bei allem das Häkchen, was das Layout nicht ändern darf. Wenn Sie nur einen Filter wollen, lassen Sie nur *Filter* angekreuzt. *Aktuelle Ansicht übernehmen* füllt alle Teile wieder mit Ihrem Bildschirm.
4. Richten Sie die Teile ein.
5. Klicken Sie auf *Speichern*.

Das Layout ist jetzt eine Schaltfläche im Menüband, aber es ist noch nicht angewendet. Klicken Sie auf die Schaltfläche, um es einzuschalten.

### Den Filter einrichten

Unter *Filter* erstellen Sie Regeln. Klicken Sie auf *+ Regel* und wählen Sie unter *Feld* ein Feld, unter *Operator* einen Operator und einen Wert. Wenn Sie nur die kritischen Vorgänge wollen: Feld *Kritisch*, Operator *gleich*, Wert *Ja*. Zu den Feldern gehören *Vorgangsname*, *Start*, *Ende*, *Gesamtpuffer*, *Fortschritt* und *Meilenstein*, außerdem Ihre eigenen Aktivitätscodes und Felder sowie *Ressourcen*. Die Operatoren hängen von der Art des Feldes ab: Bei Text können Sie *enthält* wählen, bei Zahlen und Daten *zwischen*.

Welche Operatoren Sie bekommen, hängt von der Art des Feldes ab:

- Text (*Vorgangsname*, *PSP*): *gleich*, *ungleich*, *enthält*, *beginnt mit* und *ist leer*.
- Zahl und Datum (*Gesamtpuffer*, *Start*, *Fortschritt*): *gleich*, *ungleich*, *kleiner als*, *kleiner oder gleich*, *größer als*, *größer oder gleich*, *zwischen* und *ist leer*. Bei *zwischen* gibt es zwei Felder: bei einer Zahl mit *Von* und *Bis* als Hinweis, bei einem Datum ohne Hinweis (das erste Datum ist der Anfang, das zweite das Ende).
- Ja/Nein (*Kritisch*, *Meilenstein*, *Fast kritisch*): *gleich* und *ungleich*, mit dem Wert *Ja* oder *Nein*.
- Auswahl (*Arbeitskategorie*, ein Aktivitätscode): *gleich*, *ungleich*, *ist eines von* (mit Kontrollkästchen-Werten) und *ist leer*.
- *Ressourcen*: *ist eines von* und *ist leer*.
- *In Bearbeitung*: nur *zwischen*, mit zwei Daten (von und bis).

Mit dem Feld *In Bearbeitung*, dem Operator *zwischen* und zwei Daten erhalten Sie alle Vorgänge, die in diesem Zeitraum zu irgendeinem Moment laufen, zum Beispiel alles, was im Juni aktiv ist.

Sie verbinden mehrere Regeln mit der Liste oben: *Alle folgenden (AND)* zeigt Vorgänge, die alle Regeln erfüllen, *Eine der folgenden (OR)* Vorgänge, die mindestens eine Regel erfüllen. Mit *+ Gruppe* fügen Sie eine Untergruppe mit eigenen Regeln hinzu.

Der Filter schaut auf die Vorgänge selbst. Die Phasen (Sammelvorgänge), unter die ein solcher Vorgang fällt, bleiben grau sichtbar, sodass Sie sehen, wohin der Vorgang gehört. Wenn Sie zusätzlich gruppieren, verschwinden diese grauen Phasen.

### Gruppieren und sortieren

Unter *Gruppieren* fügen Sie mit *+ Ebene* ein Feld hinzu. Es gibt höchstens zwei Gruppierungsebenen. Ohne Gruppierung sehen Sie den PSP-Baum. Unter *Sortieren* fügen Sie mit *+ Ebene* ein Feld hinzu und wählen *Aufsteigend* oder *Absteigend*. Bei zwei Ebenen entscheidet die zweite, wenn die Werte der ersten gleich sind.

### Etwas schnell ohne Schaltfläche ausprobieren

Klicken Sie im Fenster auf *Anwenden ohne Speichern*. Die angekreuzten Teile erscheinen auf dem Bildschirm, aber es wird keine Schaltfläche hinzugefügt. Das ist praktisch für einen Filter, den Sie nur einmal brauchen. Strg+Z macht es rückgängig.

### Ein Layout ändern, kopieren oder entfernen

Klicken Sie mit der rechten Maustaste auf die Schaltfläche des Layouts. Sie wählen *Bearbeiten…*, *Duplizieren* oder *Löschen*. *Löschen* fragt zuerst nach einer Bestätigung. Eine Kopie heißt *Layoutname (Kopie)*. Ein eingebautes Layout, zum Beispiel *Ressourcendiagramm*, können Sie nicht bearbeiten oder löschen. Sie duplizieren es, um Ihre eigene Version zu machen.

### Mehrere Layouts gleichzeitig

Layouts, die nicht dieselben Teile speichern, können gleichzeitig eingeschaltet sein. Wenn Sie ein Layout haben, das nur den Filter *Kritisch gleich Ja* speichert (nennen Sie es zum Beispiel *Nur kritisch*), und Sie es zusammen mit *Ressourcendiagramm* einschalten (Gruppierung, Sortierung, Beziehungslinien), erhalten Sie die kritischen Vorgänge pro Ressource. Speichern zwei Layouts denselben Teil, zum Beispiel beide einen Filter, dann übernimmt das zweite, und das erste schaltet sich aus. Schalten Sie dieses zweite Layout wieder aus, kehren Sie zu der Ansicht vor Ihrem ersten Klick zurück, nicht zum ersten Layout.

## Fallstricke und was die App tut

**Sie vergessen, Teile abzuwählen.** Ein Layout, das auch die Spalten, die Zeitskala und die Überlagerungen speichert, setzt diese bei jedem Klick auf den gespeicherten Stand zurück. Ihr Zoom springt dann weg, obwohl Sie nur einen Filter wollten. Prüfen Sie im Fenster, dass nur die gewünschten Teile angekreuzt sind.

**Eine unvollständige Regel zeigt nichts.** Wenn Sie bei einem Ja/Nein-Feld keinen Wert wählen (dort steht noch *—*) oder die Daten von *In Bearbeitung* leer lassen, passt kein Vorgang, und die Liste bleibt leer. Vervollständigen Sie die Regel.

**Eine manuelle Änderung schaltet das Layout aus.** Wenn Sie selbst einen Teil ändern, den das Layout speichert, zum Beispiel *Beziehungslinien*, während *Ressourcendiagramm* eingeschaltet ist, fällt dieses Layout heraus, und die anderen Teile kehren zu der Ansicht vor dem Layout zurück. Zoomen schaltet ein Layout aus, das die Zeitskala speichert. Wenn Sie eine Spalte breiter machen, schaltet das ein Layout aus, das die Spalten speichert. Der Rest der Ansicht bleibt dann, wie er ist. Das *Ressourcendiagramm* speichert die Zeitskala nicht, daher beeinflusst Zoomen es nicht.

**Spalten gelten für die Vorgangstabelle neben dem Gantt-Diagramm.** Der Teil *Spalten* speichert die Spalten der Tabelle links neben der Zeitleiste. Die Tabelle auf der Registerkarte *Tabelle* behält ihre eigenen Spalten. Wie Sie Spalten auswählen, steht in [Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen).

**Tiefer stufen und Ausrücken sind ausgeschaltet.** Solange ein Filter, eine Gruppierung oder eine Sortierung aktiv ist, entspricht die angezeigte Reihenfolge nicht der Reihenfolge des Terminplans. *Tiefer stufen* und *Ausrücken* sind dann deaktiviert, mit dem Tooltip *Nicht verfügbar während des Filterns/Gruppierens/Sortierens*. Schalten Sie das Layout aus, um die Struktur wieder anzupassen, wie in [Struktur anpassen](docs://howto-structuur-aanpassen) beschrieben.

**Die Statusleiste folgt nicht.** *Vorgänge:* in der Statusleiste zeigt die Anzahl der Vorgänge des ganzen Projekts, auch wenn ein Filter nur einen Teil davon zeigt.

**Layouts liegen auf Ihrem Gerät, nicht im Projekt.** Die App speichert Ihre Layouts und die Spalten für alle Ihre Projekte auf diesem Gerät. Die Überlagerungen eines Layouts (Baseline, Fortschrittslinie und die übrigen) gelten für alle Ihre Projekte. Der Filter, die Gruppierung und die Sortierung, die gerade aktiv sind, gehören zum geöffneten Projekt, gehen aber nicht in die Projektdatei: Nach dem Speichern und erneuten Öffnen ist die Ansicht wieder sauber. Außerdem markieren Filter, Gruppierung und Sortierung das Projekt nicht als „geändert“.

**Die einzelnen Schaltflächen sind ausgeblendet.** Die einzelnen Schaltflächen *Spalten…*, *Filter…*, *Gruppieren…* und *Sortieren…* auf der Registerkarte *Ansicht* gehören zur alten Ansicht. Sie holen sie mit *Klassische Ansichtsschaltflächen anzeigen* unter *Legacy-Funktionen* auf der Registerkarte *Erweitert* im Fenster *App-Einstellungen* (⚙ in der Titelleiste) zurück. Verwenden Sie lieber Layouts.

## Siehe auch

- [Tabellenspalten anpassen](docs://howto-tabelkolommen-aanpassen): die Spalten selbst auswählen, verschieben und fixieren.
- [Einen Bericht erstellen und drucken](docs://howto-rapport-maken-en-afdrukken): die Ansicht mit *Ansicht folgen* auf Papier bringen.
- [Struktur anpassen](docs://howto-structuur-aanpassen): warum Sie nicht tiefer stufen können, während Sie filtern.
