# Adding relations

Goal: link tasks together, so that a task starts only when the work before it is finished, and add a waiting time (lag) between them where needed.

## When you need this

Without relations the app does not know that the bricklayer can only start once the foundation has been poured. Every task then starts on the project start and the finish date means nothing. A **relation** records that order. The first task is the **predecessor**, the second the **successor**.

You add relations when you build a new schedule, when a task is added, or when it turns out two jobs have to wait for each other after all. You use a **lag** when there has to be time in between during which nobody works on those tasks, such as concrete that has to cure or a floor screed that has to dry.

The app knows four kinds of relations. You pick them by their abbreviation:

- **FS** (Finish-Start): the successor starts when the predecessor is finished. This is the default and by far the most used.
- **SS** (Start-Start): the successor starts when the predecessor starts.
- **FF** (Finish-Finish): the successor finishes when the predecessor finishes.
- **SF** (Start-Finish): the successor finishes when the predecessor starts.

## Steps

There are four ways to add a relation. They create the same relation; pick whatever suits your situation best.

### Linking two selected tasks

Useful when you work in the task list and can see both tasks.

1. In the task list, click the task that comes first: the predecessor.
2. Hold Ctrl and click the task that comes next: the successor.
3. Choose *Home › Tasks › Link ▾ › Link selected tasks*. The same button is also on *Planning › Relations*.

The app creates a Finish-Start relation without lag and reports, for example, *Relation created: Foundation brickwork → Lay hollow-core floor*. The order in which you click counts, not the order in the list: your first click becomes the predecessor.

### Drawing a relation in the Gantt

Useful when you add many relations in a row and have the bars in view.

1. Choose *Home › Tasks › Link ▾ › Draw relation*. Above the schedule the notice *Link mode: drag from one bar to another in the Gantt to create a relation. Press Esc to stop.* appears.
2. Press on the predecessor's bar and drag to the successor's bar. A dashed line with an arrow follows you.
3. Release. A small window *Relation type* appears with the type (FS by default) and a box for the lag.
4. Change the type or lag if needed and press Enter, or click outside it. The relation is created.
5. Add the next one straight away: the mode stays on. You stop with Esc, with the *Stop* button in the notice, or by choosing *Draw relation* again.

If you press Esc in the *Relation type* window, nothing is recorded. For a single relation you do not need to turn the mode on: hold Shift while you drag from bar to bar. Right-clicking a bar also offers *Start relation from here*; that turns link mode on and selects that task.

### Adding a relation in the Properties panel

Useful when you are looking at one task and want to add its predecessors or successors.

1. Select the task. The *Properties* panel is on the right; if you do not see it, turn it on with *View › Panels › Properties*.
2. In the *Dependencies* block, click *Add relation*.
3. Under direction, choose *Predecessor* or *Successor*: is the other task the predecessor or the successor of this task?
4. Type part of the other task's name. Pick the right one with the arrow keys and Enter, or click it.
5. Choose the type (FS by default) and fill in a lag if needed.
6. Press Enter or click the tick (*Create relation*).

All relations of the task are then listed in *Dependencies*, each with the other task's WBS number, the type and the lag. Clicking the WBS number takes you to that task.

### Typing relations in the predecessors column

Useful when you work fast with the keyboard and know the WBS numbers.

1. Click the **+** on the right of the task list header (*Add column*) and, under *Relations*, choose the predecessors column. The app currently shows it as *Predecessors*; the column next to it (*Successors*) works the same way for successors.
2. In that column, click the cell of the successor.
3. Type the predecessor's WBS number, a space and the type, for example `2.6 FS`. Put a lag straight after it: `2.6 FS+1d`. Separate several predecessors with a semicolon: `3.1 FS; 3.2 SS+2d`.
4. Press Enter.

If you press Enter or F2 in the cell instead of typing, an input opens in which you search for the task by WBS number or name, and choose the type and lag for each relation.

### Setting or changing a lag

You set a lag in the box next to the type: in the *Relation type* window after drawing, in the draft row in *Dependencies*, or after the type in the predecessors column. For an existing relation you change the lag in *Dependencies*: click in the lag box, type the new value and press Enter.

The app understands these notations:

- `3` or `3d`: 3 work days. A weekend does not count. The app shows `+3d`.
- `3ed`: 3 calendar days. The weekend does count, as with concrete that also cures on Saturday and Sunday.
- `-1`: a negative lag (lead). The successor may start a day earlier, so the tasks overlap.
- `4h`: 4 working hours. The app shows it as `+4u`.
- `50%`: half the predecessor's duration.

An example from the tutorials' practice project *House extension*. The foundation concrete has to cure before the bricklayer can work on it. So *Pour foundation → Foundation brickwork* gets an FS relation with lag `3`. After **Calculate** (F5) the pour is on Friday 18 June and the brickwork starts on Thursday 24 June: Monday, Tuesday and Wednesday are the waiting time. With `3ed` the weekend counts and the brickwork already starts on Tuesday 22 June.

### Finally: recalculate

A new relation does not move any bars yet. The status bar says *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*. Only then do the successors get their new dates and do you see the critical path. If you want the app to do this for you, turn on *Calculate automatically* under *Settings › Project › Settings*, tab *Planning*.

## Pitfalls and what the app does

**Reversed order.** With *Link selected tasks* your first click becomes the predecessor. If you click the later task first, the relation is the wrong way round. Delete it in *Dependencies* with the bin icon and add it again.

**A cycle.** If you add a relation that leads back to a task earlier in the chain, the schedule could never start. The app refuses such a relation and names the cycle, for example *This relation would create a cycle in the schedule (Set up site → Clear garden and paving → Set up site) and was not created.* First reverse or delete the existing relation.

**A task to its own phase.** A relation between a task and the summary task it sits under is not possible. The app says *A relation between a task and its own (grand)parent summary task is not allowed.*

**Duplicate.** If the relation already exists, the app says *That relation already exists* and nothing changes.

**Invalid input in the column.** If you type only a WBS number, such as `3.1`, the type is missing. The cell stays open with the hint *Use a value such as 1.2 FS+2d.* Add the type or press Esc to cancel.

**Half days of lag.** A lag in days is always a whole number. If you type `1.5`, the app turns it into `+2d`. If you want half a day, use hours, such as `4h`. Unreadable input, such as a word, is not saved: the box jumps back to the previous value.

**Nothing moves.** That is right: the app only calculates on **Calculate** (F5), unless *Calculate automatically* is on.

## See also

- [Critical path and float](docs://uitleg-kritiek-pad): what the app calculates from your relations, and why a task becomes critical.
- [Relations & constraints](docs://gids-relaties-constraints): the older guide on relations and constraints.
- [Planning well](docs://gids-goed-plannen): why every task should have a predecessor and a successor.
