---
name: progress-update
description: Record Open Planner Studio progress via planner_* (status date, actual dates, % complete); for building use goed-plannen.
---

# Progress update with `planner_*`

User facts only; never guess actual dates. `tools/list` wins.

- Every change recalculates; report only numbers read after your last change. `scheduleError` ⇒ fix first.
- `datesAsRecorded`: change nothing without the user's explicit consent (compare in a planner_duplicate_document copy).
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user.

## 1. Orient

- Before editing, record planner_get_project_info (`statusDate`, `projectEnd`, `unstartedIgnoresStatusDate`) and planner_get_critical_path.
- Links to other project files (`statistics.externalRelations`): then planner_refresh_external_links (a change); report its `changes` and `sourceMissing`.
- planner_list_baselines: none active ⇒ ask: activate older (planner_activate_baseline) or save new? Never save unasked.
- One active: a new one only after a real scope change. Asked without a scope change ⇒ say the delay so far vanishes from the comparison; wait for confirmation.

## 2. Ask the user

- Reporting/status date; actual start/finish of started/finished tasks; % and remaining estimate of running tasks; reached milestones + date.
- Before `statusDate` pushes unstarted work, planner_list_tasks `status: "NOT_STARTED"`, `tot` = reporting date; ask about unreported due tasks and wait.

## 3. One planner_batch

Steps: planner_update_project `statusDate`, then planner_update_tasks with `progress` per leaf task.

- Finished: `completion: 100`, `actualStart`, `actualFinish`; running: `completion`, `actualStart`. A missing date gets a tool guess: ask; leave that item unchanged until known.
- Resolve every refusal with the user.

## 4. Remaining work

User's remaining ≠ duration × (1 − completion/100): `completion` = done ÷ current duration; then `fields.duration` = done + remaining and `durationUnit` from planner_get_task in a later item/step (`fields` runs first). Done stays; the percentage adjusts.

## 5. Check and report

- Report end/critical-path changes (planner_get_project_info, planner_get_critical_path); baseline variance (planner_compare_baseline); delay (planner_analyze_delay).
- Negative `totalFloat` (planner_get_critical_path shows it too): planner_get_task on each such task and its successors; report the `deadline`, `constraint` or external successor that no longer fits, and its date.
- Reached milestones need `completion: 100`, `actualFinish`; otherwise they move to the status date.
- Report out-of-sequence work (started, FS predecessor unfinished); change `progressMode` only on request.
- Status date; started/finished/running tasks; unreported work; assumptions/omissions.
