# Task: apply review findings to one guide package

You get ONE package: `{{PACKAGE}}` (`"kind": "docs"`), its English source
`{{PACKAGE_DIR}}/{{ID}}.src.md`, its translation `{{PACKAGE_DIR}}/{{ID}}.out.md`, and a list of
findings `{{REVIEW_FILE}}` (only the entries with `"package": "{{ID}}"` apply).

## Rules
- Read only these four files. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Edit only `{{PACKAGE_DIR}}/{{ID}}.out.md`, and in it only the text named by `quote` in the findings.
- `quote` is a whole sentence and `proposal` the whole corrected sentence. Replace each `quote` with
  its `proposal`, unless that breaks a rule of the package (structure,
  links, inline code, numbers, `labels`, `terms`, `tokens`, `keep`, `style`); then fix the problem in
  the smallest way that keeps the rule. Skip a finding whose `quote` is not in the file.
- Change nothing else: not the wording around it, not the Markdown.

## Check
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`. Fix exactly the `XX` lines and run again. At most 3 runs; then
stop and report the remaining `XX` lines.

End with one line: the number of findings applied and skipped (with the reason per skipped finding).
