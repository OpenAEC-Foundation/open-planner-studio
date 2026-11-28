# MSPDI: beschikbaarheid in periodes en de kritiek-drempel

Een resource met capaciteit in stappen (`availabilitySteps`) gaat naar MSPDI als `<AvailabilityPeriods>` en komt daar
weer uit (`mspdiAvailability.ts`). De twee vormen zeggen iets anders over de tijd buiten een stap of periode: in OPS
geldt vóór de eerste stap de vlakke `maxUnits`, in MS Project is een resource buiten elke periode niet beschikbaar.
Daarom schrijft `availabilityPeriodsOf` de periodes sluitend van het open begin tot het open einde, en maakt `availabilityFromPeriods` van elk stuk buiten een periode (vóór de eerste, in een
gat en na een echte einddatum) een stap naar 0. MS Project gebruikt 1984-01-01 en 2049-12-31 als "NA", het open begin
en einde van de tabel; 2149-12-31 is de uiterste datum.

## Gevolgen

- Niet beschikbaar vóór de eerste periode wordt bij het lezen een stap naar 0 op 1984-01-01, geen vlakke waarde 0,
  omdat de vlakke waarde (`MaxUnits`) groter dan 0 moet blijven.
- Een einde op 2049-12-31 of 2149-12-31 is bij het lezen open, tenzij er daarna nog een periode begint; dan is het een
  echte grens. Begint de laatste stap ná 2049-12-31, dan krijgt de laatste periode bij het schrijven 2149-12-31
  als einde, anders eindigt die vóór haar begin en valt ze weg.
- `mspdiCriticalSlackLimit` beslist voor de writer en de verliesdetector (`xerExportLoss.ts`) of de kritiek-drempel als
  `<CriticalSlackLimit>` in hele dagen meegaat. Een drempel in uren (`thresholdHours`) gaat alleen mee als hij 0 is: hij
  telt per taak op haar eigen kalender, dus een ander aantal uren heeft geen exacte waarde in dagen.
