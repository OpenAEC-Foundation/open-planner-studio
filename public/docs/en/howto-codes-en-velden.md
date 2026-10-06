# Codes and custom fields

Goal: attach your own classifications (activity codes, such as *Location*) and your own fields (such as *Contractor*) to your tasks.

## When you need this

Besides the fixed data of a task (name, duration, relations, …) you can add data of your own. If you want to classify tasks by north wing and south wing, by discipline, or keep track of which contractor carries out a task, you record that yourself. There are two ways, and the difference matters.

An **activity code** is a classification with a fixed pick list. You create a **code type** (for example *Location*) with **values** (*N* for the north wing, *Z* for the south wing). A task gets at most one value per code type.

A **custom field** (under *Custom fields* in the window) is a free input field with a type: *Text*, *Number*, *Integer*, *Cost*, *Date* or *Yes/no*. The field can hold a different value on every task.

## Steps

### Defining codes and fields

1. Choose *Planning › Structure › Codes & fields*.
2. **Creating a code type.** Under *New code type (e.g. Location)* type the name and press Enter, or click *Add code type*.
3. **Adding values.** Under the code type, click *Add value*. The app puts a provisional code there, such as *V1*. Change it in the *Code* box (short, the way you would type it: *N*), fill in a *Description* if needed (*North wing*) and pick a *Colour*. A change counts as soon as you leave the box or press Enter.
4. **Creating a custom field.** Under *New field (e.g. Contractor)* type the name, choose the type and click *Add field* (or press Enter).

The window has no OK button: every change applies at once. You cannot change a field's type afterwards, only its name. If you want a different type, create a new field.

### Filling in a code or field on a task

You have two places.

- **In the *Properties* panel** (or in the window you open with F2). At the bottom is the *Codes & fields* block: a pick list per code type, an input per field. The block only appears once there is at least one code type or field.
- **As a column in the task list.** Click the **+** on the right of the table header (*Add column*) and, under *Custom*, choose the code type or field. In a code type's cell you type the code, for example `N`, or pick from the list. A code that does not exist gives *Choose a value from this activity code.*

### Using them

You can use a code type or custom field to filter, group and sort. You set that up with a layout: *View › Layout › New layout*. In the window, tick the parts you want to capture. With *Save* you get a button in *View › Layout* that you can click again later; with *Apply without saving* you only put it on screen now. When grouping, tasks without a value go under *(none)*.

For the bar colour choose *View › Baselines & progress › Bar colors*, then *By category* and the code type. Each bar then gets the *Colour* of its value.

## Pitfalls and what the app does

**Deleting removes the values on the tasks.** If you delete a code type, a value or a field with the bin, the app does not ask for confirmation, and the assignments on all tasks disappear with it. A grouping or sorting on that code type or field lapses too. *Undo* (Ctrl+Z) brings back the code type, value or field and the filled-in values, but not the grouping or sorting: you set those up again.

**Two values with the same code.** *Add value* numbers on from the number of values there are. If you delete one and add one, a code can therefore occur twice. If you type that code in a column cell, the app refuses with *This activity code value occurs more than once. Choose it from the list.* Give every value its own code.

**Templates do not take codes and fields along.** See [Saving and inserting WBS templates](docs://howto-wbs-sjablonen). If you paste tasks into another document, the app clears codes and fields that do not exist there and tells you.

**A date field does not move along.** If you move the whole project, filled-in custom fields of the type *Date* stay on their date. The app warns about this in the preview.

## See also

- [Adjusting the structure](docs://howto-structuur-aanpassen): the WBS tree, the other way to organise tasks.
- [Moving a project](docs://howto-project-verplaatsen): what happens to dates when you move the project.
- [Creating and using a layout](docs://howto-layouts-gebruiken): grouping and filtering on a code or custom field.
- [Adjusting table columns](docs://howto-tabelkolommen-aanpassen): showing a code or custom field as a column.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): the activity codes *House* and *Discipline*, the custom field *Cost estimate* and notes (open and completed).
