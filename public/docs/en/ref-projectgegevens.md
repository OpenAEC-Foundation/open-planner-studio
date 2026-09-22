# Project Information

The **Project Information** window holds the project's metadata plus the **Calculation profile and options** section. The same form also acts as the project wizard for **New**.

## Opening

- **Settings** (ribbon tab) → ribbon group **Project** → **Project info**.
- **File** → **Project info** — the same form in the Backstage, with the same **Calculation profile and options** section.

**Apply** commits all changes at once; **Cancel**, **Esc** or a click outside the window discards them. **Enter** does the same as Apply.

## Metadata

- **Project Name** — the name in the title bar and the document tab.
- **Description** — free text.
- **Engineer** and **Company** — free text; stored in the IFC file.
- **Start Date** — the point the calculation counts from. A task with predecessors is never scheduled before this date; a task without predecessors simply keeps its own, imported date, even if that's earlier than the project start — needed so an imported file (from MS Project, for example) shows exactly what the source program shows. A hard Must-Start-On/Must-Finish-On constraint overrides both rules: such a task always starts on its constrained date, with or without predecessors, even if that's earlier than the project start. If you move the start date here to a later date, Open Planner Studio automatically shifts such too-early, stand-alone tasks forward to the new start date — with a notification, and undoable with Ctrl+Z. That only happens when you deliberately change the start date, via Project Info or the AI assistant — never when opening a file.
- **End Date** — informative end of the project.

## Calculation profile and options

At the top you choose the **Calculation profile**: Open Planner Studio, Primavera P6, Microsoft Project or a template of your own. Below it are the fifteen **Conventions of this profile**; if you change one, Open Planner Studio makes a custom copy of the profile. How that works is covered in the guide **Calculation profiles** (Backstage → Help).

Below those are the **Calculation options of this project** — they are stored with the file, not the app, so they travel to other machines. **Apply this profile's default options** sets them to the defaults of the chosen profile. If you change anything in this section, the schedule is recalculated right after **Apply**, also with *Calculate automatically* off, and a notification reports how many tasks moved.

- **Critical definition** — **Total float ≤ threshold** (with **Threshold (work days)**, default 0) or **Longest path**. When the threshold is in hours, for example from a `.xer` file, the field is called **Threshold (hours, per task calendar)**; choosing another critical definition keeps that threshold.
- **Float calculation** — **Automatic (default)**, **Smallest (start/finish)**, **Start float** or **Finish float**.
- **Open-ended tasks critical** — marks tasks without a successor as critical.
- **Mark near-critical** — ticking it reveals an extra **Threshold** (default 2 work days; the unit follows the Duration display, so possibly hours): tasks with little float get the "near critical" marker.
- **Multiple float paths** — ticking it reveals the **Method** (**Free float (peeling)** or **Total float (ranking)**) and **Max. paths** (default 10): the calculation then numbers the most important float paths.
- **Lag calendar** — which calendar counts a relation's lag: **Predecessor** (default), **Successor**, **24-hour** or **Project calendar**.

How to read these results is covered in [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse).

## The project wizard (New)

**New** opens the same window as a wizard (title **New project**, button **Create**). Besides the metadata fields, the wizard contains:

- **Phasing template** — **Empty**, **Residential construction** or **Commercial / renovation**: fills the new project with a phase structure.
- **Shift** — only visible with hour planning enabled: **Day shift** (default), **2 shifts**, **3 shifts** or **24/7**.
- **Holiday set** — generates the project calendar: pick a country (with region and construction holiday where applicable), **No holidays**, or **Custom…** — the latter opens the calendar dialog right after creation so you can compose the calendar by hand. See [Calendar dialog](docs://ref-kalenderdialoog).
- **Calculation profile** — only the list; a choice also applies that profile's default calculation options. You set the conventions and calculation options afterwards through one of the entrances above.
