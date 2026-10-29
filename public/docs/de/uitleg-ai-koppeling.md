# Wie die KI-Verbindung funktioniert

Was passiert eigentlich, wenn ein KI-Assistent in Ihrem Terminplan arbeitet? In diesem Artikel lesen Sie, was die Verbindung ist, warum sie sich von einem Dateiaustausch unterscheidet, welche Grenzen die App sich selbst setzt und wie der Assistent erfährt, wie ein Terminplan aufgebaut sein soll. Das Beispiel am Ende zeigt an Zahlen, was ein Assistent in einem Schritt tun kann und was Sie davon wieder rückgängig machen können.

## Das Konzept

Ein KI-Assistent, etwa ein Chatprogramm oder ein Programmierassistent, kann über das **Model Context Protocol** (MCP) ein anderes Programm bedienen. Open Planner Studio spielt in diesem Austausch die Rolle des Servers. Die Desktop-App betreibt auf Ihrem eigenen Computer einen kleinen Server, die **Brücke**. Der Assistent verbindet sich damit und erhält eine Liste mit **Werkzeugen**: Funktionen mit einem Namen, der mit `planner_` beginnt, zum Beispiel Vorgänge lesen, eine Beziehung hinzufügen oder eine Baseline speichern. Welche es gibt, steht unter [KI-Werkzeuge](docs://ref-ai-tools).

Das Bemerkenswerte ist, dass der Assistent in dem Projekt arbeitet, das Sie in diesem Moment geöffnet haben, nicht in einer Kopie. Sie exportieren nichts und importieren nichts, und es gibt keinen Moment, in dem Sie und der Assistent zwei verschiedene Versionen ansehen. Ein Vorgang, den der Assistent hinzufügt, erscheint sofort in der Gantt-Ansicht. Die App ist dabei nicht naiv: Der Assistent arbeitet mit derselben Berechnung, demselben Rückgängig-Verlauf und denselben Regeln wie Sie.

Wie Sie die Verbindung einschalten, steht unter [KI-Assistenten anschließen (MCP)](docs://howto-ai-assistent-koppelen). Unten lesen Sie, wie sie funktioniert.

## Wie die App damit umgeht

### Ein Server, den nur Ihr eigener Computer hört

Die Brücke lauscht nur auf Ihrem eigenen Computer (`127.0.0.1`), an einem Port, standardmäßig 3877. Sie nimmt nur Anfragen an die Adresse `/mcp` an, und nur mit Ihrem **Token** im Header `Authorization: Bearer`. Eine Anfrage ohne das richtige Token lehnt sie ab. Eine Anfrage aus einem Browser erkennt sie an einem `Origin`-Header und lehnt sie ebenfalls ab, damit eine Webseite, die Sie zufällig offen haben, nicht mit Ihrem Terminplan sprechen kann. Sie verarbeitet Anfragen streng einzeln, eine nach der anderen.

Die Verbindung ist einfaches HTTP auf Ihrem eigenen Computer; die App selbst sendet nichts nach außen. Was ein Assistent mit dem Terminplan macht, den er liest, zum Beispiel was sein Anbieter damit tut, liegt beim Assistenten und fällt außerhalb der App.

### Der Assistent arbeitet an einem Dokument

Bei seiner ersten Änderung bindet die Brücke die Verbindung an das Dokument, das dann aktiv ist. Wenn Sie danach selbst zu einer anderen Registerkarte wechseln, lehnt die App die nächste Änderung des Assistenten ab (Code `DOC_DRIFT`), bis er mit `planner_switch_document` bestätigt, mit welchem Dokument er arbeiten will. So landet nichts im falschen Projekt. Ein Assistent, der selbst ein Dokument öffnet oder dupliziert, arbeitet danach in diesem neuen Dokument.

### Jede Änderung wird neu berechnet

In der App planen Sie von Hand: Sie ändern etwas und drücken dann *Berechnen* (F5), sofern nicht *Automatisch berechnen* eingeschaltet ist. Das gilt nicht für eine Änderung durch den Assistenten. Jede Schreibaktion des Assistenten läuft über eine Transaktion. Ändern sich darin Projektdaten, berechnet die App am Ende selbst neu, bei einem Skript einmal. Ein Lesewerkzeug liefert immer aktuelle Termine: Ist der Terminplan veraltet, zum Beispiel weil Sie selbst etwas geändert und noch nicht *Berechnen* gedrückt haben, berechnet das Lesewerkzeug zuerst neu. Es gibt eine Ausnahme: Ist das Projekt in der Ansicht *Termine wie gespeichert* (nach einem Import), berechnet ein Lesewerkzeug nicht stillschweigend neu, denn dann würden diese Termine ersetzt. Der Assistent erhält dann die gespeicherten Termine, mit einem Hinweis, dass sie nicht neu berechnet wurden. Eine Änderung durch den Assistenten selbst berechnet immer neu, auch dann. Nach einer Änderung durch den Assistenten müssen Sie nicht *Berechnen* drücken. Er liest dann das Ergebnis, etwa das Projektende und den kritischen Pfad, mit den Lesewerkzeugen zurück. Siehe auch [Termine wie gespeichert](docs://uitleg-datums-zoals-opgeslagen).

### Ein Skript ist ein Schritt

Ein Assistent kann eine Reihe von Schritten als Ganzes mit `planner_batch` einreichen, ein Skript mit höchstens 100 Schritten. Das ergibt für Sie einen Rückgängig-Schritt, eine Neuberechnung und eine Sicherung. Scheitert ein Schritt strukturell, zum Beispiel an einem unbekannten Werkzeug oder an einem Zirkelbezug, dann macht die App das ganze Skript rückgängig. Sie behalten nie einen halb fertigen Terminplan. Eine Ablehnung eines Eintrags innerhalb eines Sammelschritts ist milder, zum Beispiel eine ungültige Fortschrittszeile von zwanzig: Dieser Eintrag bleibt weg, und der Rest wird ausgeführt. Die Ablehnungen stehen oben in der Antwort.

### Ihre Grenzen

Vier Dinge stellen Sie selbst ein, auf der Registerkarte *KI*:

- *Pausieren* und *Schreibgeschützt* lassen den Assistenten verbunden, lehnen aber jede Änderung ab. Lesen bleibt möglich, auch die Neuberechnung eines veralteten Terminplans beim Lesen: Das sind berechnete Felder, keine Projektdaten. Daher kommt kein Rückgängig-Schritt hinzu, und das Projekt gilt nicht als geändert. Wenn Sie selbst mitten in einer Bearbeitung sind, zum Beispiel einen Balken ziehen oder in einem Feld tippen, berechnet ein Lesewerkzeug nicht neu: Der Assistent erhält dann die Termine von vor Ihrer Bearbeitung, mit einem Hinweis, dass sie veraltet sind.
- Ein offener Dialog blockiert alles. Ist zum Beispiel der Vorgangsdialog, die Einstellungen, der Präsentationsmodus oder das Willkommensfenster geöffnet, dann lehnt die App auch das Lesen ab, weil Sie mitten in einer manuellen Aktion sind. Der Assistent erhält den Fehlercode `DIALOG_OPEN`. Die Meldung nennt den internen Namen dessen, was geöffnet ist, zum Beispiel `showTaskDialog` für den Vorgangsdialog.
- Die *Automatische Sicherung* schreibt vor der ersten Änderung pro Dokument eine IFC-Kopie. Schlägt diese Sicherung fehl, führt die App die Änderung nicht aus.
- Der *Aktivitätsbereich* zeigt jeden Aufruf mit Argumenten und Antwort.

Dazu kommt Ihr normales *Rückgängig* (Strg+Z). Der Assistent teilt diesen Verlauf mit Ihnen und hat selbst `planner_undo` und `planner_redo`.

### Was der Assistent nicht tun kann

Die Brücke ist bewusst enger als die App. Was der Assistent nicht tun kann, hat meist einen von drei Gründen.

**Der Assistent greift über das Projekt hinaus.** Ein Assistent kann die Ressourcenbibliothek nicht ändern. Eine Bibliothek wird von allen Ihren Projekten gemeinsam genutzt und liegt außerhalb des Rückgängig-Verlaufs. Eine einzige Tarifänderung würde dann in Projekten wirken, die nicht einmal geöffnet sind. Bei einer Ressource aus einer Bibliothek sind Name, Typ, Beschreibung, Tarif und Einheit fest, genau wie im Ressourcen-Panel. Was das Projekt entscheidet, bleibt beim Assistenten: Max. Einheiten, Verfügbarkeit über die Zeit, Kalender und Team. Er kann auch nicht wählen, welcher Kalender der Projektkalender ist. Er kann das Berechnungsprofil und die Berechnungsoptionen lesen, aber nicht ändern; er kann nur den Fortschrittsmodus und den Projektstandard für die Vorgangsart setzen. Es gibt keine Werkzeuge für Einstellungen, Design, Sprache, Erweiterungen oder Updates.

**Es lässt sich nicht zuverlässig prüfen.** Ein Assistent kann kein Hammock setzen, einen Vorgang manuell terminieren, eine zweite Einschränkung setzen, Notizen, Farben, Aktivitätscodes, benutzerdefinierte Felder oder externe Beziehungen eintragen, und er kann keine Abgleichsverzögerung von Hand setzen. Auch einen PSP-Code wählt er nicht; das leitet die App selbst ab.

**Es betrifft etwas, das Sie selbst entscheiden müssen.** Fortschritt erfasst er nur, wenn es ein Statusdatum gibt. Das wählt er nicht selbst: Es ist Ihr Bezugsdatum. Hat ein Vorgang, der noch nicht begonnen hat, einen geplanten Anfang nach dem Statusdatum, dann muss er den Ist-Anfang angeben. Er liest und schreibt Dateien nur innerhalb Ihres Benutzerordners, und er überschreibt eine bestehende Datei nur, wenn er das ausdrücklich verlangt. Ein Export ist kein *Speichern*: Das Projekt bleibt in der App ungespeichert.

### Wie der Assistent weiß, wie er plant

Ein Assistent, der die Werkzeuge kennt, kann trotzdem einen Terminplan bauen, den kein Planer gebrauchen kann: Vorgänge ohne Beziehungen, ein fester Termin bei jedem Vorgang oder eine viel zu feine Gliederung. Deshalb gibt die App ihm drei Dinge mit.

**Die Kernregeln im Handshake.** Beim Verbinden sendet die Brücke einen kurzen Text im Feld `instructions` des MCP-Handshakes. Viele Clients setzen diesen Text in ihren Systemprompt; ob Ihrer das tut, hängt vom Client ab. Die Regeln: Beginnen Sie bei den Meilensteinen und beim Liefertermin, bauen Sie Vorgänge von etwa einem Tag bis zu zwei Wochen, steuern Sie den Terminplan über Beziehungen statt über feste Termine, verwenden Sie Einschränkungen nur für harte externe Termine, beheben Sie zuerst eine fehlgeschlagene Berechnung, verwenden Sie `planner_batch` für eine zusammenhängende Reihe, erfassen Sie Fortschritt nur mit Ihrem Statusdatum und den Ist-Werten, die Sie angeben, und nennen Sie am Ende, was Sie angenommen und was Sie bewusst nicht getan haben.

**Der Leitfaden für Assistenten.** Das Werkzeug `planner_get_planning_guide` liefert einen Leitfaden, der speziell für Assistenten geschrieben ist. Er folgt denselben Grundsätzen wie [Gut planen](docs://gids-goed-plannen), aber ein Assistent arbeitet anders als Sie: Er drückt nicht F5 und klickt nicht im Menüband, sondern ruft Werkzeuge auf, und die App berechnet für ihn neu. Daher nennt der Leitfaden bei jedem Grundsatz die Werkzeuge, die der Assistent dafür nutzt, und erklärt, was der Assistent mit der Ansicht *Termine wie gespeichert* oder mit einer fehlgeschlagenen Berechnung tut. Der Leitfaden ist auf Englisch, wie alles, was der Assistent über die Verbindung liest. Das Werkzeug nimmt für ältere Assistenten noch eine Sprachwahl an, aber das ändert den Text nicht. Sie können ihn selbst lesen unter `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Die Verbindungsanweisung im Fenster *Verbindungsdaten* bittet den Assistenten, zuerst den Leitfaden zu lesen. Das Werkzeug funktioniert auch, wenn ein Dialog offen ist, im pausierten Modus und im schreibgeschützten Modus, weil es Ihren Terminplan nicht liest.

**Zwei Skills.** Ein Skill ist eine kleine Datei mit Anweisungen, die ein Assistent in jeder Sitzung mitliest. Es gibt zwei, weil es zwei Arten von Arbeit sind. Einen Terminplan aufsetzen betrifft die Logik; den Fortschritt aktualisieren betrifft Fakten, die nur Sie kennen. Der Skill *goed-plannen* dient dazu, einen Terminplan aufzusetzen oder umzubauen: die Reihenfolge, in der die Werkzeuge genutzt werden, die Regel für die Neuberechnung, `planner_batch` und die Pflicht, Annahmen zu melden. Der Skill *progress-update* dient dem wöchentlichen Fortschrittsupdate: zuerst Ihr Statusdatum, dann den Ist-Anfang, das Ist-Ende und den Fertigstellungsgrad, und danach ein Bericht über die Abweichung gegenüber der Baseline, den kritischen Pfad und das neue Projektende. Die Planungsgrundsätze selbst stehen im Leitfaden. Beide Skills sind auf Englisch. Das Werkzeug liefert beide mit der Angabe, wo sie hingehören. Wie Sie sie installieren, steht unter [KI-Assistenten anschließen (MCP)](docs://howto-ai-assistent-koppelen).

## Ein Beispiel

Sie bitten einen Assistenten, einen Anbau mit Fundament, Mauerwerk und Dach zu planen, in dieser Reihenfolge. Ihr Projekt beginnt am Montag, 2. März 2026. Der Assistent liest zuerst den Leitfaden und reicht dann ein Skript ein:

1. den Projektstart am 2. März 2026;
2. drei Vorgänge: Foundation mit 5 Arbeitstagen, Brickwork mit 10 und Roof mit 4;
3. zwei Ende-Anfang-Beziehungen: Foundation zu Brickwork, Brickwork zu Roof.

Die App führt die drei Schritte aus, und die Termine werden neu berechnet. Liest der Assistent danach zurück, findet er: Projektende Donnerstag, 26. März 2026, Dauer des Projekts 19 Arbeitstage, alle drei Vorgänge kritisch. Das passt zur Summe: 5 + 10 + 4 ergibt 19 Arbeitstage, und 19 Arbeitstage nach Montag, 2. März, enden am Donnerstag, 26. März. Das ganze Skript ist ein Schritt in Ihrem Verlauf. Mit einem *Rückgängig* entfernen Sie die drei Vorgänge, die zwei Beziehungen und den neuen Projektstart.

Nun der Was-wäre-wenn-Fall. Sie bitten den Assistenten dann, den Fortschritt zu aktualisieren. Dafür setzt er das Statusdatum auf Montag, 16. März. Ein Statusdatum ist kein Etikett: Vorgänge, die noch nicht begonnen haben, dürfen nicht vor diesem Datum liegen und rücken darauf vor. Ohne eine einzige Zeile Fortschritt verschiebt sich der ganze Terminplan also mit: Foundation läuft vom 16. bis 20. März, Brickwork vom 23. März bis 7. April und Roof vom 8. bis 13. April. Das Projektende springt vom 26. März auf 13. April. Der Terminplan rückt um zwei Arbeitswochen vor, und der Kalender in diesem Beispiel, *Bouwkalender NL*, hat Karfreitag (3. April) und Ostern (5. und 6. April). Diese beiden freien Wochentage schieben das Ende um zwei weitere Tage. Deshalb setzt der Assistent das Statusdatum nur auf Ihre Bitte und nur dann, wenn es echten Fortschritt zu erfassen gibt.

## Folgen für Ihren Terminplan und häufige Missverständnisse

**Der Assistent hat keine eigene Kopie.** Was er ändert, ändert Ihr Projekt. Ist die Automatische Sicherung eingeschaltet, haben Sie vor seiner ersten Änderung eine IFC-Sicherung. Mit *Schreibgeschützt* kann er analysieren, ohne etwas zu ändern.

**Ein neues Token unterbricht alle Verbindungen.** Das Token ist das Passwort der Brücke. Ein neues Token macht das alte ungültig, auch bei einer laufenden Brücke, und dem Assistenten muss das neue gegeben werden.

**Dass der Assistent meldet, es hat funktioniert, ist kein Beweis.** Der Aktivitätsbereich zeigt, welches Werkzeug er tatsächlich aufgerufen hat und was zurückkam. Eine Ablehnung nennt fast immer das Feld, das falsch war, und den Weg, der funktioniert.

**Der Assistent kann keinen Was-wäre-wenn-Fall mit Rückgängig durchspielen.** Er teilt den Rückgängig-Verlauf mit Ihnen. Deshalb dupliziert er für Varianten das Dokument mit `planner_duplicate_document`. Die Kopie ist losgelöst, hat keinen Dateipfad und wird als ungespeichert angezeigt. Der Assistent schließt Varianten nicht; das entscheiden Sie.

**Ein Export durch den Assistenten ist kein Speichern.** Er schreibt eine IFC-Datei an einen Pfad, den er selbst wählt, innerhalb Ihres Benutzerordners, und er überschreibt eine bestehende Datei nur, wenn er das ausdrücklich verlangt. Ihr Projekt bleibt in der App ungespeichert und behält sein eigenes Speicherziel. Importiert er eine Datei, dann öffnet sie sich in einer neuen Registerkarte oder in einer leeren, unveränderten Registerkarte.

## Siehe auch

- [KI-Assistenten anschließen (MCP)](docs://howto-ai-assistent-koppelen): die Schritte, um die Brücke zu starten, einen Assistenten zu verbinden und den Skill zu installieren.
- [KI-Werkzeuge](docs://ref-ai-tools): alle Werkzeuge nach Gruppe, was sie ablehnen und wie lange Sicherungen aufbewahrt werden.
- [Gut planen](docs://gids-goed-plannen): die Planungsgrundsätze; der Assistent erhält sie in einer englischen Fassung mit den ergänzten Werkzeugen.
- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): was das Statusdatum mit Ihrem Terminplan macht.
