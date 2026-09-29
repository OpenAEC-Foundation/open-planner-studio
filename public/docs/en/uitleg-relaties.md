# Relations and lag

Why does the brickwork only start once the foundation is in? And why does the roof installation slip a week when the roof elements are delivered late? That is down to the relations between your tasks. In this article you read which four kinds of relations the app knows, what lag and lead do, in which calendar a lag counts, what happens to a relation on a phase, and how the app decides which relation determines a task's start date.

The rules and examples apply to a new project, with the calculation profile *Open Planner Studio* and a work week from Monday to Friday.

## The concept

A **relation** records that two tasks depend on each other. The first task is the **predecessor**, the second the **successor**. A relation is a lower limit: the successor may never start or finish earlier than the relation allows, but it may start or finish later. If a task has several predecessors, it waits for the latest date that comes out of all those relations.

There are four kinds. They differ in which moment of the predecessor (start or finish) is tied to which moment of the successor:

- **FS (Finish-Start).** The successor only starts once the predecessor is finished. The roof elements go on only once the walls are up. This is by far the most used relation.
- **SS (Start-Start).** The successor only starts once the predecessor has started. The tasks may overlap: the pipework can start as soon as the brickwork is under way.
- **FF (Finish-Finish).** The successor only finishes once the predecessor is finished. The pointing cannot be done before the brickwork is done, but it may start earlier.
- **SF (Start-Finish).** The successor only finishes once the predecessor has started. This kind is rare. An example: the temporary dewatering may only stop once the brickwork on the foundation has started.

A relation can also have a **lag**: waiting time between the two tasks, such as concrete that has to cure. A negative lag is called a **lead**: the successor then starts before the predecessor is finished, so the tasks overlap.

## How the app calculates

### The four kinds

For each relation the app calculates the earliest date on which the successor can start, and takes the latest of all the relations of a task. Without a lag it works like this:

- With FS the successor starts on the first work day after the predecessor's finish.
- With SS the successor starts on the same day as the predecessor.
- With FF the successor finishes on the same day as the predecessor. To find the start, the app counts back over the successor's duration. A successor of 3 work days therefore starts 2 work days before the predecessor's finish.
- With SF the successor finishes on the day the predecessor starts. Here too the app counts back over the successor's duration.

These are lower limits. A successor starts later if another relation or a constraint demands it. All dates only appear after **Calculate** (F5); as long as the status bar says *Out of date — recalculate (F5)*, the bars belong to the previous calculation.

### Lag and lead

A lag can be expressed in four ways:

- In **work days** (`3` or `3d`): the app skips days off and weekends. This is the default.
- In **calendar days** (`3ed`, the e stands for *elapsed* time): every day counts, including Saturday and Sunday. This is the unit for something that carries on without work being done, such as curing.
- As a **percentage** of the predecessor's duration (`40%`): the app works this out again at every calculation and rounds to whole days (2.5 days becomes 3).
- In **working hours** (`4h`): between tasks scheduled in days, the app converts the hours to whole work days of the lag calendar, rounded to the nearest whole day (half a day goes up). With a work day of 8 hours, `2h` and `3h` therefore give 0 days, `4h` up to and including `11h` give 1 day and `12h` gives 2 days.

The rule for a lag of N work days with FS: the N work days after the predecessor's finish are waiting time, and the successor starts on the work day after that. With SS and FF the lag is added to the predecessor's start and finish respectively. A negative lag counts back: a lead of 1 work day with FS lets the successor start on the day the predecessor finishes.

A lead cannot put a task before the project start. If that would happen, the app keeps the successor on the project start and reports in the *Warnings* panel: *Lead truncated by the project start — the relation is not fully honoured*.

### In which calendar the lag counts

Every task can have its own calendar. With a lag in work days it matters which calendar counts the work days. The setting *Lag calendar* decides that, with four choices: *Predecessor*, *Successor*, *24-hour* and *Project calendar*. By default the lag counts in the calendar of the **predecessor**. You find the setting under *Settings › Project › Project info*, in the block *Calculation profile and options*, at *Calculation options of this project*. The choice belongs to the project file and only counts after you click *Apply*; the schedule is then recalculated.

A lag in calendar days (`3ed`) always counts all days, whichever *Lag calendar* you choose.

### Relations on summary tasks

You can put a relation on a phase (a summary task) instead of on a task inside it. Internally the app puts that relation on every task in the phase:

- A phase as **predecessor** with FS or FF: the successor waits until the last task in the phase to finish is done.
- A phase as **successor** with FS or SS: every task in the phase waits for the predecessor, independently of the other tasks in the phase.
- A phase as **predecessor** with SS or SF: the successor waits for the start of the task in the phase that starts **last**, not for the start of the phase itself. That is more cautious than you might expect: the successor never starts too early, but possibly later than you mean. If you want the successor to follow the start of the phase, put the relation on the first task in the phase.
- A phase as **successor** with FF or SF: every task in the phase has to meet the finish demand itself (with FF finish on or after the predecessor's finish, with SF on or after the predecessor's start), even a task that could have been done much earlier. Rather put such a relation on the last task in the phase.

A relation between a task and the phase it sits under is not allowed.

### Driving relations

If a successor has several predecessors, usually one relation determines its start date: the relation that keeps the successor from starting a single day earlier than it does now. Such a relation is called **driving**. With a tie there are several driving relations. You recognise a driving relation by the lightning-bolt symbol in the *Predecessors* and *Successors* columns of the table, by the *Driving* column (the **+** on the right of the table header, under *Relations*) and by the stronger tint when you trace a path. How to open that path is in [Tracing a path](docs://howto-pad-traceren).

Driving says something about dates, not about duration. A short predecessor can be driving too, for example because of a long lag; you see that in the example below.

## Worked example

The examples use separate mini-projects, all starting on Monday 7 June 2027 unless stated otherwise. Terms such as critical path and float are explained in [Critical path and float](docs://uitleg-kritiek-pad). Building a network of relations yourself and checking it is what you do in tutorial 2, "Relations and the critical path".

### Four kinds side by side

*Pour foundation* takes 5 work days: Monday 7 to Friday 11 June. *Build walls* (5 work days) follows with FS and runs from Monday 14 to Friday 18 June. Four tasks of 3 work days each hang off *Build walls*, each with a different kind:

- *Place roof elements* (FS) starts on Monday 21 June, the first work day after the brickwork, and is done on Wednesday 23 June.
- *Pipework* (SS) starts on Monday 14 June, together with the brickwork, and is done on Wednesday 16 June.
- *Pointing* (FF) has to be done on Friday 18 June, together with the brickwork. With 3 work days it therefore starts on Wednesday 16 June.
- *Dewatering* (SF) has to finish on Monday 14 June, the day the brickwork starts. Counting back 3 work days (Thursday 10, Friday 11, Monday 14 June) gives a start on Thursday 10 June.

Only *Place roof elements* is on the critical path; the project is done on Wednesday 23 June. *Pipework*, *Pointing* and *Dewatering* have 5, 3 and 7 work days of float respectively.

### Lag and lead in numbers

*Pour foundation* is done on Friday 18 June. *Build walls* (2 work days) follows with FS. What the lag does to the start date:

- Without a lag the brickwork starts on Monday 21 June.
- With lag `3` (three work days) Monday 21, Tuesday 22 and Wednesday 23 June are waiting time; the brickwork starts on Thursday 24 June.
- With lag `3ed` (three calendar days) Saturday, Sunday and Monday count; the brickwork starts on Tuesday 22 June.
- With lag `-1` (a lead of one work day) the brickwork starts on Friday 18 June, the day the pour is done.
- With lag `40%` the lag is 40% of 5 work days, so 2 work days; the brickwork starts on Wednesday 23 June.
- With lag `50%` the lag is 2.5 work days, rounded to 3 work days; the brickwork starts on Thursday 24 June.

### Which calendar counts the lag

*Build walls* (4 work days) is on the project calendar (Monday to Friday) and is done on Thursday 10 June. *Pointing* (2 work days) follows with FS and lag `3`, and is on a calendar in which Saturday and Sunday are work days too. Then the start date depends on *Lag calendar*:

- *Predecessor* (default): the lag counts in the brickwork's calendar. Friday 11, Monday 14 and Tuesday 15 June are waiting time; the pointing starts on Wednesday 16 June.
- *Successor*: the lag counts in the pointing's calendar. Friday 11, Saturday 12 and Sunday 13 June are waiting time; the pointing starts on Monday 14 June.
- *24-hour*: every calendar day counts. Here too Friday, Saturday and Sunday are waiting time; the pointing starts on Monday 14 June.
- *Project calendar*: the lag counts in the project calendar, just like with *Predecessor*; the pointing starts on Wednesday 16 June.

### Relations on a phase

*Foundation* is a phase with two tasks: *Excavate* (2 work days, Monday 7 and Tuesday 8 June) and then *Pour* (3 work days, Wednesday 9 to Friday 11 June). *Build walls* follows the phase *Foundation* with FS and starts on Monday 14 June: the app makes it wait for *Pour*, the last task to finish.

With a phase as successor: *Permit* (3 work days, done on Wednesday 9 June) goes with FS to the phase *Structure*. The phase contains *Build walls* (4 work days) and then *Lay floor* (2 work days). Every task in the phase waits for the permit: *Build walls* starts on Thursday 10 June and is done on Tuesday 15 June. *Lay floor* also waits for the brickwork and runs from Wednesday 16 to Thursday 17 June.

With SS from a phase: the phase *Finishing* contains *Plastering* (2 work days, 7 and 8 June), then *Painting* (3 work days, 9 to 11 June) and then *Snagging* (2 work days, 14 and 15 June). *Cleaning* follows the phase with SS. You would expect a start on Monday 7 June, but the app makes *Cleaning* wait for the start of *Snagging*, the task that starts last: Monday 14 June.

### What is driving

*Pour foundation* (2 work days) runs from Monday 7 to Tuesday 8 June. Two branches follow:

- *Build walls* (5 work days): Wednesday 9 to Tuesday 15 June.
- *Order roof elements* (2 work days): Wednesday 9 and Thursday 10 June.

*Place roof elements* (3 work days) follows both: with FS after the brickwork, and with FS and lag `5` after the order (the delivery time). From the brickwork, placing could start on Wednesday 16 June. From the order, Friday 11, Monday 14, Tuesday 15, Wednesday 16 and Thursday 17 June are waiting time; placing starts on Friday 18 June. The relation with the order is therefore driving, even though the order is much shorter than the brickwork. The brickwork has 2 work days of float.

## Consequences and misconceptions

**"A relation fixes the tasks."** No, a relation is a lower limit. A successor starts at the earliest on the date the relation gives, and later if another relation or a constraint asks for that. How constraints fit in is explained in [Constraints and deadlines](docs://uitleg-constraints).

**"SS means the tasks start at the same time."** SS only says the successor may not start before the predecessor. If the successor has another predecessor that finishes later, it starts later.

**"With FF the successor starts on the same day."** No, with FF the finish dates coincide. A short successor therefore starts later than the predecessor, like the pointing in the example.

**"A lag in days counts calendar days."** By default a lag counts work days, in the predecessor's calendar. For curing or drying, where the weekend counts too, you use calendar days (`ed`).

**"A task without relations is no problem."** A task without a predecessor starts on its planned start date, and a task without a successor gets float up to the end of the project. If you forget a relation, a task therefore seems to have plenty of room; see the misconceptions in [Critical path and float](docs://uitleg-kritiek-pad).

**"A relation on a phase is one relation."** For the calculation it is one relation per task in the phase. If you move tasks into or out of a phase, the relations that apply to those tasks change too.

## See also

- [Adding relations](docs://howto-relaties-leggen): the steps to link tasks together and set a lag.
- [Critical path and float](docs://uitleg-kritiek-pad): what the app calculates from your relations, and why a task becomes critical.
- [Constraints and deadlines](docs://uitleg-constraints): date agreements alongside the relations.
- [Tracing a path](docs://howto-pad-traceren): making the chain before or after a task visible.
- [Creating a hammock](docs://howto-hammock): a task with a derived duration, hung on relations of type SS and FF.
- [External relations to another project](docs://howto-externe-relaties): relations with a task in another project file.
