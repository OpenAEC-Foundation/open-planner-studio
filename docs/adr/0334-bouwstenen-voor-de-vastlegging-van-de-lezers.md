# De lezers bouwen hun vastlegging met gedeelde stukken die niets aanvullen

De lezers van P6 XML, MSPDI, `.mpp` en CSV leveren de rekenuitvoer van hun bron als `ImportResult.recordedTimes`
(regel `state`, ADR 0255, 0268 en 0285). Drie functies in `src/engine/scheduler/recordedDates.ts` houden dat kanaal
gelijk aan de kernregel van ADR 0330: een record bevat alleen wat de bron gaf.

## Gevolgen

- Per formaat verschilt wat erin gaat:
  - P6 XML (`p6xmlReader.ts`), MSPDI (`mspdiReader.ts`) en `.mpp` (`mppReader.ts`) vallen per veld terug: een start
    zonder vroege start wordt de gewone start (`StartDate`, `Start` of de opgeloste start), los van het einde.
  - De XER-lezer (`readXerRecordedTimes`) vereist het vroege paar `early_start_date` en `early_end_date`, zonder
    terugval.
  - CSV (`csvReader.ts`) levert de invoerkolommen start en einde, met speling en kritiek als die er zijn; de herkomst
    `csv` komt de moduspoort (`recordedDatesSource`) niet door.
  - P6 XML en MSPDI lezen `isCritical` uit het bestand; XER en `.mpp` leiden het af uit de totale speling. Twee
    uitzonderingen: bij een XER-project met *Longest Path* blijft `isCritical` leeg, ook bij totale speling 0
    (`recordedIsCritical` in `xerRecordedTimes.ts`; toets 9f in `check-xer-recorded-times.ts` vergelijkt precies dat),
    en bij `.mpp` krijgt een taak met een werkelijk einde of minstens 100 % voortgang `false`, ook zonder totale speling
    (ADR 0285).
- `buildRecordedTime` geeft `undefined` zonder start of zonder einde (ook bij een lege tekst): dan is er geen
  uitspraak en geen terugval. Een andere as komt alleen in het record als ze er is: een late datum als niet-lege
  tekst, speling en `isCritical` als ze niet `undefined` zijn. Een ontbrekende as wordt nooit 0 of een gekopieerde
  datum. `readXerRecordedTimes` (`xerRecordedTimes.ts`) bouwt zijn records zelf en gebruikt deze functie niet. Toets:
  `check-recorded-times-formats.ts` 1c, 2c en 3c (alleen het vroege paar, de andere assen ontbreken).
- `leafRecordedTimes` laat de records van taken met kinderen (`childIds`) weg. `readMSPDI` en `readMPP` roepen haar
  aan, `captureRecordedDates` niet: de IFC-route houdt de eigen vastlegging van een fase. Een verzameltaak zonder
  record rolt in de modus op uit haar vastgelegde kinderen (ADR 0332). Toets voor MSPDI:
  `check-recorded-times-formats.ts` 2h (de samenvatting zonder record, het blad met).
- `recordedFloatDays` rekent werkminuten om naar dagen: de minuten afgerond op hele minuten, gedeeld door
  `minutesPerDay`. Ontbreekt de waarde of is ze niet eindig, of is `minutesPerDay` niet groter dan 0, dan ontbreekt de
  as. `hoursToDays` in `xerRecordedTimes.ts` bewaakt zelf `null` en de deler; een niet-eindig getal weigert de
  getalparser van XER eerder (`parseXerNumber`, `XER_INVALID_NUMBER`). Welke minuten per dag een lezer meegeeft, staat
  in de ADR van die lezer.
