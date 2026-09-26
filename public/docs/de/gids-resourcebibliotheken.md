# Ressourcenbibliotheken

Arbeiten Sie an mehreren Projekten mit denselben Kolonnen, denselben Subunternehmern und denselben Kalendern, möchten Sie deren Tarif, Kalender und Typ nicht in jedem Projekt einzeln pflegen — nicht jedes Mal neu eintippen und bei einer Änderung jede Kopie einzeln nachziehen. Dafür gibt es die Ressourcenbibliothek: eine gemeinsame Quelle für Ressourcen und Kalender, die zu Ihrer Organisation gehört, außerhalb einzelner Projekte lebt, und aus der mehrere Projekte schöpfen können. Diese Anleitung erklärt, wie sich die Bibliothek zu einem Projekt verhält, was genau mitreist und was pro Projekt bleibt, und wie Sie zwischen beidem wechseln.

## Was Sie hier lernen

- Den Unterschied zwischen der Bibliothek (gemeinsam, organisationsweit) und dem Projekt (was dieses Projekt tatsächlich einsetzt).
- Ein Projekt mit einer Bibliothek verknüpfen, oder es bewusst eigenständig lassen.
- Die zwei Ansichten im Tab Ressourcen: **Bibliothek** und **Projekt**.
- Die drei Arten von Zeilen, denen Sie in der Projektansicht begegnen: aus der Bibliothek, projekteigen, und verwaist.
- Genau, was eine Bibliotheksressource ins Projekt mitbringt, und was Sie frei pro Projekt festlegen.
- Die drei Aktionen, die Bibliothek und Projekt miteinander verbinden.
- Wie die App Kopien aktualisiert, und was Sie entscheiden dürfen, wenn eine Kopie abweicht.
- Teilen, Backup, und deren Grenzen.

Verfolgen Sie es an [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) und [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): Beim Öffnen wird jedes dieser Showcases automatisch mit derselben gemeinsamen Demo-Ressourcenbibliothek verknüpft, und die Kolonnen **Timmerlieden**, **Installateurs**, **Stukadoors** und **Schilders** tauchen in beiden unter genau demselben Namen wieder auf — der direkte Beweis, dass eine Bibliothek mehrere Projekte speist.

## Bibliothek und Projekt: zwei Welten

Die **Ressourcenbibliothek** ist die gemeinsame Quelle: Sie gehört zu Ihrer Organisation, nicht zu einem einzelnen Projekt, und überlebt jedes einzelne Projekt. Das **Projekt** bestimmt, was dieses konkrete Projekt daraus tatsächlich einsetzt — mit eigener Kapazität, Verfügbarkeit und Kalenderwahl. Ein Projekt ist mit genau einer Bibliothek verknüpft, oder steht vollständig für sich: In letzterem Fall funktioniert alles einfach wie gewohnt, nur ohne gemeinsame Quelle, aus der geschöpft oder in die zurückgeschrieben werden kann.

## Ein Projekt mit einer Bibliothek verknüpfen

Sie wählen die Bibliothek an zwei Stellen, die dasselbe Panel zeigen:

- Der **Projekt-Assistent** ("Neues Projekt"), mit einer Bibliotheksauswahl.
- **Projektinformationen** eines bestehenden Projekts — sowohl der Dialog als auch **Datei → Projektinformationen**.

Dieselbe Auswahl bietet auch **+ Neue Ressourcenbibliothek…**, mit der Sie direkt vor Ort eine anlegen, ohne zuvor zu Datei → Bibliothek zu gehen. **Keine (eigenständiges Projekt)** ist eine ausdrückliche Wahl in derselben Liste — Ihr Projekt zu entkoppeln ist also nie ein zufälliger Nebeneffekt, sondern immer etwas, das Sie bewusst wählen.

## Das Tab Ressourcen: zwei Ansichten

Sobald ein Projekt mit einer Bibliothek verknüpft ist, erhält das Tab Ressourcen rechts oben einen Umschalter mit zwei Ansichten:

- **Bibliothek** — die Quelle selbst verwalten. Alles hier ist direkt bearbeitbar, eine Änderung gilt sofort für **jedes** Projekt, das aus dieser Bibliothek schöpft, und liegt außerhalb von Rückgängig machen (Strg+Z) — es ist keine Projektbearbeitung.
- **Projekt** — was dieses Projekt tatsächlich verwendet: die gewohnte Projekttabelle, mit Markierungen pro Zeile für Herkunft und etwaige Abweichungen.

Arbeiten Sie mit mehreren geöffneten Projekten, die alle aus derselben Bibliothek schöpfen, gibt es noch eine dritte Ansicht: **Auslastung**. Sie zeigt pro Bibliotheksressource, wo sie über *alle* geöffneten Dokumente hinweg gebucht ist, und markiert die Tage, an denen die Summe dieser Buchungen die Firmenkapazität übersteigt — Doppelbelegung zwischen Projekten, die kein einzelnes Projekt allein sehen kann. Lesen Sie die Anleitung [Auslastungsübersicht](docs://gids-bezettingsoverzicht).

## Drei Arten von Zeilen in der Projektansicht

In der Projektansicht begegnen Ihnen drei Arten von Zeilen:

1. **Aus der Bibliothek** — erkennbar an der Markierung **Aus der Bibliothek**. Name, Typ, Tarif/Stunde und Einheit sind von der Bibliothek geerbt und werden hier als reiner Text angezeigt: Sie bearbeiten sie nicht hier, sondern in der Ansicht **Bibliothek**. Max. Einheiten, die zeitlich gestaffelte Verfügbarkeit und die Kalenderwahl sind hingegen ganz normal bearbeitbar — das ist schließlich der Einsatz auf diesem Projekt.
2. **Projekteigen** — keine Markierung, vollständig bearbeitbar. Auch ein verknüpftes Projekt kann solche Zeilen haben: nützlich für einmalige Dinge, die nicht in die gemeinsame Bibliothek gehören, wie ein gemieteter Kran oder ein Subunternehmer für diesen einen Auftrag.
3. **Verwaist** — das Bibliotheksoriginal ist verschwunden; die Zeile trägt die Markierung **nicht mehr in der Bibliothek**. Die Kopie selbst bleibt gewöhnlich nutzbar — Sie können sie lösen oder löschen.

## Was mit der Bibliothek mitreist — und was nicht

Das ist der Kern, den Sie sich merken sollten: Manche Felder sind eine unternehmensweite Vereinbarung und folgen der Bibliothek, andere sind der Einsatz dieses Projekts und legen Sie frei fest, ohne dass das je als Abweichung zählt.

**Folgt der Bibliothek:**
- Name
- Typ
- Beschreibung
- Tarif/Stunde
- Einheit
- Der **Inhalt** eines mitgereisten Kalenders (Arbeitstage, Stunden, Feiertage)

**Legen Sie pro Projekt fest, ohne dass es als Abweichung zählt:**
- Max. Einheiten
- Die zeitlich gestaffelte Verfügbarkeit
- Die **Wahl**, welcher Kalender an der Ressource hängt

Weisen Sie eine Bibliotheksressource zu, reist ihr Kalender als verknüpfte Kopie mit, die selbst ebenfalls der Bibliothek folgt — deshalb steht der *Inhalt* dieses Kalenders oben unter **Folgt der Bibliothek**. Die *Wahl*, welcher Kalender an einer Ressource hängt, steht dagegen unter **Legen Sie pro Projekt fest**: Dieselbe Kolonne kann bei einem Eilauftrag ohne Weiteres auf einem anderen Kalender laufen als sonst, ohne dass das eine Abweichung von der Bibliothek ist. Dieser Unterschied ist subtil, aber wichtig: Ändern Sie bei einer Bibliotheksressource den Tarif oder den Namen, weicht die Kopie von der Bibliothek ab; ändern Sie die Kalenderwahl oder die Max. Einheiten, tun Sie genau das, wofür dieses Feld da ist.

## Drei Aktionen, die die beiden Welten verbinden

- **Dem Projekt zuweisen** — von der Bibliothek zum Projekt: erstellt eine bearbeitbare Kopie mit Herkunftsangabe.
- **Zur Bibliothek** — von einer projekteigenen Zeile in die gemeinsame Bibliothek: verknüpft sofort. Existiert bereits ein Element mit demselben Namen in der Bibliothek, verknüpft die App damit, statt zu duplizieren.
- **Von der Bibliothek lösen** — die Herkunft verschwindet, alles wird wieder vollständig bearbeitbar. Ein mitgereister Kalender löst sich mit, sofern nicht eine andere, noch verknüpfte Ressource denselben Kalender verwendet.

## Aktualisieren und Abweichungen

Die App prüft an vier festen Momenten, ob Ihre Kopien noch zur Bibliothek passen: beim **Öffnen** einer Datei, beim **Wechseln** des Dokuments, nach einer **Bearbeitung in der Bibliothek**, und nach einer **Wiederherstellung nach einem Absturz**.

- Ist eine Kopie einfach im Rückstand (Sie haben sie selbst nicht geändert, aber die Bibliothek hat sich inzwischen weiterentwickelt), wird sie **stillschweigend aktualisiert** — Sie sehen nur einen kurzen Hinweis, keine Nachfrage.
- Wurde eine Kopie lokal (oder von jemand anderem) geändert, erscheint die Markierung **weicht ab — entscheiden**, und die App fragt pro Element, was geschehen soll: **Bibliothekswerte verwenden**, **Dateiwerte in die Bibliothek übernehmen**, oder **Später entscheiden**.

Diese Entscheidungen lassen sich nicht mit Strg+Z rückgängig machen — die zweite Option ändert nämlich die Bibliothek selbst, und die liegt vollständig außerhalb der Projekthistorie.

## Teilen und Backup

Eine Projektdatei ist immer eigenständig vollständig: Geben Sie sie jemandem ohne Ihre Bibliothek, funktioniert trotzdem alles, nur ohne gemeinsame Quelle. Eine Bibliothek exportieren und importieren Sie über **Datei → Bibliothek** — das ist zugleich Ihr Backup.

Beim Importieren wählen Sie zwischen zwei Optionen:

- **Als neue Ressourcenbibliothek hinzufügen** — die Bibliothek aus der Datei kommt einfach dazu, als zusätzliche Bibliothek neben Ihren bestehenden, und überschreibt nie etwas von Ihnen. Hatte der Absender selbst bereits einmal eine zweite, eigene Bibliothek abgespalten (etwa für einen separaten Subunternehmer), trägt diese Bibliothek eine eigene Identität mit sich: Ein mitgesendetes Projekt erkennt die Kolonnen und Kalender, die es bereits verwendete, dann sofort wieder als Bibliothekselemente, ohne dass Sie etwas nachvollziehen müssen. Hatte der Absender nur eine einzige, nie abgespaltene Bibliothek — der Normalfall bei den meisten Anwendern —, greift diese automatische Erkennung nicht von selbst: Sie verknüpfen das mitgesendete Projekt in diesem Fall selbst einmalig mit der neuen Bibliothek, wonach die Erkennung anhand des Namens die weitere Arbeit übernimmt. Besitzen Sie dieselbe Bibliothek bereits, kommt stattdessen einfach eine separate Kopie daneben zu stehen.
- **Eine bestehende Ressourcenbibliothek ersetzen** — der gesamte Inhalt der von Ihnen gewählten Bibliothek wird durch das ersetzt, was in der Datei steht. Ist Ihre eigene Version neuer als die, die Sie importieren, warnt die App Sie vorher davor.

Welche Option bereits ausgewählt ist, hängt von der Datei ab: Erkennt die App die Bibliothek noch nicht, ist "Als neue Ressourcenbibliothek hinzufügen" ausgewählt; erkennt sie sie (dieselbe Bibliothek, eine andere Version), ist "Eine bestehende Ressourcenbibliothek ersetzen" ausgewählt, mit dieser Bibliothek bereits vorausgewählt.

Bibliotheken synchronisieren nicht von selbst zwischen Geräten: Arbeiten zwei Planer mit derselben Bibliothek auf unterschiedlichen Rechnern, können die Bibliotheken auseinanderlaufen.

## Demo-Ressourcenbibliothek in den Beispielen

Öffnen Sie eines der Showcase-Beispiele (**Datei → Beispiele**, oder über diesen Hilfebereich), legt die App einmalig eine **Demo-Ressourcenbibliothek** an und verknüpft das geöffnete Beispiel damit. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) und [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) teilen sich dieselben Kolonnen aus dieser Bibliothek, sodass Sie sofort sehen, wie eine Bibliothek mehrere Projekte speist. Ihre eigenen, bestehenden Ressourcenbibliotheken bleiben davon vollkommen unberührt.

## Weiterlesen

- Ressourcen zuweisen, das Histogramm lesen und Abgleichen drehen sich alle um die Projektseite von Ressourcen — lesen Sie die Anleitung [Ressourcen, Histogramm & Abgleich](docs://gids-resources-histogram).
- Der mit einer Ressource verknüpfte Kalender nutzt dieselben Bausteine wie jeder andere Kalender — lesen Sie die Anleitung [Kalender & Stundenplanung](docs://gids-kalenders-uren).
- Sehen Sie das Teilen von Kolonnen zwischen Projekten selbst in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) und [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
