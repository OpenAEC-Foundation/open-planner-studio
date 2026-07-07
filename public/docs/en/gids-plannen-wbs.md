# Planning & WBS

A schedule starts with a task structure: which tasks exist, how are they broken down into phases, and which moments are important enough to deserve a milestone? This guide goes deeper into that foundation than the [Quick start](docs://quick-start) guide — here you'll learn not just *how* to indent, but also what a summary task actually does, how the three milestone kinds differ, how to give tasks their own codes and fields, and how to keep notes per task.

## What you'll learn here

- Building a task structure (WBS) using indenting and summary tasks.
- Moving tasks within the same level, without re-indenting.
- The three milestone kinds and the separate mandatory flag for contractual moments.
- Managing activity codes and custom fields via the **Codes & fields** window, and grouping by them.
- Using notes (a per-task checklist) to keep track of open items.

Would you rather follow along with a complete example? Open [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) via **File → Examples** — the phasing "1. Voorbereiding" (Preparation) / "2. Fundering & ruwbouw" (Foundation & shell construction) / "3. Afbouw" (Finishing) / "4. Oplevering" (Handover) with its subtasks is exactly the structure explained below.

## Building a task structure

A flat list of tasks says nothing about how they relate. By indenting a task under another task, you build a tree structure (WBS — Work Breakdown Structure): the parent task then automatically becomes a **summary task**.

1. Select the task you want to place deeper in the structure.
2. Press **Alt+→** to indent. There's a second shortcut for the same action: **Alt+Shift+→** — handy if your keyboard layout already uses Alt+→ for something else. Both do exactly the same thing.
3. Prefer working with the mouse? Right-click the task and choose **Indent** from the context menu.
4. Went one level too far? **Alt+←** (or right-click → **Outdent**) moves the task back one level.
5. For a brand-new subtask there's a faster route: right-click the parent task and choose **Add subtask**. That creates a new, already-indented task in one step, instead of adding a task first and indenting it separately afterwards.

As soon as a task has at least one subtask, it automatically becomes a summary task: its bar in the Gantt chart then spans the full period from the earliest start to the latest finish of all subtasks beneath it, and its own duration and dates can no longer be set independently. A summary task is therefore always a derived value, never a schedule you enter directly — delete or shift the subtasks, and the summary task's bar adjusts itself automatically.

### Moving tasks without re-indenting

Besides changing a task's level (indent/outdent), you can also swap a task's position within the same level, without changing the structure itself:

- **Alt+↑** moves the selected task up, above the task currently above it.
- **Alt+↓** moves the task down.

This works at any level of the tree: move a phase task, and all of its subtasks automatically move along with it.

## Milestone kinds

A milestone is a task with no duration that marks a moment — a start, a handover, an inspection. Open Planner Studio has three ways to add a milestone, all via the **Tasks** ribbon group, using the arrow next to the **Milestone** button:

- **Start milestone** — marks the beginning of a phase or the project.
- **Finish milestone** — marks a completion, for example a handover.
- **Inspection point (mandatory)** — in practice a finish milestone with the **Mandatory (contractual)** flag already checked and its Type set directly to **Inspection**, so an inspection moment is recognisable as both contractually mandatory and an inspection from the start.

Prefer the shortcut **Ctrl+M**? That gives you a generic milestone ("New milestone") which you then rename and type yourself.

You'll see this same breakdown in the properties panel once you select a milestone with the **Milestone** checkbox on: the **Milestone kind** field offers **Automatic**, **Start milestone** or **Finish milestone**. "Automatic" lets the scheduling engine decide how the milestone behaves based on its relations — choose this if the milestone has no pronounced start or finish character. Separately, there's the **Mandatory (contractual)** checkbox: that flags a milestone as contractually binding, independent of whether it's a start or finish milestone. That way you can, for example, make a start milestone mandatory too, or — as with **Inspection point** — set up a mandatory finish milestone in one click.

## Codes & fields: activity codes and custom fields

Larger schedules quickly need extra dimensions that don't fit the WBS: which unit, which discipline, which contractor. That's what **activity codes** and **custom fields** are for, both managed via the **Codes & fields** window (the **Structure** ribbon group on the **Planning** tab, button labelled **Codes & fields**).

- **Activity codes** are freely definable dimensions (for example "Location" or "Discipline") with a list of values — each value has a **Code**, a **Description** and a **Colour**. A task can have at most one value per code type. Use **Add code type** to start a new dimension, and **Add value** to build up the possible values.
- **Custom fields** are typed fields of your own — **Text**, **Number**, **Integer**, **Cost**, **Date** or **Yes/No** — that appear as a column in the task table and can be filled in per task. Think of a field "Contractor" (text) or "Permit received" (yes/no).

Once created, you assign an activity code or fill in a custom field via the columns in the task table (make them visible first via **View → Columns…** if needed) or via the task's properties panel.

### Grouping by codes and fields

Activity codes and custom fields really pay off once you group by them: go to the ribbon tab **View**, open **Group** and pick the activity code or custom field to cluster by under **Field**. The task table then shows group headers instead of the WBS tree — handy for seeing, for example, all tasks per unit or per discipline together, across the phasing. You can set up to two grouping levels at once (for example first by unit, then by discipline).

## Notes: a checklist per task

Every task has a **Notes** section in the properties panel — essentially a small checklist that stays attached to the task. This is meant for the kind of loose action items that don't fit into a schedule date: "still need to check with the contractor", "still need to order material", "waiting on drawing v2".

1. Click **+ Add note**. A new, empty row appears with focus in the text field.
2. Type the note's text.
3. Check the checkbox once the item is handled — the text then gets struck through, but the note stays visible (marked done rather than deleted) so a task's history stays readable.
4. Use the trash icon to permanently remove a note.

Notes are purely informational: they don't affect the schedule or the calculation, so they're the right tool for remarks that can't be expressed as a date or duration. See a mix of open and completed notes in practice in the medium-sized example "Nieuwbouw 6 Rijwoningen De Akkers" (tag *aantekeningen*/notes in **File → Examples**).

## Keep reading

- See this structure — phasing, summary tasks, milestones — in practice in [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- Now that the structure is in place, the next step is linking tasks together: read the guide [Relations & constraints](docs://gids-relaties-constraints).
- Still new to Open Planner Studio? Start with the [Quick start](docs://quick-start) guide for a continuous exercise from an empty project to a calculated schedule.
