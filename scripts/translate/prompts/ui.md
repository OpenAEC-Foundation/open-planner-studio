# Task: translate UI packages

You get one or more packages: `{{PACKAGES}}` (a list of paths, all `"kind": "ui"` and the same
language `lang`; each has its own `namespace`). Translate each package on its own. They hold
UI texts of Open Planner Studio, a construction scheduling app. Each item has a `key` (its path gives
context), the Dutch source `nl` and the English reading `en`. With `"plural": true` both are objects
per plural category.

## Rules
- Read only the listed packages. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- For each package `<dir>/<id>.json`, write only `<dir>/<id>.out.json`: `{ "<key>": "<text>" }`, and
  for a plural item `{ "<key>": { "<category>": "<text>", ... } }`. Exactly the keys of that package, no
  others. Never put a key of one package in the output of another.
- Meaning: **`nl` decides** when `nl` and `en` differ. `en` is a second reading.
- Terms: where a text contains a concept from `terms`, use its `target` or one of its `forms`. Never a
  variant from `avoid`. Use a term only where the source word has the concept's meaning (see
  `definition`). The same English word with another meaning (lunch *break* vs task *interruption*;
  house *extension* vs software *extension*; *calculate* in prose vs the *Calculate* command) is
  translated normally.
- `tokens`: copy them unchanged (relation codes like `FS`, duration input like `3ed`). `keep`: names
  that stay as they are (`IFC`, `MS Project`).
- `fixedText` on an item is the complete required output: copy it byte for byte, including the
  placeholder, letter and spacing. It is a key-specific contract, even if `nl` uses another unit.
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
- `labels` on an item: `nl` names another UI text (a button, tab, block). Put one of its `targets`
  in the translation exactly as written, letter for letter, not inflected or shortened; let the
  sentence carry the grammar. A label without `targets` is not translated yet: translate it as a
  short UI name.
- Quotation marks: if `style.quotes` exists, use exactly those marks (e.g. `„…“`), also where `nl`
  or `en` uses other ones.
- Keep short UI texts short: buttons, column names and menu items should be about as long as `en`.
  Same capitalisation style as the language's usual software. No explanations, no notes.
- With `previous` (an older translation): change only what the new `nl` requires.

## Check (you approve your own work)
For each package, run `{{NODE}} {{CHECK}} <package>`.
- `XX` lines are errors: fix exactly those and run again.
- `WW` lines are warnings for the reviewer: fix them only if they are real mistakes.
- At most 3 runs per package. If one is still red after its third run, leave it and report its
  remaining `XX` lines.

End with one line per package: `<id> GROEN` or `<id> ROOD`, and the number of warnings.
