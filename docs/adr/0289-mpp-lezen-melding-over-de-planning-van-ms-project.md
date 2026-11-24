# MPP lezen: de openingsmelding telt drie signalen op de gelezen taken

Bij het openen van een `.mpp` meldt de app eenmalig hoeveel taken een onderbroken, genivelleerde of door resources
gestuurde planning hebben (`sourceScheduleNotes`, gemeld in `fileSlice.ts`). De melding is alleen informatie; zulke
taken rekenen zoals MS Project. `countScheduleNotes` telt op de gevulde taken: genivelleerd (`levelingDelayMinutes`
gezet), onderbroken (`splitGaps` niet leeg) en tijdgefaseerd (`timephasedFinishFloor` of `timephasedDurationWalks`
gezet). Hij draait in `readMPP` na de lussen die `splitGaps` en de tijdgefaseerde velden zetten, anders zijn de laatste
twee altijd 0. `readMPP` zet het veld alleen als minstens één taak meetelt.

## Gevolgen

- Contouren herkent de lezer niet aan de bit `WORK_CONTOUR` van een toewijzing. Volgens het weggehaalde commentaar
  noemt MPXJ `ResourceAssignmentFactory.java` die bit op offset 8 met masker `0x00000010` tot en met 2010 en
  `0x00040000` vanaf 2013, en vond een scan van elke bit in het `FixedMeta`-record van 34 bytes in MPXJ's
  `mpp14resource.mpp` (taak "Contoured Task", toewijzing 8, in MSPDI `<WorkContour>7</WorkContour>`) geen bit die
  alleen voor die toewijzing aan staat. Volgens hetzelfde commentaar telt die taak wel als tijdgefaseerd, via haar
  gedecodeerde periodes (ADR 0288).
- Wat de lezer niet overneemt, meldt het importverslag (`scanMppImportLoss` in `mppImportLoss.ts`, issue #391);
  `readMPP` zet `msProjectReport` alleen als er iets te melden is (`hasMsProjectImportLoss`).
