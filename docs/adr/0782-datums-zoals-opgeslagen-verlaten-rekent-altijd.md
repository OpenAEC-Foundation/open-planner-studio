# Datums zoals opgeslagen verlaten rekent altijd door

Een bewerking die "datums zoals opgeslagen" verlaat, zet de modus uit en `scheduleStale` aan, maar rekent niet: dat
gebeurt binnen een Immer-producer. `useExitRecordedDates` rekent daarna één keer door, ook met Automatisch berekenen uit
(de standaard). Anders blijft de planning half opgeslagen en half bewerkt staan. De hook staat daarom los van
`useAutoCalcCPM`, die de instelling volgt. Wanneer de overgang telt en waarom de uitvoering wacht (`setTimeout` 0),
beslissen de pure functies in `src/state/recordedDatesExit.ts`.
