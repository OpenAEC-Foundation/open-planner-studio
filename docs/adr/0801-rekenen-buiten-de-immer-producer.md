# Rekenen buiten de Immer-producer

`runCPM` en `recomputeResourceLoad` (`scheduleSlice.ts`) rekenen op de bevroren staat uit `get()` en zetten alleen het
resultaat in de `set`-producer. Rekenen op de draft lijkt eenvoudiger, maar de solver en de belasting lezen elke taak,
relatie, toewijzing en kalender; via de draft maakt Immer voor al die objecten een proxy die aan het eind weer
gefinaliseerd moet worden, en dat was zichtbaar traag voor een berekening die bijna niets schrijft. De solver rekent
daarom op een kloon van de taken (`cloneTasksForSolve`), zodat de bevroren invoer en de undo-snapshots onaangeroerd
blijven.

## Gevolgen

- `runCPM` vergelijkt de uitkomst met de gewone invoer en laat een taak met ongewijzigde tijden staan, zodat een
  F5 zonder verschil dezelfde objecten houdt (`sameTaskTime`).
