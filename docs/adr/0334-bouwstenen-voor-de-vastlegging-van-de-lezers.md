# De lezers bouwen hun vastlegging met gedeelde stukken die niets aanvullen

De lezers van P6 XML, MSPDI, `.mpp` en CSV leveren de rekenuitvoer van hun bron als `ImportResult.recordedTimes`
(regel `state`, ADR 0255, 0268 en 0285). Drie functies in `src/engine/scheduler/recordedDates.ts` houden dat kanaal
gelijk aan de kernregel van ADR 0330: een record bevat alleen wat de bron gaf.

## Gevolgen

- `buildRecordedTime` geeft `undefined` zonder start of zonder einde (ook bij een lege tekst): dan is er geen
  uitspraak en geen terugval. Een andere as komt alleen in het record als ze er is: een late datum als niet-lege
  tekst, speling en `isCritical` als ze niet `undefined` zijn. Een ontbrekende as wordt nooit 0 of een gekopieerde
  datum. `readXerRecordedTimes` (`xerRecordedTimes.ts`) bouwt zijn records zelf en gebruikt deze functie niet. Toets:
  `check-recorded-times-formats.ts` 1c, 2c en 3c (alleen het vroege paar, de andere assen ontbreken).
- `leafRecordedTimes` laat de records van taken met kinderen (`childIds`) weg. `readMSPDI` en `readMPP` roepen haar
  aan, `captureRecordedDates` niet: de IFC-route houdt de eigen vastlegging van een fase. Een verzameltaak zonder
  record rolt in de modus op uit haar vastgelegde kinderen (ADR 0332). Volgens het weggehaalde commentaar schrijft
  MS Project `EarlyStart` ook op samenvattingen, telde zo'n eigen record "N taken" per formaat anders dan bij XER
  (P6 heeft geen TASK-rij per WBS) en telde een verschoven kind vaak dubbel via de ouder. Toets:
  `check-recorded-times-formats.ts` 2h.
- `recordedFloatDays` rekent werkminuten om naar dagen: de minuten afgerond op hele minuten, gedeeld door
  `minutesPerDay`. Ontbreekt de waarde of is ze niet eindig, of is `minutesPerDay` niet groter dan 0, dan ontbreekt de
  as. Dezelfde bewaking heeft `hoursToDays` in `xerRecordedTimes.ts`. Welke minuten per dag een lezer meegeeft, staat
  in de ADR van die lezer.
