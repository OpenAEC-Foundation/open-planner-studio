# Den Fortschrittsmodus wählen

Ziel: Legen Sie fest, wie die App die Restarbeit eines Vorgangs plant, der schon begonnen hat, während sein Vorgänger noch läuft: nach der Beziehung (Retained Logic) oder nach dem, was tatsächlich geschieht (Progress Override).

## Wann Sie das brauchen

Auf der Baustelle ist man oft weiter, als die Logik vorsieht. Der Maler fängt schon in den Räumen an, die verputzt sind, während der Putzer noch woanders arbeitet. Im Terminplan ist das zum Beispiel eine Ende-Anfang-Beziehung, bei der der Nachfolger beginnt, bevor der Vorgänger fertig ist. Die App nennt das **Fortschritt außer Reihenfolge**. Wenn die Statusleiste *N Beziehung(en) außerhalb der Reihenfolge* zeigt, liegt so ein Fall vor. Dann entscheidet der Fortschrittsmodus, wie die App die Restarbeit des Nachfolgers plant. Was die beiden Modi tun, zeigt ein Rechenbeispiel in [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang).

## Schritte

1. Aktualisieren Sie den Fortschritt und setzen Sie das Statusdatum, wie unter [Fortschritt aktualisieren](docs://howto-voortgang-bijwerken) beschrieben.
2. Gehen Sie zu *Planung › Baselines & Fortschritt › Fortschrittsmodus* und öffnen Sie die Liste.
3. Wählen Sie *Retained Logic* oder *Progress Override*.
4. Drücken Sie **Berechnen** (F5), zum Beispiel über *Planung › Terminplanung › Berechnen*. Diese Auswahl macht den Terminplan veraltet: Die Statusleiste meldet *Veraltet — neu berechnen (F5)*. Wenn *Automatisch berechnen* aktiv ist, macht die App das selbst.

Wie wählen Sie?

- **Retained Logic** ist der Standard. Die Beziehung bleibt gültig: Die Restarbeit des Nachfolgers beginnt erst, wenn der Vorgänger fertig ist. Wählen Sie dies, wenn die Reihenfolge wirklich feststeht oder wenn Sie vorsichtig planen wollen.
- **Progress Override** lässt die Wirklichkeit gewinnen. Die Restarbeit des Nachfolgers beginnt am Statusdatum, ohne auf den Vorgänger zu warten. Wählen Sie dies, wenn der Nachfolger wirklich weiterarbeitet und das Endedatum nicht von einem Vorgänger abhängen soll, der noch läuft.

## Das Ergebnis prüfen

- Klicken Sie in der Statusleiste auf die Meldung *N Beziehung(en) außerhalb der Reihenfolge*. Der Bereich *Warnungen* öffnet sich. Sie finden ihn auch über *Planung › Terminplanung › Warnungen*. Jede Beziehung steht darin mit dem Text *Fortschritt außer Reihenfolge: der Fortschritt des Nachfolgers widerspricht der Beziehung*, zum Beispiel *4.2 Plastering → 4.5 Painting (FS)*.
- Schauen Sie auf den Balken des Nachfolgers. Bei Retained Logic läuft er bis nach dem Ende seines Vorgängers. Bei Progress Override endet er früher. Im Beispiel der Erklärung ist das Dienstag, 27. Juli, gegenüber Donnerstag, 22. Juli.

## Fallstricke und was die App tut

**Kein Unterschied.** Der Modus wirkt nur auf Vorgänge, die schon begonnen haben, während ihr Vorgänger noch nicht fertig ist. Ohne einen solchen Vorgang ändert sich nichts.

**Die Meldung bleibt.** Progress Override löst die Meldung zum Fortschritt außer Reihenfolge nicht. Der Modus legt fest, wie die App rechnet. Der Widerspruch zwischen Beziehung und Fortschritt bleibt bestehen. Wenn die Beziehung nicht mehr stimmt, ändern Sie sie ([Beziehungen anlegen](docs://howto-relaties-leggen)).

**Er gehört zum Projekt.** Die Wahl wird mit der Projektdatei gespeichert, gilt für das ganze Projekt und lässt sich mit Strg+Z rückgängig machen. Ein neues Projekt verwendet Retained Logic.

**Eine P6-Datei.** Wenn Sie eine Primavera-P6-Datei (.xer) öffnen, übernimmt die App den Modus aus der Datei. Neben Retained Logic und Progress Override kennt P6 auch Actual Dates. Die App kennt diesen dritten Modus nicht. So eine Datei wird als Retained Logic berechnet. Die Importmeldung zählt das als *1 P6-Planungseinstellung mit sicherem Rückfall*.

**Das Berechnungsprofil.** Im Profil Primavera P6 wirkt Progress Override auch rückwärts, in den späten Terminen und im freien Puffer des Vorgängers (Konvention *Progress Override ignoriert einen begonnenen Nachfolger auch rückwärts*). Im Profil Open Planner Studio und im Profil Microsoft Project ist das nicht so. Die Konventionen finden Sie unter *Einstellungen › Projekt › Projekteinstellungen*, im Block *Berechnungsprofil und Berechnungsoptionen*. Im Beispiel der Erklärung ist dieser Rückwärtseffekt nicht zu sehen.

## Siehe auch

- [Fortschritt, Statusdatum und Baseline](docs://uitleg-voortgang): der Unterschied zwischen den beiden Modi, mit Zahlen.
- [Fortschritt aktualisieren](docs://howto-voortgang-bijwerken): den Fortschritt eingeben, auf den der Modus wirkt.
- [Beziehungen anlegen](docs://howto-relaties-leggen): eine Beziehung ändern, die nicht mehr stimmt.
