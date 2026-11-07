---
name: goed-plannen
description: Build/restructure Open Planner Studio schedules via planner_*. Progress: progress-update.
---

# Build a schedule with `planner_*`

Rules: the agent guide (`planner_get_planning_guide` `part: "guide"`). This skill is the tool order.

1. Orient: `planner_list_documents`, `planner_get_project_info`, `planner_get_project_overview`. Never change a document you have not read. Switch only on purpose (`planner_switch_document`); empty: `planner_new_document`; what-if: `planner_duplicate_document`.
2. Before any task: `planner_update_project` (name, `startDate`); `planner_get_calendars`, `planner_update_calendar` (working days, hours, holidays, construction holiday, closures).
3. One `planner_batch`: `planner_add_tasks` (milestones, phases, tasks by `tempId`), then `planner_add_dependencies`.
4. Resources: `planner_manage_resources`, then all assignments in one `planner_manage_assignments` call; read with `planner_list_resources`, `planner_get_resource_histogram`. `planner_level_resources` (`dryRun: true` first); `planner_clear_leveling` undoes.
5. Read: `planner_get_project_info`, `planner_get_critical_path`, `planner_get_task` (float of one task).
6. `planner_save_baseline`.
