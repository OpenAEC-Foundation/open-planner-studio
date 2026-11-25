# MPP lezen: vier tijdgefaseerde categorieën, elk met haar eigen byte-indeling

MS Project bewaart per toewijzing tijdgefaseerde gegevens in `Var2Data` van `TBkndAssn`. `readAssignmentTimephasedRaw`
(`mppEntities.ts`) geeft per toewijzing vier ruwe blokken door (`AssignmentTimephasedRaw`), en `mppTimephased.ts` zet
die bytes om in periodes, zonder kennis van de container, de veldkaart of een kalender. We lezen vier categorieën, op
hun var-data-sleutel (`AssignmentFieldId` in `fieldMap14.ts`): 49 `RemainingRegularWork`, 50 `ActualRegularWork`,
51 `ActualOvertimeWork` en 87 `ActualIrregularWork`. Niet de elf tijdgefaseerde baselinevarianten en niet de
kostcategorieën: volgens het weggehaalde commentaar dragen die niets bij aan datums. De categorieën delen geen
byte-indeling: volgens het weggehaalde commentaar stuurt MPXJ (`ResourceAssignmentFactory.process`) 50 en 51 door
`getCompleteWork` (samen met 87) en 49 door `getPlannedWork` (`TimephasedDataFactory.java`). Daarom heeft elk formaat
een eigen decoder; één gedeelde lezer zou een van de twee verkeerd lezen.

## Gevolgen

- Formaat A, regulier (`decodeRegularTimephasedWork`, voor 50 en 51): een kop van 16 bytes met op byte 0 het aantal
  records N (een SHORT), daarna N+1 records van 20 bytes. Het eerste record is een totaalrecord voor de hele
  toewijzing en wordt overgeslagen (MPXJ `offset = 36`). In elk volgend record: offset 0 een DOUBLE met het
  cumulatieve werk aan het einde van de periode, offset 8 een DOUBLE met het werk per uur in tienduizendsten van een
  uur (niet gebruikt), offset 16 een INT met de cumulatief verstreken werkminuten aan het einde van de periode, vanaf
  een impliciet punt 0. Daarnaast één INT op absolute offset 24, binnen het totaalrecord, als plafond (ADR 0411).
- Formaat B, gepland en restwerk (`decodePlannedRegularTimephasedWork`, voor 49): een kop van 16 bytes met op byte 0
  het aantal blokken N, zonder de N+1-regel. Bij N 0 is er één samenvattend record (ADR 0411 en 0413). Bij N vanaf 1
  volgt een samenvattingsblok van 28 bytes (overgeslagen, MPXJ `offset = 16 + 28`) en N periodeblokken van 28 bytes:
  offset 0 een DOUBLE met het cumulatieve werk, offset 8 een DOUBLE met uren per dag in twintigduizendsten van een uur
  (niet gebruikt; MPXJ: "unreliable value, not used"), offset 16 een DOUBLE met onbekende betekenis (niet gebruikt;
  MPXJ: "unknown"), offset 24 een INT met de cumulatief verstreken werkminuten. De verstreken tijd staat dus op een
  andere offset dan in formaat A.
- Irregulier (`decodeIrregularTimephasedWork`, voor 87): een kop van 16 bytes met op byte 0 het aantal records, daarna
  records van 8 bytes met twee absolute MPP-tijdstempels van 4 bytes (start op 0, einde op 4), gelezen met
  `getTimestamp` (`mppPrimitives.ts`). Er is geen apart veld voor de hoeveelheid werk (ADR 0413).
- De eenheden en de afronding per formaat staan in ADR 0411, de grenzen bij corrupte invoer in ADR 0412.
- `readMPP` decodeert alleen 50 en 49: voor de splits, de contouren, het venster en het werk van een wandeling
  (`mppReader.ts`, ADR 0287 en 0288). 51 en 87 tellen daar alleen mee in `hasAnyTimephasedData`, als teken dat een
  toewijzing tijdgefaseerde gegevens heeft (knownbug 2480). Hun decoders roept alleen `check-mpp-import.ts` aan.
- `check-mpp-import.ts` (deel Z3) bouwt blokken met deze offsets (`buildRegularBlock`, `buildPlannedBlock`,
  `buildPlannedSummaryOnlyBlock`, `buildIrregularBlock`) en vergelijkt de gedecodeerde periodes; het totaalrecord en
  het samenvattingsblok krijgen daar afwijkende waarden, zodat een decoder die ze niet overslaat een andere eerste
  periode geeft. Die toets houdt de decoder bij deze indeling, niet de indeling bij MS Project. Tegen echte bestanden
  toetsen alleen de corpusdelen (`check-mpp-fidelity.ts` en de corpusdelen van `check-mpp-import.ts`, met
  `OPS_MPP_CRAWL` of `OPS_MPP_CORPUS`). De indeling zelf komt uit het weggehaalde commentaar en MPXJ en is verder niet
  in de repo nagegaan. Volgens dat commentaar passen in het corpus 3073 van de 3298 restwerkblokken op het model van
  28 bytes, typisch 16 + 2 × 28 = 72 bytes.
