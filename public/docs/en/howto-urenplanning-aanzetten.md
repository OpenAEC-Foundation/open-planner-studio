# Turning on hour planning

Goal: plan tasks in working hours, alongside tasks in days.

## When you need this

You hire a crane by the hour, not by the day. A pour of six hours does not fit in a whole work day. A night crew works at different times from the day crew. For such work you want a duration in hours and a start and finish with a clock time. You also turn this on if you open a file and the app reports *This file contains hour-based planning.* Why the app counts days and hours differently, you can read in [Days and hours](docs://uitleg-dagen-en-uren).

## Steps

### Enabling hour planning

1. Choose *Settings › Project › Settings* and open the *Planning* tab.
2. Under *Hour planning*, tick *Enable hour planning*. It works right away. In the message *This file contains hour-based planning.* the *Enable hour planning* button does the same.
3. Below it is *Allow mixed day/hour planning*, on by default. With that setting you choose per task whether it counts in days or hours. If you turn it off, the *Duration unit* list disappears. You can then still type a duration with a unit, such as `12h`.

That changes more than the duration of a task: under *View › Time Scale* you can choose the scale *Hour*, the *Calendars* window gets the *Working times* block, and the *New project* window gets the choices *Shift* and *Default unit for new tasks*.

### Planning a task in hours

1. Select the task and look in the *Properties* panel, under *Time*, at the *Duration* field.
2. Type the duration with a unit and press Enter: `12h` (`12u`, the Dutch abbreviation, also works) for twelve hours, `1h 30m` for an hour and a half. `1.5h` is fine too. A number without a unit counts in the unit the task already has.
3. If you want to convert an existing task, choose the unit *Hours* under *Duration unit*. The app works out the duration for you and proposes it, for example *Exact conversion proposal: 16h. Apply it or retain the current unit.* Choose *Apply proposal* or *Retain*.
4. Back to days is possible with `2d` or with the unit *Days*.
5. Press **Calculate** (F5), for example via *Home › Schedule › Calculate*. The task now has a start and finish with a clock time.
6. If you want to see the hours in the Gantt, choose the scale *Hour* in the list under *View › Time Scale*.

### New tasks in hours by default

1. Choose *Settings › Project › Project info*.
2. Under *Default unit for new tasks*, choose the unit *Hours* and click *Apply*.

A new task then starts with 5 hours instead of 5 days. Existing tasks do not change. With a new project the same choice is in the *New project* window. If you choose *Day shift* under *Shift* there, *Hours* is disabled. Choose another shift, or set the default unit after creating in *Project info*.

## Pitfalls and what the app does then

**No valid working times.** If the task's calendar has no usable working times, the app reports *This calendar has no valid working times. Check its working days and times.* When calculating, the message *Hour task 'name' has no valid working hours in its calendar* can appear.

**No decimals with days.** A duration in days is a whole number. `1.5d` gives the message *Enter a whole number of days or hours, for example 2d or 12h.* If you want a day and a half, calculate in hours.

**A conversion that cannot be exact.** Twelve hours does not fit in whole days of 8 hours. The app then reports *This duration cannot be converted exactly to whole days on the current calendar.* and leaves the unit.

**The field is disabled.** For a phase, a hammock or a milestone with zero duration the duration follows from something else, and you cannot type it.

**Turning hour planning off again.** Tasks in hours remain and are still calculated. Their duration cannot be edited then; the field says *Enable hour planning to edit this hour task.*, with a button to turn it on again.

## See also

- [Days and hours](docs://uitleg-dagen-en-uren): how the app counts hours, what happens when days and hours meet and where it rounds.
- [Setting working times](docs://howto-werktijden-instellen): the times of a calendar per weekday.
- [Adding relations](docs://howto-relaties-leggen): a lag in hours between two tasks.
