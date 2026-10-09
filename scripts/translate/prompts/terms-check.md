# Task: blind check of target terms

You get ONE package: `{{PACKAGE}}` (`"kind": "terms-check"`, language `lang`). Each item has only an
id and a term in that language. The domain is construction project scheduling software (CPM, Gantt
charts, resources, baselines, progress), like MS Project and Primavera P6.

## Rules
- Read only the package. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Write only `{{PACKAGE_DIR}}/{{ID}}.out.json`: `{ "<id>": { "backTranslation": "...", "standard": true|false, "suggestion": "..." } }`
  - `backTranslation`: the English scheduling term this word means.
  - `standard`: true only if a professional planner in that language would use this exact term in
    scheduling software. False if it is a literal or unusual translation.
  - `suggestion` (only when `standard` is false): the usual term.
- One entry per item, nothing else.

## Check
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`. Fix exactly the `XX` lines and run again. At most 3 runs.
