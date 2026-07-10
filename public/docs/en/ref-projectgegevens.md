# Project Information

The **Project Information** window holds the project's metadata plus the **Calculation** section with the scheduling options. The same form also acts as the project wizard for **New**.

## Opening

- **Settings** (ribbon tab) → ribbon group **Project** → **Project info**.
- Settings window (gear ⚙) → **General** tab → **Project information...**
- **File** → **Project info** — a simplified variant in the Backstage, with only the metadata fields (no Calculation section).

**Apply** commits all changes at once; **Cancel**, **Esc** or a click outside the window discards them. **Enter** does the same as Apply.

## Metadata

- **Project Name** — the name in the title bar and the document tab.
- **Description** — free text.
- **Engineer** and **Company** — free text; stored in the IFC file.
- **Start Date** — the project start the calculation counts from.
- **End Date** — informative end of the project.

## Calculation

Scheduling options for this project — they are stored with the file, not the app, so they travel to other machines. If you change anything here, the schedule is recalculated automatically after **Apply**.

- **Critical definition** — **Total float ≤ threshold** (with **Threshold (work days)**, default 0) or **Longest path**.
- **Float calculation** — **Smallest (start/finish)** (default), **Start float** or **Finish float**.
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

The Calculation section is absent from the wizard; set it afterwards through one of the entrances above.
