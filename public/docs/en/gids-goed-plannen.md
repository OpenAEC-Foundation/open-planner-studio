# Planning well: from requirements to a reliable schedule

The other guides explain how something works: where the button is, what a field does, how a window
behaves. This guide is about the question that comes before all that — what makes a schedule good? A
good schedule is not a picture of what you hope for, but a calculation model that answers the only
question that matters once work is under way: if this slips, what happens to handover?

What follows is, in the order a planner actually works, what you do and why. For the controls, each
section points to the guide where the buttons live. The examples come from construction — structural
works, finishing trades, lead times, weather delay, subcontractors, a contractual handover date — but
the principles themselves are not construction-specific.

## The order

1. The goal: milestones and the handover date.
2. The breakdown: phases, work packages, tasks.
3. Duration per task.
4. Relationships.
5. Constraints and fixed dates.
6. Calendars.
7. Resources.
8. Critical path and float.
9. Baseline and progress.
10. The final check.

That order is not etiquette. Skip a step and it comes back as a surprise: tasks without
relationships do not move with the rest, durations without a calendar are wrong, and a baseline you
only record afterwards freezes the delay instead of the agreement.

## Start at the goal, not at the tasks

First put down the moments that are fixed, and only then the work that has to fit between them: site
preparation starts, permit irrevocable, watertight, finishing trades start, handover. Those are
milestones — points without duration, which you enter in Open Planner Studio as actual milestones and
not as a zero-day task with a name that merely looks like one.

Why this order: a schedule that starts from a list of tasks becomes a sum, and a sum rarely lands on
the date written in the contract. Start from the milestones and the question is immediately the right
one — not "how long does all of this take", but "does the work fit between these two moments, and if
not, what has to change". Count back from the desired handover date to what must be watertight by
then, and from there to the start.

A handover date fixed by contract is marked as a mandatory milestone, so that anyone opening the file
sees that the moment is neither negotiable nor movable. The three milestone kinds — start, finish,
inspection — and the separate contractual flag are covered in the guide
[Planning & WBS](docs://gids-plannen-wbs).

## The breakdown: phases, work packages, tasks

Under the milestones you build the structure: phases, then work packages, then tasks. In Open Planner
Studio you do that by indenting; a task with subtasks automatically becomes a summary task whose bar
spans the tasks beneath it. So never type a duration on a summary task — it is always derived.

The rule of thumb for granularity: **a task lasts between roughly one day and two weeks**. That is not
an arbitrary number. Shorter than a day means you are scheduling the shop floor rather than the
project — that belongs on the site manager's weekly plan, not in a CPM model that has to last for
months. Longer than two weeks means you have a task you cannot estimate honestly and cannot follow
during execution: "ground floor finishing, 40 days, 45% complete" tells nobody whether things are
going well. Schedule reviews therefore often count how many tasks run longer than about two months;
above a few percent that counts as a lack of detail.

Too fine is just as damaging as too coarse, and that is underestimated. Every task costs maintenance:
links to draw, progress to record, a fresh judgement after every change. A two-thousand-task schedule
for a six-month project does not become more accurate, it becomes unmaintained — and a schedule
nobody updates is fiction within three weeks. Pick the level at which you can report progress
honestly, every week.

In practice: "3. Finishing" is a phase, "Finishing house 4" a work package, "Plastering house 4
ground floor" a five-day task. You may deliberately break the upper limit for lead times and
supervision — a ten-week window frame delivery genuinely is one indivisible block of waiting, and
continuous supervision belongs in a hammock rather than in a series of artificial slices.

## Estimating duration

A duration is an estimate of how long the work takes, not of how fast it could go. Estimate for a
normal day with the crew you will actually get, not for the best day with the best crew. It sounds
obvious and it is still the most common mistake: optimism compounds along the chain, and a schedule
in which every task assumes the best day almost never meets its handover date.

Days or hours is a real choice, not formatting. Choose **days** for work that sets the pace on site —
bricklaying, plastering, tiling: it takes five days, whether a day happens to be eight or nine hours.
Choose **hours** when the hours themselves are the unit and the remainder of the day matters: a
three-hour inspection, a fourteen-hour concrete pour spread over two days, shift work. Open Planner
Studio stores that choice per task and never converts silently; how exactly that works is in the guide
[Calendars, working days and working hours](docs://gids-kalenders-uren).

Do not hide risk inside individual durations. Adding a day everywhere buries the margin so that
nobody can see or steer it any more — and where the margin was really needed, it turns out to be too
small. Make reserve visible: an explicit buffer task before the handover date, or a separate weather
allowance. For outdoor work in winter that is not a luxury — but watch out for double counting. The
roughly 180 workable working days a year that Dutch construction reckons with is a contractual annual
figure (UAV) from which public holidays, the industry shutdown *and* lost days have already been
deducted. So if the holidays and the shutdown are already in your project calendar, only weather
delay remains as a separate item — do not add the annual figure on top of it again. Frost and storm
delay follow their own rules in the Onwerkbaar weer Bouw & Infra collective agreement. Put those
expected lost days in the calendar or in a separate item, not hidden inside the duration of the
brickwork.

## Relationships: without a network it is not a schedule

Every task gets at least one predecessor and at least one successor. Only the first task of the
project and the last milestone are exempt. A task without relationships stands still while everything
else moves: if the structural works slip by two weeks, a disconnected finishing task does not follow,
and the schedule lies without anything turning red. This is the most common fault in schedules that
look tidy at first glance, and in a schedule review it is the first check: no more than a few percent
of tasks may have missing logic.

**Finish-to-start is the default**, and it should stay that way: foundation complete, then structural
works. In a healthy construction schedule roughly nine out of ten links are finish-to-start. That is
not dogma but a legibility requirement — finish-to-start is the only type everyone on site
understands without explanation, and the only one that behaves predictably during execution.

**Start-to-start with a lag** is for work that genuinely runs alongside rather than waits. The classic
case is a terrace of houses or a tower with floors: the bricklaying does not have to be finished
before the installer starts, he follows three days behind. That is a start-to-start with a three-day
lag, not a finish-to-start on an artificially chopped-up task. Put a finish-to-finish next to it,
otherwise the successor could in theory finish before the predecessor does. Do not use
start-to-finish; in construction there is almost never a good reason for it.

Preferably draw that start-to-start between tasks, not between phases: for a start-to-start or a
start-to-finish whose predecessor is a summary task, Open Planner Studio deliberately calculates on
the safe side — it makes the successor wait for the last-starting subtask instead of the first one,
so it never plans too early but sometimes too late. Finish-to-start and finish-to-finish on a summary
task are exact.

Be sparing with lags, and especially with negative ones. A lag is waiting time without a visible
reason — nobody can tell later why there are seven days in between. If it is concrete curing, make it
a lag in elapsed days (concrete cures at the weekend too), or better still a real "curing" task that
everyone can see and follow. A negative lag — a lead, an overlap — should really not be there at all:
in a schedule review the norm is zero. If you want overlap, split the predecessor or use a
start-to-start; a lead also hides a sequence you will never recover once something moves.
Relationship types, lags in working days versus elapsed days and
percentage lags are covered in the guide
[Relations & constraints](docs://gids-relaties-constraints).

## Constraints and manual dates: as few as possible

Every task starts out "as soon as possible", and in the vast majority of cases it should stay that
way. A constraint is a date limit that overrides the logic; the more you add, the less your schedule
calculates and the more it becomes a drawing. A plan full of fixed dates looks stable and hides the
risk precisely because of that: it no longer moves, so it no longer warns.

Use a constraint only for a hard external date the schedule itself has no influence over: the permit
that will not be irrevocable before 1 March (start no earlier than), the road closure period the
council has granted, the utility company's connection date. Those are facts from outside. "I want
this task to sit in May" is not a fact from outside — solve that with logic or with a different
duration. As a rule of thumb no more than a few percent of remaining tasks should carry a hard date
limit; above that you are steering your schedule by hand.

Never type a start date directly to get a task where you want it. That is the digital version of
dragging the bar: it sits where you put it, and it stays there even when the whole chain in front of
it runs late. If you want to watch a date without forcing the calculation, use a deadline: it enforces
nothing, but it does produce negative float the moment you stop meeting it — exactly the signal you
want. Save a hard pin for the extreme case, and then in the knowledge that it creates negative float
upstream: that is the schedule telling you it does not fit, not that something is broken.

## Calendars: the project first, then the exceptions

Get the project calendar right before entering durations: working days, working hours, public
holidays and the industry shutdown. Every duration is expressed in it, so a calendar you correct
halfway through moves your entire schedule. Add the foreseeable stoppages straight away — the frost
period in which you will not pour concrete, the closure between Christmas and New Year.

Give a resource its own calendar only when it genuinely differs: the façade contractor who comes four
days a week, the crew with different summer holidays. Do not do it "to be safe". A resource calendar
does not touch the task's dates — those keep running on the task or project calendar — but it does
affect load and levelling. The result is a difference that is hard to see through unless you know you
created it yourself: the task runs on a day the resource does not work, and that comes back as a
shortfall in the histogram. The full model is in the guide
[Calendars, working days and working hours](docs://gids-kalenders-uren).

## Resources: who does it, and can they

A schedule without resources answers only half the question. As soon as you assign the crews and the
plant, the model can do something a timeline alone cannot: show that on 14 June you need three
plastering crews while you have two.

Start with the resources that pinch. Not every screw needs to be in there; the tower crane, your own
crews, the subcontractors with a capacity ceiling and the long lead times do. Give every resource an
honest capacity — two plasterers means two, not "two, but three at a push".

Read the histogram as a question, not as an error. Red above the line means the schedule asks for more
than you have that day. Sometimes the answer is: shift it. Often the answer is: this will not work,
and that is what I wanted to know. Level when there is room and the end date may breathe, or level
within the existing float (*smoothing* — that is what the button is called) when the handover date is
fixed — the end date then stays put and you are
left with a flagged residual conflict, which is a more honest outcome than a plan that merely looks
solved.

Do not level when demand is structurally larger than capacity. The leveller rearranges existing work
in existing time; it does not hire extra plasterers and does not conjure a second crane. Three towers
that need the same crew at the same time remain three towers that need the same crew; the only thing
that changes is that handover moves out by months. The intervention that does help is phasing, extra
capacity, or different work. Nor should you level before the logic and durations are settled: you
would be levelling a schedule that is different tomorrow. The controls, the curves and the limits of
levelling are in the guide
[Resources, histogram & leveling](docs://gids-resources-histogram).

## Critical path and float: where the schedule is fragile

Calculate — with F5 or the **Calculate** button — and only then read. Open Planner Studio deliberately
does not recalculate on every change unless you turn on **Calculate automatically**; if the status bar
says "Out of date", you are looking at the previous schedule and not at this one.

The critical path is the chain without float: every day lost there is a day later at handover. That
is where your supervision and your best people go. But do not look only at red. Total float says how
far a task may run late without touching the handover date; free float says how far it may run late
without setting its next successor in motion. The difference is the float that touches nobody's end
date but does get in someone's way — useful when you work with subcontractors you cannot reschedule
twice.

Add those columns to the task table — via **View → Columns…** — and watch for three signals. A task
with a couple of days of float is not a safe task but a near-critical one; turn on the near-critical
threshold and you see them in a colour of their own. A task with an extreme amount of float — more
than about two months, counted in schedule reviews as 44 working days — is
almost always a task missing a successor rather than one that genuinely has that much room; that is
one of the standard checks in a schedule review, and it points you straight at the holes in your
network. And negative float is never a calculation error: it is the schedule saying that a deadline or
a pinned date does not fit. Multiple equally critical paths, hammocks and the calculation settings are
covered in the guide [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse).

## Baseline before the start, then keep it up

Record a baseline as soon as the schedule is approved and before a spade goes into the ground.
Without that reference you can only say later that things are running differently, not by how much and
from when — and that is exactly what you need in a site meeting, in a variation claim and when delay
is being discussed. Recalculate first, or you will freeze stale dates.

**Record what you planned on.** A baseline preserves the dates, but not the assumptions behind them —
and those are exactly what gets asked for once delay is being discussed. So when you record the
baseline, write down briefly what this schedule rests on (the *schedule basis*): which productivity
figures you used, which calendar and why it is set that way, what you deliberately left out of the
schedule, whose lead times you adopted, and who approved the schedule. Half a page is enough; without
that page nobody can reconstruct six months later whether an overrun came from the execution or from
an assumption.

After that, updating is a rhythm, not a project. Update weekly, in the same order: set the status date
to the reporting date, enter actual start and finish dates for what has started and finished, correct
the remaining duration of what is running, and calculate. A percentage on its own is too little —
actual dates are the evidence people will look at later.

Know what the status date does: work that has not started cannot start before it (a project imported
from MS Project follows MS Project's own convention there and does not shift). Forget to close out
a completed milestone and it drifts to the right on its own — not a bug, but the model refusing to
pretend that something can still happen in the past. If you get out-of-sequence warnings, work has
been done in a different order than the logic prescribes; that is usually a reason to revisit the
sequence, not to dismiss the warning. Re-baseline only on a genuine scope change, and then alongside
the first one rather than over it — otherwise you lose what was originally agreed. All of this is in
the guide [Baselines & progress](docs://gids-baselines-voortgang).

Finally: a schedule is only reliable if the people doing the work believe in it. Let the site manager
and the subcontractors hold their weekly plan against this model. If week after week you achieve only
half of what was agreed, the problem lies more often in the schedule than in the execution.

## Common mistakes

- Tasks without a predecessor or successor. The most common one and the most damaging: those tasks do
  not move with anything.
- Typing dates or dragging bars instead of drawing the logic. That quietly sets a constraint.
- Too many constraints, and using a hard pin as a bookmark.
- Three-month tasks, or half-day tasks. Between roughly one day and two weeks is the usable range.
- Optimistic durations, and margin hidden in every single task instead of visible as a buffer.
- Weather allowance and the industry shutdown missing from the calendar. They arrive in January
  regardless.
- Lags instead of tasks. Seven days of waiting without a name is inexplicable three months later.
- Levelling before the logic is settled, or continuing to level against a structural capacity
  shortfall.
- Forgetting to calculate. "Out of date" in the status bar means you are looking at the previous
  schedule.
- No baseline, or a baseline recorded only after the start.
- Tracking progress as a percentage only, without actual dates and without a status date.
- Dismissing the warnings panel without reading it. That is where missed deadlines, violated
  constraints, out-of-sequence links and overallocated resources sit together.

## Further reading

- [Quick start](docs://quick-start) — the controls in ten minutes, from empty project to calculated
  schedule.
- [Planning & WBS](docs://gids-plannen-wbs) — structure, summary tasks and milestones.
- [Relations & constraints](docs://gids-relaties-constraints) — relationship types, lag and lead, and
  every constraint type.
- [Calendars, working days and working hours](docs://gids-kalenders-uren) — days versus hours,
  calendars and holidays.
- [Resources, histogram & leveling](docs://gids-resources-histogram) — assigning, overallocation and
  levelling.
- [Critical path & advanced analysis](docs://gids-kritiek-pad-analyse) — float, near-critical work and
  the calculation settings.
- [Baselines & progress](docs://gids-baselines-voortgang) — baseline, status date and progress.
- [Warnings panel](docs://ref-waarschuwingen) — every warning in one place, with a jump to the task.
