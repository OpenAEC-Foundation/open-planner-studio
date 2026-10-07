# Settings

Every setting of the app: what it does, its starting value, what changes and where you find it. For the calculation options of a project (calculation profile, critical definition) see [Calculation options and conventions](docs://ref-rekenopties-en-conventies): those belong to the project file, not to the app.

## Where to find them and how they work

The settings panel is in three places, and everywhere it is the same panel: the gear at the top of the window, *Settings › Project › Settings* and *File › Settings*. The panel has three tabs: *Appearance*, *Planning* and *Advanced*. Each setting below only names the tab.

A change takes effect immediately. There is no *Apply* button and no *Cancel*.

**App-wide, not per project.** All settings in this article apply to all your projects and belong to this device. The app keeps them in the storage of the app or of your browser, not in the project file. Someone else opening your file therefore sees their own settings. A browser whose storage you clear starts again with the starting values.

## Appearance tab

**Theme** — the colour scheme of the interface. Choose from *Dark*, *Light* and *High Contrast*. Default: *Dark*. Effect: the colours of the whole interface, including the Gantt and the histogram. Where: *Appearance*.

**Follow system theme** — lets the colour scheme of your operating system decide. Default: off. Effect: the app is *Light* or *Dark*, depending on your system; the three theme cards are then switched off. *High Contrast* does not follow your system: you pick it yourself. If you switch this off, the theme that was on screen at that moment stays. Where: *Appearance*, under *Theme*.

**Language** — the language of the interface. Default: the language of your browser or system if the app knows it, otherwise English. Effect: all texts in the app; the fourteen languages are sorted by their short code. Arabic and Persian mirror the interface from right to left. You set the language of the Help articles separately, under *Documentation language* in *File › Help*. Where: *Appearance*.

**Font** — the font of the whole interface. Choose from *Default*, *System*, *Serif* and *Monospace*. Default: *Default*. Effect: headings and text in the window, and the text in the Gantt and the histogram. A web app does not follow your system font by itself; that is why you choose it here. Where: *Appearance*.

**Text size** — scale of the interface. Choose from 90%, 100%, 110% and 125%. Default: 100%. Effect: the text and layout of the ribbon, the panels and the dialogs get larger or smaller, and the row height of the table and the Gantt scales along. There is no choice above 125%, because button labels in the ribbon then break over several lines. Where: *Appearance*.

**Date format** — how dates appear in the app. Choose from *dd-mm-yyyy*, *mm-dd-yyyy* and *yyyy-mm-dd*. Default: *dd-mm-yyyy*. Effect: dates in the table, the dialogs, the reports and the print. Files and calculations do not change: only the display. Where: *Appearance*.

**Duration display** — in which unit the duration of a task is shown. Choose from *Automatic (native unit per task)*, *Always days* and *Always hours*. Default: *Automatic (native unit per task)*. Effect: in the task grid, the bar labels of the Gantt, the tooltip, the print and the reports. With *Automatic* a day task shows days and an hour task shows hours. With *Always days* or *Always hours* the app converts using the hours per day of the task calendar and, if the unit of the task differs, puts its own unit after it in brackets, for example `2.25d(18h)`. Only the display changes; the task keeps its own unit. Where: *Appearance*.

**Document switch style** — how you switch between open projects. Choose from *Horizontal tabs*, *Vertical tabs* and *Pill*. Default: *Horizontal tabs*. Effect: *Horizontal tabs* puts a tab bar under the ribbon; *Vertical tabs* a project bar on the left; *Pill* a small project button in the title bar. Where: *Appearance*.

### Gantt section

**Show only working days** — compresses the timeline axis. Default: off. Effect: weekends and holidays from the project calendar are skipped, so a task of 5 working days is exactly 5 columns wide. The shortcuts for *Jump to today* and *Fit to project* then also count in working days. The report has its own checkbox with the same name, which is independent of this setting. Where: *Appearance*, under *Gantt › Timeline axis*.

**Show quarter-hours when zoomed in far** — an extra fine time scale. Default: off. Effect: you can zoom in further and the hour scale gets an extra quarter-hour row. Dragging an hour bar can then snap to quarter-hours instead of whole hours. You only see this when *Enable hour planning* is on. Where: *Appearance*, under *Gantt › Quarter-hour zoom*.

**Task bars at interruptions** — whether an hour task is drawn in blocks. Choose from *Never split*, *Split when selected* and *Always split*. Default: *Split when selected*. Effect: the bar of an hour task is then drawn per working block instead of as one continuous block. *Split when selected* does that only for the selected task. It only concerns hour tasks; a task that is really split (with *Split task*) shows its interruption regardless of this setting. Where: *Appearance*, under *Gantt*.

**Scroll & zoom › Mode** — what the scroll wheel does over the Gantt. Choose from *Position*, *Keys* and *Zoom + drag*. Default: *Zoom + drag*. Effect: with *Zoom + drag* the wheel zooms around the cursor, Shift+wheel scrolls through the rows, you pan the timeline by dragging the background and Ctrl+drag (Cmd on a Mac) draws a selection box. With *Position* the function of the wheel depends on where your cursor is; Ctrl+wheel always zooms and Shift+wheel always scrolls horizontally. With *Keys* you choose yourself which key does what. The choice also applies to the second timeline of the split view. Where: *Appearance*, under *Gantt › Scroll & zoom*.

**Scroll & zoom › Screen division** — where the cursor is for which function. Only visible in the *Position* mode. Choose from *Left/right*, *Top/bottom* and *Top-right corner*. Default: *Left/right*. Effect: with *Left/right* the wheel scrolls vertically over the left half and horizontally over the right half. With *Top/bottom* the wheel scrolls horizontally over the top 30% (near the time scale) and vertically below it. With *Top-right corner* the wheel scrolls horizontally in the top-right quadrant and vertically in the rest. Where: *Appearance*, under *Gantt › Scroll & zoom*.

**Scroll & zoom › Vertical, Horizontal, Zoom** — which key belongs to which wheel function. Only visible in the *Keys* mode. For each function you choose from *Scroll*, *Ctrl + scroll* or *Shift + scroll*. Default: *Vertical* is *Scroll*, *Zoom* is *Ctrl + scroll* and *Horizontal* is *Shift + scroll*. Effect: if you pick a key that is already in use, it swaps with the function that had it. Where: *Appearance*, under *Gantt › Scroll & zoom*.

## Planning tab

**Enable construction mode** — construction-oriented starting values for new projects. Default: on. Effect: on gives a new project the calendar *Bouwkalender NL* with the Dutch public holidays, lets you choose a builders' holiday when generating holidays, offers the phasing templates *Residential construction* and *Commercial / renovation* and gives new tasks the task type *Construction*. Off gives the calendar *Standaardkalender* without holidays, only the template *Empty* and the task type *Other*. A new task under a parent task that has a task type takes over that task type first; *Construction* or *Other* applies after that. Existing tasks and calendars do not change. Where: *Planning*.

**Enable hour planning** — planning in working hours next to working days. Default: off. Effect: the time scale *Hour* appears under *View › Time Scale*, the *Calendars* window gets the block *Working times*, and the *New project* window gets the choices *Shift* and *Default unit for new tasks*. *Project info* also gets the choice *Default unit for new tasks*. Off, the app works day-granular. Tasks that are already in hours stay and are included in the calculation; you can only edit their duration once you turn hour planning on. Where: *Planning*, under *Hour planning*. See [Turning on hour planning](docs://howto-urenplanning-aanzetten).

**Allow mixed day/hour planning** — whether you choose the unit per task. Only visible when *Enable hour planning* is on. Default: on. Effect: on shows the *Duration unit* drop-down next to the duration of every task. Off hides that drop-down. Where: *Planning*, under *Hour planning*. See [Days and hours](docs://uitleg-dagen-en-uren).

**Week starts on** — the first day of the week. Choose from *Monday* and *Sunday*. Default: *Monday*. Effect: the week layout and week numbers of the time scale in the Gantt and in the reports (the Gantt chart print), and the order of the weekdays in the *Calendars* window. Where: *Planning*.

**Calculate automatically** — recalculates the schedule as soon as it is out of date. Default: off. Effect: off means you press *Calculate* (F5) yourself. On makes the app recalculate the schedule within a fraction of a second after a change to tasks, relations or calendar. During a drag gesture or while you type in a field, the app waits and calculates once when you are done. After a failed calculation it only calculates again once you have changed something. Where: *Planning*, under *Calculation*.

**Show work rules and work** — the work rule and work fields in the app. Default: off. Effect: on shows the *Work rule* field on a task and the work column for the assignments, and makes the table column *Work rule* available. Off hides them; duration and units stay and the work follows. A project that already contains work rule or work data, for example from an `.mpp` or `.xer` file, always shows them, even if the setting is off. Where: *Planning*, under *Calculation*. See [Work rules: duration, units and work](docs://uitleg-werkregels).

## Advanced tab

**Enable AI mode** — lets an AI assistant work with your schedule. Default: off. Effect: on shows the *AI* tab with the MCP bridge, so an AI assistant can work with your schedule over the Model Context Protocol. Off hides the tab and stops the bridge. Where: *Advanced*, under *AI mode*. See [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen).

**Start bridge automatically** — starts the MCP bridge when the app starts. Can only be switched on when *Enable AI mode* is on. Default: off. Effect: the bridge is live straight away, so an AI client can connect without you first opening the *AI* tab. This only works in the desktop app, and once per start: if you switch the bridge off yourself afterwards, it does not start again. Where: *Advanced*, under *AI mode*.

**Enable debug terminal** — a log panel for troubleshooting. Default: off. Effect: on puts a terminal button in the status bar, which shows or hides the log panel. Off closes the panel. Where: *Advanced*, under *Debug terminal*.

**Benchmark…** — measures the performance of the scheduling engine. Effect: opens a window in which you have a test schedule of a chosen size generated and the core phases measured. Your open project is left untouched. It is a button, not a setting: there is nothing to remember. Where: *Advanced*, under *Benchmark*.

**Statistics…** — how often the app has been downloaded. Effect: opens the window *Download statistics* with public figures from GitHub Releases; nothing is collected from you. It is a button, not a setting. Where: *Advanced*, under *Statistics*. In the window:

- *Downloads per operating system* — per system the columns *Downloads*, *Installers* (what a person downloads) and *Updates* (what the updater in the app fetches), with a *Total*. On Linux the two cannot be separated: the updater fetches the same `.deb`, `.rpm` or `.AppImage` file that people also download by hand, so there only the snap file counts as an installer. Below it *Update checks from the app*: how often the updater in an installed app has fetched the version file from GitHub to look for a new version. Those are checks, not installs.
- *Per release* — the same downloads per version, with the date; first the six newest, with *Show all … releases* for the rest.
- *Source* — the date of the figures (GitHub Releases, updated weekly) and *Refresh now*. The app keeps fetched figures for half an hour. If fetching fails, the window says so. Installs via the Snap Store do not go through GitHub and are missing.

**Start tour** — the introductory tour again. Effect: closes the settings window and starts the tour from the first step. Where: *Advanced*, under *Tour*.

**Version** — the version number of the app, with two buttons. *Check for updates* opens the update window. *What's new* shows the news of the current version. Where: *Advanced*, under *Version*.

**Show classic view buttons** — a replaced feature, under *Legacy features*. Default: off. Effect: on puts a group *Display* back on the *View* tab with the separate buttons *Columns…*, *Filter…*, *Group…* and *Sort…*. They have been replaced by the plus in the table header, the layout buttons and the layout window. Where: *Advanced*, under *Legacy features*.

## Remembered display choices outside the panel

The app also keeps these choices on this device, but you set them at the item itself, not in the settings panel.

**Baseline overlay** — the active baseline as a thin bar under the task bar. Default: on. Where: *View › Baselines & progress › Baseline overlay*.

**Progress line** — the zigzag line of progress at the status date. Default: on. Effect: the line only appears when the project has a status date, and then replaces the separate status date line. Where: *View › Baselines & progress › Progress line*.

**Status date line** — a dotted line at the status date. Default: on. Effect: if the progress line is on, it draws the marking itself. Where: *View › Baselines & progress › Status date line*.

**Resource accent** — a thin stripe in the resource colour under the task bar. Default: off. Where: *View › Baselines & progress › Resource accent*.

**Float band** — the float as a band behind non-critical bars; not for completed tasks. Default: on. Where: *View › Baselines & progress › Float band*.

**Bar colors** — what the colour of a bar depends on. Choose from *Critical path*, *Per task — automatic* and *By category*. Default: *Critical path*. Effect: applies to the Gantt and the report at the same time. Where: *View › Baselines & progress › Bar colors*.

**Histogram** — the histogram strip under the Gantt. Default: off. Where: *Resources › Histogram › Histogram*, *View › Panels › Histogram* or Ctrl+Shift+H. You set the height of the strip (default 160 pixels, between 80 and 480) by dragging its edge.

**Mini-map** — an overview map of the timeline. Default: off. Where: *View › Presentation › Mini-map*.

**Collapse the ribbon** — a compact ribbon. Default: off. Where: the arrow button at the bottom right of the ribbon.

**Width of the task table** — default 350 pixels, between 150 and 800. You set it by dragging the divider next to the table, or with left arrow and right arrow when the divider has focus.

**Width of the right panel** — default 280 pixels, between 200 and 900. You set it by dragging the edge of the panel.

**Height of *Properties* and *Warnings* in the right panel** — default 240 and 220 pixels, between 120 and 2000. *Properties* has that height when the resource list is open too. You set the height with the drag handle between the sections. The app does not remember whether the sections are open or closed.

**Also remembered, described elsewhere** — the columns of the table ([Adjusting table columns](docs://howto-tabelkolommen-aanpassen)), your layouts ([Creating and using a layout](docs://howto-layouts-gebruiken)), the report options ([Report types](docs://ref-rapporttypes)), your own calculation profile templates ([Calculation options and conventions](docs://ref-rekenopties-en-conventies)) and the *Documentation language* of Help (*File › Help*) are also kept by the app on this device, not in the project file.

## See also

- [Calculation options and conventions](docs://ref-rekenopties-en-conventies): the options that belong to a project.
- [Turning on hour planning](docs://howto-urenplanning-aanzetten): the steps for the switch *Enable hour planning*.
- [Days and hours](docs://uitleg-dagen-en-uren): how the app counts days and hours.
- [Work rules: duration, units and work](docs://uitleg-werkregels): what *Show work rules and work* makes visible.
- [Keyboard shortcuts](docs://ref-sneltoetsen): all keys of the app, including those for zooming and scrolling.
