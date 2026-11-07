---
name: progress-update
description: Use when recording progress in an Open Planner Studio schedule via the planner_* MCP tools (status date, actuals, percent complete, variance). For building use goed-plannen.
---

# Progress update with `planner_*`

Facts come from the user, never from you: a guessed actual date is worse than none. `tools/list` wins for parameters.

- Every change recalculates; report only numbers read after your last change. `scheduleStale` on a read: the user is mid-edit; read again.
- `datesAsRecorded` ⇒ report the recorded dates first. `scheduleError` ⇒ fix first.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user. Undo is shared with the user.

## 1. Orient

- `planner_get_project_info`: previous `project.statusDate`, `schedule.projectEnd` (note it), `project.schedulingProfile.conventions.unstartedIgnoresStatusDate`.
- `planner_list_baselines`: none active ⇒ ask the user: activate an older one (`planner_activate_baseline`) or save a new one? Never save one yourself: it would measure from today.

## 2. Ask the user

- Reporting date (= status date); actual start of started tasks, actual finish of finished ones, percent and remaining estimate of running ones; milestones reached, with date.
- Unreported tasks due by the reporting date: find them before you set the status date (it pushes them past it): `planner_list_tasks` `status: "NOT_STARTED"`, `tot` = reporting date.

## 3. One `planner_batch`

Steps: `planner_update_project` `statusDate`, then `planner_update_tasks` with `progress` per leaf task.

- Always send the user's actual dates. A missing one is guessed: 100 % without `actualFinish` ⇒ the status date; `actualFinish` alone ⇒ 100 % and start on that day; running without `actualStart` ⇒ a planned start.
- Finished: `completion: 100` with both dates. Running: `completion` with `actualStart`.
- Resolve every refusal with the user.

## 4. Remaining work

Remaining = duration × (1 − completion). User's remaining differs ⇒ new `fields.duration` = work done + the user's remaining, with `fields.durationUnit` (the unit from `planner_get_task`).

Example: hour task of 32 h, 25 % done (8 h), user says 32 h left ⇒ `{ "duration": 40, "durationUnit": "hours" }`. A bare `{ "duration": 40 }` is 40 days.

## 5. Read the effect

- `planner_get_project_info`: new end. `planner_get_critical_path`: compare with before; a new critical chain is news.
- `planner_compare_baseline`, `planner_analyze_delay`: `projectEndDelta` = delivery impact; never sum per-task deltas; `criticalShifters` = where the delay sits.
- Task with a deadline: negative `schedule.totalFloat` in `planner_get_task` = missed.

## 6. Check

- Reached milestones have `completion: 100` with `actualFinish`; otherwise they move to the status date.
- Out of sequence (started, finish-to-start predecessor not finished): report it; change `progressMode` only on request.
- Every actual date came from the user.

## 7. Report

Status date; tasks recorded as started, finished, running; project end against the previous update and the baseline; critical path and what changed; where the delay sits (`criticalShifters`, not summed); missed deadlines and negative float; unreported tasks; out-of-sequence work; assumptions, and what you did not do (e.g. no new baseline: only on request after a scope change).
