# Connecting an AI assistant (MCP)

Open Planner Studio can open itself up to an AI assistant. Turn on AI mode and the app becomes an **MCP server**: an assistant such as Claude connects to the window you have open right now, reads your schedule and can edit it. You watch it happen — every task it adds appears in the Gantt immediately — and anything the assistant does, you undo with a single Ctrl+Z.

That is a fundamentally different model from exporting a file, editing it somewhere and importing it back. There is no copy, no intermediate format, and no moment where you and the assistant are looking at different things. This guide covers how to switch it on, how to connect an assistant, what it may and may not do, and what to try when it doesn't work.

## What you'll learn

- Switching on AI mode and finding the AI tab.
- Starting the bridge, and having it start automatically with the app.
- Connecting an assistant — with a ready-made prompt or a configuration snippet.
- What an assistant can do to your schedule.
- The safety controls: pause, read-only, automatic backup and the activity log.
- What to do when the connection fails.

The bridge works **in the desktop app only**. The AI tab is visible in the browser build, but the server itself runs in the desktop shell and cannot start there.

## Switching it on

AI mode is off by default. Turn it on at **Settings → Application → Enable AI mode** — through the gear icon, the Settings ribbon tab or File → Settings; all three show the same switch.

Once it is on, an extra **AI** tab appears in the ribbon. Switch AI mode back off and the tab disappears and a running bridge is stopped immediately — so a server never keeps listening without the tab being there.

Below it sits **Start bridge automatically**. With that on, the server goes live as soon as you open the app, so an assistant can connect without you visiting the AI tab first. It is off by default: opening a listening port on your own machine should be a deliberate choice.

## The AI tab

The tab has four groups.

**Server** — the **Start bridge** (or **Stop bridge**) button with the status next to it: *Off*, *Live on port 3877*, *Port … busy* or *Error*. The same status appears as a coloured dot at the bottom right of the status bar, so you can see whether the bridge is alive from any other tab.

**Connection** — the port number (only editable while the server is stopped; a running server holds its port), the token, and the **Connect** button. The token is hidden by default; the eye button reveals it, the copy button takes it, and **New token** generates a fresh one. Note that the last one breaks *every* existing connection, since they all carry the old token — which is why the app asks for confirmation first.

**Safety** — **Pause**, **Read-only**, the **Auto-backup** switch, and the **Back up now** and **Open backup folder** buttons. What they do is described below under *The safety controls*.

**Activity** — the **Activity panel** button opens a list of every call the assistant makes: timestamp, tool name, how long it took, and whether it succeeded. Expand any row for the arguments and the response. That is your log: you don't have to take the assistant's word for what it did.

## Connecting an assistant

Click **Connect**. The window that opens contains four blocks you can copy one by one:

1. **Endpoint** — the address the bridge listens on, `http://localhost:3877/mcp` by default. The transport is streamable HTTP.
2. **Authentication** — the HTTP header that must accompany every request, in the form `Authorization: Bearer …`.
3. **Configuration snippet** — a ready-made block of JSON to paste into your client's MCP configuration.
4. **Connection prompt** — a piece of text you paste straight into your assistant; it connects itself and then verifies its own tool list.

That last one is the shortest route and works with any assistant that can add MCP servers. The prompt is deliberately vendor-neutral: it names only the address, the token and what the assistant should check afterwards, so it works the same with one provider as with another.

The connection is complete once the assistant can list its tools. It should see close to forty of them, all starting with `planner_`. If it sees none, the bridge isn't running or the token is wrong.

The token grants access to the plan you currently have open. Treat it like a password: not in a shared document, not in a chat with other people.

## What an assistant may do

The tools cover roughly everything you do yourself in the app:

- **Reading** — project overview, task list, a single task in detail, the critical path, resources and their histogram, calendars, baselines, and the comparison against a baseline.
- **Scheduling** — creating tasks (an entire WBS with phases and subtasks in one go), editing, moving and deleting them; adding, changing and removing relationships; recording progress.
- **Setting up** — creating and assigning resources, managing calendars and non-working days, saving and activating baselines, levelling.
- **Managing** — creating, duplicating and switching documents, importing schedule files, and exporting to IFC.

Two things matter more than the list itself.

**An assistant can work in a single script.** Instead of calling one tool after another, it can submit a sequence of steps as one whole. That isn't just faster: the entire script becomes one step in your history. If it builds a forty-task schedule with all its relationships in one go, a single Ctrl+Z removes it again. If something structural fails halfway, the whole script is rolled back instead of leaving you with a half-finished schedule.

**The schedule is recalculated after every change.** The assistant doesn't have to ask for it separately and so cannot accidentally keep working on stale dates.

## What an assistant may not do

The bridge is deliberately narrower than the app. A few things an assistant simply cannot do, even if you ask — it gets a refusal that explains the route that does work. This isn't a child lock: each case is something that reaches beyond the project you happen to be looking at.

**The resource library itself.** An assistant cannot create, change or delete a library resource or calendar. A library is app-wide data shared by all your projects, and edits to it fall outside the ordinary undo history. A single rate change would therefore ripple into projects that aren't even open, with no way to take it back. You do that yourself, under File → Library.

**The fixed fields of an inherited resource.** If a resource comes from a library, that library decides what the resource *is*: name, type, description, hourly rate and unit. Those fields appear as plain text in the Resources tab for a reason — you cannot edit them there either — and the assistant can't reach them any more than you can. What the *project* decides stays available to it: max units, time-phased availability, the calendar and crew membership. Ask for a different hourly rate anyway, and the refusal names the two real routes: change it in the library (which then applies to every project), or first detach the resource from the library — after that it is project-owned and fully editable, and the detaching itself is undone with Ctrl+Z.

**Which calendar is the project calendar.** It may edit the contents of that calendar, but swapping which one the project uses is something you do yourself in the calendar library. The same goes for scheduling options such as the multiple-critical-paths setting.

**The app itself.** There is no tool for settings, theme, language, extensions or the updater. An assistant changes nothing about how your program is set up.

**Files — yes, but within limits.** Importing means it may read a schedule file from your disk, and exporting means it may write an IFC. Writing is confined to your personal folder, and an existing file is never overwritten unless that was asked for explicitly. An export is also not a "save": your document stays marked unsaved in the app, so it cannot replace your project file behind your back.

When it asks for the resource list, an assistant immediately sees which resources come from a library, which company they belong to, and which fields are fixed. It doesn't have to run into the wall first to find out.

## The safety controls

**Pause** keeps the bridge up but refuses every change; reading stays allowed. Useful when you want to do something yourself without dropping the connection.

**Read-only** does the same, but as a stance rather than a pause: let an assistant analyse, report on or compare your schedule without being able to change anything.

**Auto-backup** automatically writes an IFC copy before the first change to a document. That happens once per document per session, so you don't collect a pile of files with every call. **Back up now** does it immediately — handy just before you let an assistant do something drastic. **Open backup folder** takes you to where they live; the app keeps the last ten per document.

On top of that there is the ordinary undo history, which an assistant shares with you. Anything it does, you can undo — and so can the assistant, since undo and redo are in its toolbox too.

## When it doesn't work

**"Port … busy."** Something is already listening on that port. Usually that is a second window of this app: the bridge can serve only one at a time. Close the other window, or pick a different port number while the server is stopped.

**The assistant gets no response, or hangs.** This happens when the window behind the server has gone away or been reloaded. Stop the bridge and start it again; if that doesn't help, restart the app. If you're unsure whether it is still alive, check the status dot in the status bar.

**The assistant sees no tools, or reports an access error.** Then the token is wrong. This mostly happens after clicking **New token** once a connection was already established: the assistant is still carrying the old one. Copy the new one from the **Connect** window and update your client's configuration.

**Nothing happens although the assistant says it worked.** Check the activity panel for what it actually called and what came back. If there is a refusal, it will almost always name the field that was wrong as well as the alternative.

## Getting your AI assistant to plan well

An assistant that knows the tools can still build a schedule no planner can use: tasks without
relationships, a fixed date on everything, or a breakdown far too fine to maintain. You no longer
have to prevent that yourself. On connecting, the assistant is handed the core rules automatically —
the bridge sends them in the `instructions` field of the MCP handshake, and clients put that text
into their system prompt: start from the milestones, tasks of roughly a day to two weeks,
relationships instead of fixed dates, and report your assumptions back.

The full explanation is in the guide [Planning well: from requirements to a reliable
schedule](docs://gids-goed-plannen). Your assistant can fetch it itself with the tool
`planner_get_planning_guide` — that returns the guide text (Dutch or English), a short agent skill
with the tool order, and where to install that skill so it comes along in a later session:
`.claude/skills/goed-plannen/SKILL.md` in the project folder it works in, or
`~/.claude/skills/goed-plannen/SKILL.md` for all of its projects. It can also be downloaded directly,
from `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md`.

## Further reading

- [Baselines & progress](docs://gids-baselines-voortgang) — what the status date does to your schedule. Worth knowing before you let an assistant set it: it is not merely a reporting date, it also pushes not-yet-started work forward.
- [Import & export](docs://gids-import-export) — how IFC, CSV, MS Project and P6 relate to each other.
- [Settings](docs://ref-instellingen) — every setting in one place, including the two AI switches.
