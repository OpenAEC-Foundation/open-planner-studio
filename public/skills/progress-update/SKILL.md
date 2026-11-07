---
name: progress-update
description: Use when recording progress in an Open Planner Studio schedule through the planner_* MCP tools — status date, actual start and finish, percent complete, remaining work, and reporting variance against the baseline, the critical path and the new finish. For building or restructuring use goed-plannen.
---

# Progress update with `planner_*`

General rules: the agent guide (`planner_get_planning_guide` `part: "guide"`). Facts come from the user, never from you: actual dates end up in site meetings and delay claims, so a guessed date is worse than none.

## 1. Orient

- `planner_get_project_info`: previous `project.statusDate`, `schedule.projectEnd` (note it: you report the change), `project.schedulingProfile.conventions.unstartedIgnoresStatusDate`.
- `planner_list_baselines`: active baseline? None ⇒ `planner_compare_baseline` and `planner_analyze_delay` refuse. Ask the user: activate an older one (`planner_activate_baseline`) or save a new one? Never save one on your own: it would measure from today.
- Envelope: `datesAsRecorded` ⇒ report the recorded dates first; `scheduleError` ⇒ fix first.

## 2. Ask the user

- Reporting date = status date.
- Started tasks: actual start. Finished: actual finish. Running: percent complete, and remaining estimate if known.
- Milestones reached, with date.
- Tasks due to start by the reporting date but not reported. Find them before you set the status date (it pushes them past the date): `planner_list_tasks` `status: "NOT_STARTED"`, `tot` = reporting date.

## 3. One `planner_batch`

1. `planner_update_project` `statusDate` (`YYYY-MM-DD`; hour planning `YYYY-MM-DDTHH:mm`). Without it every progress line is refused.
2. `planner_update_tasks`: per task `progress` with `completion` (0–100), `actualStart`, `actualFinish`; no other keys.

Rules:

- Always send the user's actual dates. A missing one is guessed: 100 % without `actualFinish` ⇒ the status date; `actualFinish` alone ⇒ 100 % and start on that same day; running without `actualStart` ⇒ a planned start (in separate calls: the status date).
- Finished: `completion: 100` with both dates. Running: `completion` with `actualStart`.
- Planned start after the status date and no `actualStart` ⇒ refused.
- Actual dates not after the status date; finish not before start; `null` clears.
- Summary tasks take no progress: record on the leaves.
- Refusals come back in `itemRejections` (in a batch: `rejections`); valid lines still apply, and one task can be both updated and refused. Resolve each with the user.

## 4. Remaining work

No remaining field: remaining = duration × (1 − completion). User's estimate differs ⇒ new `fields.duration` with `fields.durationUnit` (the unit from `planner_get_task`). Work done stays, the percent adjusts (`progressAdjusted`); shorter than work done ⇒ refused.

Example: `FIXED_WORK` task `duration: 32, durationUnit: "hours"`, 25 % ⇒ 8 h done. For 32 h left send `{ "duration": 40, "durationUnit": "hours" }`. A bare `{ "duration": 40 }` is 40 days: finish seven weeks late.

## 5. Read the effect

- `planner_get_project_info`: new end. `planner_get_critical_path`: compare with before; a new critical chain is news.
- `planner_compare_baseline`: deviating tasks (`deltaStart`, `deltaFinish` in working days, positive = later) and `projectEndDelta`.
- `planner_analyze_delay`: `projectEndDelta` = delivery impact. Never sum per-task deltas (a cascade counts several times). `criticalShifters` = where the delay sits. `projectEndDeltaAvailable` false = unknown, not zero.
- Task with a deadline: negative `schedule.totalFloat` in `planner_get_task` = missed.
- Deltas count in the current project calendar: careful after a calendar change.

## 6. Check

- Reached milestones have `completion: 100` with `actualFinish`; otherwise one in the past moves to the status date.
- Out of sequence (started, finish-to-start predecessor not finished): report it; change `progressMode` only on request.
- Every actual date came from the user.

## 7. Report

- Status date; tasks recorded as started, finished, running.
- Project end now, against the previous update and the baseline (`projectEndDelta`).
- Critical path and what changed on it.
- Where the delay sits (`criticalShifters`, each its own delta, not summed); missed deadlines, negative float.
- Unreported tasks that should have started; out-of-sequence work.
- Assumptions, and what you did not do (e.g. no new baseline: only on request after a scope change).
