# Planning & WBS

A schedule starts with a task structure: which tasks exist, how are they broken down into phases, and which moments are important enough to deserve a milestone? This guide goes deeper into that foundation than the [Quick start](docs://quick-start) guide — here you'll learn not just *how* to indent, but also what a summary task actually does, how the three milestone kinds differ, how to give tasks their own codes and fields, and how to keep notes per task.

## What you'll learn here

- Building a task structure (WBS) using indenting and summary tasks.
- Moving tasks within the same level, without re-indenting — with the keyboard, by dragging, or in
  the spreadsheet-style **Table** tab.
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

As soon as a task has at least one subtask, it automatically becomes a summary task: its bar in the Gantt chart then spans the full period from the earliest start to the latest finish of all subtasks beneath it, and its own duration and dates can no longer be set independently. A summary task is therefore normally always a derived value, never a schedule you enter directly — delete or shift the subtasks, and the summary task's bar adjusts itself automatically. One exception: a **manually scheduled** summary task (that flag arises from a `.mpp` import) does *not* roll up — it keeps its own stored dates, even when its subtasks shift.

**Collapse and expand.** With a large WBS you'll sometimes want to compact the tree temporarily. The **View** ribbon tab, **Outline** group, has two separate buttons for this — **Collapse** and **Expand** — deliberately not a single toggle, because with a mixed selection (some branches open, others closed) a toggle could never set everything the same way.

- **With a selection**, the buttons act on the selected tasks; only tasks with subtasks are affected, standalone tasks are ignored.
- **Without a selection**, they act on the whole schedule. Deselect with **Esc**, or click an empty area of the Gantt view.
- In a grouped view (see *Grouping by codes and fields* further down) the buttons collapse/expand the group bands instead — including nested bands — rather than the tasks.

The arrow in front of a summary task still works as before, to open or close just that one branch.

### Inserting a new task in the right place

New tasks don't have to land at the bottom. Every button and key that creates a task follows the
same rule:

- **If a task is selected**, the new task goes directly **below** that task — not at the bottom of
  the whole list. It inherits the level and parent of your selection, so a new task inside a phase
  stays inside that phase.
- **If nothing is selected**, it goes at the end, as before.
- **If several tasks are selected**, it lands below the **bottommost** task of your selection as
  shown on screen — never in the middle of the selection, and the order in which you clicked them
  makes no difference.

If the new task ends up with a parent this way (through your selection, or because you used **Add
subtask**), it also takes over that parent's **Type** instead of the usual default — a new task
inside "2. Foundation & shell" immediately gets the same bar colour as the rest of that phase. This
only happens at creation time; indenting or dragging an existing task later leaves its Type alone.

This applies to the **Task** button and the **Milestone** menu in the **Tasks** ribbon group, and to
**New task** in the context menu. That ribbon group is on the **Home** tab as well as the **Table**
tab, with the same three buttons (**Task**, **Milestone**, **Link**), so you no longer have to
switch tabs to enter tasks.

The keyboard is faster still:

- **Insert** inserts a task **above** the selection.
- **Ctrl+I** (**Cmd+I** on macOS) inserts a task **below** the selection — usually where you want to
  go while working down a list.

Both also appear in the shortcut overview (**Ctrl+/**), under the **Structure** category.

**Tree view only.** Inserting above or below is a structural change, and that only makes sense as
long as the displayed order is the real order. With a filter, a sort or a grouping active, the new
task would show up somewhere other than where you put it. The app then refuses the insert above/below
and shows a bar explaining why, with a button that clears the filter, sort and grouping settings in
one click. The **Task** and **Milestone** buttons keep working in that case, but place the task at
the end — with the same explanation.

### Moving tasks without re-indenting

Besides changing a task's level (indent/outdent), you can also swap a task's position within the same level, without changing the structure itself:

- **Alt+↑** moves the selected task up, above the task currently above it.
- **Alt+↓** moves the task down.

This works at any level of the tree: move a phase task, and all of its subtasks automatically move along with it.

Prefer the mouse? Grab a task by its row in the task table (the left-hand column of the Gantt view,
with the same drag behaviour on the **Table** ribbon tab) and drag it up or down. Drop it between two
rows to reorder it among its siblings, same as Alt+↑/↓. Drop it onto the lower part of a summary
task's row instead, and it nests: the task becomes that summary task's new last subtask, re-indenting
it in one motion — that's the mouse equivalent of Alt+→. Select several tasks first (Ctrl/Cmd-click,
or a box-select) and the whole selection drags and drops together.

The **Table** ribbon tab shows this same structure as a plain, editable grid, useful when you're
entering or correcting a lot of tasks at once: a single click on a cell only selects it — booleans,
dropdowns and dates never change just from clicking. Editing happens with **F2** or **Enter**, or by
typing directly (which replaces the existing content and starts editing right away); double-click
instead opens the properties panel for the active task. The arrow keys move a cell cursor without
opening it, and **Tab**/**Shift+Tab** moves to the next or previous cell, continuing onto the next or
previous task row. Indenting and outdenting remain **Alt+→**/**Alt+←**. **Enter** on the very last
row simply opens the active cell's editor; **↓** stops there (no new row). To insert a new task —
above the active row, with the cursor placed straight in its name cell — use **Insert**.

## Milestone kinds

A milestone marks a moment — a start, a handover, an inspection — and normally has zero duration; if a milestone has been given a duration greater than 0 itself (via an import, for example), Open Planner Studio simply schedules it as a task with that duration, with the **Milestone** checkbox still on. Open Planner Studio has three ways to add a milestone, all via the **Tasks** ribbon group, using the arrow next to the **Milestone** button:

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
