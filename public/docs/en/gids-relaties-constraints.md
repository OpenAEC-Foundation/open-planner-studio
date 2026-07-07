# Relations & constraints

Tasks that stand on their own don't shift when the schedule changes. Relations record that dependency; constraints record a hard or soft requirement on a date. This guide goes deeper into both than [Quick start](docs://quick-start): when do you pick which relation type, what exactly does a lag/lead do, what does a hard pin mean and when should you specifically *not* use it, and how does a deadline relate to a constraint?

## What you'll learn here

- The four relation types (FS/SS/FF/SF) and when to use each.
- Lag and lead, including percentage lag and elapsed-time lag (for example for concrete curing).
- Adding relations three ways: dragging, selection, and the relations table.
- All eight constraint types, plus the hard pin (P6 Mandatory) and the secondary constraint.
- The difference between a deadline and a constraint.

Follow along with the entry-level example [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc) (SNET permit, SS overlap, FF link) and, for the deadline conflict, with [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).

## The four relation types

Every relation has a **Predecessor** and a **Successor**, and one of four types:

- **FS — Finish-Start**: the successor starts only once the predecessor is finished. By far the most common relation in construction: foundation first, then the shell. Use FS when one task physically can't start until the other is done.
- **SS — Start-Start**: both tasks start (roughly) at the same time. Use this when two tasks can run together once the first one gets going — for example wall work and roof structure starting overlapping once the shell is underway, without one waiting for the other to finish.
- **FF — Finish-Finish**: both tasks finish (roughly) at the same time. Useful when two tasks can run independently but must be completed together — for example painting that must finish shortly after tiling, so a room can be handed over in one go.
- **SF — Start-Finish**: the predecessor must start before the successor is allowed to finish. By far the least common type in construction practice — reserve it for edge cases where a finishing task may only stop once another task has started (for example a shift handover).

Want to recognise these first three types in a real example? The "Verbouwing & Aanbouw Eengezinswoning" example contains an FS chain between the main phases, an SS overlap between the wall and roof work, and an FF link between the tiling and painting work.

## Lag and lead

A relation doesn't have to be zero: a **lag** (positive) adds wait time between predecessor and successor, a **lead** (negative, entered as a negative number) lets the successor start earlier — a deliberate overlap. The lag field (**Lag**, in the properties panel and in the relations table) accepts a short notation:

- `2d` — 2 work days of lag (the default unit: days on the project calendar).
- `3ed` — 3 **elapsed** days: calendar days that also run through weekends or holidays. This is the unit you want for, for example, **concrete curing**: concrete keeps curing on Saturday and Sunday too, so a lag of "3 work days" would underestimate the curing time if a weekend falls in between. In that case, set the lag to the elapsed unit.
- `50%` — a percentage lag: 50% of the predecessor's duration, recalculated on every CPM run as the predecessor's duration changes (the same logic as MS Project). Useful when the wait time naturally scales with the size of the preceding task.
- `-25e%` — a negative, percentage elapsed-time lag: a lead of 25% of the predecessor's duration, in elapsed days.

A negative number (lead) means the successor starts while the predecessor is still running — for example tiling that already starts during the last days of plastering in the same room.

## Adding relations

There are three ways to create a relation, depending on where you're already working:

1. **Dragging in the Gantt chart**: hold **Shift** and drag from the predecessor's bar to the successor's bar. As soon as you release, an FS relation with lag 0 is created immediately, and the **Relation type** window appears right away — there you can adjust the type (FS/SS/FF/SF) and the lag without having to open the properties panel.
2. **Selection + button**: select the predecessor first, hold Ctrl/Cmd and select the successor next (in that order), and click **New relation from selection** (the **Relations** ribbon group on the **Planning** tab, or the **Relations** tab itself). This button only works when exactly two tasks are selected.
3. **Directly in the relations table**: open the **Relations** tab (via **Manage** in the Relations ribbon group). The table shows, per relation, the columns **Predecessor**, **Type**, **Lag**, **Successor**, **Driving** and **Free float** — type and lag can be edited directly here, including for relations you created earlier by dragging or selection.

The **Driving** column shows, after a calculation, which relation actually determines the successor's start or finish date — for a task with multiple predecessors, that isn't necessarily the relation you created most recently, but the one with the latest (driving) date.

## Constraint types

A constraint imposes a date boundary on a task, independent of its relations. Open Planner Studio has eight types, set via the **Constraint** field in the properties panel:

- **As soon as possible (ASAP)** — no date boundary, the default.
- **As late as possible (ALAP)** — the task shifts as far as possible within its float.
- **Start no earlier than (SNET)** — a lower bound on the start date (for example: don't start before the permit is granted).
- **Start no later than (SNLT)** — an upper bound on the start date.
- **Finish no earlier than (FNET)** — a lower bound on the finish date.
- **Finish no later than (FNLT)** — an upper bound on the finish date.
- **Must start on (MSO)** — a fixed start date.
- **Must finish on (MFO)** — a fixed finish date.

SNET/SNLT/FNET/FNLT are all **soft boundaries**: the CPM calculation takes them into account, but a violation "only" leads to negative float, not a crash or a block. The "Verbouwing & Aanbouw Eengezinswoning" example uses an SNET constraint, for instance, to keep a task from starting before the permit is granted.

### The hard pin (P6 Mandatory)

MSO and MFO can additionally be made **hard** via the **Mandatory (pin logic)** checkbox, which only appears for these two types. This is the "P6 Mandatory" constraint from Primavera P6: the bar is fixed on the date, even if its predecessors logically contradict that. When you turn on a hard pin, Open Planner Studio shows a one-time warning: **a hard pin overrides the relationships — the bar is fixed on the date, even before its predecessors. A violation becomes negative float upstream.**

So only use a hard pin when a date genuinely isn't negotiable and stands apart from the schedule's logic — for example a legally fixed handover date that stands regardless of progress. Do **not** use it as a rule of thumb for "I want this task to sit on that date": in that case a soft constraint (SNET/FNLT/etc.) or simply a well-planned chain of relations is almost always the better choice. A hard pin can squeeze the whole network upstream: if the preceding tasks want to run through the pin, negative float appears and propagates through the entire chain before the pinned task — a sign the schedule conflicts, not that the pin solved the problem.

### Secondary constraint

For a non-hard constraint (so not ASAP/ALAP and not a hard MSO/MFO), you can add a **secondary constraint**: a second boundary from the same four soft types (SNET/FNET/SNLT/FNLT), which may not bound the same side as the primary one. That lets you set, for example, both a lower and an upper bound on the start date at the same time. Open Planner Studio validates the combination live and shows an error as soon as the combination is invalid — for example a secondary constraint next to a hard pin, which isn't allowed.

## Deadlines versus constraints

A **deadline** (a separate field, properties panel) looks like a constraint but is deliberately different: it's a soft, informational upper bound on the finish date, shown in the Gantt chart as a downward-arrow marker — green as long as the task is still on time, red once its early finish runs past it. A deadline doesn't force the schedule (unlike an MFO/FNLT constraint, which actively participates in the calculation), but it does count as an upper bound when calculating float: if the schedule naturally doesn't meet the deadline, that produces **negative float** without any constraint being involved.

That's exactly what happens in the [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) example: it contains a deliberately tight contract deadline that the schedule's natural duration doesn't meet, resulting in visible negative float — a good example to look at if you want to see what a deadline conflict looks like in practice, without anything being "broken": the schedule simply calculates through and shows where it's under strain.

Rule of thumb: use a **deadline** for a target date you want to monitor without forcing the schedule's logic, and use a **constraint** (soft or, exceptionally, hard) when a date genuinely is a boundary the calculation needs to respect.

## Keep reading

- See SNET, the SS overlap and the FF link in practice: [Verbouwing & Aanbouw Eengezinswoning](examples://showcase-verbouwing-eengezinswoning.ifc).
- See the deadline conflict in practice: [Nieuwbouw 6 Rijwoningen De Akkers](examples://showcase-rijwoningen-de-akkers.ifc).
- Structure not in place yet? Read [Planning & WBS](docs://gids-plannen-wbs) first.
- For calendars and working times that affect task duration: the guide [Calendars & hour planning](docs://gids-kalenders-uren).
