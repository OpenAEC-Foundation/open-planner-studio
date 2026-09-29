# Moving a project

Goal: shift the whole schedule to a new start date, and see beforehand what that does to the finish.

## When you need this

The start of the work moves: the permit comes later, or you reuse the schedule of an earlier house for the next one. Moving every task one by one is a lot of work. With **Move project** you enter one new start date and the app shifts everything along.

The project finish does not always move by the same amount as the start. The **calendar** does not move along: holidays, construction break and winter stop sit on fixed dates. An example with the calendar *Bouwkalender NL*: a schedule of 30 work days starts on 29 September 2026 and finishes on 9 November 2026. If you move it to 14 December 2026, 76 calendar days later, it finishes on 26 January 2027. That is 78 days later, because 25 December and 1 January are now days off within your schedule. The duration stays 30 work days. The preview in the window shows this before you change anything.

## Steps

1. Choose *Planning › Schedule › Move project…*. The button is disabled as long as the project has no start date.
2. Under *Current project start* see where the project starts now, and under *New project start* choose the new date.
3. If the project has baselines, the box *Shift baselines too* appears. Leave it off if you want to keep seeing the shift as variance (see the pitfalls).
4. Click *Calculate preview*. The app calculates the shifted schedule in full, without changing anything in your project.
5. Look at the preview (see below). If it is right, click *Move*.

In the preview you see:

- the shift in calendar days (*Shift: 76 calendar days later*);
- *Project start* and *Project finish*, from before to after;
- a red warning if the calendar interferes, or the message that the project duration stays the same;
- the number of shifted tasks and what else shifts along;
- warnings you should read (see the pitfalls).

The app calculates the new schedule straight away, so you do not need to use **Calculate** (F5), and fits the view to the whole project. The whole thing is one step for *Undo* (Ctrl+Z).

The *Move* button only works after a preview without an error, and if the new date differs from the current one. If you change the date or the box, the preview disappears and you calculate again.

### What shifts along, and what does not

What shifts: the start and finish of every task, the actual start and actual finish, the dates of constraints (also of a hard Mandatory pin), deadlines, the status date, the anchors of external relations and the availability steps of resources. The project start and, if you have filled it in, the project end date shift too.

What does not shift:

- the calendars, so holidays, construction break and winter stop;
- baselines, unless you turn on *Shift baselines too*;
- a filled-in custom field of the type *Date*.

## Pitfalls and what the app does

**The finish moves by a different number of days.** If the preview sees that the finish moves by more or fewer calendar days than the start, or that the project duration in work days changes, it shows a red warning with the numbers. You can then still cancel.

**Baselines stay in place.** A baseline exists to measure variance. If you move the project with the box off, you see the shift as variance from the baseline. If you turn the box on, the baselines shift along with the schedule. Only their dates shift; the date on which the baseline was saved does not.

**A running project.** Actual dates shift along. In a project where you have already entered progress, that is not always what you want. The app warns: *Check whether that is correct for a running project.*

**External relations.** The anchor in your own project shifts along, the source project does not. Refresh the links after moving with *Home › Tasks › Link ▾ › Refresh all external relations*.

**Holidays that do not reach far enough.** A calendar with generated holidays covers a number of years. If the moved schedule runs past that, the app calculates that year without holidays. The preview warns about it, for example: *The generated holidays of calendar “Bouwkalender NL” cover 2025–2028; the shifted schedule runs to 2029. Regenerate the holidays.* Move the project first. Then open *Planning › Calendar › Calendar*: next to the holidays it now says *Regenerate*. Confirm with *Apply* and the app recalculates. The range of the new holidays follows the project start, so regenerating before the move does not help.

**The date is in the past.** That is allowed, but the preview mentions it: *The new start date is in the past.*

**Changing the project start in Project info is something else.** If you change the start date in *Settings › Project › Project info* and choose *Apply*, the schedule does not move. Only tasks without a predecessor or constraint that would then lie before the new start shift to that date, and the app tells you how many. If you want to shift everything, use *Move project…*.

## See also

- [Critical path and float](docs://uitleg-kritiek-pad): how the schedule calculates and why the finish moves.
- [Adding relations](docs://howto-relaties-leggen): relations simply stay in place when you move.
