# MPP lezen: de veldkaart komt uit het bestand, de vaste tabel alleen helemaal of niet

Waar een veld in een taak-, resource- of toewijzingsrecord staat, leest `fieldMap14.ts` per bestand uit de veldkaart in
`Props` (`TASK_FIELD_MAP` en verwanten). De vaste tabellen (`DEFAULT_TASK_FIELDS`, `DEFAULT_RESOURCE_FIELDS`,
`DEFAULT_ASSIGNMENT_FIELDS`) gelden alleen als de veldkaart helemaal ontbreekt, nooit per ontbrekend veld
(`buildFieldMap`). De vaste tabel beschrijft een andere indeling van het record: een offset daaruit tegen de bytes van
een bestand met een eigen veldkaart geeft stil een verkeerde waarde. Volgens het weggehaalde commentaar staan in het
corpus (MS Project 16.0) bijvoorbeeld `UNIQUE_ID` en `ID` van een taak op elkaars plek ten opzichte van de vaste tabel,
en `START` van een toewijzing op 52 in plaats van 12. Ontbreekt een veld in een gelezen veldkaart, dan is het `null`;
voor de verplichte taakvelden weigert `readTasks` dan (ADR 0280).

## Gevolgen

- De veld-id's in `TaskFieldId`, `ResourceFieldId` en `AssignmentFieldId` zijn de ruwe 16-bitsindices uit de veldkaart.
  MPXJ vertaalt ze via `MPPTaskField.mapMpp14`; volgens het weggehaalde commentaar geeft die vertaling voor de velden
  van deze lezer dezelfde waarde, zodat de lezer haar niet nodig heeft. Een nieuw veld vraagt die controle opnieuw.
- `AssignmentFieldId.Resume` staat bewust niet in `DEFAULT_ASSIGNMENT_FIELDS`: volgens het weggehaalde commentaar heeft
  MPXJ er geen vaste plek voor. De tijdgefaseerde categorieën 51 en 87 staan er wel in, naast 49 en 50, hoewel MPXJ ze
  daar volgens dat commentaar weglaat.
