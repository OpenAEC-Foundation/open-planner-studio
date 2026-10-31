# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker. All labels are defined in `.github/labels.json`; add a new one there, not only on GitHub.

## State roles (exactly one per triaged issue)

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Category roles (exactly one per triaged issue)

| Label in mattpocock/skills | Label in our tracker | Meaning                        |
| -------------------------- | -------------------- | ------------------------------ |
| `bug`                      | `bug`                | Something is broken            |
| `enhancement`              | `enhancement`        | New feature or improvement     |

## Other labels in this repo

- **`area:*`** (ten labels, e.g. `area:scheduling`, `area:interop`): which part of the app. Optional, zero or more. The description of each label in `.github/labels.json` says what it covers.
- **`agent-ticket`**: the issue was created by an agent, not by a person. Always set it on issues you create (see `docs/agents/issue-tracker.md`).
- **`in-progress`**: someone is working on it. This is the claim marker; assignees are not, because every issue is auto-assigned.
- **`wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`**: used only by `/wayfinder`.
- **`browsertests`**: on a pull request, runs the browser suite in CI, at once and on every next push. See *Testing pitfalls* in `AGENTS.md` for when an agent does this.
- **`browsertests-reparatie`**: on the issue `Browsertests repareren`. While that issue is open, the repair of the Friday browser run is under way and the release waits. Only the skill `browsertests-repareren` sets this label.
- **`good first issue`, `help wanted`**: invitations to outside contributors. Set them only when a maintainer asks.

New issues from people outside the project get `needs-triage` automatically (`.github/workflows/triage-new-issues.yml`).
