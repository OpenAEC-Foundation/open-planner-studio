# Choosing a work rule

Goal: set per task what the app adjusts when you change the duration, the units or the work: the duration, the units or the work itself.

## When you need this

You have put resources on a task and you want the app to calculate the way you do. One example: the crane is hired for one day and that day is fixed. Another example: you know there are 160 hours of brickwork in it and you want to see how long it takes with three people instead of two. Those two situations need a different work rule.

The rule decides which of the three quantities duration, units and work moves along when you change another one. The background and worked examples are in [Work rules: duration, units and work](docs://uitleg-werkregels).

## Steps

### Showing the work rule

The work rule is not shown by default. Turn it on once:

1. Choose *Settings › Project › Settings*, tab *Planning*.
2. Under the heading *Calculation*, tick *Show work rules and work*.
3. Close the window with *Close*.

This is a setting of the app, not of the project file. If a file already contains work rules or stored work, such as a file from MS Project or Primavera P6, the app shows the work rule for that file even without this setting. The same goes as soon as you choose a work rule in a file yourself: the display then stays on for that file, even if you turn the setting off again.

### Choosing a rule

1. Select the task. The *Properties* panel is on the right; if you do not see it, turn it on with *View › Panels › Properties*.
2. At *Work rule*, choose one of the five options: *Fixed duration and units*, *Fixed duration and work*, *Fixed work*, *Fixed units* or *Project default (Fixed duration and units)*. With the last one the task follows the project's default.
3. Under the drop-down the app shows what the rule protects, for example *Protected: work (duration follows units)*.

You can also choose the rule in the table. Click the **+** on the right of the task list header (*Add column*) and, under *Planning*, choose the *Work rule* column.

A task without an assignment has nothing to tie together, so the rule does nothing there. Assign a resource first (see [Assigning resources with a curve](docs://howto-resource-toewijzen)).

### Seeing and changing the work

For a task with assignments, a *Work (rem.)* column appears in the *Assignments* block of the *Properties* panel, next to *Units/day*. That is the remaining work of that resource in hours. A small padlock above a column shows what the rule holds: *Units/day* with *Fixed duration and units* and with *Fixed units*, *Work (rem.)* with *Fixed duration and work* and with *Fixed work*.

If you want to change the work yourself, type the hours in the field and press Enter. The app does not accept a value of 0 or less: the field jumps back to the previous value.

### Seeing what happens

If you choose a rule, no number changes yet. Under a rule that protects work, the app only fixes the current work, so *Work (rem.)* has a stored value. Only at the next change does the rule decide what moves along. Change the *Units/day*, for example, and see what happens to the duration and the work.

If that changes the task's duration, the status bar says *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example via *Home › Schedule › Calculate*, to see the new dates. If *Calculate automatically* is on (same *Planning* tab, heading *Calculation*), the app does this itself.

## Which rule fits

- **Fixed duration and units** fits when the duration is an agreement and the units are your input. The work follows from those two. This is the default.
- **Fixed duration and work** fits when the task has to be finished within a fixed period and you know how much work is in it. If the duration changes, the app adjusts the units.
- **Fixed work** fits when you know how many hours of work are in it and want to see how the duration moves with the number of people. The plastering in the practice project gets this rule.
- **Fixed units** fits when the units are fixed, for example one crane, and the work decides the duration.

## Pitfalls and what the app does then

**The *Work rule* field is missing.** Then the setting *Show work rules and work* is off and the file has no work rules yet, or you have selected a milestone, a phase or a hammock. There is no work rule there. Select an ordinary task.

**The duration changes without me changing it.** Under *Fixed work* and *Fixed units* the duration follows from units and work. If you change one of those or the number of resources, the app adjusts the duration, rounded up to whole work days. For a task in hours the app rounds up to whole minutes.

**The work does not exactly match units × duration.** Rounding can cause that. Next to *Work (rem.)* a warning sign then appears, *Differs from units × duration*. The histogram follows the stored work.

**Material does not count.** For a material resource *Work (rem.)* shows a dash. Material never drives the duration.

**A task with progress.** The rule works on the remaining part. So *Work (rem.)* shows only what still has to happen.

**Undoing.** Choosing a rule, and every change that the rule calculates, is one step for *Undo* (Ctrl+Z).

## See also

- [Work rules: duration, units and work](docs://uitleg-werkregels): how the app ties duration, units and work together, with worked examples.
- [Assigning resources with a curve](docs://howto-resource-toewijzen): putting a resource on a task.
