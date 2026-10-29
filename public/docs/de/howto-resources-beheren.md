# Ressourcen verwalten

Ziel: Ressourcen (Personen, Maschinen und Material) in Ihrem Projekt erstellen, bearbeiten und löschen, damit Sie sie Vorgängen zuweisen können.

## Wann Sie das brauchen

Bevor Sie einen Maurer oder einen Kran einem Vorgang zuweisen, muss diese Person oder Maschine als Ressource angelegt sein. Die Ressource hält fest, wie viel davon vorhanden ist und an welchen Tagen sie arbeitet. Damit errechnet die App, ob Sie an einem Tag zu viel von ihr verlangen. Sie bearbeiten eine Ressource, wenn sich die Besetzung ändert, zum Beispiel wenn ein zweiter Maurer dazukommt.

Zwei Begriffe. **Max. Einheiten** ist die Kapazität pro Arbeitstag: 1 ist eine Person oder Maschine, 2 sind zwei davon. Eine **Zuweisung** ist eine Ressource auf einem Vorgang (siehe [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen)).

## Schritte

### Eine Ressource erstellen

1. Wählen Sie *Ressourcen › Verwalten › Neue Ressource*. Das Ressourcen-Panel nimmt den ganzen Arbeitsbereich ein, und unten in der Tabelle erscheint eine leere Zeile. Sie können das Panel auch mit *Ressourcen › Verwalten › Ressourcen* öffnen und dann *Neue Ressource im Projekt* wählen.
2. Geben Sie den Namen ein, zum Beispiel *Bricklayer*.
3. Wählen Sie den *Typ*: *Personal* (der Standard), *Gerät*, *Material*, *Subunternehmer* oder *Kolonne*.
4. Füllen Sie bei Bedarf die anderen Felder aus. Alles hat einen Standard: *Max. Einheiten* ist 1 und *Kalender* ist *Projektkalender*. *Tarif/Stunde* ist leer. Nur für den Typ *Material* können Sie *Einheit* ausfüllen, zum Beispiel m³.
5. Drücken Sie Enter oder klicken Sie außerhalb der Zeile. Die Ressource steht in der Tabelle. Mit Enter öffnet sich sofort eine leere Zeile darunter für die nächste. Drücken Sie Esc, wenn Sie fertig sind.

Die Zeile wird erst eine Ressource, wenn sie einen Namen hat. Mit Esc oder wenn Sie ohne Namen wegklicken, erstellt die App nichts. Die Reihenfolge der Eingaben spielt keine Rolle: Sie dürfen zuerst den Typ wählen und dann den Namen eingeben.

### Eine Ressource bearbeiten

Bearbeiten Sie die Felder in der Zeile. Die App speichert den Namen, den Tarif und die Einheit, wenn Sie das Feld verlassen. Die anderen Felder speichert sie sofort.

- *Max. Einheiten* akzeptiert die App nur, wenn der Wert größer als 0 ist. Bei 0 oder weniger bekommt das Feld einen roten Rand und springt auf den vorherigen Wert zurück.
- *Kalender* legt fest, an welchen Tagen die Ressource arbeitet. Wählen Sie *Projektkalender* oder einen eigenen Kalender. Mit *+ Ressourcenkalender* erstellen Sie einen neuen, und der Stift (*Bearbeiten…*) öffnet den gewählten Kalender. Arbeitet ein Vorgang an einem Tag, an dem die Ressource laut ihrem Kalender nicht arbeitet, dann zählt dieser Tag als überlastet. Wie Sie einen Ressourcenkalender erstellen, steht in [Einen Ressourcenkalender einrichten](docs://howto-resourcekalender-instellen).
- *Tarif/Stunde* und *Gesamt*: *Gesamt* ist die Stundenlast dieser Ressource mal dem Tarif. Ein Gipser, der mit 32 Stunden belastet ist und einen Tarif von 50 pro Stunde hat, kommt auf 1.600,00. Unten in der Tabelle steht die Summe aller Ressourcen.
- *Kolonne* gruppiert eine Ressource unter einer Ressource vom Typ *Kolonne*. Das ist nur eine Gruppierung: Die App addiert die Kapazität oder die Last der Mitglieder nicht zur Kolonne.
- Das farbige Feld links ist die Farbe der Ressource. Es dient nur der Anzeige und hat keine Wirkung auf den Terminplan.

### Kapazität, die sich mit der Zeit ändert

Kommt Ihr zweiter Maurer erst am 19. Juli? Klicken Sie auf den Pfeil neben *Max. Einheiten*. Wählen Sie unter *Zeitlich gestaffelte Kapazität* die Option *Schritt hinzufügen*. Jeder Schritt hat ein Datum (*Ab*) und eine Zahl (*Max. Einheiten*). Ab diesem Datum gilt diese Zahl. Ohne Schritte gilt immer der feste Wert.

Ein neuer Schritt beginnt mit dem heutigen Datum und 1 Einheit. Ändern Sie beides, sonst gilt ab heute eine Kapazität von 1.

### Eine Ressource löschen

1. Klicken Sie in der Zeile auf den Papierkorb.
2. Hat die Ressource Zuweisungen, fragt die App nach einer Bestätigung, zum Beispiel *„Bricklayer“ hat 4 Zuweisung(en) — löschen?* Klicken Sie auf den Haken, um zu löschen, oder auf das Kreuz, um abzubrechen. Ohne Zuweisungen verschwindet die Ressource sofort.

Die Zuweisungen der Ressource werden mit ihr gelöscht. Hat ein Vorgang eine andere Vorgangsart als *Feste Dauer und Einheiten*, verteilt die App die Arbeit der entfernten Ressource auf die verbleibenden Ressourcen. Je nach Vorgangsart ändert das deren Einheiten oder die Dauer des Vorgangs. Wenn sich die Dauer ändert, ist der Terminplan nicht mehr aktuell.

Sie können das Erstellen, Bearbeiten und Löschen mit *Rückgängig* (Strg+Z) rückgängig machen.

### Die kleine Übersicht in der Seitenspalte

*Ressourcen › Verwalten › Ressourcen-Dock* zeigt in der rechten Seitenspalte neben *Eigenschaften* eine kompakte Übersicht. Dort sehen Sie den Namen und die Farbe jeder Ressource. Neben einer überlasteten Ressource steht ein Warnzeichen (*Überlastet*). Dort können Sie nur *Max. Einheiten* ändern. Wenn Sie einen oder mehrere Vorgänge auswählen, zeigt die Übersicht nur die Ressourcen dieser Vorgänge.

## Fallstricke und was die App dann tut

**Nur der Typ *Material* macht bei der Berechnung einen Unterschied.** Personal, Gerät, Subunternehmer und Kolonne werden gleich behandelt. Material zählt nicht zur Dauer eines Vorgangs und wird nicht ausgeglichen. Auch im Histogramm zählt die Zeile *Alle Ressourcen* Material nicht mit.

**Kein Name, keine Ressource.** Eine leere Zeile verschwindet spurlos.

**Ein neuer Schritt in der Kapazität.** Wenn Sie vergessen, das Datum und die Zahl zu ändern, gilt ab heute eine Kapazität von 1.

**Eine Ressource entfernen, die Sie noch brauchen.** Wenn Sie sie versehentlich entfernen, drücken Sie sofort Strg+Z. Die Zuweisungen kommen ebenfalls zurück.

## Siehe auch

- [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen): eine Ressource einem Vorgang zuweisen.
- [Einen Ressourcenkalender einrichten](docs://howto-resourcekalender-instellen): die Arbeitstage einer Ressource festlegen.
- [Überlastung beheben](docs://howto-overbezetting-oplossen): was Sie tun, wenn eine Ressource an einem Tag zu viel zu tun hat.
- [Ressourcen-Panel](docs://ref-resourcepaneel): alle Felder und Schaltflächen des Ressourcen-Panels.
