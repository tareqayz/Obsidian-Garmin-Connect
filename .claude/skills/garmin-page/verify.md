# Verify in the live vault

The CLI is `/Applications/Obsidian.app/Contents/MacOS/obsidian`; `docs/obsidian-cli.md` has
its help. Helpers: `scripts/dev/ev.sh` (eval with retries), `capture-view.sh`, `click.sh`,
`compare.py`.

## Reload once per wave

- There is no hot reload. `npm run build`, then `obsidian plugin:reload id=garmin-connect`
  **once**: it prints nothing — check `app.plugins.plugins['garmin-connect']` with `ev.sh`
  instead of looping on its output.
- Every plugin load runs the startup sync (~50 Garmin requests, writes notes) and then any
  history backfills. Batch fixes; never reload per tweak.
- **Stale Svelte CSS** after a reload: `ev.sh "document.querySelectorAll('style').forEach(s => s.id?.startsWith('svelte-') && s.remove())"`,
  detach the Garmin leaves, reopen with `obsidian command id=garmin-connect:open-dashboard`.
  Check `getComputedStyle` when something looks unstyled or off by a few px.

## Capture

```bash
scripts/dev/capture-view.sh <unique-key> '<stack JSON>' 402 1 <out-prefix> dark
scripts/dev/capture-view.sh <unique-key> '<stack JSON>' 1190 0.4 <out-prefix> light
python3 scripts/dev/compare.py stitch <out-prefix> '<result JSON>' 402 <full.png>
python3 scripts/dev/compare.py trio <phone.png> <figma.png> <live.png> ref/<area>/<stat>/verify/<name>.png
```

`capture-view.sh` restores the theme, `.gch-root` width/zoom, sticky headers, scroll and the
page stack it found. Keys must be unique per run (`window.__p0` guards against a retried
eval starting a second copy, which once captured the next page into the previous file).

## Gotchas

- **The user may be using the window.** Read `view.getState().stack` before trusting a
  capture; drive pages with `view.setState({stack}, {})`, not clicks; stop if they're active.
- `obsidian eval` drops output intermittently — use `ev.sh`, make every job idempotent.
- Synthetic `el.click()` doesn't reach Svelte 5 handlers: `obsidian dev:debug on`, then
  `click.sh '<js returning the element>'`, then `dev:debug off`.
- macOS native menus: an Obsidian `Menu` never enters the DOM and pops a real menu — don't
  test pickers by clicking.
- `capturePage` returns stale frames when the window is hidden; `capture-view.sh` disables
  background throttling and invalidates first.
- Light theme: swap `theme-dark`/`theme-light` on `document.body` (never touch settings).
- Global Obsidian classes break components: never `.card`, `.prompt`, `.message`,
  `.notice`, `.menu`; `<p>` gets 6 px padding; every `aria-label` becomes a tooltip.
- Obsidian's process time zone can differ from macOS (Asia/Kuwait vs Asia/Dubai seen):
  series files carry `dayStart`; don't trust `new Date()` local hours in checks.

## Checklist per wave

1. `npm run build` passes on the integrated tree.
2. One reload, stale-style cleanup, reopen.
3. For each stat and range: capture at 402 and 1190, light and dark; `compare.py trio`
   (phone | Figma | live) into `ref/<area>/<stat>/verify/`.
4. Live numbers equal a **same-day** web capture (`page-text.js`) for the same spans.
5. `obsidian dev:errors` is clean.
6. A second sync rewrites no index file (mtimes unchanged).
