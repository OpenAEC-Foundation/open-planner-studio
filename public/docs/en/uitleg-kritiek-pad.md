# Critical path and float

Why is your project's finish date what it is? And which task can run a day late without moving the handover? Those are the questions behind the critical path. This article explains exactly what the app calculates, with an example you can check yourself.

## The concept

A schedule is a network of tasks joined by **relations**: agreements such as "the window frames go in only once the roof is closed". Those relations tie tasks together. Some chains of tasks are longer than others. The longest chain decides how long the whole project takes.

That longest chain is the **critical path**. If one task on it runs a day late, the handover moves a day. There is no room in it.

Tasks off the critical path do have room. That room is called **float**. The bricklayer building the outer cavity leaf might start two days later without anyone noticing. Those two days are his float.

So critical says nothing about how important a task is. It only says there is no time to spare.

## How the app calculates

The app does not recalculate the schedule by itself. You start the calculation with **Calculate** (F5), for example through *Home › Schedule › Calculate*. If you changed something since the last calculation, the status bar shows *Out of date — recalculate (F5)*. If you want the app to do this for you, turn on *Calculate automatically* under *Settings › Project › Settings*, tab *Planning*, heading *Calculation*.

A calculation makes two passes through the network.

### Forward pass

The app starts at the project start and follows the relations from predecessor to successor. For each task it finds the earliest day it can start. If a task has several predecessors, it waits for the last one to finish. That gives each task its **early start** and **early finish**. The latest early finish of all tasks is the project's finish date.

### Backward pass

Then the app walks back, from that finish date to the start. Now it finds, for each task, the last day it must be finished without moving the finish date. If a task has several successors, the one that must start first counts. That gives the **late start** and the **late finish**.

### Total and free float

The difference between a task's late and early dates is its **total float**: the number of work days the task can run late or start later before the project finish date moves. The app counts in work days of the task's calendar. A weekend or a public holiday does not count.

**Free float** is stricter. It is the room a task has before its first successor has to move. You can use that room without any other task noticing. Total float can be shared: if two non-critical tasks follow each other, they share the same margin. If the first one uses it up, the second has none left. The first one then has total float, but no free float. The difference between the two is called **interfering float**.

### When is a task critical?

By default a task is critical when its total float is 0 or less. You change this under *Settings › Project › Project info*, in the block *Calculation profile and options*, at *Calculation options of this project*:

- **Critical definition** with *Total float ≤ threshold* and the field *Threshold (work days)*. The threshold is 0 by default. Set it to 2, and every task with 2 work days of float or less also counts as critical.
- **Mark near-critical** with its own *Threshold*, 2 work days by default. A task with more than 0 but at most that much float then gets an amber bar. That shows which tasks have almost no margin left, without counting them as critical.
- **Open-ended tasks critical**: a task without a successor that is not finished yet then counts as critical.
- **Float calculation** decides whether total float is measured at the start of the task, at its finish, or as the smaller of the two. It is set to *Automatic (default)*.

These options belong to the project file, not to the app. When you click *Apply*, the app recalculates the schedule straight away. How Primavera P6 and MS Project calculate differently here is covered in [Calculation profiles](docs://gids-rekenprofielen).

### Where you see it

Critical tasks have a red bar in the Gantt. Behind a non-critical bar there is a green band up to its late finish: that is the float. You turn that band on or off with *View › Baselines & progress › Float band*.

When you select a task, the *Properties* panel lists everything under *CPM Result*: early and late start and finish, total, free and interfering float, and whether the task is on the critical path. To see the float of all tasks side by side, add a column with the **+** on the right of the table header, under *Calculated*. It includes *Total float*, *Free float*, *Critical* and *Near critical*.

The status bar at the bottom counts the critical tasks, for example *Critical path: 21 tasks, 45 work days*.

## Worked example: the house extension

The example comes from the tutorials' practice project *House extension*, as it stands after the tutorial on relations. The extension starts on Monday 7 June 2027. After **Calculate**, the handover is on Friday 6 August 2027. Two tasks are not critical: *Build outer cavity leaf* and *Painting*.

### Two chains that meet

After the structural floor (*Lay hollow-core floor*, finished on Monday 28 June) the work splits into two chains. Both end at *Install window frames*:

- The inside: *Build inner cavity leaf* (5 work days), then *Place roof elements* (1), then *Apply roofing* (2). The window frames can only go in once the roof is closed.
- The outside: *Build outer cavity leaf* (6 work days). The frames sit in the facade, so that must be finished too.

**Forward.** Both cavity leaves can start on Tuesday 29 June. The inner leaf is finished on Monday 5 July. The roof elements go on on Tuesday 6 July, and the roofing follows on Wednesday 7 and Thursday 8 July. The outer leaf is finished on Tuesday 6 July. *Install window frames* waits for the later of the two chains: the roofing. So the frames start on Friday 9 July.

**Backward.** The frames must start on Friday 9 July at the latest, or the handover moves. So the outer leaf must be finished by Thursday 8 July at the latest. Six work days back, that is a late start on Thursday 1 July.

**Float.** The outer leaf can start on 29 June at the earliest and must start on 1 July at the latest. In between are 2 work days: Wednesday 30 June and Thursday 1 July. That is its total float. In the *Properties* panel, under *CPM Result*, you see *Total float: 2 days* and *Critical path: No*.

The inner chain has no float. Every day of delay there moves the frames and everything after them.

### Painting

*Painting* (3 work days) starts after the plastering, on Monday 26 July, and is finished on Wednesday 28 July. The next task, *Snagging and cleaning*, also waits for the tiling. That is only finished on Thursday 5 August, because the floor screed has to dry for five work days first. So the painting may run on until Thursday 5 August. That gives 6 work days of float: 29 and 30 July, and 2 to 5 August. The weekend does not count.

For both tasks the free float equals the total float (2 and 6 days). Their direct successor is on the critical path. What they use up, they take from no one else.

### What if the outer leaf runs late?

Set the duration of *Build outer cavity leaf* to 8 work days and press **Calculate**. The outer leaf now finishes on Thursday 8 July, exactly its late finish. The float is gone and the task turns red. Both chains are now critical: the status bar counts 22 critical tasks instead of 21. The handover stays on Friday 6 August.

Make it 9 work days. Now the outer leaf is only finished on Friday 9 July. The frames move to Monday 12 July and the handover to Monday 9 August: one work day later. The outer chain is now the critical path. The inner chain has gained 1 work day of float.

### Near-critical in the example

Under *Settings › Project › Project info*, tick *Mark near-critical* (threshold 2 work days) and choose *Apply*. The outer leaf, with exactly 2 days of float, gets an amber bar. The painting, with 6 days, stays blue.

## Consequences and misconceptions

**"Critical means important."** No. An inspection can be crucial and still have float. The other way round, a simple job can be critical: in the example, *Snagging and cleaning* is on the critical path. Critical is only about time: there is no margin left.

**"This task has float, so it can wait."** Watch out for shared float. If a task has total float but no free float, every day of delay takes margin away from the tasks after it.

**A forgotten relation gives false float.** A task without a successor gets float up to the end of the project. In the practice project without relations, everything starts on 7 June and only *Build outer cavity leaf* is critical, because it is the longest task. All other tasks seem to have room. So check that every task has a successor, or turn on *Open-ended tasks critical*. In the same project, all 23 tasks then become critical.

**The critical path is not fixed.** If a non-critical task runs later than its float, another chain becomes the longest. You saw that above with 9 days of brickwork. So look again after every change, and press **Calculate** first. As long as the status bar says *Out of date*, the red bars still belong to the previous calculation.

**Float counts in work days.** Six days of float can be well over a week in the diary. A weekend, public holiday or construction holiday in the calendar does not count.

## See also

- [Adding relations](docs://howto-relaties-leggen): the steps to link tasks and set a lag.
- [Calculation profiles](docs://gids-rekenprofielen): why P6 and MS Project differ in the details.
- [Planning well](docs://gids-goed-plannen): planning principles, such as why every task should have a predecessor and a successor.
