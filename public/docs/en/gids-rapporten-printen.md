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

- **Paper**: A4, A3, A2 or A1.
- **Orientation**: landscape or portrait.
- **Auto-fit to paper** (on = the time axis is automatically compressed to the chosen size) or a
  manual **zoom** slider if you turn auto-fit off. Even for a multi-year schedule, the activity
  table and report text remain the same physical size on A4, A3, A2 and A1; only the time axis becomes
  denser or wider.
- **Font size** — 90, 100, 110 or 125%; scales the report text, row height and header/footer,
  independently of the zoom level above.
- **Repeat header on each page** — on by default; keeps the report header visible on every printed
  page instead of only the first.
- **Timeline over** — spreads the Gantt timeline across 1 to 8 pages side by side; only available
  with auto-fit on. Choose more pages when you want a less compressed timeline without reducing
  the table text.
- Toggles for **task names on bars**, **show completion**, **critical path**, **show float**,
  **dependencies**, **weekends** and **legend**. With **show completion** off the whole *Compl.*
  column disappears from the task table and the timeline gets that space; the table starts at the
  WBS column, there is no separate row-number column.
- **Truncate task names** — on (default): the name column has a fixed width that you set with the
  **Name column** slider, and a longer name ends in an ellipsis. Off: the column becomes exactly as
  wide as the longest name in the report (indentation included), so nothing is cut off; the
  timeline gets correspondingly narrower. Only an extremely long name is still truncated, so that a
  single name can never claim the whole page.
- **Bar colors** — one choice shared by the on-screen Gantt and the report. *Critical path* gives
  the familiar red/orange/blue; *Per task — automatic* gives every task a stable palette color;
  *By category* lets you select a field from the same list as **Group**. For example, choose
  **Task type** to give construction, installation and demolition one color each, or the
  **Discipline** activity code to color each discipline. WBS, custom fields and **Resource** are
  available too. With Resource, a task assigned to multiple parties gets a segmented bar weighted
  by their assignment. Tasks without a value use neutral gray. Outside *Critical path*, a **red
  outline** keeps critical tasks recognizable and the legend lists only values visible in the
  report. Change the choice under **View** and it updates here immediately — and vice versa. If a
  previously selected project field is absent from the current project, the app temporarily uses
  Task type without forgetting your selection.
- **Status line** — *None* (default), *Status date line* (a vertical dashed line at the project's
  status date) or *Progress line* (the same zigzag line as on screen: per task a bulge toward the
  progress position). Without a status date in the project nothing is drawn — set one first via
  the project info; the panel points this out.
- **Follow view** — when on, the export prints exactly what you see on screen: the active filter,
  grouping, sorting and collapsed groups stay collapsed. Off (default), the export prints the full
  task tree.
- A **company** field (auto-fills from the project setting, but is separately editable here) and the
  **author** (read-only, from the project info).

Relationship lines in the report use the same visual language as the Gantt view: a **solid** line is
a driving relationship, a **dashed** line a non-driving one, and a driving relationship between two
critical tasks is **red**. Turn *critical path* off and those lines go neutral as well. The legend at
the bottom summarises the difference. Before the first calculation every line is drawn neutral and
solid — press *Calculate* (F5) first.

The summary block above it shows the live count of tasks, leaf tasks, critical tasks and relations
in the project. The settings panel remembers your choices between sessions — reopen the Report tab
later and paper size, toggles, font size and the rest come back exactly as you left them. Only the
company field resets: it always starts from the project's own setting, so a report never carries
over another project's company name.

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
of the chosen paper size and orientation. The PDF file is **vector-based**: bars, lines and text
are stored as PDF drawing instructions rather than a single embedded image, so it stays crisp at
any zoom level and the text is selectable and searchable in any PDF viewer. This applies to Latin,
Cyrillic, Greek, Arabic and Persian text — Arabic and Persian are shaped and embedded as vector text
as well. Chinese, Japanese and Korean text is opt-in: install a font extension that supplies those
glyphs and it is embedded as vector too (selectable and searchable); without such an extension that
text is exported as a raster image — still correctly displayed, but not selectable or searchable. Handy for email or archiving without going through the system
print dialog. If you'd rather print directly (or save to PDF via the system dialog, e.g. to pick a
different paper size than the one configured above), use **Print...**.

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
