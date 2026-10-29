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

The example is the tutorials' practice project *House extension*, as it stands just before the leveling in tutorial 5. In tutorial 5 you do this yourself and check the numbers. In this example the plastering is on *Fixed work* and the plasterer works with units of 2, as in [Task types: duration, units and work](docs://uitleg-werkregels).

After the hollow-core floor, finished on Monday 28 June at 10:00, the inner cavity leaf (5 work days) and the outer cavity leaf (6 work days) both start on Monday 28 June at 10:00. They are both on the bricklayer, with units of 1 and a *Max units* of 1. After the inner leaf come the roof elements (a 6-hour crane job) and the roofing (2 work days). The frames wait for the roofing and for the outer leaf. The handover is on Monday 30 August.

### The overallocation

The inner leaf runs from 28 June 10:00 to 5 July 10:00, the outer leaf from 28 June 10:00 to 6 July 10:00. A work day runs from 07:00 to 16:00 with a one-hour break, so on 28 June both walls work 5 of the 8 hours. On that day the schedule asks 1.25 units of a bricklayer with capacity 1, from 29 June to 2 July inclusive 2 units, and on 5 July 1.375. So the bricklayer is overallocated on 6 work days, from 28 June to 5 July inclusive.

### The order

Both tasks have priority 500. The window frames are only delivered on 14 July (in tutorial 3 you set a constraint *Start no earlier than (SNET)* for that). As a result the inner leaf has 3.875 work days of float (3 work days and 7 hours) and the outer leaf 5.625 (5 work days and 5 hours). The inner leaf has the least float and so comes first. It stays from 28 June 10:00 to 5 July 10:00.

### The shift

The outer leaf cannot start on 28 June. The bricklayer is free again on Monday 5 July at 10:00, when the inner leaf is done. That is 5 work days later than the earliest start, so the leveling delay is 5. The outer leaf now runs from 5 July 10:00 to 13 July 10:00. The frames only start on 14 July anyway, so the handover stays Monday 30 August. The window reports *Project end date: unchanged (30-08-2027)* and shows one line: *Build outer cavity leaf*, old start 28-06-2027 10:00, new start 05-07-2027 10:00, *5 d*.

The shift of 5 work days fits within the float of the outer leaf. That is why *smoothing* gives the same result here. The outer leaf now keeps only 0.625 work days of float: 5 hours.

### What if the frames do not come on 14 July

Without that constraint the frames can start on Thursday 8 July at 08:00 and the handover is on Wednesday 25 August at 08:00. The outer leaf then has only 1.75 work days of float (1 work day and 6 hours).

- Without *smoothing* the outer leaf still shifts 5 work days. Now the frames have to wait: they start on Tuesday 13 July at 10:00, 3 work days later. Everything after them moves along and the handover goes from Wednesday 25 August 08:00 to Monday 30 August 10:00.
- With *smoothing* nothing shifts. The outer leaf does not fit within its 1.75 work days of float. The window shows the conflict *Build outer cavity leaf*, 6 day(s), with the reason *Not enough free capacity within the slack to resolve this conflict.*

### What if the outer leaf gets priority

If you give the outer leaf priority *High* (900), it comes first. It stays on 28 June at 10:00 and now the inner leaf gives way: 6 work days later, from 6 July 10:00 to 13 July 10:00. The inner leaf has only 3.875 work days of float, so shifting 6 work days is more than 2 work days too many. The roof elements, the frames and everything after them move along. The handover goes from Monday 30 August to Thursday 2 September at 08:00. The same overallocation therefore gives a different finish date, depending on which task stays put.

### What if a second bricklayer arrives

If you set the bricklayer's *Max units* to 2, there is no overallocation any more. *Calculate* reports *No tasks need to move — the schedule is already conflict-free.*

## Consequences and misconceptions

**"Leveling finds the shortest schedule."** No. The app works task by task in a fixed order and does not search for the best overall solution. See the example with the priority: another priority gives another finish date.

**"A leveled task is safe."** Leveling uses float. The shifted task then has less or no float left and can become critical. The outer leaf above keeps only 5 hours of float. If it then runs late, the handover moves.

**"Leveling follows my later changes."** No. The delay is a fixed number of work days. If the inner leaf becomes shorter after leveling, the outer leaf still starts 5 work days later, even though that is no longer needed. Level again then. The app starts from scratch.

**Not everything can be solved by shifting.** If the resource does not work on the days the task needs, or the task through its curve asks more on one day than the resource can supply, the overallocation stays. The app then says why at the task.

**Material is not leveled.** If material asks more than its capacity on a day, the app reports that as overallocation, but leveling leaves it.

**Pinned tasks.** Tasks at priority 1000 do not move for capacity. Their remaining overallocation is reported per task and conflict day. Change the priority, demand or capacity to resolve it. Also check *Overallocation* in the ribbon after applying.

## See also

- [Resolving overallocation](docs://howto-overbezetting-oplossen): the steps to find overallocation and level it.
- [Critical path and float](docs://uitleg-kritiek-pad): what float is and why a task becomes critical.
- [Task types: duration, units and work](docs://uitleg-werkregels): how a task's duration moves along with the units.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): three towers that need the same crews and the tower crane, and what leveling does with that.
