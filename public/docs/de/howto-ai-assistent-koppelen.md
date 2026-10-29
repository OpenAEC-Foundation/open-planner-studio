# Einen KI-Assistenten verbinden (MCP)

Ziel: Ein KI-Assistent liest mit und arbeitet an Ihrem Terminplan, mit Einblick in das, was er tut, und mit Grenzen, die Sie selbst setzen.

## Wann Sie das brauchen

Sie möchten, dass ein KI-Assistent Ihren Terminplan liest, analysiert oder ändert. Zum Beispiel, damit er einen ersten PSP entwirft, Vorgänge korrigiert oder den kritischen Pfad erklärt. Das funktioniert über das **Model Context Protocol** (MCP): ein Standard, mit dem ein KI-Assistent die Werkzeuge eines Programms nutzen kann. Dafür startet Open Planner Studio einen kleinen Server auf Ihrem eigenen Computer, die **Bridge**. Sie bietet eine Reihe von Werkzeugen an, alle mit einem Namen, der mit `planner_` beginnt, zum Lesen und Ändern von Vorgängen, Beziehungen, Ressourcen, Kalendern, Baselines, Dokumenten und Dateien. Welche es gibt und welche sie ablehnen, steht in [KI-Werkzeuge](docs://ref-ai-tools); warum die Verbindung so funktioniert, steht in [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling).

Die Bridge funktioniert nur in der Desktop-App. Wenn Sie den KI-Modus im Browser einschalten, sehen Sie die Registerkarte *KI*, aber die Schaltfläche *Bridge starten* ist grau, mit dem Text *Die Bridge funktioniert nur in der Desktop-App.* Der Rest dieses Artikels betrifft die Desktop-App. Im Browser sind auch *Jetzt sichern* und *Backup-Ordner öffnen* grau.

## Schritte

### 1. KI-Modus einschalten

1. Wählen Sie *Einstellungen › Projekt › App-Einstellungen*. Sie können auch *Datei › App-Einstellungen* wählen oder das Zahnrad oben.
2. Wählen Sie die Registerkarte *Erweitert* und schalten Sie *KI-Modus aktivieren* ein. Die Registerkarte *KI* erscheint im Menüband.
3. Wenn die Bridge sofort nach dem Start der App aktiv sein soll, schalten Sie außerdem *Bridge automatisch starten* ein. Die Option wirkt nur, wenn der KI-Modus an ist, und nur in der Desktop-App. Standardmäßig ist sie aus, weil das Öffnen eines Ports eine bewusste Entscheidung ist.

Wenn Sie den KI-Modus ausschalten, stoppt die Bridge, und die Registerkarte *KI* verschwindet.

### 2. Bridge starten

1. Gehen Sie zur Registerkarte *KI* und klicken Sie unter *Server* auf *Bridge starten*.
2. Sehen Sie sich den Status neben der Schaltfläche an. Dort steht *Aus*, *Aktiv auf Port 3877*, *Port 3877 belegt* oder *Fehler*. Wenn der Start gelingt, steht dort *Aktiv auf Port 3877* und die Schaltfläche heißt *Bridge stoppen*. Bei *Port 3877 belegt* oder *Fehler* bleibt die Schaltfläche *Bridge starten*; siehe unter Fallstricke.

Die Bridge nimmt nur auf Ihrem eigenen Computer Verbindungen an, und zwar auf einem einzigen Port. Standardmäßig ist das 3877. In der Gruppe *Verbindung* können Sie unter *Port* einen anderen wählen, aber nur, solange die Bridge gestoppt ist.

### 3. Den KI-Assistenten verbinden

1. Klicken Sie unter *Verbindung* auf *Verbinden*. Das Fenster *Verbindungsdaten* öffnet sich.
2. Wählen Sie, was Ihr Client benötigt, siehe unten.
3. Das Token ist verborgen. Mit dem Augensymbol zeigen Sie es an. Die Kopierschaltflächen kopieren immer den echten Wert, auch wenn der Bildschirm das Token verbirgt.
4. Lassen Sie den Assistenten die Liste der Werkzeuge anfordern. Diese Prüfung steht auch im Verbindungs-Prompt: Der Assistent soll die Werkzeuge mit dem Präfix `planner_` sehen. Die erwartete Anzahl steht im Verbindungs-Prompt.

Das Fenster bietet drei Wege zur Verbindung:

- *Konfigurationsausschnitt*: ein Stück Konfiguration, das Sie in die MCP-Einstellungen Ihres Clients einfügen.
- *Verbindungs-Prompt*: ein Text, den Sie in Ihren KI-Assistenten einfügen. Danach verbindet sich der Assistent selbst.
- *Endpunkt* und *Authentifizierung*: die einzelnen Angaben. Der Endpunkt ist `http://localhost:3877/mcp` mit dem Transport *streamable HTTP*. Jede Anfrage braucht einen Header `Authorization: Bearer`, gefolgt von Ihrem Token. Ihr Client muss außerdem MCP-Sitzungen unterstützen: Beim Verbinden gibt die Bridge einen Sitzungscode im Header `Mcp-Session-Id` aus, und sie lehnt jede spätere Anfrage ohne diesen Code ab. Claude Code und `mcp-remote` erledigen das selbst.

**Verbinden Sie sich nach einem Update der App erneut.** Wenn Ihr KI-Client schon mit einer älteren Version der App verbunden war, sendet er noch keinen Sitzungscode, und die Bridge lehnt jede Anfrage ab. Verbinden Sie sich deshalb nach dem Update erneut: Starten Sie eine neue Sitzung in Claude Code, und beenden Sie Claude Desktop vollständig und starten Sie es neu.

**Claude Code.** Der Konfigurationsausschnitt passt direkt zu Claude Code. Geben Sie diesen Befehl in einem Terminal ein, mit Ihrem eigenen Token statt `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Sie können den Ausschnitt auch in die Datei `.mcp.json` in Ihrem Projektordner legen. Legen Sie diese Datei dann nicht in Git ab, denn das Token gewährt Zugriff auf Ihren Plan. Ein Server aus `.mcp.json` muss in Claude Code beim ersten Mal bestätigt werden.

**Claude Desktop.** Der Konfigurationsausschnitt passt nicht direkt zu Claude Desktop. In der Datei `claude_desktop_config.json` nennen Sie ein Programm, das Claude Desktop selbst startet, keine Adresse. Verwenden Sie deshalb das externe Werkzeug `mcp-remote` dazwischen; es braucht Node.js. Wählen Sie in Claude Desktop *Einstellungen › Entwickler › Konfiguration bearbeiten*, fügen Sie dies in die Datei ein (mit Ihrem eigenen Token) und starten Sie Claude Desktop erneut:

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

Das Token steht absichtlich in `env` und nicht in `args`: Unter Windows zerbricht Claude Desktop ein Argument, das ein Leerzeichen enthält. Ein *benutzerdefinierter Connector* in Claude (*Anpassen › Connectors*) funktioniert nicht mit der Bridge. Claude verbindet sich dann aus der Anthropic-Cloud, und die kann die Bridge auf Ihrem eigenen Computer nicht erreichen.

In der Gruppe *Verbindung* steht außerdem das Feld *Token*. Das ist ein langer, zufälliger Code, den die App für Sie erzeugt und auf diesem Computer speichert. Im Fenster steht *Dieses Token gewährt Zugriff auf den geöffneten Plan. Geben Sie es nicht weiter.* Mit dem Symbol *Neuer Token* erstellen Sie ein neues Token. Die App fragt zuerst *Ein neuer Token trennt alle bestehenden Verbindungen. Fortfahren?* Wenn die Bridge läuft, startet sie mit dem neuen Token neu, und das alte Token funktioniert nicht mehr.

### 4. Die Aktivität der KI einsehen

1. Klicken Sie unter *Aktivität* auf *Aktivitätsbereich*. In der Seitenleiste öffnet sich der Bereich *KI-Aktivität*.
2. Jeder Aufruf der Bridge steht in einer Zeile, die neueste oben: Zeit, was passiert ist, wie lange es gedauert hat und ob es gelungen ist oder nicht. Klicken Sie auf eine Zeile, um *Argumente* und *Antwort* aufzuklappen.
3. Mit *Leeren* entfernen Sie alle Einträge aus der Liste. Der Bereich behält die letzten 500 Aufrufe. Solange noch nichts passiert ist, steht dort *Noch keine KI-Aktivität. Aufrufe der Bridge erscheinen hier.*

Wenn der KI-Modus an ist, steht unten rechts in der Statusleiste ein Punkt mit *KI*. Seine Farbe zeigt den Status der Bridge. Ein Klick darauf bringt Sie zur Registerkarte *KI*.

### 5. Grenzen setzen

Unter *Sicherheit* finden Sie die Schaltflächen, mit denen Sie die KI begrenzen:

- *Pausieren*: Die KI darf vorübergehend nichts ändern, Lesen bleibt erlaubt. Die Bridge bleibt aktiv. Die Schaltfläche wird zu *Fortsetzen*.
- *Schreibgeschützt*: Alle Werkzeuge, die etwas ändern, werden abgelehnt, solange diese Option an ist.
- *Auto-Backup: an*: Bevor die KI in einem Dokument zum ersten Mal etwas ändert, schreibt die App ein IFC-Backup. Das ist standardmäßig an. Mit dieser Schaltfläche schalten Sie es aus; dann steht dort *Auto-Backup: aus*. Das geschieht einmal pro Dokument, jedes Mal wenn Sie die Bridge starten.
- *Jetzt sichern*: Die App erstellt sofort ein Backup des aktiven Dokuments. Danach steht dort *Backup erstellt:* mit dem Dateinamen.
- *Backup-Ordner öffnen*: Öffnet den Ordner mit den Backups.

Die Backups liegen im Ordner `ai-backups` im Datenordner der App. Die App behält die letzten Backups und reduziert die älteren. Genau wie das funktioniert, steht in [KI-Werkzeuge](docs://ref-ai-tools).

### 6. Den KI-Assistenten gut planen lassen

Ein Assistent plant nur gut, wenn er die Planungsregeln kennt. Warum das wichtig ist und was darin steht, lesen Sie in [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling). Das machen Sie selbst:

1. **Für die Kernregeln müssen Sie nichts tun.** Die Kernregeln werden beim Verbinden automatisch mitgesendet. Ob Ihr Client sie in seinen System-Prompt aufnimmt, hängt vom Client ab.
2. **Lassen Sie den Leitfaden lesen.** Der Verbindungs-Prompt im Fenster *Verbindungsdaten* bittet den Assistenten, zuerst den Planungsleitfaden zu lesen, mit dem Werkzeug `planner_get_planning_guide`. Wenn Sie den Prompt nicht verwenden, bitten Sie den Assistenten selbst: *Lesen Sie zuerst den Planungsleitfaden mit planner_get_planning_guide, bevor Sie etwas ändern.* Sie können den Leitfaden selbst lesen unter `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Optional: die Skills installieren.** Das funktioniert nur mit einem Assistenten, der Skills unterstützt. Legen Sie die `SKILL.md` von *goed-plannen* und *progress-update* ab, und zwar als `.claude/skills/goed-plannen/SKILL.md` und `.claude/skills/progress-update/SKILL.md` im Projektordner, in dem der Assistent arbeitet. Oder legen Sie sie unter `~/.claude/skills/` ab, dann gelten sie für jedes Projekt.

Sie erhalten die Dateien auf zwei Wegen. Bitten Sie den Assistenten, das Werkzeug `planner_get_planning_guide` aufzurufen, mit `part` auf `skill` gesetzt: Die Antwort enthält beide Texte und, für jeden Skill, die Orte, an die er gehört. Oder laden Sie sie herunter von `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` und `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Wenn *goed-plannen* aus einer älteren Version der App noch da ist, ersetzen Sie es: Dieser alte Text ist auf Niederländisch und verweist auf den Hilfeartikel statt auf den Leitfaden für Assistenten.

Ob der Assistent den Leitfaden wirklich gelesen hat, sehen Sie im *Aktivitätsbereich*: Dort steht dann ein Aufruf von `planner_get_planning_guide`. Die letzte Antwort sollte eine Liste mit Annahmen enthalten: geschätzte Dauern, die gewählte Gliederung, Beziehungen, die der Assistent selbst angelegt hat, und jede Einschränkung, die er gesetzt hat. Fehlt diese Liste, bitten Sie darum. Nach einer Fortschrittsaktualisierung mit *progress-update* sollte die Antwort das Statusdatum, das neue Ende und die Abweichung gegenüber der Baseline nennen.

## Fallstricke und was die App dann tut

**Die KI ändert etwas, das Sie zurücknehmen möchten.** Jede Änderung durch die KI ist ein Schritt, den Sie mit *Rückgängig* (Strg+Z) zurücknehmen. Eine Reihe von Änderungen, die die KI als Ganzes übergibt, ist ein einziger Schritt. Danach wird das Projekt als ungespeichert angezeigt. Nach einer Änderung wird der Terminplan neu berechnet, daher müssen Sie selbst nicht F5 drücken.

**Die App lehnt einen Aufruf der KI ab.** Bei *Pausieren* und *Schreibgeschützt* lehnt die App alle Änderungen ab. Lesen bleibt möglich, auch das Neuberechnen eines veralteten Terminplans. Wenn Sie selbst gerade eine Bearbeitung machen, etwa einen Balken ziehen oder in ein Feld tippen, bekommt die KI die Termine von vor Ihrer Bearbeitung zurück, mit einem Hinweis, dass sie veraltet sind. Wenn ein Dialog offen ist, zum Beispiel die Einstellungen, ein Vorgangsdialog oder das Willkommensfenster, oder wenn der Präsentationsmodus an ist, lehnt die App alle Aufrufe ab, auch das Lesen, bis Sie den Dialog schließen. Die KI bekommt dann eine Fehlermeldung mit dem internen Namen dessen, was offen ist, zum Beispiel `showTaskDialog`. Nur `planner_get_planning_guide` funktioniert weiter, weil es Ihren Terminplan nicht liest.

**Sie wechseln die Registerkarte, während die KI arbeitet.** Die KI arbeitet an dem Dokument, in dem ihre erste Änderung landete. Wechseln Sie in der Zwischenzeit die Registerkarte, lehnt die App die nächste Änderung der KI ab, bis die KI bestätigt, dass sie an der anderen Registerkarte arbeiten will. So landet nichts im falschen Projekt.

**Die KI schreibt oder öffnet eine Datei.** Die KI kann einen Terminplan als IFC-Datei schreiben und eine Terminplan-Datei als neue Registerkarte öffnen. Das kann sie nur innerhalb Ihres Benutzerordners. Eine bestehende Datei überschreibt sie nur, wenn sie ausdrücklich darum bittet.

**Der Status ist *Port 3877 belegt*.** Ein anderes Programm nutzt den Port. Die Meldung der App steht darunter. Das Feld *Port* bleibt dann gesperrt (*Nur bearbeitbar, solange der Server gestoppt ist.*), obwohl die Bridge nicht läuft, und es gibt keine Stopp-Schaltfläche. Das ist ein bekannter Mangel. Bis das behoben ist: Schalten Sie *KI-Modus aktivieren* aus und wieder ein. Der Status steht dann wieder auf *Aus*, und Sie können einen anderen Port wählen. Kopieren Sie danach die Verbindungsdaten erneut, weil der Endpunkt den Port enthält.

**Der Client kann sich nach einem neuen Token nicht verbinden.** Ein neues Token trennt alle bestehenden Verbindungen. Geben Sie dem Client das neue Token, oder fügen Sie den Konfigurationsausschnitt erneut ein.

**Sie haben die Bridge selbst gestoppt, und sie startet nicht von selbst.** *Bridge automatisch starten* wirkt einmal bei jedem Start der App. Wenn Sie die Bridge selbst stoppen, schaltet die App sie nicht stillschweigend wieder ein.

**Die Registerkarte *KI* ist verschwunden.** Der KI-Modus ist aus. Schalten Sie ihn in Schritt 1 ein.

**Eine Webseite in Ihrem Browser kann nicht mit der Bridge sprechen.** Die Bridge lehnt jede Anfrage ab, die aus einem Browser kommt, und jede Anfrage ohne das richtige Token.

## Siehe auch

- [Rückmeldung geben](docs://howto-feedback-geven): Wenn die Verbindung anders funktioniert als hier beschrieben, melden Sie es.
- [Wie die KI-Verbindung funktioniert](docs://uitleg-ai-koppeling): was die Verbindung ist, warum der Assistent in Ihrem geöffneten Projekt arbeitet und was er nicht darf.
- [KI-Werkzeuge](docs://ref-ai-tools): alle `planner_*`-Werkzeuge nach Gruppe, die Fehlercodes und wie lange Backups aufbewahrt werden.
- [Gut planen](docs://gids-goed-plannen): die Planungsgrundsätze; der Assistent erhält sie in einer englischen Fassung mit den ergänzten Werkzeugen.
- [Einstellungen](docs://ref-instellingen): die KI-Einstellungen.
