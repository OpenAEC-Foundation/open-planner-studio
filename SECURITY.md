# Security Policy

To report a vulnerability, use GitHub's private reporting on the
[Security tab](https://github.com/OpenAEC-Foundation/open-planner-studio/security/advisories/new).
Please do not open a public issue. Reports in English are welcome.

## Reporting a vulnerability

Do **not** report a security issue through a regular issue, a pull request, or
the in-app feedback button — those are all public.

Instead, use GitHub's private reporting:
**[Security → Report a vulnerability](https://github.com/OpenAEC-Foundation/open-planner-studio/security/advisories/new)**.
This creates a private thread between you and the maintainers.

Helpful in a report:

- which version (the version is shown in Backstage → Settings, or in the title bar);
- whether it concerns the desktop version or the browser version — those differ
  in what they are allowed to do (file system, updater);
- a reproduction: the smallest steps or the smallest file that triggers it;
- what an attacker could achieve with it.

Do not send real project files if they contain company data; a reduced example
file is enough and usually clearer.

## What to expect

This is a small project without a team on call. We aim for a first response
within a week. You will hear from us what we do with the report, even if we
decide it is not a vulnerability. If you wish, you will be mentioned in the
release note of the fix.

## Supported versions

Only the latest release gets fixes. Versions are CalVer (`YYYY.M.patch`); the
desktop version updates itself via the built-in updater, except on a Snap
installation — that is updated by snapd itself. The browser
version at `open-planner-studio.open-aec.com` always runs the latest `main`.

## Where the risks are

Two components are more interesting than the rest, and it helps if a report makes
clear which one it is about.

**Extensions execute code.** An extension is JavaScript that runs in the app, in
a `new Function(...)` sandbox whose `require()` only returns the app's own API
and whose permissions are checked per API call. That sandbox is a *confinement*,
not a security boundary: only install extensions you trust. Reports about
escaping that sandbox are welcome and taken seriously.

**IFC files come from outside.** Opening means parsing. The parser is tested
against hostile input (`tests/library/check-ifc-hostile.ts`), but a file that
makes the app crash, hang, or do something it should not is a valid report.

Out of scope: an extension you install yourself being able to do what you allow
it, and an IFC file containing strange schedules.

## Disclosure

We work with coordinated disclosure: we ask you to wait with publishing until a
fix is out, or until ninety days after your report if it takes that long. If an
issue is already being actively exploited, we move faster and disclose it
publicly as soon as a fix is available.
