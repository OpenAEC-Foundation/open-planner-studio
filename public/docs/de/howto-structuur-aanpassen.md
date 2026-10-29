# Struktur anpassen

Ziel: Vorgänge in Phasen und Teilvorgänge ordnen, ihre Reihenfolge ändern und die PSP-Nummern korrekt halten.

## Wann Sie das brauchen

Ihr Terminplan ist eine Baumstruktur: Phasen (Sammelvorgänge) mit Teilvorgängen darunter, zum Beispiel *Foundation* mit *Groundwork*, *Reinforcement* und *Pouring*. Sie passen diese Baumstruktur an, wenn Sie Vorgänge unter eine Phase hängen wollen, einen Vorgang aus einer Phase herausnehmen oder wenn die Reihenfolge falsch ist. Der **PSP-Code** (1, 1.1, 1.2, 2, …) ist die Nummer eines Vorgangs in dieser Baumstruktur.

## Schritte

### Einen Vorgang tiefer stufen

1. Wählen Sie den Vorgang aus. Sie können auch mehrere Vorgänge auswählen.
2. Wählen Sie *Planung › Struktur › Tiefer stufen*. Sie können auch Alt+→ (oder Alt+Umschalt+→) verwenden oder *Einrücken* im Kontextmenü (rechte Maustaste).

Der Vorgang wird der letzte Teilvorgang des vorherigen Vorgangs auf derselben Ebene. Der vorherige Vorgang wird dadurch zum Sammelvorgang. Wenn Sie einen zusammenhängenden Block auswählen, wird der Block als Ganzes tiefer gestuft. Gibt es vor dem Vorgang keinen Vorgang auf derselben Ebene, geschieht nichts. Es erscheint keine Meldung.

### Einen Vorgang ausrücken

Wählen Sie *Planung › Struktur › Höher stufen*, drücken Sie Alt+← (oder Alt+Umschalt+←) oder wählen Sie *Ausrücken* im Kontextmenü (rechte Maustaste).

Der Vorgang wird zum Vorgang auf derselben Ebene, direkt nach der Phase, unter der er hing. Seine eigenen Teilvorgänge gehen mit ihm. Die Vorgänge, die danach in dieser Phase folgten, bleiben in ihr. Ein Vorgang auf der obersten Ebene lässt sich nicht weiter ausrücken.

### Einen Vorgang verschieben

Sie haben drei Möglichkeiten.

- **Mit der Tastatur.** Alt+↑ und Alt+↓ tauschen den Vorgang mit seinem Nachbarn auf derselben Ebene. Ein Sammelvorgang nimmt seine Teilvorgänge mit. Am Anfang oder Ende der Ebene geschieht nichts. Bei mehreren ausgewählten Vorgängen verschiebt sich nur der Vorgang, den Sie zuerst angeklickt haben.
- **Ziehen in der Vorgangstabelle.** Halten Sie die Maustaste auf einer Zeile gedrückt und ziehen Sie senkrecht. Das obere Viertel einer Zeile bedeutet *vor*, das untere Viertel *nach*. Die Mitte eines Sammelvorgangs hängt den Vorgang als letzten Teilvorgang darunter. Die Mitte eines normalen Vorgangs gilt als die nächstgelegene Kante. Ziehen Sie eine Zeile, die zu einer Mehrfachauswahl gehört, dann verschiebt sich die ganze Auswahl.
- **Ziehen im Gantt-Diagramm.** Ziehen Sie den Balken senkrecht auf eine andere Zeile. Das wirkt wie Ziehen in der Vorgangstabelle und ändert keine Termine. Ziehen Sie waagerecht, dann verschieben Sie stattdessen die Termine.

Jede Verschiebung zählt als ein Schritt für *Rückgängig* (Strg+Z).

### Die PSP-Nummern aktuell halten

Schauen Sie auf die Schaltfläche *PSP auto* in *Planung › Struktur*.

- **Ein (der Standard in einem neuen Projekt).** Auch nach dem Öffnen einer Datei ohne diese Einstellung ist sie *an*, wenn alle PSP-Codes schon zur Nummerierung des Baums passen (1, 1.1, 1.2 …). Die Codes ändern sich nicht. Auch eine leere Datei ohne diese Einstellung erhält *an*, genau wie ein neues Projekt. Die App nummeriert den ganzen Baum bei jedem Hinzufügen, Löschen und Verschieben neu. Der PSP-Code ist dann schreibgeschützt: Sie können ihn nicht in der Vorgangstabelle oder im Bereich *Eigenschaften* eintippen. *PSP neu nummerieren* ist deaktiviert.
- **Aus.** Der Standard in einer Datei mit eigenen Codes, etwa *A1000*, oder mit einem Code, der vom Baum abweicht. Die Codes bleiben gleich, auch nach dem Verschieben und Einrücken. Sie tippen sie selbst ein, in der Spalte *PSP* oder im Feld *PSP-Code* im Bereich *Eigenschaften*. Oder Sie lassen sie einmal mit *PSP neu nummerieren* neu nummerieren. Das überschreibt auch Codes, die Sie selbst eingetippt haben.

Wenn Sie *PSP auto* einschalten, nummeriert die App den Baum sofort. Sowohl *PSP auto* als auch *PSP neu nummerieren* lassen sich mit *Rückgängig* zurücknehmen.

## Stolperfallen und was die App tut

**Filtern, Gruppieren oder Sortieren ist aktiv.** Die Reihenfolge, die Sie sehen, ist dann nicht die Reihenfolge des Terminplans. Deshalb sperrt die App die Struktur. *Einrücken* und *Ausrücken* sind deaktiviert, mit dem Hinweis *Nicht verfügbar während des Filterns/Gruppierens/Sortierens*. Alt+→ und Ziehen zeigen denselben Text in einem roten Streifen mit der Schaltfläche *Leeren*. Damit entfernen Sie Filter, Gruppierung und Sortierung auf einmal. Strg+Z stellt sie nicht wieder her. Der Streifen bleibt, bis Sie auf das Kreuz klicken, Strg+Z oder Strg+Y verwenden oder zu einem anderen Dokument wechseln. *Einrücken* und *Ausrücken* fehlen dann im Kontextmenü.

Alt+↑ und Alt+↓ funktionieren in einer solchen Ansicht trotzdem, ohne Meldung. Bei nur einem Filter sehen Sie die neue Reihenfolge sofort. Bei einer Sortierung ändert sich die Reihenfolge im Terminplan zwar, Sie sehen das aber erst nach *Leeren*.

**PSP auto ist aus.** Das passiert bei einer Datei mit eigenen Codes oder bei einer Datei, die die Einstellung als *aus* speichert. Ein neuer Vorgang erhält den Code, der zu seinem Platz im Baum passt, auch wenn ein anderer Vorgang diesen Code schon hat. So können doppelte Nummern entstehen. Auch nach dem Einrücken passen die Codes nicht mehr zum Baum. *PSP neu nummerieren* behebt beides.

**Ein Meilenstein erhält Teilvorgänge.** Ein Meilenstein ist ein Zeitpunkt und hat keine Teilvorgänge. Die App entfernt die Meilenstein-Markierung und meldet das.

**Ein Vorgang mit Zuweisungen erhält Teilvorgänge.** Ein Sammelvorgang trägt selbst keine Zuweisungen. Die App fragt deshalb zuerst, was damit geschehen soll, im Fenster *Vorgang wird zum Sammelvorgang*. Das passiert, wenn Sie einen Vorgang einrücken, bei einem Vorgang *Teilvorgang hinzufügen* oder *Meilenstein hinzufügen* verwenden, eine Vorlage einfügen oder im Fenster *Vorgang bearbeiten* im Feld *Übergeordneter Vorgang* einen neuen Vorgang wählen: für einen vorhandenen Vorgang und für einen neuen Vorgang. Im Fenster *Vorgang bearbeiten* kommt die Frage vor dem Speichern. Wenn Sie dort *Abbrechen* wählen, bleibt *Vorgang bearbeiten* mit Ihren Änderungen geöffnet. Sie wählen:

- *Abbrechen*: Nichts ändert sich, auch die Struktur bleibt wie sie war.
- *Zuweisung entfernen*: Der Vorgang erhält Teilvorgänge, und seine Zuweisungen werden entfernt. Die Ist-Arbeit dieser Zuweisungen wird ebenfalls entfernt.
- *Verschieben nach „…“*: Die Zuweisungen gehen mit ihrer Ist-Arbeit zum ersten neuen Teilvorgang, der sie tragen kann. Ein Meilenstein oder ein Sammelvorgang trägt keine Zuweisungen.

Wenn dieser Teilvorgang schon dieselbe Ressource hat oder es keinen geeigneten Teilvorgang gibt, ist *Verschieben* deaktiviert. Ein oranger Block im Fenster sagt Ihnen, warum.

Wenn eine Zuweisung schon Ist-Arbeit hat, zeigt der orange Block pro Ressource, wie viele Stunden es sind, zum Beispiel: *Auf der Zuweisung von Metselaar sind bereits 8 Stunden Ist-Arbeit erfasst. Beim Entfernen geht diese Arbeit verloren.* *Abbrechen* ist dann die Standardschaltfläche: Enter ändert nichts. Wenn Sie die Zuweisung trotzdem entfernen wollen, klicken Sie selbst auf *Zuweisung entfernen*.

Solange das Fenster offen ist, funktioniert kein Tastenkürzel außerhalb des Fensters, auch nicht *Rückgängig*, *Einfügen*, Entf, F5 und Strg+S. Wenn eine Aktion auf einmal mehrere Sammelvorgänge erzeugt, zeigt das Fenster die Ressourcen pro Vorgang. Ihre Wahl gilt dann für alle. Mit *Rückgängig* (Strg+Z) machen Sie die ganze Aktion rückgängig.

**Eine Beziehung würde einen Zyklus erzeugen.** Die Beziehungen eines Sammelvorgangs gelten auch für seine Teilvorgänge. Würde eine Verschiebung dadurch einen Zyklus erzeugen, lehnt die App sie ab. Die Meldung lautet *Diese Verschiebung würde einen Zyklus im Terminplan erzeugen (…)*. Nichts ändert sich.

**Eine Beziehung zwischen einem Vorgang und seiner eigenen Phase.** Wenn Sie einen Vorgang unter eine Phase setzen, zu der er schon eine Beziehung hat, bleibt diese Beziehung bestehen. Sie zählt aber nicht mehr in der Berechnung. Die App meldet das. Mehr über Beziehungen bei Sammelvorgängen finden Sie unter [Beziehungen und Zeitabstand](docs://uitleg-relaties).

**Der Terminplan ist veraltet.** Eine Verschiebung in eine andere Phase kann Termine ändern. Drücken Sie **Berechnen** (F5). Nur die Reihenfolge innerhalb derselben Phase zu tauschen, ändert keine Termine.

## Siehe auch

- [Vorgänge und Meilensteine hinzufügen](docs://howto-taken-en-mijlpalen-toevoegen): neue Vorgänge an der richtigen Stelle einfügen.
- [PSP-Vorlagen speichern und einfügen](docs://howto-wbs-sjablonen): eine ganze Phase wiederverwenden.
- [Beziehungen anlegen](docs://howto-relaties-leggen): Vorgänge miteinander verknüpfen.
- [Vorgänge auswählen, löschen und rückgängig machen](docs://howto-taken-selecteren-verwijderen): eine Verschiebung zurücknehmen.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): vier Phasen mit ihren Teilvorgängen, so wie Sie sie durch tiefer stufen aufbauen.
