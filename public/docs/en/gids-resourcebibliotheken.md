# Resource libraries

If you work on several projects with the same crews, the same subcontractors and the same calendars, you don't want to maintain their rate, calendar and type separately in every project — retyping them each time and chasing every copy when something changes. That's what a resource library is for: a shared source of resources and calendars that belongs to your organization, lives outside individual projects, and multiple projects can draw from. This guide explains how the library relates to a project, exactly what travels along and what stays per project, and how you switch between the two.

## What you'll learn here

- The distinction between the library (shared, organization-wide) and the project (what this project actually uses).
- Linking a project to a library, or deliberately leaving it standalone.
- The two views on the Resources tab: **Library** and **Project**.
- The three kinds of rows you'll meet in the project view: from the library, project-only, and orphaned.
- Exactly what a library resource brings into the project, and what you set freely per project.
- The three actions that connect the library and the project.
- How the app refreshes copies, and what you get to decide when a copy has drifted.
- Sharing, backup, and their limits.

Follow along with [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) and [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc): opening either showcase automatically links it to one shared demo resource library, and the crews **Timmerlieden**, **Installateurs**, **Stukadoors** and **Schilders** reappear under the exact same name in both — direct proof that one library feeds multiple projects.

## Library and project: two worlds

The **resource library** is the shared source: it belongs to your organization, not to a single project, and outlives any individual project. The **project** decides what this specific project actually puts to work from it — with its own capacity, availability and calendar choice. A project links to exactly one library, or stands entirely on its own: in that case everything simply works as usual, just without a shared source to draw from or write back to.

## Linking a project to a library

You choose the library in two places, which show the same panel:

- The **new project wizard** ("New project"), with a library selector.
- **Project info** for an existing project — both the dialog and **File → Project info**.

That same selector also has **+ New resource library…**, letting you create one on the spot without first going to File → Library. **None (standalone project)** is an explicit choice in the same list — unlinking your project is never an accidental side effect, it's always something you choose deliberately.

## The Resources tab: two views

Once a project is linked to a library, the Resources tab gains a toggle in the top right with two views:

- **Library** — manage the source itself. Everything here is directly editable, a change applies immediately to **every** project drawing from this library, and it falls outside undo (Ctrl+Z) — it isn't a project edit.
- **Project** — what this project actually uses: the regular project table, with per-row markers for provenance and any deviations.

If you work with several open projects that all draw from the same library, there is a third view as well: **Occupancy**. It shows, per library resource, where it is booked across *all* open documents, and flags the days where the sum of those bookings exceeds the company capacity — double-booking between projects, which no single project can see on its own. Read the guide [Occupancy overview](docs://gids-bezettingsoverzicht).

## Three kinds of rows in the project view

In the project view you'll encounter three kinds of rows:

1. **From the library** — marked with the **From the library** badge. Name, type, rate/hour and unit are inherited from the library and shown here as plain text: you don't edit them here, but in the **Library** view. Max units, the time-phased availability and the calendar choice are freely editable, though — that's exactly this project's own commitment.
2. **Project-only** — no badge, fully editable. Even a linked project can have these rows: useful for one-off items that don't belong in the shared library, such as a rented crane or a subcontractor hired for this single job.
3. **Orphaned** — the library original is gone; the row is marked **no longer in the library**. The copy itself keeps working fine — you can unlink it or delete it.

Every row starts with a small color swatch: the **resource color**. New resources automatically get
a free color from a fixed palette, and you can always pick your own here. The color is purely
presentational — it colors the bars in the report export (**Report → Bar colors → By category →
Resource**) and
on screen, but it never counts as a deviation between library and project. On screen you have two
levels: **View → Bar colors → By category → Resource** colors the whole bar (segmented according to
each party's assignment, with the critical path as a red outline), and the separate **Resource
accent** toggle (View → Baselines & progress) adds a thin stripe in the resource color under the
bar. That accent is independent of the selected bar coloring, so it can also be combined with Task
type, Discipline or automatic per-task colors.

## What follows the library — and what doesn't

This is the part worth remembering: some fields are a company-wide agreement and follow the library, others are this project's own commitment and you set them freely, without that ever counting as a deviation.

**Follows the library:**
- Name
- Type
- Description
- Rate/hour
- Unit
- The **content** of a calendar that travelled along with a resource (work days, hours, holidays)

**You decide per project, without it counting as a deviation:**
- Max units
- The time-phased availability
- The **choice** of which calendar is attached to the resource

Assign a library resource, and its calendar travels along as a linked copy that itself keeps following the library — which is why the *content* of that calendar sits in the left-hand list above. But the *choice* of which calendar is attached to a resource sits in the right-hand list: the same crew might run on a different calendar for a rush job than it normally would, without that being a deviation from the library. This distinction is subtle but important: change a library resource's rate or name, and the copy deviates from the library; change its calendar choice or max units, and you're doing exactly what that field is there for.

## Three actions that connect the two worlds

- **Assign to project** — from library to project: creates an editable copy with provenance.
- **To the library** — from a project-only row into the shared library: links it immediately. If an item with the same name already exists in the library, the app links to that one instead of duplicating it.
- **Unlink from library** — provenance disappears, everything becomes fully editable again. A calendar that travelled along unlinks with it, unless another still-linked resource is using that same calendar.

## Refreshing and deviations

The app checks whether your copies still match the library at four fixed moments: when **opening** a file, when **switching** documents, after an **edit in the library**, and after **crash recovery**.

- If a copy has simply fallen behind (you haven't changed it yourself, but the library has moved on since), it's **refreshed silently** — you'll just see a brief notice, no question.
- If a copy has been changed locally (or by someone else), the **differs — decide** marker appears, and the app asks per item what should happen: **Use library values**, **Adopt file values into the library**, or **Decide later**.

These choices can't be undone with Ctrl+Z — the second option changes the library itself, which sits outside the project's undo history altogether.

## Sharing and backup

A project file is always self-contained: hand it to someone without your library, and everything still works, just without a shared source. You export and import a library via **File → Library** — that's also your backup.

When you import, you choose between two options:

- **Add as new resource library** — the library from the file is simply added, as an extra library alongside your existing ones, and never overwrites anything of yours. If the sender had already split off a second library of their own (say, for a separate subcontractor), that library carries its own identity along with it: a project sent together with it immediately recognizes the crews and calendars it was already using as library items again, with nothing for you to sort out. If the sender only ever had one library that was never split off — the everyday case for most people — that automatic recognition doesn't kick in: you link the sent project to the new library yourself, just once, after which matching by name takes over. If you already have that exact library, it's added as a separate copy alongside it instead.
- **Replace an existing resource library** — the entire contents of the library you pick are overwritten with what's in the file. If your own version is newer than the one you're importing, the app warns you about that beforehand.

Which option is preselected depends on the file: if the app doesn't recognize the library yet, "Add as new resource library" is selected; if it does recognize it (the same library, a different version), "Replace an existing resource library" is selected with that library already chosen.

Libraries don't synchronize between machines on their own: if two planners work with the same library on different computers, the libraries can drift apart.

## Demo resource library in the examples

Open one of the showcase examples (**File → Examples**, or from this Help panel), and the app creates a **Demo-resourcebibliotheek** once and links the opened example to it. [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) and [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc) share the same crews from that library, so you can immediately see how one library feeds multiple projects. Your own existing resource libraries are left completely untouched.

## Keep reading

- Assigning resources, reading the histogram, and leveling are all about the project side of resources — read the guide [Resources, histogram & leveling](docs://gids-resources-histogram).
- A resource's linked calendar uses the same building blocks as any other calendar — read the guide [Calendars & hour planning](docs://gids-kalenders-uren).
- See crews shared between projects for yourself in [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) and [Nieuwbouw Appartementencomplex De Vaart](examples://showcase-appartementencomplex.ifc).
