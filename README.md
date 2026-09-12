# Garmin Connect for Obsidian

Syncs Garmin Connect health data into your daily notes as frontmatter properties
— **on mobile as well as the desktop**, which is the part nobody had solved.

**Status: phase 2 + dashboard.** Authentication, session persistence, the typed
API core, the sync engine and the dashboard are done and tested (177 tests).
The UI is Svelte 5. MFA is not supported yet, and
the UI is functional rather than polished.

## Where the data goes

By default, **one note per day in a folder of its own**, with the metrics as
frontmatter properties:

```yaml
# Garmin/2026-09-12.md
---
date: 2026-09-12
steps: 8432
distance_km: 6.21
resting_hr: 48
sleep_hours: 7.5
sleep_score: 82
body_battery_high: 88
hrv_avg: 42
training_readiness: 71
workouts:
  - name: Morning Run
    type: running
    start: 2026-09-12T07:31
    minutes: 31
    distance_km: 5.12
---
```

On the first sync that writes something, an Obsidian **Bases view** is generated
next to it (`Garmin/Garmin Health.base`) so the folder reads as a sortable,
filterable table:

| Date | Steps | Resting HR | Sleep (h) | Readiness |
| --- | --- | --- | --- | --- |
| 2026-09-12 | 8432 | 48 | 7.5 | 71 |
| 2026-09-11 | 6110 | 51 | 6.8 | 64 |

That is the table without the markdown table. A markdown table would be inert
text — Dataview and Bases both query *properties*, not table rows — so this way
you get the same view and can still ask "resting HR on days I ran more than
10 km". The view is created once and never overwritten, so any columns or
filters you change by hand survive. *Rebuild the Garmin table view* regenerates
it from current settings when you want that.

### Or daily notes, or both

**Settings → Storage** switches between:

| Mode | Behaviour |
| --- | --- |
| **Data folder** (default) | One note per day in `Garmin/`. Never touches notes you wrote. Every day is writable, so backfill works with nothing existing first. Properties unprefixed — nothing to collide with. |
| **Daily notes** | Properties go into the daily note you already keep, prefixed `garmin_` so they cannot collide. Only writes to notes that already exist unless you turn on *Create missing notes*. |
| **Both** | Writes to each. A day counts as written if either took it. |

## The dashboard

**Open dashboard** (ribbon, or the command palette) opens a pane of charts drawn
from whatever has been synced — stat tiles with week-over-week deltas and
sparklines, a steps column chart against your goal, sleep by stage, and small
multiples for resting HR, HRV, Body Battery and training readiness. A range row
(30 days / 90 days / 1 year) scopes everything below it, and a **Table** toggle
swaps the whole view for the same numbers as text.

The same row carries **Sync** (the last few days) and **Backfill…** (any range
you pick), with a status line underneath saying what the vault currently holds —
"Data through 12 Sep · 386 days stored" — so the dashboard is where you both read
the data and fetch it.

The UI is **Svelte 5**, set up the way [Obsidian's guide][svelte-guide]
prescribes: `esbuild-svelte` in the build, components mounted with `mount()` and
torn down with `unmount()`. The charts are hand-drawn SVG — no chart library, no
CDN, because an Obsidian plugin cannot load external scripts and a bundled chart
library would be dead weight on a phone. What Svelte buys here is that a chart is
now markup instead of DOM-construction code, and that `bind:clientWidth` replaces
a ResizeObserver plus a measure-then-draw second pass: each chart simply sizes
itself to the card it lands in.

[svelte-guide]: https://docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin

A few choices worth knowing, since they are easy to get wrong:

- **Sleep stages take an ordinal ramp of one hue, not four colours.** Deep →
  light → REM → awake is an *ordered* scale, so four categorical hues would be
  encoding order as identity. The four blue steps were checked with the palette
  validator against Obsidian's light and dark surfaces.
- **No dual-axis charts anywhere.** Two measures of different scale get two
  charts. Resting HR, HRV, Body Battery and readiness are small multiples with
  one axis each.
- **Colour never carries meaning alone.** The sleep chart has a legend; delta
  chips lead with an arrow; every chart has the table view as its twin.
- **Deltas know which way is good.** A falling resting heart rate is green and a
  rising one is red — the opposite of steps. Deltas compare the last seven days
  against the seven before, because a single day of Garmin data swings too much
  to be a trend.
- **Themes.** Chrome follows Obsidian's own CSS variables, so the dashboard
  matches your theme; only the series colours are fixed, and both light and dark
  steps were validated against the surfaces they render on.
- **Settings keep native controls.** The settings panel is a Svelte component,
  but every row is built with Obsidian's own `Setting` API through a small
  action. Hand-rolling toggles and sliders would mean re-implementing Obsidian's
  look and its mobile behaviour and getting both subtly wrong. Svelte decides
  which rows exist — so switching storage mode now shows and hides sections
  instead of rebuilding the whole pane and losing your scroll position.

### What gets collected

Seven metric groups, each switchable: **activity** (steps, distance, calories,
floors, intensity minutes), **heart** (resting/min/max), **sleep** (duration,
stages, score, start and end), **stress and Body Battery**, **HRV**, **training
readiness**, and **workouts**. Turning a group off also stops the request that
fetches it, and drops its columns from a rebuilt table view.

---

## Setup

```bash
npm install
npm run build      # typecheck → 177 tests → bundle → mobile-safety check
```

Reload community plugins in Obsidian, enable **Garmin Connect**, then:

1. **Sign in to Garmin Connect** (command palette, or the button in settings).
   Your password is used for that one request and never written anywhere.
2. **Sync recent days** — or bind the ribbon icon, which does the same.

On mobile the plugin arrives through vault sync like any other file; enable it
in *Settings → Community plugins* and sign in there too. The two devices keep
separate sessions.

### Commands

| Command | What it does |
| --- | --- |
| Sync recent days | The last *N* days (default 3) |
| Sync today | Just today |
| Sync a date range… | Backfill, with a request estimate before you commit |
| Open dashboard | The charts pane |
| Rebuild the Garmin table view | Regenerates the Bases view from current settings |
| Sign in to Garmin Connect | |
| Run connectivity probe | Diagnostics — see below |

---

## How syncing behaves

**A day with nowhere to go costs nothing.** The target decides whether a day is
writable, and it decides *before any request is made*. In daily-notes mode with
*Create missing notes* off, a day without a note is skipped for free — so a
sparse range barely touches the network. The data folder always says yes, which
is why backfill works there.

**In daily-notes mode it finds your notes the way Obsidian does.** Folder and
date format come from the core Daily Notes plugin, with overrides in settings.
A note you have moved is still found by name.

**Re-syncing is free.** Before writing, the incoming properties are compared
against what is already in the frontmatter; if nothing would change, the file is
not touched. That matters with Obsidian Sync or LiveSync, which both treat a
bumped mtime as a change to propagate.

**It syncs more than one day on purpose.** Garmin keeps revising a day after it
ends — sleep is finalised late, and a watch that syncs in the morning rewrites
yesterday. Three days is the default.

**It backs off rather than digging in.** A 429 or a dead session abandons the
whole range immediately, because every later request would fail the same way. A
single endpoint failing for a single day is just a warning: the rest of that day
still gets written.

**It stops when it runs off the end of your history.** Backfills are unbounded —
you can ask for 2010 — but a range that reaches past the start of your Garmin
data would otherwise keep asking, four requests a day, until Garmin rate-limits
it. Since the sync walks newest to oldest, that empty region is always the tail,
so after 45 consecutive days with nothing in them (configurable; 0 disables) it
gives up and says so: *"nothing found for 45 days running, back to 2024-11-28 —
the account looks to have no data older than that"*. Nothing bogus is ever
written for those days; a day with no usable numbers is skipped, not stored as
zeroes.

**Request budget.** Roughly *groups needed* × *days with notes*, plus one paged
call for the activity list across the whole range — not one per day. The sync
runs newest day first, so a run cut short by a rate limit covered the days you
actually care about. There is a configurable pause between days.

---

## Please be careful with

- **Rate limits and lockout.** Garmin limits login attempts per IP and can lock
  an account after repeated failures. Sign in deliberately; if you see a 429,
  wait 15–30 minutes.
- **The password is never stored.** It is typed in, used for one sign-in, and
  dropped. Only a refresh token and its DI client ID are written to `data.json`.
  *If you ran the phase 0 build*, it did store your password there. The plugin
  now deletes it on load and says so with a notice — but it sat in a synced vault
  for a while, so changing your Garmin password is the cautious move.
- **That refresh token is durable account access** sitting in a file your vault
  syncs. Sign out from settings when you are done with a device.
- **`tls.peet.ws`.** A third-party echo service, contacted only when you press
  the fingerprint button in the probe, and only ever sent a User-Agent string.

---

## The part that could have killed this

`cyberjunky/python-garminconnect` is the reference implementation. Since its
post-garth rewrite it authenticates like the mobile app: a JSON POST to
`sso.garmin.com/mobile/api/login`, then a service-ticket exchange at
`diauth.garmin.com` for OAuth2 bearer tokens. No OAuth1, no HMAC signing — the
flow ports to TypeScript cleanly.

The problem was the front door. It installs `curl_cffi` to **forge TLS
fingerprints** and sleeps 10–20 s before login POSTs so Cloudflare's WAF does not
flag the burst. From Obsidian you get `requestUrl` — Electron's stack on the
desktop, the OS HTTP client on mobile — and you do not choose the fingerprint.

**Measured 2026-09-12, both platforms authenticate end to end:**

| | Desktop (Electron) | iOS (OS stack) | curl |
| --- | --- | --- | --- |
| JA4 | `t13d1516h2_8daaf6152771_02713d6af862` | `t13d2013h2_a09f3c656075_7f0f34a4126d` | — |
| UA override honoured | yes | yes | n/a |
| Login POST | 200 `SUCCESSFUL` | 200 `SUCCESSFUL` | 405 on GET |

Three different TLS fingerprints all passed — including the desktop's, which is
Chromium TLS carrying an iPhone `User-Agent`, an obvious mismatch Cloudflare did
not punish. **Garmin is not enforcing TLS fingerprinting on `/mobile/api/*`**,
which is why this works without `curl_cffi`. Note also that the human-facing
sign-in page at `/portal/sso/en-US/sign-in` returns a 403 challenge even to
plain curl: the two paths are in different protection buckets.

That is a server-side policy, not a guarantee. Garmin can tighten it any day and
there would be no workaround from inside Obsidian — which is why an edge refusal
is surfaced as its own error rather than a generic "sync failed".

Two other things phase 0 settled: `expires_in` came back as 66341 s on one run
and 97344 s on another, so the access-token lifetime is not fixed and is always
read from the response; and the login response returns seven cookies glued into
one `Set-Cookie` header, which the jar splits correctly.

---

## How this is built

```
src/http.ts              HttpClient, CookieJar                — imports nothing
src/log.ts               the Log interface + probe renderer
src/garmin/
  constants.ts           endpoints, client IDs, native headers
  errors.ts              typed failures (Auth / Blocked / RateLimit / Api / Network)
  auth.ts                sign-in: login, MFA, ticket exchange
  tokens.ts              TokenStore, expiry, refresh
  client.ts              authenticated transport: refresh, 401 retry
  endpoints.ts           typed API wrappers (extends client)
src/sync/
  metrics.ts             Garmin payloads → properties     — pure
  diff.ts                the dirty check                  — pure
  bases-view.ts          generates the Bases table view   — pure
  engine.ts              orchestration, MultiTarget       — pure
  daily-note.ts          NoteTarget: your daily notes
  data-folder.ts         NoteTarget: one note per day
  frontmatter.ts         shared dirty-checked write
  runner.ts              settings → a run, and reporting
src/dashboard/
  series.ts              rows → series, stats, formatting  — pure
  scales.ts              chart geometry, ticks, paths      — pure
  metrics.ts             what is shown and how it behaves  — pure
  collect.ts             reads days back out of the vault
  view.ts                the Obsidian ItemView, mounts Svelte
src/ui/svelte/
  Dashboard.svelte       root: filters, tiles, cards, table
  Chart.svelte           shared frame: scale, axes, hit bands, tooltip
  ColumnChart / LineChart / BandChart / StackedChart
  StatTile / Sparkline / Legend / Card / FilterBar / DataTable
  LoginForm / SyncRangeForm / ProbePanel / SettingsPanel
  obsidian-setting.ts    action that drops a native Setting row into markup
src/obsidian-http.ts     requestUrl adapter   — the only Obsidian import in the auth path
src/fetch-http.ts        fetch adapter        — Node harness and tests
src/testing/             fixture transport
src/probe.ts, ui/, …     plugin layer         — Obsidian freely
```

Two seams carry the whole design. **HTTP is injected**, so the Garmin logic runs
unchanged under `requestUrl` on a phone, under `fetch` in Node, or against
recorded fixtures in a test. **The note target is injected**, so the sync engine
— dates, budgets, back-off, partial failures — is pure and testable with no
Obsidian at all. Adding the data-folder mode needed no engine change: it is one
more `NoteTarget`.

The reason "build `node-garminconnect` first, consume it from the plugin" fails
is not that libraries are wrong — it is that a Node library bakes in Node
assumptions (`https`, `tough-cookie`, `axios`) you then cannot remove for a
mobile WebView. Starting transport-agnostic gets both.

### What the client does for you

- **Refresh ahead of expiry**, with a five-minute margin, reading `expires_in`
  from the response rather than assuming a lifetime.
- **One refresh for concurrent callers.** A day touching four endpoints at once
  triggers a single token exchange, not four.
- **401 → refresh once → retry once**, then give up. If a concurrent request
  already refreshed past the token that failed, the retry uses theirs.
- **Rotation is persisted.** Garmin may hand back a new refresh token on use;
  dropping it would strand the session days later for no visible reason.
- **A failed re-login leaves a working session alone.** A 429 while signing in
  again should not sign you out of the session you had.
- **403 is triaged.** A JSON 403 is the API declining; a non-JSON 403 is the edge
  declining. Different problems, different errors.

### Two things a port must get right

- **`requestUrl` throws on status ≥ 400** unless you pass `throw: false`, and a
  403 body is exactly what you need when diagnosing a challenge.
- **`requestUrl` keeps no cookie jar**, and `headers` is `Record<string, string>`,
  so multiple `Set-Cookie` values arrive comma-joined — and cookie expiry dates
  contain commas too. `splitSetCookie` splits only on a comma followed by a
  `token=`.

---

## Diagnostics

*Run connectivity probe* opens a modal with three checks. Every run writes its
log to `garmin-probe-logs/` in the vault, which on a phone is the only practical
way to read the output — there is no console, and the file syncs back to your
desktop like any other note.

**1. Network fingerprint** — asks `tls.peet.ws` what this platform looks like on
the wire. Reports the UA the server actually saw (if `requestUrl` drops the
override, the rest is moot), JA3/JA4, and the HTTP version.

**2. Test login** — step 0 is a credential-free reachability check (a JSON `405`
from the POST-only login endpoint means the edge let us through), then the login
POST, then MFA if demanded, then the DI ticket exchange, then a live
`connectapi` call. That last step exists because a token can come back `200`
from the auth host and still be refused by the API tier.

**3. Test session persistence** — signs in if needed, then simulates a cold
start: drops the in-memory access token, reloads the refresh token from
`data.json`, mints a new access token from it alone, and makes two typed
endpoint calls. Fixtures prove the logic; only this proves Garmin agrees.

| Verdict | What it means |
| --- | --- |
| `SUCCESS` | This platform can authenticate. |
| `BLOCKED` | Cloudflare refused the client. If step 0 passed and step 1 got a 403, the path is open and it is the credential POST being scored — retrying will not help. |
| `RATE-LIMITED` | A 429. Not a verdict. Wait 15–30 minutes; do not retry in a loop. |
| `BAD-CREDENTIALS` | Wrong email or password. Fix it before re-running — repeated failures can lock the account. |
| `FAILED` | Read the step that failed. Step 3 failing after step 1 succeeded means Garmin rotated the DI client IDs; re-check `DI_CLIENT_IDS` against python-garminconnect master. |

---

## Tests

```bash
npm test            # 177 tests, no network, no Obsidian
npm run build       # typecheck → svelte-check → tests → bundle → mobile-safety check
npm run preview:dashboard  # build the browser preview of the dashboard
npm run probe:node  # runs the real auth module under Node, step 0 only
```

Tests bundle with esbuild and run on Node's built-in runner. `FixtureHttpClient`
replays canned responses in order, which is how sequences like "401, then
refresh, then success" and "first DI client ID rejected, second accepted" are
expressed. Nothing of ours is mocked — the fixtures sit at the transport seam,
and the sync engine's doubles sit at the note-target seam, so what is under test
is the real code.

The chart components import nothing from Obsidian, which is what lets
`npm run preview:dashboard` mount the real `Dashboard.svelte` in a plain browser
with synthetic data. Open `scripts/.preview/index.html` to see it, or
append `#dark` for the dark theme. That is how the layout gets checked without
launching Obsidian.

`npm run build` fails if a node or electron require leaks into the bundle. That
is the bug class that loads fine on the desktop and throws on the phone, where it
is hardest to debug.

---

## What comes next

See [TODO.md](TODO.md). **MFA is the big one** — `verifyMfa()` is written and
typechecked but has never run, because the test account is never challenged, so
`login()` raises `GarminMfaRequiredError` rather than pretending to handle it.

## If it ever stops working

If Garmin tightens the edge later, the cheap things to try before giving up are:
the Android client (`GCM_ANDROID_DARK` with the `/gcm/android` service URL)
instead of iOS; matching more of the real app's header set and ordering; and the
SSO embed widget flow, which uses an HTML form and lands in a different
rate-limit bucket. All three are in python-garminconnect and none need TLS
forgery.

Prior art: **Garmin Health Sync** does the same job but is `isDesktopOnly: true`,
because it authenticates through an Electron `BrowserWindow` and uses the old
OAuth1 endpoints. Mobile was the gap.
