---
name: progress-update
description: Record Open Planner Studio progress via planner_*; for building use goed-plannen.
---

# Progress update with `planner_*`

Facts come from the user, never from you: a guessed actual date is worse than none. `tools/list` wins for parameters.

- Every change recalculates; report only numbers read after your last change. `scheduleError` ⇒ fix first.
- `datesAsRecorded`: your first change replaces the recorded dates (the end can move without progress): only with the user's explicit consent; compare in a `planner_duplicate_document` copy.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user.

## 1. Orient

- `planner_get_project_info`: previous `project.statusDate`, `schedule.projectEnd` (note it), `project.schedulingProfile.conventions.unstartedIgnoresStatusDate`.
- `planner_list_baselines`: none active ⇒ ask the user: activate an older one (`planner_activate_baseline`) or save a new one? Never save one yourself: it would measure from today.

## 2. Ask the user

- Reporting date (= status date); actual start of started tasks, actual finish of finished ones, percent and remaining estimate of running ones; milestones reached, with date.
- Unreported tasks due by the reporting date: find them before you set the status date (it pushes them past it): `planner_list_tasks` `status: "NOT_STARTED"`, `tot` = reporting date.

## 3. One `planner_batch`

Steps: `planner_update_project` `statusDate`, then `planner_update_tasks` with `progress` per leaf task.

- Finished: `completion: 100` with both dates. Running: `completion` with `actualStart`. A missing date is guessed (100 % ⇒ finish = status date; `actualFinish` alone ⇒ start that day; running ⇒ a planned start): ask, or report the guess.
- Resolve every refusal with the user.

## 4. Remaining work

Remaining = duration × (1 − completion). User's remaining differs ⇒ new `fields.duration` = work done + the user's remaining, with `fields.durationUnit` (the unit from `planner_get_task`).

32 h at 25 % = 8 h done; 32 h left ⇒ `{ "duration": 40, "durationUnit": "hours" }` (without unit: 40 days).

## 5. Read the effect

- `planner_get_project_info`: new end. `planner_get_critical_path`: compare with before; a new critical chain is news.
- `planner_compare_baseline`, `planner_analyze_delay`: delivery impact and delay location.
- Task with a deadline: negative `schedule.totalFloat` in `planner_get_task` = missed.

## 6. Check

- Reached milestones have `completion: 100` with `actualFinish`; otherwise they move to the status date.
- Out of sequence (started, finish-to-start predecessor not finished): report it; change `progressMode` only on request.

## 7. Report

Report: status date; started/finished/running tasks; end vs previous update/baseline; critical path and changes; delay location (`criticalShifters`, never sum); missed deadlines/negative float; unreported/out-of-sequence work; assumptions/omissions. New baseline only on request after scope change.
