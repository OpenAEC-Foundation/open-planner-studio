# Feiten die de agentteksten niet meer noemen, en waar een agent ze nu vindt

PR #836 (#818) haalt deze feiten uit de agentgids (`public/agent/planning-guide.md`) en de skills
(`public/skills/{goed-plannen,progress-update}/SKILL.md`). De regel uit de council-ronde: tool-specifieke
feiten horen in de toolbeschrijving, regels over meerdere tools in de gids.

De kolom "Waar nu" geldt voor `tools/list` zoals PR #838 (`perf/818-toolbeschrijvingen-zuinig`, head
`dca82ea0c`) hem maakt, samen met deze PR. Er zijn drie soorten plekken:

- **tools/list**: in de beschrijving van de tool ("desc") of van een parameter ("schema `x`"). Een agent ziet
  dat vóór de eerste aanroep.
- **alleen in het antwoord**: in de envelop, een veld, een foutmelding of een waarschuwing. Een agent ziet dat
  pas na de aanroep.
- **initialize**: in `MCP_INSTRUCTIONS`, die bij het koppelen meegaat.
- **alleen in de foutmelding**: een geval waarin de tool luid weigert; de melding zegt wat er mis is.

"deels" betekent: een deel staat in `tools/list`, de rest staat erachter. Haal een feit met "tools/list" daar
niet weg zonder het terug te zetten in de gids of een skill.

| # | Feit | Tool | Waar nu |
|---|---|---|---|
| 1 | Een leestool rekent een verouderde planning eerst bij, zonder undo-stap; de envelop draagt dan `scheduleRecalculated: true` | elke leestool met berekende waarden | tools/list, desc van `planner_get_project_info` ("Reads of dates, float, critical path or load refresh a stale schedule first (no undo step; `scheduleRecalculated: true`)"); ook initialize |
| 2 | De uitkomst staat in `schedule.projectEnd`, de projectduur en `criticalTasks` | `planner_get_project_info` | tools/list, desc |
| 3 | Een batch is één undo-stap, één berekening, één backup; een fout draait alles terug | `planner_batch` | tools/list, desc |
| 4 | Binnen een batch begint elk `tempId` met `tmp-`; latere stappen krijgen het echte id | `planner_batch` | tools/list, desc |
| 5 | Een leesstap in een batch heeft alleen als laatste zin; ids vooraf opzoeken | `planner_batch` | tools/list, desc ("read ids beforehand") |
| 6 | Uitgesloten als batchstap: `planner_batch`, undo/redo, document- en bestandstools, `planner_save_baseline`, `planner_get_planning_guide`, `planner_inspect_xer_provenance` | `planner_batch`, `planner_save_baseline` | tools/list, desc van beide (`planner_get_planning_guide` sinds #838 `f85cd894e`; daarvoor alleen in de foutmelding) |
| 7 | Hoogstens 100 stappen | `planner_batch` | tools/list, desc |
| 8 | Een mijlpaal heeft duur 0; meer wordt geweigerd | `planner_add_tasks` | tools/list, schema `duration` ("Milestone: 0 (more is refused)") |
| 9 | `milestoneKind`: `START`, `FINISH`, `null` = automatisch | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `milestoneKind` |
| 10 | `mandatory` is alleen een markering voor rapporten | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `mandatory` |
| 11 | `endDate` dwingt niets af, maar zet de spanne van gegenereerde feestdagen | `planner_update_project`, `planner_update_calendar` | tools/list, desc van `planner_update_project` en schema `generate` (ook de dekking zonder einde of bij `create`: start year + 3). De gids houdt de volgorde: `endDate` vóór `generate` |
| 12 | `startDate` verschuift geen bestaande taken; een latere trekt worteltaken naar voren (`anchorsClamped`); de hele planning verschuif je met `planner_move_project` | `planner_update_project` | tools/list, desc |
| 13 | `tempId` begint met `tmp-` of `tmp_`; `parentId` = bestaand id of `tempId` uit dezelfde aanroep | `planner_add_tasks` | tools/list: desc (`parentId`), schema `tempId` (`tmp-foundation`), desc van `planner_batch` (`tmp-…`) |
| 14 | Een samenvattingstaak krijgt geen duur | `planner_add_tasks`, `planner_update_tasks` | tools/list: schema `duration` ("Summary task: derived, omit it."), desc van `planner_update_tasks`; ook initialize |
| 15 | `planner_delete_tasks` wist de hele subboom; `cascadedTaskIds` noemt wat mee ging | `planner_delete_tasks` | tools/list, desc |
| 16 | Zonder `duration` krijgt een taak de standaardmaat (normaal 5 werkdagen) | `planner_add_tasks` | tools/list, desc. De gids houdt de regel: elke bladtaak een expliciete `duration` met `durationUnit` |
| 17 | Een dagduur mag een breuk zijn; `FIXED_WORK` rekent in uren; uren vragen een kalender met werktijd | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `duration` en `durationUnit` ("Always send it with `duration` (omitted = days)"), desc van `planner_update_tasks`. De gids zegt dat sinds ronde 6 niet meer; hij houdt alleen "expliciet, eenheid teruglezen" |
| 18 | `durationType`: `WORKTIME` (standaard) of `ELAPSEDTIME` | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `durationType` |
| 19 | `lag` in dagen of in procenten van de voorganger | `planner_add_dependencies`, `planner_update_dependencies` | tools/list, schema `lag` |
| 20 | Het `seqId` staat na `#` in `rels`; een relatie wijzig je met `planner_update_dependencies`, niet met verwijderen + toevoegen | `planner_get_project_overview`, `planner_update_dependencies` | tools/list, desc van beide |
| 21 | Een samenvattingstaak als voorganger of opvolger geldt voor zijn bladtaken | `planner_add_dependencies` | tools/list, desc |
| 22 | Een kringverwijzing wordt geweigerd en draait de aanroep terug | `planner_add_dependencies`, `planner_update_dependencies`, `planner_move_task` | tools/list, desc van alle drie |
| 23 | `zonder_relaties` telt ook relaties op bovenliggende samenvattingstaken | `planner_list_tasks` | tools/list, desc |
| 24 | Een datum vastzetten kan alleen met `constraint`; `null` wist; `ASAP`/`ALAP` zonder datum. Er is geen start- of eindveld | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `constraint` ("The only way to fix a date") |
| 25 | `hard` alleen bij `MSO`/`MFO` | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `constraint` |
| 26 | `deadline` begrenst alleen het late einde | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `deadline` |
| 27 | Welke kalender de projectstandaard is, kan niet via de tools wisselen | `planner_get_calendars` | tools/list, desc |
| 28 | `generate` vervangt de feestdagenlijst; `rawHolidays` voegt toe en verbreekt de koppeling met de generator (`becameLiteral`); `holidaysMode: "replace"` = precies de lijst | `planner_update_calendar` | tools/list, desc en schema `holidaysMode`. De gids houdt de valkuil: na `rawHolidays` opnieuw `generate` wist de losse dagen |
| 29 | `generate` neemt land, regio en voor NL `bouwvak`; zonder `bouwvak` maakt hij er geen | `planner_update_calendar` | tools/list, schema `generate` en `generate.bouwvak`. De gids noemt de bouwvak bij de sluitingen (ronde 5): wie hem vergeet, levert te vroeg op |
| 30 | Een resourcekalender zet je met `calendarId` | `planner_manage_resources` | tools/list, schema `calendarId` |
| 31 | `maxUnits` = capaciteit per werkdag (1 = één persoon of stuk) | `planner_manage_resources` | tools/list, schema `maxUnits` |
| 32 | Toewijzen alleen op een bladtaak, één resource één keer per taak | `planner_manage_assignments` | tools/list, desc |
| 33 | Onder `FIXED_WORK`/`FIXED_RATE` verandert een toewijzing de duur | `planner_manage_assignments` | tools/list, desc |
| 34 | Toewijzingen gaan in bulk: één aanroep is één undo-stap | `planner_manage_assignments` | tools/list, desc ("One call = one undo step."). De gids houdt "all assignments in one `planner_manage_assignments`" |
| 35 | Het histogram geeft zonder argumenten een samenvatting per resource (`peakLoad`, `overallocatedDayCount`), met `resourceIds`/`van`/`tot` de details; `bucket` | `planner_get_resource_histogram` | tools/list, desc en schema `bucket`. Dát je het leest na het toewijzen, staat in de gids (§Order 5, §Check "overloads"; ronde 6): toewijzen boven `maxUnits` slaagt zonder waarschuwing |
| 36 | `constrainToFloat: true` houdt het einde vast (`unresolved`); `false` laat het schuiven (`projectEndDelta`) | `planner_level_resources` | tools/list, desc |
| 37 | `drivingRelations`: `null` = onbekend, `[]` = geen | `planner_get_critical_path` | tools/list, desc |
| 38 | De float van één taak (totaal en vrij), de vroege en late datums; float in werkdagen, ook bij een uurtaak | `planner_get_task`, `planner_get_critical_path` | tools/list, desc van beide ("Float is in working days of the task calendar, also on hour tasks (ELAPSEDTIME: calendar days)") |
| 39 | `kritiek` telt ook samenvattingstaken (`summary: true`) | `planner_list_tasks` | tools/list, desc |
| 40 | IFC-export overschrijft geen bron in een schema dat de app niet schrijft; export verandert het opslagdoel niet | `planner_export_ifc` | tools/list, desc |
| 41 | Zonder statusdatum wordt elke voortgangsregel geweigerd | `planner_update_tasks` | tools/list, desc |
| 42 | Notatie van de statusdatum | `planner_update_project` | tools/list, schema `statusDate` |
| 43 | In `progress` alleen `completion`, `actualStart`, `actualFinish` | `planner_update_tasks` | tools/list, schema `progress` (drie velden); de weigering van andere sleutels alleen in het antwoord |
| 44 | Geplande start na de statusdatum zonder `actualStart` ⇒ geweigerd | `planner_update_tasks` | tools/list, desc |
| 45 | Werkelijke datums niet na de statusdatum; einde niet vóór start; `null` wist | `planner_update_tasks` | tools/list, schema `actualStart`, `actualFinish` |
| 46 | Een samenvattingstaak krijgt geen voortgang | `planner_update_tasks` | tools/list, desc |
| 47 | Geweigerde regels: de geldige gaan door; één taak kan zowel bijgewerkt als geweigerd zijn | `planner_update_tasks`, `planner_batch` | tools/list, desc van beide |
| 48 | Duurwijziging op een lopende taak: gedaan werk blijft (`progressAdjusted`); korter dan gedaan ⇒ geweigerd | `planner_update_tasks` | tools/list, desc. De skill progress-update houdt de rekenregel "nieuwe duur = gedaan + rest" |
| 49 | Afwijkingen per taak: `late`/`early`/`new`/`dropped`, delta's in werkdagen | `planner_compare_baseline` | tools/list, desc |
| 50 | Delta's tellen in werkdagen van de huidige projectkalender | `planner_compare_baseline` | tools/list, desc |
| 51 | Zonder actieve baseline weigeren vergelijken en vertraging analyseren | `planner_compare_baseline`, `planner_analyze_delay` | tools/list, desc ("refused without one"). De skill progress-update houdt de vraag aan de gebruiker |
| 52 | `projectEndDeltaAvailable: false` = onbekend, niet nul | `planner_analyze_delay` | tools/list, desc |
| 53 | Waar een skill te installeren is en de download-URL's | `planner_get_planning_guide` | alleen in het antwoord (`install` bij `goed-plannen`, `skill` en `both`, met beide skillnamen; `missing`). De part-beschrijving noemt de installatieparts |
| 54 | Undo is gedeeld met de gebruiker; een what-if gaat in een kopie | `planner_undo`, `planner_duplicate_document` | tools/list, desc van beide |
| 55 | `scheduleStale` op een leesantwoord: de gebruiker bewerkt nog; lees later opnieuw | elke leestool | alleen in het antwoord (`scheduleNote`, `EDIT_IN_PROGRESS_NOTE` in `tools/runtime.ts`) |
| 56 | `datesAsRecorded`: de datums komen uit het geïmporteerde bestand, niet uit een berekening | elke tool | initialize en het antwoord (`scheduleNote`, `DATES_AS_RECORDED_NOTE`). Gids en skill houden de toestemmingsregel |
| 57 | Nivelleren: eerst `dryRun: true`; `planner_clear_leveling` maakt het ongedaan | `planner_level_resources`, `planner_clear_leveling` | tools/list, desc en schema `dryRun`. De gids houdt "alleen op verzoek" |
| 58 | `DOC_DRIFT` los je op door het doel te bevestigen met `planner_switch_document` | `planner_switch_document` | tools/list, desc |
| 59 | De hele WBS-boom in één `planner_add_tasks` | `planner_add_tasks` | tools/list, desc ("a nested WBS in one call"). De gids houdt "one `planner_batch`" |
| 60 | Bij een open dialoog (`DIALOG_OPEN`) weigeren ook de leestools, behalve `planner_get_planning_guide` | elke leestool | alleen in de foutmelding ("A dialog is open (…); close it first …"). De gids noemt de guard |
| 61 | Een mijlpaal is een taak met `isMilestone: true` (duur 0) | `planner_add_tasks`, `planner_update_tasks` | tools/list, schema `isMilestone` en `duration` |
| 62 | Werk dat stopt en later doorgaat: één taak met onderbrekingen | `planner_set_task_splits` | tools/list, desc ("instead of splitting it into tasks") |
| 63 | Voor voortgang `part: "progress-update"` | `planner_get_planning_guide` | tools/list, desc; ook initialize (#838) |
| 64 | Een leeg document met `planner_new_document`, een wat-als-variant met `planner_duplicate_document` | `planner_new_document`, `planner_duplicate_document` | tools/list, desc van beide |
| 65 | Een kring na `scheduleError` breek je door een relatie te wijzigen of weg te halen | `planner_update_dependencies`, `planner_remove_dependencies` | tools/list: de tools zelf; dat een kring wordt geweigerd staat bij F22. De koppeling met `scheduleError` staat er niet letterlijk; weg uit de gids (besluit orkestrator, ronde 5: de toolnamen wijzen zichzelf) |
| 66 | In één item van `planner_update_tasks` gaat `fields` vóór `progress`; een nieuwe duur samen met een nieuw percentage geeft dus een andere rest dan na elkaar (`updateTasksCore`, `taskTools.ts`) | `planner_update_tasks` | niet in tools/list (de desc zegt alleen dat `progress` los staat van `fields`). De skill progress-update houdt de volgorde: de duur na de voortgang (§4, ronde 6) |
| 67 | `planner_get_task` toont de externe relaties van een taak in `externalLinks` (richting, type, lag, de bevroren `anchorDate`, `sourceMissing`, de bron), en die van een fase erboven in `inheritedExternalLinks` | `planner_get_task` | tools/list op main (#797): desc, `src/services/mcp/tools/readTools.ts:1214–1221`. Volgens het gedeelde contract houdt #838 dit. De gids houdt alleen wat een externe relatie is |
| 68 | Een externe relatie op een samenvattingstaak (fase) geldt voor elke taak in die fase | `planner_get_task`, `planner_refresh_external_links` | tools/list op main (#797): desc van beide, `readTools.ts:1219–1220` en `src/services/mcp/tools/externalLinkTools.ts:37–38` |
| 69 | Taken met een externe relatie (eigen of op een fase erboven) vind je met `planner_list_tasks` `externe_relaties: true` | `planner_list_tasks` | tools/list op main (#797): schema `externe_relaties`, `readTools.ts:1202` |
| 70 | `sourceMissing: true`: de brontaak staat niet meer in het bronbestand | `planner_get_task`, `planner_refresh_external_links` | tools/list op main (#797): desc van `planner_refresh_external_links` ("whether the source task is missing", `externalLinkTools.ts:29–30`) en het veld in de desc van `planner_get_task`. De gids houdt: zo'n koppeling melden |

Wat de teksten bewust houden, ook al staat het deels ook in een toolbeschrijving: herberekenen, `planner_batch`
voor een samenhangende reeks, `duration` altijd met `durationUnit`, de toestemming vóór een wijziging bij
`datesAsRecorded`, de kalendervalkuil, "nooit optellen" bij vertraging, en de regels over
geraden werkelijke datums. Die leiden tot een foute planning als een agent ze mist.
