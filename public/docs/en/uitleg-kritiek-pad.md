# Critical path and float

Why is your project's finish date what it is? And which task can run a day late without moving the handover? Those are the questions behind the critical path. This article explains exactly what the app calculates, with a small example you build and check yourself.

## The concept

A schedule is a network of tasks joined by **relations**: agreements such as "the window frames go in only once the roof is closed". Those relations tie tasks together. Some chains of tasks are longer than others. The longest chain decides how long the whole project takes.

That longest chain is the **critical path**. If one task on it runs a day late, the handover moves a day. There is no room in it.

Tasks off the critical path do have room. That room is called **float**. The bricklayer building the outer cavity leaf might start two days later without anyone noticing. Those two days are that task's float.

So critical says nothing about how important a task is. It only says there is no time to spare.

The calculation method is called **CPM** (Critical Path Method). That is why the block with the results in the *Properties* panel is called *CPM Result*.

## How the app calculates

The app does not recalculate the schedule by itself. You start the calculation with **Calculate** (F5), for example through *Home › Schedule › Calculate*. If you changed something since the last calculation, the status bar shows *Out of date — recalculate (F5)*. If you want the app to do this for you, turn on *Calculate automatically* under *Settings › Project › Settings*, tab *Planning*, heading *Calculation*.

A calculation makes two passes through the network.

### Forward pass

The app starts at the project start and follows the relations from predecessor to successor. For each task the app finds the earliest day that task can start. If a task has several predecessors, the task waits for the last one to finish. That gives each task its **early start** and **early finish**. The latest early finish of all tasks is the project's finish date.

### Backward pass

Then the app walks back, from that finish date to the start. Now the app finds, for each task, the last day the task must be finished without moving the finish date. If a task has several successors, the one that must start first counts. That gives the **late start** and the **late finish**.

### Total and free float

The difference between a task's late and early dates is its **total float**: the number of work days the task can run late or start later before the project finish date moves. The app counts in work days of the task's calendar. A weekend or a public holiday does not count.

**Free float** is stricter. It is the room a task has before one of its successors has to start later. You can use that room without any other task noticing.

Total float can be shared. If two non-critical tasks follow each other, they share the same margin. If the first one uses it up, the second has none left. The first one then has total float, but no free float. The part of the total float that is not free is called **interfering float**: if you use it, the tasks after it move too. The example below shows this with numbers.

### Negative float

Float can also become negative. That happens when a task has a deadline, or a constraint that imposes a latest date, that lies before the date the app calculates for that task. On paper the task is already late, and the task and the chain before it become critical.

### When is a task critical?

By default a task is critical when its total float is 0 or less. You change this under *Settings › Project › Project info*, in the block *Calculation profile and options*, at *Calculation options of this project*. When you click *Apply*, the app recalculates the schedule straight away. The options belong to the project file, not to the app.

- **Critical definition** with *Total float ≤ threshold* and the field *Threshold (work days)*. The threshold is 0 by default. If you want to guard a buffer, set it to 2, for example: every task with 2 work days of float or less then counts as critical and turns red.
- **Mark near-critical** with its own *Threshold*, 2 work days by default. A task with more than 0 but at most that much float gets an amber bar. That shows which tasks have almost no margin left, without calling them critical.
- **Open-ended tasks critical**: a task without a successor that is not finished yet counts as critical. Useful as a safety net against forgotten relations (see the misconceptions below).
- **Float calculation** decides whether total float is measured at the start of the task, at its finish, or as the smaller of the two. New projects are set to *Automatic (default)*. If you follow another package's way of calculating, *Apply this profile's default options* sets this choice to that profile's value: *Finish float* for Primavera P6, *Smallest (start/finish)* for MS Project. More on that in [Calculation profiles](docs://gids-rekenprofielen).

### Where you see it

Critical tasks have a red bar in the Gantt. Behind a non-critical bar there is a green band up to the task's late finish: that is the float. You turn that band on or off with *View › Baselines & progress › Float band*.

When you select a task, the *Properties* panel lists everything under *CPM Result*: early and late start and finish, total, free and interfering float, and whether the task is on the critical path. To see the float of all tasks side by side, add a column with the **+** on the right of the table header, under *Calculated*. It includes *Total float*, *Free float*, *Critical* and *Near critical*.

The status bar at the bottom counts the critical tasks, for example *Critical path: 5 tasks, 11 work days*.

## Worked example: build it yourself

The example is a piece of the shell of an extension. If you follow the tutorials, you will recognise it from the practice project *House extension*; there too, *Build outer cavity leaf* has 2 work days of float.

### The network

Create a new project with *Home › File › New* and set the *Start Date* to Monday 28 June 2027. Add these six tasks, with their duration in work days:

1. Floor: 1
2. Inner leaf: 5
3. Roof elements: 1
4. Roofing: 2
5. Outer leaf: 6
6. Window frames: 2

Then add these relations, all Finish-Start (how to do that is in [Adding relations](docs://howto-relaties-leggen)):

- Floor → Inner leaf → Roof elements → Roofing → Window frames. The frames can only go in once the roof is closed.
- Floor → Outer leaf → Window frames. The frames sit in the facade, so that must be finished too.

Press **Calculate** (F5). The project finishes on Monday 12 July 2027 and the status bar says *Critical path: 5 tasks, 11 work days*. Only Outer leaf is not critical.

### Forward

The floor is laid on Monday 28 June. Both cavity leaves can start on Tuesday 29 June. The inner leaf is finished on Monday 5 July. The roof elements go on on Tuesday 6 July, and the roofing follows on Wednesday 7 and Thursday 8 July. The outer leaf is finished on Tuesday 6 July. The window frames wait for the later of the two chains: the roofing. So they start on Friday 9 July and are finished on Monday 12 July.

### Backward

The window frames must start on Friday 9 July at the latest, or the finish date moves. So the outer leaf must be finished by Thursday 8 July at the latest. Six work days back, that is a late start on Thursday 1 July.

### The float

The outer leaf can start on 29 June at the earliest and must start on 1 July at the latest. In between are 2 work days: Wednesday 30 June and Thursday 1 July. That is its total float. Select Outer leaf and under *CPM Result* you see *Total float: 2 days* and *Critical path: No*. The free float is also 2 days, because its only successor, Window frames, is on the critical path.

The inner chain has no float. Every day of delay there moves the window frames and therefore the finish date.

### What if the outer leaf runs late?

Set the duration of Outer leaf to 8 work days and press **Calculate**. The outer leaf now finishes on Thursday 8 July, exactly its late finish. The float is gone and the task turns red. Both chains are now critical: the status bar counts 6 critical tasks. The finish date stays Monday 12 July.

Make it 9 work days. Now the outer leaf is only finished on Friday 9 July. The window frames move to Monday 12 and Tuesday 13 July: the project finishes one work day later. The outer chain is now the critical path.

The inner chain now has 1 work day of total float, but that day is shared:

- Inner leaf: total float 1, free float 0, interfering float 1. If the inner leaf runs a day late, the roof elements move with it.
- Roof elements: total float 1, free float 0, interfering float 1.
- Roofing: total float 1, free float 1. Only here does a day's delay cost nobody anything.

It is the same single day, shared by the whole chain. If the inner leaf uses it, it is gone for the roof elements and the roofing.

### Near-critical and negative float in the example

Set the duration of Outer leaf back to 6 and, under *Settings › Project › Project info*, tick *Mark near-critical* (threshold 2 work days). After *Apply*, Outer leaf, with exactly 2 days of float, gets an amber bar.

Then give Window frames a *Deadline* of Thursday 8 July 2027 in the *Properties* panel and press **Calculate**. According to the calculation the frames are only finished on 12 July, two work days late. Window frames, the floor and the whole inner chain now get a total float of −2 work days.

## Consequences and misconceptions

**"Critical means important."** No. An inspection can be crucial and still have float. The other way round, a simple job can be critical. Critical is only about time: there is no margin left.

**"This task has float, so it can wait."** Look at the free float first. If a task has total float but no free float, every day of delay takes margin away from the tasks after it, as with the inner leaf above.

**A forgotten relation gives false float.** A task without a successor gets float up to the end of the project. In the example, remove the relation Outer leaf → Window frames and recalculate: Outer leaf suddenly has 4 work days of float, and on paper could run late without the frames waiting. So check that every task has a successor, or turn on *Open-ended tasks critical*. Then Outer leaf becomes critical in the same case and the gap shows.

**The critical path is not fixed.** If a non-critical task runs later than its float, another chain becomes the longest. You saw that above with 9 days of brickwork. So look again after every change, and press **Calculate** first. As long as the status bar says *Out of date*, the red bars still belong to the previous calculation.

**Float counts in work days.** The 4 work days of float of the forgotten outer leaf run from Wednesday 7 to Monday 12 July: six days in the diary, because the weekend does not count. A public holiday or construction holiday in the calendar does not count either.

## See also

- [Adding relations](docs://howto-relaties-leggen): the steps to link tasks and set a lag.
- [Calculation profiles](docs://gids-rekenprofielen): why P6 and MS Project differ in the details.
- [Planning well](docs://gids-goed-plannen): planning principles, such as why every task should have a predecessor and a successor.
