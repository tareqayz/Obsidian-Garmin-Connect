# Capture: phone (iPhone Mirroring) and web (Chrome for Testing)

The phone is the **visual source of truth** and the primary source of golden numbers (OCR).
The web app is the **network source**: which endpoints and GraphQL operations each view
calls, their payloads, and a cross-check of the numbers.

## Phone — `scripts/iphone/mirror.sh`

The helper is a signed background app (`npm run iphone:build`, lives in
`~/Library/Application Support/garmin-mirror/`). macOS Screen Recording and Accessibility
are granted to **Garmin Mirror**, not to the terminal. `mirror.sh stop` refuses all input
until `mirror.sh resume`; closing iPhone Mirroring also stops everything.

### When to capture

**Between local midnight and ~04:00 (UTC+4) the Garmin iPhone app labels data with the UTC
date**: "Today" shows yesterday's numbers, every date label and card is one day off, 1d
timelines and per-day chart bars come up empty (seen 2026-10-08 01:20). Capture between
04:00 and 23:59 local. Note the capture time in `INDEX.md` either way.

### Session start

1. `mirror.sh doctor` → `screenRecording`, `accessibility`, `mirroringRunning` all true,
   `window` present, no `warning`. `blocking` in any shot (e.g. "Unlock Your iPhone") → stop
   and tell the orchestrator; the user must unlock/connect.
2. The window must be the calibrated size (408 × 897 pt): `doctor` warns otherwise. Resize
   with `key cmd+=` (Larger) / `key cmd+-` (Smaller) — **not** `cmd+0`, which shrinks it to
   the phone's physical size. After any size change, put the phone on Garmin's Home tab and
   run `mirror.sh calibrate ref/home/essentials-and-in-focus.PNG`.
3. `mirror.sh key cmd+1` (Home Screen), `mirror.sh open-app "Garmin Connect"`.
4. Navigate by text: `tap --text "More"` (tab bar) → `tap --text "Health Stats"` → `tap --text "<Stat>"`.

Shots are cropped to the phone screen and scaled to exactly 2x (804 × 1748 px), so
coordinates match native screenshots ÷ 3 and the 402 × 874 Figma frames (verified to ≈1 pt).
Never print the OCR of screens outside Garmin Connect (Spotlight, Home Screen): they show
the user's contacts, files and notifications.

### Commands

| Command | Use |
|---|---|
| `ocr [--grep t]` | Text items with boxes in phone points (402 wide, origin top-left). Your eyes for navigation: cheap, no image. |
| `shot <png> --ocr <json>` | A reference shot plus its OCR. View the PNG (Read) only to judge visual state. |
| `tap --text "<label>" [--nth k] [--contains]` | The normal tap. Refuses denied labels. |
| `tap --xy X Y --why "<step>"` | Icon taps only (period arrows, chips without text). Logged. |
| `back` | The navigation bar's back chevron (20, 77). Refused (`NO_BACK`) on root tabs, where that spot is the profile picture, and wherever no blue chevron is drawn. |
| `scroll down\|up <pt> [--at y]` | Vertical wheel scroll. Never horizontal: sideways swipes change the period. |
| `key cmd+1\|cmd+2\|cmd+3\|cmd+=\|cmd+-\|return\|escape` | Home Screen, App Switcher, Spotlight, Larger, Smaller; `escape` closes popovers and sheets. |
| `type "<text>"` | Spotlight only; letters, digits, space and basic punctuation (US key codes). |

The helper refuses taps on or next to: Edit, Delete, Remove, Add, Save, Log, Sync, Start,
Stop, Reset, Connect, Pair, Upgrade, Subscribe, Buy, Done, Clear, Share, Send, Record,
Measure, Sign/Log out, "+", and anything in the navigation bar's right side (⋮, +, pencil).
It pauses (`USER_ACTIVE`) if someone used the Mac in the last 20 s, refuses when iPhone
Mirroring is not frontmost or is covered, and logs every input to `input.log`.

### Shot list for one stat page

For **each range** the page offers (1d, 7d, 4w, 1y — whatever the app shows) and for
**offset 0 and −1** (the previous period, via the period arrow left of the date):
1. Top of the page: `shot`.
2. Scroll down ~550 pt at a time, `shot` after each scroll, until a shot's OCR is unchanged
   (end of page). Overlap is fine.
3. Every tab or segmented control (e.g. Score/Coach, Timeline/Stages): switch, re-shoot the
   affected section.
4. Every overlay chip on a chart: tap it, shoot the chart.
5. Every tappable card/row that opens a sub-page (factor pages, history sheets, detail
   pages): open, shoot it fully (and its ranges, if it has them), `back`.
6. Each info (i) sheet once, for its copy; close it with `back` or the sheet's close/Cancel.
   Bottom sheets (e.g. Sleep History) ignore Escape: close them with a downward drag or the
   sheet's close button. Day/week cards on stat pages switch the same page to that day/week
   rather than opening a new page — shoot the switched state and switch back.

Naming: `ref/<area>/<stat>/phone/<range>[-prev]/NN-<slug>.png` + `NN-<slug>.ocr.json`
(e.g. `stress/phone/7d-prev/03-scroll-2.png`). Sub-pages:
`phone/<range>/sub-<slug>/NN-….png`. Write `phone/INDEX.md`: one line per shot — file,
capture time, the date label on screen (`Oct 7`, `Oct 1–7`), what it shows.

Stop and report (don't improvise) on: a sheet or dialog you don't recognise, a blank or
locked frame, three `USER_ACTIVE` in a row (wait 30 s between), or anything that looks like
it would change data.

## Web — `scripts/dev/b.sh`

`b.sh` wraps gstack's `$B` with its own Chrome profile outside iCloud
(`~/.gstack/profiles/garmin-connect/chromium-profile`) and passes only read-only commands.
The user signs in once in that window (`b.sh connect`, then `b.sh goto https://connect.garmin.com/app/home`).

### Deep links (date = the day shown; range index 0 = 1d, 1 = 7d, 2 = 4w, 3 = 1y)

| Stat | URL |
|---|---|
| Sleep | `/app/sleep/{date}` |
| Stress | `/app/stress/{date}/{range}` |
| Body Battery | `/app/body-battery` |
| Heart Rate | `/app/heart-rate/{date}` |
| Respiration | `/app/respiration/{date}` |
| Pulse Ox | `/app/pulse-ox/{date}` |
| Pulse Ox Acclimation | `/app/pulse-ox-acclimation` |
| Health Status | `/app/health-status/{date}` |
| Health Snapshot | `/app/health-snapshots` |
| Fitness Age | `/app/fitness-age` |
| Weight | `/app/weight` |
| Blood Pressure | `/app/blood-pressure` |
| HRV Status | `/app/hrv-status` |
| Lifestyle Logging | not in the web nav — note "no web page" |

All are under `https://connect.garmin.com`. Where a URL has no range index, switch ranges
in the page: `b.sh snapshot -i`, find the tab **by its label**, click its ref, then
**re-snapshot before the next click** (refs renumber after every click).

### Procedure per stat

```bash
B=scripts/dev/b.sh; RAW=<scratchpad>/web/<stat>; OUT=ref/<area>/<stat>/web; mkdir -p "$RAW" "$OUT"
MARK=$(date +%s000)                                                  # the buffer is never cleared: filter by time
$B network --capture stop; $B network --capture --filter gc-api; $B network --clear
$B goto "https://connect.garmin.com/app/<…>"; $B wait --networkidle
$B eval scripts/garmin-web/graphql-hook.js                          # after every full load
# for each range / tab / state:
$B eval scripts/garmin-web/page-text.js --out "$OUT/text-<state>.txt"
$B screenshot "$OUT/<state>.png"
# at the end:
$B network --export "$RAW/capture.jsonl"                             # raw: has headers — keep it out of ref/
$B network > "$RAW/network.txt"                                      # request log: the only record of 204s
$B eval scripts/garmin-web/graphql-dump.js --out "$RAW/graphql.json"
node scripts/garmin-web/summarize.mjs --export "$RAW/capture.jsonl" --gql "$RAW/graphql.json" \
  --since "$MARK" --requests "$RAW/network.txt" --out "$OUT" --title "<Stat>"
```

`summarize.mjs` writes `endpoints.md` (page endpoints vs app-shell calls, catalogue id /
NEW, GarminApi wrapper or "no wrapper", response shapes) and scrubbed bodies in `bodies/`.
Never run `cookies`, `storage`, `state` or `cookie-import`; `page-text.js` excludes the
navigation (which shows the account name and devices).
