# Managed Linux session

This reference describes Planner in OpenAEC Linux, the Linux environment the SuperCloud streams to your browser. You use the regular desktop app there. Your administrator selects the app version in the shared image.

## Files

Your administrator sets the initial Open, Save As and export folder with `OPENAEC_MAP`, usually `/openaec` in the SuperCloud. Without this variable, regular folder selection applies. A startup file can open together with the app. You can then use the regular file dialogs.

Your home or Linux data/config folders must persist between sessions. They contain your settings and recovery files. The application folder may be read-only; your files folder must be writable.

## Updates

With `OPENAEC_BEHEERD=1`, Planner does not check for new versions, display automatic update notices or download updates. This mode is off by default. Manual update checks do not install anything either. Your administrator updates the shared image.

## Stopping and recovery

Normal closing still uses the existing prompts for unsaved changes.

If your administrator stops the managed session with `SIGTERM`, Planner blocks further input and writes the latest unsaved changes to the recovery store. You can restore them at the next start. This requires a persistent home folder and at least 30 seconds to shut down. A forced stop or a full disk can prevent recovery.

## AI connection

Your administrator can start the session's MCP connection with `OPENAEC_MCP_POORT` and `OPENAEC_MCP_GEHEIM`. The secret is not saved as a user preference. The server listens on loopback inside the shared Linux network namespace and rejects browser requests carrying an `Origin` header.

The regular permissions, pause button, read-only mode and document guards still apply. See [Connecting an AI assistant](docs://howto-ai-assistent-koppelen).
