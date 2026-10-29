# Tabellenspalten anpassen

Ziel: Wählen Sie, welche Spalten Sie in der Vorgangstabelle sehen, in welcher Reihenfolge und wie breit sie sind.

## Wann Sie das brauchen

In der Besprechung möchten Sie neben jedem Vorgang den Stichtag und den Gesamtpuffer sehen. Der Bauleiter will nur den Anfang und das Ende neben dem Namen. Oder eine Spalte ist so schmal, dass ihre Kopfzeile abgeschnitten wird. Die Vorgangstabelle besteht aus Spalten, die Sie selbst wählen: Es gibt Dutzende, von *Vorgangsname* und *Dauer* bis *Stichtag*, *Freier Puffer* und *Zugewiesene Ressourcen*.

Es gibt zwei Vorgangstabellen, jede mit eigenen Spalten:

- Die **Vorgangstabelle neben dem Gantt** steht links von der Zeitleiste, unter anderem auf den Registerkarten *Start*, *Planung* und *Ansicht*. Standardmäßig hat sie *PSP*, *Vorgangsname* und *Dauer*, damit für die Zeitleiste Platz bleibt.
- Die **Tabelle auf der Registerkarte** *Tabelle* nimmt den ganzen Arbeitsbereich ein. Standardmäßig hat sie *PSP*, *Vorgangsname*, *Dauer*, *Anfang*, *Ende*, *Arbeitskategorie*, *Kritisch*, *Gesamtpuffer* und *Fortschritt*, dazu eine Spalte je Aktivitätscode und benutzerdefiniertes Feld des Projekts.

Eine Änderung an der einen Tabelle ändert die andere nicht.

## Schritte

### Eine Spalte hinzufügen

1. Klicken Sie rechts in der Kopfzeile der Tabelle auf das Pluszeichen (**+**). Auf der Registerkarte *Tabelle* können Sie auch *Tabelle › Spalten › Spalten…* verwenden. Das Fenster *Spalte auswählen* wird geöffnet.
2. Suchen Sie die Spalte. Ganz oben steht *Zuletzt verwendet*, wenn Sie früher Spalten gewählt haben. Geben Sie einen Teil des Namens bei *Suchen* ein, zum Beispiel *Stich* für *Stichtag*, oder öffnen Sie eine Kategorie: *Vorgang*, *Planung*, *Einschränkungen*, *Beziehungen*, *Ressourcen*, *Fortschritt*, *Berechnet*, *Baseline*, *Benutzerdefiniert* oder *Technisch*.
3. Klicken Sie auf die Spalte. Sie kommt ans Ende der Tabelle, und das Fenster wird geschlossen.

Eine Spalte, die schon in der Tabelle steht, ist grau. Sie können sie nicht wählen.

### Eine Spalte entfernen

Klicken Sie auf das Minuszeichen in der Spaltenkopfzeile (*Entfernen: Stichtag*). Oder klicken Sie mit der rechten Maustaste auf die Kopfzeile und wählen Sie *Entfernen: Stichtag*. Mit Strg+Z holen Sie die Spalte zurück, oder Sie wählen sie mit dem Pluszeichen erneut.

### Die Breite anpassen

Ziehen Sie den rechten Rand der Spaltenkopfzeile nach links oder nach rechts. Doppelklicken Sie auf diesen Rand, oder wählen Sie im Menü der Kopfzeile (rechte Maustaste) *Automatisch anpassen*. Die Spalte wird dann breit genug für ihren Inhalt, höchstens 480 Pixel. Hat der Rand den Fokus, machen die Pfeiltasten die Spalte Schritt für Schritt breiter oder schmaler.

### Spalten anheften

Klicken Sie mit der rechten Maustaste auf die Kopfzeile und wählen Sie *Anheften*. Angeheftete Spalten springen nach vorn und bleiben links, wenn Sie horizontal scrollen. Das funktioniert, solange sie zusammen nicht breiter sind als das Fenster. Mit *Lösen* setzen Sie sie wieder in die Reihe.

### Die Reihenfolge ändern

Ziehen Sie eine Spaltenkopfzeile an eine andere Stelle. Eine angeheftete Spalte verschieben Sie zwischen den angehefteten Spalten, eine normale Spalte zwischen den normalen Spalten.

### Zum Standard zurückkehren

Öffnen Sie das Fenster *Spalte auswählen* und klicken Sie unten auf *Auf Standard zurücksetzen*. Die Schaltfläche ist grau, wenn die Spalten schon dem Standard entsprechen. Für die Tabelle auf der Registerkarte *Tabelle* wird außerdem für jeden Aktivitätscode und jedes benutzerdefinierte Feld des Projekts eine Spalte hinzugefügt, auch wenn Sie diese früher entfernt hatten. Diese Spalten gehören zu dem Projekt, in dem der Code oder das Feld liegt. Mehr über diese Codes und Felder lesen Sie unter [Codes und benutzerdefinierte Felder](docs://howto-codes-en-velden).

## Stolperfallen und was die App tut

**Die Kopfzeile ist abgeschnitten.** Eine schmale Spalte schneidet ihren Namen ab, zum Beispiel *Gesamtpuffer* zu *Gesam…*. Doppelklicken Sie auf den Rand der Kopfzeile, damit die Spalte passt.

**Sie passen die falsche Tabelle an.** Die Spalten der Vorgangstabelle neben dem Gantt und die der Registerkarte *Tabelle* sind getrennt. Wenn Sie auf der Registerkarte *Ansicht* oder *Start* arbeiten, passen Sie die Vorgangstabelle neben dem Gantt an. Das Pluszeichen auf der Registerkarte *Tabelle* passt die große Tabelle an.

**Ein Layout setzt Spalten zurück.** Wenn bei einem Layout der Teil *Spalten* angehakt ist, setzt ein Klick auf die Layout-Schaltfläche die Spalten der Vorgangstabelle neben dem Gantt auf den gespeicherten Stand zurück. Die Tabelle auf der Registerkarte *Tabelle* bleibt unverändert. Lesen Sie [Layout erstellen und verwenden](docs://howto-layouts-gebruiken).

**Spalten liegen auf Ihrem Gerät, nicht im Projekt.** Die App behält Ihre Spaltenauswahl für alle Ihre Projekte auf diesem Gerät und speichert sie nicht in der Projektdatei. Das Projekt wird dadurch auch nicht als „geändert“ markiert. Sie können jede Spaltenänderung mit *Rückgängig* (Strg+Z) rückgängig machen. Die Schritte heißen zum Beispiel *Spalte Stichtag hinzufügen* und *Breite der Spalte Vorgangsname ändern*.

## Siehe auch

- [Layout erstellen und verwenden](docs://howto-layouts-gebruiken): Spalten zusammen mit einem Filter oder einer Sortierung auf einer Schaltfläche ablegen.
- [Codes und benutzerdefinierte Felder](docs://howto-codes-en-velden): eigene Spalten erstellen, die Sie hier wählen können.
- [Tabellenspalten](docs://ref-tabelkolommen): alle Spalten und was sie anzeigen.
