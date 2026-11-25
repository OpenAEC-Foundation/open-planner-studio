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

- Breedte en teken van de velden volgen de leesprimitieven in `mppPrimitives.ts`, allemaal little-endian: `getShort`
  leest 16 bits zonder teken, `getInt` 32 bits met teken, `getDouble` een IEEE 754-getal van 64 bits (een waarde die
  niet eindig is, wordt 0). Van de kop van 16 bytes leest elke decoder alleen het aantal op byte 0 en 1.
- Formaat A, regulier (`decodeRegularTimephasedWork`, voor 50 en 51): op byte 0 het aantal N (16 bits zonder teken).
  Na de kop volgen fysiek N + 1 records van 20 bytes: eerst een totaalrecord voor de hele toewijzing (bytes 16 tot 36),
  dat wordt overgeslagen (MPXJ `offset = 36`), dan N perioderecords vanaf byte 36. In elk perioderecord: relatieve
  byte 0 een DOUBLE met het cumulatieve werk aan het einde van de periode, relatieve byte 8 een DOUBLE met het werk
  per uur in tienduizendsten van een uur (niet gebruikt), relatieve byte 16 een INT van 32 bits met teken met de
  cumulatief verstreken werkminuten aan het einde van de periode. Uit het totaalrecord leest de decoder één veld:
  absolute byte 24, relatieve byte 8 van het totaalrecord, als INT van 32 bits met teken; dat is het plafond
  (ADR 0411). De DOUBLE op relatieve byte 8 hoort bij de perioderecords; wat het totaalrecord verder op die plek
  draagt, leest de decoder niet.
- Formaat B, gepland en restwerk (`decodePlannedRegularTimephasedWork`, voor 49): op byte 0 het aantal N (16 bits
  zonder teken). N 0 en N vanaf 1 zijn twee verschillende vormen:
  - N 0: één samenvattend record voor de hele toewijzing; de decoder leest alleen de DOUBLE op byte 16 (het totale
    werk). Wat hij daarmee doet, staat in ADR 0411 en 0413.
  - N vanaf 1: na de kop volgen fysiek N + 1 blokken van 28 bytes: eerst een samenvattingsblok (bytes 16 tot 44), dat
    wordt overgeslagen (MPXJ `offset = 16 + 28`), dan N periodeblokken vanaf byte 44. Bij N 1 is er dus één
    periode, op byte 44. In elk periodeblok: relatieve byte 0 een DOUBLE met het cumulatieve werk, relatieve byte 8
    een DOUBLE met uren per dag in twintigduizendsten van een uur (niet gebruikt; MPXJ: "unreliable value, not
    used"), relatieve byte 16 een DOUBLE met onbekende betekenis (niet gebruikt; MPXJ: "unknown"), relatieve byte 24
    een INT van 32 bits met teken met de cumulatief verstreken werkminuten. De verstreken tijd staat dus op een andere
    plek dan in formaat A, en formaat B heeft geen plafond.
- Irregulier (`decodeIrregularTimephasedWork`, voor 87): op byte 0 het aantal N (16 bits zonder teken), daarna vanaf
  byte 16 N records van 8 bytes, zonder overgeslagen record. Elk record heeft twee absolute MPP-tijdstempels van
  4 bytes, de start op relatieve byte 0 en het einde op relatieve byte 4, gelezen met `getTimestamp`: eerst de tijd van
  de dag in eenheden van 6 seconden, dan de dagen sinds 1983-12-31 UTC, beide 16 bits zonder teken. Er is geen apart
  veld voor de hoeveelheid werk (ADR 0413).
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
