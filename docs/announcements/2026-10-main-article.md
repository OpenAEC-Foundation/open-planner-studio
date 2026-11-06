# Open Planner Studio v2026.10: open-source CPM scheduling with MS Project and P6 import

Open Planner Studio is a free, open-source (LGPL-3.0) scheduling application for construction, developed under the OpenAEC Foundation. It runs in the browser and as a desktop app for Windows, macOS and Linux.

**Try it:** [open-planner-studio.open-aec.com](https://open-planner-studio.open-aec.com/) · **Download:** [latest release](https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest)

![Open Planner Studio](https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio/main/docs/images/readme/hero.png)

## Scheduling

- CPM with total, free and interfering float; FS/SS/FF/SF relations with positive and negative lag; all eight constraint types and deadlines.
- Near-critical threshold, multiple float paths, hammock (LOE) tasks, external relations to other projects.
- Calculation profiles for Primavera P6 and MS Project conventions (e.g. early start of in-progress tasks, unstarted work before the status date). `.xer` opens with the P6 profile, `.mpp` with the MSP profile.
- Imported files first show the dates as recorded by the source program, with a count of tasks a recalculation would move.
- Progress modes Retained Logic and Progress Override (P6 Actual Dates is not supported).
- Baselines, status date, progress; progress sheet export/import via `.xlsx` or `.csv`.
- Resources, histogram and levelling; shared resource library and cross-project occupancy.
- Calendars with holidays and hour planning (shifts, breaks).

## Formats

| Format | Open | Export |
|---|---|---|
| Primavera P6 `.xer` | yes (multi-project) | in development |
| Primavera P6 XML | yes | yes |
| MS Project `.mpp` (2010–2021) | yes | – |
| MS Project XML | yes | yes |
| CSV | yes | yes |
| IFC 4.3 | yes | native format |

## Reporting

Eleven report types with live preview and PDF output (A4–A1), including look-ahead, variance against baseline, critical/near-critical and a schedule health check based on the DCMA 14-point assessment.

## Verification

- 560 data-driven scheduling test cases and 13 P6 reference cases.
- A 216-file `.mpp` benchmark that compares recalculated start and finish dates with the values saved by MS Project.

All tests are public in the [repository](https://github.com/OpenAEC-Foundation/open-planner-studio/tree/main/tests).

## Limitations

- `.mpp` is read-only and its import excludes baselines, costs, notes and custom fields. `.xer` export is in development; until then, export to P6 XML.
- No cost management.
- External relations use a fixed anchor date, not a live link.
- 4D model linking is not yet built.
- Parity with P6 and MS Project is measured, not guaranteed. Full list: [README](https://github.com/OpenAEC-Foundation/open-planner-studio#current-limitations).

## Also

- Local MCP server (desktop) so an AI assistant can read and edit the open schedule, with read-only mode and an activity log.
- 28 interface languages.

## Feedback

Test it on a real schedule and report issues via the in-app feedback button or [GitHub](https://github.com/OpenAEC-Foundation/open-planner-studio/issues). Anonymised `.mpp`, `.xer` and P6 XML files are welcome for import testing ([details](https://github.com/OpenAEC-Foundation/open-planner-studio/discussions/71)).

*Microsoft Project and Oracle Primavera P6 are trademarks of their respective owners. Open Planner Studio is not affiliated with Microsoft or Oracle.*
