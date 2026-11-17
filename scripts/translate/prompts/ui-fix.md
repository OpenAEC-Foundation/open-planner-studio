# Task: apply review findings to UI packages

You get one or more packages: `{{PACKAGES}}`, next to each `<dir>/<id>.json` its translation
`<dir>/<id>.out.json`, and a list of findings `{{REVIEW_FILE}}`. An entry applies to the package whose
`id` equals its `"package"`; ignore entries for a package that is not listed.

## Rules
- Read only these files. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Edit only the `.out.json` of a package that has findings, and in it only the keys named in its findings.
- Apply each `proposal`, unless it breaks a rule of the package (`terms`, `tokens`, `{{placeholders}}`,
  `$t(...)`, plural categories, `style`); then fix the problem in the smallest way that keeps the rule.
- An item with `fixedText` must keep that complete text byte for byte, including spacing and placeholder.
- `nl` decides the meaning when `nl` and `en` differ.

## Check
For each package you edited, run `{{NODE}} {{CHECK}} <package>`. Fix exactly the `XX` lines and run
again. At most 3 runs per package; then stop and report its remaining `XX` lines.

End with one line per package you edited: the number of findings applied and skipped (with the reason
per skipped finding).
