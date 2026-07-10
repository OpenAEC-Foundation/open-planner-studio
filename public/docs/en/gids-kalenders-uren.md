# Calendars & hour planning

A task with a duration of "5 days" only means something in combination with a calendar: which days are working days, which hours is work done, and which days fall away because of a holiday or a temporary closure? This guide covers the project calendar, resource calendars, and the optional hour planning for anyone who wants to schedule down to the hour.

## What you'll learn here

- Setting up the project calendar: work days, working times, holidays.
- Generating holidays automatically per year, including the construction holiday.
- Adding a one-off, ad-hoc closure (for example a frost stop).
- Giving a resource its own calendar, for example for a 4-day work week.
- Turning on the **Hour planning** main switch and setting up working-time bands/shifts.
- How day-based and hour-based tasks coexist in the same schedule.

Follow along with [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) (frost stop, 4-day resource calendar) and with [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) (hour planning for rebar and pour work), both also available via **File → Examples**.

## The project calendar

Calendars are managed in the **Calendars** window, opened via the **Calendar** ribbon group on the **Planning** tab (both the **Calendar** and **Holidays** buttons open the same window). This window shows a library of every calendar in the project on the left — not just the project calendar, but also any resource calendars (see below) — with a star marking whichever calendar is currently the **Project calendar**. Select a calendar on the left and edit it on the right; use **Set as project default** to make a different calendar from the list the new project calendar. For the selected calendar you set:

- **Work days** — which of the seven weekdays (Mon through Sun) count as a work day. Monday through Friday by default.
- **Work hours** — **Start (hour)**, **End (hour)** and the resulting **Hours per day**.
- **Holidays** — a list of days off, each with a **Description** and a **From**/**Until** date.

Changes to the project calendar take effect immediately in the calculation: tasks that would otherwise fall on a now-non-working day shift to the next work day.

### Generating holidays automatically

Instead of typing holidays in one by one, you can generate them automatically via **Generate holidays…** in the calendar window. Choose a **Country** (Netherlands, Germany, Belgium, France, United Kingdom, Austria, Switzerland) and optionally a **Region**. For the Netherlands there's also a specific construction option: **Construction holiday**, with the choice of **North**, **Central** or **South** (or **None**). The generated construction-holiday dates are advisory dates — the app warns about this itself: verify the exact dates with Bouwend Nederland for the current year. After picking country/region, the window shows a preview — for example "12 holidays, 1-1-2026–31-12-2026" — before you click **Generate**.

If you generate holidays for a project that spans a year boundary or is later extended, Open Planner Studio recognises that the already-generated holidays no longer cover the full project period and the window offers **Regenerate** to add the missing years — without losing any holidays you added manually earlier.

### Ad-hoc closures (for example a frost stop)

Not every interruption of work is a yearly recurring holiday. For one-off, project-specific closures — a week of frost stop, a local event closure — you simply add an extra row manually via **Add holiday** in the same list: give it a **Description** (for example "Frost stop") and a **From**/**Until** period. Such an ad-hoc closure works technically identically to a generated holiday — the CPM calculation takes it into account just the same — but is separate from the automatic yearly generation, so a subsequent **Regenerate** won't overwrite it.

See a frost-stop period in practice in the [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) example: the shared foundation of the six houses includes a frost-stop period added as a separate holiday-like entry on the calendar, apart from the automatically generated Dutch holidays.

## Resource calendars

Besides the one project calendar, every resource can get its own calendar — for example for a subcontractor who's only available four days a week, while the rest of the project runs five days. Resource calendars are managed via the **Calendar** field on the resource (with the **Edit…** button next to it) or the **Resource calendar** window title; by default a resource is set to **Project calendar**.

A resource calendar uses the same form as the project calendar (**Work days**, **Work hours**, **Holidays**), but is purely informational for the resource: it changes nothing about the task's own CPM dates. What it does affect is the **load** (histogram) and **levelling**: if a resource is set to a 4-day week while the task it's assigned to runs 5 work days, the resource load shows a shortfall on the fifth day, and the levelling window (**Level resources**) warns that the resource doesn't work on all the days the task needs — shifting within the float won't automatically resolve that calendar mismatch.

See a 4-day resource calendar in practice: the installers in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) run on their own calendar with a shortened work week, while the rest of the project keeps running on the normal project calendar.

## Hour planning: the main switch

By default, Open Planner Studio works entirely at **day granularity** — every task has a duration in whole (work) days. For tasks you'd rather plan by the hour (think of a pour that starts at 7:00 and must be done by 14:00, well before the weather turns), there's the optional **Hour planning**.

Turn on the main switch via **Settings → Timeline / Zoom → Enable hour planning**. This adds an hour timescale, shifts with working-time bands, and hour-precise task bars; with the switch off, the app works entirely as before, at day granularity. There's also an option **Allow mixed day/hour planning**, which you turn on if you want to combine both day-based and hour-based tasks in the same project (see below).

## Working-time bands and shifts

With hour planning on, the calendar gets an extra layer: instead of just "work day yes/no", you set **working-time bands** per day (the **Working times** section in the calendar window) — the exact time slots during which work happens. A gap between two bands automatically becomes a break; to schedule a break, simply adjust the times of the adjacent bands so a gap appears.

So you don't have to draw bands by hand every time, there are ready-made **shift presets**:

- **Day shift** — regular office hours, one band per day.
- **2 shifts** — two consecutive shifts.
- **3 shifts** — three consecutive shifts, covering almost the entire day.
- **Night shift** — a shift that runs past midnight.
- **24/7** — continuous operation, no interruption.

Besides these presets, you can also **Set per weekday…** the bands completely by hand, for example if Friday is shorter than the rest of the week. Put together a combination of your own that you want to reuse more often? Save it with **Save as preset…** — the preset is stored locally on this device and can then be picked again in any project. The section also shows the **Derived hours/day**: the number of effective working hours that follows from the configured bands.

## Hour-based tasks

With hour planning on and a task on an **hour calendar** (a calendar with working-time bands rather than just whole days), the task edit window shows extra fields: **Duration (hours)** next to **Duration (days)**, and a total in **Total hours**. An hour calendar is required for hour input — try to enter hours on a regular day calendar, and the hint points that out.

This is exactly how pour tasks are scheduled in practice: a task "Vloer storten toren A" (Pour floor tower A) with a duration of, say, 6 hours, linked to a shift calendar that has a morning shift that day. See this pattern in the large example [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), which uses hour planning for the rebar and pour work.

## Mixing day-based and hour-based tasks

A project doesn't have to run entirely on hours to benefit from hour planning: with **Allow mixed day/hour planning** checked, day-based tasks (on the regular project calendar) and hour-based tasks (on an hour calendar) can coexist and relate to each other in the same schedule. In that case the task table shows each task's duration in its own unit — a day task in days, an hour task in hours — and warns at the bottom of the table when tasks with different hours-per-day run alongside each other, so it stays clear which comparisons are apples-to-apples and which aren't.

## Keep reading

- See a frost stop and a 4-day resource calendar in practice: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- See hour planning for rebar and pour work in practice: [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
- Relations and lag/lead work on the same calendar units — read [Relations & constraints](docs://gids-relaties-constraints) for the difference between work-day and elapsed-time lag.
