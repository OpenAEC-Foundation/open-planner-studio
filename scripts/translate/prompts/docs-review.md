# Task: review one translated guide package

You get ONE package: `{{PACKAGE}}` (`"kind": "docs"`, language `lang`), its English source
`{{PACKAGE_DIR}}/{{ID}}.src.md`, its translation `{{PACKAGE_DIR}}/{{ID}}.out.md`, and the known
pitfalls for this language `{{PACKAGE_DIR}}/pitfalls.md` (made by `prepare docs` from
`scripts/translate/prompts/pitfalls/_all.md` and `pitfalls/<lang>.md`).

## Rules
- Read only these four files. Do not open, search or list any other file. Do not edit any
  translation. Do not edit `knownbugs.md`.
- First run `{{NODE}} {{CHECK}} {{PACKAGE}}` and keep its `WW` lines.
- Then go through the whole `.out.md` in this order. Finish each step for the whole package before
  the next step.
  1. **Warnings.** Follow up every `WW vermijd` line and every `WW term` line. Is the word used in the
     concept's meaning (see `definition`)? Then it must be the term: report it. Is the English word
     used in another meaning there (lunch *break*, house *extension*, *calculate* in prose)? Then the
     term is wrong and a normal word is right: report a term that was used anyway.
  2. **Meaning, sentence by sentence.** Put each English sentence next to its translation. Nothing
     left out, nothing added. Check every modal word (can, must, may, should), small adverb (only,
     also, still, already, after all) and adjective ("Dutch", "early", "free"). Check who does what to
     whom (subject and object, before and after, above and below).
  3. **Grammar.** Check every sentence against `pitfalls.md`, then against the language's grammar:
     agreement, case, word order, verb forms. Literal copies of English phrases are errors.
  4. **Consistency.** The same term, panel, heading, label line ("Default:", "Where:") and example
     name are written the same way in the whole package.
- Labels: a UI name in italics must be one of its label's `targets` letter for letter, in the
  nominative, with a carrier word for the case. A label with `"role": "tab"` is a ribbon or settings
  tab: only its `targets` are right. Names of example tasks, projects, calendars and resources stay in
  English exactly as in the source, everywhere.
- Write only `{{REVIEW_FILE}}`: a JSON array, one object per problem:
  `{ "package": "{{ID}}", "section": <index>, "kind": "<kind>", "problem": "<short>", "quote": "<the whole wrong sentence, copied exactly from .out.md>", "proposal": "<the whole corrected sentence>" }`
  `kind` is one of: `term` (not the term from `terms`, a word from `avoid`, or a term in the wrong
  meaning), `meaning` (wrong meaning), `omission` (something left out or added), `grammar` (see step
  3), `consistency` (see step 4), `label` (label not exactly a target), `unnatural` (correct but not
  how the language's software documentation says it), `style` (wrong form of address or quotation
  marks, see `style`).
- `quote` is the whole sentence (from the start of the sentence to its full stop, or the whole list
  item or heading), copied exactly, and it must occur exactly once in `.out.md`. `proposal` is that
  whole sentence corrected, ready to replace `quote`. It keeps Markdown, links, inline code, numbers,
  tokens and labels byte for byte, and must not start a line with a number and a period. Two problems
  in one sentence: one finding with both fixes.
- Report real problems only. No style preferences, no praise. An empty array is a valid result.

End with one line: the number of problems per `kind`.
