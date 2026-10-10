# Task: replace avoided words in one UI package

You get ONE package: `{{PACKAGE}}` (`"kind": "ui"`, `"reason": "avoid"`, language `lang`). Each item
has its current translation `previous` and, in `avoidHits`, the words in it that the termbase forbids.
`terms` lists each concept with its `target`, its `forms` and its `avoid` words.

## Rules
- Read only the package. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Write only `{{PACKAGE_DIR}}/{{ID}}.out.json`: `{ "<key>": "<text>" }`, and for a plural item
  `{ "<key>": { "<category>": "<text>", ... } }`. Exactly the keys of the package, no others.
- Start from `previous`. Replace each word from `avoidHits` with the term from `terms` whose `avoid`
  lists it: use a form from `forms` in the case the sentence needs. Adjust only the words that must
  agree with it (article, adjective, preposition). Change nothing else: not the wording, not the
  word order, not the punctuation, not the capitalisation style.
- Keep the capital letter where `previous` had one ("Ključni put" → "Kritični put").
- An item with `"stale": true`: `nl` also changed since `previous`. Then also change what the new
  `nl` requires, and nothing more.
- An item without `avoidHits`: change only what the new `nl` requires.
- `labels` on an item: keep one of each label's `targets` letter for letter.
- `{{placeholders}}`, `$t(...)` and `tokens`: keep byte for byte. Plural: keep exactly the categories
  of `previous`.

## Check
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`.
- `XX` lines are errors: fix exactly those and run again.
- A `WW` line `vermijd "…"` on a key you wrote means an avoided word is still there: fix it.
  Other `WW` lines: leave them; they were there before you.
- At most 3 runs. If it is still red after the third run, stop and report the remaining `XX` lines.

End with one line: `GROEN` or `ROOD`, the number of items changed and the number of warnings.
