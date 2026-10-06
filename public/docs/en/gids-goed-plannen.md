# Planning well

What makes a schedule good? Not how tidy it looks, but whether it answers the question that matters once work is under way: if this slips, what happens to handover? This article explains the principles behind a reliable schedule, and why they weigh so heavily in Open Planner Studio: the app calculates with what you enter, and with nothing else.

The examples come from construction — structural works, finishing trades, lead times, weather delay, subcontractors, a contractual handover date — but the principles themselves are not construction-specific.

## The concept

A good schedule is not a picture of what you hope for, but a **calculation model**: tasks with a duration, connected by relations, in a calendar. The app calculates the dates from that model. When something changes, the model recalculates and you see straight away what that means for the rest.

A planner works in a fixed order:

1. The goal: milestones and handover date.
2. The breakdown: phases, work packages, tasks.
3. The duration of each task.
4. The relations.
5. Constraints and fixed dates.
6. Calendars.
7. Resources.
8. Critical path and float.
9. Baseline and progress.
10. Review.

That order is not etiquette. Skip a step and it comes back as a surprise: tasks without relations do not move along, durations without a calendar are wrong, and a baseline you only capture afterwards freezes the delay instead of the agreement.

## How the app calculates with it

Each principle below is tied to something the app does. That is why this part follows the same order.

### Start from the goal, not from the tasks

First put down the moments that are fixed, and only then the work that has to fit between them: start of site preparation, permit final, weathertight, start of finishing, handover. Those are **milestones**: points without duration, which you really enter as a milestone (*Home › Tasks › Milestone ▾*) and not as a zero-day task with a name that resembles one.

Why this order: a schedule that starts from a list of tasks becomes a sum, and a sum rarely lands on the date in the contract. Start from the milestones and the question is the right one straight away — not "how long does all of this take together", but "does the work fit between these two moments, and if not, what has to change". Work back from the required handover date to when the building must be weathertight at the latest, and from there to the start.

A handover that is fixed by contract gets the tick box *Mandatory (contractual)*, so that anyone who opens the file sees that this moment is neither negotiable nor movable. The tick box is a marker for the Gantt and the reports; it does not guard a date. You do that with a deadline or constraint (see below).

### The breakdown: phases, work packages, tasks

Below the milestones you build the structure: phases, below them work packages, below those tasks. You do that by indenting. A task with subtasks automatically becomes a **summary task**: the app derives its bar and duration from the tasks below it. So never enter a duration for a summary task yourself.

The rule of thumb for granularity: **a task lasts between roughly one day and two weeks**. Shorter than a day means you are planning the shop floor instead of the project — that belongs in the site manager's weekly plan, not in a calculation model that has to last for months. Longer than two weeks means a task you cannot estimate properly and cannot track during execution: "finishing ground floor, 40 days, 45% complete" tells nobody whether things are going well. Schedule reviews therefore often count how many tasks run longer than about two months; above a few percent that counts as a lack of detail.

Too fine is just as damaging as too coarse. Every task costs maintenance: links to draw, progress to record, a fresh judgement after every change. A two-thousand-task schedule for a six-month project does not become more accurate, it becomes unmaintained — and a schedule nobody updates is fiction within three weeks. Pick the level at which you can report progress honestly, every week.

In practice: "3. Finishing" is a phase, "Finishing house 4" a work package, "Plastering house 4 ground floor" a five-day task. You may deliberately break the upper limit for lead times and supervision: a ten-week window frame delivery genuinely is one indivisible block of waiting, and continuous supervision belongs in a hammock rather than in a series of artificial slices.

### Estimating duration

A duration is an estimate of how long the work takes, not of how fast it could go. Estimate for a normal day with the crew you will actually get, not for the best day with the best crew. Optimism compounds along the chain: a schedule in which every task assumes the best day almost never meets its handover date.

Days or hours is a real choice, not formatting. Choose **days** for work that sets the pace on site — bricklaying, plastering, tiling: it takes five days, whether a day happens to be eight or nine hours. Choose **hours** when the hours themselves are the unit and the remainder of the day matters: a three-hour inspection, a fourteen-hour concrete pour spread over two days, shift work. The app stores that choice per task.

Do not hide risk inside individual durations. Adding a day everywhere buries the margin so that nobody can see or steer it any more — and where the margin was really needed, it turns out to be too small. Make reserve visible: an explicit buffer task before the handover date, or a separate weather allowance. Watch out for double counting: the roughly 180 workable working days a year that Dutch construction reckons with is a contractual annual figure (UAV) from which public holidays, the industry shutdown *and* lost days have already been deducted. If the holidays and the shutdown are already in your project calendar, only weather delay remains as a separate item. Frost and storm delay follow their own rules in the Onwerkbaar weer Bouw & Infra collective agreement. Put those expected lost days in the calendar or in a separate item, not hidden inside the duration of the brickwork.

### Relations: without a network it is not a schedule

The app calculates the dates along the **relations**: a task only starts when its predecessors allow it. A task without relations is not tied to anything. If the structural works slip by two weeks, a disconnected finishing task does not follow, and the schedule lies without anything turning red.

That is why every task gets at least one predecessor and at least one successor. Only the first task of the project and the last milestone are exempt. In a schedule review this is the first check: no more than a few percent of tasks may have missing logic.

**Finish-to-start is the default**, and it should stay that way: foundation complete, then structural works. In a healthy construction schedule roughly nine out of ten relations are finish-to-start. That is a legibility requirement: finish-to-start is the only type everyone on site understands without explanation, and it behaves predictably during execution.

**Start-to-start with a lag** is for work that genuinely runs alongside rather than waits. The classic case is a terrace of houses or a tower with floors: the installer follows three days behind the bricklaying. That is a start-to-start with a three-day lag, not a finish-to-start on an artificially chopped-up task. Put a finish-to-finish next to it, otherwise the successor could in theory finish before the predecessor does. In construction you almost never use start-to-finish.

Preferably draw that start-to-start between tasks, not between phases. If the predecessor of a start-to-start or start-to-finish is a phase, the app makes the successor wait for the task in that phase that starts **last**, not the first one. So it never plans too early, but sometimes later than you meant. Finish-to-start and finish-to-finish with a phase as predecessor wait for the last task in it to finish, and that is usually exactly what you mean.

Be sparing with lags, and especially with negative ones. A lag is waiting time without a visible reason: nobody can tell later why there are seven days in between. If it is concrete curing, make it a lag in calendar days (concrete cures at the weekend too), or better still a real "curing" task that everyone can see and follow. A negative lag — a lead, an overlap — should really not be there at all; in a schedule review the norm is zero. If you want overlap, split the predecessor or use a start-to-start.

### Constraints and fixed dates: as few as possible

Every task starts out "as soon as possible", and in the vast majority of cases it should stay that way. A **constraint** is a date limit next to the relations. The more you add, the less your schedule calculates and the more it becomes a drawing. A plan full of fixed dates looks stable and hides the risk precisely because of that: it no longer moves, so it no longer warns.

Use a constraint only for a hard external date the schedule itself has no influence on: the permit that will not be final before 1 March (*Start no earlier than*), the closure window the municipality has granted, the utility company's connection date. "I want this task in May" is not an external fact; you solve that with logic or a different duration. As a rule of thumb, at most a few percent of the remaining tasks carry a hard date limit.

Never type a start date to get a task into place. For a task with a predecessor, the app turns a typed (or dragged) start into a constraint *Start no earlier than (SNET)*. The task is then where you want it, and it stays there even when the whole chain before it runs late.

If you want to watch a date without steering the calculation, use a **deadline**. It moves nothing, but gives negative float and a warning as soon as the task no longer meets it — exactly the signal you want to see. Keep a hard pin (*Mandatory (pin logic)*) for the extreme case, and then knowing that it gives negative float in the chain before it: that is the schedule saying it does not fit, not that something is broken.

### Calendars: the project first, then the exceptions

All durations count in working days or working hours of a calendar. So set the project calendar up properly before you enter durations: working days, working times, public holidays and the construction holiday. A calendar you correct halfway through shifts your whole schedule. Add the foreseeable closures straight away: the frost period in which you do not pour concrete, the company shutdown between Christmas and New Year.

Only give a resource its own calendar if it really differs: the facade builder who comes four days a week, the crew that takes a different summer holiday. A resource calendar does not change a single date of a task; that keeps running on the task or project calendar. It only shows that the resource does not work on one of the task's working days, as overallocation in the histogram. That difference is hard to see through if you do not know you created it yourself.

### Resources: who does it, and is that possible

A schedule without resources answers only half the question. As soon as you assign the crews and the equipment, the histogram shows what a timeline alone cannot: that on 14 June you need three plastering crews while you have two.

Start with the resources that pinch. Not every screw needs to be in it; the tower crane, your own crews, the subcontractors with a capacity ceiling and the long lead times do. Give each resource an honest capacity: two plasterers means two, not "two, but three in an emergency".

Read the histogram as a question, not as an error. Red above the line means the schedule asks more than you have on that day. Sometimes the answer is: shift. Often the answer is: this will not work, and that is what I wanted to know. **Leveling** shifts tasks until the demand fits within the capacity. If the finish date can breathe, allow that; if the handover date is fixed, level only within the float (the tick box *Level only within slack (smoothing) — project end date stays fixed*). The finish date then stays put and you are left with a reported remaining conflict, which is a more honest outcome than a schedule that only looks solved.

Do *not* level when demand is structurally larger than capacity. Leveling rearranges existing work in time; it does not hire extra plasterers or build a second crane. Three towers that need the same crew at the same time are still three towers that need the same crew after leveling; the only thing that changes is that handover moves out. What does help then is phasing, extra capacity or different work. Do not level before your logic and durations are in place either: you would be leveling a schedule that will be different tomorrow.

### Critical path and float: where the schedule is vulnerable

The app does not recalculate with every change. Calculate with **Calculate** (F5) and only then read. If the status bar says *Out of date — recalculate (F5)*, you are looking at the previous calculation, not this one. With the setting *Calculate automatically* the app does it itself.

The **critical path** is the chain without float: every day lost there is a day later handover. That is where your supervision and your best people go. Do not look only at red. **Total float** says how far a task may run late without affecting handover; **free float** says how far it may run late without moving its successor. The difference affects nobody's finish date but does get in someone's way — useful when you work with subcontractors you cannot reschedule twice.

Watch for three signals. A task with a few days of float is not a safe task but a near-critical one; with *Mark near-critical* such tasks get their own colour. A task with an extreme amount of float — in schedule reviews more than 44 working days, about two months — is almost always missing a successor; that points you straight at the gaps in your network. And negative float is never a calculation error: it is the schedule saying that a deadline or a fixed date does not fit.

### Baseline before the start, then keep it up to date

Capture a **baseline** as soon as the schedule is approved and before a spade goes into the ground (*Planning › Baselines & progress › Manage baselines…*). Calculate first: the baseline stores the dates of the last calculation. Without that reference you can later only say *that* things are going differently, not by how much or since when — and that is exactly what you need in a site meeting, for extra work and when delay is being discussed.

A baseline stores the dates, but not the assumptions behind them, and those are exactly what gets asked as soon as delay is discussed. So when you capture it, write down briefly what this schedule is based on (in scheduling practice: the *schedule basis*): which productivity figures you used, which calendar and why it is set that way, what you deliberately left out of the schedule, who supplied the lead times you assumed, and who approved the schedule. Half a page is enough.

After that, keeping it up to date is a rhythm, not a project. Update weekly, in the same order: set the **status date** to the reporting date, enter actual start and finish dates for what has started and finished, correct the remaining duration of what is running, and calculate. A percentage alone is not enough: actual dates are the factual record that will be looked at later.

Know what the status date does: work that has not started yet is moved to the status date by the app, and the tasks after it move along (except in the calculation profile Microsoft Project). So if you forget to sign off a finished task or milestone, it moves to the right by itself. That is not a fault but the model refusing to pretend that something in the past can still happen. If you get an *Out of sequence* warning, work was done in a different order than the logic prescribes; that is usually a reason to revise the sequence, not to click the warning away. Only make a new baseline for a real change of scope, and then next to the first one, not over it.

Finally: a schedule is only reliable if the people doing the work believe in it. Have the site manager and the subcontractors hold the weekly plan up against this model. If week after week you achieve only half of what was agreed, the problem lies more often in the schedule than in the execution.

## Worked example: three choices that make the schedule lie quietly

The numbers come from two examples worked out elsewhere in Help: the practice project *House extension* from the tutorials, and a small network for an extension. Here the point is what each choice does to your schedule. You try it yourself in tutorial 2 (relations and the critical path) and tutorial 3 (a constraint and a deadline).

### A forgotten relation

In the extension, work starts on Monday 7 June 2027 and handover is on Friday 6 August. *Build outer cavity leaf* (6 work days) has *Install window frames* as its successor, because the frames sit in the facade. With that relation the outer leaf has 2 work days of float.

Forget that relation and the outer leaf suddenly has 23 work days of float, up to handover. On paper it can run weeks late without anyone waiting. Nothing turns red and no warning appears. Only with the calculation option *Open-ended tasks critical* does such a task without a successor become critical, so that the gap stands out.

### A typed date instead of a relation

The small network: *Groundwork* (3 work days), *Pour foundation* (2), *Brickwork* (5) and *Roofing* (3), one after the other, from Monday 7 June 2027. The project is done on Wednesday 23 June.

If you type a start of Monday 21 June for *Brickwork*, because the bricks only arrive then, that becomes a *Start no earlier than*. The brickwork moves a week and the project is done on Wednesday 30 June. *Groundwork* and *Pour foundation* get 5 work days of float and are no longer critical. If the bricks arrive earlier after all, the brickwork stays on 21 June: the date steers now, not the logic.

If you type Wednesday 9 June instead, before the foundation is finished, nothing happens: the relations only let the brickwork start on Monday 14 June anyway.

### A deadline instead of a constraint

If you want *Roofing* finished on Friday 18 June, put a deadline there. Nothing moves: the roofing stays on Monday 21 to Wednesday 23 June. But the chain gets −3 work days of float and the app reports *Deadline 18-06-2027 missed — early finish 23-06-2027*. So you see straight away that the agreement does not fit, instead of a bar in the right place with a chain behind it that does not make it.

## Consequences and misconceptions

- **Tasks without a predecessor or successor.** The most common, and the most damaging: those tasks do not move along and get false float.
- **Typing dates or dragging bars instead of drawing the logic.** That quietly sets a constraint.
- **Too many constraints, and a hard pin used as a bookmark.** The schedule then no longer calculates, it draws.
- **Three-month tasks, or half-day tasks.** Between roughly a day and two weeks is the usable range.
- **Optimistic durations, and margin hidden in every individual task** instead of visible as a buffer.
- **Weather delay and the construction holiday not in the calendar.** They will end up in it in January anyway.
- **Lags instead of tasks.** Seven days of unnamed waiting time is inexplicable three months later.
- **Leveling before the logic is in place**, or continuing to level against a structural capacity shortage.
- **Forgetting to calculate.** *Out of date* in the status bar means you are looking at the previous calculation.
- **No baseline, or a baseline captured only after the start.**
- **Progress recorded as a percentage only**, without actual dates and without a status date.
- **Dismissing the *Warnings* panel without reading it.** That is where the missed deadlines, violated constraints, out-of-sequence relations and overallocated resources come together (*Planning › Schedule › Warnings*).

## See also

- [Critical path and float](docs://uitleg-kritiek-pad): how the app calculates early and late dates and float.
- [Relations and lag](docs://uitleg-relaties): the four kinds of relation, lag and relations on a phase.
- [Constraints and deadlines](docs://uitleg-constraints): what each constraint and a deadline do to the calculation.
- [Calendars and working days](docs://uitleg-kalenders): how the app counts working days and which calendar wins.
- [Days and hours](docs://uitleg-dagen-en-uren): planning in days, in hours, or mixed.
- [Resource leveling](docs://uitleg-nivelleren): what leveling moves and what it does not.
- [Progress, status date and baseline](docs://uitleg-voortgang): what the status date does and how to read variance.
- [Adding tasks and milestones](docs://howto-taken-en-mijlpalen-toevoegen): entering the milestones and tasks.
- [Adding relations](docs://howto-relaties-leggen): linking tasks together.
- [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen): an assistant that plans by these principles.
- [Notifications and warnings](docs://ref-meldingen): all warnings in one place.
