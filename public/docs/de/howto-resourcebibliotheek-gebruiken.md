# Die Ressourcenbibliothek verwenden

Ziel: Ressourcen aus der Ressourcenbibliothek in Ihrem Projekt verwenden und eine Ressource, die Sie in einem Projekt angelegt haben, in die Bibliothek aufnehmen. So verwendet jedes Projekt dieselben Daten.

## Wann Sie das brauchen

Sie haben eine feste Maurerkolonne, einen Kran und einen Gipser, die in mehreren Projekten vorkommen. Ohne Bibliothek geben Sie sie in jedem Projekt neu ein. Dabei besteht das Risiko abweichender Namen und Tarife. Außerdem sieht kein Projekt, dass ein anderes Projekt dieselbe Kolonne ebenfalls anfordert. In der Bibliothek erfassen Sie sie einmal.

Was die Bibliothek ist und was ein Projekt daraus übernimmt, lesen Sie in [Die Ressourcenbibliothek](docs://uitleg-resourcebibliotheek). Dieser Artikel beschreibt die Handlungen. Anlegen, Exportieren und Löschen von Bibliotheken steht in [Ressourcenbibliotheken verwalten und teilen](docs://howto-bibliotheken-beheren).

## Schritte

### 1. Das Projekt mit einer Bibliothek verknüpfen

Mit der Bibliothek arbeiten Sie nur, wenn das Projekt damit verknüpft ist. Ohne Verknüpfung zeigt das Panel *Ressourcen* den Schalter *Bibliothek*, *Projekt* und *Belegung* nicht.

Bei einem neuen Projekt:

1. Wählen Sie *Datei › Neu*. Das Fenster *Neues Projekt* öffnet sich.
2. Sehen Sie sich das Feld *Ressourcenbibliothek* an. Das Feld steht auf der Standardbibliothek. Sie können eine andere wählen, *keine (eigenständiges Projekt)* oder *+ Neue Ressourcenbibliothek…*.
3. Klicken Sie auf *Erstellen*.

Bei einem bestehenden Projekt:

1. Wählen Sie *Datei › Projekteinstellungen*.
2. Wählen Sie unter *Ressourcenbibliothek* die Bibliothek.
3. Klicken Sie auf *Anwenden*. Bis dahin steht unten *Änderungen nicht angewendet — klicken Sie auf Anwenden, um sie zu behalten*.

Hat das Projekt schon Ressourcen mit demselben Namen wie ein Bibliothekselement, öffnet sich das Fenster *Ressourcenbibliothek verknüpfen* mit dem Abschnitt *Erkennen*. Jede Ressource mit einem Treffer zeigt *Vorschlag: Bricklayer*. Klicken Sie auf *Verknüpfen*, um diesen Vorschlag zu verknüpfen, oder auf *Alle Vorschläge verknüpfen*, wenn es mehr als einen Vorschlag gibt. Die App vergleicht Namen ohne Rücksicht auf Groß- und Kleinschreibung oder doppelte Leerzeichen. Beim Verknüpfen übernimmt die Ressource Name, Typ, Tarif, Einheit und Beschreibung vom Bibliothekselement. *Max. Einheiten* bleibt so, wie Sie es im Projekt hatten. Das Fenster zeigt außerdem Kalender des Projekts, die denselben Namen haben wie ein Bibliothekskalender. Mit *Später entscheiden* schließen Sie das Fenster, ohne zu verknüpfen.

### 2. Eine Ressource in die Bibliothek aufnehmen

1. Wählen Sie *Ressourcen › Verwalten › Ressourcen*. Das Ressourcen-Panel füllt den ganzen Arbeitsbereich aus. Es öffnet sich immer auf *Projekt*, auch bei einem verknüpften Projekt.
2. Wählen Sie oben rechts *Bibliothek*. Über der Tabelle steht *Dies bearbeitet die Bibliothek und gilt für alle Projekte — außerhalb von Rückgängig*.
3. Klicken Sie auf *Neue Ressource in der Bibliothek*. Unten in der Tabelle erscheint eine leere Zeile.
4. Geben Sie den Namen ein, zum Beispiel *Bricklayer*, und drücken Sie Enter. Die Ressource ist jetzt in der Bibliothek. Sofort öffnet sich eine leere Zeile für die nächste. Drücken Sie Esc, wenn Sie fertig sind. Ohne Namen legt die App nichts an.
5. Füllen Sie den Rest der Zeile aus. *Typ* ist standardmäßig *Personal*. Unter *Max. Einheiten* geben Sie ein, wie viele von dieser Ressource es insgesamt gibt, zum Beispiel 3 für drei Bricklayer. Die Belegungsübersicht verwendet diese Zahl als Kapazität. *Tarif/Stunde* ist optional. Sie können *Einheit* nur für den Typ *Material* ausfüllen. Unter *Kalender* wählen Sie einen Kalender aus der Bibliothek oder *+ Ressourcenkalender*, um einen anzulegen. Siehe [Einrichten eines Ressourcenkalenders](docs://howto-resourcekalender-instellen). Die App speichert Name, Tarif und Einheit, wenn Sie das Feld verlassen. Die übrigen Felder speichert sie sofort.

Jede Änderung in der Bibliothek wirkt sich sofort auf die nicht bearbeiteten Kopien in Ihren geöffneten Projekten aus.

### 3. Eine Ressource dem Projekt zuweisen

1. Klicken Sie in der Ansicht *Bibliothek* bei der Ressource auf *Dem Projekt zuweisen*. Über der Tabelle steht *Hinzugefügt*. Wenn Sie noch einmal klicken, steht dort *Bereits im Projekt vorhanden*. Es erscheint keine zweite Kopie.
2. Wählen Sie *Projekt*. Die Kopie steht in der Tabelle. Neben dem Namen steht ein kleines Bibliothekssymbol. Es heißt *Aus der Bibliothek*. Name, Typ, Tarif und Einheit sind nur Text ohne Eingabefeld. Wenn Sie mit der Maus darüber fahren, sehen Sie *Bibliothekswert — bearbeiten Sie ihn in der Bibliotheksansicht, oder lösen Sie diese Ressource von der Bibliothek*.
3. Legen Sie *Max. Einheiten* für dieses Projekt fest. Das Feld beginnt mit dem Wert aus der Bibliothek und bleibt im Projekt bearbeitbar.
4. Weisen Sie die Ressource jetzt wie jede andere Ressource Vorgängen zu, siehe [Ressourcen mit einer Kurve zuweisen](docs://howto-resource-toewijzen). *Ressourcen › Zuweisung › Zuweisen* zeigt nur Ressourcen, die schon im Projekt sind. Weisen Sie eine Bibliotheksressource deshalb zuerst auf diese Weise dem Projekt zu.

*Dem Projekt zuweisen* gibt es nur in der Ansicht *Bibliothek* eines Projekts, das mit dieser Bibliothek verknüpft ist.

### 4. Eine Ressource aus Ihrem Projekt in die Bibliothek bringen

Das tun Sie für eine Ressource, die Sie im Projekt angelegt haben und häufiger verwenden, zum Beispiel einen gemieteten Kran.

1. Klicken Sie in der Ansicht *Projekt* bei der Ressource auf *Zur Bibliothek*. Die Schaltfläche erscheint nur bei einer Ressource mit Namen, die noch nicht aus der Bibliothek stammt, in einem verknüpften Projekt.
2. Lesen Sie die Meldung über der Tabelle.

Die Meldung kann drei Aussagen enthalten:

- *Hinzugefügt*. Die Bibliothek hatte kein Element mit diesem Namen. Es wurde ein neues Element angelegt, und Ihre Ressource ist damit verknüpft.
- *War bereits in der Bibliothek vorhanden — jetzt verknüpft*. Es gab ein Element mit demselben Namen und denselben Daten. Ihre Ressource ist damit verknüpft.
- *Mit dem vorhandenen Bibliothekselement verknüpft — die Werte weichen ab, siehe die Markierung*. Es gab ein Element mit demselben Namen, aber anderen Daten. Ihre Ressource ist verknüpft und sofort mit *weicht ab — entscheiden* markiert. Fahren Sie mit Schritt 6 fort.

### 5. Eine Kopie lösen

Wenn Sie in einem Projekt von der Bibliothek abweichen wollen, zum Beispiel mit einem anderen Tarif, lösen Sie die Kopie.

1. Klicken Sie in der Ansicht *Projekt* am Ende der Zeile auf das Symbol *Von der Bibliothek lösen*.
2. Die Ressource ist jetzt eine gewöhnliche Projektressource. Alle Felder sind bearbeitbar, und sie folgt der Bibliothek nicht mehr. Auch der Kalender, der mit der Ressource kam, wird gelöst. Das gilt nicht, wenn eine andere Ressource in diesem Projekt diesem Kalender noch folgt.

Mit *Rückgängig* (Ctrl+Z) nehmen Sie das Lösen zurück.

### 6. Eine Abweichung auflösen

Eine Kopie mit *weicht ab — entscheiden* weicht vom Bibliothekselement ab. Die App entscheidet nicht, wer recht hat.

1. Klicken Sie auf die Markierung *weicht ab — entscheiden* bei der Ressource. Das Fenster *Ressourcenbibliothek verknüpfen* öffnet sich. Es öffnet sich auch von selbst, wenn Sie eine Datei mit einer solchen Kopie öffnen.
2. Wählen Sie im Abschnitt *Abweichungen*, was Sie für das Element wollen. Siehe unten.
3. Klicken Sie auf *Später entscheiden*, wenn Sie noch nicht wählen wollen. Das Fenster schließt sich, und die Markierung bleibt.

Bei einer Abweichung haben Sie zwei Möglichkeiten:

- *Bibliothekswerte verwenden*: Die Kopie bekommt die Daten aus der Bibliothek.
- *Dateiwerte in die Bibliothek übernehmen*: Die Bibliothek bekommt die Daten aus Ihrer Kopie. Darunter steht *Achtung: Dies ändert die Bibliothek und gilt für alle Ihre Projekte.* Die Kopien in anderen geöffneten Projekten folgen dieser Änderung.

## Stolperfallen und was die App dann tut

**Die Beispielprojekte haben eine eigene Bibliothek.** Wenn Sie eines der drei Beispielprojekte öffnen (*Datei › Beispiele*, oder über einen Link in der Hilfe), legt die App einmal die Bibliothek *Demo-Ressourcenbibliothek* an und verknüpft das Projekt damit. Ressourcen des Projekts mit demselben Namen wie ein Bibliothekselement werden sofort verknüpft. Kalender werden nicht verknüpft. Ihre eigenen Bibliotheken bleiben unberührt. Wenn Sie zwei Beispielprojekte nebeneinander öffnen, zeigen sie zusammen Konflikte in [Die Belegungsübersicht verwenden](docs://howto-bezettingsoverzicht-gebruiken), zum Beispiel bei der Maurerkolonne (*Masonry crew*) zwischen *Refurbishment & Extension of a Family Home* und *6 New Terraced Houses, De Akkers*.

**Sie sehen den Schalter nicht.** Das Projekt ist mit keiner Bibliothek verknüpft. Führen Sie Schritt 1 aus.

**Sie bearbeiten die Bibliothek versehentlich.** Das Panel öffnet sich immer auf *Projekt*, um das zu verhindern. Änderungen in der Ansicht *Bibliothek* gelten für alle Projekte und liegen außerhalb von *Rückgängig*.

**Sie löschen eine Ressource aus der Bibliothek.** Die App fragt zuerst *„Bricklayer“ aus der Bibliothek entfernen? Dies gilt für alle Projekte und kann nicht rückgängig gemacht werden*. Die Kopien in Ihren Projekten bleiben erhalten und funktionieren weiter. Sie bekommen die Markierung *nicht mehr in der Bibliothek* und sind vollständig bearbeitbar. Mit *Aus Projekt entfernen* nehmen Sie eine Kopie aus dem Projekt.

**Unter Ressourcenbibliothek wählen Sie eine andere Bibliothek oder *keine (eigenständiges Projekt)*.** Die Herkunftsmarkierungen der vorherigen Bibliothek verschwinden. Die Ressourcen bleiben im Projekt als gewöhnliche Projektressourcen. Bei einer anderen Bibliothek sucht die App erneut nach Ressourcen mit demselben Namen.

**Eine Ressource hat keinen Vorschlag unter *Erkennen*.** Es steht *Kein Vorschlag — manuell wählen*, aber dieses Fenster hat dafür keine Schaltfläche. Das sieht nach einem Mangel aus. Nehmen Sie eine solche Ressource mit *Zur Bibliothek* (Schritt 4) in die Bibliothek auf.

## Siehe auch

- [Die Ressourcenbibliothek](docs://uitleg-resourcebibliotheek): was die Bibliothek entscheidet, was das Projekt entscheidet und wie Kopien nachgezogen werden.
- [Ressourcenbibliotheken verwalten und teilen](docs://howto-bibliotheken-beheren): Bibliotheken anlegen, exportieren und importieren.
- [Die Belegungsübersicht verwenden](docs://howto-bezettingsoverzicht-gebruiken): sehen, ob zwei Projekte gleichzeitig dieselbe Ressource anfordern.
- [Ressourcen verwalten](docs://howto-resources-beheren): die Ressourcen eines einzelnen Projekts.
