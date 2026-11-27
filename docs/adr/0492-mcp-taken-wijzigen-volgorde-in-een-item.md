# Taken wijzigen via MCP: de volgorde binnen één item

Een item van `planner_update_tasks` kan `fields` en `progress` samen dragen. `updateTasksCore` verwerkt eerst
`fields` en daarna `progress`, en een weigering van het ene houdt het andere niet tegen: een geweigerd `fields`-blok
schrijft niets, en een `progress` in hetzelfde item loopt toch (beschrijving van de tool, ADR 0241). Binnen `fields`
geldt de volgorde hieronder, zodat een geweigerde duur ook de rest van het blok tegenhoudt.

## Gevolgen

- `draft.patchTaskFields` komt eerst. Weigert die (`refused`: een duur korter dan het gedane werk van een lopende
  taak), dan schrijft het item uit `fields` niets: de draft keert terug vóór de taak verandert, en `updateTasksCore`
  zet dan ook het eigen taaktype (`ensureCustomTaskType`) en de werkregel niet. Een geweigerde duurpatch zet dus geen
  eigen taaktype in de catalogus. Langs andere weg kan de catalogus wel een type houden dat geen taak gebruikt, zoals
  in de app: een latere update van die taak naar een ingebouwd type laat het staan. De writer schrijft alleen gebruikte
  definities (`writeTaskTypeMeta` met `savedCustomTaskTypes`). De reden van de weigering
  (`durationBelowDoneWorkReason`) noemt het gedane werk in werkdagen of uren en de kortste toegestane duur. Pas na een aanvaarde patch volgen het taaktype en de werkregel
  (`draft.setTaskWorkRule`, ADR 0243).
- Draagt het item ook `progress`, dan geeft de tool `deferCompletion` mee (ADR 0243): een duur die gelijk wordt aan
  het gedane werk zet de taak op 100 %, maar `settleEditedDuration` voert de afronding (`finishDurationProgress`) dan
  nog niet uit, zodat de opgegeven voortgang beslist. Weigert het voortgangsblok, en staat de taak na de duurpatch op
  `completion` 1 of meer zonder `actualFinish`, dan roept de tool `finishDurationProgress` alsnog aan. Dat gebeurt
  alleen als de duurpatch een voortgangsaanpassing gaf.
- `progress` wordt eerst op zijn vorm getoetst (`parseProgress`): `applyProgressUpdate` leest alleen `completion`,
  `actualStart` en `actualFinish`, dus een onbekende sleutel of een leeg blok zou anders als toegepast terugkomen.
  Toetsen: `cases-stille-noops-taken.ts`, de gevallen K3.
- `progressAdjusted` is de uitkomst van de duurpatch (`outcome.progress` van `draft.patchTaskFields`), vastgelegd
  vóór het voortgangsblok van hetzelfde item: `completion` in procent, van 0 tot en met 100, op twee decimalen (de taak
  houdt de onafgeronde fractie), en `remaining` op twee decimalen in uren als de uitkomst `remainingMinutes` draagt
  (`durationUnit: 'hours'`), anders `remainingTime` in dagen. Toets: `cases-duration-progress.ts`, de gevallen
  "lopende kalendertijdtaak, 24 uur …" (de toets eist `{ completion: 50, remaining: 12, durationUnit: 'hours' }`).
  Draagt het item ook `progress` en wordt dat aanvaard, dan beslist dat de eindstand, en kan `progressAdjusted` een
  andere voortgang noemen dan de taak na de aanroep heeft (knownbug 2532).
- Het schema van `fields` is `TASK_FIELD_SCHEMA_PROPERTIES_BARE`: dezelfde velden, typen en grenzen als bij
  `planner_add_tasks`, zonder beschrijving per veld (#818, zuiniger toolbeschrijvingen). Een assistent die alleen
  deze tool laadt, ziet die uitleg dus niet; de beschrijving van `fields` verwijst daarom naar `planner_add_tasks` en
  noemt één valkuil (`constraint` legt een datum vast, `deadline` niet).
