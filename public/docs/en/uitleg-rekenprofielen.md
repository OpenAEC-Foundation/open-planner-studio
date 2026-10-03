# Calculation profiles and conventions

The same schedule can produce different dates, depending on which calculation rules you apply. This article explains why Primavera P6 and Microsoft Project calculate differently on a few points, how the app records that difference in a **calculation profile**, and how a profile differs from the calculation options you set yourself per project. A worked example with one small network shows what this does to the dates.

## The concept

Tasks, relations and a calendar decide most of a schedule, but not everything. What happens to work that has not started when you set a status date? Where does the remaining work of a task that is already under way begin? What is a task's free float when a deadline is missed? The network says nothing about that. A scheduling package has to pick a rule for it. The app knows a number of points where the rule of Primavera P6 and that of Microsoft Project differ.

The app calls such a choice a **convention**. A **calculation profile** is the set of conventions that belongs to one package. The app has three:

- *Open Planner Studio*: the profile a new project calculates with. No convention is on.
- *Primavera P6*: the conventions the app knows from P6.
- *Microsoft Project*: the conventions the app knows from Microsoft Project.

So the profile says how a package calculates. What you want for your project is not part of it. That is what the **calculation options** are: choices such as how little float makes a task critical, or in which calendar a lag counts. You set those per project.

## How the app calculates

### Conventions and calculation options

A convention is a switch: on or off. The profile decides which switches are on. A calculation option is a choice you make. You can see the difference in the app itself, in the block *Calculation profile and options*:

- **Conventions** are under *Conventions of this profile*, grouped by subject, for example *Progress and completed work*, *Relationships and lag* and *Float and late dates*. Each line is a checkbox with the value of the profile after it (*base: on* or *base: off*). If your choice differs from that, the line stands out and *back to base* appears. The arrow in front of a line opens the explanation of that convention. Read it first if you want to change a convention.
- **Calculation options** are under *Calculation options of this project*: among others *Critical definition*, *Float calculation*, *Open-ended tasks critical*, *Mark near-critical* and *Lag calendar*. They say what you want for this project, not how a package calculates. What they do is explained in [Critical path and float](docs://uitleg-kritiek-pad) and [Relations and lag](docs://uitleg-relaties).

An example of each. "A task is critical if its total float is 0 or less" is a calculation option: you can set the threshold to 4, and then everything with 4 work days of float or less is critical. "Work that has not started moves to the status date" is a convention: Open Planner Studio and Primavera P6 do it, Microsoft Project does not.

The profile and the calculation options belong to the project file, not to the app. If you save the project, they travel with it. Two projects in the same app can therefore calculate with a different profile. A project without a profile calculates as Open Planner Studio.

If there are calculation options that only Primavera knows, the block also shows *Settings from the source file* at the bottom: for a project from a .xer file, but also if you choose *Primavera P6* in *New project* or apply the default options of Primavera P6. You cannot change them here.

### Where you choose the profile

For a new project the profile is in the *New project* window, which you open through *Home › File › New*. There, *Calculation profile* is a drop-down list. If you choose a profile there, the app replaces the calculation options you had already filled in with that profile's defaults; only settings from a source file stay. With *Primavera P6*, *Float calculation* is then *Finish float*. With *Microsoft Project* and *Open Planner Studio* every calculation option is at its default, so *Float calculation* is *Automatic (default)*. With a status date, that is also how MS Project itself calculates: a started task gets the finish float and every other task the smaller of start and finish float.

For an existing project you choose the profile under *Settings › Project › Project info*, in the block *Calculation profile and options*, in the drop-down list *Calculation profile*. You can also reach the same place through *File › Project info*. Switching profile here only changes the conventions. Your calculation options stay as they are. If you also want the default calculation options of the new profile, choose *Apply this profile's default options*.

Until you press *Apply*, a change exists only in the form. With *Apply* the app recalculates the schedule straight away, even if *Calculate automatically* is off. If tasks moved, it says how many, for example *After applying, 4 tasks moved.* The whole switch is one step for *Undo*.

If you switch one convention on or off in a profile, the app turns it into a custom profile. It is called *Copy of Open Planner Studio*, or *Copy of* the profile you started from. You can give it another name and keep it with *Save as template* for other projects in this app. The project always carries its own copy: if you change the template later, the project does not change with it.

### When the app chooses a profile itself

When you open a file, the app suggests a profile based on the format:

- A .mpp file (Microsoft Project) opens with the profile *Microsoft Project*.
- A .xer file (Primavera P6) opens with the profile *Primavera P6*.
- A file in the format *MS Project XML*, *Primavera P6 XML* or *CSV (semicolon-separated)* opens with *Open Planner Studio*, without a profile message.
- Your own project (.ifc) opens with the profile stored in it.

For a .mpp or .xer file the app reports the profile: *This project calculates as Microsoft Project. Change it via File → Project info → Calculation profile and options.* The button *Open calculation profile* in the message takes you straight to Project info. For a .xer file this line is the first detail line of the file's opening message. More about the message is in [Opening a Primavera P6 file (.xer)](docs://howto-xer-openen) and [Opening an MS Project file (.mpp)](docs://howto-mpp-openen).

For a .mpp file the app only sets the profile. The calculation options stay empty, just as in a new project with the profile *Microsoft Project*: *Float calculation* is *Automatic (default)*. An opened .mpp file and a new project with *Microsoft Project* therefore calculate float the same way.

## Worked example: one network, three profiles

The example is a small network. The calendar has a working week from Monday to Friday and no days off in these weeks. The progress mode is Retained Logic (the default). The project starts on Monday 7 June 2027. All tasks are in work days.

- *Pour foundation*: 5 work days, planned from Monday 7 June.
- *Lay walls*: 5 work days, after *Pour foundation* (Finish-Start).
- *Order window frames*: 3 work days, no predecessor, planned from Monday 7 June.
- *Fit roof*: 2 work days, after *Lay walls* and after *Order window frames*. The finish of this task is the handover.

The numbers were calculated with the app's calculation engine. You read them in the *Properties* panel under *CPM Result*.

**Without a status date and without progress, the three profiles calculate this network the same.** *Pour foundation* runs from Monday 7 to Friday 11 June, *Lay walls* from Monday 14 to Friday 18 June and *Fit roof* on Monday 21 and Tuesday 22 June. The handover is Tuesday 22 June. *Order window frames* (Monday 7 to Wednesday 9 June) has 7 work days of total float.

Now you record the status. The status date is Wednesday 9 June. The foundation started on Monday 7 June and stands at 60 %. The remaining work is therefore 2 work days (5 × 40 %). *Order window frames* has not started. How [progress and the status date](docs://uitleg-voortgang) work is in that article. Here the question is what the profile does with it.

### Open Planner Studio

The remaining work of the foundation starts on the status date: Wednesday 9 and Thursday 10 June. The early start stays the actual start, Monday 7 June. The early finish is Thursday 10 June. *Lay walls* runs from Friday 11 to Thursday 17 June and *Fit roof* on Friday 18 and Monday 21 June.

*Order window frames* was planned for Monday 7 June, but has not started. Work that has not started cannot lie in the past. So the app moves it to the status date: Wednesday 9 to Friday 11 June, with 4 work days of total float. The handover is Monday 21 June.

### Primavera P6

Everything is the same as in Open Planner Studio, except one point: the early start of *Pour foundation* is Wednesday 9 June. That is the start of the remaining work, not the actual start. This is done by the convention *In-progress task: early start = start of remaining work*, in the group *Progress and completed work*. The finish and the float do not change because of it. The handover is Monday 21 June.

### Microsoft Project

Here the dates differ. Two conventions in the group *Progress as in Microsoft Project* cause that.

*Don't move unstarted tasks to the status date*: *Order window frames* stays from Monday 7 to Wednesday 9 June, even though that lies partly before the status date. The total float is 7 work days.

*Remaining work resumes after the elapsed duration*: the remaining work starts no earlier than the status date, and no earlier than the actual start plus the duration already elapsed. At 60 % of 5 work days, 3 work days are done. Monday 7 June plus 3 work days is Thursday 10 June. That is after the status date, so the remaining work runs Thursday 10 and Friday 11 June. *Lay walls* runs from Monday 14 to Friday 18 June and *Fit roof* on Monday 21 and Tuesday 22 June. The handover is Tuesday 22 June: one work day later than in the other two profiles.

### What if

**The foundation is at 20 % instead of 60 %.** The remaining work is then 4 work days. Under all three profiles the foundation finishes on Monday 14 June and the handover is Wednesday 23 June. The Microsoft Project convention for the remaining work makes no difference here: Monday 7 June plus 1 elapsed work day is Tuesday 8 June, and that is before the status date. Such a convention is a lower limit that can only make the remaining work later. *Order window frames* and the early start under Primavera P6 still differ, as above. Under Microsoft Project, *Order window frames* then has 8 work days of total float.

**You only set a status date and enter no progress.** Under Open Planner Studio and Primavera P6 the whole network moves to Wednesday 9 June. The foundation then runs from Wednesday 9 to Tuesday 15 June and the handover becomes Thursday 24 June: two work days later than without a status date. Under Microsoft Project everything stays where it was and the handover is Tuesday 22 June.

**You put together a profile yourself.** If you switch on only *Don't move unstarted tasks to the status date* under Open Planner Studio, it becomes a custom profile, *Copy of Open Planner Studio*. With the 60 % progress the foundation then keeps the Open Planner Studio dates (finish Thursday 10 June, handover Monday 21 June). *Order window frames* does stay from Monday 7 to Wednesday 9 June, with 6 work days of total float. So a profile is a bundle of separate switches, and you can change them one by one.

**A calculation option instead of a convention.** If you set *Critical definition* (*Total float ≤ threshold*) to a *Threshold (work days)* of 4 under Open Planner Studio, *Order window frames* becomes critical, because its total float is exactly 4. No date changes. A calculation option is your choice for the project and is independent of the profile.

**A deadline that is missed.** Give *Fit roof* a deadline on Friday 18 June. Under Open Planner Studio the total float of *Fit roof* is then −1 work day and the free float is −1 as well. Under Primavera P6 the total float stays −1, but the free float becomes 0. That is what the convention *Free float never negative* does, in the group *Float and late dates*. Under Microsoft Project both are −2, because the handover falls a day later there. How a deadline works is in [Constraints and deadlines](docs://uitleg-constraints).

## Consequences and misunderstandings

**"The profile is a setting of the app."** No. The profile and the calculation options belong to the project and travel in the file. Only the templates you keep belong to the app, and a project always keeps its own copy.

**"If I export, my profile goes with it."** Only with your own project format (.ifc). If you export to *MS Project XML*, *Primavera P6 XML* or *CSV (semicolon-separated)*, the profile is not in the file. Of the calculation options, the MS Project XML export writes at most the critical threshold. The app only warns about this for a project that came from a .xer file. For a project you made yourself, you get no message. The file then opens as Open Planner Studio, without a profile message. Take the example with the profile Microsoft Project and 60 % progress. If you export it to *MS Project XML* and open it again, the app first shows the dates from the file, with the handover on Tuesday 22 June. If you let the app recalculate itself, that becomes Monday 21 June. What else an export loses is in [Files and formats](docs://uitleg-bestanden).

**"The Primavera P6 profile gives the same result as P6."** The app cannot promise that. The profile switches on the conventions the app knows from P6, and those are not all the settings of P6. Besides Retained Logic and Progress Override, P6 has a third progress mode, Actual Dates. The app does not know it: such a .xer file calculates as Retained Logic, and the opening message reports that, for example as *1 P6 scheduling setting used a safe fallback.* Some conventions of the Primavera P6 profile also only work on tasks that come from a .xer file, such as *Unstarted LOE uses the target window* and *Keep actual dates exact*. For some of them the explanation says so: "only tasks with P6 provenance". On tasks you make yourself, those conventions do nothing.

**"The progress mode is part of the profile."** No. Retained Logic or Progress Override is a separate choice per project. You set it apart from the profile, see [Choosing the progress mode](docs://howto-voortgangsmodus-kiezen). One Primavera P6 convention, *Progress Override ignores a started successor on the late side too*, only does something under Progress Override.

**"I'll just switch profile to see what happens."** You can, because *Apply* is one step for *Undo*: profile and dates go back together. But the dates can really move. In the example, switching from Open Planner Studio to Microsoft Project moves all 4 tasks. The message counts them for you. Look at the schedule afterwards before you carry on. If the app still shows the dates from the file after opening a .xer or .mpp, a profile switch leaves that view and the app calculates itself. How that works is in [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen).

**The example shows four conventions, and the list in the app is longer.** Each line in the block has its own explanation. Read it first. Also look at the group *Custom profiles only*: those conventions are off in every built-in profile, including Primavera P6. If you switch one on, it becomes a custom profile.

## See also

- [Progress, status date and baseline](docs://uitleg-voortgang): what the status date and the remaining work do, with the differences per profile.
- [Choosing the progress mode](docs://howto-voortgangsmodus-kiezen): choosing Retained Logic or Progress Override.
- [Critical path and float](docs://uitleg-kritiek-pad): the calculation options for critical and float.
- [Relations and lag](docs://uitleg-relaties): the calculation option *Lag calendar*.
- [Files and formats](docs://uitleg-bestanden): what an export carries and what it does not.
- [Exporting](docs://howto-exporteren): exporting a project.
- [Updating progress](docs://howto-voortgang-bijwerken): entering percentage, actual start and status date.
- [Dates as recorded](docs://uitleg-datums-zoals-opgeslagen): why imported dates can differ from what the app calculates itself.
