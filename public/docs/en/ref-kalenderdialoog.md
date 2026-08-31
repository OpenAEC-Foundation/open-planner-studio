# Calendar dialog

The **Calendars** window manages the project's calendar library: the list of all calendars on the left, the edit form of the selected calendar on the right.

## Opening

- **Planning** → ribbon group **Calendar** → the **Calendar** or **Holidays** button.
- **Settings** (ribbon tab) → ribbon group **Calendar** → **Calendar**.
- From the project wizard: choosing **Custom…** as the calendar opens this window after creation.

## Applying and cancelling

All edits — including new/duplicate/delete — happen in a working copy. **Apply** (or **Enter**) writes everything at once and recalculates the schedule; **Cancel**, **Esc**, the close cross or a click outside the window discards all changes.

## Library (left column)

- **List** — all calendars; the star marks the **Project calendar** (the default for tasks without their own calendar).
- **+** — **New calendar**.
- **Duplicate** — copy of the selected calendar.
- **Delete** — not possible for the last calendar; deleting the project default makes another calendar the default.
- **Set as project default** — makes the selected calendar the project calendar (button above the form).

## Form (right column)

- **Name** — free name.
- **Work days** — buttons **Mon** through **Sun**; on = working day. Presets: **Mon–Fri** (standard week, 07–16 h, 8 h/day) and **Continuous (24/7)**.
- **Start** / **End** — the day-wide working time in 24-hour `HH:MM`, including quarter-hour step buttons and Arrow Up/Down. Start defaults to 07:00 and End to 16:00; End can be 24:00. A complete valid value is committed on Enter or leaving the field, so unfinished text never changes the calendar. These controls are hidden once manually entered working-time bands are authoritative.
- **Net hours per day** — always a read-only, two-decimal `h` value derived from Start, End, Break starts and Break duration. It does not become editable when hour planning is off.
- **Break starts** / **Break duration (minutes)** — the simple pattern for a scalar calendar. Break starts uses the same 24-hour `HH:MM` field and quarter-hour controls, and defaults to 12:00. Duration determines the derived net hours and work bands. Duration 0 means no break. The dialog refuses invalid text, an inverted day, or a break outside the working day or one that consumes it all.

## Working times (only with hour planning enabled)

- **Net hours per day** — the same read-only two-decimal `h` readout, derived from the authoritative bands.
- Presets: **Day shift**, **2 shifts**, **3 shifts**, **Night shift**, **24/7** — each sets the working-time bands in one go.
- **Save as preset…** — save the current working times as your own preset (on this device); own presets appear as buttons with a delete cross.
- **Set per weekday…** / **Show/hide working times** — opens or collapses the band editor.
- **Band editor** — per weekday a list of time bands (start–end), each with a **next day** checkbox (night shift across midnight), **Add band** (a gap between two bands is a break), **Copy to all workdays**, the hour total per day and the derived hours/day at the bottom. See [Calendars & hour planning](docs://gids-kalenders-uren).

## Generate holidays…

Generates the holiday list rule-based across the project period:

- **Country** — Netherlands, Germany, Belgium, France, United Kingdom, Austria, Switzerland or **No holidays**.
- **Region** — only for countries with regional sets; default **National**.
- **Construction holiday** — Netherlands only: **None**, **North**, **Central** or **South**; with a hint that these are advisory dates.
- **Preview** — summary line ("n holidays, year–year"), expandable to the full list.
- **Generate** replaces the holiday list; **Cancel** closes the block.
- If the project now runs beyond the generated years, a hint appears at the top with a **Regenerate** button.

## Holidays

The list itself: per row **Description**, **From**, **Until** and a remove button; **Add holiday** creates a new row. Multi-day periods (construction holiday, frost delay) are simply a row with a longer From–Until span.
