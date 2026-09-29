# Tracing a path

Goal: make the chain of tasks before or after a task visible, so you can see what puts a task on its date and what moves along if it runs late.

## When you need this

The roofing only starts in three weeks and you want to know which task decides that. Or the bricklayer runs a week late and you want to see which tasks after it move along. In a schedule with dozens of relations you cannot see that from the lines. With **path tracing** the app colours all **predecessors** (tasks that come before the chosen task, directly or through other tasks) and **successors** (tasks that come after it) and dims the rest.

## Steps

1. Select the task whose path you want to see, in the task list or on its bar in the Gantt. If you select several tasks, the app traces from the first one.
2. Choose *Planning › Path tracing › Predecessors* for everything that comes before the task, or *Planning › Path tracing › Successors* for everything that comes after it. Both buttons can be on at the same time. The same two buttons are on the *Table* tab, in the *Path tracing* group.
3. If you want both directions in one go, right-click the task, in the Gantt or in the task list, and choose *Trace path*.
4. Look at the result in the Gantt and in the task list. How to read it is explained below.
5. You stop by clicking the active button again, by right-clicking a task and choosing *Stop path tracing*, or with Esc. Esc also clears the selection.

If you select another task while tracing, the path follows the new selection.

## Reading the result

- Predecessors are gold, successors purple. In the Gantt the bars change colour, in the task list a stripe appears to the left of the row: solid for predecessors, dashed for successors. The chosen task has an outline.
- A darker colour, in the task list a thicker stripe with bold text, marks the chain of **driving** relations: the relations that really determine the dates. What that means is explained in [Relations and lag](docs://uitleg-relaties).
- All tasks outside the path are dimmed. Relation lines that do not belong to the path are fainter and dotted.

## Pitfalls and what the app does

**No task selected.** Without a selected task there is nothing to trace: the button is on, but nothing changes on screen. Select a task first.

**No emphasis on the driving chain.** The emphasis comes from the last calculation. If the schedule has not been calculated yet, or the calculation gives an error, the app tints all predecessors and successors equally strongly. Press **Calculate** (F5), for example through *Home › Schedule › Calculate*, and look at the path again. After a change the emphasis stays with the previous calculation as long as the status bar says *Out of date — recalculate (F5)*.

**A relation on a phase.** Tracing follows the relations as you laid them. A relation from or to a phase (summary task) connects the phase itself. For the calculation it applies to every task in that phase, but the path does not carry on to the tasks inside it. If you trace a task inside a phase that is tied to another task by a relation on the phase itself, you therefore do not see that relation. In that case select the phase itself.

**Only the chosen direction.** If only *Predecessors* is on, you do not see what comes after the task, and the other way round.

## See also

- [Relations and lag](docs://uitleg-relaties): why a relation is driving and how the app calculates a task's start date.
- [Critical path and float](docs://uitleg-kritiek-pad): which chain decides the end of the project.
- [Adding relations](docs://howto-relaties-leggen): adding a relation if you miss a connection in the path.
