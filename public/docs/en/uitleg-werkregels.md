# Work rules: duration, units and work

You put one plasterer on the plastering and the task takes four days. If you add a second plasterer, the work can be done in two days. It can also stay four days, with twice as much work in it. Both make sense. Which of the two the app picks depends on the task's **work rule**. In this article you read how the app ties duration, units and work together and what each work rule holds constant.

## The concept

Three quantities are tied together:

- **Duration**: how long the task runs, in work days or in hours.
- **Units**: how much of a resource works on the task per work day. In the app this is called *Units/day*. Units of 1 is one plasterer for the whole day, 2 is two of them and 0.5 is half a day.
- **Work**: the total number of hours the resource spends on the task.

The sum is: work = duration × units × hours per work day. The hours per work day come from the task's calendar. Plastering of four work days with one plasterer is, with an 8-hour work day, 4 × 1 × 8 = 32 hours of work.

If you change one of the three, at least one of the other two has to move along, otherwise the sum no longer holds. The work rule decides which one. You set it per task, in the *Properties* panel. The app only shows the work rule and the work once you turn them on; how that works is in [Choosing a work rule](docs://howto-werkregel-kiezen).

A work rule only works on ordinary tasks. Milestones, phases (summary tasks), hammocks and tasks whose *Duration type* is *Elapsed time* do not have one: the *Work rule* field is not there. Material, such as concrete or plaster mortar, does not count either. The quantity of material never drives the duration and the app never adjusts it because of a work rule.

## How the app calculates

### The rule acts on what you change

The app recalculates duration, units and work only at the moment you change one of them: the task's duration, the units of an assignment, the work, a resource added or removed, or the hours per day in a calendar. **Calculate** (F5) changes none of them: F5 only calculates dates. Choosing a rule does not change a single number either. The rule counts at your next change.

If a work rule changes the task's duration, the schedule becomes out of date. The status bar then says *Out of date — recalculate (F5)*, unless *Calculate automatically* is on.

### Four rules

In the *Properties* panel, under the drop-down, the app shows what the chosen rule protects. The four rules, with the app's own text:

- **Fixed duration and units** (*Protected: duration and units (work follows)*). This is the default. The app never changes the duration itself and the work follows from duration and units. If you type the work yourself, the app adjusts the units, because the duration is fixed.
- **Fixed duration and work** (*Protected: duration and work (units follow)*). The app never changes the duration itself. If you change the duration, the work stays and the units adjust.
- **Fixed work** (*Protected: work (duration follows units)*). The work is fixed and the duration follows from work and units.
- **Fixed units** (*Protected: units (duration follows work)*). The units are fixed and the duration follows from the work.

So two rules leave the duration alone. With the other two the duration moves along when you change the units, the work or the number of resources. With one resource, Fixed work and Fixed units do exactly the same there. They differ when you change the duration yourself: with Fixed work the work stays and the units adjust, with Fixed units the units stay and the work grows along. They also differ when there are more resources on the task (see below).

The worked examples below show what each rule does.

### Rounding

The duration that follows from the sum is rounded up by the app. For a task in days that is to whole work days, for a task in hours to whole minutes. Work and units stay what you entered or what the app took from the sum. As a result the sum sometimes no longer holds exactly. The example below shows what happens then.

### Several resources

If a task has several resources, two agreements apply. With Fixed duration and work, Fixed work and Fixed units, the total work stays the same when you add or remove a resource. The app then divides it in proportion to the units. With Fixed duration and units, a new resource brings its own work instead. With Fixed work and Fixed units the slowest resource decides the duration: per resource that is the work divided by the units, and the largest result counts.

An example: two resources each have 32 hours of work and units of 1, 4 work days together. You set the units of the first to 0.5. The duration then becomes 8 work days. Under Fixed work the second resource keeps its 32 hours of work and its units drop to 0.5. Under Fixed units the second keeps its units of 1 and its work grows to 64 hours.

### Progress

If the task already has progress, the rule works on the remaining part: the remaining duration and the remaining work. In the app that work is called *Work (rem.)*. What has been done stays.

### Tasks in hours

A task you plan in hours calculates the same, but in minutes. If only the crane is on a 5-hour task, that is 5 hours of work. Under Fixed work, the duration for units of 2 then becomes 2.5 hours. The hollow-core floor in the practice project also has the carpentry crew on it. It still needs 5 hours of work, is the slowest, and so the duration stays 5 hours. How hours and days relate is explained in [Days and hours](docs://uitleg-dagen-en-uren).

## Worked example: the plastering

The example is the tutorials' practice project *House extension*. In tutorial 5 you work this out yourself and check the numbers. Here you read what each rule does.

The plastering takes 4 work days. One plasterer is assigned to it, with units of 1, and the work day is 8 hours. So the work is 32 hours.

### Fixed duration and units

- You make the duration 6 work days: the work grows to 48 hours, the units stay 1.
- You set the units to 2: the duration stays 4 work days, the work becomes 64 hours.
- You type 48 hours in *Work (rem.)*: the duration stays 4 work days, the units become 1.5.
- You assign a second resource, for example *Plasterer 2*, with units of 1: the duration stays 4 work days and that second one brings 32 hours of work, 64 hours together.

### Fixed duration and work

- You make the duration 6 work days: the work stays 32 hours, the units drop to 0.67.
- You set the units to 2: the duration stays 4 work days. Because the duration is fixed, the work grows along to 64 hours.
- You type 16 hours in *Work (rem.)*: the duration stays 4 work days, the units become 0.5.
- You assign a second resource, for example *Plasterer 2*, with units of 1: the 32 hours are divided, 16 hours each, and the units become 0.5 for both. The duration stays 4 work days.

### Fixed work

- You make the duration 6 work days: the work stays 32 hours, the units drop to 0.67.
- You set the units to 2: the work stays 32 hours and the duration becomes 2 work days. This is the step you take in tutorial 5.
- You type 48 hours in *Work (rem.)*: the units stay 1 and the duration becomes 6 work days.
- You assign a second resource, for example *Plasterer 2*, with units of 1: the 32 hours are divided, 16 hours each, and the duration becomes 2 work days. Remove that second resource again and the duration is 4 work days again.

### Fixed units

- You make the duration 6 work days: the units stay 1, the work grows to 48 hours.
- You set the units to 2: the work stays 32 hours and the duration becomes 2 work days.
- You type 48 hours in *Work (rem.)*: the units stay 1 and the duration becomes 6 work days.
- You assign a second resource, for example *Plasterer 2*, with units of 1: the 32 hours are divided, 16 hours each, and the duration becomes 2 work days.

### When the sum does not come out

Under Fixed work you set the units to 3. The work is 32 hours, so the duration becomes 32 ÷ (3 × 8) = 1.33 work days. The app rounds that up to 2 work days. Work (32 hours) and units (3) stay, but 2 × 3 × 8 is 48 hours. The histogram therefore spreads the 32 hours over the 2 work days: 2 units per day, not 3. Next to *Work (rem.)* a warning sign appears, *Differs from units × duration*, to show this.

With two resources with different units it works the same way. If, under Fixed work, you add a second resource, for example *Plasterer 2*, with units of 2 to the plasterer with units of 1, the app divides the 32 hours in the ratio 1 : 2, so 10.7 and 21.3 hours. Both then need 1.33 work days. The duration becomes 2 work days.

### A different calendar

Under Fixed work the calendar's work day goes from 8 to 6 hours. The work stays 32 hours, so the duration becomes 32 ÷ 6 = 5.33, rounded up to 6 work days. How the app counts work days and work hours is explained in [Calendars and working days](docs://uitleg-kalenders). The app reports: *After the calendar change the work rule adjusted the duration of 1 task (work stays, hours per day changed).*

### A task with progress

The inner cavity leaf takes 5 work days and is 40% done: 2 work days are done and 3 work days (24 hours) remain. Under Fixed work you set the units from 1 to 2. The remaining work stays 24 hours and the remaining duration becomes 1.5, rounded up to 2 work days. The task now takes 2 + 2 = 4 work days and the progress is 50%. The percentage moves along, because the part that is done stays the same and the remainder gets shorter.

## Consequences and misconceptions

**"Fixed work means the duration is fixed."** No, quite the opposite. With *Fixed duration and units* and *Fixed duration and work* the duration is fixed. With *Fixed work* and *Fixed units* the duration follows from the other two.

**"If I choose a rule, my schedule changes."** No. Choosing changes no number. Only at your next change does the rule decide what moves along. Under a rule that protects work, the app fixes the work at the moment you choose, so there is a number to protect. Such a task then has a stored *Work (rem.)*.

**"The duration changed without me touching it."** That can happen after a change to the units, the work, the number of resources or the hours per day, under Fixed work or Fixed units. The status bar then says the schedule is out of date. Press **Calculate** (F5) to see the new dates.

**Without an assignment a work rule does nothing.** There are then no units and no work to tie to the duration.

**Files from MS Project or Primavera P6 always show the work rule.** For a task from MS Project the text *From MS Project: effort-driven* or *From MS Project: not effort-driven* sometimes appears under the rule. That stored setting changes two cases. With *Fixed duration and work* and effort-driven, the work moves along when you change the duration, instead of the units. With *Fixed units* and not effort-driven, the work moves along when you add or remove a resource, and the duration stays. Tasks you create in the app do not have this setting.

## See also

- [Choosing a work rule](docs://howto-werkregel-kiezen): the steps to set a task's work rule.
- [Assigning resources with a curve](docs://howto-resource-toewijzen): putting a resource on a task, with units and distribution.
- [Days and hours](docs://uitleg-dagen-en-uren): how the app converts days and hours.
- [Calendars and working days](docs://uitleg-kalenders): how the app counts work days and work hours.
