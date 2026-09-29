# Selecting, deleting and undoing tasks

Goal: choose tasks, take them away and reverse a mistake.

## When you need this

Almost every action in the schedule works on the tasks you have selected: deleting, copying, indenting, turning a milestone on or off. You remove tasks when the work falls away or the schedule is revised. And because the app asks for no confirmation when deleting, *Undo* is your safety net.

## Steps

### Selecting tasks

- **One task.** Click the row in the task list or the bar in the Gantt.
- **More tasks.** Ctrl+click (⌘+click on a Mac) adds a task to the selection or removes it. In the task list, Shift+click selects all tasks from the active task to the one you clicked.
- **All tasks.** Ctrl+A, with the focus in the task list or in the Gantt.
- **A box in the Gantt.** Hold Ctrl and drag over the empty background: the bars in the box are selected. Without Ctrl that drag scrolls the timeline in the default setting.
- **Nothing.** Esc, or a click on the empty background of the Gantt.

If you select a summary task, its subtasks are not selected along. Deleting and copying do take them along.

### Deleting tasks

Select the tasks and choose one of these routes:

- *Home › Edit › Delete*. The same button is on the *Table* tab.
- Delete or Backspace, if the focus is not in the task list: so click a bar in the Gantt first.
- *Delete* in the right-click menu. If the task you clicked is part of the selection, it applies to the whole selection, otherwise only to that one task.
- The small bin at the top of the *Properties* panel (tooltip *Delete task*). That deletes the task the panel shows.

The app asks for no confirmation. If you delete several tasks at once, that is one step for *Undo*.

What disappears with them: all subtasks of a deleted summary task, all relations from and to the deleted tasks, and their resource assignments. If you delete the last subtask of a summary task, it stays behind as an ordinary task. If *WBS auto* is on, the app renumbers the tree. The schedule is out of date afterwards: press **Calculate** (F5).

### Collapsing and expanding

A summary task has a triangle before its name in the task list; click it to hide or show its subtasks. With *View › Outline › Collapse* and *Expand* you do it for the selected summary tasks, or for all of them if nothing is selected. The right-click menu of a summary task also has *Collapse* and *Expand*. In a grouped view the buttons work on the groups.

The app keeps collapsing and expanding per open document. It is not part of *Undo* and not in the project file.

### Undoing and redoing

- *Home › Edit › Undo* and *Redo* (also on the *Table* tab), the arrows in the title bar, or Ctrl+Z for undo and Ctrl+Y or Ctrl+Shift+Z for redo.
- If you do something new after an *Undo*, *Redo* is gone.

*Undo* covers changes to your project data (tasks, relations, resources, calendars and the like), applying a layout, and adding or removing a column in the task list. The app keeps the last hundred steps per document, fewer for a very large project.

## Pitfalls and what the app does

**Delete in the task list does not delete a task.** If the focus is in the task list, Delete (or Backspace) clears the contents of the selected cells. For required cells, such as the name and the duration, nothing happens. Click a bar in the Gantt or use *Delete*.

**A whole phase goes at once.** If you delete a summary task, its subtasks, their relations and assignments go with it. *Undo* (Ctrl+Z) brings everything back, the relations and assignments too.

**What does not come back.** The selection, collapsing and expanding, and the *Clear* button in the strip *Not available while filtering/grouping/sorting* are not part of *Undo*. If you press Ctrl+Z after *Clear*, you therefore reverse your previous step, not the clearing.

**Removing a task that others depend on.** The relations from and to that task disappear too. Tasks that were only attached to it come loose and start on their own date again. Add new relations if needed, see [Adding relations](docs://howto-relaties-leggen).

## See also

- [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen): the reverse, and copying tasks.
- [Adjusting the structure](docs://howto-structuur-aanpassen): hang a task under another phase instead of removing it.
