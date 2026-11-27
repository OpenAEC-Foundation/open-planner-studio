# De indeling van het lint per tabblad

Een knop die op meer tabbladen staat, is in `ribbonConfig.tsx` één constante die elk van die tabbladen gebruikt, geen
kopie: `calcButton`, `splitTaskButton`, `relationDropdownItem`, `calendarButton` en de paneelknoppen
`openResourcePanelButton`, `dockResourcePanelButton`, `toggleHistogramButton`, `warningsPanelButton` en
`scheduleShiftPanelButton`. Met een tweede lijst lopen de tabbladen bij de volgende wijziging
uit elkaar. Hele groepen deelt het lint op dezelfde manier: Start en Tabel delen `fileGroup`, `editGroup`,
`tasksGroup` en `scheduleGroup`, Planning en Tabel delen `traceGroup` en `progressGroup`. De groep Planning op het
tabblad Planning en de twee groepen Kalender (op Planning en op Instellingen) zijn wel eigen lijsten, met de gedeelde
knoppen erin.

## Gevolgen

- Tabel is Start zonder de groep Zoom, plus `traceGroup`, `tableColumnsGroup` en `progressGroup`. Zoomen verandert
  `view.zoom`, de tijdas van de Gantt, en de Tabel heeft geen tijdas. Verwijderen, Dissolve, Taak en het relatiemenu
  werken op `selectedTaskIds`, en die selectie deelt de Tabel met de Gantt. Niet elke gedeelde knop doet op de Tabel hetzelfde als op Start: de
  splitsknop staat er uit (ADR 0484), en onder het volledige resourcepaneel zie je de taken niet (knownbug 2520).
- Kolommen deelt geen constante maar één binding, `useColumnsButtonBinding` in `ribbonWidgets.tsx`, in twee
  knopvormen: de grote knop in `tableColumnsGroup` op Tabel en een kleine knop in `DisplayGroupContent`, de groep
  `display` op Beeld die er alleen met Klassieke weergaveknoppen staat (ADR 0484).
- `progressGroup` (Voortgangsblad exporteren, dan Voortgang bijwerken uit een blad) is een eigen groep achteraan op
  Planning en Tabel en zit niet in `scheduleGroup`, want die staat ook op Start. Buiten het lint opent Backstage →
  Importeren dezelfde import. De exportknop schrijft het blad als `.xlsx` (`exportAs('progress-xlsx')`); zijn label
  (`menu:ribbon.progressExport`) noemt bewust geen formaat.
- Het tabblad Rapport heeft geen lintinhoud (`reportTab` is leeg en `Ribbon.tsx` tekent er geen lint): het rapport
  heeft zijn eigen zijbalk (eigenaarsbesluit 7 november 2026,
  `docs/superpowers/specs/2026-11-07-rapport-tabblad-bevindingen.md`). Ctrl+P (`nav.reportTab`) en de knop in
  Bestand → Afdruk (`PrintSection` in `Backstage.tsx`) openen dit tabblad.
- Project verplaatsen staat in de groep Planning naast Bereken: het verschuift de hele planning en is geen
  structuur-, kalender- of baselineactie.
- De splitsknop staat naast het relatiemenu omdat het dezelfde soort schakelaar is: een modus die het slepen vanaf
  een balk overneemt.
- Dissolve (#887) staat in de groep Bewerken naast Verwijderen: dezelfde selectie, maar de keten blijft heel
  (ADR 0155).
- Beeld → Panelen bundelt de paneelknoppen: Eigenschappen (alleen daar), Resources, Resourcedock en Histogram (ook op
  Resources), en Waarschuwingspaneel en Verschuivingen (ook in de groep Planning naast Bereken). Zo staat het hele
  aanbod aan panelen bij elkaar en is het verschil tussen de twee resourceknoppen zichtbaar (ADR 0483).
- Opslaan als, Recent en Exporteren staan samen in één stapel (`fileStack2`). Als losse items staan ze naast elkaar
  en wordt de groep volgens het weggehaalde commentaar ongeveer twee keer zo breed; dat is niet gemeten.
- Op Beeld staan de baseline- en voortgangslijnen in de groep `overlays` en de balkweergave in de groep `bars`
  direct daarna (#391). `check-ribbon-overlays.ts` toetst in die twee groepen dat `bars` direct na `overlays` komt,
  dat elk item behalve de grote gesplitste knop `toggleBaselineOverlay` een stapel is met hoogstens drie items, dat
  de bekende knoppen in de juiste groep staan, en twee paren: Voortgangslijn en Statusdatumlijn in één stapel in
  die volgorde, Balkkleuren en Resource-accent in één stapel. De verdere verdeling over de stapels ligt niet vast.
