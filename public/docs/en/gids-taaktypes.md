# Work rules and work: fixed duration, fixed work or fixed units

A task with resources has three numbers that belong together: the **remaining duration** (how many working days are left), the **units** per resource (units per working day, 1 = one person full-time) and the **work** (hours). Work = remaining duration × units. Change one of them and another must move. Which one moves is decided by the task's **work rule** — MS Project calls it the *task type* plus *effort-driven*, Primavera P6 the *duration type*.

## Making it visible

By default Open Planner Studio keeps duration and units and lets the work follow — exactly how the app has always scheduled. The work rule and the remaining work are then hidden.

- **Setting**: turn on *Show work rules and work* under Settings → Planning → Calculation (⚙, the Settings tab or Backstage → Settings). The work rule then appears in the properties panel and the task dialog, the *Work (rem.)* column in the assignment table, and the *Work rule* and *Remaining work* columns in the grid's column picker.
- **Automatic**: when you open a file that already contains task types (an `.mpp`, MSPDI, P6 or XER file with task types, or a work rule set earlier in this app), those controls are shown for that document regardless of the setting. If the file carries stored work per assignment or a work rule of its own, the app tells you once, with a link to this guide; a work rule that only follows from the MS Project or P6 task type is shown silently.

## The four work rules

- **Fixed duration and units** (default; MS Project *Fixed Duration*, not effort-driven; P6 *Fixed Duration & Units/Time*): duration and units stay, work follows. Adding a resource does not change the duration.
- **Fixed duration and work** (P6 *Fixed Duration & Units*): duration and work stay, units follow. A second resource shares the work and lowers everyone's units.
- **Fixed work** (MS Project *Fixed Work*; P6 *Fixed Units*): the work stays. More units, or an extra resource, shortens the task; removing a resource lengthens it.
- **Fixed units** (MS Project *Fixed Units*, effort-driven; P6 *Fixed Units/Time*): the units stay. More work lengthens the task; an extra resource shares the work and shortens it.

Switching the rule alone changes no number. Below the list the panel says in plain words what the chosen rule protects, and in the assignment table the protected column carries a lock.

## Entering work

In the assignment table the *Work (rem.)* column shows the remaining work in hours: stored work from the file, or otherwise remaining duration × units. Type a new number and the work rule decides what moves: under *Fixed work* or *Fixed units* the task gets longer or shorter (the schedule is then stale until you recalculate), under the two fixed-duration rules the units change. Material resources never drive the duration.

Work from P6 or MS Project can differ from units × duration, for example when a resource in P6 is on the task for only part of it. Such a work cell gets an orange warning sign; point at it to see both numbers. The histogram follows the stored work, spread over the whole task duration; the units stay as the file gave them. A span of its own per assignment (work only in that part of the task) comes in a later version.

In the grid the *Work rule* (list) and *Remaining work* (`name: hours; name: hours`) columns work the same way, also when pasting across several tasks.

## Good to know

- The rule works on the **remaining** part of a started task: actual duration and actual work never move.
- A day task keeps whole days: if work ÷ units yields half a day, the duration is rounded up and the work stays exact.
- Adding or removing a resource, also via *Move to…* or deleting a resource, follows the same rule.
- When the work rule changes the duration (after different units, different work, or adding or removing a resource), that counts as an ordinary duration change. A pause that levelling had put into the task is dropped; level again afterwards. For a task in hours that has not started yet, *Scheduled finish* moves along: the start plus the new duration on the task's calendar.
- A **different calendar** (for the task, for the project, or different hours per day inside the calendar) changes the working hours per day; the work rule then decides. Under *Fixed work* and *Fixed units* a task gets longer when people work fewer hours per day (32 hours at 6 hours per day = 6 days). Under *Fixed duration and work* the units rise. Under the default rule nothing changes from before: duration and units stay, work follows. When a project or calendar change alters task durations, the app tells you how many.
- A **duration change on a started task** keeps the completed part (every progress entry records the remaining duration): what you add to or take from the duration goes to the remaining duration (never below zero). The percent complete is then recomputed as completed divided by the new duration, so the progress bar and the remaining duration agree. The same happens when a calendar change alters the duration of a started task.
- The MS Project *effort-driven* flag only counts on a task that came from an MS Project file; there "not filled in" literally means *not effort-driven*. On a task from P6 or from Open Planner Studio itself the flag plays no part. This is an **editing rule**: it only decides what moves along when you change duration, units or work, or add a resource. Calculating the schedule (F5) never reads it, and it is separate from the scheduling profile.
- Every edit is one undo step.
- In the **task dialog** the work rule, work and assignments apply at once, so they calculate with each other inside the dialog. *Cancel* rolls them back; *Save* is one undo step together with the rest of the dialog.
- The project default work rule (for tasks without their own choice) can be set through the AI assistant; a UI for it will follow.
- Milestones, summary tasks, hammocks and elapsed-time tasks have no work rule; in the grid the *Work rule* column stays empty for milestones, summary tasks and hammocks.
