# Plan a task in hours

Goal: plan tasks in working hours alongside tasks in days.

## When you need this

A crane is hired by the hour, a pour takes six hours and a night crew works outside the day shift. Duration in hours is always available. The calendar determines when those hours fit.

## Steps

### Enter the duration

1. Select the task and open *Properties › Time › Duration*.
2. Type, for example, `12h` or `1h 30m` and press Enter. `u` is also accepted for hours.
3. Press **Calculate** (F5).
4. Choose *View › Time Scale › Hour* to see hours in the timeline header.

At the *Day* scale, a bar moves in whole days. At hour zoom it moves by the hour; with *Quarter-hour zoom* and sufficient zoom, by quarter-hours.

### Show the unit selector

1. Open *App settings › Appearance*.
2. Under *Duration display*, enable *Allow mixed day/hour planning*.

This shows the *Duration unit* selector. Without the selector, you can still type a duration with a unit.

### Default new tasks to hours

1. Open *Project settings*.
2. Choose *Hour measure* under *Default measure for new tasks* and click *Apply*.

New tasks get the chosen measure. The same choice is available when creating a project, alongside the shift preset. In the P6 and MSP profiles the choice is fixed on *Hour measure*. The text below the list then says so.

## Pitfalls and what the app does

**Derived duration.** You cannot type the duration of a summary, hammock or zero-duration milestone.

**Fixed work.** A task with the task type *Fixed work* always uses the hour measure. If you set a task of 3 d to *Fixed work*, it becomes 24 h: 3 × the working time per day. The finish can therefore move, as with a duration change. In the table you cannot set such a task back to days.

**Duration display in OPS.** This setting is disabled: each task shows its own unit. In the P6 and MSP profiles the choice remains available.

## See also

- [Days and hours](docs://uitleg-dagen-en-uren): the two units.
- [Set working times](docs://howto-werktijden-instellen): the calendar.
- [App settings](docs://ref-instellingen): display and quarter-hour zoom.
