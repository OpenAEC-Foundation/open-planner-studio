# MPP lezen: duur, rest en uitsteltijd in minuten, en het anker van een handmatige taak

MS Project bewaart een duur in tienden van een minuut werktijd; het eenhedenveld ernaast is alleen de vorm van invoer
en weergave. `readTasks` neemt `SCHEDULED_DURATION` daarom als `durationMinutes` (de tienden gedeeld door 10, zonder
afronding) en geeft elke taak de urenmaat (`durationUnit: 'hours'`, spec alleen-uren §3.10, T15; review #591 ronde 1
punt 3). Een `.mpp` draagt geen OPS-markering voor de dagenmaat, want OPS schrijft geen `.mpp` en de lezer leest geen
eigen tekstvelden (knownbug 301). `scheduleDuration` rekent `hourTaskScheduleDuration` uit op de effectieve
taakkalender, na de promotie van ADR 0283.

## Gevolgen

- De eenheid van de duur komt uit `ACTUAL_DURATION_UNITS` (`TaskFieldId.DurationUnits`). Is die een kalendertijdeenheid
  (`getDurationTimeUnits` begint met `elapsed`), dan is de taak `ELAPSEDTIME`; ontbreekt het veld, dan `WORKTIME`. Een
  kalendertijdduur staat in een `.mpp` al in klokminuten (volgens het weggehaalde commentaar de vaste dag van 24 uur
  in MPXJ `MPPUtility.getAdjustedDuration`). Hoe de solver zo'n taak rekent, staat in ADR 0016.
- `REMAINING_DURATION` heeft dezelfde eenheid en wordt geklemd (`clampRemainingDurationTenths`, `limits.ts`) en
  onafgerond `remainingMinutes`. Ontbreekt het veld of is het record te kort, dan zet de lezer geen rest en leidt
  `normalizeImportedProgress` haar bij voortgang af uit `completion`. De eigen rest gaat voor, omdat MS Project die
  exact bewaart (4 werkdagen is 1920 minuten) en het percentage afgerond (33 %); een afleiding uit het percentage
  komt op een tijd die MS Project niet toont.
- Een taak zonder werkelijk einde en met een ruwe rest groter dan 0 gaat in `runningAtFullIds`, zodat
  `normalizeImportedProgress` haar op 100 % als lopend houdt, zoals bij MSPDI (knownbug 382).
- `LEVELING_DELAY` (tienden van een minuut, geklemd met `clampLevelingDelayTenths`) wordt alleen als hij niet 0 is
  `levelingDelayMinutes`, afgerond op hele minuten; `levelingDelayElapsed` komt dan uit `LEVELING_DELAY_UNITS`. Het
  veld `levelingDelay` in werkdagen, van de eigen nivelleerder, blijft leeg: de solver past `levelingDelayMinutes` zelf
  toe (ADR 0017).
- `scheduleStart` en `scheduleFinish` komen uit `resolveScheduleField`: het handmatige paar uit `Fixed2Data`
  (`TaskFieldId.Start`/`Finish`) als het gevuld is en de taak `MANUALLY_SCHEDULED` is of `SCHEDULED_START`/`_FINISH`
  leeg is, en anders `SCHEDULED_START`/`_FINISH`. De forward pass zet het anker van een handmatige taak rauw vast
  (ADR 0024). Dat dit de overschrijfregel van MPXJ `MPP14Reader.java` is en dat het handmatige paar in het corpus bij
  261 handmatige taken in 15 bestanden afwijkt, komt uit het weggehaalde commentaar.
- `resolveScheduleField` staat bewust ook in `tests/planning/mppGroundTruth.ts`, zonder import: die meetlat moet een
  fout in de lezer kunnen vinden en mag de regel dus niet delen. Houd de parameternamen en de uitdrukking in beide
  gelijk.
- Een taak zonder start of einde in het bestand krijgt die van `resolveMissingScheduleDates` (`importDates.ts`), met
  de projectstart uit de Props als anker; heeft het bestand geen projectstart, dan zet `readMPP` de projectstart op het
  anker dat die functie teruggeeft.
