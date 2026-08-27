# Settings

The **Settings** window holds the app settings: preferences that apply to this device, independent of the project file. Every change is applied and saved immediately — there is no OK button. Scheduling options that change the calculated schedule live with the project instead — see [Project Information](docs://ref-projectgegevens).

## Opening — three entrances, same content

- The **gear** (⚙) in the title bar.
- **Settings** (ribbon tab) → ribbon group **Project** → **Settings**.
- **File** → **Settings** (Backstage).

All three show exactly the same settings. Depending on your version they're spread over three or
four tabs — a fourth, **Application**, has recently split off the tail end of the first tab — but
the settings themselves and what they do are identical either way; this article groups them as
**General**, **Language** and **Timeline / Zoom**.

## General tab

**Appearance:**

- **Theme** — **Dark**, **Light** or **High Contrast**; click a card to switch.
- **Font** — **Default**, **System**, **Serif** or **Monospace**; overrides the interface's typeface. Web apps don't automatically follow your system font setting, so this and the next option are how you pick it yourself.
- **Text size** — 90%, 100%, 110% or 125%; scales the interface text and layout.
- **Document switch style** — how you switch between open documents: **Horizontal tabs**, **Vertical tabs** or **Pill**.
- **Date format** — **dd-mm-yyyy**, **mm-dd-yyyy** or **yyyy-mm-dd**. Display only; files and calculations are unaffected.
- **Construction mode** — **Enable construction mode** switches the defaults for *new* projects between construction-oriented (a construction calendar with Dutch public holidays, builders' holiday, phasing templates) and a neutral, construction-agnostic setup. Existing projects are unaffected either way.

**Application:**

- **Version** — the app's version number (read-only), with a **Check for updates** link that opens the update window. Installing updates only works in the desktop app; Snap and AppImage installs update through their own channel. Separately, the first time you open the app after it auto-updated itself, a one-off "You've just been updated" dialog appears on its own — the version jump, the installer size difference, the days since the previous release and the GitHub release notes, whichever of those it could fetch. That's a different, automatic moment from the manual **Check for updates** link here.
- **Project information...** — a shortcut to the [Project Information](docs://ref-projectgegevens) window.
- **Tour** — **Start tour** replays the introductory tour. The same restart also sits on the **View** ribbon tab → **Tour** and in the Backstage (**File** → **Start tour**).
- **Benchmark** — opens the built-in benchmark tool, for measuring this machine's scheduling/rendering performance. You pick a schedule size and a number of resources; the generated schedule has a real relationship network, in which every task without subtasks gets at least one relationship. Pick zero resources to see what the resource load itself costs.
- **AI mode** — **Enable AI mode** shows the **AI** ribbon tab with the MCP bridge, so an AI assistant can work with your schedule over the Model Context Protocol; turning it off stops a running bridge immediately. **Start bridge automatically** (only available with AI mode on) brings the bridge live as soon as the app starts, without visiting the AI tab first — desktop app only. See the in-app AI-assistant guide for the full picture.
- **Debug terminal** — **Enable debug terminal** shows the log panel for troubleshooting.

## Language tab

- **Language** — the app's display language, applied immediately.

## Timeline / Zoom tab

- **Hour planning** — **Enable hour planning** turns on hour/minute scheduling: an hour time-scale, shifts with working-time bands and hour-precise task bars. Off ⇒ new tasks start in days; existing hour tasks remain exact. With the switch on, day and hour tasks can naturally coexist. See [Calendars & hour planning](docs://gids-kalenders-uren).
- **Duration display** — **Automatic (native unit per task)**, **Always days** or **Always hours**.
- **Task bars at interruptions** — **Never split**, **Split when selected** or **Always split**: whether a bar visually splits around non-working days.
- **Timeline axis** — **Show only working days** compresses the timeline: weekends and holidays from the project calendar are skipped, so a 5-workday task is exactly 5 columns wide, whatever the calendar between them looks like.
- **Week starts on** — **Monday** or **Sunday** (week layout of the time scale).
- **Show quarter-hours when zoomed in far** — extra quarter-hour gradation on the hour time-scale.
- **Calculation** — **Calculate automatically** recalculates the schedule as soon as it becomes out of date, instead of waiting for F5.
- **Scroll & zoom** — **Mode**:
- **Zoom + drag** (the default) — the scroll wheel zooms (anchored on the cursor); drag the chart background to pan the view; Shift+scroll wheel scrolls through the rows; Ctrl/⌘+drag draws a selection box.
- **Position** — the cursor's position determines the scroll direction; with **Screen division** (**Left/right**, **Top/bottom** or **Top-right corner**). Ctrl+scroll = zoom, Shift+scroll = horizontal.
- **Keys** — assign which control (**Scroll**, **Ctrl + scroll**, **Shift + scroll**) gets which function (**Vertical**, **Horizontal**, **Zoom**) by dragging the chips; dropping on an occupied slot swaps the controls.
