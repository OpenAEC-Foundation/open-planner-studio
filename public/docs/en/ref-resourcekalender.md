# Resource calendar

The **Resource calendar** window edits the own calendar of a single resource — for example a crew that works four days a week. The form is identical to the [calendar dialog](docs://ref-kalenderdialoog); this article only describes the differences.

## Opening

- Open the resource panel: **Resources** → ribbon group **Manage** → **Resources** (full panel) or **Resource dock** (docked next to the Gantt).
- In a resource's **Calendar** column, pick a calendar and click the pencil icon (**Edit…**) next to it to edit it; create a new calendar via the same dropdown.

## Differences from the calendar dialog

- **One calendar at a time** — no library list on the left, no project-default star; just the form.
- **Apply** saves the calendar; **Cancel**, **Esc**, the close cross or a click outside the window discards the changes. A new calendar made with **+ Resource calendar** in the dropdown only exists after **Apply** and is then linked to the resource straight away (together one step for Undo); after **Cancel** nothing is left behind. It starts from the same default as **+** in the calendar dialog.
- **No automatic recalculation** — **Apply** does not recalculate the schedule. In its role as a resource calendar, a calendar does not change the CPM dates; it counts towards the load (histogram) and leveling, which you rerun yourself with F5 or **Level…** respectively. The dropdown does offer every calendar of the project, though: if you edit a calendar here that is also the project calendar or a task calendar, the schedule does change. It is then marked as out of date and F5 recalculates it.

## Fields

See the [calendar dialog](docs://ref-kalenderdialoog) for the full field reference: **Name**, **Work days** (with the Mon–Fri and Continuous (24/7) presets), **Start** / **End** in 24-hour HH:MM, read-only **Net hours per day**, **Break starts** / **Break duration**, the **Working times** section (with hour planning on), **Generate holidays…** and the **Holidays** list.

## Further reading

- [Calendars & hour planning](docs://gids-kalenders-uren) — when a resource calendar is the right choice.
- [Resources, histogram & leveling](docs://gids-resources-histogram) — how the calendar feeds into load and leveling.
