# Verversen uit de bibliotheek wist de redo per gekoppeld document

Een poolbewerking ververst de kopieën in de geopende documenten via `refreshAllDocumentsFromPool` in
`librarySlice.ts`. Welke items stil verversen (`behind`) en welke blijven staan (`deviated`), en dat zo'n verversing
niet ongedaan te maken is en de redo wist, staat in `docs/library.md` (*De vier verversingsgrenzen* en
*Ctrl+Z/verversing-eigenaardigheid*). Hier staat waarom de redo-wis niet aan het aantal treffers hangt.

`refreshAllDocumentsFromPool` roept `invalidateDocumentRedo` aan voor elk geopend document dat aan het bedrijf
hangt, actief of slapend, ook als daar niets ververst werd. Een redo-stap van vóór de poolbewerking kan
anders een toestand terugzetten die op de oude pool rust. Het blok "F4" in `tests/library/check-library-slice.ts`
toetst het geval dat dit voorkomt: materialiseren, undo, en dan een poolbewerking die in dat document niets
ververst. Wat de functie verder per document met en zonder treffer doet, staat in `refreshAllDocumentsFromPool`.

## Gevolgen

- In een slapend document werkt de verversing ook `payload.calendar` bij (`refreshProjectCalendarCache` op de
  payload), want Automatisch opslaan geeft een slapende payload zonder hydrate door (het blok "F1 (vloot-fixpakket)"
  in `check-library-slice.ts`). De werkregel-settle van een slapend document gaat naar
  `DocumentEntry.pendingWorkRuleSettle`; de melding komt bij `switchDocument`.
- Het strookgetal van *datums zoals opgeslagen* telt `recountRecordedShift` na de producer opnieuw, op de bevroren
  staat, met één `set` voor alleen de nieuwe tellers. Binnen de producer zou de doorrekening een Immer-proxy per
  taak maken. Dat geldt voor `refreshAllDocumentsFromPool` en voor `resolveDeviation('company')` met een kalender.
  Het getal zelf toetst `tests/planning/check-recorded-dates-library.ts`.
- `updatePoolCalendar` doet niets als de update gelijk is aan het poolitem (`sameValue` per veld): de kalendereditor
  in de Bibliotheekweergave stuurt bij Toepassen de hele draft, en een bump zonder wijziging zou via de verversing
  toch de redo van de gekoppelde documenten wissen. Toets 4G in `tests/planning/check-calendar-dialog-commits.ts`
  dekt de poolversie.
- `resolveDeviation('file')` schrijft de bestandswaarden in het poolitem en wist daarna zelf de redo van het actieve
  document, vóór de verversing van de andere documenten (het blok "GO-NA-fix (critreview op 3870ef9)" in
  `check-library-slice.ts`).
