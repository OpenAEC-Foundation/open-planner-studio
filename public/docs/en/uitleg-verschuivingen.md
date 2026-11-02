# Why a task moves

You change the duration of the brickwork and press F5. The schedule recalculates at once, and the lower right corner shows *4 tasks moved*, with *Project finish 3 working days later* below it. This article explains what that message counts, how the *Shifted tasks* list establishes the reason per task, and what *Undo* restores.

## The concept

A task has **moved** when its finish after the calculation differs from its finish before. The app counts ordinary tasks and milestones only. A summary task does not count, because its dates follow from the tasks below it.

The **reason** says what determines the finish now. It comes from the calculation itself: the app records per task what fixed its dates. If the reason is not certain, the list says *Reason not established*. We do not show a guess as a fact.

## How the app calculates

F5 and the *Calculate* button recalculate at once. You then see the message, with the buttons *Why?* and *Undo*. If nothing moved, no message appears. With *Calculate automatically* on there is no message either, because the app then recalculates after every edit.

*Why?* opens the *Shifted tasks* panel in the right column. The panel is also under *View* → *Panels*, so you can still read the list after the message has gone. Clicking a row shows the task in the Gantt.

The list uses these reasons:

- *Predecessor*: a relation determines the start. You see the name of the predecessor. If several predecessors determine the start together, the number is shown.
- *Calendar*: the start stayed the same or moved because of the calendar, and the task's calendar changed since the previous calculation.
- *Fixed date*: a constraint determines the date (see [Constraints and deadlines](docs://uitleg-constraints)).
- *Status date*: the task cannot run earlier than the status date.
- *Resource*: a leveling delay determines the start, or the duration changed through a different assignment.
- *Own duration changed*: the start stayed the same and the duration changed.
- *Own start date* and *Project start*: no predecessor determines the task.
- *Progress*: actual dates or the remaining duration determine the finish.

For *Calendar* and *Own duration changed* the app compares with the state at the previous calculation. That state comes from the list of edits. If it holds nothing, for example after opening a file, the reason cannot be established.

## Example

Task A takes 5 working days and task B follows with a finish-to-start relation. B finishes on Friday 19 June. You make A 3 working days longer and press F5. The message counts B as moved. The list shows for B: *Finish 19-06-2026 → 24-06-2026* and *Predecessor: A*.

## Consequences and misconceptions

- *Undo* in the message restores the dates from before the calculation, in one step. Your edit stays, and the schedule counts as out of date again. The button disappears as soon as you change anything else in the schedule.
- Ctrl+Z after F5 works differently: it takes back your last edit, together with the calculation after it.
- The list is a snapshot of the last calculation. Later edits do not change it.
- With leveling you see the preview beforehand, so this message is not needed there (see [How leveling works](docs://uitleg-nivelleren)).
- The reason names what determines the date now. That is not always the first cause: in a chain each task names its own predecessor. Click through the list to follow the chain.
