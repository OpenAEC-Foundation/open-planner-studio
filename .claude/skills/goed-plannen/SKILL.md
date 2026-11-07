---
name: goed-plannen
description: Use when building or restructuring an Open Planner Studio schedule via the planner_* MCP tools (project, calendar, WBS, links, resources, baseline). For progress use progress-update.
---

# Build a schedule with `planner_*`

Rules: the agent guide (`planner_get_planning_guide` `part: "goed-plannen"` returns it with this skill). This skill is the tool order.

1. Orient: `planner_list_documents`, `planner_get_project_info`, `planner_get_project_overview`. Never change a document you have not read. Switch only on purpose (`planner_switch_document`); empty: `planner_new_document`; what-if: `planner_duplicate_document`.
2. Before any task: `planner_update_project` (name, `startDate`); `planner_get_calendars`, `planner_update_calendar` (working days, hours, holidays, construction holiday, closures).
3. One `planner_batch`: `planner_add_tasks` (milestones, phases, tasks by `tempId`; `duration` + `durationUnit` on every leaf, none on a parent), then `planner_add_dependencies`. Later: `planner_update_tasks`, `planner_move_task`, `planner_delete_tasks`, `planner_set_task_splits`, `planner_update_dependencies`, `planner_remove_dependencies`.
4. Check the network: `planner_list_tasks` `zonder_relaties: true`; `rels` in `planner_get_project_overview`.
5. Constraints and deadlines: only for external dates the user gave you.
6. Resources: `planner_manage_resources`, then all assignments in one `planner_manage_assignments` call; read with `planner_list_resources`, `planner_get_resource_histogram`. Leveling only on request: `planner_level_resources` `dryRun: true`, show, then for real; `planner_clear_leveling` undoes.
7. Read: `planner_get_project_info`, `planner_get_critical_path`, `planner_get_task` (float of one task).
8. After the user approves: `planner_save_baseline`, on its own (not in a batch).
9. Check and report as the guide says.
