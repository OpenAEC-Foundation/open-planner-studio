# Layouts

A layout is a stored view: columns, filter, grouping, sorting, time scale and overlays (such as relationship lines and the baseline) — or only some of those. Every layout is its own button on the ribbon, with an icon and a name. Layouts are app-global (on this device): they do not belong to one project file and can be used in every document.

## The layout buttons

**View** → ribbon group **Layout**. There is one button per layout, and last the plus button **New layout**.

- **One click** switches the layout on. The button turns orange for as long as the layout is really on screen.
- **Another click** on the same button switches it off. The view goes back to how it was before you clicked a layout button.
- A layout only changes the parts it stores. The rest of your view stays as it is. If you zoom yourself while a layout is on, and that layout does not store the time scale, your zoom also stays after switching it off.
- Buttons that store different parts can be on at the same time, for example the resource diagram together with a filter button. A button that stores the same part as a button that is already on replaces that other one.
- If you change the filter, the grouping, the sorting or an overlay by hand while the layout stores it, the button switches off. The other parts of that layout then go back to how they were before you switched the button on; only what you changed yourself stays. That way you are never left with a half view that is neither the layout nor your old view.
- Zooming or dragging a column width also switches the button off, but leaves the rest of your view as it is.
- Switching on and switching off are each one step for **Undo**.

## The built-in Resource diagram layout

**Resource diagram** groups the Gantt by resource, sorts by start within each resource and hides the relationship lines — the same picture as the Resource diagram print report (**Report** tab), but on screen. Useful in a meeting: one click to see per person or crew who does what, one click back. Your zoom, your columns and your filter stay as they are. A task with several resources appears under each of them.

Want to see each resource type first (labor, crew, equipment, …) and each resource below it, like the option in the report? Make your own layout with two grouping levels: first **Resource type**, then **Resource**. Under each type you then see only the resources of that type. You can also sort by **Resource type**.

The built-in layout cannot be changed or deleted. If you want your own variant, duplicate it via right-click.

## Making a new layout

Click the plus button **New layout**. In the window:

- **Name** and **Icon** — how you recognise the button on the ribbon.
- **What does this layout store?** — six parts, each with a tick box. Only ticked parts change when you click the button. The i behind each part explains what it stores.
- Under a ticked part you set it right there: the filter rules, the grouping levels, the sorting levels and the time scale. Under **Overlay** you choose what is drawn over the bars: relationship lines, baseline, progress line, status date line, resource accent and float band, and which bar colors the Gantt uses. For **Columns** the layout takes over the columns as they are in the table now; you choose columns with the plus in the table header — see [Choosing columns](docs://ref-kolommen).
- **Take over the current view** fills all parts with what is on screen right now. The window also starts that way.

There are three buttons at the bottom. **Save** makes the layout button; the screen only changes when you click that button. **Apply without saving** puts the ticked parts on screen without making a button — for a quick, temporary filter. **Cancel** closes without doing anything.

## Editing, duplicating and deleting

Right-click a layout button: **Edit…** opens the same window with the stored settings, **Duplicate** makes a copy, **Delete** asks for confirmation first.

## Saved filters from earlier versions

Filters you saved in an earlier version now sit on the ribbon as layout buttons with a filter icon. Such a button stores only the filter and leaves the rest of your view alone — see [Filters](docs://ref-filters).

## The classic view buttons

The separate **Filter…**, **Group…** and **Sort…** buttons on the View tab have been replaced by the layout buttons and the layout window, the separate **Columns…** button by the plus in the table header and **Table** → **Columns…**. If you want the separate buttons back, switch them on via **Settings** → **Advanced** tab → **Legacy features**.
