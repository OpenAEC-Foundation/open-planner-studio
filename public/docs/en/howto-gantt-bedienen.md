# Dragging, panning and zooming in the Gantt

Goal: operate the timeline with the mouse: move a bar or adjust its duration, shift the timeline, select tasks with a box and zoom in and out.

## When you need this

You see in the Gantt that the brickwork has to start two days later, or that the pour takes a day longer, and you want to do that straight on the bar. Or you have a project of months and want to scroll quickly to the builders' holiday. The mouse has a few gestures for that. Which gesture does what depends on where you start dragging and on your scroll setting.

## Steps

### Moving a bar

1. Press on the middle of a task bar and drag horizontally. Start and finish move together, in whole days; the duration stays the same.
2. Let go. The bar stays at its new place. The schedule is then stale: press *Calculate* (F5), or let the app do it itself if *Calculate automatically* is on.

If the task has a predecessor, the app records the new start as the constraint *Start no earlier than (SNET)*, and says so after you let go. Why that is, and what happens with another constraint, is in [Constraints and deadlines](docs://uitleg-constraints). If you drag back to the original start, the original constraint comes back too.

If you drag mostly up or down instead of sideways, you move the task to another row and the dates stay. The direction you choose in the first few pixels applies to the whole drag, so one gesture never changes dates and structure at the same time. See [Adjusting the structure](docs://howto-structuur-aanpassen).

### Adjusting the duration

1. Move the mouse to the right edge of the bar. The cursor becomes an arrow pointing left and right.
2. Drag the edge. While you drag, a small pill in the accent color of the theme (orange by default) shows the duration the task would get now, for example *4d*. It follows live, so you see the new duration before you let go. At the right edge the pill is inside the bar, at the left edge just to the left of it. The pill shows the duration the way the duration column shows it.
3. Let go. The duration is the one the pill showed.

The left edge moves the start and leaves the finish, so the task gets shorter or longer at the front. The same SNET rule applies as when moving. When you drag the middle of the bar, the pill does not appear: the duration does not change.

The duration counts working days of the task's calendar. Weekends and days off do not count, and a task in days cannot get shorter than one working day. For a task in hours the app rounds to the step of the timeline under your mouse: at least an hour, or a quarter of an hour if you zoom in far enough and *Show quarter-hours when zoomed in far* is on.

One drag is one step in *Undo*, however long you drag. On a split bar the edges work differently; see [Splitting a task](docs://howto-taak-splitsen).

### Shifting the timeline

What a drag on the empty background does depends on your scroll mode. You choose it in *Settings*, tab *Appearance*, under *Gantt › Scroll & zoom* at *Mode*:

- **Zoom + drag** (default): if you drag on the empty background with the left mouse button, the timeline moves with the mouse, like a map. The cursor is a hand. On a bar, a drag simply starts a bar gesture.
- **Position** and **Keys**: the same drag makes a selection box. You shift the timeline with the wheel (see [Settings](docs://ref-instellingen)) or with the middle mouse button.

**The middle mouse button** (the wheel pressed) shifts the timeline in every mode, and also if you start on a bar. It does not work while another gesture is in progress, such as dragging a bar.

### Selecting tasks with a box

A box selects all tasks in the rows it touches. Only the height of the box counts, not the time axis.

1. Start on empty background. With *Zoom + drag* you hold Ctrl (⌘ on a Mac) while you do so; with *Position* and *Keys* that is not needed.
2. Drag over the rows you want to select. The selection gets a frame.
3. Let go. With Esc while dragging you cancel the box and the selection stays as it was.

More about selecting is in [Selecting, deleting and undoing tasks](docs://howto-taken-selecteren-verwijderen). On empty space in the task list itself, dragging does nothing.

### Zooming in and out

1. Use *Zoom +* and *Zoom -* (*Start › Zoom*), or the + and - keys. The wheel zooms too; when depends on your scroll mode (see [Settings](docs://ref-instellingen)).
2. If you want the whole project in view, choose *View › Time Scale › Fit to project* or press Ctrl+0. *Reset* (on the *View* tab) or the 0 key sets the zoom back to the default.
3. At the bottom right of the status bar is the zoom in pixels per day, for example *Zoom: 15px/day*.

The further you zoom out, the fewer grid lines there are. At 8 pixels per day or more there is a line for every day, with a thicker line at the week boundary. Between 2 and 8 pixels per day only the week boundary remains. Below 2 pixels per day, at year level, only the month boundaries are left. Otherwise the canvas would become an even stripe pattern in which the bars disappear. The grey weekends and days off, and the week bands that are tinted alternately, stay at every level; they carry the week structure when the lines drop out. In the timeline header the week numbers and day numbers only appear when there is room for them, and from 40 pixels per day the weekday is shown before the day number as well.

## Pitfalls and what the app does then

**The start does not move.** If the task has a predecessor and a constraint other than SNET, for example *As late as possible (ALAP)*, the app does not apply the dragged start. After you let go, the app says which constraint holds the start back. Change that constraint to move the start. The right edge does work, because it only changes the duration.

**The gesture does something else.** In relation mode and in split mode, bar gestures do something different; Esc stops those modes. If you hold Shift while dragging from a bar, you create a relation instead of moving a bar. See [Adding relations](docs://howto-relaties-leggen).

**In Position or Keys mode the left mouse button does not pan.** You then see a normal cursor instead of a hand. Use the wheel or the middle mouse button, or set the mode to *Zoom + drag*.

**A click in a pause of a split bar** selects the task and starts no drag or box.

## See also

- [Right-click menus](docs://ref-contextmenus): the menus on a bar, a row and a group header.
- [Keyboard shortcuts](docs://ref-sneltoetsen): the keys for zooming and for cancelling a gesture.
- [Settings](docs://ref-instellingen): the scroll mode and the time axis.
- [Constraints and deadlines](docs://uitleg-constraints): why a moved start becomes a constraint.
