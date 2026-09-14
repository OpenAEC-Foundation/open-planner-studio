---
name: goed-plannen
description: Use when an agent builds or edits a schedule in Open Planner Studio via the planner_* MCP tools — creating a WBS, setting durations, linking tasks, assigning resources, levelling, baselining or recording progress. Gives the tool order, the recalculation rule and the reporting duty; the planning principles themselves live in the in-app guide.
---

# Goed plannen via de `planner_*`-tools

## Installeren

Werk je met een agent die skills kent (Claude Code en verwanten), zet dit bestand dan neer als
`.claude/skills/goed-plannen/SKILL.md` in je eigen projectmap, of als
`~/.claude/skills/goed-plannen/SKILL.md` wanneer je hem in elk project wilt hebben. Ophalen kan op
drie manieren:

- via de MCP-bridge: de tool `planner_get_planning_guide` geeft de gidstekst én deze skilltekst
  terug, met dezelfde installatie-aanwijzing;
- via de download-URL `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md`;
- uit de repository, waar `public/skills/goed-plannen/SKILL.md` de bron is en
  `.claude/skills/goed-plannen/SKILL.md` een byte-identieke kopie (bewaakt door `npm run verify:docs`).

## De inhoud staat in de gids, niet hier

De planningsprincipes — mijlpalen eerst, granulariteit tussen ongeveer één dag en twee weken,
eind-start als standaardrelatie, constraints alleen voor harde externe datums, kalenders, resources,
speling, baseline — staan in **één** bron:

- `public/docs/nl/gids-goed-plannen.md` (Nederlands, de brontekst)
- `public/docs/en/gids-goed-plannen.md` (Engels)

Werk je zonder de repository, dan haal je dezelfde gids op met de MCP-tool
`planner_get_planning_guide` (parameters `language` en `part`), of online:

- `https://open-planner-studio.open-aec.com/docs/nl/gids-goed-plannen.md`
- `https://open-planner-studio.open-aec.com/docs/en/gids-goed-plannen.md`

**Lees die gids voordat je aan een planning begint** en houd je eraan. Dit bestand herhaalt hem
bewust niet; het voegt alleen toe wat een agent extra moet weten omdat hij via de MCP-bridge werkt
in plaats van via de interface.

## De volgorde waarin je de tools inzet

De echte toolnamen staan in `src/services/mcp/toolRegistry.ts` (en de modules eronder in
`src/services/mcp/tools/`); de route voor een nieuwe tool staat in `docs/recepten/mcp-tool.md`.
Controleer de namen en schema's daar of via `tools/list` — raad ze nooit.

1. **Oriënteren** — `planner_list_documents`, `planner_get_project_overview`,
   `planner_list_tasks`. Werk nooit blind op een document dat je niet hebt gelezen; wissel bewust
   met `planner_switch_document` en begin desnoods met `planner_new_document`.
2. **Project en kalender** — `planner_update_project` voor projectnaam, startdatum en
   reken-instellingen; `planner_get_calendars` en `planner_update_calendar` voor werkdagen,
   werktijden, feestdagen en voorziene stremmingen. Doe dit vóór stap 3: alle duren worden in die
   kalender uitgedrukt.
3. **WBS en taken** — `planner_add_tasks` (fasen en subtaken kunnen in één aanroep),
   `planner_update_tasks` voor duur en velden, `planner_move_task` voor structuur,
   `planner_delete_tasks` voor opruimen. Geef een samenvattende taak nooit een eigen duur.
4. **Relaties** — `planner_add_dependencies`, `planner_update_dependencies`,
   `planner_remove_dependencies`. Elke taak minstens één voorganger en één opvolger, behalve de
   eerste taak en de laatste mijlpaal.
5. **Resources** — `planner_manage_resources`, `planner_manage_assignments`; lezen met
   `planner_list_resources` en `planner_get_resource_histogram`. Nivelleer pas als logica en duren
   staan, en alleen op verzoek: `planner_level_resources` / `planner_clear_leveling`.
6. **Berekenen en lezen** — `planner_run_cpm`, daarna `planner_get_critical_path` en
   `planner_get_project_overview`.
7. **Baseline en voortgang** — `planner_save_baseline` (en `planner_list_baselines` /
   `planner_activate_baseline` / `planner_rename_baseline` / `planner_delete_baseline`), voortgang
   via `planner_update_tasks`, vergelijken met `planner_compare_baseline` en `planner_analyze_delay`.

## Herberekenen

Mutatietools herberekenen zelf al — elke MCP-transactie draait aan het eind `runCPM` — dus je werkt
niet stil op verouderde datums. Roep na een reeks wijzigingen tóch `planner_run_cpm` aan, niet om de
planning vers te maken maar om het resultaat te krijgen: die tool geeft je het projecteinde, de
projectduur en een kritieke-pad-samenvatting terug, en dat zijn de cijfers waarop je je conclusie
baseert. Baseer nooit een uitspraak over datums, speling of kritiek pad op cijfers van
vóór je laatste wijziging.

## `planner_batch` voor samenhangende reeksen

Hoort een reeks stappen bij elkaar — een hele WBS met zijn relaties, een fase met taken en
toewijzingen — gebruik dan `planner_batch` (maximaal 100 stappen). Dat levert één ongedaan-maak-stap
voor de gebruiker, één herberekening en één backup, en bij een structurele fout wordt de hele reeks
teruggedraaid in plaats van dat er een half afgemaakte planning blijft staan. Binnen een batch
verwijs je naar nog niet bestaande taken met tempId's die met `tmp-` of `tmp_` beginnen. Schema's
worden ook binnen een batch afgedwongen: een draaiboek omzeilt de poort niet.

## Constraints

Zet geen constraint zonder reden, en typ geen start- of einddatum om een taak op zijn plek te
krijgen — dat zet stilletjes een datumgrens en haalt de taak uit de berekening. Een constraint is
alleen op zijn plaats bij een harde externe datum die de gebruiker je heeft gegeven (vergunning,
stremmingsperiode, aansluitdatum). Een harde pin (`Verplicht`) zet je niet uit eigen beweging.
Zolang de gebruiker geen externe datum noemt, laat je alles op "zo vroeg mogelijk" staan en los je
de gewenste volgorde op met relaties.

## Meld je aannames

Een gebruiker die je een planning laat bouwen, krijgt taken, duren en relaties terug die hij niet
zelf heeft ingetypt. Sluit daarom altijd af met een korte opsomming van wat je hebt aangenomen:
geschatte duren, de gekozen granulariteit, gelegde relaties waar de opdracht niets over zei,
resourcecapaciteiten, kalenderaannames zoals werkdagen of weerverlet, en elke constraint die je hebt
gezet en waarom. Noem ook wat je bewust níét hebt gedaan (niet genivelleerd, geen baseline
vastgelegd) en wat de gebruiker zelf moet nakijken.
