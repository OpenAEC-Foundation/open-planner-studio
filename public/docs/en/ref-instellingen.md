# Settings

The **Settings** window holds the app settings: preferences that apply to this device, independent of the project file. Every change is applied and saved immediately — there is no OK button. Scheduling options that change the calculated schedule live with the project instead — see [Project Information](docs://ref-projectgegevens).

## Opening — three entrances, same content

- The **gear** (⚙) in the title bar.
- **Settings** (ribbon tab) → ribbon group **Project** → **Settings**.
- **File** → **Settings** (Backstage).

All three show exactly the same settings, spread over three tabs: **General**, **Language** and **Timeline / Zoom**.

## General tab

- **Theme** — **Dark**, **Light** or **High Contrast**; click a card to switch.
- **Document switch style** — how you switch between open documents: **Horizontal tabs**, **Vertical tabs** or **Pill**.
- **Date format** — **dd-mm-yyyy**, **mm-dd-yyyy** or **yyyy-mm-dd**. Display only; files and calculations are unaffected.
- **Version** — the app's version number (read-only).
- **Updates** — **Check for updates** opens the update window. Installing updates only works in the desktop app; Snap and AppImage installs update through their own channel.
- **Default zoom** — the default zoom level (read-only, 30 px/day).
- **Debug terminal** — **Enable debug terminal** shows the log panel for troubleshooting.
- **Project information...** — shortcut to the [Project Information](docs://ref-projectgegevens) window.
- **Tour** — **Start tour** replays the introductory tour. The same restart also sits on the **View** ribbon tab → **Tour** and in the Backstage (**File** → **Start tour**).

## Language tab

- **Language** — the app's display language; fourteen languages, applied immediately.

## Timeline / Zoom tab

- **Hour planning** — **Enable hour planning** turns on hour/minute scheduling: an hour time-scale, shifts with working-time bands and hour-precise task bars. Off ⇒ the app stays fully day-granular. With the switch on, **Allow mixed day/hour planning** appears (day and hour tasks in one project). If you open a file that contains hour planning while the switch is off, a bar at the top offers **Enable hour planning**. See [Calendars & hour planning](docs://gids-kalenders-uren).
- **Duration display** — **Automatic (native unit per task)**, **Always days** or **Always hours**.
- **Task bars at interruptions** — **Never split**, **Split when selected** or **Always split**: whether a bar visually splits around non-working days.
- **Week starts on** — **Monday** or **Sunday** (week layout of the time scale).
- **Show quarter-hours when zoomed in far** — extra quarter-hour gradation on the hour time-scale.
- **Calculation** — **Calculate automatically** recalculates the schedule as soon as it becomes out of date, instead of waiting for F5.
- **Scroll & zoom** — **Mode**:
- **Position** — the cursor's position determines the scroll direction; with **Screen division** (**Left/right**, **Top/bottom** or **Top-right corner**). Ctrl+scroll = zoom, Shift+scroll = horizontal.
- **Keys** — assign which control (**Scroll**, **Ctrl + scroll**, **Shift + scroll**) gets which function (**Vertical**, **Horizontal**, **Zoom**) by dragging the chips; dropping on an occupied slot swaps the controls.
- **Zoom + drag** — the scroll wheel zooms (anchored on the cursor); drag the chart background to pan the view.
