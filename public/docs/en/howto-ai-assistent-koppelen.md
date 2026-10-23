# Connecting an MCP client

Goal: let an MCP client read along and work on your schedule, with insight into what it does and with limits that you set yourself.

## When you need this

You want an MCP client to read, analyze or change your schedule. For example to have it draft a first WBS, correct tasks or explain the critical path. That works through the **Model Context Protocol** (MCP): a standard that lets an AI program, the **MCP client**, use tools of another program. For this, Open Planner Studio runs a small server on your own computer, the **bridge**. It offers a set of tools, all with a name that starts with `planner_`: reading and changing tasks, relations, resources, calendars, baselines, documents and files. Which ones there are and what they refuse is in [MCP tools](docs://ref-ai-tools); why the link works this way is in [How the MCP link works](docs://uitleg-ai-koppeling).

The bridge only works in the desktop app. If you allow the MCP connection in the browser, you do see the *MCP* tab, but the button *Start bridge* is grey with the text *The bridge only works in the desktop app.* The rest of this article is about the desktop app. In the browser, *Back up now* and *Open backup folder* are grey too.

## Steps

### 1. Allow the MCP connection

1. Choose *Settings › Project › App settings*. You can also choose *File › App settings*, or the gear at the top.
2. Choose the tab *Advanced* and turn on *Allow MCP connection*. The tab *MCP* appears in the ribbon.
3. If you want the bridge to be live as soon as the app starts, also turn on *Start bridge automatically*. That only switches when the MCP connection is on and only works in the desktop app. It is off by default, because opening a port is a deliberate choice.

If you turn the MCP connection off, the bridge stops and the tab *MCP* disappears.

### 2. Start the bridge

1. Go to the tab *MCP* and click *Start bridge* under *Server*.
2. Look at the status next to the button. It says *Off*, *Live on port 3877*, *Port 3877 in use* or *Error*. If starting succeeds, it says *Live on port 3877* and the button is called *Stop bridge*. With *Port 3877 in use* or *Error* the button stays *Start bridge*; see the pitfalls.

The bridge only listens on your own computer, on one port. By default that is 3877. In the group *Connection* you can choose another one under *Port*, but only while the bridge is stopped.

### 3. Connect the MCP client

1. Click *Connect* under *Connection*. The window *Connection details* opens.
2. Choose what your client needs, see below.
3. The token is hidden. With the eye icon you show it. The copy buttons always copy the real value, even if the screen hides the token.
4. Have the MCP client request the list of tools. That check is also in the connection prompt: it should see the tools with the prefix `planner_`; the expected number is in the connection prompt.

The window offers three ways to connect:

- *Configuration snippet*: a piece of configuration that you paste into the MCP settings of your client.
- *Connection prompt*: a text that you paste into your MCP client, after which it connects itself.
- *Endpoint* and *Authentication*: the separate details. The endpoint is `http://localhost:3877/mcp` with transport *streamable HTTP*. Every request needs a header `Authorization: Bearer` followed by your token. Your client must also support MCP sessions: when it connects, the bridge gives a session code in the header `Mcp-Session-Id`, and it refuses every later request without that code. Claude Code and `mcp-remote` do this by themselves.

**Connect again after an update of the app.** If your MCP client was already connected to an older version of the app, it does not send a session code yet, and the bridge refuses every request. So connect again after the update: start a new session in Claude Code, and quit Claude Desktop completely and start it again.

**Claude Code.** The configuration snippet fits Claude Code directly. Give this command in a terminal, with your own token instead of `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

You can also put the snippet in the file `.mcp.json` in your project folder. Then do not put that file in git, because the token gives access to your plan. A server from `.mcp.json` must be approved the first time in Claude Code.

**Claude Desktop.** The configuration snippet does not fit Claude Desktop directly. In the file `claude_desktop_config.json` you name a program that Claude Desktop starts itself, not an address. So use the external tool `mcp-remote` in between; it needs Node.js. In Claude Desktop choose *Settings › Developer › Edit Config*, put this in the file (with your own token) and start Claude Desktop again:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

The token is in `env` and not in `args` on purpose: on Windows, Claude Desktop breaks an argument that contains a space. A *custom connector* in Claude (*Customize › Connectors*) does not work with the bridge. Claude then connects from the Anthropic cloud, and that cannot reach the bridge on your own computer.

In the group *Connection* there is also the field *Token*. It is a long, random code that the app makes for you and stores on this computer. In the window it says *This token grants access to the open plan. Do not share it with others.* With the icon *New token* you make a new token. The app first asks *Generating a new token breaks all existing connections. Continue?* If the bridge is running, it restarts with the new token and the old one no longer works.

### 4. See what the MCP client does

1. Click *Activity panel* under *Activity*. In the side column the panel *MCP activity* opens.
2. Every call of the bridge is on a line, the newest at the top: time, what happened, how long it took, and whether it succeeded or not. Click a line to expand *Arguments* and *Response*.
3. With *Clear* you empty the list. The panel keeps the last 500 calls. As long as nothing has happened, it says *No MCP activity yet. Bridge calls will appear here.*

With the MCP connection on, there is a dot with *MCP* at the bottom right of the status bar. Its color shows the status of the bridge, and a click on it takes you to the tab *MCP*.

### 5. Set limits

Under *Safety* are the buttons with which you limit the MCP client:

- *Pause*: the MCP client may temporarily change nothing, reading is still allowed. The bridge stays active. The button becomes *Resume*.
- *Read-only*: all tools that change something are refused while this is on.
- *Auto-backup: on*: before the first change by the MCP client in a document, the app writes an IFC backup. This is on by default. With the button you turn it off, and then it says *Auto-backup: off*. This happens once per document each time you start the bridge.
- *Back up now*: makes a backup of the active document straight away. Afterwards it says *Backup created:* with the file name.
- *Open backup folder*: opens the folder with the backups.

The backups are in the folder `ai-backups` in the data folder of the app. The app keeps the recent backups and thins out older ones; exactly how is in [MCP tools](docs://ref-ai-tools).

### 6. Have the MCP client plan well

An MCP client only plans well if it knows the planning rules. Why that matters and what is in them, you read in [How the MCP link works](docs://uitleg-ai-koppeling). This is what you do yourself:

1. **Do nothing for the core rules.** They come along when connecting. Whether your client puts them in its system prompt depends on the client.
2. **Have the guide read.** The connection prompt from the window *Connection details* asks the MCP client to read the guide with the tool `planner_get_planning_guide`. If you do not use the prompt, ask yourself: *Read the planning guide with planner_get_planning_guide first, before you change anything.* You can read the guide yourself at `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Optional: install the skills.** This only works with an MCP client that supports skills. Put the `SKILL.md` of *goed-plannen* and *progress-update* in `.claude/skills/goed-plannen/SKILL.md` and `.claude/skills/progress-update/SKILL.md` in the project folder the MCP client works in, or under `~/.claude/skills/` for every project.

You get the files in two ways. Ask the MCP client to call the tool `planner_get_planning_guide` with `part` set to `skill`: the response contains both texts and, for each skill, the places where it belongs. Or download them from `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` and `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. If *goed-plannen* is still there from an older version of the app, replace it: that old text is in Dutch and points to the Help article instead of the guide for MCP clients.

Whether the MCP client really read the guide you can see in the *Activity panel*: there is then a call of `planner_get_planning_guide`. The final answer it gives should contain a list of assumptions: estimated durations, the chosen breakdown, relations it created itself and every constraint it set. If that list is missing, ask for it. After a progress update following *progress-update*, the answer should name the status date, the new finish date and the variance against the baseline.

## Pitfalls and what the app does then

**The MCP client changes something that you want to take back.** Every change by the MCP client is a step that you undo with *Undo* (Ctrl+Z). A series of changes that the MCP client passes on as one whole is one step. Afterwards the project is shown as unsaved. After a change the schedule is calculated again, so you do not have to press F5 yourself.

**The app refuses a call by the MCP client.** With *Pause* and *Read-only* the app refuses all changes and reading remains possible, including the recalculation of a stale schedule. If you are in the middle of an edit yourself, such as dragging a bar or typing in a field, the MCP client gets the dates from before your edit with a notice that they are stale. If you have a dialog open, for example the settings, a task dialog or the welcome window, or presentation mode is on, the app refuses all calls, including reading, until you close the dialog. The MCP client then gets an error message with the internal name of what is open, for example `showTaskDialog`. Only `planner_get_planning_guide` keeps working, because it does not read your schedule.

**You switch tabs while the MCP client is working.** The MCP client works on the document where its first change landed. If you switch tabs in the meantime, the app refuses its next change until it confirms that it wants to work on the other tab. That way nothing ends up in the wrong project.

**The MCP client writes or opens a file.** The MCP client can write a schedule as an IFC file and open a schedule file as a new tab. It can only do that within your user folder. It only overwrites an existing file if it explicitly asks to.

**The status is *Port 3877 in use*.** Another program is using the port. The app's message is shown below it. The port field then stays locked (*Only editable while the server is stopped.*), even though the bridge is not running, and there is no stop button. That is a known shortcoming. Until it is fixed: turn *Allow MCP connection* off and on again. The status is then back to *Off* and you can choose another port. Then copy the connection details again, because the endpoint contains the port.

**The client cannot connect after a new token.** A new token breaks all existing connections. Give the client the new token, or paste the configuration snippet again.

**You stopped the bridge yourself and it does not start by itself.** *Start bridge automatically* works once each time the app starts. If you stop the bridge yourself, the app does not quietly turn it on again.

**The tab *MCP* is gone.** The MCP connection is off. Turn it on in step 1.

**A web page in your browser cannot talk to the bridge.** The bridge refuses every request that comes from a browser, and every request without the right token.

## See also

- [Giving feedback](docs://howto-feedback-geven): if the connection works differently from what is described here, report it.
- [How the MCP link works](docs://uitleg-ai-koppeling): what the link is, why the MCP client works in your open project and what it may not do.
- [MCP tools](docs://ref-ai-tools): all `planner_*` tools by group, the error codes and how long backups are kept.
- [Planning well](docs://gids-goed-plannen): the planning principles; the MCP client receives them in an English version with the tools added.
- [App settings](docs://ref-instellingen): the MCP settings.
