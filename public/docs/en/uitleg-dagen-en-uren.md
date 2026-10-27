# Days and hours

A task of 2 days and a task of 16 hours look the same, but the app calculates them differently. Why can you choose between days and hours? And what happens when a task in hours is tied to a task in days? In this article you read how the app counts days and hours. The app does not round: it calculates to the minute. The worked example shows the numbers.

## The concept

A **day task** uses the **day measure**: its duration counts in work days, for example `5d` or `1.5d`. Every work day counts as 1, however long that day is. Part of a day counts by the working time of that day: halfway through the working time is half a day. A day task can also begin in the middle of a day, for example right after an hour task.

An **hour task** uses the **hour measure**: a duration in working hours, for example `12h` or `1h 30m`. It has a start and a finish with a clock time, for example Tuesday 11:00.

The unit belongs to the task, not to the project. You can mix day tasks and hour tasks in one schedule. That is called **mixed planning**.

You use hours for work that does not fit in whole days: a crane you hire for twelve hours, a pour of six hours, a task that can only start after lunch. For everything else days are enough and clearer.

Duration in hours is always editable. Choose the unit on the task; the calendar determines working times.

The rules in this article apply to the scheduling profile *Open Planner Studio*, the default. Under the profiles *Primavera P6* and *Microsoft Project* a day task counts in the hour measure: a day is then the standard workday in hours. The example with the free Friday afternoon shows the difference.

## How the app calculates

### Working times and the standard workday

Every calendar has **working-time blocks** for each work day (called *bands* in the app). The standard calendar has 07:00 to 12:00 and 13:00 to 16:00. The gap is the break. The app derives those blocks from the calendar's *Start (hour)*, *End (hour)* and break; you do not have to set anything for it. If you set blocks of your own per weekday, those take precedence.

The **standard workday** is the workday that occurs most often; its length is the sum of its blocks. So it is not an average: with Monday at 16 hours and Tuesday to Friday at 10 hours, the standard workday is 10 hours. If the work days differ in length, the most common daily total applies, and in a tie the highest. With four days of 8 hours and a Friday of 5 hours, the standard workday is therefore 8 hours. A calendar with its own hours per day (for example from Primavera P6) also calculates with this daily total, and the calendar window shows it. Its own value is kept for the export. If it differs, the calendar window shows an orange block below *Standard workday*. A task of 1870 hours on blocks of 10 hours therefore lasts 187 days, even if its own value is 8 hours per day.

### A task in hours

The app counts working minutes from the start, through the working-time blocks. Breaks, evenings, weekends and holidays do not count. A task of 12 hours therefore does not fit in one work day of 8 hours: it runs on into the next day.

### A task in days

The app counts work days in the day measure. How many hours a day has plays no part. A task of 5 days finishes on the same day whether the calendar has 6 or 8 hours per day. Part of a day is allowed: a task of `1.5d` from Monday 07:00 finishes on Tuesday at 11:00, halfway through Tuesday's working time.

### Converting days and hours

A day is the standard workday of the task's calendar. The app uses that in two places:

- For *Duration display*. Under *Settings › Project › App settings*, tab *Appearance*, you choose *Automatic (native unit per task)*, *Always days* or *Always hours*. A task of 18 hours shows under *Always days* as `2.25d(18h)`: the native unit stays in brackets.
- Under the profiles *Primavera P6* and *Microsoft Project*. There `5d` on a calendar with days of 8 hours is the same as `40h`.

If you switch the unit of a task, the app keeps the finish. In the profile *Open Planner Studio* it counts the days from the start of the task, each day with its own hours. Two days become `16h`, and twelve hours become `1.5d`. On a calendar where Friday has 5 hours, 5 days from Monday become `37h`. If the conversion is not exact, the app leaves the unit as it is.

### Day tasks and hour tasks together

With a Finish-Start relation the successor begins the moment the predecessor is finished, even if that is in the middle of a day. That applies to every combination of day tasks and hour tasks:

- **Hour → hour.** If the predecessor finishes on Tuesday at 11:00, the successor begins on Tuesday at 11:00.
- **Hour → day.** A day task then also begins on Tuesday at 11:00. No unused rest of the day is left.
- **Day → hour.** A day task that ends on a whole day is finished at the end of the working time, for example Tuesday 16:00. The hour task begins at the next working moment: Wednesday 07:00.

### To the minute

The app does not round:

- **A duration in days** may be a fraction. If you type `1.5d`, it becomes one and a half work days. A duration in hours may be `1.5h`, or `1h 30m`.
- **A lag in hours** counts exactly in working hours of the lag calendar, by default that of the predecessor. That also applies after a day task. Breaks, evenings and weekends do not count.
- **A lag in days** may be a fraction: `1.5` is one and a half work days.
- **A lag as a percentage** is an exact part of the duration of the predecessor: 50% of 5 days is 2.5 days.

## Worked example: the crane

The calendar is Monday to Friday from 07:00 to 12:00 and from 13:00 to 16:00: a standard workday of 8 hours. The project starts on Monday 7 June 2027 and calculates with the profile *Open Planner Studio*. *Place crane* and *Adjust elements* use the hour measure, *Finishing* and *Pour foundation* the day measure.

### Hour, hour and day

*Place crane* lasts 12 hours. Monday has 8 working hours (5 until 12:00 and 3 after the break) and Tuesday the last 4 hours. The task runs from Monday 07:00 to **Tuesday 8 June 11:00**.

*Adjust elements* lasts 8 hours and follows with a Finish-Start relation. It begins right away on Tuesday at 11:00: that is 1 hour until the break and 3 hours after it. The last 4 hours are Wednesday from 07:00 to 11:00. The finish is **Wednesday 9 June 11:00**.

*Finishing* lasts 2 days and follows *Adjust elements*. It begins right away, on **Wednesday 9 June 11:00**. The second work day runs until Friday 11:00, so the finish is **Friday 11 June 11:00**.

### The transition from hours to days

If you leave out *Adjust elements* and tie *Finishing* directly to *Place crane*, *Finishing* begins on Tuesday 8 June at 11:00 and finishes on Thursday 10 June at 11:00. *Place crane* keeps no float: nothing of Tuesday stays unused.

Reverse the order and the day task ends at the end of a work day. *Pour foundation* lasts 2 days, from Monday 7 June 07:00 to Tuesday 8 June 16:00. *Place crane* now lasts 4 hours and follows. It begins on **Wednesday 9 June at 07:00** and finishes at 11:00.

### A lag in hours

Between *Place crane* (12 hours) and *Adjust elements* (8 hours) you put a lag of 2 hours. *Adjust elements* then does not begin at 11:00 but on Tuesday at **14:00**: 1 hour until the break, and 1 hour after it. The finish moves along to **Wednesday 9 June 14:00**.

After a day task a lag in hours counts the same way. *Pour foundation* finishes on Tuesday 8 June at 16:00. Without a lag *Finishing* begins on Wednesday 9 June at 07:00. With a lag of 4 hours *Finishing* begins on **Wednesday 9 June 11:00** and finishes on Friday 11 June at 11:00. With a lag of 1 hour it begins on Wednesday at 08:00.

### A free Friday afternoon

Now Friday has only one block, from 07:00 to 12:00: 5 hours. The other days stay at 8 hours. The standard workday stays 8 hours, because that is the most common daily total. A week now has 37 working hours.

A task of 40 hours from Monday 7 June 07:00 uses Monday to Thursday (32 hours) and the Friday (5 hours). The last 3 hours fall on the Monday after, from 07:00 to 10:00. The finish is **Monday 14 June 10:00**.

A task of 5 days depends on the profile. In the profile *Open Planner Studio* the short Friday counts as a whole work day: the task finishes on **Friday 11 June 12:00** and occupies 37 hours. That is also what the app proposes if you switch the unit of 5 days to hours. Under the profile *Primavera P6* 5 days are 40 hours, and the same task finishes on Monday 14 June 10:00.

In tutorial 4, on hour planning, you plan a crane job in hours yourself.

## Consequences and misunderstandings

**"8 hours is 1 day."** Only if the calendar has days of 8 hours. On the calendar with the free Friday afternoon, 5 days in the profile *Open Planner Studio* is 37 hours, not 40.

**"If I set more hours per day, my day task finishes sooner."** No. A day task counts work days. The hours per day only change what a day is worth in hours, for example in the display. Only for a task with resources and the task type *Fixed work* or *Fixed units* does the duration change with it, because the work stays the same: 40 hours of work is 5 days at 8 hours per day and 7 days at 6 hours per day.

**"A task of 8 hours lasts one day."** Only if it starts at the beginning of the day. If it starts later, like *Adjust elements* on Tuesday at 11:00, it runs on into the next day.

**"A day task always begins in the morning."** No. A day task begins the moment its predecessor is finished, like *Finishing* on Wednesday at 11:00. It then lasts until the same moment on its last work day.


## See also

- [Plan a task in hours](docs://howto-taak-in-uren-plannen): the steps to plan a task in hours.
- [Setting working times](docs://howto-werktijden-instellen): adjusting the working-time blocks of a calendar.
- [Calendars and working days](docs://uitleg-kalenders): how the app counts work days and which calendar wins.
- [Adding relations](docs://howto-relaties-leggen): the steps to add a relation or lag.
