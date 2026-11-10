# Planning guide for AI agents

`tools/list` wins; never guess a tool or parameter.

## Order

1. Read the target before editing: planner_list_documents, planner_get_project_info, planner_get_project_overview.
2. Before tasks: planner_update_project (name, `startDate`, user-given `endDate`); planner_get_calendars → planner_update_calendar.
3. Milestones, then WBS, durations, relationships, constraints: one planner_batch.
4. planner_manage_resources, then all assignments in one planner_manage_assignments.
5. Read: planner_get_project_info, planner_get_critical_path, planner_get_task (float), planner_get_resource_histogram (load).
6. planner_save_baseline only after user approval, before work; later only for a real scope change, beside the first. Set no `statusDate` while building.

## Recalculation

- No recalculate tool; no-op won't recalculate. No dummy change: ask the user.
- Report only numbers read after your last change.
- `datesAsRecorded`: say so with every date; change nothing without the user's explicit consent.
- What-if: in a planner_duplicate_document copy.
- `scheduleError`: fix it first; a change that leaves it is rolled back.
- Guards `PAUSED`, `READ_ONLY`, `DIALOG_OPEN`, `DOC_DRIFT`: no retry loop, tell the user.

## Tasks and durations

- Tasks ~1 day–2 weeks; >a few % above ~2 months = too coarse. Exceptions: lead times, continuous supervision.
- Normal pace, available crew, no margin. Reserve: visible buffer before handover; weather: a task or days off in the calendar.
- ~180 workable days/year already exclude holidays, shutdown and weather: count each once.
- Every leaf: explicit `duration` + `durationUnit`; existing task: read the unit with planner_get_task.

## Relationships

- Every task ≥1 predecessor and ≥1 successor, except the first task and the final milestone.
- FS default (~9 in 10). SS + lag only for real overlap, paired with FF. SF: almost never.
- SS/SF between tasks, not phases.
- Few lags; no negative lag (split the predecessor, or SS). No calendar-day lag: a visible `ELAPSEDTIME` curing task.
- External links: only the user adds one (in-app). Before reporting dates that depend on one: planner_refresh_external_links; report `sourceMissing: true`.
- Gaps: planner_list_tasks `zonder_relaties: true`. No successor = no `rels` on the leaf or its summary in planner_get_project_overview (except the final milestone or an external successor).

## Constraints and dates

- Only for hard external dates from the user (permit, closure, connection); ≤ a few % of tasks. Never to place work ("in May"): use links or duration.
- `hard: true` only on the user's explicit request.
- Watch a date (e.g. handover) with `deadline`: moves nothing, gives negative float once it no longer fits (a late constraint too).

## Calendars

- Add foreseeable closures now (NL: `bouwvak`; frost, Christmas shutdown); a later correction shifts everything.
- User-given `endDate` first, then `generate`, then `rawHolidays`. End past the generated years ⇒ both again: `generate` replaces all holidays.
- Resource calendar only if it really differs; it moves no task.

## Resources

- Start with what pinches; honest `maxUnits`.
- Fixed amount (permit, inspection): a `COST` resource; assign with `costAmount`, no `unitsPerDay`, also on a milestone. No load, no duration effect.
- Level only on request after logic/durations; show `dryRun: true` first. Never level a structural shortage: report; user decides capacity/phasing.

## Float

Near-critical (no flag): `totalFloat` of a few days, not safe. Over ~44 working days: usually a missing successor.

## Check, then report

Report assumptions (durations, granularity, added links, capacities, calendars, constraints/reasons, productivity, lead-time sources, who approved), omissions, user checks; end/critical path; negative float/missed deadlines/overloads.
