# Right-click menus

Which menus the right mouse button opens in the Gantt and in the task list, what each item does and which tasks it applies to. The items that also exist as a button or a shortcut are in [The ribbon, tab by tab](docs://ref-lint) and [Keyboard shortcuts](docs://ref-sneltoetsen).

## Which menu where

There are three menus. Which one you get depends on where you click:

- **On a task bar in the Gantt** — the task menu, with *Start relation from here* at the top.
- **On a task in the task list** — the same task menu, without that one item at the top. This goes for the task list to the left of the Gantt and for the *Table* tab.
- **On a group header in the task list** — a small menu to expand and collapse groups. Group headers only appear when you group, for example with the *Resource diagram* layout.

On the empty background of the Gantt, and on the band of a group header in the Gantt, the right mouse button opens no menu. A right-click in the timeline header does nothing either. The column headers of the task list have their own menu, described in [Adjusting table columns](docs://howto-tabelkolommen-aanpassen).

**Which tasks does an item apply to?** You click on one task, but the selection sets the scope. If the task you click on is part of the selection, the item applies to the whole selection. If it is not, it applies to that one task only. With a right-click on a bar in the Gantt, that task is selected first if it was not selected yet. Every item that changes something is one step in *Undo*, also for a whole selection.

## The task menu

The items are in this order. A line between groups is a separator in the menu.

**Start relation from here** — only in the Gantt, on a bar. Turns on relation mode with this task selected; you then drag to the successor. See [Adding relations](docs://howto-relaties-leggen).

**Remove break** and **Remove all breaks** — only in the Gantt, on a bar with interruptions. *Remove break* is only there if you click on a pause or the piece after it and the interruption is editable; it removes that one pause. *Remove all breaks* removes all of them, including interruptions from a source file that you cannot edit. See [Splitting a task](docs://howto-taak-splitsen).

**Edit...** — opens the *Edit task* window for this task. See [Task dialog and properties panel](docs://ref-taak-eigenschappen).

**Insert above** and **Insert below** — inserts one new task above the top task or below the bottom task of the scope, at the same level. It only works in the pure tree view, without filter, grouping or sorting; otherwise the app refuses with a message. See [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen).

**Add subtask** — adds a new task as a subtask of the task you clicked on, at the bottom of its subtasks. For that one task only, not for the whole selection.

**Add milestone** — adds a milestone as a subtask of the task you clicked on. For that one task only.

**Add relation** — does the same as *Start relation from here*: turns on relation mode with this task selected. In the task list the item is disabled if the Gantt is not visible, with the tooltip *Only available when the Gantt chart is visible*.

**Indent** and **Outdent** — moves the tasks of the scope one level deeper or one level higher in the WBS. These two are only in the pure tree view. See [Adjusting the structure](docs://howto-structuur-aanpassen).

**Toggle milestone** — turns the task into a milestone, or back. The new state follows from the task you clicked on and applies to the whole scope: if that one is a task, all tasks in the scope become milestones. A summary task and a task with assignments do not become a milestone; the rest of the scope does, and you get a message per reason.

**Assign calendar ▸** — a submenu with *Project calendar* (the task then has no calendar of its own) and below it the available calendars. The current choice has a check mark. A task that is already on that calendar does not count and makes no extra *Undo* step. See [Creating and assigning a calendar](docs://howto-kalender-maken-en-toewijzen).

**Progress ▸** — a submenu with 0%, 25%, 50%, 75% and 100%. The current value has a check mark. A summary task has no progress of its own: if there is one in the scope, its leaf tasks get the percentage. Without a status date the app sets it to today, with a message. A task that is planned to start only after the status date and has no actual start yet first leads to a question about the actual start; if you cancel it, nothing changes. See [Updating progress](docs://howto-voortgang-bijwerken).

**Priority ▸** — a submenu with *Low* (100), *Normal* (500) and *High* (900), the leveling priority of the task. The current value has a check mark. See [Resource leveling](docs://uitleg-nivelleren).

**Trace path** — shows the predecessors and successors of this task. If tracing is already on, the item is called *Stop path tracing*. See [Tracing a path](docs://howto-pad-traceren).

**Collapse**, **Expand** and **Save branch as template** — only for a summary task. *Collapse* and *Expand* are always both there, even if the task is already collapsed or expanded, and apply to the whole scope. *Save branch as template* saves the task with its subtasks and the relations between them as a WBS template. See [Saving and inserting WBS templates](docs://howto-wbs-sjablonen).

**Delete** — deletes the tasks of the scope, with their subtasks. There is no confirmation; you get them back with Ctrl+Z, one step for the whole scope. See [Selecting, deleting and undoing tasks](docs://howto-taken-selecteren-verwijderen).

## The menu of a group header

This menu only exists in the task list, on a group header:

**Collapse group** or **Expand group** — collapses or expands only this group. The item shows what you can do.

**Expand all** and **Collapse all** — expands or collapses all groups at once.

You set up grouping with a layout, see [Creating and using a layout](docs://howto-layouts-gebruiken).

## See also

- [Dragging, panning and zooming in the Gantt](docs://howto-gantt-bedienen): what dragging with the left and middle mouse buttons does.
- [The ribbon, tab by tab](docs://ref-lint): the buttons that have the same actions.
- [Keyboard shortcuts](docs://ref-sneltoetsen): the keys that go with them.
