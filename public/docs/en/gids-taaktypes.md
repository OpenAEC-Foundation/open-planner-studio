# Task types and work: fixed duration, fixed work or fixed units

A task with resources has three numbers that belong together: the **remaining duration** (how many working days are left), the **units** per resource (units per working day, 1 = one person full-time) and the **work** (hours). Work = remaining duration × units. Change one of them and another must move. Which one moves is decided by the task's **work rule** — MS Project calls it the *task type* plus *effort-driven*, Primavera P6 the *duration type*.

## Making it visible

By default Open Planner Studio keeps duration and units and lets the work follow — exactly how the app has always scheduled. The work rule and the remaining work are then hidden.

- **Setting**: turn on *Show task types (work rules)* under Settings (⚙, the Settings tab or Backstage → Settings). The work rule then appears in the properties panel and the task dialog, the *Work (rem.)* column in the assignment table, and the *Work rule* and *Remaining work* columns in the grid's column picker.
- **Automatic**: when you open a file that already contains task types (an `.mpp`, MSPDI, P6 or XER file with task types, or a work rule set earlier in this app), those controls are shown for that document regardless of the setting. The app tells you once.

## The four work rules

- **Fixed duration and units** (default; MS Project *Fixed Duration*, not effort-driven; P6 *Fixed Duration & Units/Time*): duration and units stay, work follows. Adding a resource does not change the duration.
- **Fixed duration and work** (P6 *Fixed Duration & Units*): duration and work stay, units follow. A second resource shares the work and lowers everyone's units.
- **Fixed work** (MS Project *Fixed Work*; P6 *Fixed Units*): the work stays. More units, or an extra resource, shortens the task; removing a resource lengthens it.
- **Fixed units** (MS Project *Fixed Units*, effort-driven; P6 *Fixed Units/Time*): the units stay. More work lengthens the task; an extra resource shares the work and shortens it.

Switching the rule alone changes no number. Below the list the panel says in plain words what the chosen rule protects, and in the assignment table the protected column carries a lock.

## Entering work

In the assignment table the *Work (rem.)* column shows the remaining work in hours: stored work from the file, or otherwise remaining duration × units. Type a new number and the work rule decides what moves: under *Fixed work* or *Fixed units* the task gets longer or shorter (the schedule is then stale until you recalculate), under the two fixed-duration rules the units change. Material resources never drive the duration.

In the grid the *Work rule* (list) and *Remaining work* (`name: hours; name: hours`) columns work the same way, also when pasting across several tasks.

## Good to know

- The rule works on the **remaining** part of a started task: actual duration and actual work never move.
- A day task keeps whole days: if work ÷ units yields half a day, the duration is rounded up and the work stays exact.
- Adding or removing a resource, also via *Move to…* or deleting a resource, follows the same rule.
- Every edit is one undo step.
- The project default work rule (for tasks without their own choice) can be set through the AI assistant; a UI for it will follow.
- Milestones, summary tasks, hammocks and elapsed-time tasks have no work rule.
