# Using the occupancy overview

Goal: see on which days two or more open projects together ask for more of a resource than the resource library has.

## When you need this

Your bricklaying crew is on the facades in one project and on the garages in another. Each project finds the crew neatly planned, because the histogram and the overallocation of a project only look at that one project. Only when you lay the projects side by side does it turn out that on the same days they together ask for more than you have bricklayers. The occupancy overview does that laying side by side for you.

The overview only counts resources that come from the resource library, in projects that are linked to the same library. How that calculates, you read in [The resource library](docs://uitleg-resourcebibliotheek).

## Steps

### 1. Get the projects ready

1. Open the projects you want to compare, each in its own tab. The overview only sees projects that are open in this app.
2. Link every project to the same library, and use the resource from the library in every project. Without a library link the resource panel does not show the overview. See [Using the resource library](docs://howto-resourcebibliotheek-gebruiken).
3. Calculate the projects with *Calculate* (F5), or turn on *Calculate automatically*. What the overview does with out-of-date projects is described under the pitfalls below.

### 2. Open the overview

1. Go to one of the projects and choose *Resources › Manage › Resources*.
2. At the top right, choose *Occupancy*. The overview belongs to the library of the project you are in. You cannot change anything in this panel: it is a read-only window.

### 3. Read the table

Every resource from the library that is booked in at least one open project gets a row. Resources without a booking are not listed. The rows with the most double-booked days are at the top, then alphabetical.

- *Documents* says in how many projects the resource is booked, for example *2 documents*.
- *Period* runs from the first to the last day with load, written as yyyy-mm-dd, for example *2027-06-07 – 2027-06-14*.
- *Peak / Capacity* sets the highest daily load of all projects together against the capacity of the resource in the library, for example *4.0 / 3.0*. If the peak is higher than the capacity, it is shown in red.
- A red marker after the row, for example *3 days double-booked*, counts the days on which the sum is greater than the capacity. If you hold the mouse over it, you see the dates.

### 4. Look per project

1. Click the small arrow before the name of a resource. The row opens up.
2. At the top are the double-booked dates, the first five and then *… and 3 more* if there are more. Below that is, per project, the name with the period and the peak of that single project, for example *Houses North 2027-06-07 – 2027-06-11 Peak: 2.0*.
3. Click the row itself to see a histogram at the bottom. Each project has its own color and the bars are stacked. The dashed line is the capacity of the library. If it changes over time, you see steps. Days that are double-booked get a red band behind the bars. Click the row once more to close the histogram again. Without a chosen row it says *Select a resource to see the histogram.*

### 5. Resolve it

The overview shows the problem, but does not resolve it. You have two options:

- Move a task in one of the projects, or give it fewer units per day. Then recalculate that project with F5.
- If someone really joins, raise *Max units* of the resource in the library. You do that in *Resources › Manage › Resources*, *Library* view.

*Level…* in the ribbon does not help here: it looks at the resources of the one project you are in.

## Pitfalls and what the app does then

**The overview is empty.** It says *No library resources booked in the open documents.* Then no open project has a resource from the library on a task.

**You do not see the button *Occupancy*.** The project you are in is not linked to a library.

**A project does not count.** It is not open in this app, it is linked to another library, or the resource in it is an own resource of that project. At the bottom of the overview it always says *This overview only sees the documents opened in this app.* A copy of a resource that has since been removed from the library does not count either.

**A project is out of date.** A project is out of date if you changed something in the schedule without recalculating. The overview then handles that project as follows:

- For a project that is not the active tab, the overview calculates in advance itself, without changing the project. Above the table it then says *Changed documents have been calculated in advance for this overview; press F5 in the document, or turn on “Calculate automatically” to do this permanently.* After the project it says *Calculated in advance for this overview — the document itself still shows older dates until you press F5 there or turn on “Calculate automatically”.* If *Calculate automatically* is on (*Settings › Project › Settings*, tab *Planning*), the app does really recalculate such projects as soon as you look at the overview, and the message disappears.
- The overview does not calculate the project you are in yourself. If that project is out of date, it says *A changed document has not been recalculated yet; it is included here with its last calculated figures. Press F5 in that document, or turn on “Calculate automatically”.* and after the project *Out of date: these are the last calculated figures — press F5 in this document.* Only trust the figures of that project after F5.
- If the overview cannot calculate a project, for example because of a loop in its relations, that project does not count. It is still listed, with *Not counted: schedule not calculated — activate this document and press F5.* and above the table *At least one document has not been calculated and is not included in the occupancy.*

**The overview does not match what you expect.** The capacity comes from the library, not from the *Max units* of the copy in the project. A sum equal to the capacity is not a conflict.

## See also

- [The resource library](docs://uitleg-resourcebibliotheek): how the occupancy is counted, with a worked example.
- [Using the resource library](docs://howto-resourcebibliotheek-gebruiken): linking projects and assigning resources.
- [Resolving overallocation](docs://howto-overbezetting-oplossen): overallocation within one project.
