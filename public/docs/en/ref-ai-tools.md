# AI tools (planner_*)

All tools an AI assistant can call through the bridge, by group, with what they do and what they refuse. They all start with `planner_`. The connection prompt in the window *Connection details* names the current number, and the assistant gets the full list with descriptions from the bridge itself (`tools/list`). Why the link works the way it does is in [How the AI link works](docs://uitleg-ai-koppeling). How you turn it on is in [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen).

## How to read this list

**Read** means: the tool changes nothing. That works during *Pause* and *Read-only* too. An open dialog does block it (see *When a tool is refused* below). A read tool always gives current dates: if the schedule is stale, it recalculates first, also during *Pause* and *Read-only*: those hold back changes, not the recalculation when reading. If you are in the middle of an edit (dragging a bar, typing in a field), it does not recalculate; the assistant then gets the dates from before your edit with a notice that they are stale. If the project is in the *Dates as recorded* view, it does not recalculate; the assistant then gets the recorded dates with a notice that they have not been recalculated.

**Change** means: the tool changes your project. It is refused during *Pause*, *Read-only* and when a dialog is open. That also goes for the tools without a label below (`planner_undo`, `planner_redo`, the file tools and the document tools, except `planner_list_documents`). Every change is one step in your undo history. If project data changes, the app recalculates the schedule afterwards by itself; you do not have to press *Calculate*. Before the first change per document the app writes a backup, if *Auto-backup* is on.

**Bulk** means: one call can contain several items. An invalid item is then refused with a reason, and the valid items stay. The response names the refused items.

## Read: schedule

- `planner_get_project_info` (read) — project details and key figures: the number of tasks, relations, resources and milestones, the status date, the project end and duration, whether the schedule is stale, the calculation profile and a summary of the calendars. A good first call.
- `planner_get_project_overview` (read) — the whole WBS tree in one response: per task id, WBS, name, duration, early dates, progress, critical, and the outgoing relations with their relation id.
- `planner_list_tasks` (read) — tasks with filters (critical, status, date window, tasks without relations) and paging.
- `planner_get_task` (read) — one task in detail: dates, float, progress, constraints, deadline, calendar, assignments, predecessors and successors, interruptions.
- `planner_get_critical_path` (read) — the critical tasks with their total float, and the relations that drive the path.
- `planner_list_resources` (read) — resources with capacity, rate, calendar, crew, availability and a summary of their assignments. If a resource comes from a library, it shows which fields are fixed.
- `planner_get_resource_histogram` (read) — load against capacity per resource, per day, week or month (week by default). With no window and no resources it gives a summary per resource; with a window or resources it gives the full series and the tasks that cause an overallocation.
- `planner_get_calendars` (read) — all calendars with their full definition and how many tasks and resources use them.

## Read: baselines and variance

- `planner_list_baselines` (read) — the saved baselines and which one is active.
- `planner_compare_baseline` (read) — the current plan against the active baseline: only the tasks that differ and the difference in project end, in working days on the current project calendar. Without an active baseline it refuses.
- `planner_analyze_delay` (read) — delay analysis against the active baseline: the difference in delivery and the critical tasks that have moved. Without an active baseline it refuses.

## Tasks and structure

- `planner_add_tasks` (change, bulk) — create tasks, including a nested WBS in one call. Each task gets its own temporary name (`tmp-…`) so a child can refer to its parent. Without a duration a task gets 5 working days. A milestone has duration 0. All tasks of one call succeed together or fail together.
- `planner_update_tasks` (change, bulk) — change fields of existing tasks: name, description, duration with unit (days or hours), duration type, task type, milestone, mandatory, priority, constraint, deadline, calendar and work rule. Also a progress path: percent complete, actual start and actual finish. Any other key is refused with a reason.
- `planner_delete_tasks` (change) — delete tasks, including their whole subtree, relations and assignments. The response names exactly what went with them.
- `planner_move_task` (change) — put a task under another parent, with a position. A circular reference or putting a task under itself is refused.
- `planner_set_task_splits` (change) — set the interruptions of one task: after how many working days (or working hours) of work, and how many working days (or working hours) of pause. An empty list lifts all interruptions. See [Splitting a task](docs://howto-taak-splitsen).

## Relations

- `planner_add_dependencies` (change, bulk) — create relations with a type (`FS`, `SS`, `FF`, `SF` or the long form) and lag, for example `+2d`.
- `planner_update_dependencies` (change, bulk) — change the type, lag, predecessor or successor of an existing relation, by relation id. That is one step, instead of deleting and creating again.
- `planner_remove_dependencies` (change, bulk) — delete relations by relation id.

## Project and calendars

- `planner_update_project` (change) — name, description, author, company, start date, end date, status date, progress mode and the project default for the work rule. The start date is the anchor for new tasks. If the assistant sets it later, only loose tasks move along (without a predecessor and without a constraint that sets a lower bound, such as *Start no earlier than*) and the response reports how many as `anchorsClamped`; the rest of the schedule stays put, see [New project and Project info](docs://ref-projectinfo). The status date is not a label but the reference date of the calculation: on a schedule without progress, everything moves along. The end date is metadata only.
- `planner_move_project` (change) — move the whole existing schedule to a new start date. The calendars do not move along, so the end can jump by a different number of days than the start. Baselines stay, unless the assistant explicitly has them move too. See [Moving a project](docs://howto-project-verplaatsen).
- `planner_update_calendar` (change, bulk) — change or create calendars: working days, working hours, break, hour bands, holidays (generate for a country and region, or specify literally) and working exceptions. It cannot change which calendar is the project calendar.

## Resources and units

- `planner_manage_resources` (change, bulk) — create, change or delete resources: name, type (labor, equipment, material, subcontractor or crew), description, maximum units, cost per hour, unit, calendar, crew and availability over time. It refuses to delete a resource that has assignments until the assistant confirms explicitly. For a resource from a library, name, type, description, hourly rate and unit are fixed.
- `planner_manage_assignments` (change, bulk) — add, change, move or remove assignments: units per working day, curve and remaining work. Only on a leaf task, and the same resource only once per task. What a change in units does to the duration depends on the work rule of the task, as in [Work rules: duration, units and work](docs://uitleg-werkregels).
- `planner_level_resources` (change) — level overallocation. Within the float by default, so the end date stays; with `constrainToFloat: false` the end may move. With a dry run the assistant first gets a preview without changing anything. It skips material. See [Resource leveling](docs://uitleg-nivelleren).
- `planner_clear_leveling` (change) — clear all leveling delays.

## Managing baselines

- `planner_save_baseline` (change) — save the current schedule as a baseline and make it active straight away. It recalculates stale dates first. Cannot be used in a script.
- `planner_activate_baseline` (change) — make a baseline active, or none at all.
- `planner_rename_baseline` (change) — rename a baseline.
- `planner_delete_baseline` (change) — delete one baseline. If it was the active one, the last remaining baseline becomes active, or none if nothing remains.

## Undoing

- `planner_undo` and `planner_redo` — undo or redo one step in the active document. The history is the same as yours. The response says whether anything was really reverted.

## Documents and files

- `planner_list_documents` (read) — all open documents with title, whether they are active and modified, the number of tasks, the project start and the calculated end.
- `planner_new_document` — a new, empty document in its own tab, without the *New project* window.
- `planner_duplicate_document` — copy the active document to a new tab, for a what-if or a tender variant. The copy is detached and has no file path.
- `planner_switch_document` — make another document active. Also the way to confirm, after you switched tabs, which document the assistant works on.
- `planner_import_schedule` — open a schedule file from disk as a document: `.ifc`, `.xml` (Primavera P6 or MS Project, recognized by content), `.csv`, `.xer` and `.mpp` (MS Project 2010 through 2021). Nothing is merged with the current plan. A CSV has no calendar, so dates can shift. Only inside your user folder. After a CSV, XML or `.mpp` import the document has no save target; only an IFC takes over its path.
- `planner_export_ifc` — write the active document as an IFC 4.3 file. Only inside your user folder, and an existing file is only overwritten on explicit request. The project stays unsaved.

## Guide and source provenance

- `planner_get_planning_guide` (read) — the planning guide ([Planning well](docs://gids-goed-plannen) or a version of it for assistants), the skill *goed-plannen* or both, plus the places where the skill belongs and the download addresses. Does not touch the schedule.
- `planner_inspect_xer_provenance` (read) — inspect the retained source semantics of an opened Primavera P6 file (`.xer`): what the file contained, with counts of the import and diagnostics. Free-text fields from the file stay invisible by default; the assistant has to ask for them explicitly. Cannot be used in a script.

## The script

- `planner_batch` — run a script of at most 100 steps as one change: one undo step, one recalculation, one backup. If a step fails structurally, the whole script is rolled back and the response says per step what was carried out, failed or not reached. Temporary names (`tmp-…`) from `planner_add_tasks` apply in later steps. Not allowed as a step: `planner_batch` itself, undo and redo, the document and file tools, `planner_save_baseline`, `planner_get_planning_guide` and `planner_inspect_xer_provenance`. A script is not a programming language: there are no variables, conditions or loops.

## When a tool is refused

The assistant then gets a response with an error code and an explanation.

- `PAUSED` — *Pause* is on.
- `READ_ONLY` — *Read-only* is on.
- `DIALOG_OPEN` — a dialog is open. That counts for reading too, except for `planner_get_planning_guide`. The response names what is open by its internal name, for example `showTaskDialog`.
- `DOC_DRIFT` — you switched tabs while the assistant was working. It has to confirm with `planner_switch_document` which document it works on.
- `VALIDATION` — the arguments do not match the schema, or the requested change is not allowed. The response names the field.
- `NOT_FOUND` — an id or document does not exist.
- `CYCLE` — the change would create a circular reference. Everything in that call is rolled back.
- `SCOPE` — the file path lies outside your user folder.
- `BACKUP_FAILED` — the backup before the change failed; the change was not carried out.
- `INTERNAL` — an unexpected error while running a tool, for example a file operation that failed. The response gives the original error message.
- `STALE_PRECONDITION` — is part of the bridge's contract, but none of the current tools returns this code.

A request that sat in the queue longer than 110 seconds is no longer carried out by the app: the client has already received a time-out, and carrying it out would change things twice on a retry. A call that takes longer than 120 seconds gets a time-out from the bridge.

## What the assistant cannot set

Per task the assistant cannot set: hammock, manual scheduling, a second constraint, notes, color, activity codes, custom fields, external links and a leveling delay by hand. The app calculates the WBS code itself. At project level it cannot change the calculation profile and the calculation options. Settings, theme, language, extensions and updates are out of reach, and so is the resource library. It has no reports, layouts, filters or view either. Why is in [How the AI link works](docs://uitleg-ai-koppeling).

## What the app stores

- **The token** is on this computer, in the stored settings of the app. It is 64 characters long and random. *New token* replaces it.
- **The port** is 3877 by default and can only be changed while the bridge is stopped.
- **The activity panel** keeps the last 500 calls, only while the app is open. Arguments and responses are cut off after 20 kB per field. *Clear* empties the list.
- **The backups** are in the folder `ai-backups` in the data folder of the app; *Open backup folder* takes you there. They are named `<project name>-<timestamp>.ifc`. A saved project file has one folder across all sessions; a document you never saved gets its own folder per session. One backup per document is made each time you start the bridge, plus the backups you make yourself with *Back up now*.
- **Thinning out** happens by itself, per folder. Of the last 7 days they all stay, up to 20; whatever the running session made always stays. After that one per week remains up to 30 days old, one per month up to a year, and then one per year. The backups of a document you never saved disappear completely after a year. Files in the folder that do not belong to the app are left alone.

## See also

- [How the AI link works](docs://uitleg-ai-koppeling): why the bridge is set up this way and what the assistant may and may not do.
- [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen): start the bridge, connect, install the skill.
- [Settings](docs://ref-instellingen): the two AI switches.
- [Notifications and warnings](docs://ref-meldingen): the AI dot in the status bar.
