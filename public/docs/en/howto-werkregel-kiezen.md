# Choosing a task type

Goal: set per task what the app adjusts when you change the duration, the units or the work: the duration, the units or the work itself.

## When you need this

You have put resources on a task and you want the app to calculate the way you do. One example: the crane is hired for one day and that day is fixed. Another example: you know there are 160 hours of brickwork in it and you want to see how long it takes with three people instead of two. Those two situations need a different task type.

The task type decides which of the three quantities duration, units and work moves along when you change another one. The background and worked examples are in [Task types: duration, units and work](docs://uitleg-werkregels).

## Steps

### Showing the task type

The task type is not shown by default. Turn it on once:

1. Choose *Settings › Project › App settings*, tab *Planning*.
2. Under the heading *Calculation*, tick *Use task types*.
3. Close the window with *Close*.

This is a setting of the app, not of the project file. If a file already contains task types or stored work, such as a file from MS Project or Primavera P6, the app shows the task type for that file even without this setting. The same goes as soon as you choose a task type in a file yourself: the display then stays on for that file, even if you turn the setting off again. It stays on as long as the file is open, and after reopening as long as the file contains a task type or stored work.

### Setting the task type of a task

1. Select the task. The *Properties* panel is on the right; if you do not see it, turn it on with *View › Panels › Properties*.
2. At *Task type*, choose one of the five options: *Project default (Fixed duration and units)*, *Fixed duration and units*, *Fixed duration and work*, *Fixed work* or *Fixed units*. With *Project default* the task follows the project's default.
3. Want to know what an option does? In the open drop-down each option has an i icon. Point at it, click or tap it for the explanation. Clicking the i icon does not choose that task type yet.
4. Next to the closed field there is an i icon too. It explains the task type that applies now, for example *Duration follows from work and units.* With *Project default* that is the task type between the brackets.

*Project default* is the first choice and is what a task has by default. The task type between the brackets is the one the project currently has as its default. The app has no button to change that project default: it comes from an import (for example from MS Project or Primavera P6) or from the MCP connection. If you want another task type for one task, choose it here.

You can also choose the task type in the table. Click the **+** on the right of the task list header (*Add column*) and, under *Planning*, choose the *Task type* column.

A task without an assignment has nothing to tie together, so the task type does nothing there. Assign a resource first (see [Assigning resources with a curve](docs://howto-resource-toewijzen)).

### Seeing and changing the work

For a task with assignments, a *Work (rem.)* column appears in the *Assignments* block of the *Properties* panel, next to *Units/day*. That is the remaining work of that resource in hours. A small padlock above a column shows what the task type holds: *Units/day* with *Fixed duration and units* and with *Fixed units*, *Work (rem.)* with *Fixed duration and work* and with *Fixed work*.

If you want to change the work yourself, type the hours in the field and press Enter. The app does not accept a value of 0 or less: the field jumps back to the previous value.

### Seeing what happens

If you choose a task type, no number changes yet. Under a task type that protects work, the app only fixes the current work, so *Work (rem.)* has a stored value. Only at the next change does the task type decide what moves along. Change the *Units/day*, for example, and see what happens to the duration and the work.

If that changes the task's duration, the status bar says *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example via *Home › Schedule › Calculate*, to see the new dates. If *Calculate automatically* is on (same *Planning* tab, heading *Calculation*), the app does this itself.

## Which task type fits

- **Fixed duration and units** fits when the duration is an agreement and the units are your input. The work follows from those two. This is the default. The crane hired for one day belongs here: the day is fixed and you decide how many cranes are on it.
- **Fixed duration and work** fits when the task has to be finished within a fixed period and you know how much work is in it. If the duration changes, the app adjusts the units.
- **Fixed work** fits when you know how many hours of work are in it and want to see how the duration moves with the number of people. The 160 hours of brickwork with three people instead of two belong here. The plastering in the practice project gets this task type.
- **Fixed units** fits when the units are fixed, for example one crane, and the work decides the duration.

## Pitfalls and what the app does then

**The *Task type* field is missing.** Then the setting *Use task types* is off and the file has no task types yet, or you have selected a milestone, a phase, a hammock or a task with the duration type *Elapsed time*. There is no task type there. Select an ordinary task.

**The duration changes without me changing it.** Under *Fixed work* and *Fixed units* the duration follows from units and work. If you change one of those or the number of resources, the app adjusts the duration, rounded up to whole work days. For a task in hours the app rounds up to whole minutes.

**The work does not exactly match units × duration.** Rounding can cause that. Next to *Work (rem.)* a warning sign then appears, *Differs from units × duration*. The histogram follows the stored work.

**Material does not count.** For a material resource *Work (rem.)* shows a dash. Material never drives the duration.

**A task with progress.** The task type works on the remaining part. So *Work (rem.)* shows only what still has to happen.

**Undoing.** Choosing a task type, and every change that the task type calculates, is one step for *Undo* (Ctrl+Z). The chosen task type is then gone again, but the *Task type* field stays in view.

## See also

- [Task types: duration, units and work](docs://uitleg-werkregels): how the app ties duration, units and work together, with worked examples.
- [Assigning resources with a curve](docs://howto-resource-toewijzen): putting a resource on a task.
