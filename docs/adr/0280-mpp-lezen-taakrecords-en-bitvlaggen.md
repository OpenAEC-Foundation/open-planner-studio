# MPP lezen: welke taakrecords de lezer leest, en de bitvlaggen per versie

`readMPP` (`mppReader.ts`) leest het binaire `.mpp` van MS Project 2010 tot en met 2021 (MPP14, de map `"   114"`).
Microsoft beschrijft dat formaat niet; de structuur komt uit MPXJ (`github.com/joniles/mpxj`, LGPL-2.1), zoals de
regel `mpp` zegt. De veld-id's en offsets staan in de veldkaart `fieldMap14.ts`, de recordgroottes als constanten in
`mppReader.ts` en `mppEntities.ts`. De bronnen in MPXJ zijn `MPP14Reader.java`, `FieldMap14.java`,
`PropsKey.java` en `TaskField.java`.

## Gevolgen

- Ontbreekt een van de stromen `FixedMeta`, `FixedData` of `VarMeta` van `TBkndTask`, `"   114"/Props`, of `Props14`
  in de wortel, dan weigert de lezer het bestand. Ontbreekt in de veldkaart `UNIQUE_ID`, `ID`, `NAME`, `SCHEDULED_START` of
  `SCHEDULED_FINISH`, dan ook: zo'n veldkaart wijst op een mis-parse (bijvoorbeeld de verkeerde sleutel
  `TASK_FIELD_MAP` of `TASK_FIELD_MAP2`), en taken zonder naam of datum zijn erger dan een geweigerd bestand.
- Welke records taken zijn, beslist `collectValidTaskIndices` (`mppRecords.ts`); een record zonder leesbaar unique-id
  valt als geheel weg, en de taak met unique-id 0 (de projectsamenvattingstaak) slaat `readTasks` over, zoals
  `readMSPDI`. Een ander veld dat in de veldkaart ontbreekt of buiten het record valt, krijgt per veld een lege of
  vaste waarde.
- `Fixed2Meta` en `Fixed2Data` mogen ontbreken, net als `TBkndRsc/Fixed2Meta` in `mppEntities.ts`, en een fout bij het
  ontleden van hun bytes vangt `readTasks`; een fout van de container bij het ophalen van de stroom vangt hij niet.
  Ontbreekt een van de twee of mislukt het ontleden, dan is de taak `AUTO_SCHEDULED` en blijven het handmatige anker
  en de handmatige duur leeg. De itemgrootte van `Fixed2Meta` kiest `FixedMeta.withHeuristicItemSize` uit 92 tot en met 96, die van `FixedMeta` is 47: de getallen van
  `MPP14Reader.java`.
- De bit voor mijlpaal, manier van plannen en `EFFORT_DRIVEN` hangt af van de versie uit `detectApplicationVersion`
  (`isLegacyBitFlagVersion`): tot en met 14 (Project 2010) en een onbekende versie de tabel van 2010, daarboven die
  van 2013 en 2016. Een onbekende versie telt als 0, zoals MPXJ `NumberHelper.getInt(null)`, en 2013 en 2016 hebben
  voor deze bits dezelfde offset en hetzelfde masker (`MPP14Reader.java`). Mijlpaal en
  `EFFORT_DRIVEN` staan in `FixedMeta`, de manier van plannen in `Fixed2Meta`.
- De projecteigenschappen komen uit `"   114"/Props`. Uit de `Props14`-stroom in de wortel leest de poort
  (`readPasswordProtection`, `mppContainer.ts`) de wachtwoordvlag en of de wachtwoordhash aanwezig is. `TBkndCons` is in het MPP-jargon de tabel met relaties, geen
  datumconstraints.
- Een percentage voltooid buiten 0 tot en met 100 wordt 0 (`readPercentComplete`).
- `mspTaskTypeFromRaw`: 0, 1 en 2 worden Vaste eenheden, Vaste duur en Vast werk, een andere waarde Vast werk, en
  `null` geen taaktype. `check-mpp-import.ts` (`[Z14b type]`) toetst twee helpers: een veldkaart zonder `TYPE` geeft
  bij `fixedOffsetOf` `null`, en `mspTaskTypeFromRaw(null)` geeft `undefined`. Vast werk is de terugval van MPXJ
  `TaskTypeHelper`.
- De `.mpp.xml`-bestanden die in het corpus als ground truth dienen, zijn een andere revisie van het document dan de
  `.mpp`-bestanden (ook genoemd in de kop van `check-mpp-relations.ts`); `check-mpp-import.ts` houdt daarom per
  veldsoort een budget voor afwijkingen.

## Overwogen

MPXJ `createTaskMap` (`MPP14Reader.java`) heeft twee filters die hier niet zijn overgenomen: een
aanwezig `Fixed2Data`-record eisen, en een `FixedData`-record van minstens 75 % van `fieldMap.getMaxFixedDataSize(0)`.
Dat maximum gaat over alle taakvelden van MPXJ en is met de veldenlijst van deze lezer niet betrouwbaar te berekenen.
Wijkt een telling ooit af, dan zijn deze filters de eerste kandidaat.
