# MPP lezen: relaties, resources en toewijzingen geven bij een fout een lege lijst

`readRelations`, `readResources`, `readAssignments` en `readAssignmentTimephasedRaw` (`mppEntities.ts`) vangen elke
fout van hun `*Unsafe`-functie en geven dan een leeg resultaat.
`readTasks` weigert juist hard bij een onvolledige taakveldkaart (ADR 0280). Taken zijn de ruggengraat van het
document; een planning met taken en kalenders maar zonder relaties of resources is bruikbaarder dan een mislukte import.

## Gevolgen

- Twee afwijkingen van MPXJ (`ResourceAssignmentFactory`): een te kort toewijzingsrecord wordt niet met nullen aangevuld, en een herhaald paar van taak en resource geeft twee toewijzingen in plaats van één.
- De resource met unique-id 0 (de plaatshouder "niet toegewezen") blijft, met een vaste naam, type `LABOR` en
  `maxUnits` 1: MS Project schrijft haar ook in zijn MSPDI-export, en zo telt de lezer evenveel resources als
  `readMSPDI`. MPXJ slaat haar over. Bij taken is unique-id 0 de projectsamenvattingstaak en valt ze weg.
- Een kostenresource van MS Project wordt `LABOR`, zoals in `readMSPDI` (alleen materiaal is `MATERIAL`).
- `MAX_UNITS` en `ASSIGNMENT_UNITS` worden twee keer door 100 gedeeld: de opgeslagen waarde staat honderd keer boven de
  procentschaal van MPXJ, en de app rekent in fracties (1 is voltijds), zoals `readMSPDI`.
- De koppeling van een resourcerecord aan zijn index leest de unique-id als 16 bits, zoals MPXJ `createResourceMap`,
  hoewel het veld 32 bits is.
- De verwijdermarkering leest de lezer per tabel anders, zoals MPXJ: bij `TBkndCons` 16 bits, bij `TBkndAssn` één
  byte (`selectAssignmentRecords`); van een verwijderde taak leest `collectValidTaskIndices` de unique-id als 16 bits.
  Een lege taakplaats (een `FixedData`-record van precies `NULL_TASK_BLOCK_SIZE` bytes) slaat `collectValidTaskIndices` over, waar MPXJ er een lege taak van maakt; daardoor kan de
  telling van ID's gaten hebben.
- `emptyResourcesResult` is een fabriek en geen gedeelde constante: het lege resultaat gaat de store in, en de
  autoFreeze van Immer zou een gedeeld object bevriezen.
