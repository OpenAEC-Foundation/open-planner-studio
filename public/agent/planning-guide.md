# Planning guide for AI agents

`tools/list` wins over this guide. Never guess a tool or parameter.

## Order

1. Orient: `planner_list_documents`, `planner_get_project_info`, `planner_get_project_overview`. Never change a document you have not read. Switch only on purpose (`planner_switch_document`); empty: `planner_new_document`; what-if: `planner_duplicate_document`.
2. Before any task: `planner_update_project` (name, `startDate`, `endDate` if the user gave one), then the project calendar (`planner_get_calendars`, `planner_update_calendar`): every duration counts in it.
3. Milestones, then WBS, durations, relationships, constraints: one `planner_batch` (`planner_add_tasks` by `tempId`, then `planner_add_dependencies`).
4. Resources: `planner_manage_resources`, then all assignments in one `planner_manage_assignments`; load: `planner_get_resource_histogram`.
5. Read: `planner_get_project_info`, `planner_get_critical_path`, `planner_get_task` (float); check; report.
6. `planner_save_baseline` only after the user approves.

## Recalculation

- No recalculate tool: every data change recalculates (`planner_batch` once, at its end). A call that changes nothing does not recalculate; never change something only to force one: ask the user.
- Report only numbers read after your last change.
- `datesAsRecorded`: say so with every date. Your first change replaces the recorded dates: only on the user's explicit request, after reporting them if wanted. Compare with a calculation in a `planner_duplicate_document` copy.
- `scheduleError`: fix first (`schedule.error` in `planner_get_project_info`; break a cycle with `planner_update_dependencies` or `planner_remove_dependencies`); until then every change is rolled back.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user.

## WBS

- Tasks ~1 day–2 weeks; >a few % above ~2 months = too coarse. Exceptions: lead times, continuous supervision.
- Milestones are tasks with `isMilestone: true`.
- Work that stops and resumes: one task with `planner_set_task_splits`.
- Hammock: only in the app; ask the user.

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

## Constraints and dates

- Only for a hard external date the user gave you (permit, closure window, utility connection). "I want it in May" is not one: use logic or duration. At most a few percent of tasks.
- Never a constraint to place a task: a `SNET` stays on its date when the chain before it slips.
- `hard: true` only on the user's explicit request.
- Watch a date (e.g. handover) with `deadline`: moves nothing, gives negative float once it no longer fits.
- Negative float = a date does not fit, no calculation error: report it.

## Calendars

- Add foreseeable closures now (frost, Christmas shutdown); a later correction shifts everything.
- `generate` after `endDate` (with `create: true` it covers only up to start year + 3), then `rawHolidays` (adds; removes `generation`). End past the generated years ⇒ both again: `generate` replaces all holidays.
- Resource calendar only if it really differs; it moves no task.

## Resources

- Start with what pinches; honest `maxUnits`.
- Level only on request, after logic and durations: `dryRun: true` first, show it. Never against a structural shortage: report it; capacity or phasing is the user's decision.

## Float

Float is in working days, also on hour tasks. No near-critical flag: compare `totalFloat` yourself. A few days = near-critical, not safe. Over ~44 working days = usually a missing successor.

## Baseline and progress

- Baseline before work starts. Report the schedule basis (productivity, calendar, what is left out, lead-time sources, who approved).
- New baseline only for a real scope change, next to the first.
- No `statusDate` while building. Progress: `planner_get_planning_guide` `part: "progress-update"`.

## Check, then report

Check every rule above. Report assumptions (durations, granularity, added relationships, capacities, calendar, constraints and reasons), omissions and checks for the user; fresh project end/critical path; negative float/missed deadlines.
