# De indeling van het lint per tabblad

Een knop of groep die op meer tabbladen staat, is in `ribbonConfig.tsx` één constante die elk tabblad gebruikt, geen
kopie. Met een tweede lijst lopen de tabbladen bij de volgende knop uit elkaar. Zo delen Start en Tabel `fileGroup`,
`editGroup`, `tasksGroup` en `scheduleGroup`, Planning en Tabel `traceGroup` en `progressGroup`, en staan
`calcButton`, `splitTaskButton`, `relationDropdownItem` en `calendarButton` op meer tabbladen. De Tabel is net zo
goed een takenweergave: bestanden, bewerken, taken en berekenen werken op de store en op `selectedTaskIds`, en die
selectie deelt de Tabel met de Gantt.

## Gevolgen

- Tabel is Start zonder de groep Zoom, plus `traceGroup`, `tableColumnsGroup` en `progressGroup`. Zoomen verandert
  `view.zoom`, de tijdas van de Gantt; in de Tabel doet zo'n knop niets.
- `progressGroup` (Voortgangsblad exporteren, dan Voortgang bijwerken uit een blad) is een eigen groep achteraan op
  Planning en Tabel en zit niet in `scheduleGroup`, want die staat ook op Start. Buiten het lint opent Backstage →
  Importeren dezelfde import. De exportknop schrijft het blad als `.xlsx` (`exportAs('progress-xlsx')`); zijn label
  (`menu:ribbon.progressExport`) noemt bewust geen formaat. Volgens het weggehaalde commentaar wordt een `RibbonButtonSpec` naast een
  component-item in dezelfde groep een kaal icoon; dat is niet nagegaan.
- Het tabblad Rapport heeft geen lintinhoud (`reportTab` is leeg en `Ribbon.tsx` tekent er geen lint): het rapport
  heeft zijn eigen zijbalk (eigenaarsbesluit 7 november 2026, `docs/superpowers/specs/2026-11-07-rapport-tabblad-bevindingen.md`). Ctrl+P
  (`nav.reportTab`) en de knop in Bestand → Afdruk (`PrintSection` in
  `Backstage.tsx`) openen dit tabblad.
- Project verplaatsen staat in de groep Planning naast Bereken: het verschuift de hele planning en is geen
  structuur-, kalender- of baselineactie.
- De splitsknop staat naast het relatiemenu omdat het dezelfde soort schakelaar is: een modus die het slepen vanaf
  een balk overneemt.
- Dissolve (#887) staat in de groep Bewerken naast Verwijderen: dezelfde selectie, maar de keten blijft heel
  (ADR 0155).
- De paneelschakelaars staan op hun eigen tabblad en ook samen onder Beeld → Panelen: Eigenschappen, Resources,
  Resourcedock, Histogram, Waarschuwingspaneel en Verschuivingen. Zo staat het hele aanbod aan panelen bij elkaar
  en is het verschil tussen de twee resourceknoppen zichtbaar (ADR 0483). Waarschuwingspaneel en Verschuivingen
  staan ook in de groep Planning naast Bereken.
- Opslaan als, Recent en Exporteren staan samen in één stapel (`fileStack2`). Als losse items staan ze naast elkaar
  en wordt de groep volgens het weggehaalde commentaar ongeveer twee keer zo breed; dat is niet gemeten.
- Op Beeld staan de baseline- en voortgangslijnen in de groep `overlays` en de balkweergave in de groep `bars`
  direct daarna (#391). `check-ribbon-overlays.ts` toetst dat `bars` direct na `overlays` komt, dat de grote
  gesplitste knop `toggleBaselineOverlay` het enige item buiten een stapel is, dat een stapel hoogstens drie knoppen
  heeft, en welke knoppen samen in een stapel staan.
