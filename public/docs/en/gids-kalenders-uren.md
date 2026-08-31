# Calendars, working days and working hours

Open Planner Studio stores not only a number for each ordinary task, but also what that number means: **Days** or **Hours**. That choice belongs to the task. The calendar then determines where the duration fits in time. It never changes the selected unit or entered amount by itself.

This guide explains the complete model. It is for planners who want to use day tasks and hour tasks in one project without hidden conversion.

## The mental model

A **day task** counts whole workable calendar days. `2d` means two available working days. A working day containing ten hours still counts as one day; so does a day containing eight hours. Weekends, holidays and other non-working days do not count.

An **hour task** counts exact working minutes within the effective working-time bands of the task calendar. `12h` therefore consumes twelve actual working hours. On an eight-hour calendar that is one full day plus four hours. On a ten-hour calendar it is one full day plus two hours.

The central rule is:

- The task stores **what** you entered: days or hours, and how many.
- The calendar determines **when** those days or hours can be performed.
- Changing calendar must not change the unit or amount. Only the start/finish distribution may move.

## Setting up the project calendar

Open **Planning → Calendar**. The calendar library is on the left and a star marks the current project calendar. Select a calendar to edit its work days, working times and holidays. Use **Set as project default** to choose a different project calendar.

A calendar contains:

- **Work days** — weekdays on which work is possible.
- **Working times** — concrete time bands, for example 08:00–12:00 and 12:30–16:30.
- **Holidays** — non-working dates or ranges with a description.

A gap between two working-time bands is a break. A day containing only 08:00–12:00 is a partial working day. A day task counts that available day as one working day. An hour task gets only four working hours from it.

Use [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) to inspect a project with a frost stop and a different resource calendar. [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) contains activities that benefit from hour planning.

### Holidays and one-off closures

Use **Generate holidays…** to add holidays for a country, region and year. The Netherlands option can also generate advisory construction-holiday dates; always verify them with Bouwend Nederland.

Add a frost period or local closure manually with **Add holiday**. Such a date blocks both task types:

- a day task skips the holiday completely;
- an hour task cannot consume working minutes that day and continues in the next working-time band.

Regenerating adds missing years while retaining manually entered closures.

### Enabling hour planning

Open **Settings → Timeline / Zoom** and turn on **Enable hour planning**. This main switch makes hour input, hour-precise scheduling and the hour timescale available. Also turn on **Allow mixed day/hour planning** below it when you want to choose a unit per task; without that second preference the compact duration input remains visible, but the Days/Hours choice does not.

When hour planning is off, new tasks use **Days**. Existing or imported hour tasks are not converted or rounded. Their hour value remains stored. Before editing such a duration, Open Planner Studio asks you to enable hour planning.

In **Project information**, also choose **Default unit for new tasks: Days/Hours**. This is a project setting used by every manual new-task route. It does not change existing tasks. When hour planning is off, new tasks always start safely in days.

## Working-time bands and shifts

Every valid calendar supports both day and hour tasks. If a calendar has no manually entered per-weekday bands, Open Planner Studio derives them from the simple pattern. Set **Start**, **End** and **Break starts** as 24-hour HH:MM (07:00, 16:00 and 12:00 by default); each has quarter-hour arrow controls. Then set **Break duration** in minutes. For example, 07:00–16:00 with a 60-minute break starting at 12:00 becomes 07:00–12:00 and 13:00–16:00. 09:00–17:00 with a 30-minute break at 12:00 becomes 09:00–12:00 and 12:30–17:00. A duration of 0 means one continuous band, so 08:00–16:00 without a break remains 08:00–16:00. **Net hours per day** follows this pattern and is always a read-only two-decimal `h` value.

Start must precede End; the break must fit entirely within that working day and cannot consume it all. The dialog blocks Apply and explains an invalid or incomplete time instead of changing the calendar. Older calendars without the two break fields retain their existing behavior: their difference between clock span and the historic stored hours is initially interpreted as a midday gap and becomes explicit only after a scalar time is edited. The per-weekday editor and shift presets, such as **Day shift**, **2 shifts**, **3 shifts**, **Night shift** and **24/7**, always take precedence: once you set bands there, those are the source of truth. A night band can cross midnight.

**Net hours per day** helps with presentation but does not determine a task unit. Day tasks continue to count working days; an hour task uses only the effective bands. Only an empty or invalid calendar cannot schedule hours. There is no silent task, unit or calendar conversion and no rounding.

The derived **Net hours per day** helps with presentation, but it does not determine a task's unit. Without concrete bands the scheduler cannot know exactly where twelve working hours fit. If you select **Hours** for a task whose calendar has no bands, Open Planner Studio changes nothing. It explains that you must choose a calendar with working times or add them first. There is no day fallback and no rounding.

## Entering duration per task

The double-click dialog and fixed properties panel use the same control:

**Duration [value] [Days | Hours]**

Use the selector or type a suffix:

- `2d` selects **Days** and stores two working days.
- `12h` selects **Hours** and stores exactly 720 working minutes.
- `12u` remains accepted as the existing Dutch input alias and is subsequently displayed universally as `12h`.
- Without a suffix, a whole number follows the unit shown in the selector.

An explicit suffix therefore always wins and synchronises the selector. Normal manual entry uses whole days or whole hours. Minute precision already present in an import or file remains exact and is never silently rounded.

On import, Open Planner Studio preserves an explicit task unit when the source format can supply one. IFC distinguishes day and hour durations in its ISO duration. MSPDI and P6 XML files exported by Open Planner Studio carry the explicit choice with each task; foreign or older files without that marker keep the compatible calendar-precision rule. CSV duration is read as days. A coincidental whole number of day-hours never changes an explicit choice.

A genuine zero-duration milestone has no editable unit. Summary and hammock tasks also show derived duration; they do not gain a competing manual source.

The information icon beside the selector summarises the contract. It is reachable with both pointer and keyboard.

## Planning and conversion examples

**Examples with 8 and 10 hours**

Consider a task that starts on Monday:

- `2d` on an 8-hour calendar uses Monday and Tuesday: 16 actual hours.
- The same `2d` on a 10-hour calendar still uses Monday and Tuesday: 20 actual hours.
- `12h` on an 8-hour calendar uses all of Monday and another four hours on Tuesday.
- The same `12h` on a 10-hour calendar uses all of Monday and another two hours on Tuesday.

A break consumes no duration for an hour task. With bands 08:00–12:00 and 13:00–17:00, a six-hour task finishes at 15:00, not 14:00. A day task still counts that day as one available working day despite the break.

**Changing a calendar**

When you move a task to another calendar, `2d` remains exactly `2d` and `12h` remains exactly `12h`. Open Planner Studio only recalculates where that fixed amount of work fits. The finish date or time may therefore change.

This matters when moving from eight to ten hours per day. A twelve-hour task finishes earlier on the longer working days. A two-day task stays two days and instead contains more actual hours on that calendar. Neither case changes the task's identity.

**Relationships, lag and constraints in a mixed schedule**

A relationship first determines the boundary at which the successor may start or finish. The successor then consumes its own duration on its own calendar. A day task can therefore precede an hour task without conversion, and vice versa. An FS relationship from a `2d` task to a `6h` task makes the successor consume six concrete working hours after the finish boundary; the predecessor's two working days are not rewritten as six or sixteen hours.

Working-time lag and lead are applied with calendar awareness according to the relationship type. A date constraint, deadline or recorded actual date limits placement but likewise does not change the selected duration. Run **Calculate** after changing a calendar, relationship or constraint: scheduling is deliberately recalculated manually rather than reactively. If a finish is unexpected, check the relationship, lag/lead, constraint and effective task calendar in that order; the displayed `d` or `h` should remain unchanged.

**Explicit conversion without silent rounding**

The selector must never reinterpret the same number: `2d` never simply becomes `2h`. When you change unit, Open Planner Studio calculates an exact proposal from the task start on the current task calendar.

If conversion is exact in the allowed whole unit, you see the proposal before applying it. Two eight-hour working days can, for example, be proposed as `16h`.

If conversion is not exact, nothing is rounded. `12h` is one and a half working days on an eight-hour calendar and cannot be applied as a whole-day task. The old unit and value remain until you enter a new valid value yourself, such as `1d` or `2d`.

**Reading duration display**

Choose **Automatic**, **Days** or **Hours** under **Settings → Duration display**. This affects presentation only; it does not change task data.

In **Automatic**, the selected task unit is always shown: a two-day task appears as `2d` and a twelve-hour task as `12h`. Even sixteen hours on an eight-hour calendar remains `16h`; the calendar must not make the explicit choice look like a day task.

With another display forced, the native value remains recognisable in parentheses. This lets you compare values without Open Planner Studio converting the stored unit.

## Resource calendars

A resource can have its own calendar, for example for a subcontractor on a four-day week. It affects resource load and leveling, but does not automatically replace the task calendar and never changes the task unit. You can inspect this in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## Troubleshooting

**Hours cannot be selected**

First check that **Enable hour planning** is on. Then check whether the effective task calendar has valid working days, times and hours per day. Manual weekday bands are optional: without them the planner derives effective working times automatically.

**Changing calendar changes the finish date**

That is expected when work days, holidays or working-time bands differ. Check the task value: `2d` or `12h` should be unchanged. Run **Calculate** to see the new distribution.

**Conversion to days is refused**

The hour value does not exactly match a whole number of available working days from the task start. Open Planner Studio does not round. Retain hours or deliberately enter a new whole number of days.

**An imported hour task is visible while hour planning is off**

That protects the source data. Exact minutes remain stored and are not changed into days. Enable hour planning before editing the duration.

**`2d(16h)` or `16h(2d)` looks duplicated**

You selected **Days** or **Hours** as the fixed duration display. The first part follows that presentation preference; the value in parentheses shows the persistent task unit. Choose **Automatic** to see only the native value. The setting does not change the task itself.

## Keep reading

- Read [Relations & constraints](docs://gids-relaties-constraints) for calendar-aware relations and lag/lead.
- Revisit the calendar and frost-stop setup in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Inspect the four-day resource calendar in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Open [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) for hour work in a large project.
- Compare the pour and rebar activities in [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
