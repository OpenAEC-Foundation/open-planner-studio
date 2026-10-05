# Resolving overallocation

Goal: see where a resource has too much to do on a day and resolve that, usually by leveling tasks.

## When you need this

On paper your schedule works, but the bricklayer is on two walls that run on the same days. The app calls that **overallocation**. A resource is overallocated on a work day if the schedule asks more of it that day than its capacity (*Max units*), or if it does not work that day according to its calendar.

You first look up the overallocation. Then you pick a solution. **Leveling** is the solution the app calculates for you: it makes tasks start later until the resource can cope. How that calculates you read in [Resource leveling](docs://uitleg-nivelleren).

## Steps

### 1. Find the overallocation

1. Look in the ribbon at *Resources › Overallocation*. It says *None* or, in red, the number of overallocated resources, for example *1 resource*. After a calculation the status bar also says *⚠ 1 resource(s) overallocated*.
2. Click that message in the status bar. The *Warnings* panel opens on the right, with a line for each resource, for example *Bricklayer* with *Overallocated on 5 day(s) (29-06-2027 – 05-07-2027)*.
3. Click that line. The app turns the histogram on, picks the resource and selects all tasks the resource is on.
4. Look at the histogram under the Gantt. Red bars are overallocated days. If you move the mouse over a day, you see which tasks contribute, for example *2 tasks contribute on 2027-06-30* with the names below it.

You can also turn the histogram on yourself with *Resources › Histogram › Histogram*. Pick a resource in the list on the left, or step through the resources with *Previous* and *Next*. A red dot in the list means that resource is overallocated. The *All resources* row adds the resources together, without material.

If a task is selected, the histogram shows only the load of that task and only the resources on it. Press Esc to clear the selection and see the whole project again.

### 2. Pick a solution

- **More capacity.** If a second bricklayer really is coming, set *Max units* to 2 (see [Managing resources](docs://howto-resources-beheren)). The overallocation is then gone.
- **Fewer units per day.** Lower the *Units/day* or choose another curve for the assignment (see [Assigning resources with a curve](docs://howto-resource-toewijzen)).
- **Put tasks one after the other.** Add a relation between the two tasks, so that the second only starts once the first is finished (see [Adding relations](docs://howto-relaties-leggen)).
- **Leveling.** The app makes a task start later.

### 3. Leveling

1. Make sure the schedule has been calculated with **Calculate** (F5), for example via *Home › Schedule › Calculate*.
2. Choose *Resources › Leveling › Level…*. The window *Level resources* opens.
3. Decide whether the project's end date may move. If you leave the box *Level only within slack (smoothing) — project end date stays fixed* off, the end date may shift. If you turn it on, the app only moves tasks within their float.
4. Under *Resources* are the resources that will be leveled. By default all resources are ticked, except material. Untick a resource you want to leave alone.
5. Click *Calculate*. While it calculates it says *Calculating…* and you can stop with *Stop*. The schedule does not change yet: this is a proposal.
6. Read the proposal. At the top is the end date, for example *Project end date: unchanged (30-08-2027)* or *Project end date: 25-08-2027 → 30-08-2027*. Below it is a table with for each task the *Old start*, the *New start* and the *Days shifted*, for example *Build outer cavity leaf*, 29-06-2027, 06-07-2027 and *5 d*.
7. Choose *Apply*. The app writes the delays to the tasks and recalculates the schedule straight away. Pressing F5 is not needed. *Cancel* closes the window without a change.
8. Check *Resources › Overallocation*. It now says *None*.

If you change an option in the window after you have clicked *Calculate*, the proposal disappears. Then click *Calculate* again. If the schedule changes while the app is calculating, it says *The schedule changed while calculating. Click Calculate again.*

### Deciding which task stays put

The app places tasks one by one and the tasks that come first stay where they are. The tasks with the highest priority go first. With equal priority the task with the least float goes first.

If you want to decide yourself which task stays, give it a higher priority. Right-click the task's bar in the Gantt and choose *Priority*, then *Low* (100), *Normal* (500) or *High* (900). *Normal* is the default. You can also type a number from 0 to 1000 yourself in the *Leveling priority* column: click the **+** on the right of the task list header (*Add column*) and choose that column under *Planning*. A higher number means the task is more likely to stay put. The app does not accept a number above 1000. A task with priority 1000 never moves for capacity.

### Undoing and redoing

- *Undo* (Ctrl+Z) reverses *Apply* in one step.
- *Resources › Leveling › Clear leveling* removes all leveling from the tasks. The button is grey as long as there is no leveling. Overallocation you get back that way is simply there again.
- If you have changed the schedule since, just choose *Level…* again. The app then starts from scratch: the old delays do not count.

## Pitfalls and what the app does then

**Not calculated yet.** If the schedule has not been calculated, the window says *Calculate the schedule (F5) before leveling.* and *Calculate* is not available.

**Remaining conflicts.** Not every overallocation can be solved by shifting. The tasks that remain are listed under *Remaining conflicts*, with the number of days and the reason:

- *Not enough free capacity within the slack to resolve this conflict.* You see this with *smoothing*: within the task's float there is no free moment. Untick the box and the end date may move.
- *The resource does not work on all days this task needs — shifting cannot resolve this.* The resource has days off in its own calendar in the middle of the task. Change the calendar or the task.
- *Bricklayer peaks at 2 units/day, capacity is 1 — cannot be resolved by shifting.* Through its curve the task alone asks more on one day than the resource can supply. Choose another curve or lower units.

**It says *No tasks need to move — the schedule is already conflict-free.*** If that line appears together with the list *Remaining conflicts* in the proposal, believe the list. The line only says that there is nothing to shift. If the line appears without a list, while *Resources › Overallocation* still reports a resource, then all tasks that clash are pinned on priority 1000 or have already started. They do not move and the window does not report them as a conflict. So after applying, always look at *Overallocation*.

**Tasks that do not shift.** A task that has already started or is finished never shifts. Its load does count. Milestones and phases do not shift either.

**Material is not leveled.** If a material resource asks more than its *Max units* on a day, it does count as overallocated in *Overallocation*, but it is not in the leveling window.

**Leveling does not adapt.** The delays stay as they were calculated. If you change a task's duration later, a leveled task stays where it is, even if that place is no longer needed. Level again then.

**Overallocated because of the calendar.** If the resource does not work on a day according to its calendar, the *Warnings* panel says, for example, *Overallocated on 5 day(s) (29-06-2027 – 05-07-2027), of which 1 day(s) the resource does not work per its calendar*. If a task always runs across such a day, which is the second reason above, leveling does not resolve that.

## See also

- [Resource leveling](docs://uitleg-nivelleren): what leveling shifts, within float and beyond, and what it does not do.
- [Managing resources](docs://howto-resources-beheren): adjusting a resource's capacity and calendar.
- [Adding relations](docs://howto-relaties-leggen): putting tasks one after the other.
- [Notifications and warnings](docs://ref-meldingen): the Overallocated warning in the Warnings panel.
