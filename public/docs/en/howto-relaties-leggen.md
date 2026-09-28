# Adding relations

Goal: link tasks together, so that a task starts only when the work before it is finished, and add a waiting time (lag) between them where needed.

## When you need this

Without relations the app does not know that the bricklayer can only start once the foundation has been poured. Every task then starts on the project start and the finish date means nothing. A **relation** records that order. The first task is the **predecessor**, the second the **successor**.

You add relations when you build a schedule, when a task is added, or when two jobs turn out to depend on each other after all. A **lag** is waiting time between two tasks, such as concrete that has to cure or a floor screed that has to dry.

The default relation is **FS** (Finish-Start): the successor can only start once the predecessor is finished. The app also knows SS, FF and SF, which tie a start or finish to a start or finish; with SS (Start-Start), for example, the plastering can only start once the building services have started.

## Steps

There are four ways to add a relation. They create the same relation; pick whatever suits your situation best.

### Linking two selected tasks

Useful when you work in the task list.

1. In the task list, click the task that comes first: the predecessor.
2. Hold Ctrl (⌘ on a Mac) and click the task that comes next: the successor.
3. Choose *Home › Tasks › Link ▾ › Link selected tasks*. The same button is also on *Planning › Relations*.

The app creates a Finish-Start relation without lag and reports, for example, *Relation created: Foundation brickwork → Lay hollow-core floor*. The button only works with exactly two selected tasks.

### Drawing a relation in the Gantt

Useful when you add many relations in a row.

1. Choose *Home › Tasks › Link ▾ › Draw relation*. Above the schedule the notice *Link mode: drag from one bar to another in the Gantt to create a relation. Press Esc to stop.* appears.
2. Press on the predecessor's bar and drag to the successor's bar. A dashed line with an arrow follows you.
3. Release. A small window *Relation type* appears with the type (FS by default) and a box for the lag.
4. Change the type or lag if needed and press Enter, or click outside it. The relation is created.
5. Add the next one straight away: the mode stays on. You stop with Esc, with the *Stop* button in the notice, or by choosing *Draw relation* again.

If you press Esc in the *Relation type* window, nothing is recorded. For a single relation you do not need to turn the mode on: hold Shift while you drag from bar to bar. *Start relation from here* in a bar's right-click menu turns link mode on; you still do the dragging yourself. On the *Table* tab, without a Gantt, *Draw relation* is disabled.

### Adding a relation in the Properties panel

Useful when you are looking at one task and want to add its predecessors or successors.

1. Select the task. The *Properties* panel is on the right; if you do not see it, turn it on with *View › Panels › Properties*.
2. In the *Dependencies* block, click *Add relation*.
3. Leave the direction on *Predecessor* if the other task comes first, or choose *Successor*.
4. Type part of the other task's name. Pick the right one with the arrow keys and Enter, or click it.
5. Choose the type (FS by default) and fill in a lag if needed.
6. Press Enter or click the tick (*Create relation*).

The task's relations are then listed in *Dependencies*, each with the other task's WBS number, the type and the lag.

### Typing relations in the Predecessors column

Useful when you work fast with the keyboard and know the WBS numbers.

1. Click the **+** on the right of the task list header (*Add column*) and, under *Relations*, choose the *Predecessors* column. The *Successors* column works the same way.
2. In the *Predecessors* column, click the cell of the successor.
3. Type the predecessor's WBS number, a space and the type, for example `2.6 FS`. Put a lag straight after it: `2.6 FS+1d`. Separate several predecessors with a semicolon or comma: `3.1 FS; 3.2 SS+2d`.
4. Press Enter.

What you type replaces the whole cell. If there are predecessors in it already, type them too (see the pitfalls). If you press Enter or F2 in the cell instead of typing, an input opens that keeps the existing relations: you search for a task by WBS number or name, and choose the type and lag for each relation.

### Setting or changing a lag

You type a lag in the box next to the type, with each of the ways above. You change an existing lag in *Dependencies*: click in the lag box, type the new value and press Enter.

- `3` or `3d`: 3 work days. A weekend does not count. The app shows `+3d`.
- `3ed`: 3 calendar days. The weekend does count, as with concrete that also cures on Saturday and Sunday.
- `-1`: a negative lag (lead). The successor may start a day earlier, so the tasks overlap.
- `4h`: 4 working hours; the app shows it as `+4u`. Between two tasks scheduled in days, the app rounds this up to whole work days: `4h` then acts as 1 day.
- `50%`: half the predecessor's duration.

Example: the foundation concrete has to cure before the bricklayer can work on it, so *Pour foundation → Foundation brickwork* gets an FS relation with lag `3`. If the pour is on Friday 18 June 2027, the brickwork starts after **Calculate** on Thursday 24 June: Monday to Wednesday is waiting time. With `3ed` the weekend counts and the brickwork starts on Tuesday 22 June.

### Finally: recalculate

A new relation does not move any bars yet; the status bar says *Out of date — recalculate (F5)*. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*. Only then do the successors get their new dates. If you want the app to do this for you, turn on *Calculate automatically* under *Settings › Project › Settings*, tab *Planning*.

## Pitfalls and what the app does

**Reversed order.** With *Link selected tasks* the order in which you click counts, not the order in the list. If you click the later task first, the relation is the wrong way round. Delete it in *Dependencies* with the bin icon and add it again.

**Typing in the column wipes what was there.** If the cell holds `3.4 FS; 3.2 FS` and you type only `3.2 FS`, the relation with 3.4 is gone, without a message. Type all predecessors, use Enter or F2 to add to them, or undo with Ctrl+Z.

**A cycle.** If you add a relation that leads back to a task earlier in the chain, the schedule could never start. The app refuses such a relation: *This relation would create a cycle in the schedule (…) and was not created*, with the tasks of the cycle in brackets. First delete the relation that closes the cycle.

**A task to its own phase.** A relation between a task and the summary task it sits under is not possible. The app says *A relation between a task and its own (grand)parent summary task is not allowed.*

**Duplicate.** If the relation already exists, the app says *That relation already exists* and nothing changes.

**Shorter messages in the column.** The *Predecessors* column gives the same refusals with a shorter text under the cell: *This change would create a cycle in the schedule.*, *This relationship already exists.* or *A task cannot have a relationship with its own summary task.* If you type only a WBS number, such as `3.1`, the type is missing and the cell says *Use a value such as 1.2 FS+2d.* The cell stays open; correct the input or press Esc to cancel.

**No half days of lag.** A lag in days is always a whole number: `1.5` becomes `+2d`, and an hour lag between day tasks counts as a whole work day. Unreadable input, such as a word, is not saved: the box jumps back to the previous value.

## See also

- [Critical path and float](docs://uitleg-kritiek-pad): what the app calculates from your relations, and why a task becomes critical.
- [Planning well](docs://gids-goed-plannen): why every task should have a predecessor and a successor.
