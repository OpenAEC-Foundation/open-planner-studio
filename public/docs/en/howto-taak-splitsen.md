# Splitting a task

Goal: interrupt a task, so that the work stops and carries on later, without turning it into two tasks.

## When you need this

Laying the reinforcement takes eight work days, but after four days the crane has to go to another job and the work carries on two days later. Making two separate tasks means keeping your relations and assignments twice. With a **break** it stays one task, with one bar that has a gap. The app also calls the break a *pause*.

The work stays the same length, but the task now lasts longer on the calendar. An example: a task of 8 work days that starts on Tuesday 29 September 2026 finishes on Thursday 8 October. If you put a break of 2 work days after 4 work days, it finishes on Monday 12 October. The duration stays 8 work days, only the finish moves two work days.

## Steps

### Splitting in the Gantt

1. Choose *Home › Tasks › Split task* (or *Planning › Relations › Split task*). Above the schedule the notice *Click a bar on the day the break starts and drag right for its length. Press Esc to stop.* appears. The button is also on the *Table* tab (*Table › Tasks › Split task*), but it is disabled there.
2. Move the mouse over the bar. A dashed line and a label with the date show where the break would start. Press on the bar, on the day the break starts.
3. Drag to the right. The label shows the length, for example *2 workdays break*: the distance in work days to the day under your mouse. Release.

If you just click, without dragging, the pause becomes one work day. Dragging back to the left makes the pause shorter again, down to a minimum of one work day. For a task in hours, it works in hours.

The mode stays on, so you can split more tasks. You stop with Esc or with the *Stop* button in the notice. If you press Esc while dragging, the app reverses the pause and the mode stops. Each gesture is one step for *Undo*.

After a split the schedule is out of date. Press **Calculate** (F5) for the final dates.

### Dragging an existing break in the Gantt

This works without split mode, directly on a bar that has a break.

- Drag the piece **after** the pause to the right or left. The pause becomes longer or shorter, with the label *3 workdays break*. If you drag it back until the pause is 0, the label shows *Merge* and the two pieces are one again.
- Drag the right edge of the piece **before** the pause. That piece becomes longer or shorter, with the label *Piece: 5 workdays*. The duration of the task changes with it.
- If you drag the first piece, you move the whole task, as with any bar.

### Splitting and adjusting in the Properties panel

Select the task. In the *Properties* panel the *Breaks* block is under *Dependencies* and above *Assignments*. Scroll to it if needed.

- *Add break* puts a pause of one work day halfway through the longest piece.
- Each pause has two boxes: *after* (how many work days of work come before the pause) and *pause* (the length of the pause). Next to them are the dates of the piece after the pause. For an hour task they show hours.
- If you set *pause* to 0, the break disappears. The small bin (*Remove break*) does the same.

Be careful with *after*: that box lengthens or shortens the piece of work before the pause, and with it the duration of the whole task. With *pause* only the finish changes.

### Removing a break

Right-click the break in the Gantt, or the piece after it, and choose *Remove break*. *Remove all breaks* is in the right-click menu of every bar that has a break. Or use the *Breaks* block in the *Properties* panel, as above.

## Pitfalls and what the app does

**Not every task can be split.** You cannot split a milestone, a summary task, a task with *Hammock (derived duration)* on (see [Creating a hammock](docs://howto-hammock)), a task with duration type *Elapsed time*, a task that is *Manually scheduled*, or a task shorter than two work days. In split mode the mouse shows a not-allowed cursor and nothing happens. For such a task the *Breaks* block is also missing in *Properties*.

**On the Table tab the button does not work.** *Split task* is disabled there, with the tooltip *Only available when the Gantt chart is visible*. The gesture needs a bar. Split mode and link mode switch each other off.

**A click with no effect.** A break cannot start on the first day of the task and not inside an existing pause. Each piece of work must also stay at least one work day long. If you click such a place, nothing happens, without a message.

**A task with progress.** If the task has progress, a break can only start after the work that is already done. At 50% of 8 work days that is the fifth work day at the earliest. A click in the done part does nothing, and a task that is 100% complete can no longer be split. In the panel *Add break* is then disabled: that also applies if the middle of the longest piece falls in done work, for example at 75% of 8 work days.

**Leveling also creates breaks.** They show in the *Breaks* block with the label *leveling*. *Resources › Leveling › Clear leveling* removes them again. If you edit the breaks of such a task yourself, all its leveling pauses become yours and *Clear leveling* no longer removes them.

**Breaks do not travel to MS Project or Primavera.** If you export to *MS Project XML* or *Primavera P6 XML*, that program knows a break only as a work distribution of an assignment. Without such a distribution the task arrives without a break, and the app reports how many tasks that is: *1 task with breaks was exported without its breaks: MS Project/P6 only know breaks as a work distribution.* In the app's IFC file they are kept.

**A file with breaks the app cannot edit.** Breaks from a source file that do not fit the app's form show the message *These breaks come from the source file in a form that cannot be edited here* in the panel, with only *Remove all breaks*.

## See also

- [Critical path and float](docs://uitleg-kritiek-pad): how the schedule counts in work days and why the finish moves.
- [Adding relations](docs://howto-relaties-leggen): another mode in the Gantt, which you use with a bar drag.
- [Task dialog and properties panel](docs://ref-taak-eigenschappen): the Breaks section in the properties panel.
