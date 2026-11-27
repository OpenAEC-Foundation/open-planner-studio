# Slapende documenten doorrekenen: een kopie van de taken, zes velden vervangen, de modus eruit

`recalculateStaleSleepingDocuments` rekent elk niet-actief document met `scheduleStale` door en schrijft de uitkomst in
zijn payload terug. Alleen het bezettingsoverzicht roept hem aan, en alleen met Automatisch berekenen aan
(`ResourceOccupancyView.tsx`); zonder die instelling rekent het overzicht op een kopie en schrijft niets terug (regel
`state`, *Scheduling is manual, not reactive*). Het actieve document valt erbuiten: dat rekent via `useAutoCalcCPM` en
`runCPM`. Zoals `runCPM` maakt de actie geen undo-stap en laat ze `isDirty` staan: een doorrekening is afgeleide data,
geen bewerking. De sessiegeschiedenis raakt ze niet; bestaande stappen voor het slapende document blijven bij hun eigen
toestand horen.

## Gevolgen

- Fase 1 rekent buiten de producer, op `cloneTasksForSolve` van de payloadtaken, met dezelfde `solveProject` en dezelfde
  invoer (`solveInputFor`) als `runCPM`. Die kopie wordt ook teruggeschreven; de payload zelf blijft tot dan
  onaangeraakt, zodat een mislukte berekening niets half achterlaat. Een rekenfout (`result.error`, bijvoorbeeld een
  cyclus) of een gegooide fout laat dat document ongewijzigd en de lus gaat verder; het bezettingsoverzicht telt de
  boekingen van zo'n document dan niet mee (`occupancy.ts`).
- Een payload met `minuteModelPending` slaat de actie over. De omzetting naar minuten van een ouder document
  (`minuteModelTransition`) doen `runCPM` in `scheduleSlice.ts`, `applyLoadedProject` in `fileSlice.ts` en `restoreDocuments`; deze actie
  doet haar niet en laat zo'n document verouderd liggen.
- De nieuwe payload is een spread van de oude, zodat elk veld van het contract meegaat, met alleen `tasks`, `cpmResult`,
  `scheduleStale: false`, `resourceLoadResult: null`, `datesAsRecorded: false` en `recordedDates: null` vervangen. De
  belasting blijft leeg omdat de activatie haar toch opnieuw uitrekent (`materializeLibraryBoundary` in
  `documentActivation.ts`); een hier berekende waarde zou alleen kunnen verouderen.
- `datesAsRecorded` en `recordedDates` gaan eruit: met de spread alleen zei het document na activering "datums zoals
  opgeslagen" terwijl de berekende datums erin staan. Dat is een vangnet: `markScheduleStale` zet `scheduleStale` niet
  zolang de modus aan staat, dus zo'n payload hoort hier niet te komen. Toets: `check-recorded-dates.ts` 10A (de
  vlag met de hand gezet op een slapende payload in de modus).
- Fase 2 schrijft alleen als er iets te schrijven is. Zonder wijziging komt er geen nieuwe `documents`-referentie, dus geen
  nieuwe render en geen nieuwe aanroep door het effect in het overzicht. Een document dat tussendoor sloot of actief werd
  (`payload === null`), slaat de schrijfstap over. Toetsen: `tests/library/check-occupancy.ts` 17 tot en met 20
  (`isDirty` en geschiedenis ongemoeid, `resourceLoadResult` leeg, geen mutatie zonder verouderd document, een
  cyclusdocument byte-gelijk).
