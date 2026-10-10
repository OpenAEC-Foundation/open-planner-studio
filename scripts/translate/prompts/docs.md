# Task: translate one guide package

You get ONE package: `{{PACKAGE}}` (`"kind": "docs"`, language `lang`) and its English source
`{{PACKAGE_DIR}}/{{ID}}.src.md`: an in-app guide of Open Planner Studio, a construction scheduling app
(CPM, Gantt, resources, baselines), or a run of its `##` sections.

## Rules
- Read only these two files. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Write only `{{PACKAGE_DIR}}/{{ID}}.out.md`: all of `.src.md`, translated. Nothing before or after it.
- Markdown structure exactly as the source: the same headings (`#`, `##`, `###`) in the same order,
  the same paragraphs, the same list items (`-`, `1.`), blank lines in the same places. Do not merge,
  split, add or drop anything. No tables, block quotes or HTML.
- Links `[text](docs://…)` and `[text](examples://…)`, images `![alt](path)`: translate the text and
  the alt text; keep the target and the path byte for byte.
- Inline code (`` `…` ``): copy byte for byte. Only the codes listed in `display` may follow the
  language (the app shows them translated, e.g. a unit).
- Numbers: keep every number of the source. Write digits as 0-9 only, also in ar and fa (never ٠-٩
  or ۰-۹). A line must not start with a number and a period (`18. června`) unless the source has a
  numbered list there: write such a date another way.
- `labels` (UI names in italics, per `section`):
  - `a`: write one of its `targets` exactly, letter for letter, in italics. Never inflect or shorten
    it. Keep it in the nominative and let a carrier word (window, tab, button, column, menu) take the
    case. With `keys` the label is ambiguous: choose the target whose key fits the sentence. A label
    without `targets` is not translated yet: translate it as a short UI name.
  - `b`: a UI message with a filled-in place: write its target with `{{…}}` replaced by the same
    value as in the source.
  - `c`: copy exactly as in English (names of example tasks, calendars, projects).
  - A menu path `*A › B › C*` stays one italic span; each part is a label; keep `›`.
  - Other italics: translate normally and keep the italics.
- `terms`: for these concepts use `target` or a form from `forms`. Never a word from `avoid`.
- `tokens` (codes such as `FS`, `3ed`) and `keep` (names such as `IFC`, `MS Project`): unchanged.
  `keepSoft`: names this language may translate in running text.
- Style: follow `style.docs` (form of address, examples) and `style.address`. If `style.quotes`
  exists, use exactly those quotation marks.
- Translate the meaning, sentence by sentence. Add no explanations or notes; leave nothing out.
- With `previous` (the current translation of a section, by section index): start from it and change
  only what the new English requires.
- Ignore `sections`: that is bookkeeping for the script.

## Check (you approve your own work)
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`.
- `XX` lines are errors: fix exactly those and run again.
- `WW` lines are warnings for the reviewer: fix them only if they are real mistakes.
- At most 3 runs. If it is still red after the third run, stop and report the remaining `XX` lines.

End with one line: `GROEN` or `ROOD` and the number of warnings.
