# Setting a constraint or deadline

Goal: record a date agreement on a task, so the schedule takes it into account or shows that you are not meeting it.

## When you need this

The bricks are only delivered on 21 June, so the brickwork may not start earlier: a **constraint** *Start no earlier than*. The roof has to be closed before the builders' holiday, and you want to be warned if that does not work out: a **deadline**. The pour is fixed on a day because the concrete plant has promised it: *Must start on*. Which type fits when, and what the app does with it, is explained in [Constraints and deadlines](docs://uitleg-constraints).

## Steps

You set a constraint and a deadline in the *Properties* panel.

1. Select the task. If you do not see the *Properties* panel, turn it on with *View › Panels › Properties*.
2. At *Constraint* choose the type, for example *Start no earlier than (SNET)*.
3. With every type except *As soon as possible (ASAP)* and *As late as possible (ALAP)* the field *Constraint date* appears. Type the date in the three boxes for day, month and year, for example 21, 06 and 2027, and press Enter. The app jumps to the next box by itself as soon as a box is full. After you choose the type a date is already there: that of the previous constraint, or otherwise the task's original planned start. It can differ from the start the panel shows, so always enter the date you mean yourself.
4. If you want to fix the task on the date, even before its predecessors, choose *Must start on (MSO)* or *Must finish on (MFO)* and tick *Mandatory (pin logic)*. That is a hard pin; use it only for a date that really is fixed.
5. If you also want a second limit, for example a task that may not start before 14 June and has to be finished by 17 June, choose a type at *Secondary constraint* and fill in the *Secondary date*. This field appears with every constraint that has a date, except with a hard pin. With MSO and MFO a secondary constraint is not allowed: the app then marks it in red.
6. For a deadline fill in the *Deadline* field, in the same way as the constraint date. A deadline stands apart from the constraint: you can set both on the same task.
7. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*. Until then the status bar says *Out of date — recalculate (F5)*.

The fields are also in the *Edit task* window, which you open by right-clicking the task and choosing *Edit...*; you confirm with *Save*.

In the table you work with columns. Click the **+** in the table header and under *Constraints* choose the columns *Constraint type*, *Constraint date* and *Deadline* (there are also *Hard constraint*, *Secondary constraint type* and *Secondary constraint date*). Double-click a cell to edit it: you choose the type from a list, and you type a date with dashes, for example 21-06-2027. *Hard constraint* can only be changed for MSO and MFO.

If the task has a predecessor, there is a shortcut for *Start no earlier than*: just type a new start date in the *Start* field (in the *Properties* panel, in *Edit task* or in the table), or move the bar in the Gantt. The app then turns it into a constraint *Start no earlier than (SNET)* itself and tells you so.

## Checking the result

- In the Gantt there is a small diamond above the bar, at the start side for a start constraint and at the finish side for a finish constraint: blue for SNET and FNET, violet for SNLT, FNLT, MSO and MFO, red if the constraint is violated. A hard pin has a pin. A deadline is a downward arrow on the deadline date: green as long as the task is finished in time, red if it is late.
- A violated constraint or missed deadline appears in the *Warnings* panel (*Planning › Schedule › Warnings*) and in the status bar. The *Total float* of the task and the tasks before it is then negative.
- With an upper limit (*Start no later than*, *Finish no later than*) or a deadline, the absence of a warning means the schedule meets the date.

## Removing a constraint or deadline

At *Constraint* choose *As soon as possible (ASAP)* again. That removes the secondary constraint as well. You remove a deadline by emptying the three boxes and pressing Enter. Then press **Calculate**.

## Pitfalls and what the app does

**A constraint on a phase.** A constraint or deadline on a phase (summary task) has no effect. Put it on the task itself.

**A task that has already started.** If the task has an actual start or progress, it keeps its actual start. A *Start no earlier than* with a later date does not move it.

**Typing a start date next to another constraint.** If the task has a predecessor and already has another constraint, for example *As late as possible (ALAP)*, the app does not apply a typed start. A message names the constraint; change that if you want to move the start.

**A date in the weekend.** A date on a Saturday, Sunday or day off counts as a work day: a lower limit (*Start no earlier than*, *Finish no earlier than*) as the next work day, an upper limit (*Start no later than*, *Finish no later than*) as the previous one.

**A secondary constraint that is not allowed.** The app marks an invalid combination in red with the reason, for example *Primary and secondary may not bound the same side.* A secondary constraint is not allowed with ASAP, ALAP, MSO, MFO and a hard pin.

**A hard pin.** The first time you turn it on, the app warns that a hard pin overrides the relations. The task is then on the date, even before its predecessors; those predecessors get negative float.

**Nothing changed after setting it.** Constraints only work after **Calculate**. If an upper limit (*Start no later than*, *Finish no later than*) has no effect on the bars, that is normal: an upper limit moves nothing, it makes the float negative if the date is not met.

## See also

- [Constraints and deadlines](docs://uitleg-constraints): what each type does, and the explanation of hard pin, negative float and deadline.
- [Critical path and float](docs://uitleg-kritiek-pad): what negative float does to the critical path.
- [Relations and lag](docs://uitleg-relaties): the relations a constraint sits alongside.
- [Notifications and warnings](docs://ref-meldingen): the warnings for a violated constraint or missed deadline.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): a permit constraint *Start no earlier than* on *Demolish existing extension* (14 May 2027) and a deadline that is met with room to spare.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): a deliberately tight deadline on *Contractual project handover* (15 July 2027): after calculating, the finish is on 17 August and many tasks have negative float.
