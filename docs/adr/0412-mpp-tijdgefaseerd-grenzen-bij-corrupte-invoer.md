# MPP lezen: tijdgefaseerde blokken zonder vertrouwen in de kop

Het aantal records in de kop van een tijdgefaseerd blok is een ongecontroleerde waarde uit het bestand, en `Var2Data`
kan een blok van willekeurige lengte dragen. De decoders in `mppTimephased.ts` dimensioneren daarom niets op het ruwe
aantal: een ontbrekend of te kort blok geeft een lege lijst, en het aantal wordt eerst begrensd op wat de bloklengte
kan dragen en daarna op een vaste grens uit `limits.ts`. Dat voorkomt een lezing buiten het blok en een lus over een
aantal records dat het blok niet draagt.

## Gevolgen

- Leeg of te kort geeft een lege lijst: `null` (categorie afwezig), formaat A korter dan 36 bytes (kop en
  totaalrecord), formaat B korter dan 24 bytes (kop en het werkveld van 8 bytes van het samenvattingsblok), irregulier
  korter dan 16 bytes. `check-mpp-import.ts` (`[Z3 rood]`) toetst die zes gevallen.
- De begrenzing van het aantal, in twee stappen: eerst op het aantal hele records dat na de kop past (formaat A na
  36 bytes per 20, formaat B bij N vanaf 1 na 44 bytes per 28, irregulier na 16 bytes per 8, nooit onder 0), daarna met
  `clampTimephasedRegularRecordCount`, `clampTimephasedPlannedRecordCount` en `clampTimephasedIrregularRecordCount` op
  `MAX_TIMEPHASED_REGULAR_RECORDS` (20.000), `MAX_TIMEPHASED_PLANNED_RECORDS` (20.000) en
  `MAX_TIMEPHASED_IRREGULAR_RECORDS` (5.000). Elk formaat heeft een eigen grens, omdat de recordgrootte verschilt.
  `[Z3 1d]` toetst een kop die 50.000 of 40.000 records claimt terwijl er 2, 1 en 2 passen.
- Een periode komt alleen in de lijst als de verstreken werkminuten in dat record groter zijn dan in het vorige
  (zoals MPXJ `removeEmptyItems`, dat een periode met gelijke start en einde weglaat); een periode zonder werk maar met verstreken
  werkminuten blijft staan, want dat is een splitgat (ADR 0414, `[Z3 1b]`). De uitzondering is het ene samenvattende
  record van formaat B met N 0 (ADR 0413): daar is het einde het maximum van 0 en de klokminuten tussen de twee ankers,
  dus kan het einde gelijk zijn aan het begin.
- De vorige waarden schuiven ook na een record zonder periode mee. Na een record dat het plafond van formaat A op 0
  zette (ADR 0411), telt het volgende record dus weer vanaf werkminuut 0.
- Irregulier: een record waarvan een tijdstempel volgens `getTimestamp` geen datum is (de eigen heuristieken voor "geen
  waarde" in `mppPrimitives.ts`), of waarvan het einde niet na de start ligt, wordt overgeslagen.
