# Einen MCP-Client verbinden

Ziel: Ein MCP-Client soll Ihren Terminplan mitlesen und bearbeiten. Sie behalten den Überblick, was er tut, und Sie legen die Grenzen selbst fest.

## Schnell: Lassen Sie Claude es erledigen

Arbeiten Sie mit Claude Desktop oder Claude Code? Dann kann Claude die Verbindung selbst installieren:

1. Klicken Sie unten auf *Prompt kopieren*.
2. Fügen Sie den Prompt in einen neuen Chat mit Claude ein und senden Sie ihn.

Claude installiert dann die Erweiterung für Open Planner Studio und erklärt unterwegs, was sie tut. Wenn Sie selbst etwas tun müssen, etwa auf *Installieren* in Claude Desktop klicken, sagt Claude Ihnen genau, welchen Klick Sie machen müssen. Dafür brauchen Sie kein Token.

```prompt
Installieren Sie die Erweiterung Open Planner Studio für mich, damit Sie meine Bau-Terminpläne in Open Planner Studio lesen und ändern können. Erledigen Sie so viel wie möglich selbst. Sagen Sie vor jedem Schritt in einem einfachen Satz, was Sie tun und warum. Wenn Sie mich brauchen, fragen Sie immer nur eine Sache und warten Sie auf meine Antwort. Wenn ich etwas selbst tun muss, sagen Sie mir genau, welchen einen Klick oder welche Aktion und wo.

Das müssen Sie wissen:
- Die Erweiterung ist eine einzige Datei, open-planner-studio-<version>.mcpb, im neuesten Release: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Der direkte Link steht in https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (die Datei, deren Name auf .mcpb endet). Die Datei ist eine ZIP-Datei.
- Die Erweiterung funktioniert mit der Desktop-App Open Planner Studio und auch ohne die App. Wenn die App geöffnet ist und ihre MCP-Bridge läuft, arbeiten Sie im Terminplan, der in der App geöffnet ist. Wenn die App geschlossen ist, arbeiten Sie mit Terminplan-Dateien in einem Arbeitsordner, den ich auswähle.
- Die Installation braucht kein Token und kein Passwort. Fragen Sie mich nicht danach und lesen oder zeigen Sie keinen.

Wenn Sie mit Claude Desktop arbeiten:
1. Wenn Sie eine Datei herunterladen und auf meinem Computer öffnen können, tun Sie das mit der .mcpb-Datei. Wenn nicht, geben Sie mir den direkten Download-Link und sagen Sie mir, ich soll die Datei per Doppelklick öffnen, sobald der Download fertig ist.
2. Claude Desktop zeigt danach die Erweiterung Open Planner Studio an. Sagen Sie mir, ich soll auf Installieren klicken. Sagen Sie mir dann, ich soll bei Working folder den Ordner mit meinen Terminplan-Dateien wählen.
3. Sagen Sie mir, ich soll einen neuen Chat starten und Sie dort fragen, welche Werkzeuge von Open Planner Studio Sie sehen.

Wenn Sie mit Claude Code arbeiten:
1. Prüfen Sie, ob Node.js 22 oder neuer installiert ist. Ist das nicht so, sagen Sie mir, wie ich es installieren kann, und brechen Sie dann ab.
2. Fragen Sie mich, welcher Ordner meine Terminplan-Dateien enthält. Das ist der Arbeitsordner.
3. Laden Sie die .mcpb-Datei herunter und entpacken Sie sie in einen neuen, eigenen Ordner in meinem Benutzerordner. Lesen Sie dort manifest.json: server.mcp_config zeigt, wie der Server startet. Ersetzen Sie ${__dirname} durch den entpackten Ordner und ${user_config.workdir} durch den Arbeitsordner.
4. Führen Sie claude mcp list aus. Ist dort schon ein Server mit dem Namen open-planner-studio vorhanden, fragen Sie mich, ob Sie ihn ersetzen dürfen. Zeigen Sie seine Einstellungen nicht, denn sie können ein Token enthalten.
5. Fügen Sie den Server für mein Benutzerkonto hinzu, zum Beispiel mit: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<Arbeitsordner> -- node <entpackter Ordner>/server/index.mjs
6. Sagen Sie mir, ich soll eine neue Claude-Code-Sitzung starten. Dort zeigt /mcp, ob open-planner-studio verbunden ist.

Wenn Sie anderswo arbeiten, zum Beispiel in claude.ai im Browser, sagen Sie mir, dass dafür Claude Desktop oder Claude Code nötig ist. Wenn Sie nicht wissen, womit Sie arbeiten, fragen Sie mich.

Wenn die Installation fertig ist, erklären Sie in ein paar Sätzen:
- wie ich Ihnen erlaube, in der geöffneten App zu arbeiten: Wählen Sie in Open Planner Studio Einstellungen › Projekt › App-Einstellungen, Reiter Erweitert, und aktivieren Sie die Option MCP-Verbindung erlauben. Dann klicken Sie im Reiter MCP auf Bridge starten.
- dass eine Änderung ohne die App erst dann in der Datei steht, wenn sie gespeichert ist, und dass keine bestehende Datei überschrieben wird, solange die App geöffnet ist.
Wenn ein Schritt fehlschlägt, sagen Sie mir in einem Satz, was schiefging und was ich tun kann. Raten Sie nicht.
```

Möchten Sie es lieber selbst machen oder nutzen Sie einen anderen MCP-Client? Dann folgen Sie den Schritten unten.

## Wann Sie das brauchen

Sie möchten, dass ein MCP-Client Ihren Terminplan liest, analysiert oder ändert. Zum Beispiel, damit er einen ersten PSP entwirft, Vorgänge korrigiert oder den kritischen Pfad erklärt. Das läuft über das **Model Context Protocol** (MCP): ein Standard, mit dem ein KI-Programm, der **MCP-Client**, Werkzeuge eines anderen Programms nutzen kann. Dafür startet Open Planner Studio einen kleinen Server auf Ihrem eigenen Computer, die **Bridge**. Sie bietet eine Reihe von Werkzeugen, deren Namen alle mit `planner_` beginnen: Vorgänge, Beziehungen, Ressourcen, Kalender, Baselines, Dokumente und Dateien lesen und ändern. Welche es gibt und was sie verweigern, steht in [MCP-Werkzeuge](docs://ref-ai-tools). Der MCP-Client arbeitet im Projekt, das Sie geöffnet haben, nicht in einer Kopie: Ein Vorgang, den er hinzufügt, erscheint sofort im Gantt. Er nutzt dieselbe Berechnung und denselben Verlauf von *Rückgängig* wie Sie.

Die Bridge funktioniert nur in der Desktop-App. Wenn Sie die MCP-Verbindung im Browser erlauben, sehen Sie den Reiter *MCP*, aber die Schaltfläche *Bridge starten* ist grau und zeigt den Text *Die Bridge funktioniert nur in der Desktop-App.* Der Rest dieses Artikels handelt von der Desktop-App. Im Browser sind auch *Jetzt sichern* und *Backup-Ordner öffnen* grau.

## Schritte

### 1. MCP-Verbindung erlauben

1. Wählen Sie *Einstellungen › Projekt › App-Einstellungen*. Sie können auch *Datei › App-Einstellungen* wählen oder das Zahnrad oben.
2. Wählen Sie den Reiter *Erweitert* und schalten Sie *MCP-Verbindung erlauben* ein. Der Reiter *MCP* erscheint im Menüband.
3. Wenn die Bridge schon beim Start der App aktiv sein soll, schalten Sie außerdem *Bridge automatisch starten* ein. Die Option wirkt nur, wenn die MCP-Verbindung eingeschaltet ist, und funktioniert nur in der Desktop-App. Die Option ist standardmäßig aus, weil das Öffnen eines Ports eine bewusste Entscheidung ist.

Wenn Sie die MCP-Verbindung ausschalten, stoppt die Bridge, und der Reiter *MCP* verschwindet.

### 2. Bridge starten

1. Wechseln Sie zum Reiter *MCP* und klicken Sie unter *Server* auf *Bridge starten*.
2. Sehen Sie sich den Status neben der Schaltfläche an. Dort steht *Aus*, *Aktiv auf Port 3877*, *Port 3877 belegt* oder *Fehler*. Wenn der Start gelingt, steht dort *Aktiv auf Port 3877*, und die Schaltfläche heißt *Bridge stoppen*. Bei *Port 3877 belegt* oder *Fehler* bleibt die Schaltfläche *Bridge starten*; siehe Fallstricke.

Die Bridge hört nur auf Ihrem eigenen Computer auf einem einzigen Port. Der Standardport ist 3877. In der Gruppe *Verbindung* können Sie unter *Port* einen anderen Port wählen, aber nur, solange die Bridge gestoppt ist. Die Verbindung läuft über einfaches HTTP auf Ihrem eigenen Computer. Die App selbst sendet nichts nach außen. Was der MCP-Client mit Ihrem Terminplan macht, zum Beispiel was sein Anbieter damit macht, liegt außerhalb der App.

### 3. MCP-Client verbinden

1. Klicken Sie unter *Verbindung* auf *Verbinden*. Das Fenster *Verbindungsdaten* öffnet sich.
2. Wählen Sie, was Ihr Client braucht. Siehe unten.
3. Das Token ist ausgeblendet. Mit dem Augensymbol zeigen Sie es an. Die Kopierschaltflächen kopieren immer den echten Wert, auch wenn der Bildschirm das Token ausblendet.
4. Lassen Sie den MCP-Client die Liste der Werkzeuge abfragen. Diese Prüfung steht auch im Verbindungs-Prompt. Der Client sollte die Werkzeuge mit dem Präfix `planner_` sehen. Die erwartete Anzahl steht im Verbindungs-Prompt.

Das Fenster bietet vier Möglichkeiten, sich zu verbinden:

- *Claude regeln lassen*: derselbe Prompt wie oben in diesem Artikel, mit der Schaltfläche *Prompt kopieren*. Dieser Weg ist für Claude Desktop und Claude Code gedacht. Dafür brauchen Sie kein Token.
- *Konfigurationsausschnitt*: ein Stück Konfiguration, das Sie in die MCP-Einstellungen Ihres Clients einfügen.
- *Verbindungs-Prompt*: ein Text, den Sie in Ihren MCP-Client einfügen. Danach verbindet er sich selbst.
- *Endpunkt* und *Authentifizierung*: die einzelnen Angaben. Der Endpunkt ist `http://localhost:3877/mcp` mit dem Transport *streamable HTTP*. Jede Anfrage braucht einen Header `Authorization: Bearer`, gefolgt von Ihrem Token. Ihr Client muss außerdem MCP-Sitzungen unterstützen: Beim Verbinden gibt die Bridge im Header `Mcp-Session-Id` einen Sitzungscode aus, und sie lehnt jede spätere Anfrage ohne diesen Code ab. Claude Code und `mcp-remote` machen das von selbst.

**Verbinden Sie sich nach einem Update der App erneut.** Wenn Ihr MCP-Client schon mit einer älteren Version der App verbunden war, sendet er noch keinen Sitzungscode, und die Bridge lehnt jede Anfrage ab. Verbinden Sie sich deshalb nach dem Update erneut: Starten Sie in Claude Code eine neue Sitzung, und beenden Sie Claude Desktop vollständig und starten Sie es wieder.

**Claude Code.** Der Konfigurationsausschnitt passt direkt zu Claude Code. Geben Sie in einem Terminal diesen Befehl ein und ersetzen Sie `<token>` durch Ihr eigenes Token:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Sie können den Konfigurationsausschnitt auch in die Datei `.mcp.json` in Ihrem Projektordner legen. Nehmen Sie diese Datei dann nicht in Git auf, weil das Token Zugriff auf Ihren Plan gibt. Ein Server aus `.mcp.json` muss beim ersten Mal in Claude Code freigegeben werden.

**Claude Desktop.** Für Claude Desktop gibt es eine Erweiterung: die Datei `open-planner-studio-<version>.mcpb`. Claude Desktop installiert sie mit einem Doppelklick. Dafür brauchen Sie kein Node.js. Die Erweiterung funktioniert mit der App und ohne die App. Mit dem Prompt oben in diesem Artikel geht es schneller; unten stehen die Schritte von Hand.

1. Laden Sie die Datei `.mcpb` von der neuesten Veröffentlichung herunter: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Doppelklicken Sie auf die Datei. Claude Desktop öffnet sich und zeigt die Erweiterung *Open Planner Studio*. Installieren Sie sie. Funktioniert der Doppelklick nicht, öffnen Sie in Claude Desktop *Einstellungen › Erweiterungen* und installieren Sie die Datei dort.
3. Wählen Sie bei *Working folder* den Ordner mit Ihren Terminplan-Dateien. Claude verwendet diesen Ordner nur, wenn die App geschlossen ist. Claude liest und schreibt dann nur in diesem Ordner.
4. Schalten Sie die Erweiterung ein und starten Sie einen neuen Chat. Fragen Sie Claude, welche Werkzeuge von Open Planner Studio es sieht.

Sie geben kein Token und keinen Port ein: Solange die Bridge läuft, findet die Erweiterung die App selbst. Bei jeder Frage von Claude prüft die Erweiterung neu, welcher der beiden Fälle vorliegt:

- *Die App ist geöffnet und die Bridge läuft*: Claude arbeitet im Plan, der in der App geöffnet ist. Sie sehen jede Änderung sofort in der App.
- *Die App ist geschlossen oder die Bridge ist aus*: Claude arbeitet an einer Terminplan-Datei im Arbeitsordner. Eine Änderung steht erst dann in der Datei, wenn Claude die Datei speichert. Es gibt kein automatisches Speichern. Solange die App geöffnet ist, überschreibt Claude keine bestehende Datei, sondern speichert unter einem neuen Namen.

Wenn sich die App während der Arbeit von Claude öffnet oder schließt, wechselt die Erweiterung und meldet es Claude. Claude wählt oder öffnet dann zuerst den Plan erneut und ändert erst danach etwas. Hat Claude noch Änderungen ohne App, die nicht gespeichert sind, arbeitet die Erweiterung ohne App weiter, bis Claude sie gespeichert hat. So geht keine Arbeit verloren. Kann die Erweiterung die App nicht erreichen und gibt es keinen brauchbaren Arbeitsordner, sieht Claude nur das Werkzeug `open_planner_studio_status`, mit einer Meldung, die Ihnen sagt, was Sie tun müssen.

**Claude Desktop ohne Erweiterung.** Wenn Sie die Erweiterung nicht nutzen können, verbinden Sie Claude Desktop mit dem externen Werkzeug `mcp-remote`. Der Konfigurationsausschnitt passt nicht direkt zu Claude Desktop: In der Datei `claude_desktop_config.json` nennen Sie ein Programm, das Claude Desktop selbst startet, keine Adresse. `mcp-remote` braucht Node.js. Wählen Sie in Claude Desktop *Einstellungen › Entwickler › Konfiguration bearbeiten*, fügen Sie dies in die Datei ein (mit Ihrem eigenen Token) und starten Sie Claude Desktop erneut:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Das Token steht mit Absicht in `env` und nicht in `args`: Unter Windows zerteilt Claude Desktop ein Argument, das ein Leerzeichen enthält, falsch. Ein *benutzerdefinierter Connector* in Claude (*Anpassen › Connectors*) funktioniert nicht mit der Bridge. Claude verbindet sich dann von der Anthropic-Cloud aus, und diese kann die Bridge auf Ihrem eigenen Computer nicht erreichen.

In der Gruppe *Verbindung* gibt es außerdem das Feld *Token*. Es ist ein langer, zufälliger Code, den die App für Sie erstellt und auf diesem Computer speichert. Im Fenster steht *Dieses Token gewährt Zugriff auf den geöffneten Plan. Geben Sie es nicht weiter.* Mit dem Symbol *Neuer Token* erstellen Sie ein neues Token. Die App fragt zuerst *Ein neuer Token trennt alle bestehenden Verbindungen. Fortfahren?* Läuft die Bridge, startet sie mit dem neuen Token neu, und das alte funktioniert nicht mehr.

**Wie die Erweiterung die App findet.** Während die Bridge läuft, schreibt die Desktop-App den Port und das Token in die Datei `mcp/runtime.json` im Datenordner der App. Die Erweiterung für Claude Desktop liest diese Datei bei jeder Frage. Unter Linux und macOS kann nur Ihr Benutzerkonto die Datei lesen. Unter Windows schützt die Standard-ACL Ihres Profilordners die Datei; die App prüft das nicht separat. Stoppen Sie die Bridge oder schalten Sie die MCP-Verbindung aus, dann entfernt die App die Datei. Die App führt außerdem eine Liste der geöffneten Dateien in `mcp/open-files.json`, auch wenn die MCP-Verbindung aus ist. Solange diese Datei existiert, überschreiben die Erweiterung und der Headless-MCP-Server keine bestehende Datei, auch nicht eine Datei, die Sie gerade geöffnet haben und die noch nicht in der Liste steht. Eine neue Datei ist erlaubt. Lesen ist ebenfalls erlaubt: Claude sieht dann die Version auf dem Datenträger, ohne Ihre Änderungen, die noch nicht gespeichert sind.

### 4. Die Aktivität des MCP-Clients ansehen

1. Klicken Sie unter *Aktivität* auf *Aktivitätsbereich*. In der Seitenspalte öffnet sich der Bereich *MCP-Aktivität*.
2. Jeder Aufruf der Bridge steht in einer Zeile, der neueste oben: Zeit, was geschah, wie lange es dauerte und ob es gelang oder nicht. Klicken Sie auf eine Zeile, um *Argumente* und *Antwort* aufzuklappen.
3. Mit *Leeren* leeren Sie die Liste. Der Bereich behält die letzten 500 Aufrufe. Solange nichts passiert ist, steht dort *Noch keine MCP-Aktivität. Aufrufe der Bridge erscheinen hier.*

Ist die MCP-Verbindung eingeschaltet, steht unten rechts in der Statusleiste ein Punkt mit *MCP*. Seine Farbe zeigt den Status der Bridge, und ein Klick darauf bringt Sie zum Reiter *MCP*.

### 5. Grenzen setzen

Unter *Sicherheit* stehen die Schaltflächen, mit denen Sie den MCP-Client begrenzen:

- *Pausieren*: Der MCP-Client darf vorübergehend nichts ändern, Lesen ist weiterhin erlaubt. Die Bridge bleibt aktiv. Die Schaltfläche wird zu *Fortsetzen*.
- *Schreibgeschützt*: Alle Werkzeuge, die etwas ändern, werden abgelehnt, solange dies eingeschaltet ist.
- *Auto-Backup: an*: Bevor der MCP-Client die erste Änderung in einem Dokument macht, schreibt die App ein IFC-Backup. Das ist standardmäßig eingeschaltet. Mit der Schaltfläche schalten Sie es aus, dann steht dort *Auto-Backup: aus*. Das geschieht einmal pro Dokument und bei jedem Start der Bridge.
- *Jetzt sichern*: erstellt sofort ein Backup des aktiven Dokuments. Danach steht dort *Backup erstellt:* mit dem Dateinamen.
- *Backup-Ordner öffnen*: öffnet den Ordner mit den Backups.

Die Backups liegen im Ordner `ai-backups` im Datenordner der App. Die App behält die letzten Backups und dünnt ältere aus. Wie genau das geschieht, steht in [MCP-Werkzeuge](docs://ref-ai-tools).

### 6. Den MCP-Client gut planen lassen

Ein MCP-Client plant nur gut, wenn er die Planungsregeln kennt. Das machen Sie selbst:

1. **Für die Kernregeln tun Sie nichts.** Die Kernregeln kommen beim Verbinden mit: Die Bridge sendet sie im Feld `instructions` des MCP-Handshakes. Ob Ihr Client sie in seinen System-Prompt übernimmt, hängt vom Client ab.
2. **Lassen Sie den Leitfaden lesen.** Der Verbindungs-Prompt aus dem Fenster *Verbindungsdaten* bittet den MCP-Client, den Leitfaden mit dem Werkzeug `planner_get_planning_guide` zu lesen. Wenn Sie den Prompt nicht verwenden, bitten Sie den Client selbst mit diesem Satz: *Lesen Sie den Planungsleitfaden mit planner_get_planning_guide, bevor Sie etwas ändern.* Den Leitfaden können Sie auch selbst lesen unter `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Optional: Skills installieren.** Das funktioniert nur mit einem MCP-Client, der Skills unterstützt. Legen Sie die Datei `SKILL.md` von *goed-plannen* und *progress-update* in `.claude/skills/goed-plannen/SKILL.md` und `.claude/skills/progress-update/SKILL.md` im Projektordner, in dem der MCP-Client arbeitet, oder unter `~/.claude/skills/` für jedes Projekt.

Sie bekommen die Dateien auf zwei Wegen. Bitten Sie den MCP-Client, das Werkzeug `planner_get_planning_guide` mit `part` auf `skill` aufzurufen. Die Antwort enthält beide Texte und, für jeden Skill, die Stellen, an denen er hingehört. Oder laden Sie sie herunter von `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` und `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Ist *goed-plannen* noch aus einer älteren Version der App vorhanden, ersetzen Sie die Datei: Dieser alte Text ist auf Niederländisch und verweist für MCP-Clients auf den Hilfeartikel statt auf den Leitfaden.

Ob der MCP-Client den Leitfaden wirklich gelesen hat, sehen Sie im *Aktivitätsbereich*: Dann gibt es einen Aufruf von `planner_get_planning_guide`. Die Schlussantwort sollte eine Liste mit Annahmen enthalten: geschätzte Dauern, die gewählte Aufteilung, Beziehungen, die er selbst angelegt hat, und jede Einschränkung, die er gesetzt hat. Fehlt diese Liste, bitten Sie darum. Nach einer Fortschrittsaktualisierung nach *progress-update* sollte die Antwort das Statusdatum, das neue Ende und die Abweichung von der Baseline nennen.

## Fallstricke und was die App dann tut

**Der MCP-Client ändert etwas, das Sie zurücknehmen möchten.** Jede Änderung des MCP-Clients ist ein Schritt, den Sie mit *Rückgängig* (Strg+Z) zurücknehmen. Eine Folge von Änderungen, die der MCP-Client als Ganzes übergibt, ist ein einziger Schritt. Danach zeigt die App das Projekt als ungespeichert an. Nach einer Änderung wird der Terminplan neu berechnet, sodass Sie F5 nicht selbst drücken müssen.

**Die App weist einen Aufruf des MCP-Clients ab.** Bei *Pausieren* und *Schreibgeschützt* weist die App alle Änderungen ab. Lesen bleibt möglich, und ein veralteter Terminplan darf weiterhin neu berechnet werden. Wenn Sie selbst gerade eine Bearbeitung machen, etwa einen Balken ziehen oder in ein Feld tippen, bekommt der MCP-Client die Daten von vor Ihrer Bearbeitung, mit einem Hinweis, dass sie veraltet sind. Ist ein Dialog offen, zum Beispiel die Einstellungen, ein Vorgangsdialog oder das Willkommensfenster, oder ist der Präsentationsmodus an, weist die App alle Aufrufe ab, auch das Lesen, bis Sie den Dialog schließen. Der MCP-Client erhält dann eine Fehlermeldung mit dem internen Namen dessen, was offen ist, zum Beispiel `showTaskDialog`. Nur `planner_get_planning_guide` funktioniert weiter, weil es Ihren Terminplan nicht liest.

**Sie wechseln den Reiter, während der MCP-Client arbeitet.** Der MCP-Client arbeitet an dem Dokument, in dem seine erste Änderung landete. Wechseln Sie in der Zwischenzeit den Reiter, weist die App seine nächste Änderung ab, bis er bestätigt, dass er am anderen Reiter arbeiten möchte. So landet nichts im falschen Projekt. Öffnet oder dupliziert der MCP-Client selbst ein Dokument, arbeitet er danach in diesem neuen Dokument.

**Der MCP-Client schreibt oder öffnet eine Datei.** Der MCP-Client kann einen Terminplan als IFC-Datei schreiben und eine Terminplan-Datei als neuen Reiter öffnen. Das kann er nur innerhalb Ihres Benutzerordners. Eine bestehende Datei überschreibt er nur, wenn er ausdrücklich darum bittet.

**Der Status ist *Port 3877 belegt*.** Ein anderes Programm nutzt den Port. Die Meldung der App steht darunter. Das Portfeld bleibt dann gesperrt (*Nur bearbeitbar, solange der Server gestoppt ist.*), obwohl die Bridge nicht läuft, und es gibt keine Schaltfläche zum Stoppen. Das ist ein bekannter Mangel. Bis das behoben ist, schalten Sie *MCP-Verbindung erlauben* aus und wieder ein. Der Status steht dann wieder auf *Aus*, und Sie können einen anderen Port wählen. Kopieren Sie danach die Verbindungsdaten erneut, weil der Endpunkt den Port enthält.

**Der Client kann nach einem neuen Token nicht verbinden.** Ein neues Token trennt alle bestehenden Verbindungen. Geben Sie dem Client das neue Token, oder fügen Sie den Konfigurationsausschnitt erneut ein. Die Erweiterung in Claude Desktop liest das neue Token selbst; dort müssen Sie nichts tun.

**Sie haben die Bridge selbst gestoppt, und sie startet nicht von allein.** *Bridge automatisch starten* wirkt einmal bei jedem Start der App. Wenn Sie die Bridge selbst stoppen, schaltet die App sie nicht still wieder ein.

**Der Reiter *MCP* ist verschwunden.** Die MCP-Verbindung ist aus. Schalten Sie sie in Schritt 1 ein.

**Eine Webseite in Ihrem Browser kann nicht mit der Bridge kommunizieren.** Die Bridge lehnt jede Anfrage ab, die aus einem Browser kommt, und jede Anfrage ohne das richtige Token.

## Ohne die App

Es gibt auch einen MCP-Server, der ohne die Desktop-App arbeitet: den **MCP-Server ohne Oberfläche**. Er bietet dieselben Werkzeuge `planner_*` an, arbeitet aber mit einer Terminplan-Datei auf der Festplatte und nicht mit Ihrem geöffneten Projekt. Daher sehen Sie die Änderungen nicht im Gantt-Diagramm, und *Rückgängig* in der App gilt nicht für sie. Verwenden Sie ihn, wenn Sie die App nicht geöffnet haben möchten, oder auf einem Computer ohne Bildschirm.

Die Erweiterung für Claude Desktop startet diesen Server selbst, wenn die App geschlossen ist (siehe Schritt 3). Die folgenden Schritte gelten für einen anderen MCP-Client, zum Beispiel Claude Code.

Die Version enthält keinen fertigen Server zum Herunterladen. Sie bauen ihn aus dem Quellcode mit `npm run build:mcp-server`; dafür brauchen Sie Node.js 22 oder neuer. Das Ergebnis ist eine einzige Datei, `server.mjs`.

1. Wählen Sie einen Arbeitsordner mit Ihren Terminplan-Dateien. Der Server liest und schreibt nur in diesem Ordner.
2. Verbinden Sie Ihren MCP-Client. Für Claude Code steht der Befehl unter diesen Schritten.
3. Bitten Sie den MCP-Client, einen Terminplan zu öffnen, zum Beispiel `~/plan.ifc`. In diesem Server bedeutet `~` den Arbeitsordner.
4. Bitten Sie den MCP-Client, das Ergebnis zu speichern. Es gibt kein automatisches Speichern: Der MCP-Client schreibt die Datei mit `planner_export_ifc`. Was nicht gespeichert wird, geht verloren, wenn der Server stoppt.

Für Schritt 2 in Claude Code geben Sie diesen Befehl in einem Terminal mit Ihren eigenen Pfaden ein:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Vor der ersten Änderung an jedem Dokument erstellt der Server eine MCP-Sicherung, wie die App. Ein MCP-Client, der einen Pfad außerhalb des Arbeitsordners wählt, auch über eine symbolische Verknüpfung, wird abgewiesen. Solange die App geöffnet ist, überschreibt der Server keine vorhandene Datei.

## Siehe auch

- [Feedback geben](docs://howto-feedback-geven): Wenn die Verbindung anders funktioniert als hier beschrieben, melden Sie es.
- [MCP-Werkzeuge](docs://ref-ai-tools): alle Werkzeuge `planner_*` nach Gruppe, die Fehlercodes und wie lange Sicherungen aufbewahrt werden.
- [App-Einstellungen](docs://ref-instellingen): die MCP-Einstellungen.
