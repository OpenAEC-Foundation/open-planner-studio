# Adding tasks and milestones

Goal: put a new task or milestone in your schedule, in the place where it belongs.

## When you need this

You are building a schedule, work is added, or you want to record a moment such as handover or an inspection.

A **task** is work that takes time. A new task lasts 5 work days by default (with hour planning the project default can be hours). A **milestone** is a moment without duration: 0 days. A task with subtasks is called a **summary task**, in construction often a phase. Its duration and dates follow from its subtasks as soon as you use **Calculate** (F5).

## Steps

### Adding a task

1. Choose *Home › Tasks › Task*. The same button is on the *Table* tab.
2. The *Properties* panel opens and the *Name* field is selected. Type the name and press Enter.

The new task is first called *New task* and starts on the project start.

If a task is selected, the new task goes directly below it, at the same level. If the selected task is a summary task, the new task goes below that whole phase, so after its subtasks. If nothing is selected, it goes at the bottom of the list. The button's tooltip says which of the two will happen: *New task directly below the selection* or *New task at the bottom of the list*. If you select several tasks, one new task is created, below the lowest of the selection as you see it on screen.

### Above or below a specific task

Right-click the task and choose *Insert above* or *Insert below*. The keyboard works too: Insert adds above the selected task, Ctrl+I (⌘+I on a Mac) below it. In the task list the name cell opens straight away after Insert, ready for typing.

With several tasks selected, one new task is created: *Insert above* puts it above the topmost selected task, *Insert below* below the lowest.

### Adding a subtask

Right-click the task and choose *Add subtask*. The new task goes at the bottom of that task's subtasks. In the task list next to the Gantt, a summary task also has a small **+** after its name that does the same.

### Adding a milestone

1. Choose *Home › Tasks › Milestone ▾* and then *Start milestone*, *Finish milestone* or *Inspection point (mandatory)*.
2. Type the name and press Enter. The placement follows the same rule as for *Task*.

The three kinds differ like this:

- A *Start milestone* belongs at the start of the day, a *Finish milestone* at the end of the day. In the Gantt the diamond sits at the left or right of the day column respectively. It matters for the successor too. Say a milestone is on Tuesday 29 September 2026 and a task follows it with a Finish-Start relation: after a start milestone that task begins on that same Tuesday, after a finish milestone on Wednesday 30 September.
- An *Inspection point (mandatory)* is a finish milestone with the task type *Inspection* and the tick *Mandatory (contractual)*.

### Turning an existing task into a milestone

Right-click the task and choose *Toggle milestone*, or tick *Milestone* in the *Properties* panel. The menu item works for the whole selection. The duration becomes 0.

If you turn it off again, it stays an ordinary task with duration 0: enter a duration yourself.

### Other ways

- Ctrl+M (⌘+M on a Mac) puts a new milestone at the bottom of the list, even if a task is selected. The *Properties* panel does not open.
- *Add milestone* in a task's right-click menu makes the milestone a subtask of that task, not a sibling.

### Copying a task or a whole branch

1. In the Gantt, click the task's bar. Select more tasks with Ctrl+click.
2. Press Ctrl+C (⌘+C on a Mac). The app copies the task with all its subtasks, the relations between the copied tasks and their resource assignments.
3. If you like, click the bar of the task next to which the copy should go, and press Ctrl+V (⌘+V).

The copy has the same name, the same dates and the same progress. It goes in as a sibling of the selected task (with several: the one you clicked first), at the bottom among those siblings. If nothing is selected, it goes at the bottom of the list. The copied tasks are selected afterwards, the WBS codes (each task's number in the tree, such as 1.2; see [Adjusting the structure](docs://howto-structuur-aanpassen)) are determined again and the schedule is out of date.

The clipboard is shared by the whole app, so you can also paste into another document. What does not exist there, such as a task calendar, a custom task type, an activity code or a custom field, the app clears and tells you.

### Afterwards

A new task does not change the other dates yet. The status bar says *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*.

## Pitfalls and what the app does

**Every new task starts on the project start.** Without relations a task waits for nothing. Add relations, see [Adding relations](docs://howto-relaties-leggen).

**Filtering, grouping or sorting is on.** The order you see is then not the order of the schedule. With a task selected, *Task* and *Milestone ▾* add the new task at the bottom, and the strip *Not available while filtering/grouping/sorting* appears. *Insert above* and *Insert below* are refused, with the same strip. The *Clear* button in the strip removes filter, grouping and sorting in one go. That is not part of *Undo*: Ctrl+Z does not bring them back.

**A subtask under a task with resource assignments.** The task becomes a summary task, and a summary task carries no assignments itself. The app moves the assignments to the new subtask and tells you. If that is not possible, for example because you chose *Add milestone* and a milestone cannot carry assignments, the app adds nothing and says why.

**A subtask under a milestone.** The milestone becomes a summary task and the app removes the milestone flag, with a message.

**Milestone on for a summary task or a task with assignments.** The app refuses and says why. With assignments: remove them first.

**Copying in the task list.** In the task list (and on the *Table* tab) Ctrl+C copies only the values of the selected cells, as in a spreadsheet, and Ctrl+V pastes into cells. Copying tasks therefore only works if you use the Gantt: click a bar first.

## See also

- [Adjusting the structure](docs://howto-structuur-aanpassen): indent and move tasks and keep the WBS numbers up to date.
- [Adding relations](docs://howto-relaties-leggen): link tasks together.
- [Selecting, deleting and undoing tasks](docs://howto-taken-selecteren-verwijderen): take a task away again.
- [Critical path and float](docs://uitleg-kritiek-pad): what the app calculates once there are relations.
- [Task dialog and properties panel](docs://ref-taak-eigenschappen): all fields of a task.
- [New project and Project info](docs://ref-projectinfo): starting with a phasing template.
- [Right-click menus](docs://ref-contextmenus): all items of the menu on a task.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): a small example project (*File › Examples*) with four phases, a start milestone and a mandatory handover milestone.
