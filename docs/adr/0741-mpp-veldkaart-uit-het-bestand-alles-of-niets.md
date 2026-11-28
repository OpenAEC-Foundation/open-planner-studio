# MPP lezen: de veldkaart komt uit het bestand, de vaste tabel alleen helemaal of niet

Waar een veld in een taak-, resource- of toewijzingsrecord staat, leest `fieldMap14.ts` per bestand uit de veldkaart in
`Props` (`TASK_FIELD_MAP` en verwanten). De vaste tabellen (`DEFAULT_TASK_FIELDS`, `DEFAULT_RESOURCE_FIELDS`,
`DEFAULT_ASSIGNMENT_FIELDS`) gelden alleen als de veldkaart helemaal ontbreekt, nooit per ontbrekend veld
(`buildFieldMap`). De vaste tabel beschrijft een andere indeling van het record: een offset daaruit tegen de bytes van
een bestand met een eigen veldkaart geeft stil een verkeerde waarde. Ontbreekt een veld in een gelezen veldkaart, dan is het `null`;
voor de verplichte taakvelden weigert `readTasks` dan (ADR 0280).

## Gevolgen

- De veld-id's in `TaskFieldId`, `ResourceFieldId` en `AssignmentFieldId` zijn de ruwe 16-bitsindices uit de veldkaart.
  MPXJ vertaalt ze via `MPPTaskField.mapMpp14`; voor de velden van deze lezer geeft die vertaling dezelfde waarde
  (van de taakvelden vallen alleen 29, 35 en 36 eronder, en die vertaalt ze naar `SCHEDULED_DURATION`,
  `SCHEDULED_START` en `SCHEDULED_FINISH`), zodat de lezer haar niet nodig heeft. Een nieuw veld vraagt die controle opnieuw.
- `AssignmentFieldId.Resume` staat bewust niet in `DEFAULT_ASSIGNMENT_FIELDS`: MPXJ heeft er geen vaste
  plek voor (`FieldMap14.getDefaultAssignmentData`). De tijdgefaseerde categorieën 51 en 87 staan er wel in, naast 49
  en 50, hoewel MPXJ ze daar weglaat.
