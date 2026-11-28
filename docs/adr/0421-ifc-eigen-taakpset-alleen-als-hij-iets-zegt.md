# Een eigen pset per taak staat er alleen als hij iets zegt

Een standaardwaarde schrijft niets: `write` geeft dan `null` of een lege lijst, en de writer schrijft geen pset
(de gouden regel in `docs/ifc-round-trip.md`, route 2). Zo blijven bestaande bestanden byte-gelijk en loopt een project
niet vol met lege psets. Wat per pset als standaard telt, staat in zijn `write` in `PER_TASK_PSETS`; hier staan de
keuzes die een lezer zonder uitleg zou terugdraaien. Een afwezige property leest als de lege waarde van het veld
(ADR 0305).

## Gevolgen

- `OPS_TaskIdentity` staat er bij elke taak, met het interne taak-id. Dat is voor het verversen van een externe bron
  over herhaald lezen en schrijven heen: daar zoekt OPS de brontaak op taak-id (`docs/relaties-tussen-projecten.md`,
  "Herkennen").
- `OPS_Constraints`: een constraint (primair of secundair) alleen als het type niet ASAP is; de datum en `Hard` alleen
  als ze gezet zijn, en `Hard` alleen bij de primaire (ADR 0302). De deadline staat in dezelfde pset. `IfcTaskTime`
  heeft geen slot voor een constraint of deadline.
- Een vlag gaat alleen als `.T.`: `IsHammock`, `ManuallyScheduled`, `IsSummary`, `EffortDriven`,
  `ExplicitTargetWindow`, `Mandatory`, `AtDayEnd`, `LevelingDelayElapsed` en `Hard`. `IsSummary` houdt zo een taak
  zonder kinderen een samenvattingstaak, bijvoorbeeld een lege WBS uit P6 (ADR 0305). `SuspendResume` is de
  uitzondering: `.F.` als `p6SuspendResume` `false` is, `.T.` alleen bij een geldig paar (`hasValidP6SuspendResume`),
  en niets bij `true` zonder geldig paar (ADR 0303).
- `OPS_Milestone` alleen bij `isMilestone`, met `MilestoneKind` alleen voor START of FINISH (knownbug 2481).
- `OPS_Leveling`: `LevelingDelay` alleen als hij niet 0 of leeg is, `LevelingDelayMinutes` zodra hij gezet is (ook 0),
  beide afgerond als `IFCINTEGER` (knownbug 2482).
- `Links`, `Notes`, `Splits` en `Contours` alleen bij een niet-lege lijst, als JSON via `ifcJson`.
- `OPS_Analysis` draagt alleen nog het record `ExactFloat`; de afgeleide analysevelden schrijft de writer niet
  (`docs/ifc-round-trip.md`, "Als een veld bewust níét round-trippt"). De records `ExactFloat`, `DayMeasureDurations`
  en `ExactMinutes` gaan met een vaste sleutelvolgorde (`recordsJson`), zodat de uitvoer byte-gelijk blijft.
- `Resume` en `Stop`, `FinishFloor` en `StartAnchor`, en `ProjectId`, `TaskId` en `ExpectedFinish` van P6 gaan als
  `IFCTEXT` met de tekst uit de store, niet via `ifcDateValue` (ADR 0423); de lezer neemt een niet-lege tekst
  letterlijk over.
