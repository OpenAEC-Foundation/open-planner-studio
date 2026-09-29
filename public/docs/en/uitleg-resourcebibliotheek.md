# The resource library

Your bricklaying crew does not work for one project only. Today it is on the houses in the north, tomorrow on the garages in the south. A resource library is the place where you record such a crew once, so that every project uses the same crew. The app can then also see when two projects ask for the same people on the same day, which no single project can see. In this article you read how library and project relate to each other and how the app counts occupancy across projects.

## The concept

There are two layers.

The **resource library** is the list of resources and calendars that belong to your organization: a bricklayer, a crane, a plasterer, with their type, rate and how many of them you have. The list itself, which the app also calls the **pool**, is not in your project files but in the app: in the desktop app in a file on this computer, in the browser in that browser's storage. If you clear the site data in the browser, the library is gone; so export it as a backup. There is always at least one library. The first one is called *Mijn resourcebibliotheek* (a Dutch name) and you can rename it.

The **project** decides how much of a resource it uses and when. A project is linked to one library or stands alone. A standalone project works fine, just without a shared list.

A project does not point to the library but keeps a **copy**. When you assign *Bricklayer* from the library to a project, the app makes a copy in the project with an **origin stamp**: the note that this copy comes from library X and is item Y there. In the resource table you recognize such a copy by a small library icon. The copy is an ordinary resource: tasks can be assigned to it, and it is stored in the project file itself.

The calendars in the resource library are something else than your project's list of calendars, which you manage in the calendar dialog. A library calendar comes into your project along with a resource that uses it.

## How the app works with it

### What the library decides and what the project decides

The library decides **what a resource is**: the name, the type, the rate per hour, the unit and the description. In a project copy those fields appear as plain text. You change them in the library, so that they are right in every project. If you want a copy to go its own way after all, you unlink it from the library.

The project decides **how much and when**: *Max units*, the capacity that changes over time (*Time-phased capacity*) and which calendar the resource has. Those fields stay editable in the project and do not count as a deviation from the library. After all, the same crew may run a different calendar on a rush job than on a regular project. The content of a calendar that came along with a resource does follow the library.

### When a copy follows along

The library does not refresh the copies continuously, but at fixed moments:

- When you edit something in the library, the unedited copies in all open projects follow immediately.
- When you open a project or switch to another tab, the app compares the copies with the library. If an unedited copy is behind, the app updates it silently and reports that briefly: *1 item updated from the library* or *N items updated from the library*.

The app remembers the values from the moment the copy was made or updated. If a copy now differs from those, the app does not decide who is right. The copy then gets the marker *differs — decide*. When you open a file with such a copy, the *Link resource library* window opens by itself. There you choose per item whether the library values apply, or whether the values from your file go into the library. When you switch tabs, no window ever appears.

A deviation arises, for example, when you link an own resource in the project to a library item with the same name but different values, using *To the library*. The app does link them, and marks the copy as deviating straight away.

### When a resource disappears from the library

If you delete a resource from the library, the copy stays in your projects and keeps working. It gets the marker *no longer in the library*, and you can then edit it fully or remove it from the project.

### Occupancy across projects

The histogram and the overallocation in a project only look at that one project. The library knows more: how many of a resource there are in total. The *Occupancy* view adds up, per day, the load of all open projects that are linked to the same library and use a copy of that resource. If the sum on a day is greater than the capacity of the library, that day counts as double-booked.

Three rules decide what counts:

- The capacity comes from the library (*Max units* of the library item, or its *Time-phased capacity* on that day), not from the *Max units* of the project copy. Two projects that each stay within their own allocation can therefore still ask for too much together.
- A sum that is exactly equal to the capacity is not a conflict. More than the capacity has to be asked for.
- Only copies with an origin stamp count, and only in projects that are open in this app at that moment. An own resource of a single project is not in the library and therefore does not count. The overview does not see documents that are not opened in this app; that is also stated at the bottom of the overview itself.

## Worked example: the bricklaying crew in two projects

The library contains the resource *Bricklayer* with *Max units* 3: three bricklayers on the payroll. Two projects use it, both with a copy that has *Max units* 2.

- *Houses North* has the task *Bricklaying facades* of 5 working days from Monday 7 June 2027, with 2 units per day. The task runs from 7 to 11 June inclusive.
- *Garages South* has the task *Bricklaying garages* of 4 working days from Wednesday 9 June 2027, with 2 units per day. The weekend does not count, so the task covers 9, 10, 11 and 14 June.

Within each project the bricklayer is asked for 2 of his 2 units. Neither project reports overallocation: under *Resources › Overallocation* both say *None*. Yet together they exceed the 3 bricklayers. Per day the app counts:

- Monday 7 and Tuesday 8 June: 2 (only Houses North)
- Wednesday 9, Thursday 10 and Friday 11 June: 2 + 2 = 4
- Monday 14 June: 2 (only Garages South)

The peak is 4 against a capacity of 3. The overview shows the bricklayer with *2 documents*, the period *2027-06-07 – 2027-06-14*, *4.0 / 3.0* for peak and capacity, and *3 days double-booked*: 9, 10 and 11 June.

What if you change something:

- If *Bricklaying facades* takes 6 working days, it runs until Monday 14 June. That day also reaches 2 + 2 = 4, so the overview reports *4 days double-booked*: 9, 10, 11 and 14 June. The peak stays 4.
- If the library has *Max units* 4, it says *4.0 / 4.0* and there is no conflict, because the sum is not greater than the capacity.
- If *Garages South* works with 1 unit per day instead of 2, the peak is 3 and it says *3.0 / 3.0*: no conflict.
- If *Garages South* only starts on Monday 14 June, the projects do not overlap. The period becomes *2027-06-07 – 2027-06-17* and the peak is *2.0 / 3.0*.

The steps for looking at this in your own projects are in [Using the occupancy overview](docs://howto-bezettingsoverzicht-gebruiken).

## Consequences and misconceptions

**"The library is shared with my colleagues."** No. The library lives in the app (in the desktop app in a file on this computer, in the browser in that browser's storage) and is not synchronized. If two planners work with the same resource library, their libraries can diverge. You can share by exporting and importing, see [Managing and sharing resource libraries](docs://howto-bibliotheken-beheren). If your organization shares crews across operating companies, deliberately choose one shared library. The overview also only sees the projects that are open in this app.

**"If I change the library, everything in my projects changes."** Only the identity of the resource: name, type, rate, unit and description. *Max units*, the capacity over time and the calendar choice of a project stay as they are.

**"I can undo a library change."** No. The library belongs to the app and not to a project, so changes to it fall outside *Undo* (Ctrl+Z). The *Library* view warns about this itself: *This edits the library and applies to all projects — outside undo.* Deleting from the library also asks for confirmation and cannot be undone.

**"The occupancy overview resolves the double booking."** No, the overview is only a read-only window. It shows on which days two projects together ask for too much. Leveling (*Resources › Leveling › Level…*, see [Resource leveling](docs://uitleg-nivelleren)) looks at the resources of one project and does not take the other projects into account. Move a task in one of the projects yourself, or change the capacity in the library if someone really joins.

**"My own resource counts in the occupancy."** Only if it is in the library. A resource you only made in the project, such as a hired crane for a single job, has no origin stamp and is therefore not in the overview. With *To the library* you add it.

## See also

- [Using the resource library](docs://howto-resourcebibliotheek-gebruiken): linking, assigning resources and resolving deviations.
- [Managing and sharing resource libraries](docs://howto-bibliotheken-beheren): creating, exporting and importing libraries.
- [Using the occupancy overview](docs://howto-bezettingsoverzicht-gebruiken): finding double bookings across projects.
- [Managing resources](docs://howto-resources-beheren): the resources of a single project.
