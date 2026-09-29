# Connecting an AI assistant (MCP)

Goal: let an AI assistant read along and work on your schedule, with insight into what it does and with limits that you set yourself.

## When you need this

You want an AI assistant to read, recalculate or change your schedule. For example to have it draft a first WBS, correct tasks or explain the critical path. That works through the **Model Context Protocol** (MCP): a standard that lets an AI assistant use tools of a program. For this, Open Planner Studio runs a small server on your own computer, the **bridge**. It offers a set of tools, all with a name that starts with `planner_`: reading and changing tasks, relations, resources, calendars, baselines, documents and files.

The bridge only works in the desktop app. If you turn on AI mode in the browser, you do see the *AI* tab, but the button *Start bridge* is grey with the text *The bridge only works in the desktop app.* The rest of this article is about the desktop app. In the browser, *Back up now* and *Open backup folder* are grey too.

## Steps

### 1. Turn on AI mode

1. Choose *Settings › Project › Settings*. You can also choose *File › Settings*, or the gear at the top.
2. Choose the tab *Advanced* and turn on *Enable AI mode*. The tab *AI* appears in the ribbon.
3. If you want the bridge to be live as soon as the app starts, also turn on *Start bridge automatically*. That only switches when AI mode is on and only works in the desktop app. It is off by default, because opening a port is a deliberate choice.

If you turn AI mode off, the bridge stops and the tab *AI* disappears.

### 2. Start the bridge

1. Go to the tab *AI* and click *Start bridge* under *Server*.
2. Look at the status next to the button. It says *Off*, *Live on port 3877*, *Port 3877 in use* or *Error*. If starting succeeds, it says *Live on port 3877* and the button is called *Stop bridge*. With *Port 3877 in use* or *Error* the button stays *Start bridge*; see the pitfalls.

The bridge only listens on your own computer, on one port. By default that is 3877. In the group *Connection* you can choose another one under *Port*, but only while the bridge is stopped.

### 3. Connect the assistant

1. Click *Connect* under *Connection*. The window *Connection details* opens.
2. Choose what your client needs, see below.
3. The token is hidden. With the eye icon you show it. The copy buttons always copy the real value, even if the screen hides the token.
4. Have the assistant request the list of tools. That check is also in the connection prompt: it should see the tools with the prefix `planner_`; the expected number is in the connection prompt.

The window offers three ways to connect:

- *Configuration snippet*: a piece of configuration that you paste into the MCP settings of your client.
- *Connection prompt*: a text that you paste into your AI assistant, after which it connects itself.
- *Endpoint* and *Authentication*: the separate details. The endpoint is `http://localhost:3877/mcp` with transport *streamable HTTP*. Every request needs a header `Authorization: Bearer` followed by your token.

In the group *Connection* there is also the field *Token*. It is a long, random code that the app makes for you and stores on this computer. In the window it says *This token grants access to the open plan. Do not share it with others.* With the icon *New token* you make a new token. The app first asks *Generating a new token breaks all existing connections. Continue?* If the bridge is running, it restarts with the new token and the old one no longer works.

### 4. See what the AI does

1. Click *Activity panel* under *Activity*. In the side column the panel *AI activity* opens.
2. Every call of the bridge is on a line, the newest at the top: time, what happened, how long it took, and whether it succeeded or not. Click a line to expand *Arguments* and *Response*.
3. With *Clear* you empty the list. The panel keeps the last 500 calls. As long as nothing has happened, it says *No AI activity yet. Bridge calls will appear here.*

With AI mode on, there is a dot with *AI* at the bottom right of the status bar. Its color shows the status of the bridge, and a click on it takes you to the tab *AI*.

### 5. Set limits

Under *Safety* are the buttons with which you limit the AI:

- *Pause*: the AI may temporarily change nothing, reading is still allowed. The bridge stays active. The button becomes *Resume*.
- *Read-only*: all tools that change something are refused while this is on.
- *Auto-backup: on*: before the first change by the AI in a document, the app writes an IFC backup. This is on by default. With the button you turn it off, and then it says *Auto-backup: off*. This happens once per document each time you start the bridge.
- *Back up now*: makes a backup of the active document straight away. Afterwards it says *Backup created:* with the file name.
- *Open backup folder*: opens the folder with the backups.

The backups are in the folder `ai-backups` in the data folder of the app. The app keeps the recent backups and thins out older ones.

## Pitfalls and what the app does then

**The AI changes something that you want to take back.** Every change by the AI is a step that you undo with *Undo* (Ctrl+Z). A series of changes that the AI passes on as one whole is one step. Afterwards the project is shown as unsaved. After a change the schedule is calculated again, so you do not have to press F5 yourself.

**The app refuses a call by the AI.** With *Pause* and *Read-only* the app refuses all changes and reading remains possible. If you have a dialog open, for example the settings or a task dialog, the app refuses all calls, including reading, until you close the dialog. The AI then gets an error message.

**You switch tabs while the AI is working.** The AI works on the document where its first change landed. If you switch tabs in the meantime, the app refuses its next change until it confirms that it wants to work on the other tab. That way nothing ends up in the wrong project.

**The AI writes or opens a file.** The AI can write a schedule as an IFC file and open a schedule file as a new tab. It can only do that within your user folder. It only overwrites an existing file if it explicitly asks to.

**The status is *Port 3877 in use*.** Another program is using the port. The app's message is shown below it. The port field then stays locked (*Only editable while the server is stopped.*), even though the bridge is not running, and there is no stop button. That is a known shortcoming. Until it is fixed: turn *Enable AI mode* off and on again. The status is then back to *Off* and you can choose another port. Then copy the connection details again, because the endpoint contains the port.

**The client cannot connect after a new token.** A new token breaks all existing connections. Give the client the new token, or paste the configuration snippet again.

**You stopped the bridge yourself and it does not start by itself.** *Start bridge automatically* works once each time the app starts. If you stop the bridge yourself, the app does not quietly turn it on again.

**The tab *AI* is gone.** AI mode is off. Turn it on in step 1.

**A web page in your browser cannot talk to the bridge.** The bridge refuses every request that comes from a browser, and every request without the right token.

## See also

- [Giving feedback](docs://howto-feedback-geven): if the connection works differently from what is described here, report it.
