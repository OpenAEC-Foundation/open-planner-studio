# Een poolitem naar het project kopiëren

Toewijzen aan het project (`addLibraryCalendarToProject` en `addLibraryResourceToProject` in
`src/state/slices/librarySlice.ts`) maakt een kopie met `copyCalendarToProject` of `copyResourceToProject` in
`src/services/library/libraryOps.ts`: een nieuw project-id en een herkomststempel met de hash van het poolitem. Dat een
bestaande kopie met dezelfde herkomst hergebruikt wordt, staat in `docs/library.md` (*Drie acties verbinden de
werelden*). Een poolresource draagt verwijzingen die alleen binnen de pool iets betekenen. We kozen ervoor dat
`copyResourceToProject` die niet overneemt, zodat de kopie in het project niet naar een resource of kalender wijst
die daar niet bestaat.

## Gevolgen

- Wat hieronder over `calendarId` en `parentId` staat, geldt voor een nieuwe kopie. Bestaat er al een kopie met
  dezelfde herkomst, dan geeft `copyResourceToProject` die projectresource direct en ongewijzigd terug.
- `calendarId`: alleen als de poolresource een `calendarId` heeft dat in `pool.calendars` staat, kopieert
  `copyResourceToProject` die kalender mee (`copyCalendarToProject`, met hergebruik van een bestaande kopie) en wijst
  `calendarId` naar de projectkopie; die staat in `travelingCalendar`. In elk ander geval is `calendarId` van de kopie
  leeg.
- Een kostenresource (`isCostResource`, issue #815) neemt geen kalender mee, ook niet als een oud poolitem er nog een
  draagt, en `clearCostResourceFields` wist haar werkvelden. Toets: N4 in `tests/planning/check-cost-resource.ts`.
- `parentId` (de ploeg) wordt leeg: het wijst naar een andere poolresource, en het project heeft die ploeg niet per se.
  Geen toets houdt dit vast. `applyResourceUpdate` neemt alleen `RESOURCE_DIFF_FIELDS` over, dus `parentId` en
  `calendarId` van een projectkopie blijven bij verversen staan. Alleen als de bijgewerkte resource `COST` is, wist
  `clearCostResourceFields` ze, ook als ze dat vóór het verversen al was. Een typewissel van of naar `COST` bij een
  resource met toewijzingen weigert `resourceUpdateBlocked`; dan verandert alleen de herkomststempel.
- De andere richting, een projectresource promoveren, laat `parentId` en `calendarId` ook weg (ADR 0171).
