# Filters

The **Filter** window controls which tasks are visible — in the Gantt and on the Table tab. A filter consists of rules (field + operator + value), optionally bundled into groups.

## Opening

**View** → ribbon group **Display** → **Filter…**. The button stays highlighted while a filter is active. If you have no saved filters yet, it opens the Filter window directly. Otherwise its arrow also opens your saved filters, so choosing one applies it immediately; **Clear** switches the active filter off. **Esc**, the close cross or a click outside the window closes without applying.

## Groups: all or any

At the top of each group you choose how its rules combine:

- **All of the following (AND)** — a task must match every rule.
- **Any of the following (OR)** — matching one rule is enough.

**+ rule** adds a rule; **+ group** (top level only) adds a nested group, so you can combine AND and OR — for example "Critical is yes AND (Type is Construction OR Type is Installation)". Without rules the window shows: "No rules yet — this filter matches everything."

## A rule: field, operator, value

- **Field** — all task fields: WBS, Task Name, Duration, Start, Finish, Type, Critical, Total Float, Progress, Milestone, Free Float, Interfering Float, Near Critical, Float Path and Resources, plus the project's activity codes and custom fields.
- **Operator** — adapts to the field type:
- text: **equals**, **not equals**, **contains**, **starts with**, **is empty**;
- number and date: additionally **less than**, **less than or equal**, **greater than**, **greater than or equal** and **between** (with **From**/**To**);
- yes/no fields (such as Critical and Milestone): a **Yes**/**No** choice;
- choice fields (such as Type or an activity code): **is one of**, with tickable values.
- **Value** — the input follows the field type (text box, number, date or picker); **is empty** has no value input.

The trash icon behind a rule removes that rule; the cross at the top right of a nested group removes the whole group.

## Save and reuse filters

At the top of the Filter window, type a **Name** and click **Save** to store the current rules as a filter preset. Saved filters are available on this device in every project; they only replace the filter, never your columns, grouping, sorting or time scale. Choose a saved filter from the same list to apply it immediately, or remove the selected preset with the trash button.

## Apply, cancel and clear

- **Apply** activates the filter and closes the window. A filter without rules counts as "no filter".
- **Cancel** closes without applying the changes.
- **Clear** switches the active filter off immediately and empties the editor.

An active filter is part of a saved layout — see [Saving and loading layouts](docs://ref-layouts).

## Further reading

- [Choosing columns](docs://ref-kolommen) — which columns the table shows.
