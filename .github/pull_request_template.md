<!-- Thanks for contributing. See CONTRIBUTING.md if anything is unclear.
     Dutch is fine too. -->

### What and why

<!-- What changes, and which problem does it solve? The diff already shows what
     changes; use this space for why. Reference an issue with "Fixes #123". -->

### How it was verified

<!-- `npm run verify` is the gate — CI, the release gate and the deploy gate all
     run it. Note below what you ran and what came out of it. Tested by hand in
     the app? Say what you clicked. -->

- [ ] `npm run verify` green

### Does this touch

<!-- Tick whatever applies; leave the rest as is. These are the ones that most
     often break silently or get forgotten — see CONTRIBUTING.md. -->

- [ ] **Project data** — round-trips through the IFC layer, and tested?
- [ ] **Scheduling logic** — case added to `tests/planning/`?
- [ ] **User-visible text** — goes through `t(...)`, and all fourteen locales filled in?
- [ ] **`@tauri-apps/*`** — behind `isTauri()` or a dynamic import, so the browser
      build keeps working?
- [ ] **User-visible feature** — in-app guide in `public/docs/{nl,en}/` (plus manifest
      entry) written or updated?
- [ ] **UI interaction** — covered by a browser test in `tests/browser/`?

### Documentation

<!-- Does this change the architecture, a command, or behaviour that is described
     elsewhere? Then update CLAUDE.md/AGENTS.md, docs/CHANGELOG.md or the in-app
     docs in this PR. If not: "n/a". -->
