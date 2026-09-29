# Resource leveling

You have one bricklayer and two walls that have to be built on the same days. On paper the schedule works, but in practice he can only be in one place. Leveling is how the app resolves such clashes: it makes tasks start later, until the resource can cope. In this article you read exactly what leveling shifts, when the finish date gives way and what it does not solve for you.

## The concept

A resource is **overallocated** on a work day if the schedule asks more of it that day than it can supply. What it can supply is its capacity: *Max units* on the work days of its calendar. If it does not work that day according to its calendar, its capacity is 0.

**Leveling** resolves that by making tasks start later. It does nothing more. It does not shorten a task, does not split a task, does not change units or relations and does not add an extra resource. For each task the app looks for the first spot where the resources are free, and shifts the task there.

There are two ways, in the window *Level resources*:

- By default the project's finish date may move along. That is leveling in the proper sense.
- With the box *Level only within slack (smoothing) — project end date stays fixed* the app only moves tasks within their float. The finish date then stays put. If that does not work, the task stays where it is and the app reports a conflict. What float is, you read in [Critical path and float](docs://uitleg-kritiek-pad).

## How the app calculates

### How much a task asks

Per work day the app counts how many units each task asks of a resource. That is the units according to the curve or your own hour distribution, exactly the same hours per day that the histogram shows. The resource's capacity is *Max units*, or the value of the step in the time-phased capacity that applies on that day. A day is overallocated if the demand is greater than the capacity.

### In which order

The app places the tasks one by one, in this order: the highest priority first, then the task with the least total float, then the earliest start, and then the order in the task list. A task only comes up once its predecessors have their place.

The priority is a number from 0 to 1000 that you set per task. The default is 500. In the right-click menu of a task bar it is called *Priority*, with the choices *Low* (100), *Normal* (500) and *High* (900). A task that comes up earlier gets the place it wants. The tasks that come after have to fit around it. That is how the priority decides which task stays and which one gives way. The value 1000 is special: such a task never shifts for capacity. It is MS Project's "Do Not Level".

### Where a task shifts to

For each task the app starts at the earliest start the relations allow. That takes into account that predecessors may already have been shifted themselves. If the task fits there, it stays. If it does not fit, the app tries the next work day of the task, and so on. A task fits if on every day of the task every resource has enough free. If a task has several resources, they must all be free on those days. So a task always shifts to later, never to earlier.

The app records the shift as a **leveling delay**: a number of work days, in the task's calendar, that the task starts later than its relations require. You see it in the column *Leveling delay* under *Calculated*. The delay is saved with the project file. Calculate (F5) takes it into account as extra waiting time before the start. Tasks after it move along through their relations.

### Within float or beyond

Without *smoothing* the app keeps searching until the task fits. As a result the project's finish date can move.

With *smoothing* a task may not start later than its late start, which is the last day it could start without the finish date moving. If the task does not fit within that window, it stays at its earliest place. The task then appears under *Remaining conflicts*.

### What the app does not shift

- Tasks that have already started or are finished. Their load does count, but they never get a leveling delay.
- Tasks with priority 1000. They do follow their predecessors, but do not shift for capacity.
- Tasks without an assignment to the selected resources, milestones and phases. They only move along if a predecessor shifts.
- Material. That is never leveled.

### Proposal and apply

*Calculate* makes a proposal: the tasks that shift, with old and new start, and the finish date before and after. Nothing changes in your schedule until you choose *Apply*. Then the app writes the delays to the tasks and recalculates the schedule straight away.

## Worked example: the bricklayer on two walls

The example is the tutorials' practice project *House extension*, as it stands just before the leveling in tutorial 5. In tutorial 5 you do this yourself and check the numbers. In this example the plastering is on *Fixed work* and the plasterer works with units of 2, as in [Work rules: duration, units and work](docs://uitleg-werkregels).

After the hollow-core floor, finished on Monday 28 June, the inner cavity leaf (5 work days) and the outer cavity leaf (6 work days) both start on Tuesday 29 June. They are both on the bricklayer, with units of 1 and a *Max units* of 1. After the inner leaf come the roof elements (a 6-hour crane job) and the roofing (2 work days). The frames wait for the roofing and for the outer leaf. The handover is on Monday 30 August.

### The overallocation

The inner leaf runs from 29 June to 5 July inclusive, the outer leaf from 29 June to 6 July inclusive. From 29 June to 5 July inclusive, that is 5 work days, the schedule asks 2 units of a bricklayer with capacity 1. The bricklayer is overallocated on those 5 days.

### The order

Both tasks have priority 500. The window frames are only delivered on 14 July (in tutorial 3 you set a constraint *Start no earlier than (SNET)* for that). As a result the inner leaf has 3 work days of float and the outer leaf 5. The inner leaf has the least float and so comes first. It stays from 29 June to 5 July inclusive.

### The shift

The outer leaf cannot start on 29 June. The first day the bricklayer is free again is Tuesday 6 July. That is 5 work days later than the earliest start, so the leveling delay is 5. The outer leaf now runs from 6 July to 13 July inclusive. The frames only start on 14 July anyway, so the handover stays Monday 30 August. The window reports *Project end date: unchanged (30-08-2027)* and shows one line: *Build outer cavity leaf*, old start 29-06-2027, new start 06-07-2027, *5 d*.

The 5 work days of shifting are exactly the float of the outer leaf. That is why *smoothing* gives the same result here. The outer leaf has no float left now and is critical.

### What if the frames do not come on 14 July

Without that constraint the frames can start on Friday 9 July and the handover is on Wednesday 25 August. The outer leaf then has only 2 work days of float.

- Without *smoothing* the outer leaf still shifts 5 work days. Now the frames have to wait: they start on 14 July, 3 work days later. Everything after them moves along and the handover goes from 25 August to 30 August, also 3 work days later.
- With *smoothing* nothing shifts. The outer leaf does not fit within its 2 work days of float. The window shows the conflict *Build outer cavity leaf*, 5 day(s), with the reason *Not enough free capacity within the slack to resolve this conflict.*

### What if the outer leaf gets priority

If you give the outer leaf priority *High* (900), it comes first. It stays on 29 June and now the inner leaf gives way: 6 work days later, from 7 July to 13 July inclusive. The inner leaf has only 3 work days of float, so shifting 6 work days is 3 too many. The roof elements, the frames and everything after them move along. The handover goes from Monday 30 August to Thursday 2 September. The same overallocation therefore gives a different finish date, depending on which task stays put.

### What if a second bricklayer arrives

If you set the bricklayer's *Max units* to 2, there is no overallocation any more. *Calculate* reports *No tasks need to move — the schedule is already conflict-free.*

## Consequences and misconceptions

**"Leveling finds the shortest schedule."** No. The app works task by task in a fixed order and does not search for the best overall solution. See the example with the priority: another priority gives another finish date.

**"A leveled task is safe."** Leveling uses float. The shifted task then has less or no float left and can become critical, like the outer leaf above. If it then runs late, the handover moves.

**"Leveling follows my later changes."** No. The delay is a fixed number of work days. If the inner leaf becomes shorter after leveling, the outer leaf still starts 5 work days later, even though that is no longer needed. Level again then. The app starts from scratch.

**Not everything can be solved by shifting.** If the resource does not work on the days the task needs, or the task through its curve asks more on one day than the resource can supply, the overallocation stays. The app then says why at the task.

**Material is not leveled.** If material asks more than its capacity on a day, the app reports that as overallocation, but leveling leaves it.

**Pinned tasks.** If all tasks that clash are on priority 1000, the window reports *No tasks need to move — the schedule is already conflict-free.*, while the overallocation stays. So after applying, look at the *Overallocation* message in the ribbon.

## See also

- [Resolving overallocation](docs://howto-overbezetting-oplossen): the steps to find overallocation and level it.
- [Critical path and float](docs://uitleg-kritiek-pad): what float is and why a task becomes critical.
- [Work rules: duration, units and work](docs://uitleg-werkregels): how a task's duration moves along with the units.
