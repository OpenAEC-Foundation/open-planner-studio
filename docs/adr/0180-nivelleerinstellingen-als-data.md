# Nivelleerinstellingen uit P6 zijn data zonder aan/uit-veld

`SchedulingOptions.leveling` (`LevelingSettings` in `src/types/project.ts`) draagt de keuzes uit de P6-dialoog
*Level Resources* van een bronbestand: *Preserve scheduled early and late dates*, *Level all resources*, de
prioriteitslijst en de lijst gekozen resources. Het blok zegt niet of P6 genivelleerd heeft: P6 slaat dat niet op.
Er is bewust geen veld `enabled`. Of nivelleren een projectoptie of een eigen knop wordt, ligt nog open
(eigenaarsbeslissing 1, zie de regel `rekenprofielen`), en een vroeg verplicht aan/uit-veld zou in elk opgeslagen
IFC-bestand blijven staan. De XER-lezer en de P6 XML-lezer vullen het blok (`levelingValue` in
`src/services/xer/xerScheduleOptions.ts`; de P6 XML-lezer gaat via `deriveXerScheduleOptions`), IFC bewaart het in
`OPS_SchedulingOptions`. De nivelleerder rekent er niet mee.

## Gevolgen

- Een prioriteitssleutel bewaart de kolomnaam uit het bestand letterlijk (bijvoorbeeld `priority_type`), zonder
  interpretatie. Wat een naam betekent, beslist alleen `levelingPriorityQuantity` in
  `src/services/leveling/levelingInput.ts`, als eigen berekende of ingevoerde grootheid en nooit als opgeslagen
  P6-uitvoer.
- `priority: []` betekent dat de kolom `LevelPriorityList` in de bron staat maar leeg is; P6 sorteert dan op
  Activity ID. Ontbreekt de kolom, dan ontbreekt `priority`. `levelPriorityValue` laat een sleutel in een
  onbekende vorm weg en meldt dat.
- `resources` staat er alleen als RSRCLEVELLIST voor de SCHEDOPTIONS-rij van het project rijen heeft. Een rij
  zonder bijbehorende RSRC-rij laat `levelingValue` weg met een melding.
- `maxUnitsPerHour` (P6 *Max Units/Time*, `RSRCRATE.max_qty_per_hr`, eenheden per uur) staat er alleen als alle
  tariefrijen van die resource dezelfde niet-negatieve waarde dragen. Wisselt de waarde in de tijd, dan blijft het
  veld weg; de tijdsafhankelijke capaciteit staat in `Resource.availabilitySteps`.
- Een resource-id in de lijst is een id van dit document. Na het lezen van een IFC-bestand zet
  `remapLevelingResourceIds` (`ifcReader.ts`) het via de GlobalId om, net als de resource van een contour. Een id
  zonder resource blijft in de data staan; `resolveLevelingResources` geeft het apart terug als hangend
  (`check-leveling-input.ts`, deel 1).
- De MSPDI-export meldt het blok als verlies, behalve als het precies de standaard van de P6-dialoog draagt
  (`isP6DialogDefaultLeveling`, `check-leveling-input.ts`, deel 3). Zo'n blok zegt niets wat een ontvanger zonder
  blok niet al aanneemt, en de melding blijft dan een signaal.
