# Erweiterungsberechtigungen

Alle Berechtigungen, die eine Erweiterung in ihrem Manifest aufführen kann: was sie erlaubt, was passiert, wenn sie fehlt, und was Sie davon sehen, wenn Sie eine Erweiterung installieren. Wie Sie Erweiterungen installieren und verwalten, steht unter [Installieren und Verwalten einer Erweiterung](docs://howto-extensie-installeren).

## Was eine Berechtigung ist und was nicht

Eine Berechtigung ist eine **Angabe des Autors**: welche Teile der Oberfläche der App die Erweiterung nutzen möchte. Sie ist keine Sperre. Der Code einer Erweiterung läuft in derselben Umgebung wie die App selbst. Er kann deshalb mehr tun, als seine Berechtigungen angeben: Es gibt keine Sandbox. Die App sagt das auch im Installationsfenster. Installieren Sie nur Erweiterungen von Autoren, denen Sie vertrauen.

Die App setzt eine Berechtigung auf eine von drei Arten durch. Der Unterschied ist wichtig:

**Hart erzwungen.** Fehlt die Berechtigung, wirft die zugehörige Methode einen Fehler (auf Niederländisch zum Beispiel *Extensie "…" mist permissie: ribbon*), bevor etwas geschieht.

**Warnung.** Fehlt die Berechtigung, funktioniert die Methode trotzdem. Die App schreibt aber eine Warnung ins Protokoll. In einer künftigen Version wird daraus eine Ablehnung.

**Nur informativ.** Zu dieser Berechtigung gehört kein Teil der Oberfläche. Die App zeigt sie beim Installieren an und tut sonst nichts damit.

Keine Berechtigung ist nötig für die Grundlage der Erweiterungsoberfläche: das Lesen des Projekts, des Kalenders, der Vorgänge, der Beziehungen, der Ressourcen und der Zuweisungen; das Hinzufügen von Vorgängen und Beziehungen sowie das Ändern von Vorgängen; ein Projekt laden, neu berechnen und mehrere Änderungen zusammenfassen; das Speichern eigener Einstellungen, das Lesen eigener mitgelieferter Dateien und das Anzeigen einer Benachrichtigung.

**Das Manifest.** Die Berechtigungen stehen als Liste im Manifest. Eine Erweiterung, die Sie jetzt installieren und die eine Berechtigung enthält, die diese App-Version nicht kennt, wird abgelehnt. Bei einer bereits gespeicherten älteren Erweiterung entfernt die App unbekannte Berechtigungen und meldet das im Protokoll.

## Wie die App fragt

Beim Installieren, aus dem Katalog (*Datei › Erweiterungen › Durchsuchen › Installieren*) oder aus einer Datei (*ZIP* oder *JS*), zeigt die App das Fenster *Erweiterung installieren?*. Die Frage erscheint einmal, beim Installieren. Nicht jedes Mal, wenn Sie die Erweiterung einschalten.

Das Fenster zeigt den Namen, die Version, die Beschreibung, den Autor und, falls vorhanden, das Repository. Unter *Herkunft* steht, woher die Erweiterung stammt (*Aus dem Online-Erweiterungskatalog*, *Aus einer ZIP-Datei auf diesem Rechner* oder *Aus einer JavaScript-Datei auf diesem Rechner*). Dort steht auch, ob der Download geprüft wurde: mit der Prüfsumme aus dem Katalog, nicht geprüft, weil der Katalog keine angibt, oder als Datei, die Sie selbst gewählt haben. Unter *Wozu Sie Ja sagen* steht, dass eine Erweiterung Programmcode ist. Dieser Code läuft mit denselben Rechten wie die App. Was das in der Praxis heißt: In der Desktop-App unter anderem Dateien lesen und schreiben, überall in Ihrem Benutzerordner, sowie Zugriff auf Ihre Projekte, Einstellungen und die Zwischenablage. Im Browser Zugriff auf Ihre gespeicherten Projekte und Einstellungen, auf die Dateien, für die Sie Zugriff erlaubt haben, und auf das Netzwerk.

Unter *Was diese Erweiterung zu nutzen angibt* stehen die Berechtigungen aus dem Manifest, als kurze Bezeichnungen mit dem Namen wie unten. Dabei steht: *Das ist die Angabe des Autors, keine Beschränkung — der Code kann ohnehin mehr.* Hat die Erweiterung keine Berechtigungen, steht dort *Nichts angegeben.* Zwei Berechtigungen erhalten eine Erläuterung: *importSource* und *help*. Die anderen sechs erhalten nur ihre Bezeichnung.

Mit *Installieren* stimmen Sie zu. *Nicht installieren*, Esc und ein Klick außerhalb des Fensters lehnen die Installation ab.

## Die Berechtigungen

**ribbon** — eine Schaltfläche im Menüband platzieren. Wirkung: Die Erweiterung darf eine Schaltfläche zu einer Gruppe auf einer Menüband-Registerkarte hinzufügen. Ohne diese Berechtigung erhält eine Erweiterung einen Fehler, wenn sie es versucht. Die Schaltflächen erscheinen am Ende der gewählten Registerkarte, unter einer Gruppenbezeichnung der Erweiterung. Sie verschwinden, wenn Sie die Erweiterung ausschalten oder entfernen. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: hart. Wo: auf der Registerkarte, die die Erweiterung gewählt hat.

**events** — die Ereignisse der App verfolgen und selbst Ereignisse senden. Wirkung: Die Erweiterung darf Ereignisse abonnieren und das Abonnement wieder beenden. Sie darf auch selbst Ereignisse senden. Die App selbst sendet vier: Ein Projekt wird geladen (nach dem Importieren, Öffnen oder Laden durch eine Erweiterung), ein leeres Projekt wird angelegt, der Terminplan wird neu berechnet, und der Benutzer fordert ein Tutorial an. Das letzte Ereignis geht nur an die Tutorial-Erweiterung. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: hart. Wo: nirgends; die Erweiterung reagiert auf das Ereignis.

**backstage** — ein Importformat anbieten. Wirkung: Die Erweiterung darf einen Importer registrieren. Er erscheint unter *Datei › Importieren*. Dort klicken Sie auf ein Format und wählen eine Datei. Die eingebauten Formate sind davon getrennt (siehe [Import- und Exportformate](docs://ref-import-exportformaten)). Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: Warnung. Fehlt die Berechtigung, funktioniert das Registrieren trotzdem, mit einer Warnung im Protokoll. Das ist eine Übergangsregelung, weil bestehende Erweiterungen die Berechtigung nicht immer aufführen. Wo: *Datei › Importieren*.

**pdf-fonts** — eine Schrift für den PDF-Export bereitstellen. Wirkung: Die Erweiterung darf einen Schriftanbieter registrieren. Der PDF-Export nutzt ihn für Zeichen, die die eingebauten Schriften nicht abdecken, zum Beispiel chinesische, japanische und koreanische Zeichen. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: hart. Wo: im PDF eines Berichts. Im Installationsfenster steht nur die Bezeichnung.

**importSource** — die ursprünglichen Bytes einer importierten Datei lesen. Wirkung: Die Erweiterung darf den vollständigen Inhalt der Quelldatei eines importierten Projekts anfordern (derzeit: eine Primavera-Datei). Dazu gehören auch Felder, die die App bewusst nicht in Ihr Projekt übernimmt, zum Beispiel Prüf- und Herkunftsfelder, Kosten sowie Überprüfungs- und Ortsfelder. Das geht weit über den Rest der Oberfläche hinaus. Deshalb ist es eine eigene Berechtigung. Ohne die Berechtigung liest die App kein einziges Byte der Quelldatei. Jede Methode wirft dann einen Fehler, bevor etwas abgerufen wird. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: hart, standardmäßig verweigert. Wo: im Installationsfenster steht dazu eine Erläuterung: *importSource — die vollständigen ursprünglichen Quellbytes jeder importierten Datei (z. B. eine rohe Primavera-Datei), auch Felder, die nie ins Projekt gelangen.*

**help** — Hilfeartikel und Anleitungen hinzufügen. Wirkung: Die Erweiterung darf Hilfeartikel (Tutorials) registrieren und wieder entfernen. Sie darf eine mitgelieferte `.ifc`-Datei als neues Dokument öffnen. Sie darf eine Anleitung starten und beenden, die auf Teile der App zeigt. Ein mitgeliefertes Projekt überschreibt nie das Dokument, in dem Sie arbeiten. Es öffnet sich als neues Dokument, oder es übernimmt nur eine leere, unveränderte Registerkarte. Seit Vertragsversion 1.4.0. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: hart. Wo: im Fenster *Hilfe* (die Artikel), als neue Registerkarte (das Projekt) und als Anleitung, die auf Schaltflächen zeigt. Im Installationsfenster steht dazu eine Erläuterung: *help — darf Hilfeartikel hinzufügen, mitgelieferte Projekte als neues Dokument öffnen und eine Anleitung zeigen, die auf Teile der App verweist.*

**filesystem** — die Erweiterung gibt an, dass sie Dateien nutzt. Wirkung: keine. Kein Teil der Oberfläche hängt daran, und die App kann es nicht durchsetzen. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: nur informativ. Wo: als Bezeichnung im Installationsfenster.

**network** — die Erweiterung gibt an, dass sie das Netzwerk nutzt. Wirkung: keine; wie *filesystem*. Standard: nicht gewährt; nur das, was im Manifest steht. Durchsetzung: nur informativ. Wo: als Bezeichnung im Installationsfenster.

## Siehe auch

- [Import- und Exportformate](docs://ref-import-exportformaten): die Formate, die die App selbst kennt, neben dem, was Erweiterungen unter *Datei › Importieren* hinzufügen.
- [Installieren und Verwalten einer Erweiterung](docs://howto-extensie-installeren): Installieren, Deaktivieren und Entfernen einer Erweiterung.
