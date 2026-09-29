# Adjusting the hour distribution

Goal: for one assignment, decide yourself how much the resource works on each work day of the task, instead of using a standard curve.

## When you need this

A curve such as *Bell shaped* is a fixed shape. Sometimes you know better. The bricklayer starts on the outer cavity leaf at half strength, because the scaffolding is still being put up, and then works full time. Or you want to keep a peak just under the capacity. Then you adjust the **hour distribution**.

You work with **phases**: consecutive work days on which the resource works with the same units. The distribution only changes the hours per day of this one assignment. The task's dates do not change.

## Steps

The example is the outer cavity leaf: 6 work days, one bricklayer, 48 hours.

1. Select the task. The *Properties* panel is on the right; if you do not see it, turn it on with *View › Panels › Properties*.
2. In the *Assignments* block, click the bar-chart icon *Hour distribution…* next to the bricklayer. The window *Hour distribution in phases* opens. You start from what the app currently books: for this outer cavity leaf, one phase of 6 days with units of 1.
3. If needed, pick a starting point at *Apply shape:*. With *Bell shaped* the app makes five phases: 0.18 units on the first and the last day, 0.84 on the second and the fifth day and 1.98 on the two middle days. The total stays 48 hours.

### Adjusting the phases

You can work in the table or in the strip above it.

- Type other *Effort (units/day)* in a phase. The columns *Hours/day* and *Hours* calculate along.
- Change the number of *Days* of a phase. The last phase always runs to the end of the task and gets the days that remain.
- Choose *Split* to divide a phase in two, for 6 days into 3 and 3. Choose *Merge* to merge a phase with the next one.
- In the strip you drag a boundary to lengthen or shorten a phase, you drag the top edge to set the effort and you double-click a day to split a phase.

### Applying

Choose *Apply*. With *Cancel* the window closes without a change.

An example. You choose *Split*, set the *Days* of the first phase to 2 and the effort of that phase to 0.5. The second phase then runs 4 days with effort 1. The total is 2 × 0.5 × 8 + 4 × 1 × 8 = 40 hours.

After *Apply* the assignment's curve is set to *Contour*, disabled. *Units/day* stays as it was. The histogram and the overallocation follow the new distribution at once. Recalculating is not needed, because no date moves.

### Releasing the distribution

If the assignment has a distribution of its own, the window also has *Release distribution*. That removes your own distribution and the app goes back to *Units/day* and the curve. Also choose this if you want to change the curve, because the *Curve* drop-down is disabled as long as there is a distribution of its own.

## Pitfalls and what the app does then

**The total changes with it.** You do not divide the hours, you decide them. If you set a phase to 0.5 instead of 0.18, the total gets bigger. The total in hours is at the bottom of the window, so check it before you click *Apply*.

**Units/day no longer steers the distribution.** If you set the units to 2 later, your own distribution stays in force. The units only have an effect again once you release the distribution.

**If you change the task's duration, the distribution stretches with it.** With the default rule *Fixed duration and units* the shape then stays the same and the total grows in proportion to the duration. If the duration of a task with a distribution of its own doubles from 4 to 8 work days, the total doubles as well, from 32 to 64 hours.

**The work follows the distribution.** *Work (rem.)* becomes the sum of your phases, also under *Fixed work*. The task's duration does not change because of it.

**Invalid units.** An empty or negative effort gets a red border and *Apply* is then disabled. A phase with effort 0 is allowed. Such a phase stays within the task's duration.

**Everything applies to this one assignment.** The app says so itself: *The distribution only changes the hours per day of this assignment; task dates and splits stay as they are.* Other resources on the same task keep their own distribution.

**Hour tasks shorter than a work day.** A task you plan in hours and that lasts shorter than one work day, such as the 5-hour crane job, does not count as load. The window shows one phase with effort 0 and 0 hours for it. See also [Resolving overallocation](docs://howto-overbezetting-oplossen).

**Leveling follows the distribution.** The leveler counts the same hours per day as the histogram.

**Undoing.** *Apply* and *Release distribution* are each one step for *Undo* (Ctrl+Z).

## See also

- [Assigning resources with a curve](docs://howto-resource-toewijzen): putting a resource on a task and choosing a curve.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): what to do when a resource has too much to do on a day.
