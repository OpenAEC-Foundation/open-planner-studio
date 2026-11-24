# MPP lezen: de taakrecords, de bitvlaggen en wat van MPXJ is overgenomen

`readMPP` (`mppReader.ts`) leest het binaire `.mpp` van MS Project 2010 tot en met 2021 (MPP14, de map `"   114"`).
Microsoft beschrijft dat formaat niet; de structuur komt uit MPXJ (`github.com/joniles/mpxj`, LGPL-2.1), zoals de
regel `mpp` zegt. Het weggehaalde commentaar noemde als bronnen `MPP14Reader.java`, `FieldMap14.java`, `PropsKey.java`
en `TaskField.java`; die bronnen zijn niet in de repo nagegaan. De veld-id's en offsets staan als constanten in
`fieldMap14.ts` (`TaskFieldId`, `AssignmentFieldId` en de standaardtabellen), de recordgroottes als constanten in
`mppReader.ts` en `mppEntities.ts`. De lezer leest taken zo voorzichtig dat een ontbrekend of kort veld alleen dat
veld kost, en hij weigert hard waar zonder een veld geen betrouwbare taak overblijft.

## Gevolgen

- `openMppProject` leest de projecteigenschappen uit `"   114"/Props`. Dat de `Props14`-stroom in de wortel alleen de
  wachtwoordvlag draagt (`assertReadable` in `mppContainer.ts`), komt uit het weggehaalde commentaar.
- `TBkndCons` is in het MPP-jargon de tabel met relaties, geen datumconstraints; `readRelations` (`mppEntities.ts`)
  leest hem.
- De itemgrootte van `TBkndTask/FixedMeta` is 47 (`TASK_FIXED_META_ITEM_SIZE`); die van `Fixed2Meta` kiest
  `FixedMeta.withHeuristicItemSize` uit 92 tot en met 96 (`TASK_FIXED2_META_ITEM_SIZES`), tegen het aantal items van
  `FixedData`. Volgens het weggehaalde commentaar zijn dat de getallen van `MPP14Reader.java`.
- `Fixed2Meta` en `Fixed2Data` mogen ontbreken of onleesbaar zijn, net als `TBkndRsc/Fixed2Meta` in `mppEntities.ts`:
  dan is de taak `AUTO_SCHEDULED` en blijven het handmatige anker en de handmatige duur leeg. De vier blokken van een
  taak delen hun index.
- Ontbreekt in de veldkaart `UNIQUE_ID`, `ID`, `NAME`, `SCHEDULED_START` of `SCHEDULED_FINISH`, dan gooit `readTasks`
  een fout. Zo'n veldkaart wijst op een mis-parse (bijvoorbeeld de verkeerde sleutel `TASK_FIELD_MAP` of
  `TASK_FIELD_MAP2`), en taken zonder naam of datum zijn erger dan een geweigerd bestand.
- De taak met unique-id 0 is de projectsamenvattingstaak en wordt overgeslagen, zoals in `readMSPDI`.
- Welke bit in de metadata de mijlpaal, de manier van plannen en `EFFORT_DRIVEN` draagt, hangt af van de versie die
  `detectApplicationVersion` vindt (`isLegacyBitFlagVersion`): tot en met 14 (Project 2010) en een onbekende versie
  de tabel van 2010, daarboven die van 2013 en 2016. Een onbekende versie telt als 0, zoals MPXJ
  `NumberHelper.getInt(null)` (weggehaald commentaar). Mijlpaal en `EFFORT_DRIVEN` staan in `FixedMeta`, de manier van
  plannen in `Fixed2Meta` (`milestoneBitFlag`, `effortDrivenBitFlag`, `taskModeBitFlag`). Dat 2013 en 2016 voor deze
  bits dezelfde offset en hetzelfde masker hebben, komt uit het weggehaalde commentaar.
- `mspTaskTypeFromRaw`: `TYPE` 0, 1 en 2 worden Vaste eenheden, Vaste duur en Vast werk, elke andere aanwezige waarde
  Vast werk; ontbreekt het veld of is het record te kort, dan krijgt de taak geen `mspTaskType`
  (`check-mpp-import.ts`, `[Z14b type]` toetst het ontbrekende geval). Dat Vast werk de terugval van MPXJ
  `TaskTypeHelper` is en dat waarde 3 in een `.mpp` niet voorkomt, komt uit het weggehaalde commentaar.
- Een percentage voltooid buiten 0 tot en met 100 wordt 0 (`readPercentComplete`).
- Elke tekst die deze lezer uit var-data of de Props haalt, gaat door `getUnicodeString` met `MAX_VAR_TEXT_BYTES`
  (de reden staat bij die constante in `limits.ts`).

## Overwogen

Twee filters van MPXJ `createTaskMap` zijn niet overgenomen: een niet-leeg `Fixed2Data`-record eisen, en een
`FixedData`-record van minstens 75 % van `fieldMap.getMaxFixedDataSize(0)`. Dat maximum gaat over alle taakvelden van
MPXJ en is met de veldenlijst van deze lezer niet betrouwbaar te berekenen. `collectValidTaskIndices` (`mppRecords.ts`)
toetst eenvoudiger; volgens het weggehaalde commentaar gaf dat op alle ground-truthbestanden van het corpus hetzelfde
aantal taken. Wijkt een telling ooit af, dan zijn deze filters de eerste kandidaat.
