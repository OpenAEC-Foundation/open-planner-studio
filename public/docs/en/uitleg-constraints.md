# Constraints and deadlines

The bricks are only delivered on 21 June. The permit has not come in yet. The roof has to be closed before the builders' holiday. Relations record that a task waits for another task, but agreements about a date do not follow from the order of the work. That is what constraints and deadlines are for. In this article you read what each type does, when a task moves and when only the float changes, what a hard pin is, and how the app reports a conflict.

The rules and examples apply to a new project, with the calculation profile *Open Planner Studio* and a work week from Monday to Friday.

## The concept

A **constraint** is a date limit on a single task, independent of its relations. Such a limit can work in two ways:

- It **pushes**: the task may not start or finish earlier than the date. If the task would start earlier because of its relations, it moves to the date.
- It **guards**: the task must start or finish on the date at the latest. The app moves nothing. If the schedule does not meet the date, the **float** of the task, and of the chain before it, becomes negative. Float is the room a task has before the project's finish date moves; negative means that on paper you are already late (see [Critical path and float](docs://uitleg-kritiek-pad)).

A **deadline** is a simpler form of guarding: a target date for the finish of a task, without the task being moved by anything.

All constraints are **soft**: the calculation carries on even if a date is not met. There is one exception, the **hard pin**, which overrides the relations. More on that below.

## How the app calculates

### The eight types

You choose the type at *Constraint* in the *Properties* panel. How each type calculates:

- *As soon as possible (ASAP)*: no limit. This is the default: the task starts as soon as its relations allow.
- *As late as possible (ALAP)*: the task moves to its latest moment within its float. After that it has no float left and counts as critical.
- *Start no earlier than (SNET)*: a lower limit for the start. If the task would start earlier, it moves to the date; if the date is earlier than what the relations allow, the constraint does nothing.
- *Finish no earlier than (FNET)*: the same, but for the finish of the task.
- *Start no later than (SNLT)* and *Finish no later than (FNLT)*: an upper limit for the start or the finish. They move nothing. If the limit is not met, the app reports a violated constraint and the float becomes negative.
- *Must start on (MSO)* and *Must finish on (MFO)*: a lower and an upper limit at once. The task moves to the date if that is later than its relations demand. If the date is earlier than what the relations allow, the task stays where the relations put it, and the float becomes negative.

If a date falls on a Saturday, Sunday or day off, the app reads it as a work day: a lower limit (SNET, FNET) as the next work day, an upper limit (SNLT, FNLT) as the previous one.

### What negative float means

An upper limit works backwards. If the constraint puts a task's late date before its early date, the total float becomes negative. That goes for the tasks before it too: if the brickwork has to start by Friday 11 June at the latest and cannot start before Monday 14 June, the tasks before the brickwork are a work day late as well. All tasks with negative float are critical; how that works is explained in [Critical path and float](docs://uitleg-kritiek-pad).

The bars do not move because of an upper limit. You see the conflict in the negative *Total float*, in a red diamond above the bar, in the notice in the status bar (for example *1 constraint(s) violated*) and in the *Warnings* panel.

### The hard pin

With MSO and MFO the tick box *Mandatory (pin logic)* appears. With that tick you fix the task on the date, even if its predecessors are not finished by then. The relations are overridden:

- The task is on the date (with MSO it starts there, with MFO it finishes there) and overlaps with its predecessors.
- The predecessors get negative float, and the app reports a violated constraint as soon as the relations would let the task start later than the pin. The pinned task itself keeps 0 float.
- The successors calculate from the pinned task. They can therefore start earlier than without the pin, even though the logic before it is not finished. In the example below the end of the project moves forward by three work days because of it.

The first time you turn the pin on, the app shows a short explanation: a hard pin overrides the relations, the bar is fixed on the date, even before its predecessors.

### The secondary constraint

A task has one primary constraint. If you also want a second limit, for example a task that may not start before 14 June and has to be finished by 17 June, you add a **secondary constraint**. It has to be a real limit (SNET, FNET, SNLT or FNLT) and limit the other side of the task than the primary one: a lower limit with an upper limit. The app marks other combinations in red with the reason, for example *Primary and secondary may not bound the same side.* With ASAP, ALAP, MSO, MFO and a hard pin a secondary constraint is not allowed.

### The deadline

A deadline is a separate date on a task, alongside the constraint. It is an upper limit on the finish: it moves nothing, but makes the float negative if the task is not finished in time. The app then reports in the *Warnings* panel *Deadline … missed — early finish …* and the status bar counts the missed deadlines. In the Gantt there is a downward arrow on the deadline date: green as long as the task is finished in time, red as soon as it is late. A deadline on a Saturday counts up to and including the Friday before.

For the float a deadline does the same as FNLT. The difference lies in how you use it. A deadline is a target date you want to guard; it stands apart from the constraint, so a task can have a constraint and a deadline. FNLT is a constraint: a violation appears as a violated constraint instead of as a missed deadline.

### What a constraint does not do

- On a **phase** (summary task) a constraint or deadline does not count: the app calculates with the tasks in the phase. Put it on the task itself.
- A task that already has an actual start or progress keeps that start. An SNET with a later date does not move it.
- **Typing a start date** on a task with a predecessor does not work as a fixed start: the predecessor keeps deciding. That is why the app turns it into an SNET on the date you typed, in the *Properties* panel, in *Edit task*, in the table and when you move the bar in the Gantt. The app tells you so. If the task already has another constraint (for example ALAP or MSO), the app does not apply the new start and tells you that too; then change that constraint.

All changes only show after **Calculate** (F5).

## Worked example

The example is a small network for a house extension. It starts on Monday 7 June 2027:

- *Groundwork* (3 work days): Monday 7 to Wednesday 9 June.
- *Pour foundation* (2): Thursday 10 and Friday 11 June.
- *Brickwork* (5): Monday 14 to Friday 18 June.
- *Roofing* (3): Monday 21 to Wednesday 23 June.
- *Scaffolding* (2): follows *Pour foundation* and comes before *Roofing*. It runs on Monday 14 and Tuesday 15 June and has 3 work days of float.

The critical path is *Groundwork*, *Pour foundation*, *Brickwork* and *Roofing*. The project is done on Wednesday 23 June. What changes with one constraint on *Brickwork*?

- **SNET Monday 21 June** (the bricks only arrive then): *Brickwork* runs from Monday 21 to Friday 25 June, *Roofing* from Monday 28 to Wednesday 30 June. The project is done on Wednesday 30 June. *Groundwork* and *Pour foundation* now have 5 work days of float and are no longer critical, *Scaffolding* has 8.
- **SNET Wednesday 9 June**: no effect. The relations only let *Brickwork* start on Monday 14 June anyway.
- **SNLT Wednesday 16 June**: no effect. *Brickwork* starts on Monday 14 June and meets the limit comfortably.
- **SNLT Friday 11 June**: too tight. *Brickwork* still starts on Monday 14 June, one work day late. *Groundwork*, *Pour foundation* and *Brickwork* get −1 work day of float and the app reports *Constraint Start no later than (SNLT) 11-06-2027 is overridden by the logic (negative float)*. Nothing moves.
- **MSO Wednesday 16 June** (without a hard pin): *Brickwork* moves to Wednesday 16 June and is done on Tuesday 22 June. *Roofing* runs from Wednesday 23 to Friday 25 June, the project is done on Friday 25 June.
- **MSO Friday 11 June** (without a hard pin): the date is before what the relations allow. *Brickwork* starts on Monday 14 June anyway and the float becomes −1, just as with SNLT.
- **MSO Wednesday 9 June with a hard pin**: *Brickwork* starts on Wednesday 9 June and is done on Tuesday 15 June, while *Pour foundation* still runs until Friday 11 June. *Roofing* runs from Wednesday 16 to Friday 18 June: the project is done three work days earlier than without the pin. *Groundwork* and *Pour foundation* get −3 work days of float.

And with a constraint or deadline on another task:

- **ALAP on *Scaffolding***: the task moves to Thursday 17 and Friday 18 June, the latest moment before *Roofing*. The 3 work days of float are used up; *Scaffolding* is now critical.
- **SNET Saturday 19 June on *Scaffolding***: the limit counts as Monday 21 June. *Scaffolding* runs on Monday 21 and Tuesday 22 June and *Roofing* moves along to Wednesday 23 to Friday 25 June.
- **Deadline Friday 18 June on *Roofing***: nothing moves, *Roofing* stays on Monday 21 to Wednesday 23 June. *Groundwork*, *Pour foundation*, *Brickwork* and *Roofing* get −3 work days of float and the app reports *Deadline 18-06-2027 missed — early finish 23-06-2027*. *Scaffolding* keeps 0 work days of float and becomes critical too.
- **SNET Monday 21 June on *Brickwork*, deadline Friday 25 June on *Roofing***: the constraint pushes the brickwork back a week, and the deadline reports that *Roofing* is late on Wednesday 30 June. *Brickwork* and *Roofing* get −3 work days of float; *Groundwork* and *Pour foundation* keep 2 work days.

In tutorial 3 you set a constraint and a deadline in the tutorial project yourself and see how the schedule moves.

## Consequences and misconceptions

**"A constraint moves the task."** Only SNET, FNET, MSO and MFO can put a task later than its relations do. SNLT and FNLT never move anything: they only warn. Meeting the date then means shortening the chain before it.

**"Negative float is a fault in the app."** It is the signal that the schedule conflicts with your date agreement. You solve it by shortening the chain, relaxing the agreement, or accepting the conflict on purpose.

**"A hard pin solves the conflict."** A hard pin hides the conflict: the task is on the date, but its predecessors are not ready for it, and the successors calculate as if they were. Use it only for a date that really is fixed, such as a legal handover date, and not as a way to get a task onto a date.

**"I just type a start date."** With a task that has a predecessor that becomes an SNET. If that date is before what the predecessor allows, it does nothing.

**"Deadline or FNLT?"** Choose a deadline for a target date you want to guard, and a constraint for a date that really is a boundary condition for the schedule.

**"A constraint on the phase."** That does not count. Put it on the task itself.

## See also

- [Setting a constraint or deadline](docs://howto-constraint-deadline-zetten): the steps to set a constraint or deadline.
- [Relations and lag](docs://uitleg-relaties): the dependencies that constraints sit alongside.
- [Critical path and float](docs://uitleg-kritiek-pad): how negative float arises and what it does to the critical path.
