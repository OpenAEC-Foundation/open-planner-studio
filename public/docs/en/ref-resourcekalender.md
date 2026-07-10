# Resource calendar

The **Resource calendar** window edits the own calendar of a single resource — for example a crew that works four days a week. The form is identical to the [calendar dialog](docs://ref-kalenderdialoog); this article only describes the differences.

## Opening

- Open the resource panel: **Resources** → ribbon group **Manage** → **Resources** (full panel) or **Dock** (docked next to the Gantt).
- In a resource's **Calendar** column, pick a calendar and click the pencil icon (**Edit…**) next to it to edit it; create a new calendar via the same dropdown.

## Differences from the calendar dialog

- **One calendar at a time** — no library list on the left, no project-default star; just the form.
- **Apply** saves the calendar; **Cancel**, **Esc**, the close cross or a click outside the window discards the changes.
- **No automatic recalculation** — a resource calendar does not change the CPM dates; it counts towards the load (histogram) and leveling, which you rerun yourself with F5 or **Level…** respectively.

## Fields

See the [calendar dialog](docs://ref-kalenderdialoog) for the full field reference: **Name**, **Work days** (with the Mon–Fri and Continuous (24/7) presets), **Start (hour)** / **End (hour)** / **Hours per day**, the **Working times** section (with hour planning on), **Generate holidays…** and the **Holidays** list.

## Further reading

- [Calendars & hour planning](docs://gids-kalenders-uren) — when a resource calendar is the right choice.
- [Resources, histogram & leveling](docs://gids-resources-histogram) — how the calendar feeds into load and leveling.
