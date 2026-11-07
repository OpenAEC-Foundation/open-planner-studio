# Feiten die de agentteksten niet meer noemen, omdat `tools/list` ze geeft

PR #836 (#818) haalt deze feiten uit de agentgids (`public/agent/planning-guide.md`) en de skills
(`public/skills/{goed-plannen,progress-update}/SKILL.md`). De regel uit de council-ronde: tool-specifieke
feiten horen in de toolbeschrijving, regels over meerdere tools in de gids. Elk feit hieronder staat
nu **alleen** nog op de genoemde plek in `tools/list` (stand `origin/main` 38915fa7c). Haal ze daar dus
niet weg zonder ze terug te zetten in de gids of een skill.

"desc" = de beschrijving van de tool; "schema `x`" = de beschrijving of enum van parameter `x`.

| # | Feit | Tool | Plek |
|---|---|---|---|
| 1 | Een leestool rekent een verouderde planning eerst bij, zonder undo-stap; de envelop draagt dan `scheduleRecalculated: true` | elke leestool met berekende waarden, o.a. `planner_get_project_info` | desc ("Calculated values are always current …") |
| 2 | De uitkomst staat in `schedule.projectEnd`, de projectduur en `criticalTasks` | `planner_get_project_info` | desc |
| 3 | Een batch is één undo-stap, één berekening, één backup; een structurele fout draait alles terug | `planner_batch` | desc |
| 4 | Binnen een batch begint elk `tempId` met `tmp-`/`tmp_`; latere stappen krijgen het echte id | `planner_batch` | desc ("TEMP IDS") |
| 5 | Een leesstap in een batch heeft alleen als laatste zin; ids vooraf apart opzoeken | `planner_batch` | desc ("READ STEPS") |
| 6 | Uitgesloten als batchstap: `planner_batch`, undo/redo, document- en bestandstools, `planner_save_baseline` | `planner_batch` | desc ("EXCLUDED") |
| 7 | Hoogstens 100 stappen | `planner_batch` | desc, schema `steps` |
| 8 | Een mijlpaal heeft duur 0; `duration` > 0 is daar een fout | `planner_add_tasks` | desc, schema `duration` |
| 9 | `milestoneKind`: `START`, `FINISH`, `null` = automatisch | `planner_add_tasks`, `planner_update_tasks` | schema `milestoneKind` |
| 10 | `mandatory` is alleen een markering voor rapporten | `planner_add_tasks`, `planner_update_tasks` | schema `mandatory` |
| 11 | `endDate` is metadata; het stuurt wel de spanne van gegenereerde feestdagen | `planner_update_project` | desc |
| 12 | Een latere `startDate` trekt worteltaken zonder voorganger of constraint naar voren (`anchorsClamped`) | `planner_update_project` | desc |
| 13 | `tempId` begint met `tmp-` of `tmp_`; `parentId` = bestaand id of `tempId` uit dezelfde aanroep | `planner_add_tasks` | schema `tempId`, `parentId` |
| 14 | Een samenvattingstaak krijgt geen duur: `planner_update_tasks` weigert; in `planner_add_tasks` duur weglaten bij een nieuwe ouder met kinderen | `planner_update_tasks`, `planner_add_tasks` | desc, schema `duration` |
| 15 | `planner_delete_tasks` wist de hele subboom; `cascadedTaskIds` noemt wat mee ging | `planner_delete_tasks` | desc |
| 16 | Zonder `duration` krijgt een taak de standaardmaat van het project (normaal 5 werkdagen) | `planner_add_tasks` | desc |
| 17 | Een dagduur mag een breuk zijn; `FIXED_WORK` rekent altijd in uren (3 d = 24 h bij 8 h/dag); uren vragen een kalender met werktijd | `planner_add_tasks`, `planner_update_tasks` | schema `duration`, `durationUnit` |
| 18 | `durationType`: `WORKTIME` (standaard) of `ELAPSEDTIME` | `planner_add_tasks`, `planner_update_tasks` | schema `durationType` |
| 19 | `lag` in dagen van de dagmaat (`2`, `"+2d"`, breuken) of in procenten van de voorganger (`"+50%"`) | `planner_add_dependencies`, `planner_update_dependencies` | schema `lag` |
| 20 | Het `seqId` staat na `#` in `rels` van het overzicht | `planner_get_project_overview`, `planner_update_dependencies` | desc |
| 21 | Een samenvattingstaak als voorganger of opvolger geldt voor zijn bladtaken | `planner_add_dependencies` | desc |
| 22 | Een kringverwijzing wordt geweigerd en draait de aanroep terug | `planner_add_dependencies`, `planner_move_task` | desc |
| 23 | `zonder_relaties` telt relaties op de taak en op alle bovenliggende samenvattingstaken | `planner_list_tasks` | schema `zonder_relaties` |
| 24 | Een datum vastzetten kan alleen met `constraint` (`fields.constraint`); `null` wist; typen `SNET` … `MFO`, `ASAP`/`ALAP` zonder datum | `planner_add_tasks`, `planner_update_tasks` | schema `constraint` |
| 25 | `hard` alleen bij `MSO`/`MFO` | `planner_add_tasks`, `planner_update_tasks` | schema `constraint` |
| 26 | `deadline` begrenst alleen het late einde (verschuift niets) | `planner_add_tasks`, `planner_update_tasks` | schema `deadline` |
| 27 | `projectDefaultId`; welke kalender de projectstandaard is, kan niet via de tools wisselen | `planner_get_calendars` | desc |
| 28 | `generate` vervangt de feestdagenlijst; `rawHolidays` voegt toe en maakt de kalender letterlijk (`becameLiteral`); `holidaysMode: "replace"` = precies de lijst | `planner_update_calendar` | desc, schema `holidaysMode` |
| 29 | `generate` neemt land, regio en voor NL `bouwvak` (`geen`, `noord`, `midden`, `zuid`) | `planner_update_calendar` | schema `generate` |
| 30 | Een resourcekalender zet je met `calendarId` | `planner_manage_resources` | desc |
| 31 | Een resource maak je met `action: "create"`; `maxUnits` = capaciteit per werkdag (1 = één persoon of stuk) | `planner_manage_resources` | desc, schema `maxUnits` |
| 32 | Toewijzen alleen op een bladtaak (geen mijlpaal, geen samenvattingstaak), één resource één keer per taak | `planner_manage_assignments` | desc |
| 33 | Onder `FIXED_WORK`/`FIXED_RATE` verandert een toewijzing de duur; onder de standaard `FIXED_DURATION_RATE` niet | `planner_manage_assignments` | desc (de gids houdt alleen de regel in één zin) |
| 34 | Toewijzingen gaan in bulk: één aanroep is één undo-stap | `planner_manage_assignments` | desc |
| 35 | Het histogram geeft zonder argumenten een samenvatting per resource (`peakLoad`, `overallocatedDayCount`), met `resourceIds`/`van`/`tot` de details; `bucket`: `dag`, `week`, `maand` | `planner_get_resource_histogram` | desc, schema `bucket` |
| 36 | `constrainToFloat: true` (standaard) houdt het einde vast en meldt `unresolved`; `false` laat het einde schuiven (`projectEndDelta`) | `planner_level_resources` | desc, schema `constrainToFloat` |
| 37 | `drivingRelations` is `null` als de informatie ontbreekt (ook bij opgeslagen datums); `[]` = geen | `planner_get_critical_path` | desc |
| 38 | De float van één taak (totaal en vrij) en de vroege en late datums | `planner_get_task` | desc |
| 39 | `kritiek` telt ook samenvattingstaken met een doorgegeven vlag; zulke rijen hebben `summary: true` | `planner_list_tasks` | desc |
| 40 | IFC-export: een geopend bestand in een schema dat de app niet schrijft (IFC2X3) wordt niet overschreven, ook niet via een hoofdletteralias of link; onbekende bestandsidentiteit ⇒ geweigerd; nieuwe naam of de gebruiker laten opslaan; export verandert het opslagdoel niet | `planner_export_ifc` | desc |
| 41 | Zonder statusdatum wordt elke voortgangsregel geweigerd | `planner_update_tasks`, `planner_update_project` | desc, schema `statusDate` |
| 42 | Notatie van de statusdatum: `YYYY-MM-DD`, bij uurplanning `YYYY-MM-DDTHH:mm` | `planner_update_project` | schema `statusDate` |
| 43 | In `progress` alleen `completion` (0–100), `actualStart`, `actualFinish`; andere sleutels worden geweigerd | `planner_update_tasks` | desc, schema `progress` |
| 44 | Geplande start na de statusdatum zonder `actualStart` ⇒ geweigerd | `planner_update_tasks` | desc, schema `actualStart` |
| 45 | Werkelijke datums niet na de statusdatum; einde niet vóór start; `null` wist | `planner_update_tasks` | schema `actualStart`, `actualFinish` |
| 46 | Een samenvattingstaak krijgt geen voortgang; vastleggen op de bladtaken | `planner_update_tasks` | desc |
| 47 | Geweigerde regels: de geldige gaan door; één taak kan zowel bijgewerkt als geweigerd zijn | `planner_update_tasks` (en `planner_batch` voor `rejections`) | desc |
| 48 | Duurwijziging op een lopende taak: gedaan werk blijft, het percentage past zich aan (`progressAdjusted`); korter dan gedaan ⇒ geweigerd | `planner_update_tasks` | desc (de skill houdt de rekenregel "nieuwe duur = gedaan + rest") |
| 49 | Afwijkingen per taak: `late`/`early`/`new`/`dropped`, delta's in werkdagen | `planner_compare_baseline` | desc |
| 50 | Delta's tellen in werkdagen van de huidige projectkalender; na een kalenderwijziging met zorg lezen | `planner_compare_baseline` | desc ("YARDSTICK DISCLOSURE") |
| 51 | Zonder actieve baseline weigeren vergelijken en vertraging analyseren | `planner_compare_baseline`, `planner_analyze_delay` | desc (de skill houdt de vraag aan de gebruiker) |
| 52 | `projectEndDeltaAvailable: false` = onbekend, niet nul | `planner_analyze_delay` | desc |
| 53 | Waar een skill te installeren is en de download-URL's | `planner_get_planning_guide` | het antwoord (`install`, `missing`) |

Wat de teksten bewust houden, ook al staat het deels ook in een toolbeschrijving: herberekenen en de
envelopvlaggen, `planner_batch` voor een samenhangende reeks, `duration` altijd met `durationUnit`, geen
duur op een samenvattingstaak, "nooit optellen" bij vertraging, en de regels over geraden werkelijke
datums. Die leiden tot een foute planning als een agent ze mist.
