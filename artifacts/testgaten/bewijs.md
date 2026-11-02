# Bewijs voor de aangescherpte tests

Basis: `6386f95e6ca28b47c1ded7c085b74a1e15c2d87b` (`origin/main` bij de start).
Lokaal: Node 22.23.4. Iedere gerichte uitvoering loopt onder `flock /tmp/ops-zwaar.lock`.
De volledige suites en builds worden uitsluitend door CI uitgevoerd.

## 473 — gewone taaklabels op hun eigen rij

Op de basis is tijdelijk alleen de aanroep van `drawOutsideBarName` voor een gewone taak
uit `GanttRenderer.drawTaskBar` verwijderd. De aanroep voor samenvattingen bleef staan.
De oude test bleef groen: 23 controles, exit 0. Met dezelfde ontbrekende aanroep geeft
de aangescherpte test één afwijking, exit 1: de lange naam ontbreekt op de eigen rij.
De renderer is teruggezet met `cp` uit de vooraf gemaakte kopie in `/tmp`.

Commando: `bash tests/planning/run.sh check-gantt-label-ellipsis.ts`.

Na herstel van de renderer: 23 controles groen, exit 0. Geen productwijziging in de diff.
