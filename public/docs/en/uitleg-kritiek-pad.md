# Critical path and float

Why is your project's finish date what it is? And which task can run a day late without moving the handover? Those are the questions behind the critical path. This article explains exactly what the app calculates, using a worked example.

## The concept

A schedule is a network of tasks joined by **relations**: agreements such as "the window frames go in only once the roof is closed". Those relations tie tasks together. Some chains of tasks are longer than others. The longest chain decides how long the whole project takes.

That longest chain is the **critical path**. If one task on it runs a day late, the handover moves a day. There is no room in it.

Tasks off the critical path do have room. That room is called **float**. The bricklayer building the outer cavity leaf might start two days later without anyone noticing. Those two days are that task's float.

So critical says nothing about how important a task is. It only says there is no time to spare.

The calculation method is called **CPM** (Critical Path Method). That is why the block with the results in the *Properties* panel is called *CPM Result*.

## How the app calculates

The app does not recalculate the schedule by itself. The calculation starts with **Calculate** (F5), for example through *Home › Schedule › Calculate*. If something changed since the last calculation, the status bar shows *Out of date — recalculate (F5)*. If *Calculate automatically* is on (under *Settings › Project › Settings*, tab *Planning*, heading *Calculation*), the app does this itself.

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

By default a task is critical when its total float is 0 or less. This can be changed under *Settings › Project › Project info*, in the block *Calculation profile and options*, at *Calculation options of this project*. When you click *Apply*, the app recalculates the schedule straight away. The options belong to the project file, not to the app.

- **Critical definition** with *Total float ≤ threshold* and the field *Threshold (work days)*. The threshold is 0 by default. To guard a buffer, set it to 2, for example: every task with 2 work days of float or less then counts as critical and turns red.
- **Mark near-critical** with its own *Threshold*, 2 work days by default. A task with more than 0 but at most that much float gets an amber bar. That shows which tasks have almost no margin left, without calling them critical.
- **Open-ended tasks critical**: a task without a successor that is not finished yet counts as critical. Useful as a safety net against forgotten relations (see the misconceptions below).
- **Float calculation** decides whether total float is measured at the start of the task, at its finish, or as the smaller of the two. New projects are set to *Automatic (default)*. If you follow Primavera P6's way of calculating, *Apply this profile's default options* sets this choice to *Finish float*. MS Project itself already calculates as *Automatic (default)*: under the profile *Microsoft Project* the choice stays there.

### Where you see it

Critical tasks have a red bar in the Gantt. Behind a non-critical bar there is a green band up to the task's late finish: that is the float. The band is turned on or off with *View › Baselines & progress › Float band*.

For a selected task, the *Properties* panel lists everything under *CPM Result*: early and late start and finish, total, free and interfering float, and whether the task is on the critical path. The float of all tasks side by side is in the columns under *Calculated* (the **+** on the right of the table header), such as *Total float*, *Free float*, *Critical* and *Near critical*.

The status bar at the bottom counts the critical tasks, for example *Critical path: 21 tasks, 45 work days*.

## Worked example: the house extension

The example is the tutorials' practice project *House extension*, as it stands once all relations are in place. In tutorial 2, "Relations and the critical path", you build this yourself and check the numbers. Here you read why the numbers are what they are.

The extension starts on Monday 7 June 2027. After the calculation the handover is on Friday 6 August 2027 and the status bar says *Critical path: 21 tasks, 45 work days*. Two tasks are not critical: *Build outer cavity leaf* and *Painting*.

### Two chains that meet

After the structural floor (*Lay hollow-core floor*, finished on Monday 28 June) the work splits into two chains. Both end at *Install window frames*:

- The inside: *Build inner cavity leaf* (5 work days), then *Place roof elements* (1), then *Apply roofing* (2). The window frames can only go in once the roof is closed.
- The outside: *Build outer cavity leaf* (6 work days). The frames sit in the facade, so that must be finished too.

**Forward.** Both cavity leaves can start on Tuesday 29 June. The inner leaf is finished on Monday 5 July. The roof elements go on on Tuesday 6 July, and the roofing follows on Wednesday 7 and Thursday 8 July. The outer leaf is finished on Tuesday 6 July. *Install window frames* waits for the later of the two chains, the roofing, and so starts on Friday 9 July.

**Backward.** The frames must start on Friday 9 July at the latest, or the handover moves. So the outer leaf must be finished by Thursday 8 July at the latest. Six work days back, that is a late start on Thursday 1 July.

**Float.** The outer leaf can start on 29 June at the earliest and must start on 1 July at the latest. In between are 2 work days: Wednesday 30 June and Thursday 1 July. That is its total float; the panel shows *Total float: 2 days* and *Critical path: No*. The free float is also 2 days, because its only successor, *Install window frames*, is on the critical path.

The inner chain has no float. Every day of delay there moves the frames and everything after them.

### Painting

*Painting* (3 work days) starts after the plastering, on Monday 26 July, and is finished on Wednesday 28 July. The next task, *Snagging and cleaning*, also waits for the tiling. That is only finished on Thursday 5 August, because the floor screed has to dry for five work days first. So the painting may run on until Thursday 5 August. That gives 6 work days of float: 29 and 30 July, and 2 to 5 August. Here too the free float equals the total float, because the successor is critical.

### When the outer leaf runs late

If the outer leaf takes 8 work days instead of 6, it finishes on Thursday 8 July: exactly its late finish. The float is gone and the task turns red. Both chains are then critical and the status bar counts 22 critical tasks. The handover stays on Friday 6 August.

If it takes 9 work days, the outer leaf is only finished on Friday 9 July. The frames move to Monday 12 July and the handover to Monday 9 August: one work day later. The outer chain is now the critical path; the status bar says *Critical path: 19 tasks, 46 work days*.

The inner chain then has 1 work day of total float, but that day is shared:

- *Build inner cavity leaf*: total float 1, free float 0, interfering float 1. If the inner leaf runs a day late, the roof elements move with it.
- *Place roof elements*: total float 1, free float 0, interfering float 1.
- *Apply roofing*: total float 1, free float 1. Only here does a day's delay cost nobody anything.

It is the same single day, shared by the whole chain. If the inner leaf uses it, it is gone for the roof elements and the roofing.

### Near-critical and negative float

With *Mark near-critical* on at the default threshold of 2 work days, the outer leaf, with exactly 2 days of float, gets an amber bar. The painting, with 6 days, stays blue.

If the handover gets a deadline of Wednesday 4 August, two work days before the calculated handover, the float becomes negative. All 21 tasks on the critical path get a total float of −2 work days. The outer leaf has no float left and also becomes critical; the painting keeps 4 work days.

## Consequences and misconceptions

**"Critical means important."** No. An inspection can be crucial and still have float. The other way round, a simple job can be critical: in the example, *Snagging and cleaning* is on the critical path. Critical is only about time: there is no margin left.

**"This task has float, so it can wait."** Look at the free float first. If a task has total float but no free float, every day of delay takes margin away from the tasks after it, as with the inner leaf in the 9-work-day case.

**A forgotten relation gives false float.** A task without a successor gets float up to the end of the project. If the example lacked the relation from the outer leaf to the frames, the outer leaf would suddenly have 23 work days of float, up to the handover on 6 August. On paper it could then run weeks late without the frames waiting. With *Open-ended tasks critical* on, the outer leaf becomes critical in that case and the gap shows.

**The critical path is not fixed.** If a non-critical task runs later than its float, another chain becomes the longest. You saw that above with 9 days of brickwork. So the schedule has to be recalculated after every change. As long as the status bar says *Out of date*, the red bars still belong to the previous calculation.

**Float counts in work days.** The painting's 6 work days of float run from Thursday 29 July to Thursday 5 August: eight days in the diary, because the weekend does not count. A public holiday or construction holiday in the calendar does not count either.

## See also

- [Adding relations](docs://howto-relaties-leggen): the steps to link tasks and set a lag.
