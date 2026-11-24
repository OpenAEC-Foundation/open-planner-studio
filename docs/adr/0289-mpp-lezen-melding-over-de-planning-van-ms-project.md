# MPP lezen: de openingsmelding telt drie signalen op de gelezen taken

Bij het openen van een `.mpp` meldt de app het totaal van `sourceScheduleNotes` (`notifications.mppSourceScheduleNotes`
in `fileSlice.ts`). Dat totaal telt signalen op de gelezen taken en zegt niets over de uitkomst van een berekening. `countScheduleNotes` telt elke taak met minstens één van drie signalen
één keer, en per signaal apart: genivelleerd (`levelingDelayMinutes` gezet), onderbroken (`splitGaps` niet leeg) en
tijdgefaseerd (`timephasedFinishFloor` of `timephasedDurationWalks` gezet). Hij draait in `readMPP` na de lussen die
`splitGaps` en de tijdgefaseerde velden zetten, anders zijn de laatste twee altijd 0. `readMPP` zet het veld alleen
als minstens één taak meetelt.

## Gevolgen

- Contouren herkent de lezer niet aan de bit `WORK_CONTOUR` van een toewijzing. Volgens het weggehaalde commentaar
  staat dat veld niet in de veldentabel van MPXJ `FieldMap14.java`, en noemt MPXJ `ResourceAssignmentFactory.java` de
  bit op offset 8 met masker `0x00000010` tot en met 2010 en `0x00040000` vanaf 2013. Volgens hetzelfde commentaar vond
  een scan van elke bit in het `FixedMeta`-record van 34 bytes in MPXJ's `mpp14resource.mpp` (taak "Contoured Task",
  toewijzing 8, in MSPDI `<WorkContour>7</WorkContour>`) geen bit die alleen voor die toewijzing aan staat, en telt die
  taak via haar gedecodeerde periodes als tijdgefaseerd (ADR 0288).
- Wat de lezer niet overneemt, meldt het importverslag (`scanMppImportLoss` in `mppImportLoss.ts`, issue #391);
  `readMPP` zet `msProjectReport` alleen als er iets te melden is (`hasMsProjectImportLoss`).
