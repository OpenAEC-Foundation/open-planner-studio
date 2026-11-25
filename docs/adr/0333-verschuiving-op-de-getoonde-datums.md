# Een taak verschuift als haar getoonde datums veranderen, en een onbekende teller wordt niet verzonnen

De strook van "datums zoals opgeslagen" zegt hoeveel taken Berekenen (F5) verschuift. `recordedDatesDeviate`
(`src/engine/scheduler/recordedDates.ts`) vergelijkt daarvoor de getoonde start en het getoonde einde
(`shownStart`/`shownFinish`) van de berekende taak met die van dezelfde taak zoals de modus haar zou tonen:
`earlyStart`/`earlyFinish` uit het record, en bij een record met `summaryProgress` ook haar voortgang en werkelijke
datums. Eigenaarsbesluit 2026-10-12, optie 1: een verschil dat de gebruiker nooit ziet, mag de modus niet aanzetten.
Een blad met een werkelijke start telt dus niet om haar vroege start, en een voltooid blad (`isPinnedComplete`) telt
nooit; een lopend blad met een werkelijke start telt alleen als haar (rest)einde verschuift. Dat P6 voor zo'n taak een
vroege start op de statusdatum vastlegt en P3 zelfs een vroeg einde vóór die start, komt uit het weggehaalde
commentaar; de vorm van P3 staat in `check-recorded-dates.ts` 2g (rehab-2). Een lopend blad zonder werkelijke start
(alleen voortgang) toont haar berekende start en kan dus ook op alleen haar start meetellen. Toets: 2g tot en met 2l.

## Gevolgen

- `shiftedTaskIds` is de enige meting; `countShiftedTasks` is haar lengte. Zo geven de strook en het blok per taak in
  het eigenschappenpaneel hetzelfde antwoord. `check-recorded-dates.ts` 2l controleert de lijst: van een voltooid en
  een lopend blad met een ander einde staat alleen het lopende erin. `check-recorded-dates-library.ts` controleert de
  samenhang met de teller: na een bibliotheekverversing is de lengte van de lijst gelijk aan `shifted` (d2, d2b), en
  bij een fout van de berekening ontbreken beide (e1, e2).
- `RecordedDates` (wat `captureRecordedDates` levert) heeft geen teller: de vastlegging gebeurt vóór de berekening,
  en een plaatshouder 0 zou "niets verschuift" beweren. `RecordedDatesState.shifted` en `shiftedTaskIds` zijn daarom
  optioneel en worden samen gezet (`applyRecordedDatesOnLoad`, `recountShiftedAfterLibraryRefresh`,
  `minuteModelTransition`; de tweede wist ze samen bij een fout van de berekening). Een slapend hersteld document
  (`applyRestoredRecordedMode`) is niet berekend en heeft ze eerst niet; een verversing uit de bibliotheek
  (`recountShiftedAfterLibraryRefresh`) kan ze daarna alsnog vullen. Zolang ze ontbreken, toont
  `RecordedDatesNotice` de tekst zonder aantal en geeft `recordedTaskWillShift` `undefined`, zodat het
  eigenschappenpaneel er niets over zegt. Wat aan `times` hangt (de export, de kolommen "niet vastgelegd", de
  markering) werkt dan gewoon. De lijst per taak is een eigenaarsbesluit van 2026-10-17.
- `RecordedDatesState.origin` spiegelt `ImportResult.recordedTimesOrigin` als een lijst letterlijke waarden, zonder
  het type uit `src/services/` te importeren. `sourceFormat` is de oorspronkelijke bron met rekenuitvoer, die
  opslaan in de modus meeneemt (regel `state`, Datums zoals opgeslagen).
