# Managing and sharing resource libraries

Goal: create and delete resource libraries, put calendars in them, and export or import a library, as a backup or to use it on another computer.

## When you need this

The library is not in your project files but in the app: in the desktop app in a file on this computer, in the browser in that browser's storage. It is not synchronized. If you clear the site data in the browser, the library is gone; so export it as a backup. If a colleague wants to work with the same crews and rates, you also hand the library over as a file. If your organization has several operating companies with their own crews, you make a separate library for each one. For a new project you choose which library it uses.

What a library is, you read in [The resource library](docs://uitleg-resourcebibliotheek). You do not edit the resources themselves here but in the resource panel, see [Using the resource library](docs://howto-resourcebibliotheek-gebruiken).

## Steps

### Open the management screen

Choose *File › Library*. On the left is the list *Resource libraries*. On the right are the details of the library you click: name, the buttons, and the list *Calendars*. At the top it says that you manage resources in the *Resources* tab.

### Create, rename and choose a default library

1. Click the plus above the list (*Add resource library*). A library *New resource library* is added, and it is selected straight away.
2. Type the new name in the name field at the top of the right-hand part and press Enter, or click outside the field. The app does not accept an empty name.
3. Click *Set as default* to have this library preselected for new projects from now on. The default library has a star in the list.

### Put a calendar in the library

1. Under *Calendars*, click *From project*. A list opens with the calendars of your active project.
2. Click the small arrow after the calendar you want to take over. Above the list it says *Added.* A calendar that is already linked to this library has *already linked* after its name.
3. The calendar is now in the library's *Calendars* list. With the pencil (*Edit*) you change the name and save with the check mark. The trash can deletes the calendar immediately, without asking for confirmation. The copies in projects stay.

After *Calendars* there is a version number, for example *v2*. It goes up with every change to the library. A library calendar travels along to a project when you assign a resource that uses it. You attach it to a resource in *Resources*, *Library* view, in the column *Calendar*.

### Export a library

1. Choose the library in the list.
2. Click *Export*.
3. In the desktop app and in Chrome and Edge you choose where the file goes. In other browsers it goes straight to your downloads folder and the app tells you so. The file is called `bibliotheek-` followed by the name of the library, with the extension `.ifc`.

Below the buttons it says *Exporting is also your backup: keep the file somewhere safe.*

### Import a library

1. Click *Import*. The window *Import library* opens for the library that you had selected in the list.
2. Click *Choose file…* and pick the `.ifc` file of an export. If the file does not contain a library, it says *This IFC file does not contain a resource library.*
3. The app shows what is in it, for example *2 calendars, 5 resources (version 3).*
4. Choose what you want to do with it, see below.
5. Click *Add* or *Replace*, or *Cancel* to stop.

You have two choices:

- *Add as new resource library*: the file becomes a separate library next to your existing ones. Below it says under which name, for example *Will be added as “Mijn resourcebibliotheek (2)”.* Nothing is lost and your active project stays linked to its own library.
- *Replace an existing resource library*: the entire content of the chosen library is replaced by the one from the file. It also says so: *Importing replaces the ENTIRE pool of the selected resource library.* If you have two or more libraries, you choose which one under *Import into resource library*. If your library is newer than the file, the app warns: *Your local library is newer — importing may overwrite your changes.*

The app proposes a choice itself. For a file that contained the default library, *Add as new resource library* is preselected. If the library from the file already exists on your computer and is not the default library, *Replace an existing resource library* is preselected, with exactly that library chosen. If in doubt, choose add: that overwrites nothing.

### Delete a library

1. Choose the library in the list and click *Remove resource library*. The button is grey for the last library, because there always remains one.
2. Confirm with *Delete*. The question is *Remove this resource library?* If open projects are linked to it, it says *This resource library is linked to 1 open project. Removing it will unlink that project. Continue?* For more projects it says the same with the number, for example *linked to 2 open projects*.

The library is then gone, with all resources and calendars in it. The open projects that used it are unlinked: their resources stay as ordinary project resources. Export first if you want to keep the content.

### Pass on a project together with its library

A project file contains its own copies of the resources. If you also want to hand over the whole library, do the following. The export itself is also described in [Exporting](docs://howto-exporteren).

1. Open a project that is linked to a library and choose *File › Export*.
2. Tick *Save library file alongside*. The checkbox is only there for a linked project.
3. Choose the card *IFC 4x3* and save the file. The app then also asks for a second file. It is named like the project with `-bibliotheek` after it, and contains the library.

The checkbox only works for the IFC export, not for the other export formats. Your colleague imports the second file as described above.

## Pitfalls and what the app does then

**Two planners, two libraries.** The app does not synchronize libraries between computers. The import window always shows a warning about it: *Note: libraries are not synchronized between machines. If two planners work with the same resource library, the libraries may diverge. If your organization shares crews across operating companies, deliberately choose one shared pool.*

**Replacing overwrites everything.** Everything you had in the chosen library is gone, and a library change falls outside *Undo*. Export first if you are unsure.

**Deleting a calendar from the list happens immediately.** The app does not ask for confirmation, whereas deleting a resource does. That looks like a shortcoming. Library changes fall outside *Undo*.

## See also

- [The resource library](docs://uitleg-resourcebibliotheek): how library and project relate to each other.
- [Using the resource library](docs://howto-resourcebibliotheek-gebruiken): linking resources, assigning them and resolving deviations.
- [Exporting](docs://howto-exporteren): the export formats, including IFC with a library file.
