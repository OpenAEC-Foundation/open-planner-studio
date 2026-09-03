# Contributing to Open Planner Studio

Thanks for joining in. This page describes what you need to get a change through
the gate. In short: **`npm run verify` must be green**, and the rest of this
document explains why things are the way they are.

Note: this project's working language is Dutch — code comments, commit messages
and the canonical source translations are Dutch. Issues and pull requests in
English are welcome and will be answered in English.

## Setting up

```bash
git clone https://github.com/OpenAEC-Foundation/open-planner-studio.git
cd open-planner-studio
npm ci            # ci, not install — the lockfile is binding
npm run dev       # browser build — the dev-server prints which port it picked
npm run tauri:dev # desktop build (Tauri 2, Rust toolchain required)
```

Node 22 is what CI runs. For `tauri:dev`/`tauri:build` you additionally need a
Rust toolchain and, on Linux, the system libraries listed in `ci.yml`.

There is no single fixed port: `npm run dev` assigns this worktree a **fixed**
port in the 3007-3106 range (anchored to the worktree root, so it survives
restarts) and stamps it in `.claude/launch.json`. Read the port from the
dev-server's own output rather than assuming any particular number. Running
multiple worktrees at the same time is fine for exactly that reason:
`tauri:dev` follows the same per-worktree port and its own auto-save files.

## The gate

```bash
npm run verify
```

That is literally the same command that CI, the release gate and the deploy gate
run — one definition, in `package.json`. If it is green locally, it is green in
CI. Ten steps, run in this order:

| component | what |
|---|---|
| `npm run typecheck` | `tsc --noEmit` over `src/` and over `scripts/`+`tests/` |
| `npm run lint` | a minimal ESLint gate — promise-handling, control-regex and the React-hooks rules, **no style rules** |
| `npm test` | the five behavior suites (`planning`, `library`, `mcp`, `dev-server`, `browser`) |
| `npm run verify:examples` | the example projects in `examples/` |
| `npm run verify:docs` | the in-app documentation, 14 languages |
| `npm run verify:i18n` | missing translation keys relative to `nl` |
| `npm run verify:store-boundaries` | core runtime factories and store-bound MCP tools never import `useAppStore`/`appStoreContext` |
| `npm run verify:gantt-boundaries` | AST gate on the renderer/viewport/pointer/table boundaries |
| `npm run verify:cycles` | circular imports within `src/` |

`npm run verify:audit` (`npm audit --audit-level=high`) exists as a separate command but is
deliberately **not** part of `verify`: a newly published advisory would otherwise turn every push
and deploy red regardless of the change. Dependabot security alerts are enabled on the repository
and are the notification channel for new advisories; fix them in their own commit.

Running individual components is also possible — see the command list at the top
of [`CLAUDE.md`](CLAUDE.md). During work, `npm run test:planning` is usually
enough; run `npm run verify` before you push.

There is **no formatter, and no style rules** — the linter only catches what
`tsc` cannot (floating/misused promises, control regex, the React-hooks rules).
`tsc` runs in `strict` mode with `noUnusedLocals`/`noUnusedParameters`, so dead
code stands out on its own. Follow the style of the surrounding code.

## Things that easily go wrong

Four pitfalls that go wrong more often than the rest. The background is in
[`CLAUDE.md`](CLAUDE.md); this is the short version.

1. **IFC is the file format, not an export.** New project data must round-trip
   through `src/services/ifc/` — otherwise it is gone after saving and reopening.
   There is no separate JSON project format.
2. **Scheduling is manual, not reactive.** `runCPM` does not run on its own after
   a change. Call it after mutating tasks, relations or the calendar.
3. **The Gantt is a `<canvas>`.** Visual behavior lives in
   `src/engine/renderer/`, not in React components.
4. **The web build is production.** Anything that touches `@tauri-apps/*` must be
   behind an `isTauri()` check or a dynamic import — a top-level import breaks
   the browser version, which is live.

Visible text always goes through `t(...)`. Add new keys to `nl` (the source) and
to the other thirteen locales; `npm run verify:i18n` checks that, including the
CLDR plural categories per language.

## Commits and pull requests

- Conventional commits with a scope: `fix(ifc): …`, `feat(ui): …`,
  `test(planning): …`, `docs(…)`, `chore(…)`, `ci(…)`.
- Commit messages in Dutch, in the imperative mood.
- Describe in the body **why**, not what the diff already shows. A line on how
  you verified it is worth more than a list of changed files.
- One topic per pull request. Small PRs get read faster.
- Mention in the PR how you tested it, and which suite you ran.

Does your change touch scheduling code? Add a case to `tests/planning/` — see
[`tests/planning/README.md`](tests/planning/README.md). For a bugfix, a case that
is red first is the best description of the bug.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — the in-depth architecture guide, also useful for humans.
- [`PLAN.md`](PLAN.md) — the roadmap.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — noteworthy changes.
- [`docs/TODO.md`](docs/TODO.md) — what is still open; a good place to look for
  something to start on.
- [`docs/extensions.md`](docs/extensions.md) — writing extensions.

If your change affects the architecture or a command, update `CLAUDE.md` and
`AGENTS.md` in the same PR. `npm run verify:docs` mechanically enforces part
of this for `AGENTS.md`/`README.md`/`CONTRIBUTING.md` — dangling `npm run`
references, verify-chain step names and suite names must stay in sync with
`package.json` — but it cannot check prose, so re-read what you touch rather
than relying on the gate alone.

## Security

Do **not** report security issues via an issue. See
[`SECURITY.md`](SECURITY.md).

## License

This code is licensed under LGPL-3.0-or-later. By contributing, you agree that
your contribution will be released under that same license.
