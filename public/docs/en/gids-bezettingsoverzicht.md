# Occupancy overview

If you plan several projects that all draw from the same resource library, you'll want to see where each crew is booked across all of those projects — and above all, where the sum of those bookings exceeds what the company actually has. That's what the occupancy overview is for: the third view on the Resources tab, next to **Library** and **Project**. It's a reading window — you see everything, you change nothing from it.

## What you'll learn here

- Opening the overview and reading the table: one row per booked library item, expandable per document.
- Reading the histogram for the selected library item.
- When a resource counts as double-booked.
- What the ⚠ marker means and how to resolve it.
- The key limitation: the overview only sees what's open in this app.
- Why a duplicated document counts in full.

## Opening the overview

Open the projects you want to oversee, each in its own tab, and go to the Resources tab. The view toggle sits in the top right; pick **Occupancy**. The button only exists when the active project is linked to a library — a standalone project has no library context and therefore no occupancy overview. The overview then shows only the open documents linked to that *same* library; documents linked to a different library (or none) contribute nothing.

To see it in action right away: open [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) and [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) side by side — both draw from the same demo resource library, so their crews appear together in one overview.

## Reading the table

Each main row is one library item that is booked somewhere: its name, how many documents it appears in, the overall period of the bookings, and the peak load set against the company capacity (for instance "3.0 / 2.0"). If the item is double-booked anywhere, the row carries a red badge with the number of conflict days and the first conflict dates; rows with conflicts sort to the top.

Expand a row and you get one sub-line per document: the document title, the period in which the resource is booked there, and the peak within that document. That shows you at a glance which projects are claiming the resource and who is causing the overlap.

Library items with no booking in the open documents get no row at all: the overview shows deployment, not a catalogue — the catalogue lives in the **Library** view. Project-only resources (with no library provenance) don't count either; their occupancy is a within-project question, and the regular histogram already answers that one.

## The histogram per resource

Select a main row and a histogram for that library item appears below the table: per day, the stacked contribution of each document (each document in its own colour, with the document titles as the legend), overlaid with the library item's capacity line — steps in the time-phased availability show up in it as visible bends. Days where the stack rises above the line are marked red: the same conflict definition as in the table, not a second calculation. If bookings lie far apart in time, a long empty gap in the time axis is shown compressed with a break mark, so the chart stays readable. Only counted documents feed the histogram; a row with nothing but non-recalculated bookings shows the ⚠ explanation instead of a chart (see below).

## When does a resource count as double-booked?

Per day, the app adds up the load from all qualifying open documents and compares that sum with the capacity of the library item itself — the max units as they stand in the library, including its time-phased availability there. If the sum is *strictly greater* than that capacity, the day is double-booked. A sum exactly equal to the capacity is therefore not a conflict.

Note that the capacity comes from the library, not from the projects. Two projects that each stay neatly within their own max units can still be double-booked together — the company simply has fewer people than both projects combined are claiming. And a single document that on its own books above the company capacity shows up here as a conflict too; the expanded view then immediately reveals there's only one culprit.

## The ⚠ marker: calculated in advance, or actually left out?

Schedules don't recalculate by themselves: you press F5 (or the **Calculate** button) inside a document. If you change something since its last calculation, that document keeps showing its old dates until you press F5 there — but the occupancy overview doesn't wait for that. For such a changed document, the overview calculates it in advance itself, behind the scenes, with the current tasks and relations, and the booking counts normally with the fresh figures. The ⚠ on that booking is then informational: "calculated in advance for this overview — the document itself still shows older dates until you press F5 there." A similarly informational banner appears above the table in that case. If you have the **Calculate automatically** setting switched on, changed documents are updated for real the moment you open the overview — you no longer need to press F5 anywhere, and so you won't see a marker either.

One exception: the document you are editing at that moment — the active tab — is deliberately *not* calculated in advance here, because the overview would then recalculate the whole schedule on every keystroke. That document is included with its last calculated figures, exactly the ones you see next to it in the bar chart; if you have changed something in it since the last calculation, the marking says "out of date: these are the last calculated figures — press F5 in this document". With **Calculate automatically** on, those figures lag by a fraction of a second at most.

Only when that advance calculation itself fails — say, a cycle in the relations, or another calculation error — does the document truly not count, in the sums, peaks and conflict days. That booking stays visible but shows "—" instead of figures, with a ⚠ that does call for action: activate that document (click its tab), fix the error there, press **F5**, and switch back to the occupancy overview. A warning above the table then says that documents are being left out of the tally.

In short: the ⚠ itself is usually harmless — it just means the overview already calculated that document for you. Only a "—" instead of figures means something needs fixing in that document.

## This app only

The occupancy overview only sees the documents that are open in this app. Another window or another application on the same computer doesn't count — let alone a colleague planning on a different machine. There is no shared storage between app instances: bookings opened elsewhere don't exist locally here and therefore don't count — not even if you share the same library through export and import. That boundary sits below the table as a permanent footnote, so you can never read past it.

Files that live somewhere on disk but aren't open don't count either: the overview is about *open* documents, not everything on disk. How sharing libraries between machines does work — and which limits come with it — is covered in the guide [Resource libraries](docs://gids-resourcebibliotheken).

## Duplicates count in full

Duplicate a document — say, to explore a variant — and that duplicate is a fully-fledged open document whose bookings simply count. Original plus variant together can then show a double-booking that in reality exists only once. The overview deliberately doesn't filter that out silently: if you're comparing variants, close them for a moment or read around them.

## Keep reading

- How library and project relate to each other — linking, provenance, deviations: the guide [Resource libraries](docs://gids-resourcebibliotheken).
- Occupancy *within* a single project — the histogram and leveling: the guide [Resources, histogram & leveling](docs://gids-resources-histogram).
