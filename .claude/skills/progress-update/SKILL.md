---
name: progress-update
description: Use when an agent records progress in an Open Planner Studio schedule through the planner_* MCP tools — a weekly or periodic status update: setting the status date, entering actual start and finish dates and percent complete, correcting remaining work, and reporting the variance against the baseline, the critical path and the new finish date. For building or restructuring a schedule use the goed-plannen skill instead.
---

# Weekly progress update through the `planner_*` tools

## Install

With an agent that knows skills (Claude Code and related agents), save this file as
`.claude/skills/progress-update/SKILL.md` in the project folder you work in, or as
`~/.claude/skills/progress-update/SKILL.md` to have it in every project. `planner_get_planning_guide`
returns it together with the agent guide and the skill `goed-plannen`; the download URL is
`https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`.

The planning principles behind this, including the status date and the baseline, are in the agent
guide: `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.

## Why this is a separate job

Building a schedule is about logic. A progress update is about facts: what really started and
finished up to a reporting date, and what that does to the handover. The facts come from the user,
never from you. Actual dates are the record that will be looked at later in a site meeting or a delay
claim, so a guessed date is worse than a missing one.

## 1. Orient

- `planner_get_project_info`: the current `project.statusDate` (the previous update), the project end
  (`schedule.projectEnd`) and `project.schedulingProfile.conventions.unstartedIgnoresStatusDate`.
  Note the project end before you change anything; you report the difference.
- `planner_list_baselines`: is there an active baseline? Without one, `planner_compare_baseline` and
  `planner_analyze_delay` refuse. Do not quietly save a baseline now: a baseline saved after the delay
  only measures from now on. Ask the user whether an older baseline should be activated
  (`planner_activate_baseline`) or a new one saved.
- Watch the envelope. With `datesAsRecorded: true` the dates come from an imported file; your first
  change recalculates them, so read and report the recorded dates first if the user needs them. With
  `scheduleError` the calculation fails; fix that first.

## 2. Get the facts from the user

Ask for, and do not invent:

- the reporting date: that becomes the status date;
- for every task that started: the actual start date;
- for every task that finished: the actual finish date;
- for every task still running: the percent complete and, if the user has one, the remaining estimate;
- milestones that were reached, with their date.

Also ask about every task that should have started by the reporting date but has no report. Find them
before you set the status date, with `planner_list_tasks` `status: "NOT_STARTED"` and `tot` (to) set to
the reporting date. Do it in this order: once the status date is set, unstarted work is pushed forward
to it, and before it is set `planner_compare_baseline` shows no deviation for work that simply has not
started yet.

## 3. Status date and progress, in one batch

Put the status date and all progress lines in one `planner_batch`: one undo step for the user, one
recalculation, and a rejected line does not undo the rest.

1. `planner_update_project` with `statusDate` (`YYYY-MM-DD`; with hour planning `YYYY-MM-DDTHH:mm`).
   Without a status date every progress line is refused.
2. `planner_update_tasks` with one item per task: `{ "id": …, "progress": { "completion": …,
   "actualStart": …, "actualFinish": … } }`.

The rules the tool applies (all checked against the code):

- `completion` is a percentage, 0 to 100. Only `completion`, `actualStart` and `actualFinish` are
  allowed in `progress`; anything else is refused.
- A finished task: `completion: 100` with both `actualStart` and `actualFinish`. Without
  `actualFinish`, a 100% task gets the status date as its actual finish. `actualFinish` alone also
  makes the task 100% complete, but then sets the actual start to that same day.
- A running task: `completion` with `actualStart`. Without `actualStart` the tool derives the actual
  start from the planned start, and which planned start depends on the route. Inside this batch
  nothing is recalculated between the two steps, so it is the planned start from before the status
  date. In separate calls the status date has already pushed unstarted work forward to it, so the
  derived start lands on the status date. Either way it is a guess, not the user's date: always pass
  the actual dates you were given.
- A task whose planned start lies after the status date and has no actual start is refused unless you
  pass `actualStart`.
- Actual dates may not lie after the status date, and `actualFinish` may not lie before `actualStart`.
  `null` clears an actual date.
- A summary task (phase) takes no progress: its completion and actual dates are derived from the tasks
  below it. Record progress on the leaf tasks.
- Refused lines come back as `itemRejections` (in a batch: `rejections` at the top of the answer); the
  valid lines are applied. One task can appear both as updated and as refused. Read every rejection
  and resolve it with the user.

## 4. Remaining work

There is no remaining-duration field. The remaining duration follows from the percentage:
duration × (1 − completion), in whole days for a day task. If the user's remaining estimate differs,
change the duration of the running task with `planner_update_tasks` `fields.duration`. The work done
stays the same: remaining duration = new duration − work done, and the percentage adjusts. The answer
reports it under `progressAdjusted` (for example 10 days at 40%, changed to 12 days: 8 days left, 33%).
A duration shorter than the work done is refused.

## 5. Read the effect

- `planner_get_project_info`: the new project end.
- `planner_get_critical_path`: the critical tasks now. Compare with before: a new critical chain is
  news for the user.
- `planner_compare_baseline`: the tasks that deviate from the active baseline (`status` `late`,
  `early`, `new` or `dropped`, with `deltaStart` and `deltaFinish` in working days; positive is later)
  and `projectEndDelta`.
- `planner_analyze_delay`: `projectEndDelta` is the delivery impact in working days. Never add up the
  per-task deltas: a delay that cascades along a chain would be counted several times. The
  `criticalShifters` say where the delay sits. If `projectEndDeltaAvailable` is `false`, the impact is
  unknown, not zero.
- `planner_get_task` for a task with a deadline: negative `schedule.totalFloat` means the deadline is
  no longer met.

Deltas are measured in working days of the current project calendar; after a calendar change, read
them with care.

## 6. Check before you report

- Reached milestones are signed off (`completion: 100` with `actualFinish`); an unsigned milestone in
  the past moves to the status date by itself.
- Out of sequence: a started task whose finish-to-start predecessor is not finished. Report it as a
  reason to review the logic; do not change `progressMode` (`planner_update_project`) unless the user
  asks.
- No actual date you made up; every date came from the user.

## 7. Report to the user

- The status date, and which tasks you recorded as started, finished or running.
- The project end now, against the previous update and against the baseline (`projectEndDelta` from
  `planner_analyze_delay`).
- The critical path, and what changed on it.
- Where the delay sits (`criticalShifters`, each with its own delta, not summed), and any missed
  deadline or negative float.
- Tasks that should have started but were not reported, and out-of-sequence work.
- What you assumed, and what you deliberately did not do, such as no new baseline.

A new baseline only on the user's request after a real change of scope: `planner_save_baseline` adds
one next to the old one and makes it active; `planner_activate_baseline` switches back to the original
for comparisons.

## Example

Groundwork (3 working days), Pour foundation (2), Brickwork (5) and Roofing (3), linked
finish-to-start from Monday 7 June 2027; the baseline has project end Wednesday 23 June. The report
on Friday 11 June: Groundwork ran 7 to 9 June, Pour foundation started on 10 June and is half done.

- One batch: `statusDate: "2027-06-11"`, then Groundwork `completion: 100, actualStart: "2027-06-07",
  actualFinish: "2027-06-09"` and Pour foundation `completion: 50, actualStart: "2027-06-10"`. Project
  end stays 23 June, `projectEndDelta` 0.
- The user then says the foundation needs three more days. Changing its duration from 2 to 4 days
  gives `progressAdjusted` with 25% and 3 days remaining. Project end becomes Friday 25 June;
  `planner_analyze_delay` reports `projectEndDelta` 2, with Pour foundation, Brickwork and Roofing as
  critical shifters, each 2 days late. The delay is 2 working days, not 6.
- The trap: had you sent only `completion: 100` for Groundwork and `completion: 50` for Pour
  foundation in that batch, without actual dates, Groundwork would get the status date (11 June) as
  its actual finish instead of 9 June, and the project end would show 1 day of delay that never
  happened (Thursday 24 June). In separate calls it is worse: Groundwork's actual start and finish
  both land on 11 June, Pour foundation is refused (its planned start has moved past the status
  date), and the end shows 2 days of delay. Setting the status date alone, without any progress,
  already moves the project end of this schedule from 23 to 29 June, because all unstarted work is
  pushed to 11 June.
