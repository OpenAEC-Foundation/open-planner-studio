# Task: turn candidate terms into concepts

You get ONE package: `{{PACKAGE}}` (a JSON file with `"kind": "concepts"`). It lists candidate terms
from the user interface and the user guides of Open Planner Studio, a construction scheduling app
(CPM, Gantt, resources, baselines, progress; comparable to MS Project and Primavera P6).

## Rules
- Read only the package. Do not open, search or list any other file. Do not edit `knownbugs.md`.
- Write only `{{PACKAGE_DIR}}/{{ID}}.out.json`.
- Output: a JSON array of concepts. Each concept:
  `{ "id": "total-float", "kind": "term", "nl": "totale speling", "en": ["total float", "total slack"],
     "enBySource": { "msp": "total slack", "p6": "total float" }, "definition": "...", "seeAlso": ["free-float"] }`
  - `id`: kebab-case English (a-z, 0-9, -), unique.
  - `kind`: `term` (a domain concept that gets translated), `token` (input syntax or a code the app parses
    or writes, never translated: `FS`, `SS`, `FF`, `SF`, `3ed`, `12h`), or `keep` (a proper name that is not
    translated: `IFC`, `MS Project`, `Primavera P6`, `XER`, `CSV`, `MSPDI`). The full name "Finish-to-start"
    is a `term`, the code `FS` is a `token`.
  - `nl`: the Dutch term (use the `nl` texts in the package; lower case unless it is a name).
  - `en`: every English synonym the sources use for this concept, lower case unless a name.
  - `enBySource` (optional): which word MS Project (`msp`) and P6 (`p6`) use; each value must also be in `en`.
  - `definition`: one English sentence that fixes the meaning in scheduling (e.g. "float" is time, not a number type).
  - `seeAlso` (optional): ids of related concepts in your own output.
- Merge candidates that are the same concept (singular/plural, synonyms, word order).
- Skip candidates that are not a domain term: generic UI words (Save, Cancel, Open, Close), sentences, examples
  ("Pour foundation"), file names, numbers.
- Keep only what a translator must translate consistently. Expect roughly 10–40 concepts per package.

## Check
Run `{{NODE}} {{CHECK}} {{PACKAGE}}`. If it prints `XX` lines, fix exactly those and run it again.
At most 3 runs. Then stop and report the remaining `XX` lines.

End with one line: the number of concepts written.
