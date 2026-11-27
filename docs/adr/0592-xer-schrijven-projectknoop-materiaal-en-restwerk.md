# XER schrijven: de projectknoop, de schaal van materiaal en het restwerk

`writeXER` (`xerWriter.ts`) schrijft zo dat `readXER` na een rondgang dezelfde planning teruggeeft
(`check-xer-writer.ts`: XER → OPS → XER → OPS, byte-gelijke tweede en derde export). Drie keuzes daarvoor zien er
zonder uitleg overbodig of scheef uit. De regels van de schrijver staan verder in de regel `xer`; wat hij met de
P6 XML-schrijver deelt, in ADR 0364 en 0365.

## Gevolgen

- **De projectknoop.** De wortel van de WBS (PROJWBS met `proj_node_flag` Y) draagt de projectnaam. Heeft het
  project precies één wortel, een samenvatting met de projectnaam, dan is die de projectknoop; anders maakt de
  schrijver een nieuwe knoop. Zo komt een ingelezen XER binnen, en zonder deze regel kreeg elke rondgang een laag
  extra.
- **Materiaal per uur, de standaardinzet niet.** OPS kent de capaciteit en de inzet van materiaal per dag, XER per
  uur. De toewijzingen delen daarom door de uren per dag, en de capaciteit in `max_qty_per_hr` krijgt dezelfde schaal
  (anders stond 80 m³ per dag op een capaciteit van 80 m³ per dag in P6 voor 12,5 % bezet). `def_qty_per_hr` blijft
  `maxUnits` zonder schaal, omdat `buildXerResourceCatalog` dat veld zo als `maxUnits` terugleest.
- **Restwerk.** Zonder vastgelegd restwerk schrijft de schrijver de geschreven restduur maal de resterende inzet, zoals
  de werkregelbrug rekent (`remainingWorkOf`), en niet begroot min verricht: zonder vastgelegd verricht werk is dat de
  hele begroting. Verricht werk zonder vastgelegd veld is begroot min rest.
- Een relatie die een samenvattingstaak raakt, gaat als de bladrelaties die de solver er zelf van maakt
  (`expandSummaryRelations`); dat P6 geen relatie met een WBS-element kent, komt uit het weggehaalde commentaar en is
  niet nagegaan.
