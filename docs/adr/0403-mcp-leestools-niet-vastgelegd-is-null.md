# In "datums zoals opgeslagen" geeft een leestool een niet-vastgelegde waarde als onbekend

In "datums zoals opgeslagen" draagt `task.time` de vastlegging van het bronbestand. Voor wat het bestand niet
vastlegde, staan er terugvallen (de late datum is de vroege, speling 0, niet kritiek; ADR 0331 en 0332), en de
taaktabel toont daar "Niet vastgelegd". Een agent ziet die tabel en de strook boven de planning niet, en zou een
verzonnen nulspeling of "niet kritiek" als feit lezen. De leestools geven zo'n waarde daarom als `null`, of tellen
haar apart. Welke velden van een taak niet vastgelegd zijn, zegt `unrecordedExportGate`
(`state/recordedDatesSelectors.ts`); buiten de modus geeft die `undefined` en is het antwoord zoals zonder deze
regel. In de modus rekent een leestool ook niet door (`ensureFreshScheduleForRead`); de envelop meldt
`datesAsRecorded`.

## Gevolgen

- `planner_get_task` geeft `lateStart`, `lateFinish`, `totalFloat`, `freeFloat` en `isCritical` als `null` als ze
  niet vastgelegd zijn, en noemt ze in `datesAsRecordedUnrecordedFields`, want `null` alleen zegt niet of een waarde
  onbekend is of leeg gelaten. Toetsen: `cases-recorded-dates.ts`, "leestools in de modus: niet-vastgelegde assen
  komen als null naar buiten …" (een vastlegging met alleen het vroege paar; de toets eist de vroege start, `null` op
  de vijf velden en die lijst) en "leestools buiten de modus: …" (na F5: getallen en geen extra veld).
- Op de rijen van het overzicht en van `planner_list_tasks` is een onbekende kritieke vlag `crit: null` in plaats van
  een weggelaten veld. Het filter `kritiek` laat zo'n taak zowel bij `true` als bij `false` weg.
  `planner_get_project_info` telt zulke bladtaken niet in `criticalTasks` maar in `criticalUnrecordedTasks`, dat
  alleen meekomt als het boven 0 is. Toets: `cases-recorded-dates.ts`, "leestools in de modus: kritiek is onbekend,
  …" (twee taken zonder vastgelegde kritieke vlag; de toets eist 0 en 2 in de projectinformatie, `null` in overzicht
  en lijst, niets bij beide filters, en na F5 geen `null` en geen extra veld).
- `planner_get_critical_path` geeft `totalFloat: null` voor een kritieke taak zonder vastgelegde totale speling.
  Geen toets dekt die tak.
- `drivingRelations` is `null` als de bepalende relaties onbekend zijn (`knownDrivingSequenceIds`: geen resultaat,
  een rekenfout of `drivingUnknown`), en `[]` als er geen zijn. Met een geldig resultaat zegt een `note` dat `null`
  niet "geen" betekent. Toetsen: `cases-recorded-dates.ts`, "get_critical_path: opgeslagen datums geven onbekende
  driving, …" (de toets eist `null`, de `note`, de vastgelegde kritieke taken en het projecteinde, en dat de lezing
  niets doorrekent of vervangt), en in `cases-read.ts` "berekend zonder relaties is een bekende lege lijst" en
  "ontbrekende of mislukte berekening geeft onbekende driving". Een grens in de modus: knownbug 2329.
