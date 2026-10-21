# Obsidian CLI

The command-line interface that ships inside Obsidian, and the parts of it this repo uses to check a
change in the live vault: reload the plugin, open a page, read the DOM, capture a screenshot. The
step-by-step method, with its gotchas, is
[`.claude/skills/garmin-page/verify.md`](../.claude/skills/garmin-page/verify.md).

**Code:** `scripts/dev/ev.sh`, `click.sh`, `capture-view.sh`.

The CLI is the app's own binary, `/Applications/Obsidian.app/Contents/MacOS/Obsidian` on macOS (on
the `PATH` as `obsidian`). It talks to the app that is already running. Run `obsidian help` for every command; the vault commands (files, properties,
tasks, sync and so on) aren't needed here.

## What this repo uses

| Command | Use | Watch out for |
| --- | --- | --- |
| `plugin:reload id=garmin-connect` | load a new `main.js` after a build (Hot Reload isn't enabled) | It prints nothing on success: check `app.plugins.plugins['garmin-connect']` with `eval` rather than looping on its output. A load can start an automatic sync `STARTUP_SYNC_DELAY_MS` later (`src/main.ts`), when **Sync automatically** is on and the last sync is 15 minutes old; opening Home can too. |
| `eval code=<javascript>` | read and drive the app | The CLI drops its output now and then. Use `scripts/dev/ev.sh`, which retries until a result comes back, and make every eval safe to run twice. |
| `command id=<command-id>` | run a command, such as `garmin-connect:open-dashboard` (**Open home**) or `garmin-connect:sync-recent` | `commands filter=garmin-connect:` lists them. |
| `dev:debug on`, `dev:cdp method=… params=…`, `dev:debug off` | real clicks, drags and key presses through the Chrome DevTools Protocol | `scripts/dev/click.sh` sends the CDP events but needs `dev:debug on` first; turn it off afterwards. |
| `dev:errors`, `dev:console` | errors and console messages since the last `clear` | Read them after a reload and after each check. |
| `dev:dom`, `dev:css` | an element's HTML, text, attribute or computed style | `css=<prop>` reads a computed value. |
| `dev:mobile on`, `dev:mobile off` | the phone layout on the desktop | Restore it afterwards. |

`scripts/dev/capture-view.sh` builds a page capture out of `eval`. It drives an open Home view to a
route at phone (402) or pane (1190) width, in light or dark, and saves the screenshots.

## Reference

The relevant part of `obsidian help`, as it printed for Obsidian 1.14.4 on 2026-10-17:

```text
  command               Execute an Obsidian command
    id=<command-id>     - Command ID to execute (required)

  commands              List available commands
    filter=<prefix>     - Filter by ID prefix

  plugin:reload         Reload a plugin (for developers)
    id=<id>             - Plugin ID (required)

  plugins:enabled       List enabled plugins
    filter=core|community  - Filter by plugin type
    versions            - Include version numbers
    format=json|tsv|csv - Output format (default: tsv)

  tabs                  List open tabs
    ids                 - Include tab IDs

  workspace             Show workspace tree
    ids                 - Include workspace item IDs

Developer:
  dev:cdp               Run a Chrome DevTools Protocol command
    method=<CDP.method> - CDP method to call (required)
    params=<json>       - Method parameters as JSON

  dev:console           Show captured console messages
    clear               - Clear the console buffer
    limit=<n>           - Max messages to show (default 50)
    level=log|warn|error|info|debug  - Filter by log level

  dev:css               Inspect CSS with source locations
    selector=<css>      - CSS selector (required)
    prop=<name>         - Filter by property name

  dev:debug             Attach/detach Chrome DevTools Protocol debugger
    on                  - Attach debugger
    off                 - Detach debugger

  dev:dom               Query DOM elements
    selector=<css>      - CSS selector (required)
    total               - Return element count
    text                - Return text content
    inner               - Return innerHTML instead of outerHTML
    all                 - Return all matches instead of first
    attr=<name>         - Get attribute value
    css=<prop>          - Get CSS property value

  dev:errors            Show captured errors
    clear               - Clear the error buffer

  dev:mobile            Toggle mobile emulation
    on                  - Enable mobile emulation
    off                 - Disable mobile emulation

  dev:screenshot        Take a screenshot
    path=<filename>     - Output file path

  devtools              Toggle Electron dev tools

  eval                  Execute JavaScript and return result
    code=<javascript>   - JavaScript code to execute (required)
```
