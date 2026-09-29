# Keyboard shortcuts

All key combinations of the app, grouped as in the *Keyboard Shortcuts* window. The keys are fixed: you cannot rebind them. How to work with the mouse and menus is in the how-tos; here you look a key up.

## How to read this list

**Mac.** Wherever this article says Ctrl, use Cmd (⌘) on a Mac. Alt is Option (⌥). On a Mac the *Keyboard Shortcuts* window shows the symbols ⌥, ⇧ and ⌘ instead of Alt, Shift and Ctrl. Ctrl also works in the app on a Mac.

**Exact combination.** The app compares Ctrl, Shift and Alt exactly. Ctrl+Alt+S therefore does nothing: the keys must match the list precisely.

**Opening the window.** Press Ctrl+/ or choose *Settings › Keyboard Shortcuts › Keyboard Shortcuts*. Ctrl+/ also closes the window again. The window is read-only. It does not show every key listed here; the table and dialog keys at the bottom of this article are not in it.

**When a key does not work.** Every entry names its restrictions. Three rules apply almost everywhere:

- In an input field, a drop-down list or a text box the app does not intercept keys, so you can simply type. Exceptions: F5, Ctrl+S, F11 and Esc during the presentation also work in a field. In the built app (desktop and the web version on the site) that also holds for Ctrl+Shift+S, Ctrl+O and Ctrl+N.
- While a dialog or another window is open, the keys marked *Not in a dialog* below do not work. That also holds for presentation mode, the tour, the welcome dialog and the questions that wait for an answer, such as the consent when installing an extension.
- Document switches (Ctrl+1 to 9, Ctrl+N, Ctrl+O) also do not work while *File › Project info* holds changes that you have not yet confirmed with *Apply*. Discard or apply them first.

## File

**F5** — *Calculate*: recalculates the schedule, like the *Calculate* button (*Home › Schedule › Calculate*). Also works in an input field.

**Ctrl+S** — *Save*: saves the project. Also works in an input field.

**Ctrl+Shift+S** — *Save As*: asks where the file should go. In a development build it does not work in an input field.

**Ctrl+O** — *Open*: opens a file, usually in a new tab. Not in a dialog and not with unapplied Project info.

**Ctrl+N** — *New project*: opens the *New project* window. Not in a dialog and not with unapplied Project info.

The built app (desktop and the web version on the site) also blocks a number of browser keys so that they do not get in the way: Ctrl+R and Ctrl+Shift+R (reload), F12, Ctrl+Shift+I and Ctrl+Shift+J (developer tools), Ctrl+U (view source) and Ctrl+G, Ctrl+F and Ctrl+L (find and address bar). Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N and F5 go to the app itself.

## Edit

**Ctrl+C** — *Copy*: copies the selected tasks. Only with a selection. In the task grid Ctrl+C copies the selected cells; the grid handles that itself.

**Ctrl+V** — *Paste*: pastes copied tasks. In the task grid it pastes the cells.

**Ctrl+Z** — *Undo*.

**Ctrl+Y** or **Ctrl+Shift+Z** — *Redo*: repeats what you undid.

**Delete** or **Backspace** — *Delete*: deletes the selected tasks. Only with a selection. In a cell of the task grid, Delete and Backspace only clear the cell content (see *Table*).

**F2** — *Edit...*: opens the task dialog for the first selected task. Only with a selection. Not in a dialog. In a cell of the task grid, F2 starts editing the cell.

**Ctrl+A** — *Select all*: selects all tasks. Not in a dialog.

**Esc** — *Clear selection*: clears the selection and at the same time switches off relation mode, split mode and path tracing, and closes the task dialog and the project overview. During the presentation, Esc only closes the presentation (see *View*). In an input field Esc does none of this.

## Structure

**Alt+Shift+→** or **Alt+→** — *Indent*: makes the selected tasks one level deeper in the WBS. Only with a selection, not in a dialog.

**Alt+Shift+←** or **Alt+←** — *Outdent*: takes the selected tasks up one level. Only with a selection, not in a dialog.

Indent, outdent and insert only work in the plain tree view: without a filter, grouping or sorting. In any other view the app refuses them with a message, because the order shown is then not the order of the project.

**Insert** — *Insert above*: inserts a new task above the topmost selected task, at the same level. With no selection the task goes at the bottom. Not in a dialog.

**Ctrl+I** — *Insert below*: inserts a new task below the bottom-most selected task, at the same level. With no selection the task goes at the bottom. Not in a dialog.

**Ctrl+M** — *Add milestone*: adds a new milestone at the bottom of the list, even if you have a task selected. Not in a dialog.

**Alt+↑** — *Move task up*: moves the first selected task one place up within its level. Only with a selection, not in a dialog.

**Alt+↓** — *Move task down*: the same, one place down.

## View

**F11** — *Presentation*: switches presentation mode on or off. The app also asks the browser or window for full screen. Also works in an input field.

**Esc** (during the presentation) — *Exit presentation*. Also works in an input field. This takes precedence over *Clear selection*.

**Ctrl+=** — *Zoom in*: zooms the timeline in by a fixed step. Not in an input field.

**Ctrl+-** — *Zoom out*: zooms out by a fixed step.

**+** or **=** — *Zoom in*: zooms in by 10% around the middle of the Gantt area. Not in an input field, and only when the Gantt timeline is in view (so not on the *Table*, *IFC* and *Report* tabs).

**-** — *Zoom out*: zooms out by 10%. Same restrictions.

**0** — *Reset zoom*: sets the zoom back to the default and scrolls to the start. Same restrictions.

**Ctrl+0** — *Fit to project*: zooms so that the whole project fits in view. Same restrictions.

**Ctrl+/** — *Show shortcuts*: opens and closes the *Keyboard Shortcuts* window. Also works when another dialog is open, but not during the tour and the welcome dialog.

**Ctrl+Shift+H** — *Histogram*: switches the histogram on or off, like the *Histogram* button (*Resources › Histogram › Histogram* or *View › Panels › Histogram*). The app remembers your choice.

**Ctrl+Shift+L** — *Warnings*: switches the warnings panel on or off, like the *Warnings* button (*View › Panels › Warnings*).

## Navigation

**Ctrl+P** — *Go to Report tab*: takes you to the *Report* tab. It is therefore not a print command. Not in a dialog.

**F1** — *Open help*: opens *File › Help*. Not in an input field and not in a dialog.

**Ctrl+1** to **Ctrl+9** — *Switch document*: goes to the first to ninth open document. If that document does not exist, nothing happens. Not in a dialog and not with unapplied Project info.

**Ctrl+Home** — *Jump to today*: scrolls the timeline so that a date is at the left of the view. That is the status date if you have set one, otherwise today. So the label says "today", even when the timeline jumps to the status date. Zoom and the start of the timeline stay as they were. If a cell of the task grid has focus, Ctrl+Home instead goes to the first cell of the grid (see *Table*).

## Table

These keys work in the task grid (on the *Table* tab and in the table to the left of the Gantt) when a cell has focus. The *Keyboard Shortcuts* window shows the first six entries; the rest are not in it.

**Tab** and **Shift+Tab** — *Next/previous cell*: goes to the next or previous cell, and at the end of a row to the next row. On the very last cell (Tab) or the very first (Shift+Tab) the focus leaves the grid.

**Enter** or **F2** — *Edit cell*: opens the editor of the cell. If the cell is read-only, the grid shows a message.

**A letter, digit or other character** — *Typing replaces the cell content*: starts editing and replaces the content with what you type.

**Insert** — *Insert above*: inserts a task above the active row.

**Delete** or **Backspace** — *Clear cell content*: clears the content of the selected cells, not the task itself. The *Keyboard Shortcuts* window only lists Delete.

**Esc** — *Clear selection*: moves the focus to the grid as a whole, so that the next Tab leaves the grid, and also clears the selection as described above.

**Arrow keys** — go to the cell above, below, left or right. Add Shift to extend the selection.

**Home** and **End** — to the first or last column of the row. With Ctrl added, to the first cell of the first row and the last cell of the last row.

**Page Up** and **Page Down** — one screen height up or down.

**Enter** (while editing) — commits the input and goes to the same column in the next row. Shift+Enter goes to the previous row.

**Esc** (while editing) — cancels editing without keeping the input.

The resource table has its own key handling between the input fields; that is not in this list.

## Dialogs and other windows

These keys are not in the *Keyboard Shortcuts* window.

**Esc** — closes the topmost dialog (cancels). In *File* (Backstage) too, Esc closes the screen, unless a dialog or an open drop-down list is on top.

**Enter** — confirms the topmost dialog, like the primary button, in dialogs that support it. Enter does not do that in a multi-line text box, in an open drop-down list or during IME input.

**Esc** during a gesture in the Gantt — cancels a selection box (the selection stays as it was) and a split gesture (a split already made is undone).

**Enter** and **Esc** in the relation type picker — Enter confirms, Esc cancels.

**Left arrow and right arrow** on the divider between the task grid and the timeline — moves the divider 10 pixels at a time, 40 with Shift. The divider must have keyboard focus.

**Up arrow and down arrow** in the histogram's resource list — choose the previous or next resource. The histogram field must have focus.

## See also

- [Making and printing a report](docs://howto-rapport-maken-en-afdrukken): why Ctrl+P does not open a print window.
- [Splitting a task](docs://howto-taak-splitsen): the split gesture that Esc cancels.
- [Presenting on a large screen](docs://howto-presentatie): F11 and Esc in practice.
- [Turning on AutoSave](docs://howto-automatisch-opslaan): saving with Ctrl+S next to AutoSave.
