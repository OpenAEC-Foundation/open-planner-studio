# Task: choose the target term per concept

You get ONE package: `{{PACKAGE}}` (`"kind": "terms"`, language `lang`). Each concept has the Dutch and
English term, an English definition, and `candidates` from the Microsoft Terminology Collection (the
terms MS Project and other Microsoft products use in that language, each with its own definition).
If `existingUi` is true, each concept also has `ui`: texts from the app's current translation.

## Rules
- Read only the package. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Write only `{{PACKAGE_DIR}}/{{ID}}.out.json`: an object with one entry per concept id, plus `_style`.
- Entry: `{ "term": "...", "forms": ["...", "..."], "avoid": ["..."], "source": "...", "status": "..." }`
  - Choose by meaning: the candidate whose definition matches the concept definition. Ignore candidates
    with another meaning (e.g. "baseline" in typography, "float" as a number type).
  - `status`: `tbx` (exactly one fitting candidate), `tbx-chosen` (you chose between candidates),
    `existing-ui` (only if `existingUi` is true: the term the current UI uses), `model` (no fitting
    candidate; you give the usual professional term from your own knowledge). Never `arbitrated`.
    With `tbx` or `tbx-chosen` the `term` must be one of the candidates, spelled exactly the same.
  - `source`: `tbx`, `existing-ui` or `model`.
  - `forms`: the term itself plus the case and plural forms a sentence needs (e.g. Czech
    "celková časová rezerva", "celkové časové rezervy", "celkovou časovou rezervu"). Each form must share
    a stem with `term`. Languages without inflection (zh, ja, ko): just the term.
  - `avoid` (optional): wrong variants a translator might use.
  - Lower case unless the language capitalises nouns (German) or it is a name.
- If `existingUi` is true: use the term the current UI uses (`existing-ui`), and report:
  - `uiVariants`: other translations of the same concept that the `ui` texts also use;
  - `tbxTerm`: the fitting candidate, if the UI uses something else.
- `_style`: `{ "address": "formal" | "informal", "note": "..." }` — how the usual software in that language
  addresses the user. With `existingUi`: follow the `ui` texts. Leave it out if the package already has `style`.

## Check
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`. Fix exactly the `XX` lines and run again. At most 3 runs; then stop
and report the remaining `XX` lines.

End with one line: how many `tbx`, `tbx-chosen`, `existing-ui` and `model` entries.
