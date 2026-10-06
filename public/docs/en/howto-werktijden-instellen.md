# Setting working times

Goal: record per weekday at which clock times a calendar works, so that tasks in hours run at the right times.

## When you need this

Friday afternoon is off. The crew works from 06:00 to 22:00 in two shifts. There is a night crew. The break is shorter than an hour. As long as you plan only in days, *Start (hour)*, *End (hour)* and the break are enough ([Creating and assigning a calendar](docs://howto-kalender-maken-en-toewijzen)). If you plan tasks in hours, the app counts working minutes within the **working-time blocks** of the calendar. In the app those blocks are called *bands*: a block is a continuous stretch of working time on one weekday, and a gap between two blocks is a break. What that means for your schedule is covered in [Days and hours](docs://uitleg-dagen-en-uren).

You need *Enable hour planning* for this ([Turning on hour planning](docs://howto-urenplanning-aanzetten)). Without hour planning you do not see the *Working times* block.

## Steps

### Choosing a shift preset

1. Choose *Planning › Calendar › Calendar* and pick the calendar on the left.
2. In the *Working times* block, click a preset. It replaces the work days and working times of the calendar.
3. Click *Apply*.

Each preset does this:

- *Day shift*: Monday to Friday from 08:00 to 16:00 without a break. This turns it back into an ordinary calendar, without working-time blocks.
- *2 shifts*: Monday to Friday from 06:00 to 14:00 and from 14:00 to 22:00, 16 hours in all.
- *3 shifts*: Monday to Friday three shifts, from 06:00 to 14:00, from 14:00 to 22:00 and from 22:00 to 06:00 the next day, 24 hours in all.
- *Night shift*: Monday to Friday from 22:00 to 06:00 the next day, 8 hours.
- *24/7*: all seven days from 00:00 to 24:00.

### Setting working times per weekday

1. In the *Working times* block, click *Set per weekday…*. Under the buttons a row appears per weekday with the working time of that day, and the calendar now has working-time blocks per weekday. If the calendar already has them, this overview is open right away; the button is then called *Hide working times* and folds it in.
2. Adjust the start and end time of each block in the two time fields.
3. If you want to build in a break, click **+** (*Add band*) for that day and adjust the times of the blocks so that there is a gap between them. A new block starts at 08:00 and ends at 16:00.
4. A block that runs past midnight, you tick with *next day*. The block counts for the day on which it begins.
5. Click the bin behind a block to remove it. A day without blocks shows as *Non-working*.
6. For a day from Monday to Friday, click the copy symbol (*Copy to all workdays*) to put the blocks of that day on Monday to Friday.
7. At the bottom is *Derived hours/day:* with the net hours per day that the app derives from this. Click *Apply*.

**Example: a free Friday afternoon.** Click *Set per weekday…*. Remove the second block (13:00 to 16:00) for *Fri*. Friday now has 5 hours, the other days 8. The derived hours per day stay 8.

### Saving a preset of your own

1. Click *Save as preset…* and type a name in the *Name for your own preset* field.
2. Click *Save*. The preset now sits among the other presets, and you can use it in any project. With the cross next to it you remove it again.

A preset of your own is stored on this device, not in the project file.

## Pitfalls and what the app does then

**A preset replaces everything.** If you choose a preset, the work days and working times you set earlier disappear. The holidays stay.

**Day buttons and blocks are two things.** The buttons under *Work days* do not change the blocks. A day gets working time by clicking *Add band* for that day. If you switch a day on with the button only, it counts for tasks in days but not for tasks in hours. With a calendar that has working times, use the rows per weekday.

**Adjusting working times with hour planning off.** If you turn hour planning off again, the fields *Start (hour)*, *End (hour)* and the break come back. On a calendar with working-time blocks they do not change the blocks. So always adjust the working times while hour planning is on.

**No usable working times.** A calendar without blocks or without work days cannot carry a task in hours. The app then reports *This calendar has no valid working times. Check its working days and times.*

## See also

- [Days and hours](docs://uitleg-dagen-en-uren): how the app counts working hours and derives the net hours per day.
- [Turning on hour planning](docs://howto-urenplanning-aanzetten): planning a task in hours.
- [Calendars and working days](docs://uitleg-kalenders): which calendar applies to which task.
- [Calendar windows](docs://ref-kalenders): all fields of the calendar windows.
