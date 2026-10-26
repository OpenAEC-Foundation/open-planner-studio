# Days and hours

A task of 2 days and a task of 16 hours look the same, but the app calculates them differently. Why can you choose between days and hours? And what happens when a task in hours is tied to a task in days? In this article you read how the app counts days and hours, and where it rounds. The worked example shows the numbers.

## The concept

A **day task** has a duration in whole work days, for example `5d`. It occupies full work days. On the standard calendar it has a start and finish date without a time.

An **hour task** has a duration in working hours, for example `12h` or `1h 30m`. It has a start and a finish with a clock time, for example Tuesday 11:00.

The unit belongs to the task, not to the project. You can mix day tasks and hour tasks in one schedule. That is called **mixed planning**.

You use hours for work that does not fit in whole days: a crane you hire for twelve hours, a pour of six hours, a task that can only start after lunch. For everything else days are enough and clearer.

Duration in hours is always editable. Choose the unit on the task; the calendar determines working times.

## How the app calculates

### Working times and the standard workday

Every calendar has **working-time blocks** for each work day (called *bands* in the app). The standard calendar has 07:00 to 12:00 and 13:00 to 16:00. The gap is the break. The app derives those blocks from the calendar's *Start (hour)*, *End (hour)* and break; you do not have to set anything for it. If you set blocks of your own per weekday, those take precedence.

The **standard workday** is the workday that occurs most often; its length is the sum of its blocks. So it is not an average: with Monday at 16 hours and Tuesday to Friday at 10 hours, the standard workday is 10 hours. If the work days differ in length, the most common daily total applies, and in a tie the highest. With four days of 8 hours and a Friday of 5 hours, the standard workday is therefore 8 hours. A calendar with its own hours per day (for example from Primavera P6) also calculates with this daily total, and the calendar window shows it. Its own value is kept for the export. If it differs, the calendar window shows an orange block below *Standard workday*. A task of 1870 hours on blocks of 10 hours therefore lasts 187 days, even if its own value is 8 hours per day.

### A task in hours

The app counts working minutes from the start, through the working-time blocks. Breaks, evenings, weekends and holidays do not count. A task of 12 hours therefore does not fit in one work day of 8 hours: it runs on into the next day.

### A task in days

The app counts whole work days. The hours per day play no part. A task of 5 days finishes on the same day whether the calendar has 6 or 8 hours per day.

### Converting days and hours

A day is the standard workday of the task's calendar. The app uses that in three places:

- For *Duration display*. Under *Settings › Project › App settings*, tab *Appearance*, you choose *Automatic (native unit per task)*, *Always days* or *Always hours*. A task of 18 hours shows under *Always days* as `2.25d(18h)`: the native unit stays in brackets.
- For a lag in hours after a day task (see *Rounding*).
- When you switch the unit of a task. The app then counts the days from the start of the task, each day with its own hours, and converts the duration immediately if the outcome is exact. Two days become `16h`. On a calendar where Friday has 5 hours, 5 days from Monday become `37h`. Twelve hours cannot be turned into whole days on a calendar with days of 8 hours: the app then leaves the unit as it is.

### Day tasks and hour tasks together

The rules below apply to a Finish-Start relation on a calendar without working-time blocks of its own, such as the standard calendar.

- **Hour → hour.** The successor begins the moment the predecessor is finished, even if that is in the middle of a day.
- **Hour → day.** A day task never begins in the middle of a day. It begins on the first work day after the day on which the hour task finishes. The rest of that day stays unused and comes back as float of the hour task.
- **Day → hour.** A day task occupies its whole last day. The hour task begins on the first work day after it, at the start of the first working-time block.

### Rounding

The app rounds, or refuses, in four places:

- **A day task after an hour task** begins on the next work day. The hour task is, as it were, rounded up to whole days.
- **A lag in hours** counts in the lag calendar, by default that of the predecessor. If the predecessor is a day task on a calendar without working-time blocks of its own, such as the standard calendar, the app converts the lag to whole work days: the lag divided by the hours of the standard workday, rounded to a whole number; half a day rounds up. At 8 hours per day, 1 hour counts as 0 days, 4 hours as 1 day and 12 hours as 2 days. That also applies if the successor is an hour task. If the predecessor is an hour task, or its calendar has working-time blocks of its own, the lag counts exactly in working hours and the break does not count.
- **A duration in days** is always a whole number. If you type `1.5d`, the app reports *Enter a whole number of days or hours, for example 2d or 12h.* A duration in hours may be `1.5h`, or `1h 30m`.
- **Switching the unit** only happens if the outcome is exact (see above).

## Worked example: the crane

The calendar is Monday to Friday from 07:00 to 12:00 and from 13:00 to 16:00: a standard workday of 8 hours. The project starts on Monday 7 June 2027.

### Hour, hour and day

*Place crane* lasts 12 hours. Monday has 8 working hours (5 until 12:00 and 3 after the break) and Tuesday the last 4 hours. The task runs from Monday 07:00 to **Tuesday 8 June 11:00**.

*Adjust elements* lasts 8 hours and follows with a Finish-Start relation. It begins right away on Tuesday at 11:00: that is 1 hour until the break and 3 hours after it. The last 4 hours are Wednesday from 07:00 to 11:00. The finish is **Wednesday 9 June 11:00**.

*Finishing* lasts 2 days and follows *Adjust elements*. A day task does not begin in the middle of a day, so it begins on **Thursday 10 June** and finishes on Friday 11 June.

### Rounding at the transition

If you leave out *Adjust elements* and tie *Finishing* directly to *Place crane*, *Finishing* begins on Wednesday 9 June and finishes on Thursday 10 June. The rest of Tuesday (4 working hours) cannot be used. You see those 4 hours again as the total float of *Place crane*: half a work day.

Reverse the order and it is simpler. *Pour foundation* lasts 2 days, from Monday 7 to Tuesday 8 June. *Place crane* now lasts 4 hours and follows. It begins on **Wednesday 9 June at 07:00** and finishes at 11:00.

### A lag in hours

Between *Place crane* (12 hours) and *Adjust elements* (8 hours) you put a lag of 2 hours. *Adjust elements* then does not begin at 11:00 but on Tuesday at **14:00**: 1 hour until the break, and 1 hour after it. The finish moves along to **Wednesday 9 June 14:00**.

After a day task a lag works differently. *Pour foundation* finishes on Tuesday 8 June. Without a lag *Finishing* begins on Wednesday 9 June. With a lag of 4 hours that is half a day, and the app rounds it up: *Finishing* begins on **Thursday 10 June**. With a lag of 1 hour the app rounds down, and *Finishing* simply begins on Wednesday.

### A free Friday afternoon

Now Friday has only one block, from 07:00 to 12:00: 5 hours. The other days stay at 8 hours. The standard workday stays 8 hours, because that is the most common daily total. A week now has 37 working hours.

A task of 40 hours from Monday 7 June 07:00 uses Monday to Thursday (32 hours) and the Friday (5 hours). The last 3 hours fall on the Monday after, from 07:00 to 10:00. The finish is **Monday 14 June 10:00**. A task of 5 days would occupy 37 hours from Monday, and that is what the app proposes if you switch the unit of 5 days to hours.

In tutorial 4, on hour planning, you plan a crane job in hours yourself.

## Consequences and misunderstandings

**"8 hours is 1 day."** Only if the calendar has days of 8 hours. On the calendar with the free Friday afternoon, 5 days is 37 hours, not 40.

**"If I set more hours per day, my day task finishes sooner."** No. A day task counts whole work days. The hours per day only change what a day is worth in hours, for example in the display and for a lag in hours. Only for a task with resources and the task type *Fixed work* or *Fixed units* does the duration change with it, because the work stays the same: 40 hours of work is 5 days at 8 hours per day and 7 days at 6 hours per day.

**"A task of 8 hours lasts one day."** Only if it starts at the beginning of the day. If it starts later, like *Adjust elements* on Tuesday at 11:00, it runs on into the next day.

**A calendar with working-time blocks of its own** behaves differently from the standard calendar. You get such a calendar by setting working times per weekday or by choosing a shift preset (*2 shifts*, *3 shifts*, *Night shift* or *24/7*). On such a calendar a lag in hours counts exactly in working hours, also after a day task.


## See also

- [Plan a task in hours](docs://howto-taak-in-uren-plannen): the steps to plan a task in hours.
- [Setting working times](docs://howto-werktijden-instellen): adjusting the working-time blocks of a calendar.
- [Calendars and working days](docs://uitleg-kalenders): how the app counts work days and which calendar wins.
- [Adding relations](docs://howto-relaties-leggen): the steps to add a relation or lag.
