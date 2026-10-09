# Task: apply review findings to one UI package

You get ONE package: `{{PACKAGE}}`, its translation `{{PACKAGE_DIR}}/{{ID}}.out.json`, and a list of
findings `{{REVIEW_FILE}}` (only the entries with `"package": "{{ID}}"` apply).

## Rules
- Read only these three files. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Edit only `{{PACKAGE_DIR}}/{{ID}}.out.json`, and in it only the keys named in the findings.
- Apply each `proposal`, unless it breaks a rule of the package (`terms`, `tokens`, `{{placeholders}}`,
  `$t(...)`, plural categories, `style`); then fix the problem in the smallest way that keeps the rule.
- `nl` decides the meaning when `nl` and `en` differ.

## Check
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`. Fix exactly the `XX` lines and run again. At most 3 runs; then
stop and report the remaining `XX` lines.

End with one line: the number of findings applied and skipped (with the reason per skipped finding).
