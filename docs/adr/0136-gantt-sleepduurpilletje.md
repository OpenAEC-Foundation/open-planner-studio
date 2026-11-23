# Het duurpilletje tijdens het rekken van een balk

Tijdens het rekken van een balkrand toont de Gantt de nieuwe duur in een pilletje tegen die rand (issue #51). De
renderer tekent het zelf (`drawDragDurationBadge`) en niet als DOM-laag erboven. De x van een balkrand komt uit
`barGeometry` op de gedeelde, mogelijk gecomprimeerde as; daarbuiten zou die geometrie een tweede keer moeten
bestaan. In de renderer verschijnt het pilletje in dezelfde paint als de balk, en de tekenvolgorde (na de balken,
voor de kop) knipt het vanzelf tegen de tijdschaalkop.

## Gevolgen

- `GanttCanvas` geeft `durationDrag` alleen door bij een randsleep. Bij verplaatsen verandert de duur niet, en een
  meelopend cijfer zou suggereren dat het gebaar hem verandert.
- Plaatsing: bij de rechterrand in de balk, en erbuiten als het daar niet past; bij de linkerrand buiten de balk,
  want daarbinnen staat de naam, en erin als links geen ruimte is. Daarna geklemd op het canvas; is het canvas
  smaller dan het pilletje, dan wint de linkerkant.
- Het pilletje heeft de accentkleur (`--theme-accent` met `--theme-accent-on`) en een rand in de paneelkleur. Die
  rand is nodig: de gesleepte balk is geselecteerd en draagt een selectiering in dezelfde accentkleur
  (`check-drag-duration-badge`). Op een near-critical balk tekent het vlak zich slecht af (knownbug 1974).
- Heeft start of einde een tijd, dan komt de tekst uit de minuten van de taak, met 24 uur per dag in kalendertijd.
  Ontbreken de minuten, dan rekent hij ze uit de dagen en rondt af op hele minuten: een uursleep slaat dagen op zes
  decimalen op, en anders stond er "46h 59.9995m". Zonder tijd is het de tekst van de duurkolom.
