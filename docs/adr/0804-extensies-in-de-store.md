# Extensies in de store

Een lintknop van een extensie komt binnen met het publieke type `ExtRibbonTab` en wordt op de API-grens vertaald
(`extMappers.fromExtRibbonTab`); de store (`extensionSlice.ts`) bewaart het interne `RibbonTab`. Het publieke `relations`
wordt daar bijvoorbeeld het interne `table`; zo loopt het publieke contract niet door tot in de renderlaag.

## Gevolgen

- `registerReadyExtension` haalt in dezelfde store-update de quarantainekaart met dezelfde opslagsleutel weg. Ready en
  quarantaine sluiten elkaar uit voor één sleutel: een achtergebleven quarantainekaart zou met haar verwijderactie
  juist het herstelde geldige record wissen, en de UI ziet zo nooit twee kaarten tegelijk.
