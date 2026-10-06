# Using the resource library

Goal: use resources from the resource library in your project, and put a resource that you made in a project into the library, so that every project uses the same data.

## When you need this

You have a fixed bricklaying crew, a crane and a plasterer who appear in several projects. Without a library you type them in again in every project, with a risk of different names and rates, and no project sees that another one asks for the same crew as well. In the library you record them once.

What the library is and what a project takes over from it, you read in [The resource library](docs://uitleg-resourcebibliotheek). This article is about the actions. Creating, exporting and deleting libraries is in [Managing and sharing resource libraries](docs://howto-bibliotheken-beheren).

## Steps

### 1. Link the project to a library

You only work with the library if the project is linked to it. Without a link, the *Resources* panel does not show the *Library*, *Project* and *Occupancy* switch.

For a new project:

1. Choose *File › New*. The *New project* window opens.
2. Look at *Resource library*. The field is set to the default library. You can choose another one, *none (standalone project)* or *+ New resource library…*.
3. Click *Create*.

For an existing project:

1. Choose *File › Project info*.
2. Under *Resource library*, choose the library.
3. Click *Apply*. Until then the bottom says *Changes not applied — click Apply to keep them.*

If the project already has resources with the same name as a library item, the *Link resource library* window opens with the section *Recognized*. Each resource with a match says *Suggested: Bricklayer*. Click *Link* to link that one, or *Link all suggestions* if there is more than one suggestion. The app compares names without regard to capital letters or double spaces. When linking, the resource takes over name, type, rate, unit and description from the library item. *Max units* stays what you had in the project. The window also shows calendars of the project that have the same name as a library calendar. With *Decide later* you close the window without linking.

### 2. Put a resource in the library

1. Choose *Resources › Manage › Resources*. The resource panel takes over the workspace. It always opens on *Project*, also for a linked project.
2. At the top right, choose *Library*. Above the table it says *This edits the library and applies to all projects — outside undo.*
3. Click *New resource in library*. An empty row appears at the bottom of the table.
4. Type the name, for example *Bricklayer*, and press Enter. The resource is now in the library and an empty row opens straight away for the next one. Press Esc when you are done. Without a name the app creates nothing.
5. Fill in the rest of the row. *Type* is *Labor* by default. Under *Max units* you enter how many of this resource there are in total, for example 3 for three bricklayers. The occupancy overview uses this number as capacity. *Rate/hour* is optional. You can only fill in *Unit* for the type *Material*. Under *Calendar* you choose a calendar from the library, or *+ Resource calendar* to make one, see [Setting up a resource calendar](docs://howto-resourcekalender-instellen). The app stores name, rate and unit when you leave the field, and the other fields straight away.

Every change in the library immediately works through into the unedited copies in your open projects.

### 3. Assign a resource to your project

1. In the *Library* view, choose *Assign to project* on the resource. Above the table it says *Added.* If you click again, it says *Already in the project.* and no second copy appears.
2. Choose *Project*. The copy is in the table with a small library icon next to the name, called *From the library*. Name, type, rate and unit are plain text. If you hold the mouse over them, you see *Library value — edit it in the Library view, or unlink this resource from the library.*
3. Set *Max units* for this project. The field starts with the value from the library and stays editable in the project.
4. Now assign the resource to tasks like any other resource, see [Assigning resources with a curve](docs://howto-resource-toewijzen). *Resources › Assignment › Assign* only shows resources that are already in the project, so first assign a library resource to the project in this way.

*Assign to project* only exists in the *Library* view of a project that is linked to that library.

### 4. Bring a resource from your project to the library

You do this for a resource that you made in the project and use more often, such as a hired crane.

1. In the *Project* view, choose *To the library* on the resource. The button only appears on a resource that has a name and does not yet come from the library, in a linked project.
2. Read the message above the table.

The message can say three things:

- *Added.* The library had no item with that name. A new item was made and your resource is linked to it.
- *Already existed in the library — now linked.* There was an item with the same name and the same data. Your resource is linked to it.
- *Linked to the existing library item — the values differ, see the marker.* There was an item with the same name but different data. Your resource is linked and is immediately marked *differs — decide*. Continue at step 6.

### 5. Unlink a copy

If you want to deviate from the library in one project, for example with a different rate, you unlink the copy.

1. In the *Project* view, click the icon *Unlink from library* at the end of the row.
2. The resource is now an ordinary project resource. All fields are editable and it no longer follows the library. The calendar that came along with the resource is unlinked too, unless another resource in this project still follows it.

With *Undo* (Ctrl+Z) you take the unlinking back.

### 6. Resolve a deviation

A copy that says *differs — decide* differs from the library item. The app does not choose who is right.

1. Click the marker *differs — decide* on the resource. The *Link resource library* window opens. It also opens by itself when you open a file with such a copy.
2. In the section *Deviations*, choose what you want for the item, see below.
3. Click *Decide later* if you do not want to choose yet. The window closes and the marker stays.

For a deviation you have two choices:

- *Use library values*: the copy gets the data from the library.
- *Adopt file values into the library*: the library gets the data from your copy. Below it says *Note: this changes the library and applies to all your projects.* The copies in other open projects follow.

## Pitfalls and what the app does then

**The example projects have a library of their own.** If you open one of the three showcase examples (*File › Examples*, or through a link in Help), the app once creates the library *Demo resource library* and links the project to it. Resources of the project with the same name as a library item are linked straight away; calendars are not. Your own libraries are left alone. If you open two showcases side by side, together they show conflicts in [Using the occupancy overview](docs://howto-bezettingsoverzicht-gebruiken), for example on the masonry crew (*Masonry crew*) between *Refurbishment & Extension of a Family Home* and *6 New Terraced Houses, De Akkers*.

**You do not see the switch.** The project is not linked to a library. Do step 1.

**You edit the library by accident.** The panel always opens on *Project* to prevent that. Changes in the *Library* view apply to all projects and fall outside *Undo*.

**You delete a resource from the library.** The app first asks *Remove 'Bricklayer' from the library? This applies to all projects and cannot be undone.* The copies in your projects stay and keep working. They get the marker *no longer in the library* and are fully editable. With *Remove from project* you take a copy out of the project.

**Under Resource library you choose another library or *none (standalone project)*.** The origin stamps of the previous library disappear. The resources stay in the project as ordinary project resources. With another library, the app looks again for resources with the same name.

**A resource has no suggestion in *Recognized*.** It says *No suggestion — choose manually*, but this window has no button for that. That looks like a shortcoming. Put such a resource in the library with *To the library* (step 4).

## See also

- [The resource library](docs://uitleg-resourcebibliotheek): what the library decides, what the project decides, and how copies follow along.
- [Managing and sharing resource libraries](docs://howto-bibliotheken-beheren): creating, exporting and importing libraries.
- [Using the occupancy overview](docs://howto-bezettingsoverzicht-gebruiken): seeing whether two projects ask for the same resource at once.
- [Managing resources](docs://howto-resources-beheren): the resources of a single project.
