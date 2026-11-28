# MPP lezen: container en leesprimitieven vertrouwen geen getal uit het bestand

Een `.mpp` kan kapot of opzettelijk misvormd zijn. De CFB-lezer (`cfb.ts`) en de blokformaten in `mppPrimitives.ts`
laten daarom geen lus en geen buffer groeien met een teller die het bestand zelf noemt. Elke lus over sectoren of
minisectoren heeft een budget uit de echte bestandsgrootte (`maxSectorSteps`, `maxMiniSteps` in `CfbFile`), en de
itemtelling van `FixedMeta` en `VarMeta12` wordt begrensd op wat het blok kan dragen. Dat wijkt af van MPXJ, dat de
ruwe kopwaarde soms als lusgrens gebruikt (volgens het weggehaalde commentaar in `ConstraintFactory`; niet nagegaan).
Op een geldig bestand geven beide hetzelfde.

## Gevolgen

- Sectoren en minisectoren hebben elk hun eigen budget. Eén budget op de korrel van de minisector (64 bytes) zou voor
  gewone sectoren te ruim zijn; volgens het weggehaalde commentaar gaf dat bij 20 MB invoer 932 MB
  piekgeheugen.
- Een wachtwoord weigert de lezer alleen als in de stroom `Props14` in de wortel de vlagbit 0x1 staat én de
  wachtwoordhash aanwezig is (`readPasswordProtection`, `mppContainer.ts`). Volgens het weggehaalde commentaar noemt
  MPXJ een bestand met de vlag maar zonder hash, dat MS Project zonder wachtwoord opent; een kale vlagtoets zou dat
  weigeren. Bit 0x2 (het wachtwoord voor schrijven) telt niet.
- `parsePropsBytes` geeft bij een afgekapt record wat het al las, zoals MPXJ `Props14`; volgens het
  weggehaalde commentaar noemt MPXJ bestanden waar dat blok zo eindigt.
- `VarMeta12` accepteert magisch getal 0 naast `0xFADFADBA`: volgens het weggehaalde commentaar noemt MPXJ een verder
  geldig bestand met 0 dat MS Project gewoon opent.
- `getDouble` maakt van elke niet-eindige waarde 0, ook van `Infinity` (MPXJ alleen van NaN).
- De CFB-lezer neemt van het 64-bits grootteveld van een stroom alleen de lage 32 bits: volgens het weggehaalde
  commentaar blijven MPP-bestanden ruim onder 4 GiB.
- `getShort` en `getInt` lezen met bitverschuivingen in plaats van een `DataView` per aanroep: ze zitten in de hete lus
  van `FixedData` en `VarMeta12`, en volgens het weggehaalde commentaar scheelt dat ongeveer een factor 40.
- `getUnicodeString` begrenst ook het zoeken naar de afsluitende nul op `maxLength` (`MAX_VAR_TEXT_BYTES` in
  `limits.ts`), omdat veel unique-id's naar dezelfde grote tekst kunnen wijzen. Ze bouwt de tekst in brokken op, omdat
  `String.fromCharCode` met een te lange argumentenlijst de grens van de engine raakt.
