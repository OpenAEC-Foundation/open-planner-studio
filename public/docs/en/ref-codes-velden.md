# Codes & fields (structure dialog)

The **Codes & fields** window manages the project structure definitions: **activity codes** (freely definable dimensions such as Location or Discipline) and **custom fields** (typed user fields). The values per task are then filled in via the properties panel or the [task dialog](docs://ref-taakdialoog).

## Opening

**Planning** → ribbon group **Structure** → **Codes & fields**. **Esc**, the close cross or a click outside the window closes it. All changes take effect immediately (and can be undone with Ctrl+Z) — there is no separate save button.

## Activity codes

"Freely definable dimensions (e.g. Location, Discipline) for grouping and filtering — at most one value per type per task."

One block per code type:

- **Code type name** — editable directly.
- **Remove code type** (trash can) — removes the type including all values and the assignments on tasks.
- One row per value: **Code** (short label), **Description** and a **Colour** picker (colours groupings, among other things), plus a remove button.
- **Add value** — new value under this type.

At the bottom: input field **New code type (e.g. Location)** + button **Add code type** (Enter works too).

## Custom fields

"Typed user fields shown as columns in the table and editable per task."

One row per field: the **name** (editable directly), the **type** (read-only after creation) and a remove button.

At the bottom: input field **New field (e.g. Contractor)**, a type picker — **Text**, **Number**, **Integer**, **Cost**, **Date** or **Yes/no** — and the **Add field** button (Enter works too). The type cannot be changed after creation; create a new field if needed.

## Where the definitions show up

- As the **Codes & fields** entry section per task in the properties panel and the task dialog.
- As columns in the table view (custom fields) and as a grouping/filter dimension (activity codes).

## Further reading

- [Planning & WBS](docs://gids-plannen-wbs) — structuring a schedule, including codes and fields in practice.
