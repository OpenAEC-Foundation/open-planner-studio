# Planning guide for AI agents

`tools/list` wins over this guide. Never guess a tool or parameter.

## Order

1. Orient: planner_list_documents, planner_get_project_info, planner_get_project_overview. Never change a document you have not read.
2. Before tasks: planner_update_project (name, `startDate`, user-given `endDate`); planner_get_calendars → planner_update_calendar (durations use it).
3. Milestones, then WBS, durations, relationships, constraints: one planner_batch (planner_add_tasks by `tempId`, then planner_add_dependencies).
4. Resources: planner_manage_resources, then all assignments in one planner_manage_assignments.
5. Read: planner_get_project_info, planner_get_critical_path, planner_get_task (float), planner_get_resource_histogram (load).
6. planner_save_baseline only after the user approves, before work starts; later only for a real scope change, next to the first. Set no `statusDate` while building.

## Recalculation

- Changes recalculate (planner_batch once, at its end); no-op calls do not. No recalculate tool: never make a dummy change to force one; ask the user.
- Report only numbers read after your last change.
- `datesAsRecorded`: say so with every date. Your first change replaces them (the end can move): only with the user's explicit consent; compare in a planner_duplicate_document copy.
- `scheduleError`: fix first (`schedule.error` in planner_get_project_info); until then every change is rolled back.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user.

## WBS

- Tasks ~1 day–2 weeks; >a few % above ~2 months = too coarse. Exceptions: lead times, continuous supervision.
- Hammock: only in the app; ask the user.

## Durations

- Normal pace, available crew, no margin. Reserve: visible buffer before handover; weather: a task or calendar days.
- ~180 workable days a year already excludes holidays, shutdown and lost days; with those in the calendar only weather remains.
- Every leaf: explicit `duration` + `durationUnit`; existing task: read the unit with planner_get_task.
- Site work: days; inspections/shifts: hours.

## Relationships

- Every task ≥1 predecessor and ≥1 successor, except the first task and the final milestone.
- FS default (~9 in 10). SS + lag only for real overlap, paired with FF. SF: almost never.
- SS/SF between tasks, not phases.
- Few lags; no negative lag (split the predecessor, or SS). No calendar-day lag: a visible `"ELAPSEDTIME"` curing task.
- Gaps: planner_list_tasks `zonder_relaties: true`. No successor = no `rels` on the leaf or its summary in planner_get_project_overview (except the final milestone).

## Constraints and dates

- Only for hard external dates from the user (permit, closure, connection); ≤ a few % of tasks. Never to place work ("in May"): use links or duration; a `SNET` stays when predecessors slip.
- `hard: true` only on the user's explicit request.
- Watch a date (e.g. handover) with `deadline`: moves nothing, gives negative float once it no longer fits.
- Negative float = a date does not fit, not a calculation error.

## Calendars

- Add foreseeable closures now (NL: `bouwvak`; frost, Christmas shutdown); a later correction shifts everything.
- `generate` after `endDate`, then `rawHolidays`. End past the generated years ⇒ both again: `generate` replaces all holidays.
- Resource calendar only if it really differs; it moves no task.

## Resources

- Start with what pinches; honest `maxUnits`.
- Level only on request, after logic and durations: `dryRun: true` first, show it. Never against a structural shortage: report it; capacity or phasing is the user's decision.

## Float

No near-critical flag: compare `totalFloat` yourself. A few days = near-critical, not safe. Over ~44 working days = usually a missing successor.

## Check, then report

Check all rules. Report assumptions (durations, granularity, added links, capacities, calendars, constraints/reasons), omissions, user checks; schedule basis (productivity, calendar, lead-time sources, who approved); fresh end/critical path; negative float/missed deadlines/overloads.
