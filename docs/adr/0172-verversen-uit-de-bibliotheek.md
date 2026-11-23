# Verversen uit de bibliotheek wist de redo per gekoppeld document

Een poolbewerking ververst de kopieën in de geopende documenten via `refreshAllDocumentsFromPool` in
`librarySlice.ts`. Welke items stil verversen (`behind`) en welke blijven staan (`deviated`), en dat zo'n verversing
niet ongedaan te maken is en de redo wist, staat in `docs/library.md` (*De vier verversingsgrenzen* en
*Ctrl+Z/verversing-eigenaardigheid*). Hier staat waarom de redo-wis niet aan het aantal treffers hangt.

`refreshAllDocumentsFromPool` roept `invalidateDocumentRedo` aan voor het actieve document en voor elke slapende
payload die aan het bedrijf hangt, ook als daar niets ververst werd. Een redo-stap van vóór de poolbewerking kan
anders een toestand terugzetten die op de oude pool rust. Het blok "F4" in `tests/library/check-library-slice.ts`
toetst het geval dat dit voorkomt: materialiseren, undo, en dan een poolbewerking die in dat document niets ververst.
Arrays toewijzen en `scheduleStale` zetten gebeurt wel alleen in een document met een treffer; daarvoor telt de
functie per document apart. Belasting en rijen rekent ze alleen opnieuw uit als er in een van de documenten een
treffer was.

## Gevolgen

- In een slapend document werkt de verversing ook `payload.calendar` bij (`refreshProjectCalendarCache` op de
  payload), want Automatisch opslaan schrijft een slapende payload zonder hydrate (het blok "F1 (vloot-fixpakket)" in
  `check-library-slice.ts`). De werkregel-settle van een slapend document gaat naar
  `DocumentEntry.pendingWorkRuleSettle`; de melding komt bij `switchDocument`.
- Het strookgetal van *datums zoals opgeslagen* telt `recountRecordedShift` na de producer opnieuw, op de bevroren
  staat, met één `set` voor alleen de nieuwe tellers. Binnen de producer zou de doorrekening een Immer-proxy per taak
  maken. Dat geldt voor `refreshAllDocumentsFromPool` en voor `resolveDeviation('company')` met een kalender. Het
  getal zelf toetst `tests/planning/check-recorded-dates-library.ts`.
- `updatePoolCalendar` doet niets als de update gelijk is aan het poolitem (`sameValue` per veld): de kalendereditor
  in de Bibliotheekweergave stuurt bij Toepassen de hele draft, en elke bump zou via de verversing de redo van elk
  gekoppeld document wissen. Toets 4G in `tests/planning/check-calendar-dialog-commits.ts` dekt de poolversie.
- `resolveDeviation('file')` schrijft de bestandswaarden in het poolitem en wist daarna zelf de redo van het actieve
  document, vóór de verversing van de andere documenten (het blok "GO-NA-fix (critreview op 3870ef9)" in
  `check-library-slice.ts`).
