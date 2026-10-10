# Capture: phone and web

The phone is the **visual source of truth** and the primary source of golden numbers (OCR).
The web app is the **network source**: which endpoints and GraphQL operations each view
calls, their payloads, and a cross-check of the numbers.

## Phone — the user's screenshots

The user takes the phone shots by hand. (Driving the phone from the Mac was dropped on
2026-10-10: it cost hours and many tokens per stat.)

1. **Relaunch Garmin Connect first.** The app can get stuck a day behind: after a sync between
   local midnight and 04:00, "Today" shows the previous day and every label is one day off,
   and only a relaunch clears it. The user force-quits the app (swipe it away in the App
   Switcher), reopens it, and checks that Stress "Today" matches today's web numbers.
2. **The user shoots the list below** and drops the PNGs, in order and without write-ups, into
   `ref/<area>/<stat>/phone/<range>[-prev]/` (sub-pages in `sub-<slug>/`).
3. **You index them** (`garmin-phone-capture`). Rename to `NN-<slug>.png` in capture order,
   then OCR each one: `scripts/iphone/mirror.sh ocr-file <png> > <same name>.ocr.json`.
   - `ocr-file` needs no permissions, only the helper built once with `npm run iphone:build`.
   - It reports boxes in phone points. Native shots are 3x: 1206 × 2622 px for the
     402 × 874 pt frame, and 2622 × 1206 px (874 × 402 pt) for landscape full-screen charts —
     OCR those with `--phone-width 874`, or their boxes come out scaled for 402.
   - OCR can misread a strip (seen 2026-10-10: Stats values read upside down, `L0:99` for
     56:01, marked confident). When a number looks wrong, OCR that strip again or look.
   - Write `phone/INDEX.md` as below.
4. **Missing states go back to the user** as a short list. Don't block on them: build the frame
   from the web capture and mark it Inferred.

### Shot list for one stat page

For **each range** the page offers (1d, 7d, 4w, 1y — whatever the app shows) and for
**offset 0 and −1** (the previous period, via the period arrow left of the date):
1. The top of the page.
2. A screen further down at a time, to the end of the page. Overlap is fine.
3. Every tab or segmented control (e.g. Score/Coach, Timeline/Stages): switch, re-shoot the
   affected section.
4. Every overlay chip on a chart: tap it, shoot the chart.
5. Every tappable card/row that opens a sub-page (factor pages, history sheets, detail
   pages): open it, shoot it fully (and its ranges, if it has them), go back.
6. Each info (i) sheet once, for its copy. Bottom sheets (e.g. Sleep History) close with a
   downward drag or their close button. Day/week cards on stat pages switch the same page to
   that day/week rather than opening a new page — shoot the switched state and switch back.

Lifestyle Logging logs on a single tap: on that page, touch nothing but the range control and
back.

### Shot list for a detail page

A detail page (one activity, one snapshot) has no ranges. Shoot each tab or segment from the
top to the end, then every picker and dropdown open, every sheet (info, help, settings), the
landscape full-screen chart once per overlay chip, and any map with each of its settings.
Save, edit and share nothing on the way. Shots go in `phone/<tab>/` instead of
`phone/<range>/` (e.g. `activity-details/outdoor-run/phone/charts-time/03-scroll-2.png`).

Naming: `ref/<area>/<stat>/phone/<range>[-prev]/NN-<slug>.png` + `NN-<slug>.ocr.json`
(e.g. `stress/phone/7d-prev/03-scroll-2.png`). Sub-pages:
`phone/<range>/sub-<slug>/NN-….png`. Write `phone/INDEX.md`: one line per shot — file,
capture time, the date label on screen (`Oct 7`, `Oct 1–7`), what it shows.

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
