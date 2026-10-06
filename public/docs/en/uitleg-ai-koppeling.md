# How the AI link works

What actually happens when an AI assistant works in your schedule? In this article you read what the link is, why it differs from exchanging a file, which limits the app guards itself, and how the assistant finds out how a schedule should be built. The example at the end shows with numbers what an assistant can do in one go and what you take back of it.

## The concept

An AI assistant, such as a chat program or a programming assistant, can operate another program through the **Model Context Protocol** (MCP). Open Planner Studio plays the server in that exchange. The desktop app runs a small server on your own computer, the **bridge**. The assistant connects to it and gets a list of **tools**: instruments with a name that starts with `planner_`, such as reading tasks, adding a relation or saving a baseline. Which ones there are is in [AI tools](docs://ref-ai-tools).

The remarkable part is that the assistant works in the project you have open at that moment, not in a copy. You export nothing, you import nothing, and there is no moment where you and the assistant look at two different versions. A task the assistant adds shows up in the Gantt straight away. The app is not naive about it: the assistant works with the same calculation, the same undo history and the same rules as you.

How you turn the link on is in [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen). Below you read how it works.

## How the app handles it

### A server that only your own computer hears

The bridge only listens on your own computer (`127.0.0.1`), on one port, 3877 by default. It only accepts requests at the address `/mcp`, and only with your **token** in the header `Authorization: Bearer`. It refuses a request without the right token. A request that comes from a browser it recognizes by an `Origin` header and refuses as well, so that a web page you happen to have open cannot talk to your schedule. It processes requests strictly one at a time.

The connection is plain HTTP on your own computer; nothing leaves through the app itself. What an assistant does with the schedule it reads, for example what its provider does with it, is up to the assistant and falls outside the app.

### The assistant works on one document

At its first change, the bridge binds the connection to the document that is active then. If you switch tabs yourself afterwards, the app refuses the assistant's next change (code `DOC_DRIFT`) until it confirms with `planner_switch_document` which document it wants to work on. That way nothing ends up in the wrong project. An assistant that opens or duplicates a document itself works in that new document afterwards.

### Every change recalculates

In the app you plan by hand: you change something, then you press *Calculate*. An assistant does not have to. Every tool that changes something recalculates the schedule at the end by itself, so an assistant never works on stale dates. If it wants the result, the project end, the duration and the critical path, it calls `planner_run_cpm`. That is not a refresh but a query.

### A script is one step

An assistant can submit a series of steps as one whole with `planner_batch`, a script of at most 100 steps. That gives you one undo step, one recalculation and one backup. If one step fails structurally, for example an unknown tool or a circular reference, the app rolls the whole script back. You never keep a half-finished schedule. A refusal of one item inside a bulk step, such as one invalid progress line out of twenty, is milder: that item stays out and the rest is carried out. The refusals are at the top of the response.

### Your limits

You set four things yourself, in the *AI* tab:

- *Pause* and *Read-only* leave the assistant connected, but refuse every change. Reading stays possible.
- An open dialog blocks everything. With a task dialog, the settings, presentation mode or the welcome window open, for example, the app refuses reading too, because you are in the middle of a manual action. The assistant gets the error code `DIALOG_OPEN` with the name of the dialog.
- *Auto-backup* writes an IFC copy before the first change per document. If that backup fails, the app does not carry out the change.
- The *Activity panel* shows every call, with arguments and response.

On top of that comes your normal *Undo* (Ctrl+Z). The assistant shares that history with you and has `planner_undo` and `planner_redo` itself.

### What the assistant cannot do

The bridge is deliberately narrower than the app. What the assistant cannot do usually has one of three reasons.

**It reaches further than the project.** An assistant cannot change the resource library. A library is shared by all your projects and falls outside the undo history; one rate change would then take effect in projects that are not even open. For a resource from a library, name, type, description, hourly rate and unit are fixed, just as in the resources panel. What the project decides stays with the assistant: maximum units, availability over time, calendar and crew. It also cannot choose which calendar is the project calendar. It can read the calculation profile and the calculation options but not change them; it can only set the progress mode and the project default for the work rule. There are no tools for settings, theme, language, extensions or updates.

**It does not lend itself to reliable validation.** An assistant cannot set a hammock, schedule a task manually, set a second constraint, fill in notes, colors, activity codes, custom fields or external links, and it cannot set a leveling delay by hand. It does not choose a WBS code either; the app derives that itself.

**It touches something you must decide yourself.** It only records progress if there is a status date. It does not pick that itself: it is your reference date. If a task that has not started has a planned start after the status date, it has to supply the actual start. It reads and writes files only inside your user folder, and it only overwrites an existing file if it explicitly asks to. An export is not a *Save*: the project stays unsaved in the app.

### How the assistant knows how to plan

An assistant that knows the tools can still build a schedule that no planner has any use for: tasks without relations, a fixed date on every task, or a breakdown that is far too fine. So the app gives it three things.

**The core rules in the handshake.** When connecting, the bridge sends a short text in the `instructions` field of the MCP handshake, in English. Many clients put that text in their system prompt; whether yours does depends on the client. The rules: start at the milestones and the delivery date, build tasks of roughly a day to two weeks, drive the schedule with relations instead of fixed dates, use constraints only for hard external dates, use `planner_batch` for a coherent series, and say at the end what you assumed and what you deliberately did not do.

**The full guide.** The tool `planner_get_planning_guide` returns the guide [Planning well](docs://gids-goed-plannen), in Dutch or English. The connection prompt from the window *Connection details* asks the assistant to read it first. The tool also works while a dialog is open, while paused and in read-only mode, because it does not read your schedule.

**The skill.** A skill is a small file of instructions that an assistant reads along in every session. The skill *goed-plannen* describes the order in which the tools are used, the recalculation rule and the duty to report assumptions. The planning principles themselves are not in it; they are in the guide. The tool returns the skill together with the place where it belongs. How you install it is in [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen).

## An example

You ask an assistant: build an extension with foundation, brickwork and roof, in that order. Your project starts on Monday 2 March 2026. The assistant reads the guide first, and then submits one script:

1. the project start on 2 March 2026;
2. three tasks: Foundation of 5 working days, Brickwork of 10 and Roof of 4;
3. two Finish-to-Start relations: Foundation to Brickwork, Brickwork to Roof.

The app carries out the three steps, recalculates and reports: project end Thursday 26 March 2026, project duration 19 working days, all three tasks critical. That matches the sum: 5 + 10 + 4 is 19 working days, and 19 working days after Monday 2 March end on Thursday 26 March. The whole script is one step in your history. One *Undo* removes the three tasks, the two relations and the new project start.

Now the what-if. You then ask the assistant to update the progress, and for that it sets the status date to Monday 16 March. A status date is not a label: work that has not started may not lie before that date and moves up to it. Without a single line of progress, the whole schedule therefore moves along: Foundation runs from 16 to 20 March, Brickwork from 23 March to 7 April and Roof from 8 to 13 April. The project end jumps from 26 March to 13 April. The schedule moves up two working weeks, and the calendar in this example, *Bouwkalender NL*, has Good Friday (3 April) and Easter (5 and 6 April). Those two free weekdays push the end two more days. That is why the assistant only sets the status date at your request, and only when there is real progress to record.

## Consequences for your schedule and common misconceptions

**The assistant has no copy of its own.** What it changes, changes your project. With Auto-backup on, you have an IFC backup before its first change. With *Read-only* it can analyze without changing anything.

**A new token breaks all connections.** The token is the bridge's password. A new token invalidates the old one, even on a running bridge, and the assistant has to be given the new one.

**The assistant saying it worked is not proof.** The activity panel shows which tool it really called and what came back. A refusal almost always names the field that was wrong and the route that does work.

**The assistant cannot do a what-if with undo.** It shares undo with you, so for variants it duplicates the document with `planner_duplicate_document`. The copy is detached, has no file path and shows as unsaved. The assistant does not close variants; you decide that.

**An export by the assistant is not a save.** It writes an IFC file to a path it chooses itself, inside your user folder, and it only overwrites an existing file if it explicitly asks to. Your project stays unsaved in the app and keeps its own save target. If it imports a file, that opens in a new tab or in an empty, unchanged tab.

## See also

- [Connecting an AI assistant (MCP)](docs://howto-ai-assistent-koppelen): the steps to start the bridge, connect an assistant and install the skill.
- [AI tools](docs://ref-ai-tools): all tools by group, what they refuse and how long backups are kept.
- [Planning well](docs://gids-goed-plannen): the planning principles the assistant receives.
- [Progress, status date and baseline](docs://uitleg-voortgang): what the status date does to your schedule.
