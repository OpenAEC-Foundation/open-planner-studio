# Selecting, deleting and undoing tasks

Goal: choose tasks, take them away and reverse a mistake.

## When you need this

Almost every action in the schedule works on the tasks you have selected: deleting, copying, indenting, turning a milestone on or off. You remove tasks when the work falls away or the schedule is revised. And because the app asks for no confirmation when deleting, *Undo* is your safety net.

## Steps

### Selecting tasks

- **One task.** Click the row in the task list or the bar in the Gantt.
- **More tasks.** Ctrl+click (⌘+click on a Mac) adds a task to the selection or removes it. In the task list, Shift+click selects all tasks from the active task to the one you clicked.
- **All visible tasks.** Ctrl+A, with the focus in the task list or in the Gantt. Tasks that a filter hides fall outside it, and so do subtasks in a collapsed phase.
- **A box in the Gantt.** Hold Ctrl and drag over the empty background: all tasks in the rows the box touches are selected, even if their bar lies beside it: only the height of the box counts, not the time axis. If you release Ctrl only after the mouse button, they are added to the existing selection; otherwise they replace it. Without Ctrl that drag scrolls the timeline in the default setting.
- **Nothing.** Esc, or a click on the empty background of the Gantt.

If you select a summary task, its subtasks are not selected along. Deleting and copying do take them along.

### Deleting tasks

Select the tasks and choose one of these routes:

- *Home › Edit › Delete*. The same button is on the *Table* tab.
- Delete or Backspace, if the focus is not in the task list: so click a bar in the Gantt first.
- *Delete* in the right-click menu. If the task you clicked is part of the selection, it applies to the whole selection, otherwise only to that one task.
- The small bin at the top of the *Properties* panel (tooltip *Delete task*). That deletes the task the panel shows.

The app asks for no confirmation. If you delete several tasks at once, that is one step for *Undo*.

What disappears with them: all subtasks of a deleted summary task, all relations from and to the deleted tasks, and their resource assignments. If you delete the last subtask of a summary task, it stays behind as an ordinary task. If *WBS auto* is on, the app renumbers the tree. The schedule is out of date afterwards: press **Calculate** (F5), unless *Calculate automatically* is on.

### Dissolve: removing tasks and keeping the chain

*Dissolve* removes a task like Delete does, but the chain stays intact: the task's predecessors are linked directly to its successors. So *Dissolve* on B in A → B → C gives A → C.

Select the tasks and choose *Home › Edit › Dissolve* (also on the *Table* tab), or *Dissolve (keep chain)* in the right-click menu. The right-click menu follows the same rule as *Delete*: if the task you clicked is part of the selection, it applies to the whole selection.

- Every predecessor gets a relation to every successor, always finish-to-start without lag. The type and lag of the old relations do not count.
- A relation on a summary task above the task counts too: with A → phase P and B → C, where B is in P, *Dissolve* on B also gives A → C. Only a finish-to-start relation on the phase makes a new relation to a task inside that phase unnecessary; with another type, the finish-to-start is added.
- An external relation (to a task in another project) counts too: the successors get the external predecessor and the predecessors get the external successor, finish-to-start without lag, with the same fixed date. If that date is the wrong side of the task in the other project (for example with a start-to-start predecessor), the app leaves out that link and says so.
- If you use *Dissolve* on tasks that are linked to each other, the chain runs through them: *Dissolve* on B and C together in A → B → C → D gives A → D.
- If a finish-to-start relation already exists between predecessor and successor, it stays as it is, lag included. A relation of another type stays as well; the new finish-to-start is added next to it.
- If you use *Dissolve* on a summary task, its subtasks go with it by default, just as with deleting. The phase counts as one block: every predecessor from outside the phase (of the phase itself or of a subtask) goes to every successor outside the phase.
- To keep the subtasks, set *Dissolve on a summary task* to *Only the summary row* in the settings (*Planning* tab). Then only the summary task goes: its subtasks move up one level, into its place. Its own relations move to the first and last subtasks (those without a predecessor or successor inside the phase), with their type and lag.
- Assignments of the removed tasks go with them. *Dissolve* is one step for *Undo*, also for a whole selection. The schedule is out of date afterwards: press **Calculate** (F5).

If a new relation would create a loop or link a task to its own summary task, the app leaves out that one relation. The tasks are still removed, and a notification names the relations that were not created.

### Collapsing and expanding

A summary task has a triangle before its name in the task list; click it to hide or show its subtasks. With *View › Outline › Collapse* and *Expand* you do it for the selected summary tasks, or for all of them if nothing is selected. The right-click menu of a summary task also has *Collapse* and *Expand*. In a grouped view the buttons work on the groups.

Two or more milestones directly below each other, under the same phase or on their own, form a series. An ordinary task in between breaks the series. The first milestone of a series also has a triangle; click it and the series becomes one row *Milestones (3)*. In the Gantt the diamonds then sit side by side on that row, each with its name, cut off before the next diamond; the full name is in the tooltip. In the table the row shows the earliest milestone under *Start* and the last one under *Finish*. A click on the row in the table selects the whole series, a click on a diamond only that milestone. You can drag a diamond and draw a relationship from it; if you drag the row in the table, you move the whole series. Milestones on the same day share one diamond with their number, for example ◆2; the tooltip lists them all. A click on such a diamond selects them all, and dragging moves them together. To select, drag or link just one of them, or to use its right-click menu, expand the series. *Collapse* and *Expand* include the series. With a filter, grouping or sorting, and in the printout and the PDF, the series are expanded.

The app keeps collapsing and expanding per open document. It is not part of *Undo* and not in the project file.

### Undoing and redoing

- *Home › Edit › Undo* and *Redo* (also on the *Table* tab), the arrows in the title bar, or Ctrl+Z for undo and Ctrl+Y or Ctrl+Shift+Z for redo.
- If you do something new after an *Undo*, *Redo* is gone.

*Undo* covers changes to your project data (tasks, relations, resources, calendars and the like), and applying a layout. Changes to the columns of the task list are steps too: adding, removing, moving, resizing, auto-fitting, pinning and resetting the column layout to the default. Those column steps belong to the task list itself and apply to the whole app, not to one document. The app keeps the last hundred steps per document, fewer for a very large project.

## Pitfalls and what the app does

**Delete in the task list does not delete a task.** If the focus is in the task list, Delete (or Backspace) clears the contents of the selected cells. For a required or calculated cell, such as the name or the duration, the app refuses and shows a message under the task list, for the name for example *This value is required and cannot be left empty.* Then nothing is cleared, not even in other selected cells. Click a bar in the Gantt or use *Delete* (on the *Table* tab, where there is no Gantt: *Table › Edit › Delete* or the right-click menu).

**A whole phase goes at once.** If you delete a summary task, its subtasks, their relations and assignments go with it. *Undo* (Ctrl+Z) brings everything back, the relations and assignments too.

**What does not come back.** The selection, collapsing and expanding, and the *Clear* button in the strip *Not available while filtering/grouping/sorting* are not part of *Undo*. If you press Ctrl+Z after *Clear*, you therefore reverse your previous step, not the clearing.

**Removing a task that others depend on.** The relations from and to that task disappear too. Tasks that were only attached to it come loose and start on their own planned start again after **Calculate**. To keep the chain, choose *Dissolve* instead of *Delete*. Or add new relations yourself, see [Adding relations](docs://howto-relaties-leggen).

## See also

- [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen): the reverse, and copying tasks.
- [Adjusting the structure](docs://howto-structuur-aanpassen): hang a task under another phase instead of removing it.
- [Dragging, panning and zooming in the Gantt](docs://howto-gantt-bedienen): the selection box and the scroll modes.
- [Right-click menus](docs://ref-contextmenus): what *Delete* and the other items do to a selection.
