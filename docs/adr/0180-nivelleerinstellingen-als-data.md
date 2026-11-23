# Nivelleerinstellingen uit P6 zijn data zonder aan/uit-veld

`SchedulingOptions.leveling` (`LevelingSettings` in `src/types/project.ts`) draagt de keuzes uit de P6-dialoog
*Level Resources* van een bronbestand: *Preserve scheduled early and late dates*, *Level all resources*, de
prioriteitslijst en de lijst gekozen resources. Het blok zegt niet of P6 genivelleerd heeft: P6 slaat dat niet op.
Er is bewust geen veld `enabled`. Of nivelleren een projectoptie of een eigen knop wordt, ligt nog open
(eigenaarsbeslissing 1, zie de regel `rekenprofielen`), en een vroeg verplicht aan/uit-veld zou in elk opgeslagen
IFC-bestand blijven staan. De nivelleerder rekent er niet mee.

## Gevolgen

- Hoe de lezers het blok vullen, staat in `levelingValue` (`src/services/xer/xerScheduleOptions.ts`, ook voor P6 XML
  via `deriveXerScheduleOptions`) en in `p6xmlScheduleOptions.ts`; de toetsen zijn `check-xer-schedule-options.ts` en
  `check-xer-schedule-options-wiring.ts`. Welke eigen grootheid bij een prioriteitssleutel hoort en hoe een resource-id
  zonder resource wordt gemeld, staat in `src/services/leveling/levelingInput.ts` (`check-leveling-input.ts`).
- De MSPDI-export meldt het blok als verlies, behalve als het precies de standaard van de P6-dialoog draagt. De
  writer beslist dat in `mspdiWriter.ts` met `isP6DialogDefaultLeveling`; `check-leveling-input.ts`, deel 3, toetst
  de herkenning van die standaard. Zo'n blok zegt niets wat een ontvanger zonder
  blok niet al aanneemt, dus een export zonder het blok verliest dan niets.
