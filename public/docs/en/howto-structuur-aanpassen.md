# Adjusting the structure

Goal: arrange tasks into phases and subtasks, change their order and keep the WBS numbers correct.

## When you need this

Your schedule is a tree: phases (summary tasks) with subtasks below them, such as *Foundation* with *Groundwork*, *Reinforcement* and *Pouring*. You adjust that tree when you want to hang tasks under a phase, take a task out of one, or the order is wrong. The **WBS code** (1, 1.1, 1.2, 2, …) is a task's number in that tree.

## Steps

### Indenting a task

1. Select the task. Selecting several tasks is fine.
2. Choose *Planning › Structure › Indent*. You can also use Alt+→ (or Alt+Shift+→), or *Indent* in the right-click menu.

The task becomes the last subtask of the previous task at the same level. That task becomes a summary task as a result. If you select a contiguous block, the block indents as a whole. If the task has no previous task at the same level, nothing happens, and there is no message.

### Outdenting a task

Choose *Planning › Structure › Outdent*, press Alt+← (or Alt+Shift+←) or choose *Outdent* in the right-click menu.

The task becomes a sibling directly after the phase it hung under. Its own subtasks go with it. The tasks that came after it in that phase stay in it. A task at the top level does not outdent any further.

### Moving a task

You have three ways.

- **With the keyboard.** Alt+↑ and Alt+↓ swap the task with its neighbour at the same level. A summary task takes its subtasks along. At the top or bottom of the level nothing happens. With several tasks selected, only the task you clicked first moves.
- **Dragging in the task list.** Press on a row and drag vertically. The top quarter of a row means *before*, the bottom quarter *after*. The middle of a summary task hangs the task under it as its last subtask. The middle of an ordinary task counts as the nearest edge. If you drag a row that is part of a multiple selection, the whole selection moves.
- **Dragging in the Gantt.** Drag the bar vertically to another row. The positions for before, after or under a task work the same as in the list, but dragging a bar moves only that task, even with a multiple selection. The dates do not change. If you drag horizontally, you shift the dates instead.

Each move is one step for *Undo* (Ctrl+Z).

### Keeping the WBS numbers up to date

Look at the *WBS auto* button in *Planning › Structure*.

- **On (the default in a new project).** Also on after you open a file without this setting, if all WBS codes already match the numbering of the tree (1, 1.1, 1.2 …). The codes do not change. An empty file without this setting also gets *on*, just like a new project. The app renumbers the whole tree with every addition, deletion and move. The WBS code is then read-only: you cannot type it in the list or in the *Properties* panel. *Renumber WBS* is disabled.
- **Off.** The default in a file with its own codes, such as *A1000*, or with one code that differs from the tree. The codes stay as they are, also after moving and indenting. You type them yourself, in the *WBS* column or in the *WBS Code* field in *Properties*, or you have them renumbered once with *Renumber WBS*. That also overwrites codes you typed yourself.

If you turn *WBS auto* on, the app numbers the tree at once. Both *WBS auto* and *Renumber WBS* can be reversed with *Undo*.

## Pitfalls and what the app does

**Filtering, grouping or sorting is on.** The order you see is then not the order of the schedule, so the app locks the structure. *Indent* and *Outdent* are disabled, with the tooltip *Not available while filtering/grouping/sorting*. Alt+→ and dragging show the same text in a red strip, with the *Clear* button. That removes filter, grouping and sorting in one go, and Ctrl+Z does not bring them back. The strip stays until you click the cross, use Ctrl+Z or Ctrl+Y, or go to another document. *Indent* and *Outdent* are then missing from the right-click menu.

Alt+↑ and Alt+↓ do work in such a view, without a message. With only a filter you see the new order at once. With a sorting the order in the schedule does change, but you only see it after *Clear*.

**WBS auto is off.** This happens with a file that has its own codes, or with a file that saves the setting as *off*. A new task gets the code that fits its place in the tree, even if another task already has that code. That way duplicate numbers can appear. After indenting, too, the codes no longer match the tree. *Renumber WBS* fixes both.

**A milestone gets subtasks.** A milestone is a moment and has no subtasks. The app removes the milestone flag and tells you. For one task the notification gives its name; for several tasks it shows how many lose their milestone flag.

**A task with resource assignments gets subtasks.** A summary task carries no assignments itself. So the app first asks what to do with them, in the window *Task becomes a summary task*. This happens when you indent, use *Add subtask* or *Add milestone* on a task, insert a template, and in *Edit task* when you choose a new *Parent task*: for an existing task and for a new task. In *Edit task* the question comes before saving. If you choose *Cancel* there, *Edit task* stays open with your changes. You choose:

- *Cancel*: nothing changes, the structure also stays as it was.
- *Remove assignment*: the task gets its subtasks and its assignments are removed. The actual work of those assignments is removed too.
- *Move to '…'*: the assignments go to the first new subtask that can carry them, with their actual work. A milestone or a summary task carries no assignments.

If that subtask already has the same resource, or there is no suitable subtask, *Move* is disabled. An orange block in the window tells you why.

If an assignment already has actual work, the orange block tells you how many hours per resource, for example *The assignment of Metselaar already has 8 hours of actual work. Removing it discards that work.* *Cancel* is then the default button: Enter changes nothing. If you still want to remove the assignment, click *Remove assignment* yourself.

While the window is open, no shortcut outside the window works, including *Undo*, *Paste*, Delete, F5 and Ctrl+S. If one action creates more summary tasks at once, the window shows the resources per task, and your choice applies to all of them. One *Undo* (Ctrl+Z) reverts the whole action.

**A relation would create a cycle.** The relations of a summary task also apply to its subtasks. If a move would create a cycle because of that, the app refuses it, with the message *This move would create a cycle in the schedule (…)*. Nothing changes.

**A relation between a task and its own phase.** If you put a task under a phase it already has a relation with, that relation stays, but no longer counts in the calculation. The app tells you. You can read more about relations on summary tasks in [Relations and lag](docs://uitleg-relaties).

**The schedule is out of date.** A move to another phase can change dates. Press **Calculate** (F5). Just swapping the order within the same phase does not.

## See also

- [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen): put new tasks in the right place.
- [Saving and inserting WBS templates](docs://howto-wbs-sjablonen): reuse a whole phase.
- [Adding relations](docs://howto-relaties-leggen): link tasks together.
- [Selecting, deleting and undoing tasks](docs://howto-taken-selecteren-verwijderen): reverse a move.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): four phases with their subtasks, the way you build them by indenting.
