# Planning well: guide for AI agents

This guide is for an AI agent that builds or maintains a schedule in Open Planner Studio through the `planner_*` MCP tools. It follows the same principles as the Help article for people, *Planning well* (https://open-planner-studio.open-aec.com/docs/en/gids-goed-plannen.md), but for each principle it names the tools that apply it and what the app does when you call them. A person presses a key to recalculate and clicks through menus; you call tools, and the app recalculates for you.

Where this guide and a tool description disagree, the tool description wins: read it in `tools/list`, it comes straight from the code. Never guess a tool name or a parameter. The copy of this guide that `planner_get_planning_guide` returns belongs to the app version you are connected to; if it differs from the public URL, the copy from the tool wins.

Two skills go with this guide. `planner_get_planning_guide` returns this guide and both skills, with the paths where a skill belongs:

- `goed-plannen`: building or restructuring a schedule (https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md)
- `progress-update`: recording a weekly progress update (https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md)

## What a schedule is here

A schedule is a calculation model, not a picture: tasks with a duration, connected by relationships, in a calendar. The app calculates every date from that model. What you do not enter as logic, the app cannot calculate with, and a date you fix by hand stops warning as soon as the work around it slips.

A planner works in a fixed order:

1. The goal: milestones and handover date.
2. The breakdown: phases, work packages, tasks.
3. The duration of each task.
4. The relationships.
5. Constraints and fixed dates, as few as possible.
6. Calendars.
7. Resources.
8. Critical path and float.
9. Baseline and progress.
10. Review, then report to the user.

In tool terms one thing moves forward: set the project start and the project calendar before you create tasks, because every duration counts in that calendar.

## How calculation works through the tools

There is no recalculate tool. The rules:

- Every mutating tool that changes project data recalculates the schedule at the end of its call. A `planner_batch` recalculates once, at the end of the whole batch. A call that changes nothing does not recalculate.
- Every read tool that returns calculated values (dates, float, critical path, load, baseline variance) first recalculates a schedule that is out of date, for example after the user changed something in the app. The envelope then carries `scheduleRecalculated: true`. That adds no undo step.
- Read the outcome with `planner_get_project_info` (`schedule.projectEnd`, `schedule.projectDuration`, `statistics.criticalTasks`) and `planner_get_critical_path`. Never base a statement about dates, float or the critical path on numbers from before your last change.

Every response carries an envelope. Three fields change what you may conclude:

- `datesAsRecorded: true`, with a `scheduleNote`: the document shows the dates recorded in the imported file, not a calculation. Read tools deliberately do not recalculate, because that would replace those dates. Say so whenever you report dates. Your first call that changes data recalculates and leaves this mode, so if the user wants the file's own dates, read and report them before you change anything.
- `scheduleStale: true` with a `scheduleNote` on a read: the user is in the middle of an edit in the app (dragging or typing), so the read did not recalculate. The dates may be out of date. Read again before you draw a conclusion.
- `scheduleError`: the last calculation failed, for example on a circular dependency. Reads do not try again as long as nothing changed. Fix the cause first: `planner_get_project_info` shows it under `schedule.error`; break a loop with `planner_update_dependencies` or `planner_remove_dependencies`. A change after which the calculation still fails is rolled back as a whole, so other edits do not stick until the error is gone.

Guards you will meet: `PAUSED` and `READ_ONLY` (the user paused the assistant or made it read-only; reading still works), `DIALOG_OPEN` (a dialog is open in the app; reading is refused too, except `planner_get_planning_guide`) and `DOC_DRIFT` (the user switched tabs; confirm the document with `planner_switch_document`). Do not retry in a loop: tell the user. Undo is shared with the user; for a what-if, work in a copy made with `planner_duplicate_document`.

## Principles and the tools for them

### Start from the goal, not from the tasks

First put down the moments that are fixed: start on site, permit final, weathertight, start of finishing, handover. Then the work that has to fit between them. A schedule that starts from a list of tasks becomes a sum, and a sum rarely lands on the date in the contract. Start from the milestones and you ask the right question: does the work fit between these two moments, and if not, what has to change.

- Create milestones with `planner_add_tasks`, item `isMilestone: true`. A milestone has duration 0; a `duration` above 0 on it is an error. `milestoneKind` (`START`, `FINISH`, `null` = automatic) sets its anchor.
- A handover that is fixed by contract gets `mandatory: true`. That is a marker for the Gantt and reports; it guards no date.
- To watch the handover date without steering the calculation, give the handover milestone a `deadline`. Nothing moves, but the chain before it gets negative total float as soon as the date no longer fits.
- `planner_update_project` `endDate` is metadata. It enforces nothing in the schedule, so it does not watch the handover.
- Set `planner_update_project` `startDate` before you create tasks: it is the anchor for new tasks and does not shift the existing schedule (only a later start date pulls root tasks without predecessor or constraint forward to it, reported as `anchorsClamped`). To shift a whole existing schedule, use `planner_move_project`.

### The breakdown: phases, work packages, tasks

Below the milestones comes the structure: phases, work packages, tasks. A task lasts between roughly one day and two weeks. Shorter means planning the shop floor instead of the project, and nobody maintains that for months. Longer means a task you cannot estimate and cannot track: "finishing ground floor, 40 days, 45% complete" tells nobody whether things are going well. Schedule reviews count the tasks longer than about two months; above a few percent that counts as a lack of detail. Too fine is just as damaging: a schedule nobody updates is fiction within three weeks. Two deliberate exceptions: a lead time (a ten-week window frame delivery is one block of waiting) and continuous supervision.

- Build the tree in one `planner_add_tasks` call. Every item has a `tempId` that starts with `tmp-` or `tmp_`; `parentId` may be an existing task id or a `tempId` from the same call.
- A task with subtasks is a summary task: the app derives its dates and duration from the tasks below it. Do not send a `duration` for a summary task; it has no effect, the derived duration wins.
- Restructure with `planner_move_task` (`newParentId`, `position`). `planner_delete_tasks` deletes the whole subtree: check `cascadedTaskIds` in the answer.
- Work that stops and resumes later stays one task with interruptions (`planner_set_task_splits`), not a series of tasks.
- A hammock for continuous supervision cannot be set through the tools. If one is needed, ask the user to make it in the app.
- Check the granularity in `planner_get_project_overview`: `dur` with `durUnit` per task.

### Estimating duration

A duration is an estimate of how long the work takes, not of how fast it could go: a normal day with the crew you will actually get. Optimism compounds along the chain. Do not hide risk inside individual durations; adding a day everywhere buries the margin where nobody can see or steer it. Make reserve visible instead, as a buffer task before handover or a separate weather allowance. Watch for double counting: the roughly 180 workable days a year that Dutch construction reckons with already deduct public holidays, the industry shutdown and lost days, so with holidays and shutdown in the calendar only weather delay remains.

- Always pass `duration`. A task created without one gets the default of 5 working days.
- `duration` counts in `durationUnit`: `days` (the default) or `hours`; give both together. Choose days for work that sets the pace on site (bricklaying, plastering), hours when the hours themselves are the unit (a three-hour inspection, shift work). A day duration may be a fraction (2.5), but a working-time day task still occupies whole working days in its dates (2.5 becomes 3). Hours need a calendar with concrete work blocks (`workTime` in `planner_update_calendar`).
- `durationType: "ELAPSEDTIME"` counts calendar days around the clock, for example concrete curing; the default `WORKTIME` counts working days of the calendar.
- Reserve: a separate buffer task before the handover milestone, linked like every other task. Expected weather loss: a separate task, or the days in the calendar (see Calendars). Never spread over the durations.
- Every duration you estimated yourself is an assumption you report.

### Relations: without a network it is not a schedule

The app calculates the dates along the relationships: a task only starts when its predecessors allow it. A task without relationships is tied to nothing. If the structural work slips two weeks, a disconnected finishing task does not follow, and the schedule lies without anything turning red. So every task gets at least one predecessor and one successor; only the first task and the final milestone are exempt.

Finish-to-start is the default; in a healthy construction schedule about nine out of ten relationships are finish-to-start. Start-to-start with a lag is for work that genuinely runs alongside, such as an installer three days behind the bricklaying; pair it with a finish-to-finish so the successor cannot finish first. Start-to-finish is almost never right in construction. Draw a start-to-start between tasks, not phases: with a phase as predecessor of a start-to-start or start-to-finish, the successor waits for the task in that phase that starts last. Be sparing with lags: a lag is waiting time without a visible reason. A negative lag (a lead) should not be there at all; split the predecessor or use a start-to-start.

- Add relationships with `planner_add_dependencies`: `predecessorId`, `successorId`, `type` (`FS`, `SS`, `FF`, `SF` or the long form) and optionally `lag`. `lag` counts in working days (`2`, `"+2d"`, fractions allowed) or as a percentage of the predecessor duration (`"+50%"`).
- A lag in calendar days cannot be set through the tools. For concrete curing, add a visible curing task with `durationType: "ELAPSEDTIME"` instead of a lag.
- Change a relationship with `planner_update_dependencies` and its `seqId` (in `planner_get_project_overview`, after the `#` in `rels`), not by removing and adding it again.
- A summary task as predecessor or successor is allowed; the relationship applies to its leaf tasks. A circular dependency is a hard error (`CYCLE`) that rolls back the whole call.
- Find tasks without any relationship with `planner_list_tasks` `zonder_relaties: true` (leaf tasks only). That filter only counts relationships on the task itself: a leaf task whose summary task carries the relationship is listed too, although it is tied into the network. Check such a row against the `rels` of its parent in `planner_get_project_overview` before you add anything. A task that has a predecessor but no successor does not show there: in `planner_get_project_overview` every row lists its outgoing relationships under `rels`, so a leaf task without `rels` (other than the final milestone, and unless its summary task carries the relationship) is missing a successor.

### Constraints and fixed dates: as few as possible

Every task starts out "as soon as possible", and almost always it should stay that way. A constraint is a date limit next to the relationships. The more you add, the less the schedule calculates and the more it becomes a drawing that no longer warns. Use a constraint only for a hard external date the user gave you: the permit that is not final before a date, the closure window the municipality granted, the utility connection date. "I want this task in May" is not an external fact; solve that with logic or a different duration. At most a few percent of the tasks carry a hard date limit.

- There is no start or finish field for a task. The only way to fix a date is `constraint` in `planner_add_tasks` or `fields.constraint` in `planner_update_tasks`: `{ "type": "SNET", "date": "YYYY-MM-DD" }`, with `type` one of `SNET`, `SNLT`, `FNET`, `FNLT`, `MSO`, `MFO` (and `ASAP`, `ALAP` without a date). `constraint: null` clears it.
- Never use a constraint to put a task where you want it: with a `SNET` the task stays on that date even when the chain before it runs late. Solve the order with relationships.
- To watch a date without steering, use `deadline` (an ISO date). Nothing moves, but the task gets negative total float as soon as it no longer meets the date.
- A hard pin (`hard: true`, only with `MSO` or `MFO`) only when the user explicitly asks for it. It gives negative float in the chain before it when the date does not fit.
- Negative float is never a calculation error: it is the schedule saying a deadline or fixed date does not fit. Report it.

### Calendars: the project first, then the exceptions

All durations count in working days or working hours of a calendar, so set up the project calendar before you enter durations: working days, working times, public holidays and the construction holiday. A calendar corrected halfway shifts the whole schedule. Add the foreseeable closures straight away: the frost period without concrete pours, the shutdown between Christmas and New Year.

- Read with `planner_get_calendars`; `projectDefaultId` is the project calendar. Which calendar is the project default cannot be switched through the tools: change the fields of that calendar, or ask the user.
- Generate holidays with `planner_update_calendar` `generate` (`country`, optional `region`, and for NL `bouwvak`: `geen`, `noord`, `midden` or `zuid`). The generator fills the days over the project span and replaces the existing holiday list.
- `rawHolidays` adds literal days (frost period, company shutdown) to the existing ones. It turns the calendar literal: it can no longer be regenerated (`becameLiteral: true`). `holidaysMode: "replace"` makes the list exactly what you send.
- Give a resource its own calendar only if it really differs, such as a facade builder who comes four days a week (`planner_manage_resources` `calendarId`). A resource calendar moves no task date; it only shows as overallocation in the histogram on a task working day the resource does not work.
- Generated holidays cover a fixed span of years (`generation.generatedFromYear` to `generatedToYear` in `planner_get_calendars`). Generated before there are tasks, that span runs from the year before the project start to three years after it. If the project end lies beyond `generatedToYear` once the tasks are in, run the same `generate` again: it then covers the span up to the project end.

### Resources: who does it, and is that possible

A schedule without resources answers only half the question. Once crews and equipment are assigned, the load shows what a timeline cannot: that on one day you need three plastering crews while you have two. Start with the resources that pinch: the tower crane, your own crews, subcontractors with a capacity ceiling, long lead times. Give each resource an honest capacity.

- Create resources with `planner_manage_resources` (`action: "create"`, `name`, `type`, `maxUnits` = capacity per working day, where 1 is one person or one piece).
- Assign with `planner_manage_assignments` (`action: "add"`, `taskId`, `resourceId`, `unitsPerDay`). Only on a leaf task (not a milestone or summary task), and one resource only once per task. Under the work rule `FIXED_WORK` or `FIXED_RATE` (the task's `workRule`, or the project's `defaultWorkRule`), adding or removing a resource or changing `unitsPerDay` changes the task duration; under the default `FIXED_DURATION_RATE` it does not.
- Read the load with `planner_get_resource_histogram`. Without arguments you get a summary per resource (`peakLoad`, `overallocatedDayCount`); with `resourceIds` and/or `van` and `tot` (from and to) the detail with the assignments that cause each peak. `bucket` takes the Dutch values `dag`, `week` or `maand`.
- Level only when the user asks for it, and only once logic and durations are in place. Run `planner_level_resources` with `dryRun: true` first and show the result. The default `constrainToFloat: true` keeps the project end fixed and reports what stays unresolved (`unresolved`, `unresolvedReasons`); `constrainToFloat: false` lets the end move (`projectEndDelta`). `planner_clear_leveling` undoes leveling.
- Do not level against a structural shortage. Leveling rearranges work in time; it does not hire extra plasterers. Report the shortage: phasing, extra capacity or different work is the user's decision.

### Critical path and float: where the schedule is vulnerable

The critical path is the chain without float: every day lost there is a day later handover. Total float says how far a task may run late without affecting the project end; free float, how far without moving its successor. Three signals matter. A task with a few days of float is near-critical, not safe. A task with an extreme amount of float (in schedule reviews more than 44 working days, about two months) is almost always missing a successor. And negative float is the schedule saying a deadline or fixed date does not fit.

- You never need to trigger a calculation (see "How calculation works through the tools"); just read after your last change.
- `planner_get_critical_path` returns the critical tasks with their `totalFloat` and the driving relationships between them.
- `planner_get_task` returns `schedule.totalFloat` and `schedule.freeFloat` (working days) and the early and late dates of one task. With negative total float the late dates lie before the early ones; that is the size of the overrun.
- `planner_list_tasks` with `kritiek: true` (critical) lists the critical tasks; summary tasks with a rolled-up flag come along, marked `summary: true`.
- There is no near-critical flag and no warnings list through the tools: compare `totalFloat` yourself, and check deadlines and constraints through negative `totalFloat`.

### Baseline before the start, then keep it up to date

Capture a baseline once the user approves the schedule and before work starts. Without that reference you can later only say that things go differently, not by how much or since when. A baseline stores the dates, not the assumptions behind them, so write the schedule basis down next to it: productivity figures, the calendar and why, what is deliberately left out, who supplied the lead times, who approved the schedule.

- `planner_save_baseline` (optional `name`) records the current dates, recalculating first if needed, and makes the new baseline active. It cannot run inside `planner_batch`.
- Put the schedule basis in your report to the user.
- Keeping the schedule up to date is a different job: follow the skill `progress-update`. In short: the status date first (`planner_update_project` `statusDate`, the user's reporting date, never invented), then actual start and finish dates and percent complete through `planner_update_tasks` `progress`, then `planner_compare_baseline` and `planner_analyze_delay`.
- The status date reschedules: unstarted work (completion 0) is pushed forward to it, so the project end can move without any progress. That does not happen when `project.schedulingProfile.conventions.unstartedIgnoresStatusDate` is `true` (the Microsoft Project profile; read it with `planner_get_project_info`). Only set a status date when you are going to record progress.
- Work done in a different order than the logic prescribes is out of sequence. How the calculation treats it is `progressMode` in `planner_update_project` (`RETAINED_LOGIC`, the default, or `PROGRESS_OVERRIDE`); change it only on the user's request, and treat out-of-sequence work as a reason to review the logic.
- A new baseline only for a real change of scope, and next to the first one: `planner_save_baseline` adds one and makes it active, `planner_list_baselines` shows them all, and `planner_activate_baseline` switches back to the original.

## Worked examples

A small network from Monday 7 June 2027 on the default construction calendar (Monday to Friday): Groundwork (3 working days), Pour foundation (2), Brickwork (5) and Roofing (3), linked finish-to-start. `planner_get_project_info` gives project end Wednesday 23 June 2027.

- A constraint instead of a relationship. `fields.constraint: { "type": "SNET", "date": "2027-06-21" }` on Brickwork moves the project end to Wednesday 30 June. Groundwork and Pour foundation get 5 working days of total float and are no longer critical. If the bricks arrive earlier after all, Brickwork stays on 21 June: the date steers now, not the logic. A `SNET` on 9 June instead changes nothing: the relationships already start Brickwork on Monday 14 June.
- A deadline instead of a constraint. `fields.deadline: "2027-06-18"` on Roofing moves nothing: Roofing stays on 21 to 23 June. But Roofing and the tasks before it get total float of −3: the agreement does not fit. Report that, instead of hiding it with a constraint.

## Before you report

Check, with the tools, the mistakes that make a schedule lie quietly:

- No task without relationships: every row that `planner_list_tasks` with `zonder_relaties: true` returns is either fixed or tied in through a relationship on its summary task, and every leaf task except the final milestone has a successor, on itself or on its summary task (`rels` in `planner_get_project_overview`).
- No constraint without an external date the user gave you, and no hard pin the user did not ask for.
- Task lengths between roughly a day and two weeks, with any exception named.
- No negative lags, and no unnamed lags where a visible task belongs.
- Holidays, construction holiday and foreseeable closures are in the calendar (`planner_get_calendars`).
- Leveled only on request, and not against a structural shortage.
- Every number you report was read after your last change, and `datesAsRecorded`, `scheduleStale` and `scheduleError` in the envelope were taken into account.
- Negative float and missed deadlines are named, not hidden.

## Report to the user

A user who lets you build a schedule gets back tasks, durations and relationships they did not type themselves. Always end with a short list of what you assumed: estimated durations, the chosen granularity, relationships the request did not mention, resource capacities, calendar assumptions such as working days or weather delay, and every constraint you set and why. Name what you deliberately did not do (not leveled, no baseline captured) and what the user should check. Give the project end and the critical path as you read them after your last change.
