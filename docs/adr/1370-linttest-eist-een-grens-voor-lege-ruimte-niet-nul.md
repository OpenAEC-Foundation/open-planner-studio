# Linttest: een grens voor de lege ruimte rechts, geen nul

`tests/browser/ribbon-status-date-time.spec.ts` maakt het venster smal (1000, 900 en 760 px) en eist dat de lege
ruimte rechts van de laatste lintgroep kleiner is dan 120 px, niet dat ze nul is. Dat komt door de automaat zelf:
`findFitPlan` (`Ribbon.tsx`) kiest eerst hoeveel veldengroepen moeten inklappen en zoekt binnen die stand met
`smallestFitting` het kleinste aantal miniknoppen waarbij het lint past; om een groep open te houden kan het dus
meer knoppen mini maken. Is in de gekozen groepsstand minstens één knop mini, dan past het lint met één miniknop
minder niet meer. Er blijft dan een rest over die kleiner is dan wat één knop terug op volle grootte kost, en die
rest hangt af van de knoppen op die tab. Een eis van nul ruimte zou rood worden zonder
dat er iets mis is. De test vangt met de grens wel het gat dat ontstaat als de ruimte van een ingeklapte
veldengroep niet terug gaat naar labels (de regel in `.claude/rules/ui-shell.md`).

## Gevolgen

- Maak de grens niet krapper zonder eerst te meten wat één stap van de automaat op het tabblad Planning kost.
