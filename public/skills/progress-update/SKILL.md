---
name: progress-update
description: Record Open Planner Studio progress via planner_* (status date, actual dates, % complete); for building use goed-plannen.
---

# Progress update with `planner_*`

User facts only; never guess actual dates. `tools/list` wins.

- Every change recalculates; report only numbers read after your last change. `scheduleError` ⇒ fix first.
- `datesAsRecorded`: your first change replaces the recorded dates (the end can move without progress): only with the user's explicit consent; compare in a planner_duplicate_document copy.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user.

## 1. Orient

- Before editing, record planner_get_project_info (`statusDate`, `projectEnd`, `unstartedIgnoresStatusDate`) and planner_get_critical_path.
- Links to other project files (`statistics.externalRelations`): then planner_refresh_external_links (a change); report its `changes` and `sourceMissing`.
- planner_list_baselines: none active ⇒ ask: activate older (planner_activate_baseline) or save new? Never save unasked; it measures from now.

## 2. Ask the user

- Reporting/status date; actual start/finish of started/finished tasks; % and remaining estimate of running tasks; reached milestones + date.
- Before `statusDate` pushes unstarted work, planner_list_tasks `status: "NOT_STARTED"`, `tot` = reporting date; ask about unreported due tasks and wait.

## 3. One planner_batch

Steps: planner_update_project `statusDate`, then planner_update_tasks with `progress` per leaf task.

- Finished: `completion: 100`, `actualStart`, `actualFinish`; running: `completion`, `actualStart`. A missing date gets a tool guess: ask; leave that item unchanged until known.
- Resolve every refusal with the user.

## 4. Remaining work

User's remaining ≠ duration × (1 − completion/100) ⇒ `fields.duration` = done + user remaining; `fields.durationUnit` from planner_get_task. Set it after the progress (a later item or step): one item applies `fields` first.

## 5. Check and report

- Report planner_get_project_info end vs before, planner_get_critical_path changes; planner_compare_baseline + planner_analyze_delay for end vs baseline and delay location (`criticalShifters`, never sum).
- Task with negative `schedule.totalFloat`: read planner_get_task; a `deadline` there is missed. Report it.
- Reached milestones need `completion: 100`, `actualFinish`; otherwise they move to the status date.
- Report out-of-sequence work (started, FS predecessor unfinished); change `progressMode` only on request.
- Status date; started/finished/running tasks; unreported work; assumptions/omissions.
