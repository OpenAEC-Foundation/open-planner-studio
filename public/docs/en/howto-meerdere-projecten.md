# Working with several projects at once

Goal: have more than one schedule open, switch between them and close them separately.

## When you need this

You are working on the housing development in the neighbourhood, but the site meeting is also about the renovation of the clubhouse. Or you want to keep a variant next to the original. Each project is in its own tab, with its own tasks, calculation and time window. Switching takes one click and you lose nothing.

## Steps

### Opening a second project

1. Click the plus to the right of the tabs (*Start a project*). The *Start a project* window opens.
2. Choose *New project* for an empty schedule, or *Open existing project* to pick a file. *Cancel* closes the window.
3. With *New project* you fill in the *New project* window and click *Create*.

The project appears in its own tab and is active straight away. *New* and *Open* in the ribbon, Ctrl+O and the examples in *File › Examples* also open a project in a new tab. Only a fresh, empty schedule that you have not touched yet is reused instead of adding a tab.

### Switching between projects

- Click the tab of the project.
- Press Ctrl+1 to Ctrl+9 (⌘ instead of Ctrl on macOS) for the project at that place in the row, counted from left to right.
- Click the menu icon to the left of the tabs (*All projects*). The *Open projects* overview shows a card per project with its name, the file name (if the project has a file), a thumbnail of the schedule, the number of tasks, the number of critical tasks and the end date. Click a card to go there. Esc closes the overview.

Each tab has a coloured dot that belongs to the project. A tab with a small dot behind it has unsaved changes.

### Closing a project

Click the cross next to the name on the tab (*Close*), or the cross on a card in the overview. A project without changes closes at once. If it has unsaved changes, the app asks *Unsaved changes* with three choices:

- *Save* saves the project and then closes it.
- *Don't save* closes the project and throws the changes away.
- *Cancel* leaves the project open.

If you close the last project, an empty schedule called *New schedule* remains.

### Choosing the switch style

The tabs are a choice. Open the settings window with the gear in the title bar, go to the *Appearance* tab and choose at *Document switch style*:

- *Horizontal tabs*: the default. A row of tabs under the ribbon.
- *Vertical tabs*: a narrow bar on the left with a button per project (the first letters of the name) and a plus. If you hover over a button you see name, file name, number of tasks, number of critical tasks and end date. The button at the top opens the overview.
- *Pill*: one pill in the title bar with the name of the active project and a counter such as *2 open*. Click it to open the overview and switch there.

All three styles open the same overview, and Ctrl+1 to Ctrl+9 works in every style.

## Pitfalls and what the app does

**What belongs to the project and what is shared.** Each project has its own view: zoom and position, an active layout with filter, grouping or sorting, and split view. If you switch to another project, you see its own view there. Shared by all projects are the selected tab in the ribbon, the mini-map, your column choice, your layouts and the report choices.

**You cannot switch with a dialog open.** As long as a dialog is open, for example the settings window or a task window, Ctrl+1 to Ctrl+9 do nothing. Close the dialog first. An unapplied change in *Project info* in Backstage also blocks switching.

**Ctrl+1 to Ctrl+9 count by order.** The shortcut goes to the project at that place in the row. If you close a project, the other places shift up. If you have more than nine projects open, you reach the rest only through the tabs or the overview.

**Calculate and Report work on the active project.** Calculate (F5), *Export PDF* and the reports are about the project that is active now.

## See also

- [Creating and using a layout](docs://howto-layouts-gebruiken): setting up a view per project.
- [Making and printing a report](docs://howto-rapport-maken-en-afdrukken): the report of the active project.
