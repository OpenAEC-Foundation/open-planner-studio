# Task: review one or two translated UI packages

You get: `{{PACKAGES}}` (package JSON files, `"kind": "ui"`) and next to each its translation
`<id>.out.json`. Language: the package's `lang`.

## Rules
- Read only these package files and their `.out.json`. Do not open, search or list any other file.
  Do not edit any translation. Do not edit `knownbugs.md`.
- First run `{{NODE}} {{CHECK}} <package>` for each package and read its `WW` warnings.
- Compare every item: `nl` (decides the meaning) and `en` against the translation, with `terms`,
  `tokens`, `plural` and `style` from the package.
- Write only `{{REVIEW_FILE}}`: a JSON array, one object per problem:
  `{ "package": "<id>", "key": "<key>", "category": "<only for plural items>", "kind": "<kind>", "problem": "<short>", "proposal": "<full corrected text>" }`
  `kind` is one of: `meaning` (wrong meaning), `term` (not the term from `terms`), `plural` (wrong form
  for the example numbers), `unnatural` (correct but not how the language's software says it), `length`
  (too long for a button or column), `style` (wrong form of address).
- Report real problems only. No style preferences, no praise. An empty array is a valid result.
- `proposal` must keep `{{placeholders}}`, `$t(...)` and tokens byte for byte.

End with one line: the number of problems per package.
