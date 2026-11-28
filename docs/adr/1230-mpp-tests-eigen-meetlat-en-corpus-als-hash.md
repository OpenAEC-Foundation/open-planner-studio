# MPP-tests: een eigen meetlat, en het bedrijfscorpus alleen als hash

De tests van de `.mpp`-lezer meten tegen de datums die MS Project zelf in het bestand opslaat en tegen bytes die
ze zelf bouwen. Zo'n meting zegt alleen iets als ze niet door de code loopt die ze toetst. Daarom leest
`scanGroundTruthTasks` in `tests/planning/mppGroundTruth.ts` de TBkndTask-records met een eigen lus, met eigen
kopieën van `taskModeBitFlag`, `resolveScheduleField` en de veldkaart van blok 1 (`block1TaskStartFinishOffsets`),
in plaats van `readTasks` en de functies uit `mppReader.ts` te gebruiken: een fout in `readTasks` zou anders in de
meetlat meelopen en onzichtbaar blijven. De taaklus en de keuze tussen geplande en handmatige datumvelden zijn dus eigen code; de container, de primitieven, de veldopzoekers en de leesgrenzen deelt de scan wel met de lezer. Om dezelfde reden schrijven `mppFixtures.ts` en de MPP-checks magische getallen, `PropsKey`-sleutels en offsets letterlijk uit in plaats van ze uit `src/services/mpp/` af te leiden, ook waar ze een veld-id importeren. Wie deze kopieën samenvoegt met de lezer, haalt de toets onderuit.

Het bedrijfscorpus (`OPS_MPP_CORPUS`) bestaat uit echte bedrijfsbestanden. Als bestandslabel in de code, in `mpp-fidelity-baseline.json` en in de meetregels heet zo'n bestand alleen naar de eerste 16 hextekens van de SHA-256 van zijn bytes (`tagFor` in `check-mpp-fidelity.ts`, `resolveByHash` in `check-mpp-summary-relations.ts`); alleen de publieke crawlbestanden (`OPS_MPP_CRAWL`) mogen met hun relatieve pad verschijnen. De uitlijningscontrole in `measureFidelity` (`mppFidelity.ts`) noemt positie, MSP-id en naamlengte, geen taaknaam. `OPS_MPP_FIDELITY_REPORT=detail` en `OPS_MPP_DIAG=detail` drukken wel taaknamen of andere corpusinhoud af; die uitvoer hoort niet in een commit, PR of CI-log.

## Gevolgen

- De gedeelde veldkaart (`fieldMap14.ts`) raakt meetlat en lezer gelijk; een verkeerde offset daar vangt de
  grondwaarheid niet. Dat dekken de synthetische fixtures in `check-mpp-import.ts`, die op letterlijke offsets
  schrijven.
- `buildCalExceptionsTail` (`mppFixtures.ts`) schrijft op offset 76 standaard 256, niet 1. Bij herhalingstype 1
  negeert `mppCalendars.ts` die bytes (de frequentie is daar vast 1); een standaard van 1 zou een voorwaarde die ten
  onrechte 1 op offset 76 eist, laten slagen.
- De tijdgrens van 5 s voor de 2000 gedegenereerde MONTHLY-records in `check-mpp-calendars.ts` is bewust ruim. De
  check draait ook in de tijdzonematrix op gedeelde CI-runners; de grens moet daar niet vals rood geven en ligt nog
  steeds ver onder de 46 s van de regressie die hij vangt.
- `check-mpp-fidelity.ts` sorteert de bestanden per map met `<` en niet met `localeCompare`, omdat de
  pad-pariteitscase het eerste bruikbare bestand neemt en die keuze niet mag afhangen van de ICU- of
  taalinstelling van de machine.
