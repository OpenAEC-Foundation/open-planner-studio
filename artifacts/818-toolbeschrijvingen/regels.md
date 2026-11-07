# Regels in de toolbeschrijvingen (#818)

Per tool staan hier de regels uit de oude beschrijvingen die een agent moet kennen. Bij elke regel staat waar hij
in de nieuwe tekst staat, of waarom hij weg mag. "tool" = de toolbeschrijving, "param `x`" = de beschrijving van
parameter `x`.

Redenen om iets weg te laten:

- **schema**: het schema zegt het al (naam, type, enum, verplicht veld, grens, `additionalProperties: false`).
- **antwoord**: het antwoord van de tool meldt het zelf, met een veld of een weigering met reden. De agent hoeft
  het niet vooraf te weten om de aanroep goed te doen. Voorbeelden: `scheduleNote` bij een niet-verse planning,
  `itemRejections` bij een geweigerd item, `phaseTransitions`, `cascadedTaskIds`.
- **detail**: uitleg of achtergrond zonder invloed op de aanroep, de planning of de data.
- **dubbel**: stond op twee plekken (tool en param, twee tools, of tool en instructies); één plek blijft.

Wat bewust bleef: elke regel die zonder voorkennis tot een foute aanroep, een foute planning, een fout verslag aan de
gebruiker of dataverlies leidt. Een weigering achteraf is geen ramp, maar een stille verkeerde uitkomst wel; die
regels staan er allemaal nog.

Het invoercontract is gelijk: geen naam, type, enum, `required`, `default` of `pattern` is veranderd, en de handlers
weigeren precies wat ze eerst weigerden. De enums blijven volledig staan, ook de lange: de constrainttypen
(`ASAP` … `MFO`), de bouwvakwaarden (`geen`/`noord`/`midden`/`zuid`), `bucket` (`dag`/`week`/`maand`), de
landcodes, `shift`, `workRule`, `taskType` en de curves. Vier bewuste uitzonderingen in wat het schema TOONT
(fixronde 1 en 3):

- De uurbanden (`workTime.byWeekday.<dag>[]`, `workingExceptions[].bands[]`) tonen per veld geen `type: number`,
  `minimum` en `maximum` meer. De schemapoort toetste de binnenkant van array-items nooit (DIEPTE-REGEL in
  `schemaValidate.ts`), dus die grenzen hielden geen aanroep tegen. `bandListReason` weigert met een reden een band
  zonder getallen, met `start` buiten 0–1439, met `end` ≤ `start`, met `end` > 2880 en met overlap
  (`cases-uurkalender` test 3, ook met een negatieve start). Hij vangt niet alles wat het oude schema noemde: een
  gebroken minuut zoals `{start: 1439.5, end: 1440}` of `{start: 0, end: 0.5}` gaat erdoor. Dat is zo op `main` en
  op deze branch; het staat als knownbug 933. De grenzen staan één keer in param `byWeekday`.
- `byWeekday` noemt de zeven weekdagen niet meer elk als `properties` met hetzelfde dagschema; één dagschema staat nu
  als `additionalProperties` (fixronde 3). De beschrijving noemt de sleutels "1" … "7". De handler toetst de
  sleutels zelf (`workTimeReason`: onbekende sleutel en ontbrekende dag geweigerd). De schemapoort kent sinds
  fixronde 3 ook een schema als `additionalProperties` (test `cases-schemavalidatie`); bij planner_update_calendar
  toetst hij die laag niet, want de kalenders zijn array-items.
- De afgeleide leesvelden van planner_get_calendars (`isProjectDefault`, `usedByTasks`, `usedByResources`,
  `libraryOrigin`) staan niet meer in het schema van planner_update_calendar: ze leken schrijfbaar. `items` heeft geen
  `additionalProperties: false`, dus een teruggestuurd object blijft geldig; de handler meldt ze als `ignoredFields`.
- `planner_inspect_xer_provenance.collection` noemde `issues` twee keer; nu één keer (zelfde verzameling waarden).

`tools/list` en de SuperCloud-export geven alle vier de annotaties door, precies zoals op `main` (fixronde 3; zie
§ Annotaties).

`planner_get_planning_guide` (in `guideTools.ts`) is niet aangeraakt: PR #836 (`docs/818-gids-zuinig`) herschrijft die
tool en de gids.

## Gedeelde stukken

| regel | nieuwe plek |
|---|---|
| `tempId` begint met `tmp-`/`tmp_` | schema `pattern` bij add_tasks; tool planner_batch; param `tempId` bij manage_resources (daar zonder pattern; de code weigert) |
| Onbekende sleutel in taakvelden wordt geweigerd | schema `additionalProperties: false`; tool add_tasks ("one invalid item fails the whole call"); tool update_tasks ("a refused `fields` block changes nothing") |
| `status`, `parentId`, `resourceIds` zijn geen schrijfvelden van update_tasks; route via `progress`, move_task, manage_assignments | `TASK_FIELDS_DOC`, nu alleen in update_tasks. In add_tasks stond hij ook, maar daar is `parentId` juist wél een veld: die zin was daar fout en is weg |
| `time` is geen schrijfveld | schema (`additionalProperties: false`); de weigering noemt `duration` |
| `duration` in de maat van `durationUnit`; zonder eenheid werkdagen; een fractie blijft exact | param `duration` (test `cases-taskfields`: "fraction") |
| FIXED_WORK-taak staat altijd in uren (dagen × uren per dag) | param `duration` |
| Mijlpaal: duur 0; verzameltaak: duur afgeleid, weglaten | param `duration` |
| Dag- en uurmaat per rekenprofiel (OPS: een werkdag = een dag; P6/MSP: dagen × werktijd) | weg: detail; de agent geeft dagen zoals de gebruiker ze noemt, het profiel rekent |
| `durationUnit` samen met `duration` geven; weggelaten = dagen | param `durationUnit` + tool update_tasks (fixronde 1: een uurtaak "2 uur langer" als `{duration: 18}` werd 18 werkdagen) |
| Uurmaat vraagt een taakkalender met werktijd | param `durationUnit` (F17; ook een dagkalender met begin- en eindtijd telt, dus "working hours", niet "`workTime`") |
| `durationType`: standaard WORKTIME | param `durationType` (F18) |
| `isMilestone: true` zet duur 0 (niet op verzameltaak of taak met toewijzingen); `false` laat 0 staan tot je `duration` stuurt | param `isMilestone` |
| `taskType` is de werkcategorie, niet het taaktype `workRule` | param `taskType` |
| `customTaskType` zet USERDEFINED; een bestaand id houdt zijn naam | param `customTaskType` |
| Constraint: `null` wist; `date` nodig behalve ASAP/ALAP; `hard` alleen MSO/MFO; null/ASAP/ALAP wissen ook de secundaire; ongeldig paar geweigerd | param `constraint`; de typen staan als enum |
| `deadline` begrenst alleen de late finish | param `deadline` |
| `calendarId`: bibliotheekkalender; `null` = projectkalender | param `calendarId` |
| `workRule`: vier waarden met betekenis en MSP/P6-namen ("Fixed Units" betekent in MSP en P6 iets anders); wisselen verandert geen getal; `null` = projectstandaard; alleen gewone bladtaken | param `workRule`. Fixronde 5: kort, "which part … stays fixed, as the name says"; de lijst uitzonderingen blijft, want de code weigert daar niet: de enumcontrole in `taskFields.ts` laat een regel op een mijlpaal of verzameltaak door, en daar doet hij niets (`workRuleApplies`). Daarom ook "elsewhere it has no effect" |
| Veldbeschrijvingen van add_tasks en update_tasks.fields | dubbel: alleen bij add_tasks; update_tasks zegt "`fields` take the same fields as planner_add_tasks items" (`TASK_FIELD_SCHEMA_PROPERTIES_BARE`: zelfde schema zonder beschrijvingsTEKSTEN; het taakveld `description` blijft, fixronde 1, test `cases-taskfields`) |
| Fase-overgang: toewijzingen gaan naar de eerste nieuwe subtaak (`phaseTransitions`) | `PHASE_TRANSITION_DOC` in add_tasks en move_task; dat een mijlpaal zijn vlag verliest en wanneer de aanroep faalt: antwoord |
| Lag: getal of "+2d", fractie toegestaan, negatief = lead, "+50%" van de voorganger, andere vorm geweigerd; een lag zetten wist de andere lagvormen | param `lag`, zonder "Other forms are refused. Replaces any other lag form" (fixronde 4: een andere vorm wordt geweigerd met een reden, en één relatie heeft één lag; test `cases-update-dependencies` toetst nog "fraction") |
| `LAG_DOC` in de toolbeschrijvingen | dubbel met param `lag`; de constante is weg |
| Relatietype: lange of korte vorm (FS/FF/SS/SF) | schema: de enum noemt beide |
| Verse planning bij leestools: eerst herberekenen, zonder undo-stap; `scheduleRecalculated: true` | één zin in tool get_project_info (de SuperCloud-export heeft geen instructies) + `MCP_INSTRUCTIONS`; `FRESH_NOTE` in zeven tools is weg (F1) |
| Uitzonderingen op verse datums (`datesAsRecorded`, `scheduleStale` tijdens een bewerking, `scheduleError`) | antwoord: de envelop draagt dan `scheduleNote` of `scheduleError`. `datesAsRecorded` en `scheduleError` staan ook in `MCP_INSTRUCTIONS` |
| Paginering: GEHELE `limit` 1–1000 (standaard 50), gehele `offset` ≥ 0; bij de optionele: een van beide zet paginering aan, geen van beide geeft alles | `optionalPageNote` / `OPTIONAL_PAGE_SCHEMA`: "`limit` (integer 1–1000, default 50) and/or `offset` (integer ≥ 0) page …; omit both for all" (fixronde 4: "neither returns all" was dubbelzinnig; `optionalPage` geeft zonder beide sleutels de hele lijst) |
| "One call = one undo step" bij de bulktools | tool manage_assignments (F34) en planner_batch; bij de andere bulktools weg: detail |
| "Refused items are listed; valid ones apply" bij de bulktools | update_tasks: tool (F47); elders weg: antwoord (`itemRejections`) |

## planner_add_tasks

| regel | nieuwe plek |
|---|---|
| Geneste WBS in één aanroep; items in elke volgorde | tool |
| `parentId` = bestaand id of tempId uit dezelfde aanroep; weggelaten = wortel | tool + param `parentId` |
| `tempId` uniek in de aanroep; latere batchstappen mogen hem gebruiken | param `tempId` ("later steps of the same planner_batch", fixronde 5: "later planner_batch steps" kon als een latere batch gelezen worden) |
| `position` = index tussen de broers | param `position`; dat hij geklemd wordt: weg (de taak komt altijd ergens geldig) |
| Zonder `duration`: projectstandaard (5 werkdagen; 5 uur bij uurmaat in het OPS-profiel) | tool, als "normally 5 working days": de agent hoort zelf een duur te geven |
| Eén ongeldig item laat de hele aanroep falen (alles-of-niets) | tool |
| Antwoord: `created` (tempId → id) | tool; datums en projecteinde: antwoord |

## planner_update_tasks

| regel | nieuwe plek |
|---|---|
| `fields` = dezelfde velden als add_tasks, zonder voortgang | param `fields` (fixronde 3): "The fields of planner_add_tasks items (meaning per field there); `constraint` fixes a date, `deadline` does not". Wie alleen update_tasks laadt, ziet zo de valkuil en waar de uitleg staat |
| Een geweigerd `fields`-blok verandert niets; `progress` werkt los daarvan, dus één id kan in `updated` én `itemRejections` staan | tool (F47; fixronde 1: "a refused item changes nothing on that task" klopte niet, test `cases-taskfields`) |
| Onbekende sleutel en lege `progress` geweigerd | schema + antwoord |
| Voortgang vraagt een statusdatum; vraag hem aan de gebruiker, kies hem nooit zelf | tool (fixronde 1: "never set automatically" beschreef de app, niet de agent; SuperCloud heeft geen instructies) |
| Werkelijke start- en einddatums van de gebruiker doorgeven | tool (fixronde 1: stond alleen in de oude instructies, en die krijgt SuperCloud niet) + `MCP_INSTRUCTIONS` |
| Actuals na de statusdatum geweigerd | param `actualStart`/`actualFinish` ("≤ status date"); in de tool weg, dubbel (fixronde 4) |
| `completion` > 0 leidt actualStart af, behalve als de geplande start na de statusdatum ligt: dan `actualStart` meegeven | tool |
| Geen `duration` en geen `progress` op verzameltaken (afgeleid) | tool (F14, F46) |
| Duurwijziging op een gestarte, niet afgeronde taak houdt het gedane werk (voorbeeld 10 d / 40 % → 12 d; `progressAdjusted`); korter dan het gedane werk wordt geweigerd | tool (F48; fixronde 3: "started, unfinished", zo werkt `workRuleApply.ts`) |
| Overschreven restwerk (`remainingWorkRecomputed`) aan de gebruiker melden | tool |
| Toewijzingen volgen de duur per `workRule` | param `workRule` bij add_tasks (de vier regels) |
| Hypothetische vertraging = duur of constraint, niet `progress` | tool |
| Eén id kan in `updated` én in de weigeringen staan | tool (F47, zie boven) |
| `actualFinish` ≥ `actualStart`; `null` wist | param `actualFinish` |

## planner_delete_tasks / planner_move_task

| regel | nieuwe plek |
|---|---|
| Verwijdert de hele subboom met relaties en toewijzingen; controleer `cascadedTaskIds` | tool |
| Onbekend id per item geweigerd; id dat al door een cascade verdween telt als succes | weg: antwoord |
| move_task: `newParentId: null` = wortel; `position` = index | tool |
| Onder zichzelf of een afstammeling; kring via verzameltaakrelaties (CYCLE) | tool move_task (F22, fixronde 1) |
| Fase-overgang | `PHASE_TRANSITION_DOC` |

## planner_add_dependencies / planner_update_dependencies / planner_remove_dependencies

| regel | nieuwe plek |
|---|---|
| Verzameltaak als eindpunt TOEGESTAAN (geldt voor de bladtaken) | tool add en update (test `cases-sync2-integration`) |
| Relatie naar een eigen voorouder geweigerd | tool add en update (test: "ancestor") |
| Kring = harde fout, hele aanroep terug | tool add en update |
| Onbekende ids, duplicaat, relatie met zichzelf, item zonder wijziging | weg: antwoord (zachte weigering per item) |
| Wijzigen via update_dependencies (houdt het id), niet verwijderen + toevoegen | tool update en remove (fixronde 3: bij add weg, dubbel) |
| `seqId` = deel na `#` in de leestools | tool update; het voorbeeld "→2.3 FS+2d #seq-7" staat bij get_project_overview |
| Alleen opgegeven velden veranderen | tool update |
| Dubbele seqIds geweigerd; antwoord `changes` | weg: antwoord |

## planner_undo / planner_redo

| regel | nieuwe plek |
|---|---|
| Alleen het ACTIEVE document | tool |
| Controleer `undone`/`redone`: `ok` zonder effect is mogelijk | tool |
| Geschiedenis gedeeld met de gebruiker, ook rasterinstellingen; what-if via duplicate_document | tool undo |
| `undoDepth`/`redoDepth`; redo-scopes | weg: antwoord / detail |

## planner_set_task_splits

| regel | nieuwe plek |
|---|---|
| Vervangt de lijst; `[]` wist | tool |
| Posities op de WERK-as (voorbeeld) | tool |
| Uurtaak: `afterWorkHours`/`pauseHours` | tool |
| Alleen hele eenheden; taak wordt langer, werk blijft | tool ("pauses extend duration", fixronde 5) |
| Niet splitsbaar: mijlpaal, verzameltaak, hamer, ELAPSEDTIME, handmatig | tool |
| Korter dan twee eenheden, niet-bewerkbare geïmporteerde splits, positie in gedaan werk, dag- en uursleutels mengen, alles-of-niets | weg: antwoord (fout met index en reden; er wordt niets geschreven) |

## planner_update_calendar

| regel | nieuwe plek |
|---|---|
| Bestaand id, of `create: true` met eigen label; gebruik daarna het teruggegeven echte `id` | tool |
| Onbekend id zonder `create` geweigerd | weg: antwoord |
| Kalender-id's per document; nooit een id uit een ander document | tool |
| `generate` VERVANGT de lijst; daarna voegt `rawHolidays` toe | tool (fixronde 3: "then", zo werkt `calendarGenerate.ts:75–91`) |
| `rawHolidays` VOEGT TOE, bestaande dagen blijven | tool (test `cases-stille-noops`: "add") |
| `holidaysMode: "replace"`: lijst wordt exact `rawHolidays` | tool (test: "replace") + param `holidaysMode`. Fixronde 3: "the only way to remove one" is weg, want het klopte niet: `holidays` vervangt ook exact |
| Lege `rawHolidays` in merge-modus geweigerd; `replace` met `[]` wist alles | weg: antwoord / volgt uit "exactly `rawHolidays`" |
| `holidays` vervangt exact; niet samen met `rawHolidays`/`holidaysMode`/`generate` | param `holidays` ("The complete list"); in de tool weg, dubbel (fixronde 5) |
| Losse dagen beëindigen de koppeling met de generator (`becameLiteral`) | tool |
| `create` zonder feestdagvelden erft de feestdagen van de app-standaard; geen feestdagen: `holidays: []` | tool (de route `generate: {country: "none"}` staat bij param `country`) |
| Overzetten: object uit get_calendars letterlijk terug, met `create: true` om te kopiëren | tool get_calendars; bij update_calendar weg, dubbel (fixronde 4) |
| Afgeleide leesvelden (`isProjectDefault`, `usedBy*`, `libraryOrigin`) genegeerd (`ignoredFields`) | antwoord; sinds fixronde 1 ook niet meer in het schema (ze leken schrijfbaar: "maak dit de projectkalender" via `isProjectDefault: true` deed niets) |
| Dagkalender met pauze: `hoursPerDay` afgeleid; wijzig de uren of de pauze | tool; de weigering van een afwijkende waarde: antwoord |
| Pauze buiten de werkdag of over de hele dag geweigerd | weg: antwoord |
| `generate` óf `generation`; `generation` schrijft alleen herkomst | param `generation` |
| `workTime` maakt een uurkalender, `null` terug naar dag | param `workTime` + tool |
| Taakduren houden hun getal en eenheid; datums kunnen schuiven | tool (fixronde 3, tekst van Sol). De oude param-tekst van `workTime` ("this redefines the duration of every task") sprak de toolbeschrijving tegen en was verouderd; die zin is weg |
| Bij `workTime` volgen `workDays` altijd; `hoursPerDay` alleen als hij gelijk was aan de modale dagsom van de oude banden (een bewuste afwijking zoals P6 `day_hr_cnt` blijft staan; een dagkalender volgt altijd); opgegeven `hoursPerDay` wint | tool (fixronde 4: "follow the bands unless `hoursPerDay` is given" klopte niet; code `calendarResourceTools.ts` bij `hoursPerDayForBlocks`, `subdayIo.ts`) |
| Alleen `workDays` op uurkalender: nieuwe dag kopieert de banden van de eerste dag met banden (zo, ma … za) | param `workDays` (fixronde 5: in fixronde 4 ten onrechte weg; het antwoord toont geen banden, dus een agent die vrijdag naar zaterdag "verplaatst", geeft zaterdag stil de banden van maandag). Code: `calendarFieldPatch` → `workDaysSetPatch` → `workDayTogglePatch` → `firstBlockedDay` |
| Terugval als geen dag banden heeft (eigen werkdag, dan 07–12 + 13–16) | weg: randgeval; zo'n kalender heeft geen werktijd en faalt al; wie banden wil, geeft `workTime` |
| Ongebruikte kalenders overleven IFC opslaan + laden; geen taak nodig om hem te bewaren | weg (fixronde 3): detail, er gaat niets verloren en de aanroep verandert er niet door. Het behoud toetst `cases-uurkalender` |
| Uurbanden per weekdag overleven IFC | weg: geruststelling zonder invloed op de aanroep |
| Taken passen niet meer (`cappedTaskIds`); geen werktijd over ⇒ hele aanroep terug | weg: antwoord |
| `generate`-bereik in jaren | param `generate` |
| Landcode exact uit de lijst; `none` wist gegenereerde dagen | schema enum + param `country` (test `cases-stille-noops`: "none") |
| `bouwvak` alleen NL | param `bouwvak` + enum |
| `byWeekday`: alle zeven sleutels verplicht; banden {start, end} in minuten, oplopend, niet overlappend; `[]` = vrije dag; `start` 0–1439, `end` > `start` en ≤ 2880, telt door na middernacht (voorbeeld) | param `byWeekday`, één keer. Het dagschema is alleen `{type: array, items: {type: object, required: [start, end]}}`; het staat nog twee keer: als `additionalProperties` van `byWeekday` en bij `workingExceptions[].bands` |
| `workStartHour`/`workEndHour` in UREN, pauzevelden in MINUTEN | params |
| `workingExceptions`: complete lijst, vervangt; `bands` optioneel | param `workingExceptions` |
| Datums inclusief | param `endDate` van feestdag- en uitzonderingsitems |

## planner_manage_assignments

| regel | nieuwe plek |
|---|---|
| Velden per actie | tool. Fixronde 5: `update` noemt zijn velden (`unitsPerDay`/`curve`/`remainingWorkMinutes`; andere resource = remove + add), want de handler negeert een andere sleutel stil (knownbug 934) |
| Alleen op bladtaken, geen mijlpalen, geen dubbele resources | tool |
| Onder FIXED_WORK/FIXED_RATE veranderen eenheden of een extra resource de DUUR; onder de standaardregel zet `remainingWorkMinutes` de eenheden | tool |
| Lees de taak opnieuw voor de nieuwe duur | tool |
| `unitsPerDay`: 1 = één persoon voltijd | param `unitsPerDay` |
| `remainingWorkMinutes` in werkminuten | param; "alleen gewone bladtaak op werktijd, materiaal telt niet": antwoord / detail |
| `curve` weggelaten = UNIFORM | param `curve` |
| Dubbele resource ook binnen één aanroep geweigerd | volgt uit "no … duplicate resources" |
| Eén aanroep = één undo-stap | tool (F34) |

## planner_manage_resources

| regel | nieuwe plek |
|---|---|
| Tegenhanger van manage_assignments | tool (test `cases-resource-crud`) |
| Velden per actie | tool |
| `null` wist een veld; weggelaten sleutel blijft | tool |
| `description` leegmaken met `""`, niet `null` | param `description` |
| VERWIJDEREN wist ook alle toewijzingen; met toewijzingen alleen met `cascade: true` | tool |
| Ploeglidmaatschap van de leden vervalt bij verwijderen | tool: "Deleting a CREW also clears its members' `parentId`" (fixronde 4: het antwoord meldt het pas achteraf, en een CREW zonder eigen toewijzingen gaat zonder `cascade` weg; code `purgeResource`) + antwoord (`orphanedCrewMemberIds`) |
| `tempId` (`tmp-`/`tmp_`) bij `create`, echt id in `created`; latere batchstappen | tool ("later steps of the same planner_batch", fixronde 5) + param `tempId` |
| Bibliotheekresource: vijf velden vast; bied de gebruiker de twee routes | tool |
| Wat het project bepaalt blijft schrijfbaar | weg: volgt uit de lijst vaste velden |
| `maxUnits` per WERKDAG, standaard 1; `type` standaard LABOR; `unitOfMeasure` alleen MATERIAL; `parentId` = CREW-resource; `availabilitySteps` | params |
| Veldnamen gelijk aan list_resources | tool list_resources |

## planner_level_resources / planner_clear_leveling

| regel | nieuwe plek |
|---|---|
| `constrainToFloat: true` (standaard) binnen de speling, einde vast, overgebleven pieken in `unresolved`; `false` mag het einde verschuiven (`projectEndDelta`) | tool (F36) |
| Materiaal nooit genivelleerd | tool |
| Eerst `dryRun: true`; verandert niets | tool + param `dryRun` |
| Nivelleren reset zichzelf; herhalen stapelt niet | tool |
| `delays`, `shifts`, `recomputed` | weg: antwoord |
| clear_leveling vóór level_resources is zinloos | dubbel: level_resources zegt "Resets earlier leveling itself" (fixronde 1; test `cases-mutate-cal-res` toetst nu die zin) |

## planner_update_project / planner_move_project / planner_save_baseline

| regel | nieuwe plek |
|---|---|
| `startDate` = anker voor NIEUWE taken, schuift de planning niet; zet hem vóór add_tasks | tool |
| Een latere `startDate` klemt wortelankers zonder voorganger of constraint naar voren (`anchorsClamped`) | tool (F12; test `cases-project-start-anchor`) |
| Hele planning verschuiven = move_project | tool (test `cases-mutate-cal-res`) |
| `statusDate` = DATA DATE; niet-gestart werk (completion 0) schuift naar die datum, ook zonder voortgang; alleen zetten voor voortgang (`statusDateEffect`) | tool + param `statusDate` (test `cases-statusdatum`) |
| Statusdatum wissen maakt actuals inert | tool |
| `statusDate` met tijd tot de minuut (`YYYY-MM-DDTHH:mm`) | param `statusDate` (test `cases-statusdatum`) |
| `endDate` dwingt niets af, maar bepaalt het bereik van gegenereerde feestdagen | tool (F11) + param `generate` |
| Onbekend veld geweigerd met de lijst | weg: schema + antwoord |
| `defaultWorkRule`: `null` = FIXED_DURATION_RATE; FIXED_WORK zet taken zonder eigen regel om naar uren, ook na terugschakelen | param `defaultWorkRule` |
| move_project: hele planning; kalenders schuiven niet, dus het einde kan anders schuiven; baselines alleen met `shiftBaselines` | tool |
| Ankers van externe koppelingen schuiven niet mee | weg: detail; het antwoord meldt het verschil |
| save_baseline: wordt de actieve baseline; niet in een batch | tool |
| Verouderde planning eerst herberekend (`recomputed`) | weg: antwoord |

## Basislijnen (list / activate / rename / delete)

| regel | nieuwe plek |
|---|---|
| list_baselines geeft de ids en welke actief is | tool |
| activate: maat voor compare/analyze; `null` = geen | tool |
| Al actief (`changed: false`), dubbele naam (`warning`) | weg: antwoord |
| compare/analyze weigeren zonder actieve baseline | tool compare_baseline en analyze_delay (F51) |
| rename: naam niet leeg | tool |
| delete: niet te herbouwen; actieve weg ⇒ laatste overgebleven wordt actief | tool |

## Documenten

| regel | nieuwe plek |
|---|---|
| list_documents: om varianten te vergelijken; `title` is geen projectnaam; alleen het actieve document wordt herberekend, andere kunnen `scheduleStale` zijn | tool |
| `notCalculated`, `calculationError`, `datesAsRecorded` per rij | weg: antwoord (zelfverklarende velden) |
| new_document: wordt actief, latere aanroepen gaan daarheen; kopie via duplicate | tool |
| Zonder wizard, standaardkalender | weg: detail |
| duplicate_document: voor what-if; naamregel; latere aanroepen gaan naar de kopie, eerst terugschakelen; sluiten laat je aan de gebruiker | tool |
| De kopie heeft geen bestandspad en een eigen undo-geschiedenis | weg: detail |
| switch_document: lost DOC_DRIFT op | tool |
| Ids per document (bij switch_document) | dubbel: update_calendar en import_schedule zeggen het; een taak-id uit een ander document geeft NOT_FOUND (fixronde 1) |

## Bestanden (alleen desktop en headless; niet in de SuperCloud-set)

| regel | nieuwe plek |
|---|---|
| export_ifc: ACTIEF document, compleet, alleen in de thuismap ("home folder" blijft: de headless server vertaalt die term) | tool |
| Bestaand bestand alleen met `overwrite: true` | tool |
| Export, geen "opslaan als"; document blijft onopgeslagen | tool |
| Noem het pad aan de gebruiker | tool |
| Bronbestand van een onschrijfbaar schema (IFC2X3), of een bestand dat niet aantoonbaar anders is, wordt niet overschreven: kies een nieuwe naam of laat de gebruiker in de app opslaan | tool (F40) |
| `ifcSchema`, `schemaNotice` | antwoord; tool: "pass on `schemaNotice`" (fixronde 4: bij een IFC2X3-bron schrijft de export IFC 4.3 ADD2, en alleen `schemaNotice` zegt dat) |
| import_schedule: formaten; opent als nieuw actief document; niets samengevoegd | tool |
| Verlies per formaat aan de gebruiker melden | tool |
| `notice` doorgeven (o.a. herberekende oudere IFC) | tool; `minuteModelConversion`: antwoord |
| Gebruik `documents` uit het antwoord (één bestand kan meer documenten openen) | tool |
| Kalender-id's per document; herbouwen met update_calendar | tool |
| Alleen een IFC-import neemt het bronpad als opslagdoel; leeg tabblad hergebruikt; `documentId` | weg: detail |

## Leestools

| regel | nieuwe plek |
|---|---|
| get_project_info: goede eerste aanroep; `criticalTasks` alleen bladtaken; `schedule.projectEnd` en `projectDuration` | tool (F2; test `cases-read`) |
| `statusDate` = DATA DATE, kan het projecteinde bepalen | tool: "`statusDate` is the DATA DATE: it pushes unstarted work forward and can set the project end" (fixronde 4; test `cases-statusdatum` eist "DATA DATE") |
| `schedulingOptions.leveling` uit een bronbestand wordt niet toegepast | tool |
| `schedulingProfile`, `startToStartLagFrom` | weg: leesinformatie, geen aanroep |
| get_project_overview: elke relatie één keer, één aanroep genoeg; `id` voor muterende tools; `parentId` voor de boom; `#seq` = seqId | tool (test `cases-stille-noops`: `id`) |
| `wbs` alleen-lezen en afgeleid; `wbsCode` geen schrijfveld | weg (fixronde 1): schema; `fields` heeft `additionalProperties: false` en de weigering noemt de toegestane velden |
| Veldenlijst van de rij | weg: antwoord |
| list_tasks: filters met AND; `kritiek` telt verzameltaken mee (`summary: true`); venster inclusief; `zonder_relaties` alleen bladtaken | tool (test `cases-read`) |
| get_task: vroege en late datums, totale en vrije speling | tool (F38) |
| get_task en get_critical_path: speling in werkdagen van de taakkalender, ook bij een uurtaak; ELAPSEDTIME in kalenderdagen | tool, één gedeelde zin `FLOAT_UNIT_NOTE` (fixronde 3, council-ronde 3 op #836: main zei het in de gids en in het voorbeeld van get_task; #836 haalt het uit de gids). Code: `CPMSolver.signedFloat`. Test `cases-uurkalender`: 4 uur naast 8 uur ⇒ `freeFloat` 0.5 |
| get_task: `interruptions` in de vorm van set_task_splits; `effectiveId` → `calendarId`; negatieve speling; `actualFinishAdjusted` | tool (test `cases-statusdatum`) |
| Verzameltaak leidt voortgang af | tool update_tasks |
| MPP- en P6-bronvelden alleen-lezen | weg: schema (geen schrijfveld) |
| get_critical_path: `drivingRelations` null vs `[]`; paginering over `criticalTasks` | tool |
| `pathsMode`, `criticalPaths` alleen bij FREE_FLOAT | weg: antwoord |
| list_resources: veldnamen gelijk aan manage_resources; `library.lockedFields` | tool |
| get_resource_histogram: samenvatting zonder filters (`peakLoad`, `overallocatedDayCount`), buckets met filters; weekoverhang | tool (F35) |
| Onbekend id = fout; grens 10000 buckets | weg: antwoord (fout met uitweg) |
| Bucketwaarden zijn Nederlands | enum + param `bucket` |
| get_calendars: object letterlijk terug te schrijven, `create: true` in een ander document; projectkalender: schrijf naar de kalender met het id uit `projectDefaultId`; standaard alleen in de app te wisselen | tool (F27; fixronde 1: "update its `projectDefaultId`" was dubbelzinnig) |
| compare_baseline: afwijkingen `late`/`early`/`new`/`dropped`; maat is de huidige kalender | tool (F49, F50) |
| analyze_delay: impact = `projectEndDelta`, nooit optellen | tool |
| Geen actieve baseline ⇒ weigering | tool compare en analyze (F51) |
| `projectEndDeltaAvailable: false` = onbekend, niet 0 | tool analyze_delay (F52) |

## planner_batch

Aanvulling van de orkestrator: PR #836 haalde deze details uit de agentgids; ze staan nu alleen hier.

| regel | nieuwe plek |
|---|---|
| Max. 100 stappen | tool (test `cases-batch`: "100") + schema `maxItems` |
| Eén undo-stap, één herberekening, één backup; gebruik voor een samenhangende reeks | tool (F3; de "wanneer"-zin stond eerst in `MCP_INSTRUCTIONS`) |
| Een falende stap ⇒ hele batch terug; weigeringen per item zacht (`rejections`) | tool |
| tempId wordt in LATERE stappen van deze batch vervangen, nooit in vrije tekst | tool ("Later steps of this batch", fixronde 5) |
| Args liggen vast: alleen een laatste leesstap is zinvol; ids vooraf opzoeken | tool (test `cases-batch`: "final") |
| Uitgesloten: planner_batch, undo/redo, document- en bestandstools, planner_save_baseline, planner_get_planning_guide, planner_inspect_xer_provenance | tool (F6; fixronde 4: de laatste twee zijn `batchable: false` en ontbraken, nagelopen tegen `checkExclusions`) |
| Rapport per stap bij een fout; "geen scripttaal" | weg: antwoord / volgt uit "args are fixed at submission" |

## planner_inspect_xer_provenance

| regel | nieuwe plek |
|---|---|
| Alleen-lezen, niet batchable | tool |
| Zonder `includeRawRows` alleen id/code/label | tool |
| Met `includeRawRows` vrije tekst; niet voor summary en rawSource | param `includeRawRows` |
| Elke pagina onder 256 kB, BEHALVE rawSource (max. 8 chunks van ~256 kB base64, samen ~2,1 MB) | tool (test `cases-xer-provenance`: "EXCEPT rawSource") + param `limit` ("8 chunks of ~256 kB", fixronde 5; chunk = 192 KiB bron) |
| rawSource vraagt `includeRawSource: true` ÉN `includeResourceNames: true`; taskSourceRowsByProject vraagt `projectId` | params `includeRawSource` en `includeResourceNames` (fixronde 1: de tweede vlag was weg; `{section: "rawSource", includeRawSource: true}` werd geweigerd) |
| Resourcenamen verborgen; eerst toestemming, want persoonsgegevens gaan naar de AI-aanbieder | tool; param `includeResourceNames` verwijst ernaar ("see above") |
| Afkapgrenzen (200/2.000 tekens, 200 cellen), `archiveIssue`-codes, `sourcePresent` | weg: antwoord |

## MCP_INSTRUCTIONS (`src/services/mcp/dispatcher.ts`)

Aanvulling van de orkestrator. De instructies gaan in elke systeemprompt mee. Ze houden de kernregels die
`tests/mcp/cases-planning-guide.ts` vastlegt; wat een tool doet staat in zijn eigen beschrijving, de uitleg per
principe in de agentgids.

| regel | nieuwe plek |
|---|---|
| Echte planning waar iemand op vertrouwt | instructies ("people rely on", fixronde 5) |
| Begin bij mijlpalen en opleverdatum | instructies (test: "milestone") |
| Taken van een dag tot twee weken; verzameltaken geen eigen duur | instructies (test: "two weeks") |
| Waarom (te fijn onbeheersbaar, te grof onstuurbaar) | weg: gids |
| Relaties, geen vaste datums; FS standaard; elke taak een voorganger en opvolger; constraints alleen voor harde externe datums; nooit negatieve lag | instructies (test: "Finish-to-start", "negative lag") |
| Hoogstens een paar procent constraints | weg: gids |
| Geen aparte herbereken-stap; leestools frissen een verouderde planning op, zonder undo-stap; resultaat lezen met get_project_info en get_critical_path | instructies, kort: "Changes and reads recalculate by themselves" (test). De details (welke leestools, geen undo-stap, `scheduleRecalculated`) staan bij get_project_info (F1, fixronde 4) |
| `datesAsRecorded`: datums uit het bestand; meld dat; de eerste wijziging rekent ze opnieuw | instructies: "say so when you report dates" (test). De rest zegt `scheduleNote` (`DATES_AS_RECORDED_NOTE`), die elke envelop met `datesAsRecorded` draagt (fixronde 4) |
| `scheduleError`: eerst oplossen; een wijziging die het laat staan wordt teruggedraaid | instructies (test) |
| Gebruik planner_batch voor een samenhangende reeks | dubbel: nu in tool planner_batch |
| Voortgang vraagt de statusdatum van de gebruiker; nooit verzinnen | instructies (test: "status date") |
| Werkelijke start- en einddatums van de gebruiker doorgeven | instructies + tool update_tasks (fixronde 1: het was weg) |
| Afsluiten met de aannames en wat je niet deed | instructies: "Report what you assumed … and what you omitted" (test: "assumed") |
| Gids en skills via planner_get_planning_guide; bij voortgang `part: "progress-update"` | instructies (test). De URL is weg: elke client heeft de tool. `progress-update` als `part` bestaat pas met PR #836; zonder #836 weigert de tool hem met de geldige waarden |

## Annotaties (fixronde 3: terug zoals op `main`)

`tools/list` (desktopbridge, headless server) en de SuperCloud-export gaan door één functie, `toolListEntry` in
`src/services/mcp/toolListing.ts`. Die geeft alle vier de hints door, ook als een hint gelijk is aan de
MCP-standaardwaarde. In fixronde 1 liet hij die weg; dat is teruggedraaid. Reden (council-ronde 2): Claude Code leest
een ontbrekende `destructiveHint` en `openWorldHint` als `false`, niet als de standaard uit de spec. Weglaten
veranderde dus wat een client doet, en het leverde geen modeltokens op: een Anthropic-tooldefinitie heeft geen veld
`annotations`. De meting telt de annotaties daarom apart, niet als winst.

De tests over annotaties (`cases-sync2-integration`, `cases-mutate-tasks`, `cases-mutate-cal-res`, `cases-protocol`,
`cases-headless-server`, `cases-externe-client`, de echte-app-run in `tests/mcp/realApp/`) en `docs/mcp-verificatie.md`
zijn weer gelijk aan `main`.

## Headless en Claude Desktop-bundel (fixronde 1)

Deze teksten komen per sessie bovenop `MCP_INSTRUCTIONS`.

| regel | nieuwe plek |
|---|---|
| headless: geen app, planning in het geheugen, geen UI, niemand anders bewerkt | `headlessInstructions` (test: "Headless mode") |
| headless: bestanden alleen in de werkmap; "home folder" in tooltekst = de werkmap; `~/x.ifc` ligt erin | `headlessInstructions` |
| headless: geen opslaan of autosave; schrijven met planner_export_ifc (`overwrite: true` voor het geopende bestand); niet geëxporteerd = weg bij stoppen | `headlessInstructions` |
| headless: zolang de app draait geen bestaand bestand vervangen (SCOPE); nieuwe naam; lezen mag | `headlessInstructions` (test: "the server does not replace an existing file") |
| absolute paden moeten in de werkmap blijven | volgt uit "Files only inside the working folder" |
| bundel: app met bridge, anders de planner zonder app op de werkmap; `~/plan.ifc`; geen autosave, bewaren met planner_export_ifc | `bundleInstructions` |
| bundel: wisselt zelf bij openen of sluiten van de app en meldt dat in het volgende antwoord; daarna eerst het document opnieuw kiezen | `bundleInstructions` |

## Voorstellen uit de council die ik niet letterlijk overnam

| voorstel | wat ik deed | waarom |
|---|---|---|
| Kalendertekst van Sol (−360) | ronde 1: eigen kortere versie (−81). Fixronde 3: Sols punten overgenomen na controle in de code | "`generate` replaces, then `rawHolidays` adds" klopt (`calendarGenerate.ts:75–91`). "Task durations keep their number and unit" zegt hetzelfde als "never converted". "Never reuse an id from another document" bleef staan. "The only way to remove one" is weg: het klopte niet |
| Resourcetekst van Sol | bijna letterlijk | klopt met de code |
| `wbs`-zin 2× | allebei weg | het schema biedt `wbs`/`wbsCode` niet aan en de handler weigert met de lijst; test `cases-stille-noops` toetst nu het schema |
| `FRESH_NOTE` alleen in `MCP_INSTRUCTIONS` | ook één zin bij get_project_info | de SuperCloud-export heeft geen instructies (F1) |
| Laatste regel `MCP_INSTRUCTIONS`: `part: "progress-update"` | overgenomen | die `part`-waarde bestaat pas met PR #836. Zonder #836 weigert de tool hem met de geldige waarden (geen stille fout) |

## Afstemming met PR #836: de 53 feiten uit `artifacts/818-gids-zuinig/feiten-in-tools.md`

Stand: deze branch na fixronde 4. "tool" = beschrijving, "param" = parameterbeschrijving, "schema" = enum/grens/pattern.
F1–F52 stonden bij de vorige head (b0ef49262) deels niet meer in `tools/list`; de zestien die Sol in council-ronde 2 van
#836 noemde, zijn gemarkeerd met *.

| # | status | plek |
|---|---|---|
| F1* | staat er | tool get_project_info ("Reads of dates, float, critical path or load refresh a stale schedule first (no undo step; `scheduleRecalculated: true`)") + `MCP_INSTRUCTIONS` (kort) |
| F2* | staat er | tool get_project_info (`schedule.projectEnd`, `projectDuration`, `criticalTasks`) |
| F3* | staat er | tool planner_batch ("one undo step, recalculation and backup"; "A failed step rolls back all") |
| F4 | staat er | tool planner_batch (`tmp-…`) + schema `pattern` `^tmp[-_]` bij add_tasks |
| F5 | staat er | tool planner_batch |
| F6 | staat er | tool planner_batch |
| F7 | staat er | tool planner_batch + schema `maxItems` |
| F8 | staat er | param `duration` ("Milestone: 0 (more is refused)") |
| F9 | staat er | param `milestoneKind` + enum (update_tasks via "the same fields") |
| F10 | staat er | param `mandatory` |
| F11* | staat er | tool update_project ("sets the span of generated holidays") + param `generate` |
| F12* | staat er | tool update_project ("root tasks without predecessor or constraint") |
| F13 | staat er | param `tempId` (voorbeeld `tmp-…`) + schema `pattern`; param `parentId` + tool add_tasks |
| F14 | staat er | param `duration` (add_tasks) + tool update_tasks ("No `duration` or `progress` on summary tasks") |
| F15 | staat er | tool delete_tasks |
| F16 | staat er | tool add_tasks |
| F17* | staat er | param `durationUnit` ("`hours` needs a task calendar with working hours") + param `duration` (breuk, FIXED_WORK in uren) |
| F18* | staat er | param `durationType` ("Default WORKTIME") |
| F19 | staat er | param `lag` |
| F20 | staat er | tool get_project_overview + update_dependencies |
| F21 | staat er | tool add_dependencies |
| F22 | staat er | tool add_dependencies + move_task |
| F23 | staat er | tool list_tasks |
| F24 | staat er | param `constraint` ("The only way to fix a date") + enum |
| F25 | staat er | param `constraint` |
| F26 | staat er | param `deadline` |
| F27 | staat er | tool get_calendars |
| F28 | staat er | tool update_calendar + param `holidaysMode` |
| F29 | staat er | schema enum `country`, param `region`, enum `bouwvak` |
| F30 | staat er | param `calendarId` (manage_resources) |
| F31 | staat er | schema enum `action` + param `maxUnits` |
| F32 | staat er | tool manage_assignments |
| F33 | staat er | tool manage_assignments |
| F34* | staat er | tool manage_assignments ("One call = one undo step") |
| F35* | staat er | tool get_resource_histogram (`peakLoad`, `overallocatedDayCount`) + enum `bucket` |
| F36* | staat er | tool level_resources (`unresolved`, `projectEndDelta`) |
| F37 | staat er | tool get_critical_path |
| F38* | staat er | tool get_task ("early/late dates, total and free float") |
| F39 | staat er | tool list_tasks |
| F40 | staat er | tool export_ifc ("choose a new file name or let the user save in the app") |
| F41 | staat er | tool update_tasks + param `statusDate` |
| F42 | staat er | param `statusDate` |
| F43 | staat er | schema `progress` (drie velden, `additionalProperties: false`, `completion` 0–100) |
| F44 | staat er | tool update_tasks |
| F45 | staat er | param `actualStart`/`actualFinish` |
| F46 | staat er | tool update_tasks |
| F47* | staat er | tool update_tasks ("an id may be both `updated` and in `itemRejections`") |
| F48* | staat er | tool update_tasks (`progressAdjusted`; "less than the work done is refused") |
| F49* | staat er | tool compare_baseline (`late`/`early`/`new`/`dropped`) |
| F50 | staat er | tool compare_baseline |
| F51* | staat er | tool compare_baseline en analyze_delay ("refused without one") |
| F52* | staat er | tool analyze_delay (`projectEndDeltaAvailable: false` = unknown, not 0) |
| F53 | staat er | het antwoord van planner_get_planning_guide (`guideTools.ts`, niet aangeraakt) |
