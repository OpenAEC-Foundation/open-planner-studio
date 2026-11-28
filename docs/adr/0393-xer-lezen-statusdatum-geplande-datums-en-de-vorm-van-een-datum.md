# XER lezen: de statusdatum, ontbrekende geplande datums en de vorm van een datum

De statusdatum van een XER-project is `PROJECT.last_recalc_date`. `projectStatusDate` leest `data_date` alleen als de
kolom `last_recalc_date` in de PROJECT-tabel ontbreekt; een lege of onleesbare `last_recalc_date` geeft geen
statusdatum, ook niet naast een geldige `data_date`. `last_recalc_date` is de canonieke kolom, en een lege of
onleesbare waarde daarin is bewust geen reden om `data_date` te lezen (`check-xer-project-data-date.ts`, de gevallen "beide last leeg data
geldig" en "beide last ongeldig data geldig").

## Gevolgen

- Een datum leest `sourceInstant` (`xerInstant.ts`): op een kalender in uurmodus met kloktijd, anders als datum.
  `suspend_date`, `resume_date` en `expect_end_date` lezen per veld met hun eigen vorm (`sourceX7Instant`): met
  kloktijd een moment, zonder een datum, los van de kalender, omdat een kloktijd in een ander veld de kalender tot
  uurkalender kan maken (`check-xer-x7-hour-mode.ts`, "gemengde reader bewaart per X7-veld exact zijn eigen
  bronvorm").
- Zonder leesbare `target_start_date` wordt de geplande start de statusdatum, anders `PROJECT.plan_start_date`, elk
  gelezen met de kalender van de taak, dus in uurmodus met de kloktijd van de cel. De lezer zet dat anker zelf, omdat
  `resolveMissingScheduleDates` (`importDates.ts`) alleen het datumdeel van een projectstart gebruikt; hij krijgt hier
  een lege projectstart. Heeft het project geen van beide, dan krijgt de taak tijdelijk `0001-01-01`
  (`MISSING_START_PLACEHOLDER`), en `resolveMissingScheduleDates` vervangt elke start uit zijn lijst door het datumdeel
  van de vroegste geplande start van de andere taken, anders door vandaag. De openingsmelding telt elke activiteit
  zonder geplande start (`xerMissingPlannedStarts`), ook als ze een anker kreeg (`check-import-missing-schedule-dates.ts`;
  `check-xer-project-data-date.ts`, "scheduleStart = statusdatum").
- Zonder leesbare `target_end_date` begint het einde gelijk aan de start, en `resolveMissingScheduleDates` rekent het
  einde uit start en duur op de kalender van de taak (`finishFromStartAndDuration`). Lukt dat niet, dan houdt de taak
  het einde dat de lezer zette: de gelezen of verankerde start, en zonder anker de tijdelijke `0001-01-01`, ook als de
  start al vervangen is (knownbug 2462).
- De vroege en late datums in `task.time` zijn bij het lezen de geplande datums, nooit de opgeslagen rekenuitvoer
  (`check-xer-reader.ts` 10; regel `xer`, bak 4).
- Een `TT_FinMile` in uurmodus met dezelfde start en hetzelfde einde, precies één minuut na het begin van het eerste
  werkblok van die dag, krijgt als start dat blokbegin en als einde het werkmoment daarvoor (`prevWorkInstant`). Alleen
  die combinatie: een andere activiteitsoort, een andere minuut of een mijlpaal op het blokbegin zelf blijft zoals in
  het bestand.
  `check-xer-reader.ts` 3g leest 08:01 en eist na het rekenen, met conventie A17 aan, start 08:00 en einde 17:00 op
  de werkdag ervoor.
- `project.startDate` is de vroegste geplande start van de activiteiten, na de aanvulling hierboven. `project.endDate`
  is zonder `useProjectEndDateForFloat` het laatste geplande einde, en met die optie `PROJECT.plan_end_date` of leeg
  (ADR 0181; `check-xer-reader.ts` 2 en 13c). `createdAt` is de projectstart, `modifiedAt` de statusdatum en zonder
  statusdatum de projectstart.
