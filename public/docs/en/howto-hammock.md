# Creating a hammock

Goal: create a task that does not know its own duration, but runs from the start of one task to the finish of another, such as site setup, supervision or the hire of a site cabin.

## When you need this

The site cabin stands there for as long as the building goes on, from the first groundwork to the handover. If you give that task a fixed duration of 13 work days, it does not follow along when the brickwork runs late, and the schedule stops being right. A **hammock** (also called *level of effort*) follows the work you hang it on: its start comes from a start relation, its finish from a finish relation, and its duration is the difference between the two.

## Steps

1. Create the task, for example *Site cabin*, or select an existing task. A milestone and a summary task (phase) cannot be a hammock; in the *Properties* panel and in *Edit task* the tick box is missing for such a task, and in the table column it cannot be changed.
2. Tick *Hammock (derived duration)* in the *Properties* panel, in *Edit task* (right-click the task, *Edit...*) or in the table column *Hammock (derived duration)* under *Planning*. The *Duration* field can then no longer be edited.
3. Add a relation from the task the hammock starts with to the hammock, of type **SS** (the hammock starts together with that task) or **FS** (the hammock starts after that task). To do so, select the hammock, click *Add relation* in *Dependencies*, leave the direction on *Predecessor*, choose the task and choose the type. The steps are in [Adding relations](docs://howto-relaties-leggen).
4. Add a relation from the task the hammock ends with to the hammock, of type **FF** (the hammock finishes together with that task) or **SF**.
5. Look in the *Properties* panel under *Hammock (derived duration)*: there you see *Start driver* with the task and the type, and *Finish driver* with the task and the type. A driver is a task the hammock takes its start or finish from.
6. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*. The hammock now runs from the start of the start driver to the finish of the finish driver, and *Duration* shows the derived duration.

In the Gantt a hammock is a thin teal bar with a hook at both ends.

Example: *Site cabin* gets SS from *Groundwork* (Monday 7 June 2027) and FF from *Roofing* (done Wednesday 23 June). After **Calculate** the hammock runs from Monday 7 to Wednesday 23 June: 13 work days. If the brickwork runs 2 work days late, the end of *Roofing* becomes Friday 25 June and the hammock grows along to 15 work days.

## What the app does with a hammock

- The hammock is never critical and has no float. It does not restrict the tasks it takes its start and finish from either: they get no late date because of the hammock.
- A lag counts. With SS and lag `1d` the hammock starts a work day after the start driver, with FF and lag `2d` it finishes two work days after the finish driver.

## Pitfalls and what the app does

**No finish driver.** If the hammock has no FF or SF relation, the app cannot derive its finish. The *Properties* panel says *No finish driver (FF/SF) — the span falls back to zero length.* and the *Warnings* panel says *Hammock without a finish driver (no FF/SF predecessor): its duration falls back to zero*. The hammock then starts and finishes on the same day. Add an FF or SF relation.

**A hammock that finishes after the last task.** If the hammock carries on until after the last task, for example with FF and a lag of 2 work days, the finish date of the project moves along. The tasks you really carry out then get float; none of them is critical any more.

**Tasks that wait for a hammock.** If you add a relation from the hammock to another task, that task only starts after the end of the hammock. The whole chain before the hammock, including the tasks the hammock takes its start and finish from, then gets float and is no longer critical, because the hammock gives no pressure back. So do not let tasks wait for a hammock; rather hang such tasks on the hammock's finish driver.

**Entering a duration.** The *Duration* field of a hammock is derived and cannot be edited. A duration you had entered before ticking the box no longer counts.

## See also

- [Adding relations](docs://howto-relaties-leggen): the steps to add a relation of type SS or FF.
- [Relations and lag](docs://uitleg-relaties): what SS and FF mean and how the lag counts.
- [Critical path and float](docs://uitleg-kritiek-pad): what critical means and how float works.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contains the hammock *Structural works tower A (LOE)*.
