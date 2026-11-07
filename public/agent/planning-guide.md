# Planning guide for AI agents

`tools/list` wins over this guide for parameters, limits and answer fields. Never guess a tool or parameter.

## Order

`planner_update_project` `startDate` and the project calendar first (every duration counts in it); then milestones (start on site, permit final, weathertight, start finishing, handover), WBS, durations, relationships, constraints, resources, float, baseline; check; report.

The app calculates every date from the logic; a hand-fixed date stops warning when work slips.

## Recalculation

- No recalculate tool: every data change recalculates (`planner_batch` once, at its end). A call that changes nothing does not recalculate; never change something only to force one: ask the user.
- Report only numbers read after your last change (`planner_get_project_info`, `planner_get_critical_path`).
- `datesAsRecorded`: say so with every date. Your first change replaces the recorded dates: only on the user's explicit request, after reporting them if wanted. Compare with a calculation in a `planner_duplicate_document` copy.
- `scheduleError`: fix first (`schedule.error` in `planner_get_project_info`; break a cycle with `planner_update_dependencies` or `planner_remove_dependencies`); until then every change is rolled back.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT` (confirm with `planner_switch_document`): no retry loop, tell the user.

## Batch

A coherent series (WBS with relationships, phase with tasks and assignments) ⇒ one `planner_batch`.

## Milestones and dates

- Watch a date (e.g. handover) only with `deadline`: moves nothing, gives negative float once it no longer fits.

## WBS

- Task length ~1 day to 2 weeks. Over a few percent of tasks above ~2 months = too coarse. Exceptions: a lead time (one waiting block), continuous supervision.
- Whole tree in one `planner_add_tasks`; milestones are tasks with `isMilestone: true`. Never a `duration` on a summary task.
- Work that stops and resumes: one task with `planner_set_task_splits`.
- Hammock: not possible through the tools; ask the user to make it in the app.

## Durations

- Estimate = normal pace with the crew you will really get. No margin in durations: reserve = visible buffer task before handover; weather = a task or calendar days.
- ~180 workable days a year already excludes holidays, shutdown and lost days; with those in the calendar only weather remains.
- `duration` always with `durationUnit`: a bare number means days, also on an hour task (read the unit with `planner_get_task` first).
- Days for work that sets the site pace; hours when hours are the unit (inspection, shifts).

## Relationships

- Every task ≥1 predecessor and ≥1 successor, except the first task and the final milestone.
- Finish-to-start default (~9 in 10). Start-to-start + lag only for real overlap, paired with finish-to-finish. Start-to-finish: almost never.
- SS/SF between tasks, not phases: the successor would wait for the phase's last-starting task.
- Few lags; no negative lag (split the predecessor, or SS). No calendar-day lag: a visible `"ELAPSEDTIME"` curing task.
- Gaps: `planner_list_tasks` `zonder_relaties: true`. A missing successor shows only as a leaf without `rels` (on itself or its summary) in `planner_get_project_overview`, other than the final milestone.

## Constraints

- Only for a hard external date the user gave you (permit, closure window, utility connection). "I want it in May" is not one: use logic or duration. At most a few percent of tasks.
- Never a constraint to place a task: a `SNET` stays on its date when the chain before it slips.
- `hard: true` only on the user's explicit request.
- Negative float = a date does not fit; report it, it is no calculation error.

## Calendars

- Add foreseeable closures now (frost, Christmas shutdown); a later correction shifts everything.
- `generate` covers through the year after the project end (the later of `endDate` and the calculated end): set `endDate` first when the user gave an end.
- `generate` first, then `rawHolidays` (it adds; `generation` is then gone).
- Project end past the generated years ⇒ the same `generate` again, then `rawHolidays` again (`generate` replaces them).
- Resource calendar only if it really differs; it moves no task.

## Resources

- Start with what pinches; honest `maxUnits`.
- Under `FIXED_WORK` or `FIXED_RATE` an assignment change changes the duration.
- Level only on request, after logic and durations: `dryRun: true` first, show it. Never against a structural shortage: report it; capacity or phasing is the user's decision.

## Float

No near-critical flag: compare `totalFloat` yourself. A few days = near-critical, not safe. Over ~44 working days = usually a missing successor.

## Baseline and progress

- `planner_save_baseline` once the user approves, before work starts. Report the schedule basis (productivity, calendar, what is left out, lead-time sources, who approved).
- New baseline only for a real scope change, next to the first.
- `statusDate` only when you record progress: it pushes unstarted work. Progress: `planner_get_planning_guide` `part: "progress-update"`. Change `progressMode` only on request.

## Check, then report

Check every rule above. Report assumptions (durations, granularity, added relationships, capacities, calendar, constraints and reasons), omissions and checks for the user; fresh project end/critical path; negative float/missed deadlines.
