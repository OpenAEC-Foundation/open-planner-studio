# Saving and loading layouts

A layout is a saved view configuration: the columns, grouping, sorting, filter and time scale in one package. Layouts are app-global (on this device) — they do not belong to a single project file, so you can use them in any document.

## Opening

**View** → ribbon group **Layout**. It holds a picker with your layouts and three buttons:

- **Save as…** and **Manage…** — both open the **Manage layouts** window (below).
- **Update** — overwrites the layout chosen in the picker with the current view; disabled while **(none)** is selected.

Choosing a layout in the picker applies it immediately.

## The Manage layouts window

Without saved layouts the window shows "No saved layouts yet." Otherwise, one row per layout with:

- **Name** — editable directly in the row (rename).
- **Apply** (check mark) — asks for confirmation first: "Apply layout …? This replaces the current columns/grouping/sorting/filter/scale."
- **Update** — overwrites the layout with the current view, without confirmation.
- **Delete** (trash icon) — asks for confirmation first.

The confirmations appear as a small in-app dialog; **Esc** or **Cancel** aborts.

## Save layout as…

At the bottom of the window: type a **Name** and click **Save** — the current view is stored as a new layout and becomes the active one. Without a name the layout gets the default name "Name".

## What a layout captures

- Columns (visibility, order, width) — see [Choosing columns](docs://ref-kolommen).
- Grouping and sorting (**View** → **Group…** / **Sort…**).
- The filter — see [Filters](docs://ref-filters).
- The Gantt time scale.

Not included: zoom-level details, panel widths and selections.
