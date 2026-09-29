# Resource panel

The resource panel is where you manage resources: who and what is available, with what capacity and on which calendar. The histogram under the Gantt and overallocation belong to it. This article says for each field and button what it does, what the default is and what you notice of it. How to create and assign resources is in [Managing resources](docs://howto-resources-beheren) and [Assigning resources with a curve](docs://howto-resource-toewijzen); resolving overallocation is in [Resolving overallocation](docs://howto-overbezetting-oplossen).

## Where to find it

- **Full panel** — *Resources › Manage › Resources* or *View › Panels › Resources*. It takes over the workspace; the cross at the top right closes it.
- **Resource dock** — *Resources › Manage › Resource dock* or *View › Panels › Resource dock*: a compact list in the right-hand column next to the Gantt. See below.
- **Histogram** — *Resources › Histogram › Histogram* or *View › Panels › Histogram*: a strip under the Gantt. See below.
- **Views** — if your project belongs to a resource library, the top right of the panel has a choice between *Library*, *Project* and *Occupancy*. Without a library there is only the project table. Each time you open it, the panel starts on *Project*, so you do not end up in the shared library unnoticed.

## New resource

- **New resource in project** (in the *Library* view *New resource in library*) — button at the top right. Opens a draft row at the bottom of the table. Nothing is created until you enter a name and leave the row (or press Enter); clicking away empty or pressing Esc leaves nothing behind, no resource and no step under *Undo*. You may fill in the fields in any order; everything goes in at once. Enter or the down arrow commits the row and opens a fresh draft row; Shift+Enter or the up arrow commits it and goes back into the table. The draft row lacks the expander for capacity, the calendar pencil and the bin, because they work on a resource that does not exist yet. The button *New resource* on *Resources › Manage* does the same.
- **Grid navigation** — in the table Enter and Shift+Enter, and the up and down arrows, move the cursor between rows. Enter on the last row opens a new draft row.

## The Project view

The table of what this project uses. Each row is a resource. Changes to text and rate take effect as soon as you leave the field and count as one step under *Undo*.

- **Color** — a colour picker. Default: the first free colour from the palette. Effect: the colour of the resource accent under the Gantt bars (*View › Baselines & progress › Resource accent*) and of the swatch in the dock.
- **Name** — the name of the resource. An empty name is not kept; the field falls back to the old name.
- **Type** — *Labor*, *Equipment*, *Material*, *Subcontractor* or *Crew*. Default for a new resource: *Labor*. Effect: *Material* has a *Unit* and does not count in the *All resources* sum of the histogram; leveling skips material. *Crew* can be chosen as the *Crew* of other resources. The other types calculate the same.
- **Max units** — how much of the resource is available per day, a number above 0 (fractions are allowed). Default: 1. Effect: the capacity per day. If the load is higher, the resource is overallocated. The arrow next to it unfolds the *Time-phased capacity*; the number by the arrow is the number of steps.
- **Time-phased capacity** — steps with *From* (a date) and *Max units*. *Add step* adds a step with today and 1. Without steps it says *No steps — the flat max units always applies.* Effect: from the date of a step, its *Max units* applies instead of the flat value; the last step with a date on or before a day wins.
- **Calendar** — a list with *Project calendar* (default), the calendars of the project and *+ Resource calendar* for a new one. The pencil (*Edit…*) opens the chosen calendar and is disabled for *Project calendar*. Effect: the days on which the resource works. On a day off the capacity is 0; if work is planned then, the resource is overallocated with the reason *Does not work this day per calendar "…"*. The resource calendar does not change the dates of a task. See [Calendar windows](docs://ref-kalenders).
- **Rate/hour** — the cost per hour. Empty = no rate; an invalid number falls back. Effect: no influence on the schedule or the load. The rate determines the column *Total*, is stored in the IFC file and is written along when exporting to MS Project (standard rate) and Primavera P6 XML (price per unit).
- **Total** — read-only: the loaded hours × the rate, with two decimals; *—* without a rate or load. At the bottom a line *Total* adds up all resources. The hours come from the last calculation and count units × hours per day of the task's calendar; out of date? Press *Calculate*.
- **Unit** — the unit of measure of the material, for example `m³`. Only fillable for the type *Material* (tooltip *Only applies to resources of type Material.*). Effect: a label; it does not calculate.
- **Crew** — the crew the resource belongs to, from the resources of the type *Crew*. Default: *None*. Effect: grouping only; the capacity and load of a crew are not the sum of its members.
- **Delete** (the bin) — deletes the resource. If it has assignments, the app first asks *'…' has … assignment(s) — delete?* with a tick to confirm and a cross to cancel.
- **To the library** — only when the project belongs to a resource library, for a resource with a name that does not yet come from the library. Puts it in the library, or links it to an existing item with the same name, and reports what happened (*Added.*, *Already existed in the library — now linked.* or *Linked to the existing library item — the values differ, see the marker.*).
- **Unlink from library** — the unlink icon on a resource that comes from the library. Removes the origin, after which all fields are free again.

Without resources it says *No resources yet. Add one to get started.* If the project belongs to a library, it says *This project isn't using any library resources yet.* with a hint.

### Resources from the library

A resource that comes from the library has a small library icon (*From the library*). Its *Name*, *Type*, *Rate/hour* and *Unit* are then plain text (*Library value — edit it in the Library view, or unlink this resource from the library.*), because the library decides what the resource is. *Color*, *Max units*, the capacity steps, *Calendar* and *Crew* stay editable, because the project decides how much and when. Two badges may appear: *differs — decide* (a click opens the *Link resource library* window) and *no longer in the library*, with the button *Remove from project*.

## The Library view

Only when the project belongs to a resource library. See [Using the resource library](docs://howto-resourcebibliotheek-gebruiken) and [Managing and sharing resource libraries](docs://howto-bibliotheken-beheren). At the top is a coloured notice: *This edits the library and applies to all projects — outside undo.* The table has the same fields as the *Project* view with these differences:

- There is no *Total* column: that is a calculation for one project.
- The *Crew* column is there as soon as the library has resources.
- The *Calendar* column offers the calendars of the library, with *No calendar* as default.
- **Assign to project** — puts the resource in the project, with a copy of its calendar. Reports *Added.* or *Already in the project.*
- **Delete** — asks *Remove '…' from the library? This applies to all projects and cannot be undone.*
- Without resources it says *No resources in the pool yet.*

## The Occupancy view

A read-only view across all open documents: which library resources are booked where. There is no button for a new resource. See [Using the occupancy overview](docs://howto-bezettingsoverzicht-gebruiken).

- **Table** — per library resource: *Name*, *Documents* (the number of documents it is in), *Period* and *Peak / Capacity* (the highest combined load against the capacity on that day). A red *N days double-booked* means that across several documents the resource has more than its capacity. The arrow next to a name unfolds the documents, each with period and peak; a click on a row shows the histogram of that resource (*Select a resource to see the histogram.*).
- **What counts** — only documents that are open in this app (*This overview only sees the documents opened in this app.*). A document that has not been calculated gets a message at its line. The active document counts with its last calculated figures (*Out of date: these are the last calculated figures — press F5 in this document.*). Another document is calculated in advance by the overview (*Calculated in advance for this overview — the document itself still shows older dates until you press F5 there or turn on “Calculate automatically”.*); if *Calculate automatically* is on, the overview really calculates those documents. If calculating fails, the document does not count (*Not counted: schedule not calculated — activate this document and press F5.*). Without booked resources it says *No library resources booked in the open documents.*
- **Order** — resources with double bookings are at the top, most conflict days first, then alphabetical.

## The resource dock

A compact list in the right-hand column, next to the *Properties* panel. Per resource: a colour swatch, the name (read-only), a red triangle *Overallocated* as soon as the resource has at least one overloaded day, and *Max units* to edit. If there is a task selection, only the resources of those tasks are listed. In the header are *Full panel* (opens the full panel) and *Close dock*. Without resources it says *No resources yet. Add one to get started.*

## The histogram

A strip under the Gantt that shows the load of a resource per day. Turn it on or off with *Resources › Histogram › Histogram* or *View › Panels › Histogram*. Default: off; your choice is remembered. The height is 160 pixels by default and can be dragged at the edge between the Gantt and the histogram.

- **Picker** — on the left, under the task table, is a list: *All resources* pinned at the top, below it one line per resource. A click chooses the line, the arrow keys step through it, and *Resources › Histogram › Previous* and *Next* do the same. A red dot next to a line means that resource has at least one overloaded day; for *All resources* the dot only looks at resources that are not material. If there is a task selection, the list only contains the resources of those tasks; if your chosen resource falls outside it, the strip temporarily shows *All resources* of the selection.
- **Bars** — one bar per day: the load in units. A line shows the capacity; the part of the bar above the capacity is red. At the top left is the highest value with *units*. *All resources* adds up the load and the capacity of all resources, except material.
- **Tooltip** — hold the mouse still for a moment over a day: *N tasks contribute on {date}* with the names of at most eight tasks. For a chosen resource and a day on which its calendar does not work, it also says *Does not work this day per calendar "…"*.
- **Messages in the strip** — *Recalculate (F5) to show the load* while there is no load, *No resources yet* without resources, and *⚠ Schedule out of date — recalculate (F5)* at the top right when the schedule is out of date.
- **What counts** — the units per day of every assignment, spread over the working days of the task according to the *Curve* (or the *Hour distribution*); only leaf tasks and no milestones. The load refreshes after *Calculate* and after changes to resources and assignments; if you change the dates of tasks, that only counts after *Calculate*.

## Overallocation

A resource is overallocated on a day if its load is higher than its capacity. The capacity is *Max units* (with the capacity steps) on a working day of its calendar, and 0 on a day off. Material does count here. The reason is either too little capacity, or a day on which the resource does not work according to its calendar.

Where you see it:

- **Resources › Overallocation** — the number of overallocated resources, or *None*.
- **Status bar** — *N resource(s) overallocated*; a click opens the *Warnings* panel.
- **Warnings** — a line per resource *Overallocated on N day(s) (first – last)*, with *the resource does not work these day(s) per its calendar* added if all days are days off, or *of which N day(s) the resource does not work per its calendar* for a mix. See [Notifications and warnings](docs://ref-meldingen).
- **Histogram** — the red parts of the bars and the red dot in the picker.
- **Dock** — the triangle *Overallocated*.

Leveling can resolve overallocation by moving tasks within their float; it does not resolve a resource that has to work on a day off. See [Leveling](docs://uitleg-nivelleren).
