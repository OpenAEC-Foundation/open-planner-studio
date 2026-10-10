# Task: translate one UI package

You get ONE package: `{{PACKAGE}}` (`"kind": "ui"`, language `lang`, namespace `namespace`). It holds
UI texts of Open Planner Studio, a construction scheduling app. Each item has a `key` (its path gives
context), the Dutch source `nl` and the English reading `en`. With `"plural": true` both are objects
per plural category.

## Rules
- Read only the package. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Write only `{{PACKAGE_DIR}}/{{ID}}.out.json`: `{ "<key>": "<text>" }`, and for a plural item
  `{ "<key>": { "<category>": "<text>", ... } }`. Exactly the keys of the package, no others.
- Meaning: **`nl` decides** when `nl` and `en` differ. `en` is a second reading.
- Terms: where a text contains a concept from `terms`, use its `target` or one of its `forms`. Never a
  variant from `avoid`.
- `tokens`: copy them unchanged (relation codes like `FS`, duration input like `3ed`). `keep`: names
  that stay as they are (`IFC`, `MS Project`).
- `{{placeholders}}` and `$t(...)` nesting: copy byte for byte. Do not translate, rename, add or drop
  them. Only in a plural form you may write `{{count}}` out as a word (e.g. "one task").
- Plural: give exactly the categories listed in the package's `plural` object, no more, no fewer. The
  numbers next to each category show what it means in this language; write each form for those numbers.
- Address the user as `style.address` says (`formal` / `informal`).
- Commands (buttons, menu and ribbon items, context-menu items) use the form in `style.commands`,
  exactly like its examples. Sentences and hints follow `style.address`.
- When a text names another UI element (a column, button, tab or menu item), write that name exactly
  as the element's own label, in the nominative, between the language's quotation marks; let the
  sentence carry the grammar ("Check the columns «Predecessors» and «Successors»").
- Keep short UI texts short: buttons, column names and menu items should be about as long as `en`.
  Same capitalisation style as the language's usual software. No explanations, no notes.
- With `previous` (an older translation): change only what the new `nl` requires.

## Check (you approve your own work)
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`.
- `XX` lines are errors: fix exactly those and run again.
- `WW` lines are warnings for the reviewer: fix them only if they are real mistakes.
- At most 3 runs. If it is still red after the third run, stop and report the remaining `XX` lines.

End with one line: `GROEN` or `ROOD` and the number of warnings.
