---
name: goed-plannen
description: Use when an agent builds or restructures a schedule in Open Planner Studio through the planner_* MCP tools — setting up the project and calendar, creating a WBS, setting durations, linking tasks, constraints, assigning resources, leveling or capturing the first baseline. Gives the tool order, the recalculation rule, when to use planner_batch and the duty to report assumptions. For a weekly progress update use the progress-update skill instead.
---

# Planning well through the `planner_*` tools

## Install

With an agent that knows skills (Claude Code and related agents), save this file as
`.claude/skills/goed-plannen/SKILL.md` in the project folder you work in, or as
`~/.claude/skills/goed-plannen/SKILL.md` to have it in every project. The companion skill for progress
updates belongs next to it as `progress-update/SKILL.md`. Three ways to get the files:

- through the MCP bridge: `planner_get_planning_guide` returns the agent guide and both skills, with
  these install paths;
- by download: `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` and
  `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`;
- from the repository, where `public/skills/<name>/SKILL.md` is the source and
  `.claude/skills/<name>/SKILL.md` a byte-identical copy (guarded by `npm run verify:docs`).

## The principles are in the agent guide

The planning principles (milestones first, tasks of roughly one day to two weeks, finish-to-start as
the default relationship, constraints only for hard external dates, calendars, resources, float,
baseline) are in one place, with the tools that apply each of them:

- `https://open-planner-studio.open-aec.com/agent/planning-guide.md`, also returned by
  `planner_get_planning_guide`.

**Read it before you start on a schedule** and keep to it. This skill does not repeat it; it gives
the order of work and the rules that come from working through the bridge.

## The order of the tools

Check names and schemas in `tools/list`; never guess them.

1. **Orient.** `planner_list_documents`, `planner_get_project_info`, `planner_get_project_overview`.
   Never work on a document you have not read. Switch deliberately with `planner_switch_document`;
   start an empty one with `planner_new_document`, or a what-if copy with `planner_duplicate_document`.
2. **Project and calendar.** `planner_update_project` for the name and `startDate` (the anchor for new
   tasks, so before step 3); `planner_get_calendars` and `planner_update_calendar` for working days,
   working hours, public holidays, the construction holiday and foreseeable closures. Do this before
   step 3: every duration counts in that calendar.
3. **WBS and tasks.** `planner_add_tasks` (milestones, phases and subtasks in one call, with `tempId`s
   that start with `tmp-`), always with an explicit `duration`; `planner_update_tasks` for fields;
   `planner_move_task` for structure; `planner_delete_tasks` to clean up (it takes the whole subtree).
   Never give a summary task a duration. Work that is suspended and resumed later is one task with
   interruptions (`planner_set_task_splits`), not separate tasks.
4. **Relationships.** `planner_add_dependencies`, `planner_update_dependencies`,
   `planner_remove_dependencies`. Every task gets at least one predecessor and one successor, except
   the first task and the final milestone. Check with `planner_list_tasks` `zonder_relaties: true`
   and the `rels` per row in `planner_get_project_overview`. That filter ignores relationships on a
   summary task, so it also lists leaf tasks tied in through their phase: check those before you add
   anything.
5. **Constraints and deadlines.** Only for a hard external date the user gave you (see below).
6. **Resources.** `planner_manage_resources`, `planner_manage_assignments`; read with
   `planner_list_resources` and `planner_get_resource_histogram`. Under the work rule `FIXED_WORK` or
   `FIXED_RATE` (`workRule` on the task, or `defaultWorkRule` on the project), adding or removing a
   resource or changing `unitsPerDay` changes the task duration. Level only once logic and durations
   are in place, and only on request: `planner_level_resources` with `dryRun: true` first, then for
   real; `planner_clear_leveling` to undo it.
7. **Read the result.** `planner_get_project_info` (project end, duration, number of critical tasks)
   and `planner_get_critical_path`; `planner_get_task` for the float of one task.
8. **Baseline.** `planner_save_baseline` once the user approves the schedule, on its own (it cannot
   run inside a batch). Recording progress afterwards is the `progress-update` skill.

## Recalculation

There is no recalculate step. Every mutating tool that changes something recalculates at the end, and
every read tool that returns dates, float, the critical path or load first recalculates a schedule
that is out of date (the envelope then says `scheduleRecalculated: true`). Base your conclusions on
`planner_get_project_info` and `planner_get_critical_path` read after your last change. Watch the
envelope:

- `datesAsRecorded: true`: the dates come from the imported file, not a calculation; reads do not
  recalculate. Say so with every date you report. Your first change recalculates and leaves that mode.
- `scheduleStale: true` with a `scheduleNote` on a read: the user is editing in the app; read again
  before you conclude anything.
- `scheduleError`: the calculation fails (for example a circular dependency). Fix that first; a
  change after which the calculation still fails is rolled back.

## `planner_batch` for a coherent series

When steps belong together (a whole WBS with its relationships, a phase with tasks and assignments),
use `planner_batch` (at most 100 steps). The user gets one undo step, one recalculation and one
backup, and a structural error rolls the whole series back instead of leaving a half-built schedule.
Inside a batch, refer to tasks that do not exist yet by `tempId` (`tmp-…`); later steps get the real
id. Look up existing ids with read calls before the batch: a read step can only usefully be the last
one. Schemas are enforced inside a batch too. Not allowed as a step: `planner_batch` itself, undo and
redo, the document and file tools, `planner_save_baseline`, `planner_get_planning_guide` and
`planner_inspect_xer_provenance`.

## Constraints

Set no constraint without a reason. There is no start-date field: the only way to fix a date is a
constraint, and a `SNET` keeps the task on that date even when the chain before it runs late. A
constraint belongs only to a hard external date the user gave you (permit, closure window, connection
date). Do not set a hard pin (`hard: true`) on your own. To watch a date without moving anything, use a
`deadline`. As long as the user names no external date, leave everything "as soon as possible" and
get the order right with relationships.

## Report your assumptions

A user who lets you build a schedule gets back tasks, durations and relationships they did not type
themselves. So always finish with a short list of what you assumed: estimated durations, the chosen
granularity, relationships the request did not mention, resource capacities, calendar assumptions
such as working days or weather delay, and every constraint you set and why. Also say what you
deliberately did not do (not leveled, no baseline captured), what the user should check, and the
project end and critical path as you read them after your last change.
