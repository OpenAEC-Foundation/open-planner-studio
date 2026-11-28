# MPP lezen: de openingsmelding telt drie signalen op de gelezen taken

Bij het openen van een `.mpp` meldt de app het totaal van `sourceScheduleNotes` (`notifications.mppSourceScheduleNotes`
in `fileSlice.ts`). Dat totaal telt signalen op de gelezen taken en zegt niets over de uitkomst van een berekening. `countScheduleNotes` telt elke taak met minstens één van drie signalen
één keer, en per signaal apart: genivelleerd (`levelingDelayMinutes` gezet), onderbroken (`splitGaps` niet leeg) en
tijdgefaseerd (`timephasedFinishFloor` of `timephasedDurationWalks` gezet). Hij draait in `readMPP` na de lussen die
`splitGaps` en de tijdgefaseerde velden zetten, anders zijn de laatste twee altijd 0. `readMPP` zet het veld alleen
als minstens één taak meetelt.

## Gevolgen

- Contouren herkent de lezer niet aan de bit `WORK_CONTOUR` van een toewijzing. Dat veld
  staat niet in de veldentabel van MPXJ `FieldMap14.java`, en MPXJ `ResourceAssignmentFactory.java` noemt de
  bit op offset 8 met masker `0x00000010` tot en met 2010 en `0x00040000` vanaf 2013. Een scan van elke bit in het
  `FixedMeta`-record van 34 bytes in MPXJ's `mpp14resource.mpp` (taak "Contoured Task") vond geen bit die alleen
  voor die toewijzing aan staat (`docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md`, T12-fixronde, en
  `2026-08-17-plan-mpp-nul-afwijkingen.md`); die taak telt via haar gedecodeerde periodes als tijdgefaseerd (ADR 0288).
- Wat de lezer niet overneemt, meldt het importverslag (`scanMppImportLoss` in `mppImportLoss.ts`, issue #391);
  `readMPP` zet `msProjectReport` alleen als er iets te melden is (`hasMsProjectImportLoss`).
