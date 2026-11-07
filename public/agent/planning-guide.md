# Planning guide for AI agents

Rules for building and keeping a schedule in Open Planner Studio with the `planner_*` tools.

- Parameters, limits, answer fields: `tools/list`. It wins over this guide. Never guess a tool or parameter.
- The copy from `planner_get_planning_guide` matches the connected app version; it wins over the public URL.
- Skills: `goed-plannen` (build or restructure), `progress-update` (record progress). Same tool returns them.

## Model and order

Schedule = calculation model (tasks, durations, relationships, calendar); the app calculates every date. No logic, no calculation; a hand-fixed date stops warning when work slips.

1. `planner_update_project` `startDate` and the project calendar. Before any task: every duration counts in that calendar.
2. Milestones: start on site, permit final, weathertight, start finishing, handover.
3. WBS: phases, work packages, tasks.
4. Durations.
5. Relationships.
6. Constraints and deadlines, as few as possible.
7. Resources.
8. Critical path and float.
9. Baseline, later progress.
10. Checks, then report.

## Recalculation

- No recalculate tool. Every mutating call that changes data recalculates at its end; `planner_batch` once, at the end.
- Read tools with calculated values (dates, float, critical path, load, variance) first recalculate a stale schedule: `scheduleRecalculated: true`, no undo step.
- Report only numbers read after your last change: `planner_get_project_info` (`schedule.projectEnd`, `schedule.projectDuration`, `statistics.criticalTasks`), `planner_get_critical_path`.

Envelope:

- `datesAsRecorded: true`: dates from the imported file, not calculated; reads keep them. Say so with every date. Your first change recalculates and ends the mode: read and report the file's dates first if the user wants them.
- `scheduleStale: true` on a read: user is mid-edit in the app; dates may be old. Read again before concluding.
- `scheduleError`: last calculation failed (e.g. cycle); reads do not retry. Fix first: cause in `schedule.error` of `planner_get_project_info`; break a loop with `planner_update_dependencies` or `planner_remove_dependencies`. A change after which the calculation still fails is rolled back whole.

Guards: `PAUSED`, `READ_ONLY` (reads work), `DIALOG_OPEN` (reads refused too, except this guide), `DOC_DRIFT` (user switched document: confirm with `planner_switch_document`). No retry loop: tell the user. Undo is shared with the user; a what-if goes in a `planner_duplicate_document` copy.

## Batch

Coherent series (WBS with relationships, phase with tasks and assignments) ⇒ one `planner_batch`: one undo step, one recalculation, one backup, and a structural error rolls back all instead of leaving half a schedule. New tasks by `tempId`; look up existing ids before the batch.

## Milestones and project dates

- `planner_add_tasks` item `isMilestone: true`: duration 0 (a `duration` above 0 is an error). `milestoneKind`: `START`, `FINISH`, `null` (automatic).
- Contractual handover: `mandatory: true` is only a marker; it guards no date.
- `planner_update_project` `endDate` is metadata: enforces and watches nothing (only widens holiday regeneration).
- `startDate` anchors new tasks; it does not shift existing ones (a later start only pulls root tasks without predecessor or constraint forward: `anchorsClamped`). Shift a whole schedule: `planner_move_project`.

## WBS

- Task length about 1 day to 2 weeks (finer: nobody updates it; coarser: cannot track). Over a few percent of tasks above ~2 months = too little detail. Exceptions: a lead time (one waiting block), continuous supervision.
- Whole tree in one `planner_add_tasks`: `tempId` starting `tmp-` or `tmp_`; `parentId` = existing id or `tempId` of the same call.
- Summary task: dates and duration derived from children. Never send it a `duration`: `planner_update_tasks` refuses; in `planner_add_tasks` a duration on a parent with children in the same call fails the whole call.
- Restructure: `planner_move_task`. `planner_delete_tasks` deletes the subtree: check `cascadedTaskIds`.
- Work that stops and resumes: one task with `planner_set_task_splits`, not several tasks.
- Hammock: not possible through the tools; ask the user to make it in the app.
- Granularity check: `dur` and `durUnit` per row of `planner_get_project_overview`.

## Durations

- Estimate = normal pace with the crew you will really get. No margin hidden in durations: reserve = visible buffer task before handover; weather = a task or calendar days.
- No double counting: ~180 workable days a year already excludes holidays, industry shutdown and lost days; with those in the calendar, only weather remains.
- Always send `duration` with its `durationUnit` (`days` default, or `hours`). Without `duration`: project default (normally 5 days). Without `durationUnit` the number counts in days, also on an hour task: read the unit with `planner_get_task` before you change a duration.
- Days for work that sets the site pace; hours when hours are the unit (inspection, shifts). Fractions allowed (2.5). `FIXED_WORK` is always in hours (3 days = 24 h at 8 h/day). Hours need a calendar with working time.
- `durationType: "ELAPSEDTIME"` = calendar days around the clock (curing); default `WORKTIME`.
- Every duration you estimated is an assumption to report.

## Relationships

- Every task ≥1 predecessor and ≥1 successor, except the first task and the final milestone. An unlinked task does not follow a slip, and nothing warns.
- Finish-to-start default (~9 in 10). Start-to-start + lag only for real overlap; pair it with finish-to-finish. Start-to-finish: almost never.
- SS/SF between tasks, not phases: a phase as predecessor makes the successor wait for its last-starting task.
- Lags sparingly (hidden waiting). No negative lag: split the predecessor or use SS.
- `planner_add_dependencies`: `lag` in days of the day measure (`2`, `"+2d"`) or percent of the predecessor (`"+50%"`). No calendar-day lag: add a visible curing task with `"ELAPSEDTIME"` instead.
- Change one: `planner_update_dependencies` by `seqId` (after `#` in `rels` of `planner_get_project_overview`), not remove + add.
- A summary task in a relationship applies to its leaves. A cycle is `CYCLE` and rolls back the whole call.
- Find gaps: `planner_list_tasks` `zonder_relaties: true` (leaves with no relationship on themselves or any ancestor). Missing successor does not show there: a leaf without `rels` in `planner_get_project_overview` (and none on its summary) needs one, unless it is the final milestone.

## Constraints

- Default "as soon as possible"; keep it. Constraint only for a hard external date the user gave you (permit, closure window, utility connection). "I want it in May" is not one: use logic or duration. At most a few percent of tasks.
- No start or finish field. Only `constraint` in `planner_add_tasks` or `fields.constraint` in `planner_update_tasks`; `constraint: null` clears.
- Never a constraint to place a task: a `SNET` stays on its date when the chain before it runs late.
- Watch a date without steering (e.g. handover milestone): `deadline`. Moves nothing; negative total float once it no longer fits.
- `hard: true` (only `MSO`/`MFO`): only on the user's explicit request.
- Negative float = a deadline or fixed date does not fit; no calculation error.

## Calendars

- A later calendar correction shifts everything. Add foreseeable closures now (frost period, Christmas shutdown).
- `planner_get_calendars`: `projectDefaultId`. Switching the default is not possible: edit that calendar, or ask the user.
- `planner_update_calendar` `generate` (country, region, `bouwvak` for NL) replaces the holiday list. `rawHolidays` adds literal days but makes the calendar literal, no longer regenerable (`becameLiteral: true`); `holidaysMode: "replace"` = exactly your list.
- Generated years: `generation.generatedToYear` in `planner_get_calendars`. Calculated project end beyond it ⇒ run the same `generate` again.
- Resource calendar only if it really differs (`planner_manage_resources` `calendarId`). It moves no task date; it only shows as overallocation.

## Resources

- Start with what pinches: tower crane, own crews, capped subcontractors, long lead times. Create with `planner_manage_resources`; honest `maxUnits` per working day (1 = one person or piece).
- `planner_manage_assignments`: leaf tasks only (no milestone, no summary), one resource once per task. Under `FIXED_WORK` or `FIXED_RATE` (task `workRule` or project `defaultWorkRule`), adding, removing or changing `unitsPerDay` changes the duration; under default `FIXED_DURATION_RATE` not.
- Load: `planner_get_resource_histogram`.
- Level only on request, after logic and durations: `planner_level_resources` `dryRun: true` first, show the result. `constrainToFloat: true` (default) keeps the end, reports `unresolved`; false lets the end move. Undo: `planner_clear_leveling`.
- Never level against a structural shortage: leveling moves work, it adds no people. Report it; phasing or capacity is the user's decision.

## Critical path and float

- `planner_get_critical_path`: critical tasks, `totalFloat`, driving relationships. `drivingRelations` `null` = unknown (also with recorded dates), not "none"; `[]` = none.
- `planner_get_task`: `schedule.totalFloat`, `schedule.freeFloat` (working days), early and late dates.
- `planner_list_tasks` `kritiek: true`: critical tasks (summary rows marked `summary: true`).
- No near-critical flag, no warnings list: compare `totalFloat` yourself. A few days = near-critical, not safe. Over ~44 working days = usually a missing successor.

## Baseline and progress

- `planner_save_baseline` once the user approves, before work starts. Not inside a batch. It stores dates, not reasons: put the schedule basis in your report (productivity, calendar, what is left out, lead-time sources, who approved).
- New baseline only for a real scope change, next to the first: `planner_list_baselines`, `planner_activate_baseline` to switch back.
- Progress: skill `progress-update`. The status date is the user's reporting date, never invented. It pushes unstarted work to it (unless `project.schedulingProfile.conventions.unstartedIgnoresStatusDate` in `planner_get_project_info`), so set it only when you record progress.
- Out-of-sequence work: reason to review logic. Change `progressMode` only on request.

## IFC export

`planner_export_ifc` never overwrites an opened file in an unsupported schema (e.g. IFC2X3), also not via a case alias, link or other path spelling. Unknown file identity ⇒ existing target refused: pick a new name, or ask the user to save in the app and choose the schema. Export changes neither the save target nor the open schema question.

## Check, then report

Check against the rules above: links (`zonder_relaties`, `rels`), constraints and `hard`, task lengths, lags, calendar closures, leveling, numbers read after your last change, envelope flags. End with:

- Assumptions: estimated durations, granularity, relationships the user did not mention, resource capacities, calendar (working days, weather), every constraint and why.
- What you deliberately did not do (e.g. no leveling, no baseline), and what the user should check.
- Project end and critical path, read after your last change; negative float and missed deadlines named.
