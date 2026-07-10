# Reports & printing

A schedule isn't finished until you can share it — on paper for a site meeting, as an image in a
presentation, or as an overview of what's coming up and what has already shifted. That's what the
**Report** tab is for, with three report types and a print preview.

## What you'll learn here

- The three report types on the **Report** tab: Gantt print, milestone overview, variance.
- How the print preview works: paper size, orientation and which elements you toggle on/off.
- How to actually print a report or save it as a file.
- What **Ctrl+P** does in this app.

## Getting to the report screen

There are three ways in to the same screen: click the **Report** ribbon tab, go to
**Backstage → Print** (which opens the report screen directly), or press **Ctrl+P**. All three land
on the same place — there's no separate "print" dialog; the report screen *is* the print preview.

The screen is split into two columns: a settings panel on the left with the **Report type** picker
at the top, and a live preview on the right that updates immediately as you change the settings on
the left.

## The three report types

### Gantt print

A full, formatted printout of the Gantt bars — this is the only report type with a settings block:

- **Paper**: A4, A3 or A1.
- **Orientation**: landscape or portrait.
- **Auto-fit to paper** (on = the schedule scales automatically to the chosen size) or a manual
  **zoom** slider if you turn auto-fit off.
- Toggles for **task names on bars**, **show completion**, **critical path**, **show float**,
  **dependencies**, **weekends** and **legend**.
- A **company** field (auto-fills from the project setting, but is separately editable here) and the
  **author** (read-only, from the project info).

The summary block above it shows the live count of tasks, leaf tasks, critical tasks and relations
in the project.

### Milestone overview

A table of every milestone in the project: WBS, name, kind (automatic/start/finish), date, the
underlying constraint or deadline, float, whether the milestone is mandatory, and status (on
schedule / critical / late). The summary block shows the total milestone count, how many are
mandatory and how many are late. This report has no paper size/orientation settings — it prints the
table exactly as shown.

### Variance

Compares the current schedule against the active baseline: baseline start/finish versus current
start/finish, the difference in working days for start and finish, and a status per task (on
schedule / late / early / new / dropped). If there's no active baseline, the screen states that
explicitly instead of showing an empty report. The summary block also shows the shift in the
project's finish date in working days, if there is one. See the guide
[Baselines & progress](docs://gids-baselines-voortgang) for how to record a baseline before this
report can tell you anything useful.

## Printing and exporting

The settings panel always has a **Print...** button at the bottom — it opens a separate print window
containing the report and immediately triggers the browser/OS print dialog. For the Gantt report,
that window uses the chosen paper size and orientation; the milestone and variance reports print the
table as displayed.

Only the Gantt report also has an **Export PDF** button. That saves the current preview as an
actual PDF file (filename ending in `-planning.pdf`) — one page sized to the physical dimensions
of the chosen paper size and orientation, with the report embedded full-page as an image. Handy
for email or archiving without going through the system print dialog. If you'd rather print
directly (or save to PDF via the system dialog, e.g. to pick a different paper size than the one
configured above), use **Print...**.

## Reports in practice

Each report type serves a different conversation:

- The **Gantt report** is the classic site-meeting handout: the critical path highlighted, float
  visible on the non-critical bars, and the legend explaining what each colour means. Turn on
  **task names on bars** and **show completion** if the audience doesn't already know the schedule;
  turn them off for a clean overview on A1 if a separate task list is handed out alongside it.
- The **milestone overview** is for anyone who only wants the important dates without paging through
  dozens of task rows — for example a client who mainly wants to know whether the mandatory handover
  dates are being met. The ◆ symbol before a milestone name in the table marks a **mandatory**
  milestone.
- The **variance report** is the conversation about correcting course: which tasks are slipping
  relative to the baseline, and by how many working days. See this report in practice in the showcase
  [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc), which has
  two baselines (a contract baseline and a rebaseline after a change order) with their own progress
  and status date — a good example of how the Δ columns fill in once there's an actual difference
  between the baseline and the current schedule.

The live preview on the right refreshes on every change to the settings on the left — there's no
separate "refresh" button, and nothing is computed only at print time.

## Further reading

- A variance report has nothing to compare until a baseline has been recorded — read the guide
  [Baselines & progress](docs://gids-baselines-voortgang).
- The critical path and float shown on the Gantt report come from the same calculation as the Gantt
  view itself — read the guide [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse)
  for how to read that.
