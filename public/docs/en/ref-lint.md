# The ribbon, tab by tab

The ribbon at the top of the screen has tabs, and each tab has groups of buttons. This article says, for each button, what it does and where you see the result. How to tackle a job step by step is in the how-to guides; this is where you look up what a button is. A button that only exists or works under a condition has that condition next to it.

## How the ribbon behaves

- **Tabs** — *File* is on the left, then *Home*, *Planning*, *Resources*, *View*, *Settings*, *Table*, *IFC*, *Report* and, only with AI mode on, *AI*.
- **Narrow window** — when the ribbon does not fit, buttons shrink to an icon from right to left. The name is then the tooltip on the button. Every button without its own tooltip shows its name.
- **Collapse the ribbon** — the small arrow at the bottom right of the ribbon turns it into a flat strip with icons only. The *Baselines & progress* group and the *Connection* group on the AI tab then disappear behind a single button with a pop-up. Default: expanded. Your choice is remembered.
- **Extension buttons** — an extension can add its own group at the end of a tab. Such a button does what the extension gave it.

## File

Clicking *File* makes a screen of its own (the Backstage) take over the workspace. It has no ribbon. *Back* closes it. If you changed something under *Project info* and did not apply it, the app first asks what to do with it.

- **New** — opens the *New project* window and closes the Backstage. The fields are in [New project and Project info](docs://ref-projectinfo).
- **Open** — picks a file and opens it as a document. Closes the Backstage.
- **Recent** — a list of recently opened projects; a click opens one. Only visible when the environment can reopen files: in the desktop app and in browsers that offer file access, such as Chrome and Edge. In other browsers the button is there, but the page stays empty.
- **Examples** — bundled example schedules, split into *Full showcase schedules* (badge *All features*) and *Simple examples*. A click opens one in a new tab.
- **Save** — writes the project to the file of this document. If the document has no file yet, you first choose a name and place. A file you opened in a format other than IFC is never overwritten; then *Save* asks for a name and place for an IFC file.
- **Save As** — picks a new name or place and saves there as IFC.
- **Export** — cards per export format, with a description. A click converts the project and saves it, and takes you back to *Home*. If the schedule has a cycle, the error appears in the Backstage and you stay there. If the project is linked to a resource library, the checkbox *Save library file alongside* appears below; it only works for the IFC card.
- **Import** — at the top the card *Update progress from a spreadsheet* (disabled without tasks), below it the importers that extensions add.
- **Print** — the button *Open print preview* takes you to the *Report* tab.
- **Project info** — the metadata and calculation profile of this project. Changes only take effect after *Apply*. See [New project and Project info](docs://ref-projectinfo) and [Calculation profiles and conventions](docs://uitleg-rekenprofielen).
- **Settings** — the same settings as the *Settings* window.
- **Extensions** — management and installation of extensions; see [Installing and managing an extension](docs://howto-extensie-installeren).
- **Library** — management of resource libraries; see [Managing and sharing resource libraries](docs://howto-bibliotheken-beheren).
- **Help** — the built-in documentation, with search and a documentation language.
- **Start tour** — closes the Backstage and starts the tour at step 1.
- **Close project** — closes the active document. If it has unsaved changes, the app asks for confirmation.

## Home

### Home › File

- **New**, **Save**, **Open** and **Save As** — the same actions as in *File*.
- **Recent** — drop-down with the recent projects; a click opens one. Only visible under the same condition as *File › Recent*. Without recent files it says *No recent files*.
- **Export** — drop-down with the export formats (short names). A click converts the project and saves it.

### Home › Edit

- **Undo** — reverses the last change. Disabled when there is nothing to undo.
- **Redo** — restores the last undone change. Disabled when there is nothing to redo.
- **Delete** — deletes the selected tasks, together with their subtasks, as one step. Disabled without a selection.

### Home › Tasks

- **Task** — adds a task named *New task*, with a duration of 5 working days, starting on the project start. (If *Enable hour planning* is on and the *Default unit for new tasks* in *Project info* is hours, the duration is 5 hours.) If a task is selected and the view is the plain tree, it lands directly below the lowest selected task (tooltip *New task directly below the selection*). With no selection it goes at the bottom (tooltip *New task at the bottom of the list*). With a selection but while filtering, grouping or sorting, it also goes at the bottom and a strip says *Not available while filtering/grouping/sorting*. The new task becomes the only selection, the Gantt jumps to it and its name is ready to overwrite in the *Properties* panel.
- **Milestone ▾** — a drop-down that puts a milestone (duration 0) in the same place as *Task*. *Start milestone* and *Finish milestone* set the kind of milestone; the new milestone is named *New milestone* and gets task type *Other*. *Inspection point (mandatory)* makes a finish milestone with task type *Inspection* and the flag *Mandatory (contractual)*, named *New inspection point*.
- **Link ▾** — a drop-down with four fixed actions; the main button never changes meaning. See *Planning › Relations* for the four actions.
- **Split task** — turns split mode on or off. On: a strip under the ribbon explains that you click on a bar where the break starts and drag right for its length. Disabled when the Gantt is not in view (on the *Table*, *IFC* and *Report* tabs and under the full resource panel); the tooltip then says *Only available when the Gantt chart is visible*. See [Splitting a task](docs://howto-taak-splitsen).

### Home › Schedule

- **Calculate** — calculates the schedule: dates, float, critical path and resource load. This never happens by itself, unless you turn on *Calculate automatically* (*Settings*, tab *Planning*, heading *Calculation*). While the schedule is out of date, the status bar says *Out of date — recalculate (F5)*.

### Home › Zoom

- **Zoom +** — zooms the time axis in by 10 pixels per day.
- **Zoom -** — zooms the time axis out by 10 pixels per day.

## Planning

### Planning › Schedule

The *Calculate* button is the same as on *Home*.

- **Move project…** — opens the *Move project* window. Disabled without a project start date. See [Moving a project](docs://howto-project-verplaatsen).
- **Warnings** — shows or hides the *Warnings* panel in the right-hand column. The button lights up while you can see the panel. Turning it on expands a collapsed column. What is in it is described in [Notifications and warnings](docs://ref-meldingen).

### Planning › Relations

The group has the *Link ▾* button with four actions and the *Split task* button (same as on *Home*). The four actions:

- **Draw relation** — turns link mode on or off; a check mark appears when it is on, and the main button lights up. On: you drag from one bar to another in the Gantt to create a relation, and a strip under the ribbon says how to stop (*Stop* or Esc). Disabled when the Gantt is not in view.
- **Link selected tasks** — creates a Finish-Start relation without lag between two tasks; the one selected first becomes the predecessor. Only available with exactly two tasks selected (otherwise *Select exactly two tasks*). A duplicate relation or a cycle is refused with a message.
- **Add external relation…** — opens a window to add an external predecessor or successor to the selected task. Only available with exactly one task selected (otherwise *Select exactly one task*).
- **Refresh all external relations** — refreshes the anchors of all external relations and reports in the menu how many were updated or are missing. Only available when the project has external relations (otherwise *This project has no external relations*).

For the why of relations see [Creating relations](docs://howto-relaties-leggen) and [Relations and lag](docs://uitleg-relaties).

### Planning › Path tracing

- **Predecessors** — highlights in the Gantt the predecessors of the selected tasks, chain by chain.
- **Successors** — highlights the successors of the selected tasks.

You can have both on at once; a second click on a button turns that side off again. Driving relations get a stronger tint. See [Tracing a path](docs://howto-pad-traceren).

### Planning › Calendar

- **Calendar** — opens the *Calendars* window with the project's calendar library. See [Calendar windows](docs://ref-kalenders).

### Planning › Structure

- **Codes & fields** — opens the *Codes & fields* window for activity codes and custom fields. See [Codes and custom fields](docs://howto-codes-en-velden).
- **WBS auto** — turns automatic numbering of the WBS codes on or off. Default: off. On: the whole tree is renumbered at once, the codes then follow every structure change, and the *WBS Code* field in the panel and the dialog is disabled.
- **Renumber WBS** — renumbers the WBS codes once, following the position in the tree (1.2.3). Disabled while *WBS auto* is on.
- **Templates** — drop-down with saved WBS templates, each with its number of tasks and relations. A click inserts the template under the selected task, or at the top level without a selection. The bin icon deletes a template. Without templates it says how to save one (right-click a summary task, *Save branch as template*). See [Saving and inserting WBS templates](docs://howto-wbs-sjablonen).
- **Indent** — makes the selected tasks subtasks of the task before them. Disabled without a selection and as soon as you are filtering, grouping or sorting; the tooltip then says *Not available while filtering/grouping/sorting*.
- **Outdent** — moves the selected tasks up one level, directly after their current parent. Same conditions as *Indent*.

### Planning › Baselines & progress

- **Manage baselines…** — opens the baseline window. See [Saving and managing a baseline](docs://howto-baseline-opslaan-en-beheren).
- **Status date** — the date up to which you measure progress. Type a date; the cross (*Clear status date*) removes it. Effect: progress is measured up to that date, and the status date line and progress line in the Gantt sit on it. See [Progress, status date and baseline](docs://uitleg-voortgang).
- **Progress mode** — a choice between *Retained Logic* and *Progress Override*. Default: *Retained Logic*. Effect: with *Retained Logic* the remaining work of a started successor follows the relation; with *Progress Override* the remaining work starts on the status date, without waiting for the predecessor. See [Choosing the progress mode](docs://howto-voortgangsmodus-kiezen).

In the collapsed ribbon these three sit behind one flag button titled *Baselines & progress*.

### Planning › Progress

- **Export progress sheet** — makes an `.xlsx` sheet with the tasks, to fill in progress outside the app. Disabled without tasks.
- **Update progress from a spreadsheet** — opens the import window for a returned sheet. Disabled without tasks. See [Importing progress from a spreadsheet](docs://howto-voortgang-importeren).

This group is also on *Table* and *Report*.

## Resources

### Resources › Manage

- **Resources** — opens the full resource panel; it takes over the workspace. Lights up while you see that panel. See [Resource panel](docs://ref-resourcepaneel).
- **Resource dock** — docks the compact resource panel in the right-hand column, next to the Gantt. Lights up while the dock is visible; a second click closes it. The dock shows only name, colour, a warning on overload and *Max units*, and with a task selection only the resources of those tasks.
- **New resource** — opens the full resource panel with an empty draft row for a new resource. Nothing is created until you enter a name; clicking away leaves nothing behind. The resource goes into the library or into the project, depending on the view.

### Resources › Assignment

- **Assign ▾** — assigns a resource to the selected task. Only available with exactly one task selected that is a leaf task and not a milestone; otherwise the button is grey. In the menu you first set *Units/day* (default 1) and *Curve* (default *Uniform*); a click on a resource assigns it with those values. The menu lists only resources that are not yet on the task. See [Assigning resources with a curve](docs://howto-resource-toewijzen).

### Resources › Histogram

- **Histogram** — shows or hides the histogram strip under the Gantt. Default: off. Your choice is remembered.
- **Previous** and **Next** — step through the resources in the picker of the histogram strip, with *All resources* as an extra step in the round. Disabled when the histogram is off or the project has no resources.

### Resources › Leveling

- **Level…** — opens the *Level resources* window. See [Leveling](docs://uitleg-nivelleren).
- **Clear leveling** — removes the delays and breaks that leveling applied. Disabled when no task has a leveling result.

### Resources › Overallocation

- **Overallocation** — not a button but a counter: the number of resources with at least one overloaded day, or *None*. Red with a warning icon as soon as there is one. The number refreshes after *Calculate* and after changes to resources and assignments; if you change the dates of tasks, that only counts after *Calculate*.

## View

### View › Time Scale

- **Zoom +** and **Zoom -** — zoom the time axis in or out by 10 pixels per day.
- **Reset** — sets the zoom back to the default of 30 pixels per day.
- **Fit to project** — zooms and scrolls so the whole project fits in view.
- **Scale choice** — a list with *Year*, *Quarter*, *Month*, *Week*, *Day* and, only with *Enable hour planning* on, *Hour*. A choice sets a fixed zoom; the value shown follows the current zoom, and below it that zoom is shown in pixels per day.

### View › Display

- **Columns…**, **Filter…**, **Group…** and **Sort…** — only visible when *Show classic view buttons* is on (*Settings*, tab *Advanced*, heading *Legacy features*). Default: off. *Columns…* takes you to *Table* and opens the column picker there. *Filter…* opens the filter window straight away as long as there is no saved filter; with saved filters it opens a menu with *Filter…*, *Clear* (only when a filter is active) and the saved filters. *Group…* allows two levels. *Sort…* allows more levels. A button lights up when that view setting is active. In the current ribbon you do this with layout buttons; see [Creating and using a layout](docs://howto-layouts-gebruiken).

### View › Outline

- **Collapse** — collapses the selected summary tasks; without a selection all of them. In a grouped view it collapses all groups and a selection has no effect.
- **Expand** — the reverse.

### View › Layout

- **Layout buttons** — each layout is a switch with an icon and a name. *Resource diagram* is included. One click turns the layout on, another click turns it off and brings back the view from before the click. Layouts with different parts can be on together. Right-click a layout: *Edit…*, *Duplicate* and *Delete* (after confirmation). An included layout can only be duplicated.
- **New layout** — opens the layout window for a new layout.

### View › Presentation

- **Presentation** — turns presentation mode on or off (F11 or Esc to stop): only the Gantt fills the screen. See [Presenting on a large screen](docs://howto-presentatie).
- **Split view** — splits the Gantt into two time windows that both start with your current zoom and position (split 50 percent), or makes it one again. Default: off. See [Using split view and the mini-map](docs://howto-split-view-en-mini-map).
- **Mini-map** — shows or hides the mini-map. Default: off. Your choice is remembered.

### View › Panels

- **Properties** — shows or hides the *Properties* panel in the right-hand column. Default: on. See [Task dialog and properties panel](docs://ref-taak-eigenschappen).

The *Resources*, *Resource dock* and *Histogram* buttons are the same as on *Resources*, and *Warnings* is the same as on *Planning*.

### View › Baselines & progress

This group has the same name as the one on *Planning*, but holds the drawing options of the Gantt.

- **Baseline overlay** — shows the active baseline as a thin bar under each task bar. Default: on. Without an active baseline there is nothing to see.
- **Progress line** — draws a line on the status date that bulges out per task to its progress. Default: on. Without a status date there is nothing to see. When the progress line is on, that line is also the marker of the status date.
- **Status date line** — draws a dashed line on the status date. Default: on. You only see it when the progress line is off, because otherwise that line takes its place. The label with the date in the header stays as long as at least one of the two is on.
- **Bar colors** — chooses how the bars are coloured: *Critical path* (default), *Per task — automatic* or *By category* with a choice of field. If that field is not in this project, the menu says that *Task type* is used temporarily. Outside *Critical path*, a red outline marks the critical path. The choice also applies to the report.
- **Resource accent** — draws a thin strip in the resource colour under each leaf bar, divided in proportion to the units per day. Default: off.
- **Float band** — draws the green band after a non-critical bar, up to the task's late finish. Default: on.
- **Relationship lines** — shows or hides the relationship lines between tasks. Default: on. The choice belongs to the document and to the layout.

## Settings

### Settings › Project

- **Project info** — opens the *Project info* window: the metadata of the project and, in the block *Calculation profile and options*, how the project calculates. See [New project and Project info](docs://ref-projectinfo).
- **Settings** — opens the *Settings* window with the tabs *Appearance*, *Planning* and *Advanced*. The same settings are under *File › Settings*.

### Settings › Calendar

The *Calendar* button is the same as on *Planning*.

### Settings › Keyboard Shortcuts

- **Keyboard Shortcuts** — opens the *Keyboard Shortcuts* window.

## Table

The *Table* tab shows the tasks as a full table instead of the Gantt. The groups *File*, *Edit*, *Tasks*, *Schedule* and *Path tracing* are the same as on *Home* and *Planning* and act on the same selection. There is no *Zoom* group, because zooming only scales the time axis of the Gantt. The buttons *Split task* and *Draw relation* are disabled here: there is no Gantt.

### Table › Columns

- **Columns…** — opens the column picker of this table. The same picker opens with the plus in the table header. The tooltip says *Choose the columns of the Table view*. See [Adjusting table columns](docs://howto-tabelkolommen-aanpassen) and [Table columns](docs://ref-tabelkolommen).

## IFC

The tab shows the IFC panel in the workspace. The ribbon has no buttons here, only the line of text *IFC 4x3 - Industry Foundation Classes*.

## Report

### Report › Report

- **Print** — only on this tab, where it does nothing because *Report* is already open; the report choices are in the report screen.

## AI

The *AI* tab only exists when *Enable AI mode* is on (*Settings*, tab *Advanced*, heading *AI mode*). Default: off. Turning it off removes the tab and stops the bridge. An AI assistant works with your schedule through an MCP bridge that you start here. See [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Start bridge** and **Stop bridge** — start or stop the MCP bridge. Next to it is the status: *Off*, *Live on port …*, *Port … in use* (with the reason) or *Error*. Disabled in the web version; the tooltip says *The bridge only works in the desktop app.* The same status shows as a dot with *AI* in the status bar.

### AI › Connection

- **Port** — the port of the bridge. Default: 3877. Only editable when the status is *Off* (tooltip *Only editable while the server is stopped.*).
- **Token** — the password of the bridge, shown hidden. Small buttons *Show token*/*Hide token*, *Copy* and *New token*. *New token* asks for confirmation first, because a new token breaks all existing connections; if the bridge is running, it restarts with the new token.
- **Connect** — shows the connection details: endpoint, token, a configuration snippet and a connection prompt that you paste into your AI agent.

### AI › Safety

- **Pause** / **Resume** — temporarily refuses all changes by the AI; reading stays allowed and the bridge stays live. The button lights up red while paused.
- **Read-only** — refuses all mutating tools while this is on.
- **Auto-backup: on** / **Auto-backup: off** — automatically writes an IFC backup before the first AI change per document. Default: on.
- **Back up now** — writes a backup straight away and reports the file name. Desktop app only.
- **Open backup folder** — opens the folder with the backups. Desktop app only.

### AI › Activity

- **Activity panel** — shows or hides the *AI activity* panel with the calls to the bridge, with their arguments and response.
