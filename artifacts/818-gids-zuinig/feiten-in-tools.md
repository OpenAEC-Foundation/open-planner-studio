# Feiten die de agentteksten niet meer noemen, en waar een agent ze nu vindt

PR #836 (#818) haalt deze feiten uit de agentgids (`public/agent/planning-guide.md`) en de skills
(`public/skills/{goed-plannen,progress-update}/SKILL.md`). De regel uit de council-ronde: tool-specifieke
feiten horen in de toolbeschrijving, regels over meerdere tools in de gids.

De kolom "Waar nu" geldt voor `tools/list` zoals PR #838 (`perf/818-toolbeschrijvingen-zuinig`, head
`b0ef49262`) hem maakt, samen met deze PR. Er zijn drie soorten plekken:

- **tools/list**: in de beschrijving van de tool ("desc") of van een parameter ("schema `x`"). Een agent ziet
  dat vóór de eerste aanroep.
- **alleen in het antwoord**: in de envelop, een veld, een foutmelding of een waarschuwing. Een agent ziet dat
  pas na de aanroep.
- **initialize**: in `MCP_INSTRUCTIONS`, die bij het koppelen meegaat.

"deels" betekent: een deel staat in `tools/list`, de rest staat erachter. Haal een feit met "tools/list" daar
niet weg zonder het terug te zetten in de gids of een skill.

| # | Feit | Tool | Waar nu |
|---|---|---|---|
| 1 | Een leestool rekent een verouderde planning eerst bij; de envelop draagt dan `scheduleRecalculated: true` | elke leestool met berekende waarden | tools/list, desc ("Recalculates a stale schedule first."); de vlag alleen in het antwoord |
| 2 | De uitkomst staat in `schedule.projectEnd`, de projectduur en `criticalTasks` | `planner_get_project_info` | deels: desc noemt "project end" en `criticalTasks`; het veld `schedule.projectEnd` alleen in het antwoord |
| 3 | Een batch is één undo-stap, één berekening, één backup; een fout draait alles terug | `planner_batch` | deels: desc noemt undo-stap, berekening en terugdraaien; de backup alleen in het antwoord (`backupCreated`) |
| 4 | Binnen een batch begint elk `tempId` met `tmp-`; latere stappen krijgen het echte id | `planner_batch` | tools/list, desc |
| 5 | Een leesstap in een batch heeft alleen als laatste zin; ids vooraf opzoeken | `planner_batch` | tools/list, desc ("look up ids before") |
| 6 | Uitgesloten als batchstap: `planner_batch`, undo/redo, document- en bestandstools, `planner_save_baseline` | `planner_batch`, `planner_save_baseline` | tools/list, desc van beide |
| 7 | Hoogstens 100 stappen | `planner_batch` | tools/list, desc |
| 8 | Een mijlpaal heeft duur 0 | `planner_add_tasks` | tools/list, schema `duration`; de weigering van `duration` > 0 alleen in het antwoord |
| 9 | `milestoneKind`: `START`, `FINISH`, `null` = automatisch | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `milestoneKind` |
| 10 | `mandatory` is alleen een markering voor rapporten | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `mandatory` ("Reporting marker only.") |
| 11 | `endDate` dwingt niets af; het stuurt wel de spanne van gegenereerde feestdagen | `planner_update_project`, `planner_update_calendar` | deels: desc ("`endDate` enforces nothing."); dat `endDate` meetelt voor de spanne van `generate`, staat niet in `tools/list`. De gids houdt het ("set `endDate` first") |
| 12 | `startDate` verschuift geen bestaande taken; een latere trekt worteltaken naar voren (`anchorsClamped`); de hele planning verschuif je met `planner_move_project` | `planner_update_project` | tools/list, desc |
| 13 | `tempId` begint met `tmp-` of `tmp_`; `parentId` = bestaand id of `tempId` uit dezelfde aanroep | `planner_add_tasks` | tools/list: desc (`parentId`), schema `tempId` (voorbeeld `tmp-foundation`); de vaste voorvoegsels letterlijk alleen bij `planner_manage_resources` |
| 14 | Een samenvattingstaak krijgt geen duur | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `duration` ("Summary task: derived, omit it."); de weigering alleen in het antwoord. De gids houdt de regel ook |
| 15 | `planner_delete_tasks` wist de hele subboom; `cascadedTaskIds` noemt wat mee ging | `planner_delete_tasks` | tools/list, desc |
| 16 | Zonder `duration` krijgt een taak de standaardmaat (normaal 5 werkdagen) | `planner_add_tasks` | tools/list, desc |
| 17 | Een dagduur mag een breuk zijn; `FIXED_WORK` rekent in uren; uren vragen een kalender met werktijd | `planner_add_tasks`, `planner_update_tasks` | deels: schema `duration` (breuk, `FIXED_WORK` in uren); de eis van een kalender met werktijd alleen in het antwoord |
| 18 | `durationType`: `WORKTIME` (standaard) of `ELAPSEDTIME` | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `durationType` (enum, uitleg `ELAPSEDTIME`); dat `WORKTIME` de standaard is, staat er niet |
| 19 | `lag` in dagen of in procenten van de voorganger | `planner_add_dependencies`, `planner_update_dependencies` | tools/list, schema `lag` |
| 20 | Het `seqId` staat na `#` in `rels`; een relatie wijzig je met `planner_update_dependencies`, niet met verwijderen + toevoegen | `planner_get_project_overview`, `planner_update_dependencies` | tools/list, desc van beide |
| 21 | Een samenvattingstaak als voorganger of opvolger geldt voor zijn bladtaken | `planner_add_dependencies` | tools/list, desc |
| 22 | Een kringverwijzing wordt geweigerd en draait de aanroep terug | `planner_add_dependencies`, `planner_update_dependencies`, `planner_move_task` | deels: desc van beide relatietools; bij `planner_move_task` alleen in het antwoord |
| 23 | `zonder_relaties` telt ook relaties op bovenliggende samenvattingstaken | `planner_list_tasks` | tools/list, desc |
| 24 | Een datum vastzetten kan alleen met `constraint`; `null` wist; `ASAP`/`ALAP` zonder datum. Er is geen start- of eindveld | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `constraint`; de velden in het schema kennen geen start of einde |
| 25 | `hard` alleen bij `MSO`/`MFO` | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `constraint` |
| 26 | `deadline` begrenst alleen het late einde | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `deadline` |
| 27 | Welke kalender de projectstandaard is, kan niet via de tools wisselen | `planner_get_calendars` | tools/list, desc |
| 28 | `generate` vervangt de feestdagenlijst; `rawHolidays` voegt toe en verbreekt de koppeling met de generator (`becameLiteral`); `holidaysMode: "replace"` = precies de lijst | `planner_update_calendar` | tools/list, desc en schema `holidaysMode`. De gids houdt de valkuil: na `rawHolidays` opnieuw `generate` wist de losse dagen |
| 29 | `generate` neemt land, regio en voor NL `bouwvak` | `planner_update_calendar` | tools/list, schema `generate` |
| 30 | Een resourcekalender zet je met `calendarId` | `planner_manage_resources` | tools/list, schema `calendarId` |
| 31 | `maxUnits` = capaciteit per werkdag (1 = één persoon of stuk) | `planner_manage_resources` | tools/list, schema `maxUnits` |
| 32 | Toewijzen alleen op een bladtaak, één resource één keer per taak | `planner_manage_assignments` | tools/list, desc |
| 33 | Onder `FIXED_WORK`/`FIXED_RATE` verandert een toewijzing de duur | `planner_manage_assignments` | tools/list, desc. De gids houdt de regel ook |
| 34 | Toewijzingen gaan in bulk: één aanroep is één undo-stap | `planner_manage_assignments` | deels: het schema `actions` is een lijst; "één undo-stap" staat nergens. De skill goed-plannen houdt "alle toewijzingen in één aanroep" |
| 35 | Het histogram geeft zonder argumenten een samenvatting per resource, met `resourceIds`/`van`/`tot` de details; `bucket` | `planner_get_resource_histogram` | tools/list, desc en schema `bucket`; de veldnamen (`peakLoad`, `overallocatedDayCount`) alleen in het antwoord |
| 36 | `constrainToFloat: true` houdt het einde vast; `false` laat het schuiven | `planner_level_resources` | tools/list, desc; `unresolved` en `projectEndDelta` alleen in het antwoord |
| 37 | `drivingRelations`: `null` = onbekend, `[]` = geen | `planner_get_critical_path` | tools/list, desc |
| 38 | De float van één taak (totaal en vrij) en de vroege en late datums | `planner_get_task` | deels: desc noemt `totalFloat` en de late datums; vrije float alleen in het antwoord. De skill goed-plannen houdt "`planner_get_task` (float of one task)" |
| 39 | `kritiek` telt ook samenvattingstaken (`summary: true`) | `planner_list_tasks` | tools/list, desc |
| 40 | IFC-export overschrijft geen bron in een schema dat de app niet schrijft; export verandert het opslagdoel niet | `planner_export_ifc` | tools/list, desc |
| 41 | Zonder statusdatum wordt elke voortgangsregel geweigerd | `planner_update_tasks` | tools/list, desc |
| 42 | Notatie van de statusdatum | `planner_update_project` | tools/list, schema `statusDate` |
| 43 | In `progress` alleen `completion`, `actualStart`, `actualFinish` | `planner_update_tasks` | tools/list, schema `progress` (drie velden); de weigering van andere sleutels alleen in het antwoord |
| 44 | Geplande start na de statusdatum zonder `actualStart` ⇒ geweigerd | `planner_update_tasks` | tools/list, desc |
| 45 | Werkelijke datums niet na de statusdatum; einde niet vóór start; `null` wist | `planner_update_tasks` | tools/list, schema `actualStart`, `actualFinish` |
| 46 | Een samenvattingstaak krijgt geen voortgang | `planner_update_tasks` | tools/list, desc |
| 47 | Geweigerde regels: de geldige gaan door | `planner_update_tasks`, `planner_batch` | deels: desc ("A refused item changes nothing on that task", batch: `rejections` zijn zacht); dat één taak zowel bijgewerkt als geweigerd kan zijn, alleen in het antwoord |
| 48 | Duurwijziging op een lopende taak: gedaan werk blijft; korter dan gedaan ⇒ geweigerd | `planner_update_tasks` | deels: desc (voorbeeld 10 d bij 40 %); de weigering alleen in het antwoord. De skill progress-update houdt de rekenregel |
| 49 | Afwijkingen per taak: `late`/`early`/`new`/`dropped`, delta's in werkdagen | `planner_compare_baseline` | deels: desc (afwijkingen, werkdagen); de soorten alleen in het antwoord |
| 50 | Delta's tellen in werkdagen van de huidige projectkalender | `planner_compare_baseline` | tools/list, desc |
| 51 | Zonder actieve baseline weigeren vergelijken en vertraging analyseren | `planner_compare_baseline`, `planner_analyze_delay` | alleen in het antwoord (foutmelding "No active baseline …"). De skill progress-update houdt de vraag aan de gebruiker |
| 52 | `projectEndDeltaAvailable: false` = onbekend, niet nul | `planner_analyze_delay` | alleen in het antwoord |
| 53 | Waar een skill te installeren is en de download-URL's | `planner_get_planning_guide` | alleen in het antwoord (`install`, `missing`) |
| 54 | Undo is gedeeld met de gebruiker; een what-if gaat in een kopie | `planner_undo`, `planner_duplicate_document` | tools/list, desc van beide |
| 55 | `scheduleStale` op een leesantwoord: de gebruiker bewerkt nog; lees later opnieuw | elke leestool | alleen in het antwoord (`scheduleNote`, `EDIT_IN_PROGRESS_NOTE` in `tools/runtime.ts`) |
| 56 | `datesAsRecorded`: de datums komen uit het geïmporteerde bestand, niet uit een berekening | elke tool | initialize en het antwoord (`scheduleNote`, `DATES_AS_RECORDED_NOTE`). Gids en skill houden de toestemmingsregel |
| 57 | Nivelleren: eerst `dryRun: true`; `planner_clear_leveling` maakt het ongedaan | `planner_level_resources`, `planner_clear_leveling` | tools/list, desc en schema `dryRun`. Gids en skill houden "alleen op verzoek" |

Wat de teksten bewust houden, ook al staat het deels ook in een toolbeschrijving: herberekenen, `planner_batch`
voor een samenhangende reeks, `duration` altijd met `durationUnit`, geen duur op een samenvattingstaak, de
toestemming vóór een wijziging bij `datesAsRecorded`, de kalendervalkuil, "nooit optellen" bij vertraging, en
de regels over geraden werkelijke datums. Die leiden tot een foute planning als een agent ze mist.
