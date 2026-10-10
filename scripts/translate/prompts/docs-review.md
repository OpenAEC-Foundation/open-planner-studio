# Task: review one translated guide package

You get ONE package: `{{PACKAGE}}` (`"kind": "docs"`, language `lang`), its English source
`{{PACKAGE_DIR}}/{{ID}}.src.md` and its translation `{{PACKAGE_DIR}}/{{ID}}.out.md`.

## Rules
- Read only these three files. Do not open, search or list any other file. Do not edit any
  translation. Do not edit `knownbugs.md`.
- First run `{{NODE}} {{CHECK}} {{PACKAGE}}` and read its `WW` warnings.
- Compare sentence by sentence: English source against the translation, with `terms`, `labels`,
  `tokens`, `keep` and `style` from the package.
- A UI name in italics must be one of its label's `targets` letter for letter, in the nominative, with
  a carrier word for the case. Report an inflected, shortened or paraphrased label as `label`.
- Write only `{{REVIEW_FILE}}`: a JSON array, one object per problem:
  `{ "package": "{{ID}}", "section": <index>, "kind": "<kind>", "problem": "<short>", "quote": "<the wrong text, copied exactly from .out.md>", "proposal": "<the corrected text for quote>" }`
  `kind` is one of: `meaning` (wrong meaning), `omission` (something left out or added), `term` (not
  the term from `terms`, or a word from `avoid`), `label` (label not exactly a target), `unnatural`
  (correct but not how the language's software documentation says it), `style` (wrong form of
  address or quotation marks, see `style`).
- `quote` must occur exactly once in `.out.md`; make it long enough. `proposal` keeps Markdown, links,
  inline code, numbers, tokens and labels byte for byte, and must not start a line with a number and a
  period.
- Report real problems only. No style preferences, no praise. An empty array is a valid result.

End with one line: the number of problems.
