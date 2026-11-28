# MPP lezen: duur, rest en uitsteltijd in minuten, en het anker van een handmatige taak

MS Project bewaart een duur in tienden van een minuut. `readTasks` levert `SCHEDULED_DURATION` als `durationMinutes`
(de tienden gedeeld door 10, zonder afronding) en geeft elke taak de urenmaat (`durationUnit: 'hours'`, spec
alleen-uren §3.10, T15; review #591 ronde 1 punt 3). `readTasks` neemt eigen tekstvelden niet over en decodeert dus geen
OPS-markering voor de dagenmaat; `scanMppImportLoss` (`mppImportLoss.ts`) leest hun bytes alleen voor de telling van
wat bij import wegvalt (knownbug 301). `scheduleDuration` rekent `hourTaskScheduleDuration` uit op de effectieve taakkalender, na
de promotie van ADR 0283.

## Gevolgen

- Het eenhedenveld `ACTUAL_DURATION_UNITS` (`TaskFieldId.DurationUnits`) bepaalt `durationType`: een
  kalendertijdeenheid (`getDurationTimeUnits` begint met `elapsed`) geeft `ELAPSEDTIME`, elke andere eenheid en een
  ontbrekend veld `WORKTIME`. Dezelfde `durationMinutes` zijn dus bij `ELAPSEDTIME` klokminuten en bij `WORKTIME`
  werkminuten; hoe de solver ze plant, staat in ADR 0016. Een kalendertijdduur staat in een `.mpp` al in klokminuten
  (de vaste dag van 24 uur in MPXJ `MPPUtility.getAdjustedDuration`).
- Een duur met een breuk van een minuut gaat als `ExactMinutes`-record mee naar IFC en XML (T14;
  `check-uren-f5b-adapters.ts` (1)).
- `REMAINING_DURATION` heeft dezelfde eenheid, wordt geklemd (`clampRemainingDurationTenths`, `limits.ts`) en wordt
  onafgerond `remainingMinutes`. Ontbreekt het veld of is het record te kort, dan levert de lezer geen rest, en leidt
  `normalizeImportedProgress` haar bij voortgang af uit `completion`. De eigen rest gaat voor, omdat MS Project die
  exact bewaart (4 werkdagen is 1920 minuten) en het percentage afgerond (33 %); een afleiding uit het percentage komt
  op een tijd die MS Project niet toont.
- Een taak zonder werkelijk einde en met een ruwe rest groter dan 0 gaat in `runningAtFullIds`, zodat
  `normalizeImportedProgress` haar op 100 % als lopend houdt, zoals bij MSPDI (knownbug 382).
- `LEVELING_DELAY` (tienden van een minuut, geklemd met `clampLevelingDelayTenths`) wordt alleen als hij niet 0 is
  `levelingDelayMinutes`, afgerond op hele minuten; `levelingDelayElapsed` komt dan uit `LEVELING_DELAY_UNITS`. Het
  veld `levelingDelay` in werkdagen, van de eigen nivelleerder, blijft leeg: de solver past `levelingDelayMinutes` zelf
  toe (ADR 0017).
- `resolveScheduleField` kiest start en einde elk apart: voor de start het handmatige `Start` uit `Fixed2Data` als
  dat gevuld is en de taak `MANUALLY_SCHEDULED` is of `SCHEDULED_START` leeg is, anders `SCHEDULED_START`; voor het
  einde hetzelfde met `Finish` en `SCHEDULED_FINISH`. Een handmatige taak met een handmatige start en een leeg
  handmatig einde krijgt zo die start en het einde uit `SCHEDULED_FINISH`. Waarom het handmatige anker telt: ADR 0024.
  Dit is de overschrijfregel van MPXJ `MPP14Reader.java`.
- `resolveScheduleField` staat bewust ook in `tests/planning/mppGroundTruth.ts`, zonder import: die meetlat moet een
  fout in de lezer kunnen vinden en mag de regel dus niet delen. Houd de parameternamen en de uitdrukking in beide
  gelijk.
- Een start of einde die uit geen van beide velden komt, vult `resolveMissingScheduleDates` (`importDates.ts`), met de
  projectstart uit de Props als anker; heeft het bestand geen projectstart, dan zet `readMPP` de projectstart op het
  anker dat die functie teruggeeft.
- De lag van een relatie levert `mppLagToSequenceFields` (`mppEntities.ts`). Een lag in
  werktijd is altijd `lagMinutes`, ook 0, zoals bij MSPDI. Een lag in procenten is `lagPercent`, bij verstreken
  procenten met `lagUnit: 'ELAPSEDTIME'`; een lag in verstreken dagen is `lagDays` met die `lagUnit`, en een andere
  verstreken eenheid `lagMinutes` met die `lagUnit`. Een
  bronwaarde -1, ook de terugval als het record te kort is voor de lag, geeft alleen `lagDays: 0`. De constraintcodes vertaalt
  `mspCodeToConstraint` van de MSPDI-lezer.
